import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Newspaper, Building2, Star, GraduationCap, Sparkles, Users, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface OnboardingData {
  persona: string;
  industry: string;
  companyName: string;
  teamSize: string;
  goals: string[];
  targetAudience: string;
  contentFrequency: string;
}

const personas = [
  { id: "news_outlet", title: "News & Media", icon: Newspaper, description: "Publish news and journalism" },
  { id: "business", title: "Business", icon: Building2, description: "Marketing and brand content" },
  { id: "influencer", title: "Creator/Influencer", icon: Star, description: "Personal brand content" },
  { id: "educator", title: "Educator", icon: GraduationCap, description: "Educational content" },
  { id: "creator", title: "Storyteller", icon: Sparkles, description: "Fiction and creative content" },
  { id: "other", title: "Other", icon: Users, description: "Something else" },
];

const industries = [
  { value: "media", label: "Media & Entertainment" },
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "retail", label: "Retail & E-commerce" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "food", label: "Food & Beverage" },
  { value: "sports", label: "Sports" },
  { value: "real_estate", label: "Real Estate" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "government", label: "Government" },
  { value: "other", label: "Other" },
];

const teamSizes = [
  { value: "solo", label: "Just me" },
  { value: "small", label: "2-10 people" },
  { value: "medium", label: "11-50 people" },
  { value: "large", label: "51-200 people" },
  { value: "enterprise", label: "200+ people" },
];

const goals = [
  { id: "engagement", label: "Increase audience engagement" },
  { id: "retention", label: "Improve content retention" },
  { id: "monetization", label: "Monetize content" },
  { id: "brand", label: "Build brand awareness" },
  { id: "education", label: "Educate audience" },
  { id: "community", label: "Build community" },
  { id: "leads", label: "Generate leads" },
  { id: "entertainment", label: "Entertain audience" },
];

const contentFrequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "occasional", label: "Occasionally" },
];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [data, setData] = useState<OnboardingData>({
    persona: "",
    industry: "",
    companyName: "",
    teamSize: "",
    goals: [],
    targetAudience: "",
    contentFrequency: "",
  });

  const totalSteps = 4;

  const [saveError, setSaveError] = useState<string | null>(null);
  
  const saveOnboarding = useMutation({
    mutationFn: async (onboardingData: OnboardingData) => {
      const response = await fetch("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...onboardingData,
          goals: onboardingData.goals,
          onboardingCompleted: true,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save onboarding");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      setSaveError(null);
      onComplete();
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    },
  });

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      saveOnboarding.mutate(data);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!data.persona;
      case 2:
        return !!data.industry;
      case 3:
        return data.goals.length > 0;
      case 4:
        return !!data.contentFrequency;
      default:
        return true;
    }
  };

  const toggleGoal = (goalId: string) => {
    setData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter((g) => g !== goalId)
        : [...prev.goals, goalId],
    }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Step {step} of {totalSteps}</span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    What brings you to NextScene?
                  </h1>
                  <p className="text-muted-foreground">
                    Help us personalize your experience
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {personas.map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => setData({ ...data, persona: persona.id })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        data.persona === persona.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`button-persona-${persona.id}`}
                    >
                      <persona.icon className={`w-6 h-6 mb-2 ${data.persona === persona.id ? "text-primary" : ""}`} />
                      <p className="font-bold text-sm">{persona.title}</p>
                      <p className="text-xs text-muted-foreground">{persona.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    Tell us about your organization
                  </h1>
                  <p className="text-muted-foreground">
                    This helps us recommend the right features
                  </p>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={data.industry} onValueChange={(v) => setData({ ...data, industry: v })}>
                      <SelectTrigger data-testid="select-industry">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => (
                          <SelectItem key={ind.value} value={ind.value}>
                            {ind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company / Brand Name (optional)</Label>
                    <Input
                      id="companyName"
                      value={data.companyName}
                      onChange={(e) => setData({ ...data, companyName: e.target.value })}
                      placeholder="Enter your company name"
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamSize">Team Size</Label>
                    <Select value={data.teamSize} onValueChange={(v) => setData({ ...data, teamSize: v })}>
                      <SelectTrigger data-testid="select-team-size">
                        <SelectValue placeholder="Select team size" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamSizes.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    What are your main goals?
                  </h1>
                  <p className="text-muted-foreground">
                    Select all that apply
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                  {goals.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        data.goals.includes(goal.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`button-goal-${goal.id}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        data.goals.includes(goal.id) ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {data.goals.includes(goal.id) && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{goal.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    How often will you create content?
                  </h1>
                  <p className="text-muted-foreground">
                    This helps us optimize your dashboard
                  </p>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="space-y-2">
                    <Label>Content Frequency</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {contentFrequencies.map((freq) => (
                        <button
                          key={freq.value}
                          onClick={() => setData({ ...data, contentFrequency: freq.value })}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            data.contentFrequency === freq.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                          data-testid={`button-frequency-${freq.value}`}
                        >
                          <span className="font-medium">{freq.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetAudience">Target Audience (optional)</Label>
                    <Input
                      id="targetAudience"
                      value={data.targetAudience}
                      onChange={(e) => setData({ ...data, targetAudience: e.target.value })}
                      placeholder="e.g., Young professionals, Students, Parents"
                      data-testid="input-target-audience"
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {saveError && (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-center text-destructive" data-testid="text-save-error">
            {saveError}
          </div>
        )}

        <div className="flex justify-between mt-12">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || saveOnboarding.isPending}
            className="gap-2"
            data-testid="button-next"
          >
            {step === totalSteps ? (saveOnboarding.isPending ? "Saving..." : "Get Started") : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
