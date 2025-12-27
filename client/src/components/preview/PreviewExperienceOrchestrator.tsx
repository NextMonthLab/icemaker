import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardPlayer from "@/components/CardPlayer";
import { adaptPreviewToCards } from "./PreviewCardAdapter";
import { MessageCircle, ArrowRight, Sparkles, Shield, BarChart3, Palette } from "lucide-react";

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

interface CommonQuestion {
  question: string;
  contextPrompt: string;
}

function generateCommonQuestions(identity: SiteIdentity, brandName: string): CommonQuestion[] {
  const questions: CommonQuestion[] = [];
  
  if (identity.faqCandidates.length > 0) {
    identity.faqCandidates.slice(0, 4).forEach((faq) => {
      const cleanQuestion = faq.replace(/\?+$/, '').trim();
      if (cleanQuestion.length > 10 && cleanQuestion.length < 120) {
        questions.push({
          question: cleanQuestion.endsWith('?') ? cleanQuestion : `${cleanQuestion}?`,
          contextPrompt: `Answer this question about ${brandName}: ${cleanQuestion}. Keep it concise and helpful.`,
        });
      }
    });
  }
  
  if (questions.length < 3 && identity.serviceHeadings.length > 0) {
    const service = identity.serviceHeadings[0];
    questions.push({
      question: `What does ${service} involve?`,
      contextPrompt: `Explain what ${service} involves for ${brandName}. Be specific and helpful.`,
    });
  }
  
  if (questions.length < 4) {
    questions.push({
      question: `How do I get started with ${brandName}?`,
      contextPrompt: `Explain how someone can get started working with ${brandName}. Focus on next steps.`,
    });
  }
  
  return questions.slice(0, 4);
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

  const brandName = siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || siteTitle?.split(' - ')[0] || siteIdentity.sourceDomain;
  const commonQuestions = generateCommonQuestions(siteIdentity, brandName);
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

  const handleQuestionTap = useCallback((question: CommonQuestion) => {
    onAskAbout(question.contextPrompt);
  }, [onAskAbout]);

  const handleAskGeneral = useCallback(() => {
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
            style={{ background: '#0a0a0a' }}
          >
            {/* PLANE 1: VISITOR EXPERIENCE */}
            <header className="p-5 pt-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                {(siteIdentity.logoUrl || siteIdentity.faviconUrl) && (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 bg-white/[0.06] border border-white/[0.1]">
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
                  <p className="text-xs text-white/40">{siteIdentity.sourceDomain}</p>
                </div>
              </div>
            </header>

            <div className="p-4 space-y-5">
              {/* Overview Block */}
              {(siteIdentity.heroDescription || siteSummary) && (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">Overview</h2>
                  <p className="text-[15px] text-white/80 leading-relaxed">
                    {siteIdentity.heroDescription || siteSummary}
                  </p>
                </section>
              )}

              {/* What We Do Block */}
              {(siteIdentity.serviceHeadings.length > 0 || siteIdentity.serviceBullets.length > 0) && (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">What We Do</h2>
                  <ul className="space-y-2.5">
                    {(siteIdentity.serviceHeadings.length > 0 
                      ? siteIdentity.serviceHeadings.slice(0, 6) 
                      : siteIdentity.serviceBullets.slice(0, 6)
                    ).map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[15px] text-white/75">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Common Questions Block - AI TRIGGERS */}
              {commonQuestions.length > 0 && (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">Common Questions</h2>
                  <div className="space-y-2">
                    {commonQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuestionTap(q)}
                        className="w-full text-left p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all flex items-center justify-between gap-3 group"
                        data-testid={`question-trigger-${i}`}
                      >
                        <span className="text-[15px] text-white/75 group-hover:text-white/90 transition-colors">
                          {q.question}
                        </span>
                        <MessageCircle className="w-4 h-4 text-white/30 group-hover:text-white/60 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Single AI Entry Point */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/95 to-transparent">
              <button
                onClick={handleAskGeneral}
                className="w-full max-w-lg mx-auto block p-4 rounded-xl font-medium text-base transition-all shadow-2xl flex items-center justify-center gap-2 bg-white/[0.08] border border-white/[0.15] hover:bg-white/[0.12] hover:border-white/[0.25] text-white"
                data-testid="button-single-ask"
              >
                <MessageCircle className="w-5 h-5 text-white/60" />
                Ask about {brandName}
              </button>
            </div>

            {/* PLANE 2: OWNER ACTIVATION (Separate Layer) */}
            <div className="mt-16 mx-4 mb-8">
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent mb-8" />
              
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-white/50" />
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">For Business Owners</span>
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">Own this Smart Site</h3>
                <p className="text-sm text-white/50 mb-5">
                  This page is powered by a Smart Site. Activate it to unlock full control.
                </p>
                
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02]">
                    <Palette className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white/70">Brand Matching</p>
                      <p className="text-[11px] text-white/40">Your colours, your voice</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02]">
                    <Shield className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white/70">AI Safeguards</p>
                      <p className="text-[11px] text-white/40">Control what AI says</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02]">
                    <BarChart3 className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white/70">Insights</p>
                      <p className="text-[11px] text-white/40">What customers ask</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02]">
                    <MessageCircle className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white/70">24/7 Leads</p>
                      <p className="text-[11px] text-white/40">Capture enquiries always</p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={onClaim}
                  className="w-full p-3.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90"
                  data-testid="button-activate-smartsite"
                >
                  Activate this Smart Site
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
