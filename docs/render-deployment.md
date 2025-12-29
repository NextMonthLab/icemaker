# Render Deployment Guide

This guide covers deploying NextMonth to Render or any standard hosting platform.

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` for live deployment |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PUBLIC_TOKEN_SECRET` | Yes | Secret for signing public access tokens (min 32 chars) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_live_...` for production) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key (optional, for client-side) |
| `PUBLIC_APP_URL` | No | Override for app URL (e.g., `https://yourdomain.com`) |
| `SESSION_SECRET` | Recommended | Secret for session cookies |

## Stripe Setup for Render

### 1. Get Your Stripe Keys

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Live mode** (toggle in top right)
3. Go to **Developers > API Keys**
4. Copy the **Secret key** (`sk_live_...`)
5. Copy the **Publishable key** (`pk_live_...`)

### 2. Create Webhook Endpoint

1. Go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-render-domain.onrender.com/api/stripe/webhook`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_...`)

### 3. Configure Render Environment

Add these environment variables in Render dashboard:

```
NODE_ENV=production
DATABASE_URL=<your-postgres-connection-string>
PUBLIC_TOKEN_SECRET=<generate-a-32-char-random-string>
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
PUBLIC_APP_URL=https://your-domain.onrender.com
```

## Startup Verification

On startup, the server logs will show:

```
========================================
  Security Startup Checks (Phase 1.1)
========================================
Environment: production
Platform: Standard (Render/other)

[Token System]
  - PUBLIC_TOKEN_SECRET: SET (stable)
  ...

[Stripe Configuration]
  - Mode: Standard environment variables
  - STRIPE_SECRET_KEY: SET
  - STRIPE_WEBHOOK_SECRET: SET

[Rate Limiting]
  - Analytics: 100 requests/minute per IP
  ...

✅ Security checks passed - system is ready
========================================
```

If you see errors, check your environment variables.

## Testing Webhooks Locally

For local development testing:

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe listen --forward-to localhost:5000/api/stripe/webhook`
3. Copy the webhook signing secret from CLI output
4. Set `STRIPE_WEBHOOK_SECRET` in your local env

## Common Issues

### "STRIPE_SECRET_KEY is required"
- Ensure `STRIPE_SECRET_KEY` is set in Render environment variables
- Check for typos in the key name

### Webhook signature verification failed
- Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe Dashboard
- Ensure the webhook URL in Stripe Dashboard matches your actual endpoint

### Checkout redirects to wrong URL
- Set `PUBLIC_APP_URL` to your production domain
- Ensure your domain is configured correctly in Render

### Subscriptions not syncing
- Check webhook event logs in Stripe Dashboard
- Verify all required events are selected
- Check server logs for webhook processing errors

## One-Click Deployment Checklist

Before deploying:

- [ ] All environment variables set in Render
- [ ] Stripe webhook endpoint created with correct URL
- [ ] Webhook events selected (subscription, checkout, invoice)
- [ ] STRIPE_WEBHOOK_SECRET copied to Render
- [ ] DATABASE_URL points to production database
- [ ] PUBLIC_TOKEN_SECRET is a secure random string
- [ ] NODE_ENV is set to "production"

After deploying:

- [ ] Check startup logs for "Security checks passed"
- [ ] Test a checkout flow end-to-end
- [ ] Verify webhook receives events (check Stripe Dashboard)
- [ ] Confirm subscription creates correctly in database

## Files Changed for Render Compatibility

| File | Purpose |
|------|---------|
| `server/stripeClient.ts` | Uses env vars with Replit connector fallback |
| `server/startup.ts` | Validates required env vars on startup |
| `server/index.ts` | Platform-agnostic Stripe initialization |
| `server/webhookHandlers.ts` | Direct signature verification + event deduplication |
| `server/routes.ts` | PUBLIC_APP_URL support for checkout redirects |
