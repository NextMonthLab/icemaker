# StoryFlix - Interactive Narrative Platform

## Overview

StoryFlix is an interactive narrative platform that delivers daily "story cards" and monetizes through text-only AI character chat. The core loop is: Daily Drop → Obsession (watch + read) → Chat (constrained character) → Share (vertical clip) → Return (next day).

Key features include:
- **Daily Drop Engine**: Scheduled release of vertical story cards with reveal effects
- **Interactive Chat**: Conversations with story characters (AI-powered, with secrets they cannot reveal)
- **Case Journal**: Track progress and collected clues
- **Admin Dashboard**: Create cards manually or import Season Packs via ZIP, schedule releases
- **Engine-Generated Images**: AI image generation support with visual style constraints and prompt composition

### Engine-Generated Images System

Universes can specify `visualMode`:
- `author_supplied` (default): Images are uploaded by content creators
- `engine_generated`: Images are generated using AI based on prompts

For engine-generated universes:
- `visualStyle` defines base prompt, negative prompt, aspect ratio, and consistency settings
- Cards include `sceneDescription` and/or `imageGeneration` with prompt, shot_type, lighting
- Prompt composition: universe.basePrompt + card.prompt + shot_type + lighting
- API endpoints: `/api/universes/:id/cards/pending-images`, `/api/cards/:id/generate-image`

Sample manifest available at: `docs/sample-time-spent-manifest.json`

### Source Guardrails System (Grounding & Anti-Hallucination)

The transformation pipeline extracts and enforces grounding rules to prevent AI hallucination. These guardrails ensure the Story Engine stays faithful to the source material.

**Guardrail Extraction (Stage 2)**:
The pipeline extracts these constraints from the source material:
- `coreThemes`: Themes explicitly present in the source (not inferred)
- `toneConstraints`: Rules about tone (e.g., "restrained, not melodramatic")
- `factualBoundaries`: Facts that must be respected (names, places, events)
- `exclusions`: Topics/themes the AI must NOT introduce
- `quotableElements`: Key phrases and concepts directly from the source
- `sensitiveTopics`: Subjects requiring careful handling
- `creativeLatitude`: "strict" (factual), "moderate" (interpret), or "liberal" (creative)
- `groundingStatement`: What this material IS and what it is NOT

**Guardrail Enforcement**:
- Stage 4 (Card Planning): Guardrails constrain card content generation
- Stage 5 (Character Chat): Characters are source-bound with explicit deflection rules
- Character prompts include: "If asked about something not in the source, respond 'That's not something I know about'"

**Admin Visibility**:
The Admin Universe Detail page shows guardrails for transparency:
- Grounding statement and creative latitude
- Core themes and tone constraints
- Exclusions (what AI must NOT introduce)
- Quotable elements and sensitive topics

**Design Principle**: "Extract → interpret → structure → elevate, but never replace."
When there's a trade-off between engagement and accuracy, accuracy wins by default.

### Export & Distribution System

The platform supports three distribution modes, all pointing back to the canonical experience:

**Mode 1: Canonical Interactive Experience (Home Base)**
- Full card sequence with two-phase flow (cinematic → context)
- AI character chat, message boards, guardrails
- Permanent URL: `/story/{slug}`
- This is the single source of truth

**Mode 2: Embeddable Interactive Experience**
- Embed via iframe with `?embed=true` parameter
- Retains full interactivity
- Shows "Powered by StoryFlix" badge
- Updates propagate automatically from canonical

**Mode 3: Standalone Video Export (Hook Mode)**
- Deliberately incomplete - creates curiosity
- QR code permanently burned in (non-removable)
- Auto-generated posting copy with short URL
- Character-aware CTAs ("Talk to [Character]")

**Export Page** (`/admin/universes/:id/export`):
- Canonical URL display and copy
- QR code generation and download
- Embed code generator
- Editable posting copy with CTA

**Public API**:
- `GET /api/story/:slug`: Returns universe, published cards, and characters for unauthenticated viewers

**Guardrails**: All exports drive users back to the canonical experience. No export may contain more intelligence than the source.

### Chat System v2 (Schema Version 2)

The platform supports credible, guardrailed AI character chat powered by a three-layer prompt composition system:

**Layer 1: Universe Chat Policy (required for schemaVersion 2)**
- `rating`: Content rating (PG/12/15/18) for gating
- `spoiler_policy`: Hard or soft spoiler protection rules
- `truth_policy`: When characters can lie in-character
- `refusal_style`: In-character deflection templates
- `safety_policy`: Disallowed content categories and escalation rules
- `disclaimer`: AI-generated content notice

