-- Migration 20260603000800: Add description column to elections table
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS description TEXT;
