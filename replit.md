# NextScene - Meaning-to-Experience Engine

## Overview
NextScene is a meaning-to-experience engine that transforms any structured content (scripts, PDFs, websites, decks, documents) into cinematic, interactive story cards. The platform is content-agnostic, working equally for creative storytelling and commercial/brand storytelling. Key features include AI-generated visuals (image/video), guardrailed AI character chat, optional voice and music, and exportable/embeddable experiences.

**Primary positioning:** Brand Storytelling Engine for businesses
**Secondary expansion:** Creative/Entertainment for filmmakers and creators
**Deferred:** News/Real-time content

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Mobile-first Design**: Optimized for phone viewing with vertical story cards.
- **Styling**: TailwindCSS with shadcn/ui component library (New York style) for a consistent and modern look.
- **Animations**: Framer Motion for dynamic card reveal effects and transitions, enhancing user engagement.

### Technical Implementations
- **Frontend**: React with TypeScript, Vite, Wouter for routing, TanStack React Query for server state, and React Context for global state.
- **Backend**: Node.js with Express, RESTful API, Passport.js for authentication with local strategy and express-session.
- **AI Integration**:
    - **Kling AI Video Generation**: Supports `text-to-video` and `image-to-video` modes with various quality models (kling-v1 to kling-v2-master).
    - **Engine-Generated Images**: AI image generation based on universe-defined visual styles and card-specific scene descriptions, ensuring consistent visual themes.
    - **TTS Narration**: AI-generated voice narration using OpenAI's TTS API, with configurable voices, speeds, and auto-fill modes (manual, derive from text/captions, AI summarization).

### Feature Specifications
- **Marketing Homepage**: Public landing page with persona-specific CTAs for news outlets, businesses, influencers, and educators. Authenticated users are automatically redirected to the app dashboard.
- **Persona-Specific Pages**: Dedicated landing pages at `/for/news`, `/for/business`, `/for/influencer`, `/for/educator` with tailored messaging and use cases.
- **User Onboarding Flow**: Multi-step wizard for new users to capture persona, industry, team size, goals, and content frequency. Stored in `user_onboarding_profiles` table for personalization.
- **Route Protection**: All authenticated routes wrapped with RequireAuth component. Marketing pages remain public while app routes redirect unauthenticated users to login.
- **Daily Drop Engine**: Scheduled release of story cards.
- **Interactive Chat System (v2)**: Credible, guardrailed AI character chat using a three-layer prompt composition (Universe Policy, Character Profile, Card Overrides) to control personality, knowledge, and conversation flow, preventing hallucination.
- **Source Guardrails System**: Extracts and enforces `coreThemes`, `toneConstraints`, `factualBoundaries`, `exclusions`, `quotableElements`, `sensitiveTopics`, and `creativeLatitude` from source material to ensure AI accuracy and consistency.
- **Visual Bible System**: Comprehensive design guide for universe visual consistency. Includes:
  - **Design Guide Editor**: Art style, color palette, mood/tone, camera style, lighting notes, and quality level settings that apply to all AI generations.
  - **Prompt Builder**: Automatically merges universe design guide, character visual profiles, location continuity, and card-specific prompts into cohesive generation prompts.
  - **Reference Asset Library**: Upload and manage reference images for characters, locations, styles, props, and color palettes to maintain visual consistency.
  - **Quality Levels**: Draft/Standard/High/Ultra settings that adjust generation parameters.
  - **Negative Prompts & Avoid Lists**: Configure elements to always exclude from generated content.
- **Export & Distribution**: Supports canonical interactive experience, embeddable interactive experience, and standalone video export with CTAs driving users back to the canonical platform.
- **Soundtrack Management**: Audio library for background music with batch import, metadata editing, and per-universe audio settings (off, continuous).
- **Role-Based Access Control**: Three-tier user system (viewer/creator/admin) with subscription-based entitlements.
  - **Viewer**: Default role, can consume stories and chat with characters.
  - **Creator**: Can build stories via Transform feature, with tiered capabilities based on subscription.
  - **Admin**: Full platform access.
- **Subscription Tiers**: Free, Pro ($19/mo), and Business ($49/mo) with differentiated feature access:
  - **Free**: 1 universe, 5 cards, basic story creation.
  - **Pro**: Unlimited universes, 50 cards/story, custom characters, AI images, voice narration, analytics.
  - **Business**: Everything in Pro plus unlimited cards, AI video generation, export/distribution.

### System Design Choices
- **Monorepo Structure**: Client, server, and shared code managed within a single repository for streamlined development.
- **Schema Sharing**: Database schema defined once (`shared/schema.ts`) and used by both Drizzle ORM on the server and for client-side type inference.
- **Storage Abstraction**: An interface layer (`server/storage.ts`) for database operations to allow for flexible implementation changes.
- **PWA Ready**: Designed with a mobile-first approach, suitable for progressive web application deployment.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **connect-pg-simple**: PostgreSQL session store.

### Core Libraries
- **drizzle-orm**: Type-safe ORM for PostgreSQL.
- **drizzle-zod**: Schema validation integration.
- **passport / passport-local**: Authentication middleware.
- **bcrypt**: Password hashing.
- **Kling AI API**: For AI video generation.
- **OpenAI TTS API**: For AI voice narration.
- **R2/S3-compatible object storage**: For storing generated audio files.

### Frontend Libraries
- **@tanstack/react-query**: Server state management.
- **@radix-ui/**: Headless UI primitives.
- **framer-motion**: Animation library.
- **wouter**: Lightweight routing.