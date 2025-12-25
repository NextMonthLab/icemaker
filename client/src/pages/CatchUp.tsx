import Layout from "@/components/Layout";
import { Link } from "wouter";
import { CheckCircle2, Lock, Loader2, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppContext } from "@/lib/app-context";
import { useLocalProgress } from "@/lib/local-progress";
import { useMemo } from "react";

export default function CatchUp() {
  const { universe } = useAppContext();
  const { getWatchedCards } = useLocalProgress();

  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed", universe?.id],
    queryFn: () => api.getFeed(universe!.id),
    enabled: !!universe,
  });

  if (!universe || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const visibleCards = feed?.cards.filter(c => c.isVisible) || [];
  const watchedCardIds = getWatchedCards(universe.id);
  
  // Sort by dayIndex ascending (earliest first)
  const sortedCards = [...visibleCards].sort((a, b) => a.dayIndex - b.dayIndex);

  // Find the next unwatched card index (users can only access watched cards or the next one)
  const nextUnwatchedIndex = useMemo(() => {
    for (let i = 0; i < sortedCards.length; i++) {
      if (!watchedCardIds.includes(sortedCards[i].id)) {
        return i;
      }
    }
    return sortedCards.length; // All watched
  }, [sortedCards, watchedCardIds]);

  if (sortedCards.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">No Cards Yet</h2>
          <p className="text-muted-foreground">Check back when the story begins.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 pt-8 md:p-8 max-w-md mx-auto animate-in fade-in duration-500">
        <div className="mb-6">
          <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Timeline</span>
          <h1 className="text-3xl font-display font-bold">{universe.name}</h1>
        </div>

        <div className="space-y-3">
          {sortedCards.map((card, index) => {
            const isWatched = watchedCardIds.includes(card.id);
            const imageUrl = card.generatedImageUrl || card.imagePath;
            const isAccessible = index <= nextUnwatchedIndex;
            const isNextToWatch = index === nextUnwatchedIndex && !isWatched;
            
            const cardElement = (
              <div 
                className={`group relative flex gap-4 p-3 rounded-lg border transition-colors overflow-hidden ${
                  isAccessible 
                    ? "border-border bg-card hover:bg-accent/5 cursor-pointer" 
                    : "border-border/30 bg-card/30 opacity-50 cursor-not-allowed"
                }`}
                data-testid={`card-timeline-${card.id}`}
              >
                <div className="w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-black relative">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={card.title}
                      className={`w-full h-full object-cover transition-all ${isAccessible ? 'opacity-70 group-hover:opacity-100' : 'opacity-40'}`}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10" />
                  )}
                  
                  {isAccessible && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center">
                        <Play className="w-3 h-3 text-white ml-0.5 fill-white" />
                      </div>
                    </div>
                  )}
                  
                  {!isAccessible && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-white/50" />
                    </div>
                  )}
                  
                  {isWatched && (
                    <div className="absolute top-1 right-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500 drop-shadow" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold tracking-wider uppercase ${isAccessible ? 'text-primary' : 'text-muted-foreground'}`}>
                      Day {card.dayIndex}
                    </span>
                    {isNextToWatch && (
                      <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded uppercase font-bold">
                        Start Here
                      </span>
                    )}
                  </div>
                  <h3 className={`text-lg font-display font-bold mb-1 truncate ${isAccessible ? 'group-hover:text-primary transition-colors' : 'text-muted-foreground'}`}>
                    {card.title}
                  </h3>
                  {card.recapText && isAccessible && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{card.recapText}</p>
                  )}
                </div>
              </div>
            );
            
            return isAccessible ? (
              <Link key={card.id} href={`/card/${card.id}`}>
                {cardElement}
              </Link>
            ) : (
              <div key={card.id}>{cardElement}</div>
            );
          })}
        </div>

        {/* Locked future cards preview */}
        {feed?.lockedCount && feed.lockedCount > 0 && (
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-bold">
                {feed.lockedCount} more {feed.lockedCount === 1 ? 'card' : 'cards'} coming
              </span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
