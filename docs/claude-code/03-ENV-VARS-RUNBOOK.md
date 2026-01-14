# Environment Variables Runbook

## Complete Environment Variable Reference

### Critical (Required for Startup)

| Variable | Purpose | Required Dev | Required Prod | Example Format |
|----------|---------|--------------|---------------|----------------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | Yes | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `SESSION_SECRET` | Express session encryption | Yes | Yes | `random-32-char-string-here-abc123` |
| `PUBLIC_TOKEN_SECRET` | Public access token signing (HMAC-SHA256) | Yes | Yes | `another-random-32-char-string` |
| `NODE_ENV` | Environment mode | No (defaults dev) | Yes | `production` |

### AI Services

| Variable | Purpose | Required Dev | Required Prod | Example Format |
|----------|---------|--------------|---------------|----------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI Integrations key | No* | No* | Auto-provided by Replit |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI base URL | No* | No* | Auto-provided by Replit |
| `OPENAI_API_KEY` | Direct OpenAI API key (fallback) | Yes** | Yes** | `sk-...` |
| `KLING_ACCESS_KEY` | Kling AI video generation | No | For video | Access key string |
| `KLING_SECRET_KEY` | Kling AI authentication | No | For video | Secret key string |
| `KLING_API_BASE` | Kling API endpoint | No | For video | `https://api.kling.ai` |
| `REPLICATE_API_TOKEN` | Replicate fallback video | No | For video | `r8_...` |
| `PEXELS_API_KEY` | Stock image search | No | For stock images | API key string |

*Replit provides these automatically via integrations
**Required if not using Replit AI Integrations

### Billing (Stripe)

| Variable | Purpose | Required Dev | Required Prod | Example Format |
|----------|---------|--------------|---------------|----------------|
| `STRIPE_SECRET_KEY` | Stripe API secret | For billing | Yes | `sk_live_...` or `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key | For billing | Yes | `pk_live_...` or `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | For billing | Yes | `whsec_...` |

### Email (Resend)

| Variable | Purpose | Required Dev | Required Prod | Example Format |
|----------|---------|--------------|---------------|----------------|
| `RESEND_API_KEY` | Resend email API | No | For email | `re_...` |
| `EMAIL_FROM_ADDRESS` | Sender email address | No | For email | `hello@yourdomain.com` |

### Object Storage

| Variable | Purpose | Required Dev | Required Prod | Example Format |
|----------|---------|--------------|---------------|----------------|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage bucket | For uploads | Yes | Bucket UUID |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public asset paths | No | No | `public/` |
| `PRIVATE_OBJECT_DIR` | Private upload directory | No | No | `.private/` |

### Feature Flags and Limits

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `AI_CHAT_ENABLED` | Enable AI character chat | true | `true` / `false` |
| `AI_IMAGE_GENERATION_ENABLED` | Enable image generation | true | `true` / `false` |
| `AI_TTS_ENABLED` | Enable text-to-speech | true | `true` / `false` |
| `VIDEO_GENERATION_ENABLED` | Enable video generation | true | `true` / `false` |
| `ICE_GENERATION_ENABLED` | Enable ICE creation | true | `true` / `false` |
| `MAGIC_LINKS_ENABLED` | Enable magic link auth | false | `true` / `false` |
| `INVITE_ONLY_MODE` | Require invite codes | false | `true` / `false` |

### Emergency Stops

| Variable | Purpose | Default |
|----------|---------|---------|
| `EMERGENCY_STOP` | Global kill switch | false |
| `STOP_AI_CHAT` | Disable AI chat | false |
| `STOP_IMAGE_GENERATION` | Disable image gen | false |
| `STOP_VIDEO_GENERATION` | Disable video gen | false |
| `STOP_NEW_ORBITS` | Disable new orbit creation | false |

### Rate Limits

| Variable | Purpose | Default |
|----------|---------|---------|
| `DAILY_API_CALL_LIMIT` | API calls per day | 1000 |
| `DAILY_IMAGE_GENERATION_LIMIT` | Images per day | 50 |
| `DAILY_VIDEO_GENERATION_LIMIT` | Videos per day | 10 |
| `FREE_CONVERSATION_LIMIT` | Free tier chat messages | 20 |
| `FREE_CONVERSATION_SOFT_LIMIT` | Soft limit for upsell | 15 |
| `MAX_CONCURRENT_ICE_JOBS` | Parallel ICE processing | 5 |
| `MAX_VIDEO_SCENES` | Max video scenes per ICE | 10 |
| `MAX_CREDITS_PER_PURCHASE` | Credit purchase cap | 1000 |
| `MAX_NEW_ORBITS_PER_DAY` | Orbit creation limit | 3 |

