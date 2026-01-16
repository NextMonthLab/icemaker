import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Play, Home, AlertCircle, ChevronLeft, ChevronRight, Volume2, VolumeX, Music, Mail, ArrowRight, Heart, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CardPlayer from "@/components/CardPlayer";
import { InteractivityNode, StoryCharacter } from "@/components/InteractivityNode";
import type { CaptionState } from "@/caption-engine/schemas";
import GlobalNav from "@/components/GlobalNav";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { useCardReadiness, usePreloadNextCard, TRANSITION_CONFIG } from "@/hooks/useCardReadiness";

interface ReadyCardPlayerProps {
  card: PreviewCard;
  cardIndex: number;
  narrationMuted: boolean;
  narrationVolume: number;
  icePreviewId?: string;
  captionState?: CaptionState;
  onReady: () => void;
}

function MediaPreloader({ 
  card, 
  onReady 
}: { card: PreviewCard; onReady: () => void }) {
  const hasMedia = !!(card.generatedImageUrl || card.generatedVideoUrl);
  const preferVideo = !!card.generatedVideoUrl;
  
  const { markMounted } = useCardReadiness({
    imageUrl: card.generatedImageUrl,
    videoUrl: card.generatedVideoUrl,
    preferVideo,
    onReady,
  });

  useEffect(() => {
    if (hasMedia) {
      markMounted();
    } else {
      onReady();
    }
  }, [hasMedia, markMounted, onReady]);

  return null;
}

function VisibleCardPlayer({ 
  card, 
  cardIndex, 
  narrationMuted, 
  narrationVolume, 
  icePreviewId,
  captionState,
}: Omit<ReadyCardPlayerProps, 'onReady'>) {
  // Use pre-parsed captions if available, otherwise split content into sentences
  const captions = card.captions && card.captions.length > 0 
    ? card.captions 
    : card.content.split('. ').filter(s => s.trim()).map(s => s.endsWith('.') ? s : s + '.');
  
  return (
    <CardPlayer
      card={{
        id: card.id,
        title: card.title,
        image: card.generatedImageUrl || "/placeholder-dark.jpg",
        captions,
        sceneText: card.content,
        recapText: card.title,
        publishDate: new Date().toISOString(),
        dayIndex: cardIndex,
        narrationAudioUrl: card.narrationAudioUrl,
        generatedVideoUrl: card.generatedVideoUrl,
        captionTimings: card.captionTimings,
      }}
      narrationMuted={narrationMuted}
      narrationVolume={narrationVolume}
      icePreviewId={icePreviewId}
      captionState={captionState}
    />
  );
}

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
  captions?: string[]; // Pre-parsed captions if available
  captionTimings?: any[]; // Timing data for captions
}

interface InteractivityNodeData {
  id: string;
  afterCardIndex: number;
  isActive: boolean;
  selectedCharacterId?: string;
}

