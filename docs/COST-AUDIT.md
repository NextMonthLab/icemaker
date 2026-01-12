# IceMaker Cost Audit

**Generated:** 2026-01-12  
**Auditor:** Replit Agent  
**Scope:** Build-time, Hosting, and Runtime costs for IceMaker platform

---

## A) Architecture Cost Map

| Cost Centre | Provider/Model | Code Locations | Unit Driver | How to Measure | Notes |
|-------------|---------------|----------------|-------------|----------------|-------|
| **LLM - Pipeline Stages** | OpenAI gpt-4o via Replit AI Integrations | `server/pipeline/runner.ts:callAI()` | Tokens (input + output) | `response.usage.prompt_tokens`, `response.usage.completion_tokens` | 6 pipeline stages, max_tokens=4096 per call |
| **LLM - Chat/Q&A** | OpenAI gpt-5.1 via Replit AI Integrations | `server/replit_integrations/chat/routes.ts:84` | Tokens (input + output) | Stream response, count tokens | max_completion_tokens=2048, context grows with history |
| **TTS - Narration** | OpenAI tts-1 (direct API) | `server/tts/openaiProvider.ts:synthesiseSpeech()` | Characters of text | Input text length | Requires OPENAI_API_KEY (not AI_INTEGRATIONS) |
| **Image Generation** | OpenAI gpt-image-1 via Replit AI Integrations | `server/replit_integrations/image/client.ts:generateImageBuffer()` | Images generated | Count of API calls | Sizes: 1024x1024, 512x512, 256x256 |
| **Video - Kling** | Kling AI (direct API) | `server/video/kling.ts` | Videos x duration | Task completions | Models: v1-5, v1-6, v2-0; Duration: 5s or 10s |
| **Video - Replicate** | Replicate (various models) | `server/video/replicate.ts` | Videos x duration | Prediction completions | haiper ($0.25/5s), minimax ($1.00/5s), kling ($1.40/5s) |
| **Video Export** | FFmpeg (compute) | `server/video/exportService.ts` | Export duration | Processing time | Local compute, no direct API cost |
| **Object Storage** | Cloudflare R2 via Replit | `server/storage/objectStore.ts` | GB stored + GB egress | S3 API calls, file sizes | Env: R2_ENDPOINT, R2_BUCKET |
| **Database** | Neon PostgreSQL via Replit | `server/storage.ts`, Drizzle ORM | Rows, queries | Query counts | Included in Replit plan |
| **Email** | Resend via Replit Connector | `server/services/email/emailClient.ts` | Emails sent | API calls | Transactional emails only |
| **Payments** | Stripe via Replit Connector | `server/stripeClient.ts` | Transactions | Webhook events | 2.9% + $0.30 per transaction |

---

## B) Unit Cost Model (Spreadsheet-Ready)

### Price Variables (populate from vendor pricing)

```
# OpenAI Pricing (via Replit AI Integrations - may be subsidized)
price_per_1k_input_tokens_gpt4o     = $0.0025   # GPT-4o input
price_per_1k_output_tokens_gpt4o    = $0.010    # GPT-4o output
price_per_1k_input_tokens_gpt5      = $0.003    # GPT-5.1 input (estimate)
price_per_1k_output_tokens_gpt5     = $0.015    # GPT-5.1 output (estimate)

# OpenAI TTS (direct API - OPENAI_API_KEY)
tts_cost_per_1m_chars               = $15.00    # tts-1 model

# OpenAI Image (via Replit AI Integrations)
image_cost_1024x1024                = $0.04     # gpt-image-1 (estimate)
image_cost_512x512                  = $0.018    # gpt-image-1 (estimate)

# Video Generation (Replicate)
video_cost_haiper_5s                = $0.25     # haiper-video-2
video_cost_minimax_5s               = $1.00     # minimax-video
video_cost_kling_standard_5s        = $1.40     # kling-v1.6-standard
video_cost_kling_pro_5s             = $2.00     # kling-v1.6-pro

# Storage (Cloudflare R2)
storage_cost_per_gb_month           = $0.015    # R2 storage
bandwidth_cost_per_gb_egress        = $0.00     # R2 free egress (first 10GB/month)

# Email (Resend)
email_cost_per_1k                   = $0.00     # Free tier: 3000/month
```

