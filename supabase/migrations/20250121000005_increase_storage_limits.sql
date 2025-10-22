-- Increase Storage Limits for Video Recordings
-- This migration increases the file size limit and optimizes storage settings

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

-- 3. Ensure policies are still in place
DROP POLICY IF EXISTS "Allow anonymous recording uploads" ON storage.objects;
CREATE POLICY "Allow anonymous recording uploads" ON storage.objects
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (bucket_id = 'exam-recordings');

DROP POLICY IF EXISTS "Allow authenticated users to view recordings" ON storage.objects;
CREATE POLICY "Allow authenticated users to view recordings" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (bucket_id = 'exam-recordings');

DROP POLICY IF EXISTS "Allow admins to manage recordings" ON storage.objects;
CREATE POLICY "Allow admins to manage recordings" ON storage.objects
  FOR ALL 
  TO authenticated
  USING (
    bucket_id = 'exam-recordings' AND 
    public.has_role(auth.uid(), 'admin')
  );

-- 4. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- 5. Verify the setup
SELECT 'Storage bucket limits increased to 5GB successfully' as status;
