import OpenAI from "openai";
import type { TTSProvider, Voice, SynthesisResult } from "./provider";

const OPENAI_VOICES: Voice[] = [
  { id: "alloy", name: "Alloy", previewTextHint: "A balanced, neutral voice.", tags: ["neutral", "versatile"] },
  { id: "echo", name: "Echo", previewTextHint: "A warm, resonant voice.", tags: ["warm", "male"] },
  { id: "fable", name: "Fable", previewTextHint: "A British-accented storytelling voice.", tags: ["british", "storytelling"] },
  { id: "onyx", name: "Onyx", previewTextHint: "A deep, authoritative voice.", tags: ["deep", "male", "authoritative"] },
  { id: "nova", name: "Nova", previewTextHint: "A friendly, energetic voice.", tags: ["female", "energetic", "friendly"] },
  { id: "shimmer", name: "Shimmer", previewTextHint: "A soft, expressive voice.", tags: ["female", "soft", "expressive"] },
];

export class OpenAITTSProvider implements TTSProvider {
  private client: OpenAI | null = null;

  constructor() {
    // TTS requires a direct OpenAI API key - the Replit AI integration doesn't support /audio/speech
    // Only use OPENAI_API_KEY, NOT AI_INTEGRATIONS_OPENAI_API_KEY
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  listVoices(): Voice[] {
    return OPENAI_VOICES;
  }

  async synthesiseSpeech(options: { text: string; voice: string; speed?: number }): Promise<SynthesisResult> {
    if (!this.client) {
      throw new Error("TTS not configured: OPENAI_API_KEY is missing");
    }

    const speed = Math.max(0.25, Math.min(4.0, options.speed || 1.0));
    const voice = options.voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

    const response = await this.client.audio.speech.create({
      model: "tts-1",
      voice,
      input: options.text,
      speed,
      response_format: "mp3",
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioBuffer,
      contentType: "audio/mpeg",
    };
  }
}
