# Monetisation and Perfect Picture

## Perfect Picture: What "Done" Looks Like

### Stable Build Pipeline
- Content upload -> parsing -> card generation: < 30 seconds
- Image generation: < 15 seconds per card
- Video generation: < 90 seconds per card
- TTS narration: < 10 seconds per card
- Zero orphaned jobs, zero data loss
- Graceful degradation when external APIs fail

### Predictable Unit Costs Per ICE Type

| ICE Type | Cards | Images | Videos | TTS | Est. Cost |
|----------|-------|--------|--------|-----|-----------|
| Text-only | 5 | 0 | 0 | 0 | ~$0.01 |
| Image-enhanced | 5 | 5 | 0 | 0 | ~$0.20 |
| Narrated | 5 | 5 | 0 | 5 | ~$0.35 |
| Video-enhanced | 5 | 5 | 2 | 5 | ~$1.50 |
| Full production | 10 | 10 | 5 | 10 | ~$4.00 |

### Guardrails That Stop Loss-Making Behaviour
- Video duration capped at 5 seconds (cost guardrail)
- Image resolution capped at 1024x1024 (~$0.04/image)
- Daily generation limits per user
- Storage quotas by subscription tier
- Rate limiting on all expensive operations

### Tenant Quotas and Billing Tiers

**Current Implementation Status**: Partially implemented

Tier system exists in database (`plans` table) and is enforced via `entitlements.ts`:

```typescript
// server/entitlements.ts
export async function getFullEntitlements(userId: number) {
  // Returns tier-specific limits:
  // - storageBytes
  // - dailyImageLimit
  // - dailyVideoLimit
  // - aiChatLimit
  // - customCharacters (boolean)
  // - conversationInsights (boolean)
  // - customFields (boolean)
}
```

---

## Pricing Model

### Subscription Tiers

| Tier | Price | Target User | Key Features |
|------|-------|-------------|--------------|
| Free | $0 | Explorers | 3 ICEs, basic features, watermarked |
| Creator | $19/mo | Indie creators | Unlimited ICEs, no watermark, basic analytics |
| Business | $49/mo | Professionals | Custom characters, lead capture, insights |
| Enterprise | Custom | Large orgs | Custom branding, SSO, dedicated support |

### Feature Matrix (from entitlements.ts)

| Feature | Free | Creator | Business |
|---------|------|---------|----------|
| ICE creation | 3 | Unlimited | Unlimited |
| Image generation | 10/day | 50/day | 200/day |
| Video generation | 2/day | 10/day | 50/day |
| TTS narration | 10/day | 50/day | 200/day |
| AI character chat | 20 msg | 100 msg | Unlimited |
| Custom characters | No | Yes | Yes |
| Lead capture | No | Basic | Advanced |
| Conversation insights | No | No | Yes |
| Custom fields | No | No | Yes |
| Logo branding | No | Yes | Yes |
| Storage | 500MB | 5GB | 25GB |

---

## Cost Model

### Cost Centres

| Service | Provider | Cost Metric | Approx. Cost |
|---------|----------|-------------|--------------|
| LLM Chat | OpenAI gpt-4o-mini | Per 1K tokens | ~$0.00015 in / $0.0006 out |
| Image Gen | OpenAI dall-e-3 | Per image | ~$0.04 (1024x1024) |
| Video Gen | Kling AI | Per 5-sec video | ~$0.30-0.50 |
| TTS | OpenAI tts-1 | Per 1K characters | ~$0.015 |
| Storage | Replit/R2 | Per GB/month | ~$0.015 |
| Egress | Replit/R2 | Per GB | ~$0.09 |

### Where Costs Occur in Code

**LLM Chat**:
- File: `server/chat.ts`
- Endpoint: `POST /api/ice/preview/:id/chat`
- Model: gpt-4o-mini

**Image Generation**:
- File: `server/routes.ts` (image generation section)
- Endpoint: `POST /api/cards/:id/image/generate`
- Model: dall-e-3

**Video Generation**:
- File: `server/video/index.ts`
- Endpoint: `POST /api/cards/:id/video/generate`
- Provider: Kling AI (primary), Replicate (fallback)

