-- Migration 20260604000300: Results Engine, Tie Resolution, Re-open, and Results RLS policies

-- 1. ALTER STATUS CONSTRAINT TO SUPPORT 'Draw / Deadlock'
ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_status_check;
ALTER TABLE public.elections ADD CONSTRAINT elections_status_check CHECK (
    status IN ('Draft', 'Active', 'Paused', 'Completed', 'Emergency_Stopped', 'Archived', 'Draw / Deadlock')
);

-- 2. ADD COLUMNS FOR WINNER METADATA
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS joint_winners BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT NULL;

-- 3. UPDATE ELECTION INTEGRITY TRIGGER TO INCLUDE 'Draw / Deadlock'
CREATE OR REPLACE FUNCTION public.check_election_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_used_tokens INTEGER;
    v_votes_cast INTEGER;
BEGIN
    -- Assert integrity when election ends (status changes to Completed, Emergency_Stopped, or Draw / Deadlock)
    IF NEW.status IN ('Completed', 'Emergency_Stopped', 'Draw / Deadlock') AND OLD.status NOT IN ('Completed', 'Emergency_Stopped', 'Draw / Deadlock') THEN
        -- Count tokens marked as 'used' for this election
        SELECT COUNT(*) INTO v_used_tokens
        FROM public.tokens
        WHERE election_id = NEW.id AND status = 'used';

        -- Count actual cast ballots
        SELECT COUNT(*) INTO v_votes_cast
        FROM public.votes
        WHERE election_id = NEW.id;

        -- Enforce integrity constraint
        IF v_used_tokens <> v_votes_cast THEN
            RAISE EXCEPTION 'Election Integrity Check Failed: Number of used tokens (%) does not match cast votes (%). Result publication aborted.', 
                v_used_tokens, v_votes_cast;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE ELECTION STATUS AUDIT LOGGING TRIGGER FOR 'Draw / Deadlock'
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
            WHEN 'Draw / Deadlock' THEN 'ELECTION_TIE'
            ELSE 'ELECTION_STATUS_CHANGED'
        END;
        
        -- Override for reopening/resuming
        IF OLD.status = 'Completed' AND NEW.status = 'Active' THEN
            v_event_type := 'ELECTION_REOPENED';
        ELSIF OLD.status = 'Draw / Deadlock' AND NEW.status = 'Active' THEN
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

-- 5. RPC: FINALIZE ELECTION
CREATE OR REPLACE FUNCTION public.finalize_election(p_election_id UUID)
RETURNS text AS $$
DECLARE
    v_max_votes BIGINT;
    v_winner_count INTEGER;
    v_winners_json JSONB;
    v_used_tokens INTEGER;
    v_votes_cast INTEGER;
    v_election_name TEXT;
    v_new_status TEXT;
BEGIN
    -- Assert caller is super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    -- Fetch and lock the election row
    SELECT election_name, status INTO v_election_name, v_new_status
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_new_status NOT IN ('Active', 'Paused') THEN
        RAISE EXCEPTION 'Only Active or Paused elections can be finalized. Current status: %', v_new_status;
    END IF;

    -- Perform manual integrity check before changing status
    SELECT COUNT(*) INTO v_used_tokens FROM public.tokens WHERE election_id = p_election_id AND status = 'used';
    SELECT COUNT(*) INTO v_votes_cast FROM public.votes WHERE election_id = p_election_id;
    IF v_used_tokens <> v_votes_cast THEN
        RAISE EXCEPTION 'Election Integrity Check Failed: Number of used tokens (%) does not match cast votes (%). Result publication aborted.', 
            v_used_tokens, v_votes_cast;
    END IF;

    -- Calculate maximum vote count amongst candidates
    SELECT COALESCE(MAX(cnt), 0) INTO v_max_votes
    FROM (
        SELECT COUNT(*) AS cnt
        FROM public.votes
        WHERE election_id = p_election_id
        GROUP BY candidate_id
    ) sub;

    -- If no votes cast or no candidates
    IF v_max_votes = 0 THEN
        UPDATE public.elections
        SET status = 'Completed',
            joint_winners = FALSE,
            winners = '[]'::jsonb,
            end_time = LEAST(end_time, NOW())
        WHERE id = p_election_id;
        
        RETURN 'Completed';
    END IF;

    -- Count how many candidates have the max vote count
    SELECT COUNT(*) INTO v_winner_count
    FROM (
        SELECT c.id
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active'
        GROUP BY c.id
        HAVING COUNT(v.id) = v_max_votes
    ) sub2;

    -- If single winner
    IF v_winner_count = 1 THEN
        SELECT json_build_array(json_build_object(
            'id', c.id,
            'name', c.candidate_name,
            'dept', c.department,
            'roll_number', c.roll_number,
            'votes', v_max_votes
        ))::jsonb INTO v_winners_json
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active'
        GROUP BY c.id, c.candidate_name, c.department, c.roll_number
        HAVING COUNT(v.id) = v_max_votes;

        UPDATE public.elections
        SET status = 'Completed',
            joint_winners = FALSE,
            winners = v_winners_json,
            end_time = LEAST(end_time, NOW())
        WHERE id = p_election_id;
        
        RETURN 'Completed';
    ELSE
        -- Tie / Draw deadlock between multiple candidates
        SELECT json_agg(json_build_object(
            'id', c.id,
            'name', c.candidate_name,
            'dept', c.department,
            'roll_number', c.roll_number,
            'votes', v_max_votes
        ))::jsonb INTO v_winners_json
        FROM public.candidates c
        JOIN public.votes v ON v.candidate_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'active'
        GROUP BY c.id, c.candidate_name, c.department, c.roll_number
        HAVING COUNT(v.id) = v_max_votes;

        UPDATE public.elections
        SET status = 'Draw / Deadlock',
            joint_winners = FALSE,
            winners = v_winners_json,
            end_time = LEAST(end_time, NOW())
        WHERE id = p_election_id;

        RETURN 'Draw / Deadlock';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: DECLARE JOINT WINNERS
