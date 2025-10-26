# Candidate Registration 403 Error - Fix Guide

## Problem Description
Candidates were getting a 403 Forbidden error when trying to register for exams. The error occurred when the application tried to insert a new record into the `candidate_sessions` table.

## Root Cause
The issue was caused by Row Level Security (RLS) policies that weren't properly configured to allow anonymous users (candidates) to insert records into the `candidate_sessions` table.

## Solution Applied

### 1. Updated Supabase Client Configuration
- Modified `/src/integrations/supabase/client.ts` to include better configuration for anonymous access
- Added `detectSessionInUrl: true` and explicit schema configuration

### 2. Created New Database Migration
- Created `/supabase/migrations/20250121000001_fix_candidate_registration.sql`
- This migration:
  - Drops and recreates RLS policies for `candidate_sessions`
  - Grants proper permissions to anonymous users
  - Adds validation triggers for data integrity
  - Ensures candidates can register without authentication

### 3. Enhanced Error Handling
- Updated `/src/pages/CandidateRegister.tsx` to provide better error messages
- Added console logging for debugging registration issues

## Steps to Apply the Fix

### 1. Run the Database Migration
Execute the new migration in your Supabase SQL Editor:
```sql
-- The migration file: supabase/migrations/20250121000001_fix_candidate_registration.sql
```

### 2. Verify Environment Variables
Make sure you have the correct Supabase credentials in your environment:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

### 3. Test Candidate Registration
1. Navigate to the candidate registration page
2. Fill out the registration form
3. Submit the form
4. Verify that registration succeeds without 403 errors

## Key Changes Made

### Database Policies
- **Before**: Policies were too restrictive for anonymous users
- **After**: Explicit policies allowing anonymous candidate registration

### Supabase Client
- **Before**: Basic configuration without explicit schema settings
- **After**: Enhanced configuration with better anonymous access support

### Error Handling
- **Before**: Generic error messages
- **After**: Detailed error messages with console logging for debugging

## Verification Steps

### 1. Check Database Policies
Run this query to verify the policies are correctly set:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'candidate_sessions';
```

### 2. Test Anonymous Access
Verify that anonymous users can insert into candidate_sessions:
```sql
-- This should work without authentication
INSERT INTO public.candidate_sessions (
  exam_id, full_name, email, contact, exam_location, consent_given
) VALUES (
  'some-exam-id', 'Test User', 'test@example.com', '1234567890', 'home', true
);
```

### 3. Check Permissions
Verify that the `anon` role has the necessary permissions:
```sql
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'candidate_sessions' AND grantee = 'anon';
```

## Troubleshooting

### If Registration Still Fails

1. **Check Supabase Dashboard**:
   - Go to Authentication > Settings
   - Ensure "Enable email confirmations" is set appropriately
   - Check if there are any rate limiting issues

2. **Verify RLS is Working**:
   ```sql
   -- Check if RLS is enabled
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'candidate_sessions';
   ```

3. **Test with Different Browser**:
   - Clear browser cache and cookies
   - Try in incognito/private mode
   - Check browser console for additional errors

4. **Check Network Tab**:
   - Open browser developer tools
   - Go to Network tab
   - Try registration and check the actual HTTP response

### Common Issues and Solutions

1. **403 Forbidden**: Usually RLS policy issues - run the migration
2. **Network Errors**: Check Supabase URL and API key
3. **Validation Errors**: Check that all required fields are filled
4. **CORS Issues**: Ensure Supabase project allows your domain

## Additional Notes

- The fix maintains security by keeping RLS enabled but with proper policies
- Anonymous users can only insert and update their own sessions
- Admin users retain full access to all candidate sessions
- The solution is production-ready and follows Supabase best practices

## Support

If you continue to experience issues after applying this fix:
1. Check the browser console for detailed error messages
2. Verify your Supabase project settings
3. Ensure all migrations have been applied successfully
4. Test with a fresh browser session

