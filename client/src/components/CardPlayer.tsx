import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { MessageSquare, ChevronUp, Share2, BookOpen, RotateCcw, Volume2, VolumeX, Film, Image, Play, Pause } from "lucide-react";
import { Link, useLocation } from "wouter";
import MessageBoard from "@/components/MessageBoard";

function useIsTabletLandscape() {
  const [isTabletLandscape, setIsTabletLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;
      const isTabletSize = width >= 768 && width <= 1366;
      setIsTabletLandscape(isLandscape && isTabletSize);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  return isTabletLandscape;
}

interface Character {
  id: number;
  name: string;
  avatar?: string | null;
}

interface BrandPreferences {
  accentColor: string;
  theme: 'dark' | 'light';
  selectedLogo: string | null;
  selectedImages: string[];
}

export type CardFont = 'cinzel' | 'playfair' | 'inter' | 'oswald' | 'dancing' | 'bebas';

export const CARD_FONTS: { id: CardFont; name: string; fontFamily: string }[] = [
  { id: 'cinzel', name: 'Cinzel', fontFamily: '"Cinzel", serif' },
  { id: 'playfair', name: 'Playfair', fontFamily: '"Playfair Display", serif' },
  { id: 'inter', name: 'Inter', fontFamily: '"Inter", sans-serif' },
  { id: 'oswald', name: 'Oswald', fontFamily: '"Oswald", sans-serif' },
  { id: 'dancing', name: 'Dancing Script', fontFamily: '"Dancing Script", cursive' },
  { id: 'bebas', name: 'Bebas Neue', fontFamily: '"Bebas Neue", sans-serif' },
];

export const CARD_COLORS = [
  { id: 'white', name: 'White', value: '#ffffff' },
  { id: 'gold', name: 'Gold', value: '#ffd700' },
  { id: 'pink', name: 'Pink', value: '#ec4899' },
  { id: 'purple', name: 'Purple', value: '#a855f7' },
  { id: 'cyan', name: 'Cyan', value: '#06b6d4' },
  { id: 'green', name: 'Green', value: '#22c55e' },
];

interface CardPlayerProps {
  card: Card;
  autoplay?: boolean;
  characters?: Character[];
  onChatClick?: (characterId: number) => void;
  onPhaseChange?: (phase: "cinematic" | "context") => void;
  fullScreen?: boolean;
  brandPreferences?: BrandPreferences | null;
  font?: CardFont;
  fontColor?: string;
}

type Phase = "cinematic" | "context";

export default function CardPlayer({ 
  card, 
  autoplay = true, 
  characters = [],
  onChatClick,
  onPhaseChange,
  fullScreen = false,
  brandPreferences,
  font = 'cinzel',
  fontColor = '#ffffff'
}: CardPlayerProps) {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("cinematic");
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [dismissedRotateHint, setDismissedRotateHint] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isTabletLandscape = useIsTabletLandscape();
  
  const theme = brandPreferences?.theme || 'dark';
  const accentColor = brandPreferences?.accentColor || '#ffffff';
  const bgColor = theme === 'dark' ? '#0a0a0a' : '#f5f5f5';
  const textColor = theme === 'dark' ? 'white' : '#1a1a1a';
  const mutedTextColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  
  const selectedFontFamily = CARD_FONTS.find(f => f.id === font)?.fontFamily || CARD_FONTS[0].fontFamily;
  
  const getActiveMedia = () => {
    if (card.mediaAssets?.length && card.selectedMediaAssetId) {
      const selected = card.mediaAssets.find(a => a.id === card.selectedMediaAssetId);
      if (selected && selected.status === 'ready') {
        return {
          imageUrl: selected.kind === 'image' ? selected.url : card.image,
          videoUrl: selected.kind === 'video' ? selected.url : card.generatedVideoUrl,
        };
      }
    }
    return {
      imageUrl: card.image,
      videoUrl: card.generatedVideoUrl,
    };
  };
  
  const activeMedia = getActiveMedia();
  
  const hasNarration = card.narrationEnabled && card.narrationStatus === "ready" && card.narrationAudioUrl;
  const hasVideo = card.videoGenerated && activeMedia.videoUrl && card.videoGenerationStatus === "completed";
  const hasImage = !!activeMedia.imageUrl;
  const hasBothMediaTypes = hasImage && hasVideo;

  // Reset all state when card changes
  useEffect(() => {
    setPhase("cinematic");
    setCaptionIndex(0);
    setShowSwipeHint(false);
    setIsPlaying(autoplay);
    // Use preferred media type from card settings, fallback to video if available
    const useVideo = card.preferredMediaType === 'video' ? hasVideo : false;
    setShowVideo(!!useVideo);
    
    // Stop any playing audio when card changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioProgress(0);
    setAudioDuration(0);
    setIsAudioPlaying(false);
    // Stop any playing video when card changes
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [card.id, autoplay, hasVideo]);
  
  const toggleMediaType = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowVideo(prev => !prev);
  }, []);
  
  // Play/pause audio based on phase
  useEffect(() => {
    if (!hasNarration || !audioRef.current) return;
    
    if (phase === "cinematic" && isPlaying && !audioMuted) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [phase, isPlaying, hasNarration, audioMuted]);
  
  const toggleAudioMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAudioMuted(prev => !prev);
  }, []);
  
  const toggleAudioPlayback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasNarration) return;
    
    // Toggle isPlaying to sync captions and audio
    setIsPlaying(prev => {
      const newPlaying = !prev;
      if (audioRef.current) {
        if (newPlaying) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
      return newPlaying;
    });
  }, [hasNarration]);
  
  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setAudioProgress(audioRef.current.currentTime);
    }
  }, []);
  
  const handleAudioLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  }, []);
  
  const handleAudioPlay = useCallback(() => {
    setIsAudioPlaying(true);
  }, []);
  
  const handleAudioPause = useCallback(() => {
    setIsAudioPlaying(false);
  }, []);
  
  const handleAudioEnded = useCallback(() => {
    setIsAudioPlaying(false);
    setAudioProgress(0);
  }, []);
  
  const seekAudio = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !audioDuration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audioRef.current.currentTime = percentage * audioDuration;
  }, [audioDuration]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const advanceToContext = useCallback(() => {
    setPhase("context");
    onPhaseChange?.("context");
  }, [onPhaseChange]);

  const resetToCinematic = useCallback(() => {
    setShowSwipeHint(false);
    setPhase("cinematic");
    setCaptionIndex(0);
    setIsPlaying(true);
    onPhaseChange?.("cinematic");
  }, [onPhaseChange]);

  useEffect(() => {
    if (!isPlaying || phase !== "cinematic") return;

    const captionInterval = setInterval(() => {
      setCaptionIndex((prev) => {
        const next = prev + 1;
        if (next >= card.captions.length) {
          setShowSwipeHint(true);
          return prev;
        }
        return next;
      });
    }, 3000);

    return () => clearInterval(captionInterval);
  }, [isPlaying, card.captions.length, phase]);

  useEffect(() => {
    if (showSwipeHint) {
      const timeout = setTimeout(() => {
        advanceToContext();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [showSwipeHint, advanceToContext]);

  const handleTap = () => {
    if (phase === "cinematic") {
      advanceToContext();
    }
  };

  const primaryCharacter = characters[0];

  // Force 9:16 portrait aspect ratio on all devices for consistent mobile-first experience
  const containerClass = fullScreen
    ? "relative h-full max-h-screen aspect-[9/16] mx-auto overflow-hidden"
    : "relative w-full aspect-[9/16] overflow-hidden rounded-2xl shadow-2xl";

  return (
    <div 
      className={containerClass}
      style={{ 
        backgroundColor: bgColor,
        border: fullScreen ? 'none' : `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
      }}
      onClick={handleTap}
      data-testid="card-player"
    >
      <AnimatePresence mode="wait">
        {phase === "cinematic" ? (
          <motion.div
            key="cinematic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            {fullScreen && isTabletLandscape && !dismissedRotateHint && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 text-white/90 text-sm"
                onClick={(e) => { e.stopPropagation(); setDismissedRotateHint(true); }}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Rotate for best view</span>
                <button className="ml-2 text-white/60 hover:text-white">&times;</button>
              </motion.div>
            )}
            <motion.div 
              className="absolute inset-0 w-full h-full flex items-center justify-center"
              initial={{ scale: 1 }}
              animate={{ scale: isPlaying && !isTabletLandscape && !showVideo ? 1.15 : 1 }}
              transition={{ duration: 20, ease: "linear" }}
            >
              {showVideo && hasVideo ? (
                <video
                  ref={videoRef}
                  src={activeMedia.videoUrl!}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  data-testid="video-player"
                />
              ) : activeMedia.imageUrl ? (
                <img
                  src={activeMedia.imageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/40 via-background to-primary/20" />
              )}
            </motion.div>

            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <span className="text-xs font-mono text-white/60 bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                DAY {card.dayIndex}
              </span>
              <div className="flex items-center gap-2">
                {hasBothMediaTypes && (
                  <button
                    onClick={toggleMediaType}
                    className="p-2 bg-black/30 rounded-full backdrop-blur-sm hover:bg-black/50 transition-colors flex items-center gap-1"
                    data-testid="button-toggle-media"
                  >
                    {showVideo ? (
                      <>
                        <Image className="w-4 h-4 text-white/70" />
                        <span className="text-xs text-white/70">Image</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-4 h-4 text-white/70" />
                        <span className="text-xs text-white/70">Video</span>
                      </>
                    )}
                  </button>
                )}
                {hasNarration && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleAudioPlayback}
                      className="p-2 bg-black/30 rounded-full backdrop-blur-sm hover:bg-black/50 transition-colors"
                      data-testid="button-toggle-audio-playback"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 text-white/70" />
                      ) : (
                        <Play className="w-4 h-4 text-white/70" />
                      )}
                    </button>
                    <button
                      onClick={toggleAudioMute}
                      className="p-2 bg-black/30 rounded-full backdrop-blur-sm hover:bg-black/50 transition-colors"
                      data-testid="button-toggle-audio"
                    >
                      {audioMuted ? (
                        <VolumeX className="w-4 h-4 text-white/70" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-white/70" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {hasNarration && audioDuration > 0 && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer z-20"
                onClick={seekAudio}
                data-testid="audio-progress-bar"
              >
                <motion.div 
                  className="h-full bg-white/80"
                  style={{ width: `${(audioProgress / audioDuration) * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
                {isAudioPlaying && (
                  <motion.div
                    className="absolute right-2 bottom-2 flex items-center gap-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="text-[10px] text-white/60 font-mono">
                      {Math.floor(audioProgress)}s / {Math.floor(audioDuration)}s
                    </span>
                  </motion.div>
                )}
              </div>
            )}
            
            {hasNarration && (
              <audio
                ref={audioRef}
                src={card.narrationAudioUrl!}
                preload="auto"
                muted={audioMuted}
                className="hidden"
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onEnded={handleAudioEnded}
                data-testid="audio-narration-player"
              />
            )}

            <div className={`absolute inset-x-0 bottom-0 top-16 flex flex-col justify-end ${fullScreen ? 'p-8 pb-24' : 'p-6 pb-16'}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={captionIndex}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="flex items-center justify-center max-h-[60%] overflow-hidden"
                >
                  {captionIndex < card.captions.length ? (
                    <p 
                      className={`font-bold text-center leading-snug px-4 tracking-wide ${
                        card.captions[captionIndex].length > 100 
                          ? (fullScreen ? 'text-xl md:text-2xl' : 'text-lg md:text-xl')
                          : card.captions[captionIndex].length > 50 
                            ? (fullScreen ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl')
                            : (fullScreen ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl')
                      }`}
                      style={{ 
                        textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                        fontFamily: selectedFontFamily,
                        color: fontColor
                      }}
                    >
                      {card.captions[captionIndex]}
                    </p>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            {showSwipeHint && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1"
              >
                <motion.div
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  <ChevronUp className="w-6 h-6 text-white/80" />
                </motion.div>
                <span className="text-xs text-white/60">Tap to continue</span>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="context"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative overflow-hidden shrink-0 ${fullScreen && isTabletLandscape ? 'h-1/3 flex items-center justify-center bg-black' : 'h-2/5'}`}>
              {activeMedia.imageUrl ? (
                <img
                  src={activeMedia.imageUrl}
                  alt={card.title}
                  className={fullScreen && isTabletLandscape 
                    ? "max-w-full max-h-full object-contain"
                    : "w-full h-full object-cover"}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/40 via-background to-primary/20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
              
              <button
                onClick={resetToCinematic}
                className="absolute top-3 left-3 text-xs text-white/70 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/60 transition-colors flex items-center gap-1"
                data-testid="button-replay"
              >
                ↺ Replay
              </button>
            </div>

            <div className="flex-1 min-h-0 bg-gradient-to-b from-black via-zinc-900 to-zinc-900 p-5 pb-28 flex flex-col overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs font-mono text-primary/80 tracking-widest">DAY {card.dayIndex}</span>
                  <h2 className="text-xl font-display font-bold text-white mt-1 tracking-wide" data-testid="context-title">
                    {card.title}
                  </h2>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {card.sceneText && (
                <p className="text-sm text-white/70 leading-relaxed mb-4 italic border-l-2 border-primary/50 pl-3">
                  "{card.sceneText}"
                </p>
              )}

              <div className="flex-1" />

              {primaryCharacter ? (
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/50 to-primary/20 flex items-center justify-center overflow-hidden">
                      {primaryCharacter.avatar ? (
                        <img 
                          src={primaryCharacter.avatar} 
                          alt={primaryCharacter.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-white">
                          {primaryCharacter.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{primaryCharacter.name}</p>
                      <p className="text-xs text-white/50">Available to chat</p>
                    </div>
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full gap-2 py-6 text-base font-semibold bg-primary hover:bg-primary/90"
                    data-testid="button-chat-character"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChatClick?.(primaryCharacter.id);
                      setLocation(`/chat?character=${primaryCharacter.id}&card=${card.id}`);
                    }}
                  >
                    <MessageSquare className="w-5 h-5" />
                    Chat with {primaryCharacter.name}
                  </Button>
                </div>
              ) : null}
              
              <MessageBoard cardId={card.id} compact={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
