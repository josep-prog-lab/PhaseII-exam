import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import VideoRecorder from "@/components/VideoRecorder";
import { Clock, Save, CheckCircle, AlertTriangle, Monitor, Camera, Mic } from "lucide-react";

interface ExamSection {
  id: string;
  section_type: 'mcq' | 'theoretical' | 'practical';
  title: string;
  timer_minutes: number;
  section_order: number;
  questions: ExamQuestion[];
}

interface ExamQuestion {
  id: string;
  question_text: string;
  question_order: number;
  options?: string[];
  correct_answer?: string;
  points: number;
}

interface CandidateAnswer {
  question_id: string;
  answer_text?: string;
  selected_option?: string;
  code_submission?: any;
}

const CandidateExam = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [sections, setSections] = useState<ExamSection[]>([]);
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, CandidateAnswer>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingChecksum, setRecordingChecksum] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [recordingRequired, setRecordingRequired] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    camera: false,
    microphone: false,
    screen: false
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadExamData();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (sections.length > 0 && currentSection < sections.length) {
      startSectionTimer();
    }
  }, [currentSection, sections]);

  useEffect(() => {
    // Auto-save answers every 30 seconds
    autoSaveIntervalRef.current = setInterval(() => {
      saveAnswers();
    }, 30000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [answers]);

  const loadExamData = async () => {
    try {
      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from("candidate_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);
      setRecordingRequired(sessionData.recording_required || true);

      // Load exam
      const { data: examData, error: examError } = await supabase
        .from("exams")
        .select("*")
        .eq("id", sessionData.exam_id)
        .single();

      if (examError) throw examError;
      setExam(examData);

      // Load sections and questions
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("exam_sections")
        .select(`
          *,
          exam_questions(*)
        `)
        .eq("exam_id", examData.id)
        .order("section_order");

      if (sectionsError) throw sectionsError;

      const formattedSections = sectionsData.map(section => ({
        ...section,
        questions: section.exam_questions.map((q: any) => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : undefined
        }))
      }));

      setSections(formattedSections);

      // Load existing answers
      const { data: answersData } = await supabase
        .from("candidate_answers")
        .select("*")
        .eq("session_id", sessionId);

      if (answersData) {
        const answersMap: Record<string, CandidateAnswer> = {};
        answersData.forEach(answer => {
          answersMap[answer.question_id] = {
            question_id: answer.question_id,
            answer_text: answer.answer_text,
            selected_option: answer.selected_option,
            code_submission: answer.code_submission
          };
        });
        setAnswers(answersMap);
      }

    } catch (error) {
      console.error("Error loading exam data:", error);
      toast.error("Failed to load exam. Please try again.");
      navigate("/candidate/register");
    } finally {
      setLoading(false);
    }
  };

  const startSectionTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    const section = sections[currentSection];
    setTimeRemaining(section.timer_minutes * 60);

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSectionTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSectionTimeout = () => {
    toast.warning(`Time's up for ${sections[currentSection].title}! Moving to next section.`);
    nextSection();
  };

  const nextSection = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(prev => prev + 1);
    } else {
      // All sections completed
      setShowSubmitDialog(true);
    }
  };

  const saveAnswers = async () => {
    if (!sessionId) return;

    try {
      const answersToSave = Object.values(answers).filter(answer => 
        answer.answer_text || answer.selected_option || answer.code_submission
      );

      for (const answer of answersToSave) {
        const { error } = await supabase
          .from("candidate_answers")
          .upsert({
            session_id: sessionId,
            question_id: answer.question_id,
            answer_text: answer.answer_text,
            selected_option: answer.selected_option,
            code_submission: answer.code_submission,
            is_auto_saved: true
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  const updateAnswer = (questionId: string, field: keyof CandidateAnswer, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        [field]: value
      }
    }));
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setExamStarted(true);
    
    // Update session to mark recording as started
    if (sessionId) {
      supabase
        .from("candidate_sessions")
        .update({ recording_started_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    
    toast.success("Recording started - Exam monitoring is now active");
  };

  const handleRecordingStop = async (blob: Blob, checksum: string) => {
    setRecordingBlob(blob);
    setRecordingChecksum(checksum);
    setIsRecording(false);
    toast.success("Recording completed and saved");
    
    // The VideoRecorder component now handles upload automatically
    // We just need to update the UI state
  };

  const requestPermissions = async () => {
    try {
      console.log("Starting permission request process...");
      setShowPermissionDialog(true);
      
      // Step 1: Request camera and microphone permissions
      console.log("Requesting camera and microphone permissions...");
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setPermissionStatus(prev => ({
        ...prev,
        camera: true,
        microphone: true
      }));
      
      console.log("Camera and microphone permissions granted");
      toast.success("Camera and microphone permissions granted!");
      
      // Step 2: Request screen sharing permission (mandatory)
      console.log("Requesting screen sharing permission...");
      try {
        const displayMediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'monitor',
            cursor: 'always'
          },
          audio: true
        });
        
        // Check if user selected entire screen (not a window or tab)
        const videoTrack = displayMediaStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        // Stop this test stream - VideoRecorder will request again when starting
        displayMediaStream.getTracks().forEach(track => track.stop());
        
        if (settings.displaySurface !== 'monitor') {
          toast.error("You must share your ENTIRE SCREEN, not just a window or tab.");
          throw new Error("Entire screen sharing is mandatory");
        }
        
        setPermissionStatus(prev => ({
          ...prev,
          screen: true
        }));
        
        console.log("Screen sharing permission granted");
        toast.success("Screen sharing permission granted!");
        
      } catch (screenError) {
        console.error("Screen sharing permission failed:", screenError);
        userMediaStream.getTracks().forEach(track => track.stop());
        toast.error("Screen sharing is mandatory. You must share your entire screen to take the exam.");
        throw new Error("Screen sharing permission denied");
      }
      
      // Stop the user media stream - VideoRecorder will request fresh streams
      userMediaStream.getTracks().forEach(track => track.stop());
      
      // All permissions granted, start the exam
      console.log("All permissions granted, starting exam...");
      setExamStarted(true);
      setShowPermissionDialog(false);
      
      toast.success("All permissions granted! Starting exam...");
      
    } catch (error) {
      console.error("Permission request failed:", error);
      toast.error(`Failed to get required permissions: ${error instanceof Error ? error.message : 'Unknown error'}. All permissions are mandatory to proceed.`);
      
      // Reset permission status on failure
      setPermissionStatus({
        camera: false,
        microphone: false,
        screen: false
      });
      setShowPermissionDialog(false);
    }
  };

  const submitExam = async () => {
    setSubmitting(true);
    
    try {
      console.log("Starting exam submission...");
      
      // Save final answers
      await saveAnswers();
      console.log("Answers saved successfully");

      // Update session status with better error handling
      const { error: sessionError } = await supabase
        .from("candidate_sessions")
        .update({
          status: 'completed',
          submitted_at: new Date().toISOString()
          // Do not overwrite recording_url here; VideoRecorder already saved the storage path
        })
        .eq("id", sessionId);

      if (sessionError) {
        console.error("Session update error:", sessionError);
        throw new Error(`Failed to update session: ${sessionError.message}`);
      }

      console.log("Session updated successfully");
      toast.success("Exam submitted successfully!");
      navigate("/candidate/exam-complete");
    } catch (error) {
      console.error("Error submitting exam:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit exam';
      toast.error(`Failed to submit exam: ${errorMessage}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getSectionTypeColor = (type: string) => {
    switch (type) {
      case "mcq": return "bg-blue-100 text-blue-800";
      case "theoretical": return "bg-green-100 text-green-800";
      case "practical": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!session || !exam || sections.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Exam Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The exam session could not be loaded. Please contact support.
            </p>
            <Button onClick={() => navigate("/candidate/register")}>
              Return to Registration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show permission dialog if recording is required but not started
  if (recordingRequired && !examStarted) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
              <Camera className="h-8 w-8 text-warning" />
            </div>
            <CardTitle className="text-2xl font-bold">Exam Monitoring Required</CardTitle>
            <CardDescription className="text-lg">
              To ensure exam integrity, you must enable camera and microphone. Screen sharing will be requested when the exam begins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Camera className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="font-semibold text-blue-900">Camera Access</h4>
                  <p className="text-sm text-blue-700">Your webcam will be recorded for supervision</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Mic className="h-5 w-5 text-green-600" />
                <div>
                  <h4 className="font-semibold text-green-900">Microphone Access</h4>
                  <p className="text-sm text-green-700">Audio will be recorded for monitoring</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Monitor className="h-5 w-5 text-purple-600" />
                <div>
                  <h4 className="font-semibold text-purple-900">Screen Sharing</h4>
                  <p className="text-sm text-purple-700">Will be requested when recording starts</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-warning-foreground">
                <strong>Important:</strong> Recording is mandatory for this exam. You cannot proceed without enabling all permissions.
              </p>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={requestPermissions} 
                size="lg"
                className="w-full"
              >
                Enable Monitoring & Start Exam
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSectionData = sections[currentSection];
  const progress = ((currentSection + 1) / sections.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{exam.title}</h1>
              <p className="text-sm text-muted-foreground">
                Section {currentSection + 1} of {sections.length}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={getSectionTypeColor(currentSectionData.section_type)}>
                {currentSectionData.section_type.toUpperCase()}
              </Badge>
              <div className="text-right">
                <div className="flex items-center gap-2 text-lg font-mono">
                  <Clock className="h-5 w-5" />
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentSectionData.timer_minutes} minutes
                </div>
              </div>
            </div>
          </div>
          <Progress value={progress} className="mt-2" />
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Video Recording - Always visible with prominent camera preview */}
          <div className="lg:col-span-1 space-y-4">
            <VideoRecorder
              sessionId={sessionId!}
              candidateName={(session?.full_name as string) || "Candidate"}
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              autoStart={recordingRequired}
              mandatory={recordingRequired}
            />
            
            {/* Permanent reminder that recording is active */}
            {isRecording && (
              <Card className="border-red-500">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-sm font-semibold">Your exam is being monitored</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Camera, microphone, and screen are recording
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Exam Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {currentSectionData.title}
                  <Badge className={getSectionTypeColor(currentSectionData.section_type)}>
                    {currentSectionData.questions.length} questions
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {currentSectionData.section_type === 'mcq' && "Select the best answer for each question."}
                  {currentSectionData.section_type === 'theoretical' && "Provide detailed written answers."}
                  {currentSectionData.section_type === 'practical' && "Write code to solve the given problems."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentSectionData.questions.map((question, index) => (
                  <Card key={question.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        Question {index + 1} ({question.points} point{question.points !== 1 ? 's' : ''})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-foreground">{question.question_text}</p>

                      {currentSectionData.section_type === 'mcq' && question.options && (
                        <RadioGroup
                          value={answers[question.id]?.selected_option || ""}
                          onValueChange={(value) => updateAnswer(question.id, "selected_option", value)}
                        >
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center space-x-2">
                              <RadioGroupItem 
                                value={String.fromCharCode(65 + optionIndex)} 
                                id={`${question.id}-${optionIndex}`} 
                              />
                              <Label htmlFor={`${question.id}-${optionIndex}`} className="flex-1">
                                {String.fromCharCode(65 + optionIndex)}. {option}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}

                      {(currentSectionData.section_type === 'theoretical' || currentSectionData.section_type === 'practical') && (
                        <div className="space-y-2">
                          <Label htmlFor={`answer-${question.id}`}>
                            {currentSectionData.section_type === 'theoretical' ? 'Your Answer' : 'Your Code'}
                          </Label>
                          <Textarea
                            id={`answer-${question.id}`}
                            value={answers[question.id]?.answer_text || ""}
                            onChange={(e) => updateAnswer(question.id, "answer_text", e.target.value)}
                            placeholder={
                              currentSectionData.section_type === 'theoretical' 
                                ? "Type your answer here..." 
                                : "Write your code here..."
                            }
                            rows={currentSectionData.section_type === 'practical' ? 10 : 5}
                            className="font-mono"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => saveAnswers()}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Progress
                  </Button>

                  <div className="flex gap-2">
                    {currentSection < sections.length - 1 ? (
                      <Button onClick={nextSection}>
                        Next Section
                      </Button>
                    ) : (
                      <Button onClick={() => setShowSubmitDialog(true)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Submit Exam
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your exam? This action cannot be undone. 
              Make sure you have answered all questions to the best of your ability.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction onClick={submitExam} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Exam"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permission Request Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Requesting Permissions
            </DialogTitle>
            <DialogDescription>
              Please allow the following permissions to start your exam:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Camera className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900">Camera Access</h4>
                <p className="text-sm text-blue-700">Allow camera for supervision</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${permissionStatus.camera ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Mic className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-900">Microphone Access</h4>
                <p className="text-sm text-green-700">Allow microphone for monitoring</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${permissionStatus.microphone ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <Monitor className="h-5 w-5 text-purple-600" />
              <div className="flex-1">
                <h4 className="font-semibold text-purple-900">Screen Sharing</h4>
                <p className="text-sm text-purple-700">Allow screen sharing for supervision</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${permissionStatus.screen ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> You will be prompted by your browser to allow these permissions. 
                Please click "Allow" for each request to continue with the exam.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateExam;

