import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle } from "lucide-react";

const CandidateRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!consentGiven) {
      toast.error("You must consent to recording and academic integrity rules to continue");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("full-name") as string;
    const email = formData.get("email") as string;
    const contact = formData.get("contact") as string;
    const gender = formData.get("gender") as string;

    // Get first active exam
    const { data: exams, error: examError } = await supabase
      .from("exams")
      .select("id")
      .eq("is_active", true)
      .limit(1);

    if (examError || !exams || exams.length === 0) {
      toast.error("No active exams available at this time");
      setLoading(false);
      return;
    }

    const { data: session, error } = await supabase
      .from("candidate_sessions")
      .insert({
        exam_id: exams[0].id,
        full_name: fullName,
        email: email,
        contact: contact,
        gender: gender,
        exam_location: location,
        custom_location: location === "other" ? customLocation : null,
        consent_given: consentGiven,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Registration error:", error);
      toast.error(`Failed to register for exam: ${error.message || "Please try again."}`);
      return;
    }

    toast.success("Registration successful! Redirecting to exam setup...");
    
    // Update session to mark recording as required
    await supabase
      .from("candidate_sessions")
      .update({ recording_required: true })
      .eq("id", session.id);
    
    navigate(`/candidate/exam/${session.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle px-6 py-12">
      <div className="container mx-auto max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-secondary">
              <Shield className="h-8 w-8 text-secondary-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold">Candidate Registration</CardTitle>
            <CardDescription>
              Complete your registration to begin your supervised examination
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Personal Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name *</Label>
                  <Input
                    id="full-name"
                    name="full-name"
                    type="text"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Number *</Label>
                  <Input
                    id="contact"
                    name="contact"
                    type="tel"
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender Identification</Label>
                  <RadioGroup name="gender" defaultValue="prefer-not-to-say">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male" className="font-normal">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female" className="font-normal">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="font-normal">Other</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="prefer-not-to-say" id="prefer-not-to-say" />
                      <Label htmlFor="prefer-not-to-say" className="font-normal">Prefer not to say</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Exam Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Exam Location</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="location">Where are you taking this exam? *</Label>
                  <Select value={location} onValueChange={setLocation} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="school">School</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="workplace">Workplace</SelectItem>
                      <SelectItem value="other">Other Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {location === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-location">Specify Location</Label>
                    <Input
                      id="custom-location"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Enter your location"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Consent and Rules */}
              <div className="space-y-4 rounded-lg border-2 border-warning bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-warning" />
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold text-foreground">Important: Recording and Academic Integrity</p>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      <li>Your screen, webcam, and audio will be continuously recorded</li>
                      <li>Tab switches and copy-paste actions will be logged</li>
                      <li>Violations of academic integrity rules will result in disqualification</li>
                      <li>All recordings are reviewed for suspicious activities</li>
                      <li>You must complete all sections within the allotted time</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                  />
                  <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
                    I have read and understood the rules above. I consent to being recorded and agree to maintain 
                    academic integrity throughout the examination. *
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !consentGiven}
                size="lg"
              >
                {loading ? "Setting up exam..." : "Continue to Permissions Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateRegister;
