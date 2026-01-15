import type { TTSProvider, Voice, SynthesisResult } from "./provider";

const ELEVENLABS_VOICES: Voice[] = [
  { id: "eleven_rachel", name: "Rachel (ElevenLabs)", previewTextHint: "A warm, professional American female voice.", tags: ["female", "professional", "american", "elevenlabs"] },
  { id: "eleven_domi", name: "Domi (ElevenLabs)", previewTextHint: "A strong, authoritative American female voice.", tags: ["female", "strong", "american", "elevenlabs"] },
  { id: "eleven_bella", name: "Bella (ElevenLabs)", previewTextHint: "A soft, friendly American female voice.", tags: ["female", "soft", "friendly", "elevenlabs"] },
  { id: "eleven_antoni", name: "Antoni (ElevenLabs)", previewTextHint: "A warm, engaging American male voice.", tags: ["male", "warm", "american", "elevenlabs"] },
  { id: "eleven_elli", name: "Elli (ElevenLabs)", previewTextHint: "A young, energetic American female voice.", tags: ["female", "young", "energetic", "elevenlabs"] },
  { id: "eleven_josh", name: "Josh (ElevenLabs)", previewTextHint: "A deep, authoritative American male voice.", tags: ["male", "deep", "authoritative", "elevenlabs"] },
  { id: "eleven_arnold", name: "Arnold (ElevenLabs)", previewTextHint: "A crisp, clear British male voice.", tags: ["male", "british", "clear", "elevenlabs"] },
  { id: "eleven_adam", name: "Adam (ElevenLabs)", previewTextHint: "A deep, narrative American male voice.", tags: ["male", "deep", "narrative", "elevenlabs"] },
  { id: "eleven_sam", name: "Sam (ElevenLabs)", previewTextHint: "A warm, friendly American male voice.", tags: ["male", "warm", "friendly", "elevenlabs"] },
];

const VOICE_ID_MAP: Record<string, string> = {
  "eleven_rachel": "21m00Tcm4TlvDq8ikWAM",
  "eleven_domi": "AZnzlk1XvdvUeBnXmlld",
  "eleven_bella": "EXAVITQu4vr4xnSDxMaL",
  "eleven_antoni": "ErXwobaYiN019PkySvjV",
  "eleven_elli": "MF3mGyEYCl7XYWbV9V6O",
  "eleven_josh": "TxGEqnHWrfWFTfGW9XjX",
  "eleven_arnold": "VR6AewLTigWG4xSOukaG",
  "eleven_adam": "pNInz6obpgDQGcFmaJgB",
  "eleven_sam": "yoZ06aMxZJJ28mfd3POQ",
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

  async synthesiseSpeech(options: { text: string; voice: string; speed?: number }): Promise<SynthesisResult> {
    if (!this.apiKey) {
      throw new Error("ElevenLabs TTS not configured: ELEVENLABS_API_KEY is missing");
    }

    const voiceId = VOICE_ID_MAP[options.voice];
    if (!voiceId) {
      throw new Error(`Unknown ElevenLabs voice: ${options.voice}`);
    }

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
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioBuffer,
      contentType: "audio/mpeg",
    };
  }
}