**Layer 2: Character Chat Profile (required for schemaVersion 2)**
- `system_prompt`: Core AI personality and behavior rules (REQUIRED)
- `voice`: How the character speaks
- `speech_style`: Verbal patterns and habits
- `goals`: Conversation objectives
- `knowledge_cutoff`: Dynamic or fixed dayIndex limit
- `secrets`: Array with id, trigger_patterns, and deflect_with responses
- `hard_limits`: Things character will never do or reveal
- `refusal_style`: How to deflect uncomfortable questions

**Layer 3: Card Chat Overrides (per-card context)**
- `emotional_state`: guarded, warm, panicked, confident, etc.
- `scene_context`: What just happened in this card
- `objectives`: Character's goals in this moment
- `knows_up_to_day_index`: Override knowledge cutoff
- `taboo_for_this_scene`: Topics to avoid today
- `can_reveal`: Things now safe to reveal
- `spoiler_traps`: Specific trigger/deflection pairs

**Prompt Composer** (server/chat.ts):
- Combines all three layers deterministically
- Always enforces knowledge cutoff (hard mode adds stricter rules)
- Processes secrets with pattern matching and deflections
- Adds safety policy enforcement

**Schema Documentation**: `docs/season-pack-schema-v2.json`
**Sample v2 Manifest**: `docs/sample-time-spent-manifest-v2.json`

### Soundtrack Management System

The platform includes a complete audio management system for background music:

**Audio Library (`/admin/audio`):**
- Scan `/uploads/audio/` folder for MP3 files
- Batch import discovered tracks with automatic metadata extraction
- Single file upload with drag-and-drop support
- Edit track metadata: title, artist, mood tags, genre tags, licensing info, attribution
- Delete tracks from library

**Audio Modes (per-universe):**
- `off`: No background music
- `continuous`: Same track plays throughout the story experience
- `per_card`: Each card can have its own track (future enhancement)

**Audio Settings:**
- Default track selection for the universe
- Fade in/out timings (ms)
- Mood tags: tense, upbeat, mysterious, romantic, sad, action, calm, epic, playful, dark
- Genre tags: cinematic, electronic, ambient, pop, orchestral, rock, jazz, hip-hop, acoustic, thriller

**Database Tables:**
- `audio_tracks`: Stores track metadata, file paths, and tags
- `universe_audio_settings`: Per-universe audio configuration

**API Endpoints:**
- `GET /api/audio/tracks`: List all tracks (optional mood/genre filtering)
- `POST /api/audio/scan`: Scan folder for new files
- `POST /api/audio/import`: Batch import scanned tracks
- `POST /api/audio/upload`: Single file upload
- `PATCH /api/audio/tracks/:id`: Update track metadata
- `DELETE /api/audio/tracks/:id`: Delete track
- `GET/PATCH /api/universes/:id/audio-settings`: Universe audio configuration

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for auth and app state
- **Styling**: TailwindCSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for card reveal effects and transitions
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Pattern**: RESTful API under `/api` prefix
- **Authentication**: Passport.js with local strategy, express-session for session management
- **Password Hashing**: bcrypt

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Key Entities**: Users, Universes (story worlds), Characters, Cards, UserProgress, ChatThreads, ChatMessages, CardCharacters (junction table)
- **Migrations**: Managed via `drizzle-kit push`

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production Build**: esbuild bundles server, Vite builds client to `dist/public`
- **Entry Point**: `server/index.ts` runs Express which serves the SPA and API

### Key Design Decisions

1. **Monorepo Structure**: Client, server, and shared code in one repository with TypeScript path aliases for clean imports.

2. **Schema Sharing**: Database schema defined once in `shared/schema.ts`, used by both Drizzle ORM on the server and for type inference on the client.

3. **Storage Abstraction**: `server/storage.ts` provides an interface layer over database operations, making it easier to swap implementations.

4. **Session-Based Auth**: Uses express-session with passport-local for authentication, suitable for the daily engagement model where users return frequently.

5. **PWA-Ready**: The platform is designed for mobile-first experience with vertical story cards optimized for phone viewing.

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **connect-pg-simple**: PostgreSQL session store for express-session

### Core Libraries
- **drizzle-orm**: Type-safe ORM for PostgreSQL
- **drizzle-zod**: Schema validation integration between Drizzle and Zod
- **passport / passport-local**: Authentication middleware
- **bcrypt**: Password hashing

### Frontend Libraries  
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Headless UI primitives (used by shadcn/ui)
- **framer-motion**: Animation library for card reveals
- **wouter**: Lightweight routing

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption (auto-generated in production)
- `NODE_ENV`: Set to "production" for production builds