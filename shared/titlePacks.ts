import { z } from "zod";
import type { CSSProperties } from "react";

// Type-only import - CaptionGeometry is defined in client but used here as optional parameter
// This creates a soft dependency that allows titlePacks to work standalone
export interface CaptionGeometry {
  compositionWidth: number;
  compositionHeight: number;
  safeAreaLeft: number;
  safeAreaRight: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  availableCaptionWidth: number;
  captionBottomY: number;
  viewportScale: number;
  viewportCaptionWidth: number;
  viewportPadding: number;
}

export const titlePackLayerSchema = z.object({
  fontFamily: z.string(),
  fontWeight: z.number().default(400),
  sizeMin: z.number(), // in px for 1080 canvas
  sizeMax: z.number(),
  letterSpacing: z.string().optional(), // e.g., "0.05em"
  textTransform: z.enum(["uppercase", "lowercase", "capitalize", "none"]).default("none"),
  color: z.string(), // CSS color or token like "primary"
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  maxLines: z.number().default(2),
  stroke: z.object({
    color: z.string(),
    width: z.number(), // in px
  }).optional(),
  shadow: z.object({
    color: z.string(),
    blur: z.number(),
    x: z.number(),
    y: z.number(),
  }).optional(),
  glow: z.object({
    color: z.string(),
    blur: z.number(),
  }).optional(),
});

export type TitlePackLayer = z.infer<typeof titlePackLayerSchema>;

export const titlePackSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  thumbnail: z.string().optional(), // Preview image URL
  
  // Canvas settings
  canvas: z.object({
    width: z.number().default(1080),
    height: z.number().default(1920),
  }).default({ width: 1080, height: 1920 }),
  
  // Safe zones (percentage from edges)
  safeZone: z.object({
    top: z.number().default(10), // 10% from top
    bottom: z.number().default(15), // 15% from bottom
    left: z.number().default(5),
    right: z.number().default(5),
  }).default({ top: 10, bottom: 15, left: 5, right: 5 }),
  
  // Color palette
  colors: z.object({
    primary: z.string(), // Main text color
    accent: z.string(), // Accent/highlight color
    background: z.string().optional(), // Optional overlay
  }),
  
  // Text layers
  headline: titlePackLayerSchema,
  supporting: titlePackLayerSchema.optional(),
  
  // Accent shapes
  accentShape: z.object({
    type: z.enum(["none", "pill", "box", "tape", "underline", "diagonal", "letterbox"]),
    color: z.string(),
    opacity: z.number().default(1),
    blur: z.number().optional(), // For glow effects
  }).optional(),
  
  // Badge/tag (for episode markers etc)
  badge: z.object({
    enabled: z.boolean().default(false),
    position: z.enum(["top-left", "top-center", "top-right"]).default("top-left"),
    style: z.enum(["pill", "box", "minimal"]).default("pill"),
    fontFamily: z.string(),
    fontSize: z.number(),
    color: z.string(),
    backgroundColor: z.string(),
  }).optional(),
  
  // Texture overlay
  textureOverlay: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(["grain", "noise", "scanlines", "vhs"]),
    opacity: z.number().default(0.1),
  }).optional(),
  
  // Animation preset (for future use)
  animation: z.enum(["none", "fade", "slide", "pop", "type-on"]).default("fade"),
});

export type TitlePack = z.infer<typeof titlePackSchema>;

// ============ PREDEFINED TITLE PACKS ============

