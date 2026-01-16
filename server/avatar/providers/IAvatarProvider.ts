export interface GuestVideoInput {
  script: string;
  headshotUrl?: string;
  voiceId?: string;
  audioUrl?: string;
  name?: string;
  maxDurationSeconds?: number;
}

export interface GuestVideoGenerateResult {
  providerJobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  durationSeconds?: number;
  error?: string;
}

export interface GuestVideoStatusResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  durationSeconds?: number;
  error?: string;
  progress?: number;
}

export interface IAvatarProvider {
  readonly name: string;
  readonly id: 'heygen' | 'did';
  
  generateGuestVideo(input: GuestVideoInput): Promise<GuestVideoGenerateResult>;
  
  getGuestVideoStatus(providerJobId: string): Promise<GuestVideoStatusResult>;
  
  isConfigured(): boolean;
}
