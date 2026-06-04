-- Migration 20260604000400: Change verify_portal_token to return JSONB for dynamic election name in verification portal

DROP FUNCTION IF EXISTS public.verify_portal_token(text);

CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS jsonb AS $$
DECLARE
    v_token_hash TEXT;
    v_token RECORD;
    v_client_ip TEXT;
    v_cooldown TIMESTAMPTZ;
    v_election_status TEXT;
    v_election_name TEXT;
    v_status_text TEXT;
BEGIN
    -- Extract IP for rate limiting
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

    -- Hash token
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Fetch token
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

    -- Reset cooldown on successful token find
    INSERT INTO public.token_attempts (ip_address, failed_attempts, cooldown_until)
    VALUES (v_client_ip, 0, '-infinity'::TIMESTAMPTZ)
    ON CONFLICT (ip_address)
    DO UPDATE SET failed_attempts = 0, cooldown_until = '-infinity'::TIMESTAMPTZ;

    -- Fetch election info
    SELECT election_name, status INTO v_election_name, v_election_status
    FROM public.elections
    WHERE id = v_token.election_id;

    -- Audit logs (Standardized)
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('TOKEN_VERIFIED', 'anonymous', 'Token status queried via public portal.');

    -- Calculate Status Text
    IF v_token.status = 'unused' THEN
        IF v_election_status = 'Active' THEN
            v_status_text := 'Election Still In Progress';
        ELSE
            v_status_text := 'Pending Counting';
        END IF;
    ELSIF v_token.status = 'used' THEN
        IF v_election_status IN ('Completed', 'Emergency_Stopped') THEN
            v_status_text := '✓ Vote Counted';
        ELSIF v_election_status = 'Active' THEN
            v_status_text := '✓ Vote Recorded';
        ELSE
            v_status_text := 'Pending Counting';
        END IF;
    ELSIF v_token.status = 'invalidated' THEN
        v_status_text := '✗ Token Invalidated';
    ELSE
        v_status_text := '✗ Token Expired';
    END IF;

    -- Return JSONB payload with status and election name (no candidate information leaks)
    RETURN jsonb_build_object(
        'status', v_status_text,
        'election_name', v_election_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