export const TITLE_PACKS: TitlePack[] = [
  // 1. Neon Impact - Bold uppercase, thick stroke + glow, neon accents
  {
    id: "neon-impact",
    name: "Neon Impact",
    description: "Big uppercase headline with thick stroke and neon glow. Great for hooks and bold statements.",
    canvas: { width: 1080, height: 1920 },
    safeZone: { top: 10, bottom: 20, left: 5, right: 5 },
    colors: {
      primary: "#ffffff",
      accent: "#ec4899", // pink
      background: "rgba(0,0,0,0.3)",
    },
    headline: {
      fontFamily: '"Bebas Neue", sans-serif',
      fontWeight: 400,
      sizeMin: 48,
      sizeMax: 72,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#ffffff",
      textAlign: "center",
      maxLines: 2,
      stroke: {
        color: "#ec4899",
        width: 3,
      },
      glow: {
        color: "#ec4899",
        blur: 20,
      },
    },
    supporting: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 500,
      sizeMin: 20,
      sizeMax: 28,
      textTransform: "none",
      color: "rgba(255,255,255,0.85)",
      textAlign: "center",
      maxLines: 3,
    },
    accentShape: {
      type: "none",
      color: "#ec4899",
      opacity: 0.8,
    },
    animation: "pop",
  },
  
  // 2. Cinematic Subtitles - Lower-third, letterbox vibe, restrained palette
  {
    id: "cinematic-subtitles",
    name: "Cinematic Subtitles",
    description: "Lower-third framing with subtle letterbox vibe. Perfect for narration-driven stories.",
    canvas: { width: 1080, height: 1920 },
    safeZone: { top: 5, bottom: 25, left: 8, right: 8 },
    colors: {
      primary: "#ffffff",
      accent: "#94a3b8", // slate
      background: "rgba(0,0,0,0.5)",
    },
    headline: {
      fontFamily: '"Cinzel", serif',
      fontWeight: 500,
      sizeMin: 32,
      sizeMax: 48,
      letterSpacing: "0.02em",
      textTransform: "none",
      color: "#ffffff",
      textAlign: "center",
      maxLines: 2,
      shadow: {
        color: "rgba(0,0,0,0.9)",
        blur: 15,
        x: 0,
        y: 4,
      },
    },
    supporting: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      sizeMin: 18,
      sizeMax: 24,
      textTransform: "none",
      color: "rgba(255,255,255,0.75)",
      textAlign: "center",
      maxLines: 3,
      shadow: {
        color: "rgba(0,0,0,0.8)",
        blur: 10,
        x: 0,
        y: 2,
      },
    },
    accentShape: {
      type: "letterbox",
      color: "#000000",
      opacity: 0.4,
    },
    animation: "fade",
  },
  
  // 3. Grunge Tape - Sticker/tape labels, distressed overlays
  {
    id: "grunge-tape",
    name: "Grunge Tape",
    description: "Sticker and tape labels with rough edges. Feels street, raw, documentary.",
    canvas: { width: 1080, height: 1920 },
    safeZone: { top: 15, bottom: 20, left: 5, right: 5 },
    colors: {
      primary: "#1a1a1a",
      accent: "#fef3c7", // cream/tape color
      background: "transparent",
    },
    headline: {
      fontFamily: '"Oswald", sans-serif',
      fontWeight: 700,
      sizeMin: 36,
      sizeMax: 56,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
      color: "#1a1a1a",
      textAlign: "center",
      maxLines: 2,
    },
    supporting: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 500,
      sizeMin: 18,
      sizeMax: 24,
      textTransform: "none",
      color: "#1a1a1a",
      textAlign: "center",
      maxLines: 3,
    },
    accentShape: {
      type: "tape",
      color: "#fef3c7",
      opacity: 0.95,
    },
    textureOverlay: {
      enabled: true,
      type: "grain",
      opacity: 0.15,
    },
    animation: "slide",
  },
  
  // 4. Editorial Minimal - Clean modern, high whitespace, accent line
  {
    id: "editorial-minimal",
    name: "Editorial Minimal",
    description: "Clean modern layout with high whitespace. Great for premium brand stories.",
    canvas: { width: 1080, height: 1920 },
    safeZone: { top: 10, bottom: 15, left: 10, right: 10 },
    colors: {
      primary: "#ffffff",
      accent: "#3b82f6", // blue
      background: "transparent",
    },
    headline: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 600,
      sizeMin: 36,
      sizeMax: 52,
      letterSpacing: "0.01em",
      textTransform: "none",
      color: "#ffffff",
      textAlign: "center",
      maxLines: 2,
      shadow: {
        color: "rgba(0,0,0,0.6)",
        blur: 12,
        x: 0,
        y: 3,
      },
    },
    supporting: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      sizeMin: 16,
      sizeMax: 22,
      textTransform: "none",
      color: "rgba(255,255,255,0.8)",
      textAlign: "center",
      maxLines: 3,
      shadow: {
        color: "rgba(0,0,0,0.5)",
        blur: 8,
        x: 0,
        y: 2,
      },
    },
    accentShape: {
      type: "underline",
      color: "#3b82f6",
      opacity: 1,
    },
    animation: "fade",
  },
  
  // 5. Hyper Cut - Angled shapes, diagonal slashes, punchy color
  {
    id: "hyper-cut",
    name: "Hyper Cut",
    description: "Angled shapes, diagonal slashes, punchy colors. Best for fast TikTok pacing.",
    canvas: { width: 1080, height: 1920 },
    safeZone: { top: 15, bottom: 18, left: 5, right: 5 },
    colors: {
      primary: "#ffffff",
      accent: "#fbbf24", // amber/yellow
      background: "rgba(0,0,0,0.4)",
    },
    headline: {
      fontFamily: '"Bebas Neue", sans-serif',
      fontWeight: 400,
      sizeMin: 44,
      sizeMax: 68,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color: "#ffffff",
      textAlign: "center",
      maxLines: 2,
      stroke: {
        color: "#fbbf24",
        width: 2,
      },
    },
    supporting: {
      fontFamily: '"Oswald", sans-serif',
      fontWeight: 500,
      sizeMin: 22,
      sizeMax: 30,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      color: "#fbbf24",
      textAlign: "center",
      maxLines: 2,
    },
    accentShape: {
      type: "diagonal",
      color: "#fbbf24",
      opacity: 0.9,
    },
    animation: "pop",
  },
];

