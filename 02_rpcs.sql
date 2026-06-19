-- 02_rpcs.sql: State Machine RPCs

CREATE OR REPLACE FUNCTION public.request_voting_token(
    p_election_id UUID,
    p_voter_id VARCHAR,
    p_token_hash TEXT,
    p_expires_in_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_token_id UUID;
    v_current_step voting_step;
    v_delivery_status token_delivery_status;
BEGIN
    -- Ensure atomic operations
    
    -- 1. Get or create session
    SELECT id, current_step, delivery_status 
    INTO v_session_id, v_current_step, v_delivery_status
    FROM public.voting_sessions
    WHERE election_id = p_election_id AND voter_id = p_voter_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.voting_sessions (election_id, voter_id, current_step, delivery_status)
        VALUES (p_election_id, p_voter_id, 'TOKEN_DELIVERY', 'PENDING')
        RETURNING id INTO v_session_id;
    ELSE
        -- 2. State recovery logic
        -- If an active token is pending delivery, we can overwrite or fail, but let's allow retry if FAILED
        IF v_delivery_status = 'DELIVERED' AND v_current_step >= 'TOKEN_VERIFICATION' THEN
            RAISE EXCEPTION 'A valid token has already been delivered and is in process.';
        END IF;

        -- We update the session state for the new token
        UPDATE public.voting_sessions
        SET current_step = 'TOKEN_DELIVERY',
            delivery_status = 'PENDING',
            updated_at = now()
        WHERE id = v_session_id;
        
        -- Invalidate any existing active tokens for this session
        UPDATE public.voting_tokens
        SET state = 'EXPIRED', updated_at = now()
        WHERE session_id = v_session_id AND state = 'ACTIVE';
    END IF;

    -- 3. Insert new token
    INSERT INTO public.voting_tokens (session_id, token_hash, expires_at)
    VALUES (v_session_id, p_token_hash, now() + (p_expires_in_minutes || ' minutes')::interval)
    RETURNING id INTO v_token_id;

    -- 4. Audit Log
    INSERT INTO public.audit_logs (session_id, action, details)
    VALUES (v_session_id, 'TOKEN_REQUESTED', jsonb_build_object('token_id', v_token_id));

    RETURN jsonb_build_object('session_id', v_session_id, 'token_id', v_token_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_voting_token(
    p_session_id UUID,
    p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token_id UUID;
    v_token_state token_state;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Lock the token for update
    SELECT id, state, expires_at
    INTO v_token_id, v_token_state, v_expires_at
    FROM public.voting_tokens
    WHERE session_id = p_session_id AND token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid token.';
    END IF;

    IF v_token_state != 'ACTIVE' THEN
        RAISE EXCEPTION 'Token is not active (current state: %).', v_token_state;
    END IF;

    IF now() > v_expires_at THEN
        UPDATE public.voting_tokens SET state = 'EXPIRED', updated_at = now() WHERE id = v_token_id;
        RAISE EXCEPTION 'Token has expired.';
    END IF;

    -- Valid token, proceed with state transition
    UPDATE public.voting_tokens
    SET state = 'VERIFIED', updated_at = now()
    WHERE id = v_token_id;

    UPDATE public.voting_sessions
    SET current_step = 'CANDIDATE_SELECTION', updated_at = now()
    WHERE id = p_session_id;

    INSERT INTO public.audit_logs (session_id, action, details)
    VALUES (p_session_id, 'TOKEN_VERIFIED', jsonb_build_object('token_id', v_token_id));

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_secure_vote(
    p_session_id UUID,
    p_candidate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_step voting_step;
    v_token_id UUID;
BEGIN
    -- 1. Lock the session and verify it's ready for voting
    SELECT current_step
    INTO v_current_step
    FROM public.voting_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF v_current_step = 'COMPLETION' THEN
        RAISE EXCEPTION 'Double-voting prevented: Session already completed.';
    END IF;

    -- 2. Verify there is a VERIFIED token
    SELECT id
    INTO v_token_id
    FROM public.voting_tokens
    WHERE session_id = p_session_id AND state = 'VERIFIED'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No verified token found for this session.';
    END IF;

    -- 3. Transition token to USED
    UPDATE public.voting_tokens
    SET state = 'USED', updated_at = now()
    WHERE id = v_token_id;

    -- 4. Transition session to COMPLETION
    UPDATE public.voting_sessions
    SET current_step = 'COMPLETION', updated_at = now()
    WHERE id = p_session_id;

    -- 5. Audit Log (We do NOT log the candidate_id here to maintain voter anonymity)
    INSERT INTO public.audit_logs (session_id, action, details)
    VALUES (p_session_id, 'VOTE_SUBMITTED', jsonb_build_object('token_id', v_token_id));

    -- Note: Actual casting of the vote would happen here. For example:
    -- INSERT INTO public.votes_table (candidate_id) VALUES (p_candidate_id);

    RETURN jsonb_build_object('success', true);
END;
$$;
