# IceMaker Architecture Map

## Frontend Overview

### Tech Stack
- **React 19** with Vite 7
- **TailwindCSS 4** with shadcn/ui components
- **Wouter** for routing
- **TanStack Query v5** for server state
- **Framer Motion** for animations
- **Remotion** for caption engine / video composition

### Directory Structure

```
client/src/
├── pages/              # Route pages (wouter)
│   ├── admin/          # Admin dashboard pages
│   ├── enterprise/     # Enterprise/sales pages
│   ├── icemaker/       # IceMaker-specific pages
│   ├── legal/          # Privacy, Terms, etc.
│   ├── marketing/      # Landing pages
│   └── smartglasses/   # Orbit device pages
├── components/
│   ├── ui/             # shadcn base components
│   ├── preview/        # ICE preview/player components
│   ├── ice-maker/      # ICE creation components
│   ├── experience/     # Experience viewer
│   └── launchpad/      # Dashboard components
├── caption-engine/     # Remotion-based caption system
├── hooks/              # Custom React hooks
├── lib/                # Utilities and types
│   ├── queryClient.ts  # TanStack Query setup
│   └── types/          # TypeScript interfaces
└── remotion/           # Video composition layers
```

### Key Pages

| Path | File | Purpose |
|------|------|---------|
| `/` | `GuestIceBuilderPage.tsx` | Main ICE creation wizard |
| `/create` | `CreateIcePage.tsx` | 4-step ICE creation wizard |
| `/library` | `Library.tsx` | User's ICE library |
| `/ice/:id` | `PublishedIcePage.tsx` | Published ICE viewer |
| `/p/:id` | `PreviewPage.tsx` | ICE preview player |
| `/login` | `Login.tsx` | Authentication |
| `/admin` | `Admin.tsx` | Admin dashboard |
| `/pricing` | `marketing/Pricing.tsx` | Subscription plans |

### State Management
- **TanStack Query** for all server state (no Redux/Zustand)
- Query keys use hierarchical arrays: `['/api/ice/preview', id]`
- Mutations invalidate related query keys
- `apiRequest()` helper in `lib/queryClient.ts` for POST/PATCH/DELETE

### Card Transitions
- `MediaPreloader` component handles preloading
- `displayedCardIndex` / `pendingCardIndex` pattern
- Timeout fallback prevents hanging on failed loads
- Cards animate with Framer Motion

---

## Backend Overview

### Tech Stack
- **Node.js 20+** with Express.js
- **Drizzle ORM** with PostgreSQL (Neon)
- **Passport.js** with local strategy for auth
- **Multer** for file uploads
- **OpenAI SDK** for AI features

### Directory Structure

```
server/
├── index.ts            # Express app entry point
├── routes.ts           # All API routes (~10k lines)
├── storage.ts          # IStorage interface + DatabaseStorage
├── entitlements.ts     # Subscription tier feature gating
├── previewHelpers.ts   # ICE CRUD helpers
├── authPolicies.ts     # Authorization checks
├── rateLimit.ts        # Rate limiting middleware
├── securityLogger.ts   # Security event logging
├── requestValidation.ts # Zod request validators
├── stripeClient.ts     # Stripe integration
├── services/
│   ├── briefParser.ts      # Producer brief parsing
│   ├── businessDataExtractor.ts
│   ├── conversationIntelligence.ts
│   ├── topicTileGenerator.ts
│   └── ...
├── jobs/
│   ├── archiveExpiredPreviews.ts
│   ├── orphanCleanup.ts
│   └── storageReconciliation.ts
├── video/
│   └── index.ts        # Kling/Replicate video generation
├── tts/                # Text-to-speech
├── replit_integrations/
│   └── object_storage.ts
└── config/
```

### Middleware Stack (order matters)
1. `express.json()` - Body parsing
2. Session middleware (connect-pg-simple)
3. Passport authentication
4. Rate limiters (per route)
5. Request validators (Zod)
6. Auth checks (`requireAuth`, `requireAdmin`)

### Authentication
- Session-based with PostgreSQL store
- `requireAuth` middleware checks `req.isAuthenticated()`
- `requireAdmin` checks `req.user.isAdmin` or `role === 'admin'`
- Public endpoints use token-based access (`validatePublicAccessToken`)

---

## ICE Data Model

### Core Entity: `ice_previews`

```typescript
// shared/schema.ts - icePreviews table
{
  id: text (UUID),          // Primary key
  universeId: integer,      // Link to universe (optional)
  ownerUserId: integer,     // Creator of the ICE
  title: text,
  description: text,
  projectBible: jsonb,      // Visual style, scene lock, etc.
  cards: jsonb[],           // Array of card objects
  characters: jsonb[],      // AI characters for this ICE
  visibility: text,         // 'private' | 'unlisted' | 'public'
  publishedAt: timestamp,
  expiresAt: timestamp,     // Guest ICEs expire
  status: text,             // 'draft' | 'published' | 'archived'
  // ... many more fields
}
```

### Card Structure

