import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Globe, Brain, MessageCircle, BarChart3, Zap, Shield, Users } from "lucide-react";

interface SiteIngestionLoaderProps {
  brandName?: string;
  accentColor?: string;
  onComplete?: () => void;
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
    detail: "Your Smart Site will feel authentically yours from the first glance.",
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
    description: "Smart Sites convert 3x more visitors into leads than static websites.",
    detail: "Interactive conversations build trust and capture intent naturally.",
  },
  {
    icon: Shield,
    title: "Protecting Your Brand",
    description: "AI responses are guardrailed to always represent your business accurately.",
    detail: "You stay in control of what your Smart Site says about you.",
  },
];

const progressStages = [
  { progress: 0, label: "Connecting to your website..." },
  { progress: 15, label: "Downloading page content..." },
  { progress: 30, label: "Extracting brand identity..." },
  { progress: 45, label: "Analyzing services & offerings..." },
  { progress: 60, label: "Finding FAQs & testimonials..." },
  { progress: 75, label: "Building knowledge base..." },
  { progress: 90, label: "Preparing your Smart Site..." },
  { progress: 100, label: "Almost ready..." },
];

export function SiteIngestionLoader({ brandName, accentColor = "#8b5cf6", onComplete }: SiteIngestionLoaderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [hasCalledComplete, setHasCalledComplete] = useState(false);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % educationalSlides.length);
    }, 4000);
    return () => clearInterval(slideInterval);
  }, []);

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < progressStages.length - 1) return prev + 1;
        return prev;
      });
    }, 2500);
    return () => clearInterval(stageInterval);
  }, []);

  // Call onComplete when we reach the final stage
  useEffect(() => {
    if (currentStage === progressStages.length - 1 && onComplete && !hasCalledComplete) {
      setHasCalledComplete(true);
      // Small delay for the final animation
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStage, onComplete, hasCalledComplete]);

  useEffect(() => {
    const targetProgress = progressStages[currentStage].progress;
    const animateProgress = () => {
      setDisplayProgress((prev) => {
        const diff = targetProgress - prev;
        if (Math.abs(diff) < 1) return targetProgress;
        return prev + diff * 0.1;
      });
    };
    const animationFrame = setInterval(animateProgress, 50);
    return () => clearInterval(animationFrame);
  }, [currentStage]);

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
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            <span className="text-lg font-semibold text-primary">NextMonth</span>
          </div>
          {brandName && (
            <h1 className="text-2xl font-bold text-foreground">
              Creating Smart Site for <span style={{ color: accentColor }}>{brandName}</span>
            </h1>
          )}
          {!brandName && (
            <h1 className="text-2xl font-bold text-foreground">
              Creating Your Smart Site
            </h1>
          )}
        </motion.div>

        <div className="space-y-3">
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ 
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
                width: `${displayProgress}%`,
              }}
              transition={{ type: "spring", stiffness: 50 }}
            />
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ 
                backgroundSize: "200% 100%",
                animation: "shimmer 2s infinite linear",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressStages[currentStage].label}</span>
            <span>{Math.round(displayProgress)}%</span>
          </div>
        </div>

        <div className="relative h-48 overflow-hidden">
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

        <div className="flex justify-center gap-2">
          {educationalSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: index === currentSlide ? accentColor : 'rgba(255,255,255,0.2)',
                transform: index === currentSlide ? 'scale(1.3)' : 'scale(1)',
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
