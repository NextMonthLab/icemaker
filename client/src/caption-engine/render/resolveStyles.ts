import type { CSSProperties } from "react";
import type { CaptionPresetId, SafeAreaProfile, KaraokeStyleId, CaptionFontSize } from "../schemas";
import { captionPresets } from "../presets";
import { typographyTokens } from "../tokens/typography";
import { colorTokens } from "../tokens/colors";
import { backgroundTokens, getBackgroundCSS } from "../tokens/backgrounds";
import { getSafeAreaConfig } from "../safe-area";
import { fitTextToBox, type FitResult, type FitSettings } from "../layout/fit";
import { composeTitleLines, type CaptionLayoutMode } from "../layout/title";

export interface ResolveStylesInput {
  presetId: CaptionPresetId;
  fullScreen?: boolean;
  safeAreaProfileId?: SafeAreaProfile;
  karaokeEnabled?: boolean;
  karaokeStyle?: KaraokeStyleId;
  textLength?: number;
  headlineText?: string;
  layoutMode?: CaptionLayoutMode;
  fontSize?: CaptionFontSize;
  globalScaleFactor?: number;
  // Deck-level target font size from measureCaptionSet - ensures consistent sizing
  // while still running fitTextToBox to prevent overflow
  deckTargetFontSize?: number;
  layout?: {
    containerWidthPx: number;
  };
}

export interface ResolvedCaptionStyles {
  container: CSSProperties;
  panel: CSSProperties;
  headline: CSSProperties;
  supporting: CSSProperties;
  karaokeGlow?: string;
  headlineLines: string[];
  headlineFontSizePx: number;
  headlineDidFit: boolean;
  fitDebug?: {
    overflowLog: string[];
    panelWidth: number;
    lineCount: number;
  };
  fitGeometry: {
    panelWidthPx: number;
    paddingPx: number;
    panelMaxWidthPercent: number;
  };
}

