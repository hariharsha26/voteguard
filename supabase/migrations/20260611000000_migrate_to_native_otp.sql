-- ==========================================
-- MIGRATION: NATIVE EMAIL OTP SIMPLIFICATION
-- ==========================================

-- 1. Drop unused custom OTP tables and their dependencies
DROP TABLE IF EXISTS public.email_otps CASCADE;

-- 2. Drop custom OTP generation and verification RPCs
DROP FUNCTION IF EXISTS public.generate_login_otp(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_login_otp() CASCADE;
DROP FUNCTION IF EXISTS public.verify_login_otp(text) CASCADE;

-- 3. We no longer use custom verified_sessions table for MFA state. 
-- We will redefine is_session_verified() to simply check if the user is authenticated.
-- This keeps existing RLS policies intact without needing to drop/recreate them all.
CREATE OR REPLACE FUNCTION public.is_session_verified()
RETURNS BOOLEAN AS $$
BEGIN
    -- With Supabase Native OTP, if auth.uid() is present, they have a valid session.
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Optionally drop verified_sessions completely since it is no longer the source of truth.
DROP TABLE IF EXISTS public.verified_sessions CASCADE;

-- 5. Drop email_delivery_logs since we no longer use Resend custom integration for OTPs
-- Wait, request-token still uses Resend. Let's not drop email_delivery_logs entirely, 
-- but we don't need to change it either. We'll leave it as is so token emails can still be logged.
