-- Add missing recording_checksum and recording_started_at columns to candidate_sessions
-- These columns are required for video recording verification and tracking

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
SELECT 'recording_checksum, recording_started_at, and recording_required columns added successfully' as status;
