import type { CSSProperties } from "react";
import type { CaptionPresetId, SafeAreaProfile, KaraokeStyleId } from "../schemas";
import { captionPresets } from "../presets";
import { typographyTokens } from "../tokens/typography";
import { colorTokens } from "../tokens/colors";
import { backgroundTokens, getBackgroundCSS } from "../tokens/backgrounds";
import { getSafeAreaConfig } from "../safe-area";

export interface ResolveStylesInput {
  presetId: CaptionPresetId;
  fullScreen?: boolean;
  safeAreaProfileId?: SafeAreaProfile;
  karaokeEnabled?: boolean;
  karaokeStyle?: KaraokeStyleId;
  textLength?: number;
}

export interface ResolvedCaptionStyles {
  container: CSSProperties;
  panel: CSSProperties;
  headline: CSSProperties;
  supporting: CSSProperties;
  karaokeGlow?: string;
}

export function resolveStyles(input: ResolveStylesInput): ResolvedCaptionStyles {
  const {
    presetId,
    fullScreen = false,
    safeAreaProfileId = "universal",
    karaokeEnabled = false,
    karaokeStyle = "weight",
    textLength = 50,
  } = input;

  const preset = captionPresets[presetId] || captionPresets.clean_white;
  const typography = typographyTokens[preset.typography] || typographyTokens.sans;
  const colors = colorTokens[preset.colors] || colorTokens.shadowWhite;
  const background = backgroundTokens[preset.background] || backgroundTokens.none;
  const safeArea = getSafeAreaConfig(safeAreaProfileId);

  const colorsAny = colors as any;

  const baseFontSize = fullScreen ? typography.fontSize : typography.fontSize * 0.7;
  const fontScale = textLength > 110 ? 0.75 : textLength > 80 ? 0.85 : 1;
  const adjustedFontSize = baseFontSize * fontScale;

  const professionalTextShadow = colorsAny.shadow || "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.4)";
  const glowShadow = "0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.8)";

  const panelStyles = getBackgroundCSS(preset.background);

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
  };

  const headline: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: `${adjustedFontSize}px`,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    textTransform: (typography as any).textTransform || "none",
    color: colors.text,
    textShadow: karaokeEnabled && karaokeStyle === "glow" ? glowShadow : professionalTextShadow,
    WebkitTextStroke: colorsAny.stroke ? `${colorsAny.strokeWidth || 1}px ${colorsAny.stroke}` : undefined,
    margin: 0,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as any,
    WebkitLineClamp: 3,
    overflow: "hidden",
  };

  const supporting: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: `${adjustedFontSize * 0.5}px`,
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
  };

  return {
    container,
    panel,
    headline,
    supporting,
    karaokeGlow: glowShadow,
  };
}