// ============ SMART TEXT FITTING ============

export interface TextFitResult {
  headline: string;
  supporting: string | null;
  headlineFontSize: number;
  supportingFontSize: number | null;
}

export function splitTextIntoHeadlineAndSupporting(text: string): { headline: string; supporting: string | null } {
  const trimmed = text.trim();
  
  // If short enough, it's all headline
  if (trimmed.length <= 60) {
    return { headline: trimmed, supporting: null };
  }
  
  // Try to split at first sentence boundary
  const sentenceMatch = trimmed.match(/^(.+?[.!?])\s+([\s\S]+)$/);
  if (sentenceMatch && sentenceMatch[1].length <= 80) {
    return {
      headline: sentenceMatch[1],
      supporting: sentenceMatch[2],
    };
  }
  
  // Split at comma or dash if reasonable
  const punctMatch = trimmed.match(/^(.{20,60}[,–—])\s*([\s\S]+)$/);
  if (punctMatch) {
    return {
      headline: punctMatch[1].replace(/[,–—]$/, ''),
      supporting: punctMatch[2],
    };
  }
  
  // Fall back to word boundary near midpoint
  const words = trimmed.split(/\s+/);
  if (words.length >= 4) {
    const midpoint = Math.ceil(words.length * 0.4);
    const headline = words.slice(0, midpoint).join(' ');
    const supporting = words.slice(midpoint).join(' ');
    return { headline, supporting };
  }
  
  return { headline: trimmed, supporting: null };
}

export function calculateFontSize(
  text: string,
  layer: TitlePackLayer,
  containerWidth: number
): number {
  // Estimate characters per line based on font size
  // Start with max size and scale down if needed
  const avgCharWidth = 0.5; // Approximate ratio of font size to character width
  
  let fontSize = layer.sizeMax;
  const maxCharsPerLine = Math.floor(containerWidth / (fontSize * avgCharWidth));
  const lines = Math.ceil(text.length / maxCharsPerLine);
  
  // Scale down if exceeds max lines
  if (lines > layer.maxLines) {
    const neededCharsPerLine = Math.ceil(text.length / layer.maxLines);
    fontSize = Math.max(layer.sizeMin, containerWidth / (neededCharsPerLine * avgCharWidth));
  }
  
  return Math.round(fontSize);
}

export function fitTextToPack(
  text: string,
  pack: TitlePack,
  containerWidth: number = 1080
): TextFitResult {
  const { headline, supporting } = splitTextIntoHeadlineAndSupporting(text);
  
  // Calculate safe zone width
  const safeWidth = containerWidth * (1 - (pack.safeZone.left + pack.safeZone.right) / 100);
  
  const headlineFontSize = calculateFontSize(headline, pack.headline, safeWidth);
  
  let supportingFontSize: number | null = null;
  if (supporting && pack.supporting) {
    supportingFontSize = calculateFontSize(supporting, pack.supporting, safeWidth);
  }
  
  return {
    headline,
    supporting,
    headlineFontSize,
    supportingFontSize,
  };
}