```typescript
interface PreviewCard {
  id: string;
  title: string;
  sceneText: string;
  imageUrl?: string;
  videoUrl?: string;
  narrationUrl?: string;
  captionEnabled?: boolean;
  captionPreset?: string;
  interactivityEnabled?: boolean;
  interactivityCharacterId?: number;
  visualPrompt?: string;      // For image generation
  videoPrompt?: string;       // For video generation
  // ... more fields
}
```

### Entity Relationships

```
users (1) ─────┬──── (N) creator_profiles
              └──── (N) ice_previews (owner)

creator_profiles (1) ─── (N) media_assets
                    ─── (N) ai_usage_events

ice_previews (1) ─── (N) preview_analytics
             ─── (N) preview_chat_messages
             ─── (N) ice_card_comments
             ─── (N) conversation_insights

characters (1) ─── (N) ai_character_custom_fields
           ─── (N) ai_character_field_responses

universes (1) ─── (N) characters
          ─── (N) locations
          ─── (N) universe_reference_assets
          ─── (N) cards (legacy)
```

---

## Pipelines

### ICE Creation Pipeline

1. **Content Upload** (`POST /api/ice/preview/upload`)
   - File: `server/routes.ts` lines 6629+
   - Accepts: PDF, TXT, MD, DOCX
   - Calls: `documentProcessor.ts`, detects screenplay format

2. **Brief Parsing** (for Producer Briefs)
   - File: `server/services/briefParser.ts`
   - Parses markdown tables with Card|Content|Visual columns
   - Extracts visual prompts (IMAGE: / VIDEO: prefixes)

3. **Card Generation**
   - Creates card array from parsed content
   - Applies Project Bible settings (scene lock, visual style)
   - Stores in `ice_previews.cards` JSONB

4. **Media Generation** (async, user-triggered)
   - Image: OpenAI DALL-E via `/api/cards/:id/image/generate`
   - Video: Kling AI via `/api/cards/:id/video/generate`
   - TTS: OpenAI TTS via `/api/cards/:id/narration/generate`

5. **Publishing** (`POST /api/ice/preview/:id/publish`)
   - Sets `publishedAt`, `status = 'published'`
   - Generates shareable URL

### Asset Generation Flow

```
User clicks "Generate Image"
         │
         ▼
POST /api/cards/:id/image/generate
         │
         ▼
Build prompt from:
  - Card visual prompt
  - Project Bible style
  - Scene lock settings
         │
         ▼
OpenAI DALL-E (gpt-image-1)
         │
         ▼
Upload to Object Storage
         │
         ▼
Update card.imageUrl
         │
         ▼
Return updated card
```

---

## Storage

### Object Storage (R2/S3-compatible)

**Provider**: Replit Object Storage (uses DEFAULT_OBJECT_STORAGE_BUCKET_ID)

**Bucket Layout**:
```
bucket/
├── public/              # Publicly accessible assets
│   ├── images/          # Generated images
│   ├── videos/          # Generated videos
│   └── audio/           # TTS narration files
└── .private/            # Private uploads
    ├── documents/       # Uploaded briefs/scripts
    └── avatars/         # User avatars
```

**Key Files**:
- `server/replit_integrations/object_storage.ts` - ObjectStorageService class
- Uses signed URLs for private content
- Public content served via `/objects/:path` route

**Privacy Defaults**:
- User uploads: private by default
- Generated media: public (for sharing)
- Logos: public with user control

---

## Third-Party Integrations

### OpenAI
- **Usage**: Chat completions, image generation, TTS
- **Models**: gpt-4o-mini (chat), dall-e-3 (images), tts-1 (audio)
- **Key env vars**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `OPENAI_API_KEY`
- **Error handling**: Retries with p-retry, graceful degradation
- **Files**: `server/routes.ts` (getOpenAI function), `server/chat.ts`

### Kling AI (Video)
- **Usage**: Image-to-video generation
- **Key env vars**: `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, `KLING_API_BASE`
- **File**: `server/video/index.ts`
- **Cost guardrail**: 5-second max duration

### Replicate (Fallback Video)
- **Usage**: Alternative video models
- **Key env vars**: `REPLICATE_API_TOKEN`
- **File**: `server/video/index.ts`

### Stripe
- **Usage**: Subscription billing, one-time purchases
- **Key env vars**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Files**: `server/stripeClient.ts`, `server/webhookHandlers.ts`

### Resend
- **Usage**: Transactional email
- **Key env vars**: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`
- **File**: `server/services/email/`

---

## Render Deployment

### Build Command
```bash
npm install --include=dev && npm run build
```

### Start Command
```bash
npm run start
```

### Required Environment Variables
See `03-ENV-VARS-RUNBOOK.md` for complete list.

**Critical for startup**:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `PUBLIC_TOKEN_SECRET` - Public access token signing

### Health Check
- **Endpoint**: `GET /api/health`
- **File**: `server/routes.ts` line 181
- Returns: `{ status: "ok", timestamp: "..." }`

### Database Migration
After first deploy, run in Render shell:
```bash
npm run db:push
```
This creates all tables defined in `shared/schema.ts`.
