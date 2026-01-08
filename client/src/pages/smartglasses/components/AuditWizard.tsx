import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuditAnswers, AuditResult, CategoryFit, BudgetRange, PrimaryGoal, MustHaveFeature, PrivacyComfort, PhoneEcosystem } from "@/lib/types/smartglasses";

const budgetOptions: { value: BudgetRange; label: string }[] = [
  { value: "under_300", label: "Under £300" },
  { value: "300_600", label: "£300 - £600" },
  { value: "600_1200", label: "£600 - £1,200" },
  { value: "over_1200", label: "£1,200+" },
];

const goalOptions: { value: PrimaryGoal; label: string; desc: string }[] = [
  { value: "content_creation", label: "Content creation", desc: "Capture and share moments" },
  { value: "fitness", label: "Fitness", desc: "Workouts and outdoor activities" },
  { value: "commuting", label: "Commuting", desc: "Hands-free during travel" },
  { value: "work", label: "Work", desc: "Productivity and meetings" },
  { value: "accessibility", label: "Accessibility", desc: "Assistive features" },
  { value: "experimenting", label: "Experimenting", desc: "Curious about the tech" },
];

const featureOptions: { value: MustHaveFeature; label: string }[] = [
  { value: "camera", label: "Camera" },
  { value: "open_ear_audio", label: "Open-ear audio" },
  { value: "ar_display", label: "AR display" },
  { value: "prescription_support", label: "Prescription support" },
  { value: "long_battery", label: "Long battery" },
  { value: "lightweight", label: "Lightweight" },
];

const privacyOptions: { value: PrivacyComfort; label: string; desc: string }[] = [
  { value: "low", label: "Low", desc: "Fine with always-on features" },
  { value: "medium", label: "Medium", desc: "Prefer clear recording indicators" },
  { value: "high", label: "High", desc: "Minimal data collection preferred" },
];

const ecosystemOptions: { value: PhoneEcosystem; label: string }[] = [
  { value: "iphone", label: "iPhone" },
  { value: "android", label: "Android" },
  { value: "mixed", label: "Mixed / both" },
];

function generateAuditResult(answers: AuditAnswers): AuditResult {
  const categoryFits: CategoryFit[] = [];
  const considerations: string[] = [];

  if (answers.primaryGoal === "content_creation" || answers.mustHaveFeatures.includes("camera")) {
    categoryFits.push({
      id: "camera_first",
      name: "Camera-first creator glasses",
      description: "Optimised for capturing photos and video with quick sharing to social platforms.",
      matchScore: answers.primaryGoal === "content_creation" ? 95 : 75,
    });
  }

  if (answers.mustHaveFeatures.includes("open_ear_audio") || answers.primaryGoal === "commuting") {
    categoryFits.push({
      id: "audio_first",
      name: "Audio-first everyday glasses",
      description: "Focus on music, calls, and podcasts with all-day comfort.",
      matchScore: answers.primaryGoal === "commuting" ? 90 : 70,
    });
  }

  if (answers.mustHaveFeatures.includes("ar_display")) {
    categoryFits.push({
      id: "true_ar",
      name: "True AR display glasses",
      description: "Visual overlays, navigation, and spatial computing features.",
      matchScore: 85,
    });
  }

  if (answers.primaryGoal === "work") {
    categoryFits.push({
      id: "enterprise",
      name: "Enterprise workflow glasses",
      description: "Built for productivity, meetings, and professional environments.",
      matchScore: 88,
    });
  }

  if (answers.primaryGoal === "accessibility") {
    categoryFits.push({
      id: "assistive",
      name: "Accessibility and assistive glasses",
      description: "Features like text-to-speech, object recognition, and navigation aids.",
      matchScore: 92,
    });
  }

  if (categoryFits.length === 0) {
    categoryFits.push({
      id: "audio_first",
      name: "Audio-first everyday glasses",
      description: "A great starting point for exploring smart glasses technology.",
      matchScore: 70,
    });
  }

  if (answers.wearsGlasses) {
    considerations.push("Prescription lens compatibility will be important for your comfort.");
  }

  if (answers.privacyComfort === "high") {
    considerations.push("Look for glasses with clear recording indicators and privacy-first design.");
  }

  if (answers.budgetRange === "under_300") {
    considerations.push("At this budget, audio-first glasses offer the best value. AR displays are typically £600+.");
  }

  if (answers.budgetRange === "over_1200") {
    considerations.push("Premium budget opens up true AR glasses with displays and spatial computing.");
  }

  if (answers.phoneEcosystem === "iphone") {
    considerations.push("Some glasses have deeper iOS integration. Check compatibility before buying.");
  }

  if (answers.mustHaveFeatures.includes("long_battery")) {
    considerations.push("Battery life varies from 4-12 hours. Consider your daily usage patterns.");
  }

  const goalLabel = goalOptions.find(g => g.value === answers.primaryGoal)?.label || "general use";
  const budgetLabel = budgetOptions.find(b => b.value === answers.budgetRange)?.label || "flexible budget";

  const profileSummary = `You're looking for smart glasses for ${goalLabel.toLowerCase()} with a ${budgetLabel.toLowerCase()}. ${
    answers.mustHaveFeatures.length > 0
      ? `Your must-haves include ${answers.mustHaveFeatures.map(f => featureOptions.find(fo => fo.value === f)?.label.toLowerCase()).join(", ")}.`
      : ""
  } ${answers.wearsGlasses ? "Since you already wear glasses, prescription options will be key." : ""}`;

  return {
    profileSummary: profileSummary.trim(),
    considerations,
    categoryFits: categoryFits.sort((a, b) => b.matchScore - a.matchScore),
  };
}