**TTS**:
- File: `server/tts/`
- Endpoint: `POST /api/cards/:id/narration/generate`
- Model: tts-1

**Storage**:
- File: `server/replit_integrations/object_storage.ts`
- All upload endpoints

### Recommended Usage Caps (Current Settings)

```
DAILY_IMAGE_GENERATION_LIMIT=50      # Per user per day
DAILY_VIDEO_GENERATION_LIMIT=10      # Per user per day
MAX_VIDEO_SCENES=10                  # Per ICE
FREE_CONVERSATION_LIMIT=20           # Free tier chat messages
MAX_CONCURRENT_ICE_JOBS=5            # Parallel processing
```

### Fail-Safes

1. **Emergency Stop** (`EMERGENCY_STOP=true`): Disables all AI generation
2. **Individual Stops**: `STOP_IMAGE_GENERATION`, `STOP_VIDEO_GENERATION`, `STOP_AI_CHAT`
3. **Rate Limiting**: Per-IP and per-user limits on expensive endpoints
4. **Storage Quota Check**: `POST /api/me/storage/check` before uploads
5. **Entitlement Checks**: Every generation endpoint checks user tier

---

## Operational Metrics to Track

### Health Metrics
- ICE build success rate (target: >99%)
- Average build time (target: <30s for parsing)
- API response time p95 (target: <500ms)
- Error rate by endpoint

### Cost Metrics
- Images generated per day
- Videos generated per day
- TTS minutes generated per day
- Storage growth rate (GB/week)
- Cost per ICE (aggregate)

### Business Metrics
- ICEs created per user
- Conversion rate (guest -> registered)
- Upgrade rate (free -> paid)
- Churn rate by tier

### Storage Health
- Orphaned files (no ICE reference)
- Draft files pending cleanup
- Storage reconciliation job status

---

## Risk List

### Biggest Ways to Accidentally Lose Money

1. **Unbounded video generation**
   - Risk: User triggers many video generations
   - Current guardrail: 5-second max, daily limits
   - Missing: Per-ICE video count limit

2. **Image generation abuse**
   - Risk: Repeated regeneration of same card
   - Current guardrail: Daily limits
   - Suggestion: Add per-card cooldown

3. **Chat abuse**
   - Risk: Long conversations burning tokens
   - Current guardrail: Message limits, conversation limits
   - Working as intended

4. **Storage bloat**
   - Risk: Orphaned uploads accumulating
   - Current guardrail: Orphan cleanup job
   - Location: `server/jobs/orphanCleanup.ts`

5. **Free tier abuse**
   - Risk: Many accounts to bypass limits
   - Current guardrail: IP rate limiting
   - Suggestion: Device fingerprinting (future)

### Code-Level Guardrails That Should Exist

1. **Per-ICE generation budget**: Track total cost per ICE
2. **Real-time cost dashboard**: Admin view of daily spend
3. **Automatic pause at threshold**: Stop generation if daily cost exceeds $X
4. **Usage anomaly detection**: Alert on unusual patterns

### Current Guardrail Implementation

File: `server/entitlements.ts`
```typescript
// Checks performed before generation:
// 1. User authenticated
// 2. User has sufficient tier
// 3. Daily limit not exceeded
// 4. Storage quota not exceeded (for uploads)
```

File: `server/rateLimit.ts`
```typescript
// Rate limits:
// - Analytics: 100 req/min per IP
// - Activation: 10 req/min per IP
// - Chat: 20 req/min per IP
```

---

## Cost Audit Logging

Enable with `COST_AUDIT_LOGGING=true`

Logs to console:
```
[COST] Image generation: user=123, ice=abc, model=dall-e-3, est_cost=$0.04
[COST] Video generation: user=123, ice=abc, duration=5s, est_cost=$0.35
[COST] TTS generation: user=123, ice=abc, chars=500, est_cost=$0.0075
```

Database tracking:
- Table: `ai_usage_events`
- Fields: `profileId`, `iceId`, `usageType`, `creditsUsed`, `model`, `metadata`
