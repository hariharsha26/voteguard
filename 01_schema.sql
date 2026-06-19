-- 01_schema.sql: Database-Synced State Machine Schema

-- ENUMs
CREATE TYPE voting_step AS ENUM (
    'ELECTION_DETAILS',
    'VOTER_AUTHENTICATION',
    'TOKEN_REQUEST',
    'TOKEN_DELIVERY',
    'TOKEN_VERIFICATION',
    'CANDIDATE_SELECTION',
    'VOTE_REVIEW',
    'VOTE_SUBMISSION',
    'COMPLETION'
);

CREATE TYPE token_delivery_status AS ENUM (
    'PENDING',
    'DELIVERED',
    'FAILED'
);

CREATE TYPE token_state AS ENUM (
    'ACTIVE',
    'VERIFIED',
    'USED',
    'EXPIRED'
);

-- Tables
CREATE TABLE public.voting_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL,
    voter_id VARCHAR(255) NOT NULL,
    current_step voting_step NOT NULL DEFAULT 'ELECTION_DETAILS',
    delivery_status token_delivery_status,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(election_id, voter_id)
);

CREATE TABLE public.voting_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.voting_sessions(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    state token_state NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.voting_sessions(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_voting_sessions_voter_election ON public.voting_sessions(voter_id, election_id);
CREATE INDEX idx_voting_tokens_session_id ON public.voting_tokens(session_id);
CREATE INDEX idx_audit_logs_session_id ON public.audit_logs(session_id);

-- RLS (Row Level Security) Setup
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
