-- Migration 20260603000900: Public secure token request wrapper
CREATE OR REPLACE FUNCTION public.request_election_token(
    p_election_id UUID,
    p_token_hash TEXT
)
RETURNS boolean AS $$
BEGIN
    -- Check if session is verified
    IF NOT public.is_session_verified() THEN
        RAISE EXCEPTION 'Unauthorized session. Please complete OTP verification first.';
    END IF;

    -- Call private commit function
    RETURN private.commit_token_request(auth.uid(), p_election_id, p_token_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
