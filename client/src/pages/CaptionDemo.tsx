import { useState, useMemo } from "react";
import GlobalNav from "@/components/GlobalNav";
import { CaptionStylePicker } from "@/components/ice-maker/CaptionStylePicker";
import { CaptionPreviewPlayer } from "@/components/ice-maker/CaptionPreviewPlayer";
import { createDefaultCaptionState } from "@/caption-engine/schemas";
import type { CaptionState, PhraseGroup, WordTiming } from "@/caption-engine/schemas";

const sampleWords: WordTiming[] = [
  { word: "Welcome", startMs: 0, endMs: 400 },
  { word: "to", startMs: 400, endMs: 550 },
  { word: "the", startMs: 550, endMs: 700 },
  { word: "caption", startMs: 700, endMs: 1100 },
  { word: "engine", startMs: 1100, endMs: 1500 },
  { word: "demo", startMs: 1500, endMs: 2000 },
];

const samplePhraseGroups: PhraseGroup[] = [
  {
    id: "group-1",
    segmentIds: ["seg-1"],
    displayText: "Welcome to the\ncaption engine demo",
    lines: ["Welcome to the", "caption engine demo"],
    startMs: 0,
    endMs: 2500,
    words: sampleWords,
    karaokeEligible: true,
  },
  {
    id: "group-2",
    segmentIds: ["seg-2"],
    displayText: "Try different styles\nand see the magic",
    lines: ["Try different styles", "and see the magic"],
    startMs: 2500,
    endMs: 5000,
    words: [
      { word: "Try", startMs: 2500, endMs: 2800 },
      { word: "different", startMs: 2800, endMs: 3200 },
      { word: "styles", startMs: 3200, endMs: 3600 },
      { word: "and", startMs: 3600, endMs: 3800 },
      { word: "see", startMs: 3800, endMs: 4100 },
      { word: "the", startMs: 4100, endMs: 4300 },
      { word: "magic", startMs: 4300, endMs: 5000 },
    ],
    karaokeEligible: true,
  },
  {
    id: "group-3",
    segmentIds: ["seg-3"],
    displayText: "Karaoke mode highlights\neach word as it plays",
    lines: ["Karaoke mode highlights", "each word as it plays"],
    startMs: 5000,
    endMs: 8000,
    words: [
      { word: "Karaoke", startMs: 5000, endMs: 5500 },
      { word: "mode", startMs: 5500, endMs: 5900 },
      { word: "highlights", startMs: 5900, endMs: 6500 },
      { word: "each", startMs: 6500, endMs: 6800 },
      { word: "word", startMs: 6800, endMs: 7100 },
      { word: "as", startMs: 7100, endMs: 7300 },
      { word: "it", startMs: 7300, endMs: 7500 },
      { word: "plays", startMs: 7500, endMs: 8000 },
    ],
    karaokeEligible: true,
  },
];

export default function CaptionDemo() {
  const [captionState, setCaptionState] = useState<CaptionState>(() => ({
    ...createDefaultCaptionState(),
    phraseGroups: samplePhraseGroups,
  }));
  
  const handleStateChange = (newState: CaptionState) => {
    setCaptionState({
      ...newState,
      phraseGroups: samplePhraseGroups,
    });
  };
  
  return (
    <div className="min-h-screen bg-background">
      <GlobalNav context="ice" />
      
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Caption Style Editor
          </h1>
          <p className="text-muted-foreground">
            Choose a caption style and see it in action with live preview
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="order-2 lg:order-1">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
                Style Options
              </h2>
              <CaptionStylePicker
                captionState={captionState}
                onStateChange={handleStateChange}
              />
            </div>
            
            <div className="mt-4 p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl">
              <h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                Current Settings
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Preset:</span>
                  <span className="text-zinc-300">{captionState.presetId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Animation:</span>
                  <span className="text-zinc-300">{captionState.animationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Safe Area:</span>
                  <span className="text-zinc-300">{captionState.safeAreaProfileId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Karaoke:</span>
                  <span className="text-zinc-300">
                    {captionState.karaokeEnabled ? captionState.karaokeStyle : "off"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="order-1 lg:order-2">
            <div className="sticky top-24">
              <h2 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider text-center">
                Live Preview
              </h2>
              <CaptionPreviewPlayer
                captionState={captionState}
                durationMs={8000}
                showControls={true}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
