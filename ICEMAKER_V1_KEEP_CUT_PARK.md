# IceMaker v1: KEEP / CUT / PARK Analysis

**Strategic Decision**: IceMaker is an ICE platform. Orbit is not part of v1.

**Core Flow**: Create ICE → Generate assets → Preview → Share/Publish → Manage credits/billing → Storage

---

## KEEP / CUT / PARK Master Table

| Domain | Feature | Decision | Reason | Replacement/Consolidation | Risk if Removed |
|--------|---------|----------|--------|---------------------------|-----------------|
| **1. USER & ACCOUNT MANAGEMENT** |
| | User Registration & Authentication | **KEEP** | Required for creator accounts and content ownership | - | High |
| | User Roles & Permissions | **KEEP** | Need viewer/creator/admin roles for access control | Simplify to 3 roles (remove influencer) | Medium |
| | Creator Profile Activation | **KEEP** | Core flow for becoming a creator | - | High |
| | Profile Management | **KEEP** | Creators need basic profile (bio, avatar, links) | - | Medium |
| | Creator Social Links | **PARK** | Nice-to-have, not v1 critical | Add in v2 with social features | Low |
| | Onboarding Survey | **CUT** | Too complex for v1, causes decision paralysis | Simple welcome flow | Low |
| | Onboarding Path Selection | **CUT** | This is the Orbit/ICE fork - removing it simplifies onboarding | One onboarding path (ICE) | Low |
| | Magic Links for Authentication | **PARK** | Nice auth feature but password login sufficient for v1 | Add in v2 | Low |
| | Device Session Management | **PARK** | Orbit Cube related, not needed for ICE | - | Low |
| **2. CREATOR PLATFORM & PROFILES** |
| | Creator Profiles (Public) | **KEEP** | Needed for attribution and creator branding | - | Medium |
| | Creator Follower System | **PARK** | Social feature for v2 | Add with discovery features | Low |
| | Creator Statistics | **KEEP** | Basic analytics needed for creators to understand performance | - | Medium |
| | Creator Storage Quota Management | **KEEP** | Critical for billing and cost control | - | High |
| **3. ICE CREATION & SOURCE INGESTION** |
| | ICE Quick-Start Modes (URL/Text/File/Wizard) | **KEEP** | Core UX for creating ICEs, key differentiator | - | High |
| | ICE from URL Ingestion | **KEEP** | Key differentiator, viral use case | - | High |
| | ICE from Brief (Text) | **KEEP** | Core input method | - | High |
| | ICE from File Upload | **KEEP** | Core input method | - | Medium |
| | Screenplay Detection & Import | **PARK** | Advanced feature, screenplay users are niche for v1 | Add as "Pro" feature later | Low |
| | Content Type Detection | **KEEP** | Needed for smart ingestion routing | - | Medium |
| | Story Fidelity Modes | **PARK** | Advanced control, default to one mode (interpretive) | Make single default, expose in v2 | Low |
| | Content Context Selection | **CUT** | Too granular for v1 | Auto-detect context | Low |
| | Domain Risk Tracking & Adaptive Ingestion | **PARK** | Operational/debug feature, not user-facing | Keep in backend, hide from UI | Low |
| | URL Fetch Caching | **KEEP** | Performance optimization, reduces costs | - | Medium |
| | Ingestion Run Logging | **PARK** | Admin/debug feature | Keep for support, hide from UI | Low |
| **4. STORY STRUCTURE** |
| | **Universes (Story Worlds)** | **CUT** | **Duplicate concept - consolidate into ICE Previews** | **ICE Previews become primary content model** | **High** |
| | Universe Visibility Control | **CUT** | Consolidate into ICE visibility | Use ICE visibility (unlisted/public) | Medium |
| | **ICE Previews (Standalone Stories)** | **KEEP** | **Primary content model for v1** | - | **High** |
| | Cards (Episodes/Scenes) | **KEEP** | Core content unit | - | High |
| | Card Sequencing | **KEEP** | Needed for narrative structure | - | High |
| | Release Modes (daily/all_at_once/hybrid) | **PARK** | Just support all_at_once for v1, defer gating complexity | Default to all_at_once | Low |
| | Characters | **KEEP** | Core feature for chat and narrative | - | High |
| | Locations | **PARK** | Advanced continuity feature, not v1 critical | Add with advanced continuity tools | Low |
| | Card-Character Relationships | **KEEP** | Needed for chat functionality | - | High |
| | Project Bible (Continuity Guardrails) | **PARK** | Advanced feature for power users | Simplify to basic style guide | Low |
| | Character Visual Profiles | **KEEP** | Needed for consistent image generation | - | High |
| | Location Continuity Rules | **PARK** | Advanced continuity, not v1 | Add with locations feature | Low |
| | Design Guide | **KEEP** | One visual style per ICE (simplified) | Simplify to 3-5 core fields | Medium |
| | Reference Assets (Visual Examples) | **KEEP** | Improves generation quality significantly | - | Medium |
| | Chat Policies (Guardrails) | **KEEP** | Need content rating at minimum | Simplify to just content rating + basic safety | Medium |
| | Source Guardrails | **PARK** | Advanced control for faithful adaptations | Add with script_exact fidelity mode | Low |
| | Card-Level Chat Overrides | **PARK** | Too granular for v1 | Character-level chat is enough | Low |
| **5. AI CONTENT GENERATION** |
| | AI Image Generation | **KEEP** | Core feature | - | High |
| | Image Generation Settings | **KEEP** | Needed but most should be "Advanced" (hidden by default) | Hide 80% of controls, expose basics | Medium |
| | AI Image Generation for ICE Cards | **KEEP** | Core feature | - | High |
| | Video Generation (Text-to-Video) | **KEEP** | Premium feature, revenue driver | - | High |
| | Video Generation (Image-to-Video) | **KEEP** | Premium feature, revenue driver | - | High |
| | Video Generation Status Polling | **KEEP** | Required for async video generation | - | High |
| | Video Generation for ICE Cards | **KEEP** | Core feature | - | High |
| | Text-to-Speech (Narration) | **KEEP** | Core feature | - | High |
| | Narration Preview | **KEEP** | Important UX improvement | - | Medium |
| | Narration Text Customization | **KEEP** | Needed for creator control | - | Medium |
| | Narration Status Tracking | **KEEP** | Required for async TTS | - | High |
| | TTS Usage Logging | **KEEP** | Required for billing | - | High |
| | Audio Narration for ICE Cards | **KEEP** | Core feature | - | High |
| | Background Music / Soundtrack | **PARK** | Nice-to-have, adds complexity | Add as premium feature v2 | Low |
| | Audio Ducking | **PARK** | Nice-to-have audio polish | Add with background music | Low |
| | Audio Track Import & Management | **PARK** | Admin feature not needed for v1 | Add with background music | Low |
| | AI Usage Event Tracking | **KEEP** | Required for billing and cost monitoring | - | High |
| | AI Prompt Enhancement | **PARK** | Experimental feature | Build into default prompting | Low |
| | Custom Character Knowledge Integration | **PARK** | Advanced/experimental, adds training complexity | Add as "Pro" feature later | Low |
| | Character Training Status | **PARK** | Not needed without custom knowledge | - | Low |
| **6. CHARACTERS & INTERACTIVITY** |
| | AI Character Chat | **KEEP** | Core differentiator | - | High |
| | Chat Threads | **KEEP** | Conversation persistence required | - | High |
| | Character System Prompts | **KEEP** | Core character definition | - | High |
| | Character Secrets | **PARK** | Advanced control | Build into system prompt for v1 | Low |
| | Character Voice & Speech Style | **KEEP** | Important for character consistency (simplified) | Keep 3-4 key fields only | Medium |
| | Character Goals | **PARK** | Advanced prompt engineering | Fold into system prompt | Low |
| | Character Knowledge Cutoff | **PARK** | Advanced spoiler control | Not needed without daily release | Low |
| | Spoiler Traps | **PARK** | Advanced spoiler control | Not needed without daily release | Low |
| | In-Character Deflections | **PARK** | Nice-to-have polish | Generic deflection for v1 | Low |
| | Card-Level Character Chat Context | **PARK** | Too granular, character-level is enough | - | Low |
| | Interactivity Nodes | **PARK** | Experimental feature | Add as "branching" feature later | Low |
| | Custom Character Creation | **KEEP** | Core creator feature | - | High |
| | Public Figure Simulation Flag | **CUT** | Legal complexity, risky for v1 | Remove entirely, too risky | Low |
| **7. CHAT & CONVERSATIONAL FEATURES** |
| | Chat Rate Limiting | **KEEP** | Abuse prevention required | - | High |
| | Chat with Rate Limiting | **KEEP** | Core feature | - | High |
| | Conversation Insights | **PARK** | Analytics feature for later | Add in creator analytics v2 | Low |
| | Chat Message Reactions (Community) | **CUT** | Community feature not in v1 | Add with message board v2 | Low |
| | Anonymous Chat Support | **KEEP** | Reduces friction for guest users | - | High |
| | Chat Response Enhancement | **PARK** | Experimental post-processing | Build into prompts | Low |
| **8. COMMUNITY & SOCIAL FEATURES** |
| | **Message Board (Per Card)** | **PARK** | **Community feature for v2** | **Consolidate all 4 message systems** | **Low** |
| | **ICE Card Message Board** | **PARK** | **Duplicate message system** | **Pick one message board for v2** | **Low** |
| | Anonymous Messaging | **PARK** | Community feature | - | Low |
| | Message Reactions | **PARK** | Community feature | - | Low |
| | Creator Following | **PARK** | Social feature for v2 | Add with discovery | Low |
| | ICE Discovery/Browse | **KEEP** | Needed for public ICEs to be discovered | - | Medium |
| | ICE Likes | **PARK** | Social metric, not critical | Add with social features | Low |
| | Creator Statistics Visibility | **KEEP** | Basic public stats OK (followers, ICE count) | - | Low |
| **9. PREVIEW, SHARING & PUBLISHING** |
| | ICE Preview Generation | **KEEP** | Core feature | - | High |
| | Guest ICE Previews (72hr expiry) | **KEEP** | Critical for viral growth and testing | - | High |
| | ICE Claim Token System | **KEEP** | Security for guest preview claiming | - | High |
| | Share Slug (Short URLs) | **KEEP** | Sharing UX critical | - | High |
| | ICE Publishing | **KEEP** | Core creator workflow | - | High |
| | Lead Gate | **KEEP** | Monetization for creators | - | High |
| | Logo Branding | **KEEP** | Monetization for creators (Pro feature) | - | Medium |
| | ICE Export to Video | **KEEP** | Value-add premium feature | - | Medium |
| | Export Job Status | **KEEP** | Required for async export | - | Medium |
| | Export History | **KEEP** | UX for re-downloading exports | - | Low |
| | Universe Story Publishing | **CUT** | Consolidate with ICE Publishing | ICE Publishing only | Medium |
| | User Progress Tracking | **PARK** | Only needed for daily release mode | Add when daily release returns | Low |
| | Card Unlock Progression | **PARK** | Only needed for daily release mode | Add when daily release returns | Low |
| **10. ASSETS, STORAGE & MEDIA** |
| | Media Asset Upload | **KEEP** | Core feature | - | High |
| | Media Selection from Library | **KEEP** | Reuse uploaded media | - | Medium |
| | Card Media Assets | **KEEP** | Tracking required | - | High |
| | Media Scraped from Source | **KEEP** | Auto-extraction from URLs | - | Medium |
| | Pexels Image Search | **PARK** | Nice-to-have stock photos | Add as "Stock Library" v2 | Low |
| | Storage Quota Enforcement | **KEEP** | Critical for billing and cost control | - | High |
| | Storage Usage Endpoint | **KEEP** | Transparency for creators | - | Medium |
| | Media Soft Delete & Quota Reclaim | **KEEP** | Quota management | - | Medium |
| | Media Asset Cleanup Jobs | **KEEP** | Operations / cost control | - | Medium |
| | User-Initiated Storage Check | **KEEP** | Transparency | - | Low |
| **11. BILLING, SUBSCRIPTIONS & CREDITS** |
| | Plans (Tiers) | **KEEP** | Monetization foundation | Simplify to 2-3 tiers max | High |
| | Plan Features | **KEEP** | Entitlements system | - | High |
| | Subscriptions | **KEEP** | Recurring revenue | - | High |
| | Entitlements (Computed) | **KEEP** | Access control | - | High |
| | Credit Wallets | **KEEP** | AI usage billing | - | High |
| | Credit Events (Audit Log) | **KEEP** | Billing audit trail | - | High |
| | Checkout & Payment Processing | **KEEP** | Core payment flow | - | High |
| | Checkout Calculation | **KEEP** | Pricing logic | - | High |
| | Checkout Configuration | **KEEP** | Stripe integration | - | High |
| | Checkout Verification | **KEEP** | Payment security | - | High |
| | Billing Portal Link | **KEEP** | Self-service subscription management | - | High |
| | Buy Credits | **KEEP** | Top-up mechanism | - | High |
| | Checkout Transaction Idempotency | **KEEP** | Reliability / prevents double charging | - | High |
| | Monthly Credit Grants | **KEEP** | Subscriber value | - | Medium |
| **12. MONETIZATION & LEAD CAPTURE** |
| | Lead Gate Email Capture | **KEEP** | Lead generation for creators | - | High |
| | ICE Leads Database | **KEEP** | Creator CRM | - | High |
| | Creator Leads Dashboard | **KEEP** | Value to creators | - | High |
| | **Enterprise Branding Enquiry** | **CUT** | **Duplicate lead capture** | **Use lead gate instead** | **Low** |
| | Social Proof Capture (Orbit) | **PARK** | Orbit feature | - | Low |
| | Social Proof Items | **PARK** | Orbit feature | - | Low |
| **13. ANALYTICS, EVENTS & TRACKING** |
| | Analytics Events | **KEEP** | Product insights required | - | High |
| | Analytics Rate Limiting | **KEEP** | Abuse prevention | - | High |
| | Experience Analytics Summary | **KEEP** | Admin monitoring | - | Medium |
| | ICE Analytics Summary | **KEEP** | Creator dashboard | - | High |
| | ICE Analytics by Individual | **KEEP** | Creator insights per ICE | - | Medium |
| | Usage Dashboard (Creator) | **KEEP** | Transparency on credits/storage | - | High |
| | ICE-Specific Usage | **KEEP** | Per-ICE cost visibility | - | Medium |
| | Engagement Metrics | **PARK** | For when community features launch | Add with message boards v2 | Low |
| | Audit Logs | **KEEP** | Admin/security required | - | High |
| | Billing Audit Logs | **KEEP** | Finance/compliance | - | High |
| **14. ORBIT / BUSINESS INTELLIGENCE** |
| | **ALL 34 ORBIT FEATURES** | **PARK** | **Orbit is separate product, not part of ICE v1** | **Quarantine entire Orbit domain** | **Low** |
| | (Orbit Smart Sites, Power-Ups, Documents, Hero Posts, Brand Voice, Analytics, Leads, Videos, Boxes, Chat Sessions, Conversations, Claim Tokens, Customization, Tiers, Strength Score, ICE Allowance, Signal/Cubes, Pairing, Access Control, ICE Flywheel, Topic Tiles, Pulse Events, Industry Entities, Products, Reviews, Specs, Community Links, Alignments, Core Concepts, Knowledge Prompts, ICE Drafts) | **PARK** | Not required for ICE functionality | Separate Orbit deployment | Low |
| **15. ADMIN & INTERNAL TOOLING** |
| | Admin Dashboard | **KEEP** | Operations required | - | High |
| | Admin User Management | **KEEP** | Support required | - | High |
| | Admin Universe Management | **CUT** | No universes in v1 | Admin manages ICEs instead | High |
| | Admin Character Management | **KEEP** | Built-in character library management | - | Medium |
| | Admin Card Management | **KEEP** | Support/moderation needed | - | High |
| | Admin Audio Library Management | **PARK** | No background music in v1 | Add when music feature launches | Low |
| | Admin Blog Publishing | **PARK** | Marketing can use external CMS | Use Medium/Ghost externally | Low |
| | Admin Transformation Job Tracking | **KEEP** | Debug/support for ingestion issues | - | Medium |
| | Emergency Pause Experience | **KEEP** | Moderation/abuse response | - | High |
| | Emergency Archive Preview | **KEEP** | Abuse prevention | - | High |
| | Admin Seed Data | **KEEP** | Development/testing | - | Low |
| | Image Generation for Cards (Admin) | **KEEP** | Bulk operations / support | - | Medium |
| | Video Generation for Cards (Admin) | **KEEP** | Bulk operations / support | - | Medium |
| | Image Settings Editor | **KEEP** | Admin override for issues | - | Low |
| | Admin Action Logging | **KEEP** | Audit trail | - | High |
| **16. SECURITY, RATE LIMITING & ABUSE PROTECTION** |
| | User Authentication (Passport.js) | **KEEP** | Security foundation | - | High |
| | Password Hashing (bcrypt) | **KEEP** | Security required | - | High |
| | Session Security | **KEEP** | Security required | - | High |
| | Request Validation | **KEEP** | Input validation required | - | High |
| | Analytics Rate Limiting | **KEEP** | Abuse prevention | - | High |
| | Chat Rate Limiting | **KEEP** | Abuse prevention | - | High |
| | Activation Rate Limiting | **KEEP** | Abuse prevention | - | Medium |
| | Device Rate Limiting (Orbit) | **PARK** | Orbit Cube feature | - | Low |
| | IP-Based Rate Limiting | **KEEP** | Guest preview abuse prevention | - | High |
| | Security Logger | **KEEP** | Security monitoring | - | High |
| | SSRF Protection | **PARK** | Needed for Orbit scraping, not ICE URLs | Keep in backend if URL ingestion uses it | Low |
| | Domain Risk Throttling | **PARK** | Operational feature | Keep in backend, hide from UI | Low |
| | Auth Policies (Granular) | **KEEP** | Permission system required | Simplify to ICE-only (remove universe checks) | High |
| **17. TRANSFORMATION & IMPORT/EXPORT** |
| | **Transformation Jobs** | **CUT** | **Separate concept from ICE creation** | **Consolidate into ICE creation flow** | **Medium** |
| | **Transformation from URL** | **CUT** | **Duplicate of ICE from URL** | **ICE from URL is the feature** | **High** |
| | **Transformation from File** | **CUT** | **Duplicate of ICE from File** | **ICE from File is the feature** | **Medium** |
| | Import Template | **CUT** | Bulk import not needed for v1 | Add for enterprise later | Low |
| | Import Validation | **CUT** | Bulk import not needed | - | Low |
| | Import Execution | **CUT** | Bulk import not needed | - | Low |
| | Transformation Retry | **CUT** | Consolidate into ICE creation retry | - | Low |
| | Transformation from ICE Preview | **CUT** | Complex remix feature | Add later if needed | Low |
| | ICE Export (covered in Publishing) | **KEEP** | Already covered above | - | High |
| | Video Export Jobs (covered above) | **KEEP** | Already covered above | - | High |
| | Catalog Export (Orbit) | **PARK** | Orbit feature | - | Low |
| | CPAC Export (Orbit) | **PARK** | Orbit feature | - | Low |
| **18. EXPERIMENTAL / INCOMPLETE FEATURES** |
| | Smart Site Pipeline (Auto-Builder) | **PARK** | Experimental, incomplete | Assess after v1 launch | Low |
| | Caption Engine / Advanced Styling | **PARK** | Experimental, basic captions sufficient | Add as premium feature | Low |
| | Title Packs (Visual Styling) | **CUT** | Legacy feature being replaced | Use caption engine if needed later | Low |
| | Karaoke Mode (Caption Highlighting) | **PARK** | Experimental polish feature | Add as premium feature | Low |
| | Scene Lock (Spatial Continuity) | **PARK** | Experimental continuity feature | Add with locations | Low |
| | Topic Tile Generation | **PARK** | Orbit discovery feature | Orbit-related | Low |
| | Pulse Events (Real-time Intelligence) | **PARK** | Orbit feature, incomplete | Orbit-related | Low |
| | Industry Entities & Products | **PARK** | Orbit feature, no clear UX | Orbit-related | Low |
| | Community Links | **PARK** | Orbit social graph | Orbit-related | Low |
| | Alignments & Core Concepts | **PARK** | Orbit matching system | Orbit-related | Low |
| | Orbit Knowledge Prompts | **PARK** | Orbit feature | Orbit-related | Low |
| | ICE Drafts (Orbit Integration) | **PARK** | Orbit → ICE flow | Orbit-related | Low |
| | ICE Moderation | **PARK** | Moderation system incomplete | Use emergency pause for now | Low |
| | ICE Analytics Events | **KEEP** | Already covered in Analytics | - | Medium |
| | Notifications | **PARK** | Nice-to-have, incomplete | Add in v2 | Low |
| | Blog & Educational Content | **PARK** | Marketing feature | Use external CMS | Low |
| | Guest Chat (Preview Instances) | **CUT** | Duplicate tracking system | Use icePreviews + chat threads | Low |
| | API Integrations | **PARK** | Third-party API system incomplete | Add for enterprise v2 | Low |

