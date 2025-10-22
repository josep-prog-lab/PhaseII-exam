import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, Plus, FileText, Users, BarChart } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }
      
      setUser(session.user);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate("/admin/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/admin/auth");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-foreground">Welcome back!</h2>
          <p className="text-muted-foreground">Manage your exams, monitor candidates, and review submissions.</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="cursor-pointer transition-all duration-300 hover:shadow-lg"
            onClick={() => navigate("/admin/create-exam")}
          >
            <CardHeader>
              <Plus className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Create Exam</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Set up a new examination with sections and questions</CardDescription>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all duration-300 hover:shadow-lg"
            onClick={() => navigate("/admin/manage-exams")}
          >
            <CardHeader>
              <FileText className="mb-2 h-8 w-8 text-secondary" />
              <CardTitle>Manage Exams</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>View and edit existing examinations</CardDescription>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all duration-300 hover:shadow-lg"
            onClick={() => navigate("/admin/submissions")}
          >
            <CardHeader>
              <Users className="mb-2 h-8 w-8 text-success" />
              <CardTitle>Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Review candidate submissions, answers, and recordings</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <BarChart className="mb-2 h-8 w-8 text-warning" />
              <CardTitle>View Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Access exam results and analytics</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest candidate sessions and submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">No recent activity to display</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
