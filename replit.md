# NextMonth – Claude Code Operating Context

## Overview
NextMonth is a Meaning-to-Experience Engine for brand storytelling, creative narratives, and knowledge transfer. It transforms diverse content into interactive, cinematic story cards using AI-generated visuals, guardrailed AI character interaction, a Visual Bible system, TTS narration, and a Daily Drop Engine. The platform aims to provide immersive and engaging narrative experiences, evolving from basic analytics to strategic advice driven by pattern intelligence and behavioral sequences. It supports role-based access and a tiered subscription model, focusing on business intelligence and user-centric content creation.

## User Preferences
I prefer simple language and clear, concise explanations. I value iterative development and prefer to be asked before major changes are made to the codebase. Please provide detailed explanations when new features or significant modifications are implemented. Do not make changes to the `shared/schema.ts` file without explicit approval, as it is the single source of truth for data models. Ensure that any AI-generated content adheres to the established visual bible system and character profiles for consistency.

## System Architecture
NextMonth employs a multi-stage content pipeline (Input Normalization, Theme Extraction, Character/Location Extraction, Card Planning, Card Content Drafting, QA/Validation). The frontend uses React 18, Vite, TailwindCSS (shadcn/ui), Wouter, and TanStack Query. The backend is built with Node.js, Express, Drizzle ORM, Neon-backed PostgreSQL, and Passport.js for authentication.

