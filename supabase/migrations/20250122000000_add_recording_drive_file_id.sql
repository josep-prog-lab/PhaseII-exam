-- Add missing recording_drive_file_id column to candidate_sessions
-- This column stores the Google Drive file ID for uploaded recordings

-- Add the column if it doesn't exist
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_drive_file_id TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.candidate_sessions.recording_drive_file_id IS 'Google Drive file ID for uploaded exam recordings';

-- Verify the column was added
SELECT 'recording_drive_file_id column added successfully' as status;
