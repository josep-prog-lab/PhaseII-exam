import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Save, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

const CreateExam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [rotationSlot, setRotationSlot] = useState(1);
  const [sections, setSections] = useState<ExamSection[]>([
    {
      id: "1",
      section_type: "mcq",
      title: "Multiple Choice Questions",
      timer_minutes: 30,
      section_order: 1,
      questions: []
    },
    {
      id: "2", 
      section_type: "theoretical",
      title: "Theoretical Questions",
      timer_minutes: 45,
      section_order: 2,
      questions: []
    },
    {
      id: "3",
      section_type: "practical", 
      title: "Practical Coding",
      timer_minutes: 60,
      section_order: 3,
      questions: []
    }
  ]);

  const addQuestion = (sectionId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const newQuestion: ExamQuestion = {
          id: Date.now().toString(),
          question_text: "",
          question_order: section.questions.length + 1,
          options: section.section_type === "mcq" ? ["", "", "", ""] : undefined,
          correct_answer: "",
          points: 1
        };
        return {
          ...section,
          questions: [...section.questions, newQuestion]
        };
      }
      return section;
    }));
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          questions: section.questions.filter(q => q.id !== questionId)
        };
      }
      return section;
    }));
  };

  const updateQuestion = (sectionId: string, questionId: string, field: keyof ExamQuestion, value: any) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          questions: section.questions.map(q => 
            q.id === questionId ? { ...q, [field]: value } : q
          )
        };
      }
      return section;
    }));
  };

  const updateSection = (sectionId: string, field: keyof ExamSection, value: any) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, [field]: value } : section
    ));
  };

  const handleSaveExam = async () => {
    if (!examTitle.trim()) {
      toast.error("Please enter an exam title");
      return;
    }

    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
    if (totalQuestions === 0) {
      toast.error("Please add at least one question to the exam");
      return;
    }

    // Validate questions
    for (const section of sections) {
      for (const question of section.questions) {
        if (!question.question_text.trim()) {
          toast.error(`Please fill in all question texts in ${section.title}`);
          return;
        }
        if (section.section_type === "mcq" && (!question.options || question.options.some(opt => !opt.trim()))) {
          toast.error(`Please fill in all MCQ options in ${section.title}`);
          return;
        }
        if (section.section_type === "mcq" && !question.correct_answer) {
          toast.error(`Please select correct answers for MCQ questions in ${section.title}`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      // Create exam
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert({
          title: examTitle,
          description: examDescription,
          rotation_slot: rotationSlot,
          is_active: true,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (examError) throw examError;

      // Create sections
      for (const section of sections) {
        const { data: examSection, error: sectionError } = await supabase
          .from("exam_sections")
          .insert({
            exam_id: exam.id,
            section_type: section.section_type,
            section_order: section.section_order,
            title: section.title,
            timer_minutes: section.timer_minutes
          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        // Create questions
        for (const question of section.questions) {
          const { error: questionError } = await supabase
            .from("exam_questions")
            .insert({
              section_id: examSection.id,
              question_text: question.question_text,
              question_order: question.question_order,
              options: question.options ? JSON.stringify(question.options) : null,
              correct_answer: question.correct_answer,
              points: question.points
            });

          if (questionError) throw questionError;
        }
      }

      toast.success("Exam created successfully!");
      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSectionTypeColor = (type: string) => {
    switch (type) {
      case "mcq": return "bg-blue-100 text-blue-800";
      case "theoretical": return "bg-green-100 text-green-800";
      case "practical": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

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
            <h1 className="text-2xl font-bold text-foreground">Create New Exam</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button onClick={handleSaveExam} disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Saving..." : "Save Exam"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Exam Details */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Exam Details</CardTitle>
                <CardDescription>Basic information about the exam</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title *</Label>
                  <Input
                    id="title"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Enter exam title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={examDescription}
                    onChange={(e) => setExamDescription(e.target.value)}
                    placeholder="Enter exam description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rotation">Rotation Slot</Label>
                  <Select value={rotationSlot.toString()} onValueChange={(value) => setRotationSlot(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Slot 1 (00:00-02:00)</SelectItem>
                      <SelectItem value="2">Slot 2 (02:00-04:00)</SelectItem>
                      <SelectItem value="3">Slot 3 (04:00-06:00)</SelectItem>
                      <SelectItem value="4">Slot 4 (06:00-08:00)</SelectItem>
                      <SelectItem value="5">Slot 5 (08:00-10:00)</SelectItem>
                      <SelectItem value="6">Slot 6 (10:00-12:00)</SelectItem>
                      <SelectItem value="7">Slot 7 (12:00-14:00)</SelectItem>
                      <SelectItem value="8">Slot 8 (14:00-16:00)</SelectItem>
                      <SelectItem value="9">Slot 9 (16:00-18:00)</SelectItem>
                      <SelectItem value="10">Slot 10 (18:00-20:00)</SelectItem>
                      <SelectItem value="11">Slot 11 (20:00-22:00)</SelectItem>
                      <SelectItem value="12">Slot 12 (22:00-00:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Total Questions:</strong> {sections.reduce((sum, section) => sum + section.questions.length, 0)}</p>
                    <p><strong>Total Time:</strong> {sections.reduce((sum, section) => sum + section.timer_minutes, 0)} minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exam Sections */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="mcq" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                {sections.map((section) => (
                  <TabsTrigger key={section.id} value={section.section_type}>
                    <Badge className={`mr-2 ${getSectionTypeColor(section.section_type)}`}>
                      {section.questions.length}
                    </Badge>
                    {section.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {sections.map((section) => (
                <TabsContent key={section.id} value={section.section_type} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {section.title}
                            <Badge className={getSectionTypeColor(section.section_type)}>
                              {section.section_type.toUpperCase()}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {section.questions.length} questions • {section.timer_minutes} minutes
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addQuestion(section.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Question
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Section Settings */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor={`section-title-${section.id}`}>Section Title</Label>
                          <Input
                            id={`section-title-${section.id}`}
                            value={section.title}
                            onChange={(e) => updateSection(section.id, "title", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`timer-${section.id}`}>Timer (minutes)</Label>
                          <Input
                            id={`timer-${section.id}`}
                            type="number"
                            min="1"
                            max="180"
                            value={section.timer_minutes}
                            onChange={(e) => updateSection(section.id, "timer_minutes", parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Questions */}
                      {section.questions.map((question, index) => (
                        <Card key={question.id} className="border-l-4 border-l-primary">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">Question {index + 1}</h4>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this question? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => removeQuestion(section.id, question.id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>Question Text *</Label>
                              <Textarea
                                value={question.question_text}
                                onChange={(e) => updateQuestion(section.id, question.id, "question_text", e.target.value)}
                                placeholder="Enter your question here..."
                                rows={3}
                              />
                            </div>

                            {section.section_type === "mcq" && (
                              <div className="space-y-3">
                                <Label>Answer Options *</Label>
                                {question.options?.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center gap-2">
                                    <Input
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...(question.options || [])];
                                        newOptions[optionIndex] = e.target.value;
                                        updateQuestion(section.id, question.id, "options", newOptions);
                                      }}
                                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                                    />
                                    <input
                                      type="radio"
                                      name={`correct-${question.id}`}
                                      checked={question.correct_answer === String.fromCharCode(65 + optionIndex)}
                                      onChange={() => updateQuestion(section.id, question.id, "correct_answer", String.fromCharCode(65 + optionIndex))}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-4">
                              <div className="space-y-2">
                                <Label>Points</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={question.points}
                                  onChange={(e) => updateQuestion(section.id, question.id, "points", parseInt(e.target.value))}
                                  className="w-20"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {section.questions.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No questions added yet.</p>
                          <p className="text-sm">Click "Add Question" to get started.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateExam;

