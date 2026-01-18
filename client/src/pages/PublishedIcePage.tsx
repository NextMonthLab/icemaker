import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Play, Home, AlertCircle, ChevronLeft, ChevronRight, Volume2, VolumeX, Music, Mail, ArrowRight, Heart, X, Sparkles, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import icemakerLogo from "@assets/icemaker-logo.png";
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
  // Determine active media: check mediaAssets/selectedMediaAssetId first, then fall back to legacy fields
  const selectedAsset = card.mediaAssets?.find(a => a.id === card.selectedMediaAssetId);
  const videoAsset = card.mediaAssets?.find(a => a.kind === 'video' && a.status === 'ready');
  const imageAsset = card.mediaAssets?.find(a => a.kind === 'image' && a.status === 'ready');
  
  // Active media priority: selected asset > video asset > image asset > legacy fields
  const activeVideoUrl = selectedAsset?.kind === 'video' ? selectedAsset.url : 
    (videoAsset?.url || card.generatedVideoUrl);
  const activeImageUrl = selectedAsset?.kind === 'image' ? selectedAsset.url : 
    (imageAsset?.url || card.generatedImageUrl);
  
  const hasMedia = !!(activeImageUrl || activeVideoUrl);
  const preferVideo = !!activeVideoUrl;
  
  const { markMounted } = useCardReadiness({
    imageUrl: activeImageUrl,
    videoUrl: activeVideoUrl,
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
  onCardComplete,
}: Omit<ReadyCardPlayerProps, 'onReady'> & { onCardComplete?: () => void }) {
  // Use pre-parsed captions if available, otherwise split content into sentences
  const captions = card.captions && card.captions.length > 0 
    ? card.captions 
    : card.content.split('. ').filter(s => s.trim()).map(s => s.endsWith('.') ? s : s + '.');
  
  // When phase changes to context, auto-advance to next card (showcase mode)
  const handlePhaseChange = useCallback((phase: "cinematic" | "context") => {
    if (phase === "context" && onCardComplete) {
      onCardComplete();
    }
  }, [onCardComplete]);
  
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
        mediaAssets: card.mediaAssets,
        selectedMediaAssetId: card.selectedMediaAssetId,
        mediaSegments: card.mediaSegments,
        cinematicContinuationEnabled: card.cinematicContinuationEnabled,
        continuationImageUrl: card.continuationImageUrl,
        videoDurationSec: card.videoDurationSec,
        narrationDurationSec: card.narrationDurationSec,
      }}
      narrationMuted={narrationMuted}
      narrationVolume={narrationVolume}
      icePreviewId={icePreviewId}
      captionState={captionState}
      onPhaseChange={handlePhaseChange}
      fullScreen={true}
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
  mediaSegments?: any[];
  captions?: string[]; // Pre-parsed captions if available
  captionTimings?: any[]; // Timing data for captions
  cinematicContinuationEnabled?: boolean;
  continuationImageUrl?: string;
  videoDurationSec?: number;
  narrationDurationSec?: number;
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
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [completedNodeId, setCompletedNodeId] = useState<string | null>(null);

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

  // Create a stable signature of interactivity nodes to detect changes
  const nodesSignature = useMemo(() => {
    const nodes = ice?.interactivityNodes || [];
    return nodes.map((n: InteractivityNodeData) => `${n.id}:${n.afterCardIndex}`).join("|");
  }, [ice?.interactivityNodes]);

  // Reset end screen and node completion state when switching experiences or when nodes change
  useEffect(() => {
    setShowEndScreen(false);
    setCompletedNodeId(null);
    setActiveNodeIndex(null);
  }, [shareSlug, ice?.id, nodesSignature]);

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
        // Default music volume is quiet (15%) so narration is clearly audible
        musicAudioRef.current.volume = (ice.musicVolume ?? 15) / 100;
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
    
    // Don't allow advancing while interactivity node is active - user must use Continue button
    if (activeNodeIndex !== null) return;
    
    const nodeAtCard = interactivityNodes.find(n => n.afterCardIndex === displayedCardIndex);
    
    if (displayedCardIndex < cards.length - 1) {
      if (nodeAtCard) {
        setActiveNodeIndex(displayedCardIndex);
      } else {
        navigateToCard(displayedCardIndex + 1);
      }
    } else if (displayedCardIndex === cards.length - 1 && !showEndScreen) {
      // On the last card - check for interactivity node first
      // Only bypass if this specific node was completed
      if (nodeAtCard && completedNodeId !== nodeAtCard.id) {
        // Show the creator's CTA/interactivity node first
        setActiveNodeIndex(displayedCardIndex);
      } else {
        // No node or node already completed - show IceMaker end screen
        setShowEndScreen(true);
      }
    }
  };

  const handlePrev = () => {
    if (pendingCardIndex !== null) return;
    if (showEndScreen) {
      // Go back from end screen to last card - reset completion so node shows again
      setShowEndScreen(false);
      setCompletedNodeId(null);
    } else if (displayedCardIndex > 0) {
      setActiveNodeIndex(null);
      // If leaving the last card, reset completion state
      if (displayedCardIndex === cards.length - 1) {
        setCompletedNodeId(null);
      }
      navigateToCard(displayedCardIndex - 1);
    }
  };

  const handleCardComplete = () => {
    const nodeAtCard = interactivityNodes.find(n => n.afterCardIndex === displayedCardIndex);
    if (nodeAtCard) {
      // Show interactivity node (creator's CTA)
      setActiveNodeIndex(displayedCardIndex);
    } else if (displayedCardIndex < cards.length - 1) {
      navigateToCard(displayedCardIndex + 1);
    } else {
      // Last card completed - auto-show IceMaker end screen
      setShowEndScreen(true);
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
        {/* Dramatic background with blur and gradient */}
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 blur-sm"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-zinc-950/70" />
        
        {/* Animated glow effect */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <div className="relative z-10 text-center max-w-lg px-4">
          {/* IceMaker Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
              data-testid="link-icemaker-logo"
            >
              <img 
                src={icemakerLogo} 
                alt="IceMaker" 
                className="h-12 sm:h-16 mx-auto drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]"
              />
            </a>
          </motion.div>
          
          {/* Title with dramatic styling */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight"
          >
            {ice?.title || "Untitled Experience"}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-cyan-300/80 mb-10 text-lg"
          >
            {cards.length} cards • Interactive experience
          </motion.p>
          
          {requiresLeadGate ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-zinc-900/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-6 max-w-sm mx-auto shadow-[0_0_60px_rgba(34,211,238,0.15)]"
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
                  className="bg-zinc-800/80 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="input-lead-email"
                />
                {leadError && (
                  <p className="text-red-400 text-sm">{leadError}</p>
                )}
                <Button 
                  type="submit"
                  disabled={leadMutation.isPending}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25"
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button 
                onClick={() => setIsPlaying(true)}
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-10 py-7 text-xl font-semibold rounded-2xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105"
                data-testid="button-start-experience"
              >
                <Play className="w-7 h-7 mr-3 fill-current" />
                Start Experience
              </Button>
            </motion.div>
          )}
          
          {/* Powered by IceMaker footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 text-white/40 text-sm"
          >
            Powered by IceMaker
          </motion.div>
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
    <div className="h-[100dvh] bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Close button - top left */}
      <button
        onClick={handleCloseICE}
        className="fixed top-2 sm:top-4 left-2 sm:left-4 z-50 p-2 sm:p-2.5 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-colors"
        data-testid="button-close-ice"
        title={user ? "Return to editor" : "Go to homepage"}
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </button>
      
      <div className="flex-1 flex items-center justify-center p-1 sm:p-4 min-h-0">
        <div className="w-full max-h-full sm:h-auto sm:max-w-md relative flex items-center justify-center">
          {nextCard && !showEndScreen && (
            <MediaPreloader
              card={nextCard}
              onReady={handleCardReady}
            />
          )}
          
          <AnimatePresence mode="wait">
            {showEndScreen ? (
              <motion.div
                key="end-screen"
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
                {/* IceMaker End Screen CTA */}
                <div className="aspect-[9/16] bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-xl overflow-hidden flex flex-col items-center justify-center p-8 text-center border border-cyan-500/20">
                  {/* IceMaker Logo */}
                  <div className="mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">IceMaker</h2>
                    <p className="text-cyan-400 text-sm mt-1">Interactive Content Experiences</p>
                  </div>
                  
                  {/* Messaging */}
                  <div className="space-y-4 mb-8">
                    <p className="text-white/80 text-lg leading-relaxed">
                      Discover more cinematic experiences like this one
                    </p>
                    <p className="text-white/60 text-sm">
                      Create your own interactive stories with AI-generated visuals, narration, and engaging characters
                    </p>
                  </div>
                  
                  {/* CTAs */}
                  <div className="space-y-3 w-full max-w-xs">
                    <Link href="/try">
                      <Button 
                        className="w-full gap-2" 
                        variant="default"
                        data-testid="button-create-your-own"
                      >
                        <Sparkles className="w-4 h-4" />
                        Create Your Own
                      </Button>
                    </Link>
                    <Link href="/">
                      <Button 
                        variant="ghost" 
                        className="w-full gap-2"
                        data-testid="button-explore-more"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Explore More
                      </Button>
                    </Link>
                  </div>
                  
                  {/* Replay option */}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowEndScreen(false);
                      setCompletedNodeId(null); // Reset so creator CTA shows again on replay
                      navigateToCard(0);
                    }}
                    className="mt-8 gap-2"
                    data-testid="button-replay"
                  >
                    <Play className="w-4 h-4" />
                    Replay Experience
                  </Button>
                </div>
              </motion.div>
            ) : (
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
              className="will-change-transform w-full max-h-full sm:h-auto sm:max-w-md"
            >
              <VisibleCardPlayer
                card={displayedCard}
                cardIndex={displayedCardIndex}
                narrationMuted={narrationMuted}
                narrationVolume={ice?.narrationVolume || 100}
                icePreviewId={ice?.id}
                captionState={ice?.captionSettings as CaptionState | undefined}
                onCardComplete={handleCardComplete}
              />
            </motion.div>
            )}
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
                    } else {
                      // Last card interactivity completed - mark node id and show IceMaker end screen
                      setCompletedNodeId(nodeAtDisplayedCard.id);
                      setShowEndScreen(true);
                    }
                  }}
                  variant="default"
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

      <div className="shrink-0 p-2 sm:p-4 bg-zinc-900/80 backdrop-blur-sm border-t border-zinc-800 safe-area-bottom">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between gap-2">
            {/* Card counter + controls */}
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-white/60 font-medium">
                {showEndScreen ? "End" : `${displayedCardIndex + 1}/${cards.length}`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNarrationMuted(!narrationMuted)}
                  className="h-7 w-7 sm:h-8 sm:w-8 text-white/60 hover:text-white"
                  data-testid="button-toggle-narration"
                >
                  {narrationMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </Button>
                {ice?.musicTrackUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMusicEnabled(!musicEnabled)}
                    className={`h-7 w-7 sm:h-8 sm:w-8 ${musicEnabled ? "text-cyan-400" : "text-white/60 hover:text-white"}`}
                    data-testid="button-toggle-music"
                  >
                    <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Creator attribution (compact on mobile) */}
            {ice?.creator && (
              <Link href={ice.creator.slug ? `/creator/${ice.creator.slug}` : "#"} className="hidden sm:block">
                <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer" data-testid="link-creator">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={ice.creator.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px] bg-gradient-to-br from-cyan-500 to-blue-600">
                      {ice.creator.displayName?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white/60">{ice.creator.displayName}</span>
                </div>
              </Link>
            )}
            
            {/* Navigation arrows */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                disabled={(displayedCardIndex === 0 && !showEndScreen) || pendingCardIndex !== null}
                className="h-7 w-7 sm:h-8 sm:w-8 text-white/60 hover:text-white disabled:opacity-30"
                data-testid="button-prev-card"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={showEndScreen || pendingCardIndex !== null}
                className="h-7 w-7 sm:h-8 sm:w-8 text-white/60 hover:text-white disabled:opacity-30"
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
