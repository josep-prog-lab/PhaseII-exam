import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Square, Camera, Mic, Monitor, AlertTriangle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Prefer secure server-side upload via Supabase Edge Function

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
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      screenStreamRef.current = screenStream;
      webcamStreamRef.current = webcamStream;

      // Combine streams
      const combinedStream = new MediaStream();
      
      // Add screen video track
      screenStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // Add webcam video track
      webcamStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // Add audio track (prefer screen audio, fallback to webcam)
      const audioTracks = screenStream.getAudioTracks().length > 0 
        ? screenStream.getAudioTracks() 
        : webcamStream.getAudioTracks();
      
      audioTracks.forEach(track => {
        combinedStream.addTrack(track);
      });

      // Create recorder with optimized settings for smaller file sizes
      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8', // Use vp8 for better compression
        videoBitsPerSecond: 500000, // Reduced from 1Mbps to 500Kbps
        audioBitsPerSecond: 64000 // Reduced from 128Kbps to 64Kbps
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
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
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

      // Build desired name using candidate full name; fall back to session-based
      const safeName = (candidateName || `session-${sessionId}`).trim().replace(/\s+/g, ' ');
      const desiredName = `${safeName}`;

      // Try Google Drive upload first (preferred method)
      try {
        console.log('Attempting Google Drive upload...');
        
        // Upload to Google Drive via Edge Function (FormData)
        const form = new FormData();
        form.append('file', blob, `${safeName}.webm`);
        form.append('candidateName', desiredName);

        // Try to get the correct Supabase functions URL
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : '/functions/v1';
        console.log(`Using functions base URL: ${functionsBase}`);
        
        const res = await fetch(`${functionsBase}/upload-to-drive`, { 
          method: 'POST', 
          body: form 
        });
        
        if (!res.ok) {
          const text = await res.text();
          console.error(`Drive upload failed: ${res.status} ${text}`);
          throw new Error(`Drive upload failed: ${res.status} ${text}`);
        }
        
        const driveFile = await res.json();
        console.log('Google Drive upload successful:', driveFile);

        // Update session with Drive link (prefer webViewLink); store file id as well
        const updateData: any = { 
          recording_url: driveFile.webViewLink || driveFile.webContentLink || driveFile.id
        };
        
        // Only include recording_drive_file_id if the column exists
        // This prevents errors if the column hasn't been added yet
        try {
          updateData.recording_drive_file_id = driveFile.id;
        } catch (error) {
          console.warn('recording_drive_file_id column not available, skipping');
        }

        const { error: updateError } = await supabase
          .from('candidate_sessions')
          .update(updateData)
          .eq('id', sessionId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw new Error(`Failed to update session: ${updateError.message}`);
        }

        toast.success(`Recording uploaded to Drive (${(blob.size / (1024 * 1024)).toFixed(2)}MB)`);
        return driveFile.id;

      } catch (driveError) {
        console.warn('Google Drive upload failed, trying Supabase storage fallback:', driveError);
        
        // If it's a 404 error, the Edge Function isn't deployed
        if (driveError instanceof Error && driveError.message.includes('404')) {
          console.warn('Google Drive Edge Function not deployed, using Supabase storage only');
        }
        
        // Fallback to Supabase storage if Google Drive fails
        const fileName = `session-${sessionId}-${new Date().toISOString()}.webm`;
        
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

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('exam-recordings')
          .getPublicUrl(fileName);

        // Update session with storage URL
        const updateData: any = { 
          recording_url: urlData.publicUrl
        };
        
        // Only include recording_drive_file_id if the column exists
        try {
          updateData.recording_drive_file_id = uploadData.path;
        } catch (error) {
          console.warn('recording_drive_file_id column not available, skipping');
        }

        const { error: updateError } = await supabase
          .from('candidate_sessions')
          .update(updateData)
          .eq('id', sessionId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw new Error(`Failed to update session: ${updateError.message}`);
        }

        toast.success(`Recording uploaded to storage (${(blob.size / (1024 * 1024)).toFixed(2)}MB)`);
        return uploadData.path;
      }

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
      </CardContent>
    </Card>
  );
};

export default VideoRecorder;

