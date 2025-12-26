import { useParams, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import CardPlayer from "@/components/CardPlayer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Experience() {
  const { slug } = useParams<{ slug: string }>();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const embedMode = params.get("embed") === "true";
  const startCard = params.get("card") ? parseInt(params.get("card")!) : undefined;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data: storyData, isLoading } = useQuery({
    queryKey: ["story-by-slug", slug],
    queryFn: () => api.getStoryBySlug(slug!),
    enabled: !!slug,
  });

  const universe = storyData?.universe;
  const availableCards = storyData?.cards || [];
  const allCharacters = storyData?.characters || [];
  const creator = storyData?.creator;

  const cardIndex = useMemo(() => {
    if (selectedIndex !== null) return selectedIndex;
    if (startCard) {
      const idx = availableCards.findIndex(c => c.dayIndex === startCard);
      if (idx !== -1) return idx;
    }
    return 0;
  }, [selectedIndex, startCard, availableCards]);

  const currentCard = availableCards[cardIndex];

  const { data: cardCharacters } = useQuery({
    queryKey: ["card-characters", currentCard?.id],
    queryFn: () => api.getCardCharacters(currentCard!.id),
    enabled: !!currentCard,
  });

  const handleNavigate = useCallback((direction: "prev" | "next") => {
    if (direction === "prev" && cardIndex > 0) {
      setSelectedIndex(cardIndex - 1);
    } else if (direction === "next" && cardIndex < availableCards.length - 1) {
      setSelectedIndex(cardIndex + 1);
    }
  }, [cardIndex, availableCards.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold text-white mb-2">Story Not Found</h1>
        <p className="text-white/60">This experience doesn't exist or has been removed.</p>
      </div>
    );
  }

  if (availableCards.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold text-white mb-2">{universe.name}</h1>
        <p className="text-white/60">This story is coming soon.</p>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formattedCard = {
    id: String(currentCard.id),
    dayIndex: currentCard.dayIndex,
    title: currentCard.title,
    image: currentCard.generatedImageUrl || currentCard.imagePath || "",
    captions: currentCard.captionsJson || [],
    sceneText: currentCard.sceneText,
    recapText: currentCard.recapText,
    publishDate: currentCard.publishAt ? new Date(currentCard.publishAt).toISOString() : new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-black" data-testid="experience-page">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative h-screen"
        >
          <CardPlayer
            card={formattedCard}
            characters={cardCharacters || allCharacters || []}
            fullScreen={true}
          />
          
          {availableCards.length > 1 && (
            <>
              {cardIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 z-50"
                  onClick={() => handleNavigate("prev")}
                  data-testid="button-prev-card"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              {cardIndex < availableCards.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 z-50"
                  onClick={() => handleNavigate("next")}
                  data-testid="button-next-card"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      
      {embedMode && (
        <div className="fixed bottom-2 right-2 text-xs text-white/50 bg-black/50 px-2 py-1 rounded z-50">
          Powered by NextScene
        </div>
      )}
      
      {creator && (
        <div className="fixed bottom-4 left-4 z-50" data-testid="creator-attribution">
          {creator.slug ? (
            <Link href={`/creator/${creator.slug}`}>
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full hover:bg-black/80 transition-colors cursor-pointer">
                <Avatar className="h-6 w-6 border border-white/20">
                  <AvatarImage src={creator.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs"><User className="w-3 h-3" /></AvatarFallback>
                </Avatar>
                <div className="text-white">
                  <span className="text-xs font-medium">{creator.displayName}</span>
                  {creator.headline && (
                    <span className="text-white/50 text-[10px] ml-1 hidden sm:inline">{creator.headline}</span>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full">
              <Avatar className="h-6 w-6 border border-white/20">
                <AvatarImage src={creator.avatarUrl || undefined} />
                <AvatarFallback className="text-xs"><User className="w-3 h-3" /></AvatarFallback>
              </Avatar>
              <span className="text-white text-xs font-medium">{creator.displayName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
