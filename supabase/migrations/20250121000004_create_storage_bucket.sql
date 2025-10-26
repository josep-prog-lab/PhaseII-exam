-- Create Storage Bucket for Video Recordings
-- This migration creates a storage bucket and policies for exam recordings

-- 1. Create storage bucket for exam recordings (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-recordings',
  'exam-recordings', 
  false,
  104857600, -- 100MB limit
  ARRAY['video/webm', 'video/mp4', 'video/avi', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create policy to allow anonymous users to upload recordings
DROP POLICY IF EXISTS "Allow anonymous recording uploads" ON storage.objects;
CREATE POLICY "Allow anonymous recording uploads" ON storage.objects
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (bucket_id = 'exam-recordings');

-- 3. Create policy to allow authenticated users to view recordings
DROP POLICY IF EXISTS "Allow authenticated users to view recordings" ON storage.objects;
CREATE POLICY "Allow authenticated users to view recordings" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (bucket_id = 'exam-recordings');

-- 4. Create policy to allow admins to manage recordings
DROP POLICY IF EXISTS "Allow admins to manage recordings" ON storage.objects;
CREATE POLICY "Allow admins to manage recordings" ON storage.objects
  FOR ALL 
  TO authenticated
  USING (
    bucket_id = 'exam-recordings' AND 
    public.has_role(auth.uid(), 'admin')
  );

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- 6. Add helpful comments (using regular comments instead of COMMENT ON statements)
-- Storage bucket 'exam-recordings' is for exam recording videos
-- Policy "Allow anonymous recording uploads" allows candidates to upload their exam recordings
-- Policy "Allow authenticated users to view recordings" allows authenticated users to view recordings  
-- Policy "Allow admins to manage recordings" allows admins to manage all recordings

-- 7. Verify the setup
SELECT 'Storage bucket and policies created successfully' as status;