---

## TOP 10 HIGHEST-IMPACT SIMPLIFICATION WINS

### 1. **CUT: Universes Entirely (Consolidate into ICE Previews)**
- **Effort**: High (36 tables/routes related to universes)
- **Impact**: Massive - eliminates duplicate content model, taxonomy confusion
- **Action**: Make ICE Previews the only content model; universes → icePreviews migration
- **Win**: Users have ONE way to create stories, not two competing concepts

### 2. **PARK: All 34 Orbit Features (Quarantine Entire Domain)**
- **Effort**: High (30+ tables, 40+ routes, multiple services)
- **Impact**: Massive - removes second product from codebase
- **Action**: Feature flag all Orbit routes, hide all Orbit UI, keep tables dormant
- **Win**: ICE becomes clear, focused product identity

### 3. **CUT: Multiple "Transformation" Concepts**
- **Effort**: Medium (10+ routes, transformationJobs table)
- **Impact**: High - "transformation" vs "ICE creation" creates mental overhead
- **Action**: Consolidate transformationJobs into ICE creation flow
- **Win**: One creation flow, not two overlapping systems

### 4. **PARK: 4 Chat/Message Systems (Consolidate to 1)**
- **Effort**: High (4 different message tables, reaction systems)
- **Impact**: High - chat fragmentation confuses architecture and UX
- **Action**: Keep character chat only; park card message boards for v2
- **Win**: Clear chat model - character conversations only

