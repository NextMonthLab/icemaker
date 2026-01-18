import type { TTSProvider, Voice, SynthesisResult } from "./provider";
import { estimateSpeechDuration } from "./provider";

// Sound Effects generation result
export interface SoundEffectResult {
  audioBuffer: Buffer;
  contentType: string;
  durationSeconds: number;
}

const ELEVENLABS_VOICES: Voice[] = [
  // Popular female voices
  { id: "eleven_rachel", name: "Rachel", previewTextHint: "Warm, professional American female - great for corporate", tags: ["female", "professional", "american", "elevenlabs"], description: "Professional Female (US)" },
  { id: "eleven_domi", name: "Domi", previewTextHint: "Strong, authoritative American female - confident delivery", tags: ["female", "strong", "american", "elevenlabs"], description: "Authoritative Female (US)" },
  { id: "eleven_bella", name: "Bella", previewTextHint: "Soft, friendly American female - approachable tone", tags: ["female", "soft", "friendly", "elevenlabs"], description: "Friendly Female (US)" },
  { id: "eleven_elli", name: "Elli", previewTextHint: "Young, energetic American female - fresh and lively", tags: ["female", "young", "energetic", "elevenlabs"], description: "Youthful Female (US)" },
  { id: "eleven_dorothy", name: "Dorothy", previewTextHint: "Young British female - warm and pleasant", tags: ["female", "british", "young", "elevenlabs"], description: "Young Female (British)" },
  { id: "eleven_charlotte", name: "Charlotte", previewTextHint: "Swedish-accented female - sophisticated and clear", tags: ["female", "swedish", "sophisticated", "elevenlabs"], description: "Swedish Female" },
  { id: "eleven_freya", name: "Freya", previewTextHint: "Clear, professional American female - articulate", tags: ["female", "clear", "professional", "elevenlabs"], description: "Clear Female (US)" },
  { id: "eleven_gigi", name: "Gigi", previewTextHint: "Youthful, energetic American female - upbeat", tags: ["female", "youthful", "energetic", "elevenlabs"], description: "Energetic Female (US)" },
  { id: "eleven_grace", name: "Grace", previewTextHint: "Calm, measured American female - reassuring", tags: ["female", "calm", "measured", "elevenlabs"], description: "Calm Female (US)" },
  { id: "eleven_sarah", name: "Sarah", previewTextHint: "Multilingual female - natural in many languages", tags: ["female", "multilingual", "versatile", "elevenlabs"], description: "Multilingual Female" },
  { id: "eleven_matilda", name: "Matilda", previewTextHint: "German-accented female - precise and warm", tags: ["female", "german", "precise", "elevenlabs"], description: "German Female" },
  { id: "eleven_glinda", name: "Glinda", previewTextHint: "Theatrical female - whimsical and expressive", tags: ["female", "theatrical", "expressive", "elevenlabs"], description: "Theatrical Female" },
  { id: "eleven_nicole", name: "Nicole", previewTextHint: "Soft, whispery female - intimate ASMR-like quality", tags: ["female", "soft", "whisper", "asmr", "elevenlabs"], description: "Soft Whisper Female" },
  // Popular male voices
  { id: "eleven_antoni", name: "Antoni", previewTextHint: "Warm, engaging American male - news anchor style", tags: ["male", "warm", "american", "elevenlabs"], description: "News Anchor Male (US)" },
  { id: "eleven_josh", name: "Josh", previewTextHint: "Deep, authoritative American male - commanding", tags: ["male", "deep", "authoritative", "elevenlabs"], description: "Deep Male (US)" },
  { id: "eleven_arnold", name: "Arnold", previewTextHint: "Crisp, clear British male - refined delivery", tags: ["male", "british", "clear", "elevenlabs"], description: "British Male" },
  { id: "eleven_adam", name: "Adam", previewTextHint: "Deep, narrative American male - viral TikTok voice", tags: ["male", "deep", "narrative", "viral", "elevenlabs"], description: "Deep Narrator (US) ⭐" },
  { id: "eleven_sam", name: "Sam", previewTextHint: "Warm, friendly American male - conversational", tags: ["male", "warm", "friendly", "elevenlabs"], description: "Friendly Male (US)" },
  { id: "eleven_charlie", name: "Charlie", previewTextHint: "Casual Australian male - laid-back and natural", tags: ["male", "australian", "casual", "elevenlabs"], description: "Australian Male" },
  { id: "eleven_clyde", name: "Clyde", previewTextHint: "Character male - gruff war veteran type", tags: ["male", "character", "gruff", "elevenlabs"], description: "Character Voice Male" },
  { id: "eleven_harry", name: "Harry", previewTextHint: "Warm British male - storytelling style", tags: ["male", "british", "warm", "storytelling", "elevenlabs"], description: "British Storyteller" },
  { id: "eleven_george", name: "George", previewTextHint: "British male - warm and professional", tags: ["male", "british", "professional", "elevenlabs"], description: "Warm British Male" },
  { id: "eleven_thomas", name: "Thomas", previewTextHint: "Calm American male - soothing and measured", tags: ["male", "calm", "american", "soothing", "elevenlabs"], description: "Calm Male (US)" },
  { id: "eleven_brian", name: "Brian", previewTextHint: "Multilingual male - natural in many languages", tags: ["male", "multilingual", "versatile", "elevenlabs"], description: "Multilingual Male" },
  { id: "eleven_daniel", name: "Daniel", previewTextHint: "British male - deep authoritative narrator", tags: ["male", "british", "deep", "authoritative", "elevenlabs"], description: "Deep British Narrator" },
  { id: "eleven_liam", name: "Liam", previewTextHint: "Young American male - confident and energetic", tags: ["male", "young", "american", "energetic", "elevenlabs"], description: "Young Male (US)" },
];

