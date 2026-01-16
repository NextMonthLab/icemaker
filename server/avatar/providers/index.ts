import type { IAvatarProvider } from './IAvatarProvider';
import { heygenProvider } from './HeyGenProvider';
import { didProvider } from './DidProvider';

export * from './IAvatarProvider';
export { heygenProvider } from './HeyGenProvider';
export { didProvider } from './DidProvider';

const providers: Record<string, IAvatarProvider> = {
  heygen: heygenProvider,
  did: didProvider,
};

export function getAvatarProvider(providerId: 'heygen' | 'did' = 'heygen'): IAvatarProvider {
  return providers[providerId] || heygenProvider;
}

export function getDefaultAvatarProvider(): IAvatarProvider {
  if (heygenProvider.isConfigured()) {
    return heygenProvider;
  }
  if (didProvider.isConfigured()) {
    return didProvider;
  }
  return heygenProvider;
}

export function getConfiguredProviders(): IAvatarProvider[] {
  return Object.values(providers).filter(p => p.isConfigured());
}
