-- Migration 20260608000000: Security Policy Fix — Remove anon SELECT on super_admins
-- Found during QA verification on 2026-06-05
-- The "Anyone can lookup admin email by admin ID" policy allowed unauthenticated
-- clients to SELECT from super_admins. Replaced with authenticated-only policy.

DROP POLICY IF EXISTS "Anyone can lookup admin email by admin ID" ON public.super_admins;

CREATE POLICY "Authenticated users can lookup admin email"
ON public.super_admins
FOR SELECT
TO authenticated
USING (true);
