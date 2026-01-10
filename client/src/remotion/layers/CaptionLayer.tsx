import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { CaptionState, PhraseGroup, CaptionPresetId, AnimationId, SafeAreaProfile } from "@/caption-engine/schemas";
import { getCaptionPreset } from "@/caption-engine/presets";
import { typographyTokens } from "@/caption-engine/tokens/typography";
import { colorTokens } from "@/caption-engine/tokens/colors";
import { backgroundTokens } from "@/caption-engine/tokens/backgrounds";
import { getAnimationToken } from "@/caption-engine/tokens/animation";
import { getCaptionSafeY, getCaptionMaxWidth } from "@/caption-engine/safe-area";

interface CaptionLayerProps {
  captionState: CaptionState;
}

interface CaptionBlockProps {
  phraseGroup: PhraseGroup;
  presetId: CaptionPresetId;
  animationId: AnimationId;
  safeAreaProfile: SafeAreaProfile;
  frameRate: number;
  currentFrame: number;
  videoWidth: number;
  videoHeight: number;
  fontSizeScale?: number;
  verticalOffset?: number;
}

function CaptionBlock({
  phraseGroup,
  presetId,
  animationId,
  safeAreaProfile,
  frameRate,
  currentFrame,
  videoWidth,
  videoHeight,
  fontSizeScale = 1,
  verticalOffset = 0,
}: CaptionBlockProps) {
  const preset = getCaptionPreset(presetId);
  const typography = typographyTokens[preset.typography];
  const colors = colorTokens[preset.colors];
  const background = backgroundTokens[preset.background];
  const animation = getAnimationToken(animationId);
  
  const startFrame = Math.round((phraseGroup.startMs / 1000) * frameRate);
  const endFrame = Math.round((phraseGroup.endMs / 1000) * frameRate);
  
  const isVisible = currentFrame >= startFrame && currentFrame <= endFrame;
  if (!isVisible) return null;
  
  const entranceFrames = Math.round((animation.entranceDurationMs / 1000) * frameRate);
  const exitFrames = Math.round((animation.exitDurationMs / 1000) * frameRate);
  
  const relativeFrame = currentFrame - startFrame;
  const framesUntilEnd = endFrame - currentFrame;
  
  let opacity = 1;
  let translateY = 0;
  let scale = 1;
  
  if (animation.entranceTransform && relativeFrame < entranceFrames) {
    const progress = relativeFrame / entranceFrames;
    if (animation.entranceTransform.opacity !== undefined) {
      opacity = interpolate(progress, [0, 1], [animation.entranceTransform.opacity, 1]);
    }
    if (animation.entranceTransform.translateY !== undefined) {
      translateY = interpolate(progress, [0, 1], [animation.entranceTransform.translateY, 0]);
    }
    if (animation.entranceTransform.scale !== undefined) {
      scale = interpolate(progress, [0, 1], [animation.entranceTransform.scale, 1]);
    }
  }
  
  if (animation.exitTransform && framesUntilEnd < exitFrames) {
    const progress = framesUntilEnd / exitFrames;
    if (animation.exitTransform.opacity !== undefined) {
      opacity = interpolate(progress, [0, 1], [animation.exitTransform.opacity, 1]);
    }
    if (animation.exitTransform.translateY !== undefined) {
      translateY = interpolate(progress, [0, 1], [animation.exitTransform.translateY, 0]);
    }
    if (animation.exitTransform.scale !== undefined) {
      scale = interpolate(progress, [0, 1], [animation.exitTransform.scale, 1]);
    }
  }
  
  const safeY = getCaptionSafeY(safeAreaProfile, videoHeight);
  const maxWidth = getCaptionMaxWidth(safeAreaProfile, videoWidth);
  const scaleFactor = videoWidth / 1080;
  const fontSize = typography.fontSize * scaleFactor * fontSizeScale;
  
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: (videoHeight - safeY) + (verticalOffset * scaleFactor),
    left: "50%",
    transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
    opacity,
    maxWidth,
    textAlign: "center",
    pointerEvents: "none",
  };
  
  const colorToken = colors as Record<string, unknown>;
  const typographyToken = typography as Record<string, unknown>;
  const backgroundToken = background as Record<string, unknown>;
  
  const textStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: typography.lineHeight,
    letterSpacing: typography.letterSpacing,
    textTransform: (typographyToken.textTransform as React.CSSProperties['textTransform']) || "none",
    color: colors.text,
    textShadow: colorToken.shadow as string | undefined,
    WebkitTextStroke: colorToken.strokeWidth 
      ? `${colorToken.strokeWidth}px ${colorToken.stroke}` 
      : undefined,
  };
  
  const backgroundStyle: React.CSSProperties = background.treatment !== "none" ? {
    padding: `${background.paddingY * scaleFactor}px ${background.paddingX * scaleFactor}px`,
    borderRadius: background.borderRadius * scaleFactor,
    background: colorToken.background as string | undefined,
    opacity: colorToken.backgroundOpacity as number | undefined,
    backdropFilter: backgroundToken.blurAmount 
      ? `blur(${backgroundToken.blurAmount}px)` 
      : undefined,
  } : {};
  
  return (
    <div style={containerStyle}>
      <div style={{ ...textStyle, ...backgroundStyle }}>
        {phraseGroup.lines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
    </div>
  );
}

export function CaptionLayer({ captionState }: CaptionLayerProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  const { 
    phraseGroups, 
    presetId, 
    animationId, 
    safeAreaProfileId,
    overrides 
  } = captionState;
  
  if (phraseGroups.length === 0) {
    return null;
  }
  
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {phraseGroups.map((group) => (
        <CaptionBlock
          key={group.id}
          phraseGroup={group}
          presetId={presetId}
          animationId={animationId}
          safeAreaProfile={safeAreaProfileId}
          frameRate={fps}
          currentFrame={frame}
          videoWidth={width}
          videoHeight={height}
          fontSizeScale={overrides?.fontSizeScale}
          verticalOffset={overrides?.verticalOffset}
        />
      ))}
    </div>
  );
}

export default CaptionLayer;
