-- Quick script to assign admin role to existing users
-- Run this in your Supabase SQL Editor after running the migration

-- Option 1: Assign admin role to a specific user by email
-- Replace 'your-email@example.com' with the actual email
SELECT public.assign_admin_role('your-email@example.com');

-- Option 2: Assign admin role to all existing users (use with caution)
-- This will make all current users admins
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);

-- Option 3: Check current user roles
SELECT * FROM public.user_roles_view;

-- Option 4: Check if a specific user has admin role
-- Replace 'your-email@example.com' with the actual email
SELECT 
  u.email,
  ur.role,
  public.has_role(u.id, 'admin') as is_admin
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'your-email@example.com';
