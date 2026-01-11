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

import {
  getTitlePackById,
  splitTextIntoHeadlineAndSupporting,
  getLayerStylesWithText,
  DEFAULT_TITLE_PACK_ID,
  type TitlePack
} from "@shared/titlePacks";
import { calculateCaptionGeometry } from "@/caption-engine/geometry";
import { CaptionDebugOverlay } from "./CaptionDebugOverlay";

interface CardPlayerProps {
  card: Card;
  autoplay?: boolean;
  characters?: Character[];
  onChatClick?: (characterId: number) => void;
  onPhaseChange?: (phase: "cinematic" | "context") => void;
  fullScreen?: boolean;
  brandPreferences?: BrandPreferences | null;
  titlePackId?: string;
  narrationVolume?: number; // 0-100
  narrationMuted?: boolean;
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
  titlePackId = DEFAULT_TITLE_PACK_ID,
  narrationVolume = 100,
  narrationMuted = false
}: CardPlayerProps) {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("cinematic");
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [dismissedRotateHint, setDismissedRotateHint] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isTabletLandscape = useIsTabletLandscape();
  
  const theme = brandPreferences?.theme || 'dark';
  const accentColor = brandPreferences?.accentColor || '#ffffff';
  const bgColor = theme === 'dark' ? '#0a0a0a' : '#f5f5f5';
  const textColor = theme === 'dark' ? 'white' : '#1a1a1a';
  const mutedTextColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  
  const titlePack = getTitlePackById(titlePackId) || getTitlePackById(DEFAULT_TITLE_PACK_ID)!;

  // Calculate unified caption geometry contract
  const captionGeometry = calculateCaptionGeometry({
    compositionWidth: titlePack.canvas.width,
    compositionHeight: titlePack.canvas.height,
    safeZoneLeftPercent: titlePack.safeZone.left,
    safeZoneRightPercent: titlePack.safeZone.right,
    safeZoneTopPercent: titlePack.safeZone.top,
    safeZoneBottomPercent: titlePack.safeZone.bottom,
    viewportScale: fullScreen ? 0.5 : 0.4,
  });

  const getActiveMedia = () => {
    if (card.mediaAssets?.length && card.selectedMediaAssetId) {
      const selected = card.mediaAssets.find(a => a.id === card.selectedMediaAssetId);
      if (selected && selected.status === 'ready') {
        return {
          imageUrl: selected.kind === 'image' ? selected.url : card.image,
          videoUrl: selected.kind === 'video' ? selected.url : card.generatedVideoUrl,
          selectedIsVideo: selected.kind === 'video',
        };
      }
    }
    return {
      imageUrl: card.image,
      videoUrl: card.generatedVideoUrl,
      selectedIsVideo: false,
    };
  };
  
  const activeMedia = getActiveMedia();
  
  const hasNarration = card.narrationEnabled && card.narrationStatus === "ready" && card.narrationAudioUrl;
  // Show video if: selected asset is video, OR videoGenerated flag is set, OR generatedVideoUrl exists (fallback for older cards)
  const hasVideo = !!activeMedia.videoUrl && (
    activeMedia.selectedIsVideo || 
    (card.videoGenerated && card.videoGenerationStatus === "completed") ||
    !!card.generatedVideoUrl  // Fallback: show if URL exists even without flags
  );
  const hasImage = !!activeMedia.imageUrl;
  const hasBothMediaTypes = hasImage && hasVideo;

  // Reset all state when card changes
  useEffect(() => {
    setPhase("cinematic");
    setCaptionIndex(0);
    setShowSwipeHint(false);
    setIsPlaying(autoplay);
    // Show video if: preferredMediaType is video, OR selected asset is video, OR only video available (no image)
    const useVideo = hasVideo && (
      card.preferredMediaType === 'video' || 
      activeMedia.selectedIsVideo || 
      !hasImage
    );
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

  // Update narration volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = narrationVolume / 100;
    }
  }, [narrationVolume]);
  
  const toggleMediaType = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowVideo(prev => !prev);
  }, []);
  
  // Play/pause audio based on phase
  useEffect(() => {
    if (!hasNarration || !audioRef.current) return;
    
    if (phase === "cinematic" && isPlaying && !narrationMuted) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [phase, isPlaying, hasNarration, narrationMuted]);
  
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
  
  const handleAudioEnded = useCallback(() => {
    setIsAudioPlaying(false);
    setAudioProgress(0);
    // When narration ends, advance to context phase
    if (phase === "cinematic") {
      advanceToContext();
    }
  }, [phase, advanceToContext]);
  
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

  // Debug overlay toggle (press 'D' key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setDebugOverlay(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Smart duration calculation: max(narration, text read time, minimum)
  const calculateCaptionDuration = useCallback((captionText: string): number => {
    // If we have narration, let audio control timing (handled by handleAudioEnded)
    if (hasNarration && audioDuration > 0) {
      // Distribute audio duration across captions
      const perCaptionDuration = (audioDuration * 1000) / card.captions.length;
      return Math.max(perCaptionDuration, 2000); // Minimum 2s per caption
    }
    
    // Text read time: ~2.8 words per second (comfortable reading speed)
    const wordCount = captionText.split(/\s+/).filter(w => w.length > 0).length;
    const textReadTime = Math.ceil((wordCount / 2.8) * 1000);
    
    // Minimum 2.5s, maximum 10s per caption
    return Math.min(Math.max(textReadTime, 2500), 10000);
  }, [hasNarration, audioDuration, card.captions.length]);
  
  // Clear swipe hint when audio metadata loads (prevents early transition)
  useEffect(() => {
    if (hasNarration && audioDuration > 0) {
      setShowSwipeHint(false);
    }
  }, [hasNarration, audioDuration]);

  useEffect(() => {
    if (!isPlaying || phase !== "cinematic") return;
    
    // If we have narration, wait for audio metadata before running any timers
    // The handleAudioEnded callback will control the phase transition
    if (hasNarration) {
      if (audioDuration > 0) {
        // Advance captions in sync with audio duration
        const perCaptionDuration = (audioDuration * 1000) / Math.max(card.captions.length, 1);
        const captionInterval = setInterval(() => {
          setCaptionIndex((prev) => {
            const next = prev + 1;
            if (next >= card.captions.length) {
              return prev; // Audio end will trigger context phase
            }
            return next;
          });
        }, perCaptionDuration);
        
        return () => clearInterval(captionInterval);
      }
      // Still waiting for audio metadata - don't start any timers yet
      return;
    }
    
    // No narration - use smart text-based timing
    const currentCaption = card.captions[captionIndex] || "";
    const duration = calculateCaptionDuration(currentCaption);
    
    const timeout = setTimeout(() => {
      setCaptionIndex((prev) => {
        const next = prev + 1;
        if (next >= card.captions.length) {
          setShowSwipeHint(true);
          return prev;
        }
        return next;
      });
    }, duration);

    return () => clearTimeout(timeout);
  }, [isPlaying, card.captions, phase, captionIndex, calculateCaptionDuration, hasNarration, audioDuration]);

  // Auto-advance after swipe hint (only for non-narration cards)
  useEffect(() => {
    if (showSwipeHint && !hasNarration) {
      const timeout = setTimeout(() => {
        advanceToContext();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [showSwipeHint, advanceToContext, hasNarration]);

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

            <div className="absolute top-4 left-4 right-4 flex items-center justify-end">
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
                    {narrationMuted && (
                      <div className="p-2 bg-black/30 rounded-full backdrop-blur-sm">
                        <VolumeX className="w-4 h-4 text-white/40" />
                      </div>
                    )}
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
                muted={narrationMuted}
                className="hidden"
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onEnded={handleAudioEnded}
                data-testid="audio-narration-player"
              />
            )}
            

            {/* Caption region - uses geometry contract for consistent positioning */}
            <div
              className="absolute left-0 right-0 bottom-0 flex items-end justify-center pointer-events-none"
              style={{
                paddingLeft: `${captionGeometry.viewportPadding}px`,
                paddingRight: `${captionGeometry.viewportPadding}px`,
                paddingBottom: `${captionGeometry.safeAreaBottom * captionGeometry.viewportScale}px`,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={captionIndex}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-full"
                  style={{
                    maxWidth: `${captionGeometry.viewportCaptionWidth}px`,
                  }}
                >
                  {captionIndex < card.captions.length ? (
                    (() => {
                      const captionText = card.captions[captionIndex];
                      const { headline, supporting } = splitTextIntoHeadlineAndSupporting(captionText);
                      const headlineStyles = getLayerStylesWithText(headline, titlePack.headline, titlePack, fullScreen, captionGeometry);
                      const supportingStyles = titlePack.supporting && supporting
                        ? getLayerStylesWithText(supporting, titlePack.supporting, titlePack, fullScreen, captionGeometry)
                        : null;

                      return (
                        <div className="flex flex-col items-center gap-3 w-full" style={{ position: 'relative' }}>
                          {/* Accent shape background for grunge-tape pack */}
                          {titlePack.accentShape?.type === 'tape' && (
                            <div 
                              className="absolute inset-x-8 rounded-sm -skew-y-1"
                              style={{
                                backgroundColor: titlePack.accentShape.color,
                                opacity: titlePack.accentShape.opacity,
                                top: '50%',
                                transform: 'translateY(-50%) skewY(-1deg)',
                                padding: '1rem 2rem',
                                zIndex: -1,
                              }}
                            />
                          )}
                          
                          {/* Headline */}
                          <p
                            className="font-bold leading-snug w-full"
                            style={{
                              ...headlineStyles,
                              boxSizing: 'border-box',
                              wordWrap: 'break-word',
                              overflowWrap: 'break-word',
                            }}
                            data-testid="text-headline"
                          >
                            {headline}
                          </p>

                          {/* Supporting text */}
                          {supporting && supportingStyles && (
                            <p
                              className="leading-relaxed w-full"
                              style={{
                                ...supportingStyles,
                                boxSizing: 'border-box',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                              }}
                              data-testid="text-supporting"
                            >
                              {supporting}
                            </p>
                          )}
                          
                          {/* Underline accent for editorial-minimal pack */}
                          {titlePack.accentShape?.type === 'underline' && (
                            <div 
                              className="w-16 h-0.5 mt-1"
                              style={{
                                backgroundColor: titlePack.accentShape.color,
                                opacity: titlePack.accentShape.opacity,
                              }}
                            />
                          )}
                        </div>
                      );
                    })()
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
            {/* End caption region */}

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
                  <h2 className="text-xl font-display font-bold text-white tracking-wide" data-testid="context-title">
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

      {/* Debug overlay (toggle with 'D' key) */}
      {phase === "cinematic" && (
        <CaptionDebugOverlay geometry={captionGeometry} enabled={debugOverlay} />
      )}
    </div>
  );
}
