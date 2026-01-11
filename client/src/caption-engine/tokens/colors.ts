export interface ColorToken {
  text: string;
  textSecondary?: string;
  background?: string;
  backgroundOpacity?: number;
  highlight?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: string;
}

export const colorTokens = {
  white: {
    text: "#FFFFFF",
    textSecondary: "#CCCCCC",
  },
  black: {
    text: "#000000",
    textSecondary: "#333333",
  },
  whiteOnDark: {
    text: "#FFFFFF",
    background: "#000000",
    backgroundOpacity: 0.7,
  },
  blackOnLight: {
    text: "#000000",
    background: "#FFFFFF",
    backgroundOpacity: 0.85,
  },
  highlightYellow: {
    text: "#000000",
    background: "#FFE500",
    backgroundOpacity: 1,
    highlight: "#FFFF00",
  },
  highlightPink: {
    text: "#FFFFFF",
    background: "#FF1493",
    backgroundOpacity: 1,
    highlight: "#FF69B4",
  },
  neonBlue: {
    text: "#00FFFF",
    stroke: "#FFFFFF",
    strokeWidth: 1,
    shadow: "0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 40px rgba(0,255,255,0.5)",
  },
  gradientPurple: {
    text: "#FFFFFF",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    backgroundOpacity: 0.9,
  },
  neutral: {
    text: "#E5E5E5",
    textSecondary: "#A0A0A0",
    stroke: "#404040",
    strokeWidth: 1,
  },
  shadowWhite: {
    text: "#FFFFFF",
    shadow: "2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.3)",
  },
} satisfies Record<string, ColorToken>;

export type ColorTokenId = keyof typeof colorTokens;