CREATE OR REPLACE FUNCTION public.declare_joint_winners(p_election_id UUID)
RETURNS boolean AS $$
DECLARE
    v_election_status TEXT;
    v_election_name TEXT;
BEGIN
    -- Assert caller is super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    SELECT election_name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_election_status <> 'Draw / Deadlock' THEN
        RAISE EXCEPTION 'Joint winners can only be declared for elections in Draw / Deadlock status.';
    END IF;

    UPDATE public.elections
    SET status = 'Completed',
        joint_winners = TRUE
    WHERE id = p_election_id;

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TIE_BREAK', 'super_admin', 'Declared Joint Winners override executed for election "' || v_election_name || '".');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: REOPEN ELECTION WITH RESET SEQUENCE
CREATE OR REPLACE FUNCTION public.reopen_election(p_election_id UUID, p_new_end_time TIMESTAMPTZ)
RETURNS boolean AS $$
DECLARE
    v_election_status TEXT;
    v_election_name TEXT;
BEGIN
    -- Assert caller is super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized administrative operation.';
    END IF;

    SELECT election_name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Election not found.';
    END IF;

    IF v_election_status <> 'Draw / Deadlock' THEN
        RAISE EXCEPTION 'Only elections in Draw / Deadlock status can be reopened.';
    END IF;

    IF p_new_end_time <= NOW() THEN
        RAISE EXCEPTION 'The new voting end time must be in the future.';
    END IF;

    -- Reset status and update end time
    UPDATE public.elections
    SET status = 'Active',
        joint_winners = FALSE,
        winners = NULL,
        end_time = p_new_end_time
    WHERE id = p_election_id;

    -- FLUSH/RESET DATA TO SEVER AND RE-OPEN VOTING WINDOW
    DELETE FROM public.votes WHERE election_id = p_election_id;
    DELETE FROM public.tokens WHERE election_id = p_election_id;
    DELETE FROM public.token_delivery_sessions WHERE election_id = p_election_id;
    UPDATE public.voter_participation 
    SET has_requested_token = FALSE, has_voted = FALSE 
    WHERE election_id = p_election_id;

    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('ELECTION_REOPENED', 'super_admin', 'Reopened election "' || v_election_name || '". Reset all vote counts, flushed tokens, and configured new window until ' || p_new_end_time || '.');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RECREATE ELECTION STATISTICS VIEW TO INCLUDE THE NEW DATA
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
    e.emergency_locked,
    e.joint_winners,
    e.winners
FROM public.elections e;

-- 9. ADD VOTE SELECT POLICY FOR FINALIZED ELECTIONS
DROP POLICY IF EXISTS "Anyone can read votes for finalized elections" ON public.votes;
CREATE POLICY "Anyone can read votes for finalized elections"
ON public.votes
FOR SELECT
TO authenticated, anon
USING (
    EXISTS (
        SELECT 1 FROM public.elections e
        WHERE e.id = votes.election_id
        AND e.status IN ('Completed', 'Emergency_Stopped', 'Draw / Deadlock')
    )
);

-- Grant select permission on the updated view
GRANT SELECT ON public.election_statistics TO authenticated, anon;
