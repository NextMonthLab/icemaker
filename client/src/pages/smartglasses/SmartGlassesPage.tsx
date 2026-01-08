import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "./components/HeroSection";
import { QuickExplainersGrid } from "./components/QuickExplainersGrid";
import { AuditWizard } from "./components/AuditWizard";
import { QALibrary } from "./components/QALibrary";
import { CTASections } from "./components/CTASections";
import { SponsoredProductsGrid } from "./components/SponsoredProductsGrid";

export default function SmartGlassesPage() {
  const auditRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qaId = params.get("qa");
    const answerId = params.get("answer");

    if (qaId && answerId) {
      setTimeout(() => {
        const answerEl = document.getElementById(`answer-${answerId}`);
        if (answerEl) {
          answerEl.scrollIntoView({ behavior: "smooth", block: "center" });
          answerEl.classList.add("ring-2", "ring-pink-500", "ring-offset-2", "ring-offset-black");
          setTimeout(() => {
            answerEl.classList.remove("ring-2", "ring-pink-500", "ring-offset-2", "ring-offset-black");
          }, 3000);
        }
      }, 500);
    }
  }, [location]);

  const scrollToAudit = () => {
    auditRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToQA = () => {
    qaRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <HeroSection onStartAudit={scrollToAudit} onExploreQuestions={scrollToQA} />
      
      <QuickExplainersGrid />
      
      <div ref={auditRef}>
        <AuditWizard />
      </div>
      
      <div ref={qaRef}>
        <QALibrary />
      </div>
      
      <CTASections />
      
      <SponsoredProductsGrid />
      
      <footer className="border-t border-zinc-800 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-zinc-500 text-sm">
          <p>Smart Glasses Discovery by NextMonth</p>
          <p className="mt-2">Editorial content is independent. Sponsored placements are clearly labelled.</p>
        </div>
      </footer>
    </div>
  );
}
