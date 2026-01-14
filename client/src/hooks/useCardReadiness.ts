import { useState, useEffect, useCallback, useRef } from "react";

interface MediaUrls {
  imageUrl?: string | null;
  videoUrl?: string | null;
}

interface CardReadinessState {
  isMediaReady: boolean;
  isMounted: boolean;
  isFullyReady: boolean;
}

interface UseCardReadinessOptions {
  imageUrl?: string | null;
  videoUrl?: string | null;
  preferVideo?: boolean;
  onReady?: () => void;
}

export const TRANSITION_CONFIG = {
  duration: 0.4,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  readyDelay: 80,
} as const;

export function useCardReadiness({
  imageUrl,
  videoUrl,
  preferVideo = false,
  onReady,
}: UseCardReadinessOptions): CardReadinessState & {
  markMounted: () => void;
  resetReadiness: () => void;
} {
  const [isMounted, setIsMounted] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const onReadyCalledRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const primaryMediaUrl = preferVideo && videoUrl ? videoUrl : imageUrl;

  const markMounted = useCallback(() => {
    setIsMounted(true);
  }, []);

  const resetReadiness = useCallback(() => {
    setIsMounted(false);
    setIsMediaReady(false);
    onReadyCalledRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetReadiness();

    if (!primaryMediaUrl) {
      setIsMediaReady(true);
      return;
    }

    const isVideo = preferVideo && videoUrl && primaryMediaUrl === videoUrl;

    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = primaryMediaUrl;
      
      const handleCanPlay = () => {
        setIsMediaReady(true);
        video.removeEventListener("canplaythrough", handleCanPlay);
        video.removeEventListener("loadeddata", handleCanPlay);
        video.removeEventListener("error", handleError);
      };
      
      const handleError = () => {
        setIsMediaReady(true);
        video.removeEventListener("canplaythrough", handleCanPlay);
        video.removeEventListener("loadeddata", handleCanPlay);
        video.removeEventListener("error", handleError);
      };

      video.addEventListener("loadeddata", handleCanPlay);
      video.addEventListener("canplaythrough", handleCanPlay);
      video.addEventListener("error", handleError);

      timeoutRef.current = setTimeout(() => {
        setIsMediaReady(true);
      }, 3000);

      return () => {
        video.removeEventListener("canplaythrough", handleCanPlay);
        video.removeEventListener("loadeddata", handleCanPlay);
        video.removeEventListener("error", handleError);
        video.src = "";
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      const img = new Image();
      img.src = primaryMediaUrl;
      
      const handleLoad = () => {
        if ("decode" in img) {
          img.decode().then(() => {
            setIsMediaReady(true);
          }).catch(() => {
            setIsMediaReady(true);
          });
        } else {
          setIsMediaReady(true);
        }
      };

      const handleError = () => {
        setIsMediaReady(true);
      };

      if (img.complete && img.naturalWidth > 0) {
        handleLoad();
      } else {
        img.onload = handleLoad;
        img.onerror = handleError;
      }

      timeoutRef.current = setTimeout(() => {
        setIsMediaReady(true);
      }, 3000);

      return () => {
        img.onload = null;
        img.onerror = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [primaryMediaUrl, preferVideo, videoUrl, resetReadiness]);

  const isFullyReady = isMounted && isMediaReady;

  useEffect(() => {
    if (isFullyReady && !onReadyCalledRef.current && onReady) {
      onReadyCalledRef.current = true;
      const delay = setTimeout(() => {
        onReady();
      }, TRANSITION_CONFIG.readyDelay);
      return () => clearTimeout(delay);
    }
  }, [isFullyReady, onReady]);

  return {
    isMounted,
    isMediaReady,
    isFullyReady,
    markMounted,
    resetReadiness,
  };
}

export function preloadCardMedia(urls: MediaUrls): void {
  if (urls.imageUrl) {
    const img = new Image();
    img.src = urls.imageUrl;
    if ("decode" in img) {
      img.decode().catch(() => {});
    }
  }
  
  if (urls.videoUrl) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = urls.videoUrl;
    document.head.appendChild(link);
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 30000);
  }
}

export function usePreloadNextCard(
  cards: Array<{ generatedImageUrl?: string | null; generatedVideoUrl?: string | null }>,
  currentIndex: number
): void {
  useEffect(() => {
    const nextCard = cards[currentIndex + 1];
    if (nextCard) {
      preloadCardMedia({
        imageUrl: nextCard.generatedImageUrl,
        videoUrl: nextCard.generatedVideoUrl,
      });
    }
  }, [cards, currentIndex]);
}
