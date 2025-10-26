import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LiveStreamProbeProps {
  sessionId: string;
  onActiveChange: (sessionId: string, isActive: boolean) => void;
}

const LiveStreamProbe = ({ sessionId, onActiveChange }: LiveStreamProbeProps) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const healthTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const channel = supabase.channel(`live-video-${sessionId}`, {
      config: { broadcast: { self: false }, presence: { key: sessionId } },
    });

    channel
      .on("broadcast", { event: "video-frame" }, () => {
        lastFrameRef.current = Date.now();
        if (!isActive) {
          setIsActive(true);
          onActiveChange(sessionId, true);
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Health monitor: if no frames for 10s, mark inactive
    healthTimerRef.current = setInterval(() => {
      const last = lastFrameRef.current;
      if (!last) return;
      if (Date.now() - last > 10000 && isActive) {
        setIsActive(false);
        onActiveChange(sessionId, false);
      }
    }, 3000);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, [sessionId, onActiveChange, isActive]);

  return null;
};

export default LiveStreamProbe;
