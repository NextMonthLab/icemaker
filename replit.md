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