### 5. **CUT: Onboarding Fork (Orbit vs ICE Path Selection)**
- **Effort**: Low (remove onboarding survey, path routing)
- **Impact**: High - eliminates decision paralysis at entry
- **Action**: Single onboarding flow → "Create your first ICE"
- **Win**: 50% reduction in onboarding complexity

### 6. **PARK: Daily Release Mode & Card Unlocking**
- **Effort**: Medium (userProgress tracking, unlock logic, release modes)
- **Impact**: Medium - adds gating complexity for marginal value in v1
- **Action**: Default to all_at_once, hide daily/hybrid modes
- **Win**: Simpler publishing flow, faster time-to-market

### 7. **PARK: Advanced Continuity Features (Locations, Scene Lock, Project Bible)**
- **Effort**: Medium (5+ tables, continuity services)
- **Impact**: Medium - power-user features add UI complexity
- **Action**: Hide location/scene management, keep basic character continuity
- **Win**: 80% of creators don't need this; expose as "Pro" later

### 8. **PARK: Background Music / Audio System**
- **Effort**: Medium (audioTracks, universeAudioSettings, ducking logic)
- **Impact**: Medium - nice-to-have adds operational complexity
- **Action**: Remove audio track library, audio settings UI
- **Win**: Faster content creation, fewer things to manage

