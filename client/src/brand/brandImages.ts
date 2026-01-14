/**
 * Brand Images Configuration
 * 
 * This file is the single source of truth for all brand imagery in IceMaker.
 * Rob can update Cloudinary URLs here without touching JSX files.
 * 
 * HOW TO UPDATE:
 * 1. Find the image entry by its `id` field
 * 2. Replace the `url` value with your Cloudinary URL
 * 3. Adjust `overlayOpacity` or `blurPx` if needed for contrast
 */

export type BrandImagePurpose =
  | "global-bg"
  | "home-hero"
  | "home-section"
  | "pricing-hero"
  | "library-bg"
  | "library-card-fallback"
  | "examples-bg"
  | "discover-bg";

export type BrandImageMood = "cinematic" | "playful";

export interface BrandImage {
  id: string;
  label: string;
  url: string;
  alt?: string;
  purpose: BrandImagePurpose;
  mood?: BrandImageMood;
  overlayOpacity?: number;
  blurPx?: number;
  preload?: boolean;
}

/**
 * BRAND IMAGE IDS
 * Use these constants when referencing images by ID
 */
export const HOME_HERO_IMAGE_ID = "home-hero-main";
export const GLOBAL_BG_IMAGE_ID = "global-bg-main";
export const LIBRARY_BG_IMAGE_ID = "library-bg-main";
export const PRICING_BG_IMAGE_ID = "pricing-hero-main";
export const EXAMPLES_BG_IMAGE_ID = "examples-bg-main";
export const DISCOVER_BG_IMAGE_ID = "discover-bg-main";

/**
 * BRAND IMAGES CONFIGURATION
 * 
 * Rob: Paste your Cloudinary URLs in the `url` fields below.
 * Leave empty string "" if no image is available yet.
 */
export const BRAND_IMAGES: BrandImage[] = [
  // ============ GLOBAL BACKGROUNDS ============
  {
    id: GLOBAL_BG_IMAGE_ID,
    label: "Global Background",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Abstract cinematic background",
    purpose: "global-bg",
    mood: "cinematic",
    overlayOpacity: 0.85,
    blurPx: 20,
    preload: false,
  },

  // ============ HOME PAGE ============
  {
    id: HOME_HERO_IMAGE_ID,
    label: "Home Hero Background",
    url: "https://res.cloudinary.com/drl0fxrkq/image/upload/v1768424814/Winter_Lake_original_1297313_fpmqtu.jpg", // Rob: paste Cloudinary URL here
    alt: "Cinematic storytelling hero image",
    purpose: "home-hero",
    mood: "cinematic",
    overlayOpacity: 0.7,
    blurPx: 8,
    preload: true, // Above the fold - preload for performance
  },
  {
    id: "home-section-features",
    label: "Home Features Section",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Features background",
    purpose: "home-section",
    mood: "cinematic",
    overlayOpacity: 0.9,
    blurPx: 30,
    preload: false,
  },

  // ============ PRICING PAGE ============
  {
    id: PRICING_BG_IMAGE_ID,
    label: "Pricing Hero Background",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Premium pricing background",
    purpose: "pricing-hero",
    mood: "cinematic",
    overlayOpacity: 0.8,
    blurPx: 12,
    preload: true,
  },

  // ============ LIBRARY PAGE ============
  {
    id: LIBRARY_BG_IMAGE_ID,
    label: "Library Background",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Library background",
    purpose: "library-bg",
    mood: "cinematic",
    overlayOpacity: 0.92,
    blurPx: 25,
    preload: false,
  },

  // ============ LIBRARY CARD FALLBACKS ============
  // These are used when an ICE doesn't have its own cover image
  {
    id: "fallback-cover-1",
    label: "Fallback Cover 1",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Story cover",
    purpose: "library-card-fallback",
    mood: "cinematic",
    overlayOpacity: 0.3,
  },
  {
    id: "fallback-cover-2",
    label: "Fallback Cover 2",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Story cover",
    purpose: "library-card-fallback",
    mood: "cinematic",
    overlayOpacity: 0.3,
  },
  {
    id: "fallback-cover-3",
    label: "Fallback Cover 3",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Story cover",
    purpose: "library-card-fallback",
    mood: "cinematic",
    overlayOpacity: 0.3,
  },
  {
    id: "fallback-cover-4",
    label: "Fallback Cover 4",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Story cover",
    purpose: "library-card-fallback",
    mood: "playful",
    overlayOpacity: 0.3,
  },

  // ============ EXAMPLES / DISCOVER ============
  {
    id: EXAMPLES_BG_IMAGE_ID,
    label: "Examples Background",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Examples showcase background",
    purpose: "examples-bg",
    mood: "playful",
    overlayOpacity: 0.85,
    blurPx: 15,
    preload: false,
  },
  {
    id: DISCOVER_BG_IMAGE_ID,
    label: "Discover Background",
    url: "", // Rob: paste Cloudinary URL here
    alt: "Discover page background",
    purpose: "discover-bg",
    mood: "playful",
    overlayOpacity: 0.88,
    blurPx: 18,
    preload: false,
  },
];

/**
 * Get a brand image by its ID
 */
export function getBrandImageById(id: string): BrandImage | undefined {
  return BRAND_IMAGES.find((img) => img.id === id);
}

/**
 * Get all brand images for a specific purpose
 */
export function getBrandImagesByPurpose(purpose: BrandImagePurpose): BrandImage[] {
  return BRAND_IMAGES.filter((img) => img.purpose === purpose);
}

/**
 * Get fallback library covers (for ICEs without their own cover)
 * Returns only images that have valid URLs
 */
export function getFallbackLibraryCovers(): BrandImage[] {
  return BRAND_IMAGES.filter(
    (img) => img.purpose === "library-card-fallback" && img.url.length > 0
  );
}

/**
 * Get a deterministic fallback cover based on a stable key (e.g., ICE id)
 * Falls back to index-based rotation if no valid covers available
 */
export function getDeterministicFallbackCover(stableKey: string, index: number = 0): BrandImage | undefined {
  const covers = getFallbackLibraryCovers();
  if (covers.length === 0) return undefined;
  
  // Create a simple hash from the stable key for deterministic selection
  let hash = 0;
  for (let i = 0; i < stableKey.length; i++) {
    hash = (hash << 5) - hash + stableKey.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const coverIndex = Math.abs(hash + index) % covers.length;
  return covers[coverIndex];
}

/**
 * Get the first valid image for a purpose, or undefined if none available
 */
export function getFirstValidImageForPurpose(purpose: BrandImagePurpose): BrandImage | undefined {
  return BRAND_IMAGES.find((img) => img.purpose === purpose && img.url.length > 0);
}