export default function PublishedIcePage() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number | null>(null);
  const [narrationMuted, setNarrationMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadError, setLeadError] = useState("");

  const handleCloseICE = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
    if (user && ice?.id) {
      setLocation(`/ice/preview/${ice.id}`);
    } else {
      setLocation("/");
    }
  };

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

  const leadMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", `/api/ice/s/${shareSlug}/lead`, { email });
      return response.json();
    },
    onSuccess: () => {
      setLeadCaptured(true);
      setLeadError("");
      sessionStorage.setItem(`ice_lead_${shareSlug}`, "true");
      setIsPlaying(true);
    },
    onError: (error: Error) => {
      setLeadError(error.message || "Failed to submit email");
    },
  });

  const { data: likeStatus } = useQuery<{ liked: boolean; likeCount: number }>({
    queryKey: ["ice-like", ice?.id],
    queryFn: async () => {
      const res = await fetch(`/api/ice/preview/${ice!.id}/like`, { credentials: "include" });
      if (!res.ok) return { liked: false, likeCount: ice?.likeCount || 0 };
      return res.json();
    },
    enabled: !!ice?.id && !!user,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ice/preview/${ice!.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to like");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ice-like", ice?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/ice/s", shareSlug] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ice/preview/${ice!.id}/like`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unlike");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ice-like", ice?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/ice/s", shareSlug] });
    },
  });

  const handleToggleLike = () => {
    if (!user) {
      toast({ title: "Sign in to like", description: "Create an account to like and save ICEs" });
      return;
    }
    if (likeStatus?.liked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail || !leadEmail.includes("@")) {
      setLeadError("Please enter a valid email address");
      return;
    }
    leadMutation.mutate(leadEmail);
  };

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
  
  const requiresLeadGate = ice?.leadGateEnabled && !leadCaptured && !sessionStorage.getItem(`ice_lead_${shareSlug}`);

  const [displayedCardIndex, setDisplayedCardIndex] = useState(0);
  const [pendingCardIndex, setPendingCardIndex] = useState<number | null>(null);
  const pendingReadyRef = useRef(false);
  
  usePreloadNextCard(cards, displayedCardIndex);
  
  const handleCardReady = useCallback(() => {
    if (pendingCardIndex !== null && !pendingReadyRef.current) {
      pendingReadyRef.current = true;
      setTimeout(() => {
        setDisplayedCardIndex(pendingCardIndex);
        setPendingCardIndex(null);
        pendingReadyRef.current = false;
      }, TRANSITION_CONFIG.readyDelay);
    }
  }, [pendingCardIndex]);
  
  const navigateToCard = useCallback((targetIndex: number) => {
    if (pendingCardIndex !== null) return;
    if (targetIndex >= 0 && targetIndex < cards.length && targetIndex !== displayedCardIndex) {
      pendingReadyRef.current = false;
      setPendingCardIndex(targetIndex);
    }
  }, [pendingCardIndex, cards.length, displayedCardIndex]);
  
  const nextCard = pendingCardIndex !== null ? cards[pendingCardIndex] : null;

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
    if (pendingCardIndex !== null) return;
    if (displayedCardIndex < cards.length - 1) {
      const nodeAtCard = interactivityNodes.find(n => n.afterCardIndex === displayedCardIndex);
      if (nodeAtCard && activeNodeIndex !== displayedCardIndex) {
        setActiveNodeIndex(displayedCardIndex);
      } else {
        setActiveNodeIndex(null);
        navigateToCard(displayedCardIndex + 1);
      }
    }
  };

  const handlePrev = () => {
    if (pendingCardIndex !== null) return;
    if (displayedCardIndex > 0) {
      setActiveNodeIndex(null);
      navigateToCard(displayedCardIndex - 1);
    }
  };

  const handleCardComplete = () => {
    const nodeAtCard = interactivityNodes.find(n => n.afterCardIndex === displayedCardIndex);
    if (nodeAtCard) {
      setActiveNodeIndex(displayedCardIndex);
    } else if (displayedCardIndex < cards.length - 1) {
      navigateToCard(displayedCardIndex + 1);
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
          
          {requiresLeadGate ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 max-w-sm mx-auto"
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">
                  {ice?.leadGatePrompt || "Enter your email to continue watching"}
                </span>
              </div>
              <form onSubmit={handleLeadSubmit} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  data-testid="input-lead-email"
                />
                {leadError && (
                  <p className="text-red-400 text-sm">{leadError}</p>
                )}
                <Button 
                  type="submit"
                  disabled={leadMutation.isPending}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
                  data-testid="button-submit-lead"
                >
                  {leadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          ) : (
            <Button 
              onClick={() => setIsPlaying(true)}
              size="lg"
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-8 py-6 text-lg"
              data-testid="button-start-experience"
            >
              <Play className="w-6 h-6 mr-2" />
              Start Experience
            </Button>
          )}
        </div>
      </div>
    );
  }

  const displayedCard = cards[displayedCardIndex];
  const nodeAtDisplayedCard = interactivityNodes.find(n => n.afterCardIndex === displayedCardIndex);

  const cardTransitionVariants = {
    initial: { opacity: 0, x: 30, scale: 0.98 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -30, scale: 0.98 },
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative">
      {/* Close button - top left */}
      <button
        onClick={handleCloseICE}
        className="fixed top-4 left-4 z-50 p-2.5 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-colors"
        data-testid="button-close-ice"
        title={user ? "Return to editor" : "Go to homepage"}
      >
        <X className="w-5 h-5 text-white" />
      </button>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md relative">
          {nextCard && (
            <MediaPreloader
              card={nextCard}
              onReady={handleCardReady}
            />
          )}
          
          <AnimatePresence mode="wait">
            <motion.div
              key={displayedCardIndex}
              variants={cardTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ 
                duration: TRANSITION_CONFIG.duration, 
                ease: TRANSITION_CONFIG.ease,
              }}
              className="will-change-transform"
            >
              <VisibleCardPlayer
                card={displayedCard}
                cardIndex={displayedCardIndex}
                narrationMuted={narrationMuted}
                narrationVolume={ice?.narrationVolume || 100}
                icePreviewId={ice?.id}
                captionState={ice?.captionSettings as CaptionState | undefined}
              />
            </motion.div>
          </AnimatePresence>

          {activeNodeIndex !== null && nodeAtDisplayedCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <InteractivityNode
                nodeId={nodeAtDisplayedCard.id}
                afterCardIndex={nodeAtDisplayedCard.afterCardIndex}
                previewId={ice?.id || ""}
                isActive={true}
                onActivate={() => {}}
                onRemove={() => {}}
                characters={characters}
                selectedCharacterId={nodeAtDisplayedCard.selectedCharacterId}
              />
              <div className="flex justify-center mt-4">
                <Button
                  onClick={() => {
                    setActiveNodeIndex(null);
                    if (displayedCardIndex < cards.length - 1) {
                      navigateToCard(displayedCardIndex + 1);
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
        <div className="max-w-md mx-auto space-y-3">
          {ice?.creator && (
            <div className="flex items-center justify-between">
              <Link href={ice.creator.slug ? `/creator/${ice.creator.slug}` : "#"}>
                <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer" data-testid="link-creator">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={ice.creator.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-cyan-500 to-blue-600">
                      {ice.creator.displayName?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-white/80">{ice.creator.displayName}</span>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleLike}
                disabled={likeMutation.isPending || unlikeMutation.isPending}
                className={`gap-1.5 ${likeStatus?.liked ? "text-red-400 hover:text-red-300" : "text-white/60 hover:text-white"}`}
                data-testid="button-like"
              >
                <Heart className={`w-4 h-4 ${likeStatus?.liked ? "fill-current" : ""}`} />
                <span className="text-xs">{likeStatus?.likeCount ?? ice?.likeCount ?? 0}</span>
              </Button>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/60">
                {displayedCardIndex + 1} / {cards.length}
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
                disabled={displayedCardIndex === 0 || pendingCardIndex !== null}
                className="h-8 w-8 text-white/60 hover:text-white disabled:opacity-30"
                data-testid="button-prev-card"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={(displayedCardIndex === cards.length - 1 && activeNodeIndex === null) || pendingCardIndex !== null}
                className="h-8 w-8 text-white/60 hover:text-white disabled:opacity-30"
                data-testid="button-next-card"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
