import { useState, useRef, useEffect } from "react";
import { StoryCard, StoryCardData } from "./StoryCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
}

interface StoryModeProps {
  siteIdentity: SiteIdentity;
  siteTitle: string | null;
  siteSummary: string | null;
  onAskAbout: (prompt: string) => void;
  onClaim: () => void;
}

function buildStoryCards(identity: SiteIdentity, siteTitle: string | null, siteSummary: string | null): StoryCardData[] {
  const cards: StoryCardData[] = [];
  const primaryColour = identity.primaryColour || '#7c3aed';

  const headline = identity.heroHeadline || siteTitle || identity.sourceDomain;
  const description = identity.heroDescription || siteSummary || '';
  const firstSentence = description.split(/[.!?]/)[0]?.trim();

  cards.push({
    id: 'identity',
    type: 'identity',
    headline: headline,
    support: firstSentence || undefined,
    imageUrl: identity.heroImageUrl,
    primaryColour,
    contextualPrompt: `Tell me more about ${identity.title?.split(' - ')[0] || identity.sourceDomain}`
  });

  const sentences = description.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 20);
  const tensionSentence = sentences.find(s => 
    /shouldn't|struggle|challenge|problem|difficult|confus|overwhelm|stress|worry|fear|risk/i.test(s)
  ) || sentences[1];

  if (tensionSentence) {
    cards.push({
      id: 'tension',
      type: 'tension',
      headline: tensionSentence.length > 80 ? tensionSentence.substring(0, 77) + '...' : tensionSentence,
      support: sentences[2] || undefined,
      primaryColour,
      contextualPrompt: "What problems do you solve?"
    });
  }

  if (identity.serviceHeadings.length > 0) {
    const topServices = identity.serviceHeadings.slice(0, 4);
    cards.push({
      id: 'services',
      type: 'services',
      headline: "What we do",
      pills: topServices,
      primaryColour,
      contextualPrompt: `What does ${topServices[0]} include?`
    });
  }

  const whyHeading = identity.serviceHeadings.find(h => 
    /why|about|approach|difference|values|mission/i.test(h)
  );
  if (whyHeading) {
    cards.push({
      id: 'why',
      type: 'why',
      headline: whyHeading,
      support: identity.serviceBullets[0] || undefined,
      primaryColour,
      contextualPrompt: "What makes you different?"
    });
  }

  if (identity.faqCandidates.length > 0) {
    cards.push({
      id: 'faq',
      type: 'faq',
      headline: "Common questions",
      faqItems: identity.faqCandidates.slice(0, 3),
      primaryColour
    });
  }

  cards.push({
    id: 'cta',
    type: 'cta',
    headline: "Ready to activate?",
    support: "Keep this Smart Site live and capture the leads it uncovers.",
    primaryColour,
    ctaText: "Claim and activate"
  });

  return cards;
}

export function StoryMode({ siteIdentity, siteTitle, siteSummary, onAskAbout, onClaim }: StoryModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cards = buildStoryCards(siteIdentity, siteTitle, siteSummary);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.offsetWidth;
      const newIndex = Math.round(scrollLeft / cardWidth);
      setCurrentIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCard = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth = container.offsetWidth;
    container.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  };

  const goNext = () => {
    if (currentIndex < cards.length - 1) {
      scrollToCard(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      scrollToCard(currentIndex - 1);
    }
  };

  return (
    <div className="relative w-full" data-testid="story-mode">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ 
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {cards.map((card, i) => (
          <div 
            key={card.id} 
            className="w-full flex-shrink-0 h-[70vh] min-h-[400px] max-h-[600px]"
            style={{ scrollSnapAlign: 'center' }}
          >
            <StoryCard
              card={card}
              onAskAbout={onAskAbout}
              onCta={onClaim}
              isLast={i === cards.length - 1}
            />
          </div>
        ))}
      </div>

      {cards.length > 1 && (
        <>
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/60 transition-all z-10"
            data-testid="story-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === cards.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/60 transition-all z-10"
            data-testid="story-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToCard(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentIndex 
                ? 'bg-white w-6' 
                : 'bg-white/40 hover:bg-white/60'
            }`}
            data-testid={`story-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}
