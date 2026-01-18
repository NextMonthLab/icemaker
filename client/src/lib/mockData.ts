import cardImage from "@assets/generated_images/cinematic_cyberpunk_noir_city_street_at_night_with_rain.png";
import charImage from "@assets/generated_images/mysterious_cyberpunk_character_portrait.png";

export type VideoRenderMode = 'auto' | 'fill' | 'fit';

export interface MediaAsset {
  id: string;
  kind: 'image' | 'video';
  source: 'upload' | 'ai' | 'stock';
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  prompt?: string;
  enhancedPrompt?: string;
  negativePrompt?: string;
  status: 'ready' | 'generating' | 'failed';
  predictionId?: string;
  model?: string;
  renderMode?: VideoRenderMode;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceAspectRatio?: number;
  durationSec?: number; // Video duration in seconds (for timeline calculations)
  muteAudio?: boolean; // Whether to mute video's original audio (default true)
}

// Media segment for multi-clip timeline per card
export interface MediaSegment {
  id: string;
  assetId?: string; // Reference to mediaAssets[] entry
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  durationSec: number; // How long this segment plays (after trimming)
  startTimeSec: number; // When segment starts in card timeline
  order: number; // Sequence order (0, 1, 2...)
  renderMode?: VideoRenderMode; // For video segments
  sourceAspectRatio?: number;
  muteAudio?: boolean; // Whether to mute video's original audio (default true)
  // Trim controls (for video clips)
  trimStartSec?: number; // Seconds trimmed from start (default 0)
  trimEndSec?: number; // Seconds trimmed from end (default 0)
  originalDurationSec?: number; // Full video duration before trimming
}

// Caption timing for forced alignment (Phase 2)
export type CaptionTimingSource = 'whisper' | 'heuristic' | 'none';

export interface CaptionTiming {
  startMs: number;
  endMs: number;
  timingSource: CaptionTimingSource;
  matchScore?: number; // 0-1 confidence from alignment
}

export interface Card {
  id: string | number;
  dayIndex?: number; // Optional - removed from display per "bin Day 1/2/3" directive
  title: string;
  image: string;
  captions: string[];
  captionTimings?: CaptionTiming[]; // Per-caption timing data (Phase 2)
  sceneText: string;
  recapText: string;
  publishDate: string;
  narrationEnabled?: boolean;
  narrationAudioUrl?: string | null;
  narrationText?: string | null;
  narrationStatus?: string | null;
  generatedVideoUrl?: string | null;
  videoGenerated?: boolean;
  videoGenerationStatus?: string | null;
  preferredMediaType?: 'image' | 'video' | null;
  mediaAssets?: MediaAsset[];
  selectedMediaAssetId?: string | null;
  enhancePromptEnabled?: boolean;
  basePrompt?: string;
  enhancedPrompt?: string;
  // CTA card fields
  cardType?: 'standard' | 'guest' | 'cta';
  ctaHeadline?: string;
  ctaButtonLabel?: string;
  ctaUrl?: string;
  ctaSubtext?: string;
  
  // Cinematic Continuation (Cutaway Still) - when video ends before narration
  cinematicContinuationEnabled?: boolean; // Default true
  continuationImageUrl?: string | null; // Generated continuation still
  continuationImageStatus?: 'none' | 'pending' | 'generating' | 'ready' | 'failed';
  videoDurationSec?: number; // Video duration in seconds
  narrationDurationSec?: number; // Narration audio duration in seconds
  
  // Multi-segment media timeline - fill card duration with sequential clips
  mediaSegments?: MediaSegment[];
}

// AI-powered video prompt suggestion for multi-segment timelines
export type StoryArcPhase = 'setup' | 'build' | 'peak' | 'resolve';

export interface ClipSuggestion {
  id: string;
  prompt: string;
  rationale: string; // Brief explanation of why this prompt fits
  arcPhase: StoryArcPhase;
  continuityHints: string[]; // Visual elements to maintain from previous clips
}

export interface ClipSuggestionRequest {
  cardTitle: string;
  cardNarration: string;
  currentSegmentIndex: number; // Which segment we're suggesting for (0-based)
  totalSegmentsPlanned: number; // How many segments will fit the timeline
  priorPrompts: string[]; // Prompts used for previous segments
  sceneLockDescription?: string; // Scene Lock visual context
  visualBibleStyle?: string; // Visual Bible style hints
}

export interface ClipSuggestionResponse {
  suggestions: ClipSuggestion[];
  cached: boolean;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
}

export const MOCK_UNIVERSE = {
  name: "Neon Rain",
  description: "A detective noir story set in the underbelly of Sector 7.",
};

export const MOCK_CHARACTERS: Character[] = [
  {
    id: "char_1",
    name: "V",
    role: "The Informant",
    avatar: charImage,
    description: "Knows everything that happens in the lower levels. Doesn't give it up for free.",
  },
  {
    id: "char_2",
    name: "Detective K",
    role: "The Lead",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
    description: "Burnt out, running on caffeine and synth-stims.",
  },
];

export const MOCK_CARDS: Card[] = [
  {
    id: "card_1",
    dayIndex: 1,
    title: "The Drop",
    image: cardImage,
    captions: [
      "It started with the rain...",
      "Always the rain in Sector 7.",
      "Then I saw the package.",
    ],
    sceneText: "The package was sitting in a puddle of neon-reflected oil. It didn't belong there. Nothing clean belongs in Sector 7.",
    recapText: "We found a mysterious package in Sector 7.",
    publishDate: "2023-10-24T09:00:00Z",
  },
  {
    id: "card_2",
    dayIndex: 2,
    title: "The Decryption",
    image: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=1080&h=1920&fit=crop",
    captions: [
      "Encrypted. Heavily.",
      "Corporate grade ICE.",
      "Someone doesn't want this opened.",
    ],
    sceneText: "I took it to V. She laughed when she saw the encryption headers. 'You're playing with fire, detective,' she said. But she took the credits anyway.",
    recapText: "V is attempting to decrypt the package.",
    publishDate: "2023-10-25T09:00:00Z",
  },
  {
    id: "card_3",
    dayIndex: 3,
    title: "The Shadow",
    image: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1080&h=1920&fit=crop",
    captions: [
      "I'm being followed.",
      "Just a shadow in the reflection.",
      "They know I have it.",
    ],
    sceneText: "Walking back from V's place, I felt eyes on me. A black sedan with tinted windows. Arasaka? Militech? Or something worse?",
    recapText: "Someone is following the detective.",
    publishDate: "2023-10-26T09:00:00Z",
  },
];

export function addMockCard(card: Card) {
  MOCK_CARDS.push(card);
}
