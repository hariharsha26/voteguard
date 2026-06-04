-- Migration 20260604000200: Integrity Improvements, Metadata Freezes, and Turnout View

-- 1. ENFORCE CONSTRAINTS AND COLUMNS ON VOTES, ELECTIONS, AND TOKENS
-- A. Enforce election_id NOT NULL and add unique constraint on votes
ALTER TABLE public.votes ALTER COLUMN election_id SET NOT NULL;

-- Remove duplicate constraint if it exists, then add unique constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_token_per_election;
ALTER TABLE public.votes ADD CONSTRAINT unique_token_per_election UNIQUE (token_hash, election_id);

-- B. Add emergency_locked to elections
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS emergency_locked BOOLEAN DEFAULT FALSE NOT NULL;

-- C. Add issued_at and expires_at to token_delivery_sessions
ALTER TABLE public.token_delivery_sessions ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
ALTER TABLE public.token_delivery_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. CANDIDATES & ELIGIBILITY FREEZE TRIGGERS
CREATE OR REPLACE FUNCTION public.check_election_draft_status()
RETURNS TRIGGER AS $$
DECLARE
    v_election_status TEXT;
    v_election_id UUID;
BEGIN
    v_election_id := COALESCE(NEW.election_id, OLD.election_id);
    IF v_election_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status INTO v_election_status FROM public.elections WHERE id = v_election_id;
    IF FOUND AND v_election_status <> 'Draft' THEN
        RAISE EXCEPTION 'Cannot modify candidates or eligibility when election is not in Draft status.';
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Candidate Freeze Trigger
DROP TRIGGER IF EXISTS enforce_candidates_draft_only ON public.candidates;
CREATE TRIGGER enforce_candidates_draft_only
    BEFORE INSERT OR UPDATE OR DELETE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION public.check_election_draft_status();

-- Bind Eligibility Freeze Trigger
DROP TRIGGER IF EXISTS enforce_eligibility_draft_only ON public.election_eligibility;
CREATE TRIGGER enforce_eligibility_draft_only
    BEFORE INSERT OR UPDATE OR DELETE ON public.election_eligibility
    FOR EACH ROW EXECUTE FUNCTION public.check_election_draft_status();

-- 3. ELECTION METADATA FREEZE TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_election_modification_after_start()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> 'Draft' THEN
        IF OLD.election_name IS DISTINCT FROM NEW.election_name OR
           OLD.election_type IS DISTINCT FROM NEW.election_type OR
           OLD.description IS DISTINCT FROM NEW.description OR
           OLD.election_code IS DISTINCT FROM NEW.election_code OR
           OLD.access_code IS DISTINCT FROM NEW.access_code OR
           OLD.start_time IS DISTINCT FROM NEW.start_time OR
           OLD.end_time IS DISTINCT FROM NEW.end_time THEN
            RAISE EXCEPTION 'Cannot modify election configuration once it is out of Draft status.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_election_metadata_freeze ON public.elections;
CREATE TRIGGER enforce_election_metadata_freeze
    BEFORE UPDATE ON public.elections
    FOR EACH ROW EXECUTE FUNCTION public.prevent_election_modification_after_start();

