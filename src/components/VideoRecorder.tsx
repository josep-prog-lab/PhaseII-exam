import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Square, Camera, Mic, Monitor, AlertTriangle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Prefer secure server-side upload via Supabase Edge Function

// Configurable via .env (optional)
const RECORDING_FPS = Number(import.meta.env.VITE_RECORDING_FPS) || 30;
const VIDEO_BITRATE = Number(import.meta.env.VITE_VIDEO_BITRATE) || 500_000; // bps
const AUDIO_BITRATE = Number(import.meta.env.VITE_AUDIO_BITRATE) || 64_000; // bps
const PIP_WIDTH_RATIO = Number(import.meta.env.VITE_PIP_WIDTH_RATIO) || 0.2; // 20% of width

interface VideoRecorderProps {
  sessionId: string;
  candidateName?: string;
  onRecordingStart?: () => void;
  onRecordingStop?: (blob: Blob, checksum: string) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  mandatory?: boolean;
}

const VideoRecorder = ({ sessionId, candidateName, onRecordingStart, onRecordingStop, onError, autoStart = false, mandatory = false }: VideoRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const recorderRef = useRef<any>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const webcamPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    checkPermissions();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      stopAllStreams();
    };
  }, []);

  // Auto-start recording if required
  useEffect(() => {
    if (autoStart && hasPermissions && !isRecording && !error) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        startRecording();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, hasPermissions, isRecording, error]);

  const checkPermissions = async () => {
    try {
      // Check camera permission
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (cameraPermission.state === 'granted' && microphonePermission.state === 'granted') {
        setHasPermissions(true);
      } else if (cameraPermission.state === 'prompt' || microphonePermission.state === 'prompt') {
        // Permissions are in prompt state, we can request them
        setHasPermissions(true);
      } else {
        setError("Camera and microphone permissions are required for exam monitoring");
      }
    } catch (error) {
      console.warn("Permission API not supported, will request permissions when starting recording");
      setHasPermissions(true);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request screen capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always'
        },
        audio: true
      });

      // Request webcam and microphone
      console.log('Requesting webcam and microphone...');
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      console.log('Webcam stream obtained:', {
        videoTracks: webcamStream.getVideoTracks().length,
        audioTracks: webcamStream.getAudioTracks().length,
        videoSettings: webcamStream.getVideoTracks()[0]?.getSettings()
      });

      screenStreamRef.current = screenStream;
      webcamStreamRef.current = webcamStream;

      // Show webcam preview
      if (webcamPreviewRef.current) {
        console.log('Setting up webcam preview...');
        const videoElement = webcamPreviewRef.current;
        videoElement.srcObject = webcamStream;
        
        // Ensure video loads and plays
        videoElement.onloadedmetadata = () => {
          console.log('Webcam preview metadata loaded, starting playback');
          videoElement.play()
            .then(() => console.log('Webcam preview playing successfully'))
            .catch(err => {
              console.error('Error playing webcam preview:', err);
              toast.error('Failed to display camera preview');
            });
        };
        
        // Handle errors
        videoElement.onerror = (err) => {
          console.error('Video element error:', err);
          toast.error('Camera display error');
        };
      }

      // Create composite stream with canvas (screen + webcam overlay)
      const canvas = canvasRef.current || document.createElement('canvas');
      if (!canvasRef.current) canvasRef.current = canvas;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Set canvas size to match screen stream
      const screenTrack = screenStream.getVideoTracks()[0];
      const screenSettings = screenTrack.getSettings();
      canvas.width = screenSettings.width || 1920;
      canvas.height = screenSettings.height || 1080;

      // Create video elements for compositing
      const screenVideo = document.createElement('video');
      screenVideo.muted = true;
      screenVideo.playsInline = true as any;
      screenVideo.srcObject = screenStream;

      const webcamVideo = document.createElement('video');
      webcamVideo.muted = true; // avoid feedback
      webcamVideo.playsInline = true as any;
      webcamVideo.srcObject = webcamStream;

      // Ensure both videos are ready before starting the draw loop
      await Promise.all([
        new Promise<void>((resolve) => {
          screenVideo.onloadeddata = () => resolve();
          // Fallback in case event doesn't fire
          screenVideo.play().catch(() => resolve());
        }),
        new Promise<void>((resolve) => {
          webcamVideo.onloadeddata = () => resolve();
          webcamVideo.play().catch(() => resolve());
        })
      ]);

      // Composite function - draw screen + webcam overlay continuously
      const drawComposite = () => {
        if (!ctx) return;
        
        // Only draw when a current frame is available
        if (screenVideo.readyState >= 2) {
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        }
        
        // Draw webcam in bottom-right corner (picture-in-picture)
        const pipWidth = canvas.width * PIP_WIDTH_RATIO;
        const pipHeight = pipWidth * 0.75; // 4:3 aspect ratio
        const pipX = canvas.width - pipWidth - 20; // 20px from right
        const pipY = canvas.height - pipHeight - 20; // 20px from bottom
        
        // Draw border around webcam
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(pipX - 2, pipY - 2, pipWidth + 4, pipHeight + 4);
        
        // Draw webcam feed when ready
        if (webcamVideo.readyState >= 2) {
          ctx.drawImage(webcamVideo, pipX, pipY, pipWidth, pipHeight);
        }
        
        animationFrameRef.current = requestAnimationFrame(drawComposite);
      };

      // Start compositing loop immediately (independent of isRecording state)
      animationFrameRef.current = requestAnimationFrame(drawComposite);

      // Capture canvas stream
      const compositeStream = canvas.captureStream(RECORDING_FPS);
      compositeStreamRef.current = compositeStream;
      
      // Add audio tracks to composite stream
      const audioTracks = screenStream.getAudioTracks().length > 0 
        ? screenStream.getAudioTracks() 
        : webcamStream.getAudioTracks();
      
      audioTracks.forEach(track => {
        compositeStream.addTrack(track);
      });

      // Create recorder with optimized settings for smaller file sizes
      const recorder = new MediaRecorder(compositeStream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: VIDEO_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE
      });

      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const checksum = await calculateChecksum(blob);
        
        // Upload recording to storage with retry mechanism
        let uploadSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!uploadSuccess && retryCount < maxRetries) {
          try {
            await uploadRecording(blob, checksum);
            uploadSuccess = true;
          } catch (error) {
            retryCount++;
            console.error(`Upload attempt ${retryCount} failed:`, error);
            
            if (retryCount < maxRetries) {
              toast.warning(`Upload failed, retrying... (${retryCount}/${maxRetries})`);
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            } else {
              toast.error("Failed to upload recording after multiple attempts. Recording saved locally.");
              console.error('All upload attempts failed:', error);
            }
          }
        }
        
        if (onRecordingStop) {
          onRecordingStop(blob, checksum);
        }
      };

      recorder.onerror = (event) => {
        console.error('Recording error:', event);
        setError('Recording failed. Please try again.');
        stopRecording();
      };

      // Handle stream end events
      screenStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          toast.warning("Screen sharing ended. Recording stopped.");
          stopRecording();
        });
      });

      webcamStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          toast.warning("Camera access ended. Recording stopped.");
          stopRecording();
        });
      });

      recorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Start timer
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);
        setRecordingProgress((elapsed / 3600) * 100); // Progress over 1 hour
      }, 1000);

      if (onRecordingStart) {
        onRecordingStart();
      }

      toast.success("Recording started successfully");
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      stopAllStreams();
      toast.success("Recording stopped");
    }
  };

  const stopAllStreams = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }
    
    if (compositeStreamRef.current) {
      compositeStreamRef.current.getTracks().forEach(track => track.stop());
      compositeStreamRef.current = null;
    }
    
    // Clear webcam preview
    if (webcamPreviewRef.current) {
      webcamPreviewRef.current.srcObject = null;
    }
  };

  const calculateChecksum = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const uploadRecording = async (blob: Blob, checksum: string) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Check file size before upload (5GB limit)
      const maxSize = 5 * 1024 * 1024 * 1024; // 5GB in bytes
      if (blob.size > maxSize) {
        throw new Error(`Recording file is too large (${(blob.size / (1024 * 1024 * 1024)).toFixed(2)}GB). Maximum allowed size is 5GB.`);
      }

      console.log(`Uploading recording: ${sessionId}-${new Date().toISOString()}.webm, Size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);

      // Build file name using candidate name or session ID
      const safeName = (candidateName || `session-${sessionId}`).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
      const fileName = `${safeName}-${new Date().toISOString()}.webm`;
        
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('exam-recordings')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('Upload successful, storage path:', uploadData.path);

      // Update session with JUST the storage path (not the full URL)
      // This allows us to use .download() and .createSignedUrl() later
      const { error: updateError } = await supabase
        .from('candidate_sessions')
        .update({ 
          recording_url: uploadData.path,  // Store only the path
          recording_checksum: checksum
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Failed to update session: ${updateError.message}`);
      }

      toast.success(`Recording uploaded successfully (${(blob.size / (1024 * 1024)).toFixed(2)}MB)`);
      return uploadData.path;

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload recording';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Recording Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={checkPermissions} variant="outline">
            Check Permissions Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Exam Recording
        </CardTitle>
        <CardDescription>
          {mandatory 
            ? "Recording is mandatory for exam integrity - All permissions must be enabled"
            : "Your screen and webcam are being recorded for exam integrity"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant={isRecording ? "destructive" : "secondary"} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              {isRecording ? 'RECORDING' : 'STOPPED'}
            </Badge>
            
            {isRecording && (
              <div className="text-sm font-mono">
                {formatTime(recordingTime)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button 
                onClick={startRecording} 
                disabled={!hasPermissions}
                className={mandatory ? "bg-warning hover:bg-warning/90" : ""}
              >
                <Play className="mr-2 h-4 w-4" />
                {mandatory ? "Enable Monitoring" : "Start Recording"}
              </Button>
            ) : (
              <Button 
                onClick={stopRecording} 
                variant="destructive"
                disabled={mandatory}
                title={mandatory ? "Recording cannot be stopped during mandatory monitoring" : ""}
              >
                <Square className="mr-2 h-4 w-4" />
                {mandatory ? "Recording Active" : "Stop Recording"}
              </Button>
            )}
          </div>
        </div>

        {isRecording && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Recording Progress</span>
              <span>{recordingProgress.toFixed(1)}%</span>
            </div>
            <Progress value={recordingProgress} className="h-2" />
          </div>
        )}

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Uploading Recording
              </span>
              <span>{uploadProgress.toFixed(1)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Monitor className="h-4 w-4" />
            Screen
          </div>
          <div className="flex items-center gap-1">
            <Camera className="h-4 w-4" />
            Webcam
          </div>
          <div className="flex items-center gap-1">
            <Mic className="h-4 w-4" />
            Audio
          </div>
        </div>

        {!hasPermissions && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning-foreground">
              Please allow camera, microphone, and screen sharing permissions to start recording.
            </p>
          </div>
        )}

        {/* Webcam Preview - Shows candidate's face during exam */}
        {isRecording && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Your Camera View
            </h4>
            <div className="relative rounded-lg overflow-hidden border-2 border-primary bg-gray-900">
              <video
                ref={webcamPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-auto"
                style={{ maxHeight: '200px', minHeight: '150px', objectFit: 'cover' }}
              />
              <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Your face is being recorded and will appear in the bottom-right corner of the exam recording.
            </p>
          </div>
        )}

        {/* Hidden canvas for compositing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </CardContent>
    </Card>
  );
};

export default VideoRecorder;

