-- Migration 20260605000000: Phase 5 Results Engine, Election Finalization, and Safeguards

-- 1. STANDARDIZE ELECTION STATUS VALUES TO UPPERCASE ENUMS
UPDATE public.elections SET status = 'DRAFT' WHERE status = 'Draft';
UPDATE public.elections SET status = 'ACTIVE' WHERE status = 'Active';
UPDATE public.elections SET status = 'PAUSED' WHERE status = 'Paused';
UPDATE public.elections SET status = 'COMPLETED' WHERE status = 'Completed';
UPDATE public.elections SET status = 'STOPPED' WHERE status = 'Emergency_Stopped' OR status = 'Stopped';
UPDATE public.elections SET status = 'DEADLOCK' WHERE status = 'Draw / Deadlock' OR status = 'Deadlock';
UPDATE public.elections SET status = 'ARCHIVED' WHERE status = 'Archived';

-- Update check constraint on elections status
ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_status_check;
ALTER TABLE public.elections ADD CONSTRAINT elections_status_check CHECK (
    status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED', 'DEADLOCK', 'ARCHIVED')
);

-- Add current_round and is_tie to elections
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS is_tie BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS joint_winners BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT NULL;

-- 2. ADD ROUNDS SUPPORT TO VOTES AND TOKENS
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS election_round INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS election_round INTEGER DEFAULT 1 NOT NULL;

-- Update voter_participation table for rounds
ALTER TABLE public.voter_participation DROP CONSTRAINT IF EXISTS voter_participation_pkey;
ALTER TABLE public.voter_participation ADD COLUMN IF NOT EXISTS election_round INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.voter_participation ADD CONSTRAINT voter_participation_pkey PRIMARY KEY (roll_number, election_id, election_round);

-- 3. CREATE SNAPSHOT TABLES FOR RESULTS AND SUMMARY
CREATE TABLE IF NOT EXISTS public.election_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    election_round INTEGER NOT NULL,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 0,
    vote_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    position_rank INTEGER NOT NULL,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.election_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    election_round INTEGER NOT NULL,
    winner_candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    total_votes INTEGER NOT NULL DEFAULT 0,
    total_eligible_voters INTEGER NOT NULL DEFAULT 0,
    turnout_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    result_generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_tie BOOLEAN NOT NULL DEFAULT FALSE,
    is_joint_winner BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_election_round UNIQUE (election_id, election_round)
);

-- Enable RLS
ALTER TABLE public.election_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_summary ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR RESULTS AND SUMMARIES
DROP POLICY IF EXISTS "Super admins can manage election_results" ON public.election_results;
CREATE POLICY "Super admins can manage election_results"
ON public.election_results FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can manage election_summary" ON public.election_summary;
CREATE POLICY "Super admins can manage election_summary"
ON public.election_summary FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Anyone can read election_results of finalized elections" ON public.election_results;
CREATE POLICY "Anyone can read election_results of finalized elections"
ON public.election_results FOR SELECT TO authenticated, anon
USING (
    EXISTS (
        SELECT 1 FROM public.elections e
        WHERE e.id = election_results.election_id
        AND e.status IN ('COMPLETED', 'STOPPED', 'DEADLOCK')
    )
);

DROP POLICY IF EXISTS "Anyone can read election_summary of finalized elections" ON public.election_summary;
CREATE POLICY "Anyone can read election_summary of finalized elections"
ON public.election_summary FOR SELECT TO authenticated, anon
USING (
    EXISTS (
        SELECT 1 FROM public.elections e
        WHERE e.id = election_summary.election_id
        AND e.status IN ('COMPLETED', 'STOPPED', 'DEADLOCK')
    )
);

