-- Migration 20260606000000: Phase 6 Hardening, Operational Audits, and Monitoring

-- Enable pgcrypto for digest functions if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. RECREATE TOKEN ATTEMPTS WITH CLIENT FINGERPRINT
DROP TABLE IF EXISTS public.token_attempts CASCADE;
CREATE TABLE public.token_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_fingerprint TEXT UNIQUE NOT NULL,
    failed_attempts INTEGER DEFAULT 0 NOT NULL,
    locked_until TIMESTAMPTZ,
    last_attempt TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE ACCOUNT LOCKOUTS TABLE (SEPARATE COUNTERS)
CREATE TABLE public.account_lockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    login_failures INTEGER DEFAULT 0 NOT NULL,
    login_locked_until TIMESTAMPTZ,
    otp_failures INTEGER DEFAULT 0 NOT NULL,
    otp_locked_until TIMESTAMPTZ,
    token_failures INTEGER DEFAULT 0 NOT NULL,
    token_locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RECREATE AUDIT LOGS TABLE WITH NEW STRUCTURE & BACKWARD COMPATIBILITY
DROP TABLE IF EXISTS public.audit_logs CASCADE;
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_type TEXT CHECK (actor_type IN ('VOTER', 'SUPER_ADMIN', 'SYSTEM')),
    actor_identifier TEXT,
    election_id UUID,
    election_round INTEGER,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Backward compatibility legacy fields
    actor TEXT,
    details TEXT
);

-- 4. CREATE SECURITY EVENTS TABLE
CREATE TABLE public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_type TEXT CHECK (actor_type IN ('VOTER', 'SUPER_ADMIN', 'SYSTEM')),
    actor_identifier TEXT,
    session_id TEXT,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATE SUSPICIOUS ACTIVITY TABLE (WITHOUT CLIENT FINGERPRINTS)
CREATE TABLE public.suspicious_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_identifier TEXT,
    session_id TEXT,
    reason TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CREATE SYSTEM ERRORS TABLE
