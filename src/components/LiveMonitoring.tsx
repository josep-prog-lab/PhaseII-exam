import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Clock, 
  Video, 
  Eye, 
  AlertCircle,
  CheckCircle2,
  Radio
} from "lucide-react";

interface ActiveSession {
  id: string;
  full_name: string;
  email: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  recording_started_at: string | null;
  exam: {
    title: string;
  };
}

const LiveMonitoring = () => {
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveSessions();

    // Subscribe to real-time updates for candidate_sessions table
    const channel = supabase
      .channel('live-monitoring')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_sessions'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          // Reload sessions when any change occurs
          loadActiveSessions();
        }
      )
      .subscribe();

    // Refresh every 10 seconds as backup
    const interval = setInterval(loadActiveSessions, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const loadActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_sessions')
        .select(`
          id,
          full_name,
          email,
          status,
          started_at,
          recording_started_at,
          exam:exams(title)
        `)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false });

      if (error) throw error;
      setActiveSessions(data || []);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getElapsedTime = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="ml-2 text-muted-foreground">Loading live sessions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-500 animate-pulse" />
          Live Exam Monitoring
          <Badge variant="destructive" className="ml-auto">
            {activeSessions.length} Active
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time view of candidates currently taking exams
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activeSessions.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No active exam sessions at the moment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <h3 className="font-semibold">{session.full_name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        LIVE
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{session.email}</p>
                    <p className="text-sm font-medium text-primary mb-2">{session.exam.title}</p>
                    
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Elapsed: {getElapsedTime(session.started_at)}</span>
                      </div>
                      
                      {session.recording_started_at ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Video className="h-4 w-4" />
                          <span>Recording Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-orange-600">
                          <AlertCircle className="h-4 w-4" />
                          <span>No Recording</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/session/${session.id}/review`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {activeSessions.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Auto-refreshing every 10 seconds</span>
              </div>
              <Button variant="ghost" size="sm" onClick={loadActiveSessions}>
                Refresh Now
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveMonitoring;
