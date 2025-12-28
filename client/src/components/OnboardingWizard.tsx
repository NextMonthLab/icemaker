import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Building2, Film, GraduationCap, Globe, FileText, Clapperboard, Upload, Wand2, MessageCircle, Shield, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Lens = 'brand' | 'creator' | 'knowledge';

interface OnboardingData {
  lens: Lens | '';
  companyName: string;
  primaryGoal: string;
  contentType: string;
}

const lenses = [
  { 
    id: 'brand' as Lens, 
    title: "Brand / Business Story", 
    subtitle: "Turn a website or product into an interactive experience",
    icon: Building2, 
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500",
  },
  { 
    id: 'creator' as Lens, 
    title: "Creative Story / Script", 
    subtitle: "Bring a story, script, or idea to life moment by moment",
    icon: Film, 
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500",
  },
  { 
    id: 'knowledge' as Lens, 
    title: "Knowledge / Learning", 
    subtitle: "Transform documents into something people actually remember",
    icon: GraduationCap, 
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500",
  },
];

const lensContent = {
  brand: {
    inputTitle: "What will you transform?",
    inputSubtitle: "Start with a URL, product page, or case study",
    inputIcon: Globe,
    inputPlaceholder: "Enter your website URL or company name",
    goalTitle: "What's your primary goal?",
    goals: [
      { id: "convert", label: "Convert visitors into customers" },
      { id: "explain", label: "Explain what we do clearly" },
      { id: "showcase", label: "Showcase products or services" },
      { id: "train", label: "Train customers or partners" },
      { id: "pitch", label: "Pitch to investors or stakeholders" },
    ],
    summaryPoints: [
      { icon: Upload, text: "Your website becomes an interactive walkthrough" },
      { icon: MessageCircle, text: "Customers can ask questions, grounded in your content" },
      { icon: Shield, text: "Every answer stays factually accurate" },
    ],
  },
  creator: {
    inputTitle: "What story will you tell?",
    inputSubtitle: "Start with a script, treatment, or story idea",
    inputIcon: Clapperboard,
    inputPlaceholder: "Give your story a working title",
    goalTitle: "What experience are you creating?",
    goals: [
      { id: "short_film", label: "Short film or micro-cinema" },
      { id: "trailer", label: "Trailer or teaser" },
      { id: "series", label: "Serialized episodes" },
      { id: "interactive", label: "Interactive fiction" },
      { id: "experimental", label: "Experimental storytelling" },
    ],
    summaryPoints: [
      { icon: Film, text: "Each card is a moment your audience lives inside" },
      { icon: MessageCircle, text: "Characters respond in-world, safely guardrailed" },
      { icon: Wand2, text: "Your visual style stays consistent throughout" },
    ],
  },
  knowledge: {
    inputTitle: "What will you teach?",
    inputSubtitle: "Start with a PDF, deck, or document",
    inputIcon: FileText,
    inputPlaceholder: "Enter the topic or document title",
    goalTitle: "What's the learning goal?",
    goals: [
      { id: "onboard", label: "Onboard new team members" },
      { id: "train", label: "Train on processes or policies" },
      { id: "educate", label: "Educate customers or users" },
      { id: "explain", label: "Explain complex topics simply" },
      { id: "summarize", label: "Summarize research or reports" },
    ],
    summaryPoints: [
      { icon: FileText, text: "Dense material becomes digestible moments" },
      { icon: MessageCircle, text: "Learners can ask the expert without interrupting them" },
      { icon: Shield, text: "Answers stay grounded in your source material" },
    ],
  },
};

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [data, setData] = useState<OnboardingData>({
    lens: '',
    companyName: '',
    primaryGoal: '',
    contentType: '',
  });

  const totalSteps = 4;
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const currentLens = data.lens ? lensContent[data.lens] : null;
  const currentLensConfig = lenses.find(l => l.id === data.lens);
  
  const saveOnboarding = useMutation({
    mutationFn: async (onboardingData: OnboardingData) => {
      const response = await fetch("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          persona: onboardingData.lens,
          companyName: onboardingData.companyName,
          goals: [onboardingData.primaryGoal],
          contentFrequency: 'occasional',
          industry: 'other',
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
        return !!data.lens;
      case 2:
        return true;
      case 3:
        return !!data.primaryGoal;
      case 4:
        return true;
      default:
        return true;
    }
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
            {/* Step 1: Lens Selection */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    What are you creating today?
                  </h1>
                  <p className="text-muted-foreground">
                    Choose your starting point — you can always change this later
                  </p>
                </div>
                <div className="space-y-4">
                  {lenses.map((lens) => (
                    <button
                      key={lens.id}
                      onClick={() => setData({ ...data, lens: lens.id })}
                      className={`w-full p-6 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                        data.lens === lens.id
                          ? `${lens.borderColor} ${lens.bgColor}`
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`button-lens-${lens.id}`}
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${lens.color} flex items-center justify-center flex-shrink-0`}>
                        <lens.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{lens.title}</p>
                        <p className="text-sm text-muted-foreground">{lens.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Input Context */}
            {step === 2 && currentLens && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    {currentLens.inputTitle}
                  </h1>
                  <p className="text-muted-foreground">
                    {currentLens.inputSubtitle}
                  </p>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">
                      {data.lens === 'brand' ? 'Website or Company' : data.lens === 'creator' ? 'Story Title' : 'Topic or Document'}
                    </Label>
                    <div className="relative">
                      <currentLens.inputIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="companyName"
                        value={data.companyName}
                        onChange={(e) => setData({ ...data, companyName: e.target.value })}
                        placeholder={currentLens.inputPlaceholder}
                        className="pl-10"
                        data-testid="input-context"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You can skip this for now and add content later
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Goal Selection */}
            {step === 3 && currentLens && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    {currentLens.goalTitle}
                  </h1>
                  <p className="text-muted-foreground">
                    This helps us set the right defaults
                  </p>
                </div>
                <div className="space-y-3 max-w-md mx-auto">
                  {currentLens.goals.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => setData({ ...data, primaryGoal: goal.id })}
                      className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        data.primaryGoal === goal.id
                          ? `${currentLensConfig?.borderColor} ${currentLensConfig?.bgColor}`
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`button-goal-${goal.id}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        data.primaryGoal === goal.id ? `${currentLensConfig?.borderColor} bg-primary` : "border-muted-foreground"
                      }`}>
                        {data.primaryGoal === goal.id && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-medium">{goal.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Summary / What to Expect */}
            {step === 4 && currentLens && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-step-title">
                    You're all set
                  </h1>
                  <p className="text-muted-foreground">
                    Here's what NextMonth will do for you
                  </p>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  {currentLens.summaryPoints.map((point, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.15 }}
                      className={`flex items-start gap-4 p-4 rounded-lg ${currentLensConfig?.bgColor}`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${currentLensConfig?.color} flex items-center justify-center flex-shrink-0`}>
                        <point.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm font-medium pt-2">{point.text}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="text-center pt-4">
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    NextMonth doesn't invent meaning. It elevates what's already there.
                  </p>
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
            {step === totalSteps ? (saveOnboarding.isPending ? "Creating..." : "Create Your NextMonth") : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