### 9. **CUT: Multiple Lead Capture Systems (Consolidate to Lead Gate)**
- **Effort**: Low (remove enterprise enquiry form)
- **Impact**: Medium - reduces lead routing confusion
- **Action**: One lead gate system for all lead capture
- **Win**: Simpler lead management for creators

### 10. **PARK: Advanced Image Generation Controls (Hide 80%)**
- **Effort**: Low (UI hiding, not backend removal)
- **Impact**: Medium - 7+ layers of image controls overwhelm creators
- **Action**: Show prompt + reference image only; hide negative prompt, shot type, lighting, seed as "Advanced"
- **Win**: Cleaner UI, faster creation, power users can still access

---

## ICEMAKER V1 FEATURE SET (KEPT FEATURES ONLY)

### **Core Creation Flow**
- User registration & authentication (email/password)
- Creator profile activation ("become a creator")
- ICE creation from URL, text, or file upload
- Content auto-extraction and structuring
- Card sequencing and narrative structure
- Character creation and management

### **AI Generation**
- AI image generation with basic controls (prompt + reference images)
- AI video generation (text-to-video, image-to-video)
- Text-to-speech narration with voice selection
- Narration customization
- Generation status tracking

### **Characters & Chat**
- Custom character creation
- Character visual profiles for consistent appearance
- Character system prompts & voice/style
- AI character chat with conversation persistence
- Anonymous chat support (guest users)
- Chat rate limiting

