import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Globe, Brain, MessageCircle, BarChart3, Zap, Shield, Users, CheckCircle2, Lightbulb, Target, TrendingUp, Heart, Award, Clock, Rocket } from "lucide-react";

interface SiteIngestionLoaderProps {
  brandName?: string;
  accentColor?: string;
  isComplete?: boolean;
  onReady?: () => void;
}

const educationalSlides = [
  {
    icon: Brain,
    title: "Understanding Your Business",
    description: "We're reading your website and learning what makes your business unique.",
    detail: "Our AI extracts services, FAQs, testimonials, and key information.",
  },
  {
    icon: MessageCircle,
    title: "Creating Your AI Assistant",
    description: "Building a conversational interface that knows your business inside out.",
    detail: "Visitors will be able to ask questions and get instant, accurate answers.",
  },
  {
    icon: Globe,
    title: "Extracting Visual Identity",
    description: "Capturing your brand colours, logos, and imagery for a cohesive experience.",
    detail: "Your Orbit will feel authentically yours from the first glance.",
  },
  {
    icon: BarChart3,
    title: "Setting Up Intelligence",
    description: "Preparing analytics to help you understand what visitors really want.",
    detail: "Track conversations, popular questions, and engagement patterns.",
  },
  {
    icon: Users,
    title: "Engaging Your Audience",
    description: "Orbits convert 3x more visitors into leads than static websites.",
    detail: "Interactive conversations build trust and capture intent naturally.",
  },
  {
    icon: Shield,
    title: "Protecting Your Brand",
    description: "AI responses are guardrailed to always represent your business accurately.",
    detail: "You stay in control of what your Orbit says about you.",
  },
  {
    icon: Lightbulb,
    title: "Finding Customer Questions",
    description: "We identify the questions your customers commonly ask.",
    detail: "Your Orbit will proactively address visitor concerns.",
  },
  {
    icon: Target,
    title: "Optimizing for Conversions",
    description: "Every interaction is designed to guide visitors toward taking action.",
    detail: "From enquiries to bookings, we make it easy to convert.",
  },
  {
    icon: TrendingUp,
    title: "Continuous Learning",
    description: "Your Orbit gets smarter over time based on real conversations.",
    detail: "Insights help you improve your messaging and offerings.",
  },
  {
    icon: Heart,
    title: "Building Trust",
    description: "Testimonials and social proof are highlighted to build confidence.",
    detail: "Real customer stories help new visitors feel secure.",
  },
  {
    icon: Award,
    title: "Professional Presentation",
    description: "Your Orbit presents your business at its absolute best.",
    detail: "Clean, modern design that works on any device.",
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    description: "Your Orbit never sleeps - it's always ready to help visitors.",
    detail: "Capture leads and answer questions around the clock.",
  },
  {
    icon: Rocket,
    title: "Ready to Launch",
    description: "In moments, your Orbit will be ready to share with the world.",
    detail: "Embed it, link to it, or use it as your new digital front door.",
  },
];

const progressStages = [
  { progress: 5, label: "Connecting to your website..." },
  { progress: 15, label: "Downloading page content..." },
  { progress: 25, label: "Extracting brand identity..." },
  { progress: 35, label: "Analyzing services & offerings..." },
  { progress: 45, label: "Finding FAQs & testimonials..." },
  { progress: 55, label: "Extracting structured data..." },
  { progress: 65, label: "Building knowledge base..." },
  { progress: 75, label: "Validating content quality..." },
  { progress: 85, label: "Preparing your Orbit..." },
  { progress: 95, label: "Final optimizations..." },
];

export function SiteIngestionLoader({ brandName, accentColor = "#8b5cf6", isComplete = false, onReady }: SiteIngestionLoaderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const hasCalledReady = useRef(false);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % educationalSlides.length);
    }, 5000);
    return () => clearInterval(slideInterval);
  }, []);

  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      setCurrentStage(progressStages.length);
      return;
    }
    
    const stageInterval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < progressStages.length - 1) return prev + 1;
        return prev;
      });
    }, 3000);
    return () => clearInterval(stageInterval);
  }, [isComplete]);

  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      if (onReady && !hasCalledReady.current) {
        hasCalledReady.current = true;
        setTimeout(() => onReady(), 800);
      }
      return;
    }
    
    const targetProgress = progressStages[currentStage]?.progress || 95;
    const animateProgress = () => {
      setDisplayProgress((prev) => {
        const diff = targetProgress - prev;
        if (Math.abs(diff) < 0.5) return targetProgress;
        return prev + diff * 0.08;
      });
    };
    const animationFrame = setInterval(animateProgress, 50);
    return () => clearInterval(animationFrame);
  }, [currentStage, isComplete, onReady]);

  const slide = educationalSlides[currentSlide];
  const SlideIcon = slide.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6"
      data-testid="site-ingestion-loader"
    >
      <div className="w-full max-w-lg mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="NextMonth" 
              className="h-12 animate-pulse"
              style={{ clipPath: 'inset(30% 0 30% 0)' }}
            />
          </div>
          {brandName && (
            <h1 className="text-2xl font-bold text-foreground">
              Creating Your Orbit for <span style={{ color: accentColor }}>{brandName}</span>
            </h1>
          )}
          {!brandName && (
            <h1 className="text-2xl font-bold text-foreground">
              Creating Your Orbit
            </h1>
          )}
        </motion.div>

        <div className="space-y-3">
          <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ 
                background: isComplete 
                  ? `linear-gradient(90deg, #22c55e, #16a34a)` 
                  : `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
                width: `${displayProgress}%`,
              }}
              transition={{ type: "spring", stiffness: 50 }}
            />
            {!isComplete && (
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                style={{ 
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s infinite linear",
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-500 font-medium">Ready! Loading your Orbit...</span>
                </>
              ) : (
                progressStages[currentStage]?.label || "Processing..."
              )}
            </span>
            <span className={isComplete ? "text-green-500 font-medium" : ""}>
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>

        <div className="relative h-52 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex flex-col items-center text-center"
            >
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${accentColor}20` }}
              >
                <SlideIcon 
                  className="w-8 h-8" 
                  style={{ color: accentColor }} 
                />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {slide.title}
              </h3>
              <p className="text-muted-foreground mb-2">
                {slide.description}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {slide.detail}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-1.5">
          {educationalSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: index === currentSlide ? accentColor : 'rgba(255,255,255,0.2)',
                transform: index === currentSlide ? 'scale(1.5)' : 'scale(1)',
              }}
              data-testid={`slide-indicator-${index}`}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center space-y-4 pt-4"
        >
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              <span>Brand Safe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>3x Engagement</span>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </motion.div>
  );
}