### Estimated Token Usage Per Stage

```
# Pipeline Stages (build-time)
avg_tokens_stage0_normalize         = 0         # No LLM call
avg_tokens_stage1_read_input        = 3000      # ~15000 chars / 5 = 3000 tokens
avg_tokens_stage1_read_output       = 500
avg_tokens_stage2_theme_input       = 1500
avg_tokens_stage2_theme_output      = 400
avg_tokens_stage3_world_input       = 2000
avg_tokens_stage3_world_output      = 600
avg_tokens_stage4_plan_input        = 2500
avg_tokens_stage4_plan_output       = 1500      # Card plan JSON
avg_tokens_stage5_draft_input       = 3000      # Per card
avg_tokens_stage5_draft_output      = 800       # Per card

# Q&A Runtime (per question)
avg_tokens_qa_input                 = 2000      # Context + question
avg_tokens_qa_output                = 500       # Answer
```

### ICE Build Cost Formulas

```
# Short ICE (6 cards, text + 3 images)
cost_llm_pipeline_short = (
  (3000 + 1500 + 2000 + 2500 + 3000*6) * price_per_1k_input_tokens_gpt4o / 1000 +
  (500 + 400 + 600 + 1500 + 800*6) * price_per_1k_output_tokens_gpt4o / 1000
)
cost_images_short = 3 * image_cost_1024x1024
cost_tts_short = 0  # No narration
cost_video_short = 0  # No video
cost_per_short_ICE_build = cost_llm_pipeline_short + cost_images_short
# Estimate: ~$0.30 - $0.50

# Medium ICE (10 cards, text + 6 images + narration)
cost_llm_pipeline_medium = (
  (3000 + 1500 + 2000 + 2500 + 3000*10) * price_per_1k_input_tokens_gpt4o / 1000 +
  (500 + 400 + 600 + 1500 + 800*10) * price_per_1k_output_tokens_gpt4o / 1000
)
cost_images_medium = 6 * image_cost_1024x1024
cost_tts_medium = 10 * 500 * tts_cost_per_1m_chars / 1000000  # ~500 chars per card
cost_video_medium = 0
cost_per_medium_ICE_build = cost_llm_pipeline_medium + cost_images_medium + cost_tts_medium
# Estimate: ~$0.50 - $0.80

# Long ICE (15 cards, text + narration + images + 4 bundled videos)
cost_llm_pipeline_long = (
  (3000 + 1500 + 2000 + 2500 + 3000*15) * price_per_1k_input_tokens_gpt4o / 1000 +
  (500 + 400 + 600 + 1500 + 800*15) * price_per_1k_output_tokens_gpt4o / 1000
)
cost_images_long = 15 * image_cost_1024x1024
cost_tts_long = 15 * 500 * tts_cost_per_1m_chars / 1000000
cost_video_long = 4 * video_cost_haiper_5s  # Bundled = 4 videos max
cost_per_long_ICE_build = cost_llm_pipeline_long + cost_images_long + cost_tts_long + cost_video_long
# Estimate: ~$2.00 - $3.00

# Full Cinematic ICE (15 cards, 12 videos)
cost_full_cinematic = cost_per_long_ICE_build + 8 * video_cost_minimax_5s
# Estimate: ~$10.00 - $12.00
```

### Viewer Runtime Cost Formulas

```
# Per Q&A question (runtime)
cost_per_question = (
  avg_tokens_qa_input * price_per_1k_input_tokens_gpt5 / 1000 +
  avg_tokens_qa_output * price_per_1k_output_tokens_gpt5 / 1000
)
# Estimate: ~$0.01 per question

# Per viewer session (assume 5 questions)
cost_per_viewer_session = 5 * cost_per_question
# Estimate: ~$0.05 per session

# Per 100 viewers (assume 3 questions each)
cost_per_100_viewers = 100 * 3 * cost_per_question
# Estimate: ~$3.00
```

