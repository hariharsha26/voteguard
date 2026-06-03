-- Migration 20260603000600: Candidate Enhancements
-- 1. ADD COMPOSITE UNIQUE CONSTRAINT
ALTER TABLE public.candidates 
ADD CONSTRAINT candidates_election_roll_unique UNIQUE (election_id, roll_number);

-- 2. ADD STATUS COLUMN FOR SOFT DELETE SUPPORT
ALTER TABLE public.candidates 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
