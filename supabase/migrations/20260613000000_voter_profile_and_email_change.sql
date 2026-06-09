-- Migration 20260613000000: Voter Profile Editing & Secure Email Change Flow

-- 1. Alter voters table: Add columns
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create updated_at trigger for voters table
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_voters_updated_at ON public.voters;
CREATE TRIGGER trg_voters_updated_at
    BEFORE UPDATE ON public.voters
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create email change requests table
CREATE TABLE IF NOT EXISTS public.email_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    current_email TEXT NOT NULL,
    new_email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    failed_attempts INT DEFAULT 0 NOT NULL,
    locked_until TIMESTAMPTZ,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own email change requests" ON public.email_change_requests;
CREATE POLICY "Users can manage own email change requests"
ON public.email_change_requests
FOR ALL TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- 4. Create update_voter_profile RPC
CREATE OR REPLACE FUNCTION public.update_voter_profile(
    p_full_name TEXT,
    p_phone_number TEXT,
    p_department TEXT,
    p_profile_photo_url TEXT
)
RETURNS jsonb AS $$
DECLARE
    v_roll_number TEXT;
BEGIN
    -- Check auth
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT roll_number INTO v_roll_number FROM public.voters WHERE auth_user_id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    UPDATE public.voters
    SET full_name = p_full_name,
        phone_number = p_phone_number,
        department = p_department,
        profile_photo_url = p_profile_photo_url
    WHERE auth_user_id = auth.uid();

    -- Log audit event
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('PROFILE_UPDATED', v_roll_number, 'Voter updated profile information (Name: ' || p_full_name || ', Dept: ' || p_department || ').');

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Profile updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create request_email_change RPC
CREATE OR REPLACE FUNCTION public.request_email_change(
    p_new_email TEXT
)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_current_email TEXT;
    v_roll_number TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_request_id UUID;
    v_dev_mode TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    -- Get current email and roll number
    SELECT email, roll_number INTO v_current_email, v_roll_number
    FROM public.voters
    WHERE auth_user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    -- Ensure new email is not already in use in voters table
    IF EXISTS (
        SELECT 1 FROM public.voters WHERE email = p_new_email
    ) THEN
        RAISE EXCEPTION 'Email address already in use.';
    END IF;

    -- Generate a 6-digit OTP
    v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');

    -- Insert into requests
    INSERT INTO public.email_change_requests (
        auth_user_id,
        current_email,
        new_email,
        otp_hash,
        expires_at
    ) VALUES (
        v_user_id,
        v_current_email,
        p_new_email,
        v_otp_hash,
        NOW() + INTERVAL '10 minutes'
    ) RETURNING id INTO v_request_id;

    -- Log OTP to debug table if in dev mode
    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    IF COALESCE(v_dev_mode, 'false') = 'true' THEN
        CREATE TABLE IF NOT EXISTS public.debug_email_change_otps (
            request_id UUID PRIMARY KEY,
            otp TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
        
        INSERT INTO public.debug_email_change_otps (request_id, otp)
        VALUES (v_request_id, v_otp)
        ON CONFLICT (request_id) DO UPDATE SET otp = v_otp;
    END IF;

    -- Log audit trail
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('EMAIL_CHANGE_REQUESTED', v_roll_number, 'Voter requested email change from ' || v_current_email || ' to ' || p_new_email || '.');

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create verify_email_change_otp RPC
CREATE OR REPLACE FUNCTION public.verify_email_change_otp(
    p_request_id UUID,
    p_otp TEXT
)
RETURNS jsonb AS $$
DECLARE
    v_request RECORD;
    v_otp_hash TEXT;
    v_roll_number TEXT;
BEGIN
    -- Get request details
    SELECT * INTO v_request
    FROM public.email_change_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found.';
    END IF;

    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE auth_user_id = v_request.auth_user_id;

    -- Check lockout
    IF v_request.locked_until IS NOT NULL AND v_request.locked_until > NOW() THEN
        RAISE EXCEPTION 'Too many failed attempts. Cooldown active.';
    END IF;

    -- Check expiry
    IF v_request.expires_at < NOW() THEN
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('EMAIL_CHANGE_FAILED', COALESCE(v_roll_number, 'unknown'), 'Email change verification failed: OTP expired.');
        RAISE EXCEPTION 'Verification code has expired.';
    END IF;

    v_otp_hash := encode(digest(p_otp, 'sha256'), 'hex');

    -- Validate OTP
    IF v_request.otp_hash = v_otp_hash THEN
        -- Mark request as verified
        UPDATE public.email_change_requests
        SET verified = TRUE
        WHERE id = p_request_id;

        -- Log audit trail
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('EMAIL_CHANGE_VERIFIED', COALESCE(v_roll_number, 'unknown'), 'Email change OTP verified successfully.');

        RETURN jsonb_build_object(
            'success', true,
            'message', 'OTP verified successfully.'
        );
    ELSE
        -- Increment failed attempts
        UPDATE public.email_change_requests
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
        WHERE id = p_request_id;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('EMAIL_CHANGE_FAILED', COALESCE(v_roll_number, 'unknown'), 'Email change verification failed: Invalid OTP.');

        RAISE EXCEPTION 'Invalid verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create finalize_email_change RPC
CREATE OR REPLACE FUNCTION public.finalize_email_change(
    p_request_id UUID
)
RETURNS jsonb AS $$
DECLARE
    v_request RECORD;
    v_roll_number TEXT;
BEGIN
    SELECT * INTO v_request
    FROM public.email_change_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found.';
    END IF;

    -- Ensure request was verified and belongs to the authenticated user
    IF auth.uid() IS NULL OR v_request.auth_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    IF COALESCE(v_request.verified, FALSE) = FALSE THEN
        RAISE EXCEPTION 'Request is not verified.';
    END IF;

    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE auth_user_id = auth.uid();

    -- Update voters table email
    UPDATE public.voters
    SET email = v_request.new_email
    WHERE auth_user_id = auth.uid();

    -- Delete pending request
    DELETE FROM public.email_change_requests WHERE id = p_request_id;
    
    -- Delete debug OTP if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'debug_email_change_otps'
    ) THEN
        DELETE FROM public.debug_email_change_otps WHERE request_id = p_request_id;
    END IF;

    -- Log audit trail
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('EMAIL_CHANGED', COALESCE(v_roll_number, 'unknown'), 'Email address successfully updated from ' || v_request.current_email || ' to ' || v_request.new_email || '.');

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Email address successfully updated.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_voter_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_email_change(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_email_change_otp(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_email_change(UUID) TO authenticated;
