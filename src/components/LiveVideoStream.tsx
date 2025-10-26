import { useState, useEffect, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Video, VideoOff, Maximize2, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface LiveVideoStreamProps {
  sessionId: string;
  candidateName: string;
  isActive: boolean;
  onStreamStatusChange?: (sessionId: string, isStreaming: boolean) => void;
}

/**
 * LiveVideoStream Component
 * 
 * This component enables real-time video monitoring of candidates during exams.
 * It uses Supabase Realtime to establish a live connection and streams video frames.
 * 
 * Note: For production, consider using WebRTC with TURN/STUN servers for better
 * peer-to-peer video streaming. This implementation uses a simplified approach
 * with periodic frame updates via Supabase Realtime channels.
 */
const LiveVideoStream = ({ sessionId, candidateName, isActive, onStreamStatusChange }: LiveVideoStreamProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastFrameUpdate, setLastFrameUpdate] = useState<Date | null>(null);
  const [streamHealth, setStreamHealth] = useState<'good' | 'fair' | 'poor'>('good');
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && sessionId) {
      initializeStream();
    } else {
      cleanupStream();
    }

    return () => {
      cleanupStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isActive]);

  const initializeStream = async () => {
    try {
      setError(null);
      
      // Create a Supabase Realtime channel for this specific session
      const channel = supabase.channel(`live-video-${sessionId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: sessionId }
        }
      });

      // Listen for video frame updates from the candidate
      channel
        .on('broadcast', { event: 'video-frame' }, (payload) => {
          if (payload.payload && payload.payload.frame) {
            renderFrame(payload.payload.frame);
            const now = new Date();
            setLastFrameUpdate(now);
            if (!isStreaming) {
              setIsStreaming(true);
              onStreamStatusChange?.(sessionId, true);
            }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to live video stream for session ${sessionId}`);
            // Do not mark as streaming until frames arrive
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel subscription error');
            setError('Failed to connect to live stream');
            if (isStreaming) {
              setIsStreaming(false);
              onStreamStatusChange?.(sessionId, false);
            }
          }
        });

      channelRef.current = channel;

      // Monitor stream health
      healthCheckIntervalRef.current = setInterval(() => {
        checkStreamHealth();
      }, 5000);

    } catch (error) {
      console.error('Error initializing live stream:', error);
      setError('Failed to initialize stream');
      setIsStreaming(false);
    }
  };

  const cleanupStream = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (isStreaming) {
      onStreamStatusChange?.(sessionId, false);
    }
    setIsStreaming(false);
  };

  const renderFrame = (frameData: string) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      console.error('Error loading video frame');
    };
    img.src = frameData; // Base64 encoded frame
  };

  const checkStreamHealth = () => {
    if (!lastFrameUpdate) {
      setStreamHealth('poor');
      if (isStreaming) {
        onStreamStatusChange?.(sessionId, false);
        setIsStreaming(false);
      }
      return;
    }

    const now = new Date();
    const timeSinceLastFrame = now.getTime() - lastFrameUpdate.getTime();
    
    if (timeSinceLastFrame < 3000) {
      setStreamHealth('good');
    } else if (timeSinceLastFrame < 10000) {
      setStreamHealth('fair');
    } else {
      setStreamHealth('poor');
      setError('Stream may have disconnected');
      if (isStreaming) {
        onStreamStatusChange?.(sessionId, false);
        setIsStreaming(false);
      }
    }
  };

  const requestFullScreen = () => {
    if (canvasRef.current) {
      canvasRef.current.requestFullscreen();
    }
  };

  const getHealthColor = () => {
    switch (streamHealth) {
      case 'good': return 'bg-green-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            {isStreaming ? (
              <>
                <Video className="h-4 w-4 text-green-500" />
                <span>{candidateName}</span>
              </>
            ) : (
              <>
                <VideoOff className="h-4 w-4 text-gray-400" />
                <span>{candidateName}</span>
              </>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {isStreaming && (
              <>
                <div className={`w-2 h-2 rounded-full ${getHealthColor()} animate-pulse`} />
                <Badge variant={streamHealth === 'good' ? 'default' : 'destructive'} className="text-xs">
                  {streamHealth === 'good' ? 'LIVE' : streamHealth.toUpperCase()}
                </Badge>
              </>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={requestFullScreen}
              disabled={!isStreaming}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="relative rounded-lg overflow-hidden bg-gray-900" style={{ aspectRatio: '16/9' }}>
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : !isStreaming ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Eye className="h-12 w-12 text-gray-500 mb-2" />
              <p className="text-sm text-gray-400">Waiting for stream...</p>
            </div>
          ) : null}
          
          <canvas
            ref={canvasRef}
            width={480}
            height={270}
            className="w-full h-full object-cover"
          />
          
          {isStreaming && lastFrameUpdate && (
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </div>
          )}
        </div>
        
        {isStreaming && (
          <div className="mt-2 text-xs text-muted-foreground text-center">
            Session ID: {sessionId.slice(0, 8)}...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(LiveVideoStream);
