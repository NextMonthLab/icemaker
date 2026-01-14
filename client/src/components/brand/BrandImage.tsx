import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  type BrandImagePurpose,
  getBrandImageById,
  getDeterministicFallbackCover,
  getFallbackLibraryCovers,
} from "@/brand/brandImages";

interface BrandImageProps {
  imageUrl?: string;
  imageId?: string;
  fallbackPurpose?: BrandImagePurpose;
  stableKey?: string;
  alt?: string;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait";
}

/**
 * BrandImage Component
 * 
 * Renders an image with fallback support for brand consistency.
 * Use for ICE card covers and other foreground images.
 * 
 * Priority:
 * 1. imageUrl (direct URL, e.g., from ICE data)
 * 2. imageId (reference to brandImages.ts)
 * 3. Deterministic fallback based on stableKey
 * 4. Gradient placeholder
 * 
 * Usage:
 * <BrandImage 
 *   imageUrl={ice.coverImage} 
 *   stableKey={ice.id}
 *   alt="Story cover"
 * />
 */
export function BrandImage({
  imageUrl,
  imageId,
  fallbackPurpose = "library-card-fallback",
  stableKey = "",
  alt = "Cover image",
  className,
  aspectRatio = "video",
}: BrandImageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Determine which image to show
  const getImageUrl = useCallback((): string | undefined => {
    // Priority 1: Direct URL provided
    if (imageUrl && imageUrl.length > 0) {
      return imageUrl;
    }

    // Priority 2: Reference to brandImages by ID
    if (imageId) {
      const brandImage = getBrandImageById(imageId);
      if (brandImage && brandImage.url.length > 0) {
        return brandImage.url;
      }
    }

    // Priority 3: Fallback covers
    const fallbackCovers = getFallbackLibraryCovers();
    if (fallbackCovers.length === 0) {
      return undefined;
    }

    // Try deterministic selection first
    if (stableKey && currentImageIndex === 0) {
      const deterministicCover = getDeterministicFallbackCover(stableKey, 0);
      if (deterministicCover) {
        return deterministicCover.url;
      }
    }

    // Rotate through fallbacks on error
    if (currentImageIndex < fallbackCovers.length) {
      return fallbackCovers[currentImageIndex].url;
    }

    return undefined;
  }, [imageUrl, imageId, stableKey, currentImageIndex]);

  const currentUrl = getImageUrl();

  const handleError = useCallback(() => {
    const fallbackCovers = getFallbackLibraryCovers();
    if (currentImageIndex < fallbackCovers.length - 1) {
      setCurrentImageIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  }, [currentImageIndex]);

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
  }[aspectRatio];

  // Gradient placeholder when no image available
  if (!currentUrl || allFailed) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-primary/10",
          aspectRatioClass,
          className
        )}
        role="img"
        aria-label={alt}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
      <img
        src={currentUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        onError={handleError}
      />
      {/* Subtle overlay for consistency */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    </div>
  );
}

export default BrandImage;
