export type BackgroundTreatment = "none" | "pill" | "panel" | "blur" | "gradient";

export interface BackgroundToken {
  treatment: BackgroundTreatment;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
  blurAmount?: number;
}

export const backgroundTokens = {
  none: {
    treatment: "none" as const,
    paddingX: 0,
    paddingY: 0,
    borderRadius: 0,
  },
  pill: {
    treatment: "pill" as const,
    paddingX: 24,
    paddingY: 12,
    borderRadius: 999,
  },
  panel: {
    treatment: "panel" as const,
    paddingX: 32,
    paddingY: 20,
    borderRadius: 12,
  },
  blur: {
    treatment: "blur" as const,
    paddingX: 28,
    paddingY: 16,
    borderRadius: 16,
    blurAmount: 12,
  },
  gradient: {
    treatment: "gradient" as const,
    paddingX: 24,
    paddingY: 14,
    borderRadius: 16,
  },
} satisfies Record<string, BackgroundToken>;

export type BackgroundTokenId = keyof typeof backgroundTokens;

import type { CSSProperties } from "react";

export function getBackgroundCSS(tokenId: BackgroundTokenId, options?: { pillColor?: string }): CSSProperties {
  const baseContainerStyles: CSSProperties = {
    display: "inline-block",
    maxWidth: "95%",
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    hyphens: "none",
    boxSizing: "border-box",
  };

  switch (tokenId) {
    case "panel":
      return {
        ...baseContainerStyles,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "20px 32px",
        borderRadius: "12px",
      };
    case "pill":
      return {
        ...baseContainerStyles,
        backgroundColor: options?.pillColor || "rgba(255, 220, 0, 0.9)",
        padding: "16px 32px",
        borderRadius: "999px",
      };
    case "blur":
      return {
        ...baseContainerStyles,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "22px 34px",
        borderRadius: "16px",
      };
    case "gradient":
      return {
        ...baseContainerStyles,
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.85), rgba(59, 130, 246, 0.85))",
        padding: "22px 34px",
        borderRadius: "16px",
      };
    case "none":
    default:
      return {};
  }
}
