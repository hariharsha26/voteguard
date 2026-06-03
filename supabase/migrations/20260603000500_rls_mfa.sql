-- RLS policies enforcing Session Verification and Role Checks
-- Phase 2 — Authentication, Authorization & Security Layer

-- 1. ENABLE RLS ON ALL SENSITIVE TABLES
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_delivery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can do everything on voters" ON public.voters;
DROP POLICY IF EXISTS "Voters can view and edit own profile" ON public.voters;
DROP POLICY IF EXISTS "Super admins can do everything on elections" ON public.elections;
DROP POLICY IF EXISTS "Voters can select non-draft elections" ON public.elections;
DROP POLICY IF EXISTS "Super admins can do everything on candidates" ON public.candidates;
DROP POLICY IF EXISTS "Voters can select candidates" ON public.candidates;
DROP POLICY IF EXISTS "Super admins can do everything on eligibility" ON public.election_eligibility;
DROP POLICY IF EXISTS "Voters can select own eligibility" ON public.election_eligibility;
DROP POLICY IF EXISTS "Super admins can do everything on token requests" ON public.token_requests;
DROP POLICY IF EXISTS "Voters can manage own token requests" ON public.token_requests;
DROP POLICY IF EXISTS "Super admins can do everything on tokens" ON public.tokens;
DROP POLICY IF EXISTS "Super admins can do everything on delivery sessions" ON public.token_delivery_sessions;
DROP POLICY IF EXISTS "Super admins can read votes when completed" ON public.votes;
DROP POLICY IF EXISTS "Super admins can manage audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can manage rate limits" ON public.rate_limits;

-- 2. VOTERS POLICIES
CREATE POLICY "Super admins can do everything on voters"
ON public.voters
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Voters can view and edit own profile"
ON public.voters
TO authenticated
USING (public.is_session_verified() AND auth_user_id = auth.uid())
WITH CHECK (public.is_session_verified() AND auth_user_id = auth.uid());

-- 3. ELECTIONS POLICIES
CREATE POLICY "Super admins can do everything on elections"
ON public.elections
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Voters can select non-draft elections"
ON public.elections
FOR SELECT
TO authenticated
USING (public.is_session_verified() AND status <> 'Draft');

-- 4. CANDIDATES POLICIES
CREATE POLICY "Super admins can do everything on candidates"
ON public.candidates
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Voters can select candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (
    public.is_session_verified() AND 
    EXISTS (
        SELECT 1 FROM public.elections
        WHERE elections.id = candidates.election_id
        AND elections.status <> 'Draft'
    )
);

-- 5. ELIGIBILITY POLICIES
CREATE POLICY "Super admins can do everything on eligibility"
ON public.election_eligibility
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Voters can select own eligibility"
ON public.election_eligibility
FOR SELECT
TO authenticated
USING (
    public.is_session_verified() AND 
    roll_number = (SELECT roll_number FROM public.voters WHERE auth_user_id = auth.uid())
);

-- 6. TOKEN REQUESTS POLICIES
CREATE POLICY "Super admins can do everything on token requests"
ON public.token_requests
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Voters can manage own token requests"
ON public.token_requests
TO authenticated
USING (
    public.is_session_verified() AND 
    roll_number = (SELECT roll_number FROM public.voters WHERE auth_user_id = auth.uid())
)
WITH CHECK (
    public.is_session_verified() AND 
    roll_number = (SELECT roll_number FROM public.voters WHERE auth_user_id = auth.uid())
);

-- 7. TOKENS POLICIES (No direct voter table access)
CREATE POLICY "Super admins can do everything on tokens"
ON public.tokens
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 8. DELIVERY SESSIONS POLICIES (No direct voter table access)
CREATE POLICY "Super admins can do everything on delivery sessions"
ON public.token_delivery_sessions
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 9. VOTES POLICIES (No direct voter table access)
CREATE POLICY "Super admins can read votes when completed"
ON public.votes
FOR SELECT
TO authenticated
USING (
    public.is_super_admin() AND
    EXISTS (
        SELECT 1 FROM public.elections e
        JOIN public.candidates c ON c.election_id = e.id
        WHERE c.id = votes.candidate_id
        AND e.status IN ('Completed', 'Emergency_Stopped')
    )
);

-- 10. AUDIT LOGS POLICIES
CREATE POLICY "Super admins can manage audit logs"
ON public.audit_logs
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 11. RATE LIMITS POLICIES
CREATE POLICY "Super admins can manage rate limits"
ON public.rate_limits
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
