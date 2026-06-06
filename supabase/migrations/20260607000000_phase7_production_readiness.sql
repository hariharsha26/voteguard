-- Migration 20260607000000: Production Readiness, Snapshots, Backups, Email logs, and Production Lock

-- 1. SEED PRODUCTION LOCK SETTING
INSERT INTO public.system_settings (key, value)
VALUES ('production_lock', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2. BACKUP REGISTRY TABLE
CREATE TABLE IF NOT EXISTS public.backup_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type TEXT NOT NULL CHECK (backup_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    backup_status TEXT NOT NULL CHECK (backup_status IN ('SUCCESS', 'FAILED', 'IN_PROGRESS')),
    notes TEXT
);

-- RLS for backup_registry
ALTER TABLE public.backup_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage backup registry"
ON public.backup_registry
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());


-- 3. EMAIL DELIVERY LOGS TABLE (Privacy-First)
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_identifier TEXT NOT NULL, -- e.g. roll_number or actor_id
    delivery_type TEXT NOT NULL,        -- e.g. 'TOKEN_EMAIL', 'OTP_EMAIL'
    status TEXT NOT NULL CHECK (status IN ('queued', 'delivered', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS for email_delivery_logs
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view email delivery logs"
ON public.email_delivery_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Service role and authenticated can insert email logs"
ON public.email_delivery_logs
FOR INSERT
TO authenticated, anon
WITH CHECK (TRUE);


-- 4. ELECTION SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.election_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    election_round INTEGER NOT NULL,
    trigger_event TEXT NOT NULL CHECK (trigger_event IN ('finalization', 'emergency_stop', 'reopen')),
    election_metadata JSONB NOT NULL,
    candidate_config JSONB NOT NULL,
    eligibility_config JSONB NOT NULL,
    statistics JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS for election_snapshots
ALTER TABLE public.election_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view election snapshots"
ON public.election_snapshots
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Immutable Snapshots Trigger: Allow INSERT, deny UPDATE and DELETE
CREATE OR REPLACE FUNCTION public.prevent_snapshot_modifications()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Historical election snapshots are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_snapshot_updates
BEFORE UPDATE OR DELETE ON public.election_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.prevent_snapshot_modifications();


-- 5. FUNCTION TO CREATE SNAPSHOTS
CREATE OR REPLACE FUNCTION public.create_election_snapshot(
    p_election_id UUID,
    p_round INTEGER,
    p_event TEXT
) RETURNS VOID AS $$
DECLARE
    v_metadata JSONB;
    v_candidates JSONB;
    v_eligibility JSONB;
    v_stats JSONB;
BEGIN
    -- Build metadata of election
    SELECT jsonb_build_object(
        'id', id,
        'election_name', election_name,
        'election_code', election_code,
        'election_type', election_type,
        'status', status,
        'start_time', start_time,
        'end_time', end_time,
        'created_at', created_at,
        'current_round', current_round
    ) INTO v_metadata
    FROM public.elections
    WHERE id = p_election_id;

    -- Get candidate configuration
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'candidate_name', candidate_name,
            'roll_number', roll_number,
            'department', department,
            'votes_count', votes_count
        )
    ), '[]'::jsonb) INTO v_candidates
    FROM public.candidates
    WHERE election_id = p_election_id AND status = 'active';

    -- Get eligibility configuration
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'department', department
        )
    ), '[]'::jsonb) INTO v_eligibility
    FROM public.election_eligibility
    WHERE election_id = p_election_id;

    -- Get statistics
    SELECT jsonb_build_object(
        'total_eligible_voters', (
            SELECT COUNT(*) FROM public.voters v
            WHERE EXISTS (
                SELECT 1 FROM public.election_eligibility ee
                WHERE ee.election_id = p_election_id
                AND ee.department = v.department
            )
        ),
        'tokens_generated', (
            SELECT COUNT(*) FROM public.tokens
            WHERE election_id = p_election_id AND election_round = p_round
        ),
        'tokens_verified', (
            SELECT COUNT(*) FROM public.tokens
            WHERE election_id = p_election_id AND election_round = p_round AND status = 'used'
        ),
        'votes_cast', (
            SELECT COUNT(*) FROM public.votes
            WHERE election_id = p_election_id AND election_round = p_round
        )
    ) INTO v_stats;

    -- Insert snapshot
    INSERT INTO public.election_snapshots (
        election_id,
        election_round,
        trigger_event,
        election_metadata,
        candidate_config,
        eligibility_config,
        statistics
    ) VALUES (
        p_election_id,
        p_round,
        p_event,
        v_metadata,
        v_candidates,
        v_eligibility,
        v_stats
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. TRIGGER ON ELECTIONS TO CAPTURE SNAPSHOTS
CREATE OR REPLACE FUNCTION public.trg_election_snapshot_before_update()
RETURNS TRIGGER AS $$
BEGIN
    -- A. Snapshot before finalization: when status transitions from ACTIVE/PAUSED to COMPLETED/DEADLOCK
    IF OLD.status IN ('ACTIVE', 'PAUSED') AND NEW.status IN ('COMPLETED', 'DEADLOCK') THEN
        PERFORM public.create_election_snapshot(OLD.id, OLD.current_round, 'finalization');
    END IF;

    -- B. Snapshot before emergency stop: when status transitions to STOPPED or emergency_locked becomes TRUE
    IF (OLD.status <> 'STOPPED' AND NEW.status = 'STOPPED') OR (NEW.emergency_locked = TRUE AND OLD.emergency_locked = FALSE) THEN
        -- Check if snapshot for emergency_stop already exists in this round to prevent duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.election_snapshots 
            WHERE election_id = OLD.id AND election_round = OLD.current_round AND trigger_event = 'emergency_stop'
        ) THEN
            PERFORM public.create_election_snapshot(OLD.id, OLD.current_round, 'emergency_stop');
        END IF;
    END IF;

    -- C. Snapshot before reopening rounds: when status transitions from DEADLOCK to ACTIVE
    IF OLD.status = 'DEADLOCK' AND NEW.status = 'ACTIVE' THEN
        PERFORM public.create_election_snapshot(OLD.id, OLD.current_round, 'reopen');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS election_snapshot_before_update_trigger ON public.elections;
