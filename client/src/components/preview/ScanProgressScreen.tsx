import { motion } from "framer-motion";
import { Globe, Sparkles, Shield, BarChart3, Palette, MessageCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface ScanProgressScreenProps {
  domain: string;
  onComplete?: () => void;
}

const steps = [
  { 
    id: 'deep-read', 
    label: 'Deep Read', 
    description: 'Reading your site structure so visitors get accurate answers',
    minDwell: 3000,
    color: 'from-pink-500 to-pink-400',
  },
  { 
    id: 'concept-map', 
    label: 'Understanding', 
    description: 'Extracting services and questions customers actually ask',
    minDwell: 4000,
    color: 'from-purple-500 to-purple-400',
  },
  { 
    id: 'language-check', 
    label: 'Language Validation', 
    description: 'Ensuring everything reads naturally, not like labels',
    minDwell: 3000,
    color: 'from-blue-500 to-blue-400',
  },
  { 
    id: 'mental-model', 
    label: 'Visitor Clarity', 
    description: 'Checking if a visitor would understand what you do',
    minDwell: 3000,
    color: 'from-indigo-500 to-indigo-400',
  },
  { 
    id: 'build', 
    label: 'Building', 
    description: 'Creating your 24/7 assistant with validated content',
    minDwell: 2000,
    color: 'from-emerald-500 to-emerald-400',
  },
];

const ownerBenefits = [
  { icon: Palette, title: 'Brand Matching', description: 'Your colours, your voice', color: 'text-pink-400' },
  { icon: Shield, title: 'AI Safeguards', description: 'Control what AI says', color: 'text-purple-400' },
  { icon: BarChart3, title: 'Insights', description: 'What customers ask', color: 'text-blue-400' },
  { icon: MessageCircle, title: '24/7 Leads', description: 'Capture enquiries always', color: 'text-emerald-400' },
];

export function ScanProgressScreen({ domain, onComplete }: ScanProgressScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const hasCalledComplete = useRef(false);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    let cumulativeTime = 0;

    steps.forEach((step, index) => {
      if (index > 0) {
        const timer = setTimeout(() => {
          setCurrentStep(index);
        }, cumulativeTime);
        timers.push(timer);
      }
      cumulativeTime += step.minDwell;
    });

    // Mark complete after all steps
    const completeTimer = setTimeout(() => {
      setCurrentStep(steps.length);
      setIsComplete(true);
    }, cumulativeTime);
    timers.push(completeTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  // Call onComplete once when finished
  useEffect(() => {
    if (isComplete && onComplete && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      // Small delay for the final checkmark animation
      const timer = setTimeout(() => {
        onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center py-6"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-full">
          <Globe className="w-4 h-4 text-pink-400" />
          <span className="text-pink-300/80 text-sm font-medium">{domain}</span>
        </div>
        
        <h1 className="text-xl sm:text-2xl font-semibold text-white mb-2">
          Understanding your website
        </h1>
        <p className="text-white/50 text-sm mb-8 sm:mb-10 px-4">
          We're reading carefully so visitors get accurate answers.
        </p>

        <div className="space-y-2 sm:space-y-2.5 mb-10 sm:mb-12">
          {steps.map((step, index) => {
            const isStepComplete = index < currentStep;
            const isCurrent = index === currentStep;
            const isPending = index > currentStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15, duration: 0.4 }}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all ${
                  isStepComplete 
                    ? 'bg-gradient-to-r from-white/[0.06] to-white/[0.02] border-white/[0.15]' 
                    : isCurrent 
                      ? 'bg-gradient-to-r from-pink-500/[0.08] to-purple-500/[0.05] border-pink-500/30' 
                      : 'bg-white/[0.01] border-white/[0.06]'
                }`}
              >
                <div className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                  {isStepComplete ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  ) : isCurrent ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-2 border-pink-500/20 border-t-pink-400"
                      />
                      <span className="text-xs font-semibold text-pink-300">{index + 1}</span>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-white/30">{index + 1}</span>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isStepComplete ? 'text-white/80' : isCurrent ? 'text-pink-200' : 'text-white/40'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs truncate sm:whitespace-normal ${
                    isStepComplete ? 'text-white/50' : isCurrent ? 'text-pink-300/60' : 'text-white/25'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent mb-6 sm:mb-8" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-pink-400/60" />
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              When you activate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ownerBenefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1, duration: 0.3 }}
                className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
              >
                <benefit.icon className={`w-4 h-4 ${benefit.color} mt-0.5 flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/70 truncate">{benefit.title}</p>
                  <p className="text-[10px] text-white/40 truncate">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
