-- Migration 20260612000000: Schema Simplification and Metadata Cleanup

-- 1. Alter elections table: Drop election_type
ALTER TABLE public.elections DROP COLUMN IF EXISTS election_type;

-- 2. Alter candidates table: Drop candidates_election_roll_unique constraint, roll_number column, and rename manifesto
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_election_roll_unique;
ALTER TABLE public.candidates DROP COLUMN IF EXISTS roll_number;
ALTER TABLE public.candidates RENAME COLUMN manifesto TO description;

-- 3. Recompile prevent_election_modification_after_start trigger function
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

-- 4. Recompile calculate_election_results function
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
            'votes', v_max_votes
        ))::jsonb INTO v_winners_json
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active' AND v.election_round = v_current_round
        GROUP BY c.id, c.candidate_name, c.department
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
            'votes', v_max_votes
        ))::jsonb INTO v_winner_id, v_winners_json
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active' AND v.election_round = v_current_round
        GROUP BY c.id, c.candidate_name, c.department
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

-- 5. Recompile commit_token_request function
CREATE OR REPLACE FUNCTION private.commit_token_request(
    p_voter_id UUID,
    p_election_id UUID,
    p_token_hash TEXT
)
RETURNS boolean AS $$
DECLARE
    v_roll_number TEXT;
    v_is_eligible BOOLEAN;
    v_election_status TEXT;
    v_election_end TIMESTAMPTZ;
    v_emergency_locked BOOLEAN;
    v_current_round INTEGER;
BEGIN
    -- Fetch election details & checks
    SELECT status, end_time, emergency_locked, current_round 
    INTO v_election_status, v_election_end, v_emergency_locked, v_current_round
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

    -- Eligibility check (Standardized)
    SELECT is_eligible INTO v_is_eligible
    FROM public.election_eligibility
    WHERE election_id = p_election_id AND roll_number = v_roll_number;

    IF COALESCE(v_is_eligible, FALSE) = FALSE THEN
        RAISE EXCEPTION 'Voter is not whitelisted for this election.';
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

-- 6. Recompile get_election_audit_report function
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
    SELECT id, election_name, election_code, status, current_round, winners
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
