import Layout from "@/components/Layout";
import CardPlayer from "@/components/CardPlayer";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppContext } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";

export default function Today() {
  const { universe } = useAppContext();
  const { user } = useAuth();

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", universe?.id],
    queryFn: () => api.getCards(universe!.id),
    enabled: !!universe,
  });

  const { data: progress } = useQuery({
    queryKey: ["progress", universe?.id],
    queryFn: () => api.getProgress(universe!.id),
    enabled: !!universe && !!user,
  });

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

  const unlocked = progress?.unlockedDayIndex ?? 0;
  const currentCard = cards.find(c => c.dayIndex === Math.max(1, unlocked));
  const card = currentCard || cards[0];

  return (
    <Layout>
      <div className="p-4 pb-24 md:p-8 max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* The Card Player */}
        <CardPlayer card={{
          id: card.id.toString(),
          dayIndex: card.dayIndex,
          title: card.title,
          image: card.imagePath || "",
          captions: card.captionsJson || [],
          sceneText: card.sceneText,
          recapText: card.recapText,
          publishDate: card.publishAt?.toISOString() || new Date().toISOString(),
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
