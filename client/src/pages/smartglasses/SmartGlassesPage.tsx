import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { HeroSection } from "./components/HeroSection";
import { QuickExplainersGrid } from "./components/QuickExplainersGrid";
import { AuditWizard } from "./components/AuditWizard";
import { QALibrary } from "./components/QALibrary";
import { CTASections } from "./components/CTASections";
import { SponsoredProductsGrid } from "./components/SponsoredProductsGrid";
import { BrandsGrid } from "./components/BrandsGrid";
import { FeaturedProductsGrid } from "./components/FeaturedProductsGrid";
import { StartHereGrid } from "./components/StartHereGrid";
import { CommunitiesSection } from "./components/CommunitiesSection";
import type { IndustryOrbitFrontPage } from "@/lib/types/industryOrbitFrontPage";

const ORBIT_SLUG = "smart-glasses";

export default function SmartGlassesPage() {
  const auditRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  const { data: frontPage, isLoading: frontPageLoading, error: frontPageError } = useQuery<IndustryOrbitFrontPage>({
    queryKey: ["/api/industry-orbits", ORBIT_SLUG, "front-page"],
    queryFn: async () => {
      const res = await fetch(`/api/industry-orbits/${ORBIT_SLUG}/front-page`);
      if (!res.ok) throw new Error("Failed to fetch front page");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  
  if (frontPageError) {
    console.error("Front page error:", frontPageError);
  }

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
      
      {frontPageLoading && (
        <section className="py-12 px-4 border-t border-zinc-800">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 bg-zinc-800 rounded" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-zinc-800 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      
      {frontPage && <BrandsGrid brands={frontPage.brands} />}
      
      {frontPage && <FeaturedProductsGrid products={frontPage.featuredProducts} />}
      
      {frontPage && <StartHereGrid startHere={frontPage.startHere} />}
      
      <QuickExplainersGrid />
      
      <div ref={auditRef}>
        <AuditWizard />
      </div>
      
      <div ref={qaRef}>
        <QALibrary />
      </div>
      
      {frontPage && (
        <CommunitiesSection 
          communities={frontPage.communities} 
          sources={frontPage.sources} 
        />
      )}
      
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
