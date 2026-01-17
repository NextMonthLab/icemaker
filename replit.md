# NextMonth – Claude Code Operating Context

## Overview
NextMonth is a Meaning-to-Experience Engine designed for brand storytelling, creative narratives, and knowledge transfer. It transforms diverse content into interactive, cinematic story cards using AI-generated visuals, guardrailed AI character interaction, a Visual Bible system, TTS narration, and a Daily Drop Engine. The platform aims to evolve from basic analytics to strategic advice driven by pattern intelligence and behavioral sequences, supporting role-based access and a tiered subscription model. Its core purpose is to deliver immersive and engaging narrative experiences, with a focus on business intelligence and user-centric content creation.

## User Preferences
I prefer simple language and clear, concise explanations. I value iterative development and prefer to be asked before major changes are made to the codebase. Please provide detailed explanations when new features or significant modifications are implemented. Do not make changes to the `shared/schema.ts` file without explicit approval, as it is the single source of truth for data models. Ensure that any AI-generated content adheres to the established visual bible system and character profiles for consistency.

## System Architecture
NextMonth employs a multi-stage content pipeline: Input Normalization, Theme Extraction, Character/Location Extraction, Card Planning, Card Content Drafting, and QA/Validation. The frontend uses React 18, Vite, TailwindCSS (shadcn/ui), Wouter, and TanStack Query. The backend is built with Node.js, Express, Drizzle ORM, Neon-backed PostgreSQL, and Passport.js for authentication.

