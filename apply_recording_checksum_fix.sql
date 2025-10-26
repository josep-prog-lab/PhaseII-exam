-- ============================================
-- MANUAL DATABASE FIX: Add missing columns
-- ============================================
-- 
-- Run this in your Supabase SQL Editor to fix the database schema
-- This fixes the "recording_checksum column not found" error
--
-- Instructions:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to the SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- ============================================

-- Add recording_checksum column for verifying recording integrity
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_checksum TEXT;

-- Add recording_started_at to track when recording began
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMPTZ;

-- Add recording_required to track if recording is mandatory
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_required BOOLEAN NOT NULL DEFAULT true;

-- Add comments to document the columns
COMMENT ON COLUMN public.candidate_sessions.recording_checksum IS 'SHA-256 checksum of the uploaded recording for integrity verification';
COMMENT ON COLUMN public.candidate_sessions.recording_started_at IS 'Timestamp when the recording was started';
COMMENT ON COLUMN public.candidate_sessions.recording_required IS 'Whether recording is mandatory for this exam session';

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'candidate_sessions' 
  AND column_name IN ('recording_checksum', 'recording_started_at', 'recording_required')
ORDER BY column_name;

-- Success message
SELECT 'Database schema updated successfully! recording_checksum, recording_started_at, and recording_required columns have been added.' as status;
