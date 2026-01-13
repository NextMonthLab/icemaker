import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Film, MessageCircle, Download, Globe, X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface GuidedWalkthroughProps {
  onComplete: () => void;
  onSkip: () => void;
}

const WALKTHROUGH_STEPS = [
  {
    id: "cards",
    icon: Film,
    title: "Story Cards",
    description: "Your content is organized into cinematic story cards. Each card is a moment in your narrative that your audience will experience one at a time.",
    highlight: "Tap any card to edit its title and content.",
  },
  {
    id: "nodes",
    icon: MessageCircle,
    title: "AI Interactions",
    description: "Between cards, you can add AI interaction points. These are moments where your audience can pause and have a live conversation with an AI character.",
    highlight: "Click the ➕ between cards to add one.",
  },
  {
    id: "download-vs-publish",
    icon: Globe,
    title: "Download vs Publish",
    description: "You have two options for your finished experience:",
    options: [
      {
        icon: Download,
        label: "Download",
        text: "Get a video file of your story. Great for sharing on social media or embedding elsewhere.",
      },
      {
        icon: Globe,
        label: "Publish",
        text: "Host an interactive experience with live AI characters. Requires a subscription.",
      },
    ],
  },
];

export function GuidedWalkthrough({ onComplete, onSkip }: GuidedWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = WALKTHROUGH_STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === WALKTHROUGH_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
      >
        <div className="relative p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="absolute top-4 right-4 text-slate-400 hover:text-white h-8 px-2"
            data-testid="button-skip-walkthrough"
          >
            Skip
            <X className="w-4 h-4 ml-1" />
          </Button>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-cyan-400 font-medium uppercase tracking-wider">
                Step {currentStep + 1} of {WALKTHROUGH_STEPS.length}
              </p>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                {step.description}
              </p>

              {step.highlight && (
                <div className="bg-cyan-900/30 border border-cyan-500/30 rounded-lg px-4 py-3 mb-4">
                  <p className="text-cyan-200 text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    {step.highlight}
                  </p>
                </div>
              )}

              {step.options && (
                <div className="space-y-3">
                  {step.options.map((option) => {
                    const OptionIcon = option.icon;
                    return (
                      <div
                        key={option.label}
                        className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <OptionIcon className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{option.label}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{option.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-1.5 mt-6 mb-4">
            {WALKTHROUGH_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStep
                    ? "w-6 bg-cyan-500"
                    : idx < currentStep
                    ? "w-1.5 bg-cyan-400"
                    : "w-1.5 bg-slate-600"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="text-slate-400 hover:text-white"
            data-testid="button-walkthrough-prev"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            data-testid="button-walkthrough-next"
          >
            {isLastStep ? "Get Started" : "Next"}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
