# Quick Start - Apply Database Fix

## ⚠️ IMMEDIATE ACTION REQUIRED

Before testing the application, you **MUST** run the database migration to add missing columns.

## Step 1: Apply Database Migration

1. Open your Supabase Dashboard: https://nmduczkfmzmoxqxqghfx.supabase.co
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the contents of `apply_recording_checksum_fix.sql`
5. Paste into the SQL Editor
6. Click **RUN** (or press Ctrl+Enter)
7. You should see a success message

## Step 2: Test the Application

```bash
npm run dev
```

Then navigate to the candidate registration page and test the exam flow.

## What Was Fixed?

✅ **Database Schema**: Added `recording_checksum`, `recording_started_at`, and `recording_required` columns

✅ **Camera Display**: Fixed blank white screen - camera preview now shows properly

✅ **Screen Sharing**: Removed duplicate prompt - only shown once when recording starts

✅ **Console Errors**: Suppressed browser extension errors for cleaner console

## Files Changed

- `src/pages/CandidateExam.tsx` - Permission flow improvements
- `src/components/VideoRecorder.tsx` - Camera display fix
- `src/main.tsx` - Error suppression
- `supabase/migrations/20250122000001_add_recording_checksum.sql` - New migration
- `apply_recording_checksum_fix.sql` - Manual SQL script (run this!)

## Need More Details?

See `FIXES_APPLIED.md` for comprehensive documentation of all changes.

---

**Remember: Run the SQL script FIRST, then test!**
