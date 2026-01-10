import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { IcePreviewComposition } from "@/remotion/compositions";
import type { CaptionState } from "@/caption-engine/schemas";
import { defaultVerticalConfig, getDurationInFrames } from "@/remotion/utils/layout";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface CaptionPreviewPlayerProps {
  videoUrl?: string;
  imageUrl?: string;
  captionState?: CaptionState;
  durationMs?: number;
  className?: string;
  showControls?: boolean;
}

export function CaptionPreviewPlayer({
  videoUrl,
  imageUrl,
  captionState,
  durationMs = 10000,
  className = "",
  showControls = true,
}: CaptionPreviewPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  
  const durationInFrames = useMemo(() => 
    getDurationInFrames(durationMs, defaultVerticalConfig.fps),
    [durationMs]
  );
  
  const config = useMemo(() => ({
    ...defaultVerticalConfig,
    durationInFrames,
  }), [durationInFrames]);
  
  const inputProps = useMemo(() => ({
    videoUrl,
    imageUrl,
    captionState,
  }), [videoUrl, imageUrl, captionState]);
  
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(Math.round(e.detail.frame));
    };
    
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);
    player.addEventListener("frameupdate", handleFrameUpdate as EventListener);
    
    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
      player.removeEventListener("frameupdate", handleFrameUpdate as EventListener);
    };
  }, []);
  
  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying]);
  
  const handleReset = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(0);
    player.pause();
    setCurrentFrame(0);
    setIsPlaying(false);
  }, []);
  
  const handleMuteToggle = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      const newMuted = !isMuted;
      player.setVolume(newMuted ? 0 : 1);
      setIsMuted(newMuted);
    }
  }, [isMuted]);
  
  const handleSeek = useCallback((value: number[]) => {
    const player = playerRef.current;
    if (!player) return;
    const frame = Math.round(value[0]);
    player.seekTo(frame);
    setCurrentFrame(frame);
  }, []);
  
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="relative bg-black rounded-lg overflow-hidden aspect-[9/16] max-w-[360px] mx-auto">
        <Player
          ref={playerRef}
          component={IcePreviewComposition}
          inputProps={inputProps}
          durationInFrames={config.durationInFrames}
          compositionWidth={config.width}
          compositionHeight={config.height}
          fps={config.fps}
          style={{
            width: "100%",
            height: "100%",
          }}
          controls={false}
          loop
          autoPlay={false}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          moveToBeginningWhenEnded
        />
        
        {!showControls && (
          <div 
            className="absolute inset-0 cursor-pointer"
            onClick={handlePlayPause}
          />
        )}
      </div>
      
      {showControls && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={handlePlayPause}
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={handleReset}
              data-testid="button-reset"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <div className="flex-1 mx-2">
              <Slider
                value={[currentFrame]}
                min={0}
                max={config.durationInFrames}
                step={1}
                onValueChange={handleSeek}
                className="cursor-pointer"
                data-testid="slider-progress"
              />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={handleMuteToggle}
              data-testid="button-mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>
          
          <div className="text-xs text-zinc-500 text-center">
            {Math.floor(currentFrame / config.fps)}s / {Math.floor(config.durationInFrames / config.fps)}s
          </div>
        </div>
      )}
    </div>
  );
}

export default CaptionPreviewPlayer;
