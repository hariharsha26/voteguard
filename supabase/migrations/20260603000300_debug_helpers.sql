-- System Settings & Debug Helpers
-- Phase 1: Database Schema Design (Debug Helpers)

-- 1. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to system settings for verified sessions and admins
CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated, anon
USING (TRUE);

CREATE POLICY "Admins can edit system settings"
ON public.system_settings
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Insert default debug_mode = true for local development
INSERT INTO public.system_settings (key, value)
VALUES ('debug_mode', 'true')
ON CONFLICT (key) DO NOTHING;

-- 2. PRIVATE DEBUG TOKENS TABLE (Stores plaintext tokens ONLY in debug mode)
CREATE TABLE IF NOT EXISTS private.debug_tokens (
    roll_number TEXT PRIMARY KEY REFERENCES public.voters(roll_number) ON DELETE CASCADE,
    token_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. FUNCTION TO CHECK IF DEBUG MODE IS ACTIVE
CREATE OR REPLACE FUNCTION public.is_debug_mode()
RETURNS BOOLEAN AS $$
DECLARE
    v_val TEXT;
BEGIN
    SELECT value INTO v_val FROM public.system_settings WHERE key = 'debug_mode';
    RETURN COALESCE(v_val = 'true', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. DEBUG RPC TO FETCH PLAINTEXT OTP
CREATE OR REPLACE FUNCTION public.debug_get_otp(p_session_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_val TEXT;
BEGIN
    -- Check if debug mode is active
    IF NOT public.is_debug_mode() THEN
        RAISE EXCEPTION 'Debug mode is not active.';
    END IF;

    -- Return a dummy OTP for testing, or we look it up if we store it
    -- For simplicity, if debug_mode is true, we will allow '123456' as valid OTP in verify_login_otp.
    RETURN '123456';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. DEBUG RPC TO FETCH GENERATED TOKEN
CREATE OR REPLACE FUNCTION public.debug_get_token(p_roll_number TEXT)
RETURNS TEXT AS $$
DECLARE
    v_token_val TEXT;
BEGIN
    -- Check if debug mode is active
    IF NOT public.is_debug_mode() THEN
        RAISE EXCEPTION 'Debug mode is not active.';
    END IF;

    SELECT token_value INTO v_token_val
    FROM private.debug_tokens
    WHERE roll_number = p_roll_number;

    RETURN v_token_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- UPDATE VERIFY_LOGIN_OTP FOR DEBUG MODE
-- ==========================================

CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_session_id UUID;
    v_otp_hash TEXT;
    v_client_ip TEXT;
    v_roll_number TEXT;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    -- Apply rate limit check
    PERFORM public.rate_limit_check(v_client_ip);

    -- Get session ID from JWT
    v_session_id := COALESCE((auth.jwt() ->> 'session_id')::UUID, '00000000-0000-0000-0000-000000000000'::UUID);

    -- Hash input code
    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    -- Verify OTP (Check both database hash and debug default '123456' if debug_mode is active)
    IF EXISTS (
        SELECT 1 FROM private.voter_login_otps
        WHERE session_id = v_session_id
        AND otp_hash = v_otp_hash
        AND expires_at > NOW()
    ) OR (public.is_debug_mode() AND p_otp_code = '123456') THEN
        -- Clear OTP record
        DELETE FROM private.voter_login_otps WHERE session_id = v_session_id;

        -- Record session verification status
        INSERT INTO public.session_verifications (session_id, is_verified)
        VALUES (v_session_id, TRUE)
        ON CONFLICT (session_id)
        DO UPDATE SET is_verified = TRUE;

        -- Log event
        SELECT roll_number INTO v_roll_number FROM public.voters WHERE id = auth.uid();
        INSERT INTO public.audit_logs (event_type, actor, description)
        VALUES ('OTP Verified', COALESCE(v_roll_number, 'admin'), 'Email MFA code successfully verified.');

        -- Reset rate limits
        UPDATE public.rate_limits SET failed_attempts = 0, locked_until = '-infinity'::TIMESTAMPTZ WHERE identifier = v_client_ip;

        RETURN TRUE;
    ELSE
        -- Track failed attempt
        PERFORM public.rate_limit_fail(v_client_ip);
        RAISE EXCEPTION 'Invalid or expired verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
