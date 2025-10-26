import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Square, Camera, Mic, Monitor, AlertTriangle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Prefer secure server-side upload via Supabase Edge Function

// Configurable via .env (optional) - Optimized defaults for efficiency
const RECORDING_FPS = Number(import.meta.env.VITE_RECORDING_FPS) || 24; // Reduced from 30 to 24 FPS
const VIDEO_BITRATE = Number(import.meta.env.VITE_VIDEO_BITRATE) || 400_000; // Reduced from 500k to 400k bps
const AUDIO_BITRATE = Number(import.meta.env.VITE_AUDIO_BITRATE) || 48_000; // Reduced from 64k to 48k bps
const PIP_WIDTH_RATIO = Number(import.meta.env.VITE_PIP_WIDTH_RATIO) || 0.2; // 20% of width
const CHUNK_DURATION_MS = Number(import.meta.env.VITE_CHUNK_DURATION_MS) || 60000; // 1 minute chunks
const MAX_CANVAS_WIDTH = Number(import.meta.env.VITE_MAX_CANVAS_WIDTH) || 1280; // Max width for recording

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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const webcamPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    checkPermissions();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      stopAllStreams();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Set isRecording to true FIRST to render the video element
      // This ensures webcamPreviewRef.current exists before we set the stream
      setIsRecording(true);
      
      // Small delay to ensure the video element is rendered in DOM
      await new Promise(resolve => setTimeout(resolve, 200));
      
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

      // Setup webcam preview FIRST before recording starts
      // This ensures the candidate can see their face immediately
      console.log('Setting up webcam preview...');
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (webcamPreviewRef.current) {
        const videoElement = webcamPreviewRef.current;
        
        // Set the webcam stream to the video element
        videoElement.srcObject = webcamStream;
        
        // Force video attributes
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        
        // Wait for metadata to load
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.warn('Webcam preview timeout - continuing anyway');
            resolve();
          }, 3000);
          
          videoElement.onloadedmetadata = async () => {
            clearTimeout(timeout);
            console.log('Webcam preview metadata loaded:', {
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight,
              readyState: videoElement.readyState
            });
            
            try {
              await videoElement.play();
              console.log('Webcam preview playing successfully');
              resolve();
            } catch (err) {
              console.error('Error playing webcam preview:', err);
              toast.error('Failed to start camera preview');
              reject(err);
            }
          };
          
          videoElement.onerror = (err) => {
            clearTimeout(timeout);
            console.error('Video element error:', err);
            toast.error('Camera display error');
            reject(err);
          };
        });
        
        console.log('Webcam preview setup complete');
      } else {
        console.warn('Webcam preview element not found in DOM');
      }

      // Create composite stream with canvas (screen + webcam overlay)
      const canvas = canvasRef.current || document.createElement('canvas');
      if (!canvasRef.current) canvasRef.current = canvas;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Set canvas size to match screen stream, but cap at max width for efficiency
      const screenTrack = screenStream.getVideoTracks()[0];
      const screenSettings = screenTrack.getSettings();
      const originalWidth = screenSettings.width || 1920;
      const originalHeight = screenSettings.height || 1080;
      
      // Scale down if necessary to reduce file size
      if (originalWidth > MAX_CANVAS_WIDTH) {
        const scale = MAX_CANVAS_WIDTH / originalWidth;
        canvas.width = MAX_CANVAS_WIDTH;
        canvas.height = Math.round(originalHeight * scale);
        console.log(`Canvas scaled down from ${originalWidth}x${originalHeight} to ${canvas.width}x${canvas.height}`);
      } else {
        canvas.width = originalWidth;
        canvas.height = originalHeight;
      }

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
      
      // Initialize live streaming to admin dashboard
      initializeLiveStreaming(canvas);
      
      // Add audio tracks to composite stream
      const audioTracks = screenStream.getAudioTracks().length > 0 
        ? screenStream.getAudioTracks() 
        : webcamStream.getAudioTracks();
      
      audioTracks.forEach(track => {
        compositeStream.addTrack(track);
      });

      // Create recorder with optimized settings for smaller file sizes
      // Try VP9 first (better compression), fall back to VP8
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        console.log('VP9 not supported, using VP8');
      } else {
        console.log('Using VP9 codec for better compression');
      }
      
      const recorder = new MediaRecorder(compositeStream, {
        mimeType: mimeType,
        videoBitsPerSecond: VIDEO_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE
      });

      const chunks: BlobPart[] = [];
      let chunkCount = 0;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          chunkCount++;
          
          // Log chunk info for debugging
          const chunkSizeMB = (event.data.size / (1024 * 1024)).toFixed(2);
          console.log(`Chunk ${chunkCount} recorded: ${chunkSizeMB}MB`);
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
      // Collect data in larger chunks (5 seconds) for better efficiency
      recorder.start(5000); // Collect data every 5 seconds instead of 1 second
      
      // isRecording already set to true earlier to render video element
      // setIsRecording(true); // Already done at start of function
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

  const initializeLiveStreaming = async (canvas: HTMLCanvasElement) => {
    try {
      // Create a Supabase Realtime channel for broadcasting video frames
      const channel = supabase.channel(`live-video-${sessionId}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: sessionId }
        }
      });
      
      const subscribeStatus = await channel.subscribe();
      console.log('Live streaming channel subscription status:', subscribeStatus);
      
      realtimeChannelRef.current = channel;
      
      console.log('Live streaming initialized for session:', sessionId);
      
      let frameCount = 0;
      
      // Broadcast frames every 2 seconds (to reduce bandwidth)
      // For production, consider using WebRTC for better real-time performance
      broadcastIntervalRef.current = setInterval(() => {
        // Don't check isRecording state - just check if canvas exists
        if (canvas && canvasRef.current) {
          try {
            // Capture frame from canvas at reduced quality for live streaming
            const frameData = canvas.toDataURL('image/jpeg', 0.4); // 40% quality
            frameCount++;
            
            console.log(`Broadcasting frame ${frameCount} for session ${sessionId} (size: ${(frameData.length / 1024).toFixed(1)}KB)`);
            
            // Broadcast frame to admin dashboard
            channel.send({
              type: 'broadcast',
              event: 'video-frame',
              payload: {
                frame: frameData,
                sessionId: sessionId,
                timestamp: Date.now(),
                frameNumber: frameCount
              }
            }).then(() => {
              console.log(`Frame ${frameCount} sent successfully`);
            }).catch((err) => {
              console.error(`Error sending frame ${frameCount}:`, err);
            });
          } catch (error) {
            console.error('Error broadcasting video frame:', error);
          }
        } else {
          console.warn('Canvas not available for broadcasting');
        }
      }, 2000); // Broadcast every 2 seconds
      
    } catch (error) {
      console.error('Error initializing live streaming:', error);
      // Don't block recording if live streaming fails
    }
  };

  const stopAllStreams = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
    
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
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

        {/* Webcam Preview - Always render but hide when not recording */}
        {/* This ensures the video element exists in DOM before we set the stream */}
        <div className={isRecording ? 'block mt-4' : 'hidden'}>
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-primary">
              <Camera className="h-5 w-5" />
              Your Camera View - You Are Being Monitored
            </h4>
            <div className="relative rounded-lg overflow-hidden border-4 border-red-500 bg-black shadow-lg">
              <video
                ref={webcamPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-auto bg-black"
                style={{ 
                  maxHeight: '300px', 
                  minHeight: '200px', 
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
              <div className="absolute top-3 left-3 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-md flex items-center gap-2 shadow-lg">
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                LIVE RECORDING
              </div>
              <div className="absolute bottom-3 left-3 right-3 bg-black/80 text-white text-xs px-3 py-2 rounded-md">
                <p className="font-medium">✓ Your face is visible and being recorded</p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 rounded">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                📹 This is what's being recorded: Your face will appear in the bottom-right corner of your screen recording for exam supervision.
              </p>
            </div>
          </div>
        </div>

        {/* Hidden canvas for compositing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </CardContent>
    </Card>
  );
};

export default VideoRecorder;

