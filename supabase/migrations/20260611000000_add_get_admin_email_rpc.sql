-- Migration 20260611000000: Add get_admin_email_by_id RPC function
-- Allows unauthenticated login gate to safely resolve admin_id to email without opening select RLS to anon.

CREATE OR REPLACE FUNCTION public.get_admin_email_by_id(p_admin_id text)
RETURNS text AS $$
DECLARE
    v_email text;
BEGIN
    SELECT email INTO v_email
    FROM public.super_admins
    WHERE admin_id = p_admin_id;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_email_by_id(text) TO anon, authenticated;
