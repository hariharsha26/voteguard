-- Migration 20260604000500: Authentication Reset, RLS Lookup Policies, Dev OTP Override, and Fresh Seeds

-- 1. CLEANUP OLD AUTHENTICATION DATA
-- Delete verified sessions
DELETE FROM public.verified_sessions;

-- Delete email OTP records
DELETE FROM public.email_otps;

-- Delete old audit logs related to auth testing
DELETE FROM public.audit_logs WHERE event_type IN ('LOGIN_SUCCESS', 'OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'SESSION_LOGOUT', 'TOKEN_REQUESTED', 'TOKEN_DELIVERED', 'TOKEN_REGENERATED', 'TOKEN_VERIFIED', 'VOTE_SUBMITTED');

-- Delete old super admin and voter profiles
DELETE FROM public.voters WHERE email IN ('hariharshahello56@gmail.com', 'hariharsha@voteguard.org', 'hariharshahello@gmail.com', 'dynamax_gamer26@voteguard.org');
DELETE FROM public.super_admins WHERE email IN ('hariharshahello56@gmail.com', 'hariharsha@voteguard.org', 'hariharshahello@gmail.com', 'dynamax_gamer26@voteguard.org');

-- Delete associated auth users (which will automatically cascade if there are foreign keys, but we do it explicitly)
DELETE FROM auth.users WHERE email IN ('hariharshahello56@gmail.com', 'hariharsha@voteguard.org', 'hariharshahello@gmail.com', 'dynamax_gamer26@voteguard.org');


-- 2. ADD RLS LOOKUP POLICIES FOR CLIENT-SIDE EMAIL RESOLUTION
DROP POLICY IF EXISTS "Anyone can lookup email by roll number" ON public.voters;
CREATE POLICY "Anyone can lookup email by roll number"
ON public.voters
FOR SELECT
TO authenticated, anon
USING (TRUE);

DROP POLICY IF EXISTS "Anyone can lookup admin email by admin ID" ON public.super_admins;
CREATE POLICY "Anyone can lookup admin email by admin ID"
ON public.super_admins
FOR SELECT
TO authenticated, anon
USING (TRUE);

DROP POLICY IF EXISTS "Super admins can manage all super admin profiles" ON public.super_admins;
CREATE POLICY "Super admins can manage all super admin profiles"
ON public.super_admins
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());


-- 3. SEED DEV MODE SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES 
  ('dev_mode', 'true'),
  ('default_otp', '20071226')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- 4. REFACTOR OTP FUNCTIONS FOR DEV OVERRIDE
-- A. verify_login_otp
CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_otp_hash TEXT;
    v_otp RECORD;
    v_client_ip TEXT;
    v_actor TEXT;
    v_dev_mode TEXT;
    v_default_otp TEXT;
    v_is_dev_otp BOOLEAN;
BEGIN
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

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

    SELECT roll_number INTO v_actor FROM public.voters WHERE auth_user_id = v_user_id;
    IF NOT FOUND THEN
        SELECT admin_id INTO v_actor FROM public.super_admins WHERE auth_user_id = v_user_id;
    END IF;

    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    -- Fetch dev settings
    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    SELECT value INTO v_default_otp FROM public.system_settings WHERE key = 'default_otp';

    v_is_dev_otp := (COALESCE(v_dev_mode, 'false') = 'true' AND p_otp_code = COALESCE(v_default_otp, '20071226'));

    SELECT * INTO v_otp
    FROM public.email_otps
    WHERE auth_user_id = v_user_id
    AND used = FALSE
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF (v_otp.id IS NOT NULL AND v_otp.otp_code = v_otp_hash) OR v_is_dev_otp THEN
        IF v_otp.id IS NOT NULL THEN
            UPDATE public.email_otps SET used = TRUE WHERE id = v_otp.id;
        END IF;

        INSERT INTO public.verified_sessions (auth_user_id, session_id, verified, verified_at, expires_at)
        VALUES (v_user_id, v_session_id, TRUE, NOW(), NOW() + interval '8 hours')
        ON CONFLICT (auth_user_id, session_id)
        DO UPDATE SET verified = TRUE, verified_at = NOW(), expires_at = NOW() + interval '8 hours';

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_VERIFIED', v_actor, 'Session successfully verified.');
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('LOGIN_SUCCESS', v_actor, 'User session fully authenticated.');

        UPDATE public.rate_limits SET failed_attempts = 0, locked_until = NULL WHERE identifier = v_client_ip;

        RETURN TRUE;
    ELSE
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_FAILED', COALESCE(v_actor, 'unknown'), 'Invalid verification code submitted.');

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

-- B. generate_login_otp
CREATE OR REPLACE FUNCTION public.generate_login_otp()
RETURNS TABLE (email text, debug_otp text) AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_actor TEXT;
    v_dev_mode TEXT;
    v_default_otp TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Session is not authenticated.';
    END IF;
    
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

    -- Fetch dev settings
    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    SELECT value INTO v_default_otp FROM public.system_settings WHERE key = 'default_otp';
    
    IF COALESCE(v_dev_mode, 'false') = 'true' THEN
        v_otp := COALESCE(v_default_otp, '20071226');
    ELSE
        v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    END IF;
    
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
    
    INSERT INTO public.email_otps (auth_user_id, otp_code, expires_at)
    VALUES (v_user_id, v_otp_hash, NOW() + interval '10 minutes');
    
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('OTP_SENT', v_actor, 'Email verification code dispatched.');
    
    IF COALESCE(v_dev_mode, 'false') = 'true' OR EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true') THEN
        RETURN QUERY SELECT v_email, v_otp;
    ELSE
        RETURN QUERY SELECT v_email, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. SEED FRESH SUPER ADMIN ACCOUNT (auth.users)
-- Email: dynamax_gamer26@voteguard.org
-- ID: 26-L34-A4416
-- Name: Hari Harsha
-- Password: honey@26HARS
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    phone_change_token,
    email_change,
    phone
) VALUES (
    '46a98e3c-7f26-4ee9-9724-1115c0489b56',
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'dynamax_gamer26@voteguard.org',
    crypt('honey@26HARS', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
    '{"full_name": "Hari Harsha", "admin_id": "26-L34-A4416", "uid": "dynamax_gamer26", "role": "super_admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    ''
);


-- 6. SEED FRESH VOTER ACCOUNT (auth.users)
-- Email: hariharshahello@gmail.com
-- Roll: 25L35A4416
-- Name: Hari Harsha Ummidi
-- Dept: CSE-DS
-- Phone: 9346293891
-- Password: honey@26HARS
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    phone,
    phone_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    phone_change_token,
    email_change
) VALUES (
    'f4407909-6cc7-4a6e-a897-f4380b935af0',
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'hariharshahello@gmail.com',
    crypt('honey@26HARS', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"], "role": "voter"}'::jsonb,
    '{"full_name": "Hari Harsha Ummidi", "roll_number": "25L35A4416", "department": "CSE-DS", "role": "voter"}'::jsonb,
    '9346293891',
    now(),
    now(),
    now(),
    '',
    '',
    '',
    '',
    ''
);

