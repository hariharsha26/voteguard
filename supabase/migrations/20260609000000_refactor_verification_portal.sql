-- Migration 20260609000000: Refactor Verification Portal API Contract
-- Simplifies verify_portal_token RPC to return only election_name and status,
-- mapping token state to exactly four statuses: Vote Pending, Election Still In Progress, Vote Counted, and Invalid Token.

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
        
        RETURN jsonb_build_object(
            'election_name', NULL,
            'status', 'Invalid Token'
        );
    END IF;

    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    SELECT election_name, status, current_round 
    INTO v_election_name, v_election_status, v_current_round
    FROM public.elections
    WHERE id = v_token.election_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'election_name', NULL,
            'status', 'Invalid Token'
        );
    END IF;

    -- Apply the simplified status logic
    IF v_token.status = 'unused' THEN
        v_status_text := 'Vote Pending';
    ELSIF v_token.status = 'used' THEN
        IF v_election_status IN ('ACTIVE', 'PAUSED') THEN
            v_status_text := 'Election Still In Progress';
        ELSIF v_election_status IN ('COMPLETED', 'STOPPED', 'DEADLOCK') THEN
            v_status_text := 'Vote Counted';
        ELSE
            v_status_text := 'Invalid Token';
        END IF;
    ELSE
        v_status_text := 'Invalid Token';
    END IF;

    -- Return JSONB payload with ONLY status and election_name
    RETURN jsonb_build_object(
        'status', v_status_text,
        'election_name', v_election_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
