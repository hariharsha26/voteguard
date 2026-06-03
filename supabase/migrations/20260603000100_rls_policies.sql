-- Helper functions and Row-Level Security (RLS) policies
-- Phase 1: Database Schema Design (Security Policies)

-- 1. SECURITY HELPER FUNCTIONS

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_verified_session()
RETURNS BOOLEAN AS $$
BEGIN
    -- If user is admin, allow
    IF public.is_admin() THEN
        RETURN TRUE;
    END IF;

    -- Otherwise check session verification
    RETURN EXISTS (
        SELECT 1 FROM public.session_verifications
        WHERE session_id = COALESCE((auth.jwt() ->> 'session_id')::UUID, '00000000-0000-0000-0000-000000000000'::UUID)
        AND is_verified = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ENABLE RLS ON ALL TABLES (done in init but enforce)
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_delivery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_verifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR ELECTIONS
CREATE POLICY "Admins can do everything on elections"
ON public.elections
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Verified voters can view non-draft elections"
ON public.elections
FOR SELECT
TO authenticated
USING (public.is_verified_session() AND status <> 'Draft');

-- 4. RLS POLICIES FOR CANDIDATES
CREATE POLICY "Admins can do everything on candidates"
ON public.candidates
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Verified voters can view candidates of non-draft elections"
ON public.candidates
FOR SELECT
TO authenticated
USING (
    public.is_verified_session() AND 
    EXISTS (
        SELECT 1 FROM public.elections 
        WHERE elections.id = candidates.election_id 
        AND elections.status <> 'Draft'
    )
);

-- 5. RLS POLICIES FOR VOTERS
CREATE POLICY "Admins can do everything on voters"
ON public.voters
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Voters can view and update their own profile"
ON public.voters
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 6. RLS POLICIES FOR ELECTION ELIGIBILITY
CREATE POLICY "Admins can do everything on election eligibility"
ON public.election_eligibility
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Voters can view their own eligibility"
ON public.election_eligibility
FOR SELECT
TO authenticated
USING (
    public.is_verified_session() AND 
    roll_number = (SELECT roll_number FROM public.voters WHERE id = auth.uid())
);

-- 7. RLS POLICIES FOR VOTER PARTICIPATION
CREATE POLICY "Admins can do everything on voter participation"
ON public.voter_participation
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Voters can view their own participation details"
ON public.voter_participation
FOR SELECT
TO authenticated
USING (
    public.is_verified_session() AND 
    roll_number = (SELECT roll_number FROM public.voters WHERE id = auth.uid())
);

-- 8. RLS POLICIES FOR TOKENS
-- Voters have no direct table access (SELECT, INSERT, UPDATE, DELETE).
-- Access is restricted to secure RPC functions running as SECURITY DEFINER.
CREATE POLICY "Admins can do everything on tokens"
ON public.tokens
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 9. RLS POLICIES FOR TOKEN DELIVERY SESSIONS
-- Voters have no direct table access.
CREATE POLICY "Admins can do everything on token delivery sessions"
ON public.token_delivery_sessions
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 10. RLS POLICIES FOR VOTES (SEALED BALLOT BOX)
-- Votes are write-only through submit_vote RPC. No direct SELECT is allowed until Completed/Emergency Stopped.
CREATE POLICY "Admins can read votes when election is completed"
ON public.votes
FOR SELECT
TO authenticated
USING (
    public.is_admin() AND 
    EXISTS (
        SELECT 1 FROM public.elections
        WHERE elections.id = votes.election_id
        AND elections.status IN ('Completed', 'Emergency Stopped')
    )
);

-- 11. RLS POLICIES FOR AUDIT LOGS
CREATE POLICY "Admins can read and insert audit logs"
ON public.audit_logs
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 12. RLS POLICIES FOR RATE LIMITS
-- Only accessible via internal logic and admin queries.
CREATE POLICY "Admins can view and manage rate limits"
ON public.rate_limits
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 13. RLS POLICIES FOR SESSION VERIFICATIONS
CREATE POLICY "Admins can do everything on session verifications"
ON public.session_verifications
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Voters can check their active session verification status"
ON public.session_verifications
FOR SELECT
TO authenticated
USING (session_id = COALESCE((auth.jwt() ->> 'session_id')::UUID, '00000000-0000-0000-0000-000000000000'::UUID));
