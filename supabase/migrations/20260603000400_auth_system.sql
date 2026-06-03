-- Phase 2 — Authentication, Authorization & Security Layer
-- Setup for Voter profile auth mapping, Super Admin, Email OTP, and Verified Sessions

-- 1. UPDATE VOTERS TABLE
ALTER TABLE public.voters 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. CREATE SUPER ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id TEXT UNIQUE NOT NULL,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- 3. CREATE EMAIL OTPS TABLE
CREATE TABLE IF NOT EXISTS public.email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    otp_code TEXT NOT NULL, -- SHA-256 Hash of OTP
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- 4. CREATE VERIFIED SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.verified_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT verified_sessions_user_session_unique UNIQUE (auth_user_id, session_id)
);
ALTER TABLE public.verified_sessions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AUTOMATIC PROFILE SYNCHRONIZATION TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Check role from app_metadata or user_metadata
    v_role := COALESCE(NEW.raw_app_meta_data ->> 'role', NEW.raw_user_meta_data ->> 'role');

    IF v_role = 'super_admin' THEN
        INSERT INTO public.super_admins (auth_user_id, admin_id, full_name, email)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'admin_id', 'VG-SUPER-' || LPAD(FLOOR(RANDOM()*1000)::text, 3, '0')),
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Super Admin'),
            NEW.email
        );
    ELSE
        -- Update or insert voter profile
        INSERT INTO public.voters (auth_user_id, roll_number, email, full_name, department)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'roll_number', ''),
            NEW.email,
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
            NEW.raw_user_meta_data ->> 'department'
        )
        ON CONFLICT (roll_number) 
        DO UPDATE SET 
            auth_user_id = EXCLUDED.auth_user_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            department = EXCLUDED.department;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==========================================