### URLs and Domains

| Variable | Purpose | Example |
|----------|---------|---------|
| `PUBLIC_APP_URL` | Public-facing app URL | `https://icemaker.onrender.com` |
| `BASE_URL` | Base URL for links | `https://icemaker.onrender.com` |
| `ALLOWED_DOMAINS` | CORS allowed domains | `icemaker.onrender.com,localhost` |

### Debugging

| Variable | Purpose | Default |
|----------|---------|---------|
| `COST_AUDIT_LOGGING` | Log AI generation costs | false |
| `SECURITY_LOG_VERBOSE` | Verbose security logs | false |

---

## File References

### Where Variables Are Used

**DATABASE_URL**:
- `server/storage.ts` line ~15 - Database connection
- `server/routes.ts` line ~123 - Session store

**SESSION_SECRET**:
- `server/routes.ts` line ~131 - Express session config

**PUBLIC_TOKEN_SECRET**:
- `server/publicAccessToken.ts` - Token signing/verification

**OPENAI_API_KEY / AI_INTEGRATIONS_OPENAI_API_KEY**:
- `server/routes.ts` lines 54-62 - getOpenAI() function
- `server/chat.ts` - Chat completions
- `server/tts/` - Text-to-speech

**STRIPE_***:
- `server/stripeClient.ts` - Stripe client init
- `server/webhookHandlers.ts` - Webhook processing
- `server/routes.ts` checkout endpoints

---

## Render Deployment Runbook

### Setting Environment Variables

1. Go to your Render service dashboard
2. Click "Environment" in the left sidebar
3. Add each variable as key-value pair
4. Click "Save Changes"
5. Service will automatically redeploy

### Verify Variables Are Set

In Render shell:
```bash
echo $DATABASE_URL | head -c 20  # Should show postgres://...
echo $NODE_ENV                    # Should show "production"
echo $SESSION_SECRET | wc -c      # Should be 32+ characters
```

### Common Deployment Failures

#### "relation does not exist"
**Cause**: Database tables not created
**Fix**: Run `npm run db:push` in Render shell

#### "SESSION_SECRET is required"
**Cause**: Missing env var
**Fix**: Add SESSION_SECRET in Render environment

#### "Invalid API key"
**Cause**: OpenAI/Stripe key incorrect or expired
**Fix**: Verify key in provider dashboard, update in Render

#### "ECONNREFUSED" on database
**Cause**: DATABASE_URL incorrect or database not running
**Fix**: Verify connection string, check database service status

#### App starts but shows blank page
**Cause**: Build failed or missing client assets
**Fix**: Check build logs, ensure `npm run build` succeeded

### Health Check Verification

After deploy, test:
```bash
curl https://your-app.onrender.com/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-14T12:00:00.000Z"}
```

---

## Secrets Safety

### Never Log Secrets

The following patterns MUST be avoided:

```typescript
// BAD - Never do this
console.log("API Key:", process.env.OPENAI_API_KEY);
console.log("Full config:", JSON.stringify(process.env));

// GOOD - Mask sensitive values
console.log("API Key configured:", !!process.env.OPENAI_API_KEY);
console.log("Database connected:", !!process.env.DATABASE_URL);
```

### Redaction Patterns

When logging requests/responses that might contain secrets:

```typescript
const redactSecrets = (obj: any): any => {
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'authorization',
    'api_key', 'apiKey', 'session', 'cookie'
  ];
  // ... redaction logic
};
```

### File Locations for Security Logging

- `server/securityLogger.ts` - Security event logging
- `server/authPolicies.ts` - Access control logging
- `server/rateLimit.ts` - Rate limit logging

### Environment Variable Access Pattern

Always use defensive access:

```typescript
// GOOD - Check existence before use
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required");
}

// GOOD - Provide defaults for optional vars
const limit = parseInt(process.env.DAILY_LIMIT || "100", 10);

// GOOD - Boolean parsing
const enabled = process.env.FEATURE_FLAG === "true";
```