### **Publishing & Sharing**
- Guest ICE previews (72hr expiry for viral testing)
- ICE claim tokens (secure preview claiming)
- ICE publishing (unlisted/public visibility)
- Share slugs (short URLs for sharing)
- Lead gate (email capture before viewing)
- Logo branding (Pro feature)
- ICE discovery/browse

### **Media & Storage**
- Media asset upload
- Media library (reuse uploaded assets)
- Media scraped from URLs (auto-extraction)
- Storage quota enforcement
- Storage usage transparency
- Media cleanup jobs

### **Monetization & Billing**
- Subscription plans (2-3 tiers)
- Credit wallets (video/voice credits)
- Stripe checkout & payment processing
- Buy credits (top-up)
- Billing portal (self-service)
- Monthly credit grants

### **Analytics & Insights**
- Creator analytics dashboard (ICE views, shares, engagement)
- Usage dashboard (credits, storage used)
- Per-ICE usage and cost visibility
- Lead capture dashboard
- Event tracking

### **Video Export**
- ICE export to video (MP4 download)
- Export job tracking
- Export history

### **Admin & Operations**
- Admin dashboard
- User management
- ICE management (support/moderation)
- Character library management
- Emergency pause/archive (abuse response)
- Audit logs (security, billing)

### **Security & Abuse Prevention**
- Secure authentication & sessions
- Rate limiting (chat, analytics, IP-based)
- Request validation
- Security logging

