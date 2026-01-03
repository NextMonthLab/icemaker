import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Sparkles,
  Rocket,
  ArrowRight,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FirstRunOnboardingProps {
  open: boolean;
  onClose: () => void;
  onStartTour: (path: "orbit-first" | "ice-first") => void;
}

const pathOptions = [
  {
    id: "orbit-first" as const,
    icon: Globe,
    title: "Claim your Orbit",
    subtitle: "Turn your website into an AI-powered presence",
    description: "We'll scan your site and create an intelligent knowledge base that answers questions about your business.",
    gradient: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    steps: ["Enter your URL", "Watch it extract knowledge", "Go live instantly"],
  },
  {
    id: "ice-first" as const,
    icon: Sparkles,
    title: "Create an ICE",
    subtitle: "Build an Interactive Cinematic Experience",
    description: "Transform any content into an immersive story with AI-generated visuals, narration, and character interaction.",
    gradient: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    steps: ["Drop in any content", "AI builds the story", "Share everywhere"],
  },
];

export function FirstRunOnboarding({
  open,
  onClose,
  onStartTour,
}: FirstRunOnboardingProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const dismissMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/me/onboarding/tour", { onboardingDismissed: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "onboarding"] });
    },
  });

  const selectPathMutation = useMutation({
    mutationFn: async (path: "orbit-first" | "ice-first") => {
      return apiRequest("PATCH", "/api/me/onboarding/tour", { onboardingPath: path });
    },
    onSuccess: (_, path) => {
      queryClient.invalidateQueries({ queryKey: ["me", "onboarding"] });
      onClose();
      setTimeout(() => {
        onStartTour(path);
      }, 100);
    },
  });

  const handleSkip = () => {
    dismissMutation.mutate();
    onClose();
  };

  const handleSelectPath = (path: "orbit-first" | "ice-first") => {
    selectPathMutation.mutate(path);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="sm:max-w-2xl bg-black border border-zinc-800 p-0 gap-0 overflow-hidden"
        data-testid="first-run-onboarding-modal"
      >
        <DialogTitle className="sr-only">Welcome to NextMonth</DialogTitle>
        
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10"
          data-testid="button-skip-onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 mb-4">
              <Rocket className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Quick Start Guide</span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Welcome to NextMonth
            </h2>
            <p className="text-zinc-400">
              Choose how you'd like to get started
            </p>
          </div>

          <div className="grid gap-4">
            {pathOptions.map((option) => {
              const Icon = option.icon;
              const isHovered = hoveredPath === option.id;

              return (
                <motion.button
                  key={option.id}
                  onClick={() => handleSelectPath(option.id)}
                  onMouseEnter={() => setHoveredPath(option.id)}
                  onMouseLeave={() => setHoveredPath(null)}
                  className={`relative w-full text-left p-6 rounded-xl border transition-all ${
                    isHovered
                      ? "border-zinc-600 bg-zinc-900/50"
                      : "border-zinc-800 bg-zinc-900/30"
                  }`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  data-testid={`button-path-${option.id}`}
                  disabled={selectPathMutation.isPending}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${option.gradient} shrink-0`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">
                          {option.title}
                        </h3>
                        <ArrowRight
                          className={`h-5 w-5 transition-all ${
                            isHovered
                              ? "text-white translate-x-0 opacity-100"
                              : "text-zinc-500 -translate-x-2 opacity-0"
                          }`}
                        />
                      </div>
                      <p className="text-sm text-zinc-400 mb-3">
                        {option.subtitle}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        {option.steps.map((step, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-medium">
                              {i + 1}
                            </span>
                            {step}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={handleSkip}
              className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
              data-testid="button-skip-tour-text"
            >
              Skip for now - I'll explore on my own
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FirstRunOnboarding;
