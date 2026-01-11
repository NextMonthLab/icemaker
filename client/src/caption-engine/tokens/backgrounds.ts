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