export function resolveStyles(input: ResolveStylesInput): ResolvedCaptionStyles {
  const {
    presetId,
    fullScreen = false,
    safeAreaProfileId = "universal",
    karaokeEnabled = false,
    karaokeStyle = "weight",
    headlineText = "",
    layoutMode = "title",
    fontSize = "medium",
    globalScaleFactor = 1,
    deckTargetFontSize,
    layout,
  } = input;
  
  // Font size multipliers: small = 0.9x, medium = 1.1x, large = 1.35x
  // globalScaleFactor ensures consistency across all captions in a deck
  const fontSizeMultiplier = fontSize === 'small' ? 0.9 : fontSize === 'large' ? 1.35 : 1.1;

  const preset = captionPresets[presetId] || captionPresets.clean_white;
  const typography = typographyTokens[preset.typography] || typographyTokens.sans;
  const colors = colorTokens[preset.colors] || colorTokens.shadowWhite;
  const background = backgroundTokens[preset.background] || backgroundTokens.none;
  const safeArea = getSafeAreaConfig(safeAreaProfileId);

  const colorsAny = colors as any;

  const professionalTextShadow = colorsAny.shadow || "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.4)";
  const glowShadow = "0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.8)";
  
  // Determine if text color is light or dark using luminance
  // Dark shadow only makes sense on light text - dark shadow on dark text is unreadable
  const isLightText = (() => {
    const textColor = colors.text;
    if (!textColor || typeof textColor !== 'string') return true;
    
    // Parse hex color
    let hex = textColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    // Calculate relative luminance (simplified)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5; // Light text if luminance > 50%
  })();

  const panelStyles = getBackgroundCSS(preset.background, {
    pillColor: colorsAny.background,
  });

  const isParagraphMode = layoutMode === 'paragraph';
  const baseTypographySize = fullScreen ? typography.fontSize : typography.fontSize * 0.7;
  const baseFontSizeRaw = isParagraphMode ? baseTypographySize * 0.85 : baseTypographySize;
  
  // Per-caption fitting: each caption fits independently with its own font size
  // When deckTargetFontSize is provided, use it as the base to ensure consistency
  // Apply user's fontSize preference via fontSizeMultiplier
  const computedBaseFontSize = baseFontSizeRaw * fontSizeMultiplier;
  
  // If deck-level target is provided, use the smaller of the two
  // This ensures all captions use the same size (determined by longest caption)
  const baseFontSize = deckTargetFontSize 
    ? Math.min(computedBaseFontSize, deckTargetFontSize) 
    : computedBaseFontSize;
  
  // Raised minimum font sizes for better readability
  // Fullscreen: 32px min (was 24), Non-fullscreen: 24px min (was 16)
  const minFontSizeRaw = isParagraphMode 
    ? (fullScreen ? 24 : 18) 
    : (fullScreen ? 32 : 24);
  const minFontSize = minFontSizeRaw * fontSizeMultiplier;
  const containerWidth = layout?.containerWidthPx || 375;
  const lineHeight = isParagraphMode ? 1.15 : 1.1;
  
  // Allow more lines for long captions - 4 lines default, 5 for paragraph mode
  // This lets long captions wrap more before shrinking font
  const maxLines = isParagraphMode ? 5 : 4;

  const fitSettings: FitSettings = {
    maxLines,
    panelMaxWidthPercent: 92,
    baseFontSize: baseFontSize,
    minFontSize: minFontSize,
    padding: isParagraphMode ? 12 : 16,
    lineHeight,
    fontFamily: typography.fontFamily,
    fontWeight: 700,
  };

  let fitResult: FitResult;
  if (headlineText && headlineText.trim()) {
    const composedLines = composeTitleLines(headlineText, { layoutMode });
    const composedText = composedLines.join('\n');
    
    // Always run fitTextToBox to ensure text fits within container
    // When deckTargetFontSize is provided, baseFontSize is already the smallest from the deck,
    // so fitting will only shrink further if this specific caption still doesn't fit
    fitResult = fitTextToBox(composedText, containerWidth, fitSettings);
    fitResult.lines = composedLines;
  } else {
    fitResult = {
      lines: [''],
      fontSize: baseFontSize,
      lineCount: 1,
      panelWidth: containerWidth * 0.92,
      fitted: true,
      warning: null,
      iterations: 0,
      overflowLog: [],
    };
  }

  const container: CSSProperties = {
    maxHeight: "30vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "0 16px 24px",
  };

  const panel: CSSProperties = {
    ...panelStyles,
    maxWidth: `${fitSettings.panelMaxWidthPercent}%`,
  };

  const headline: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: `${fitResult.fontSize}px`,
    fontWeight: 700,
    lineHeight: fitSettings.lineHeight,
    letterSpacing: "-0.02em",
    textTransform: (typography as any).textTransform || "none",
    color: colors.text,
    textShadow: karaokeEnabled && karaokeStyle === "glow" 
      ? glowShadow 
      : (isLightText ? professionalTextShadow : "none"),
    WebkitTextStroke: colorsAny.stroke ? `${colorsAny.strokeWidth || 1}px ${colorsAny.stroke}` : undefined,
    margin: 0,
    textAlign: "center",
    display: "block",
    overflow: "visible",
    textOverflow: "clip",
    whiteSpace: "pre-line",
    wordBreak: "keep-all" as any,
    overflowWrap: "normal" as any,
    hyphens: "none",
  };

  const supporting: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: `${fitResult.fontSize * 0.5}px`,
    fontWeight: 400,
    lineHeight: 1.3,
    color: "rgba(255,255,255,0.75)",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    letterSpacing: "0.01em",
    margin: 0,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as any,
    WebkitLineClamp: 2,
    overflow: "hidden",
    whiteSpace: "normal",
    wordBreak: "keep-all" as any,
    overflowWrap: "normal" as any,
    hyphens: "none",
  };

  return {
    container,
    panel,
    headline,
    supporting,
    karaokeGlow: glowShadow,
    headlineLines: fitResult.lines,
    headlineFontSizePx: fitResult.fontSize,
    headlineDidFit: fitResult.fitted,
    fitDebug: {
      overflowLog: fitResult.overflowLog,
      panelWidth: fitResult.panelWidth,
      lineCount: fitResult.lineCount,
    },
    fitGeometry: {
      panelWidthPx: fitResult.panelWidth,
      paddingPx: fitSettings.padding,
      panelMaxWidthPercent: fitSettings.panelMaxWidthPercent,
    },
  };
}
