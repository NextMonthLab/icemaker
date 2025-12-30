# NextMonth – Claude Code Operating Context

## Overview
NextMonth is a Meaning-to-Experience Engine designed for brand storytelling, creative narratives, and knowledge transfer. It converts various content sources into interactive, cinematic story cards featuring AI-generated visuals, guardrailed AI character interaction, a Visual Bible system for consistency, TTS narration, and a Daily Drop Engine. The platform supports role-based access and a tiered subscription model, aiming for a monetizable MVP. The long-term vision involves evolving from basic analytics to strategic advice based on pattern intelligence and behavioral sequences.

## User Preferences
I prefer simple language and clear, concise explanations. I value iterative development and prefer to be asked before major changes are made to the codebase. Please provide detailed explanations when new features or significant modifications are implemented. Do not make changes to the `shared/schema.ts` file without explicit approval, as it is the single source of truth for data models. Ensure that any AI-generated content adheres to the established visual bible system and character profiles for consistency.

## System Architecture
NextMonth employs a multi-stage pipeline: Input Normalisation, Theme Extraction, Character/Location Extraction, Card Planning, Card Content Drafting, and QA/Validation. The frontend uses React 18 with Vite, TailwindCSS (shadcn/ui), Wouter, and TanStack Query. The backend is Node.js and Express, utilizing Drizzle ORM with Neon-backed PostgreSQL and Passport.js for authentication.

Key architectural decisions include:
-   **Schema-First Development**: `shared/schema.ts` defines all data models, generating types for client and server.
-   **Storage Abstraction**: Database operations are managed via an `IStorage` interface.
-   **Three-Layer Chat Prompt Composition**: AI prompts are built from Universe Policy, Character Profile, and Card Overrides.
-   **Visual Bible System**: Ensures visual consistency via a Design Guide, Reference Assets, and a Prompt Builder.
-   **Lens-Based User Experience**: Onboarding allows users to select a "lens" (Brand, Creative, Knowledge) for a customized experience.
-   **Tiered Capability Model**: Features are gated by an "Orbit" tier model (Free, Grow, Understand, Intelligence).
-   **Pattern Intelligence Focus**: Analytics are designed for future pattern recognition, focusing on session journeys, event ordering, object interaction, and outcome linkage.
-   **UI/UX**: Cinematic dark theme with Cinzel and Inter fonts, and a pink-purple-blue gradient accent.
-   **Three-Tier Navigation System**: Global navigation and product-specific submenus (`GlobalNav`, `IceMakerLayout`, `OrbitLayout`).
-   **Data Sources Integration**: Supports ingestion of external read-only GET APIs with SSRF protection.
-   **AgoraCube Device System**: Enables Orbit display on thin clients (e.g., Raspberry Pi 5) with kiosk mode and voice interaction.
-   **Orbit Signal Schema v0.1**: Machine-readable JSON endpoint at `/.well-known/orbit.json` for AI systems, exposing structured business identity.
-   **Guest ICE Builder**: Allows anonymous users to create ICE previews at `/try` with server-persisted, time-limited previews and rate limiting.
-   **Preview Share Bar**: Facilitates stakeholder sharing of unclaimed Orbits with time remaining and sharing options.
-   **Experience Analytics System**: Client-side tracking for experience and card views, with public event and admin summary endpoints.
-   **Multi-Tenant Security (Phase 1)**: Implemented with HMAC-SHA256 signed access tokens for story and preview access, and per-IP rate limiting.
-   **Stripe Subscription System**: Full subscription billing with webhook-based synchronization for product plans (Pro, Business), checkout flow, and credit granting idempotency.
-   **Platform-Agnostic Deployment**: Configurable via environment variables for various hosting platforms (e.g., Render), including URL overrides and webhook verification.
-   **Email & Notifications System**: Transactional emails via Resend (e.g., Orbit Claim Magic Link) and in-app notifications (tier-gated).
-   **Interactivity Nodes Between Cards**: Supports interactive nodes *between* cards for conversational moments and AI character interaction, fully live in preview and requiring subscription for published persistence.
-   **Story-Specific Character AI**: During preview creation, characters are automatically extracted from story content (detective, victim, suspects, witnesses, etc.) with unique personas, system prompts, and in-character responses. Characters appear in interactivity nodes with dropdown selection when multiple are available.
-   **Card Pace Controls**: Preview modal includes Slow/Normal/Fast pace controls (12s/5s/3s) for card auto-advance timing, allowing users to control the viewing experience. Mobile-optimized layout prevents overlap.
-   **Guided First-Run Experience**: A light, skippable walkthrough on first preview explaining cards, interactivity nodes, and the distinction between downloading and publishing.
-   **Login Does Not Unlock Features**: Login saves progress and allows checkout; payment via Stripe unlocks media generation, AI interactivity, and publishing.
-   **Shopping List / Production Manifest**: Calculates and displays media counts (cards, interactivity nodes, AI characters, images, video, music, voice) with real-time price updates before checkout.
-   **Download vs Publish**: Download produces a non-interactive video artifact; Publish creates a public, interactive experience with AI, requiring a subscription.
-   **Editor Transition**: Users transition from a Preview Editor to a Professional/Production Editor post-upgrade, with an explicit explanation and orientation.

## External Dependencies
-   **OpenAI API**: For chat completions (gpt-4o-mini) and Text-to-Speech (TTS).
-   **Kling AI API**: For video generation.
-   **Replicate API**: For alternative video generation models.
-   **Stripe**: For subscription billing and payment processing.
-   **Resend**: For transactional email delivery.
-   **Replit Object Storage (R2/S3-compatible)**: For file storage.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.