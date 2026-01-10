import type { AnimationId } from "../schemas";

export interface AnimationToken {
  entranceDurationMs: number;
  exitDurationMs: number;
  entranceEasing: string;
  exitEasing: string;
  entranceTransform?: {
    translateY?: number;
    translateX?: number;
    scale?: number;
    opacity?: number;
  };
  exitTransform?: {
    translateY?: number;
    translateX?: number;
    scale?: number;
    opacity?: number;
  };
}

export const animationTokens: Record<AnimationId, AnimationToken> = {
  none: {
    entranceDurationMs: 0,
    exitDurationMs: 0,
    entranceEasing: "linear",
    exitEasing: "linear",
  },
  fade: {
    entranceDurationMs: 250,
    exitDurationMs: 180,
    entranceEasing: "ease-out",
    exitEasing: "ease-in",
    entranceTransform: { opacity: 0 },
    exitTransform: { opacity: 0 },
  },
  slide_up: {
    entranceDurationMs: 280,
    exitDurationMs: 200,
    entranceEasing: "cubic-bezier(0.16, 1, 0.3, 1)",
    exitEasing: "ease-in",
    entranceTransform: { translateY: 30, opacity: 0 },
    exitTransform: { translateY: -15, opacity: 0 },
  },
  pop: {
    entranceDurationMs: 220,
    exitDurationMs: 150,
    entranceEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    exitEasing: "ease-in",
    entranceTransform: { scale: 0.85, opacity: 0 },
    exitTransform: { scale: 0.95, opacity: 0 },
  },
  typewriter: {
    entranceDurationMs: 300,
    exitDurationMs: 100,
    entranceEasing: "steps(1)",
    exitEasing: "ease-out",
    entranceTransform: { opacity: 0 },
    exitTransform: { opacity: 0 },
  },
};

export function getAnimationToken(id: AnimationId): AnimationToken {
  return animationTokens[id] || animationTokens.fade;
}
