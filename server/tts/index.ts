import { OpenAITTSProvider } from "./openaiProvider";
import { ElevenLabsTTSProvider } from "./elevenlabsProvider";
import type { TTSProvider, Voice, SynthesisResult } from "./provider";

export type { Voice, SynthesisResult, TTSProvider };

let openaiProvider: TTSProvider | null = null;
let elevenlabsProvider: TTSProvider | null = null;

function getOpenAIProvider(): TTSProvider {
  if (!openaiProvider) {
    openaiProvider = new OpenAITTSProvider();
  }
  return openaiProvider;
}

function getElevenLabsProvider(): TTSProvider {
  if (!elevenlabsProvider) {
    elevenlabsProvider = new ElevenLabsTTSProvider();
  }
  return elevenlabsProvider;
}

function isElevenLabsVoice(voiceId: string): boolean {
  return voiceId.startsWith("eleven_");
}

export function listVoices(): Voice[] {
  const voices: Voice[] = [];
  
  const openai = getOpenAIProvider();
  if (openai.isConfigured()) {
    voices.push(...openai.listVoices());
  }
  
  const elevenlabs = getElevenLabsProvider();
  if (elevenlabs.isConfigured()) {
    voices.push(...elevenlabs.listVoices());
  }
  
  return voices;
}

export async function synthesiseSpeech(options: {
  text: string;
  voice: string;
  speed?: number;
  deliveryStyle?: string;
}): Promise<SynthesisResult> {
  if (isElevenLabsVoice(options.voice)) {
    const provider = getElevenLabsProvider();
    if (!provider.isConfigured()) {
      throw new Error("ElevenLabs TTS not configured");
    }
    return provider.synthesiseSpeech(options);
  }
  
  const provider = getOpenAIProvider();
  if (!provider.isConfigured()) {
    throw new Error("OpenAI TTS not configured");
  }
  return provider.synthesiseSpeech(options);
}

// Generate a cache key for narration audio
export function generateNarrationCacheKey(text: string, voiceId: string, deliveryStyle: string, speed: number): string {
  const crypto = require('crypto');
  const data = `${text}|${voiceId}|${deliveryStyle}|${speed}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

export function isTTSConfigured(): boolean {
  return getOpenAIProvider().isConfigured() || getElevenLabsProvider().isConfigured();
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
