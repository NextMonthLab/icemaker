import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Card, MediaAsset, MediaSegment } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { getEffectiveRenderMode, computeAspectRatio, type EffectiveRenderMode } from "@/lib/videoFraming";
import { MessageSquare, ChevronUp, Share2, BookOpen, RotateCcw, Volume2, VolumeX, Film, Image, Play, Pause, Music, Mic, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { CaptionState } from "@/caption-engine/schemas";
import { resolveStyles } from "@/caption-engine/render/resolveStyles";
import { ScaleToFitCaption } from "@/components/ScaleToFitCaption";

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
  narrationVolume?: number; // 0-100
  narrationMuted?: boolean;
  captionState?: CaptionState; // Caption Engine state for presets/karaoke/animations
  showPlaceholderOverlay?: boolean; // Show "ADD YOUR..." overlay on placeholder backgrounds
  icePreviewId?: string; // For ICE card message boards
  logoEnabled?: boolean; // Show logo overlay on cards
  logoUrl?: string | null; // URL to the logo image
  logoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; // Position of logo overlay
  adminCtaEnabled?: boolean; // Show "Powered by IceMaker" CTA instead of logo (admin feature)
  onNarrationPlayingChange?: (isPlaying: boolean) => void; // Callback when narration starts/stops (for music ducking)
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
  narrationVolume = 100,
  narrationMuted = false,
  captionState,
  showPlaceholderOverlay = false,
  icePreviewId,
  logoEnabled = false,
  logoUrl = null,
  logoPosition = "top-right",
  adminCtaEnabled = false,
  onNarrationPlayingChange
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
  const [showContinuation, setShowContinuation] = useState(false); // Cinematic Continuation state
  const [videoAspect, setVideoAspect] = useState<'portrait' | 'landscape' | 'square'>('portrait'); // Track video aspect ratio for smart scaling
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0); // For multi-segment timeline playback
  const [segmentTransitioning, setSegmentTransitioning] = useState(false); // Crossfade between segments
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevVideoRef = useRef<HTMLVideoElement | null>(null); // For segment crossfade
  const captionRegionRef = useRef<HTMLDivElement | null>(null);
  
  // Keep volume in a ref so callbacks always have the latest value
  const narrationVolumeRef = useRef(narrationVolume);
  useEffect(() => {
    narrationVolumeRef.current = narrationVolume;
  }, [narrationVolume]);
  const [containerWidthPx, setContainerWidthPx] = useState(375);
  const isTabletLandscape = useIsTabletLandscape();

  useEffect(() => {
    const el = captionRegionRef.current;
    if (!el) return;

    const updateWidth = () => {
      // Use clientWidth and subtract padding to get actual content area
      const style = getComputedStyle(el);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const contentWidth = el.clientWidth - paddingLeft - paddingRight;
      setContainerWidthPx(contentWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);
  
  const theme = brandPreferences?.theme || 'dark';
  const accentColor = brandPreferences?.accentColor || '#ffffff';
  const bgColor = theme === 'dark' ? '#0a0a0a' : '#f5f5f5';
  const textColor = theme === 'dark' ? 'white' : '#1a1a1a';
  const mutedTextColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  
  const titlePack = getTitlePackById(captionState?.presetId || DEFAULT_TITLE_PACK_ID) || getTitlePackById(DEFAULT_TITLE_PACK_ID)!;

  // Calculate unified caption geometry contract
  // Dynamic viewportScale based on actual container width to prevent clipping on narrow devices
  const dynamicViewportScale = containerWidthPx / titlePack.canvas.width;
  
  const captionGeometry = calculateCaptionGeometry({
    compositionWidth: titlePack.canvas.width,
    compositionHeight: titlePack.canvas.height,
    safeZoneLeftPercent: titlePack.safeZone.left,
    safeZoneRightPercent: titlePack.safeZone.right,
    safeZoneTopPercent: titlePack.safeZone.top,
    safeZoneBottomPercent: titlePack.safeZone.bottom,
    viewportScale: dynamicViewportScale,
  });
  
  // Pre-calculate styles for all captions with deck-level font consistency
  // First pass: compute individual font sizes, then use minimum for all
  const captionStylesCache = useMemo(() => {
    const captions = card.captions || [];
    const cache: Record<number, ReturnType<typeof resolveStyles>> = {};
    
    if (captions.length === 0) return cache;
    
    // First pass: compute font sizes for each caption independently
    const individualSizes: number[] = [];
    for (let i = 0; i < captions.length; i++) {
      const result = resolveStyles({
        presetId: captionState?.presetId || 'clean_white',
        fullScreen,
        karaokeEnabled: captionState?.karaokeEnabled,
        karaokeStyle: captionState?.karaokeStyle,
        headlineText: captions[i],
        layoutMode: 'title',
        fontSize: captionState?.fontSize || 'medium',
        layout: { containerWidthPx: captionGeometry.availableCaptionWidth },
      });
      individualSizes.push(result.headlineFontSizePx);
    }
    
    // Find minimum font size (determined by longest caption)
    const deckTargetFontSize = Math.min(...individualSizes);
    
    // Second pass: apply uniform font size to all captions
    for (let i = 0; i < captions.length; i++) {
      cache[i] = resolveStyles({
        presetId: captionState?.presetId || 'clean_white',
        fullScreen,
        karaokeEnabled: captionState?.karaokeEnabled,
        karaokeStyle: captionState?.karaokeStyle,
        headlineText: captions[i],
        layoutMode: 'title',
        fontSize: captionState?.fontSize || 'medium',
        layout: { containerWidthPx: captionGeometry.availableCaptionWidth },
        deckTargetFontSize,
      });
    }
    
    return cache;
  }, [card.captions, captionGeometry.availableCaptionWidth, captionState?.presetId, captionState?.fontSize, captionState?.karaokeEnabled, captionState?.karaokeStyle, fullScreen]);

  // Get sorted media segments for timeline playback
  const sortedSegments = useMemo(() => {
    if (!card.mediaSegments?.length) return [];
    return [...card.mediaSegments].sort((a, b) => a.order - b.order);
  }, [card.mediaSegments]);
  
  const hasSegments = sortedSegments.length > 0;
  const currentSegment = hasSegments ? sortedSegments[currentSegmentIndex] : null;
  const nextSegment = hasSegments && currentSegmentIndex < sortedSegments.length - 1 
    ? sortedSegments[currentSegmentIndex + 1] 
    : null;
  
  const getActiveMedia = () => {
    // If using segments, get media from current segment
    if (hasSegments && currentSegment) {
      const segmentAsset = card.mediaAssets?.find(a => a.id === currentSegment.assetId);
      return {
        imageUrl: currentSegment.kind === 'image' ? currentSegment.url : card.image,
        videoUrl: currentSegment.kind === 'video' ? currentSegment.url : undefined,
        selectedIsVideo: currentSegment.kind === 'video',
        selectedAsset: segmentAsset,
        segment: currentSegment,
      };
    }
    
    // Fallback to standard asset selection with "video wins" logic
    // When no segments exist, prefer any ready video over a selected image
    // This fixes the edge case where image is generated first, then video
    if (card.mediaAssets?.length) {
      const selected = card.selectedMediaAssetId 
        ? card.mediaAssets.find(a => a.id === card.selectedMediaAssetId)
        : undefined;
      
      // Find ready videos and images, sorted by createdAt descending (most recent first)
      const readyVideos = card.mediaAssets
        .filter(a => a.kind === 'video' && a.status === 'ready')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      const readyImages = card.mediaAssets
        .filter(a => a.kind === 'image' && a.status === 'ready')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      const latestReadyVideo = readyVideos[0];
      const latestReadyImage = readyImages[0];
      
      // "Video wins": prefer selected if it's a video, otherwise use latest video
      const primaryAsset = (selected?.kind === 'video' && selected.status === 'ready')
        ? selected
        : (latestReadyVideo || selected);
      
      if (primaryAsset && primaryAsset.status === 'ready') {
        // When video is primary, use image for background/continuation:
        // Prefer selected image if available, then any ready image, finally card.image
        const backgroundImage = primaryAsset.kind === 'video' 
          ? (selected?.kind === 'image' ? selected.url : latestReadyImage?.url || card.image)
          : primaryAsset.url;
        
        return {
          imageUrl: backgroundImage || card.image,
          videoUrl: primaryAsset.kind === 'video' ? primaryAsset.url : card.generatedVideoUrl,
          selectedIsVideo: primaryAsset.kind === 'video',
          selectedAsset: primaryAsset as MediaAsset,
          segment: undefined as MediaSegment | undefined,
        };
      }
    }
    return {
      imageUrl: card.image,
      videoUrl: card.generatedVideoUrl,
      selectedIsVideo: !!card.generatedVideoUrl,
      selectedAsset: undefined as MediaAsset | undefined,
      segment: undefined as MediaSegment | undefined,
    };
  };
  
  const activeMedia = getActiveMedia();
  
  // Determine if video audio should be muted
  // Default is true (muted) for backwards compatibility and because narration is separate
  // Users can set muteAudio=false on uploaded videos to hear original audio
  const shouldMuteVideoAudio = useMemo(() => {
    // Check segment first (multi-clip timeline)
    if (activeMedia.segment?.muteAudio === false) return false;
    // Check selected asset (single asset selection)
    if (activeMedia.selectedAsset?.muteAudio === false) return false;
    // Default: mute video audio (narration is separate)
    return true;
  }, [activeMedia.segment, activeMedia.selectedAsset]);
  
  // Compute effective render mode - use asset metadata if available, fallback to runtime-detected videoAspect
  const effectiveVideoRenderMode: EffectiveRenderMode = useMemo(() => {
    // If we have a selected video asset with explicit renderMode (not auto), use it directly
    if (activeMedia.selectedAsset?.kind === 'video' && activeMedia.selectedAsset.renderMode && activeMedia.selectedAsset.renderMode !== 'auto') {
      return activeMedia.selectedAsset.renderMode;
    }
    
    // For auto mode or no asset: try to compute from metadata, fallback to runtime detection
    const asset = activeMedia.selectedAsset;
    if (asset?.kind === 'video') {
      // Prefer stored aspect ratio, compute from dimensions if not available
      const assetRatio = asset.sourceAspectRatio ?? 
        (asset.sourceWidth && asset.sourceHeight ? computeAspectRatio(asset.sourceWidth, asset.sourceHeight) : undefined);
      
      if (assetRatio) {
        return getEffectiveRenderMode({
          renderMode: 'auto',
          sourceAspectRatio: assetRatio,
        });
      }
    }
    
    // Fallback to runtime-detected videoAspect from handleVideoLoadedMetadata
    // This covers cases where metadata isn't pre-populated on the asset
    return videoAspect === 'landscape' ? 'fit' : 'fill';
  }, [activeMedia.selectedAsset, videoAspect]);
  
  const hasNarration = card.narrationEnabled && card.narrationStatus === "ready" && card.narrationAudioUrl;
  // Show video if: selected asset is video, OR videoGenerated flag is set, OR generatedVideoUrl exists (fallback for older cards)
  const hasVideo = !!activeMedia.videoUrl && (
    activeMedia.selectedIsVideo || 
    (card.videoGenerated && card.videoGenerationStatus === "completed") ||
    !!card.generatedVideoUrl  // Fallback: show if URL exists even without flags
  );
  
  // Check if there's an actual generated/uploaded image (not just a placeholder/fallback)
  // Generated image = any image asset in mediaAssets with status 'ready'
  // This distinguishes from card.image which may be a placeholder background
  const hasGeneratedImage = !!(
    card.mediaAssets?.some(a => a.kind === 'image' && a.status === 'ready')
  );
  
  // hasImage is for display purposes (can use fallback), hasGeneratedImage is for media selection logic
  const hasImage = !!activeMedia.imageUrl;
  const hasBothMediaTypes = hasGeneratedImage && hasVideo;

  // Reset all state when card changes (only trigger on card.id change, not hasVideo)
  useEffect(() => {
    setPhase("cinematic");
    setCaptionIndex(0);
    setShowSwipeHint(false);
    setIsPlaying(autoplay);
    setShowContinuation(false); // Reset cinematic continuation state
    setVideoAspect('portrait'); // Reset video aspect for new card
    setCurrentSegmentIndex(0); // Reset segment playback for new card
    setSegmentTransitioning(false);
    
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
  }, [card.id, autoplay]);
  
  // Detect video aspect ratio when video metadata loads
  const handleVideoLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const { videoWidth, videoHeight } = video;
    if (videoWidth && videoHeight) {
      const ratio = videoWidth / videoHeight;
      if (ratio > 1.2) {
        setVideoAspect('landscape'); // Wide video (16:9, 4K landscape, etc.)
      } else if (ratio < 0.8) {
        setVideoAspect('portrait'); // Tall video (9:16)
      } else {
        setVideoAspect('square'); // Nearly square
      }
    }
  }, []);
  
  // Separate effect for video display preference (can run when hasVideo changes)
  useEffect(() => {
    // Show video if: preferredMediaType is video, OR selected asset is video, OR only video available (no generated image)
    // Use hasGeneratedImage (not hasImage) so video-only cards default to video mode
    const useVideo = hasVideo && (
      card.preferredMediaType === 'video' || 
      activeMedia.selectedIsVideo || 
      !hasGeneratedImage
    );
    setShowVideo(!!useVideo);
  }, [card.id, hasVideo, hasGeneratedImage, card.preferredMediaType, activeMedia.selectedIsVideo]);

  // Update narration volume - use regular effect with more frequent checks
  // This ensures volume changes take effect even while audio is playing
  useEffect(() => {
    console.log('[CardPlayer] Volume effect triggered, narrationVolume:', narrationVolume, 'audioRef.current exists:', !!audioRef.current);
    if (audioRef.current) {
      const previousVolume = audioRef.current.volume;
      audioRef.current.volume = narrationVolume / 100;
      console.log('[CardPlayer] Narration volume changed:', previousVolume, '->', audioRef.current.volume);
    } else {
      console.log('[CardPlayer] audioRef.current is NULL - cannot set volume');
    }
  }, [narrationVolume]);
  
  // Also sync volume on card change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = narrationVolume / 100;
    }
  }, [card.id, narrationVolume]);
  
  const toggleMediaType = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowVideo(prev => !prev);
    // Reset continuation state when toggling back to video mode
    setShowContinuation(false);
  }, []);
  
  // Play/pause audio based on phase
  useEffect(() => {
    if (!hasNarration || !audioRef.current) return;
    
    if (phase === "cinematic" && isPlaying && !narrationMuted) {
      // Always apply volume before playing (ensures volume is set)
      audioRef.current.volume = narrationVolume / 100;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [phase, isPlaying, hasNarration, narrationMuted, narrationVolume]);
  
  // Play/pause video based on isPlaying state (unified control)
  useEffect(() => {
    if (!videoRef.current || !showVideo || !hasVideo) return;
    
    if (phase === "cinematic" && isPlaying) {
      // Reset continuation state when restarting video playback
      // This allows video to replay from start after it previously ended
      if (videoRef.current.currentTime === 0 || videoRef.current.ended) {
        setShowContinuation(false);
      }
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [phase, isPlaying, showVideo, hasVideo]);
  
  // Cinematic Continuation: determine if we need to show continuation still when video ends
  const cinematicContinuationEnabled = card.cinematicContinuationEnabled !== false; // Default true
  const hasContinuationImage = !!card.continuationImageUrl;
  const needsContinuation = hasVideo && hasNarration && cinematicContinuationEnabled && (
    // Use audio duration comparison if available
    (audioDuration > 0 && card.videoDurationSec && audioDuration > card.videoDurationSec) ||
    // Fallback: compare stored durations
    (card.narrationDurationSec && card.videoDurationSec && card.narrationDurationSec > card.videoDurationSec)
  );
  
  // Centralized segment advancement with guard against double-advancement
  // NOTE: These refs and the advanceToNextSegment function MUST be defined before handleVideoEnded
  const segmentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const advancingRef = useRef(false); // Guard against double-advancement
  
  // Clear all segment-related timers
  const clearAllSegmentTimers = useCallback(() => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  }, []);
  
  // Centralized segment advancement function
  const advanceToNextSegment = useCallback(() => {
    // Guard against double-advancement
    if (advancingRef.current) {
      console.log('[CardPlayer] Segment advancement already in progress, skipping');
      return;
    }
    
    if (!hasSegments || currentSegmentIndex >= sortedSegments.length - 1) {
      // Last segment - check for continuation
      if (needsContinuation && hasContinuationImage) {
        setShowContinuation(true);
      }
      return;
    }
    
    advancingRef.current = true;
    console.log('[CardPlayer] Advancing to next segment:', currentSegmentIndex + 1);
    setSegmentTransitioning(true);
    
    // Clear any pending timers before scheduling new ones
    clearAllSegmentTimers();
    
    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentSegmentIndex(prev => prev + 1);
      fadeTimeoutRef.current = setTimeout(() => {
        setSegmentTransitioning(false);
        advancingRef.current = false;
      }, 300);
    }, 150);
  }, [hasSegments, currentSegmentIndex, sortedSegments.length, needsContinuation, hasContinuationImage, clearAllSegmentTimers]);
  
  // Handle video ended event - use centralized advancement
  const handleVideoEnded = useCallback(() => {
    // If using segments, use centralized advancement (handles guard against double-advancement)
    if (hasSegments) {
      advanceToNextSegment();
      return;
    }
    
    // No segments - check for continuation
    if (needsContinuation && hasContinuationImage) {
      setShowContinuation(true);
    } else if (needsContinuation && !hasContinuationImage) {
      console.log('[CardPlayer] Video ended, continuation needed but no image available');
    }
  }, [hasSegments, advanceToNextSegment, needsContinuation, hasContinuationImage]);
  
  // Video ref callback to start playback when video element mounts
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    // Remove old event listener if swapping elements
    if (videoRef.current && videoRef.current !== el) {
      videoRef.current.removeEventListener('ended', handleVideoEnded);
    }
    
    videoRef.current = el;
    
    if (el) {
      // Add ended event listener for cinematic continuation
      el.addEventListener('ended', handleVideoEnded);
      
      if (phase === "cinematic" && isPlaying && showVideo && hasVideo) {
        el.play().catch(() => {});
      }
    }
  }, [phase, isPlaying, showVideo, hasVideo, handleVideoEnded]);
  
  // Cleanup video ended event listener on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('ended', handleVideoEnded);
      }
    };
  }, [handleVideoEnded]);
  
  // Timer-based segment advancement for image segments
  useEffect(() => {
    clearAllSegmentTimers();
    advancingRef.current = false; // Reset guard when segment changes
    
    if (!isPlaying || !hasSegments || !currentSegment) return;
    
    // For image segments, use timer-based advancement
    if (currentSegment.kind === 'image' && currentSegment.durationSec > 0) {
      console.log('[CardPlayer] Setting timer for image segment:', currentSegmentIndex, 'duration:', currentSegment.durationSec);
      segmentTimerRef.current = setTimeout(() => {
        advanceToNextSegment();
      }, currentSegment.durationSec * 1000);
    }
    
    return () => {
      clearAllSegmentTimers();
    };
  }, [isPlaying, hasSegments, currentSegment, currentSegmentIndex, advanceToNextSegment, clearAllSegmentTimers]);
  
  // Update handleVideoEnded to use centralized advancement
  // This is done by updating the callback dependency below
  
  // Restart video playback when segment changes (for video segments)
  useEffect(() => {
    if (!hasSegments || !currentSegment || currentSegment.kind !== 'video') return;
    if (!videoRef.current || !isPlaying) return;
    
    // Reset video to start and play
    videoRef.current.currentTime = 0;
    if (showVideo) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentSegmentIndex, hasSegments, currentSegment?.kind, isPlaying, showVideo, activeMedia.videoUrl]);
  
  // Clamp currentSegmentIndex if segments array changes
  useEffect(() => {
    if (hasSegments && currentSegmentIndex >= sortedSegments.length) {
      setCurrentSegmentIndex(Math.max(0, sortedSegments.length - 1));
    }
  }, [hasSegments, currentSegmentIndex, sortedSegments.length]);
  
  const toggleAudioPlayback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPlaying(prev => !prev);
  }, []);
  
  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setAudioProgress(audioRef.current.currentTime);
    }
  }, []);
  
  // Use requestAnimationFrame for smoother caption sync with audio
  // The timeupdate event only fires ~4 times/second, which causes visible lag
  // Also continuously enforce volume to catch any resets
  useEffect(() => {
    if (!hasNarration || !isAudioPlaying) return;
    
    let animationId: number;
    const updateProgress = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setAudioProgress(audioRef.current.currentTime);
        // Continuously enforce volume in case something resets it
        const targetVolume = narrationVolume / 100;
        if (Math.abs(audioRef.current.volume - targetVolume) > 0.01) {
          console.log('[Narration] Volume drift detected, correcting from', audioRef.current.volume, 'to', targetVolume);
          audioRef.current.volume = targetVolume;
        }
        animationId = requestAnimationFrame(updateProgress);
      }
    };
    
    animationId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationId);
  }, [hasNarration, isAudioPlaying, narrationVolume]);
  
  const handleAudioLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
      // Always apply current volume when audio loads (use ref for latest value)
      audioRef.current.volume = narrationVolumeRef.current / 100;
      console.log('[CardPlayer] Audio loadedmetadata - volume applied:', narrationVolumeRef.current / 100);
    }
  }, []);
  
  // Ref callback to apply volume immediately when audio element is assigned
  const setAudioRef = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (el) {
      // Use ref for latest volume value (callback might be stale)
      el.volume = narrationVolumeRef.current / 100;
      console.log('[CardPlayer] Audio ref assigned - volume applied:', narrationVolumeRef.current / 100);
      // Also listen for canplay as backup
      el.addEventListener('canplay', () => {
        el.volume = narrationVolumeRef.current / 100;
        console.log('[CardPlayer] Audio canplay - volume applied:', narrationVolumeRef.current / 100);
      }, { once: true });
    }
  }, []);
  
  const handleAudioPlay = useCallback(() => {
    setIsAudioPlaying(true);
    onNarrationPlayingChange?.(true);
  }, [onNarrationPlayingChange]);
  
  const handleAudioPause = useCallback(() => {
    setIsAudioPlaying(false);
    onNarrationPlayingChange?.(false);
  }, [onNarrationPlayingChange]);

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
    onNarrationPlayingChange?.(false);
    // When narration ends, advance to context phase
    if (phase === "cinematic") {
      advanceToContext();
    }
  }, [phase, advanceToContext, onNarrationPlayingChange]);
  
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

  // Calculate caption time ranges (start/end in seconds) for each caption
  // Priority: 1) Use explicit timing data if available, 2) Fall back to equal time slices
  const captionTimeRanges = useMemo(() => {
    const captions = card.captions || [];
    if (captions.length === 0 || !audioDuration || audioDuration <= 0) return [];
    
    // Use aligned timing data if available (Phase 2 - Forced Alignment)
    const timings = card.captionTimings;
    if (timings && timings.length === captions.length) {
      return timings.map(t => ({
        start: t.startMs / 1000,
        end: t.endMs / 1000,
      }));
    }
    
    // Fallback: Word-weighted time distribution (longer sentences get more time)
    // Count words in each caption
    const wordCounts = captions.map(c => c.split(/\s+/).filter(w => w.length > 0).length);
    const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
    
    if (totalWords === 0) {
      // Edge case: no words, use equal distribution
      const perCaptionDuration = audioDuration / captions.length;
      return captions.map((_, i) => ({
        start: i * perCaptionDuration,
        end: (i + 1) * perCaptionDuration,
      }));
    }
    
    // Distribute time proportionally to word count, with min 1.5s per caption
    const minDuration = 1.5;
    const ranges: { start: number; end: number }[] = [];
    let currentTime = 0;
    
    for (let i = 0; i < captions.length; i++) {
      const proportion = wordCounts[i] / totalWords;
      let duration = audioDuration * proportion;
      // Clamp to minimum duration
      duration = Math.max(duration, minDuration);
      ranges.push({
        start: currentTime,
        end: currentTime + duration,
      });
      currentTime += duration;
    }
    
    // Normalize if we exceeded audio duration due to min clamps
    if (currentTime > audioDuration && ranges.length > 0) {
      const scale = audioDuration / currentTime;
      let runningTime = 0;
      for (const range of ranges) {
        const duration = (range.end - range.start) * scale;
        range.start = runningTime;
        range.end = runningTime + duration;
        runningTime += duration;
      }
    }
    
    return ranges;
  }, [card.captions, card.captionTimings, audioDuration]);
  
  // Sync captions with audio progress when narration is playing
  // Gap behavior: hold previous caption until next one starts (avoids "captions vanished" feeling)
  useEffect(() => {
    if (!hasNarration || !audioDuration || audioDuration <= 0) return;
    if (!isPlaying || phase !== "cinematic") return;
    
    const captionCount = card.captions.length;
    if (captionCount === 0 || captionTimeRanges.length === 0) return;
    
    // Find which caption should be active based on current audio time
    // Gap behavior: hold previous caption during gaps between captions
    let targetIndex = captionIndex;
    
    for (let i = 0; i < captionTimeRanges.length; i++) {
      const range = captionTimeRanges[i];
      // If we're within this caption's range, show it
      if (audioProgress >= range.start && audioProgress < range.end) {
        targetIndex = i;
        break;
      }
      // If we're past this caption but before the next one starts (gap),
      // hold the current caption (don't change targetIndex)
      if (audioProgress >= range.end) {
        const nextRange = captionTimeRanges[i + 1];
        if (!nextRange || audioProgress < nextRange.start) {
          // In a gap - hold this caption
          targetIndex = i;
          break;
        }
      }
    }
    
    // Only update if the target index changed
    if (targetIndex !== captionIndex) {
      setCaptionIndex(targetIndex);
    }
  }, [hasNarration, audioDuration, audioProgress, isPlaying, phase, card.captions.length, captionIndex, captionTimeRanges]);
  
  // For cards without narration, use text-based timing
  useEffect(() => {
    if (!isPlaying || phase !== "cinematic") return;
    if (hasNarration) return; // Handled by audio sync above
    
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
  }, [isPlaying, card.captions, phase, captionIndex, calculateCaptionDuration, hasNarration]);

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

  // Prefer isPrimary character, then brief characters, then first character
  const primaryCharacter = characters.find(c => (c as any).isPrimary) 
    || characters.find(c => (c as any).source === 'brief')
    || characters[0];

  // Force 9:16 portrait aspect ratio on all devices for consistent mobile-first experience
  const containerClass = fullScreen
    ? "relative h-full max-h-screen aspect-[9/16] mx-auto overflow-hidden"
    : "relative w-full aspect-[9/16] overflow-hidden rounded-2xl shadow-2xl";

  return (
    <div 
      ref={captionRegionRef}
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
              className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
              initial={{ scale: 1 }}
              animate={{ scale: isPlaying && !isTabletLandscape && !showVideo ? 1.15 : 1 }}
              transition={{ duration: 20, ease: "linear" }}
            >
              {showVideo && hasVideo ? (
                <>
                  {/* Video element with smart scaling based on renderMode (Auto/Fill/Fit) */}
                  {effectiveVideoRenderMode === 'fit' ? (
                    <>
                      {/* FIT mode: Blur-fill background for landscape videos - fills space attractively */}
                      <video
                        src={activeMedia.videoUrl!}
                        muted
                        playsInline
                        autoPlay
                        loop
                        className={`absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-60 transition-opacity duration-300 ${showContinuation ? 'opacity-0' : ''}`}
                        aria-hidden="true"
                      />
                      {/* Main video - contained to show full frame without cropping */}
                      <video
                        ref={setVideoRef}
                        src={activeMedia.videoUrl!}
                        muted={shouldMuteVideoAudio}
                        playsInline
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        className={`relative z-10 w-full h-full object-contain transition-opacity duration-300 ${showContinuation || segmentTransitioning ? 'opacity-0' : 'opacity-100'}`}
                        data-testid="video-player"
                      />
                    </>
                  ) : (
                    /* FILL mode: object-cover for full-bleed effect (crops to fill) */
                    <video
                      ref={setVideoRef}
                      src={activeMedia.videoUrl!}
                      muted={shouldMuteVideoAudio}
                      playsInline
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${showContinuation || segmentTransitioning ? 'opacity-0' : 'opacity-100'}`}
                      data-testid="video-player"
                    />
                  )}
                  {/* Cinematic Continuation: crossfade to still image when video ends */}
                  {showContinuation && hasContinuationImage && (
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      src={card.continuationImageUrl!}
                      alt={`${card.title} continuation`}
                      className="absolute inset-0 w-full h-full object-cover z-20"
                      data-testid="continuation-image"
                    />
                  )}
                </>
              ) : activeMedia.imageUrl ? (
                <>
                  <img
                    src={activeMedia.imageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                  {/* ADD YOUR... overlay for placeholder backgrounds - positions OPPOSITE to captions to avoid overlap */}
                  {showPlaceholderOverlay && (() => {
                    const captionPosition = captionState?.position || 'bottom';
                    // Move overlay to opposite position to avoid overlap with captions
                    const overlayJustify = captionPosition === 'top' ? 'justify-end pb-24' : captionPosition === 'middle' ? 'justify-start pt-16' : 'justify-start pt-16';
                    return (
                    <div className={`absolute inset-0 flex flex-col items-center ${overlayJustify} z-10 pointer-events-none`}>
                      <div className="text-center mb-4">
                        <h3 className="text-2xl font-light tracking-[0.3em] text-white drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                          ADD YOUR...
                        </h3>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                          <Image className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                          <Play className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                          <Music className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                          <Mic className="w-6 h-6 text-cyan-300" />
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  {/* Placeholder gradient background with ADD YOUR... overlay - positions OPPOSITE to captions to avoid overlap */}
                  <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 via-blue-900/30 to-slate-900/50" />
                  {(() => {
                    const captionPosition = captionState?.position || 'bottom';
                    // Move overlay to opposite position to avoid overlap with captions
                    const overlayJustify = captionPosition === 'top' ? 'justify-end pb-24' : captionPosition === 'middle' ? 'justify-start pt-16' : 'justify-start pt-16';
                    return (
                  <div className={`absolute inset-0 flex flex-col items-center ${overlayJustify} z-10 pointer-events-none`}>
                    <div className="text-center mb-4">
                      <h3 className="text-2xl font-light tracking-[0.3em] text-white drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                        ADD YOUR...
                      </h3>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                        <Image className="w-6 h-6 text-cyan-300" />
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                        <Play className="w-6 h-6 text-cyan-300" />
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                        <Music className="w-6 h-6 text-cyan-300" />
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 flex items-center justify-center">
                        <Mic className="w-6 h-6 text-cyan-300" />
                      </div>
                    </div>
                  </div>
                    );
                  })()}
                </>
              )}
            </motion.div>

            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

            {/* Logo Overlay - positioned based on user preference, inside scale container */}
            {logoEnabled && logoUrl ? (
              <div 
                className={`absolute z-20 pointer-events-none ${
                  logoPosition === "top-left" ? "top-16 left-4" :
                  logoPosition === "top-right" ? "top-16 right-4" :
                  logoPosition === "bottom-left" ? "bottom-44 left-4" :
                  "bottom-44 right-4"
                }`}
                data-testid="logo-overlay"
              >
                <div className="w-16 h-16 bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden flex items-center justify-center p-1.5">
                  <img 
                    src={logoUrl} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ) : null}

            <div className="absolute top-3 left-3 right-3 pr-1 flex items-center justify-end z-30 pointer-events-auto">
              <div className="flex items-center gap-2">
                {hasBothMediaTypes && (
                  <button
                    onClick={toggleMediaType}
                    className="p-2 bg-black/30 rounded-full backdrop-blur-sm hover:bg-black/50 transition-colors flex items-center gap-1"
                    data-testid="button-toggle-media"
                    title={showVideo ? "Switch to Image" : "Switch to Video"}
                  >
                    {showVideo ? (
                      <>
                        <Film className="w-4 h-4 text-white/70" />
                        <span className="text-xs text-white/70">Video</span>
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4 text-white/70" />
                        <span className="text-xs text-white/70">Image</span>
                      </>
                    )}
                  </button>
                )}
                {hasNarration && narrationMuted && (
                  <div className="p-2 bg-black/30 rounded-full backdrop-blur-sm">
                    <VolumeX className="w-4 h-4 text-white/40" />
                  </div>
                )}
              </div>
            </div>
            
            {hasNarration && audioDuration > 0 && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer z-20 pointer-events-auto"
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
                ref={setAudioRef}
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
            

            {/* ═══════════════════════════════════════════════════════════════════════
                CTA CARD - Call to Action Layout
                Displays centered button instead of captions for CTA cards
            ═══════════════════════════════════════════════════════════════════════ */}
            {card.cardType === 'cta' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-20"
                style={{
                  padding: `${captionGeometry.safeAreaTop * captionGeometry.viewportScale}px ${captionGeometry.safeAreaLeft * captionGeometry.viewportScale}px`,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex flex-col items-center gap-4 text-center px-6"
                >
                  {card.ctaHeadline && (
                    <h2 
                      className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg"
                      style={{
                        textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 4px 20px rgba(0,0,0,0.5)',
                      }}
                    >
                      {card.ctaHeadline}
                    </h2>
                  )}
                  
                  {card.ctaUrl && card.ctaButtonLabel && (
                    <Button
                      asChild
                      size="lg"
                      className="bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/30 border-cyan-600"
                      data-testid="cta-button"
                    >
                      <a
                        href={card.ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {card.ctaButtonLabel}
                        <ExternalLink className="w-5 h-5 ml-2" />
                      </a>
                    </Button>
                  )}
                  
                  {card.ctaSubtext && (
                    <p 
                      className="text-sm text-white/70 max-w-xs"
                      style={{
                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      {card.ctaSubtext}
                    </p>
                  )}
                </motion.div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                COMPOSITION STAGE - Caption Rendering Architecture
                
                CRITICAL: Captions MUST be measured and rendered in composition space (1080px).
                DO NOT reintroduce DOM-width fitting or viewport-based calculations.
                
                How it works:
                1. Composition stage is exactly compositionWidth (1080px)
                2. Safe area padding applied inside the stage (54px each side)
                3. Text fitting uses availableCaptionWidth (972px) in composition space
                4. The ENTIRE stage is scaled via CSS transform: scale(viewportScale)
                5. Layout happens first at full size, then paint scales uniformly
                
                If fit width = render width in the same coordinate system, clipping is IMPOSSIBLE.
                
                DO NOT:
                - Use clientWidth, offsetWidth, or ResizeObserver for caption fitting
                - Apply max-width: 90% or similar viewport-relative constraints
                - Add scale() transforms to inner caption elements
                - Reference containerWidthPx from DOM measurements
                
                This architecture matches professional video systems (Remotion, CapCut, After Effects).
            ═══════════════════════════════════════════════════════════════════════ */}
            {card.cardType !== 'cta' && (() => {
              // Position settings: top/middle/bottom third of screen
              // Using flexbox for reliable vertical positioning without transform conflicts
              const position = captionState?.position || 'bottom';
              const justifyContent = position === 'top' ? 'flex-start' : position === 'middle' ? 'center' : 'flex-end';
              const transformOrigin = position === 'top' ? 'top center' : position === 'middle' ? 'center center' : 'bottom center';
              
              // Safe area padding based on position
              const paddingTop = position === 'top' ? `${captionGeometry.safeAreaTop * captionGeometry.viewportScale}px` : 0;
              const paddingBottom = position === 'bottom' ? `${captionGeometry.safeAreaBottom * captionGeometry.viewportScale}px` : 0;
              
              return (
            <div
              className="absolute inset-0 flex flex-col items-center pointer-events-none"
              style={{
                justifyContent,
                paddingTop,
                paddingBottom,
              }}
            >
              {/* Scale wrapper - scales the composition stage to viewport size */}
              <div
                style={{
                  transform: `scale(${captionGeometry.viewportScale})`,
                  transformOrigin,
                }}
              >
                {/* COMPOSITION STAGE - exactly compositionWidth, clips any overflow */}
                <div
                  style={{
                    width: captionGeometry.compositionWidth,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    paddingLeft: captionGeometry.safeAreaLeft,
                    paddingRight: captionGeometry.safeAreaRight,
                    boxSizing: "border-box",
                    overflow: "hidden", // Clip any text that exceeds safe area width
                  }}
                >
                  <AnimatePresence mode="wait">
                    {(() => {
                      // Animation variants based on captionState.animationId
                      const animationId = captionState?.animationId || 'fade';
                      
                      // Get animation props based on selected animation
                      const getAnimationProps = () => {
                        switch (animationId) {
                          case 'none':
                            return {
                              initial: { opacity: 1 },
                              animate: { opacity: 1 },
                              exit: { opacity: 1 },
                              transition: { duration: 0 },
                            };
                          case 'slide_up':
                            return {
                              initial: { opacity: 0, y: 40 },
                              animate: { opacity: 1, y: 0 },
                              exit: { opacity: 0, y: -30 },
                              transition: { duration: 0.5, ease: "easeOut" as const },
                            };
                          case 'pop':
                            return {
                              initial: { opacity: 0, scale: 0.8 },
                              animate: { opacity: 1, scale: 1 },
                              exit: { opacity: 0, scale: 0.9 },
                              transition: { duration: 0.4, type: "spring" as const, stiffness: 400, damping: 15 },
                            };
                          case 'typewriter':
                            return {
                              initial: { opacity: 0, x: -20 },
                              animate: { opacity: 1, x: 0 },
                              exit: { opacity: 0, x: 20 },
                              transition: { duration: 0.4, ease: "easeOut" as const },
                            };
                          case 'fade':
                          default:
                            return {
                              initial: { opacity: 0 },
                              animate: { opacity: 1 },
                              exit: { opacity: 0 },
                              transition: { duration: 0.5, ease: "easeOut" as const },
                            };
                        }
                      };
                      const animProps = getAnimationProps();
                      
                      return (
                    <motion.div
                      key={captionIndex}
                      initial={animProps.initial}
                      animate={animProps.animate}
                      exit={animProps.exit}
                      transition={animProps.transition}
                      style={{
                        width: "100%",
                        maxWidth: captionGeometry.availableCaptionWidth,
                      }}
                    >
                      {captionIndex < card.captions.length && captionStylesCache[captionIndex] ? (
                        (() => {
                          // Use cached styles (pre-calculated in useMemo)
                          const styles = captionStylesCache[captionIndex];
                          const showCaptionDebug = new URLSearchParams(window.location.search).get('captionDebug') === '1';
                          
                          return (
                            <div className="flex flex-col items-center w-full">
                              <ScaleToFitCaption
                                lines={styles.headlineLines}
                                panelStyle={styles.panel}
                                textStyle={styles.headline}
                                containerWidthPx={captionGeometry.availableCaptionWidth}
                                fittedFontSizePx={styles.headlineFontSizePx}
                                didFit={styles.headlineDidFit}
                                showDebug={showCaptionDebug}
                                fitGeometry={styles.fitGeometry}
                              />
                            </div>
                          );
                        })()
                      ) : null}
                    </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            );
            })()}
            {/* End composition stage */}

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

            {/* Admin CTA - centered at bottom, above navigation controls */}
            {/* Placed outside the scale animation container for stable positioning */}
            {adminCtaEnabled && (
              <a 
                href="/"
                className="absolute z-30 pointer-events-auto bottom-20 left-1/2 -translate-x-1/2"
                data-testid="admin-cta-overlay"
              >
                <div className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-500 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2.5 shadow-lg shadow-cyan-500/25 border border-white/20 hover:shadow-cyan-400/40 hover:scale-[1.02] transition-all duration-200">
                  <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <span className="text-white text-xs font-semibold tracking-wide whitespace-nowrap">
                    Made with IceMaker
                  </span>
                </div>
              </a>
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