---

## C) Empirical Measurements

### Test Builds Required

To capture accurate measurements, run these test scenarios:

| Test | Cards | Images | Narration | Videos | Expected Cost |
|------|-------|--------|-----------|--------|---------------|
| Short | 6 | 3 | No | 0 | ~$0.30 |
| Medium | 10 | 6 | Yes | 0 | ~$0.60 |
| Long | 15 | 15 | Yes | 4 | ~$2.50 |

### Instrumentation Needed

The following instrumentation should be added to capture real costs:

```typescript
// Add to server/pipeline/runner.ts after each callAI()
if (process.env.COST_AUDIT_LOGGING === 'true') {
  console.log(`[COST_AUDIT] LLM call: model=${response.model}, ` +
    `prompt_tokens=${response.usage?.prompt_tokens}, ` +
    `completion_tokens=${response.usage?.completion_tokens}`);
}

// Add to server/replit_integrations/image/client.ts after generateImageBuffer()
if (process.env.COST_AUDIT_LOGGING === 'true') {
  console.log(`[COST_AUDIT] Image generated: size=${size}`);
}

// Add to server/video/replicate.ts after successful generation
if (process.env.COST_AUDIT_LOGGING === 'true') {
  console.log(`[COST_AUDIT] Video generated: model=${modelKey}, duration=${request.duration}`);
}
```

---

## D) Risk Flags

### Critical Risks (Could Blow Margins)

| Risk | Location | Severity | Impact |
|------|----------|----------|--------|
| **Unbounded Chat Context** | `server/replit_integrations/chat/routes.ts:73` | HIGH | Context grows with every message, no truncation. 100+ messages = 50k+ tokens per request |
| **No Token Limits on Pipeline** | `server/pipeline/runner.ts` | MEDIUM | max_tokens=4096 but no input truncation beyond 15000 chars |
| **Video Generation Default** | `server/video/videoCap.ts:8` | MEDIUM | BUNDLED_VIDEO_SCENES=4 means 4 free videos per ICE |
| **No Per-Tenant Quotas** | N/A | HIGH | No credit system for limiting builds per user |
| **No Caching on LLM Calls** | `server/pipeline/runner.ts` | MEDIUM | Same content re-processed costs full price |
| **TTS on Every Card** | `server/routes.ts` | MEDIUM | Narration generated on-demand, no caching |
| **Missing Rate Limits on Q&A** | `server/replit_integrations/chat/routes.ts` | HIGH | No per-user rate limiting on chat endpoint |
| **Image Size Default** | `server/replit_integrations/image/client.ts:16` | LOW | Default 1024x1024, could use 512x512 for thumbnails |

### Secondary Risks

| Risk | Location | Severity | Impact |
|------|----------|----------|--------|
| No compression on storage | `server/storage/objectStore.ts` | LOW | Larger files = more storage cost |
| Export compute unbounded | `server/video/exportService.ts` | LOW | Long exports block server |
| No cleanup of temp files | `server/video/exportService.ts` | LOW | Disk space accumulation |

---

## E) Recommendations (MVP Guardrails)

### 1. Credit/Usage Enforcement Points

| Enforcement Point | Location | Implementation |
|-------------------|----------|----------------|
| ICE Build Quota | `server/routes.ts` before pipeline start | Check user.credits >= estimated_cost |
| Video Scene Limit | `server/video/videoCap.ts` | Already implemented (4 bundled) |
| Q&A Question Limit | `server/replit_integrations/chat/routes.ts` | Add per-session counter (max 20 questions) |
| Daily Build Cap | `server/routes.ts` | Limit to 3 builds/day for free tier |

### 2. Caching Strategy

