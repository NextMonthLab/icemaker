import OpenAI from "openai";
import type { TTSProvider, Voice, SynthesisResult } from "./provider";
import { estimateSpeechDuration } from "./provider";

const OPENAI_VOICES: Voice[] = [
  // Original 6 voices
  { id: "alloy", name: "Alloy", previewTextHint: "Balanced, neutral voice - versatile for any content", tags: ["neutral", "versatile", "american"], description: "Neutral & Versatile" },
  { id: "echo", name: "Echo", previewTextHint: "Warm, resonant male voice - great for podcasts", tags: ["warm", "male", "american"], description: "Warm Male" },
  { id: "fable", name: "Fable", previewTextHint: "British storyteller voice - perfect for narratives", tags: ["british", "storytelling", "male"], description: "British Storyteller" },
  { id: "onyx", name: "Onyx", previewTextHint: "Deep, authoritative male - ideal for serious content", tags: ["deep", "male", "authoritative", "american"], description: "Deep & Authoritative" },
  { id: "nova", name: "Nova", previewTextHint: "Friendly, energetic female - upbeat and engaging", tags: ["female", "energetic", "friendly", "american"], description: "Energetic Female" },
  { id: "shimmer", name: "Shimmer", previewTextHint: "Soft, expressive female - gentle and calming", tags: ["female", "soft", "expressive", "american"], description: "Soft & Expressive" },
  // New voices added in 2024-2025
  { id: "ash", name: "Ash", previewTextHint: "Clear, articulate voice - professional presentations", tags: ["clear", "professional", "american"], description: "Clear & Professional" },
  { id: "ballad", name: "Ballad", previewTextHint: "Melodic, emotional voice - dramatic storytelling", tags: ["melodic", "emotional", "dramatic"], description: "Melodic & Emotional" },
  { id: "coral", name: "Coral", previewTextHint: "Bright, friendly female - conversational tone", tags: ["female", "bright", "friendly", "conversational"], description: "Bright & Friendly" },
  { id: "sage", name: "Sage", previewTextHint: "Wise, measured voice - educational content", tags: ["wise", "calm", "educational"], description: "Wise & Measured" },
  { id: "verse", name: "Verse", previewTextHint: "Poetic, artistic voice - creative content", tags: ["poetic", "artistic", "creative"], description: "Poetic & Artistic" },
  { id: "marin", name: "Marin", previewTextHint: "Modern, youthful voice - dynamic and fresh", tags: ["youthful", "modern", "dynamic"], description: "Modern & Youthful" },
  { id: "cedar", name: "Cedar", previewTextHint: "Rich, grounded voice - trustworthy narrator", tags: ["rich", "grounded", "trustworthy", "male"], description: "Rich & Grounded" },
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
    const voice = options.voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" | "ash" | "ballad" | "coral" | "sage" | "verse" | "marin" | "cedar";

    const response = await this.client.audio.speech.create({
      model: "tts-1",
      voice,
      input: options.text,
      speed,
      response_format: "mp3",
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Estimate duration based on text length and speed
    const durationSeconds = estimateSpeechDuration(options.text, speed);

    return {
      audioBuffer,
      contentType: "audio/mpeg",
      durationSeconds,
    };
  }
}
