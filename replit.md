# NextMonth – Claude Code Operating Context

## Overview
NextMonth is a Meaning-to-Experience Engine that converts source content (scripts, PDFs, websites) into interactive, cinematic story cards. It's designed for brand storytelling, creative narratives, and knowledge transfer, featuring AI-generated visuals, guardrailed AI character interaction, a Visual Bible system for consistency, TTS narration, and a Daily Drop Engine. The platform supports role-based access and a tiered subscription model, aiming for a stable and monetisable MVP. The long-term vision is to evolve from basic analytics to providing strategic advice based on pattern intelligence, focusing on understanding behavioral sequences and their commercial implications.

## User Preferences
I prefer simple language and clear, concise explanations. I value iterative development and prefer to be asked before major changes are made to the codebase. Please provide detailed explanations when new features or significant modifications are implemented. Do not make changes to the `shared/schema.ts` file without explicit approval, as it is the single source of truth for data models. Ensure that any AI-generated content adheres to the established visual bible system and character profiles for consistency.

## System Architecture
NextMonth's architecture is a multi-stage pipeline: Input Normalisation, Theme Extraction, Character/Location Extraction, Card Planning, Card Content Drafting, and final QA/Validation. The frontend uses React 18 with Vite, TailwindCSS (shadcn/ui), Wouter for routing, and TanStack Query. The backend is Node.js and Express, with Drizzle ORM for type-safe PostgreSQL interactions (Neon-backed) and Passport.js for authentication.

Key architectural patterns and design decisions include:
-   **Schema-First Development**: `shared/schema.ts` defines all data models, generating types for both client and server.
-   **Storage Abstraction**: All database operations are managed via an `IStorage` interface (`server/storage.ts`).
-   **Three-Layer Chat Prompt Composition**: AI chat prompts are built from a Universe Policy, Character Profile, and Card Overrides.
-   **Visual Bible System**: Ensures visual consistency using a Design Guide, Reference Assets, and a Prompt Builder.
-   **Lens-Based User Experience**: Users select a "lens" (Brand, Creative, Knowledge) during onboarding to customize their experience.
-   **Tiered Capability Model**: The "Orbit" tier model (Free, Grow, Understand, Intelligence) gates features rather than access, with a focus on making the free tier a profitable acquisition channel.
-   **Pattern Intelligence Focus**: All analytics and tracking are designed to support future pattern recognition and strategic advice, emphasizing session-based journeys, event ordering, object-level interaction, and outcome linkage.
-   **UI/UX**: Emphasizes a cinematic feel with a dark theme, using Cinzel for headlines and Inter for body text, and a pink-purple-blue gradient accent.
-   **Data Sources Integration**: Supports ingestion of external read-only GET APIs with SSRF protection and encrypted credentials for conversational intelligence.
-   **AgoraCube Device System**: Enables Orbit display on dedicated thin clients (e.g., Raspberry Pi 5) with kiosk mode and optional voice interaction (STT/TTS), including device authentication and rate limiting.
-   **Orbit Signal Schema v0.1**: Machine-readable JSON endpoint at `/.well-known/orbit.json` that exposes structured business identity for AI systems. Features include:
    -   Domain resolution via host header to map requests to the correct Orbit
    -   Claimed-only publishing by default (controlled by `ORBIT_SCHEMA_ALLOW_UNCLAIMED` env var)
    -   Alternative access via `/api/orbit/:slug/signal-schema` for testing
    -   Optional HMAC signing via `ORBIT_SCHEMA_SIGNING_SECRET` env var
    -   Caching headers for efficient AI crawler access
    -   Schema includes: business identity, positioning, services, proof points, FAQs, AI guidance, and contact info
-   **Guest ICE Builder (Try Before Login)**: Anonymous users can create ICE previews at `/try` without authentication. Features include:
    -   URL or text input → AI-generated story cards
    -   Server-persisted previews in `ice_previews` table (7-day expiry for guests)
    -   Drag-drop card reordering and inline editing
    -   Deep-linking support via `/ice/preview/:id` route
    -   IP-based rate limiting (10 previews/day per IP)
    -   Ownership enforcement on promotion (requires matching IP or authenticated owner)
    -   Login redirect with return URL for seamless resume flow
    -   Premium feature upsell (AI images, video, narration, export) requiring authentication

## External Dependencies
-   **OpenAI API**: Used for chat completions (gpt-4o-mini) and Text-to-Speech (TTS).
-   **Kling AI API**: Integrated for video generation.
-   **Replicate API**: Used for alternative video generation models.
-   **Stripe**: For subscription billing and payment processing.
-   **Replit Object Storage (R2/S3-compatible)**: For file storage.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.