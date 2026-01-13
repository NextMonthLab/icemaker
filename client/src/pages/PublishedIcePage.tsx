import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Home, AlertCircle, ChevronLeft, ChevronRight, Volume2, VolumeX, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CardPlayer from "@/components/CardPlayer";
import { InteractivityNode, StoryCharacter } from "@/components/InteractivityNode";
import GlobalNav from "@/components/GlobalNav";

interface PreviewCard {
  id: string;
  title: string;
  content: string;
  order: number;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  narrationAudioUrl?: string;
  mediaAssets?: any[];
  selectedMediaAssetId?: string;
}

interface InteractivityNodeData {
  id: string;
  afterCardIndex: number;
  isActive: boolean;
  selectedCharacterId?: string;
}

export default function PublishedIcePage() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number | null>(null);
  const [narrationMuted, setNarrationMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  const { data: ice, isLoading, error } = useQuery({
    queryKey: ["/api/ice/s", shareSlug],
    queryFn: async () => {
      const res = await fetch(`/api/ice/s/${shareSlug}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("This ICE is not available");
        throw new Error("Failed to load ICE");
      }
      return res.json();
    },
    enabled: !!shareSlug,
  });

  const cards: PreviewCard[] = ice?.cards || [];
  const characters: StoryCharacter[] = (ice?.characters || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    description: c.description,
    openingMessage: c.openingMessage,
    systemPrompt: c.systemPrompt,
  }));
  const interactivityNodes: InteractivityNodeData[] = ice?.interactivityNodes || [];

  useEffect(() => {
    if (ice?.musicEnabled && ice?.musicTrackUrl) {
      setMusicEnabled(true);
    }
  }, [ice]);

  useEffect(() => {
    if (musicEnabled && ice?.musicTrackUrl && isPlaying) {
      if (!musicAudioRef.current) {
        musicAudioRef.current = new Audio(ice.musicTrackUrl);
        musicAudioRef.current.loop = true;
        musicAudioRef.current.volume = (ice.musicVolume || 50) / 100;
      }
      musicAudioRef.current.play().catch(console.error);
    } else if (musicAudioRef.current) {
      musicAudioRef.current.pause();
    }

    return () => {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    };
  }, [musicEnabled, isPlaying, ice?.musicTrackUrl, ice?.musicVolume]);

  const handleNext = () => {
    if (currentCardIndex < cards.length - 1) {
      const nodeAtCurrentCard = interactivityNodes.find(n => n.afterCardIndex === currentCardIndex);
      if (nodeAtCurrentCard && activeNodeIndex !== currentCardIndex) {
        setActiveNodeIndex(currentCardIndex);
      } else {
        setActiveNodeIndex(null);
        setCurrentCardIndex(prev => prev + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentCardIndex > 0) {
      setActiveNodeIndex(null);
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const handleCardComplete = () => {
    const nodeAtCurrentCard = interactivityNodes.find(n => n.afterCardIndex === currentCardIndex);
    if (nodeAtCurrentCard) {
      setActiveNodeIndex(currentCardIndex);
    } else if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-white/60">Loading experience...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Experience Not Found</h2>
          <p className="text-white/60 mb-6">
            {(error as Error).message || "This experience may have been removed or is no longer public."}
          </p>
          <Link href="/">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isPlaying) {
    const firstCard = cards[0];
    const backgroundImage = firstCard?.generatedImageUrl || "/placeholder-dark.jpg";

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
        
        <div className="relative z-10 text-center max-w-lg px-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">{ice?.title || "Untitled Experience"}</h1>
          <p className="text-white/60 mb-8">
            {cards.length} cards • Interactive experience
          </p>
          <Button 
            onClick={() => setIsPlaying(true)}
            size="lg"
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-8 py-6 text-lg"
            data-testid="button-start-experience"
          >
            <Play className="w-6 h-6 mr-2" />
            Start Experience
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const nodeAtCurrentCard = interactivityNodes.find(n => n.afterCardIndex === currentCardIndex);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCardIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <CardPlayer
                card={{
                  id: currentCard.id,
                  title: currentCard.title,
                  image: currentCard.generatedImageUrl || "/placeholder-dark.jpg",
                  captions: [currentCard.content],
                  sceneText: currentCard.content,
                  recapText: currentCard.title,
                  publishDate: new Date().toISOString(),
                  dayIndex: currentCardIndex,
                  narrationAudioUrl: currentCard.narrationAudioUrl,
                  generatedVideoUrl: currentCard.generatedVideoUrl,
                }}
                currentCardIndex={currentCardIndex}
                totalCards={cards.length}
                onNext={handleNext}
                onPrev={handlePrev}
                onCardPhaseComplete={handleCardComplete}
                narrationMuted={narrationMuted}
                narrationVolume={ice?.narrationVolume || 100}
              />
            </motion.div>
          </AnimatePresence>

          {activeNodeIndex !== null && nodeAtCurrentCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <InteractivityNode
                nodeId={nodeAtCurrentCard.id}
                afterCardIndex={nodeAtCurrentCard.afterCardIndex}
                previewId={ice?.id || ""}
                isActive={true}
                onActivate={() => {}}
                onRemove={() => {}}
                characters={characters}
                selectedCharacterId={nodeAtCurrentCard.selectedCharacterId}
              />
              <div className="flex justify-center mt-4">
                <Button
                  onClick={() => {
                    setActiveNodeIndex(null);
                    if (currentCardIndex < cards.length - 1) {
                      setCurrentCardIndex(prev => prev + 1);
                    }
                  }}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  data-testid="button-continue"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60">
              {currentCardIndex + 1} / {cards.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNarrationMuted(!narrationMuted)}
                className="h-8 w-8 text-white/60 hover:text-white"
                data-testid="button-toggle-narration"
              >
                {narrationMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              {ice?.musicTrackUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`h-8 w-8 ${musicEnabled ? "text-cyan-400" : "text-white/60 hover:text-white"}`}
                  data-testid="button-toggle-music"
                >
                  <Music className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              disabled={currentCardIndex === 0}
              className="h-8 w-8 text-white/60 hover:text-white disabled:opacity-30"
              data-testid="button-prev-card"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={currentCardIndex === cards.length - 1 && activeNodeIndex === null}
              className="h-8 w-8 text-white/60 hover:text-white disabled:opacity-30"
              data-testid="button-next-card"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
