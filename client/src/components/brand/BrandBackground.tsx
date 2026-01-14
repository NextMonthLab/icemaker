import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  type BrandImagePurpose,
  getBrandImageById,
  getFirstValidImageForPurpose,
} from "@/brand/brandImages";

interface BrandBackgroundProps {
  purpose: BrandImagePurpose;
  imageId?: string;
  variant?: "subtle" | "hero";
  className?: string;
  children?: React.ReactNode;
}

/**
 * BrandBackground Component
 * 
 * Renders a background with optional Cloudinary image overlay.
 * Falls back gracefully to gradient-only if image is missing or fails to load.
 * 
 * Usage:
 * <BrandBackground purpose="home-hero" variant="hero">
 *   <YourContent />
 * </BrandBackground>
 */
export function BrandBackground({
  purpose,
  imageId,
  variant = "subtle",
  className,
  children,
}: BrandBackgroundProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Get the brand image config
  const brandImage = imageId
    ? getBrandImageById(imageId)
    : getFirstValidImageForPurpose(purpose);

  const hasValidImage = brandImage && brandImage.url.length > 0 && !imageError;

  // Default values
  const overlayOpacity = brandImage?.overlayOpacity ?? (variant === "hero" ? 0.7 : 0.9);
  const blurPx = brandImage?.blurPx ?? (variant === "hero" ? 2 : 8);
  const shouldPreload = brandImage?.preload ?? false;

  // Preload image if configured
  useEffect(() => {
    if (!hasValidImage || !brandImage?.url) return;

    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageError(true);
    img.src = brandImage.url;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [brandImage?.url, hasValidImage]);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // If no valid image is configured, just render children without any overlay
  // This makes the component a transparent passthrough until URLs are added
  if (!hasValidImage) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Brand image layer - only renders when valid URL exists */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          imageLoaded ? "opacity-100" : "opacity-0",
          prefersReducedMotion && "transition-none"
        )}
        aria-hidden="true"
      >
        <img
          src={brandImage.url}
          alt=""
          loading={shouldPreload ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: `blur(${blurPx}px)`,
            transform: "scale(1.1)", // Prevent blur edge artifacts
          }}
          onError={() => setImageError(true)}
        />
        {/* Overlay for contrast */}
        <div
          className="absolute inset-0 bg-background"
          style={{ opacity: overlayOpacity }}
        />
      </div>

      {/* Accent gradient overlay for hero variant */}
      {variant === "hero" && (
        <div
          className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default BrandBackground;
