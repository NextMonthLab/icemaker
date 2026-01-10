import React from "react";
import { AbsoluteFill, Video, Img, staticFile } from "remotion";
import { CaptionLayer } from "../layers/CaptionLayer";
import type { CaptionState } from "@/caption-engine/schemas";

export interface IcePreviewCompositionProps {
  videoUrl?: string;
  imageUrl?: string;
  captionState?: CaptionState;
  backgroundColor?: string;
}

export function IcePreviewComposition({
  videoUrl,
  imageUrl,
  captionState,
  backgroundColor = "#000000",
}: IcePreviewCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {videoUrl && (
        <Video
          src={videoUrl}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      
      {!videoUrl && imageUrl && (
        <Img
          src={imageUrl}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      
      {captionState && <CaptionLayer captionState={captionState} />}
    </AbsoluteFill>
  );
}

export default IcePreviewComposition;
