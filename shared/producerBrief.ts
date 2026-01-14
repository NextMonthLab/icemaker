import { z } from "zod";

export const briefAiCharacterSchema = z.object({
  name: z.string(),
  personality: z.string(),
  expertiseLevel: z.string().optional(),
  communicationStyle: z.string().optional(),
  visualAppearance: z.string().optional(),
  behaviourRules: z.array(z.string()).default([]),
  systemPrompt: z.string(),
  stageContexts: z.array(z.object({
    stageNumber: z.number(),
    stageName: z.string(),
    contextAddition: z.string(),
    commonQuestions: z.array(z.string()).default([]),
  })).default([]),
  exampleInteractions: z.array(z.object({
    userMessage: z.string(),
    characterResponse: z.string(),
  })).default([]),
});

export type BriefAiCharacter = z.infer<typeof briefAiCharacterSchema>;

export const briefCardSchema = z.object({
  stageNumber: z.number(),
  stageName: z.string(),
  cardIndex: z.number(),
  cardId: z.string(),
  content: z.string(),
  visualPrompt: z.string().optional(),
  videoPrompt: z.string().optional(),
  isCheckpoint: z.boolean().default(false),
});

export type BriefCard = z.infer<typeof briefCardSchema>;

export const briefStageSchema = z.object({
  stageNumber: z.number(),
  stageName: z.string(),
  purpose: z.string().optional(),
  cards: z.array(briefCardSchema),
  hasAiCheckpoint: z.boolean().default(false),
  checkpointDescription: z.string().optional(),
});

export type BriefStage = z.infer<typeof briefStageSchema>;

export const briefVisualDirectionSchema = z.object({
  overallAesthetic: z.string().optional(),
  cameraPerspective: z.string().optional(),
  lightingAndColour: z.string().optional(),
  baseStylePrompt: z.string().optional(),
});

export type BriefVisualDirection = z.infer<typeof briefVisualDirectionSchema>;

export const producerBriefSchema = z.object({
  title: z.string(),
  format: z.string().optional(),
  targetAudience: z.string().optional(),
  estimatedDuration: z.string().optional(),
  visualStyle: z.string().optional(),
  visualDirection: briefVisualDirectionSchema.optional(),
  aiCharacter: briefAiCharacterSchema.optional(),
  stages: z.array(briefStageSchema),
  totalCardCount: z.number(),
  strictMode: z.boolean().default(true),
});

export type ProducerBrief = z.infer<typeof producerBriefSchema>;

export interface ParsedProducerBrief {
  brief: ProducerBrief;
  rawText: string;
  parseWarnings: string[];
  parseErrors: string[];
}

export const PRODUCER_BRIEF_MARKERS = {
  experienceOverview: /(?:^|\n)#+?\s*\d*\.?\s*Experience\s+Overview/i,
  visualDirection: /(?:^|\n)#+?\s*\d*\.?\s*Visual\s+Direction/i,
  aiCharacter: /(?:^|\n)#+?\s*\d*\.?\s*AI\s+Character/i,
  stageBreakdown: /(?:^|\n)#+?\s*\d*\.?\s*Stage\s+Breakdown/i,
  stage: /(?:^|\n)#+?\s*Stage\s+(\d+):\s*(.+)/gi,
  cardTable: /\|\s*Card\s*\|\s*Content\s*\|\s*Visual/i,
  systemPrompt: /System\s+Prompt|Base\s+Prompt/i,
  stageContext: /Stage\s+(\d+)\s+Addition/i,
  aiCheckpoint: /AI\s+(?:Chef\s+)?Checkpoint/i,
};