const VOICE_ID_MAP: Record<string, string> = {
  // Female voices
  "eleven_rachel": "21m00Tcm4TlvDq8ikWAM",
  "eleven_domi": "AZnzlk1XvdvUeBnXmlld",
  "eleven_bella": "EXAVITQu4vr4xnSDxMaL",
  "eleven_elli": "MF3mGyEYCl7XYWbV9V6O",
  "eleven_dorothy": "ThT5KcBeYPX3keUQqHPh",
  "eleven_charlotte": "XB0fDUnXU5powFXDhCwa",
  "eleven_freya": "jsCqWAovK2LkecY7zXl4",
  "eleven_gigi": "jBpfuIE2acCO8z3wKNLl",
  "eleven_grace": "oWAxZDx7w5VEj9dCyTzz",
  "eleven_sarah": "EXAVITQu4vr4xnSDxMaL",
  "eleven_matilda": "XrExE9yKIg1WjnnlVkGX",
  "eleven_glinda": "z9fAnlkpzviPz146aGWa",
  "eleven_nicole": "piTKgcLEGmPE4e6mEKli",
  // Male voices
  "eleven_antoni": "ErXwobaYiN019PkySvjV",
  "eleven_josh": "TxGEqnHWrfWFTfGW9XjX",
  "eleven_arnold": "VR6AewLTigWG4xSOukaG",
  "eleven_adam": "pNInz6obpgDQGcFmaJgB",
  "eleven_sam": "yoZ06aMxZJJ28mfd3POQ",
  "eleven_charlie": "IKne3meq5aSn9XLyUdCD",
  "eleven_clyde": "2EiwWnXFnvU5JabPnv8n",
  "eleven_harry": "SOYHLrjzK2X1ezoPC6cr",
  "eleven_george": "JBFqnCBsd6RMkjVDRZzb",
  "eleven_thomas": "GBv7mTt0atIp3Br8iCZE",
  "eleven_brian": "nPczCjzI2devNBz1zQrb",
  "eleven_daniel": "onwK4e9ZLuTAKqWW03F9",
  "eleven_liam": "TX3LPaxmHKxFdv7VOQHJ",
};

export class ElevenLabsTTSProvider implements TTSProvider {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  listVoices(): Voice[] {
    return ELEVENLABS_VOICES;
  }

  // Map delivery style to ElevenLabs voice_settings
  private getVoiceSettings(deliveryStyle?: string): { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean } {
    switch (deliveryStyle) {
      case 'confident':
        return { stability: 0.7, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true };
      case 'friendly':
        return { stability: 0.4, similarity_boost: 0.7, style: 0.7, use_speaker_boost: true };
      case 'dramatic':
        return { stability: 0.3, similarity_boost: 0.9, style: 0.9, use_speaker_boost: true };
      case 'calm':
        return { stability: 0.8, similarity_boost: 0.6, style: 0.3, use_speaker_boost: false };
      case 'neutral':
      default:
        return { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true };
    }
  }

  async synthesiseSpeech(options: { text: string; voice: string; speed?: number; deliveryStyle?: string }): Promise<SynthesisResult> {
    if (!this.apiKey) {
      throw new Error("ElevenLabs TTS not configured: ELEVENLABS_API_KEY is missing");
    }

    const voiceId = VOICE_ID_MAP[options.voice];
    if (!voiceId) {
      throw new Error(`Unknown ElevenLabs voice: ${options.voice}`);
    }

    const voiceSettings = this.getVoiceSettings(options.deliveryStyle);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Estimate duration based on text length (ElevenLabs doesn't return duration)
    const durationSeconds = estimateSpeechDuration(options.text, 1.0);

    return {
      audioBuffer,
      contentType: "audio/mpeg",
      durationSeconds,
    };
  }

  // Generate sound effect using ElevenLabs Sound Effects API
  async generateSoundEffect(options: { 
    prompt: string; 
    durationSeconds?: number;
    promptInfluence?: number;
  }): Promise<SoundEffectResult> {
    if (!this.apiKey) {
      throw new Error("ElevenLabs not configured: ELEVENLABS_API_KEY is missing");
    }

    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: options.prompt,
        duration_seconds: options.durationSeconds || 2,
        prompt_influence: options.promptInfluence || 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs Sound Effects API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioBuffer,
      contentType: "audio/mpeg",
      durationSeconds: options.durationSeconds || 2,
    };
  }
}
