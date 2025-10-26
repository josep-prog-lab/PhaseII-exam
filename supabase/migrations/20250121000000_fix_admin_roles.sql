-- Fix Admin Role Assignment Issue
-- This migration addresses the 403 error when creating exams

-- 1. Update the handle_new_user function to automatically assign admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  
  -- Automatically assign admin role to new users
  -- This assumes all users signing up through the admin portal are admins
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 2. Add a policy to allow users to insert their own roles (for the trigger)
CREATE POLICY "Users can insert own roles" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Add a policy to allow users to view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Create a function to manually assign admin role (for existing users)
CREATE OR REPLACE FUNCTION public.assign_admin_role(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- 5. Create a function to check if current user is admin (helper function)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- 6. Add a more permissive policy for exam creation (temporary fix)
-- This allows any authenticated user to create exams, but you can restrict this later
CREATE POLICY "Authenticated users can create exams" ON public.exams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Update the exam management policy to be more specific
DROP POLICY IF EXISTS "Admins can manage exams" ON public.exams;
CREATE POLICY "Admins can manage exams" ON public.exams
  FOR ALL USING (public.is_current_user_admin());

-- 8. Add a policy for authenticated users to view their own created exams
CREATE POLICY "Users can view own created exams" ON public.exams
  FOR SELECT USING (auth.uid() = created_by);

-- 9. Add a policy for authenticated users to update their own created exams
CREATE POLICY "Users can update own created exams" ON public.exams
  FOR UPDATE USING (auth.uid() = created_by);

-- 10. Add a policy for authenticated users to delete their own created exams
CREATE POLICY "Users can delete own created exams" ON public.exams
  FOR DELETE USING (auth.uid() = created_by);

-- 11. Update section policies to allow authenticated users to manage sections
DROP POLICY IF EXISTS "Admins can manage sections" ON public.exam_sections;
CREATE POLICY "Admins can manage sections" ON public.exam_sections
  FOR ALL USING (public.is_current_user_admin());

-- 12. Add policy for authenticated users to manage sections of their own exams
CREATE POLICY "Users can manage sections of own exams" ON public.exam_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.exams 
      WHERE id = exam_id AND created_by = auth.uid()
    )
  );

-- 13. Update question policies similarly
DROP POLICY IF EXISTS "Admins can manage questions" ON public.exam_questions;
CREATE POLICY "Admins can manage questions" ON public.exam_questions
  FOR ALL USING (public.is_current_user_admin());

-- 14. Add policy for authenticated users to manage questions of their own exams
CREATE POLICY "Users can manage questions of own exams" ON public.exam_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.exam_sections es
      JOIN public.exams e ON es.exam_id = e.id
      WHERE es.id = section_id AND e.created_by = auth.uid()
    )
  );

-- 15. Create a view to easily see user roles (for debugging)
CREATE OR REPLACE VIEW public.user_roles_view AS
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  ur.role,
  ur.created_at as role_assigned_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.user_roles_view TO authenticated;

-- 16. Add helpful comments
COMMENT ON FUNCTION public.assign_admin_role(TEXT) IS 'Manually assign admin role to a user by email';
COMMENT ON FUNCTION public.is_current_user_admin() IS 'Check if the current authenticated user has admin role';
COMMENT ON VIEW public.user_roles_view IS 'View to see all users and their roles for debugging';
