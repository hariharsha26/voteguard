-- Migration 20260618000000: Production Reset, OTP Hardening, and Account Seeding

-- 1. CLEANUP ALL DATA TABLES
TRUNCATE TABLE 
    public.votes, 
    public.tokens, 
    public.election_results, 
    public.election_summary,
    public.election_snapshots, 
    public.token_requests, 
    public.voter_participation, 
    public.audit_logs, 
    public.security_events, 
    public.suspicious_activity, 
    public.email_delivery_logs, 
    public.verified_sessions, 
    public.email_otps, 
    public.account_lockouts, 
    public.system_errors, 
    public.token_delivery_sessions, 
    public.token_attempts, 
    public.fingerprint_attempts, 
    public.backup_registry,
    public.candidates, 
    public.election_eligibility, 
    public.elections,
    public.email_change_requests
    CASCADE;

-- Clean auth users and public profiles
DELETE FROM auth.users;
TRUNCATE TABLE public.super_admins CASCADE;
TRUNCATE TABLE public.voters CASCADE;

-- 2. HARDEN SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES 
  ('dev_mode', 'false'),
  ('debug_mode', 'false'),
  ('production_lock', 'true'),
  ('college_code', 'L35')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

DELETE FROM public.system_settings WHERE key = 'default_otp';

-- 3. UPDATE EMAIL DELIVERY LOGS STATUS CONSTRAINT
ALTER TABLE public.email_delivery_logs DROP CONSTRAINT IF EXISTS email_delivery_logs_status_check;
ALTER TABLE public.email_delivery_logs ADD CONSTRAINT email_delivery_logs_status_check CHECK (status IN ('SENT', 'DELIVERED', 'FAILED', 'BOUNCED'));

-- 4. REDEFINE OTP FUNCTIONS
-- A. generate_login_otp(p_user_id)
CREATE OR REPLACE FUNCTION public.generate_login_otp(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (email text, debug_otp text) AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_actor TEXT;
    v_new_otp_id UUID;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    v_user_id := p_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Session is not authenticated.';
    END IF;

    -- Check lockout status
    IF EXISTS (
        SELECT 1 FROM public.account_lockouts
        WHERE auth_user_id = v_user_id AND otp_locked_until > NOW()
    ) THEN
        RAISE EXCEPTION 'OTP generation is locked due to excessive failures. Try again later.';
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
        v_is_admin := TRUE;
    END IF;

    -- Generate code (4 digits for Voter, 6 digits for Admin)
    IF v_is_admin THEN
        v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    ELSE
        v_otp := LPAD(FLOOR(RANDOM()*10000)::text, 4, '0');
    END IF;
    
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
    
    INSERT INTO public.email_otps (auth_user_id, otp_code, expires_at)
    VALUES (v_user_id, v_otp_hash, NOW() + interval '10 minutes')
    RETURNING id INTO v_new_otp_id;
    
    -- Log OTP event
    IF EXISTS (
        SELECT 1 FROM public.email_otps 
        WHERE auth_user_id = v_user_id AND used = FALSE AND created_at >= NOW() - interval '10 minutes' AND id <> v_new_otp_id
    ) THEN
        PERFORM public.log_security_event('OTP_RESENT', CASE WHEN v_is_admin THEN 'SUPER_ADMIN' ELSE 'VOTER' END, v_actor, NULL, NULL);
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_RESENT', v_actor, 'Email verification code resent.');
    ELSE
        PERFORM public.log_security_event('OTP_SENT', CASE WHEN v_is_admin THEN 'SUPER_ADMIN' ELSE 'VOTER' END, v_actor, NULL, NULL);
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_SENT', v_actor, 'Email verification code dispatched.');
    END IF;
    
    RETURN QUERY SELECT v_email, v_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke public execution and grant to service_role only for security hardening
REVOKE EXECUTE ON FUNCTION public.generate_login_otp(UUID) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.generate_login_otp(UUID) TO service_role;

-- B. verify_login_otp(p_otp_code)
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

    -- Find the latest unused OTP
    SELECT * INTO v_otp
    FROM public.email_otps
    WHERE auth_user_id = v_user_id
    AND used = FALSE
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_otp.id IS NULL THEN
        RAISE EXCEPTION 'No verification code found.';
    END IF;

    -- Check if expired (> 10 minutes)
    IF v_otp.expires_at <= NOW() THEN
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_EXPIRED', COALESCE(v_actor, 'unknown'), 'Verification code has expired (10-minute validity exceeded).');
        PERFORM public.log_security_event('OTP_EXPIRED', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, COALESCE(v_actor, 'unknown'), NULL, NULL);
        RAISE EXCEPTION 'Verification code has expired.';
    END IF;

    IF v_otp.otp_code = v_otp_hash THEN
        UPDATE public.email_otps SET used = TRUE WHERE id = v_otp.id;

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

        RAISE EXCEPTION 'Invalid verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SEED PRODUCTION VOTERS
-- Voter 1: Hari Harsha
-- UID: 25L35A4416 | Email: hariharshahello@gmail.com | Password: honey@26H
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change_token, reauthentication_token
) VALUES (
    'f4407909-6cc7-4a6e-a897-f4380b935af0', '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'hariharshahello@gmail.com', crypt('honey@26H', gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"], "role": "voter"}'::jsonb,
    '{"full_name": "Hari Harsha", "roll_number": "25L35A4416", "department": "CSE-DS", "role": "voter"}'::jsonb,
    now(), now(), '9346293891',
    '', '', '', '', '', '', ''
);

