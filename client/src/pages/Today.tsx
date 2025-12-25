import Layout from "@/components/Layout";
import CardPlayer from "@/components/CardPlayer";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppContext } from "@/lib/app-context";
import { useState } from "react";

export default function Today() {
  const { universe } = useAppContext();
  const params = useParams<{ id?: string }>();
  const cardIdFromUrl = params.id ? parseInt(params.id) : null;

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", universe?.id],
    queryFn: () => api.getCards(universe!.id),
    enabled: !!universe,
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!universe || cardsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">No Cards Available</h2>
          <p className="text-muted-foreground">There are no story cards for this universe yet.</p>
        </div>
      </Layout>
    );
  }

  // Filter to only published cards with publishAt in the past (or null = publish immediately)
  const now = new Date();
  const availableCards = cards
    .filter(c => c.status === 'published' && (!c.publishAt || new Date(c.publishAt) <= now))
    .sort((a, b) => a.dayIndex - b.dayIndex);

  if (availableCards.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Coming Soon</h2>
          <p className="text-muted-foreground">The first story drop hasn't been released yet. Check back soon!</p>
        </div>
      </Layout>
    );
  }

  // If viewing a specific card by ID
  let cardIndex = selectedIndex;
  if (cardIdFromUrl) {
    const idx = availableCards.findIndex(c => c.id === cardIdFromUrl);
    if (idx !== -1) cardIndex = idx;
  }
  if (cardIndex === null) {
    // Default to the latest (highest day index) available card
    cardIndex = availableCards.length - 1;
  }

  const card = availableCards[cardIndex];
  const hasPrev = cardIndex > 0;
  const hasNext = cardIndex < availableCards.length - 1;

  return (
    <Layout>
      <div className="p-4 pb-24 md:p-8 max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Debug: Show active universe */}
        <div className="text-xs text-muted-foreground font-mono" data-testid="text-universe-debug">
          Universe: {universe.name} | ID: {universe.id} {universe.slug && `| Slug: ${universe.slug}`}
        </div>
        
        {/* Navigation */}
        {availableCards.length > 1 && (
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedIndex(cardIndex! - 1)}
              disabled={!hasPrev}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {cardIndex! + 1} of {availableCards.length}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedIndex(cardIndex! + 1)}
              disabled={!hasNext}
              className="gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* The Card Player */}
        <CardPlayer card={{
          id: card.id.toString(),
          dayIndex: card.dayIndex,
          title: card.title,
          image: card.imagePath || "",
          captions: card.captionsJson || [],
          sceneText: card.sceneText,
          recapText: card.recapText,
          publishDate: card.publishAt ? String(card.publishAt) : new Date().toISOString(),
        }} />

        {/* Scene Text */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-display font-bold" data-testid="text-card-title">{card.title}</h1>
                <span className="text-xs font-mono text-muted-foreground" data-testid="text-day-index">DAY {card.dayIndex}</span>
            </div>
            
            <p className="text-lg leading-relaxed text-muted-foreground font-serif border-l-2 border-primary pl-4 italic" data-testid="text-scene">
                "{card.sceneText}"
            </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3">
            <Link href="/chat">
                <Button size="lg" className="w-full gap-2 text-md py-6 font-display" data-testid="button-chat">
                    <MessageSquare className="w-5 h-5" />
                    Chat with Character
                </Button>
            </Link>
            
            <Button variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5" data-testid="button-save">
                <Download className="w-4 h-4" />
                Save Video Clip
            </Button>
        </div>

      </div>
    </Layout>
  );
}
