-- Database RPC Functions & Security Engines
-- Phase 1: Database Schema Design (RPC Functions)

-- 1. CREATE PRIVATE SCHEMA FOR PRIVATE USER SECURITY DATA
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT ALL ON SCHEMA private TO postgres, service_role;

-- 2. PRIVATE OTP STORAGE TABLE
CREATE TABLE IF NOT EXISTS private.voter_login_otps (
    session_id UUID PRIMARY KEY,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE private.voter_login_otps ENABLE ROW LEVEL SECURITY;

-- 3. RATE LIMITING FAIL ENGINE
CREATE OR REPLACE FUNCTION public.rate_limit_fail(p_identifier text)
RETURNS void AS $$
DECLARE
    v_attempts integer;
    v_lock_duration interval;
    v_locked_until timestamptz;
BEGIN
    -- Upsert failure attempts
    INSERT INTO public.rate_limits (identifier, failed_attempts)
    VALUES (p_identifier, 1)
    ON CONFLICT (identifier)
    DO UPDATE SET failed_attempts = public.rate_limits.failed_attempts + 1;

    -- Fetch current attempts count
    SELECT failed_attempts INTO v_attempts
    FROM public.rate_limits
    WHERE identifier = p_identifier;

    -- Calculate cooldown duration based on requirement scale
    IF v_attempts >= 21 THEN
        v_lock_duration := interval '30 minutes';
    ELSIF v_attempts >= 16 THEN
        v_lock_duration := interval '5 minutes';
    ELSIF v_attempts >= 11 THEN
        v_lock_duration := interval '1 minute';
    ELSIF v_attempts >= 6 THEN
        v_lock_duration := interval '30 seconds';
    ELSE
        v_lock_duration := interval '0 seconds';
    END IF;

    -- Set lock timestamp
    IF v_lock_duration > interval '0 seconds' THEN
        v_locked_until := NOW() + v_lock_duration;
        UPDATE public.rate_limits
        SET locked_until = v_locked_until
        WHERE identifier = p_identifier;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RATE LIMIT CHECK ENGINE
CREATE OR REPLACE FUNCTION public.rate_limit_check(p_identifier text)
RETURNS boolean AS $$
DECLARE
    v_locked_until timestamptz;
    v_remaining_seconds integer;
BEGIN
    SELECT locked_until INTO v_locked_until
    FROM public.rate_limits
    WHERE identifier = p_identifier;

    IF FOUND AND v_locked_until > NOW() THEN
        v_remaining_seconds := EXTRACT(EPOCH FROM (v_locked_until - NOW()))::integer;
        RAISE EXCEPTION 'Rate limit exceeded. Cooldown active. Try again in % seconds.', v_remaining_seconds;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VERIFY LOGIN OTP RPC
CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_session_id UUID;
    v_otp_hash TEXT;
    v_client_ip TEXT;
    v_roll_number TEXT;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    -- Apply rate limit check
    PERFORM public.rate_limit_check(v_client_ip);

    -- Get session ID from JWT
    v_session_id := COALESCE((auth.jwt() ->> 'session_id')::UUID, '00000000-0000-0000-0000-000000000000'::UUID);

    -- Hash input code
    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    -- Verify and delete OTP
    IF EXISTS (
        SELECT 1 FROM private.voter_login_otps
        WHERE session_id = v_session_id
        AND otp_hash = v_otp_hash
        AND expires_at > NOW()
    ) THEN
        -- Clear OTP record
        DELETE FROM private.voter_login_otps WHERE session_id = v_session_id;

        -- Record session verification status
        INSERT INTO public.session_verifications (session_id, is_verified)
        VALUES (v_session_id, TRUE)
        ON CONFLICT (session_id)
        DO UPDATE SET is_verified = TRUE;

        -- Log event
        SELECT roll_number INTO v_roll_number FROM public.voters WHERE id = auth.uid();
        INSERT INTO public.audit_logs (event_type, actor, description)
        VALUES ('OTP Verified', COALESCE(v_roll_number, 'admin'), 'Email MFA code successfully verified.');

        -- Reset rate limits
        UPDATE public.rate_limits SET failed_attempts = 0, locked_until = '-infinity'::TIMESTAMPTZ WHERE identifier = v_client_ip;

        RETURN TRUE;
    ELSE
        -- Track failed attempt
        PERFORM public.rate_limit_fail(v_client_ip);
        RAISE EXCEPTION 'Invalid or expired verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PRIVATE SCHEMA COMMIT TOKEN REQUEST (Invoked by Edge Function)
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
    -- 1. Fetch voter roll number
    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE id = p_voter_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    -- 2. Fetch election details
    SELECT type, status INTO v_election_type, v_election_status
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not currently active for token requests.';
    END IF;

    -- 3. Check Eligibility
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

    -- 4. Check double-request prevention
    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND has_requested_token = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already requested a token for this election.';
    END IF;

    -- 5. Commit record writes
    -- Insert token hash
    INSERT INTO public.tokens (token_hash, election_id, status)
    VALUES (p_token_hash, p_election_id, 'unused');

    -- Insert temporary session mapping
    INSERT INTO public.token_delivery_sessions (roll_number, token_hash)
    VALUES (v_roll_number, p_token_hash);

    -- Mark voter participation
    INSERT INTO public.voter_participation (roll_number, election_id, has_requested_token)
    VALUES (v_roll_number, p_election_id, TRUE)
    ON CONFLICT (roll_number, election_id)
    DO UPDATE SET has_requested_token = TRUE;

    -- Write Audit Log (Stripped token value for anonymity)
    INSERT INTO public.audit_logs (event_type, actor, description)
    VALUES ('Token Requested', v_roll_number, 'Voter requested election token successfully.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. SUBMIT VOTE TRANSACTION RPC
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

    -- Verify candidate matches election
    IF NOT EXISTS (
        SELECT 1 FROM public.candidates
        WHERE id = p_candidate_id AND election_id = v_token.election_id
    ) THEN
        RAISE EXCEPTION 'Selected candidate does not belong to this election.';
    END IF;

    -- Fetch roll number from temporary session mapping
    SELECT roll_number INTO v_roll_number
    FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter delivery session not found. Integrity breached.';
    END IF;

    -- 1. Insert vote
    INSERT INTO public.votes (token_hash, candidate_id, election_id)
    VALUES (v_token_hash, p_candidate_id, v_token.election_id);

    -- 2. Update token status
    UPDATE public.tokens
    SET status = 'used', used_at = NOW()
    WHERE token_hash = v_token_hash;

    -- 3. Update voter participation
    UPDATE public.voter_participation
    SET has_voted = TRUE
    WHERE roll_number = v_roll_number AND election_id = v_token.election_id;

    -- 4. SEVER THE LINK: delete session row
    DELETE FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    -- 5. Audit Log (No token or candidate details)
    INSERT INTO public.audit_logs (event_type, actor, description)
    VALUES ('Vote Submitted', 'anonymous', 'Ballot cast and cryptographically sealed.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. VERIFY PORTAL TOKEN STATUS RPC (Rate-limited)
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
    SELECT name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = v_token.election_id;

    -- Log verification audit
    INSERT INTO public.audit_logs (event_type, actor, description)
    VALUES ('Token Checked in Portal', 'anonymous', 'Token status queried via public portal.');

    -- Map output options
    IF v_token.status = 'unused' THEN
        RETURN '⏳ Pending Counting';
    ELSIF v_token.status = 'used' THEN
        IF v_election_status IN ('Completed', 'Emergency Stopped') THEN
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

-- 9. ADMIN REGENERATE TOKEN RPC
CREATE OR REPLACE FUNCTION public.admin_regenerate_token(
    p_voter_roll_number TEXT,
    p_election_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
BEGIN
    -- Enforce Admin only
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Find active delivery session token
    SELECT token_hash INTO v_token_hash
    FROM public.token_delivery_sessions
    WHERE roll_number = p_voter_roll_number;

    -- Invalidate active token
    IF FOUND THEN
        UPDATE public.tokens
        SET status = 'invalidated'
        WHERE token_hash = v_token_hash;

        DELETE FROM public.token_delivery_sessions
        WHERE roll_number = p_voter_roll_number;
    END IF;

    -- Reset request status on participation table so they can request new token
    UPDATE public.voter_participation
    SET has_requested_token = FALSE
    WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;

    -- Log admin recovery
    INSERT INTO public.audit_logs (event_type, actor, description)
    VALUES ('Token Recovery', 'admin', 'Invalidated active token for voter ' || p_voter_roll_number || ' to allow regeneration.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
