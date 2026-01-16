import type { IAvatarProvider, GuestVideoInput, GuestVideoGenerateResult, GuestVideoStatusResult } from './IAvatarProvider';

export class DidProvider implements IAvatarProvider {
  readonly name = 'D-ID';
  readonly id = 'did' as const;
  
  private getApiKey(): string | undefined {
    return process.env.DID_API_KEY;
  }
  
  isConfigured(): boolean {
    return !!this.getApiKey();
  }
  
  async generateGuestVideo(_input: GuestVideoInput): Promise<GuestVideoGenerateResult> {
    return {
      providerJobId: '',
      status: 'failed',
      error: 'D-ID provider not yet implemented. Use HeyGen instead.',
    };
  }
  
  async getGuestVideoStatus(_providerJobId: string): Promise<GuestVideoStatusResult> {
    return {
      status: 'failed',
      error: 'D-ID provider not yet implemented',
    };
  }
}

export const didProvider = new DidProvider();
