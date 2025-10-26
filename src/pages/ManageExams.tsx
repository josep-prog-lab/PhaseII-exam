import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Edit, Eye, Trash2, Users, Clock, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Exam {
  id: string;
  title: string;
  description: string | null;
  rotation_slot: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sections_count?: number;
  questions_count?: number;
  sessions_count?: number;
}

const ManageExams = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select(`
          *,
          exam_sections(count),
          candidate_sessions(count)
        `)
        .order("created_at", { ascending: false });

      if (examsError) throw examsError;

      // Get detailed counts
      const examsWithCounts = await Promise.all(
        examsData.map(async (exam) => {
          const { count: sectionsCount } = await supabase
            .from("exam_sections")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id);

          const { count: questionsCount } = await supabase
            .from("exam_questions")
            .select("*", { count: "exact", head: true })
            .in("section_id", 
              (await supabase.from("exam_sections").select("id").eq("exam_id", exam.id)).data?.map(s => s.id) || []
            );

          const { count: sessionsCount } = await supabase
            .from("candidate_sessions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id);

          return {
            ...exam,
            sections_count: sectionsCount || 0,
            questions_count: questionsCount || 0,
            sessions_count: sessionsCount || 0
          };
        })
      );

      setExams(examsWithCounts);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  const toggleExamStatus = async (examId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("exams")
        .update({ is_active: !currentStatus })
        .eq("id", examId);

      if (error) throw error;

      setExams(prev => prev.map(exam => 
        exam.id === examId ? { ...exam, is_active: !currentStatus } : exam
      ));

      toast.success(`Exam ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error("Error updating exam status:", error);
      toast.error("Failed to update exam status");
    }
  };

  const deleteExam = async (examId: string) => {
    try {
      const { error } = await supabase
        .from("exams")
        .delete()
        .eq("id", examId);

      if (error) throw error;

      setExams(prev => prev.filter(exam => exam.id !== examId));
      toast.success("Exam deleted successfully");
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    }
  };

  const getRotationTime = (slot: number) => {
    const startHour = (slot - 1) * 2;
    const endHour = startHour + 2;
    return `${startHour.toString().padStart(2, '0')}:00-${endHour.toString().padStart(2, '0')}:00`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading exams...</p>
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
            <h1 className="text-2xl font-bold text-foreground">Manage Exams</h1>
          </div>
          <Button onClick={() => navigate("/admin/create-exam")}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Exam
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {exams.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No exams created yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first exam to get started with the platform.
              </p>
              <Button onClick={() => navigate("/admin/create-exam")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Exam
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Exams</p>
                      <p className="text-2xl font-bold">{exams.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="h-3 w-3 bg-green-600 rounded-full"></div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Active Exams</p>
                      <p className="text-2xl font-bold">{exams.filter(e => e.is_active).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                      <p className="text-2xl font-bold">{exams.reduce((sum, exam) => sum + exam.sessions_count, 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Questions</p>
                      <p className="text-2xl font-bold">{exams.reduce((sum, exam) => sum + exam.questions_count, 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Exams Table */}
            <Card>
              <CardHeader>
                <CardTitle>All Exams</CardTitle>
                <CardDescription>
                  Manage your exams, view statistics, and control exam availability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rotation Slot</TableHead>
                      <TableHead>Sections</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{exam.title}</p>
                            {exam.description && (
                              <p className="text-sm text-muted-foreground truncate max-w-xs">
                                {exam.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={exam.is_active ? "default" : "secondary"}>
                            {exam.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">Slot {exam.rotation_slot}</p>
                            <p className="text-muted-foreground">{getRotationTime(exam.rotation_slot)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{exam.sections_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{exam.questions_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{exam.sessions_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(exam.created_at).toLocaleDateString()}</p>
                            <p className="text-muted-foreground">
                              {new Date(exam.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExamStatus(exam.id, exam.is_active)}
                            >
                              {exam.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/exam/${exam.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/exam/${exam.id}/sessions`)}
                              title="View Sessions"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Exam</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{exam.title}"? This action cannot be undone and will also delete all associated sections, questions, and candidate sessions.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteExam(exam.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default ManageExams;
