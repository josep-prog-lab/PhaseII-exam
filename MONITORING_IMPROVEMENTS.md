# Exam Monitoring System - Improvements Documentation

## Overview
This document outlines the comprehensive improvements made to the exam monitoring system to ensure fair exam supervision with real-time video monitoring, strict permission enforcement, and optimized recording efficiency.

---

## 1. ✅ Camera Preview During Exam

### Problem
Camera was not visible to the candidate while taking the exam, making it unclear whether recording was active.

### Solution
- **Enhanced VideoRecorder Component**: Webcam preview is now always visible during recording
- **Persistent Monitoring Indicator**: Added a prominent red-bordered card showing "Your exam is being monitored"
- **Real-time Status**: Camera feed displays "LIVE" indicator with pulsing animation
- **Visibility**: Camera preview shows in the bottom-right corner of the screen recording (PIP mode)

### Files Modified
- `src/components/VideoRecorder.tsx` (lines 559-583)
- `src/pages/CandidateExam.tsx` (lines 533-557)

### Key Features
```typescript
// Camera preview is always visible when recording
{isRecording && (
  <div className="webcam-preview">
    <video ref={webcamPreviewRef} autoPlay muted playsInline />
    <div className="live-indicator">LIVE</div>
  </div>
)}
```

---

## 2. ✅ Mandatory Permission Enforcement

### Problem
Candidates could bypass permission requirements or only share a window instead of entire screen.

### Solution
- **Three-Step Permission Flow**:
  1. Camera access (mandatory)
  2. Microphone access (mandatory)
  3. Entire screen sharing (mandatory - not just window or tab)
  
- **Validation**: System verifies that the shared display surface is 'monitor' (not 'window' or 'tab')
- **No Bypass**: Exam cannot start until all permissions are granted
- **Clear UI**: Full-screen permission dialog with visual indicators for each permission

### Files Modified
- `src/pages/CandidateExam.tsx` (lines 267-347, 394-450)

### Permission Validation
```typescript
// Verify entire screen is shared
const settings = videoTrack.getSettings();
if (settings.displaySurface !== 'monitor') {
  toast.error("You must share your ENTIRE SCREEN, not just a window or tab.");
  throw new Error("Entire screen sharing is mandatory");
}
```

### User Experience
- Clear pre-exam screen explaining required permissions
- Step-by-step permission request with visual feedback
- Error messages if permissions are denied or incorrect display is selected
- Cannot proceed without completing all permission steps

---

## 3. ✅ Live Video Monitoring for Admin

### Problem
Admin dashboard only showed session metadata without live video feed of candidates.

### Solution
- **New LiveVideoStream Component**: Real-time video streaming from candidate to admin
- **Supabase Realtime Integration**: Uses Realtime channels for broadcasting video frames
- **Video Grid View**: Admin can view multiple candidates simultaneously in a grid layout
- **Stream Health Monitoring**: Visual indicators (good/fair/poor) for stream quality
- **Auto-refresh**: Updates every 2 seconds with new frames

### Files Created
- `src/components/LiveVideoStream.tsx` (new component)

### Files Modified
- `src/components/LiveMonitoring.tsx` (integrated video grid)
- `src/components/VideoRecorder.tsx` (added broadcasting capability)

### Architecture
```
Candidate Side:
  Canvas (Screen + Webcam) → Capture Frame → Broadcast via Supabase Realtime

Admin Side:
  Subscribe to Channel → Receive Frames → Render on Canvas → Display in Grid
```

### Key Features
- **Multi-candidate monitoring**: View up to 3x3 grid of live feeds
- **Fullscreen mode**: Click maximize button for detailed view
- **Stream health indicators**: Color-coded status (green/yellow/red)
- **Automatic cleanup**: Streams stop when candidate completes exam
- **Toggle view**: Admin can show/hide video grid