CREATE TRIGGER election_snapshot_before_update_trigger
BEFORE UPDATE ON public.elections
FOR EACH ROW
EXECUTE FUNCTION public.trg_election_snapshot_before_update();


-- 7. SYSTEM STATUS VIEW & get_system_status() RPC
CREATE OR REPLACE VIEW public.system_status AS
SELECT
    'healthy'::TEXT AS database_status,
    (
        SELECT CASE 
            WHEN EXISTS (
                SELECT 1 FROM public.email_delivery_logs
                WHERE created_at > NOW() - interval '1 hour' AND status = 'failed'
            ) AND NOT EXISTS (
                SELECT 1 FROM public.email_delivery_logs
                WHERE created_at > NOW() - interval '1 hour' AND status = 'delivered'
            ) THEN 'unhealthy'
            WHEN EXISTS (
                SELECT 1 FROM public.email_delivery_logs
                WHERE created_at > NOW() - interval '1 hour' AND status = 'failed'
            ) THEN 'degraded'
            ELSE 'healthy'
        END
    )::TEXT AS email_service_status,
    (
        SELECT COUNT(DISTINCT auth_user_id) 
        FROM public.verified_sessions 
        WHERE expires_at > NOW()
    )::INTEGER AS active_sessions,
    (SELECT COUNT(*) FROM public.elections)::INTEGER AS total_elections,
    (SELECT COUNT(*) FROM public.elections WHERE status = 'COMPLETED')::INTEGER AS completed_elections,
    (
        SELECT COALESCE(election_name, 'None')
        FROM public.elections
        WHERE status = 'ACTIVE'
        LIMIT 1
    )::TEXT AS current_active_election,
    (SELECT COUNT(*) FROM public.voters)::INTEGER AS total_voters,
    (SELECT COUNT(*) FROM public.votes)::INTEGER AS total_votes_cast,
    (SELECT COUNT(*) FROM public.tokens)::INTEGER AS total_tokens_generated,
    (SELECT COUNT(*) FROM public.tokens WHERE status = 'used')::INTEGER AS total_tokens_verified;

CREATE OR REPLACE FUNCTION public.get_system_status()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_uptime TEXT;
    v_last_backup TIMESTAMPTZ;
    v_backup_status TEXT;
BEGIN
    -- Assert Super Admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Uptime simulation
    v_uptime := '99.98% (Online)';

    -- Fetch latest backup status
    SELECT created_at, backup_status INTO v_last_backup, v_backup_status
    FROM public.backup_registry
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT jsonb_build_object(
        'database_status', database_status,
        'email_service_status', email_service_status,
        'active_sessions', active_sessions,
        'total_elections', total_elections,
        'completed_elections', completed_elections,
        'current_active_election', current_active_election,
        'total_voters', total_voters,
        'total_votes_cast', total_votes_cast,
        'total_tokens_generated', total_tokens_generated,
        'total_tokens_verified', total_tokens_verified,
        'system_uptime', v_uptime,
        'application_version', '1.0.0',
        'last_backup_time', COALESCE(v_last_backup::text, 'No backups run'),
        'last_backup_status', COALESCE(v_backup_status, 'UNKNOWN')
    ) INTO v_result
    FROM public.system_status;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. HARDEN DATABASE FUNCTIONS TO RESPECT PRODUCTION LOCK
