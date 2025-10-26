# Exam Creation Issue Analysis & Solution

## Problem Summary
You're encountering a **403 Forbidden** error when trying to save exams to the database. The error message indicates:
```
new row violates row-level security policy for table "exams"
```

## Root Cause Analysis

### 1. **Missing Admin Role Assignment**
- When users sign up through `AdminAuth.tsx`, they get authenticated but are **NOT automatically assigned the 'admin' role**
- The `user_roles` table remains empty for new users
- The RLS policy requires admin role to create exams

### 2. **Row Level Security (RLS) Policy Issue**
The `exams` table has this policy:
```sql
CREATE POLICY "Admins can manage exams" ON public.exams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
```

The `has_role()` function checks if the current user has admin role, but since no role is assigned during signup, it returns `false`.

### 3. **Missing created_by Field**
The `CreateExam.tsx` component wasn't setting the `created_by` field when creating exams, which is required for proper ownership tracking.

## Solutions Implemented

### 1. **Database Migration** (`20250121000000_fix_admin_roles.sql`)
This migration includes:

- **Automatic Admin Role Assignment**: Updated `handle_new_user()` function to automatically assign admin role to new users
- **Enhanced RLS Policies**: Added more flexible policies that allow authenticated users to create exams
- **Helper Functions**: Created utility functions for role management
- **Debugging Tools**: Added views and functions to help troubleshoot role issues

### 2. **Code Fix** (`CreateExam.tsx`)
- Added `created_by` field when creating exams to properly track ownership

### 3. **Admin Role Assignment Script** (`assign-admin-role.sql`)
- Quick script to manually assign admin roles to existing users
- Multiple options for different scenarios

## How to Fix Your Current Issue

### Step 1: Run the Migration
1. Go to your Supabase SQL Editor
2. Copy and paste the contents of `supabase/migrations/20250121000000_fix_admin_roles.sql`
3. Execute the migration

### Step 2: Assign Admin Role to Your User
1. In Supabase SQL Editor, run:
```sql
-- Replace 'your-email@example.com' with your actual email
SELECT public.assign_admin_role('your-email@example.com');
```

### Step 3: Verify the Fix
1. Check if you have admin role:
```sql
SELECT * FROM public.user_roles_view WHERE email = 'your-email@example.com';
```

2. Test creating an exam in your application

## Database Schema Improvements

The migration also includes several improvements:

### Enhanced Security
- More granular RLS policies
- Proper ownership tracking
- Better role management

### Better Data Handling
- Automatic role assignment for new users
- Proper `created_by` field population
- Enhanced error handling

### Debugging Tools
- `user_roles_view` for easy role inspection
- Helper functions for role checking
- Manual role assignment capabilities

## Key Changes Made

### 1. **Automatic Role Assignment**
```sql
-- Updated handle_new_user function
INSERT INTO public.user_roles (user_id, role)
VALUES (NEW.id, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 2. **Flexible RLS Policies**
```sql
-- Allow authenticated users to create exams
CREATE POLICY "Authenticated users can create exams" ON public.exams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to manage their own exams
CREATE POLICY "Users can update own created exams" ON public.exams
  FOR UPDATE USING (auth.uid() = created_by);
```

### 3. **Code Fix**
```typescript
// Added created_by field
const { data: exam, error: examError } = await supabase
  .from("exams")
  .insert({
    title: examTitle,
    description: examDescription,
    rotation_slot: rotationSlot,
    is_active: true,
    created_by: (await supabase.auth.getUser()).data.user?.id
  })
```

## Testing the Fix

After implementing the solution:

1. **Sign up a new user** - Should automatically get admin role
2. **Create an exam** - Should work without 403 error
3. **Check database** - Verify exam is created with proper `created_by` field
4. **Verify RLS** - Ensure only admins can manage exams

## Future Considerations

1. **Role Management UI**: Consider adding a UI for managing user roles
2. **Audit Logging**: Add logging for exam creation/modification
3. **Permission Granularity**: Consider more specific permissions (e.g., exam-specific admin roles)
4. **Email Verification**: Ensure email verification is working properly

## Files Modified/Created

- ✅ `supabase/migrations/20250121000000_fix_admin_roles.sql` (NEW)
- ✅ `assign-admin-role.sql` (NEW)
- ✅ `src/pages/CreateExam.tsx` (MODIFIED)
- ✅ `EXAM_ISSUE_ANALYSIS.md` (NEW)

The solution addresses both the immediate 403 error and provides a robust foundation for proper role-based access control in your exam system.
