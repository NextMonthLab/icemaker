import type { VideoRenderMode, IceMediaAsset } from "@shared/schema";

export type EffectiveRenderMode = 'fill' | 'fit';

interface VideoFramingConfig {
  renderMode: VideoRenderMode;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceAspectRatio?: number;
}

export function getEffectiveRenderMode(config: VideoFramingConfig): EffectiveRenderMode {
  const { renderMode, sourceWidth, sourceHeight, sourceAspectRatio } = config;
  
  if (renderMode === 'fill') return 'fill';
  if (renderMode === 'fit') return 'fit';
  
  const ratio = sourceAspectRatio ?? 
    (sourceWidth && sourceHeight ? sourceWidth / sourceHeight : null);
  
  if (!ratio) {
    return 'fill';
  }
  
  if (ratio < 0.8) {
    return 'fill';
  }
  
  if (ratio >= 0.8 && ratio <= 1.2) {
    return 'fill';
  }
  
  if (ratio > 1.5) {
    return 'fit';
  }
  
  return 'fill';
}

export function getEffectiveRenderModeFromAsset(asset: IceMediaAsset): EffectiveRenderMode {
  return getEffectiveRenderMode({
    renderMode: asset.renderMode || 'auto',
    sourceWidth: asset.sourceWidth,
    sourceHeight: asset.sourceHeight,
    sourceAspectRatio: asset.sourceAspectRatio,
  });
}

export function getVideoStyleClasses(mode: EffectiveRenderMode): {
  containerClass: string;
  videoClass: string;
  needsBlurBackground: boolean;
} {
  if (mode === 'fit') {
    return {
      containerClass: 'relative w-full h-full',
      videoClass: 'relative z-10 w-full h-full object-contain',
      needsBlurBackground: true,
    };
  }
  
  return {
    containerClass: 'relative w-full h-full',
    videoClass: 'w-full h-full object-cover',
    needsBlurBackground: false,
  };
}

export function computeAspectRatio(width: number, height: number): number {
  if (!height || height === 0) return 1;
  return width / height;
}

export function classifyAspectRatio(ratio: number): 'portrait' | 'square' | 'landscape' {
  if (ratio < 0.8) return 'portrait';
  if (ratio <= 1.2) return 'square';
  return 'landscape';
}
