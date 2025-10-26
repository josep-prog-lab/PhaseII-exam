import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PWAInstaller from "./components/PWAInstaller";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminAuth from "./pages/AdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import CreateExam from "./pages/CreateExam";
import EditExam from "./pages/EditExam";
import ManageExams from "./pages/ManageExams";
import ExamSessions from "./pages/ExamSessions";
import Submissions from "./pages/Submissions";
import CandidateRegister from "./pages/CandidateRegister";
import CandidateExam from "./pages/CandidateExam";
import CandidateExamComplete from "./pages/CandidateExamComplete";
import SessionReview from "./pages/SessionReview";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstaller />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin/auth" element={<AdminAuth />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/create-exam" element={<CreateExam />} />
          <Route path="/admin/exam/:examId/edit" element={<EditExam />} />
          <Route path="/admin/manage-exams" element={<ManageExams />} />
          <Route path="/admin/exam/:examId/sessions" element={<ExamSessions />} />
          <Route path="/admin/submissions" element={<Submissions />} />
          <Route path="/admin/session/:sessionId/review" element={<SessionReview />} />
          <Route path="/candidate/register" element={<CandidateRegister />} />
          <Route path="/candidate/exam/:sessionId" element={<CandidateExam />} />
          <Route path="/candidate/exam-complete" element={<CandidateExamComplete />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