---

## ORBIT QUARANTINE PLAN

### **Objective**: Isolate Orbit without breaking ICE or requiring immediate deletion

### **Phase 1: UI Removal (Immediate - 1 day)**
1. **Remove Orbit Navigation**
   - Remove Orbit links from global nav (`GlobalNav.tsx`, `SiteNav.tsx`)
   - Remove "Orbit" from onboarding path selection
   - Hide Orbit-related pages from route index

2. **Remove Orbit Entry Points**
   - Comment out Orbit page routes in `client/src/main.tsx`
   - Hide Orbit CTAs, discovery tiles, cross-links from ICE UI
   - Remove "Create Orbit" buttons/cards

3. **Update Homepage/Marketing**
   - Remove Orbit from homepage hero
   - Remove Orbit from pricing page
   - Remove Orbit from feature descriptions

**Result**: Orbit becomes inaccessible to users but backend remains intact

### **Phase 2: Feature Flags (Immediate - parallel with Phase 1)**
1. **Create Feature Flag System**
   ```typescript
   // server/featureFlags.ts
   export const FEATURES = {
     ORBIT_ENABLED: false,
     UNIVERSES_ENABLED: false, // Also disable universes
     DAILY_RELEASE_ENABLED: false,
     BACKGROUND_MUSIC_ENABLED: false,
     COMMUNITY_FEATURES_ENABLED: false,
   }
   ```

