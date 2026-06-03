-- Phase 1 — VoteGuard Database Schema Design (Supabase)
-- Foundation setup matching exact schema specification

-- Enable pgcrypto for hashing and UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. VOTERS TABLE
CREATE TABLE public.voters (
    roll_number TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ELECTIONS TABLE
CREATE TABLE public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_name TEXT NOT NULL,
    election_code TEXT UNIQUE NOT NULL,
    election_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Paused', 'Completed', 'Emergency_Stopped')),
    access_code TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- V1 Constraint: Only one active election at a time
CREATE UNIQUE INDEX elections_active_idx
ON public.elections (status)
WHERE status = 'Active';

-- 3. CANDIDATES TABLE
CREATE TABLE public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    roll_number TEXT,
    department TEXT,
    manifesto TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ELECTION ELIGIBILITY TABLE
CREATE TABLE public.election_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    roll_number TEXT NOT NULL,
    is_eligible BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TOKEN REQUESTS TABLE
CREATE TABLE public.token_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    roll_number TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TOKEN DELIVERY SESSIONS TABLE
CREATE TABLE public.token_delivery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    roll_number TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TOKENS TABLE
CREATE TABLE public.tokens (
    token_hash TEXT PRIMARY KEY,
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'invalidated', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- 8. VOTES TABLE
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT REFERENCES public.tokens(token_hash) ON DELETE RESTRICT,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. RATE LIMITS TABLE
CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT UNIQUE,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ
);

-- ==========================================
-- ELECTION CLOSURE INTEGRITY TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.check_election_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_used_tokens INTEGER;
    v_votes_cast INTEGER;
BEGIN
    -- Assert integrity when election ends (status changes to Completed or Emergency_Stopped)
    IF NEW.status IN ('Completed', 'Emergency_Stopped') AND OLD.status NOT IN ('Completed', 'Emergency_Stopped') THEN
        -- Count tokens marked as 'used' for this election
        SELECT COUNT(*) INTO v_used_tokens
        FROM public.tokens
        WHERE election_id = NEW.id AND status = 'used';

        -- Count actual cast ballots (linked to this election via candidates table)
        SELECT COUNT(*) INTO v_votes_cast
        FROM public.votes v
        JOIN public.candidates c ON v.candidate_id = c.id
        WHERE c.election_id = NEW.id;

        -- Enforce integrity constraint
        IF v_used_tokens <> v_votes_cast THEN
            RAISE EXCEPTION 'Election Integrity Check Failed: Number of used tokens (%) does not match cast votes (%). Result publication aborted.', 
                v_used_tokens, v_votes_cast;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_election_integrity_on_completed
    BEFORE UPDATE ON public.elections
    FOR EACH ROW
    EXECUTE FUNCTION public.check_election_integrity();
