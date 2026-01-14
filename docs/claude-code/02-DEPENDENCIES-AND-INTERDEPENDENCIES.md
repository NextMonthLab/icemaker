# Dependencies and Interdependencies

## Dependency Graph by Area

### ICE Creation Flow
```
Content Upload ──► Document Parser ──► Brief Parser ──► Card Generator
                                                             │
                                                             ▼
                                                     ice_previews table
                                                             │
                         ┌───────────────────────────────────┼───────────────────────────────────┐
                         ▼                                   ▼                                   ▼
                  Image Generation                    Video Generation                    TTS Generation
                  (OpenAI DALL-E)                    (Kling / Replicate)                  (OpenAI TTS)
                         │                                   │                                   │
                         ▼                                   ▼                                   ▼
                  Object Storage                      Object Storage                      Object Storage
                         │                                   │                                   │
                         └───────────────────────────────────┼───────────────────────────────────┘
                                                             ▼
                                                      Playback UI
                                                  (PreviewPage, PublishedIcePage)
```

### Authentication Flow
```
Login Request ──► Passport Local Strategy ──► bcrypt verify ──► Session Create
                                                                      │
                                                                      ▼
                                                               PostgreSQL Session Store
                                                                      │
                         ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
                         ▼                                            ▼                                            ▼
                  requireAuth middleware                    Entitlements Check                           Tenant Isolation
                  (checks req.isAuthenticated)              (getFullEntitlements)                        (owner_user_id checks)
                         │                                            │                                            │
                         ▼                                            ▼                                            ▼
                  Protected Routes                            Feature Gating                              Data Access
                  (my-previews, checkout)                     (AI limits, storage)                        (only own ICEs)
```

### Billing Flow
```
Stripe Checkout ──► Webhook Handler ──► Update creator_profiles
                                               │
                                               ▼
                                        plan_id assignment
                                               │
                                               ▼
                                        Entitlements recalc
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         ▼                     ▼                     ▼
                  Storage Limits         AI Generation          Feature Flags
                  (storageLimitBytes)    Limits (daily)         (video, custom chars)
```

---

## "If You Change X, Check Y" Lists

### Card Transitions (client/src/components/preview/)
If you change:
- `MediaPreloader.tsx` → Check `PreviewPlayer.tsx`, card state sync
- Card animation timing → Check `displayedCardIndex`/`pendingCardIndex` logic
- Image/video loading → Check timeout fallback (prevents hanging)

### ICE Player
If you change:
- `PreviewPage.tsx` → Check `PublishedIcePage.tsx` (share same components)
- Card data structure → Check `IceCardEditor.tsx`, `GuestIceBuilderPage.tsx`
- AI character chat → Check `chatRateLimiter`, message validation

### API Contracts
If you change:
- Response shape in `routes.ts` → Check corresponding frontend query
- Error response format → Check frontend error handlers
- Authentication requirements → Check frontend auth state handling

### Storage URLs
If you change:
- Object storage paths → Check `ObjectStorageService.ts`
- Public/private prefixes → Check `/objects/:path` route
- Signed URL generation → Check expiry times

### Pricing Guards / Quotas
If you change:
- `entitlements.ts` → Check all `getFullEntitlements()` usages
- Plan tiers in database → Check frontend tier displays
- Usage limits → Check both server enforcement AND frontend UI

---

## Known Fragile Points

### Race Conditions
1. **Concurrent card updates**: Multiple browser tabs editing same ICE
   - Location: `PUT /api/ice/preview/:id/cards`
   - Risk: Last write wins, potential data loss
   - Mitigation: Full card array replacement (not partial)

2. **Video generation polling**: Status checks during generation
   - Location: `server/video/index.ts`
   - Risk: Stale status, orphaned jobs
   - Mitigation: Timeout limits, cleanup jobs

### Async Flows
1. **Media generation**: User-triggered, runs in background
   - Cannot block request/response cycle
   - Frontend polls for completion
   - Error states must be surfaced to UI

2. **Brief parsing**: May take time for large documents
   - Location: `server/services/briefParser.ts`
   - Uses streaming where possible

### Timeouts
1. **OpenAI calls**: Default timeout, may fail on slow responses
   - Mitigation: p-retry with exponential backoff

2. **Kling video generation**: Can take 60+ seconds
   - Polling endpoint: `/api/cards/:id/video/status`
   - Frontend handles long waits with progress UI

3. **Session expiry**: Default session duration
   - Location: Session middleware in `routes.ts`
   - Frontend detects 401 and redirects to login

### Retries
1. **AI generation retries**: Handled by p-retry
   - Max retries: 3 with exponential backoff
   - Fails gracefully with user-facing error

2. **Stripe webhooks**: Stripe retries failed webhooks
   - Idempotency keys prevent duplicate processing

---

## Critical File Dependencies

### shared/schema.ts
**Depends on**: Nothing (source of truth)
**Depended on by**:
- `server/storage.ts` - All database operations
- `server/routes.ts` - Request/response types
- `client/src/lib/types/` - Frontend type imports
- Drizzle migrations - Schema sync

### server/routes.ts
**Depends on**:
- `shared/schema.ts` - Types
- `server/storage.ts` - Database operations
- `server/entitlements.ts` - Feature gating
- All services, jobs, video modules

**Depended on by**:
- Frontend (via HTTP API calls)

### server/storage.ts
**Depends on**:
- `shared/schema.ts` - Table definitions
- Database connection (DATABASE_URL)

**Depended on by**:
- `server/routes.ts` - All API handlers
- `server/jobs/` - Background jobs

### client/src/lib/queryClient.ts
**Depends on**: Nothing external
**Depended on by**:
- All frontend pages using TanStack Query
- All mutations (apiRequest helper)

---

## Module Boundaries

### Server Modules (can be safely refactored in isolation)
- `server/services/briefParser.ts` - Self-contained parsing logic
- `server/tts/` - TTS generation, minimal external deps
- `server/caption-engine/` - Caption rendering
- `server/jobs/` - Background job definitions

### Shared Modules (changes ripple widely)
- `shared/schema.ts` - Affects everything
- `server/entitlements.ts` - Affects all feature-gated code
- `server/storage.ts` - Affects all database operations

### Frontend Modules (can be safely refactored)
- `client/src/caption-engine/` - Isolated caption system
- `client/src/remotion/` - Video composition
- Individual page components (mostly self-contained)
