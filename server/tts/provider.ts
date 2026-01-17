export interface Voice {
  id: string;
  name: string;
  previewTextHint: string;
  tags: string[];
}

export interface SynthesisResult {
  audioBuffer: Buffer;
  contentType: string;
  durationSeconds?: number; // Estimated duration in seconds
}

// Estimate speech duration based on text length and speed
// Average speaking rate: ~150 words/minute = 2.5 words/second
// Average word length: ~5 characters, so ~12.5 chars/second at normal speed
export function estimateSpeechDuration(text: string, speed: number = 1.0): number {
  const charsPerSecond = 12.5 * speed; // Adjust for speed
  const duration = text.length / charsPerSecond;
  return Math.max(1, Math.round(duration * 10) / 10); // Minimum 1 second, round to 0.1s
}

export interface TTSProvider {
  listVoices(): Voice[];
  synthesiseSpeech(options: { text: string; voice: string; speed?: number }): Promise<SynthesisResult>;
  isConfigured(): boolean;
}
