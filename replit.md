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
-   **Tiered Capability Model**: Features are gated by "Orbit" subscription tiers (Free, Grow, Understand, Intelligence).
-   **Pattern Intelligence**: Analytics focus on pattern recognition for session journeys, event ordering, object interaction, and outcome linkage.
-   **UI/UX**: Features a cinematic dark theme with specific fonts and an **icy blue/cyan branding palette** (cyan-500/600 for primary actions, blue-500/600 for gradients), utilizing a three-tier navigation system. The IceMaker product uses consistent cyan branding throughout the wizard, editor, checkout, and media generation interfaces.
-   **Data Sources Integration**: Supports ingestion of external read-only GET APIs with SSRF protection.
-   **Orbit Device System**: Enables display on thin clients with kiosk mode and voice interaction.
-   **Orbit Signal Schema**: Machine-readable JSON endpoint at `/.well-known/orbit.json` for AI systems.
-   **Guest ICE Builder**: Allows anonymous users to create time-limited ICE previews with server-persisted data and rate limiting.
-   **Experience Analytics System**: Client-side tracking for experience and card views.
-   **Multi-Tenant Security**: Implemented with HMAC-SHA256 signed access tokens and per-IP rate limiting.
-   **Email & Notifications System**: Transactional emails via Resend and in-app notifications.
-   **Interactivity Nodes**: Supports conversational AI character interaction between cards in live previews.
-   **Story Fidelity Modes**: Content uploads trigger Script-Exact Mode for script parsing or Interpretive Mode for content summarization.
-   **Guest-First Conversion Model**: Users experience value before identity or payment.
-   **Website Extraction System**: Automatically extracts product/menu data from business websites using site detection, multi-page crawling, quality validation, and image filtering. This includes specialized support for various business types (catalogue, menu, service, hybrid) and high-signal data extraction (faq, team_member, business_profile, contact, opening_hours, testimonial, trust_signal).
-   **Launchpad Hub**: A unified command center (`/launchpad`) combining Orbit metrics with IceMaker content creation.
-   **Title Packs System**: Provides professional typography presets for ICE card captions.
-   **Video Export System**: Server-side FFmpeg-based video export for ICE previews, creating downloadable MP4 videos with caption overlays, TTS, and optional background music.
-   **Auto-Testimonial Capture System**: Automatically detects customer praise in Orbit chat conversations using AI-powered sentiment analysis.
-   **Business-Type-Aware Chat System**: Orbit chat automatically detects business type to adjust system prompts and language.
-   **Shared Orbit Chat Service**: Consolidated chat logic in `server/services/orbitChatService.ts`.
-   **Hero Posts System**: Allows Orbit owners to add best-performing social media posts for AI-powered pattern analysis and AI-generated follow-up suggestions.
-   **Tone of Voice System**: Analyzes hero posts to generate brand voice profiles.
-   **Knowledge Coach System**: Proactively generates weekly AI-powered questions to help business owners fill knowledge gaps.
-   **Orbit Settings System**: Full settings page at `/orbit/:slug/settings` with database persistence for Orbit configurations.
-   **Category Discovery Pages**: Educational category pages with SEO-friendly content and interactive audits.
-   **Orbit Type Doctrine**: Architectural distinction between 'industry' (pre-seeded, non-claimable) and 'standard' (user-claimable, owned) orbits.
-   **Orbit Seed Pack (CPAC)**: JSON format for seeding Industry Orbits with products, entities, communities, and tiles. Managed via an admin panel at `/admin/cpac`.
-   **Orbit → ICE Flywheel**: Enables admins and influencers to convert Orbit insights into shareable ICE content drafts.
-   **Caption Engine**: Remotion-based caption system for ICE content with token-driven design, various presets, safe area profiles for social media, phrase grouping, karaoke highlighting, word-level timing, and a fit-to-box layout engine. The composition stage is fixed-width (1080px) and scaled via CSS transform for consistent rendering.
-   **Orbit Behaviour Health Dashboard**: Admin-only dashboard at `/admin/orbits/health` for monitoring Orbit system health with contract-first verification and deterministic checks.
-   **Media Cost Guardrails (LOCKED)**: Strictly enforced economic constraints on video (5-second cap, no HD) and images (1024x1024, ~$0.04/image) to preserve profitability. No silent retries or hidden multi-candidate generation.
-   **Website Intelligence Integration**: URL ingestion integrated into `/orbit/:slug/import` for crawling, topic tile generation, and caching.
-   **ICE Card Comments System**: Anonymous viewer comments on ICE cards via `iceCardMessages` and `iceCardMessageReactions` tables. Uses text-based ICE card IDs (e.g., `ice_xxx_card_0`) with API routes at `/api/ice/cards/:iceCardId/messages`. Includes display name persistence via localStorage, 280-char limit, and reaction support.
-   **Conversation Insights System**: Business-tier exclusive AI-powered analysis of viewer chat conversations. Aggregates `previewChatMessages` data, generates insights via OpenAI (gpt-4o-mini), and caches results for 24 hours in `conversationInsights` table. Features include: sentiment scoring, top topics extraction, common questions identification, engagement pattern analysis, and actionable recommendations. Gated by `canViewConversationInsights` entitlement with upgrade prompts for lower tiers.
-   **Custom Fields System**: Business-tier feature for structured data capture during AI character conversations. Supports 8 field types (text, number, email, phone, single_select, multi_select, boolean, date). Data stored via `aiCharacterCustomFields` (field definitions with sort order) and `aiCharacterFieldResponses` (session-tracked jsonb values) tables. Features inline chat capture form that appears after 3 messages, collapsible advanced options in character builder, and aggregated field data visualization in Conversation Insights panel. Gated by `canConfigureStructuredCapture` entitlement.
-   **Logo Branding System**: Allows users to upload custom logos (2MB max) via Object Storage and display them on every ICE card. Logo position configurable (top-left, top-right, bottom-left, bottom-right). Settings stored in `icePreviews` table (`logoEnabled`, `logoUrl`, `logoPosition` columns). UI in ICE editor with preview, toggle, and position selector. Logo renders as 48x48 backdrop-blur overlay in CardPlayer component.
-   **ICE Creation Wizard**: 4-step wizard at `/create` for designing ICEs from scratch without content injection. Step 1: Choose template family (10 families across 4 categories - Onboard+Train, Sell+Showcase, Engage+Collect, Story+Entertain). Step 2: Select length (6/10/15 cards). Step 3: Pick structure with card arc preview. Step 4: Style choices (visual style, voice, interaction, title pack). Generates blueprint JSON that transforms into editable ICE draft. Template library in `shared/templateFamilies.ts`, transformer in `shared/blueprintTransformer.ts`. Backend endpoint `POST /api/ice/preview/wizard` with input validation and sanitization.
-   **Demo ICE Architecture (FUTURE)**: Demo ICEs are real ICEs created via the standard IceMaker UI, not hard-coded. They use the same ingestion, card generation, media generation, and interaction pipeline as user ICEs. The distinction is presentation and surfacing, not creation. Future implementation will include: (1) Demo flagging mechanism (e.g., `isDemo: true` or `visibility: demo`), (2) Dedicated demo listing page at `/demos` or `/case-studies`, (3) Homepage section with CTA routing to demo page. Core principle: Demo ICEs must prove IceMaker by being made with IceMaker—no special rendering, no mocked experiences.
-   **Render Deployment Architecture**: Single Node.js web service + PostgreSQL database deployment model. Health check endpoint at `/api/health` verifies database connectivity. Build outputs bundled server (`dist/index.cjs`) + static frontend (`dist/public/`). Documented in `docs/DEPLOY_RENDER.md` with `render.yaml` blueprint for one-click deploy.

## External Dependencies
-   **OpenAI API**: Used for chat completions (gpt-4o-mini) and Text-to-Speech (TTS).
-   **Kling AI API**: Utilized for video generation.
-   **Replicate API**: Provides alternative models for video generation.
-   **Stripe**: Integrated for subscription billing and payment processing.
-   **Resend**: Handles transactional email delivery.
-   **Replit Object Storage (R2/S3-compatible)**: Used for general file storage.
-   **Neon (PostgreSQL)**: Serves as the managed PostgreSQL database service.