| What to Cache | Where | TTL | Savings |
|---------------|-------|-----|---------|
| Pipeline stage 1-3 outputs | Redis/DB by content hash | 7 days | ~40% of pipeline cost |
| Generated images by prompt hash | Object Storage | 30 days | ~60% image cost for similar content |
| TTS audio by text hash | Object Storage | 30 days | 100% repeat narration cost |
| Chat responses for identical questions | Memory/Redis | 1 hour | Variable |

### 3. Hard Caps / Default Limits

```typescript
// Recommended limits
const LIMITS = {
  // Build-time
  MAX_INPUT_CHARS: 50000,           // Truncate longer inputs
  MAX_CARDS_PER_ICE: 20,            // Prevent runaway costs
  MAX_IMAGES_PER_ICE: 15,           // Image cap
  MAX_BUNDLED_VIDEOS: 4,            // Already in videoCap.ts
  MAX_TTS_CHARS_PER_CARD: 1000,     // Truncate long narration
  
  // Runtime
  MAX_CHAT_CONTEXT_MESSAGES: 20,    // Truncate older messages
  MAX_QUESTIONS_PER_SESSION: 25,    // Session limit
  MAX_QUESTION_LENGTH: 500,         // Input validation
  
  // Daily/Monthly
  FREE_TIER_BUILDS_PER_DAY: 3,
  FREE_TIER_QUESTIONS_PER_DAY: 50,
  PAID_TIER_BUILDS_PER_DAY: 20,
};
```

### 4. Model Tiering

| Use Case | Current Model | Recommended | Savings |
|----------|---------------|-------------|---------|
| Pipeline stages 1-3 | gpt-4o | gpt-4o-mini | ~70% |
| Pipeline stages 4-5 | gpt-4o | gpt-4o | Keep for quality |
| Q&A Chat | gpt-5.1 | gpt-4o-mini | ~80% |
| Complex Q&A | gpt-5.1 | gpt-4o | Only for premium |
| Video (bundled) | kling | haiper-video-2 | ~80% |
| Video (premium) | kling | kling-v1.6-standard | Keep |

### 5. Safe Free Tier Limitations

```
FREE TIER LIMITS:
- 3 ICE builds per day
- 6 cards per ICE maximum
- 3 images per ICE (no video)
- No narration (TTS)
- 10 Q&A questions per day
- 7-day preview expiry

GROW TIER ($19/month):
- 10 ICE builds per day
- 12 cards per ICE
- 10 images per ICE
- 4 bundled videos (haiper)
- Narration included
- 100 Q&A questions per day
- 30-day preview expiry

PRO TIER ($49/month):
- Unlimited builds
- 20 cards per ICE
- 20 images per ICE
- 12 videos (choice of model)
- Narration + music
- Unlimited Q&A
- No expiry
```

---

## Summary: Cost Per ICE

| ICE Type | Build Cost | Storage/month | 100 Viewers | Total 1st Month |
|----------|------------|---------------|-------------|-----------------|
| Short (6 cards, 3 images) | ~$0.35 | ~$0.01 | ~$3.00 | ~$3.36 |
| Medium (10 cards, 6 images, TTS) | ~$0.65 | ~$0.02 | ~$3.00 | ~$3.67 |
| Long (15 cards, 15 images, TTS, 4 videos) | ~$2.50 | ~$0.05 | ~$3.00 | ~$5.55 |
| Full Cinematic (15 cards, 12 videos) | ~$11.00 | ~$0.10 | ~$3.00 | ~$14.10 |

**Break-even pricing suggestion:**
- Short ICE: $5/build (43% margin)
- Medium ICE: $8/build (54% margin)
- Long ICE: $15/build (63% margin)
- Full Cinematic: $25-35/build (56-69% margin)

---

## Implementation Priority

1. **Immediate (Week 1):** Add chat context truncation, per-session question limits
2. **Short-term (Week 2-3):** Implement build credits, model tiering for cheap operations
3. **Medium-term (Month 1):** Add caching layer for images/TTS, usage dashboard
4. **Long-term (Quarter 1):** Full credit system, tier enforcement, usage analytics

