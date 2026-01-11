/**
 * Unified Caption Geometry Contract
 *
 * This module provides the single source of truth for all caption geometry calculations.
 * It ensures that font sizing, DOM rendering, and Remotion export all use identical
 * coordinate systems and measurements.
 *
 * CRITICAL: All caption rendering code MUST use this module to prevent clipping bugs.
 */

export interface CaptionGeometry {
  // Composition dimensions (fixed, canonical)
  compositionWidth: number;
  compositionHeight: number;

  // Safe area (in composition coordinates)
  safeAreaLeft: number;
  safeAreaRight: number;
  safeAreaTop: number;
  safeAreaBottom: number;

  // Available caption area (in composition coordinates)
  availableCaptionWidth: number;
  captionBottomY: number;

  // For DOM rendering: scale factor from composition to viewport
  viewportScale: number;

  // Actual DOM dimensions (scaled)
  viewportCaptionWidth: number;
  viewportPadding: number;
}

/**
 * Calculate unified caption geometry
 *
 * @param options - Configuration options
 * @returns Complete geometry contract for caption rendering
 */
export function calculateCaptionGeometry(options: {
  // Composition dimensions (fixed, canonical)
  compositionWidth?: number;
  compositionHeight?: number;

  // Safe zone percentages (from titlePack)
  safeZoneLeftPercent?: number;
  safeZoneRightPercent?: number;
  safeZoneTopPercent?: number;
  safeZoneBottomPercent?: number;

  // For DOM rendering
  viewportScale?: number;

  // DEPRECATED: No longer use these - everything is derived from composition geometry
  // containerWidth?: number;
  // nestedPadding?: boolean;
} = {}): CaptionGeometry {
  // Fixed composition dimensions (9:16 vertical video)
  const compositionWidth = options.compositionWidth ?? 1080;
  const compositionHeight = options.compositionHeight ?? 1920;

  // Safe zone percentages (default: 5% left/right, 10% top, 15% bottom)
  const safeZoneLeft = options.safeZoneLeftPercent ?? 5;
  const safeZoneRight = options.safeZoneRightPercent ?? 5;
  const safeZoneTop = options.safeZoneTopPercent ?? 10;
  const safeZoneBottom = options.safeZoneBottomPercent ?? 15;

  // Calculate safe area in composition coordinates
  const safeAreaLeft = compositionWidth * (safeZoneLeft / 100);
  const safeAreaRight = compositionWidth * (safeZoneRight / 100);
  const safeAreaTop = compositionHeight * (safeZoneTop / 100);
  const safeAreaBottom = compositionHeight * (safeZoneBottom / 100);

  // Available caption width (composition space)
  const availableCaptionWidth = compositionWidth - safeAreaLeft - safeAreaRight;

  // Caption bottom position (composition space)
  const captionBottomY = compositionHeight - safeAreaBottom;

  // Viewport scale (for DOM rendering)
  const viewportScale = options.viewportScale ?? 0.4;

  // Viewport dimensions (scaled from composition)
  const viewportCaptionWidth = availableCaptionWidth * viewportScale;
  const viewportPadding = safeAreaLeft * viewportScale;

  return {
    compositionWidth,
    compositionHeight,
    safeAreaLeft,
    safeAreaRight,
    safeAreaTop,
    safeAreaBottom,
    availableCaptionWidth,
    captionBottomY,
    viewportScale,
    viewportCaptionWidth,
    viewportPadding,
  };
}

/**
 * Calculate font size based on geometry contract
 *
 * @param text - Text to measure
 * @param baseFontSize - Base font size in composition coordinates
 * @param geometry - Geometry contract
 * @returns Scaled font size for viewport rendering
 */
export function calculateViewportFontSize(
  text: string,
  baseFontSize: number,
  geometry: CaptionGeometry,
  maxLines: number = 2
): number {
  // Estimate characters per line based on font size
  const avgCharWidth = 0.5; // Approximate ratio of font size to character width

  // Calculate in composition space first
  let fontSize = baseFontSize;
  const maxCharsPerLine = Math.floor(geometry.availableCaptionWidth / (fontSize * avgCharWidth));
  const lines = Math.ceil(text.length / maxCharsPerLine);

  // Scale down if exceeds max lines
  if (lines > maxLines) {
    const neededCharsPerLine = Math.ceil(text.length / maxLines);
    fontSize = Math.max(
      baseFontSize * 0.5, // Minimum 50% of base size
      geometry.availableCaptionWidth / (neededCharsPerLine * avgCharWidth)
    );
  }

  // Scale to viewport
  return Math.round(fontSize * geometry.viewportScale);
}

/**
 * Get debug overlay data for visual verification
 *
 * @param geometry - Geometry contract
 * @returns CSS-compatible boundary data for overlays
 */
export function getDebugOverlayData(geometry: CaptionGeometry) {
  return {
    // Safe area boundaries (in viewport coordinates)
    safeAreaBounds: {
      left: geometry.safeAreaLeft * geometry.viewportScale,
      right: geometry.safeAreaRight * geometry.viewportScale,
      top: geometry.safeAreaTop * geometry.viewportScale,
      bottom: geometry.safeAreaBottom * geometry.viewportScale,
    },

    // Available caption region
    captionRegion: {
      width: geometry.viewportCaptionWidth,
      left: geometry.safeAreaLeft * geometry.viewportScale,
      bottom: (geometry.compositionHeight - geometry.captionBottomY) * geometry.viewportScale,
    },

    // Composition dimensions
    composition: {
      width: geometry.compositionWidth,
      height: geometry.compositionHeight,
    },
  };
}

/**
 * Validate that caption text will fit without clipping
 *
 * @param text - Caption text
 * @param fontSize - Calculated font size (viewport)
 * @param geometry - Geometry contract
 * @returns true if text will fit, false if it will clip
 */
export function validateCaptionFits(
  text: string,
  fontSize: number,
  geometry: CaptionGeometry
): { fits: boolean; estimatedWidth: number; availableWidth: number } {
  // Rough estimate of text width
  const avgCharWidth = 0.5;
  const estimatedWidth = text.length * fontSize * avgCharWidth;
  const availableWidth = geometry.viewportCaptionWidth;

  return {
    fits: estimatedWidth <= availableWidth,
    estimatedWidth,
    availableWidth,
  };
}
