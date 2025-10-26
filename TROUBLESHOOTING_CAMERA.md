# Troubleshooting Camera and Recording Issues

## Issue 1: Black/Blank Camera Preview

### Symptoms
- Camera shows "LIVE" badge but displays a black screen
- Recording is active but candidate's face isn't visible

### Possible Causes & Solutions

#### 1. Camera is covered or not properly selected
**Check:**
- Is your physical camera covered or blocked?
- Are you using the correct camera (not a virtual camera)?
- Try visiting chrome://settings/content/camera to verify camera access

#### 2. Browser hasn't fully granted camera access
**Solution:**
```bash
# In browser console, check:
navigator.mediaDevices.enumerateDevices()
  .then(devices => console.log(devices.filter(d => d.kind === 'videoinput')));
```

#### 3. Video element not receiving stream properly
**Fixed in latest code:**
- Added better error handling in VideoRecorder.tsx
- Added console logging to track stream setup
- Added video element error handlers

**To verify the fix works:**
1. Open browser DevTools console
2. Start the exam
3. Look for these logs:
   ```
   Requesting webcam and microphone...
   Webcam stream obtained: ...
   Setting up webcam preview...
   Webcam preview metadata loaded, starting playback
   Webcam preview playing successfully
   ```

4. If you see "Error playing webcam preview" - the camera permissions might be denied

#### 4. CSS or styling hiding the video
**Check:**
The video element should have:
- `bg-gray-900` background (so you see dark gray, not pure black)
- `objectFit: 'cover'` to fill the space
- `minHeight: '150px'` to ensure visible area

### Debug Steps

1. **Test camera in isolation:**
   ```javascript
   // Run in browser console:
   navigator.mediaDevices.getUserMedia({ video: true, audio: false })
     .then(stream => {
       const video = document.createElement('video');
       video.srcObject = stream;
       video.style.position = 'fixed';
       video.style.top = '0';
       video.style.left = '0';
       video.style.zIndex = '99999';
       video.style.width = '400px';
       video.autoplay = true;
       document.body.appendChild(video);
     });
   ```
   This will show your camera in the corner of the screen.

2. **Check browser console for errors:**
   Look for messages starting with:
   - `Error playing webcam preview`
   - `Video element error`
   - `Permission denied`

3. **Verify camera is working:**
   - Go to https://webcamtests.com/
   - Confirm your camera works there
   - Return to your exam app

---

## Issue 2: Recording Not Showing in Admin Dashboard

### Symptoms
- Exam is completed
- Recording badge shows "RECORDING" during exam
- But admin dashboard shows "No recording available"

### Root Cause
**The `recording_checksum` column is missing from the database!**

### **CRITICAL: You MUST run the database migration**

#### Step-by-Step Fix:

1. **Open Supabase Dashboard:**
   - Go to: https://nmduczkfmzmoxqxqghfx.supabase.co
   - Login to your account

2. **Navigate to SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and run this SQL:**

```sql
-- Add missing columns to candidate_sessions table
ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_checksum TEXT;

ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMPTZ;

ALTER TABLE public.candidate_sessions 
ADD COLUMN IF NOT EXISTS recording_required BOOLEAN NOT NULL DEFAULT true;

-- Add comments
COMMENT ON COLUMN public.candidate_sessions.recording_checksum 
  IS 'SHA-256 checksum of the uploaded recording for integrity verification';

COMMENT ON COLUMN public.candidate_sessions.recording_started_at 
  IS 'Timestamp when the recording was started';

COMMENT ON COLUMN public.candidate_sessions.recording_required 
  IS 'Whether recording is mandatory for this exam session';

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidate_sessions' 
  AND column_name IN ('recording_checksum', 'recording_started_at', 'recording_required')
ORDER BY column_name;
```

4. **Click RUN** (or press Ctrl+Enter)

5. **Verify Success:**
   You should see output showing the three new columns were added.

#### After running the migration:

1. Restart your development server:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. Test with a new exam session:
   - Register a new candidate
   - Start the exam
   - Complete and submit
   - Check admin dashboard - recording should now appear

---

## Issue 3: SessionReview Dialog Error

### Symptoms
```
Uncaught ReferenceError: Dialog is not defined
```

### Status
**✅ FIXED** - Added missing Dialog imports to SessionReview.tsx

The file now imports:
```typescript
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

---

## Quick Checklist

Before testing again, ensure:

- [ ] Database migration SQL has been run in Supabase dashboard
- [ ] SessionReview.tsx Dialog import fix is in place
- [ ] VideoRecorder.tsx has enhanced error handling
- [ ] Development server has been restarted
- [ ] Browser has camera permissions granted
- [ ] You're testing with a fresh exam session (not old data)

---

## Expected Behavior After Fixes

### During Exam:
1. Click "Enable Monitoring & Start Exam"
2. Grant camera + microphone permissions (one prompt)
3. Exam starts
4. Recording starts automatically
5. Grant screen sharing permission (one prompt)
6. Camera preview shows your face with "LIVE" badge
7. Recording timer counts up
8. Screen and camera are being recorded

### After Completing Exam:
1. Submit exam
2. Recording automatically uploads to Supabase storage
3. Database records recording path and checksum

### In Admin Dashboard:
1. Go to session review
2. See recording status: "Available"
3. Click preview to watch recording
4. Click download to save recording locally

---

## Still Having Issues?

### Check these in order:

1. **Camera Preview Still Black?**
   - Run the camera test script in console (see debug steps above)
   - Check if other apps can access your camera
   - Try in incognito mode (to rule out extension conflicts)
   - Check browser console for specific error messages

2. **Recording Not Uploading?**
   - Verify database migration was run successfully
   - Check Network tab for failed requests to Supabase
   - Check Supabase storage bucket exists: `exam-recordings`
   - Verify Supabase storage policies allow uploads

3. **Admin Dashboard Errors?**
   - Hard refresh the page (Ctrl+Shift+R)
   - Clear browser cache
   - Check browser console for errors

---

## Console Commands for Debugging

```javascript
// 1. Check if camera is accessible
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('✅ Camera works!', stream.getVideoTracks()[0].getSettings());
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => console.error('❌ Camera error:', err));

// 2. Check Supabase connection
const { data, error } = await supabase.from('candidate_sessions').select('id').limit(1);
console.log('Supabase test:', error ? `❌ ${error.message}` : '✅ Connected');

// 3. List available cameras
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    const cameras = devices.filter(d => d.kind === 'videoinput');
    console.log('Available cameras:', cameras);
  });
```

---

**Need more help? Check the main FIXES_APPLIED.md document for comprehensive details.**
