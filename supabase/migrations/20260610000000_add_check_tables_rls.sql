-- Migration 20260610000000: Add check_tables_rls Helper RPC
-- Exposes RLS rowsecurity status of public schema tables to the service_role key
-- without exposing it to the public or authenticated roles.

CREATE OR REPLACE FUNCTION public.check_tables_rls()
RETURNS TABLE(tablename TEXT, rowsecurity BOOLEAN) AS $$
BEGIN
    RETURN QUERY 
    SELECT pg_tables.tablename::text, pg_tables.rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execution from public (which includes anon and authenticated roles)
REVOKE EXECUTE ON FUNCTION public.check_tables_rls() FROM public;

-- Grant execution to service_role and postgres roles
GRANT EXECUTE ON FUNCTION public.check_tables_rls() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_tables_rls() TO postgres;