CREATE TABLE public.system_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    error_message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CREATE INTERNAL FINGERPRINT ATTEMPTS TABLE (FOR SUSPICIOUS ACTIVITY CHECKS)
CREATE TABLE public.fingerprint_attempts (
    client_fingerprint TEXT PRIMARY KEY,
    login_failures INTEGER DEFAULT 0 NOT NULL,
    otp_failures INTEGER DEFAULT 0 NOT NULL,
    token_failures INTEGER DEFAULT 0 NOT NULL,
    token_gen_attempts INTEGER DEFAULT 0 NOT NULL,
    session_creations INTEGER DEFAULT 0 NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ENABLE RLS ON ALL NEW TABLES
ALTER TABLE public.token_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspicious_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fingerprint_attempts ENABLE ROW LEVEL SECURITY;

-- 9. DEFINE RLS POLICIES (SUPER ADMIN ONLY)
DROP POLICY IF EXISTS "Super Admin Full Access on token_attempts" ON public.token_attempts;
CREATE POLICY "Super Admin Full Access on token_attempts" ON public.token_attempts
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin Full Access on account_lockouts" ON public.account_lockouts;
CREATE POLICY "Super Admin Full Access on account_lockouts" ON public.account_lockouts
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin Full Access on audit_logs" ON public.audit_logs;
CREATE POLICY "Super Admin Full Access on audit_logs" ON public.audit_logs
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin Full Access on security_events" ON public.security_events;
CREATE POLICY "Super Admin Full Access on security_events" ON public.security_events
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin Full Access on suspicious_activity" ON public.suspicious_activity;
CREATE POLICY "Super Admin Full Access on suspicious_activity" ON public.suspicious_activity
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin Full Access on system_errors" ON public.system_errors;
CREATE POLICY "Super Admin Full Access on system_errors" ON public.system_errors
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin Full Access on fingerprint_attempts" ON public.fingerprint_attempts;
CREATE POLICY "Super Admin Full Access on fingerprint_attempts" ON public.fingerprint_attempts
    FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 10. SANITIZATION AND COMPATIBILITY TRIGGERS
CREATE OR REPLACE FUNCTION public.sanitize_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_key TEXT;
BEGIN
    -- Populate backward compatibility fields
    IF NEW.actor_identifier IS NULL THEN
        NEW.actor_identifier := NEW.actor;
    END IF;
    IF NEW.actor IS NULL THEN
        NEW.actor := NEW.actor_identifier;
    END IF;

    IF NEW.actor_type IS NULL AND NEW.actor IS NOT NULL THEN
        IF NEW.actor = 'super_admin' OR NEW.actor LIKE 'admin%' OR NEW.actor LIKE 'dynamax%' THEN
            NEW.actor_type := 'SUPER_ADMIN';
        ELSIF NEW.actor = 'system' OR NEW.actor = 'SYSTEM' THEN
            NEW.actor_type := 'SYSTEM';
        ELSE
            NEW.actor_type := 'VOTER';
        END IF;
    END IF;

    IF NEW.metadata_json IS NULL OR NEW.metadata_json = '{}'::jsonb THEN
        IF NEW.details IS NOT NULL THEN
            NEW.metadata_json := jsonb_build_object('details', NEW.details);
        ELSE
            NEW.metadata_json := '{}'::jsonb;
        END IF;
    END IF;
    
    IF NEW.details IS NULL AND NEW.metadata_json IS NOT NULL THEN
        NEW.details := NEW.metadata_json->>'details';
    END IF;

    -- Strip sensitive keys from metadata_json (strictly redacted)
    FOR v_key IN SELECT * FROM jsonb_object_keys(NEW.metadata_json) LOOP
        IF v_key IN ('otp', 'otp_code', 'token', 'token_hash', 'password', 'selection', 'candidate_id', 'candidate_name', 'email', 'email_content', 'subject', 'body', 'phone_number', 'phone', 'ip_address', 'client_fingerprint') THEN
            NEW.metadata_json := NEW.metadata_json - v_key;
        END IF;
    END LOOP;

    -- Redact details string
    IF NEW.details IS NOT NULL THEN
        NEW.details := regexp_replace(NEW.details, '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[REDACTED_EMAIL]', 'g');
        NEW.details := regexp_replace(NEW.details, '\bVG-TEST-[A-F0-9]+\b', '[REDACTED_TOKEN]', 'g');
        NEW.details := regexp_replace(NEW.details, '\b\d{6,8}\b', '[REDACTED_CODE]', 'g');
        NEW.details := regexp_replace(NEW.details, '\b\d{10,12}\b', '[REDACTED_PHONE]', 'g');
        NEW.details := regexp_replace(NEW.details, 'for Candidate [A-Za-z0-9 ]+', 'for [REDACTED_SELECTION]', 'g');
    END IF;

    -- Clean actor_identifier if it contains email details
    IF NEW.actor_identifier IS NOT NULL AND NEW.actor_identifier LIKE '%@%' THEN
        NEW.actor_identifier := regexp_replace(NEW.actor_identifier, '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[REDACTED_EMAIL]', 'g');
    END IF;
    IF NEW.actor IS NOT NULL AND NEW.actor LIKE '%@%' THEN
        NEW.actor := regexp_replace(NEW.actor, '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[REDACTED_EMAIL]', 'g');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sanitize_audit_log
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.sanitize_audit_log();

CREATE OR REPLACE FUNCTION public.sanitize_security_event()
RETURNS TRIGGER AS $$
DECLARE
    v_key TEXT;
BEGIN
    -- Strip client fingerprint / raw IP
    IF NEW.metadata_json ? 'client_fingerprint' THEN
        NEW.metadata_json := NEW.metadata_json - 'client_fingerprint';
    END IF;
    IF NEW.metadata_json ? 'ip_address' THEN
        NEW.metadata_json := NEW.metadata_json - 'ip_address';
    END IF;

    -- Strip other sensitive data
    FOR v_key IN SELECT * FROM jsonb_object_keys(NEW.metadata_json) LOOP
        IF v_key IN ('otp', 'otp_code', 'token', 'token_hash', 'password', 'selection', 'candidate_id', 'candidate_name', 'email', 'email_content', 'subject', 'body', 'phone_number', 'phone') THEN
            NEW.metadata_json := NEW.metadata_json - v_key;
        END IF;
    END LOOP;

    -- Sanitize actor_identifier if email
    IF NEW.actor_identifier IS NOT NULL AND NEW.actor_identifier LIKE '%@%' THEN
        NEW.actor_identifier := regexp_replace(NEW.actor_identifier, '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[REDACTED_EMAIL]', 'g');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sanitize_security_event
    BEFORE INSERT ON public.security_events
    FOR EACH ROW EXECUTE FUNCTION public.sanitize_security_event();

-- 11. UNIFIED SECURITY EVENT LOGGING RPC
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_event_type TEXT,
    p_actor_type TEXT,
    p_actor_identifier TEXT,
    p_session_id TEXT DEFAULT NULL,
    p_client_fingerprint TEXT DEFAULT NULL,
    p_metadata_json JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
    v_recent_alert_exists BOOLEAN;
    v_alert_reason TEXT;
    v_alert_severity TEXT;
    v_alert_type TEXT;
    v_attempts RECORD;
    v_salt TEXT;
    v_salted_fingerprint TEXT;
BEGIN
    -- Calculate salted fingerprint internally to ensure privacy
    IF p_client_fingerprint IS NOT NULL THEN
        SELECT value INTO v_salt FROM public.system_settings WHERE key = 'fingerprint_salt';
        IF v_salt IS NULL THEN
            v_salt := 'voteguard-default-salt-2026';
        END IF;
        v_salted_fingerprint := encode(digest(p_client_fingerprint || '-' || v_salt, 'sha256'), 'hex');
    END IF;

    -- Insert security event
    INSERT INTO public.security_events (
        event_type,
        actor_type,
        actor_identifier,
        session_id,
        metadata_json
    ) VALUES (
        p_event_type,
        p_actor_type,
        p_actor_identifier,
        p_session_id,
        p_metadata_json
    );

    -- Insert into audit_logs
    INSERT INTO public.audit_logs (
        event_type,
        actor_type,
        actor_identifier,
        metadata_json
    ) VALUES (
        p_event_type,
        p_actor_type,
        p_actor_identifier,
        p_metadata_json
    );

    -- Track fingerprint counters internally
    IF v_salted_fingerprint IS NOT NULL THEN
        -- Reset counters if they haven't been updated in 1 hour (auto cooldown decay)
        UPDATE public.fingerprint_attempts
        SET login_failures = CASE WHEN last_updated < NOW() - INTERVAL '1 hour' THEN 0 ELSE login_failures END,
            otp_failures = CASE WHEN last_updated < NOW() - INTERVAL '1 hour' THEN 0 ELSE otp_failures END,
            token_failures = CASE WHEN last_updated < NOW() - INTERVAL '1 hour' THEN 0 ELSE token_failures END,
            token_gen_attempts = CASE WHEN last_updated < NOW() - INTERVAL '1 hour' THEN 0 ELSE token_gen_attempts END,
            session_creations = CASE WHEN last_updated < NOW() - INTERVAL '1 hour' THEN 0 ELSE session_creations END
        WHERE client_fingerprint = v_salted_fingerprint;

        -- Increment counters
        INSERT INTO public.fingerprint_attempts (
            client_fingerprint, login_failures, otp_failures, token_failures, token_gen_attempts, session_creations, last_updated
        ) VALUES (
            v_salted_fingerprint,
            CASE WHEN p_event_type = 'LOGIN_FAILURE' THEN 1 ELSE 0 END,
            CASE WHEN p_event_type = 'OTP_FAILURE' THEN 1 ELSE 0 END,
            CASE WHEN p_event_type = 'TOKEN_VERIFY_FAILURE' THEN 1 ELSE 0 END,
            CASE WHEN p_event_type = 'TOKEN_REQUEST' THEN 1 ELSE 0 END,
            CASE WHEN p_event_type = 'SESSION_CREATED' THEN 1 ELSE 0 END,
            NOW()
        ) ON CONFLICT (client_fingerprint) DO UPDATE SET
            login_failures = public.fingerprint_attempts.login_failures + CASE WHEN p_event_type = 'LOGIN_FAILURE' THEN 1 ELSE 0 END,
            otp_failures = public.fingerprint_attempts.otp_failures + CASE WHEN p_event_type = 'OTP_FAILURE' THEN 1 ELSE 0 END,
            token_failures = public.fingerprint_attempts.token_failures + CASE WHEN p_event_type = 'TOKEN_VERIFY_FAILURE' THEN 1 ELSE 0 END,
            token_gen_attempts = public.fingerprint_attempts.token_gen_attempts + CASE WHEN p_event_type = 'TOKEN_REQUEST' THEN 1 ELSE 0 END,
            session_creations = public.fingerprint_attempts.session_creations + CASE WHEN p_event_type = 'SESSION_CREATED' THEN 1 ELSE 0 END,
            last_updated = NOW()
        RETURNING * INTO v_attempts;

        -- Check alerts thresholds
        v_alert_type := NULL;
        IF v_attempts.login_failures > 10 THEN
            v_alert_type := 'EXCESSIVE_LOGIN_FAILURES';
            v_alert_reason := 'Excessive login failures detected on this client';
            v_alert_severity := 'HIGH';
        ELSIF v_attempts.otp_failures > 5 THEN
            v_alert_type := 'EXCESSIVE_OTP_FAILURES';
            v_alert_reason := 'Excessive OTP verification failures detected on this client';
            v_alert_severity := 'HIGH';
        ELSIF v_attempts.token_failures > 20 THEN
            v_alert_type := 'EXCESSIVE_TOKEN_VERIFY_FAILURES';
            v_alert_reason := 'Excessive token verification failures detected on this client';
            v_alert_severity := 'HIGH';
        ELSIF v_attempts.token_gen_attempts > 5 THEN
            v_alert_type := 'EXCESSIVE_TOKEN_GEN_ATTEMPTS';
            v_alert_reason := 'Excessive token generation requests detected in a short duration';
            v_alert_severity := 'MEDIUM';
        ELSIF v_attempts.session_creations > 5 THEN
            v_alert_type := 'EXCESSIVE_SESSION_CREATION';
            v_alert_reason := 'Excessive session creation attempts detected';
            v_alert_severity := 'MEDIUM';
        END IF;

        -- Insert warning (suppression rule: max 1 warning per type per hour)
        IF v_alert_type IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.suspicious_activity
                WHERE event_type = v_alert_type
                  AND (actor_identifier = p_actor_identifier OR session_id = p_session_id)
                  AND created_at > NOW() - INTERVAL '1 hour'
            ) INTO v_recent_alert_exists;

            IF NOT v_recent_alert_exists THEN
                INSERT INTO public.suspicious_activity (
                    event_type, actor_identifier, session_id, reason, severity
                ) VALUES (
                    v_alert_type, p_actor_identifier, p_session_id, v_alert_reason, v_alert_severity
                );
            END IF;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. LOG SYSTEM ERROR RPC
