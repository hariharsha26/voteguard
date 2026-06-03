-- Migration 20260603000700: Fix dependencies, missing voter_participation table, add votes.election_id, and compile correct RPC functions

-- 1. CREATE VOTER PARTICIPATION TABLE
CREATE TABLE IF NOT EXISTS public.voter_participation (
    roll_number TEXT NOT NULL,
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    has_requested_token BOOLEAN DEFAULT FALSE,
    has_voted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (roll_number, election_id)
);

-- 2. ENABLE RLS ON VOTER PARTICIPATION
ALTER TABLE public.voter_participation ENABLE ROW LEVEL SECURITY;

-- 3. DROP AND CREATE POLICIES FOR VOTER PARTICIPATION
DROP POLICY IF EXISTS "Super admins can do everything on voter participation" ON public.voter_participation;
CREATE POLICY "Super admins can do everything on voter participation"
ON public.voter_participation
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Voters can view their own participation details" ON public.voter_participation;
CREATE POLICY "Voters can view their own participation details"
ON public.voter_participation
FOR SELECT
TO authenticated
USING (
    public.is_session_verified() AND 
    roll_number = (SELECT roll_number FROM public.voters WHERE auth_user_id = auth.uid())
);

-- 4. ADD ELECTION_ID COLUMN TO VOTES TABLE
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS election_id UUID REFERENCES public.elections(id) ON DELETE RESTRICT;

-- 5. COMPILE PRIVATE SCHEMA COMMIT TOKEN REQUEST
CREATE OR REPLACE FUNCTION private.commit_token_request(
    p_voter_id UUID,
    p_election_id UUID,
    p_token_hash TEXT
)
RETURNS boolean AS $$
DECLARE
    v_roll_number TEXT;
    v_is_eligible BOOLEAN;
    v_election_type TEXT;
    v_election_status TEXT;
BEGIN
    -- Fetch voter roll number
    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE auth_user_id = p_voter_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    -- Fetch election details
    SELECT election_type, status INTO v_election_type, v_election_status
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not currently active for token requests.';
    END IF;

    -- Check Eligibility
    SELECT is_eligible INTO v_is_eligible
    FROM public.election_eligibility
    WHERE election_id = p_election_id AND roll_number = v_roll_number;

    IF v_election_type = 'Private' THEN
        -- Private elections require explicit whitelist
        IF COALESCE(v_is_eligible, FALSE) = FALSE THEN
            RAISE EXCEPTION 'Voter is not whitelisted for this election.';
        END IF;
    ELSE
        -- Public elections allow all except explicit blacklist
        IF FOUND AND v_is_eligible = FALSE THEN
            RAISE EXCEPTION 'Voter is blacklisted for this election.';
        END IF;
    END IF;

    -- Check double-request prevention
    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND has_requested_token = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already requested a token for this election.';
    END IF;

    -- Commit record writes
    -- Insert token hash
    INSERT INTO public.tokens (token_hash, election_id, status)
    VALUES (p_token_hash, p_election_id, 'unused');

    -- Insert temporary session mapping
    INSERT INTO public.token_delivery_sessions (election_id, roll_number, token_hash)
    VALUES (p_election_id, v_roll_number, p_token_hash);

    -- Mark voter participation
    INSERT INTO public.voter_participation (roll_number, election_id, has_requested_token)
    VALUES (v_roll_number, p_election_id, TRUE)
    ON CONFLICT (roll_number, election_id)
    DO UPDATE SET has_requested_token = TRUE;

    -- Write Audit Log
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Requested', v_roll_number, 'Voter requested election token successfully.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. COMPILE SUBMIT VOTE TRANSACTION RPC
CREATE OR REPLACE FUNCTION public.submit_vote(
    p_token TEXT,
    p_candidate_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_election_status TEXT;
    v_roll_number TEXT;
BEGIN
    -- Hash token value
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Lock and verify token row
    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid token.';
    END IF;

    IF v_token.status <> 'unused' THEN
        RAISE EXCEPTION 'Token has already been %.', v_token.status;
    END IF;

    -- Verify election status is Active
    SELECT status INTO v_election_status
    FROM public.elections
    WHERE id = v_token.election_id;

    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not currently accepting votes.';
    END IF;

    -- Verify candidate matches election and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.candidates
        WHERE id = p_candidate_id AND election_id = v_token.election_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Selected candidate is not active or does not belong to this election.';
    END IF;

    -- Fetch roll number from temporary session mapping
    SELECT roll_number INTO v_roll_number
    FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter delivery session not found. Integrity breached.';
    END IF;

    -- Insert vote
    INSERT INTO public.votes (token_hash, candidate_id, election_id)
    VALUES (v_token_hash, p_candidate_id, v_token.election_id);

    -- Update token status
    UPDATE public.tokens
    SET status = 'used', used_at = NOW()
    WHERE token_hash = v_token_hash;

    -- Update voter participation
    UPDATE public.voter_participation
    SET has_voted = TRUE
    WHERE roll_number = v_roll_number AND election_id = v_token.election_id;

    -- SEVER THE LINK: delete session row
    DELETE FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    -- Audit Log (No token or candidate details)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Vote Submitted', 'anonymous', 'Ballot cast and cryptographically sealed.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. COMPILE VERIFY PORTAL TOKEN STATUS RPC
CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS text AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_client_ip TEXT;
    v_election_status TEXT;
    v_election_name TEXT;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    -- Apply rate limit check
    PERFORM public.rate_limit_check(v_client_ip);

    -- Hash token value
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Verify token exists
    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash;

    IF NOT FOUND THEN
        -- Record failure & apply progressive cooldowns
        PERFORM public.rate_limit_fail(v_client_ip);
        RAISE EXCEPTION '✗ Token Not Found. No matching vote was found in the secure registry.';
    END IF;

    -- Reset rate limits on success
    UPDATE public.rate_limits SET failed_attempts = 0, locked_until = '-infinity'::TIMESTAMPTZ WHERE identifier = v_client_ip;

    -- Fetch election metadata
    SELECT election_name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = v_token.election_id;

    -- Log verification audit
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Checked in Portal', 'anonymous', 'Token status queried via public portal.');

    -- Map output options
    IF v_token.status = 'unused' THEN
        RETURN '⏳ Pending Counting';
    ELSIF v_token.status = 'used' THEN
        IF v_election_status IN ('Completed', 'Emergency_Stopped') THEN
            RETURN '✓ Vote Counted';
        ELSE
            RETURN '✓ Vote Recorded';
        END IF;
    ELSIF v_token.status = 'invalidated' THEN
        RETURN '✗ Token Invalidated';
    ELSE
        RETURN '✗ Token Expired';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. COMPILE ADMIN REGENERATE TOKEN RPC
CREATE OR REPLACE FUNCTION public.admin_regenerate_token(
    p_voter_roll_number TEXT,
    p_election_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
BEGIN
    -- Enforce Super Admin only
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Find active delivery session token for this election
    SELECT token_hash INTO v_token_hash
    FROM public.token_delivery_sessions
    WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;

    -- Invalidate active token
    IF FOUND THEN
        UPDATE public.tokens
        SET status = 'invalidated'
        WHERE token_hash = v_token_hash;

        DELETE FROM public.token_delivery_sessions
        WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;
    END IF;

    -- Reset request status on participation table so they can request new token
    UPDATE public.voter_participation
    SET has_requested_token = FALSE
    WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;

    -- Log admin recovery
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Recovery', 'admin', 'Invalidated active token for voter ' || p_voter_roll_number || ' to allow regeneration.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
