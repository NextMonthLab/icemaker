import Stripe from 'stripe';

let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function hasReplitConnector(): boolean {
  return !!(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL)
  );
}

async function getCredentialsFromEnv(): Promise<{ publishableKey: string; secretKey: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY environment variable is required. ' +
      'Set this in your environment for Render or other platforms.'
    );
  }

  return {
    publishableKey: publishableKey || '',
    secretKey,
  };
}

async function getCredentialsFromReplitConnector(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not available');
  }

  const connectorName = 'stripe';
  const targetEnvironment = isProduction() ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings || !connectionSettings.settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found via Replit connector`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable || '',
    secretKey: connectionSettings.settings.secret,
  };
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  if (process.env.STRIPE_SECRET_KEY) {
    console.log('[stripe] Using standard environment variables for Stripe');
    cachedCredentials = await getCredentialsFromEnv();
    return cachedCredentials;
  }

  if (hasReplitConnector()) {
    console.log('[stripe] Using Replit connector for Stripe credentials');
    cachedCredentials = await getCredentialsFromReplitConnector();
    return cachedCredentials;
  }

  throw new Error(
    'Stripe credentials not configured. ' +
    'Set STRIPE_SECRET_KEY environment variable, or run on Replit with Stripe connector enabled.'
  );
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}

export function getWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

export function validateStripeConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const hasEnvVars = !!process.env.STRIPE_SECRET_KEY;
  const hasReplit = hasReplitConnector();
  
  if (!hasEnvVars && !hasReplit) {
    errors.push('STRIPE_SECRET_KEY is required (or Replit connector must be configured)');
  }
  
  if (!hasReplit && !process.env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET is required for webhook signature verification on non-Replit platforms');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
