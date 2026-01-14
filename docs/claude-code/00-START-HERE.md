# IceMaker - Claude Code Orientation Pack

## What IceMaker Is

IceMaker is a **Meaning-to-Experience Engine** - a SaaS platform that transforms content into Interactive Content Experiences (ICEs). Users upload documents, scripts, or briefs, and IceMaker generates cinematic story cards with AI-generated visuals, TTS narration, and interactive AI character conversations. The platform enables creators to publish shareable ICEs for audience engagement, lead capture, and brand storytelling.

## What IceMaker Is NOT

- Not a video editor or traditional CMS
- Not a chatbot platform (AI characters are bounded, guardrailed assistants within ICEs)
- Not a general-purpose AI tool - it is purpose-built for narrative experiences
- Not ready for unbounded scope expansion - maintain focus on ICE creation and delivery

## Philosophy

1. **Simplicity over features** - Every new feature must justify its existence
2. **Cinematic cards first** - The card-based viewing experience is core to the product
3. **Creativity-first UX** - Make content creation feel effortless and magical
4. **Avoid scope creep** - Say no to features that don't serve the core ICE workflow
5. **Guest-first conversion** - Users experience value before identity or payment
6. **Guardrailed AI** - AI characters follow strict policies; never expose internals

---

## 10 Golden Rules for Changes

1. **DO NOT modify `shared/schema.ts` without explicit user approval** - It is the single source of truth
2. **DO NOT break API contracts** - Frontend depends on exact response shapes
3. **DO NOT expose or log secrets** - Never log API keys, tokens, or credentials
4. **DO NOT change Render environment variable names** - Production depends on exact names
5. **DO NOT remove rate limiting or security middleware** - These protect against abuse
6. **DO NOT bypass entitlement/tier checks** - Respect subscription gating
7. **DO NOT generate videos beyond 5 seconds** - Cost guardrail
8. **DO NOT generate images above 1024x1024** - Cost guardrail (~$0.04/image)
9. **DO NOT rewrite major systems from scratch** - Debug and fix existing code
10. **DO verify changes locally before suggesting deployment** - Test the full ICE flow

---

## Quick Commands

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Development mode | `npm run dev` |
| Build for production | `npm run build` |
| Start production | `npm run start` |
| Database push (migrations) | `npm run db:push` |
| Type check | `npm run check` |

---

## When Something Breaks - Top 10 Files to Check

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `server/routes.ts` | All API endpoints (10k+ lines) |
| 2 | `server/storage.ts` | Database operations via IStorage |
| 3 | `shared/schema.ts` | All data models (Drizzle + Zod) |
| 4 | `client/src/lib/queryClient.ts` | TanStack Query config + API helpers |
| 5 | `server/entitlements.ts` | Subscription tier feature gating |
| 6 | `server/previewHelpers.ts` | ICE creation/update logic |
| 7 | `client/src/pages/GuestIceBuilderPage.tsx` | Main ICE creation UI |
| 8 | `client/src/components/IceCardEditor.tsx` | Card editing interface |
| 9 | `server/services/briefParser.ts` | Producer brief parsing |
| 10 | `server/video/index.ts` | Video generation (Kling/Replicate) |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pages     │  │ Components  │  │ Caption     │              │
│  │ (Wouter)    │  │ (shadcn/ui) │  │ Engine      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                          │                                       │
│           TanStack Query │ (apiRequest)                         │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Express.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   routes.ts │  │  storage.ts │  │ entitlements│              │
│  │   (API)     │  │ (IStorage)  │  │    .ts      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                          │                                       │
│                          │                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  services/  │  │   jobs/     │  │   video/    │              │
│  │ (AI, scrape)│  │ (scheduled) │  │ (Kling API) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└──────────────────────────┼──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │   Object    │ │   External      │
│   (Neon)        │ │   Storage   │ │   APIs          │
│                 │ │   (R2/S3)   │ │                 │
│ - users         │ │             │ │ - OpenAI        │
│ - ice_previews  │ │ - public/   │ │ - Kling AI      │
│ - characters    │ │ - .private/ │ │ - Replicate     │
│ - plans         │ │             │ │ - Stripe        │
│ - analytics     │ │             │ │ - Resend        │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

---

## Key Concepts

- **ICE (Interactive Content Experience)**: A published story with cards, AI characters, and media
- **Universe**: A story world container (legacy concept, ICE is primary)
- **Cards**: Individual story beats with text, images, video, narration
- **AI Characters**: Guardrailed chatbots that can appear between cards
- **Producer Brief**: Structured markdown document for professional content creation
- **Entitlements**: Feature flags gated by subscription tier (Free/Creator/Business)
- **Visual Bible**: Design system ensuring visual consistency across cards