-- Voter 2: Yaswanth
-- UID: 24L31A4412 | Email: hariharshahello56@gmail.com | Password: 02092006
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change_token, reauthentication_token
) VALUES (
    'c29fd8c3-48d2-4886-871f-ec171360da8b', '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'hariharshahello56@gmail.com', crypt('02092006', gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"], "role": "voter"}'::jsonb,
    '{"full_name": "Yaswanth", "roll_number": "24L31A4412", "department": "CSE-DS", "role": "voter"}'::jsonb,
    now(), now(),
    '', '', '', '', '', '', ''
);

-- 6. SEED PRODUCTION SUPER ADMINS
-- Admin 1: Hari Harsha
-- UID: 25-L35-A44-16 | Password: honey@26HARS
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change_token, reauthentication_token
) VALUES (
    '46a98e3c-7f26-4ee9-9724-1115c0489b56', '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'admin1@voteguard.org', crypt('honey@26HARS', gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
    '{"full_name": "Hari Harsha", "admin_id": "25-L35-A44-16", "uid": "25-L35-A44-16", "role": "super_admin"}'::jsonb,
    now(), now(),
    '', '', '', '', '', '', ''
);

-- Admin 2: Yaswanth
-- UID: 24-L31-A44-12 | Password: 02092006
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change_token, reauthentication_token
) VALUES (
    'be4f9d12-1234-4bc3-956f-da71360da8b9', '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'admin2@voteguard.org', crypt('02092006', gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
    '{"full_name": "Yaswanth", "admin_id": "24-L31-A44-12", "uid": "24-L31-A44-12", "role": "super_admin"}'::jsonb,
    now(), now(),
    '', '', '', '', '', '', ''
);

-- 7. SEED AUTH IDENTITIES FOR RESOLUTION
INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES 
(
    'f4407909-6cc7-4a6e-a897-f4380b935af0',
    'f4407909-6cc7-4a6e-a897-f4380b935af0',
    '{"sub": "f4407909-6cc7-4a6e-a897-f4380b935af0", "email": "hariharshahello@gmail.com", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'hariharshahello@gmail.com',
    now(), now(), now()
),
(
    'c29fd8c3-48d2-4886-871f-ec171360da8b',
    'c29fd8c3-48d2-4886-871f-ec171360da8b',
    '{"sub": "c29fd8c3-48d2-4886-871f-ec171360da8b", "email": "hariharshahello56@gmail.com", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'hariharshahello56@gmail.com',
    now(), now(), now()
),
(
    '46a98e3c-7f26-4ee9-9724-1115c0489b56',
    '46a98e3c-7f26-4ee9-9724-1115c0489b56',
    '{"sub": "46a98e3c-7f26-4ee9-9724-1115c0489b56", "email": "admin1@voteguard.org", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'admin1@voteguard.org',
    now(), now(), now()
),
(
    'be4f9d12-1234-4bc3-956f-da71360da8b9',
    'be4f9d12-1234-4bc3-956f-da71360da8b9',
    '{"sub": "be4f9d12-1234-4bc3-956f-da71360da8b9", "email": "admin2@voteguard.org", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'admin2@voteguard.org',
    now(), now(), now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;