-- 4. ELECTION STATUS AUDIT LOGGING TRIGGER
CREATE OR REPLACE FUNCTION public.log_election_status_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_event_type := CASE NEW.status
            WHEN 'Active' THEN 'ELECTION_STARTED'
            WHEN 'Paused' THEN 'ELECTION_PAUSED'
            WHEN 'Completed' THEN 'ELECTION_COMPLETED'
            WHEN 'Emergency_Stopped' THEN 'ELECTION_STOPPED'
            ELSE 'ELECTION_STATUS_CHANGED'
        END;
        
        -- Override for reopening/resuming
        IF OLD.status = 'Completed' AND NEW.status = 'Active' THEN
            v_event_type := 'ELECTION_REOPENED';
        ELSIF OLD.status = 'Paused' AND NEW.status = 'Active' THEN
            v_event_type := 'ELECTION_RESUMED';
        END IF;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES (v_event_type, 'super_admin', 'Election "' || NEW.election_name || '" status changed from ' || OLD.status || ' to ' || NEW.status || '.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_election_status_changed ON public.elections;
CREATE TRIGGER on_election_status_changed
    AFTER UPDATE ON public.elections
    FOR EACH ROW EXECUTE FUNCTION public.log_election_status_changes();

-- 5. STANDARDIZE ALL PL/PGSQL SECURITY AND TRANSACTION RPCs
-- A. generate_login_otp (Standardized audits)
CREATE OR REPLACE FUNCTION public.generate_login_otp()
RETURNS TABLE (email text, debug_otp text) AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_actor TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Session is not authenticated.';
    END IF;
    
    SELECT voters.email, voters.roll_number INTO v_email, v_actor
    FROM public.voters
    WHERE auth_user_id = v_user_id;

    IF NOT FOUND THEN
        SELECT super_admins.email, super_admins.admin_id INTO v_email, v_actor
        FROM public.super_admins
        WHERE auth_user_id = v_user_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Voter or Administrator profile not found.';
        END IF;
    END IF;
    
    v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
    
    INSERT INTO public.email_otps (auth_user_id, otp_code, expires_at)
    VALUES (v_user_id, v_otp_hash, NOW() + interval '10 minutes');
    
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('OTP_SENT', v_actor, 'Email verification code dispatched.');
    
    IF EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true') THEN
        RETURN QUERY SELECT v_email, v_otp;
    ELSE
        RETURN QUERY SELECT v_email, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. verify_login_otp (Standardized audits)
CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_otp_hash TEXT;
    v_otp RECORD;
    v_client_ip TEXT;
    v_actor TEXT;
BEGIN
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    IF EXISTS (
        SELECT 1 FROM public.rate_limits
        WHERE identifier = v_client_ip AND locked_until > NOW()
    ) THEN
        RAISE EXCEPTION 'Rate limit exceeded. Cooldown active.';
    END IF;

    v_user_id := auth.uid();
    v_session_id := auth.jwt() ->> 'session_id';
    
    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RAISE EXCEPTION 'Authentication credentials invalid.';
    END IF;

    SELECT roll_number INTO v_actor FROM public.voters WHERE auth_user_id = v_user_id;
    IF NOT FOUND THEN
        SELECT admin_id INTO v_actor FROM public.super_admins WHERE auth_user_id = v_user_id;
    END IF;

    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    SELECT * INTO v_otp
    FROM public.email_otps
    WHERE auth_user_id = v_user_id
    AND used = FALSE
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF (FOUND AND v_otp.otp_code = v_otp_hash) OR 
       (EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true') AND p_otp_code = '123456') 
    THEN
        IF v_otp.id IS NOT NULL THEN
            UPDATE public.email_otps SET used = TRUE WHERE id = v_otp.id;
        END IF;

        INSERT INTO public.verified_sessions (auth_user_id, session_id, verified, verified_at, expires_at)
        VALUES (v_user_id, v_session_id, TRUE, NOW(), NOW() + interval '8 hours')
        ON CONFLICT (auth_user_id, session_id)
        DO UPDATE SET verified = TRUE, verified_at = NOW(), expires_at = NOW() + interval '8 hours';

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_VERIFIED', v_actor, 'Session successfully verified.');
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('LOGIN_SUCCESS', v_actor, 'User session fully authenticated.');

        UPDATE public.rate_limits SET failed_attempts = 0, locked_until = NULL WHERE identifier = v_client_ip;

        RETURN TRUE;
    ELSE
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('OTP_FAILED', COALESCE(v_actor, 'unknown'), 'Invalid verification code submitted.');

        INSERT INTO public.rate_limits (identifier, failed_attempts, locked_until)
        VALUES (v_client_ip, 1, NULL)
        ON CONFLICT (identifier)
        DO UPDATE SET 
            failed_attempts = public.rate_limits.failed_attempts + 1,
            locked_until = CASE 
                WHEN public.rate_limits.failed_attempts + 1 >= 21 THEN NOW() + interval '30 minutes'
                WHEN public.rate_limits.failed_attempts + 1 >= 16 THEN NOW() + interval '5 minutes'
                WHEN public.rate_limits.failed_attempts + 1 >= 11 THEN NOW() + interval '1 minute'
                WHEN public.rate_limits.failed_attempts + 1 >= 6 THEN NOW() + interval '30 seconds'
                ELSE NULL
            END;

        RAISE EXCEPTION 'Invalid or expired verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. handle_logout (Standardized audits)
CREATE OR REPLACE FUNCTION public.handle_logout()
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_actor TEXT;
BEGIN
    v_user_id := auth.uid();
    v_session_id := auth.jwt() ->> 'session_id';

    IF v_user_id IS NOT NULL THEN
        SELECT roll_number INTO v_actor FROM public.voters WHERE auth_user_id = v_user_id;
        IF NOT FOUND THEN
            SELECT admin_id INTO v_actor FROM public.super_admins WHERE auth_user_id = v_user_id;
        END IF;

        DELETE FROM public.verified_sessions
        WHERE auth_user_id = v_user_id AND session_id = v_session_id;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('SESSION_LOGOUT', COALESCE(v_actor, 'unknown'), 'User manually ended secure session.');
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. commit_token_request (Emergency lock check, exact end_time expiry, standardized audits)
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
    v_election_end TIMESTAMPTZ;
    v_emergency_locked BOOLEAN;
BEGIN
    -- 1. Fetch election details & emergency lock status
    SELECT election_type, status, end_time, emergency_locked INTO v_election_type, v_election_status, v_election_end, v_emergency_locked
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_emergency_locked = TRUE THEN
        RAISE EXCEPTION 'Operation blocked. Election is emergency locked.';
    END IF;

    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not currently active for token requests.';
    END IF;

    -- 2. Fetch voter roll number
    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE auth_user_id = p_voter_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    -- 3. Check Eligibility
    SELECT is_eligible INTO v_is_eligible
    FROM public.election_eligibility
    WHERE election_id = p_election_id AND roll_number = v_roll_number;

    IF v_election_type = 'Private' THEN
        IF COALESCE(v_is_eligible, FALSE) = FALSE THEN
            RAISE EXCEPTION 'Voter is not whitelisted for this election.';
        END IF;
    ELSE
        IF FOUND AND v_is_eligible = FALSE THEN
            RAISE EXCEPTION 'Voter is blacklisted for this election.';
        END IF;
    END IF;

    -- 4. Check double-voting and double-request prevention
    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND has_voted = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already voted in this election.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND has_requested_token = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already requested a token for this election.';
    END IF;

    -- 5. Commit record writes
    INSERT INTO public.tokens (token_hash, election_id, status)
    VALUES (p_token_hash, p_election_id, 'unused');

    -- Insert temporary session mapping with exact election end_time expiry
    INSERT INTO public.token_delivery_sessions (election_id, roll_number, token_hash, expires_at)
    VALUES (p_election_id, v_roll_number, p_token_hash, v_election_end);

    -- Mark voter participation
    INSERT INTO public.voter_participation (roll_number, election_id, has_requested_token)
    VALUES (v_roll_number, p_election_id, TRUE)
    ON CONFLICT (roll_number, election_id)
    DO UPDATE SET has_requested_token = TRUE;

    -- Write Audit Logs
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_REQUESTED', v_roll_number, 'Voter requested election token successfully.');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_DELIVERED', v_roll_number, 'Cryptographic voting token successfully generated and dispatched.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. verify_token (Emergency lock check, expires_at check, standardized audits)
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
    v_emergency_locked BOOLEAN;
    v_session RECORD;
BEGIN
    -- Extract IP for rate limiting
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    SELECT cooldown_until, failed_attempts INTO v_cooldown, v_failed_count
    FROM public.token_attempts
    WHERE ip_address = v_client_ip;

    IF FOUND AND v_cooldown > NOW() THEN
        RAISE EXCEPTION 'Too many failed attempts. Try again after % seconds.', CEIL(EXTRACT(EPOCH FROM (v_cooldown - NOW())))::INTEGER;
    END IF;

    -- 1. Fetch election details & emergency lock status
    SELECT status, end_time, emergency_locked INTO v_election_status, v_election_end, v_emergency_locked
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_emergency_locked = TRUE THEN
        RAISE EXCEPTION 'Operation blocked. Election is emergency locked.';
    END IF;

    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not active.';
    END IF;

    -- 2. Hash and fetch token
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash AND election_id = p_election_id;

    IF NOT FOUND THEN
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

    -- 3. Check Token Status
    IF v_token.status = 'used' THEN
        RAISE EXCEPTION 'Token Already Used.';
    ELSIF v_token.status = 'invalidated' THEN
        RAISE EXCEPTION 'Token Invalidated.';
    ELSIF v_token.status = 'expired' THEN
        RAISE EXCEPTION 'Token Expired.';
    END IF;

    -- 4. Validate Expiration against token delivery session and current time
    SELECT * INTO v_session FROM public.token_delivery_sessions WHERE token_hash = v_token_hash;
    IF (FOUND AND v_session.expires_at IS NOT NULL AND NOW() > v_session.expires_at) OR (NOW() >= v_election_end) THEN
        UPDATE public.tokens SET status = 'expired' WHERE token_hash = v_token_hash;
        RAISE EXCEPTION 'Token Expired.';
    END IF;

    -- Reset rate limits on success
    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    -- Log verification audit (Standardized)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_VERIFIED', 'anonymous', 'Secure voting credentials validated.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. submit_vote (Emergency lock check, standardized audits)
CREATE OR REPLACE FUNCTION public.submit_vote(
    p_token TEXT,
    p_candidate_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_election_status TEXT;
    v_emergency_locked BOOLEAN;
    v_roll_number TEXT;
BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

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

    -- 1. Fetch election details & emergency lock status
    SELECT status, emergency_locked INTO v_election_status, v_emergency_locked
    FROM public.elections
    WHERE id = v_token.election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_emergency_locked = TRUE THEN
        RAISE EXCEPTION 'Operation blocked. Election is emergency locked.';
    END IF;

    IF v_election_status <> 'Active' THEN
        RAISE EXCEPTION 'Election is not currently accepting votes.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.candidates
        WHERE id = p_candidate_id AND election_id = v_token.election_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Selected candidate is not active or does not belong to this election.';
    END IF;

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

    -- SEVER THE LINK
    DELETE FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    -- Audit Log (Standardized)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('VOTE_SUBMITTED', 'anonymous', 'Ballot cast and cryptographically sealed.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- G. verify_portal_token (Standardized audits)
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
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    SELECT cooldown_until INTO v_cooldown
    FROM public.token_attempts
    WHERE ip_address = v_client_ip;

    IF FOUND AND v_cooldown > NOW() THEN
        RAISE EXCEPTION 'Too many failed attempts. Try again after % seconds.', CEIL(EXTRACT(EPOCH FROM (v_cooldown - NOW())))::INTEGER;
    END IF;

    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash;

    IF NOT FOUND THEN
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

    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    SELECT election_name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = v_token.election_id;

    -- Audit logs (Standardized)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_VERIFIED', 'anonymous', 'Token status queried via public portal.');

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

-- H. admin_regenerate_token (Standardized audits)
CREATE OR REPLACE FUNCTION public.admin_regenerate_token(
    p_voter_roll_number TEXT,
    p_election_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    SELECT token_hash INTO v_token_hash
    FROM public.token_delivery_sessions
    WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;

    IF FOUND THEN
        UPDATE public.tokens
        SET status = 'invalidated'
        WHERE token_hash = v_token_hash;

        DELETE FROM public.token_delivery_sessions
        WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;
    END IF;

    UPDATE public.voter_participation
    SET has_requested_token = FALSE
    WHERE roll_number = p_voter_roll_number AND election_id = p_election_id;

    -- Audit Log (Standardized)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_REGENERATED', 'admin', 'Invalidated active token for voter ' || p_voter_roll_number || ' to allow regeneration.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREATE ELECTION STATISTICS VIEW
CREATE OR REPLACE VIEW public.election_statistics AS
SELECT 
    e.id AS election_id,
    e.election_name,
    COALESCE(
        (SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE),
        0
    ) AS eligible_voters,
    COALESCE(
        (SELECT COUNT(*) FROM public.tokens t WHERE t.election_id = e.id),
        0
    ) AS token_requests,
    COALESCE(
        (SELECT COUNT(*) FROM public.votes v WHERE v.election_id = e.id),
        0
    ) AS votes_cast,
    (
        COALESCE(
            (SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE),
            0
        ) - 
        COALESCE(
            (SELECT COUNT(*) FROM public.votes v WHERE v.election_id = e.id),
            0
        )
    ) AS remaining_voters,
    CASE 
        WHEN COALESCE((SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE), 0) > 0 
        THEN ROUND(
            (COALESCE((SELECT COUNT(*) FROM public.votes v WHERE v.election_id = e.id), 0)::numeric / 
             COALESCE((SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE), 0)::numeric) * 100, 
            2
        )
        ELSE 0.00
    END AS turnout_percentage,
    e.status,
    e.emergency_locked
FROM public.elections e;

-- Grant permissions on the new view
GRANT SELECT ON public.election_statistics TO authenticated, anon;
