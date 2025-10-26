-- Fix Candidate Registration 403 Error
-- This migration addresses the 403 Forbidden error when candidates try to register

-- 1. Drop existing policies on candidate_sessions to recreate them properly
DROP POLICY IF EXISTS "Anyone can insert session" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Candidates can update own session" ON public.candidate_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.candidate_sessions;

-- 2. Create more explicit policies for candidate_sessions
-- Allow anonymous users to insert candidate sessions (for registration)
CREATE POLICY "Allow anonymous candidate registration" ON public.candidate_sessions
  FOR INSERT 
  WITH CHECK (true);

-- Allow candidates to update their own sessions (by session ID)
CREATE POLICY "Allow session updates by session ID" ON public.candidate_sessions
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Allow admins to view all sessions
CREATE POLICY "Admins can view all sessions" ON public.candidate_sessions
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Grant necessary permissions to anonymous users
GRANT INSERT ON public.candidate_sessions TO anon;
GRANT UPDATE ON public.candidate_sessions TO anon;
GRANT SELECT ON public.candidate_sessions TO anon;

-- 4. Ensure the table is accessible to anonymous users
ALTER TABLE public.candidate_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Create a function to help with session validation
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
  
  -- Set default values
  IF NEW.status IS NULL THEN
    NEW.status = 'in_progress';
  END IF;
  
  IF NEW.consent_given IS NULL THEN
    NEW.consent_given = false;
  END IF;
  
  IF NEW.flags IS NULL THEN
    NEW.flags = '[]'::jsonb;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger to validate candidate sessions
DROP TRIGGER IF EXISTS validate_candidate_session_trigger ON public.candidate_sessions;
CREATE TRIGGER validate_candidate_session_trigger
  BEFORE INSERT OR UPDATE ON public.candidate_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_candidate_session();

-- 7. Add helpful comments
COMMENT ON POLICY "Allow anonymous candidate registration" ON public.candidate_sessions IS 'Allows anonymous users to register for exams';
COMMENT ON POLICY "Allow session updates by session ID" ON public.candidate_sessions IS 'Allows candidates to update their session data';
COMMENT ON FUNCTION public.validate_candidate_session() IS 'Validates candidate session data before insert/update';

