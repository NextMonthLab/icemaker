import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Play, ArrowRight, Flame, Loader2, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppContext } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import type { Universe, Card } from "@shared/schema";

export default function Home() {
  const { universe, setUniverse } = useAppContext();
  const { user } = useAuth();

  const { data: universes, isLoading: universesLoading } = useQuery({
    queryKey: ["universes"],
    queryFn: () => api.getUniverses(),
  });

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", universe?.id],
    queryFn: () => api.getCards(universe!.id),
    enabled: !!universe,
  });

  if (universesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // No universes at all
  if (!universes || universes.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-display font-bold mb-4">No Stories Yet</h2>
          <p className="text-muted-foreground mb-6">There are no stories available. Check back soon!</p>
          {user?.isAdmin && (
            <Link href="/admin">
              <Button>Go to Admin Panel</Button>
            </Link>
          )}
        </div>
      </Layout>
    );
  }

  // Multiple universes - show story picker
  if (universes.length > 1 && !universe) {
    return (
      <Layout>
        <div className="p-4 pt-8 md:p-8 space-y-6 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Choose Your Story</span>
            <h1 className="text-3xl font-display font-black">StoryFlix</h1>
          </div>

          <div className="grid gap-4 max-w-lg mx-auto">
            {universes.map((u) => (
              <UniverseCard 
                key={u.id} 
                universe={u} 
                onSelect={() => setUniverse(u)} 
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Auto-select first universe if none selected
  const activeUniverse = universe || universes[0];
  if (!universe && activeUniverse) {
    setUniverse(activeUniverse);
  }

  // Loading cards for selected universe
  if (cardsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Filter to only published cards with publishAt in the past (or null = publish immediately)
  const now = new Date();
  const availableCards = cards
    ?.filter(c => c.status === 'published' && (!c.publishAt || new Date(c.publishAt) <= now))
    .sort((a, b) => a.dayIndex - b.dayIndex) || [];

  if (availableCards.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">
            {cards && cards.length > 0 ? "Coming Soon" : "No Story Available"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {cards && cards.length > 0 
              ? "The first story drop hasn't been released yet. Check back soon!"
              : "There are no story cards for this universe yet."}
          </p>
          {universes.length > 1 && (
            <Button variant="outline" onClick={() => setUniverse(null as any)} className="mb-4">
              Choose Another Story
            </Button>
          )}
          {user?.isAdmin && (
            <Link href="/admin">
              <Button>Go to Admin Panel</Button>
            </Link>
          )}
        </div>
      </Layout>
    );
  }

  // Latest available card (highest day index that's been published)
  const todayCard = availableCards[availableCards.length - 1];
  const totalAvailable = availableCards.length;
  const catchUpCount = Math.max(0, totalAvailable - 1);

  return (
    <Layout>
      <div className="p-4 pt-8 md:p-8 space-y-8 animate-in fade-in duration-500">
        
        {/* Header with Progress */}
        <div className="flex justify-between items-start">
            <div className="space-y-1">
                <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase" data-testid="text-daily-drop">Daily Drop</span>
                <h1 className="text-3xl md:text-5xl font-display font-black text-foreground uppercase tracking-tight" data-testid="text-universe-name">
                  {activeUniverse.name}
                </h1>
                <span className="text-xs text-muted-foreground font-mono" data-testid="text-universe-debug">
                  ID: {activeUniverse.id} {activeUniverse.slug && `| Slug: ${activeUniverse.slug}`}
                </span>
            </div>
            <div className="flex flex-col items-center bg-card border border-border px-3 py-2 rounded-lg shadow-lg">
                <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
                <span className="text-xs font-bold font-mono mt-1" data-testid="text-streak">DAY {todayCard.dayIndex}</span>
            </div>
        </div>

        <p className="text-muted-foreground max-w-sm text-sm border-l-2 border-primary/50 pl-3 italic" data-testid="text-description">
            {activeUniverse.description}
        </p>

        {/* Today's Card Preview */}
        <div className="relative max-w-sm mx-auto group cursor-pointer mt-8">
             <Link href="/today">
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border-2 border-white/5 group-hover:border-primary/50 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-primary/20">
                    <img src={todayCard.imagePath || "/placeholder.jpg"} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/40 backdrop-blur-sm animate-pulse">
                            <Play className="w-6 h-6 text-white ml-1 fill-white" />
                        </div>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent pt-24">
                        <span className="inline-block px-2 py-0.5 mb-2 text-[10px] font-bold bg-primary text-white rounded uppercase tracking-wider shadow-lg">
                          {todayCard.dayIndex === 1 ? "Start Here" : "Latest Chapter"}
                        </span>
                        <h2 className="text-3xl font-display font-bold text-white mb-1 drop-shadow-md" data-testid="text-today-title">{todayCard.title}</h2>
                        <div className="flex items-center gap-2 text-white/80 text-xs font-medium tracking-wide">
                            <span>TAP TO WATCH</span>
                            <ArrowRight className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto pt-4">
            <Link href="/catch-up">
                <div className="p-4 rounded-lg bg-card/50 border border-border hover:bg-card hover:border-primary/50 transition-all cursor-pointer text-center group">
                    <span className="block text-2xl font-bold mb-1 group-hover:text-primary transition-colors" data-testid="text-missed-count">{catchUpCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Previous Cards</span>
                </div>
            </Link>
            {universes.length > 1 ? (
              <div 
                className="p-4 rounded-lg bg-card/50 border border-border hover:bg-card hover:border-primary/50 transition-all cursor-pointer text-center group"
                onClick={() => setUniverse(null as any)}
              >
                <span className="block text-2xl font-bold mb-1 group-hover:text-primary transition-colors">{universes.length}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">More Stories</span>
              </div>
            ) : (
              <a href="https://discord.com" target="_blank" rel="noreferrer">
                <div className="p-4 rounded-lg bg-card/50 border border-border hover:bg-[#5865F2]/10 hover:border-[#5865F2] transition-all cursor-pointer text-center group">
                    <span className="block text-2xl font-bold mb-1 group-hover:text-[#5865F2] transition-colors">👾</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Community</span>
                </div>
              </a>
            )}
        </div>

      </div>
    </Layout>
  );
}

function UniverseCard({ universe, onSelect }: { universe: Universe; onSelect: () => void }) {
  const { data: cards } = useQuery({
    queryKey: ["cards", universe.id],
    queryFn: () => api.getCards(universe.id),
  });

  const now = new Date();
  const availableCards = cards
    ?.filter(c => c.status === 'published' && c.publishAt && new Date(c.publishAt) <= now)
    .sort((a, b) => a.dayIndex - b.dayIndex) || [];

  const latestCard = availableCards[availableCards.length - 1];
  const totalDays = availableCards.length;

  return (
    <div 
      className="group cursor-pointer"
      onClick={onSelect}
      data-testid={`card-universe-${universe.id}`}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg border border-white/10 group-hover:border-primary/50 transition-all duration-300 group-hover:scale-[1.01]">
        {latestCard?.imagePath ? (
          <img 
            src={latestCard.imagePath} 
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1">
            {totalDays > 0 && (
              <span className="text-[10px] font-bold bg-primary/90 text-white px-2 py-0.5 rounded uppercase">
                {totalDays} {totalDays === 1 ? 'Day' : 'Days'} Available
              </span>
            )}
          </div>
          <h3 className="text-xl font-display font-bold text-white mb-1">{universe.name}</h3>
          <p className="text-white/70 text-xs line-clamp-2">{universe.description}</p>
        </div>

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