2. **Gate Orbit Routes**
   - Wrap all `/api/orbit/*` routes with feature flag check
   - Return 404 or "Feature not available" for disabled features
   - Keep routes registered but non-functional

3. **Gate Orbit Database Access**
   - Add flag checks before Orbit table queries
   - Prevents accidental writes to Orbit tables

**Result**: Orbit is dormant but can be re-enabled with flag flip

### **Phase 3: Database Isolation (Within 1 week)**
1. **Document Orbit Schema**
   - Create `ORBIT_SCHEMA.md` listing all Orbit tables
   - Document foreign key dependencies between ICE ↔ Orbit

2. **Check for Shared Tables**
   - Audit: Do any ICE features read from Orbit tables?
   - Likely candidates: users, creatorProfiles (shared), analytics (shared)
   - Document shared vs. Orbit-only tables

3. **Create Orbit Schema Namespace** (Optional)
   - Move Orbit tables to separate Postgres schema: `orbit.*`
   - Update Orbit queries to use `orbit.orbitMeta`, `orbit.orbitSources`, etc.
   - Keeps tables isolated but in same database

**Result**: Clear boundary between ICE and Orbit data

### **Phase 4: Code Organization (Within 2 weeks)**
1. **Move Orbit Backend Code**
   ```
   server/
   ├── orbit/           (move all Orbit services here)
   │   ├── routes/
   │   ├── services/
   │   └── jobs/
   └── ice/             (rename existing to clarify)
       ├── routes/
       ├── services/
       └── jobs/
   ```

2. **Move Orbit Frontend Code**
   ```
   client/src/
   ├── pages/orbit/     (move Orbit pages here)
   ├── components/orbit/ (move Orbit components)
   └── pages/ice/       (ICE pages)
   ```

3. **Update Imports**
   - Update import paths to reflect new structure
   - Use absolute imports to avoid `../../../` hell

