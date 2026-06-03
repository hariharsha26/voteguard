-- Migration 20260603001000: Allow 'Archived' status in elections table
ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_status_check;
ALTER TABLE public.elections ADD CONSTRAINT elections_status_check CHECK (status IN ('Draft', 'Active', 'Paused', 'Completed', 'Emergency_Stopped', 'Archived'));
