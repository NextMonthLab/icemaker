# IceMaker Storage & AI Fair Use Doctrine

**Version 1.0 | January 2026**

This document defines the non-negotiable rules for IceMaker's storage and AI usage systems.

---

## 1. Core Principles

### Storage is Priced, AI is Metered

- **Storage** = Permanence. Users pay for the space their content occupies.
- **AI** = Compute. Users pay for what they generate, not unlimited access.
- **BYO Media** = First-class. Users can build entire ICEs without AI generation.

### IceMaker is NOT an "AI-generation liability machine"

Most AI products fail because:
- Storage is free
- AI is unlimited
- Heavy users quietly destroy margins

IceMaker avoids this by:
- Pricing permanence (storage tiers)
- Charging for compute (AI credits)
- Rewarding intentional usage

---

## 2. Storage Rules

### Architecture
- **Object Storage**: Cloudflare R2 (zero egress, predictable costs)
- **Database**: Metadata only (file references, not binaries)
- **Uploads**: Pre-signed URLs, client-to-storage direct
- **Buckets**: Private by default, signed URL delivery

### Quota Enforcement
- Each creator profile has `usedStorageBytes` and `storageLimitBytes`
- Uploads are blocked when quota is exceeded
- Storage is recalculated when files are deleted

### Cleanup Jobs
- **Orphan Cleanup**: Draft uploads not finalized within 24h are deleted
- **Storage Reconciliation**: Nightly job to verify `usedStorageBytes` matches reality

---

## 3. AI Usage Rules

### Billing Model
- AI generation is **pay-as-you-go** by default
- Credits can be purchased or earned
- Each generation event is logged with cost

### Usage Tracking
- All AI operations create an `ai_usage_event` record
- Events track: profileId, iceId, usageType, creditsUsed, model
- Per-ICE cost visibility enabled

### Credit Types
- **Video Credits**: Video generation (most expensive)
- **Voice Credits**: TTS narration
- **Image Credits**: AI image generation (charged per image)
- **Chat Credits**: Interactive character conversations

---

## 4. Tier Limits (January 2026)

| Tier | Monthly | ICEs | Storage | AI Model |
|------|---------|------|---------|----------|
| Starter | £19.99 | 5 | 5GB | BYO only |
| Creator | £39.99 | 15 | 25GB | Pay-as-you-go |
| Studio | £99.99 | 50 | 100GB | Pay-as-you-go |
| Enterprise | Custom | Custom | 500GB+ | Custom |

### Storage Add-ons
- +50GB → £10/month
- +100GB → £18/month
- +500GB → £60/month

---

## 5. Non-Negotiable Rules

1. **Never store media in the database** - Object storage only
2. **Never allow unlimited AI generation** - Always metered
3. **Never proxy large uploads through the server** - Pre-signed URLs only
4. **Never skip quota checks** - Enforce before every upload
5. **Never bundle AI credits with base plan** - Keep costs visible and separate

---

## 6. Future Considerations

- Video transcoding pipeline (720p web-optimized variants)
- CDN edge caching for frequently accessed media
- Tiered storage (hot/cold) for archived ICEs
- AI cost estimation before generation

---

*This doctrine prevents future you (or future collaborators) from "just adding unlimited X".*