### Implementation Details
```typescript
// Broadcasting from candidate (every 2 seconds)
const frameData = canvas.toDataURL('image/jpeg', 0.5); // 50% quality
channel.send({
  type: 'broadcast',
  event: 'video-frame',
  payload: { frame: frameData, sessionId, timestamp }
});

// Receiving on admin side
channel.on('broadcast', { event: 'video-frame' }, (payload) => {
  renderFrame(payload.payload.frame);
  setLastFrameUpdate(new Date());
});
```

---

## 4. ✅ Auto-Remove Completed Sessions

### Problem
Completed or abandoned exam sessions continued to show in live monitoring dashboard.

### Solution
- **Automatic Filtering**: Only fetch sessions with `status = 'in_progress'`
- **Stale Session Detection**: Automatically remove sessions running >24 hours (likely abandoned)
- **Real-time Updates**: Supabase Realtime subscription triggers immediate UI updates
- **Instant Removal**: When candidate submits exam, status changes to 'completed' and session disappears

### Files Modified
- `src/components/LiveMonitoring.tsx` (lines 64-96)

### Filtering Logic
```typescript
// Only show active sessions
.eq('status', 'in_progress')

// Remove stale sessions (>24 hours)
const filteredData = data.filter(session => {
  const hoursElapsed = (now - startTime) / (1000 * 60 * 60);
  return hoursElapsed < 24;
});
```

### Benefits
- Clean dashboard showing only active exams
- Reduced database queries
- Better performance with fewer active channels
- Clear visual feedback for exam completion

---

## 5. ✅ Optimized Video Recording Efficiency

### Problem
Large video file sizes, high bandwidth usage, and potential quality issues.

### Solution

### A. Codec Optimization
- **VP9 Codec** (primary): Better compression than VP8, ~30% smaller files
- **VP8 Fallback**: For browsers that don't support VP9
- **Opus Audio**: More efficient than previous audio codec

### B. Resolution Scaling
- **Max Canvas Width**: 1280px (down from potentially 1920px+)
- **Automatic Scaling**: Maintains aspect ratio while reducing file size
- **Smart Detection**: Only scales down if necessary

### C. Bitrate Reduction
- **Video**: 400 kbps (down from 500 kbps) - 20% reduction
- **Audio**: 48 kbps (down from 64 kbps) - 25% reduction
- **FPS**: 24 fps (down from 30 fps) - 20% reduction

### D. Chunking Optimization
- **Data Collection**: 5-second chunks (up from 1-second)
- **Fewer Write Operations**: 80% reduction in I/O operations
- **Better Buffering**: Smoother recording with less overhead

### Files Modified
- `src/components/VideoRecorder.tsx` (lines 11-17, 160-176, 249-275, 333-335)

### Performance Metrics (Estimated)
```
Before Optimization:
- 1 hour exam: ~450 MB
- Network: ~125 KB/s upload
- CPU: High (30 fps + 1s chunks)

After Optimization:
- 1 hour exam: ~270 MB (~40% reduction)
- Network: ~75 KB/s upload
- CPU: Medium (24 fps + 5s chunks)
```

### Configuration (Environment Variables)
```env
# Customize via .env file
VITE_RECORDING_FPS=24           # Frames per second
VITE_VIDEO_BITRATE=400000       # Video bitrate (bps)
VITE_AUDIO_BITRATE=48000        # Audio bitrate (bps)
VITE_MAX_CANVAS_WIDTH=1280      # Max recording width
VITE_PIP_WIDTH_RATIO=0.2        # Webcam size (20% of screen)
```

---

