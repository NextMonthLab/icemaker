import { OpenAITTSProvider } from "./openaiProvider";
import type { TTSProvider, Voice, SynthesisResult } from "./provider";

export type { Voice, SynthesisResult, TTSProvider };

let provider: TTSProvider | null = null;

export function getTTSProvider(): TTSProvider {
  if (!provider) {
    provider = new OpenAITTSProvider();
  }
  return provider;
}

export function listVoices(): Voice[] {
  return getTTSProvider().listVoices();
}

export async function synthesiseSpeech(options: {
  text: string;
  voice: string;
  speed?: number;
}): Promise<SynthesisResult> {
  return getTTSProvider().synthesiseSpeech(options);
}

export function isTTSConfigured(): boolean {
  return getTTSProvider().isConfigured();
}

export const MAX_NARRATION_TEXT_LENGTH = 3000;

export function validateNarrationText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: "Narration text cannot be empty" };
  }
  if (text.length > MAX_NARRATION_TEXT_LENGTH) {
    return { valid: false, error: `Narration text exceeds maximum length of ${MAX_NARRATION_TEXT_LENGTH} characters` };
  }
  return { valid: true };
}
