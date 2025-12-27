import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardPlayer from "@/components/CardPlayer";
import { adaptPreviewToCards } from "./PreviewCardAdapter";
import { MessageCircle, ArrowRight, Sparkles, Shield, BarChart3, Palette } from "lucide-react";

interface CommonQuestion {
  question: string;
  contextPrompt: string;
}

interface ValidatedContent {
  overview: string;
  whatWeDo: string[];
  commonQuestions: CommonQuestion[];
  brandName: string;
  passed: boolean;
  issues: string[];
}

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
  validatedContent?: ValidatedContent;
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

function getValidatedContent(identity: SiteIdentity, fallbackBrandName: string): ValidatedContent | null {
  // Hard gate: No UI without validation
  if (!identity.validatedContent) {
    return null;
  }
  return identity.validatedContent;
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

  const fallbackBrandName = siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || siteTitle?.split(' - ')[0] || siteIdentity.sourceDomain;
  const validatedContent = getValidatedContent(siteIdentity, fallbackBrandName);
  
  // Gate on validation: if not passed, show failure state
  const validationPassed = validatedContent?.passed ?? false;
  const validationIssues = validatedContent?.issues ?? [];
  
  const brandName = validatedContent?.brandName ?? fallbackBrandName;
  const overview = validatedContent?.overview ?? '';
  const whatWeDo = validatedContent?.whatWeDo ?? [];
  const commonQuestions = validatedContent?.commonQuestions ?? [];
  
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
      {/* CINEMATIC MODE: Only show if validation passed */}
      <AnimatePresence mode="wait">
        {mode === 'cinematic' && validationPassed && heroCard && (
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
        
        {/* VALIDATION FAILURE: Skip cinematic, show failure immediately */}
        {mode === 'cinematic' && !validationPassed && (
          <motion.div
            key="validation-failure-immediate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: '#0a0a0a' }}
          >
            <div className="max-w-md p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-3">Content Validation Required</h2>
              <p className="text-sm text-white/60 mb-6 leading-relaxed">
                This site's content couldn't be fully validated. Smart Site experiences require verified content to ensure visitors receive accurate information.
              </p>
              {validationIssues.length > 0 && (
                <ul className="text-xs text-white/40 mb-6 space-y-1 text-left max-w-sm mx-auto">
                  {validationIssues.slice(0, 3).map((issue: string, i: number) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              )}
              <button
                onClick={handleAskGeneral}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition-colors text-white/80 flex items-center gap-2 mx-auto"
                data-testid="button-ask-anyway-cinematic"
              >
                <MessageCircle className="w-4 h-4" />
                Ask a question anyway
              </button>
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

            {/* HARD GATE: Show failure state if validation didn't pass */}
            {!validationPassed && (
              <div className="p-6 m-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <h2 className="font-medium text-amber-200">Content Validation Required</h2>
                </div>
                <p className="text-sm text-white/60 mb-4">
                  This site's content couldn't be fully validated for clarity and accuracy. 
                  The Smart Site experience requires verified content to ensure visitors get accurate information.
                </p>
                {validationIssues.length > 0 && (
                  <ul className="text-xs text-white/40 space-y-1 mb-4">
                    {validationIssues.slice(0, 3).map((issue: string, i: number) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={handleAskGeneral}
                  className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-white/80"
                  data-testid="button-ask-anyway"
                >
                  Ask a question anyway
                </button>
              </div>
            )}

            <div className="p-4 space-y-5">
              {/* Overview Block - Uses validated content */}
              {overview && (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">Overview</h2>
                  <p className="text-[15px] text-white/80 leading-relaxed">
                    {overview}
                  </p>
                </section>
              )}

              {/* What We Do Block - Uses validated human-readable content */}
              {whatWeDo.length > 0 && (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">What We Do</h2>
                  <ul className="space-y-2.5">
                    {whatWeDo.map((item: string, i: number) => (
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

            {/* Single AI Entry Point - Only show when validation passed */}
            {validationPassed && (
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
            )}

            {/* PLANE 2: OWNER ACTIVATION (Separate Layer) - Only show when validation passed */}
            {validationPassed && (
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
