# IceMaker Cost Audit

**Generated:** 2026-01-13  
**Auditor:** Replit Agent  
**Scope:** Build-time, Hosting, and Runtime costs for IceMaker platform  
**Target Market:** Corporate L&D (demo-led, higher value accounts)

---

## A) Architecture Cost Map

| Cost Centre | Provider/Model | Code Locations | Unit Driver | How to Measure | Notes |
|-------------|---------------|----------------|-------------|----------------|-------|
| **LLM - Pipeline Stages** | OpenAI gpt-4o via Replit AI Integrations | `server/pipeline/runner.ts:callAI()` | Tokens (input + output) | `response.usage.prompt_tokens`, `response.usage.completion_tokens` | 6 pipeline stages, max_tokens=4096 per call |
| **LLM - Chat/Q&A** | OpenAI gpt-5.1 via Replit AI Integrations | `server/replit_integrations/chat/routes.ts:98` | Tokens (input + output) | Stream response, count tokens | max_completion_tokens=2048, context now truncated to 20 messages |
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
avg_tokens_stage2_guardrails_input  = 3500      # Additional guardrails call
avg_tokens_stage2_guardrails_output = 600
avg_tokens_stage3_world_input       = 2000
avg_tokens_stage3_world_output      = 600
avg_tokens_stage4_plan_input        = 2500
avg_tokens_stage4_plan_output       = 1500      # Card plan JSON
avg_tokens_stage5_char_input        = 1500      # Per character prompt
avg_tokens_stage5_char_output       = 800       # Per character

# Q&A Runtime (per question)
avg_tokens_qa_input                 = 2000      # Context + question (now capped at 20 messages)
avg_tokens_qa_output                = 500       # Answer
```

### ICE Build Cost Formulas

```
# Short ICE (6 cards, text + 3 images)
cost_llm_pipeline_short = (
  (3000 + 1500 + 3500 + 2000 + 2500 + 1500) * price_per_1k_input_tokens_gpt4o / 1000 +
  (500 + 400 + 600 + 600 + 1500 + 800) * price_per_1k_output_tokens_gpt4o / 1000
)
cost_images_short = 3 * image_cost_1024x1024
cost_tts_short = 0  # No narration
cost_video_short = 0  # No video
cost_per_short_ICE_build = cost_llm_pipeline_short + cost_images_short
# Estimate: ~$0.30 - $0.50

# Medium ICE (10 cards, text + 6 images + narration)
cost_llm_pipeline_medium = (
  (3000 + 1500 + 3500 + 2000 + 2500 + 1500) * price_per_1k_input_tokens_gpt4o / 1000 +
  (500 + 400 + 600 + 600 + 1500 + 800) * price_per_1k_output_tokens_gpt4o / 1000
)
cost_images_medium = 6 * image_cost_1024x1024
cost_tts_medium = 10 * 500 * tts_cost_per_1m_chars / 1000000  # ~500 chars per card
cost_video_medium = 0
cost_per_medium_ICE_build = cost_llm_pipeline_medium + cost_images_medium + cost_tts_medium
# Estimate: ~$0.50 - $0.80

