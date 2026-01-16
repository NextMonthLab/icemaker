import type { IAvatarProvider, GuestVideoInput, GuestVideoGenerateResult, GuestVideoStatusResult } from './IAvatarProvider';

const HEYGEN_API_BASE = 'https://api.heygen.com';

export class HeyGenProvider implements IAvatarProvider {
  readonly name = 'HeyGen';
  readonly id = 'heygen' as const;
  
  private getApiKey(): string | undefined {
    return process.env.HEYGEN_API_KEY;
  }
  
  isConfigured(): boolean {
    return !!this.getApiKey();
  }
  
  async generateGuestVideo(input: GuestVideoInput): Promise<GuestVideoGenerateResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        providerJobId: '',
        status: 'failed',
        error: 'HeyGen API key not configured',
      };
    }
    
    try {
      const videoInput: Record<string, unknown> = {
        script: {
          type: 'text',
          input: input.script,
        },
        dimension: {
          width: 720,
          height: 1280,
        },
      };
      
      if (input.headshotUrl) {
        videoInput.avatar = {
          photo_url: input.headshotUrl,
          avatar_style: 'normal',
        };
      }
      
      if (input.voiceId) {
        (videoInput.script as Record<string, unknown>).voice_id = input.voiceId;
      } else if (input.audioUrl) {
        (videoInput.script as Record<string, unknown>).type = 'audio';
        (videoInput.script as Record<string, unknown>).audio_url = input.audioUrl;
      }
      
      const response = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          video_inputs: [videoInput],
          test: process.env.NODE_ENV !== 'production',
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[HeyGen] API error:', response.status, errorText);
        return {
          providerJobId: '',
          status: 'failed',
          error: `HeyGen API error: ${response.status} - ${errorText}`,
        };
      }
      
      const data = await response.json() as { data?: { video_id?: string }; error?: { message?: string } };
      
      if (data.error) {
        return {
          providerJobId: '',
          status: 'failed',
          error: data.error.message || 'Unknown HeyGen error',
        };
      }
      
      const videoId = data.data?.video_id;
      if (!videoId) {
        return {
          providerJobId: '',
          status: 'failed',
          error: 'No video ID returned from HeyGen',
        };
      }
      
      console.log('[HeyGen] Video generation started, job ID:', videoId);
      
      return {
        providerJobId: videoId,
        status: 'processing',
      };
    } catch (error) {
      console.error('[HeyGen] Generate error:', error);
      return {
        providerJobId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async getGuestVideoStatus(providerJobId: string): Promise<GuestVideoStatusResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        status: 'failed',
        error: 'HeyGen API key not configured',
      };
    }
    
    try {
      const response = await fetch(`${HEYGEN_API_BASE}/v1/video_status.get?video_id=${providerJobId}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[HeyGen] Status check error:', response.status, errorText);
        return {
          status: 'failed',
          error: `HeyGen status check error: ${response.status}`,
        };
      }
      
      const data = await response.json() as {
        data?: {
          status?: string;
          video_url?: string;
          duration?: number;
          error?: { message?: string };
        };
      };
      
      const heygenStatus = data.data?.status;
      
      if (heygenStatus === 'completed') {
        return {
          status: 'completed',
          videoUrl: data.data?.video_url,
          durationSeconds: data.data?.duration,
        };
      } else if (heygenStatus === 'failed') {
        return {
          status: 'failed',
          error: data.data?.error?.message || 'Video generation failed',
        };
      } else if (heygenStatus === 'pending' || heygenStatus === 'processing') {
        return {
          status: heygenStatus as 'pending' | 'processing',
        };
      }
      
      return {
        status: 'processing',
      };
    } catch (error) {
      console.error('[HeyGen] Status check error:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const heygenProvider = new HeyGenProvider();
