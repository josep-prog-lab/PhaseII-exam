import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Home, FileText, Clock } from "lucide-react";

const CandidateExamComplete = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-green-600">Exam Submitted Successfully!</CardTitle>
          <CardDescription className="text-lg">
            Thank you for completing the examination. Your responses have been recorded and submitted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <FileText className="mx-auto h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-semibold text-blue-900">Answers Recorded</h3>
              <p className="text-sm text-blue-700">All your responses have been saved</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Clock className="mx-auto h-8 w-8 text-purple-600 mb-2" />
              <h3 className="font-semibold text-purple-900">Recording Complete</h3>
              <p className="text-sm text-purple-700">Session recording has been processed</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
              <h3 className="font-semibold text-green-900">Submission Confirmed</h3>
              <p className="text-sm text-green-700">Your exam has been submitted</p>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your exam responses will be reviewed by the examination team</li>
              <li>• The recording of your session will be analyzed for integrity</li>
              <li>• Results will be communicated through the official channels</li>
              <li>• You will receive notification once grading is complete</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => navigate("/")} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Return to Home
            </Button>
            <Button variant="outline" onClick={() => navigate("/candidate/register")}>
              Take Another Exam
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>If you have any questions about your exam submission, please contact the examination team.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidateExamComplete;

