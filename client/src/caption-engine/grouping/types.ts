import { z } from "zod";

export const timedWordSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  confidence: z.number().optional(),
});

export type TimedWord = z.infer<typeof timedWordSchema>;

export const transcriptSchema = z.object({
  words: z.array(timedWordSchema),
  durationMs: z.number(),
  language: z.string().optional(),
});

export type Transcript = z.infer<typeof transcriptSchema>;

export interface GroupingConfig {
  maxCharsPerLine: number;
  maxLinesPerGroup: number;
  maxWordsPerGroup: number;
  minPauseForBreakMs: number;
  preferBreakOnPunctuation: boolean;
}

export const defaultGroupingConfig: GroupingConfig = {
  maxCharsPerLine: 32,
  maxLinesPerGroup: 2,
  maxWordsPerGroup: 8,
  minPauseForBreakMs: 300,
  preferBreakOnPunctuation: true,
};

export interface WordGroup {
  words: TimedWord[];
  startMs: number;
  endMs: number;
  text: string;
}

export interface PhraseGroupResult {
  id: string;
  lines: string[];
  words: TimedWord[];
  startMs: number;
  endMs: number;
}
