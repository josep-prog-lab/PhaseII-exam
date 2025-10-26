# Video Upload Fix - Complete Setup Guide

## Issues Identified

1. **❌ Supabase Connection Failure**: `net::ERR_NAME_NOT_RESOLVED`
2. **❌ Storage Size Limit**: Videos are 127MB but Supabase bucket limit is still 100MB  
3. **❌ Wrong Upload Path**: System tries Supabase storage instead of Google Drive
4. **❌ Missing Environment Variables**: No `.env` file with Supabase credentials
5. **❌ Edge Function Not Deployed**: Google Drive upload function not accessible

## Step-by-Step Fix

### 1. Create Environment File

Create a `.env` file in the project root with your Supabase credentials:

```bash
# Create .env file
cat > .env << 'EOF'
# Supabase Configuration - REPLACE WITH YOUR ACTUAL VALUES
VITE_SUPABASE_URL=https://tifytikdzembawmgggij.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
VITE_SUPABASE_FUNCTIONS_URL=https://tifytikdzembawmgggij.supabase.co/functions/v1

# Google Drive Configuration (Optional - for direct client upload)
VITE_GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
EOF
```

**⚠️ IMPORTANT**: Replace `your-anon-public-key-here` with your actual Supabase anon key from your Supabase dashboard.

### 2. Apply Storage Fix to Supabase

Run the storage fix SQL script in your Supabase SQL editor:

```sql
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
```

### 3. Deploy Google Drive Edge Function

Deploy the Google Drive upload function to Supabase:

```bash
# Deploy the Edge Function
supabase functions deploy upload-to-drive --no-verify-jwt

# Set the required secrets
supabase secrets set GDRIVE_FOLDER_ID=your-google-drive-folder-id
supabase secrets set GDRIVE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

### 4. Configure Google Drive Integration

1. **Share Drive Folder**: Share your Google Drive folder with the service account email: `examspace-bot@response-dashboard-475713.iam.gserviceaccount.com`
2. **Get Folder ID**: Copy the folder ID from the Drive URL
3. **Set Secrets**: Use the secrets from `examspace-storage.json`

### 5. Test the Fix

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Test video recording**: 
   - Start an exam session
   - Begin recording
   - Check browser console for upload progress
   - Verify the video appears in your Google Drive folder

## Expected Behavior After Fix

✅ **Video Recording**: Should work without size limit errors  
✅ **Google Drive Upload**: Videos should upload to your designated Drive folder  
✅ **Fallback Storage**: If Drive fails, videos upload to Supabase storage  
✅ **Database Updates**: Session records should update with video URLs  
✅ **Error Handling**: Proper error messages and retry mechanisms  

## Troubleshooting

### If Supabase Connection Still Fails:
1. Check your `.env` file has correct Supabase URL and key
2. Verify your Supabase project is active
3. Check network connectivity

### If Google Drive Upload Fails:
1. Verify the Edge Function is deployed: `supabase functions list`
2. Check secrets are set: `supabase secrets list`
3. Ensure Drive folder is shared with service account
4. Check browser console for detailed error messages

### If Storage Upload Fails:
1. Run the storage fix SQL script
2. Verify bucket exists and has correct limits
3. Check storage policies allow uploads

## Video Upload Flow (Fixed)

```
1. User starts recording → VideoRecorder component
2. Recording stops → Blob created (127MB+)
3. Upload attempt:
   a. Try Google Drive via Edge Function (preferred)
   b. If fails, fallback to Supabase storage
4. Update database with video URL
5. Show success message to user
```

The system now has proper error handling, fallback mechanisms, and should handle large video files correctly.
