Google Drive upload integration

Setup
- Share the destination Drive folder with the service account email: examspace-bot@response-dashboard-475713.iam.gserviceaccount.com (Writer or higher).
- Capture the folder ID from the Drive URL and store it as a secret in Supabase: GDRIVE_FOLDER_ID.
- Store the full service account JSON as a Supabase secret: GDRIVE_SERVICE_ACCOUNT_JSON.

Deploy Edge Function
- Path: supabase/functions/upload-to-drive
- Deploy: supabase functions deploy upload-to-drive --no-verify-jwt
- Set secrets: supabase secrets set --env-file <(printf "GDRIVE_FOLDER_ID=YOUR_FOLDER_ID\nGDRIVE_SERVICE_ACCOUNT_JSON=$(cat examspace-storage.json)")

Frontend behavior
- VideoRecorder posts the recorded blob and candidateName to /functions/v1/upload-to-drive.
- The Edge Function uploads using resumable upload and returns { id, name, webViewLink, webContentLink }.
- The app saves recording_url to the Drive link (webViewLink/webContentLink) or file id.

Filename collision
- If a candidate name already exists in the folder, the function appends Roman numerals: (II), (III), ... before .webm.

Session review
- If recording_url is a Drive link or file id, the review page will render it; otherwise it falls back to Supabase storage.

Security
- Service account credentials are kept server-side via Supabase Edge Function. Do not expose in client builds.

# Video Upload Fix Documentation

## Problem Analysis

The video recording upload was failing with the error:
```
StorageApiError: The object exceeded the maximum allowed size
```

### Root Causes:
1. **Storage Limit**: Supabase bucket was configured with 100MB limit
2. **Video Size**: Long recordings (1+ hours) were generating files >100MB
3. **Bitrate Settings**: High bitrate settings (1Mbps video + 128Kbps audio)
4. **No Error Handling**: No retry mechanism or size checking

### Size Calculation:
- **Original Settings**: 1Mbps video + 128Kbps audio
- **1-hour recording**: ~3.6GB (36x the 100MB limit)
- **Even 30 minutes**: ~1.8GB (18x the limit)

## Solutions Implemented

### 1. Database Migration
- **File**: `supabase/migrations/20250121000005_increase_storage_limits.sql`
- **Changes**:
  - Increased file size limit from 100MB to 5GB
  - Added additional MIME types for video files
  - Maintained existing security policies

### 2. VideoRecorder Component Optimizations
- **File**: `src/components/VideoRecorder.tsx`
- **Changes**:
  - Reduced video bitrate from 1Mbps to 500Kbps
  - Reduced audio bitrate from 128Kbps to 64Kbps
  - Changed codec from VP9 to VP8 for better compression
  - Added file size validation before upload
  - Implemented retry mechanism (3 attempts)
  - Enhanced error handling and logging

### 3. Quick Fix Script
- **File**: `apply_storage_fix.sql`
- **Purpose**: Immediate database fix without running full migrations

## Expected Results

### File Size Reduction:
- **Before**: 1-hour recording = ~3.6GB
- **After**: 1-hour recording = ~1.8GB (50% reduction)
- **Storage Limit**: 5GB (50x increase from 100MB)

### New Size Estimates:
- **30 minutes**: ~900MB
- **1 hour**: ~1.8GB
- **2 hours**: ~3.6GB
- **3+ hours**: May still exceed 5GB limit

## Implementation Steps

### 1. Apply Database Fix
```sql
-- Run the migration or apply_storage_fix.sql
UPDATE storage.buckets 
SET file_size_limit = 5368709120  -- 5GB
WHERE id = 'exam-recordings';
```

### 2. Deploy Code Changes
- The VideoRecorder component changes are already applied
- No additional deployment steps needed

### 3. Test the Fix
1. Start a recording session
2. Record for 30+ minutes
3. Stop recording
4. Verify upload succeeds
5. Check file size in Supabase dashboard

## Monitoring and Maintenance

### File Size Monitoring
- Check Supabase storage usage regularly
- Monitor for files approaching 5GB limit
- Consider implementing automatic compression for very long recordings

### Future Improvements
1. **Chunked Upload**: For files >5GB, implement chunked upload
2. **Compression**: Add server-side compression for large files
3. **Cleanup**: Implement automatic cleanup of old recordings
4. **CDN**: Consider using CDN for video delivery

## Troubleshooting

### If Upload Still Fails:
1. Check Supabase dashboard for storage bucket settings
2. Verify the migration was applied correctly
3. Check browser console for detailed error messages
4. Test with shorter recordings first

### Common Issues:
- **Network timeouts**: Implement chunked upload
- **Browser memory**: Consider recording in smaller segments
- **Storage quota**: Monitor Supabase project storage limits

## Files Modified
- `supabase/migrations/20250121000005_increase_storage_limits.sql` (new)
- `src/components/VideoRecorder.tsx` (modified)
- `apply_storage_fix.sql` (new)
- `VIDEO_UPLOAD_FIX.md` (this file)

## Testing Checklist
- [ ] Database migration applied successfully
- [ ] Storage bucket shows 5GB limit
- [ ] Video recording starts without errors
- [ ] 30-minute recording uploads successfully
- [ ] 1-hour recording uploads successfully
- [ ] Error handling works for oversized files
- [ ] Retry mechanism functions correctly