## Live Streaming Architecture

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     CANDIDATE SIDE                           │
├─────────────────────────────────────────────────────────────┤
│  Screen Share → Canvas ←── Webcam (PIP)                     │
│       ↓                                                       │
│  MediaRecorder (Full Quality) → Storage (Recording)         │
│       ↓                                                       │
│  Frame Capture (2s interval, 50% quality)                   │
│       ↓                                                       │
│  Supabase Realtime Channel (Broadcast)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓ Network
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                      ADMIN SIDE                              │
├─────────────────────────────────────────────────────────────┤
│  Supabase Realtime Channel (Receive)                        │
│       ↓                                                       │
│  LiveVideoStream Component                                   │
│       ↓                                                       │
│  Canvas Rendering → Display in Grid                         │
│       ↓                                                       │
│  Health Monitor (Check every 5s)                            │
└─────────────────────────────────────────────────────────────┘
```

### Bandwidth Considerations
- **Live Stream**: ~50 KB/frame × 0.5 frames/s = ~25 KB/s per candidate
- **Recording Upload**: Separate, handled at end of exam
- **Scalability**: Admin can monitor ~20 candidates on typical connection

---

## Security & Privacy

### Data Protection
- ✅ Recordings stored in Supabase secure storage
- ✅ SHA-256 checksums for integrity verification
- ✅ Automatic encryption in transit (HTTPS)
- ✅ Storage bucket with RLS policies

### Compliance
- ✅ Clear permission prompts (GDPR/privacy compliance)
- ✅ Candidates explicitly consent to monitoring
- ✅ Visual indicators when recording is active
- ✅ Limited retention (implement as needed)

---

## Testing Checklist

### Candidate Experience
- [ ] Permission flow works correctly
- [ ] All three permissions (camera/mic/screen) are enforced
- [ ] Cannot start exam without permissions
- [ ] Camera preview visible during entire exam
- [ ] Recording indicator always visible
- [ ] Video upload succeeds after exam

### Admin Experience
- [ ] Live monitoring shows active sessions
- [ ] Video grid displays multiple candidates
- [ ] Video frames update every 2 seconds
- [ ] Stream health indicators work correctly
- [ ] Completed sessions auto-remove from dashboard
- [ ] Can view session details
- [ ] Can access recorded videos

### Performance
- [ ] File sizes reduced by ~40%
- [ ] No lag during recording
- [ ] Live streaming doesn't affect exam performance
- [ ] Multiple admin viewers don't degrade quality

---

## Future Enhancements (Recommended)

### 1. WebRTC Implementation
Replace Supabase Realtime broadcast with WebRTC for:
- True peer-to-peer video streaming
- Lower latency (<500ms instead of 2s)
- Better bandwidth efficiency
- Support for TURN/STUN servers

### 2. Adaptive Bitrate
Implement dynamic quality adjustment based on:
- Network conditions
- Available bandwidth
- CPU utilization

### 3. AI-Powered Monitoring
- Face detection to ensure candidate remains in frame
- Multiple person detection (cheating prevention)
- Audio analysis for suspicious activity
- Automated alerts for admin

### 4. Mobile Support
- Responsive video grid for tablets
- Mobile app for admin monitoring
- Touch-optimized controls

### 5. Recording Playback Features
- Seekable timeline
- 2x speed playback
- Bookmark suspicious moments
- Side-by-side comparison of multiple candidates

---

## Troubleshooting

### Camera Not Showing
**Issue**: Webcam preview doesn't display  
**Solution**: Check browser permissions, ensure getUserMedia is allowed

### Entire Screen Not Shared
**Issue**: Candidate tries to share window  
**Solution**: System now validates displaySurface === 'monitor'

### Live Stream Not Working
**Issue**: Admin doesn't see live feed  
**Solution**: 
- Check Supabase Realtime is enabled
- Verify channel names match
- Check network connectivity

### Large File Sizes
**Issue**: Recording files too large  
**Solution**: Adjust environment variables for lower bitrates

### Performance Issues
**Issue**: Exam lags during recording  
**Solution**: 
- Reduce canvas resolution
- Lower FPS to 20
- Disable live streaming temporarily

---

## Support

For issues or questions, check:
1. Browser console for errors
2. Supabase dashboard for realtime channel status
3. Network tab for bandwidth issues
4. Storage bucket for uploaded recordings

## Credits

Developed with:
- React + TypeScript
- Supabase (Backend + Realtime)
- MediaRecorder API
- Canvas API
- WebRTC foundations (for future enhancement)
