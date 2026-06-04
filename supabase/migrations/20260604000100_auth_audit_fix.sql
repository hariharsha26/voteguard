-- Migration 20260604000100: Auth & Security Audit Fixes
-- Phase A: Rename legacy session_verifications table instead of dropping immediately
ALTER TABLE IF EXISTS public.session_verifications RENAME TO session_verifications_legacy;

-- 1. Recreate missing public.system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop obsolete policies on system_settings if they exist
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can edit system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admins can edit system settings" ON public.system_settings;

-- Create clean RLS policies for system_settings
CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated, anon
USING (TRUE);

CREATE POLICY "Super admins can edit system settings"
ON public.system_settings
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Populate default settings
INSERT INTO public.system_settings (key, value)
VALUES 
    ('debug_mode', 'true'),
    ('college_code', 'L35')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Redefine is_super_admin with database-backed checks for extra security
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- A. Validate against JWT metadata claims
    IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin', FALSE) THEN
        -- B. Double check against the physical database record
        RETURN EXISTS (
            SELECT 1
            FROM public.super_admins sa
            WHERE sa.auth_user_id = auth.uid()
        );
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remove is_admin() and references
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 4. Apply clean RLS policies for public.verified_sessions
ALTER TABLE public.verified_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Super admins can manage all verified sessions" ON public.verified_sessions;
DROP POLICY IF EXISTS "Users can check their own active session verification status" ON public.verified_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.verified_sessions;

-- Policy A: Super admins have full CRUD on verified sessions
CREATE POLICY "Super admins can manage all verified sessions"
ON public.verified_sessions
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Policy B: Authenticated users can check their own verified sessions
CREATE POLICY "Users can check their own active session verification status"
ON public.verified_sessions
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Policy C: Users can delete/clear their own sessions (required on logout)
CREATE POLICY "Users can delete their own sessions"
ON public.verified_sessions
FOR DELETE
TO authenticated
USING (auth_user_id = auth.uid());
