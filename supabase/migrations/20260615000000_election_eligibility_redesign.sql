-- Migration 20260615000000: Election Eligibility System Redesign

-- 1. Alter elections table to add eligibility_rules jsonb column
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS eligibility_rules JSONB DEFAULT '[]'::jsonb;

-- 2. Create helper function to convert base36 to integer
CREATE OR REPLACE FUNCTION public.base36_to_int(p_str TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    v_val BIGINT := 0;
    v_char CHAR;
    v_idx INT;
BEGIN
    IF p_str IS NULL OR p_str = '' THEN
        RETURN -1;
    END IF;
    p_str := upper(p_str);
    FOR i IN 1..length(p_str) LOOP
        v_char := substring(p_str from i for 1);
        v_idx := position(v_char in v_chars) - 1;
        IF v_idx < 0 THEN
            RETURN -1; -- Invalid character
        END IF;
        v_val := v_val * 36 + v_idx;
    END LOOP;
    RETURN v_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Create eligibility validator function
CREATE OR REPLACE FUNCTION public.validate_voter_eligibility(
    p_roll_number TEXT,
    p_eligibility_rules JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_rule JSONB;
    v_prefix TEXT;
    v_var_length INT;
    v_mode TEXT;
    v_from TEXT;
    v_to TEXT;
    v_var_part TEXT;
    v_var_val BIGINT;
    v_from_val BIGINT;
    v_to_val BIGINT;
BEGIN
    IF p_eligibility_rules IS NULL OR jsonb_array_length(p_eligibility_rules) = 0 THEN
        RETURN FALSE;
    END IF;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(p_eligibility_rules) LOOP
        v_prefix := v_rule->>'prefix';
        v_var_length := (v_rule->>'variableLength')::INT;
        v_mode := v_rule->>'mode';
        v_from := v_rule->>'from';
        v_to := v_rule->>'to';

        -- Check prefix match and length constraint
        IF p_roll_number LIKE v_prefix || '%' AND length(p_roll_number) = length(v_prefix) + v_var_length THEN
            v_var_part := substring(p_roll_number from length(v_prefix) + 1);

            IF v_mode = 'numeric' THEN
                IF v_var_part ~ '^[0-9]+$' THEN
                    v_var_val := v_var_part::BIGINT;
                    v_from_val := v_from::BIGINT;
                    v_to_val := v_to::BIGINT;
                    IF v_var_val >= v_from_val AND v_var_val <= v_to_val THEN
                        RETURN TRUE;
                    END IF;
                END IF;
            ELSIF v_mode = 'alphanumeric' THEN
                v_var_val := public.base36_to_int(v_var_part);
                v_from_val := public.base36_to_int(v_from);
                v_to_val := public.base36_to_int(v_to);
                IF v_var_val <> -1 AND v_from_val <> -1 AND v_to_val <> -1 THEN
                    IF v_var_val >= v_from_val AND v_var_val <= v_to_val THEN
                        RETURN TRUE;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Recompile commit_token_request to implement dynamic checks
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

    -- Eligibility check (Redesigned)
    SELECT is_eligible INTO v_is_eligible
    FROM public.election_eligibility
    WHERE election_id = p_election_id AND roll_number = v_roll_number;

    IF FOUND THEN
        -- Explicit whitelist/blacklist record overrides dynamic patterns
        IF v_is_eligible = FALSE THEN
            RAISE EXCEPTION 'Voter is not eligible for this election (explicitly restricted).';
        END IF;
    ELSE
        -- If no explicit record, check dynamic pattern-based eligibility_rules
        DECLARE
            v_rules JSONB;
            v_dynamic_eligible BOOLEAN;
        BEGIN
            SELECT eligibility_rules INTO v_rules
            FROM public.elections
            WHERE id = p_election_id;

            IF v_rules IS NOT NULL AND jsonb_array_length(v_rules) > 0 THEN
                v_dynamic_eligible := public.validate_voter_eligibility(v_roll_number, v_rules);
                IF NOT v_dynamic_eligible THEN
                    RAISE EXCEPTION 'Voter is not eligible for this election based on configured roll number patterns.';
                END IF;
            ELSE
                -- No eligibility rules defined and no explicit whitelist record -> unauthorized
                RAISE EXCEPTION 'Voter is not whitelisted for this election.';
            END IF;
        END;
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