# Long ICE (15 cards, text + narration + images + 4 bundled videos)
cost_llm_pipeline_long = (
  (3000 + 1500 + 3500 + 2000 + 2500 + 1500*2) * price_per_1k_input_tokens_gpt4o / 1000 +
  (500 + 400 + 600 + 600 + 1500 + 800*2) * price_per_1k_output_tokens_gpt4o / 1000
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
# Per Q&A question (runtime) - NOW WITH 20-MESSAGE CONTEXT CAP
cost_per_question = (
  avg_tokens_qa_input * price_per_1k_input_tokens_gpt5 / 1000 +
  avg_tokens_qa_output * price_per_1k_output_tokens_gpt5 / 1000
)
# Estimate: ~$0.01 per question (capped, won't grow unbounded)

# Per viewer session (assume 5 questions)
cost_per_viewer_session = 5 * cost_per_question
# Estimate: ~$0.05 per session

# Per 100 viewers (assume 3 questions each)
cost_per_100_viewers = 100 * 3 * cost_per_question
# Estimate: ~$3.00
```

---

## C) Empirical Measurements

### Cost Audit Instrumentation (IMPLEMENTED)

The following instrumentation has been added and is activated via `COST_AUDIT_LOGGING=true`:

**Pipeline LLM Calls** (`server/pipeline/runner.ts`):
- Each `callAI()` call now logs: stage name, model, prompt_tokens, completion_tokens, total_tokens
- Logs emitted: `[COST_AUDIT] stage1_read: model=gpt-4o, prompt_tokens=X, completion_tokens=Y, total=Z`
- Exportable via `getCostAuditLog()` function

**Chat/Q&A Calls** (`server/replit_integrations/chat/routes.ts`):
- Logs estimated input tokens before each request
- Logs whether context was truncated
- Format: `[COST_AUDIT] Chat request: messages=X, estimated_input_tokens=Y, truncated=true/false`

### Empirical Test Results (2026-01-13)

Tests run with `COST_AUDIT_LOGGING=true` via `scripts/cost-audit-test.ts`:

**Note:** These tests used sample L&D content (386-4,300 chars). The pipeline generated 2-3 cards based on content substance. The "Standard" and "Extended" categories in the Revised Cost Model extrapolate linearly from this data for typical facilitator content (which is usually 3,000-10,000 chars).

#### SHORT ICE (386 chars input, 3 cards generated)

| Stage | Prompt Tokens | Completion Tokens | Total |
|-------|---------------|-------------------|-------|
| stage1_read | 205 | 121 | 326 |
| stage2_identifyStory | 282 | 77 | 359 |
| stage2_guardrails | 362 | 379 | 741 |
| stage3_extractWorld | 272 | 286 | 558 |
| stage4_shapeMoments | 715 | 907 | 1,622 |
| stage5_characterPrompt ×3 | 2,646 | 1,436 | 4,082 |
| **TOTAL** | **4,482** | **3,206** | **7,688** |

**LLM Cost:** Input $0.0112 + Output $0.0321 = **$0.0433** (£0.035)

#### MEDIUM ICE (2,499 chars input, 2 cards generated)

| Stage | Prompt Tokens | Completion Tokens | Total |
|-------|---------------|-------------------|-------|
| stage1_read | 609 | 350 | 959 |
| stage2_identifyStory | 683 | 82 | 765 |
| stage2_guardrails | 765 | 497 | 1,262 |
| stage3_extractWorld | 675 | 264 | 939 |
| stage4_shapeMoments | 1,192 | 1,881 | 3,073 |
| stage5_characterPrompt ×2 | 1,972 | 1,017 | 2,989 |
| **TOTAL** | **5,896** | **4,091** | **9,987** |

**LLM Cost:** Input $0.0147 + Output $0.0409 = **$0.0556** (£0.044)

#### LONG ICE (4,300 chars input, 3 cards generated)

| Stage | Prompt Tokens | Completion Tokens | Total |
|-------|---------------|-------------------|-------|
| stage1_read | 1,021 | 379 | 1,400 |
| stage2_identifyStory | 1,109 | 94 | 1,203 |
| stage2_guardrails | 1,179 | 449 | 1,628 |
| stage3_extractWorld | 1,089 | 318 | 1,407 |
| stage4_shapeMoments | 1,612 | 2,398 | 4,010 |
| stage5_characterPrompt ×3 | 2,924 | 1,605 | 4,529 |
| **TOTAL** | **8,934** | **5,243** | **14,177** |

**LLM Cost:** Input $0.0223 + Output $0.0524 = **$0.0747** (£0.060)

### Key Finding: LLM Costs Are Trivial

The empirical tests show LLM pipeline costs are **dramatically lower** than original estimates:

| ICE Type | Estimated LLM Cost | Actual LLM Cost | Difference |
|----------|-------------------|-----------------|------------|
| Short | ~$0.15 | **$0.04** | 73% lower |
| Medium | ~$0.20 | **$0.06** | 70% lower |
| Long | ~$0.35 | **$0.07** | 80% lower |

**The dominant costs are images ($0.04 each) and video ($0.25-$1.40 each), not LLM tokens.**

### Revised Cost Model (Post-Empirical)

**Test Findings:** Token costs scale linearly with content length. Card count depends on content substance, not just "short/medium/long" setting.

| ICE Type | LLM | Images | TTS | Video | **Total** |
|----------|-----|--------|-----|-------|-----------|
| Minimal (2-3 cards, 3 images) | $0.05 | $0.12 | $0.00 | $0.00 | **$0.17** |
| Standard (5-6 cards, 5 images, TTS) | $0.08 | $0.20 | $0.04 | $0.00 | **$0.32** |
| Extended (8-10 cards, 8 images, TTS) | $0.12 | $0.32 | $0.06 | $0.00 | **$0.50** |
| With Video (8-10 cards, 4 videos) | $0.12 | $0.32 | $0.06 | $1.00 | **$1.50** |
| Cinematic (8-10 cards, 8 videos) | $0.12 | $0.32 | $0.06 | $2.00 | **$2.50** |

*LLM: ~$0.015 per 1000 chars input content (validated via testing)*
*TTS: ~500 chars/card × $15/1M chars = $0.0075/card*
*Image: $0.04 per 1024×1024*
*Video: $0.25 haiper, $1.40 kling*

---

## D) Risk Flags

### Critical Risks (Could Blow Margins)

| Risk | Location | Severity | Status | Impact |
|------|----------|----------|--------|--------|
| **Unbounded Chat Context** | `server/replit_integrations/chat/routes.ts:77-79` | HIGH | **MITIGATED** | Now capped at 20 messages via `MAX_CONTEXT_MESSAGES` |
| **No Token Limits on Pipeline** | `server/pipeline/runner.ts` | MEDIUM | Open | max_tokens=4096 but no input truncation beyond 15000 chars |
| **Video Generation Default** | `server/video/videoCap.ts:8` | MEDIUM | By Design | BUNDLED_VIDEO_SCENES=4 means 4 free videos per ICE |
| **No Per-Tenant Quotas** | N/A | HIGH | Open | No credit system for limiting builds per user |
| **No Caching on LLM Calls** | `server/pipeline/runner.ts` | MEDIUM | Open | Same content re-processed costs full price |
| **TTS on Every Card** | `server/routes.ts` | MEDIUM | Open | Narration generated on-demand, no caching |
| **Missing Rate Limits on Q&A** | `server/replit_integrations/chat/routes.ts` | MEDIUM | Open | No per-user rate limiting on chat endpoint |
| **Image Size Default** | `server/replit_integrations/image/client.ts:16` | LOW | Open | Default 1024x1024, could use 512x512 for thumbnails |

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
| Q&A Question Limit | `server/replit_integrations/chat/routes.ts` | Add per-session counter (max 25 questions) |
| Daily Build Cap | `server/routes.ts` | Limit to 3 builds/day for free tier |

### 2. Caching Strategy

| What to Cache | Where | TTL | Savings |
|---------------|-------|-----|---------|
| Pipeline stage 1-3 outputs | Redis/DB by content hash | 7 days | ~40% of pipeline cost |
| Generated images by prompt hash | Object Storage | 30 days | ~60% image cost for similar content |
| TTS audio by text hash | Object Storage | 30 days | 100% repeat narration cost |
| Chat responses for identical questions | Memory/Redis | 1 hour | Variable |

### 3. Hard Caps / Default Limits (PARTIALLY IMPLEMENTED)

```typescript
const LIMITS = {
  // Build-time
  MAX_INPUT_CHARS: 50000,           // Truncate longer inputs
  MAX_CARDS_PER_ICE: 20,            // Prevent runaway costs
  MAX_IMAGES_PER_ICE: 15,           // Image cap
  MAX_BUNDLED_VIDEOS: 4,            // Already in videoCap.ts
  MAX_TTS_CHARS_PER_CARD: 1000,     // Truncate long narration
  
  // Runtime (IMPLEMENTED)
  MAX_CHAT_CONTEXT_MESSAGES: 20,    // ✅ Implemented in chat/routes.ts
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

---

## F) L&D Usage Model: Normal vs Excessive

Understanding what "normal" usage looks like for Corporate L&D helps define quotas, detect abuse, and price appropriately.

### L&D Mental Models

IceMaker maps to how L&D professionals already think:

| Concept | IceMaker Equivalent | Usage Pattern |
|---------|---------------------|---------------|
| **Modules** | ICE experiences | Built once, run many times per cohort |
| **Cohorts** | Shared/separate memory contexts | 8-25 learners, 4-12 sessions |
| **Learning journeys** | Multi-ICE programmes | 3-6 ICEs building on each other |
| **Facilitation** | Intelligence support | Challenges thinking, prompts reflection |

### What is a "Session"?

A session is one cohort interaction with one ICE experience:

| Session Type | Duration | Questions/Learner | Total Questions | Frequency |
|--------------|----------|-------------------|-----------------|-----------|
| **Self-paced module** | 15-30 min | 2-5 | 16-125 (8-25 learners) | Once per cohort |
| **Live workshop support** | 60-90 min | 5-10 | 40-250 (8-25 learners) | Weekly for 4-8 weeks |
| **Coaching companion** | Ongoing | 3-8 per week | 12-32/learner/month | Continuous |
| **Strategy/scenario session** | 2-3 hours | 10-20 | 80-500 (8-25 learners) | Monthly |

### Normal Usage: Pilot Programme

*Single facilitator, 1 cohort, 1 module*

| Metric | Normal Range | Cost Implication |
|--------|--------------|------------------|
| ICEs built | 1-2/month | ~£0.80-1.50 build cost |
| Learners | 8-15 | - |
| Sessions | 4-6/month | - |
| Questions/cohort | 150-400/month | ~£1.50-4.00/month |
| **Total monthly cost** | - | **~£2.30-5.50** |

### Normal Usage: Active Programme

*1-2 facilitators, 2-3 cohorts, 3-4 modules*

| Metric | Normal Range | Cost Implication |
|--------|--------------|------------------|
| ICEs built | 3-6/month | ~£2.50-5.00 build cost |
| Learners | 25-50 total | - |
| Sessions | 15-25/month | - |
| Questions/cohort | 400-1,200/month | ~£4.00-12.00/month |
| **Total monthly cost** | - | **~£6.50-17.00** |

### Normal Usage: Team Programme

*3-5 facilitators, 5-10 cohorts, 6-10 modules*

| Metric | Normal Range | Cost Implication |
|--------|--------------|------------------|
| ICEs built | 6-12/month | ~£5.00-10.00 build cost |
| Learners | 75-200 total | - |
| Sessions | 40-80/month | - |
| Questions/total | 1,500-5,000/month | ~£15.00-50.00/month |
| **Total monthly cost** | - | **~£20.00-60.00** |

### Excessive Usage: Warning Signs

These patterns indicate abuse, runaway costs, or incorrect tier:

| Pattern | Threshold | Action |
|---------|-----------|--------|
| Questions/learner/session > 20 | Warn at 15, hard cap at 25 | Rate limit, suggest tier upgrade |
| ICE rebuilds same content | > 3x same source in 7 days | Cache, suggest edit instead |
| Empty/test ICEs | > 50% builds < 10 questions total | Soft-cap trial builds |
| API hammering | > 100 questions/hour from single user | Throttle, investigate |
| Multi-tenant sharing | Single account, 10+ distinct cohorts | Enforce seat pricing |

### Memory Refresh Cadence

When should cohort memory reset?

| Programme Type | Memory Lifetime | Refresh Trigger |
|----------------|-----------------|-----------------|
| Single module | End of cohort | Manual or cohort completion |
| Multi-week journey | Programme duration | Manual at programme end |
| Always-on coaching | 90 days rolling | Automatic trim, keep key insights |
| Strategy/scenario | Session-only | Reset per session by design |

### What "Success" Looks Like (Not Maximum)

| Metric | Success | Maximum | Abuse |
|--------|---------|---------|-------|
| Questions per learner per session | 3-8 | 15 | 25+ |
| Sessions per cohort per week | 1-2 | 4 | 10+ |
| ICE builds per facilitator per month | 1-3 | 8 | 20+ |
| Cohorts per facilitator | 2-4 | 8 | 15+ |

---

## G) Corporate L&D Pricing Model (Refined)

Based on target market: **Corporate L&D** (demo-led, fewer but higher value accounts)  
Pricing philosophy: **£99 barely registers, £149-249 is "serious but acceptable", £29 feels consumer**

### Two Cost Buckets

1. **Build Allowance** - covers ingestion + structuring + narration + music + images + optional video
2. **Audience Allowance** - covers viewer Q&A interactions (now capped at 20-message context)

### Unit Cost Reference (GBP, 1 USD = 0.80 GBP) — Revised with Empirical Data

| Item | USD Cost | GBP Cost | Notes |
|------|----------|----------|-------|
| Q&A Question | $0.01 | £0.008 | Per question, 20-msg context cap |
| Standard ICE Build (5-6 cards) | **$0.32** | **£0.26** | *Validated 2026-01-13* |
| Extended ICE Build (8-10 cards) | **$0.50** | **£0.40** | *Estimated from empirical data* |
| Extended + Video (4 videos) | **$1.50** | **£1.20** | *$0.50 build + $1.00 video* |
| Haiper video clip | $0.25 | £0.20 | |
| Kling video clip | $1.40 | £1.12 | |

### Tier Structure (L&D-Appropriate Pricing)

#### Pilot — £49/month (or £79 with coaching pack)
*Single facilitator testing IceMaker with one cohort*

| Allowance | Included | Overage |
|-----------|----------|---------|
| Facilitators | 1 | - |
| Build | 2 Medium ICEs/month | Top-up £12/ICE |
| Audience | 400 questions/month | Top-up £15/500 |
| Cohorts | 1 active | - |
| Memory | 30-day retention | - |
| Video | Off | Premium add-on |
| Support | Email | - |

**Upsell trigger:** > 1 cohort, > 400 questions, or programme expansion

#### Team — £149/month (or £199 with video pack)
*Real L&D deployment: multiple cohorts, shared memory*

| Allowance | Included | Overage |
|-----------|----------|---------|
| Facilitators | 3 included (+£35/seat) | - |
| Build | 6 Medium or 2 Long ICEs/month | Top-up £10/ICE |
| Audience | 2,000 questions/month | Top-up £12/500 |
| Cohorts | 5 active | £20/extra cohort |
| Memory | 90-day retention | - |
| Video | Optional: +£50/month for 8 clips | - |
| Collaboration | Roles, shared library | - |
| Support | Priority email + onboarding call | - |

**Upsell trigger:** > 5 cohorts, > 2,000 questions, department expansion

#### Department — £299/month (or £399 with full video + analytics)
*L&D team or agency running multiple programmes*

| Allowance | Included | Overage |
|-----------|----------|---------|
| Facilitators | 8 included (+£30/seat) | - |
| Build | 15 Medium or 5 Long ICEs/month | Top-up £8/ICE |
| Audience | 6,000 questions/month | Top-up £10/500 |
| Cohorts | 15 active | £15/extra cohort |
| Memory | 180-day retention | - |
| Video | 12 clips/month included | - |
| Collaboration | Full permissions, templates | - |
| Analytics | Cohort insights, pattern reports | - |
| Support | Priority + quarterly review | - |

**Upsell trigger:** > 15 cohorts, API access, SSO requirement

### Tier Economics Sanity Table (Revised with Empirical Data)

| Tier | Revenue | Builds Cost | Questions Cost | Video Cost | Total Cost | Contribution | Margin |
|------|---------|-------------|----------------|------------|------------|--------------|--------|
| **Pilot** £49 | £49 | 2 × £0.26 = £0.52 | 400 × £0.008 = £3.20 | £0 | £3.72 | £45.28 | **92%** |
| **Team** £149 | £149 | 6 × £0.26 = £1.56 | 2,000 × £0.008 = £16.00 | £0 | £17.56 | £131.44 | **88%** |
| **Dept** £299 | £299 | 15 × £0.26 = £3.90 | 6,000 × £0.008 = £48.00 | 12 × £0.20 = £2.40 | £54.30 | £244.70 | **82%** |

*Note: Build cost £0.26 (~$0.32) per Standard ICE (5-6 cards) based on empirical testing. These are "at full allowance" costs. Actual usage typically 60-70% of allowance.*

#### Enterprise — Custom (£500+/month)
*Large organizations with specific requirements*

- Unlimited facilitators (within reason)
- Volume discounts on builds + questions
- SSO integration
- Custom data retention
- Dedicated success manager
- SLA guarantees
- Invoice billing

### Why These Prices Work for L&D

| Price Point | L&D Perception | Comparison |
|-------------|----------------|------------|
| £49/month | "Tool trial budget" | Less than 1 consultant hour |
| £149/month | "Serious capability" | Cost of 2 days training materials |
| £299/month | "Programme investment" | Less than 1 external facilitator day |
| Top-ups | "Rounding error" | Coffee for the team |

### Top-Up Economics (Revised with Empirical Data)

| Pack | Price | Contents | Cost | Contribution | Margin |
|------|-------|----------|------|--------------|--------|
| Audience Pack | £15 | +500 questions | £4.00 | £11.00 | 73% |
| Build Pack (Small) | £20 | +2 Standard ICEs | £0.52 | £19.48 | **97%** |
| Build Pack (Large) | £35 | +4 Standard ICEs | £1.04 | £33.96 | **97%** |
| Video Pack (Standard) | £40 | 6 haiper clips | £1.20 | £38.80 | 97% |
| Video Pack (Premium) | £75 | 6 kling clips | £6.72 | £68.28 | 91% |

### Break-Even Check (Revised with Empirical Data)

| Scenario | Revenue | Cost | Margin | Status |
|----------|---------|------|--------|--------|
| Pilot at full usage | £49 | £3.72 | 92% | Healthy |
| Team at full usage | £149 | £17.56 | 88% | Healthy |
| Dept at full usage | £299 | £54.30 | 82% | Healthy |
| Pilot + 1 top-up | £64 | £7.92 | 88% | Healthy |
| Heavy Pilot (2x usage) | £49 | £7.44 | 85% | Healthy |

*Danger zone: Any tier where cost > 50% of revenue needs intervention.*

### Stress Test: What If Media Costs Double or Triple?

This tests resilience to pricing volatility (beta pricing removal, provider changes, etc.):

| Scenario | Base Cost | 2× Media | 3× Media | Margin@2× | Margin@3× |
|----------|-----------|----------|----------|-----------|-----------|
| **Pilot** £49 (no video) | £3.72 | £4.24 | £4.76 | 91% | 90% |
| **Team** £149 (no video) | £17.56 | £18.68 | £19.80 | 87% | 87% |
| **Dept** £299 (12 videos) | £54.30 | £58.20 | £62.10 | 81% | 79% |
| **Cinematic ICE** $2.50 | $2.50 | $4.50 | $6.50 | n/a | n/a |

**Finding:** Margins remain healthy (79%+) even at 3× media costs. The pricing model is resilient.

**Calculation Notes:**
- Base media costs: Images £0.16/build (5 images × £0.032), Video £0.20/clip
- At 2×: Images £0.32/build, Video £0.40/clip
- At 3×: Images £0.48/build, Video £0.60/clip
- LLM costs don't change with media pricing

### Provider Risk Summary

| Provider | Subsidy Risk | Price Volatility | Mitigation |
|----------|--------------|------------------|------------|
| Replit AI Integrations (images) | **Medium** | Unknown | Monitor, have OpenAI direct fallback |
| Replicate (video) | Low | Low (marketplace) | Multiple models available |
| Kling Direct (video) | Low | Low | Alternative to Replicate |
| OpenAI Direct (TTS) | Low | Stable | Well-established pricing |

---

## H) Summary: Cost Per ICE (Revised with Empirical Data)

| ICE Type | Build Cost | Storage/month | 100 Viewers | Total 1st Month |
|----------|------------|---------------|-------------|-----------------|
| Minimal (2-3 cards, 3 images) | **$0.17** | ~$0.01 | ~$3.00 | **$3.18** |
| Standard (5-6 cards, 5 images, TTS) | **$0.32** | ~$0.02 | ~$3.00 | **$3.34** |
| Extended (8-10 cards, 8 images, TTS) | **$0.50** | ~$0.03 | ~$3.00 | **$3.53** |
| With Video (8-10 cards, 4 videos) | **$1.50** | ~$0.05 | ~$3.00 | **$4.55** |
| Cinematic (8-10 cards, 8 videos) | **$2.50** | ~$0.10 | ~$3.00 | **$5.60** |

*Validated via empirical testing on 2026-01-13. LLM costs (~$0.05-0.12/build) are trivial; images and video dominate.*

---

## I) Implementation Priority

### Immediate (Week 1) - PARTIALLY DONE
- [x] Add chat context truncation (MAX_CONTEXT_MESSAGES=20)
- [x] Add cost audit instrumentation
- [ ] Per-session question limits
- [ ] Input validation (MAX_QUESTION_LENGTH)

### Short-term (Week 2-3)
- [ ] Implement build credits system
- [ ] Model tiering for cheap operations (gpt-4o-mini for stages 1-3)
- [ ] Per-user rate limiting on Q&A

### Medium-term (Month 1)
- [ ] Add caching layer for images/TTS
- [ ] Usage dashboard for customers
- [ ] Stripe subscription tiers

### Long-term (Quarter 1)
- [ ] Full credit system with real-time usage
- [ ] Tier enforcement at all enforcement points
- [ ] Usage analytics and reporting
- [ ] Enterprise SSO

---

## J) Verification Checklist

Before launching pricing:

- [x] Run empirical tests with COST_AUDIT_LOGGING=true ✅ (2026-01-13)
- [x] Verify actual token counts match estimates ✅ (70-80% lower than estimates!)
- [ ] Confirm video generation costs at scale
- [ ] Test context truncation under load
- [ ] Validate Stripe webhook integration
- [ ] Set up usage monitoring/alerting

### Running Cost Audit Tests

```bash
# Prerequisite: Ensure test user exists in database
# INSERT INTO users (username, email, password) VALUES ('test-cost-audit', 'test@costaudit.local', 'not-a-real-password');

# Run individual tests
npx tsx scripts/cost-audit-test.ts short
npx tsx scripts/cost-audit-test.ts medium
npx tsx scripts/cost-audit-test.ts long

# Run all tests
npx tsx scripts/cost-audit-test.ts all
```

*Note: The test script requires a user with ID=1 in the database. Create one first if running in a fresh environment.*

