export interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

export const typographyTokens = {
  sans: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  serif: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 44,
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0.5,
  },
  mono: {
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
    fontSize: 40,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  impact: {
    fontFamily: "'Bebas Neue', Impact, sans-serif",
    fontSize: 56,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  display: {
    fontFamily: "'Poppins', 'Montserrat', sans-serif",
    fontSize: 52,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: -0.5,
  },
} satisfies Record<string, TypographyToken>;

export type TypographyTokenId = keyof typeof typographyTokens;

export const fontSizeScale = {
  xs: 0.7,
  sm: 0.85,
  base: 1.0,
  lg: 1.15,
  xl: 1.3,
};

export const fontWeightScale = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};
