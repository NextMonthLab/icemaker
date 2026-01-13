import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lightbulb, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  BookOpen, 
  Target, 
  Users, 
  MessageSquare,
  Sparkles,
  ArrowDown,
  CheckCircle2
} from "lucide-react";

interface StoryStructureOverlayProps {
  onClose: () => void;
  totalCards: number;
  onCardFocus?: (cardIndex: number) => void;
}

const STORY_STRUCTURE_TIPS = [
  {
    id: "hook",
    title: "The Hook",
    cardRange: "Card 1",
    icon: Sparkles,
    description: "Start with a compelling hook that grabs attention. This is your first impression – make it count.",
    tips: [
      "Open with a provocative question or statement",
      "Present a relatable problem or challenge",
      "Use vivid, concrete language"
    ],
    example: "Instead of 'Let's discuss leadership', try 'What if everything you knew about leadership was wrong?'"
  },
  {
    id: "context",
    title: "Set the Context",
    cardRange: "Cards 2-3",
    icon: Target,
    description: "Establish the stakes and why this matters. Help your audience understand the 'why' before the 'how'.",
    tips: [
      "Connect to your audience's real challenges",
      "Establish credibility and relevance",
      "Create tension between current state and desired outcome"
    ],
    example: "Teams that master this skill see 40% higher engagement – yet most organizations struggle with it."
  },
  {
    id: "journey",
    title: "The Learning Journey",
    cardRange: "Middle cards",
    icon: BookOpen,
    description: "Build your core content in digestible steps. Each card should reveal one key insight.",
    tips: [
      "One concept per card – no overloading",
      "Use stories and examples to illustrate points",
      "Add interaction points for reflection"
    ],
    example: "Break complex topics into 'moments of discovery' rather than information dumps."
  },
  {
    id: "interaction",
    title: "Pause for Reflection",
    cardRange: "Between key cards",
    icon: MessageSquare,
    description: "Use interaction points to let learners process and apply what they've learned.",
    tips: [
      "Ask open-ended questions that promote thinking",
      "Let the AI character guide deeper exploration",
      "Give learners space to connect to their own experience"
    ],
    example: "Add an interaction after Card 3 with: 'How does this connect to a challenge you're facing?'"
  },
  {
    id: "transformation",
    title: "The Transformation",
    cardRange: "Near the end",
    icon: Users,
    description: "Show the payoff. What has changed? What can they now do differently?",
    tips: [
      "Reinforce key takeaways visually",
      "Connect back to the opening hook",
      "Paint a picture of success"
    ],
    example: "Imagine your next team meeting with this new approach. What would be different?"
  },
  {
    id: "action",
    title: "Call to Action",
    cardRange: "Final card",
    icon: CheckCircle2,
    description: "End with a clear next step. Don't leave your audience wondering 'now what?'",
    tips: [
      "One specific, actionable takeaway",
      "Make it feel achievable today",
      "Create momentum for continued learning"
    ],
    example: "Your challenge this week: Try one conversation using this approach."
  }
];

export function StoryStructureOverlay({ 
  onClose, 
  totalCards,
  onCardFocus 
}: StoryStructureOverlayProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const section = STORY_STRUCTURE_TIPS[currentSection];
  const Icon = section.icon;
  const isLastSection = currentSection === STORY_STRUCTURE_TIPS.length - 1;

  const handleNext = () => {
    if (isLastSection) {
      onClose();
    } else {
      setCurrentSection(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="story-structure-overlay"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
      >
        <div className="relative p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white h-8 px-2"
            data-testid="button-close-story-structure"
          >
            Close
            <X className="w-4 h-4 ml-1" />
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-cyan-400 font-medium uppercase tracking-wider">
                Story Structure Guide
              </p>
              <h2 className="text-xl font-bold text-white">Craft a Compelling Narrative</h2>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <p className="text-sm text-cyan-300">{section.cardRange}</p>
                </div>
              </div>

              <p className="text-slate-300 text-sm leading-relaxed">
                {section.description}
              </p>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Tips</p>
                <ul className="space-y-2">
                  {section.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <ArrowDown className="w-4 h-4 text-cyan-400 mt-0.5 rotate-[-90deg]" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-4">
                <p className="text-xs font-medium text-cyan-400 uppercase tracking-wide mb-1">Example</p>
                <p className="text-sm text-cyan-100 italic">"{section.example}"</p>
              </div>

              {totalCards > 0 && (
                <p className="text-xs text-slate-500 text-center">
                  Your ICE has {totalCards} cards – apply this structure to guide your audience.
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-1.5 mt-6 mb-4">
            {STORY_STRUCTURE_TIPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSection(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentSection
                    ? "w-6 bg-cyan-500"
                    : idx < currentSection
                    ? "w-1.5 bg-cyan-400"
                    : "w-1.5 bg-slate-600"
                }`}
                data-testid={`button-section-${idx}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentSection === 0}
            className="text-slate-400 hover:text-white"
            data-testid="button-story-structure-prev"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            data-testid="button-story-structure-next"
          >
            {isLastSection ? "Start Building" : "Next Tip"}
            {!isLastSection && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