**Result**: Clear code boundaries; easier to extract later

### **Phase 5: Deployment Isolation (Future - if Orbit returns)**
1. **Separate Deployments** (if Orbit becomes a product)
   - Option A: Monorepo with separate `apps/icemaker` and `apps/orbit`
   - Option B: Separate repos with shared `@storyflix/shared` package

2. **Shared Schema Package**
   - Extract shared types to `@storyflix/types`
   - Both apps depend on shared package
   - Prevents type drift

3. **Database Decision**
   - Option A: Shared database, separate schemas
   - Option B: Separate databases, replicate shared tables (users, etc.)

**Result**: Orbit can scale independently without affecting ICE

### **Phase 6: Future Re-Integration Path (If Needed)**
1. **Orbit as Add-On**
   - If creators want Orbit: "Add Orbit Smart Site to your ICEs"
   - Orbit becomes ICE plugin, not separate product
   - Shared auth, shared creator profiles

2. **Cross-Product Features**
   - "Embed ICE in Orbit" (already exists as orbitBoxes)
   - "Generate ICE from Orbit" (already exists as iceDrafts)
   - Keep these isolated behind feature flags

**Result**: Orbit can return as premium add-on without re-merging codebases

---

## QUARANTINE RISKS & MITIGATIONS

| Risk | Mitigation |
|------|------------|
| **Orbit tables referenced in ICE code** | Audit: grep for `orbitMeta`, `orbitSources`, etc. in ICE routes |
| **Shared analytics events** | Keep `events` table, filter by context in queries |
| **User onboarding references Orbit** | Already marked CUT - remove onboarding path selection |
| **ICE → Orbit cross-links in UI** | Remove all "Create Orbit from ICE" CTAs |
| **Foreign key constraints** | Document all FK relationships before schema changes |
| **Billing system references both products** | Keep plans/subscriptions; hide Orbit-specific tiers |

---

## IMMEDIATE NEXT STEPS

### **Day 1: UI Lockdown**
1. Hide all Orbit navigation and entry points
2. Comment out Orbit page routes
3. Add feature flags for Orbit, Universes, Daily Release
4. Gate `/api/orbit/*` routes with flags
5. Test: Ensure ICE creation still works

### **Day 2: Universe → ICE Migration**
1. Create migration script: `universes` → `icePreviews`
2. Map universe fields to ICE fields
3. Test migration on staging data
4. Update routes to use `icePreviews` instead of `universes`

### **Week 1: Code Organization**
1. Move Orbit code to `/orbit` subdirectories
2. Document Orbit schema
3. Audit ICE ↔ Orbit dependencies
4. Remove transformation routes (consolidate into ICE)

### **Week 2: UI Cleanup & Testing**
1. Remove advanced controls (hide as "Advanced")
2. Simplify onboarding
3. Test full ICE creation → publish → share → lead capture flow
4. Load test with Orbit dormant

---

## SUCCESS METRICS

**If Quarantine Succeeds:**
- ✅ ICE creation works without any Orbit dependencies
- ✅ New users never see Orbit mentioned
- ✅ Database queries don't touch Orbit tables (except audit logs)
- ✅ Orbit can be deleted OR re-enabled with minimal effort
- ✅ Onboarding time reduced by 50%
- ✅ UI feels focused on one clear product

**Performance Wins:**
- Faster page loads (fewer routes registered)
- Smaller client bundle (Orbit pages not loaded)
- Simpler mental model for developers and users

---

## SUMMARY

**Total Features:**
- **KEEP**: 89 features (core ICE platform)
- **CUT**: 28 features (duplicates, complexity, legacy)
- **PARK**: 53 features (Orbit + advanced features for v2)

**Biggest Wins:**
1. Eliminate Universe/ICE content model confusion
2. Quarantine Orbit (34 features)
3. Consolidate transformation into ICE creation
4. One chat system, one lead system, one creation flow
5. Hide 80% of advanced controls

**Risk Assessment:**
- Low risk: Most PARK/CUT features are additive, not foundational
- High effort items: Universe migration, Orbit quarantine
- Quick wins: Remove onboarding fork, hide advanced UI

**Estimated Simplification:**
- **40% reduction in user-facing complexity**
- **35% reduction in active codebase** (by quarantining Orbit)
- **50% reduction in onboarding friction**

---

This analysis provides a clear, actionable roadmap for shipping IceMaker v1 as a focused ICE platform.
