import crypto from 'crypto';

const REQUIRED_IN_PRODUCTION = ['PUBLIC_TOKEN_SECRET', 'DATABASE_URL'];
const RECOMMENDED_IN_PRODUCTION = ['SESSION_SECRET', 'STRIPE_WEBHOOK_SECRET'];

function hasReplitConnector(): boolean {
  return !!(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL)
  );
}

interface StartupCheckResult {
  success: boolean;
  warnings: string[];
  errors: string[];
}

export function runStartupSecurityChecks(): StartupCheckResult {
  const isProduction = process.env.NODE_ENV === 'production';
  const result: StartupCheckResult = {
    success: true,
    warnings: [],
    errors: [],
  };

  console.log('========================================');
  console.log('  Security Startup Checks (Phase 1.1)');
  console.log('========================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Platform: ${hasReplitConnector() ? 'Replit' : 'Standard (Render/other)'}`);
  console.log('');

  // Check required environment variables in production
  if (isProduction) {
    for (const envVar of REQUIRED_IN_PRODUCTION) {
      if (!process.env[envVar]) {
        result.errors.push(`CRITICAL: ${envVar} is REQUIRED in production but not set`);
        result.success = false;
      }
    }

    for (const envVar of RECOMMENDED_IN_PRODUCTION) {
      if (!process.env[envVar]) {
        result.warnings.push(`WARNING: ${envVar} is recommended in production but not set`);
      }
    }
  } else {
    // In development, warn if using default values
    if (!process.env.PUBLIC_TOKEN_SECRET) {
      result.warnings.push('DEV: PUBLIC_TOKEN_SECRET not set - using random value (tokens will invalidate on restart)');
    }
  }

  // Token system status
  const tokenSecretSet = !!process.env.PUBLIC_TOKEN_SECRET;
  console.log('[Token System]');
  console.log(`  - PUBLIC_TOKEN_SECRET: ${tokenSecretSet ? 'SET (stable)' : 'RANDOM (dev mode)'}`);
  console.log(`  - Token version: 1`);
  console.log(`  - Token expiry: 3600 seconds (1 hour)`);
  console.log(`  - Resource types: story, preview`);
  console.log(`  - Audiences: analytics, chat`);
  console.log('');

  // Stripe configuration status
  const stripeSecretSet = !!process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecretSet = !!process.env.STRIPE_WEBHOOK_SECRET;
  const usingReplitConnector = hasReplitConnector();
  
  console.log('[Stripe Configuration]');
  if (usingReplitConnector) {
    console.log('  - Mode: Replit Connector (auto-managed)');
    console.log('  - Credentials: Via Replit integration');
    console.log('  - Webhook secret: Managed by stripe-replit-sync');
  } else {
    console.log('  - Mode: Standard environment variables');
    console.log(`  - STRIPE_SECRET_KEY: ${stripeSecretSet ? 'SET' : 'NOT SET'}`);
    console.log(`  - STRIPE_WEBHOOK_SECRET: ${stripeWebhookSecretSet ? 'SET' : 'NOT SET'}`);
    
    if (!stripeSecretSet && isProduction) {
      result.errors.push('CRITICAL: STRIPE_SECRET_KEY is required in production');
      result.success = false;
    }
    if (!stripeWebhookSecretSet && isProduction) {
      result.warnings.push('WARNING: STRIPE_WEBHOOK_SECRET not set - webhook verification may fail');
    }
  }
  console.log('');

  // Rate limiting status
  console.log('[Rate Limiting]');
  console.log('  - Analytics: 100 requests/minute per IP');
  console.log('  - Activation/Pause: 10 requests/minute per IP');
  console.log('  - Chat: 30 requests/minute per user/IP');
  console.log('');

  // Print warnings
  if (result.warnings.length > 0) {
    console.log('[Warnings]');
    for (const warning of result.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
    console.log('');
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log('[ERRORS - CRITICAL]');
    for (const error of result.errors) {
      console.error(`  ❌ ${error}`);
    }
    console.log('');
  }

  // Final status
  if (result.success) {
    console.log('✅ Security checks passed - system is ready');
  } else {
    console.error('❌ SECURITY CHECKS FAILED - see errors above');
    if (isProduction) {
      console.error('');
      console.error('🛑 SERVER WILL NOT START IN PRODUCTION WITH MISSING SECURITY CONFIG');
      console.error('');
    }
  }
  console.log('========================================');
  console.log('');

  return result;
}

export function enforceProductionSecurity(): void {
  const result = runStartupSecurityChecks();
  
  if (!result.success && process.env.NODE_ENV === 'production') {
    console.error('');
    console.error('FATAL: Cannot start server in production with missing security configuration.');
    console.error('Please set all required environment variables and restart.');
    console.error('');
    process.exit(1);
  }
}
