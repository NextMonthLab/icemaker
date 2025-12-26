export interface Voice {
  id: string;
  name: string;
  previewTextHint: string;
  tags: string[];
}

export interface SynthesisResult {
  audioBuffer: Buffer;
  contentType: string;
}

export interface TTSProvider {
  listVoices(): Voice[];
  synthesiseSpeech(options: { text: string; voice: string; speed?: number }): Promise<SynthesisResult>;
  isConfigured(): boolean;
}