CREATE OR REPLACE FUNCTION public.log_system_error(
    p_source TEXT,
    p_error_message TEXT,
    p_severity TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.system_errors (source, error_message, severity)
    VALUES (p_source, p_error_message, p_severity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. RETENTION CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void AS $$
BEGIN
    -- security_events -> 180 days
    DELETE FROM public.security_events WHERE created_at < NOW() - INTERVAL '180 days';
    
    -- suspicious_activity -> 365 days
    DELETE FROM public.suspicious_activity WHERE created_at < NOW() - INTERVAL '365 days';
    
    -- system_errors -> 365 days
    DELETE FROM public.system_errors WHERE created_at < NOW() - INTERVAL '365 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. SYSTEM HEALTH MATERIALIZED VIEW
DROP MATERIALIZED VIEW IF EXISTS public.system_health CASCADE;
CREATE MATERIALIZED VIEW public.system_health AS
SELECT
    (SELECT COUNT(*) FROM public.voters) AS total_voters,
    (SELECT COUNT(*) FROM public.verified_sessions WHERE expires_at > NOW()) AS active_sessions,
    (SELECT COUNT(*) FROM public.verified_sessions WHERE verified = TRUE AND expires_at > NOW()) AS verified_sessions,
    (SELECT COUNT(*) FROM public.elections WHERE status = 'ACTIVE') AS active_elections,
    (SELECT COUNT(*) FROM public.elections WHERE status = 'COMPLETED') AS completed_elections,
    (SELECT COUNT(*) FROM public.elections WHERE status = 'STOPPED') AS stopped_elections,
    (SELECT COUNT(*) FROM public.elections) AS total_elections,
    (SELECT COUNT(*) FROM public.tokens) AS total_tokens_generated,
    (SELECT COUNT(*) FROM public.tokens WHERE status = 'used') AS total_tokens_verified,
    (SELECT COUNT(*) FROM public.votes) AS total_votes_cast,
    (SELECT COALESCE(AVG(turnout_percentage), 0.00) FROM public.election_summary) AS average_turnout,
    (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'LOGIN_FAILURE' AND created_at >= CURRENT_DATE) AS failed_logins_today,
    (SELECT COUNT(*) FROM public.account_lockouts WHERE otp_locked_until > NOW() OR login_locked_until > NOW() OR token_locked_until > NOW()) AS active_lockouts,
    (SELECT COUNT(*) FROM public.suspicious_activity WHERE created_at >= CURRENT_DATE) AS suspicious_activities_today,
    NOW() AS last_refreshed_at;

GRANT SELECT ON public.system_health TO postgres;

-- 15. RPC: GET SECURITY DASHBOARD
CREATE OR REPLACE FUNCTION public.get_security_dashboard()
RETURNS jsonb AS $$
DECLARE
    v_health RECORD;
    v_suspicious JSONB;
    v_errors JSONB;
BEGIN
    -- Assert Super Admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Refresh Materialized View
    REFRESH MATERIALIZED VIEW public.system_health;

    -- Select health details
    SELECT * INTO v_health FROM public.system_health LIMIT 1;

    -- Get suspicious activities (recent 20, fingerprints omitted by default)
    SELECT COALESCE(json_agg(sa), '[]'::jsonb) INTO v_suspicious
    FROM (
        SELECT id, event_type, actor_identifier, session_id, reason, severity, created_at
        FROM public.suspicious_activity
        ORDER BY created_at DESC
        LIMIT 20
    ) sa;

    -- Get recent system errors
    SELECT COALESCE(json_agg(se), '[]'::jsonb) INTO v_errors
    FROM (
        SELECT id, source, error_message, severity, created_at
        FROM public.system_errors
        ORDER BY created_at DESC
        LIMIT 20
    ) se;

    RETURN jsonb_build_object(
        'total_voters', v_health.total_voters,
        'active_sessions', v_health.active_sessions,
        'verified_sessions', v_health.verified_sessions,
        'active_elections', v_health.active_elections,
        'completed_elections', v_health.completed_elections,
        'stopped_elections', v_health.stopped_elections,
        'total_elections', v_health.total_elections,
        'total_tokens_generated', v_health.total_tokens_generated,
        'total_tokens_verified', v_health.total_tokens_verified,
        'total_votes_cast', v_health.total_votes_cast,
        'average_turnout', v_health.average_turnout,
        'failed_logins_today', v_health.failed_logins_today,
        'active_lockouts', v_health.active_lockouts,
        'suspicious_activities_today', v_health.suspicious_activities_today,
        'suspicious_activities', v_suspicious,
        'system_errors', v_errors,
        'last_refreshed_at', v_health.last_refreshed_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. RPC: GET ELECTION AUDIT REPORT
CREATE OR REPLACE FUNCTION public.get_election_audit_report(p_election_id UUID)
RETURNS jsonb AS $$
DECLARE
    v_election RECORD;
    v_rounds JSONB;
    v_tokens_gen INT;
    v_tokens_ver INT;
    v_votes_cast INT;
    v_eligible_voters INT;
    v_snapshot_votes INT;
    v_participation_pct NUMERIC(5,2);
    v_integrity_status TEXT;
    v_reasons TEXT[];
BEGIN
    -- Assert Super Admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Fetch election metadata
    SELECT id, election_name, election_code, election_type, status, current_round, winners
    INTO v_election
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Fetch summaries per round
    SELECT COALESCE(json_agg(r), '[]'::jsonb) INTO v_rounds
    FROM (
        SELECT 
            election_round,
            total_votes,
            total_eligible_voters,
            turnout_percentage,
            is_tie,
            is_joint_winner,
            result_generated_at,
            (SELECT candidate_name FROM public.candidates WHERE id = winner_candidate_id) AS winner_name
        FROM public.election_summary
        WHERE election_id = p_election_id
        ORDER BY election_round ASC
    ) r;

    -- Totals for the current round
    SELECT COUNT(*) INTO v_tokens_gen FROM public.tokens WHERE election_id = p_election_id AND election_round = v_election.current_round;
    SELECT COUNT(*) INTO v_tokens_ver FROM public.tokens WHERE election_id = p_election_id AND status = 'used' AND election_round = v_election.current_round;
    SELECT COUNT(*) INTO v_votes_cast FROM public.votes WHERE election_id = p_election_id AND election_round = v_election.current_round;
    SELECT COUNT(*) INTO v_eligible_voters FROM public.election_eligibility WHERE election_id = p_election_id AND is_eligible = TRUE;
    SELECT COALESCE(SUM(vote_count), 0) INTO v_snapshot_votes FROM public.election_results WHERE election_id = p_election_id AND election_round = v_election.current_round;

    IF v_eligible_voters > 0 THEN
        v_participation_pct := ROUND((v_votes_cast::numeric / v_eligible_voters::numeric) * 100, 2);
    ELSE
        v_participation_pct := 0.00;
    END IF;

    -- Integrity Validation
    v_integrity_status := 'PASSED';
    v_reasons := ARRAY[]::TEXT[];

    IF v_votes_cast > v_tokens_ver THEN
        v_integrity_status := 'FAILED';
        v_reasons := array_append(v_reasons, 'Votes Cast (' || v_votes_cast || ') exceeds Tokens Verified (' || v_tokens_ver || ')');
    END IF;

    IF v_tokens_ver > v_tokens_gen THEN
        v_integrity_status := 'FAILED';
        v_reasons := array_append(v_reasons, 'Tokens Verified (' || v_tokens_ver || ') exceeds Tokens Generated (' || v_tokens_gen || ')');
    END IF;

    IF v_tokens_gen > v_eligible_voters THEN
        v_integrity_status := 'FAILED';
        v_reasons := array_append(v_reasons, 'Tokens Generated (' || v_tokens_gen || ') exceeds Whitelisted Eligible Voters (' || v_eligible_voters || ')');
    END IF;

    IF v_election.status IN ('COMPLETED', 'DEADLOCK', 'STOPPED') AND v_snapshot_votes <> v_votes_cast THEN
        v_integrity_status := 'FAILED';
        v_reasons := array_append(v_reasons, 'Total Votes in Results Snapshot (' || v_snapshot_votes || ') does not match Votes Cast in Current Round (' || v_votes_cast || ')');
    END IF;

    RETURN jsonb_build_object(
        'election_id', v_election.id,
        'election_name', v_election.election_name,
        'election_code', v_election.election_code,
        'election_type', v_election.election_type,
        'status', v_election.status,
        'current_round', v_election.current_round,
        'winners', v_election.winners,
        'rounds', v_rounds,
        'tokens_generated', v_tokens_gen,
        'tokens_verified', v_tokens_ver,
        'votes_cast', v_votes_cast,
        'eligible_voters', v_eligible_voters,
        'participation_percentage', v_participation_pct,
        'integrity_status', v_integrity_status,
        'integrity_reasons', to_jsonb(v_reasons)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. RE-COMPILE OTP SYSTEM TO SUPPORT SEPARATE LOCKOUTS AND CONCURRENT SESSIONS
CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_otp_hash TEXT;
    v_otp RECORD;
    v_client_ip TEXT;
    v_client_fingerprint TEXT;
    v_salt TEXT;
    v_actor TEXT;
    v_dev_mode TEXT;
    v_default_otp TEXT;
    v_is_dev_otp BOOLEAN;
    v_cooldown TIMESTAMPTZ;
    v_failed_count INTEGER;
BEGIN
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    SELECT value INTO v_salt FROM public.system_settings WHERE key = 'fingerprint_salt';
    IF v_salt IS NULL THEN
        v_salt := 'voteguard-default-salt-2026';
    END IF;
    v_client_fingerprint := encode(digest(v_client_ip || '-' || v_salt, 'sha256'), 'hex');

    -- IP fingerprint attempts verification check
    SELECT locked_until, failed_attempts INTO v_cooldown, v_failed_count
    FROM public.token_attempts
    WHERE client_fingerprint = v_client_fingerprint;

    IF FOUND AND v_cooldown > NOW() THEN
        RAISE EXCEPTION 'Too many verification attempts from this device. Cooldown active.';
    END IF;

    v_user_id := auth.uid();
    v_session_id := auth.jwt() ->> 'session_id';
    
    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RAISE EXCEPTION 'Authentication credentials invalid.';
    END IF;

    -- Check if OTP is locked for this user account (separate counter)
    IF EXISTS (
        SELECT 1 FROM public.account_lockouts
        WHERE auth_user_id = v_user_id AND otp_locked_until > NOW()
    ) THEN
        RAISE EXCEPTION 'OTP verification is temporarily locked due to excessive failures.';
    END IF;

    SELECT roll_number INTO v_actor FROM public.voters WHERE auth_user_id = v_user_id;
    IF NOT FOUND THEN
        SELECT admin_id INTO v_actor FROM public.super_admins WHERE auth_user_id = v_user_id;
    END IF;

    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    SELECT value INTO v_default_otp FROM public.system_settings WHERE key = 'default_otp';

    v_is_dev_otp := (COALESCE(v_dev_mode, 'false') = 'true' AND p_otp_code = COALESCE(v_default_otp, '20071226'));

    SELECT * INTO v_otp
    FROM public.email_otps
    WHERE auth_user_id = v_user_id
    AND used = FALSE
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF (v_otp.id IS NOT NULL AND v_otp.otp_code = v_otp_hash) OR v_is_dev_otp THEN
        IF v_otp.id IS NOT NULL THEN
            UPDATE public.email_otps SET used = TRUE WHERE id = v_otp.id;
        END IF;

        INSERT INTO public.verified_sessions (auth_user_id, session_id, verified, verified_at, expires_at)
        VALUES (v_user_id, v_session_id, TRUE, NOW(), NOW() + interval '8 hours')
        ON CONFLICT (auth_user_id, session_id)
        DO UPDATE SET verified = TRUE, verified_at = NOW(), expires_at = NOW() + interval '8 hours';

        -- Concurrent session policy: Force terminate other active sessions for this account
        DELETE FROM public.verified_sessions
        WHERE auth_user_id = v_user_id AND session_id <> v_session_id;

        -- Reset account OTP failure counter
        INSERT INTO public.account_lockouts (auth_user_id, otp_failures, otp_locked_until, updated_at)
        VALUES (v_user_id, 0, NULL, NOW())
        ON CONFLICT (auth_user_id) DO UPDATE SET otp_failures = 0, otp_locked_until = NULL, updated_at = NOW();

        -- Reset fingerprint cooldown attempts
        UPDATE public.token_attempts SET failed_attempts = 0, locked_until = NULL WHERE client_fingerprint = v_client_fingerprint;

        -- Log events (anonymously)
        PERFORM public.log_security_event('OTP_SUCCESS', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, v_actor, v_session_id, v_client_ip);
        PERFORM public.log_security_event('LOGIN_SUCCESS', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, v_actor, v_session_id, v_client_ip);

        RETURN TRUE;
    ELSE
        -- Increment account lockout counter
        INSERT INTO public.account_lockouts (auth_user_id, otp_failures, otp_locked_until, updated_at)
        VALUES (v_user_id, 1, NULL, NOW())
        ON CONFLICT (auth_user_id) DO UPDATE SET
            otp_failures = public.account_lockouts.otp_failures + 1,
            otp_locked_until = CASE
                WHEN public.account_lockouts.otp_failures + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END,
            updated_at = NOW();

        -- Increment device fingerprint failed attempts
        INSERT INTO public.token_attempts (client_fingerprint, failed_attempts, locked_until, last_attempt)
        VALUES (v_client_fingerprint, 1, NULL, NOW())
        ON CONFLICT (client_fingerprint)
        DO UPDATE SET 
            failed_attempts = public.token_attempts.failed_attempts + 1,
            last_attempt = NOW(),
            locked_until = CASE 
                WHEN public.token_attempts.failed_attempts + 1 >= 21 THEN NOW() + interval '30 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 16 THEN NOW() + interval '5 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 11 THEN NOW() + interval '1 minute'
                WHEN public.token_attempts.failed_attempts + 1 >= 6 THEN NOW() + interval '30 seconds'
                ELSE NULL
            END;

        -- Log events
        PERFORM public.log_security_event('OTP_FAILURE', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, COALESCE(v_actor, 'unknown'), v_session_id, v_client_ip, jsonb_build_object('reason', 'Invalid OTP code'));
        
        IF EXISTS (SELECT 1 FROM public.account_lockouts WHERE auth_user_id = v_user_id AND otp_locked_until > NOW()) THEN
            PERFORM public.log_security_event('ACCOUNT_LOCKED', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, COALESCE(v_actor, 'unknown'), v_session_id, v_client_ip, jsonb_build_object('subsystem', 'OTP'));
        END IF;

        RAISE EXCEPTION 'Invalid or expired verification code.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_login_otp()
RETURNS TABLE (email text, debug_otp text) AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_actor TEXT;
    v_dev_mode TEXT;
    v_default_otp TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Session is not authenticated.';
    END IF;

    -- Check lockout status
    IF EXISTS (
        SELECT 1 FROM public.account_lockouts
        WHERE auth_user_id = v_user_id AND otp_locked_until > NOW()
    ) THEN
        RAISE EXCEPTION 'OTP generation is locked due to excessive failures. Try again later.';
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

    -- Fetch dev settings
    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    SELECT value INTO v_default_otp FROM public.system_settings WHERE key = 'default_otp';
    
    IF COALESCE(v_dev_mode, 'false') = 'true' THEN
        v_otp := COALESCE(v_default_otp, '20071226');
    ELSE
        v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    END IF;
    
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
    
    INSERT INTO public.email_otps (auth_user_id, otp_code, expires_at)
    VALUES (v_user_id, v_otp_hash, NOW() + interval '10 minutes');
    
    -- Log OTP generation event
    PERFORM public.log_security_event('OTP_SENT', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, v_actor, NULL, NULL);
    
    IF COALESCE(v_dev_mode, 'false') = 'true' OR EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true') THEN
        RETURN QUERY SELECT v_email, v_otp;
    ELSE
        RETURN QUERY SELECT v_email, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. RE-COMPILE ANONYMOUS TOKEN VERIFICATION TO RATE LIMIT BY CLIENT FINGERPRINT
CREATE OR REPLACE FUNCTION public.verify_token(
    p_token TEXT,
    p_election_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_client_ip TEXT;
    v_client_fingerprint TEXT;
    v_salt TEXT;
    v_cooldown TIMESTAMPTZ;
    v_failed_count INTEGER;
    v_election_status TEXT;
    v_election_end TIMESTAMPTZ;
    v_emergency_locked BOOLEAN;
    v_current_round INTEGER;
    v_session RECORD;
BEGIN
    -- Extract IP
    v_client_ip := COALESCE(
        split_part((current_setting('request.headers', true)::json->>'x-forwarded-for')::text, ',', 1),
        'unknown'
    );

    SELECT value INTO v_salt FROM public.system_settings WHERE key = 'fingerprint_salt';
    IF v_salt IS NULL THEN
        v_salt := 'voteguard-default-salt-2026';
    END IF;
    v_client_fingerprint := encode(digest(v_client_ip || '-' || v_salt, 'sha256'), 'hex');

    -- Device level rate limiting check (no permanent logging of raw IP)
    SELECT cooldown_until, failed_attempts INTO v_cooldown, v_failed_count
    FROM public.token_attempts
    WHERE client_fingerprint = v_client_fingerprint;

    IF FOUND AND v_cooldown > NOW() THEN
        RAISE EXCEPTION 'Too many failed attempts from this device. Try again after % seconds.', CEIL(EXTRACT(EPOCH FROM (v_cooldown - NOW())))::INTEGER;
    END IF;

    -- Fetch election details & emergency lock status
    SELECT status, end_time, emergency_locked, current_round 
    INTO v_election_status, v_election_end, v_emergency_locked, v_current_round
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_emergency_locked = TRUE OR v_election_status = 'STOPPED' THEN
        RAISE EXCEPTION 'Operation blocked. Election is emergency stopped/locked.';
    END IF;

    IF v_election_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Election is not active.';
    END IF;

    -- Hash and fetch token
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_token
    FROM public.tokens
    WHERE token_hash = v_token_hash AND election_id = p_election_id;

    IF NOT FOUND THEN
        -- Increment fingerprint failed attempts
        INSERT INTO public.token_attempts (client_fingerprint, failed_attempts, locked_until, last_attempt)
        VALUES (v_client_fingerprint, 1, NULL, NOW())
        ON CONFLICT (client_fingerprint)
        DO UPDATE SET 
            failed_attempts = public.token_attempts.failed_attempts + 1,
            last_attempt = NOW(),
            locked_until = CASE 
                WHEN public.token_attempts.failed_attempts + 1 >= 21 THEN NOW() + interval '30 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 16 THEN NOW() + interval '5 minutes'
                WHEN public.token_attempts.failed_attempts + 1 >= 11 THEN NOW() + interval '1 minute'
                WHEN public.token_attempts.failed_attempts + 1 >= 6 THEN NOW() + interval '30 seconds'
                ELSE NULL
            END;

        -- Log token verification failure (anonymously)
        PERFORM public.log_security_event('TOKEN_VERIFY_FAILURE', 'SYSTEM', 'anonymous', NULL, v_client_ip, jsonb_build_object('election_id', p_election_id, 'reason', 'Invalid Token'));

        RAISE EXCEPTION 'Invalid Token.';
    END IF;

    -- Round isolation check
    IF v_token.election_round <> v_current_round THEN
        RAISE EXCEPTION 'Token round (%) does not match current round (%).', v_token.election_round, v_current_round;
    END IF;

    -- Check status
    IF v_token.status = 'used' THEN
        RAISE EXCEPTION 'Token Already Used.';
    ELSIF v_token.status = 'invalidated' THEN
        RAISE EXCEPTION 'Token Invalidated.';
    ELSIF v_token.status = 'expired' THEN
        RAISE EXCEPTION 'Token Expired.';
    END IF;

    -- Success: reset client rate limits
    UPDATE public.token_attempts SET failed_attempts = 0, locked_until = NULL WHERE client_fingerprint = v_client_fingerprint;

    -- Log verification success (anonymously, no token value stored)
    PERFORM public.log_security_event('TOKEN_VERIFY_SUCCESS', 'SYSTEM', 'anonymous', NULL, v_client_ip, jsonb_build_object('election_id', p_election_id));

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 19. GRANT EXECUTE PRIVILEGES ON SECURITY OPERATIONS
GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_system_error(TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_security_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_audit_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_security_events() TO authenticated;
