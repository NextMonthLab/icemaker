import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardPlayer from "@/components/CardPlayer";
import { adaptPreviewToCards } from "./PreviewCardAdapter";
import { ChevronDown, MessageCircle, ArrowRight, X } from "lucide-react";

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
  onModeChange?: (mode: 'cinematic' | 'interactive') => void;
}

type Mode = 'cinematic' | 'interactive';

interface ContentSection {
  id: string;
  title: string;
  type: 'overview' | 'services' | 'questions' | 'next-steps';
  items: string[];
}

function buildSections(identity: SiteIdentity, siteSummary: string | null): ContentSection[] {
  const sections: ContentSection[] = [];
  
  const overviewText = identity.heroDescription || siteSummary || '';
  if (overviewText) {
    sections.push({
      id: 'overview',
      title: 'Overview',
      type: 'overview',
      items: [overviewText],
    });
  }
  
  if (identity.serviceHeadings.length > 0 || identity.serviceBullets.length > 0) {
    sections.push({
      id: 'services',
      title: 'What We Do',
      type: 'services',
      items: identity.serviceHeadings.length > 0 
        ? identity.serviceHeadings.slice(0, 6) 
        : identity.serviceBullets.slice(0, 6),
    });
  }
  
  if (identity.faqCandidates.length > 0) {
    sections.push({
      id: 'questions',
      title: 'Common Questions',
      type: 'questions',
      items: identity.faqCandidates.slice(0, 4),
    });
  }
  
  sections.push({
    id: 'next-steps',
    title: 'Next Steps',
    type: 'next-steps',
    items: ['Ready to learn more? Start a conversation or activate this Smart Site.'],
  });
  
  return sections;
}

export function PreviewExperienceOrchestrator({
  siteIdentity,
  siteTitle,
  siteSummary,
  onAskAbout,
  onClaim,
  onModeChange,
}: PreviewExperienceOrchestratorProps) {
  const [mode, setMode] = useState<Mode>('cinematic');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const brandName = siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || siteTitle?.split(' - ')[0] || siteIdentity.sourceDomain;
  const primaryColour = siteIdentity.primaryColour || '#7c3aed';
  const sections = buildSections(siteIdentity, siteSummary);
  const cards = adaptPreviewToCards(siteIdentity, siteTitle, { type: 'overview', id: 'overview', index: 0 });
  const heroCard = cards[0];

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const handlePhaseChange = useCallback((phase: "cinematic" | "context") => {
    if (phase === 'context') {
      setMode('interactive');
    }
  }, []);

  const handleSectionToggle = useCallback((sectionId: string) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  }, []);

  const handleAskAboutService = useCallback(() => {
    onAskAbout(`Tell me more about ${brandName}`);
  }, [brandName, onAskAbout]);

  return (
    <>
      <AnimatePresence mode="wait">
        {mode === 'cinematic' && heroCard && (
          <motion.div
            key="cinematic-hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 bg-black"
          >
            {(siteIdentity.logoUrl || siteIdentity.faviconUrl) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="absolute top-4 left-4 z-[60] flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <img
                  src={siteIdentity.logoUrl || siteIdentity.faviconUrl || ''}
                  alt=""
                  className="w-6 h-6 rounded object-contain"
                  style={{ filter: 'brightness(1.2)' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-sm font-medium text-white/90 max-w-[140px] truncate">
                  {siteIdentity.sourceDomain}
                </span>
              </motion.div>
            )}
            <div className="w-full h-full">
              <CardPlayer
                card={heroCard}
                autoplay={true}
                onPhaseChange={handlePhaseChange}
                fullScreen={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mode === 'interactive' && (
          <motion.div
            key="interactive-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full min-h-screen pb-24"
            style={{ 
              background: `linear-gradient(180deg, color-mix(in srgb, ${primaryColour} 8%, #0a0a0a) 0%, #0a0a0a 200px)`
            }}
          >
            <header className="p-5 pt-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                {(siteIdentity.logoUrl || siteIdentity.faviconUrl) && (
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5"
                    style={{ 
                      backgroundColor: `color-mix(in srgb, ${primaryColour} 20%, #1a1a1a)`,
                      border: `1px solid color-mix(in srgb, ${primaryColour} 30%, transparent)`
                    }}
                  >
                    <img
                      src={siteIdentity.logoUrl || siteIdentity.faviconUrl || ''}
                      alt=""
                      className="w-full h-full object-contain"
                      style={{ filter: 'brightness(1.1)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-semibold text-white">{brandName}</h1>
                  <p className="text-xs text-white/50">{siteIdentity.sourceDomain}</p>
                </div>
              </div>
            </header>

            <div className="p-4 space-y-3">
              {sections.map((section) => (
                <div 
                  key={section.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                >
                  <button
                    onClick={() => handleSectionToggle(section.id)}
                    className="w-full text-left p-4 flex items-center justify-between"
                    data-testid={`section-toggle-${section.id}`}
                  >
                    <span className="font-medium text-white">{section.title}</span>
                    <motion.div
                      animate={{ rotate: expandedSection === section.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    </motion.div>
                  </button>
                  
                  <AnimatePresence>
                    {expandedSection === section.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-white/5 pt-3">
                          {section.type === 'overview' && (
                            <p className="text-sm text-white/70 leading-relaxed">
                              {section.items[0]}
                            </p>
                          )}
                          
                          {section.type === 'services' && (
                            <ul className="space-y-2">
                              {section.items.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                  <span 
                                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: primaryColour }}
                                  />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          
                          {section.type === 'questions' && (
                            <ul className="space-y-2">
                              {section.items.map((item, i) => (
                                <li 
                                  key={i} 
                                  className="text-sm text-white/70 py-2 border-b border-white/5 last:border-0"
                                >
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                          
                          {section.type === 'next-steps' && (
                            <div className="space-y-3">
                              <p className="text-sm text-white/70">{section.items[0]}</p>
                              <button
                                onClick={onClaim}
                                className="w-full p-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                style={{
                                  backgroundColor: primaryColour,
                                  color: '#fff',
                                }}
                                data-testid="button-claim-inline"
                              >
                                Activate this Smart Site
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
              <button
                onClick={handleAskAboutService}
                className="w-full max-w-lg mx-auto block p-4 rounded-xl font-medium text-base transition-all shadow-2xl flex items-center justify-center gap-2"
                style={{
                  backgroundColor: `color-mix(in srgb, ${primaryColour} 15%, #1a1a1a)`,
                  border: `1px solid color-mix(in srgb, ${primaryColour} 40%, transparent)`,
                  color: '#fff',
                }}
                data-testid="button-single-ask"
              >
                <MessageCircle className="w-5 h-5" style={{ color: primaryColour }} />
                Ask about {brandName}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