-- SECURITY HELPER FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check claim in JWT
    RETURN COALESCE(auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_session_verified()
RETURNS BOOLEAN AS $$
BEGIN
    -- Super Admins bypass active voter session checking if they are validated
    IF public.is_super_admin() THEN
        -- Verify that super admin has a verified session
        RETURN EXISTS (
            SELECT 1 FROM public.verified_sessions
            WHERE auth_user_id = auth.uid()
            AND session_id = auth.jwt() ->> 'session_id'
            AND verified = TRUE
            AND expires_at > NOW()
        );
    END IF;

    -- Standard Voter session verification check
    RETURN EXISTS (
        SELECT 1 FROM public.verified_sessions
        WHERE auth_user_id = auth.uid()
        AND session_id = auth.jwt() ->> 'session_id'
        AND verified = TRUE
        AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- OTP GENERATION & VERIFICATION RPCs
-- ==========================================

-- 1. REQUEST / GENERATE LOGIN OTP
CREATE OR REPLACE FUNCTION public.generate_login_otp()
RETURNS TABLE (email text, debug_otp text) AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_actor TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Session is not authenticated.';
    END IF;
    
    -- Lookup user email and identify actor name for audit
    SELECT voters.email, voters.roll_number INTO v_email, v_actor
    FROM public.voters
    WHERE auth_user_id = v_user_id;

    IF NOT FOUND THEN
        SELECT super_admins.email, super_admins.admin_id INTO v_email, v_actor
        FROM public.super_admins
        WHERE auth_user_id = v_user_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Voter or Administrator profile not found.';
        END IF;
    END IF;
    
    -- Generate 6 digit OTP
    v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
    
    -- Save to OTP table
    INSERT INTO public.email_otps (auth_user_id, otp_code, expires_at)
    VALUES (v_user_id, v_otp_hash, NOW() + interval '10 minutes');
    
    -- Log event
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('OTP Sent', v_actor, 'Email verification code dispatched.');
    
    -- Support debug mode for local DX
    IF EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true') THEN
        RETURN QUERY SELECT v_email, v_otp;
    ELSE
        RETURN QUERY SELECT v_email, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. VERIFY LOGIN OTP RPC
CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_otp_hash TEXT;
    v_otp RECORD;
    v_client_ip TEXT;
    v_actor TEXT;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    -- Check active cooldowns
    IF EXISTS (
        SELECT 1 FROM public.rate_limits
        WHERE identifier = v_client_ip AND locked_until > NOW()
    ) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Cooldown active.';
    END IF;

    v_user_id := auth.uid();
    v_session_id := auth.jwt() ->> 'session_id';
    
    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RAISE EXCEPTION 'Authentication credentials invalid.';
    END IF;

    -- Lookup actor identifier for logging
    SELECT roll_number INTO v_actor FROM public.voters WHERE auth_user_id = v_user_id;
    IF NOT FOUND THEN
        SELECT admin_id INTO v_actor FROM public.super_admins WHERE auth_user_id = v_user_id;
    END IF;

    -- Hash input code
    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    -- Fetch active OTP
    SELECT * INTO v_otp
    FROM public.email_otps
    WHERE auth_user_id = v_user_id
    AND used = FALSE
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    -- Verify (Bypass checking if debug default '123456' is active)
    IF (FOUND AND v_otp.otp_code = v_otp_hash) OR 
       (EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true') AND p_otp_code = '123456') 
    THEN
        -- Mark OTP as used
        IF v_otp.id IS NOT NULL THEN
            UPDATE public.email_otps SET used = TRUE WHERE id = v_otp.id;
        END IF;

        -- Record verified session (lasts 8 hours)
        INSERT INTO public.verified_sessions (auth_user_id, session_id, verified, verified_at, expires_at)
        VALUES (v_user_id, v_session_id, TRUE, NOW(), NOW() + interval '8 hours')
        ON CONFLICT (auth_user_id, session_id)
        DO UPDATE SET verified = TRUE, verified_at = NOW(), expires_at = NOW() + interval '8 hours';

        -- Audit Logs
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP Verified', v_actor, 'Session successfully verified.');
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('Login Success', v_actor, 'User session fully authenticated.');

        -- Clear Rate limits for this IP
        UPDATE public.rate_limits SET failed_attempts = 0, locked_until = NULL WHERE identifier = v_client_ip;

        RETURN TRUE;
    ELSE
        -- Track failed attempt
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP Failed', COALESCE(v_actor, 'unknown'), 'Invalid verification code submitted.');

        -- Apply progressive IP penalty
        INSERT INTO public.rate_limits (identifier, failed_attempts, locked_until)
        VALUES (v_client_ip, 1, NULL)
        ON CONFLICT (identifier)
        DO UPDATE SET 
            failed_attempts = public.rate_limits.failed_attempts + 1,
            locked_until = CASE 
                WHEN public.rate_limits.failed_attempts + 1 >= 21 THEN NOW() + interval '30 minutes'
                WHEN public.rate_limits.failed_attempts + 1 >= 16 THEN NOW() + interval '5 minutes'
                WHEN public.rate_limits.failed_attempts + 1 >= 11 THEN NOW() + interval '1 minute'
                WHEN public.rate_limits.failed_attempts + 1 >= 6 THEN NOW() + interval '30 seconds'
                ELSE NULL
            END;

        RAISE EXCEPTION 'Invalid or expired verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. LOGOUT CLEANUP RPC
CREATE OR REPLACE FUNCTION public.handle_logout()
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_actor TEXT;
BEGIN
    v_user_id := auth.uid();
    v_session_id := auth.jwt() ->> 'session_id';

    IF v_user_id IS NOT NULL THEN
        -- Find actor roll or admin ID
        SELECT roll_number INTO v_actor FROM public.voters WHERE auth_user_id = v_user_id;
        IF NOT FOUND THEN
            SELECT admin_id INTO v_actor FROM public.super_admins WHERE auth_user_id = v_user_id;
        END IF;

        -- Remove session verification record
        DELETE FROM public.verified_sessions
        WHERE auth_user_id = v_user_id AND session_id = v_session_id;

        -- Log logout
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('Logout', COALESCE(v_actor, 'unknown'), 'User manually ended secure session.');
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
