import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Clock, Eye, FileCheck, Lock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-exam-space.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90"></div>
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${heroImage})` }}
        ></div>
        
        <div className="container relative mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <h1 className="mb-6 text-5xl font-bold text-primary-foreground md:text-6xl lg:text-7xl">
              Exam Space
            </h1>
            <p className="mb-8 text-xl text-primary-foreground/90 md:text-2xl">
              Secure, Supervised, and Structured Online Examinations
            </p>
            <p className="mb-10 text-lg text-primary-foreground/80">
              A comprehensive platform designed to ensure exam integrity through continuous monitoring, 
              anti-cheating measures, and a guided candidate workflow.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/admin/auth">
                <Button variant="hero" size="lg">
                  Admin Portal
                </Button>
              </Link>
              <Link to="/candidate/register">
                <Button variant="secondary" size="lg">
                  Take an Exam
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-foreground">
            Why Choose Exam Space?
          </h2>
          <p className="text-lg text-muted-foreground">
            Built for integrity, designed for fairness
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card className="transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Shield className="mb-4 h-12 w-12 text-primary" />
              <CardTitle>Complete Security</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Continuous recording of screen, audio, and webcam ensures every action is monitored and auditable.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Clock className="mb-4 h-12 w-12 text-secondary" />
              <CardTitle>Timed Sections</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Independent timers for MCQs (30-45min), Theoretical (45-60min), and Practical (60-90min) sections.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Eye className="mb-4 h-12 w-12 text-primary" />
              <CardTitle>Anti-Cheating</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Tab switches, window changes, and copy-paste attempts are logged and flagged automatically.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <FileCheck className="mb-4 h-12 w-12 text-success" />
              <CardTitle>Direct Answers</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                All answers submitted directly on the platform. No external links or file uploads allowed.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Lock className="mb-4 h-12 w-12 text-destructive" />
              <CardTitle>Exam Rotation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Exams rotate every 2 hours to prevent content sharing and maintain assessment integrity.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <Users className="mb-4 h-12 w-12 text-secondary" />
              <CardTitle>Admin Control</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Complete exam lifecycle management with monitoring dashboard and post-exam review tools.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-muted py-20">
        <div className="container mx-auto px-6">
          <h2 className="mb-12 text-center text-4xl font-bold text-foreground">
            How It Works
          </h2>
          
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                1
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Registration & Consent</h3>
                <p className="text-muted-foreground">
                  Candidates provide their details and consent to recording and academic integrity rules.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-bold text-secondary-foreground">
                2
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Permissions Setup</h3>
                <p className="text-muted-foreground">
                  Enable camera, microphone, and screen sharing to begin supervised examination.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                3
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Three-Section Exam</h3>
                <p className="text-muted-foreground">
                  Complete MCQs, theoretical questions, and choose one practical coding task with independent timers.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-xl font-bold text-success-foreground">
                4
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Submission & Review</h3>
                <p className="text-muted-foreground">
                  Submit your exam and recordings are saved securely for admin review and grading.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-muted-foreground">
            © 2025 Exam Space. Ensuring integrity in digital assessments.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
