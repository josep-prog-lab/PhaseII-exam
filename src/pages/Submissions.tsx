import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Eye, 
  Clock, 
  User, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Video, 
  Play, 
  Download,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  Timer,
  Users
} from "lucide-react";

interface ExamSession {
  id: string;
  full_name: string;
  email: string;
  contact: string;
  exam_location: string;
  custom_location: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  submitted_at: string | null;
  recording_url: string | null;
  recording_started_at: string | null;
  flags: any;
  exam: {
    title: string;
    rotation_slot: number;
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
      title: string;
    };
  };
}

const Submissions = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<AnswerData[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [previewSession, setPreviewSession] = useState<ExamSession | null>(null);

  useEffect(() => {
    loadAllSessions();
  }, []);

  const loadAllSessions = async () => {
    try {
      // Load all sessions from all exams
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("candidate_sessions")
        .select(`
          *,
          exam:exams(title, rotation_slot)
        `)
        .order("started_at", { ascending: false });

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);
    } catch (error) {
      console.error("Error loading sessions:", error);
      toast.error("Failed to load candidate sessions");
    } finally {
      setLoading(false);
    }
  };

  const loadSessionAnswers = async (sessionId: string) => {
    setAnswersLoading(true);
    try {
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
              section_type,
              title
            )
          )
        `)
        .eq("session_id", sessionId)
        .order("submitted_at");

      if (answersError) throw answersError;
      setSessionAnswers(answersData || []);
    } catch (error) {
      console.error("Error loading session answers:", error);
      toast.error("Failed to load session answers");
    } finally {
      setAnswersLoading(false);
    }
  };

  const handleViewAnswers = async (session: ExamSession) => {
    setSelectedSession(session);
    await loadSessionAnswers(session.id);
    
    // Handle video URL - recording_url now stores just the storage path
    if (session.recording_url) {
      try {
        const { data: videoData, error } = await supabase.storage
          .from('exam-recordings')
          .createSignedUrl(session.recording_url, 3600);
        
        if (error) {
          console.error('Error creating signed URL:', error);
          setVideoUrl(null);
        } else if (videoData?.signedUrl) {
          setVideoUrl(videoData.signedUrl);
        }
      } catch (error) {
        console.error('Error loading video URL:', error);
        setVideoUrl(null);
      }
    } else {
      setVideoUrl(null);
    }
  };

  const downloadRecording = async (session: ExamSession) => {
    if (!session.recording_url) {
      toast.error("No recording available for download");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('exam-recordings')
        .download(session.recording_url);

      if (error) {
        console.error('Download error:', error);
        throw error;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `exam-recording-${session.full_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Recording download started");
    } catch (error) {
      console.error("Error downloading recording:", error);
      toast.error("Failed to download recording. The file may not exist or you may not have permission to access it.");
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

  const groupAnswersBySection = (answers: AnswerData[]) => {
    const sections: { [key: string]: AnswerData[] } = {};
    answers.forEach(answer => {
      const sectionType = answer.question.section.section_type;
      if (!sections[sectionType]) {
        sections[sectionType] = [];
      }
      sections[sectionType].push(answer);
    });
    return sections;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Submissions</h1>
              <p className="text-sm text-muted-foreground">All candidate exam submissions and recordings</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No submissions found</h3>
              <p className="text-muted-foreground">
                No candidates have submitted exams yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-primary" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                      <p className="text-2xl font-bold">{sessions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                      <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'in_progress').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'completed').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Abandoned</p>
                      <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'abandoned').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Submissions Table */}
            <Card>
              <CardHeader>
                <CardTitle>Candidate Submissions</CardTitle>
                <CardDescription>
                  Review all candidate exam submissions, answers, and recordings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Candidate Details</TableHead>
                        <TableHead className="min-w-[120px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Location</TableHead>
                        <TableHead className="min-w-[100px]">Duration</TableHead>
                        <TableHead className="min-w-[120px]">Started</TableHead>
                        <TableHead className="min-w-[100px]">Flags</TableHead>
                        <TableHead className="min-w-[150px]">Questions & Answers</TableHead>
                        <TableHead className="min-w-[150px]">Video Recording</TableHead>
                        <TableHead className="min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id}>
                          {/* Candidate Details Column */}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <p className="font-medium">{session.full_name}</p>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {session.email}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {session.contact}
                              </div>
                            </div>
                          </TableCell>

                          {/* Status Column */}
                          <TableCell>
                            <Badge className={`${getStatusColor(session.status)} flex items-center gap-1 w-fit`}>
                              {getStatusIcon(session.status)}
                              {session.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </TableCell>

                          {/* Location Column */}
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-4 w-4" />
                              {getLocationDisplay(session.exam_location, session.custom_location)}
                            </div>
                          </TableCell>

                          {/* Duration Column */}
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm font-mono">
                              <Timer className="h-4 w-4" />
                              {formatDuration(session.started_at, session.submitted_at)}
                            </div>
                          </TableCell>

                          {/* Started Column */}
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(session.started_at).toLocaleDateString()}
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {new Date(session.started_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </TableCell>

                          {/* Flags Column */}
                          <TableCell>
                            {session.flags && Array.isArray(session.flags) && session.flags.length > 0 ? (
                              <Badge variant="destructive">
                                {session.flags.length} flag{session.flags.length !== 1 ? 's' : ''}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">No flags</Badge>
                            )}
                          </TableCell>

                          {/* Questions & Answers Column */}
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewAnswers(session)}
                                  className="w-full"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Answers
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Candidate Answers - {selectedSession?.full_name}</DialogTitle>
                                  <DialogDescription>
                                    Review all answers submitted by the candidate organized by sections
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {answersLoading ? (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <p className="ml-2 text-muted-foreground">Loading answers...</p>
                                  </div>
                                ) : (
                                  <Tabs defaultValue="overview" className="w-full">
                                    <TabsList className="grid w-full grid-cols-4">
                                      <TabsTrigger value="overview">Overview</TabsTrigger>
                                      <TabsTrigger value="mcq">MCQ Section</TabsTrigger>
                                      <TabsTrigger value="theoretical">Theoretical</TabsTrigger>
                                      <TabsTrigger value="practical">Practical</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="overview" className="space-y-4">
                                      <div className="grid gap-4 md:grid-cols-3">
                                        <Card>
                                          <CardContent className="p-4">
                                            <h3 className="font-semibold">Total Questions</h3>
                                            <p className="text-2xl font-bold">{sessionAnswers.length}</p>
                                          </CardContent>
                                        </Card>
                                        <Card>
                                          <CardContent className="p-4">
                                            <h3 className="font-semibold">MCQ Questions</h3>
                                            <p className="text-2xl font-bold">
                                              {sessionAnswers.filter(a => a.question.section.section_type === 'mcq').length}
                                            </p>
                                          </CardContent>
                                        </Card>
                                        <Card>
                                          <CardContent className="p-4">
                                            <h3 className="font-semibold">Written Questions</h3>
                                            <p className="text-2xl font-bold">
                                              {sessionAnswers.filter(a => a.question.section.section_type === 'theoretical').length}
                                            </p>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </TabsContent>

                                    {['mcq', 'theoretical', 'practical'].map(sectionType => (
                                      <TabsContent key={sectionType} value={sectionType} className="space-y-4">
                                        <h3 className="text-lg font-semibold capitalize">
                                          {sectionType} Section Questions
                                        </h3>
                                        {sessionAnswers
                                          .filter(answer => answer.question.section.section_type === sectionType)
                                          .map((answer, index) => (
                                            <Card key={answer.id}>
                                              <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                  <h4 className="font-medium">Question {index + 1}</h4>
                                                  <Badge variant="outline">{answer.question.points} points</Badge>
                                                </div>
                                                
                                                <p className="text-sm text-muted-foreground mb-4">
                                                  {answer.question.question_text}
                                                </p>

                                                {sectionType === 'mcq' && (
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

                                                {sectionType === 'theoretical' && (
                                                  <div>
                                                    <p className="text-sm font-medium mb-2">Answer:</p>
                                                    <p className="text-sm bg-muted p-2 rounded whitespace-pre-wrap">
                                                      {answer.answer_text || 'No answer provided'}
                                                    </p>
                                                  </div>
                                                )}

                                                {sectionType === 'practical' && answer.code_submission && (
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
                                              </CardContent>
                                            </Card>
                                          ))}
                                      </TabsContent>
                                    ))}
                                  </Tabs>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>

                          {/* Video Recording Column */}
                          <TableCell>
                            <div className="space-y-2">
                              {session.recording_url ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Video className="h-4 w-4 text-green-600" />
                                    <span className="text-sm text-green-600">Available</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        setPreviewSession(session);
                                        // Load video URL for preview
                                        try {
                                          const { data: videoData } = await supabase.storage
                                            .from('exam-recordings')
                                            .createSignedUrl(session.recording_url!, 3600);
                                          if (videoData?.signedUrl) {
                                            setVideoUrl(videoData.signedUrl);
                                            setShowVideoPreview(true);
                                          }
                                        } catch (error) {
                                          console.error('Error loading video:', error);
                                          toast.error('Failed to load video preview');
                                        }
                                      }}
                                      className="flex-1"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Preview
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => downloadRecording(session)}
                                      className="flex-1"
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download
                                    </Button>
                                  </div>
                                  {session.recording_started_at && (
                                    <p className="text-xs text-muted-foreground">
                                      Started: {new Date(session.recording_started_at).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Video className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">No recording</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Actions Column */}
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/admin/session/${session.id}/review`)}
                                title="Full Review"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Video Preview Dialog */}
      <Dialog open={showVideoPreview} onOpenChange={setShowVideoPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Recording Preview - {previewSession?.full_name}
            </DialogTitle>
            <DialogDescription>
              Preview the exam recording before downloading. This video includes screen capture with the candidate's webcam overlay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {videoUrl ? (
              <div className="relative">
                <video
                  controls
                  className="w-full rounded-lg border"
                  style={{ maxHeight: '70vh' }}
                  src={videoUrl}
                  preload="metadata"
                >
                  Your browser does not support video playback.
                </video>
                <div className="mt-4 flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowVideoPreview(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      if (previewSession) {
                        downloadRecording(previewSession);
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Recording
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading video...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Submissions;
