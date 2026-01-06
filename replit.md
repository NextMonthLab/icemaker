# NextMonth – Claude Code Operating Context

## Overview
NextMonth is a Meaning-to-Experience Engine designed for brand storytelling, creative narratives, and knowledge transfer. It transforms diverse content into interactive, cinematic story cards featuring AI-generated visuals, guardrailed AI character interaction, a Visual Bible system, TTS narration, and a Daily Drop Engine. The platform aims to evolve from basic analytics to strategic advice driven by pattern intelligence and behavioral sequences, supporting role-based access and a tiered subscription model.

## User Preferences
I prefer simple language and clear, concise explanations. I value iterative development and prefer to be asked before major changes are made to the codebase. Please provide detailed explanations when new features or significant modifications are implemented. Do not make changes to the `shared/schema.ts` file without explicit approval, as it is the single source of truth for data models. Ensure that any AI-generated content adheres to the established visual bible system and character profiles for consistency.

## System Architecture
NextMonth employs a multi-stage content pipeline: Input Normalization, Theme Extraction, Character/Location Extraction, Card Planning, Card Content Drafting, and QA/Validation. The frontend uses React 18, Vite, TailwindCSS (shadcn/ui), Wouter, and TanStack Query. The backend is built with Node.js, Express, Drizzle ORM, Neon-backed PostgreSQL, and Passport.js for authentication.

