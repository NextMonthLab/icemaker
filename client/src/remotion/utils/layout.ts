export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export const defaultVerticalConfig: VideoConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 300,
};

export const defaultHorizontalConfig: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};

export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

export function framesToMs(frames: number, fps: number): number {
  return Math.round((frames / fps) * 1000);
}

export function getDurationInFrames(durationMs: number, fps: number): number {
  return Math.ceil((durationMs / 1000) * fps);
}
