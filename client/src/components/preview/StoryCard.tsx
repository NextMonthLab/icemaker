import { MessageCircle, ChevronRight } from "lucide-react";

export interface StoryCardData {
  id: string;
  type: 'identity' | 'tension' | 'services' | 'why' | 'faq' | 'cta';
  headline: string;
  support?: string;
  imageUrl?: string | null;
  primaryColour: string;
  pills?: string[];
  faqItems?: string[];
  ctaText?: string;
  contextualPrompt?: string;
}

interface StoryCardProps {
  card: StoryCardData;
  onAskAbout?: (prompt: string) => void;
  onCta?: () => void;
  isLast?: boolean;
}

export function StoryCard({ card, onAskAbout, onCta, isLast }: StoryCardProps) {
  const backgroundStyle = card.imageUrl
    ? {
        background: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%), url(${card.imageUrl}) center/cover no-repeat`
      }
    : {
        background: `linear-gradient(135deg, ${card.primaryColour}60 0%, ${card.primaryColour}30 40%, #0a0a0a 100%)`
      };

  return (
    <div
      className="w-full h-full flex-shrink-0 snap-center relative flex flex-col justify-end"
      style={backgroundStyle}
      data-testid={`story-card-${card.id}`}
    >
      <div className="p-6 pb-8 space-y-4">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight tracking-wide drop-shadow-lg">
          {card.headline}
        </h2>

        {card.support && (
          <p className="text-base text-white/90 leading-relaxed max-w-lg drop-shadow">
            {card.support}
          </p>
        )}

        {card.pills && card.pills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {card.pills.map((pill, i) => (
              <span
                key={i}
                className="px-3 py-1.5 text-sm font-medium rounded-full bg-white/15 text-white backdrop-blur-sm border border-white/20"
              >
                {pill}
              </span>
            ))}
          </div>
        )}

        {card.faqItems && card.faqItems.length > 0 && (
          <div className="space-y-2">
            {card.faqItems.map((faq, i) => (
              <button
                key={i}
                onClick={() => onAskAbout?.(faq)}
                className="w-full text-left px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium flex items-center justify-between hover:bg-white/20 transition-colors"
                data-testid={`story-faq-${i}`}
              >
                <span>{faq}</span>
                <ChevronRight className="w-4 h-4 opacity-60" />
              </button>
            ))}
          </div>
        )}

        {card.type === 'cta' && card.ctaText && onCta && (
          <button
            onClick={onCta}
            className="w-full px-6 py-4 rounded-xl bg-white text-black font-semibold text-base hover:bg-white/90 transition-colors"
            data-testid="story-cta-claim"
          >
            {card.ctaText}
          </button>
        )}

        {card.contextualPrompt && card.type !== 'cta' && card.type !== 'faq' && (
          <button
            onClick={() => onAskAbout?.(card.contextualPrompt!)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white text-sm font-medium hover:bg-white/25 transition-colors"
            data-testid={`story-ask-${card.id}`}
          >
            <MessageCircle className="w-4 h-4" />
            Ask about this
          </button>
        )}

        {isLast && card.type !== 'cta' && (
          <div className="pt-2">
            <button
              onClick={() => {
                document.getElementById('smart-site-scaffold')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 text-white/70 text-sm hover:text-white transition-colors"
              data-testid="story-explore-more"
            >
              <span>Explore the full Smart Site</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
