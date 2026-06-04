-- Migration 20260604000000: Phase 4 Secure Token Engine, Verification and Duplicate Prevention

-- 1. Create token_attempts table for anti-bruteforce protection
CREATE TABLE IF NOT EXISTS public.token_attempts (
    ip_address TEXT PRIMARY KEY,
    failed_attempts INTEGER DEFAULT 0,
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on token_attempts
ALTER TABLE public.token_attempts ENABLE ROW LEVEL SECURITY;

-- Allow reading/writing token attempts for security checks
CREATE POLICY "Anyone can read token attempts" ON public.token_attempts
    FOR SELECT TO authenticated, anon USING (TRUE);

-- 2. Add Unique Constraints for Double-Voting Prevention
CREATE UNIQUE INDEX IF NOT EXISTS one_vote_per_token ON public.votes(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS one_token_per_election ON public.token_delivery_sessions(roll_number, election_id);

-- 3. Redefine private.commit_token_request to enforce User Has Not Voted check and write audit logs
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

    -- Check if voter has already voted
    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND has_voted = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already voted in this election.';
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

    -- Write Audit Logs
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Requested', v_roll_number, 'Voter requested election token successfully.');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Generated', v_roll_number, 'Cryptographic voting token successfully generated.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create verify_token RPC for anti-bruteforce progressive verification
CREATE OR REPLACE FUNCTION public.verify_token(
    p_token TEXT,
    p_election_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_client_ip TEXT;
    v_cooldown TIMESTAMPTZ;
    v_failed_count INTEGER;
    v_election_status TEXT;
    v_election_end TIMESTAMPTZ;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    -- Check active cooldowns
    SELECT cooldown_until, failed_attempts INTO v_cooldown, v_failed_count
    FROM public.token_attempts
    WHERE ip_address = v_client_ip;

    IF FOUND AND v_cooldown > NOW() THEN
        RAISE EXCEPTION 'Too many failed attempts. Try again after % seconds.', CEIL(EXTRACT(EPOCH FROM (v_cooldown - NOW())))::INTEGER;
    END IF;

    -- Hash input token
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Fetch token
    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash AND election_id = p_election_id;

    IF NOT FOUND THEN
        -- Track failed attempt
        INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
        VALUES (v_client_ip, 1, NULL)
        ON CONFLICT (ip_address)
        DO UPDATE SET 
            failed_attempts = public.token_attempts.failed_attempts + 1,
            cooldown_until = CASE 
                WHEN public.token_attempts.failed_attempts + 1 >= 21 THEN NOW() + interval '30 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 16 THEN NOW() + interval '5 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 11 THEN NOW() + interval '1 minute'
                WHEN public.token_attempts.failed_attempts + 1 >= 6 THEN NOW() + interval '30 seconds'
                ELSE NULL
            END;

        RAISE EXCEPTION 'Invalid Token.';
    END IF;

    -- Check Token Status
    IF v_token.status = 'used' THEN
        RAISE EXCEPTION 'Token Already Used.';
    ELSIF v_token.status = 'invalidated' THEN
        RAISE EXCEPTION 'Token Invalidated.';
    ELSIF v_token.status = 'expired' THEN
        RAISE EXCEPTION 'Token Expired.';
    END IF;

    -- Fetch election status and end time
    SELECT status, end_time INTO v_election_status, v_election_end
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Validate Election is Active
    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not active.';
    END IF;

    -- Validate Expiry (Current Time < Election End Time)
    IF NOW() >= v_election_end THEN
        -- Mark token expired
        UPDATE public.tokens SET status = 'expired' WHERE token_hash = v_token_hash;
        RAISE EXCEPTION 'Token Expired.';
    END IF;

    -- Reset rate limits on success
    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    -- Log verification audit (No token details)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Verified', 'anonymous', 'Secure voting credentials validated.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Redefine verify_portal_token to use updated states
CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS text AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_client_ip TEXT;
    v_cooldown TIMESTAMPTZ;
    v_election_status TEXT;
    v_election_name TEXT;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    -- Apply rate limit check using the new token_attempts table
    SELECT cooldown_until INTO v_cooldown
    FROM public.token_attempts
    WHERE ip_address = v_client_ip;

    IF FOUND AND v_cooldown > NOW() THEN
        RAISE EXCEPTION 'Too many failed attempts. Try again after % seconds.', CEIL(EXTRACT(EPOCH FROM (v_cooldown - NOW())))::INTEGER;
    END IF;

    -- Hash token value
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Verify token exists
    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash;

    IF NOT FOUND THEN
        -- Record failure & apply progressive cooldowns in token_attempts
        INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
        VALUES (v_client_ip, 1, NULL)
        ON CONFLICT (ip_address)
        DO UPDATE SET 
            failed_attempts = public.token_attempts.failed_attempts + 1,
            cooldown_until = CASE 
                WHEN public.token_attempts.failed_attempts + 1 >= 21 THEN NOW() + interval '30 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 16 THEN NOW() + interval '5 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 11 THEN NOW() + interval '1 minute'
                WHEN public.token_attempts.failed_attempts + 1 >= 6 THEN NOW() + interval '30 seconds'
                ELSE NULL
            END;
        RAISE EXCEPTION 'Token Not Found';
    END IF;

    -- Reset rate limits on success
    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    -- Fetch election metadata
    SELECT election_name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = v_token.election_id;

    -- Log verification audit
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('Token Checked in Portal', 'anonymous', 'Token status queried via public portal.');

    -- Map output options
    IF v_token.status = 'unused' THEN
        IF v_election_status = 'Active' THEN
            RETURN 'Election Still In Progress';
        ELSE
            RETURN 'Pending Counting';
        END IF;
    ELSIF v_token.status = 'used' THEN
        IF v_election_status IN ('Completed', 'Emergency_Stopped') THEN
            RETURN '✓ Vote Counted';
        ELSIF v_election_status = 'Active' THEN
            RETURN '✓ Vote Recorded';
        ELSE
            RETURN 'Pending Counting';
        END IF;
    ELSIF v_token.status = 'invalidated' THEN
        RETURN '✗ Token Invalidated';
    ELSE
        RETURN '✗ Token Expired';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
