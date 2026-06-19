-- Migration 20260617000000: Fix Admin Permissions and Setup Background Cron
-- 1. Redefine is_super_admin to check database records directly and bypass JWT role claim dependency
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.super_admins sa
        WHERE sa.auth_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule auto-finalization of expired elections every minute
-- Unschedule if already exists to avoid duplicates when running migrations
SELECT cron.unschedule('check-and-finalize-expired-elections')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-and-finalize-expired-elections');

SELECT cron.schedule(
    'check-and-finalize-expired-elections',
    '* * * * *',
    'SELECT public.check_and_finalize_expired_elections();'
);
