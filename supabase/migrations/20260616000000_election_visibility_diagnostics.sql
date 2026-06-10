-- Migration 20260616000000: Election Visibility Diagnostics RPC

CREATE OR REPLACE FUNCTION public.get_election_visibility_report()
RETURNS TABLE (
    election_id UUID,
    election_name TEXT,
    status TEXT,
    eligible_voters_count BIGINT,
    visible_under_rls BOOLEAN,
    visible_to_current_voter BOOLEAN,
    visibility_reason TEXT
) AS $$
DECLARE
    v_voter_id UUID;
    v_roll_number TEXT;
    v_session_verified BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_election_visibility_report()
RETURNS TABLE (
    election_id UUID,
    election_name TEXT,
    status TEXT,
    eligible_voters_count BIGINT,
    visible_under_rls BOOLEAN,
    visible_to_current_voter BOOLEAN,
    visibility_reason TEXT
) AS $$
DECLARE
    v_voter_id UUID;
    v_roll_number TEXT;
    v_session_verified BOOLEAN;
BEGIN
    -- Get current auth user ID
    v_voter_id := auth.uid();
    
    -- Get voter roll number
    SELECT roll_number INTO v_roll_number
    FROM public.voters
    WHERE auth_user_id = v_voter_id;

    -- Check if active session is verified
    v_session_verified := public.is_session_verified();

    RETURN QUERY
    SELECT 
        e.id AS election_id,
        e.election_name,
        e.status,
        -- Count eligible voters count (dynamic + explicit)
        (
            SELECT COUNT(*)::BIGINT
            FROM public.voters v
            WHERE 
                -- Explicitly whitelisted
                EXISTS (
                    SELECT 1 FROM public.election_eligibility ee 
                    WHERE ee.election_id = e.id AND ee.roll_number = v.roll_number AND ee.is_eligible = TRUE
                )
                OR (
                    -- Not explicitly blacklisted
                    NOT EXISTS (
                        SELECT 1 FROM public.election_eligibility ee 
                        WHERE ee.election_id = e.id AND ee.roll_number = v.roll_number AND ee.is_eligible = FALSE
                    )
                    -- Matches dynamic rules
                    AND e.eligibility_rules IS NOT NULL 
                    AND jsonb_array_length(e.eligibility_rules) > 0
                    AND public.validate_voter_eligibility(v.roll_number, e.eligibility_rules) = TRUE
                )
        ) AS eligible_voters_count,
        
        -- Visible under RLS? (Must have verified session and status <> 'DRAFT')
        (v_session_verified = TRUE AND e.status <> 'DRAFT') AS visible_under_rls,
        
        -- Visible to current voter? (Visible under RLS AND eligible)
        (
            v_session_verified = TRUE 
            AND e.status <> 'DRAFT'
            AND (
                -- Explicitly whitelisted
                EXISTS (
                    SELECT 1 FROM public.election_eligibility ee 
                    WHERE ee.election_id = e.id AND ee.roll_number = v_roll_number AND ee.is_eligible = TRUE
                )
                OR (
                    -- Not explicitly blacklisted
                    NOT EXISTS (
                        SELECT 1 FROM public.election_eligibility ee 
                        WHERE ee.election_id = e.id AND ee.roll_number = v_roll_number AND ee.is_eligible = FALSE
                    )
                    -- Matches dynamic rules
                    AND e.eligibility_rules IS NOT NULL 
                    AND jsonb_array_length(e.eligibility_rules) > 0
                    AND public.validate_voter_eligibility(v_roll_number, e.eligibility_rules) = TRUE
                )
            )
        ) AS visible_to_current_voter,

        -- Visibility reason
        CASE
            WHEN v_session_verified = FALSE THEN 'RLS blocked: active session not verified'
            WHEN e.status = 'DRAFT' THEN 'RLS blocked: election status is DRAFT'
            WHEN EXISTS (
                SELECT 1 FROM public.election_eligibility ee 
                WHERE ee.election_id = e.id AND ee.roll_number = v_roll_number AND ee.is_eligible = FALSE
            ) THEN 'Not eligible: Explicitly blacklisted'
            WHEN EXISTS (
                SELECT 1 FROM public.election_eligibility ee 
                WHERE ee.election_id = e.id AND ee.roll_number = v_roll_number AND ee.is_eligible = TRUE
            ) THEN 'Eligible: Explicitly whitelisted'
            WHEN e.eligibility_rules IS NULL OR jsonb_array_length(e.eligibility_rules) = 0 THEN 'Not eligible: No rules configured and not explicitly whitelisted'
            WHEN public.validate_voter_eligibility(v_roll_number, e.eligibility_rules) = TRUE THEN 'Eligible: Matches roll number prefix/range pattern'
            ELSE 'Not eligible: Pattern mismatch (Prefix / variable length / range constraint)'
        END AS visibility_reason
    FROM public.elections e
    ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