Key architectural decisions and features include:
-   **Schema-First Development**: `shared/schema.ts` defines all data models.
-   **Storage Abstraction**: Database operations are managed via an `IStorage` interface.
-   **Three-Layer Chat Prompt Composition**: AI prompts are constructed from Universe Policy, Character Profile, and Card Overrides.
-   **Visual Bible System**: Ensures visual consistency through a Design Guide, Reference Assets, and Prompt Builder.
-   **Lens-Based User Experience**: Onboarding is customized by user-selected "lens" (Brand, Creative, Knowledge).
-   **Tiered Capability Model**: Features are gated by "Orbit" subscription tiers (Free, Grow, Understand, Intelligence).
-   **Pattern Intelligence Focus**: Analytics are designed for future pattern recognition on session journeys, event ordering, object interaction, and outcome linkage.
-   **UI/UX**: Cinematic dark theme with Cinzel and Inter fonts, accented by a pink-purple-blue gradient.
-   **Three-Tier Navigation System**: Global navigation with product-specific submenus.
-   **Data Sources Integration**: Supports ingestion of external read-only GET APIs with SSRF protection.
-   **Orbit Device System**: Enables Orbit display on thin clients with kiosk mode and voice interaction.
-   **Orbit Signal Schema**: Machine-readable JSON endpoint at `/.well-known/orbit.json` for AI systems.
-   **Guest ICE Builder**: Allows anonymous users to create time-limited ICE previews at `/try` with server-persisted data and rate limiting.
-   **Preview Share Bar**: Facilitates sharing of unclaimed Orbits.
-   **Experience Analytics System**: Client-side tracking for experience and card views.
-   **Multi-Tenant Security**: Implemented with HMAC-SHA256 signed access tokens and per-IP rate limiting.
-   **Stripe Subscription System**: Full subscription billing with webhook synchronization for product plans.
-   **Platform-Agnostic Deployment**: Configurable via environment variables.
-   **Email & Notifications System**: Transactional emails via Resend and in-app notifications.
-   **Interactivity Nodes**: Supports conversational AI character interaction between cards in live previews.
-   **Story-Specific Character AI**: Characters extracted from story content with unique personas for in-character responses.
-   **Card Pace Controls**: Preview modal includes Slow/Normal/Fast pace controls for card auto-advance timing.
-   **Story Fidelity Modes**: Content uploads detect type; scripts trigger Script-Exact Mode (parses scenes, dialogue) for card generation, preserving narrative order, while Interpretive Mode summarizes other content.
-   **Selective Expansion**: For scripts, offers scene progress and expansion options (Preview Only, Full Story, Act 1).
-   **Guided First-Run Experience**: A light, skippable walkthrough on first preview.
-   **Login Does Not Unlock Features**: Login saves progress; payment unlocks media generation, AI interactivity, and publishing.
-   **Guest-First Conversion Model**: Users experience value before identity or payment.
-   **Shopping List / Production Manifest**: Calculates and displays media counts with real-time price updates before checkout.
-   **Download vs Publish**: Download produces a non-interactive video artifact; Publish creates a public, interactive experience requiring a subscription.
-   **Editor Transition**: Users transition from Preview Editor to Professional/Production Editor post-upgrade.
-   **Canonical Routing Rules**: Specific routes for CTAs like "Launch Interactive Builder" (`/try`), "Sign In" (`/login`), and "Dashboard" (`/dashboard`), emphasizing guest-first creation.
-   **Website Extraction System**: Automatically detects and extracts product/menu data from business websites using Site Detection, Multi-Page Crawling, Quality Validation, and Image Filtering. Includes Site Fingerprinting and DOM Extraction Strategies (Microdata/Schema.org, Repeating Sibling Patterns, Image + Price Cards).
-   **Orbit System**: Extracts product/menu catalogues (50-200+ items) from diverse business websites, utilizing Site Fingerprinting, Multi-Page Crawling, AI-Based Extraction (GPT-4o-mini), Quality Validation, and Image Filtering. It supports `catalogue`, `menu`, `service`, and `hybrid` business types.
-   **High-Signal Business Data Extraction**: Captures richer business context beyond products/menus, including `faq`, `team_member`, `business_profile`, `contact`, `opening_hours`, `testimonial`, and `trust_signal` as new box types. An on-demand enrichment API (`/api/orbit/:slug/enrich`) crawls high-signal pages to generate a `seedingSummary` and `aiContext`.
-   **Launchpad Hub**: A unified command center (`/launchpad`) combining Orbit metrics with IceMaker content creation, featuring a two-column layout for insights and the IceBuilder panel, and a bottom strip for recent drafts.
-   **Title Packs System**: Provides professional typography presets for ICE card captions, replacing manual controls. Packs include Neon Impact, Cinematic Subtitles, Grunge Tape, Editorial Minimal, and Hyper Cut, with smart text fitting utilities.
-   **Video Export System**: Server-side FFmpeg-based video export for ICE previews. Creates downloadable MP4 videos with Title Pack caption overlays, TTS narration audio, and optional background music. Supports three quality levels (draft/standard/HD) with background job processing and progress tracking. Export jobs are stored in `video_export_jobs` table with status polling API.
-   **Auto-Testimonial Capture System**: Automatically detects customer praise in Orbit chat conversations using AI-powered sentiment analysis. Features include rule-based pre-filtering (praise/complaint/legal keywords), GPT-4o-mini classification for topic/sentiment/specificity scoring, risk flag detection, quote cleaning with variant generation (short/medium/long), consent management (name+town or anonymous), and export formatting for website/TikTok/case study. Managed via Social Proof Library UI at `/orbit/:slug/proof`. Uses a multi-step flow: (1) detect praise → ask contextual question to draw out detail, (2) collect detailed feedback → ask for consent, (3) handle consent response.
-   **Business-Type-Aware Chat System**: Orbit chat automatically detects business type from content keywords and box types, adjusting system prompts and language accordingly. Supports: recruitment agencies (jobs/careers language), restaurants (menu/dishes language), retail (products language), and professional services (services language). Prevents misclassification errors like treating employment agencies as restaurants.
-   **Hero Posts System**: Allows Orbit owners to add their best-performing social media posts for AI-powered pattern analysis. Features include: platform auto-detection (LinkedIn, X, Instagram, Facebook, YouTube, TikTok), OpenGraph metadata fetching with SSRF protection, GPT-4o-mini extraction of topics/hooks/intent/proof points, aggregated insights (top themes, hook types, proof patterns), and AI-generated follow-up post suggestions. Status flow: pending → enriching → ready/needs_text/error. UI at `/orbit/:slug/hero-posts` with filters, bulk add, and insights panel.

## External Dependencies
-   **OpenAI API**: For chat completions (gpt-4o-mini) and Text-to-Speech (TTS).
-   **Kling AI API**: For video generation.
-   **Replicate API**: For alternative video generation models.
-   **Stripe**: For subscription billing and payment processing.
-   **Resend**: For transactional email delivery.
-   **Replit Object Storage (R2/S3-compatible)**: For file storage.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.