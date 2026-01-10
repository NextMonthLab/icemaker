import { z } from "zod";

export const CAPTION_SCHEMA_VERSION = 1;
export const TOKEN_VERSION = 1;

export const SafeAreaProfileSchema = z.enum([
  "universal",
  "tiktok",
  "instagram_reels",
  "youtube_shorts",
]);
export type SafeAreaProfile = z.infer<typeof SafeAreaProfileSchema>;

export const TranscriptionProviderSchema = z.enum([
  "whisper",
  "deepgram",
  "assembly_ai",
  "manual",
]);
export type TranscriptionProvider = z.infer<typeof TranscriptionProviderSchema>;

export const WordTimingSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  confidence: z.number().min(0).max(1).optional(),
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const CaptionSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  words: z.array(WordTimingSchema).optional(),
  speakerId: z.string().optional(),
});
export type CaptionSegment = z.infer<typeof CaptionSegmentSchema>;

export const PhraseGroupSchema = z.object({
  id: z.string(),
  segmentIds: z.array(z.string()),
  displayText: z.string(),
  lines: z.array(z.string()).max(2),
  startMs: z.number(),
  endMs: z.number(),
  words: z.array(WordTimingSchema).optional(),
  karaokeEligible: z.boolean().default(false),
});
export type PhraseGroup = z.infer<typeof PhraseGroupSchema>;

export const CaptionPresetIdSchema = z.enum([
  "clean_white",
  "clean_black",
  "boxed_white",
  "boxed_black",
  "highlight_yellow",
  "highlight_pink",
  "typewriter",
  "gradient_purple",
  "neon_blue",
  "minimal_shadow",
  "bold_impact",
  "elegant_serif",
]);
export type CaptionPresetId = z.infer<typeof CaptionPresetIdSchema>;

export const AnimationIdSchema = z.enum([
  "none",
  "fade",
  "slide_up",
  "pop",
  "typewriter",
]);
export type AnimationId = z.infer<typeof AnimationIdSchema>;

export const TitlePresetIdSchema = z.enum([
  "bold_center",
  "lower_third_left",
  "lower_third_gradient",
  "name_title",
  "location_tag",
  "chapter_marker",
]);
export type TitlePresetId = z.infer<typeof TitlePresetIdSchema>;

export const CaptionOverridesSchema = z.object({
  fontSizeScale: z.number().min(0.8).max(1.2).optional(),
  verticalOffset: z.number().min(-50).max(50).optional(),
  backgroundEnabled: z.boolean().optional(),
  karaokeEnabled: z.boolean().optional(),
}).strict();
export type CaptionOverrides = z.infer<typeof CaptionOverridesSchema>;

export const CaptionStateSchema = z.object({
  schemaVersion: z.number().default(CAPTION_SCHEMA_VERSION),
  tokenVersion: z.number().default(TOKEN_VERSION),
  
  presetId: CaptionPresetIdSchema.default("clean_white"),
  animationId: AnimationIdSchema.default("fade"),
  titlePresetId: TitlePresetIdSchema.optional(),
  safeAreaProfileId: SafeAreaProfileSchema.default("universal"),
  
  karaokeRequested: z.boolean().default(false),
  karaokeEffective: z.boolean().default(false),
  karaokeConfidenceThreshold: z.number().min(0).max(1).default(0.85),
  
  transcriptionProvider: TranscriptionProviderSchema.optional(),
  transcriptionConfidence: z.number().min(0).max(1).optional(),
  
  segments: z.array(CaptionSegmentSchema).default([]),
  phraseGroups: z.array(PhraseGroupSchema).default([]),
  
  overrides: CaptionOverridesSchema.optional(),
  
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CaptionState = z.infer<typeof CaptionStateSchema>;

export function createDefaultCaptionState(): CaptionState {
  return {
    schemaVersion: CAPTION_SCHEMA_VERSION,
    tokenVersion: TOKEN_VERSION,
    presetId: "clean_white",
    animationId: "fade",
    safeAreaProfileId: "universal",
    karaokeRequested: false,
    karaokeEffective: false,
    karaokeConfidenceThreshold: 0.85,
    segments: [],
    phraseGroups: [],
  };
}

export function validateCaptionState(state: unknown): { 
  valid: boolean; 
  data?: CaptionState; 
  errors?: z.ZodError 
} {
  const result = CaptionStateSchema.safeParse(state);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}
