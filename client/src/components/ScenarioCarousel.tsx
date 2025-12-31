import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import engineerImage from "@assets/stock_images/engineer_working_in__08fad5a8.jpg";
import businessImage from "@assets/stock_images/business_professiona_dba1a455.jpg";
import teacherImage from "@assets/stock_images/teacher_educator_in__8c1ca5d7.jpg";
import filmmakerImage from "@assets/stock_images/filmmaker_director_r_bff3ccae.jpg";
import writerImage from "@assets/stock_images/creative_writer_work_c38a4245.jpg";

export type ScenarioAudience = "business" | "creator" | "educator" | "all";

export interface Scenario {
  id: string;
  title: string;
  audience: ScenarioAudience[];
  hasContent: string;
  doesWith: string;
  outcome: string;
  image: string;
}

export const allScenarios: Scenario[] = [
  {
    id: "innovative-business",
    title: "Innovative Business",
    audience: ["business", "all"],
    hasContent: "Technical documents and product specifications",
    doesWith: "Creates an interactive experience with an AI engineer answering questions about new technology",
    outcome: "Complex products become accessible and engaging for prospects and partners",
    image: engineerImage,
  },
  {
    id: "legacy-content",
    title: "Established Business",
    audience: ["business", "all"],
    hasContent: "Years of high-quality blog posts and articles",
    doesWith: "Converts written content into cinematic, video-first content for social platforms",
    outcome: "LinkedIn, TikTok, YouTube Shorts, and Instagram Reels filled with repurposed thought leadership",
    image: businessImage,
  },
  {
    id: "educator",
    title: "Teacher & Educator",
    audience: ["educator", "all"],
    hasContent: "Fact sheets and curriculum materials",
    doesWith: "Creates character-driven interactive lessons with historical figures explaining concepts",
    outcome: "Students engage deeply with content they actually remember",
    image: teacherImage,
  },
  {
    id: "filmmaker",
    title: "Independent Filmmaker",
    audience: ["creator", "all"],
    hasContent: "A screenplay and creative vision",
    doesWith: "Uses ICE as a living storyboard to align the creative team with generated scenes",
    outcome: "Team alignment before production begins, saving time and budget",
    image: filmmakerImage,
  },
  {
    id: "amateur-writer",
    title: "Amateur Writer",
    audience: ["creator", "all"],
    hasContent: "Unpublished short stories and creative writing",
    doesWith: "Brings stories to life and shares them publicly via video platforms",
    outcome: "Creative work finally reaches an audience and gains traction",
    image: writerImage,
  },
];

interface ScenarioCarouselProps {
  filter?: ScenarioAudience;
  showDots?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export default function ScenarioCarousel({
  filter = "all",
  showDots = true,
  autoPlay = true,
  autoPlayInterval = 6000,
}: ScenarioCarouselProps) {
  const scenarios = filter === "all" 
    ? allScenarios 
    : allScenarios.filter(s => s.audience.includes(filter));
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % scenarios.length);
  }, [scenarios.length]);

  const goToPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + scenarios.length) % scenarios.length);
  }, [scenarios.length]);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlay, autoPlayInterval, goToNext]);

  const currentScenario = scenarios[currentIndex];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="relative w-full" data-testid="scenario-carousel">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentScenario.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="grid md:grid-cols-2 gap-0"
          >
            <div className="relative aspect-[4/3] md:aspect-auto">
              <img
                src={currentScenario.image}
                alt={currentScenario.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/80 md:block hidden" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent md:hidden" />
            </div>

            <div className="p-8 md:p-10 flex flex-col justify-center bg-black/40 md:bg-transparent">
              <p className="text-pink-400 text-sm font-medium mb-2 uppercase tracking-wide">
                Scenario
              </p>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-6">
                {currentScenario.title}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">They have</p>
                  <p className="text-white/80">{currentScenario.hasContent}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">They use ICE to</p>
                  <p className="text-white/80">{currentScenario.doesWith}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">The outcome</p>
                  <p className="text-white">{currentScenario.outcome}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <button
          onClick={goToPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
          aria-label="Previous scenario"
          data-testid="carousel-prev"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
          aria-label="Next scenario"
          data-testid="carousel-next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {showDots && (
        <div className="flex justify-center gap-2 mt-6">
          {scenarios.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-pink-500 w-6"
                  : "bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to scenario ${index + 1}`}
              data-testid={`carousel-dot-${index}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
