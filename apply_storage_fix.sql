-- Apply Storage Fix for Video Recordings
-- Run this script to fix the storage size limits

-- 1. Update storage bucket with increased limits
UPDATE storage.buckets 
SET 
  file_size_limit = 5368709120, -- 5GB limit (increased from 100MB)
  allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo']
WHERE id = 'exam-recordings';

-- 2. If bucket doesn't exist, create it with proper limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-recordings',
  'exam-recordings', 
  false,
  5368709120, -- 5GB limit
  ARRAY['video/webm', 'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Verify the update
SELECT 
  id, 
  name, 
  file_size_limit, 
  file_size_limit / (1024 * 1024 * 1024) as size_limit_gb,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'exam-recordings';