// Get pack by ID
export function getTitlePackById(id: string): TitlePack | undefined {
  return TITLE_PACKS.find(p => p.id === id);
}

// Default pack for new stories
export const DEFAULT_TITLE_PACK_ID = "cinematic-subtitles";

// Get all packs for selection UI
export function getAllTitlePacks(): TitlePack[] {
  return TITLE_PACKS;
}

// Generate CSS styles from a layer definition
export function getLayerStyles(
  layer: TitlePackLayer,
  fullScreen: boolean,
  containerWidth: number = 1080
): CSSProperties {
  // Use dynamic sizing from fitTextToPack when we have actual text
  // For now, calculate a scaled size based on viewport
  const baseFontSize = fullScreen ? layer.sizeMax : layer.sizeMin + (layer.sizeMax - layer.sizeMin) * 0.5;
  const viewportScale = fullScreen ? 0.5 : 0.4; // Scale for viewport display
  const scaledFontSize = Math.round(baseFontSize * viewportScale);
  
  // Build text shadow string
  let textShadow = '';
  if (layer.shadow) {
    textShadow = `${layer.shadow.x}px ${layer.shadow.y}px ${layer.shadow.blur}px ${layer.shadow.color}`;
  }
  if (layer.glow) {
    const glowShadow = `0 0 ${layer.glow.blur}px ${layer.glow.color}`;
    textShadow = textShadow ? `${textShadow}, ${glowShadow}` : glowShadow;
  }
  
  // Build stroke string for webkit
  let webkitTextStroke: string | undefined;
  if (layer.stroke) {
    webkitTextStroke = `${layer.stroke.width}px ${layer.stroke.color}`;
  }
  
  return {
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fontSize: `${scaledFontSize}px`,
    letterSpacing: layer.letterSpacing || 'normal',
    textTransform: layer.textTransform as CSSProperties['textTransform'],
    color: layer.color,
    textAlign: layer.textAlign,
    textShadow: textShadow || '0 2px 10px rgba(0,0,0,0.9)',
    WebkitTextStroke: webkitTextStroke,
  };
}

// Generate layer styles with dynamic font sizing based on actual text
export function getLayerStylesWithText(
  text: string,
  layer: TitlePackLayer,
  pack: TitlePack,
  fullScreen: boolean,
  geometry?: CaptionGeometry
): CSSProperties {
  let scaledFontSize: number;

  if (geometry) {
    // Use geometry contract for consistent font sizing
    const calculatedSize = calculateFontSize(text, layer, geometry.availableCaptionWidth);
    scaledFontSize = Math.round(calculatedSize * geometry.viewportScale);
  } else {
    // Fallback to old method (for backward compatibility)
    const containerWidth = pack.canvas.width;
    const safeWidth = containerWidth * (1 - (pack.safeZone.left + pack.safeZone.right) / 100);
    const calculatedSize = calculateFontSize(text, layer, safeWidth);
    const viewportScale = fullScreen ? 0.5 : 0.4;
    scaledFontSize = Math.round(calculatedSize * viewportScale);
  }

  // Build text shadow string
  let textShadow = '';
  if (layer.shadow) {
    textShadow = `${layer.shadow.x}px ${layer.shadow.y}px ${layer.shadow.blur}px ${layer.shadow.color}`;
  }
  if (layer.glow) {
    const glowShadow = `0 0 ${layer.glow.blur}px ${layer.glow.color}`;
    textShadow = textShadow ? `${textShadow}, ${glowShadow}` : glowShadow;
  }

  // Build stroke string
  let webkitTextStroke: string | undefined;
  if (layer.stroke) {
    webkitTextStroke = `${layer.stroke.width}px ${layer.stroke.color}`;
  }

  return {
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fontSize: `${scaledFontSize}px`,
    letterSpacing: layer.letterSpacing || 'normal',
    textTransform: layer.textTransform as CSSProperties['textTransform'],
    color: layer.color,
    textAlign: layer.textAlign,
    textShadow: textShadow || '0 2px 10px rgba(0,0,0,0.9)',
    WebkitTextStroke: webkitTextStroke,
  };
}