-- 5. ENFORCE RESULTS IMMUTABILITY (APPEND-ONLY) VIA TRIGGERS
CREATE OR REPLACE FUNCTION public.prevent_results_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow bypass if explicitly configured for joint-winner resolution
    IF current_setting('public.bypass_results_immutability', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Election results and summaries are immutable once written.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_results_modification ON public.election_results;
CREATE TRIGGER trg_prevent_results_modification
    BEFORE UPDATE OR DELETE ON public.election_results
    FOR EACH ROW EXECUTE FUNCTION public.prevent_results_modification();

DROP TRIGGER IF EXISTS trg_prevent_summary_modification ON public.election_summary;
CREATE TRIGGER trg_prevent_summary_modification
    BEFORE UPDATE OR DELETE ON public.election_summary
    FOR EACH ROW EXECUTE FUNCTION public.prevent_results_modification();

-- 6. CANDIDATE AND ELIGIBILITY FREEZE ON NON-DRAFT TRIGGERS
CREATE OR REPLACE FUNCTION public.check_election_draft_status()
RETURNS TRIGGER AS $$
DECLARE
    v_election_status TEXT;
    v_election_id UUID;
END;
$$ LANGUAGE plpgsql;

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
    IF FOUND AND v_election_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Cannot modify candidates or eligibility when election is not in DRAFT status.';
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforce election metadata freezes on non-DRAFT
CREATE OR REPLACE FUNCTION public.prevent_election_modification_after_start()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> 'DRAFT' THEN
        -- Allow state transitions and any associated metadata updates
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            RETURN NEW;
        END IF;
        -- Otherwise, block configuration changes
        IF OLD.election_name IS DISTINCT FROM NEW.election_name OR
           OLD.election_type IS DISTINCT FROM NEW.election_type OR
           OLD.description IS DISTINCT FROM NEW.description OR
           OLD.election_code IS DISTINCT FROM NEW.election_code OR
           OLD.access_code IS DISTINCT FROM NEW.access_code OR
           OLD.start_time IS DISTINCT FROM NEW.start_time OR
           OLD.end_time IS DISTINCT FROM NEW.end_time THEN
            RAISE EXCEPTION 'Cannot modify election configuration once it is out of DRAFT status.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate election status logging trigger
CREATE OR REPLACE FUNCTION public.log_election_status_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_event_type := CASE NEW.status
            WHEN 'ACTIVE' THEN 'ELECTION_STARTED'
            WHEN 'PAUSED' THEN 'ELECTION_PAUSED'
            WHEN 'COMPLETED' THEN 'ELECTION_COMPLETED'
            WHEN 'STOPPED' THEN 'ELECTION_STOPPED'
            WHEN 'DEADLOCK' THEN 'DEADLOCK_DETECTED'
            ELSE 'ELECTION_STATUS_CHANGED'
        END;
        
        IF OLD.status = 'COMPLETED' AND NEW.status = 'ACTIVE' THEN
            v_event_type := 'ROUND_REOPENED';
        ELSIF OLD.status = 'DEADLOCK' AND NEW.status = 'ACTIVE' THEN
            v_event_type := 'ROUND_REOPENED';
        ELSIF OLD.status = 'PAUSED' AND NEW.status = 'ACTIVE' THEN
            v_event_type := 'ELECTION_RESUMED';
        END IF;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES (v_event_type, 'super_admin', 'Election "' || NEW.election_name || '" status changed from ' || OLD.status || ' to ' || NEW.status || '.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. SECURE RPC: CALCULATE ELECTION RESULTS
CREATE OR REPLACE FUNCTION public.calculate_election_results(p_election_id UUID)
RETURNS text AS $$
DECLARE
    v_current_round INTEGER;
    v_election_name TEXT;
    v_election_status TEXT;
    v_emergency_locked BOOLEAN;
    v_total_votes INTEGER;
    v_eligible_voters INTEGER;
    v_turnout_percentage NUMERIC(5,2);
    v_max_votes INTEGER;
    v_winner_count INTEGER;
    v_winner_id UUID;
    v_new_status TEXT;
    v_winners_json JSONB;
BEGIN
    -- Bypass auth checks for scheduled automatic finalization, otherwise require Super Admin
    IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Fetch and lock election details
    SELECT election_name, status, current_round, emergency_locked 
    INTO v_election_name, v_election_status, v_current_round, v_emergency_locked
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Only ACTIVE or PAUSED elections can be finalized
    IF v_election_status NOT IN ('ACTIVE', 'PAUSED') THEN
        RETURN v_election_status;
    END IF;

    -- Perform audit event
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('RESULTS_CALCULATED', 'super_admin', 'Initiated results aggregation for "' || v_election_name || '" (Round ' || v_current_round || ').');

    -- Calculate Turnout Index
    SELECT COUNT(*) INTO v_total_votes 
    FROM public.votes 
    WHERE election_id = p_election_id AND election_round = v_current_round;

    SELECT COUNT(*) INTO v_eligible_voters 
    FROM public.election_eligibility 
    WHERE election_id = p_election_id AND is_eligible = TRUE;

    IF v_eligible_voters > 0 THEN
        v_turnout_percentage := ROUND((v_total_votes::numeric / v_eligible_voters::numeric) * 100, 2);
    ELSE
        v_turnout_percentage := 0.00;
    END IF;

    -- Calculate maximum vote count amongst candidates
    SELECT COALESCE(MAX(cnt), 0) INTO v_max_votes
    FROM (
        SELECT COUNT(*) AS cnt
        FROM public.votes v
        JOIN public.candidates c ON v.candidate_id = c.id
        WHERE v.election_id = p_election_id AND v.election_round = v_current_round AND c.status = 'active'
        GROUP BY v.candidate_id
    ) sub;

    -- Handing completed with zero votes
    IF v_max_votes = 0 THEN
        v_new_status := 'COMPLETED';
        
        UPDATE public.elections
        SET status = v_new_status,
            is_tie = FALSE,
            joint_winners = FALSE,
            winners = '[]'::jsonb,
            end_time = LEAST(end_time, NOW())
        WHERE id = p_election_id;

        INSERT INTO public.election_summary (
            election_id, election_round, winner_candidate_id, total_votes, 
            total_eligible_voters, turnout_percentage, is_tie, is_joint_winner
        ) VALUES (
            p_election_id, v_current_round, NULL, 0, 
            v_eligible_voters, 0.00, FALSE, FALSE
        ) ON CONFLICT (election_id, election_round) DO NOTHING;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('ELECTION_COMPLETED', 'super_admin', 'Election "' || v_election_name || '" completed successfully with 0 votes.');
        
        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('RESULTS_PUBLISHED', 'super_admin', 'Results published for election "' || v_election_name || '".');

        RETURN v_new_status;
    END IF;

    -- Count candidate tied for first place
    SELECT COUNT(*) INTO v_winner_count
    FROM (
        SELECT c.id
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active' AND v.election_round = v_current_round
        GROUP BY c.id
        HAVING COUNT(v.id) = v_max_votes
    ) sub2;

    -- Insert Candidate stands snapshot
    INSERT INTO public.election_results (
        election_id, election_round, candidate_id, candidate_name, vote_count, vote_percentage, position_rank, is_winner
    )
    SELECT
        p_election_id,
        v_current_round,
        c.id,
        c.candidate_name,
        COUNT(v.id) as vote_count,
        ROUND((COUNT(v.id)::numeric / v_total_votes::numeric) * 100, 2) as vote_percentage,
        DENSE_RANK() OVER (ORDER BY COUNT(v.id) DESC) as position_rank,
        CASE WHEN COUNT(v.id) = v_max_votes AND v_winner_count = 1 THEN TRUE ELSE FALSE END as is_winner
    FROM public.candidates c
    LEFT JOIN public.votes v ON v.candidate_id = c.id AND v.election_round = v_current_round
    WHERE c.election_id = p_election_id AND c.status = 'active'
    GROUP BY c.id, c.candidate_name;

    -- Update election details
    IF v_winner_count > 1 THEN
        v_new_status := 'DEADLOCK';
        
        SELECT json_agg(json_build_object(
            'id', c.id,
            'name', c.candidate_name,
            'dept', c.department,
            'roll_number', c.roll_number,
            'votes', v_max_votes
        ))::jsonb INTO v_winners_json
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active' AND v.election_round = v_current_round
        GROUP BY c.id, c.candidate_name, c.department, c.roll_number
        HAVING COUNT(v.id) = v_max_votes;

        UPDATE public.elections
        SET status = v_new_status,
            is_tie = TRUE,
            joint_winners = FALSE,
            winners = v_winners_json,
            end_time = LEAST(end_time, NOW())
        WHERE id = p_election_id;

        INSERT INTO public.election_summary (
            election_id, election_round, winner_candidate_id, total_votes, 
            total_eligible_voters, turnout_percentage, is_tie, is_joint_winner
        ) VALUES (
            p_election_id, v_current_round, NULL, v_total_votes, 
            v_eligible_voters, v_turnout_percentage, TRUE, FALSE
        ) ON CONFLICT (election_id, election_round) DO NOTHING;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('DEADLOCK_DETECTED', 'super_admin', 'Tie deadlock detected in election "' || v_election_name || '" between ' || v_winner_count || ' candidates.');

    ELSE
        v_new_status := 'COMPLETED';

        SELECT c.id, json_build_array(json_build_object(
            'id', c.id,
            'name', c.candidate_name,
            'dept', c.department,
            'roll_number', c.roll_number,
            'votes', v_max_votes
        ))::jsonb INTO v_winner_id, v_winners_json
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active' AND v.election_round = v_current_round
        GROUP BY c.id, c.candidate_name, c.department, c.roll_number
        HAVING COUNT(v.id) = v_max_votes;

        UPDATE public.elections
        SET status = v_new_status,
            is_tie = FALSE,
            joint_winners = FALSE,
            winners = v_winners_json,
            end_time = LEAST(end_time, NOW())
        WHERE id = p_election_id;

        INSERT INTO public.election_summary (
            election_id, election_round, winner_candidate_id, total_votes, 
            total_eligible_voters, turnout_percentage, is_tie, is_joint_winner
        ) VALUES (
            p_election_id, v_current_round, v_winner_id, v_total_votes, 
            v_eligible_voters, v_turnout_percentage, FALSE, FALSE
        ) ON CONFLICT (election_id, election_round) DO NOTHING;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('WINNER_DECLARED', 'super_admin', 'Winner declared for "' || v_election_name || '".');

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('ELECTION_COMPLETED', 'super_admin', 'Election "' || v_election_name || '" completed successfully.');
    END IF;

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('RESULTS_PUBLISHED', 'super_admin', 'Results published for election "' || v_election_name || '".');

    RETURN v_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recompile finalize_election RPC
CREATE OR REPLACE FUNCTION public.finalize_election(p_election_id UUID)
RETURNS text AS $$
BEGIN
    RETURN public.calculate_election_results(p_election_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. SECURE RPC: DECLARE JOINT WINNERS
CREATE OR REPLACE FUNCTION public.declare_joint_winners(p_election_id UUID)
RETURNS boolean AS $$
DECLARE
    v_current_round INTEGER;
    v_election_name TEXT;
    v_election_status TEXT;
BEGIN
    -- Assert Super Admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    SELECT election_name, status, current_round 
    INTO v_election_name, v_election_status, v_current_round
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_election_status <> 'DEADLOCK' THEN
        RAISE EXCEPTION 'Joint winners can only be declared for elections in DEADLOCK status.';
    END IF;

    -- Bypass immutability rules temporarily
    PERFORM set_config('public.bypass_results_immutability', 'true', true);

    -- Update election
    UPDATE public.elections
    SET status = 'COMPLETED',
        joint_winners = TRUE
    WHERE id = p_election_id;

    -- Update results standings
    UPDATE public.election_results
    SET is_winner = TRUE
    WHERE election_id = p_election_id AND election_round = v_current_round AND position_rank = 1;

    -- Update summary statistics
    UPDATE public.election_summary
    SET is_joint_winner = TRUE,
        is_tie = FALSE
    WHERE election_id = p_election_id AND election_round = v_current_round;

    -- Restore immutability
    PERFORM set_config('public.bypass_results_immutability', 'false', true);

    -- Standardized audit trails
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('JOINT_WINNERS_DECLARED', 'super_admin', 'Declared Joint Winners override executed for election "' || v_election_name || '".');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('WINNER_DECLARED', 'super_admin', 'Winners declared for "' || v_election_name || '" (Joint Winners).');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('RESULTS_PUBLISHED', 'super_admin', 'Joint winner results published for election "' || v_election_name || '".');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('ELECTION_COMPLETED', 'super_admin', 'Election "' || v_election_name || '" completed successfully after tie-break.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. SECURE RPC: REOPEN DEADLOCK ELECTION FOR NEXT ROUND
CREATE OR REPLACE FUNCTION public.reopen_election(p_election_id UUID, p_new_end_time TIMESTAMPTZ)
RETURNS boolean AS $$
DECLARE
    v_election_status TEXT;
    v_election_name TEXT;
    v_current_round INTEGER;
BEGIN
    -- Assert Super Admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    SELECT election_name, status, current_round INTO v_election_name, v_election_status, v_current_round
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Enforce reopen safeguard: strictly DEADLOCK elections only
    IF v_election_status <> 'DEADLOCK' THEN
        RAISE EXCEPTION 'Only elections in DEADLOCK status can be reopened.';
    END IF;

    IF p_new_end_time <= NOW() THEN
        RAISE EXCEPTION 'The new voting end time must be in the future.';
    END IF;

    -- Increment round and change status to ACTIVE
    UPDATE public.elections
    SET status = 'ACTIVE',
        is_tie = FALSE,
        joint_winners = FALSE,
        winners = NULL,
        current_round = v_current_round + 1,
        end_time = p_new_end_time
    WHERE id = p_election_id;

    -- Audit trails
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('ROUND_REOPENED', 'super_admin', 'Reopened election "' || v_election_name || '" to Round ' || (v_current_round + 1) || '. Set new window until ' || p_new_end_time || '.');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('ELECTION_REOPENED', 'super_admin', 'Reopened election "' || v_election_name || '" for voting.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. SECURE RPC: EMERGENCY STOP ELECTION
CREATE OR REPLACE FUNCTION public.emergency_stop_election(p_election_id UUID, p_publish_results BOOLEAN)
RETURNS boolean AS $$
DECLARE
    v_election_name TEXT;
    v_current_round INTEGER;
BEGIN
    -- Assert Super Admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    SELECT election_name, current_round INTO v_election_name, v_current_round
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Stop election and lockdown
    UPDATE public.elections
    SET status = 'STOPPED',
        emergency_locked = TRUE,
        end_time = LEAST(end_time, NOW())
    WHERE id = p_election_id;

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('ELECTION_STOPPED', 'super_admin', 'EMERGENCY STOP executed on "' || v_election_name || '". Voting immediately halted.');

    -- If results calculation requested
    IF p_publish_results = TRUE THEN
        PERFORM public.calculate_election_results(p_election_id);
        
        -- Restore status to STOPPED
        UPDATE public.elections
        SET status = 'STOPPED'
        WHERE id = p_election_id;

        INSERT INTO public.audit_logs (event_type, actor, details)
        VALUES ('EMERGENCY_RESULTS_PUBLISHED', 'super_admin', 'Standings snapshot published under Emergency Stopped state for "' || v_election_name || '".');
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. SECURE RPC: AUTOMATIC EXPIRED COMPLETION
CREATE OR REPLACE FUNCTION public.check_and_finalize_expired_elections()
RETURNS void AS $$
DECLARE
    v_rec RECORD;
BEGIN
    FOR v_rec IN 
        SELECT id FROM public.elections 
        WHERE end_time < NOW() AND status = 'ACTIVE'
    LOOP
        PERFORM public.calculate_election_results(v_rec.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. ENFORCE ROUND ISOLATION & EMERGENCY LOCKS ON VOTING ACTIONS
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
    v_current_round INTEGER;
BEGIN
    -- Fetch election details & checks
    SELECT election_type, status, end_time, emergency_locked, current_round 
    INTO v_election_type, v_election_status, v_election_end, v_emergency_locked, v_current_round
    FROM public.elections
    WHERE id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Strict emergency lockdown checks
    IF v_emergency_locked = TRUE OR v_election_status = 'STOPPED' THEN
        RAISE EXCEPTION 'Operation blocked. Election is emergency stopped/locked.';
    END IF;

    IF v_election_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Election is not currently active for token requests.';
    END IF;

    -- Voter profile validation
    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE auth_user_id = p_voter_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    -- Whitelist check
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

    -- Double-voting and double-request check (ROUND SPECIFIC)
    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND election_round = v_current_round AND has_voted = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already voted in this election round.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.voter_participation
        WHERE roll_number = v_roll_number AND election_id = p_election_id AND election_round = v_current_round AND has_requested_token = TRUE
    ) THEN
        RAISE EXCEPTION 'Voter has already requested a token for this election round.';
    END IF;

    -- Insert token with round number
    INSERT INTO public.tokens (token_hash, election_id, election_round, status)
    VALUES (p_token_hash, p_election_id, v_current_round, 'unused');

    -- Insert temporary session mapping
    INSERT INTO public.token_delivery_sessions (election_id, roll_number, token_hash, expires_at)
    VALUES (p_election_id, v_roll_number, p_token_hash, v_election_end);

    -- Mark voter participation
    INSERT INTO public.voter_participation (roll_number, election_id, election_round, has_requested_token)
    VALUES (v_roll_number, p_election_id, v_current_round, TRUE)
    ON CONFLICT (roll_number, election_id, election_round)
    DO UPDATE SET has_requested_token = TRUE;

    -- Audit Logs
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_REQUESTED', v_roll_number, 'Voter requested election token successfully for round ' || v_current_round || '.');

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_DELIVERED', v_roll_number, 'Cryptographic voting token successfully generated and dispatched for round ' || v_current_round || '.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recompile verify_token RPC
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
    v_current_round INTEGER;
    v_session RECORD;
END;
$$ LANGUAGE plpgsql;

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
    v_current_round INTEGER;
    v_session RECORD;
BEGIN
    -- Extract IP
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

    -- Expiration validation
    SELECT * INTO v_session FROM public.token_delivery_sessions WHERE token_hash = v_token_hash;
    IF (FOUND AND v_session.expires_at IS NOT NULL AND NOW() > v_session.expires_at) OR (NOW() >= v_election_end) THEN
        UPDATE public.tokens SET status = 'expired' WHERE token_hash = v_token_hash;
        RAISE EXCEPTION 'Token Expired.';
    END IF;

    -- Reset rate limit
    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    -- Log verification
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_VERIFIED', 'anonymous', 'Secure voting credentials validated.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recompile submit_vote RPC
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
    v_current_round INTEGER;
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

    -- Fetch election details & emergency lock status
    SELECT status, emergency_locked, current_round 
    INTO v_election_status, v_emergency_locked, v_current_round
    FROM public.elections
    WHERE id = v_token.election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    -- Strict emergency lockdown checks
    IF v_emergency_locked = TRUE OR v_election_status = 'STOPPED' THEN
        RAISE EXCEPTION 'Operation blocked. Election is emergency stopped/locked.';
    END IF;

    IF v_election_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Election is not currently accepting votes.';
    END IF;

    -- Round isolation check
    IF v_token.election_round <> v_current_round THEN
        RAISE EXCEPTION 'Token round (%) does not match current round (%).', v_token.election_round, v_current_round;
    END IF;

    -- Candidate validation
    IF NOT EXISTS (
        SELECT 1 FROM public.candidates
        WHERE id = p_candidate_id AND election_id = v_token.election_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Selected candidate is not active or does not belong to this election.';
    END IF;

    -- Delivery session check
    SELECT roll_number INTO v_roll_number
    FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter delivery session not found. Integrity breached.';
    END IF;

    -- Insert vote with round
    INSERT INTO public.votes (token_hash, candidate_id, election_id, election_round)
    VALUES (v_token_hash, p_candidate_id, v_token.election_id, v_current_round);

    -- Update token status
    UPDATE public.tokens
    SET status = 'used', used_at = NOW()
    WHERE token_hash = v_token_hash;

    -- Update voter participation for round
    UPDATE public.voter_participation
    SET has_voted = TRUE
    WHERE roll_number = v_roll_number AND election_id = v_token.election_id AND election_round = v_current_round;

    -- Sever link
    DELETE FROM public.token_delivery_sessions
    WHERE token_hash = v_token_hash;

    -- Audit Trail
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('VOTE_SUBMITTED', 'anonymous', 'Ballot cast and cryptographically sealed for round ' || v_current_round || '.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recompile verify_portal_token RPC (Simplicity, Round validation, standardized statuses)
CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS jsonb AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_client_ip TEXT;
    v_cooldown TIMESTAMPTZ;
    v_election_status TEXT;
    v_election_name TEXT;
    v_current_round INTEGER;
    v_status_text TEXT;
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

    SELECT election_name, status, current_round 
    INTO v_election_name, v_election_status, v_current_round
    FROM public.elections
    WHERE id = v_token.election_id;

    -- Round Isolation: Prevent old-round tokens from being queried
    IF v_token.election_round <> v_current_round THEN
        RAISE EXCEPTION 'Token round (%) does not match current round (%).', v_token.election_round, v_current_round;
    END IF;

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_VERIFIED', 'anonymous', 'Token status queried via public portal for election: ' || v_election_name);

    -- Determine status text
    IF v_token.status = 'unused' THEN
        IF v_election_status = 'ACTIVE' THEN
            v_status_text := 'Election Still In Progress';
        ELSE
            v_status_text := 'Pending Counting';
        END IF;
    ELSIF v_token.status = 'used' THEN
        IF v_election_status IN ('COMPLETED', 'STOPPED', 'DEADLOCK') THEN
            v_status_text := '✓ Vote Counted';
        ELSIF v_election_status = 'ACTIVE' THEN
            v_status_text := '✓ Vote Recorded';
        ELSE
            v_status_text := 'Pending Counting';
        END IF;
    ELSIF v_token.status = 'invalidated' THEN
        v_status_text := '✗ Token Invalidated';
    ELSE
        v_status_text := '✗ Token Expired';
    END IF;

    -- Return JSONB payload with ONLY status and election name (NO candidates/rankings/choices)
    RETURN jsonb_build_object(
        'status', v_status_text,
        'election_name', v_election_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. AUDIT POLICY: SUPER ADMINS CAN READ ALL VOTES AT ANY TIME
DROP POLICY IF EXISTS "Super admins can read votes when completed" ON public.votes;
CREATE POLICY "Super admins can read votes at any time"
ON public.votes
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- Recompile voter SELECT policy on votes table (standardized statuses)
DROP POLICY IF EXISTS "Anyone can read votes for finalized elections" ON public.votes;
CREATE POLICY "Anyone can read votes for finalized elections"
ON public.votes
FOR SELECT
TO authenticated, anon
USING (
    EXISTS (
        SELECT 1 FROM public.elections e
        WHERE e.id = votes.election_id
        AND e.status IN ('COMPLETED', 'STOPPED', 'DEADLOCK')
    )
);

-- 14. CREATE ELECTION INTEGRITY REPORT VIEW
CREATE OR REPLACE VIEW public.election_integrity_report WITH (security_invoker = true) AS
SELECT
    e.id AS election_id,
    e.election_name,
    e.current_round AS current_round,
    (SELECT COUNT(*) FROM public.tokens t WHERE t.election_id = e.id AND t.election_round = e.current_round) AS total_tokens_generated,
    (SELECT COUNT(*) FROM public.tokens t WHERE t.election_id = e.id AND t.election_round = e.current_round AND t.status = 'used') AS total_tokens_verified,
    (SELECT COUNT(*) FROM public.votes v WHERE v.election_id = e.id AND v.election_round = e.current_round) AS total_votes_cast,
    (SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE) AS eligible_voters,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE) > 0 
        THEN ROUND(((SELECT COUNT(*) FROM public.votes v WHERE v.election_id = e.id AND v.election_round = e.current_round)::numeric / (SELECT COUNT(*) FROM public.election_eligibility ee WHERE ee.election_id = e.id AND ee.is_eligible = TRUE)::numeric) * 100, 2)
        ELSE 0.00
    END AS participation_percentage,
    COALESCE((SELECT COUNT(*) FROM public.audit_logs al WHERE al.event_type = 'TOKEN_FAILED' AND al.details LIKE '%' || e.election_name || '%'), 0) AS invalid_token_attempts,
    COALESCE((SELECT COUNT(*) FROM public.audit_logs al WHERE al.event_type = 'RATE_LIMIT' AND al.details LIKE '%' || e.election_name || '%'), 0) AS blocked_verification_attempts
FROM public.elections e;

-- 15. GRANT SELECT PRIVILEGES
GRANT SELECT ON public.election_results TO authenticated, anon;
GRANT SELECT ON public.election_summary TO authenticated, anon;
GRANT SELECT ON public.election_integrity_report TO authenticated, anon;

-- 16. SECURE CLEANUP HELPER FUNCTION FOR SUPER ADMINS
CREATE OR REPLACE FUNCTION public.delete_election_records(p_election_id UUID)
RETURNS void AS $$
BEGIN
    -- Check if super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Bypass immutability rules temporarily
    PERFORM set_config('public.bypass_results_immutability', 'true', true);

    -- Delete votes referencing the election's candidates or the election itself
    DELETE FROM public.votes WHERE election_id = p_election_id;
    
    -- Delete token delivery sessions
    DELETE FROM public.token_delivery_sessions WHERE election_id = p_election_id;

    -- Delete tokens
    DELETE FROM public.tokens WHERE election_id = p_election_id;

    -- Delete voter participation
    DELETE FROM public.voter_participation WHERE election_id = p_election_id;

    -- Delete election results
    DELETE FROM public.election_results WHERE election_id = p_election_id;

    -- Delete election summary
    DELETE FROM public.election_summary WHERE election_id = p_election_id;

    -- Delete election itself
    DELETE FROM public.elections WHERE id = p_election_id;

    -- Restore immutability
    PERFORM set_config('public.bypass_results_immutability', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_election_records(UUID) TO authenticated;