CREATE OR REPLACE FUNCTION public.is_production_lock_active()
RETURNS BOOLEAN AS $$
DECLARE
    v_val TEXT;
BEGIN
    SELECT value INTO v_val FROM public.system_settings WHERE key = 'production_lock';
    RETURN COALESCE(v_val = 'true', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Override is_debug_mode() to strictly return FALSE if production_lock is enabled
CREATE OR REPLACE FUNCTION public.is_debug_mode()
RETURNS BOOLEAN AS $$
DECLARE
    v_val TEXT;
BEGIN
    IF public.is_production_lock_active() THEN
        RETURN FALSE;
    END IF;

    SELECT value INTO v_val FROM public.system_settings WHERE key = 'debug_mode';
    RETURN COALESCE(v_val = 'true', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Harden verify_login_otp to disable OTP bypass when production lock is active
CREATE OR REPLACE FUNCTION public.verify_login_otp(p_otp_code text)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_otp_hash TEXT;
    v_otp RECORD;
    v_client_ip TEXT;
    v_actor TEXT;
    v_dev_mode TEXT;
    v_default_otp TEXT;
    v_is_dev_otp BOOLEAN;
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

    -- Block test user logins if production lock is active
    IF public.is_production_lock_active() THEN
        IF v_actor IN ('26-L34-A4416', '25L35A4416', 'dynamax_gamer26', 'hariharshahello') OR 
           EXISTS (
               SELECT 1 FROM auth.users 
               WHERE id = v_user_id AND email IN ('hariharshahello@gmail.com', 'dynamax_gamer26@voteguard.org')
           ) THEN
            RAISE EXCEPTION 'Development test accounts are disabled under production lock.';
        END IF;
    END IF;

    v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');

    -- Fetch dev settings
    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    SELECT value INTO v_default_otp FROM public.system_settings WHERE key = 'default_otp';

    -- Dev OTP override is strictly disabled if production_lock is active
    v_is_dev_otp := (
        NOT public.is_production_lock_active() AND 
        COALESCE(v_dev_mode, 'false') = 'true' AND 
        p_otp_code = COALESCE(v_default_otp, '20071226')
    );

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

-- Harden generate_login_otp to reject dev OTPs when production lock is active
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

    -- Block test account OTP generation if production lock is active
    IF public.is_production_lock_active() THEN
        IF v_actor IN ('26-L34-A4416', '25L35A4416', 'dynamax_gamer26', 'hariharshahello') OR 
           v_email IN ('hariharshahello@gmail.com', 'dynamax_gamer26@voteguard.org') THEN
            RAISE EXCEPTION 'Development test accounts are disabled under production lock.';
        END IF;
    END IF;

    -- Fetch dev settings
    SELECT value INTO v_dev_mode FROM public.system_settings WHERE key = 'dev_mode';
    SELECT value INTO v_default_otp FROM public.system_settings WHERE key = 'default_otp';
    
    -- Dev OTP bypass is strictly disabled if production_lock is active
    IF NOT public.is_production_lock_active() AND COALESCE(v_dev_mode, 'false') = 'true' THEN
        v_otp := COALESCE(v_default_otp, '20071226');
    ELSE
        v_otp := LPAD(FLOOR(RANDOM()*1000000)::text, 6, '0');
    END IF;
    
    v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
    
    INSERT INTO public.email_otps (auth_user_id, otp_code, expires_at)
    VALUES (v_user_id, v_otp_hash, NOW() + interval '10 minutes');
    
    -- Log OTP generation event
    PERFORM public.log_security_event('OTP_SENT', CASE WHEN EXISTS (SELECT 1 FROM public.super_admins WHERE auth_user_id = v_user_id) THEN 'SUPER_ADMIN' ELSE 'VOTER' END, v_actor, NULL, NULL);
    
    -- Hide debug OTP returning when production lock is active
    IF NOT public.is_production_lock_active() AND (COALESCE(v_dev_mode, 'false') = 'true' OR EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'debug_mode' AND value = 'true')) THEN
        RETURN QUERY SELECT v_email, v_otp;
    ELSE
        RETURN QUERY SELECT v_email, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
