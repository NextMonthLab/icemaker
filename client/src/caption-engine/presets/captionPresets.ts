import type { CaptionPresetId } from "../schemas";
import type { TypographyTokenId } from "../tokens/typography";
import type { ColorTokenId } from "../tokens/colors";
import type { BackgroundTokenId } from "../tokens/backgrounds";

export interface CaptionPreset {
  id: CaptionPresetId;
  name: string;
  description: string;
  typography: TypographyTokenId;
  colors: ColorTokenId;
  background: BackgroundTokenId;
  karaokeStyle?: "weight" | "brightness" | "underline" | "color";
  version: number;
}

export const captionPresets: Record<CaptionPresetId, CaptionPreset> = {
  clean_white: {
    id: "clean_white",
    name: "Clean White",
    description: "Simple white text with shadow",
    typography: "sans",
    colors: "shadowWhite",
    background: "none",
    karaokeStyle: "weight",
    version: 1,
  },
  clean_black: {
    id: "clean_black",
    name: "Clean Black",
    description: "Simple black text for light backgrounds",
    typography: "sans",
    colors: "black",
    background: "none",
    karaokeStyle: "weight",
    version: 1,
  },
  boxed_white: {
    id: "boxed_white",
    name: "Boxed White",
    description: "White text with dark background box",
    typography: "sans",
    colors: "whiteOnDark",
    background: "panel",
    karaokeStyle: "brightness",
    version: 1,
  },
  boxed_black: {
    id: "boxed_black",
    name: "Boxed Black",
    description: "Black text with light background box",
    typography: "sans",
    colors: "blackOnLight",
    background: "panel",
    karaokeStyle: "brightness",
    version: 1,
  },
  highlight_yellow: {
    id: "highlight_yellow",
    name: "Highlight Yellow",
    description: "Bold yellow highlight effect",
    typography: "impact",
    colors: "highlightYellow",
    background: "pill",
    karaokeStyle: "color",
    version: 1,
  },
  highlight_pink: {
    id: "highlight_pink",
    name: "Highlight Pink",
    description: "Vibrant pink highlight",
    typography: "impact",
    colors: "highlightPink",
    background: "pill",
    karaokeStyle: "color",
    version: 1,
  },
  typewriter: {
    id: "typewriter",
    name: "Typewriter",
    description: "Monospace typewriter effect",
    typography: "mono",
    colors: "neutral",
    background: "blur",
    karaokeStyle: "underline",
    version: 1,
  },
  gradient_purple: {
    id: "gradient_purple",
    name: "Gradient Purple",
    description: "Purple gradient background",
    typography: "display",
    colors: "gradientPurple",
    background: "gradient",
    karaokeStyle: "brightness",
    version: 1,
  },
  neon_blue: {
    id: "neon_blue",
    name: "Neon Blue",
    description: "Glowing neon effect",
    typography: "display",
    colors: "neonBlue",
    background: "none",
    karaokeStyle: "brightness",
    version: 1,
  },
  minimal_shadow: {
    id: "minimal_shadow",
    name: "Minimal Shadow",
    description: "Clean white with subtle shadow",
    typography: "sans",
    colors: "shadowWhite",
    background: "none",
    karaokeStyle: "weight",
    version: 1,
  },
  bold_impact: {
    id: "bold_impact",
    name: "Bold Impact",
    description: "Heavy uppercase impact style",
    typography: "impact",
    colors: "white",
    background: "none",
    karaokeStyle: "weight",
    version: 1,
  },
  elegant_serif: {
    id: "elegant_serif",
    name: "Elegant Serif",
    description: "Refined serif typography",
    typography: "serif",
    colors: "white",
    background: "none",
    karaokeStyle: "underline",
    version: 1,
  },
};

export function getCaptionPreset(id: CaptionPresetId): CaptionPreset {
  return captionPresets[id] || captionPresets.clean_white;
}
