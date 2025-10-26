# "Enable Monitoring & Start Exam" Button Fix

## Problem Identified
The "Enable Monitoring & Start Exam" button was showing but not functioning properly. When clicked, it wasn't requesting the necessary permissions (camera, microphone, screen sharing) or starting the exam.

## Root Cause
The button was calling `setShowPermissionDialog(true)` but there was no actual permission request functionality implemented. The dialog was just a placeholder without the logic to request browser permissions.

## Solution Implemented

### 1. **Added Permission Request Function**
Created `requestPermissions()` function that:
- Requests camera and microphone permissions via `navigator.mediaDevices.getUserMedia()`
- Requests screen sharing permission via `navigator.mediaDevices.getDisplayMedia()`
- Updates permission status in real-time
- Automatically starts the exam once all permissions are granted

### 2. **Enhanced Permission Dialog**
Added a proper permission dialog that:
- Shows real-time status of each permission (camera, mic, screen)
- Displays visual indicators (green dots) when permissions are granted
- Provides clear instructions to the user
- Shows progress as permissions are granted

### 3. **Automatic Exam Start**
Once all permissions are granted:
- Sets `examStarted` to `true`
- Closes the permission dialog
- Automatically starts the VideoRecorder component
- Begins continuous recording of screen, webcam, and audio

### 4. **Enhanced VideoRecorder**
Updated the VideoRecorder component to:
- Auto-start recording when `autoStart` prop is true
- Handle mandatory recording mode
- Provide better error handling and user feedback

## How It Works Now

### **Step 1: Button Click**
When user clicks "Enable Monitoring & Start Exam":
```javascript
onClick={requestPermissions}
```

### **Step 2: Permission Requests**
The function sequentially requests:
1. **Camera & Microphone**: `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
2. **Screen Sharing**: `navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: true })`

### **Step 3: Browser Prompts**
User will see browser permission dialogs:
- "Allow camera access?"
- "Allow microphone access?"
- "Choose what to share" (for screen sharing)

### **Step 4: Automatic Exam Start**
Once all permissions are granted:
- Permission dialog closes
- Exam interface loads
- VideoRecorder automatically starts recording
- Candidate can begin taking the exam

## Files Modified

### **src/pages/CandidateExam.tsx**
- Added `requestPermissions()` function
- Added permission status state management
- Added permission dialog component
- Enhanced button click handler
- Added console logging for debugging

### **src/components/VideoRecorder.tsx**
- Enhanced auto-start functionality
- Improved permission checking
- Better error handling

## Testing the Fix

### **1. Navigate to Exam**
Go to: `http://localhost:8081/candidate/exam/[session-id]`

### **2. Click the Button**
Click "Enable Monitoring & Start Exam"

### **3. Grant Permissions**
Allow all browser permission prompts:
- Camera access
- Microphone access
- Screen sharing

### **4. Verify Exam Starts**
- Permission dialog should close
- Exam interface should load
- Recording should start automatically
- VideoRecorder should show "RECORDING" status

## Browser Requirements

### **HTTPS Required**
Screen sharing and camera access require HTTPS in production. For local development:
- Use `localhost` (automatically trusted)
- Or use `https://localhost:8081` if needed

### **Browser Support**
- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support

## Debugging

### **Console Logs**
The function now includes detailed console logging:
```
Starting permission request process...
Requesting camera and microphone permissions...
Camera and microphone permissions granted
Requesting screen sharing permission...
Screen sharing permission granted
All permissions granted, starting exam...
```

### **Common Issues**
1. **HTTPS Required**: Ensure using HTTPS or localhost
2. **Browser Permissions**: Check browser settings for camera/mic access
3. **Screen Sharing**: Some browsers require user interaction before screen sharing
4. **Multiple Tabs**: Close other tabs that might be using camera/mic

## Expected Behavior

### **Before Fix**
- Button clicked → Nothing happens
- No permission requests
- No exam start

### **After Fix**
- Button clicked → Permission dialog opens
- Browser prompts for camera, mic, screen sharing
- Permissions granted → Exam starts automatically
- Recording begins immediately
- Full supervision active

The button is now fully functional and will properly request all necessary permissions and start the exam with mandatory recording enabled.
