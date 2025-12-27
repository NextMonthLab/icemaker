import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardPlayer from "@/components/CardPlayer";
import { adaptPreviewToCards, getTargetsFromIdentity, PreviewTarget } from "./PreviewCardAdapter";
import { ChevronRight, MessageCircle } from "lucide-react";

interface SiteIdentity {
  sourceDomain: string;
  title: string | null;
  heroHeadline: string | null;
  heroDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  primaryColour: string;
  serviceHeadings: string[];
  serviceBullets: string[];
  faqCandidates: string[];
  imagePool?: string[];
}

interface PreviewExperienceOrchestratorProps {
  siteIdentity: SiteIdentity;
  siteTitle: string | null;
  siteSummary: string | null;
  onAskAbout: (prompt: string) => void;
  onClaim: () => void;
}

type Mode = 'cinematic' | 'interactive' | 'transitioning';

export function PreviewExperienceOrchestrator({
  siteIdentity,
  siteTitle,
  onAskAbout,
  onClaim,
}: PreviewExperienceOrchestratorProps) {
  const [mode, setMode] = useState<Mode>('cinematic');
  const [currentTarget, setCurrentTarget] = useState<PreviewTarget>({ type: 'overview', id: 'overview', index: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const primaryColour = siteIdentity.primaryColour || '#7c3aed';
  const targets = getTargetsFromIdentity(siteIdentity);
  const cards = adaptPreviewToCards(siteIdentity, siteTitle, currentTarget);
  const currentCard = cards[0];

  const handlePhaseChange = useCallback((phase: "cinematic" | "context") => {
    if (phase === 'context') {
      setMode('interactive');
    }
  }, []);

  const handleTargetClick = useCallback((target: PreviewTarget) => {
    if (target.id === currentTarget.id) return;

    setIsTransitioning(true);
    setMode('transitioning');

    setTimeout(() => {
      setCurrentTarget(target);
      setMode('cinematic');
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 250);
  }, [currentTarget.id]);

  const handleAskAbout = useCallback((target: PreviewTarget) => {
    const prompt = target.type === 'faq' 
      ? target.label || 'Tell me more'
      : target.type === 'service'
      ? `What does ${target.label} include?`
      : target.type === 'why'
      ? 'What makes you different?'
      : target.type === 'lead'
      ? 'How do I get started?'
      : `Tell me about ${siteIdentity.sourceDomain}`;
    
    onAskAbout(prompt);
  }, [siteIdentity.sourceDomain, onAskAbout]);

  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait">
        {isTransitioning && (
          <motion.div
            key="transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {mode === 'cinematic' && currentCard && (
          <motion.div
            key={`cinematic-${currentTarget.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-[100svh] min-h-[500px] relative"
            style={{ scrollSnapAlign: 'start' }}
          >
            {(siteIdentity.logoUrl || siteIdentity.faviconUrl) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <img
                  src={siteIdentity.logoUrl || siteIdentity.faviconUrl || ''}
                  alt=""
                  className="w-6 h-6 rounded object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-sm font-medium text-white/90 max-w-[120px] truncate">
                  {siteIdentity.sourceDomain}
                </span>
              </motion.div>
            )}
            <CardPlayer
              card={currentCard}
              autoplay={true}
              onPhaseChange={handlePhaseChange}
              fullScreen={true}
            />
          </motion.div>
        )}

        {mode === 'interactive' && (
          <motion.div
            key={`interactive-${currentTarget.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full min-h-[100svh] pb-20"
            style={{ 
              background: `linear-gradient(to bottom, color-mix(in srgb, ${primaryColour} 8%, #0a0a0a), #0a0a0a)`
            }}
          >
            <div className="p-5 pt-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  {currentTarget.label || 'Overview'}
                </h2>
                <button
                  onClick={() => handleAskAbout(currentTarget)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${primaryColour} 20%, transparent)`,
                    color: primaryColour,
                  }}
                  data-testid="button-ask-current"
                >
                  <MessageCircle className="w-4 h-4" />
                  Ask
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {targets.filter(t => t.id !== currentTarget.id).slice(0, 5).map((target) => (
                <button
                  key={target.id}
                  onClick={() => handleTargetClick(target)}
                  className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all group flex items-center justify-between"
                  style={{
                    borderLeftColor: primaryColour,
                    borderLeftWidth: '3px',
                  }}
                  data-testid={`target-${target.id}`}
                >
                  <div className="flex-1">
                    <span className="text-xs uppercase tracking-wider text-white/50 mb-1 block">
                      {target.type === 'service' ? 'Service' : target.type === 'faq' ? 'Question' : target.type === 'lead' ? 'Next Step' : target.type}
                    </span>
                    <span className="font-medium text-white group-hover:text-white transition-colors line-clamp-2">
                      {target.label}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors flex-shrink-0 ml-3" />
                </button>
              ))}
            </div>

            {currentTarget.type === 'lead' && (
              <div className="p-4 pt-2">
                <button
                  onClick={onClaim}
                  className="w-full p-4 rounded-xl font-semibold text-base transition-colors"
                  style={{
                    backgroundColor: primaryColour,
                    color: '#fff',
                  }}
                  data-testid="button-claim-orchestrator"
                >
                  Claim and activate
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
