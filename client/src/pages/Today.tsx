import Layout from "@/components/Layout";
import CardPlayer from "@/components/CardPlayer";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppContext } from "@/lib/app-context";
import { useState, useMemo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocalProgress } from "@/lib/local-progress";

export default function Today() {
  const { universe } = useAppContext();
  const params = useParams<{ id?: string }>();
  const cardIdFromUrl = params.id ? parseInt(params.id) : null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const { getNextUnwatchedIndex, markCardWatched, hasWatchedCard } = useLocalProgress();

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", universe?.id],
    queryFn: () => api.getCards(universe!.id),
    enabled: !!universe,
  });

  const availableCards = useMemo(() => {
    if (!cards) return [];
    const now = new Date();
    return cards
      .filter(c => c.status === 'published' && (!c.publishAt || new Date(c.publishAt) <= now))
      .sort((a, b) => a.dayIndex - b.dayIndex);
  }, [cards]);

  // Determine starting index: URL param > selected > next unwatched > first card
  const cardIndex = useMemo(() => {
    if (selectedIndex !== null) return selectedIndex;
    if (cardIdFromUrl) {
      const idx = availableCards.findIndex(c => c.id === cardIdFromUrl);
      if (idx !== -1) return idx;
    }
    // Start at next unwatched card (sequential progress)
    if (universe && availableCards.length > 0) {
      return getNextUnwatchedIndex(universe.id, availableCards);
    }
    return 0;
  }, [selectedIndex, cardIdFromUrl, availableCards, universe, getNextUnwatchedIndex]);

  const currentCard = availableCards[cardIndex];

  const { data: cardCharacters } = useQuery({
    queryKey: ["card-characters", currentCard?.id],
    queryFn: () => api.getCardCharacters(currentCard!.id),
    enabled: !!currentCard,
  });

  const handlePhaseChange = useCallback((phase: "cinematic" | "context") => {
    // Mark card as watched when reaching context phase
    if (phase === "context" && universe && currentCard) {
      markCardWatched(universe.id, currentCard.id);
    }
  }, [universe, currentCard, markCardWatched]);

  const handleNavigate = useCallback((direction: "prev" | "next") => {
    if (direction === "prev" && cardIndex > 0) {
      setSelectedIndex(cardIndex - 1);
      setIsFullScreen(true);
    } else if (direction === "next" && cardIndex < availableCards.length - 1) {
      setSelectedIndex(cardIndex + 1);
      setIsFullScreen(true);
    }
  }, [cardIndex, availableCards.length]);

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

  const card = currentCard;
  const hasPrev = cardIndex > 0;
  
  // Only allow forward navigation if current card has been watched
  const currentCardWatched = universe && currentCard ? hasWatchedCard(universe.id, currentCard.id) : false;
  const hasNext = cardIndex < availableCards.length - 1 && currentCardWatched;

  return (
    <>
      {/* Full-screen overlay for cinematic mode */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            data-testid="fullscreen-player"
          >
            {/* Close button */}
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
              data-testid="button-close-fullscreen"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation arrows */}
            {hasPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); handleNavigate("prev"); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
                data-testid="button-prev-fullscreen"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={(e) => { e.stopPropagation(); handleNavigate("next"); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
                data-testid="button-next-fullscreen"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Card counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/60 text-sm font-mono">
              {cardIndex + 1} / {availableCards.length}
            </div>

            {/* Full-screen card player */}
            <div className="w-full h-full">
              <CardPlayer 
                card={{
                  id: card.id.toString(),
                  dayIndex: card.dayIndex,
                  title: card.title,
                  image: card.generatedImageUrl || card.imagePath || "",
                  captions: card.captionsJson || [],
                  sceneText: card.sceneText,
                  recapText: card.recapText,
                  publishDate: card.publishAt ? String(card.publishAt) : new Date().toISOString(),
                }} 
                characters={cardCharacters || []}
                onPhaseChange={handlePhaseChange}
                fullScreen
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regular layout view */}
      <Layout>
        <div className="p-4 pb-24 md:p-8 max-w-md mx-auto space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Navigation */}
          {availableCards.length > 1 && (
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleNavigate("prev")}
                disabled={!hasPrev}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {cardIndex + 1} of {availableCards.length}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleNavigate("next")}
                disabled={!hasNext}
                className="gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Card preview - tap to go full screen */}
          <div 
            onClick={() => setIsFullScreen(true)}
            className="cursor-pointer"
          >
            <CardPlayer 
              card={{
                id: card.id.toString(),
                dayIndex: card.dayIndex,
                title: card.title,
                image: card.generatedImageUrl || card.imagePath || "",
                captions: card.captionsJson || [],
                sceneText: card.sceneText,
                recapText: card.recapText,
                publishDate: card.publishAt ? String(card.publishAt) : new Date().toISOString(),
              }} 
              characters={cardCharacters || []}
              autoplay={false}
              onPhaseChange={handlePhaseChange}
            />
          </div>

          {/* Actions below card */}
          <div className="pt-2">
            <Button variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5" data-testid="button-save">
              <Download className="w-4 h-4" />
              Save Video Clip
            </Button>
          </div>

        </div>
      </Layout>
    </>
  );
}
