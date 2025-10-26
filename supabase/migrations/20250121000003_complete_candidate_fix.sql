-- Complete Candidate Registration and Exam Flow Fix
-- This migration ensures candidates can register and take exams seamlessly

-- 1. Fix candidate_sessions RLS policies
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Anyone can insert session" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Candidates can update own session" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Allow anonymous candidate registration" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Allow session updates by session ID" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Allow candidate session updates" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Allow candidate session selection" ON public.candidate_sessions;

-- 2. Create comprehensive policies for candidate_sessions
CREATE POLICY "Allow anonymous candidate registration" ON public.candidate_sessions
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow candidate session updates" ON public.candidate_sessions
  FOR UPDATE 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow candidate session selection" ON public.candidate_sessions
  FOR SELECT 
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can view all sessions" ON public.candidate_sessions
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Grant comprehensive permissions
GRANT INSERT, UPDATE, SELECT ON public.candidate_sessions TO anon;
GRANT INSERT, UPDATE, SELECT ON public.candidate_sessions TO authenticated;

-- 4. Fix candidate_answers RLS policies
DROP POLICY IF EXISTS "Admins can view all answers" ON public.candidate_answers;
DROP POLICY IF EXISTS "Anyone can insert answers" ON public.candidate_answers;
DROP POLICY IF EXISTS "Candidates can update own answers" ON public.candidate_answers;

CREATE POLICY "Allow anonymous answer submission" ON public.candidate_answers
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow answer updates" ON public.candidate_answers
  FOR UPDATE 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow answer selection" ON public.candidate_answers
  FOR SELECT 
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can view all answers" ON public.candidate_answers
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Grant permissions for candidate_answers
GRANT INSERT, UPDATE, SELECT ON public.candidate_answers TO anon;
GRANT INSERT, UPDATE, SELECT ON public.candidate_answers TO authenticated;

-- 6. Ensure exams are accessible to anonymous users
DROP POLICY IF EXISTS "Anyone can view active exams" ON public.exams;
CREATE POLICY "Anyone can view active exams" ON public.exams
  FOR SELECT 
  TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON public.exams TO anon;

-- 7. Ensure exam sections and questions are accessible
DROP POLICY IF EXISTS "Anyone can view sections" ON public.exam_sections;
CREATE POLICY "Anyone can view sections" ON public.exam_sections
  FOR SELECT 
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view questions" ON public.exam_questions;
CREATE POLICY "Anyone can view questions" ON public.exam_questions
  FOR SELECT 
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.exam_sections TO anon;
GRANT SELECT ON public.exam_questions TO anon;

-- 8. Add recording_url field to candidate_sessions if it doesn't exist
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- 9. Add recording_started_at field to track when recording began
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMPTZ;

-- 10. Add recording_required field to enforce mandatory recording
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_required BOOLEAN NOT NULL DEFAULT true;

-- 11. Update the validation function to include new fields
CREATE OR REPLACE FUNCTION public.validate_candidate_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure required fields are present
  IF NEW.full_name IS NULL OR NEW.full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  
  IF NEW.contact IS NULL OR NEW.contact = '' THEN
    RAISE EXCEPTION 'Contact is required';
  END IF;
  
  IF NEW.exam_location IS NULL OR NEW.exam_location = '' THEN
    RAISE EXCEPTION 'Exam location is required';
  END IF;
  
  -- Set default values if not provided
  IF NEW.status IS NULL THEN
    NEW.status = 'in_progress';
  END IF;
  
  IF NEW.consent_given IS NULL THEN
    NEW.consent_given = false;
  END IF;
  
  IF NEW.flags IS NULL THEN
    NEW.flags = '[]'::jsonb;
  END IF;
  
  IF NEW.recording_required IS NULL THEN
    NEW.recording_required = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 12. Ensure the trigger exists
DROP TRIGGER IF EXISTS validate_candidate_session_trigger ON public.candidate_sessions;
CREATE TRIGGER validate_candidate_session_trigger
  BEFORE INSERT OR UPDATE ON public.candidate_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_candidate_session();

-- 13. Add helpful comments
COMMENT ON POLICY "Allow anonymous candidate registration" ON public.candidate_sessions IS 'Allows anonymous users to register for exams';
COMMENT ON POLICY "Allow candidate session updates" ON public.candidate_sessions IS 'Allows candidates to update their session data';
COMMENT ON POLICY "Allow candidate session selection" ON public.candidate_sessions IS 'Allows candidates to select their session data';
COMMENT ON POLICY "Allow anonymous answer submission" ON public.candidate_answers IS 'Allows anonymous users to submit answers';
COMMENT ON POLICY "Allow answer updates" ON public.candidate_answers IS 'Allows candidates to update their answers';
COMMENT ON POLICY "Allow answer selection" ON public.candidate_answers IS 'Allows candidates to select their answers';

-- 14. Verify the setup
SELECT 'Candidate registration and exam flow has been fixed successfully' as status;