Key architectural decisions and features include:
-   **Schema-First Development**: All data models are defined in `shared/schema.ts`.
-   **Storage Abstraction**: Database operations are managed via an `IStorage` interface.
-   **Three-Layer Chat Prompt Composition**: AI prompts are dynamically constructed from Universe Policy, Character Profile, and Card Overrides.
-   **Visual Bible System**: Ensures visual consistency through a Design Guide, Reference Assets, and Prompt Builder.
-   **Lens-Based User Experience**: Onboarding is customized by user-selected "lens" (Brand, Creative, Knowledge).
-   **Tiered Capability Model**: Features are gated by "Orbit" subscription tiers.
-   **Pattern Intelligence**: Analytics focus on pattern recognition for session journeys, event ordering, object interaction, and outcome linkage.
-   **UI/UX**: Features a cinematic dark theme with an **icy blue/cyan branding palette**, utilizing a three-tier navigation system. The IceMaker product uses consistent cyan branding throughout the wizard, editor, checkout, and media generation interfaces.
-   **Data Sources Integration**: Supports ingestion of external read-only GET APIs with SSRF protection.
-   **Orbit Device System**: Enables display on thin clients with kiosk mode and voice interaction.
-   **Orbit Signal Schema**: Machine-readable JSON endpoint at `/.well-known/orbit.json` for AI systems.
-   **Guest ICE Builder**: Allows anonymous users to create time-limited ICE previews with server-persisted data and rate limiting.
-   **Multi-Tenant Security**: Implemented with HMAC-SHA256 signed access tokens and per-IP rate limiting.
-   **Interactivity Nodes**: Supports conversational AI character interaction between cards in live previews.
-   **Story Fidelity Modes**: Content uploads trigger Script-Exact Mode for script parsing or Interpretive Mode for content summarization.
-   **Guest-First Conversion Model**: Users experience value before identity or payment.
-   **Website Extraction System**: Automatically extracts product/menu data from business websites with specialized support for various business types and high-signal data extraction.
-   **Launchpad Hub**: A unified command center (`/launchpad`) combining Orbit metrics with IceMaker content creation.
-   **Video Export System**: Server-side FFmpeg-based video export for ICE previews, creating downloadable MP4 videos with caption overlays, TTS, and optional background music.
-   **AI-Powered Business Intelligence**: Includes Auto-Testimonial Capture, Business-Type-Aware Chat, Hero Posts analysis for pattern detection, Tone of Voice System from hero posts, and Knowledge Coach for proactive question generation.
-   **Orbit Settings System**: Full settings page at `/orbit/:slug/settings` with database persistence for Orbit configurations.
-   **Category Discovery Pages**: Educational category pages with SEO-friendly content and interactive audits.
-   **Orbit Type Doctrine**: Architectural distinction between 'industry' (pre-seeded, non-claimable) and 'standard' (user-claimable, owned) orbits.
-   **Orbit Seed Pack (CPAC)**: JSON format for seeding Industry Orbits with products, entities, communities, and tiles, managed via an admin panel.
-   **Orbit → ICE Flywheel**: Enables admins and influencers to convert Orbit insights into shareable ICE content drafts.
-   **Caption Engine**: Remotion-based caption system for ICE content with token-driven design, various presets, safe area profiles for social media, phrase grouping, karaoke highlighting, word-level timing, and a fit-to-box layout engine.
-   **Caption Forced Alignment**: Whisper API-based word-level timestamp extraction for precise caption sync. Features fuzzy word matching with contraction expansion, per-caption fallback on low confidence, and "hold previous caption" gap behavior. Enabled via `CAPTION_ALIGNMENT_ENABLED=true` and `captionTimingMode='aligned'` per ICE.
-   **Orbit Behaviour Health Dashboard**: Admin-only dashboard at `/admin/orbits/health` for monitoring Orbit system health.
-   **Media Cost Guardrails**: Strictly enforced economic constraints on video (5-second cap, no HD) and images (1024x1024, ~$0.04/image) to preserve profitability. Video duration is capped at 5 seconds in `server/video/replicate.ts`. Videos do NOT loop - when video ends before narration, the last frame holds. If longer durations are needed, the cap must be removed from the Replicate provider and the UI duration selector should match actual capability.
-   **Website Intelligence Integration**: URL ingestion integrated into `/orbit/:slug/import` for crawling, topic tile generation, and caching.
-   **ICE Card Comments System**: Anonymous viewer comments on ICE cards with display name persistence, character limits, and reaction support.
-   **Conversation Insights System**: Business-tier exclusive AI-powered analysis of viewer chat conversations, aggregating `previewChatMessages` data, generating insights via OpenAI, and caching results.
-   **Custom Fields System**: Business-tier feature for structured data capture during AI character conversations, supporting 8 field types and featuring inline chat capture forms.
-   **Logo Branding System**: Allows users to upload custom logos (2MB max) via Object Storage and display them on every ICE card with configurable position.
-   **ICE Creation Wizard**: 4-step wizard at `/create` for designing ICEs from scratch without content injection, guiding users through template selection, length, structure, and style choices.
-   **Demo ICE Architecture**: Demo ICEs are real ICEs created via the standard IceMaker UI, not hard-coded, intended to prove IceMaker by being made with IceMaker.
-   **Render Deployment Architecture**: Single Node.js web service + PostgreSQL database deployment model with a health check endpoint at `/api/health`.
-   **Storage Quota & AI Usage Tracking System**: Comprehensive usage tracking for fair billing, including `media_assets` and `ai_usage_events` tables, with tiered storage limits.
-   **Producer Brief Mode**: Enables professional producers to upload structured specification documents (.docx, .txt, .md) that auto-create ICEs with exact specifications, including card counts, AI characters, interactivity checkpoints, and visual direction.
-   **Enterprise Custom Branding Page**: Sales and education page at `/enterprise/custom-branding` for enterprise custom branding services, featuring various branding options and an enquiry form.
-   **Scene Lock System**: Enables visual continuity across ICE cards through a locked scene configuration in Project Bible, with granular lock flags for environment, camera, lighting, and background elements, and card-level override options.
-   **Desktop Builder Layout**: Responsive 2-column layout for GuestIceBuilderPage with BuilderActionsSidebar (collapsible sidebar for actions like AI media, music, logo, captions, export, publish) visible on desktop (lg+), BuilderPreviewDrawer (slide-in preview with card media), and stacked panels hidden on desktop.
-   **Cinematic Continuation System**: Solves the video-narration duration mismatch problem. When narration continues beyond the 5-second video cap, CardPlayer transitions via crossfade to a context-aware still image. Uses `cinematicContinuationEnabled` (default true), `continuationImageUrl`, `videoDurationSec`, and `narrationDurationSec` fields. Video `ended` event triggers the transition. API endpoint at `/api/ice/preview/:previewId/cards/:cardId/generate-continuation-still` generates AI stills using scene context and Scene Lock config for visual continuity.
-   **Audio Volume & Ducking System**: Music and narration volumes with iOS-aware behavior. On iOS, volume sliders are hidden (iOS Safari doesn't support programmatic volume control) and volumes are fixed at 20% music, 100% narration. On desktop, volume sliders allow user control with automatic music ducking: when narration plays, music ducks to 20% (background level); when narration stops, music returns to user-set volume. Smooth 400ms fade transitions via requestAnimationFrame. CardPlayer notifies parent via `onNarrationPlayingChange` callback.

## External Dependencies
-   **OpenAI API**: Used for chat completions (gpt-4o-mini) and Text-to-Speech (TTS).
-   **Kling AI API**: Utilized for video generation.
-   **Replicate API**: Provides alternative models for video generation.
-   **Stripe**: Integrated for subscription billing and payment processing.
-   **Resend**: Handles transactional email delivery.
-   **Replit Object Storage (R2/S3-compatible)**: Used for general file storage.
-   **Neon (PostgreSQL)**: Serves as the managed PostgreSQL database service.