export function AuditWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AuditAnswers>({
    budgetRange: null,
    primaryGoal: null,
    mustHaveFeatures: [],
    privacyComfort: null,
    phoneEcosystem: null,
    wearsGlasses: null,
  });
  const [result, setResult] = useState<AuditResult | null>(null);

  const steps = [
    { title: "Budget", subtitle: "What's your budget range?" },
    { title: "Goal", subtitle: "What's your primary goal?" },
    { title: "Features", subtitle: "Select must-have features" },
    { title: "Privacy", subtitle: "Your privacy comfort level" },
    { title: "Ecosystem", subtitle: "Your phone ecosystem" },
    { title: "Glasses", subtitle: "Do you already wear glasses?" },
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return answers.budgetRange !== null;
      case 1: return answers.primaryGoal !== null;
      case 2: return true;
      case 3: return answers.privacyComfort !== null;
      case 4: return answers.phoneEcosystem !== null;
      case 5: return answers.wearsGlasses !== null;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setResult(generateAuditResult(answers));
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleFeature = (feature: MustHaveFeature) => {
    setAnswers(prev => ({
      ...prev,
      mustHaveFeatures: prev.mustHaveFeatures.includes(feature)
        ? prev.mustHaveFeatures.filter(f => f !== feature)
        : [...prev.mustHaveFeatures, feature],
    }));
  };

  if (result) {
    return (
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Your Smart Glasses Profile</h2>
                <p className="text-zinc-400">Based on your answers</p>
              </div>
            </div>

            <p className="text-zinc-300 mb-6" data-testid="text-profile-summary">{result.profileSummary}</p>

            {result.considerations.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-3">Top considerations</h3>
                <ul className="space-y-2">
                  {result.considerations.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-zinc-400">
                      <span className="text-pink-400 mt-1">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Category fits</h3>
              <div className="grid gap-4">
                {result.categoryFits.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700"
                    data-testid={`category-fit-${cat.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{cat.name}</h4>
                      <span className="text-sm text-pink-400 font-medium">{cat.matchScore}% match</span>
                    </div>
                    <p className="text-sm text-zinc-400">{cat.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500"
                data-testid="button-ask-orbit"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Ask the Orbit about my results
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                data-testid="button-unlock-influencer"
              >
                Unlock Influencer Mode
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full mt-4 text-zinc-500"
              onClick={() => { setResult(null); setStep(0); }}
            >
              Start over
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Smart Glasses Audit</h2>
          <p className="text-zinc-400">Find your ideal category in 6 quick questions</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-8 h-2 rounded-full transition-colors",
                i === step ? "bg-pink-500" : i < step ? "bg-pink-500/50" : "bg-zinc-700"
              )}
            />
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <h3 className="text-xl font-semibold text-white mb-2">{steps[step].title}</h3>
          <p className="text-zinc-400 mb-6">{steps[step].subtitle}</p>

          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {budgetOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswers(prev => ({ ...prev, budgetRange: opt.value }))}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    answers.budgetRange === opt.value
                      ? "border-pink-500 bg-pink-500/10 text-white"
                      : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                  )}
                  data-testid={`option-budget-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {goalOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswers(prev => ({ ...prev, primaryGoal: opt.value }))}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    answers.primaryGoal === opt.value
                      ? "border-pink-500 bg-pink-500/10"
                      : "border-zinc-700 hover:border-zinc-600"
                  )}
                  data-testid={`option-goal-${opt.value}`}
                >
                  <div className="font-medium text-white">{opt.label}</div>
                  <div className="text-sm text-zinc-400">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {featureOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleFeature(opt.value)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                    answers.mustHaveFeatures.includes(opt.value)
                      ? "border-pink-500 bg-pink-500/10 text-white"
                      : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                  )}
                  data-testid={`option-feature-${opt.value}`}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center",
                    answers.mustHaveFeatures.includes(opt.value)
                      ? "bg-pink-500 border-pink-500"
                      : "border-zinc-600"
                  )}>
                    {answers.mustHaveFeatures.includes(opt.value) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {privacyOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswers(prev => ({ ...prev, privacyComfort: opt.value }))}
                  className={cn(
                    "w-full p-4 rounded-xl border text-left transition-all",
                    answers.privacyComfort === opt.value
                      ? "border-pink-500 bg-pink-500/10"
                      : "border-zinc-700 hover:border-zinc-600"
                  )}
                  data-testid={`option-privacy-${opt.value}`}
                >
                  <div className="font-medium text-white">{opt.label}</div>
                  <div className="text-sm text-zinc-400">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-3 gap-3">
              {ecosystemOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswers(prev => ({ ...prev, phoneEcosystem: opt.value }))}
                  className={cn(
                    "p-4 rounded-xl border text-center transition-all",
                    answers.phoneEcosystem === opt.value
                      ? "border-pink-500 bg-pink-500/10 text-white"
                      : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                  )}
                  data-testid={`option-ecosystem-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAnswers(prev => ({ ...prev, wearsGlasses: true }))}
                className={cn(
                  "p-4 rounded-xl border text-center transition-all",
                  answers.wearsGlasses === true
                    ? "border-pink-500 bg-pink-500/10 text-white"
                    : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                )}
                data-testid="option-glasses-yes"
              >
                Yes, I wear glasses
              </button>
              <button
                onClick={() => setAnswers(prev => ({ ...prev, wearsGlasses: false }))}
                className={cn(
                  "p-4 rounded-xl border text-center transition-all",
                  answers.wearsGlasses === false
                    ? "border-pink-500 bg-pink-500/10 text-white"
                    : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                )}
                data-testid="option-glasses-no"
              >
                No
              </button>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className="text-zinc-400"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-gradient-to-r from-pink-500 to-purple-500"
              data-testid="button-next-step"
            >
              {step === steps.length - 1 ? "See results" : "Next"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