Key architectural decisions and features include:
-   **Schema-First Development**: Data models defined in `shared/schema.ts`.
-   **Storage Abstraction**: Database operations managed via an `IStorage` interface.
-   **Three-Layer Chat Prompt Composition**: Dynamic AI prompt construction from Universe Policy, Character Profile, and Card Overrides.
-   **Visual Bible System**: Ensures visual consistency through Design Guide, Reference Assets, and Prompt Builder.
-   **Lens-Based User Experience**: Onboarding customized by user-selected "lens" (Brand, Creative, Knowledge).
-   **Tiered Capability Model**: Features gated by "Orbit" subscription tiers.
-   **Pattern Intelligence**: Analytics focus on pattern recognition for session journeys, event ordering, object interaction, and outcome linkage.
-   **UI/UX**: Cinematic dark theme with an icy blue/cyan branding palette, three-tier navigation system, and consistent cyan branding for the IceMaker product.
-   **Data Sources Integration**: Supports ingestion of external read-only GET APIs with SSRF protection.
-   **Orbit Device System**: Enables display on thin clients with kiosk mode and voice interaction.
-   **Orbit Signal Schema**: Machine-readable JSON endpoint at `/.well-known/orbit.json` for AI systems.
-   **Guest ICE Builder**: Allows anonymous users to create time-limited ICE previews with server-persisted data and rate limiting.
-   **Multi-Tenant Security**: Implemented with HMAC-SHA256 signed access tokens and per-IP rate limiting.
-   **Interlude System**: Conversational AI character interaction between scenes in live previews (narrative beats positioned between content).
-   **Story Fidelity Modes**: Script-Exact Mode for script parsing or Interpretive Mode for content summarization.
-   **Guest-First Conversion Model**: Users experience value before identity or payment.
-   **Website Extraction System**: Automatically extracts product/menu data from business websites.
-   **Launchpad Hub**: Unified command center (`/launchpad`) for Orbit metrics and IceMaker content creation.
-   **Video Export System**: Server-side FFmpeg-based video export for ICE previews, creating downloadable MP4s with captions, TTS, and optional background music.
-   **AI-Powered Business Intelligence**: Includes Auto-Testimonial Capture, Business-Type-Aware Chat, Hero Posts analysis, Tone of Voice System, and Knowledge Coach.
-   **Orbit Settings System**: Full settings page at `/orbit/:slug/settings` with database persistence.
-   **Category Discovery Pages**: Educational category pages with SEO-friendly content and interactive audits.
-   **Orbit Type Doctrine**: Architectural distinction between 'industry' (pre-seeded) and 'standard' (user-claimable) orbits.
-   **Orbit Seed Pack (CPAC)**: JSON format for seeding Industry Orbits, managed via an admin panel.
-   **Orbit → ICE Flywheel**: Enables conversion of Orbit insights into shareable ICE content drafts.
-   **Caption Engine**: Remotion-based caption system with token-driven design, presets, safe area profiles, phrase grouping, karaoke highlighting, word-level timing, and fit-to-box layout.
-   **Caption Forced Alignment**: Whisper API-based word-level timestamp extraction for precise caption sync.
-   **Orbit Behaviour Health Dashboard**: Admin-only dashboard at `/admin/orbits/health` for monitoring system health.
-   **Media Cost Guardrails**: Economic constraints on video and images to preserve profitability.
-   **Website Intelligence Integration**: URL ingestion into `/orbit/:slug/import` for crawling, topic tile generation, and caching.
-   **ICE Card Comments System**: Anonymous viewer comments on ICE cards with display name persistence, character limits, and reactions.
-   **Conversation Insights System**: Business-tier AI-powered analysis of viewer chat conversations.
-   **Custom Fields System**: Business-tier feature for structured data capture during AI character conversations.
-   **Logo Branding System**: Users can upload custom logos to display on every ICE card.
-   **ICE Creation Wizard**: 4-step wizard at `/create` for designing ICEs from scratch.
-   **Demo ICE Architecture**: Demo ICEs are real ICEs created via the standard IceMaker UI.
-   **Render Deployment Architecture**: Single Node.js web service + PostgreSQL database deployment with a `/api/health` endpoint.
-   **Storage Quota & AI Usage Tracking System**: Comprehensive usage tracking for billing and tiered storage limits.
-   **Producer Brief Mode**: Enables producers to upload structured specification documents (.docx, .txt, .md) to auto-create ICEs.
-   **Enterprise Custom Branding Page**: Sales and education page at `/enterprise/custom-branding`.
-   **Continuity Lock System**: Enables visual continuity across ICE scenes through a locked scene configuration (formerly "Scene Lock").
-   **Desktop Builder Layout**: Responsive 2-column layout for GuestIceBuilderPage with BuilderActionsSidebar and BuilderPreviewDrawer.
-   **Cinematic Continuation System**: Transitions to a context-aware still image when narration exceeds video duration.
-   **Audio Volume & Ducking System**: Music and narration volume control with iOS-aware behavior and automatic music ducking.
-   **Smart Video Scaling System**: CardPlayer detects video aspect ratio and applies appropriate scaling (object-cover or blur-fill).
-   **Per-Clip Video Framing System**: Manual override of video display mode per media asset (`auto`|`fill`|`fit`).
-   **Experience Flow System**: Enables filling scene duration with sequential video/image clips with crossfade transitions (formerly "Media Timeline").
-   **AI Clip Suggestion System**: AI-powered video prompt suggestions based on story arc, scene narrative, and Continuity Lock.
-   **Drag-and-Drop Experience Flow**: Unified flow with draggable media blocks for reordering, duration adjustment, and removal.
-   **Quick Add UX System**: One-click media generation buttons at the top of editor tabs for AI Image, Video, and Narration.
-   **ElevenLabs TTS Phase 1**: Enhanced TTS with delivery style controls, character voice binding, and audio caching.
-   **ElevenLabs TTS Phase 2**: Voice preview feature for testing voice/style before generation, batch narration with delivery style selection, and audio cleanup on unmount.
-   **Pacing Presets System**: Experience Flow now surfaces Fast/Standard/Cinematic pacing options (3s/5s/8s default image durations) instead of exposing raw second values.

## External Dependencies
-   **OpenAI API**: Used for chat completions (gpt-4o-mini) and Text-to-Speech (TTS fallback).
-   **ElevenLabs API**: Primary TTS provider with delivery style controls and voice binding. Enabled via `ELEVENLABS_API_KEY` secret.
-   **Kling AI API**: Utilized for video generation.
-   **Replicate API**: Provides alternative models for video generation.
-   **Stripe**: Integrated for subscription billing and payment processing.
-   **Resend**: Handles transactional email delivery.
-   **Replit Object Storage (R2/S3-compatible)**: Used for general file storage.
-   **Neon (PostgreSQL)**: Serves as the managed PostgreSQL database service.