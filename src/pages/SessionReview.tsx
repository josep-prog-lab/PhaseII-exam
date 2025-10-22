import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  User, 
  Clock, 
  MapPin, 
  Play, 
  Download, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  Eye,
  Video
} from "lucide-react";

interface SessionData {
  id: string;
  full_name: string;
  email: string;
  contact: string;
  exam_location: string;
  custom_location: string | null;
  status: string;
  started_at: string;
  submitted_at: string | null;
  recording_url: string | null;
  recording_started_at: string | null;
  flags: any;
  exam: {
    title: string;
    description: string;
  };
}

interface AnswerData {
  id: string;
  question_id: string;
  answer_text: string | null;
  selected_option: string | null;
  code_submission: any;
  submitted_at: string;
  question: {
    question_text: string;
    options: any;
    correct_answer: string | null;
    points: number;
    section: {
      section_type: string;
    };
  };
}

const SessionReview = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [answers, setAnswers] = useState<AnswerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      // Load session with exam details
      const { data: sessionData, error: sessionError } = await supabase
        .from("candidate_sessions")
        .select(`
          *,
          exam:exams(title, description)
        `)
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Load answers with question details
      const { data: answersData, error: answersError } = await supabase
        .from("candidate_answers")
        .select(`
          *,
          question:exam_questions(
            question_text,
            options,
            correct_answer,
            points,
            section:exam_sections(
              section_type
            )
          )
        `)
        .eq("session_id", sessionId)
        .order("submitted_at");

      if (answersError) throw answersError;
      setAnswers(answersData || []);

      // Load video: if URL looks like a Drive link or ID, prefer it; else fallback to Supabase storage
      if (sessionData.recording_url) {
        const url: string = sessionData.recording_url;
        if (url.startsWith('http') && (url.includes('drive.google.com') || url.includes('googleusercontent.com'))) {
          setVideoUrl(url);
        } else if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) {
          // Looks like a Drive file ID
          setVideoUrl(`https://drive.google.com/uc?id=${url}&export=download`);
        } else {
          const { data: videoData } = await supabase.storage
            .from('exam-recordings')
            .createSignedUrl(url, 3600);
          if (videoData?.signedUrl) setVideoUrl(videoData.signedUrl);
        }
      }
    } catch (error) {
      console.error("Error loading session data:", error);
      toast.error("Failed to load session data");
    } finally {
      setLoading(false);
    }
  };

  const downloadRecording = async () => {
    if (!session?.recording_url) {
      toast.error("No recording available for download");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('exam-recordings')
        .download(session.recording_url);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `exam-recording-${session.full_name}-${session.id}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Recording download started");
    } catch (error) {
      console.error("Error downloading recording:", error);
      toast.error("Failed to download recording");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'abandoned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'abandoned': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  const formatDuration = (startedAt: string, submittedAt?: string | null) => {
    const start = new Date(startedAt);
    const end = submittedAt ? new Date(submittedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getLocationDisplay = (location: string, customLocation?: string | null) => {
    if (location === 'other' && customLocation) {
      return customLocation;
    }
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  const parseOptions = (options: string | null) => {
    if (!options) return [];
    try {
      return JSON.parse(options);
    } catch {
      return [];
    }
  };

  const calculateScore = () => {
    let totalPoints = 0;
    let earnedPoints = 0;

    answers.forEach(answer => {
      const question = answer.question;
      totalPoints += question.points;

      if (question.section.section_type === 'mcq' && answer.selected_option === question.correct_answer) {
        earnedPoints += question.points;
      } else if (question.section.section_type === 'theoretical' && answer.answer_text) {
        // For theoretical questions, we'll assume partial credit for now
        // In a real system, this would need manual grading
        earnedPoints += question.points * 0.5; // 50% for having an answer
      }
    });

    return { earned: earnedPoints, total: totalPoints, percentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0 };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Session not found</h3>
          <p className="text-muted-foreground mb-4">The requested session could not be found.</p>
          <Button onClick={() => navigate("/admin/manage-exams")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Exams
          </Button>
        </div>
      </div>
    );
  }

  const score = calculateScore();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Session Review</h1>
              <p className="text-sm text-muted-foreground">{session.exam.title}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Session Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Candidate Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">{session.full_name}</p>
                  <p className="text-sm text-muted-foreground">{session.email}</p>
                  <p className="text-sm text-muted-foreground">{session.contact}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(session.status)} flex items-center gap-1 w-fit`}>
                    {getStatusIcon(session.status)}
                    {session.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-4 w-4" />
                  {getLocationDisplay(session.exam_location, session.custom_location)}
                </div>

                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4" />
                  Duration: {formatDuration(session.started_at, session.submitted_at)}
                </div>

                {session.flags && Array.isArray(session.flags) && session.flags.length > 0 && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium text-destructive mb-1">
                      {session.flags.length} Flag{session.flags.length !== 1 ? 's' : ''} Raised
                    </p>
                    <p className="text-xs text-destructive/80">
                      Review the recording for suspicious activity
                    </p>
                  </div>
                )}

                {/* Recording Section */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Exam Recording
                  </h4>
                  
                  {session.recording_url ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Recording available ({session.recording_started_at ? 'Started: ' + new Date(session.recording_started_at).toLocaleString() : 'Unknown start time'})
                      </p>
                      <div className="flex gap-2">
                        {videoUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                              <Play className="mr-2 h-4 w-4" />
                              Watch
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={downloadRecording}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recording available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Answers and Results */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="answers" className="space-y-4">
              <TabsList>
                <TabsTrigger value="answers">Answers ({answers.length})</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="answers">
                <Card>
                  <CardHeader>
                    <CardTitle>Candidate Answers</CardTitle>
                    <CardDescription>
                      Review all answers submitted by the candidate
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {answers.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No answers submitted</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {answers.map((answer, index) => (
                          <div key={answer.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="font-medium">Question {index + 1}</h4>
                              <Badge variant="outline">{answer.question.points} points</Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-4">
                              {answer.question.question_text}
                            </p>

                            {answer.question.section.section_type === 'mcq' && (
                              <div>
                                <p className="text-sm font-medium mb-2">Selected Answer:</p>
                                <p className="text-sm bg-muted p-2 rounded">
                                  {answer.selected_option || 'No answer selected'}
                                </p>
                                {answer.question.correct_answer && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Correct Answer: {answer.question.correct_answer}
                                  </p>
                                )}
                              </div>
                            )}

                            {answer.question.section.section_type === 'theoretical' && (
                              <div>
                                <p className="text-sm font-medium mb-2">Answer:</p>
                                <p className="text-sm bg-muted p-2 rounded whitespace-pre-wrap">
                                  {answer.answer_text || 'No answer provided'}
                                </p>
                              </div>
                            )}

                            {answer.question.section.section_type === 'practical' && answer.code_submission && (
                              <div>
                                <p className="text-sm font-medium mb-2">Code Submission:</p>
                                <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                                  {JSON.stringify(answer.code_submission, null, 2)}
                                </pre>
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground mt-2">
                              Submitted: {new Date(answer.submitted_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary">
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Summary</CardTitle>
                    <CardDescription>
                      Overview of candidate performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center p-4 border rounded">
                        <h3 className="text-2xl font-bold text-primary">{score.earned.toFixed(1)}</h3>
                        <p className="text-sm text-muted-foreground">Points Earned</p>
                      </div>
                      <div className="text-center p-4 border rounded">
                        <h3 className="text-2xl font-bold">{score.total}</h3>
                        <p className="text-sm text-muted-foreground">Total Points</p>
                      </div>
                      <div className="text-center p-4 border rounded">
                        <h3 className="text-2xl font-bold text-success">{score.percentage.toFixed(1)}%</h3>
                        <p className="text-sm text-muted-foreground">Score</p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="font-medium mb-2">Exam Details</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Started:</span> {new Date(session.started_at).toLocaleString()}</p>
                        <p><span className="font-medium">Submitted:</span> {session.submitted_at ? new Date(session.submitted_at).toLocaleString() : 'Not submitted'}</p>
                        <p><span className="font-medium">Status:</span> {session.status}</p>
                        <p><span className="font-medium">Recording:</span> {session.recording_url ? 'Available' : 'Not available'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SessionReview;
