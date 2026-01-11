import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, desc, asc, inArray, sql, gte, lt } from "drizzle-orm";
import * as schema from "@shared/schema";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export interface IStorage {
  // Users
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  updateUser(id: number, data: Partial<schema.InsertUser>): Promise<schema.User | undefined>;
  getAllUsers(): Promise<schema.User[]>;
  
  // Admin Platform Metrics
  getPlatformMetrics(): Promise<{
    totalUsers: number;
    usersByRole: { role: string; count: number }[];
    totalOrbits: number;
    industryOrbits: number;
    standardOrbits: number;
    totalVisits30d: number;
    totalConversations30d: number;
  }>;
  getIndustryOrbits(): Promise<schema.OrbitMeta[]>;
  
  // Creator Profiles
  getCreatorProfile(userId: number): Promise<schema.CreatorProfile | undefined>;
  getCreatorProfileBySlug(slug: string): Promise<schema.CreatorProfile | undefined>;
  getCreatorWithUser(userId: number): Promise<{ profile: schema.CreatorProfile; user: schema.User } | undefined>;
  createCreatorProfile(profile: schema.InsertCreatorProfile): Promise<schema.CreatorProfile>;
  updateCreatorProfile(userId: number, data: Partial<schema.InsertCreatorProfile>): Promise<schema.CreatorProfile | undefined>;
  getUniversesByCreator(userId: number): Promise<schema.Universe[]>;
  getCreatorForUniverse(universeId: number): Promise<schema.CreatorProfile | undefined>;
  
  // Universe
  getUniverse(id: number): Promise<schema.Universe | undefined>;
  getUniverseBySlug(slug: string): Promise<schema.Universe | undefined>;
  getAllUniverses(): Promise<schema.Universe[]>;
  createUniverse(universe: schema.InsertUniverse): Promise<schema.Universe>;
  updateUniverse(id: number, universe: Partial<schema.InsertUniverse>): Promise<schema.Universe | undefined>;
  deleteUniverse(id: number): Promise<void>;
  deleteUniverseContent(id: number): Promise<void>;
  
  // Characters
  getCharacter(id: number): Promise<schema.Character | undefined>;
  getCharacterBySlug(universeId: number, slug: string): Promise<schema.Character | undefined>;
  getCharactersByUniverse(universeId: number): Promise<schema.Character[]>;
  createCharacter(character: schema.InsertCharacter): Promise<schema.Character>;
  updateCharacter(id: number, character: Partial<schema.InsertCharacter>): Promise<schema.Character | undefined>;
  deleteCharacter(id: number): Promise<void>;
  
  // Cards
  getCard(id: number): Promise<schema.Card | undefined>;
  getCardByDay(universeId: number, season: number, dayIndex: number): Promise<schema.Card | undefined>;
  getCardsByUniverse(universeId: number): Promise<schema.Card[]>;
  getCardsBySeason(universeId: number, season: number): Promise<schema.Card[]>;
  createCard(card: schema.InsertCard): Promise<schema.Card>;
  updateCard(id: number, card: Partial<schema.InsertCard>): Promise<schema.Card | undefined>;
  deleteCard(id: number): Promise<void>;
  deleteAllCardsByUniverse(universeId: number): Promise<number>;
  
  // Card-Character relationships
  linkCardCharacter(cardId: number, characterId: number): Promise<void>;
  unlinkCardCharacter(cardId: number, characterId: number): Promise<void>;
  getCharactersForCard(cardId: number): Promise<schema.Character[]>;
  
  // User Progress
  getUserProgress(userId: number, universeId: number): Promise<schema.UserProgress | undefined>;
  createOrUpdateProgress(progress: schema.InsertUserProgress): Promise<schema.UserProgress>;
  unlockNextCard(userId: number, universeId: number): Promise<schema.UserProgress | undefined>;
  
  // Chat
  getChatThread(userId: number, universeId: number, characterId: number): Promise<schema.ChatThread | undefined>;
  createChatThread(thread: schema.InsertChatThread): Promise<schema.ChatThread>;
  getChatMessages(threadId: number, limit?: number): Promise<schema.ChatMessage[]>;
  addChatMessage(message: schema.InsertChatMessage): Promise<schema.ChatMessage>;
  
  // Events
  logEvent(event: schema.InsertEvent): Promise<void>;
  getExperienceAnalyticsSummary(universeId: number, days?: number): Promise<{
    views: { total: number; last7Days: number };
    conversations: { total: number; last7Days: number };
    completionRate: number;
    topQuestions: string[];
    topCard: { id: number; title: string; views: number } | null;
  }>;
  
  // Locations
  getLocation(id: number): Promise<schema.Location | undefined>;
  getLocationBySlug(universeId: number, slug: string): Promise<schema.Location | undefined>;
  getLocationsByUniverse(universeId: number): Promise<schema.Location[]>;
  createLocation(location: schema.InsertLocation): Promise<schema.Location>;
  updateLocation(id: number, location: Partial<schema.InsertLocation>): Promise<schema.Location | undefined>;
  deleteLocation(id: number): Promise<void>;
  
  // Card Messages (micro message boards)
  getCardMessages(cardId: number, limit?: number): Promise<schema.CardMessage[]>;
  createCardMessage(message: schema.InsertCardMessage): Promise<schema.CardMessage>;
  getCardMessageReactions(messageId: number): Promise<schema.CardMessageReaction[]>;
  addCardMessageReaction(reaction: schema.InsertCardMessageReaction): Promise<schema.CardMessageReaction>;
  removeCardMessageReaction(messageId: number, userId: number | null, anonFingerprint: string | null): Promise<void>;
  
  // Audio Tracks
  getAudioTrack(id: number): Promise<schema.AudioTrack | undefined>;
  getAllAudioTracks(): Promise<schema.AudioTrack[]>;
  getAudioTracksByFilter(mood?: string, genre?: string): Promise<schema.AudioTrack[]>;
  createAudioTrack(track: schema.InsertAudioTrack): Promise<schema.AudioTrack>;
  updateAudioTrack(id: number, track: Partial<schema.InsertAudioTrack>): Promise<schema.AudioTrack | undefined>;
  deleteAudioTrack(id: number): Promise<void>;
  
  // Universe Audio Settings
  getUniverseAudioSettings(universeId: number): Promise<schema.UniverseAudioSettings | undefined>;
  createOrUpdateUniverseAudioSettings(settings: schema.InsertUniverseAudioSettings): Promise<schema.UniverseAudioSettings>;
  
  // Transformation Jobs (Universal Story Engine Pipeline)
  getTransformationJob(id: number): Promise<schema.TransformationJob | undefined>;
  getTransformationJobsByUser(userId: number): Promise<schema.TransformationJob[]>;
  createTransformationJob(job: schema.InsertTransformationJob): Promise<schema.TransformationJob>;
  updateTransformationJob(id: number, job: Partial<schema.InsertTransformationJob>): Promise<schema.TransformationJob | undefined>;
  deleteTransformationJob(id: number): Promise<void>;
  
  // ICE Previews (Guest Builder)
  getIcePreview(id: string): Promise<schema.IcePreview | undefined>;
  getIcePreviewsByUser(userId: number): Promise<schema.IcePreview[]>;
  createIcePreview(preview: schema.InsertIcePreview): Promise<schema.IcePreview>;
  updateIcePreview(id: string, data: Partial<schema.InsertIcePreview>): Promise<schema.IcePreview | undefined>;
  deleteIcePreview(id: string): Promise<void>;
  countIpIcePreviewsToday(ip: string): Promise<number>;
  promoteIcePreview(id: string, userId: number, jobId: number): Promise<schema.IcePreview | undefined>;
  
  // Reference Assets (Visual Bible)
  getReferenceAsset(id: number): Promise<schema.UniverseReferenceAsset | undefined>;
  getReferenceAssetsByUniverse(universeId: number): Promise<schema.UniverseReferenceAsset[]>;
  getReferenceAssetsByType(universeId: number, assetType: schema.ReferenceAssetType): Promise<schema.UniverseReferenceAsset[]>;
  createReferenceAsset(asset: schema.InsertUniverseReferenceAsset): Promise<schema.UniverseReferenceAsset>;
  updateReferenceAsset(id: number, asset: Partial<schema.InsertUniverseReferenceAsset>): Promise<schema.UniverseReferenceAsset | undefined>;
  deleteReferenceAsset(id: number): Promise<void>;
  
  // Plans & Subscriptions
  getPlan(id: number): Promise<schema.Plan | undefined>;
  getPlanByName(name: string): Promise<schema.Plan | undefined>;
  getPlanByStripePriceId(priceId: string): Promise<schema.Plan | undefined>;
  getAllPlans(): Promise<schema.Plan[]>;
  createPlan(plan: schema.InsertPlan): Promise<schema.Plan>;
  
  getSubscription(userId: number): Promise<schema.Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<schema.Subscription | undefined>;
  createSubscription(subscription: schema.InsertSubscription): Promise<schema.Subscription>;
  updateSubscription(id: number, data: Partial<schema.InsertSubscription>): Promise<schema.Subscription | undefined>;
  
  // Entitlements
  getEntitlements(userId: number): Promise<schema.Entitlement | undefined>;
  upsertEntitlements(userId: number, entitlements: Partial<schema.InsertEntitlement>): Promise<schema.Entitlement>;
  
  // Credit Wallets
  getCreditWallet(userId: number): Promise<schema.CreditWallet | undefined>;
  getOrCreateCreditWallet(userId: number): Promise<schema.CreditWallet>;
  addCredits(userId: number, videoCredits: number, voiceCredits: number): Promise<schema.CreditWallet>;
  spendCredits(userId: number, creditType: 'video' | 'voice', amount: number): Promise<schema.CreditWallet>;
  grantMonthlyCredits(userId: number, videoCredits: number, voiceCredits: number): Promise<void>;
  
  // Credit Events
  logCreditEvent(event: schema.InsertCreditEvent): Promise<schema.CreditEvent>;
  
  // Checkout Transactions (idempotency)
  getCheckoutTransactionByKey(idempotencyKey: string): Promise<schema.CheckoutTransaction | undefined>;
  getCheckoutTransactionBySessionId(stripeCheckoutSessionId: string): Promise<schema.CheckoutTransaction | undefined>;
  createCheckoutTransaction(transaction: schema.InsertCheckoutTransaction): Promise<schema.CheckoutTransaction>;
  updateCheckoutTransaction(id: number, data: Partial<schema.InsertCheckoutTransaction>): Promise<schema.CheckoutTransaction | undefined>;
  
  // User Onboarding Profiles
  getUserOnboardingProfile(userId: number): Promise<schema.UserOnboardingProfile | undefined>;
  upsertUserOnboardingProfile(profile: schema.InsertUserOnboardingProfile): Promise<schema.UserOnboardingProfile>;
  
  // Card Media Assets
  getCardMediaAssets(cardId: number): Promise<schema.CardMediaAsset[]>;
  getCardMediaAsset(id: number): Promise<schema.CardMediaAsset | undefined>;
  createCardMediaAsset(asset: schema.InsertCardMediaAsset): Promise<schema.CardMediaAsset>;
  deleteCardMediaAsset(id: number): Promise<void>;
  softDeleteCardMediaAsset(id: number): Promise<void>;
  
  // User Storage Usage
  getUserStorageUsage(userId: number): Promise<schema.UserStorageUsage | undefined>;
  getOrCreateUserStorageUsage(userId: number): Promise<schema.UserStorageUsage>;
  updateStorageUsage(userId: number, deltaBytes: number, deltaImages: number, deltaVideos: number): Promise<schema.UserStorageUsage>;

  // Preview Instances
  getPreviewInstance(id: string): Promise<schema.PreviewInstance | undefined>;
  createPreviewInstance(preview: schema.InsertPreviewInstance): Promise<schema.PreviewInstance>;
  updatePreviewInstance(id: string, data: Partial<schema.InsertPreviewInstance>): Promise<schema.PreviewInstance | undefined>;
  archivePreviewInstance(id: string): Promise<void>;
  getExpiredPreviews(): Promise<schema.PreviewInstance[]>;
  countUserPreviewsToday(userId: number): Promise<number>;
  countIpPreviewsToday(ip: string): Promise<number>;

  // Preview Chat Messages
  getPreviewChatMessages(previewId: string, limit?: number): Promise<schema.PreviewChatMessage[]>;
  addPreviewChatMessage(message: schema.InsertPreviewChatMessage): Promise<schema.PreviewChatMessage>;
  incrementPreviewMessageCount(previewId: string): Promise<void>;
  incrementPreviewMessageCountIfUnderLimit(previewId: string, maxMessages: number): Promise<number | null>;

  // Orbit Meta
  getOrbitMeta(businessSlug: string): Promise<schema.OrbitMeta | undefined>;
  getOrbitMetaById(id: number): Promise<schema.OrbitMeta | undefined>;
  getOrbitMetaByPreviewId(previewId: string): Promise<schema.OrbitMeta | undefined>;
  getOrbitMetaByDomain(domain: string): Promise<schema.OrbitMeta | undefined>;
  getOrbitsByOwner(userId: number): Promise<schema.OrbitMeta[]>;
  createOrbitMeta(data: schema.InsertOrbitMeta): Promise<schema.OrbitMeta>;
  updateOrbitMeta(businessSlug: string, data: Partial<schema.InsertOrbitMeta>): Promise<schema.OrbitMeta | undefined>;
  setOrbitGenerationStatus(businessSlug: string, status: schema.OrbitGenerationStatus, error?: string): Promise<void>;
  setOrbitPackVersion(businessSlug: string, version: string, key: string): Promise<void>;
  setOrbitPreviewId(businessSlug: string, previewId: string): Promise<void>;
  claimOrbit(businessSlug: string, email: string, userId?: number): Promise<void>;
  
  // Orbit Claim Tokens
  createClaimToken(data: schema.InsertOrbitClaimToken): Promise<schema.OrbitClaimToken>;
  getClaimToken(token: string): Promise<schema.OrbitClaimToken | undefined>;
  markClaimTokenUsed(token: string): Promise<void>;

  // Orbit Sources (Power-Up)
  upsertOrbitSources(businessSlug: string, sources: Array<{ label: schema.OrbitSourceLabel; sourceType: schema.OrbitSourceType; value: string }>): Promise<schema.OrbitSource[]>;
  getOrbitSources(businessSlug: string): Promise<schema.OrbitSource[]>;
  updateOrbitTierAndStrength(businessSlug: string, planTier: string, strengthScore: number): Promise<schema.OrbitMeta | undefined>;

  // Hero Posts
  createHeroPost(data: schema.InsertHeroPost): Promise<schema.HeroPost>;
  getHeroPosts(businessSlug: string, filters?: { status?: schema.HeroPostStatus; platform?: schema.HeroPostPlatform; limit?: number }): Promise<schema.HeroPost[]>;
  getHeroPost(id: number): Promise<schema.HeroPost | undefined>;
  getHeroPostByUrl(businessSlug: string, url: string): Promise<schema.HeroPost | undefined>;
  updateHeroPost(id: number, data: Partial<schema.InsertHeroPost>): Promise<schema.HeroPost | undefined>;
  deleteHeroPost(id: number): Promise<void>;
  getHeroPostInsights(businessSlug: string): Promise<schema.HeroPostInsight | undefined>;
  upsertHeroPostInsights(businessSlug: string, data: Partial<schema.InsertHeroPostInsight>): Promise<schema.HeroPostInsight>;
  getHeroPostsAsKnowledge(businessSlug: string): Promise<schema.HeroPost[]>;
  countHeroPostsAsKnowledge(businessSlug: string): Promise<number>;
  toggleHeroPostKnowledge(id: number, useAsKnowledge: boolean): Promise<schema.HeroPost | undefined>;

  // Orbit Videos
  createOrbitVideo(data: schema.InsertOrbitVideo): Promise<schema.OrbitVideo>;
  getOrbitVideos(businessSlug: string, enabledOnly?: boolean): Promise<schema.OrbitVideo[]>;
  getOrbitVideo(id: number): Promise<schema.OrbitVideo | undefined>;
  updateOrbitVideo(id: number, data: Partial<schema.InsertOrbitVideo>): Promise<schema.OrbitVideo | undefined>;
  deleteOrbitVideo(id: number): Promise<void>;
  createVideoEvent(data: schema.InsertOrbitVideoEvent): Promise<schema.OrbitVideoEvent>;
  getVideoEvents(videoId: number, limit?: number): Promise<schema.OrbitVideoEvent[]>;
  incrementVideoStats(videoId: number, stats: { serve?: boolean; play?: boolean; watchTimeMs?: number }): Promise<void>;

  // Orbit Documents
  createOrbitDocument(data: schema.InsertOrbitDocument): Promise<schema.OrbitDocument>;
  getOrbitDocuments(businessSlug: string): Promise<schema.OrbitDocument[]>;
  getOrbitDocument(id: number): Promise<schema.OrbitDocument | undefined>;
  updateOrbitDocument(id: number, data: Partial<schema.InsertOrbitDocument>): Promise<schema.OrbitDocument | undefined>;
  deleteOrbitDocument(id: number): Promise<void>;

  // Orbit Analytics
  getOrbitAnalytics(businessSlug: string, days?: number): Promise<schema.OrbitAnalytics[]>;
  getOrbitAnalyticsSummary(businessSlug: string, days?: number): Promise<{
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
  }>;
  getMonthlyConversationCount(businessSlug: string): Promise<number>;
  incrementOrbitMetric(businessSlug: string, metric: 'visits' | 'interactions' | 'conversations' | 'iceViews'): Promise<void>;
  getOrCreateTodayAnalytics(businessSlug: string): Promise<schema.OrbitAnalytics>;
  
  // Orbit Leads
  createOrbitLead(data: schema.InsertOrbitLead): Promise<schema.OrbitLead>;
  getOrbitLeads(businessSlug: string, limit?: number): Promise<schema.OrbitLead[]>;
  getOrbitLeadsCount(businessSlug: string): Promise<number>;
  markLeadRead(leadId: number): Promise<void>;

  // Orbit Boxes (Grid Curation)
  getOrbitBoxes(businessSlug: string, includeHidden?: boolean): Promise<schema.OrbitBox[]>;
  getOrbitBoxesByCategory(businessSlug: string): Promise<Map<string, schema.OrbitBox[]>>;
  getOrbitBox(id: number): Promise<schema.OrbitBox | undefined>;
  createOrbitBox(data: schema.InsertOrbitBox): Promise<schema.OrbitBox>;
  bulkImportOrbitBoxes(businessSlug: string, items: schema.InsertOrbitBox[], clearExisting?: boolean): Promise<{ imported: number; skipped: number }>;
  updateOrbitBox(id: number, data: Partial<schema.InsertOrbitBox>): Promise<schema.OrbitBox | undefined>;
  deleteOrbitBox(id: number): Promise<void>;
  deleteOrbitBoxesByType(businessSlug: string, boxType: schema.OrbitBoxType): Promise<number>;
  reorderOrbitBoxes(businessSlug: string, boxIds: number[]): Promise<void>;

  // Phase 2: Orbit Sessions
  getOrCreateOrbitSession(sessionId: string, businessSlug: string): Promise<schema.OrbitSession>;
  getOrbitSession(sessionId: string): Promise<schema.OrbitSession | undefined>;
  updateOrbitSession(sessionId: string, data: Partial<schema.InsertOrbitSession>): Promise<schema.OrbitSession | undefined>;

  // Phase 2: Orbit Events
  logOrbitEvent(data: schema.InsertOrbitEvent): Promise<schema.OrbitEvent>;
  getOrbitEvents(sessionId: string): Promise<schema.OrbitEvent[]>;
  getOrbitEventsBySlug(businessSlug: string, limit?: number): Promise<schema.OrbitEvent[]>;
  
  // Product Analytics Events
  logOrbitProductEvent(data: {
    businessSlug: string;
    eventType: string;
    intent?: string;
    messageContent?: string;
    productId?: string;
    conversationId?: number | null;
  }): Promise<void>;

  // Phase 2: Orbit Conversations (Insight tier)
  createOrbitConversation(data: schema.InsertOrbitConversation): Promise<schema.OrbitConversation>;
  getOrbitConversation(id: number): Promise<schema.OrbitConversation | undefined>;
  getOrbitConversations(businessSlug: string, limit?: number): Promise<schema.OrbitConversation[]>;
  updateOrbitConversation(id: number, data: Partial<schema.InsertOrbitConversation>): Promise<schema.OrbitConversation | undefined>;

  // Phase 2: Orbit Messages
  addOrbitMessage(data: schema.InsertOrbitMessage): Promise<schema.OrbitMessage>;
  getOrbitMessages(conversationId: number): Promise<schema.OrbitMessage[]>;

  // Phase 2: Orbit Insights Summary
  getOrbitInsightsSummary(businessSlug: string): Promise<schema.OrbitInsightsSummary | undefined>;
  upsertOrbitInsightsSummary(data: schema.InsertOrbitInsightsSummary): Promise<schema.OrbitInsightsSummary>;

  // Phase 2: Orbit Lead with context
  getOrbitLead(id: number): Promise<schema.OrbitLead | undefined>;
  updateOrbitLead(id: number, data: Partial<schema.InsertOrbitLead>): Promise<schema.OrbitLead | undefined>;

  // Phase 2: ICE Allowance
  getOrbitIceAllowance(businessSlug: string): Promise<{ allowance: number; used: number; periodStart: Date | null }>;
  incrementOrbitIceUsed(businessSlug: string): Promise<void>;
  resetOrbitIcePeriod(businessSlug: string, allowance: number): Promise<void>;

  // Knowledge Coach: Proactive Gap Questions
  createKnowledgePrompt(data: schema.InsertOrbitKnowledgePrompt): Promise<schema.OrbitKnowledgePrompt>;
  createKnowledgePrompts(data: schema.InsertOrbitKnowledgePrompt[]): Promise<schema.OrbitKnowledgePrompt[]>;
  getKnowledgePrompts(businessSlug: string, status?: schema.KnowledgePromptStatus): Promise<schema.OrbitKnowledgePrompt[]>;
  getKnowledgePrompt(id: number): Promise<schema.OrbitKnowledgePrompt | undefined>;
  updateKnowledgePrompt(id: number, data: Partial<schema.InsertOrbitKnowledgePrompt>): Promise<schema.OrbitKnowledgePrompt | undefined>;
  getPendingKnowledgePromptsCount(businessSlug: string): Promise<number>;
  getWeeklyKnowledgePrompts(businessSlug: string, weekNumber: number): Promise<schema.OrbitKnowledgePrompt[]>;
  expireOldKnowledgePrompts(): Promise<number>;
  getEligibleOrbitsForKnowledgeCoach(): Promise<schema.OrbitMeta[]>;

  // Phase 4: Notifications
  createNotification(data: schema.InsertNotification): Promise<schema.Notification>;
  getNotifications(userId: number, limit?: number): Promise<schema.Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  findNotificationByDedupeKey(dedupeKey: string): Promise<schema.Notification | undefined>;

  // Phase 4: Notification Preferences
  getNotificationPreferences(userId: number): Promise<schema.NotificationPreferences | undefined>;
  upsertNotificationPreferences(data: schema.InsertNotificationPreferences): Promise<schema.NotificationPreferences>;

  // Phase 4: Magic Links
  createMagicLink(data: schema.InsertMagicLink): Promise<schema.MagicLink>;
  getMagicLink(token: string): Promise<schema.MagicLink | undefined>;
  markMagicLinkUsed(token: string): Promise<void>;
  cleanupExpiredMagicLinks(): Promise<number>;

  // Phase 5: Data Sources (API Snapshot Ingestion)
  // Secrets
  createApiSecret(data: schema.InsertApiSecret): Promise<schema.ApiSecret>;
  getApiSecret(id: number): Promise<schema.ApiSecret | undefined>;
  getApiSecretsByOrbit(orbitSlug: string): Promise<schema.ApiSecret[]>;
  deleteApiSecret(id: number): Promise<void>;
  
  // Connections
  createApiConnection(data: schema.InsertApiConnection): Promise<schema.ApiConnection>;
  getApiConnection(id: number): Promise<schema.ApiConnection | undefined>;
  getApiConnectionsByOrbit(orbitSlug: string): Promise<schema.ApiConnection[]>;
  updateApiConnection(id: number, data: Partial<schema.InsertApiConnection>): Promise<schema.ApiConnection | undefined>;
  deleteApiConnection(id: number): Promise<void>;
  
  // Endpoints
  createApiEndpoint(data: schema.InsertApiEndpoint): Promise<schema.ApiEndpoint>;
  getApiEndpoint(id: number): Promise<schema.ApiEndpoint | undefined>;
  getApiEndpointsByConnection(connectionId: number): Promise<schema.ApiEndpoint[]>;
  updateApiEndpoint(id: number, data: Partial<schema.InsertApiEndpoint>): Promise<schema.ApiEndpoint | undefined>;
  deleteApiEndpoint(id: number): Promise<void>;
  
  // Snapshots
  createApiSnapshot(data: schema.InsertApiSnapshot): Promise<schema.ApiSnapshot>;
  getApiSnapshot(id: number): Promise<schema.ApiSnapshot | undefined>;
  getApiSnapshotsByEndpoint(endpointId: number, limit?: number): Promise<schema.ApiSnapshot[]>;
  getLatestSnapshot(endpointId: number): Promise<schema.ApiSnapshot | undefined>;
  updateApiSnapshot(id: number, data: Partial<schema.InsertApiSnapshot>): Promise<schema.ApiSnapshot | undefined>;
  getNextSnapshotVersion(endpointId: number): Promise<number>;
  findSnapshotByHash(endpointId: number, requestHash: string): Promise<schema.ApiSnapshot | undefined>;
  
  // ICE Drafts (Launchpad)
  createIceDraft(data: schema.InsertIceDraft): Promise<schema.IceDraft>;
  getIceDraft(id: number): Promise<schema.IceDraft | undefined>;
  getIceDraftsByOrbit(businessSlug: string, limit?: number): Promise<schema.IceDraft[]>;
  updateIceDraft(id: number, data: Partial<schema.InsertIceDraft>): Promise<schema.IceDraft | undefined>;
  deleteIceDraft(id: number): Promise<void>;
  
  // Curated Items
  createApiCuratedItem(data: schema.InsertApiCuratedItem): Promise<schema.ApiCuratedItem>;
  createApiCuratedItems(data: schema.InsertApiCuratedItem[]): Promise<schema.ApiCuratedItem[]>;
  getApiCuratedItemsBySnapshot(snapshotId: number): Promise<schema.ApiCuratedItem[]>;
  getApiCuratedItemsByOrbit(orbitSlug: string, limit?: number): Promise<schema.ApiCuratedItem[]>;
  getLatestCuratedItemsByConnection(connectionId: number): Promise<schema.ApiCuratedItem[]>;

  // Orbit Signal Access Log (AI Discovery Metrics)
  logOrbitSignalAccess(data: schema.InsertOrbitSignalAccessLog): Promise<schema.OrbitSignalAccessLog>;
  getOrbitSignalAccessMetrics(orbitSlug: string, days?: number): Promise<{
    totalAccesses: number;
    lastAccessAt: Date | null;
    topUserAgents: { agent: string; count: number }[];
  }>;

  // Blog Posts
  getBlogPost(id: number): Promise<schema.BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<schema.BlogPost | undefined>;
  getAllBlogPosts(includeUnpublished?: boolean): Promise<schema.BlogPost[]>;
  createBlogPost(data: schema.InsertBlogPost): Promise<schema.BlogPost>;
  updateBlogPost(id: number, data: Partial<schema.InsertBlogPost>): Promise<schema.BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<void>;

  // Active Ice Hosting
  activateIce(universeId: number, userId: number): Promise<schema.Universe | undefined>;
  pauseIce(universeId: number): Promise<schema.Universe | undefined>;
  getActiveIceCount(userId: number): Promise<number>;
  getIcesToPauseOnDowngrade(userId: number, newLimit: number): Promise<schema.Universe[]>;
  
  // Security Audit Logging
  createAuditLog(log: schema.InsertAuditLog): Promise<schema.AuditLog>;
  getAuditLogs(resourceType: string, resourceId: string, limit?: number): Promise<schema.AuditLog[]>;
  
  // Billing Audit Logging
  createBillingAuditLog(log: schema.InsertBillingAuditLog): Promise<schema.BillingAuditLog>;

  // Social Proof (Testimonial Capture)
  createSocialProofItem(data: schema.InsertSocialProofItem): Promise<schema.SocialProofItem>;
  getSocialProofItem(id: number): Promise<schema.SocialProofItem | undefined>;
  getSocialProofItems(businessSlug: string, filters?: { 
    status?: schema.SocialProofStatus; 
    consentStatus?: schema.SocialProofConsentStatus;
    topic?: schema.SocialProofTopic;
  }): Promise<schema.SocialProofItem[]>;
  updateSocialProofItem(id: number, data: Partial<schema.InsertSocialProofItem>): Promise<schema.SocialProofItem | undefined>;
  deleteSocialProofItem(id: number): Promise<void>;

  // Video Export Jobs
  createVideoExportJob(data: schema.InsertVideoExportJob): Promise<schema.VideoExportJob>;
  getVideoExportJob(jobId: string): Promise<schema.VideoExportJob | undefined>;
  getVideoExportJobsByUser(userId: number, limit?: number): Promise<schema.VideoExportJob[]>;
  updateVideoExportJob(jobId: string, data: Partial<schema.InsertVideoExportJob>): Promise<schema.VideoExportJob | undefined>;
  deleteVideoExportJob(jobId: string): Promise<void>;

  // ============ INDUSTRY ORBIT SYSTEM ============
  
  // Industry Entities
  createIndustryEntity(data: schema.InsertIndustryEntity): Promise<schema.IndustryEntity>;
  getIndustryEntity(id: number): Promise<schema.IndustryEntity | undefined>;
  getIndustryEntitiesByOrbit(orbitId: number): Promise<schema.IndustryEntity[]>;
  getIndustryEntityByName(orbitId: number, name: string): Promise<schema.IndustryEntity | undefined>;
  updateIndustryEntity(id: number, data: Partial<schema.InsertIndustryEntity>): Promise<schema.IndustryEntity | undefined>;
  deleteIndustryEntity(id: number): Promise<void>;
  
  // Industry Products
  createIndustryProduct(data: schema.InsertIndustryProduct): Promise<schema.IndustryProduct>;
  getIndustryProduct(id: number): Promise<schema.IndustryProduct | undefined>;
  getIndustryProductsByOrbit(orbitId: number): Promise<schema.IndustryProduct[]>;
  getIndustryProductByName(orbitId: number, name: string): Promise<schema.IndustryProduct | undefined>;
  updateIndustryProduct(id: number, data: Partial<schema.InsertIndustryProduct>): Promise<schema.IndustryProduct | undefined>;
  deleteIndustryProduct(id: number): Promise<void>;
  
  // Product Specs
  createProductSpec(data: schema.InsertProductSpec): Promise<schema.ProductSpec>;
  getProductSpecs(productId: number): Promise<schema.ProductSpec[]>;
  updateProductSpec(id: number, data: Partial<schema.InsertProductSpec>): Promise<schema.ProductSpec | undefined>;
  deleteProductSpec(id: number): Promise<void>;
  deleteProductSpecsByProduct(productId: number): Promise<void>;
  
  // Industry Reviews
  createIndustryReview(data: schema.InsertIndustryReview): Promise<schema.IndustryReview>;
  getIndustryReview(id: number): Promise<schema.IndustryReview | undefined>;
  getIndustryReviewsByOrbit(orbitId: number): Promise<schema.IndustryReview[]>;
  updateIndustryReview(id: number, data: Partial<schema.InsertIndustryReview>): Promise<schema.IndustryReview | undefined>;
  deleteIndustryReview(id: number): Promise<void>;
  
  // Industry Assets
  createIndustryAsset(data: schema.InsertIndustryAsset): Promise<schema.IndustryAsset>;
  getIndustryAsset(id: number): Promise<schema.IndustryAsset | undefined>;
  getIndustryAssetsByOrbit(orbitId: number): Promise<schema.IndustryAsset[]>;
  deleteIndustryAsset(id: number): Promise<void>;
  
  // Community Links
  createCommunityLink(data: schema.InsertCommunityLink): Promise<schema.CommunityLink>;
  getCommunityLink(id: number): Promise<schema.CommunityLink | undefined>;
  getCommunityLinksByOrbit(orbitId: number): Promise<schema.CommunityLink[]>;
  updateCommunityLink(id: number, data: Partial<schema.InsertCommunityLink>): Promise<schema.CommunityLink | undefined>;
  deleteCommunityLink(id: number): Promise<void>;
  
  // Topic Tiles
  createTopicTile(data: schema.InsertTopicTile): Promise<schema.TopicTile>;
  getTopicTile(id: number): Promise<schema.TopicTile | undefined>;
  getTopicTilesByOrbit(orbitId: number): Promise<schema.TopicTile[]>;
  updateTopicTile(id: number, data: Partial<schema.InsertTopicTile>): Promise<schema.TopicTile | undefined>;
  deleteTopicTile(id: number): Promise<void>;
  
  // Pulse Sources
  createPulseSource(data: schema.InsertPulseSource): Promise<schema.PulseSource>;
  getPulseSource(id: number): Promise<schema.PulseSource | undefined>;
  getPulseSourcesByOrbit(orbitId: number): Promise<schema.PulseSource[]>;
  getEnabledPulseSources(): Promise<schema.PulseSource[]>;
  updatePulseSource(id: number, data: Partial<schema.InsertPulseSource>): Promise<schema.PulseSource | undefined>;
  deletePulseSource(id: number): Promise<void>;
  
  // Pulse Snapshots
  createPulseSnapshot(data: schema.InsertPulseSnapshot): Promise<schema.PulseSnapshot>;
  getLatestPulseSnapshot(sourceId: number): Promise<schema.PulseSnapshot | undefined>;
  getPulseSnapshots(sourceId: number, limit?: number): Promise<schema.PulseSnapshot[]>;
  
  // Pulse Events
  createPulseEvent(data: schema.InsertPulseEvent): Promise<schema.PulseEvent>;
  getPulseEvent(id: number): Promise<schema.PulseEvent | undefined>;
  getPulseEventsByOrbit(orbitId: number, status?: schema.PulseEventStatus): Promise<schema.PulseEvent[]>;
  updatePulseEvent(id: number, data: Partial<schema.InsertPulseEvent>): Promise<schema.PulseEvent | undefined>;
  
  // Alignments
  createAlignment(data: schema.InsertAlignment): Promise<schema.Alignment>;
  getAlignment(orbitId: number, userId: number): Promise<schema.Alignment | undefined>;
  getAlignmentsByOrbit(orbitId: number): Promise<schema.Alignment[]>;
  getAlignmentsByUser(userId: number): Promise<schema.Alignment[]>;
  updateAlignment(id: number, data: Partial<schema.InsertAlignment>): Promise<schema.Alignment | undefined>;
  deleteAlignment(id: number): Promise<void>;
  
  // Core Concepts (CPAC)
  createCoreConcept(data: schema.InsertCoreConcept): Promise<schema.CoreConcept>;
  getCoreConceptsByOrbit(orbitId: number): Promise<schema.CoreConcept[]>;
  getCoreConceptByConceptId(orbitId: number, conceptId: string): Promise<schema.CoreConcept | undefined>;
  deleteCoreConcept(id: number): Promise<void>;
  deleteCoreConceptsByOrbit(orbitId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<schema.User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    return result;
  }
  
  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });
    return result;
  }
  
  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    if (!email) return undefined;
    const result = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    return result;
  }
  
  async createUser(insertUser: schema.InsertUser): Promise<schema.User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<schema.InsertUser>): Promise<schema.User | undefined> {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();
    return user;
  }
  
  async getAllUsers(): Promise<schema.User[]> {
    return await db.query.users.findMany({
      orderBy: [desc(schema.users.createdAt)],
    });
  }
  
  // Admin Platform Metrics
  async getPlatformMetrics(): Promise<{
    totalUsers: number;
    usersByRole: { role: string; count: number }[];
    totalOrbits: number;
    industryOrbits: number;
    standardOrbits: number;
    totalVisits30d: number;
    totalConversations30d: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Count users
    const allUsers = await db.query.users.findMany();
    const totalUsers = allUsers.length;
    
    // Users by role
    const roleCounts: Record<string, number> = {};
    allUsers.forEach(u => {
      const role = u.role || 'viewer';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    const usersByRole = Object.entries(roleCounts).map(([role, count]) => ({ role, count }));
    
    // Count orbits
    const allOrbits = await db.query.orbitMeta.findMany();
    const totalOrbits = allOrbits.length;
    const industryOrbits = allOrbits.filter(o => o.orbitType === 'industry').length;
    const standardOrbits = allOrbits.filter(o => o.orbitType === 'standard').length;
    
    // Count visits and conversations (30 days)
    const analytics = await db
      .select({
        totalVisits: sql<number>`COALESCE(SUM(total_visits), 0)`,
        totalConversations: sql<number>`COALESCE(SUM(total_conversations), 0)`,
      })
      .from(schema.orbitAnalytics)
      .where(gte(schema.orbitAnalytics.lastUpdated, thirtyDaysAgo));
    
    return {
      totalUsers,
      usersByRole,
      totalOrbits,
      industryOrbits,
      standardOrbits,
      totalVisits30d: Number(analytics[0]?.totalVisits || 0),
      totalConversations30d: Number(analytics[0]?.totalConversations || 0),
    };
  }
  
  async getIndustryOrbits(): Promise<schema.OrbitMeta[]> {
    return await db.query.orbitMeta.findMany({
      where: eq(schema.orbitMeta.orbitType, 'industry'),
      orderBy: [desc(schema.orbitMeta.lastUpdated)],
    });
  }
  
  // Creator Profiles
  async getCreatorProfile(userId: number): Promise<schema.CreatorProfile | undefined> {
    const result = await db.query.creatorProfiles.findFirst({
      where: eq(schema.creatorProfiles.userId, userId),
    });
    return result;
  }
  
  async createCreatorProfile(profile: schema.InsertCreatorProfile): Promise<schema.CreatorProfile> {
    const [result] = await db.insert(schema.creatorProfiles).values(profile).returning();
    return result;
  }
  
  async updateCreatorProfile(userId: number, data: Partial<schema.InsertCreatorProfile>): Promise<schema.CreatorProfile | undefined> {
    const [result] = await db.update(schema.creatorProfiles)
      .set(data)
      .where(eq(schema.creatorProfiles.userId, userId))
      .returning();
    return result;
  }
  
  async getCreatorProfileBySlug(slug: string): Promise<schema.CreatorProfile | undefined> {
    if (!slug) return undefined;
    const result = await db.query.creatorProfiles.findFirst({
      where: eq(schema.creatorProfiles.slug, slug),
    });
    return result;
  }
  
  async getCreatorWithUser(userId: number): Promise<{ profile: schema.CreatorProfile; user: schema.User } | undefined> {
    const profile = await this.getCreatorProfile(userId);
    if (!profile) return undefined;
    const user = await this.getUser(userId);
    if (!user) return undefined;
    return { profile, user };
  }
  
  async getUniversesByCreator(userId: number): Promise<schema.Universe[]> {
    const ownershipRecords = await db.query.universeCreators.findMany({
      where: eq(schema.universeCreators.userId, userId),
    });
    if (ownershipRecords.length === 0) return [];
    const universeIds = ownershipRecords.map(r => r.universeId);
    return await db.query.universes.findMany({
      where: inArray(schema.universes.id, universeIds),
    });
  }
  
  async getCreatorForUniverse(universeId: number): Promise<schema.CreatorProfile | undefined> {
    const ownerRecord = await db.query.universeCreators.findFirst({
      where: and(
        eq(schema.universeCreators.universeId, universeId),
        eq(schema.universeCreators.role, 'owner')
      ),
    });
    if (!ownerRecord) return undefined;
    return await this.getCreatorProfile(ownerRecord.userId);
  }
  
  // Universe
  async getUniverse(id: number): Promise<schema.Universe | undefined> {
    const result = await db.query.universes.findFirst({
      where: eq(schema.universes.id, id),
    });
    return result;
  }
  
  async getUniverseBySlug(slug: string): Promise<schema.Universe | undefined> {
    const result = await db.query.universes.findFirst({
      where: eq(schema.universes.slug, slug),
    });
    return result;
  }
  
  async getAllUniverses(): Promise<schema.Universe[]> {
    return await db.query.universes.findMany();
  }
  
  async createUniverse(universe: schema.InsertUniverse): Promise<schema.Universe> {
    const [result] = await db.insert(schema.universes).values(universe).returning();
    return result;
  }
  
  async updateUniverse(id: number, universe: Partial<schema.InsertUniverse>): Promise<schema.Universe | undefined> {
    const [result] = await db.update(schema.universes)
      .set(universe)
      .where(eq(schema.universes.id, id))
      .returning();
    return result;
  }
  
  async deleteUniverse(id: number): Promise<void> {
    await db.delete(schema.universes).where(eq(schema.universes.id, id));
  }
  
  async deleteUniverseContent(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Get all card IDs for this universe
      const cards = await tx.query.cards.findMany({ 
        where: eq(schema.cards.universeId, id),
        columns: { id: true }
      });
      const cardIds = cards.map(c => c.id);
      
      // Get all character IDs for this universe
      const characters = await tx.query.characters.findMany({
        where: eq(schema.characters.universeId, id),
        columns: { id: true }
      });
      const characterIds = characters.map(c => c.id);
      
      // Delete chat messages and threads for characters in this universe
      if (characterIds.length > 0) {
        // Get all thread IDs for these characters
        const threads = await tx.query.chatThreads.findMany({
          where: inArray(schema.chatThreads.characterId, characterIds),
          columns: { id: true }
        });
        const threadIds = threads.map(t => t.id);
        
        // Delete messages first, then threads
        if (threadIds.length > 0) {
          await tx.delete(schema.chatMessages).where(inArray(schema.chatMessages.threadId, threadIds));
        }
        await tx.delete(schema.chatThreads).where(inArray(schema.chatThreads.characterId, characterIds));
      }
      
      // Delete all card-character links in one query
      if (cardIds.length > 0) {
        await tx.delete(schema.cardCharacters).where(inArray(schema.cardCharacters.cardId, cardIds));
      }
      
      // Clear transformation jobs that reference this universe (set outputUniverseId to null)
      await tx.update(schema.transformationJobs)
        .set({ outputUniverseId: null })
        .where(eq(schema.transformationJobs.outputUniverseId, id));
      
      // Delete all cards, characters, and locations for this universe
      await tx.delete(schema.cards).where(eq(schema.cards.universeId, id));
      await tx.delete(schema.characters).where(eq(schema.characters.universeId, id));
      await tx.delete(schema.locations).where(eq(schema.locations.universeId, id));
    });
  }
  
  // Characters
  async getCharacter(id: number): Promise<schema.Character | undefined> {
    const result = await db.query.characters.findFirst({
      where: eq(schema.characters.id, id),
    });
    return result;
  }
  
  async getCharacterBySlug(universeId: number, slug: string): Promise<schema.Character | undefined> {
    const result = await db.query.characters.findFirst({
      where: and(
        eq(schema.characters.universeId, universeId),
        eq(schema.characters.characterSlug, slug)
      ),
    });
    return result;
  }
  
  async getCharactersByUniverse(universeId: number): Promise<schema.Character[]> {
    return await db.query.characters.findMany({
      where: eq(schema.characters.universeId, universeId),
    });
  }
  
  async createCharacter(character: schema.InsertCharacter): Promise<schema.Character> {
    const [result] = await db.insert(schema.characters).values(character).returning();
    return result;
  }
  
  async updateCharacter(id: number, character: Partial<schema.InsertCharacter>): Promise<schema.Character | undefined> {
    const [result] = await db.update(schema.characters)
      .set(character)
      .where(eq(schema.characters.id, id))
      .returning();
    return result;
  }
  
  async deleteCharacter(id: number): Promise<void> {
    await db.delete(schema.characters).where(eq(schema.characters.id, id));
  }
  
  // Cards
  async getCard(id: number): Promise<schema.Card | undefined> {
    const result = await db.query.cards.findFirst({
      where: eq(schema.cards.id, id),
    });
    return result;
  }
  
  async getCardByDay(universeId: number, season: number, dayIndex: number): Promise<schema.Card | undefined> {
    const result = await db.query.cards.findFirst({
      where: and(
        eq(schema.cards.universeId, universeId),
        eq(schema.cards.season, season),
        eq(schema.cards.dayIndex, dayIndex)
      ),
    });
    return result;
  }
  
  async getCardsByUniverse(universeId: number): Promise<schema.Card[]> {
    return await db.query.cards.findMany({
      where: eq(schema.cards.universeId, universeId),
      orderBy: [schema.cards.dayIndex],
    });
  }
  
  async getCardsBySeason(universeId: number, season: number): Promise<schema.Card[]> {
    return await db.query.cards.findMany({
      where: and(
        eq(schema.cards.universeId, universeId),
        eq(schema.cards.season, season)
      ),
      orderBy: [schema.cards.dayIndex],
    });
  }
  
  async createCard(card: schema.InsertCard): Promise<schema.Card> {
    const [result] = await db.insert(schema.cards).values(card).returning();
    return result;
  }
  
  async updateCard(id: number, card: Partial<schema.InsertCard>): Promise<schema.Card | undefined> {
    const [result] = await db.update(schema.cards)
      .set(card)
      .where(eq(schema.cards.id, id))
      .returning();
    return result;
  }
  
  async deleteCard(id: number): Promise<void> {
    await db.delete(schema.cardCharacters).where(eq(schema.cardCharacters.cardId, id));
    await db.delete(schema.cards).where(eq(schema.cards.id, id));
  }
  
  async deleteAllCardsByUniverse(universeId: number): Promise<number> {
    return await db.transaction(async (tx) => {
      // Get all card IDs for this universe
      const cards = await tx.query.cards.findMany({ 
        where: eq(schema.cards.universeId, universeId),
        columns: { id: true }
      });
      const cardIds = cards.map(c => c.id);
      
      // Delete all card-character links in one query (if there are cards)
      if (cardIds.length > 0) {
        await tx.delete(schema.cardCharacters).where(inArray(schema.cardCharacters.cardId, cardIds));
      }
      
      // Delete all cards for this universe
      const result = await tx.delete(schema.cards).where(eq(schema.cards.universeId, universeId)).returning();
      return result.length;
    });
  }
  
  // Card-Character relationships
  async linkCardCharacter(cardId: number, characterId: number): Promise<void> {
    await db.insert(schema.cardCharacters).values({ cardId, characterId });
  }
  
  async unlinkCardCharacter(cardId: number, characterId: number): Promise<void> {
    await db.delete(schema.cardCharacters)
      .where(and(
        eq(schema.cardCharacters.cardId, cardId),
        eq(schema.cardCharacters.characterId, characterId)
      ));
  }
  
  async getCharactersForCard(cardId: number): Promise<schema.Character[]> {
    const results = await db
      .select({ character: schema.characters })
      .from(schema.cardCharacters)
      .innerJoin(schema.characters, eq(schema.cardCharacters.characterId, schema.characters.id))
      .where(eq(schema.cardCharacters.cardId, cardId));
    
    return results.map(r => r.character);
  }
  
  // User Progress
  async getUserProgress(userId: number, universeId: number): Promise<schema.UserProgress | undefined> {
    const result = await db.query.userProgress.findFirst({
      where: and(
        eq(schema.userProgress.userId, userId),
        eq(schema.userProgress.universeId, universeId)
      ),
    });
    return result;
  }
  
  async createOrUpdateProgress(progress: schema.InsertUserProgress): Promise<schema.UserProgress> {
    const existing = await this.getUserProgress(progress.userId, progress.universeId);
    
    if (existing) {
      const [updated] = await db.update(schema.userProgress)
        .set(progress)
        .where(and(
          eq(schema.userProgress.userId, progress.userId),
          eq(schema.userProgress.universeId, progress.universeId)
        ))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(schema.userProgress).values(progress).returning();
      return created;
    }
  }
  
  async unlockNextCard(userId: number, universeId: number): Promise<schema.UserProgress | undefined> {
    const progress = await this.getUserProgress(userId, universeId);
    const newDayIndex = (progress?.unlockedDayIndex ?? 0) + 1;
    
    return await this.createOrUpdateProgress({
      userId,
      universeId,
      unlockedDayIndex: newDayIndex,
      currentStreak: (progress?.currentStreak ?? 0) + 1,
      lastSeenAt: new Date(),
    });
  }
  
  // Chat
  async getChatThread(userId: number, universeId: number, characterId: number): Promise<schema.ChatThread | undefined> {
    const result = await db.query.chatThreads.findFirst({
      where: and(
        eq(schema.chatThreads.userId, userId),
        eq(schema.chatThreads.universeId, universeId),
        eq(schema.chatThreads.characterId, characterId)
      ),
    });
    return result;
  }
  
  async createChatThread(thread: schema.InsertChatThread): Promise<schema.ChatThread> {
    const [result] = await db.insert(schema.chatThreads).values(thread).returning();
    return result;
  }
  
  async getChatMessages(threadId: number, limit?: number): Promise<schema.ChatMessage[]> {
    return await db.query.chatMessages.findMany({
      where: eq(schema.chatMessages.threadId, threadId),
      orderBy: [schema.chatMessages.createdAt],
      limit: limit,
    });
  }
  
  async addChatMessage(message: schema.InsertChatMessage): Promise<schema.ChatMessage> {
    const [result] = await db.insert(schema.chatMessages).values(message).returning();
    return result;
  }
  
  // Events
  async logEvent(event: schema.InsertEvent): Promise<void> {
    await db.insert(schema.events).values(event);
  }
  
  async getExperienceAnalyticsSummary(universeId: number, days: number = 30): Promise<{
    views: { total: number; last7Days: number };
    conversations: { total: number; last7Days: number };
    completionRate: number;
    topQuestions: string[];
    topCard: { id: number; title: string; views: number } | null;
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const allEvents = await db.query.events.findMany({
      where: gte(schema.events.createdAt, thirtyDaysAgo),
    });
    
    const universeEvents = allEvents.filter(e => 
      e.metadataJson && (e.metadataJson as any).universeId === universeId
    );
    
    const viewEvents = universeEvents.filter(e => 
      e.type === 'experience_view' || e.type === 'card_view'
    );
    const conversationEvents = universeEvents.filter(e => 
      e.type === 'conversation_start' || e.type === 'chat_start'
    );
    
    const recentViewEvents = viewEvents.filter(e => e.createdAt >= sevenDaysAgo);
    const recentConversationEvents = conversationEvents.filter(e => e.createdAt >= sevenDaysAgo);
    
    const cards = await this.getCardsByUniverse(universeId);
    const totalCards = cards.length;
    
    const cardViewCounts: Record<number, number> = {};
    viewEvents.forEach(e => {
      const cardId = (e.metadataJson as any)?.cardId;
      if (cardId) {
        cardViewCounts[cardId] = (cardViewCounts[cardId] || 0) + 1;
      }
    });
    
    const lastCardViewCount = totalCards > 0 ? (cardViewCounts[cards[totalCards - 1]?.id] || 0) : 0;
    const firstCardViewCount = totalCards > 0 ? (cardViewCounts[cards[0]?.id] || 0) : 0;
    const completionRate = firstCardViewCount > 0 
      ? Math.round((lastCardViewCount / firstCardViewCount) * 100) 
      : 0;
    
    const questionEvents = universeEvents.filter(e => e.type === 'question_asked');
    const questions = questionEvents
      .map(e => (e.metadataJson as any)?.question)
      .filter(Boolean);
    const questionCounts: Record<string, number> = {};
    questions.forEach(q => {
      const normalized = q.toLowerCase().trim().slice(0, 100);
      questionCounts[normalized] = (questionCounts[normalized] || 0) + 1;
    });
    const topQuestions = Object.entries(questionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([q]) => q);
    
    let topCard: { id: number; title: string; views: number } | null = null;
    if (Object.keys(cardViewCounts).length > 0) {
      const topCardId = Object.entries(cardViewCounts)
        .sort((a, b) => b[1] - a[1])[0];
      if (topCardId) {
        const card = cards.find(c => c.id === Number(topCardId[0]));
        if (card) {
          topCard = { id: card.id, title: card.title, views: topCardId[1] };
        }
      }
    }
    
    return {
      views: { total: viewEvents.length, last7Days: recentViewEvents.length },
      conversations: { total: conversationEvents.length, last7Days: recentConversationEvents.length },
      completionRate,
      topQuestions,
      topCard,
    };
  }
  
  // Locations
  async getLocation(id: number): Promise<schema.Location | undefined> {
    const result = await db.query.locations.findFirst({
      where: eq(schema.locations.id, id),
    });
    return result;
  }
  
  async getLocationBySlug(universeId: number, slug: string): Promise<schema.Location | undefined> {
    const result = await db.query.locations.findFirst({
      where: and(
        eq(schema.locations.universeId, universeId),
        eq(schema.locations.locationSlug, slug)
      ),
    });
    return result;
  }
  
  async getLocationsByUniverse(universeId: number): Promise<schema.Location[]> {
    return await db.query.locations.findMany({
      where: eq(schema.locations.universeId, universeId),
    });
  }
  
  async createLocation(location: schema.InsertLocation): Promise<schema.Location> {
    const [result] = await db.insert(schema.locations).values(location).returning();
    return result;
  }
  
  async updateLocation(id: number, location: Partial<schema.InsertLocation>): Promise<schema.Location | undefined> {
    const [result] = await db.update(schema.locations)
      .set(location)
      .where(eq(schema.locations.id, id))
      .returning();
    return result;
  }
  
  async deleteLocation(id: number): Promise<void> {
    await db.delete(schema.locations).where(eq(schema.locations.id, id));
  }
  
  // Card Messages (micro message boards)
  async getCardMessages(cardId: number, limit?: number): Promise<schema.CardMessage[]> {
    return await db.query.cardMessages.findMany({
      where: eq(schema.cardMessages.cardId, cardId),
      orderBy: [desc(schema.cardMessages.createdAt)],
      limit: limit || 50,
    });
  }
  
  async createCardMessage(message: schema.InsertCardMessage): Promise<schema.CardMessage> {
    const [result] = await db.insert(schema.cardMessages).values(message).returning();
    return result;
  }
  
  async getCardMessageReactions(messageId: number): Promise<schema.CardMessageReaction[]> {
    return await db.query.cardMessageReactions.findMany({
      where: eq(schema.cardMessageReactions.messageId, messageId),
    });
  }
  
  async addCardMessageReaction(reaction: schema.InsertCardMessageReaction): Promise<schema.CardMessageReaction> {
    const [result] = await db.insert(schema.cardMessageReactions).values(reaction).returning();
    return result;
  }
  
  async removeCardMessageReaction(messageId: number, userId: number | null, anonFingerprint: string | null): Promise<void> {
    if (userId) {
      await db.delete(schema.cardMessageReactions).where(
        and(
          eq(schema.cardMessageReactions.messageId, messageId),
          eq(schema.cardMessageReactions.userId, userId)
        )
      );
    } else if (anonFingerprint) {
      await db.delete(schema.cardMessageReactions).where(
        and(
          eq(schema.cardMessageReactions.messageId, messageId),
          eq(schema.cardMessageReactions.anonFingerprint, anonFingerprint)
        )
      );
    }
  }
  
  // Audio Tracks
  async getAudioTrack(id: number): Promise<schema.AudioTrack | undefined> {
    const result = await db.query.audioTracks.findFirst({
      where: eq(schema.audioTracks.id, id),
    });
    return result;
  }
  
  async getAllAudioTracks(): Promise<schema.AudioTrack[]> {
    return await db.query.audioTracks.findMany({
      orderBy: [desc(schema.audioTracks.createdAt)],
    });
  }
  
  async getAudioTracksByFilter(mood?: string, genre?: string): Promise<schema.AudioTrack[]> {
    // Get all tracks, then filter in JS (JSON array querying is complex in Drizzle)
    const allTracks = await db.query.audioTracks.findMany({
      orderBy: [desc(schema.audioTracks.createdAt)],
    });
    
    return allTracks.filter(track => {
      if (mood && !(track.moodTags as string[] || []).includes(mood)) return false;
      if (genre && !(track.genreTags as string[] || []).includes(genre)) return false;
      return true;
    });
  }
  
  async createAudioTrack(track: schema.InsertAudioTrack): Promise<schema.AudioTrack> {
    const [result] = await db.insert(schema.audioTracks).values(track).returning();
    return result;
  }
  
  async updateAudioTrack(id: number, track: Partial<schema.InsertAudioTrack>): Promise<schema.AudioTrack | undefined> {
    const [result] = await db.update(schema.audioTracks)
      .set({ ...track, updatedAt: new Date() })
      .where(eq(schema.audioTracks.id, id))
      .returning();
    return result;
  }
  
  async deleteAudioTrack(id: number): Promise<void> {
    await db.delete(schema.audioTracks).where(eq(schema.audioTracks.id, id));
  }
  
  // Universe Audio Settings
  async getUniverseAudioSettings(universeId: number): Promise<schema.UniverseAudioSettings | undefined> {
    const result = await db.query.universeAudioSettings.findFirst({
      where: eq(schema.universeAudioSettings.universeId, universeId),
    });
    return result;
  }
  
  async createOrUpdateUniverseAudioSettings(settings: schema.InsertUniverseAudioSettings): Promise<schema.UniverseAudioSettings> {
    const existing = await this.getUniverseAudioSettings(settings.universeId);
    if (existing) {
      const [result] = await db.update(schema.universeAudioSettings)
        .set(settings)
        .where(eq(schema.universeAudioSettings.universeId, settings.universeId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(schema.universeAudioSettings).values(settings).returning();
      return result;
    }
  }
  
  // Transformation Jobs (Universal Story Engine Pipeline)
  async getTransformationJob(id: number): Promise<schema.TransformationJob | undefined> {
    const result = await db.query.transformationJobs.findFirst({
      where: eq(schema.transformationJobs.id, id),
    });
    return result;
  }
  
  async getTransformationJobsByUser(userId: number): Promise<schema.TransformationJob[]> {
    return await db.query.transformationJobs.findMany({
      where: eq(schema.transformationJobs.userId, userId),
      orderBy: [desc(schema.transformationJobs.createdAt)],
    });
  }
  
  async createTransformationJob(job: schema.InsertTransformationJob): Promise<schema.TransformationJob> {
    const defaultStageStatuses: schema.StageStatuses = {
      stage0: 'pending',
      stage1: 'pending',
      stage2: 'pending',
      stage3: 'pending',
      stage4: 'pending',
      stage5: 'pending',
    };
    const [result] = await db.insert(schema.transformationJobs).values({
      ...job,
      stageStatuses: job.stageStatuses || defaultStageStatuses,
      artifacts: job.artifacts || {},
    } as any).returning();
    return result;
  }
  
  async updateTransformationJob(id: number, job: Partial<schema.InsertTransformationJob>): Promise<schema.TransformationJob | undefined> {
    const [result] = await db.update(schema.transformationJobs)
      .set({ ...job, updatedAt: new Date() } as any)
      .where(eq(schema.transformationJobs.id, id))
      .returning();
    return result;
  }
  
  async deleteTransformationJob(id: number): Promise<void> {
    await db.delete(schema.transformationJobs).where(eq(schema.transformationJobs.id, id));
  }
  
  // ICE Previews (Guest Builder)
  async getIcePreview(id: string): Promise<schema.IcePreview | undefined> {
    const result = await db.query.icePreviews.findFirst({
      where: eq(schema.icePreviews.id, id),
    });
    return result;
  }
  
  async getIcePreviewsByUser(userId: number): Promise<schema.IcePreview[]> {
    const results = await db.query.icePreviews.findMany({
      where: eq(schema.icePreviews.ownerUserId, userId),
      orderBy: (previews, { desc }) => [desc(previews.createdAt)],
    });
    return results;
  }
  
  async createIcePreview(preview: schema.InsertIcePreview): Promise<schema.IcePreview> {
    const [result] = await db.insert(schema.icePreviews).values(preview).returning();
    return result;
  }
  
  async updateIcePreview(id: string, data: Partial<schema.InsertIcePreview>): Promise<schema.IcePreview | undefined> {
    const [result] = await db.update(schema.icePreviews)
      .set(data as any)
      .where(eq(schema.icePreviews.id, id))
      .returning();
    return result;
  }
  
  async deleteIcePreview(id: string): Promise<void> {
    await db.delete(schema.icePreviews).where(eq(schema.icePreviews.id, id));
  }
  
  async countIpIcePreviewsToday(ip: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.icePreviews)
      .where(and(
        eq(schema.icePreviews.ownerIp, ip),
        gte(schema.icePreviews.createdAt, today)
      ));
    return Number(result[0]?.count || 0);
  }
  
  async promoteIcePreview(id: string, userId: number, jobId: number): Promise<schema.IcePreview | undefined> {
    const [result] = await db.update(schema.icePreviews)
      .set({
        ownerUserId: userId,
        status: 'promoted' as schema.IcePreviewStatus,
        promotedToJobId: jobId,
        promotedAt: new Date(),
      })
      .where(eq(schema.icePreviews.id, id))
      .returning();
    return result;
  }
  
  // Reference Assets (Visual Bible)
  async getReferenceAsset(id: number): Promise<schema.UniverseReferenceAsset | undefined> {
    const result = await db.query.universeReferenceAssets.findFirst({
      where: eq(schema.universeReferenceAssets.id, id),
    });
    return result;
  }
  
  async getReferenceAssetsByUniverse(universeId: number): Promise<schema.UniverseReferenceAsset[]> {
    return await db.query.universeReferenceAssets.findMany({
      where: eq(schema.universeReferenceAssets.universeId, universeId),
      orderBy: (assets, { desc }) => [desc(assets.priority)],
    });
  }
  
  async getReferenceAssetsByType(universeId: number, assetType: schema.ReferenceAssetType): Promise<schema.UniverseReferenceAsset[]> {
    return await db.query.universeReferenceAssets.findMany({
      where: and(
        eq(schema.universeReferenceAssets.universeId, universeId),
        eq(schema.universeReferenceAssets.assetType, assetType)
      ),
      orderBy: (assets, { desc }) => [desc(assets.priority)],
    });
  }
  
  async createReferenceAsset(asset: schema.InsertUniverseReferenceAsset): Promise<schema.UniverseReferenceAsset> {
    const [result] = await db.insert(schema.universeReferenceAssets).values(asset).returning();
    return result;
  }
  
  async updateReferenceAsset(id: number, asset: Partial<schema.InsertUniverseReferenceAsset>): Promise<schema.UniverseReferenceAsset | undefined> {
    const [result] = await db.update(schema.universeReferenceAssets)
      .set(asset)
      .where(eq(schema.universeReferenceAssets.id, id))
      .returning();
    return result;
  }
  
  async deleteReferenceAsset(id: number): Promise<void> {
    await db.delete(schema.universeReferenceAssets).where(eq(schema.universeReferenceAssets.id, id));
  }
  
  // Plans & Subscriptions
  async getPlan(id: number): Promise<schema.Plan | undefined> {
    const result = await db.query.plans.findFirst({
      where: eq(schema.plans.id, id),
    });
    return result;
  }
  
  async getPlanByName(name: string): Promise<schema.Plan | undefined> {
    const result = await db.query.plans.findFirst({
      where: eq(schema.plans.name, name),
    });
    return result;
  }
  
  async getPlanByStripePriceId(priceId: string): Promise<schema.Plan | undefined> {
    const result = await db.query.plans.findFirst({
      where: (plans, { or, eq }) => or(
        eq(plans.stripePriceIdMonthly, priceId),
        eq(plans.stripePriceIdYearly, priceId)
      ),
    });
    return result;
  }
  
  async getAllPlans(): Promise<schema.Plan[]> {
    return await db.query.plans.findMany({
      where: eq(schema.plans.isActive, true),
    });
  }
  
  async createPlan(plan: schema.InsertPlan): Promise<schema.Plan> {
    const [result] = await db.insert(schema.plans).values(plan).returning();
    return result;
  }
  
  async getSubscription(userId: number): Promise<schema.Subscription | undefined> {
    const result = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, userId),
    });
    return result;
  }
  
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<schema.Subscription | undefined> {
    const result = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId),
    });
    return result;
  }
  
  async createSubscription(subscription: schema.InsertSubscription): Promise<schema.Subscription> {
    const [result] = await db.insert(schema.subscriptions).values(subscription as any).returning();
    return result;
  }
  
  async updateSubscription(id: number, data: Partial<schema.InsertSubscription>): Promise<schema.Subscription | undefined> {
    const [result] = await db.update(schema.subscriptions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(schema.subscriptions.id, id))
      .returning();
    return result;
  }
  
  // Entitlements
  async getEntitlements(userId: number): Promise<schema.Entitlement | undefined> {
    const result = await db.query.entitlements.findFirst({
      where: eq(schema.entitlements.userId, userId),
    });
    return result;
  }
  
  async upsertEntitlements(userId: number, entitlementData: Partial<schema.InsertEntitlement>): Promise<schema.Entitlement> {
    const existing = await this.getEntitlements(userId);
    
    if (existing) {
      const [result] = await db.update(schema.entitlements)
        .set({ ...entitlementData, updatedAt: new Date() })
        .where(eq(schema.entitlements.userId, userId))
        .returning();
      return result;
    }
    
    const [result] = await db.insert(schema.entitlements)
      .values({ userId, ...entitlementData } as schema.InsertEntitlement)
      .returning();
    return result;
  }
  
  // Credit Wallets
  async getCreditWallet(userId: number): Promise<schema.CreditWallet | undefined> {
    const result = await db.query.creditWallets.findFirst({
      where: eq(schema.creditWallets.userId, userId),
    });
    return result;
  }
  
  async getOrCreateCreditWallet(userId: number): Promise<schema.CreditWallet> {
    const existing = await this.getCreditWallet(userId);
    if (existing) return existing;
    
    const [result] = await db.insert(schema.creditWallets)
      .values({ userId, videoCredits: 0, voiceCredits: 0 })
      .returning();
    return result;
  }
  
  async addCredits(userId: number, videoCredits: number, voiceCredits: number): Promise<schema.CreditWallet> {
    const wallet = await this.getOrCreateCreditWallet(userId);
    
    const [result] = await db.update(schema.creditWallets)
      .set({
        videoCredits: wallet.videoCredits + videoCredits,
        voiceCredits: wallet.voiceCredits + voiceCredits,
        updatedAt: new Date(),
      })
      .where(eq(schema.creditWallets.userId, userId))
      .returning();
    return result;
  }
  
  async spendCredits(userId: number, creditType: 'video' | 'voice', amount: number): Promise<schema.CreditWallet> {
    const wallet = await this.getOrCreateCreditWallet(userId);
    const currentBalance = creditType === 'video' ? wallet.videoCredits : wallet.voiceCredits;
    
    if (currentBalance < amount) {
      throw new Error(`Insufficient ${creditType} credits`);
    }
    
    const update = creditType === 'video'
      ? { videoCredits: wallet.videoCredits - amount }
      : { voiceCredits: wallet.voiceCredits - amount };
    
    const [result] = await db.update(schema.creditWallets)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(schema.creditWallets.userId, userId))
      .returning();
    
    await this.logCreditEvent({
      userId,
      eventType: 'spend',
      creditType,
      amount: -amount,
      balanceAfter: creditType === 'video' ? result.videoCredits : result.voiceCredits,
    });
    
    return result;
  }
  
  async grantMonthlyCredits(userId: number, videoCredits: number, voiceCredits: number): Promise<void> {
    const wallet = await this.addCredits(userId, videoCredits, voiceCredits);
    
    if (videoCredits > 0) {
      await this.logCreditEvent({
        userId,
        eventType: 'monthly_grant',
        creditType: 'video',
        amount: videoCredits,
        balanceAfter: wallet.videoCredits,
      });
    }
    
    if (voiceCredits > 0) {
      await this.logCreditEvent({
        userId,
        eventType: 'monthly_grant',
        creditType: 'voice',
        amount: voiceCredits,
        balanceAfter: wallet.voiceCredits,
      });
    }
  }
  
  // Credit Events
  async logCreditEvent(event: schema.InsertCreditEvent): Promise<schema.CreditEvent> {
    const [result] = await db.insert(schema.creditEvents).values(event as any).returning();
    return result;
  }
  
  // Checkout Transactions (idempotency)
  async getCheckoutTransactionByKey(idempotencyKey: string): Promise<schema.CheckoutTransaction | undefined> {
    const result = await db.query.checkoutTransactions.findFirst({
      where: eq(schema.checkoutTransactions.idempotencyKey, idempotencyKey),
    });
    return result;
  }
  
  async getCheckoutTransactionBySessionId(stripeCheckoutSessionId: string): Promise<schema.CheckoutTransaction | undefined> {
    const result = await db.query.checkoutTransactions.findFirst({
      where: eq(schema.checkoutTransactions.stripeCheckoutSessionId, stripeCheckoutSessionId),
    });
    return result;
  }
  
  async createCheckoutTransaction(transaction: schema.InsertCheckoutTransaction): Promise<schema.CheckoutTransaction> {
    const [result] = await db.insert(schema.checkoutTransactions).values(transaction as any).returning();
    return result;
  }
  
  async updateCheckoutTransaction(id: number, data: Partial<schema.InsertCheckoutTransaction>): Promise<schema.CheckoutTransaction | undefined> {
    const [result] = await db.update(schema.checkoutTransactions)
      .set(data as any)
      .where(eq(schema.checkoutTransactions.id, id))
      .returning();
    return result;
  }
  
  // TTS Usage Logging
  async logTtsUsage(usage: schema.InsertTtsUsage): Promise<schema.TtsUsage> {
    const [result] = await db.insert(schema.ttsUsage).values(usage as any).returning();
    return result;
  }
  
  // User Onboarding Profiles
  async getUserOnboardingProfile(userId: number): Promise<schema.UserOnboardingProfile | undefined> {
    const result = await db.query.userOnboardingProfiles.findFirst({
      where: eq(schema.userOnboardingProfiles.userId, userId),
    });
    return result;
  }
  
  async upsertUserOnboardingProfile(profile: schema.InsertUserOnboardingProfile): Promise<schema.UserOnboardingProfile> {
    const existing = await this.getUserOnboardingProfile(profile.userId);
    if (existing) {
      const [result] = await db.update(schema.userOnboardingProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(schema.userOnboardingProfiles.userId, profile.userId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(schema.userOnboardingProfiles)
        .values(profile as any)
        .returning();
      return result;
    }
  }
  
  // Card Media Assets
  async getCardMediaAssets(cardId: number): Promise<schema.CardMediaAsset[]> {
    const result = await db.query.cardMediaAssets.findMany({
      where: and(
        eq(schema.cardMediaAssets.cardId, cardId),
        eq(schema.cardMediaAssets.isActive, true)
      ),
    });
    return result;
  }
  
  async getCardMediaAsset(id: number): Promise<schema.CardMediaAsset | undefined> {
    const result = await db.query.cardMediaAssets.findFirst({
      where: eq(schema.cardMediaAssets.id, id),
    });
    return result;
  }
  
  async createCardMediaAsset(asset: schema.InsertCardMediaAsset): Promise<schema.CardMediaAsset> {
    const [result] = await db.insert(schema.cardMediaAssets).values(asset as any).returning();
    return result;
  }
  
  async deleteCardMediaAsset(id: number): Promise<void> {
    await db.delete(schema.cardMediaAssets).where(eq(schema.cardMediaAssets.id, id));
  }
  
  async softDeleteCardMediaAsset(id: number): Promise<void> {
    await db.update(schema.cardMediaAssets)
      .set({ isActive: false })
      .where(eq(schema.cardMediaAssets.id, id));
  }
  
  // User Storage Usage
  async getUserStorageUsage(userId: number): Promise<schema.UserStorageUsage | undefined> {
    const result = await db.query.userStorageUsage.findFirst({
      where: eq(schema.userStorageUsage.userId, userId),
    });
    return result;
  }
  
  async getOrCreateUserStorageUsage(userId: number): Promise<schema.UserStorageUsage> {
    let usage = await this.getUserStorageUsage(userId);
    if (!usage) {
      const [result] = await db.insert(schema.userStorageUsage)
        .values({ userId, totalBytesUsed: 0, imageCount: 0, videoCount: 0 })
        .returning();
      usage = result;
    }
    return usage;
  }
  
  async updateStorageUsage(userId: number, deltaBytes: number, deltaImages: number, deltaVideos: number): Promise<schema.UserStorageUsage> {
    const current = await this.getOrCreateUserStorageUsage(userId);
    const [result] = await db.update(schema.userStorageUsage)
      .set({
        totalBytesUsed: Math.max(0, current.totalBytesUsed + deltaBytes),
        imageCount: Math.max(0, current.imageCount + deltaImages),
        videoCount: Math.max(0, current.videoCount + deltaVideos),
        updatedAt: new Date(),
      })
      .where(eq(schema.userStorageUsage.userId, userId))
      .returning();
    return result;
  }

  // Preview Instances
  async getPreviewInstance(id: string): Promise<schema.PreviewInstance | undefined> {
    const result = await db.query.previewInstances.findFirst({
      where: eq(schema.previewInstances.id, id),
    });
    return result;
  }

  async createPreviewInstance(preview: schema.InsertPreviewInstance): Promise<schema.PreviewInstance> {
    const [result] = await db.insert(schema.previewInstances).values(preview as any).returning();
    return result;
  }

  async updatePreviewInstance(id: string, data: Partial<schema.InsertPreviewInstance>): Promise<schema.PreviewInstance | undefined> {
    const [result] = await db.update(schema.previewInstances)
      .set({...data, lastActiveAt: new Date()})
      .where(eq(schema.previewInstances.id, id))
      .returning();
    return result;
  }

  async archivePreviewInstance(id: string): Promise<void> {
    await db.update(schema.previewInstances)
      .set({ status: 'archived', archivedAt: new Date() })
      .where(eq(schema.previewInstances.id, id));
  }

  async getExpiredPreviews(): Promise<schema.PreviewInstance[]> {
    const result = await db.query.previewInstances.findMany({
      where: and(
        eq(schema.previewInstances.status, 'active'),
        // expiresAt < now
        sql`${schema.previewInstances.expiresAt} < NOW()`
      ),
    });
    return result;
  }

  async countUserPreviewsToday(userId: number): Promise<number> {
    const result = await db.query.previewInstances.findMany({
      where: and(
        eq(schema.previewInstances.ownerUserId, userId),
        // createdAt > start of today
        sql`${schema.previewInstances.createdAt} > CURRENT_DATE`
      ),
    });
    return result.length;
  }

  async countIpPreviewsToday(ip: string): Promise<number> {
    const result = await db.query.previewInstances.findMany({
      where: and(
        eq(schema.previewInstances.ownerIp, ip),
        // createdAt > start of today
        sql`${schema.previewInstances.createdAt} > CURRENT_DATE`
      ),
    });
    return result.length;
  }

  // Preview Chat Messages
  async getPreviewChatMessages(previewId: string, limit: number = 50): Promise<schema.PreviewChatMessage[]> {
    const result = await db.query.previewChatMessages.findMany({
      where: eq(schema.previewChatMessages.previewId, previewId),
      orderBy: desc(schema.previewChatMessages.createdAt),
      limit,
    });
    return result.reverse(); // Oldest first
  }

  async addPreviewChatMessage(message: schema.InsertPreviewChatMessage): Promise<schema.PreviewChatMessage> {
    const [result] = await db.insert(schema.previewChatMessages).values(message as any).returning();
    return result;
  }

  async incrementPreviewMessageCount(previewId: string): Promise<void> {
    await db.update(schema.previewInstances)
      .set({ messageCount: sql`${schema.previewInstances.messageCount} + 1` })
      .where(eq(schema.previewInstances.id, previewId));
  }

  /**
   * Atomically increment message count only if under limit
   * Prevents race condition where multiple concurrent requests bypass the cap
   * @returns The new message count if successful, null if at/over limit
   */
  async incrementPreviewMessageCountIfUnderLimit(previewId: string, maxMessages: number): Promise<number | null> {
    const result = await db.update(schema.previewInstances)
      .set({ messageCount: sql`${schema.previewInstances.messageCount} + 1` })
      .where(
        and(
          eq(schema.previewInstances.id, previewId),
          sql`${schema.previewInstances.messageCount} < ${maxMessages}`
        )
      )
      .returning({ messageCount: schema.previewInstances.messageCount });

    // If no rows updated, we hit the limit
    return result.length > 0 ? result[0].messageCount : null;
  }

  // Orbit Meta
  async getOrbitMeta(businessSlug: string): Promise<schema.OrbitMeta | undefined> {
    const result = await db.query.orbitMeta.findFirst({
      where: eq(schema.orbitMeta.businessSlug, businessSlug),
    });
    return result;
  }

  async getOrbitMetaById(id: number): Promise<schema.OrbitMeta | undefined> {
    const result = await db.query.orbitMeta.findFirst({
      where: eq(schema.orbitMeta.id, id),
    });
    return result;
  }

  async getOrbitMetaByPreviewId(previewId: string): Promise<schema.OrbitMeta | undefined> {
    const result = await db.query.orbitMeta.findFirst({
      where: eq(schema.orbitMeta.previewId, previewId),
    });
    return result;
  }

  async getOrbitMetaByDomain(domain: string): Promise<schema.OrbitMeta | undefined> {
    const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
    const results = await db.query.orbitMeta.findMany({
      where: sql`lower(${schema.orbitMeta.sourceUrl}) LIKE ${'%://' + normalizedDomain + '%'} OR lower(${schema.orbitMeta.sourceUrl}) LIKE ${'%://www.' + normalizedDomain + '%'}`,
    });
    for (const result of results) {
      try {
        const url = new URL(result.sourceUrl);
        const sourceDomain = url.hostname.replace(/^www\./, '').toLowerCase();
        if (sourceDomain === normalizedDomain) {
          return result;
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  async getOrbitsByOwner(userId: number): Promise<schema.OrbitMeta[]> {
    const results = await db.query.orbitMeta.findMany({
      where: eq(schema.orbitMeta.ownerId, userId),
      orderBy: [desc(schema.orbitMeta.lastUpdated)],
    });
    return results;
  }

  async createOrbitMeta(data: schema.InsertOrbitMeta): Promise<schema.OrbitMeta> {
    const [result] = await db.insert(schema.orbitMeta).values(data as any).returning();
    return result;
  }

  async updateOrbitMeta(businessSlug: string, data: Partial<schema.InsertOrbitMeta>): Promise<schema.OrbitMeta | undefined> {
    const [result] = await db.update(schema.orbitMeta)
      .set({ ...data, lastUpdated: new Date() })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug))
      .returning();
    return result;
  }

  async setOrbitGenerationStatus(businessSlug: string, status: schema.OrbitGenerationStatus, error?: string): Promise<void> {
    const updateData: Partial<schema.InsertOrbitMeta> = {
      generationStatus: status,
      lastError: error || null,
    };
    
    if (status === 'generating') {
      updateData.requestedAt = new Date();
    } else if (status === 'ready' || status === 'failed') {
      updateData.completedAt = new Date();
    }
    
    await db.update(schema.orbitMeta)
      .set({ ...updateData, lastUpdated: new Date() })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug));
  }

  async setOrbitPackVersion(businessSlug: string, version: string, key: string): Promise<void> {
    await db.update(schema.orbitMeta)
      .set({
        currentPackVersion: version,
        currentPackKey: key,
        totalPackVersions: sql`${schema.orbitMeta.totalPackVersions} + 1`,
        lastUpdated: new Date(),
      })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug));
  }

  async setOrbitPreviewId(businessSlug: string, previewId: string): Promise<void> {
    await db.update(schema.orbitMeta)
      .set({
        previewId,
        lastUpdated: new Date(),
      })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug));
  }

  async claimOrbit(businessSlug: string, email: string, userId?: number): Promise<void> {
    await db.update(schema.orbitMeta)
      .set({
        ownerId: userId || null,
        ownerEmail: email,
        verifiedAt: new Date(),
        lastUpdated: new Date(),
      })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug));
  }

  async createClaimToken(data: schema.InsertOrbitClaimToken): Promise<schema.OrbitClaimToken> {
    const [result] = await db.insert(schema.orbitClaimTokens).values(data as any).returning();
    return result;
  }

  async getClaimToken(token: string): Promise<schema.OrbitClaimToken | undefined> {
    const result = await db.query.orbitClaimTokens.findFirst({
      where: eq(schema.orbitClaimTokens.token, token),
    });
    return result;
  }

  async markClaimTokenUsed(token: string): Promise<void> {
    await db.update(schema.orbitClaimTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.orbitClaimTokens.token, token));
  }

  // Orbit Sources (Power-Up)
  async upsertOrbitSources(
    businessSlug: string, 
    sources: Array<{ label: schema.OrbitSourceLabel; sourceType: schema.OrbitSourceType; value: string }>
  ): Promise<schema.OrbitSource[]> {
    const results: schema.OrbitSource[] = [];
    
    for (const source of sources) {
      const [upserted] = await db
        .insert(schema.orbitSources)
        .values({
          businessSlug,
          label: source.label,
          sourceType: source.sourceType,
          value: source.value,
        })
        .onConflictDoUpdate({
          target: [schema.orbitSources.businessSlug, schema.orbitSources.label],
          set: {
            sourceType: source.sourceType,
            value: source.value,
            updatedAt: new Date(),
          },
        })
        .returning();
      results.push(upserted);
    }
    
    return results;
  }

  async getOrbitSources(businessSlug: string): Promise<schema.OrbitSource[]> {
    const results = await db.query.orbitSources.findMany({
      where: eq(schema.orbitSources.businessSlug, businessSlug),
      orderBy: [asc(schema.orbitSources.createdAt)],
    });
    return results;
  }

  async updateOrbitTierAndStrength(
    businessSlug: string, 
    planTier: string, 
    strengthScore: number
  ): Promise<schema.OrbitMeta | undefined> {
    const [updated] = await db
      .update(schema.orbitMeta)
      .set({ 
        planTier, 
        strengthScore,
        lastUpdated: new Date(),
      })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug))
      .returning();
    return updated;
  }

  // Hero Posts implementation
  async createHeroPost(data: schema.InsertHeroPost): Promise<schema.HeroPost> {
    const [created] = await db.insert(schema.heroPosts).values(data as any).returning();
    return created;
  }

  async getHeroPosts(
    businessSlug: string, 
    filters?: { status?: schema.HeroPostStatus; platform?: schema.HeroPostPlatform; limit?: number }
  ): Promise<schema.HeroPost[]> {
    const conditions = [eq(schema.heroPosts.businessSlug, businessSlug)];
    
    if (filters?.status) {
      conditions.push(eq(schema.heroPosts.status, filters.status));
    }
    if (filters?.platform) {
      conditions.push(eq(schema.heroPosts.sourcePlatform, filters.platform));
    }
    
    const results = await db.query.heroPosts.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.heroPosts.createdAt)],
      limit: filters?.limit || 100,
    });
    return results;
  }

  async getHeroPost(id: number): Promise<schema.HeroPost | undefined> {
    return db.query.heroPosts.findFirst({
      where: eq(schema.heroPosts.id, id),
    });
  }

  async getHeroPostByUrl(businessSlug: string, url: string): Promise<schema.HeroPost | undefined> {
    return db.query.heroPosts.findFirst({
      where: and(
        eq(schema.heroPosts.businessSlug, businessSlug),
        eq(schema.heroPosts.url, url)
      ),
    });
  }

  async updateHeroPost(id: number, data: Partial<schema.InsertHeroPost>): Promise<schema.HeroPost | undefined> {
    const [updated] = await db
      .update(schema.heroPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.heroPosts.id, id))
      .returning();
    return updated;
  }

  async deleteHeroPost(id: number): Promise<void> {
    await db.delete(schema.heroPosts).where(eq(schema.heroPosts.id, id));
  }

  async getHeroPostsAsKnowledge(businessSlug: string): Promise<schema.HeroPost[]> {
    return db.query.heroPosts.findMany({
      where: and(
        eq(schema.heroPosts.businessSlug, businessSlug),
        eq(schema.heroPosts.useAsKnowledge, true),
        eq(schema.heroPosts.status, 'ready')
      ),
    });
  }

  async countHeroPostsAsKnowledge(businessSlug: string): Promise<number> {
    const posts = await this.getHeroPostsAsKnowledge(businessSlug);
    return posts.filter(p => p.text && p.text.length > 0).length;
  }

  async toggleHeroPostKnowledge(id: number, useAsKnowledge: boolean): Promise<schema.HeroPost | undefined> {
    const [updated] = await db
      .update(schema.heroPosts)
      .set({ useAsKnowledge, updatedAt: new Date() })
      .where(eq(schema.heroPosts.id, id))
      .returning();
    return updated;
  }

  async getHeroPostInsights(businessSlug: string): Promise<schema.HeroPostInsight | undefined> {
    return db.query.heroPostInsights.findFirst({
      where: eq(schema.heroPostInsights.businessSlug, businessSlug),
    });
  }

  async upsertHeroPostInsights(
    businessSlug: string, 
    data: Partial<schema.InsertHeroPostInsight>
  ): Promise<schema.HeroPostInsight> {
    const [result] = await db
      .insert(schema.heroPostInsights)
      .values({ 
        businessSlug, 
        ...data,
        updatedAt: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: schema.heroPostInsights.businessSlug,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Orbit Documents implementation
  async createOrbitDocument(data: schema.InsertOrbitDocument): Promise<schema.OrbitDocument> {
    const [created] = await db.insert(schema.orbitDocuments).values(data as any).returning();
    return created;
  }

  async getOrbitDocuments(businessSlug: string): Promise<schema.OrbitDocument[]> {
    return db.query.orbitDocuments.findMany({
      where: eq(schema.orbitDocuments.businessSlug, businessSlug),
      orderBy: [desc(schema.orbitDocuments.createdAt)],
    });
  }

  async getOrbitDocument(id: number): Promise<schema.OrbitDocument | undefined> {
    return db.query.orbitDocuments.findFirst({
      where: eq(schema.orbitDocuments.id, id),
    });
  }

  async updateOrbitDocument(id: number, data: Partial<schema.InsertOrbitDocument>): Promise<schema.OrbitDocument | undefined> {
    const [updated] = await db
      .update(schema.orbitDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.orbitDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteOrbitDocument(id: number): Promise<void> {
    await db.delete(schema.orbitDocuments).where(eq(schema.orbitDocuments.id, id));
  }

  // Orbit Videos implementation
  async createOrbitVideo(data: schema.InsertOrbitVideo): Promise<schema.OrbitVideo> {
    const [created] = await db.insert(schema.orbitVideos).values(data as any).returning();
    return created;
  }

  async getOrbitVideos(businessSlug: string, enabledOnly: boolean = false): Promise<schema.OrbitVideo[]> {
    const conditions = [eq(schema.orbitVideos.businessSlug, businessSlug)];
    if (enabledOnly) {
      conditions.push(eq(schema.orbitVideos.isEnabled, true));
    }
    return db.query.orbitVideos.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.orbitVideos.createdAt)],
    });
  }

  async getOrbitVideo(id: number): Promise<schema.OrbitVideo | undefined> {
    return db.query.orbitVideos.findFirst({
      where: eq(schema.orbitVideos.id, id),
    });
  }

  async updateOrbitVideo(id: number, data: Partial<schema.InsertOrbitVideo>): Promise<schema.OrbitVideo | undefined> {
    const [updated] = await db
      .update(schema.orbitVideos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.orbitVideos.id, id))
      .returning();
    return updated;
  }

  async deleteOrbitVideo(id: number): Promise<void> {
    await db.delete(schema.orbitVideos).where(eq(schema.orbitVideos.id, id));
  }

  async incrementVideoStats(videoId: number, stats: { serve?: boolean; play?: boolean; watchTimeMs?: number }): Promise<void> {
    const updates: any = { updatedAt: new Date() };
    if (stats.serve) {
      updates.serveCount = sql`${schema.orbitVideos.serveCount} + 1`;
    }
    if (stats.play) {
      updates.playCount = sql`${schema.orbitVideos.playCount} + 1`;
    }
    if (stats.watchTimeMs) {
      updates.totalWatchTimeMs = sql`${schema.orbitVideos.totalWatchTimeMs} + ${stats.watchTimeMs}`;
    }
    await db.update(schema.orbitVideos).set(updates).where(eq(schema.orbitVideos.id, videoId));
  }

  async createVideoEvent(data: schema.InsertOrbitVideoEvent): Promise<schema.OrbitVideoEvent> {
    const [created] = await db.insert(schema.orbitVideoEvents).values(data as any).returning();
    return created;
  }

  async getVideoEvents(videoId: number, limit: number = 100): Promise<schema.OrbitVideoEvent[]> {
    return db.query.orbitVideoEvents.findMany({
      where: eq(schema.orbitVideoEvents.videoId, videoId),
      orderBy: [desc(schema.orbitVideoEvents.createdAt)],
      limit,
    });
  }

  async getOrCreateTodayAnalytics(businessSlug: string): Promise<schema.OrbitAnalytics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existing = await db.query.orbitAnalytics.findFirst({
      where: and(
        eq(schema.orbitAnalytics.businessSlug, businessSlug),
        eq(schema.orbitAnalytics.date, today)
      ),
    });
    
    if (existing) return existing;
    
    const [created] = await db.insert(schema.orbitAnalytics)
      .values({
        businessSlug,
        date: today,
        visits: 0,
        interactions: 0,
        conversations: 0,
        iceViews: 0,
        uniqueVisitors: 0,
        avgSessionDuration: 0,
      })
      .returning();
    return created;
  }

  async incrementOrbitMetric(businessSlug: string, metric: 'visits' | 'interactions' | 'conversations' | 'iceViews'): Promise<void> {
    await this.getOrCreateTodayAnalytics(businessSlug);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const columnMap = {
      visits: schema.orbitAnalytics.visits,
      interactions: schema.orbitAnalytics.interactions,
      conversations: schema.orbitAnalytics.conversations,
      iceViews: schema.orbitAnalytics.iceViews,
    };
    
    await db.update(schema.orbitAnalytics)
      .set({ [metric]: sql`${columnMap[metric]} + 1` })
      .where(and(
        eq(schema.orbitAnalytics.businessSlug, businessSlug),
        eq(schema.orbitAnalytics.date, today)
      ));
  }

  async getOrbitAnalytics(businessSlug: string, days: number = 30): Promise<schema.OrbitAnalytics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const results = await db.query.orbitAnalytics.findMany({
      where: and(
        eq(schema.orbitAnalytics.businessSlug, businessSlug),
        gte(schema.orbitAnalytics.date, startDate)
      ),
      orderBy: [desc(schema.orbitAnalytics.date)],
    });
    return results;
  }

  async getOrbitAnalyticsSummary(businessSlug: string, days: number = 30): Promise<{
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
  }> {
    const analytics = await this.getOrbitAnalytics(businessSlug, days);
    
    return analytics.reduce((acc, day) => ({
      visits: acc.visits + day.visits,
      interactions: acc.interactions + day.interactions,
      conversations: acc.conversations + day.conversations,
      iceViews: acc.iceViews + day.iceViews,
    }), { visits: 0, interactions: 0, conversations: 0, iceViews: 0 });
  }

  async getMonthlyConversationCount(businessSlug: string): Promise<number> {
    // Use UTC to ensure consistent month boundaries regardless of server timezone
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const results = await db.query.orbitAnalytics.findMany({
      where: and(
        eq(schema.orbitAnalytics.businessSlug, businessSlug),
        gte(schema.orbitAnalytics.date, startOfMonth)
      ),
    });

    return results.reduce((sum, day) => sum + day.conversations, 0);
  }

  // Orbit Leads
  async createOrbitLead(data: schema.InsertOrbitLead): Promise<schema.OrbitLead> {
    const [lead] = await db.insert(schema.orbitLeads).values(data).returning();
    return lead;
  }

  async getOrbitLeads(businessSlug: string, limit: number = 50): Promise<schema.OrbitLead[]> {
    const results = await db.query.orbitLeads.findMany({
      where: eq(schema.orbitLeads.businessSlug, businessSlug),
      orderBy: [desc(schema.orbitLeads.createdAt)],
      limit,
    });
    return results;
  }

  async getOrbitLeadsCount(businessSlug: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.orbitLeads)
      .where(eq(schema.orbitLeads.businessSlug, businessSlug));
    return Number(result[0]?.count || 0);
  }

  async markLeadRead(leadId: number): Promise<void> {
    await db.update(schema.orbitLeads)
      .set({ isRead: true })
      .where(eq(schema.orbitLeads.id, leadId));
  }

  // Orbit Boxes (Grid Curation)
  async getOrbitBoxes(businessSlug: string, includeHidden: boolean = false): Promise<schema.OrbitBox[]> {
    const conditions = [eq(schema.orbitBoxes.businessSlug, businessSlug)];
    if (!includeHidden) {
      conditions.push(eq(schema.orbitBoxes.isVisible, true));
    }
    
    const results = await db.query.orbitBoxes.findMany({
      where: and(...conditions),
      orderBy: [asc(schema.orbitBoxes.sortOrder)],
    });
    return results;
  }

  async getOrbitBox(id: number): Promise<schema.OrbitBox | undefined> {
    const result = await db.query.orbitBoxes.findFirst({
      where: eq(schema.orbitBoxes.id, id),
    });
    return result;
  }

  async createOrbitBox(data: schema.InsertOrbitBox): Promise<schema.OrbitBox> {
    // Auto-assign sortOrder if not provided to prevent NULL sort order issues
    if (data.sortOrder === undefined || data.sortOrder === null) {
      const maxOrderResult = await db.query.orbitBoxes.findMany({
        where: eq(schema.orbitBoxes.businessSlug, data.businessSlug),
        orderBy: [desc(schema.orbitBoxes.sortOrder)],
        limit: 1,
      });

      const maxOrder = maxOrderResult.length > 0 && maxOrderResult[0].sortOrder !== null
        ? maxOrderResult[0].sortOrder
        : 0;

      data.sortOrder = maxOrder + 1;
    }

    const [box] = await db.insert(schema.orbitBoxes).values(data).returning();
    return box;
  }

  async updateOrbitBox(id: number, data: Partial<schema.InsertOrbitBox>): Promise<schema.OrbitBox | undefined> {
    const [box] = await db.update(schema.orbitBoxes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.orbitBoxes.id, id))
      .returning();
    return box;
  }

  async deleteOrbitBox(id: number): Promise<void> {
    await db.delete(schema.orbitBoxes)
      .where(eq(schema.orbitBoxes.id, id));
  }

  async reorderOrbitBoxes(businessSlug: string, boxIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < boxIds.length; i++) {
        await tx.update(schema.orbitBoxes)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(
            eq(schema.orbitBoxes.id, boxIds[i]),
            eq(schema.orbitBoxes.businessSlug, businessSlug)
          ));
      }
    });
  }

  async getOrbitBoxesByCategory(businessSlug: string): Promise<Map<string, schema.OrbitBox[]>> {
    const boxes = await this.getOrbitBoxes(businessSlug);
    const categoryMap = new Map<string, schema.OrbitBox[]>();
    
    for (const box of boxes) {
      const category = box.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(box);
    }
    
    return categoryMap;
  }

  async bulkImportOrbitBoxes(
    businessSlug: string, 
    items: schema.InsertOrbitBox[], 
    clearExisting: boolean = false
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    await db.transaction(async (tx) => {
      if (clearExisting) {
        await tx.delete(schema.orbitBoxes)
          .where(and(
            eq(schema.orbitBoxes.businessSlug, businessSlug),
            inArray(schema.orbitBoxes.boxType, ['product', 'menu_item'])
          ));
      }
      
      const existingBoxes = await tx.query.orbitBoxes.findMany({
        where: eq(schema.orbitBoxes.businessSlug, businessSlug),
      });
      const existingSkus = new Set(existingBoxes.map(b => b.sku).filter(Boolean));
      const maxOrder = Math.max(0, ...existingBoxes.map(b => b.sortOrder));
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.sku && existingSkus.has(item.sku) && !clearExisting) {
          skipped++;
          continue;
        }
        
        await tx.insert(schema.orbitBoxes).values({
          ...item,
          businessSlug,
          sortOrder: maxOrder + i + 1,
        });
        imported++;
      }
    });
    
    return { imported, skipped };
  }

  async deleteOrbitBoxesByType(businessSlug: string, boxType: schema.OrbitBoxType): Promise<number> {
    const result = await db.delete(schema.orbitBoxes)
      .where(and(
        eq(schema.orbitBoxes.businessSlug, businessSlug),
        eq(schema.orbitBoxes.boxType, boxType)
      ))
      .returning({ id: schema.orbitBoxes.id });
    return result.length;
  }

  // Phase 2: Orbit Sessions
  async getOrCreateOrbitSession(sessionId: string, businessSlug: string): Promise<schema.OrbitSession> {
    const existing = await db.query.orbitSessions.findFirst({
      where: eq(schema.orbitSessions.sessionId, sessionId),
    });
    if (existing) {
      await db.update(schema.orbitSessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(schema.orbitSessions.sessionId, sessionId));
      return { ...existing, lastActivityAt: new Date() };
    }
    const [session] = await db.insert(schema.orbitSessions)
      .values({ sessionId, businessSlug })
      .returning();
    return session;
  }

  async getOrbitSession(sessionId: string): Promise<schema.OrbitSession | undefined> {
    return db.query.orbitSessions.findFirst({
      where: eq(schema.orbitSessions.sessionId, sessionId),
    });
  }

  async updateOrbitSession(sessionId: string, data: Partial<schema.InsertOrbitSession>): Promise<schema.OrbitSession | undefined> {
    const [session] = await db.update(schema.orbitSessions)
      .set({ ...data, lastActivityAt: new Date() })
      .where(eq(schema.orbitSessions.sessionId, sessionId))
      .returning();
    return session;
  }

  // Phase 2: Orbit Events
  async logOrbitEvent(data: schema.InsertOrbitEvent): Promise<schema.OrbitEvent> {
    const [event] = await db.insert(schema.orbitEvents).values(data).returning();
    await db.update(schema.orbitSessions)
      .set({ 
        eventCount: sql`${schema.orbitSessions.eventCount} + 1`,
        lastActivityAt: new Date()
      })
      .where(eq(schema.orbitSessions.sessionId, data.sessionId));
    return event;
  }

  async getOrbitEvents(sessionId: string): Promise<schema.OrbitEvent[]> {
    return db.query.orbitEvents.findMany({
      where: eq(schema.orbitEvents.sessionId, sessionId),
      orderBy: [asc(schema.orbitEvents.createdAt)],
    });
  }

  async getOrbitEventsBySlug(businessSlug: string, limit: number = 100): Promise<schema.OrbitEvent[]> {
    return db.query.orbitEvents.findMany({
      where: eq(schema.orbitEvents.businessSlug, businessSlug),
      orderBy: [desc(schema.orbitEvents.createdAt)],
      limit,
    });
  }

  async logOrbitProductEvent(data: {
    businessSlug: string;
    eventType: string;
    intent?: string;
    messageContent?: string;
    productId?: string;
    conversationId?: number | null;
  }): Promise<void> {
    try {
      const session = await this.getOrCreateOrbitSession(`product-analytics-${Date.now()}`, data.businessSlug);
      
      await db.insert(schema.orbitEvents).values({
        businessSlug: data.businessSlug,
        sessionId: session.sessionId,
        eventType: 'chat_message' as schema.OrbitEventType,
        conversationId: data.conversationId || undefined,
        metadataJson: {
          productAnalytics: true,
          analyticsType: data.eventType,
          intent: data.intent,
          messagePreview: data.messageContent?.slice(0, 100),
          productId: data.productId,
        },
      });
    } catch (err) {
      console.error('Error logging product event:', err);
    }
  }

  // Phase 2: Orbit Conversations
  async createOrbitConversation(data: schema.InsertOrbitConversation): Promise<schema.OrbitConversation> {
    const [conversation] = await db.insert(schema.orbitConversations).values(data).returning();
    return conversation;
  }

  async getOrbitConversation(id: number): Promise<schema.OrbitConversation | undefined> {
    return db.query.orbitConversations.findFirst({
      where: eq(schema.orbitConversations.id, id),
    });
  }

  async getOrbitConversations(businessSlug: string, limit: number = 50): Promise<schema.OrbitConversation[]> {
    return db.query.orbitConversations.findMany({
      where: eq(schema.orbitConversations.businessSlug, businessSlug),
      orderBy: [desc(schema.orbitConversations.lastMessageAt)],
      limit,
    });
  }

  async updateOrbitConversation(id: number, data: Partial<schema.InsertOrbitConversation>): Promise<schema.OrbitConversation | undefined> {
    const [conversation] = await db.update(schema.orbitConversations)
      .set({ ...data, lastMessageAt: new Date() })
      .where(eq(schema.orbitConversations.id, id))
      .returning();
    return conversation;
  }

  // Phase 2: Orbit Messages
  async addOrbitMessage(data: schema.InsertOrbitMessage): Promise<schema.OrbitMessage> {
    const [message] = await db.insert(schema.orbitMessages).values(data).returning();
    await db.update(schema.orbitConversations)
      .set({ 
        messageCount: sql`${schema.orbitConversations.messageCount} + 1`,
        lastMessageAt: new Date()
      })
      .where(eq(schema.orbitConversations.id, data.conversationId));
    return message;
  }

  async getOrbitMessages(conversationId: number): Promise<schema.OrbitMessage[]> {
    return db.query.orbitMessages.findMany({
      where: eq(schema.orbitMessages.conversationId, conversationId),
      orderBy: [asc(schema.orbitMessages.createdAt)],
    });
  }

  // Phase 2: Orbit Insights Summary
  async getOrbitInsightsSummary(businessSlug: string): Promise<schema.OrbitInsightsSummary | undefined> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return db.query.orbitInsightsSummary.findFirst({
      where: and(
        eq(schema.orbitInsightsSummary.businessSlug, businessSlug),
        gte(schema.orbitInsightsSummary.periodStart, startOfMonth)
      ),
    });
  }

  async upsertOrbitInsightsSummary(data: schema.InsertOrbitInsightsSummary): Promise<schema.OrbitInsightsSummary> {
    const existing = await this.getOrbitInsightsSummary(data.businessSlug);
    if (existing) {
      const [updated] = await db.update(schema.orbitInsightsSummary)
        .set({ ...data, lastUpdated: new Date() })
        .where(eq(schema.orbitInsightsSummary.id, existing.id))
        .returning();
      return updated;
    }
    const [summary] = await db.insert(schema.orbitInsightsSummary).values(data).returning();
    return summary;
  }

  // Phase 2: Orbit Lead with context
  async getOrbitLead(id: number): Promise<schema.OrbitLead | undefined> {
    return db.query.orbitLeads.findFirst({
      where: eq(schema.orbitLeads.id, id),
    });
  }

  async updateOrbitLead(id: number, data: Partial<schema.InsertOrbitLead>): Promise<schema.OrbitLead | undefined> {
    const [lead] = await db.update(schema.orbitLeads)
      .set(data)
      .where(eq(schema.orbitLeads.id, id))
      .returning();
    return lead;
  }

  // Phase 2: ICE Allowance
  async getOrbitIceAllowance(businessSlug: string): Promise<{ allowance: number; used: number; periodStart: Date | null }> {
    const meta = await this.getOrbitMeta(businessSlug);
    if (!meta) {
      return { allowance: 0, used: 0, periodStart: null };
    }
    return {
      allowance: meta.iceAllowanceMonthly || 0,
      used: meta.iceUsedThisPeriod || 0,
      periodStart: meta.icePeriodStart || null,
    };
  }

  async incrementOrbitIceUsed(businessSlug: string): Promise<void> {
    await db.update(schema.orbitMeta)
      .set({ iceUsedThisPeriod: sql`${schema.orbitMeta.iceUsedThisPeriod} + 1` })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug));
  }

  async resetOrbitIcePeriod(businessSlug: string, allowance: number): Promise<void> {
    await db.update(schema.orbitMeta)
      .set({ 
        iceAllowanceMonthly: allowance,
        iceUsedThisPeriod: 0,
        icePeriodStart: new Date()
      })
      .where(eq(schema.orbitMeta.businessSlug, businessSlug));
  }

  // Knowledge Coach: Proactive Gap Questions
  async createKnowledgePrompt(data: schema.InsertOrbitKnowledgePrompt): Promise<schema.OrbitKnowledgePrompt> {
    const [prompt] = await db.insert(schema.orbitKnowledgePrompts).values(data).returning();
    return prompt;
  }

  async createKnowledgePrompts(data: schema.InsertOrbitKnowledgePrompt[]): Promise<schema.OrbitKnowledgePrompt[]> {
    if (data.length === 0) return [];
    const prompts = await db.insert(schema.orbitKnowledgePrompts).values(data).returning();
    return prompts;
  }

  async getKnowledgePrompts(businessSlug: string, status?: schema.KnowledgePromptStatus): Promise<schema.OrbitKnowledgePrompt[]> {
    const conditions = [eq(schema.orbitKnowledgePrompts.businessSlug, businessSlug)];
    if (status) {
      conditions.push(eq(schema.orbitKnowledgePrompts.status, status));
    }
    return db.query.orbitKnowledgePrompts.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.orbitKnowledgePrompts.impactScore), desc(schema.orbitKnowledgePrompts.createdAt)],
    });
  }

  async getKnowledgePrompt(id: number): Promise<schema.OrbitKnowledgePrompt | undefined> {
    return db.query.orbitKnowledgePrompts.findFirst({
      where: eq(schema.orbitKnowledgePrompts.id, id),
    });
  }

  async updateKnowledgePrompt(id: number, data: Partial<schema.InsertOrbitKnowledgePrompt>): Promise<schema.OrbitKnowledgePrompt | undefined> {
    const [prompt] = await db.update(schema.orbitKnowledgePrompts)
      .set(data)
      .where(eq(schema.orbitKnowledgePrompts.id, id))
      .returning();
    return prompt;
  }

  async getPendingKnowledgePromptsCount(businessSlug: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.orbitKnowledgePrompts)
      .where(and(
        eq(schema.orbitKnowledgePrompts.businessSlug, businessSlug),
        eq(schema.orbitKnowledgePrompts.status, 'pending')
      ));
    return Number(result[0]?.count || 0);
  }

  async getWeeklyKnowledgePrompts(businessSlug: string, weekNumber: number): Promise<schema.OrbitKnowledgePrompt[]> {
    return db.query.orbitKnowledgePrompts.findMany({
      where: and(
        eq(schema.orbitKnowledgePrompts.businessSlug, businessSlug),
        eq(schema.orbitKnowledgePrompts.weekNumber, weekNumber)
      ),
      orderBy: [desc(schema.orbitKnowledgePrompts.impactScore)],
    });
  }

  async expireOldKnowledgePrompts(): Promise<number> {
    const result = await db.update(schema.orbitKnowledgePrompts)
      .set({ status: 'expired' })
      .where(and(
        eq(schema.orbitKnowledgePrompts.status, 'pending'),
        lt(schema.orbitKnowledgePrompts.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }

  async getEligibleOrbitsForKnowledgeCoach(): Promise<schema.OrbitMeta[]> {
    return db.query.orbitMeta.findMany({
      where: inArray(schema.orbitMeta.planTier, ['grow', 'intelligence']),
    });
  }

  // Phase 4: Notifications
  async createNotification(data: schema.InsertNotification): Promise<schema.Notification> {
    const [notification] = await db.insert(schema.notifications).values(data).returning();
    return notification;
  }

  async getNotifications(userId: number, limit: number = 50): Promise<schema.Notification[]> {
    return db.query.notifications.findMany({
      where: eq(schema.notifications.userId, userId),
      orderBy: [desc(schema.notifications.createdAt)],
      limit,
    });
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ));
    return Number(result[0]?.count || 0);
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, id));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.userId, userId));
  }

  async findNotificationByDedupeKey(dedupeKey: string): Promise<schema.Notification | undefined> {
    return db.query.notifications.findFirst({
      where: eq(schema.notifications.dedupeKey, dedupeKey),
    });
  }

  // Phase 4: Notification Preferences
  async getNotificationPreferences(userId: number): Promise<schema.NotificationPreferences | undefined> {
    return db.query.notificationPreferences.findFirst({
      where: eq(schema.notificationPreferences.userId, userId),
    });
  }

  async upsertNotificationPreferences(data: schema.InsertNotificationPreferences): Promise<schema.NotificationPreferences> {
    const existing = await this.getNotificationPreferences(data.userId);
    if (existing) {
      const [updated] = await db.update(schema.notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.notificationPreferences.userId, data.userId))
        .returning();
      return updated;
    }
    const [prefs] = await db.insert(schema.notificationPreferences).values(data).returning();
    return prefs;
  }

  // Phase 4: Magic Links
  async createMagicLink(data: schema.InsertMagicLink): Promise<schema.MagicLink> {
    const [link] = await db.insert(schema.magicLinks).values(data).returning();
    return link;
  }

  async getMagicLink(token: string): Promise<schema.MagicLink | undefined> {
    return db.query.magicLinks.findFirst({
      where: eq(schema.magicLinks.token, token),
    });
  }

  async markMagicLinkUsed(token: string): Promise<void> {
    await db.update(schema.magicLinks)
      .set({ usedAt: new Date() })
      .where(eq(schema.magicLinks.token, token));
  }

  async cleanupExpiredMagicLinks(): Promise<number> {
    const result = await db.delete(schema.magicLinks)
      .where(sql`${schema.magicLinks.expiresAt} < NOW()`)
      .returning();
    return result.length;
  }

  // Phase 5: Data Sources (API Snapshot Ingestion)
  // Secrets
  async createApiSecret(data: schema.InsertApiSecret): Promise<schema.ApiSecret> {
    const [secret] = await db.insert(schema.apiSecrets).values(data).returning();
    return secret;
  }

  async getApiSecret(id: number): Promise<schema.ApiSecret | undefined> {
    return db.query.apiSecrets.findFirst({
      where: eq(schema.apiSecrets.id, id),
    });
  }

  async getApiSecretsByOrbit(orbitSlug: string): Promise<schema.ApiSecret[]> {
    return db.query.apiSecrets.findMany({
      where: eq(schema.apiSecrets.orbitSlug, orbitSlug),
      orderBy: [desc(schema.apiSecrets.createdAt)],
    });
  }

  async deleteApiSecret(id: number): Promise<void> {
    await db.delete(schema.apiSecrets).where(eq(schema.apiSecrets.id, id));
  }

  // Connections
  async createApiConnection(data: schema.InsertApiConnection): Promise<schema.ApiConnection> {
    const [connection] = await db.insert(schema.apiConnections).values(data).returning();
    return connection;
  }

  async getApiConnection(id: number): Promise<schema.ApiConnection | undefined> {
    return db.query.apiConnections.findFirst({
      where: eq(schema.apiConnections.id, id),
    });
  }

  async getApiConnectionsByOrbit(orbitSlug: string): Promise<schema.ApiConnection[]> {
    return db.query.apiConnections.findMany({
      where: eq(schema.apiConnections.orbitSlug, orbitSlug),
      orderBy: [desc(schema.apiConnections.createdAt)],
    });
  }

  async updateApiConnection(id: number, data: Partial<schema.InsertApiConnection>): Promise<schema.ApiConnection | undefined> {
    const [connection] = await db.update(schema.apiConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.apiConnections.id, id))
      .returning();
    return connection;
  }

  async deleteApiConnection(id: number): Promise<void> {
    await db.delete(schema.apiConnections).where(eq(schema.apiConnections.id, id));
  }

  // Endpoints
  async createApiEndpoint(data: schema.InsertApiEndpoint): Promise<schema.ApiEndpoint> {
    const [endpoint] = await db.insert(schema.apiEndpoints).values(data).returning();
    return endpoint;
  }

  async getApiEndpoint(id: number): Promise<schema.ApiEndpoint | undefined> {
    return db.query.apiEndpoints.findFirst({
      where: eq(schema.apiEndpoints.id, id),
    });
  }

  async getApiEndpointsByConnection(connectionId: number): Promise<schema.ApiEndpoint[]> {
    return db.query.apiEndpoints.findMany({
      where: eq(schema.apiEndpoints.connectionId, connectionId),
      orderBy: [asc(schema.apiEndpoints.createdAt)],
    });
  }

  async updateApiEndpoint(id: number, data: Partial<schema.InsertApiEndpoint>): Promise<schema.ApiEndpoint | undefined> {
    const [endpoint] = await db.update(schema.apiEndpoints)
      .set(data)
      .where(eq(schema.apiEndpoints.id, id))
      .returning();
    return endpoint;
  }

  async deleteApiEndpoint(id: number): Promise<void> {
    await db.delete(schema.apiEndpoints).where(eq(schema.apiEndpoints.id, id));
  }

  // Snapshots
  async createApiSnapshot(data: schema.InsertApiSnapshot): Promise<schema.ApiSnapshot> {
    const [snapshot] = await db.insert(schema.apiSnapshots).values(data).returning();
    return snapshot;
  }

  async getApiSnapshot(id: number): Promise<schema.ApiSnapshot | undefined> {
    return db.query.apiSnapshots.findFirst({
      where: eq(schema.apiSnapshots.id, id),
    });
  }

  async getApiSnapshotsByEndpoint(endpointId: number, limit: number = 30): Promise<schema.ApiSnapshot[]> {
    return db.query.apiSnapshots.findMany({
      where: eq(schema.apiSnapshots.endpointId, endpointId),
      orderBy: [desc(schema.apiSnapshots.fetchedAt)],
      limit,
    });
  }

  async getLatestSnapshot(endpointId: number): Promise<schema.ApiSnapshot | undefined> {
    return db.query.apiSnapshots.findFirst({
      where: and(
        eq(schema.apiSnapshots.endpointId, endpointId),
        eq(schema.apiSnapshots.status, 'ready')
      ),
      orderBy: [desc(schema.apiSnapshots.version)],
    });
  }

  async updateApiSnapshot(id: number, data: Partial<schema.InsertApiSnapshot>): Promise<schema.ApiSnapshot | undefined> {
    const [snapshot] = await db.update(schema.apiSnapshots)
      .set(data)
      .where(eq(schema.apiSnapshots.id, id))
      .returning();
    return snapshot;
  }

  async getNextSnapshotVersion(endpointId: number): Promise<number> {
    const result = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${schema.apiSnapshots.version}), 0)` })
      .from(schema.apiSnapshots)
      .where(eq(schema.apiSnapshots.endpointId, endpointId));
    return (result[0]?.maxVersion || 0) + 1;
  }

  async findSnapshotByHash(endpointId: number, requestHash: string): Promise<schema.ApiSnapshot | undefined> {
    return db.query.apiSnapshots.findFirst({
      where: and(
        eq(schema.apiSnapshots.endpointId, endpointId),
        eq(schema.apiSnapshots.requestHash, requestHash)
      ),
    });
  }

  // ICE Drafts (Launchpad)
  async createIceDraft(data: schema.InsertIceDraft): Promise<schema.IceDraft> {
    const [draft] = await db.insert(schema.iceDrafts).values(data).returning();
    return draft;
  }

  async getIceDraft(id: number): Promise<schema.IceDraft | undefined> {
    return db.query.iceDrafts.findFirst({
      where: eq(schema.iceDrafts.id, id),
    });
  }

  async getIceDraftsByOrbit(businessSlug: string, limit: number = 20): Promise<schema.IceDraft[]> {
    return db.query.iceDrafts.findMany({
      where: eq(schema.iceDrafts.businessSlug, businessSlug),
      orderBy: [desc(schema.iceDrafts.createdAt)],
      limit,
    });
  }

  async updateIceDraft(id: number, data: Partial<schema.InsertIceDraft>): Promise<schema.IceDraft | undefined> {
    const [draft] = await db.update(schema.iceDrafts)
      .set(data)
      .where(eq(schema.iceDrafts.id, id))
      .returning();
    return draft;
  }

  async deleteIceDraft(id: number): Promise<void> {
    await db.delete(schema.iceDrafts).where(eq(schema.iceDrafts.id, id));
  }

  // Curated Items
  async createApiCuratedItem(data: schema.InsertApiCuratedItem): Promise<schema.ApiCuratedItem> {
    const [item] = await db.insert(schema.apiCuratedItems).values(data).returning();
    return item;
  }

  async createApiCuratedItems(data: schema.InsertApiCuratedItem[]): Promise<schema.ApiCuratedItem[]> {
    if (data.length === 0) return [];
    return db.insert(schema.apiCuratedItems).values(data).returning();
  }

  async getApiCuratedItemsBySnapshot(snapshotId: number): Promise<schema.ApiCuratedItem[]> {
    return db.query.apiCuratedItems.findMany({
      where: eq(schema.apiCuratedItems.snapshotId, snapshotId),
      orderBy: [asc(schema.apiCuratedItems.id)],
    });
  }

  async getApiCuratedItemsByOrbit(orbitSlug: string, limit: number = 100): Promise<schema.ApiCuratedItem[]> {
    return db.query.apiCuratedItems.findMany({
      where: eq(schema.apiCuratedItems.orbitSlug, orbitSlug),
      orderBy: [desc(schema.apiCuratedItems.indexedAt)],
      limit,
    });
  }

  async getLatestCuratedItemsByConnection(connectionId: number): Promise<schema.ApiCuratedItem[]> {
    // Get the latest snapshot for each endpoint in this connection
    const snapshots = await db.query.apiSnapshots.findMany({
      where: and(
        eq(schema.apiSnapshots.connectionId, connectionId),
        eq(schema.apiSnapshots.status, 'ready')
      ),
      orderBy: [desc(schema.apiSnapshots.version)],
    });
    
    if (snapshots.length === 0) return [];
    
    // Get items from the latest snapshot
    const latestSnapshot = snapshots[0];
    return this.getApiCuratedItemsBySnapshot(latestSnapshot.id);
  }

  // ============================================
  // DEVICE SESSIONS (AgoraCube / Thin Clients)
  // ============================================

  async createDeviceSession(data: schema.InsertDeviceSession): Promise<schema.DeviceSession> {
    const [session] = await db.insert(schema.deviceSessions).values(data).returning();
    return session;
  }

  async getDeviceSession(deviceId: string): Promise<schema.DeviceSession | undefined> {
    return db.query.deviceSessions.findFirst({
      where: and(
        eq(schema.deviceSessions.deviceId, deviceId),
        sql`${schema.deviceSessions.revokedAt} IS NULL`
      ),
    });
  }

  async getDeviceSessionByToken(tokenHash: string): Promise<schema.DeviceSession | undefined> {
    return db.query.deviceSessions.findFirst({
      where: and(
        eq(schema.deviceSessions.tokenHash, tokenHash),
        sql`${schema.deviceSessions.revokedAt} IS NULL`
      ),
    });
  }

  async getDeviceSessionByPairingCode(pairingCode: string): Promise<schema.DeviceSession | undefined> {
    return db.query.deviceSessions.findFirst({
      where: and(
        eq(schema.deviceSessions.pairingCode, pairingCode),
        sql`${schema.deviceSessions.pairingExpiresAt} > NOW()`,
        sql`${schema.deviceSessions.revokedAt} IS NULL`
      ),
    });
  }

  async getDeviceSessionsByOrbit(orbitSlug: string): Promise<schema.DeviceSession[]> {
    return db.query.deviceSessions.findMany({
      where: eq(schema.deviceSessions.orbitSlug, orbitSlug),
      orderBy: [desc(schema.deviceSessions.createdAt)],
    });
  }

  async updateDeviceSession(deviceId: string, data: Partial<schema.InsertDeviceSession>): Promise<schema.DeviceSession | undefined> {
    const [session] = await db.update(schema.deviceSessions)
      .set(data)
      .where(eq(schema.deviceSessions.deviceId, deviceId))
      .returning();
    return session;
  }

  async revokeDeviceSession(deviceId: string): Promise<void> {
    await db.update(schema.deviceSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.deviceSessions.deviceId, deviceId));
  }

  async clearPairingCode(deviceId: string): Promise<void> {
    await db.update(schema.deviceSessions)
      .set({ pairingCode: null, pairingExpiresAt: null })
      .where(eq(schema.deviceSessions.deviceId, deviceId));
  }

  // Device Events (Audit Log)
  async createDeviceEvent(data: schema.InsertDeviceEvent): Promise<schema.DeviceEvent> {
    const [event] = await db.insert(schema.deviceEvents).values(data).returning();
    return event;
  }

  async getDeviceEvents(deviceId: string, limit: number = 100): Promise<schema.DeviceEvent[]> {
    return db.query.deviceEvents.findMany({
      where: eq(schema.deviceEvents.deviceId, deviceId),
      orderBy: [desc(schema.deviceEvents.createdAt)],
      limit,
    });
  }

  async getDeviceEventsByOrbit(orbitSlug: string, limit: number = 100): Promise<schema.DeviceEvent[]> {
    return db.query.deviceEvents.findMany({
      where: eq(schema.deviceEvents.orbitSlug, orbitSlug),
      orderBy: [desc(schema.deviceEvents.createdAt)],
      limit,
    });
  }

  // Rate Limiting (Token Bucket)
  async getOrCreateRateLimit(deviceId: string, orbitSlug: string): Promise<schema.DeviceRateLimit> {
    const existing = await db.query.deviceRateLimits.findFirst({
      where: and(
        eq(schema.deviceRateLimits.deviceId, deviceId),
        eq(schema.deviceRateLimits.orbitSlug, orbitSlug)
      ),
    });
    
    if (existing) return existing;
    
    const [newLimit] = await db.insert(schema.deviceRateLimits)
      .values({ deviceId, orbitSlug, tokens: 10 })
      .returning();
    return newLimit;
  }

  async updateRateLimit(id: number, tokens: number): Promise<void> {
    await db.update(schema.deviceRateLimits)
      .set({ tokens, lastRefillAt: new Date() })
      .where(eq(schema.deviceRateLimits.id, id));
  }

  async consumeRateLimitToken(deviceId: string, orbitSlug: string): Promise<{ allowed: boolean; tokensRemaining: number; retryAfter?: number }> {
    const limit = await this.getOrCreateRateLimit(deviceId, orbitSlug);
    
    // Token bucket: refill 2 tokens per minute, max 10 (burst)
    const now = new Date();
    const lastRefill = new Date(limit.lastRefillAt);
    const minutesSinceRefill = (now.getTime() - lastRefill.getTime()) / 60000;
    const tokensToAdd = Math.floor(minutesSinceRefill * 2); // 2 tokens per minute = 120/hour
    const newTokens = Math.min(10, limit.tokens + tokensToAdd); // Cap at 10 (burst allowance)
    
    if (newTokens < 1) {
      // Calculate seconds until next token is available
      const secondsSinceLastRefill = minutesSinceRefill * 60;
      const secondsUntilNextToken = Math.ceil(30 - (secondsSinceLastRefill % 30)); // 30s per token
      return { allowed: false, tokensRemaining: 0, retryAfter: secondsUntilNextToken };
    }
    
    await this.updateRateLimit(limit.id, newTokens - 1);
    return { allowed: true, tokensRemaining: newTokens - 1 };
  }

  // ============================================
  // ORBIT CUBES (Physical Hardware Devices)
  // ============================================

  async createOrbitCube(data: schema.InsertOrbitCube): Promise<schema.OrbitCube> {
    const [cube] = await db.insert(schema.orbitCubes).values(data).returning();
    return cube;
  }

  async getOrbitCube(cubeUuid: string): Promise<schema.OrbitCube | undefined> {
    return db.query.orbitCubes.findFirst({
      where: eq(schema.orbitCubes.cubeUuid, cubeUuid),
    });
  }

  async getOrbitCubeById(id: number): Promise<schema.OrbitCube | undefined> {
    return db.query.orbitCubes.findFirst({
      where: eq(schema.orbitCubes.id, id),
    });
  }

  async getOrbitCubesByOrbit(orbitSlug: string): Promise<schema.OrbitCube[]> {
    return db.query.orbitCubes.findMany({
      where: and(
        eq(schema.orbitCubes.orbitSlug, orbitSlug),
        sql`${schema.orbitCubes.revokedAt} IS NULL`
      ),
      orderBy: [desc(schema.orbitCubes.createdAt)],
    });
  }

  async getOrbitCubeByPairingCode(pairingCode: string): Promise<schema.OrbitCube | undefined> {
    return db.query.orbitCubes.findFirst({
      where: and(
        eq(schema.orbitCubes.pairingCode, pairingCode),
        sql`${schema.orbitCubes.pairingCodeExpiresAt} > NOW()`,
        sql`${schema.orbitCubes.revokedAt} IS NULL`
      ),
    });
  }

  async updateOrbitCube(cubeUuid: string, data: Partial<schema.InsertOrbitCube>): Promise<schema.OrbitCube | undefined> {
    const [cube] = await db.update(schema.orbitCubes)
      .set(data)
      .where(eq(schema.orbitCubes.cubeUuid, cubeUuid))
      .returning();
    return cube;
  }

  async updateOrbitCubeById(id: number, data: Partial<schema.InsertOrbitCube>): Promise<schema.OrbitCube | undefined> {
    const [cube] = await db.update(schema.orbitCubes)
      .set(data)
      .where(eq(schema.orbitCubes.id, id))
      .returning();
    return cube;
  }

  async revokeOrbitCube(cubeUuid: string): Promise<void> {
    await db.update(schema.orbitCubes)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(schema.orbitCubes.cubeUuid, cubeUuid));
  }

  async regenerateCubePairingCode(cubeUuid: string): Promise<{ code: string; expiresAt: Date }> {
    const code = this.generatePairingCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await db.update(schema.orbitCubes)
      .set({ pairingCode: code, pairingCodeExpiresAt: expiresAt })
      .where(eq(schema.orbitCubes.cubeUuid, cubeUuid));
    
    return { code, expiresAt };
  }

  private generatePairingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Orbit Cube Orders
  async createOrbitCubeOrder(data: schema.InsertOrbitCubeOrder): Promise<schema.OrbitCubeOrder> {
    const [order] = await db.insert(schema.orbitCubeOrders).values(data).returning();
    return order;
  }

  async getOrbitCubeOrder(id: number): Promise<schema.OrbitCubeOrder | undefined> {
    return db.query.orbitCubeOrders.findFirst({
      where: eq(schema.orbitCubeOrders.id, id),
    });
  }

  async getOrbitCubeOrderByCheckoutSession(sessionId: string): Promise<schema.OrbitCubeOrder | undefined> {
    return db.query.orbitCubeOrders.findFirst({
      where: eq(schema.orbitCubeOrders.stripeCheckoutSessionId, sessionId),
    });
  }

  async getOrbitCubeOrdersByOrbit(orbitSlug: string): Promise<schema.OrbitCubeOrder[]> {
    return db.query.orbitCubeOrders.findMany({
      where: eq(schema.orbitCubeOrders.orbitSlug, orbitSlug),
      orderBy: [desc(schema.orbitCubeOrders.createdAt)],
    });
  }

  async updateOrbitCubeOrder(id: number, data: Partial<schema.InsertOrbitCubeOrder>): Promise<schema.OrbitCubeOrder | undefined> {
    const [order] = await db.update(schema.orbitCubeOrders)
      .set(data)
      .where(eq(schema.orbitCubeOrders.id, id))
      .returning();
    return order;
  }

  // Orbit Signal Access Log (AI Discovery Metrics)
  async logOrbitSignalAccess(data: schema.InsertOrbitSignalAccessLog): Promise<schema.OrbitSignalAccessLog> {
    const [log] = await db.insert(schema.orbitSignalAccessLog).values(data).returning();
    return log;
  }

  async getOrbitSignalAccessMetrics(orbitSlug: string, days: number = 30): Promise<{
    totalAccesses: number;
    lastAccessAt: Date | null;
    topUserAgents: { agent: string; count: number }[];
  }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const logs = await db.query.orbitSignalAccessLog.findMany({
      where: and(
        eq(schema.orbitSignalAccessLog.orbitSlug, orbitSlug),
        gte(schema.orbitSignalAccessLog.accessedAt, cutoff)
      ),
      orderBy: [desc(schema.orbitSignalAccessLog.accessedAt)],
    });
    
    const totalAccesses = logs.length;
    const lastAccessAt = logs.length > 0 ? logs[0].accessedAt : null;
    
    const agentCounts = new Map<string, number>();
    for (const log of logs) {
      const agent = log.userAgentTruncated || 'Unknown';
      agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
    }
    
    const topUserAgents = Array.from(agentCounts.entries())
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return { totalAccesses, lastAccessAt, topUserAgents };
  }

  // Blog Posts
  async getBlogPost(id: number): Promise<schema.BlogPost | undefined> {
    return db.query.blogPosts.findFirst({
      where: eq(schema.blogPosts.id, id),
    });
  }

  async getBlogPostBySlug(slug: string): Promise<schema.BlogPost | undefined> {
    return db.query.blogPosts.findFirst({
      where: eq(schema.blogPosts.slug, slug),
    });
  }

  async getAllBlogPosts(includeUnpublished: boolean = false): Promise<schema.BlogPost[]> {
    if (includeUnpublished) {
      return db.query.blogPosts.findMany({
        orderBy: [desc(schema.blogPosts.createdAt)],
      });
    }
    return db.query.blogPosts.findMany({
      where: eq(schema.blogPosts.status, 'published'),
      orderBy: [desc(schema.blogPosts.publishedAt)],
    });
  }

  async createBlogPost(data: schema.InsertBlogPost): Promise<schema.BlogPost> {
    const [post] = await db.insert(schema.blogPosts).values(data).returning();
    return post;
  }

  async updateBlogPost(id: number, data: Partial<schema.InsertBlogPost>): Promise<schema.BlogPost | undefined> {
    const [post] = await db.update(schema.blogPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.blogPosts.id, id))
      .returning();
    return post;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, id));
  }

  // Active Ice Hosting
  async activateIce(universeId: number, userId: number): Promise<schema.Universe | undefined> {
    const [result] = await db.update(schema.universes)
      .set({
        iceStatus: 'active',
        activeSince: new Date(),
        pausedAt: null,
        ownerUserId: userId,
      })
      .where(eq(schema.universes.id, universeId))
      .returning();
    return result;
  }

  async pauseIce(universeId: number): Promise<schema.Universe | undefined> {
    const [result] = await db.update(schema.universes)
      .set({
        iceStatus: 'paused',
        pausedAt: new Date(),
      })
      .where(eq(schema.universes.id, universeId))
      .returning();
    return result;
  }

  async getActiveIceCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.universes)
      .where(
        and(
          eq(schema.universes.ownerUserId, userId),
          eq(schema.universes.iceStatus, 'active')
        )
      );
    return result[0]?.count || 0;
  }

  async getIcesToPauseOnDowngrade(userId: number, newLimit: number): Promise<schema.Universe[]> {
    const activeIces = await db.query.universes.findMany({
      where: and(
        eq(schema.universes.ownerUserId, userId),
        eq(schema.universes.iceStatus, 'active')
      ),
      orderBy: [asc(schema.universes.activeSince)],
    });
    
    if (activeIces.length <= newLimit) {
      return [];
    }
    return activeIces.slice(newLimit);
  }
  
  // Security Audit Logging
  async createAuditLog(log: schema.InsertAuditLog): Promise<schema.AuditLog> {
    const [result] = await db.insert(schema.auditLogs).values(log).returning();
    return result;
  }
  
  async getAuditLogs(resourceType: string, resourceId: string, limit: number = 100): Promise<schema.AuditLog[]> {
    return await db.query.auditLogs.findMany({
      where: and(
        eq(schema.auditLogs.resourceType, resourceType),
        eq(schema.auditLogs.resourceId, resourceId)
      ),
      orderBy: [desc(schema.auditLogs.createdAt)],
      limit,
    });
  }
  
  // Billing Audit Logging
  async createBillingAuditLog(log: schema.InsertBillingAuditLog): Promise<schema.BillingAuditLog> {
    const [result] = await db.insert(schema.billingAuditLogs).values(log).returning();
    return result;
  }

  // Social Proof (Testimonial Capture)
  async createSocialProofItem(data: schema.InsertSocialProofItem): Promise<schema.SocialProofItem> {
    const [result] = await db.insert(schema.socialProofItems).values(data).returning();
    return result;
  }

  async getSocialProofItem(id: number): Promise<schema.SocialProofItem | undefined> {
    return await db.query.socialProofItems.findFirst({
      where: eq(schema.socialProofItems.id, id),
    });
  }

  async getSocialProofItems(businessSlug: string, filters?: { 
    status?: schema.SocialProofStatus; 
    consentStatus?: schema.SocialProofConsentStatus;
    topic?: schema.SocialProofTopic;
  }): Promise<schema.SocialProofItem[]> {
    const conditions = [eq(schema.socialProofItems.businessSlug, businessSlug)];
    
    if (filters?.status) {
      conditions.push(eq(schema.socialProofItems.status, filters.status));
    }
    if (filters?.consentStatus) {
      conditions.push(eq(schema.socialProofItems.consentStatus, filters.consentStatus));
    }
    if (filters?.topic) {
      conditions.push(eq(schema.socialProofItems.topic, filters.topic));
    }
    
    return await db.query.socialProofItems.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.socialProofItems.createdAt)],
    });
  }

  async updateSocialProofItem(id: number, data: Partial<schema.InsertSocialProofItem>): Promise<schema.SocialProofItem | undefined> {
    const [result] = await db.update(schema.socialProofItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.socialProofItems.id, id))
      .returning();
    return result;
  }

  async deleteSocialProofItem(id: number): Promise<void> {
    await db.delete(schema.socialProofItems).where(eq(schema.socialProofItems.id, id));
  }

  // Video Export Jobs
  async createVideoExportJob(data: schema.InsertVideoExportJob): Promise<schema.VideoExportJob> {
    const [result] = await db.insert(schema.videoExportJobs).values(data).returning();
    return result;
  }

  async getVideoExportJob(jobId: string): Promise<schema.VideoExportJob | undefined> {
    return await db.query.videoExportJobs.findFirst({
      where: eq(schema.videoExportJobs.jobId, jobId),
    });
  }

  async getVideoExportJobsByUser(userId: number, limit: number = 20): Promise<schema.VideoExportJob[]> {
    return await db.query.videoExportJobs.findMany({
      where: eq(schema.videoExportJobs.userId, userId),
      orderBy: [desc(schema.videoExportJobs.createdAt)],
      limit,
    });
  }

  async updateVideoExportJob(jobId: string, data: Partial<schema.InsertVideoExportJob>): Promise<schema.VideoExportJob | undefined> {
    const [result] = await db.update(schema.videoExportJobs)
      .set(data)
      .where(eq(schema.videoExportJobs.jobId, jobId))
      .returning();
    return result;
  }

  async deleteVideoExportJob(jobId: string): Promise<void> {
    await db.delete(schema.videoExportJobs).where(eq(schema.videoExportJobs.jobId, jobId));
  }

  // ============ INDUSTRY ORBIT SYSTEM ============

  // Industry Entities
  async createIndustryEntity(data: schema.InsertIndustryEntity): Promise<schema.IndustryEntity> {
    const [result] = await db.insert(schema.industryEntities).values(data).returning();
    return result;
  }

  async getIndustryEntity(id: number): Promise<schema.IndustryEntity | undefined> {
    return await db.query.industryEntities.findFirst({
      where: eq(schema.industryEntities.id, id),
    });
  }

  async getIndustryEntitiesByOrbit(orbitId: number): Promise<schema.IndustryEntity[]> {
    return await db.query.industryEntities.findMany({
      where: eq(schema.industryEntities.orbitId, orbitId),
      orderBy: [asc(schema.industryEntities.name)],
    });
  }

  async getIndustryEntityByName(orbitId: number, name: string): Promise<schema.IndustryEntity | undefined> {
    return await db.query.industryEntities.findFirst({
      where: and(
        eq(schema.industryEntities.orbitId, orbitId),
        eq(schema.industryEntities.name, name)
      ),
    });
  }

  async updateIndustryEntity(id: number, data: Partial<schema.InsertIndustryEntity>): Promise<schema.IndustryEntity | undefined> {
    const [result] = await db.update(schema.industryEntities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.industryEntities.id, id))
      .returning();
    return result;
  }

  async deleteIndustryEntity(id: number): Promise<void> {
    await db.delete(schema.industryEntities).where(eq(schema.industryEntities.id, id));
  }

  // Industry Products
  async createIndustryProduct(data: schema.InsertIndustryProduct): Promise<schema.IndustryProduct> {
    const [result] = await db.insert(schema.industryProducts).values(data).returning();
    return result;
  }

  async getIndustryProduct(id: number): Promise<schema.IndustryProduct | undefined> {
    return await db.query.industryProducts.findFirst({
      where: eq(schema.industryProducts.id, id),
    });
  }

  async getIndustryProductsByOrbit(orbitId: number): Promise<schema.IndustryProduct[]> {
    return await db.query.industryProducts.findMany({
      where: eq(schema.industryProducts.orbitId, orbitId),
      orderBy: [asc(schema.industryProducts.name)],
    });
  }

  async getIndustryProductByName(orbitId: number, name: string): Promise<schema.IndustryProduct | undefined> {
    return await db.query.industryProducts.findFirst({
      where: and(
        eq(schema.industryProducts.orbitId, orbitId),
        eq(schema.industryProducts.name, name)
      ),
    });
  }

  async updateIndustryProduct(id: number, data: Partial<schema.InsertIndustryProduct>): Promise<schema.IndustryProduct | undefined> {
    const [result] = await db.update(schema.industryProducts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.industryProducts.id, id))
      .returning();
    return result;
  }

  async deleteIndustryProduct(id: number): Promise<void> {
    await db.delete(schema.industryProducts).where(eq(schema.industryProducts.id, id));
  }

  // Product Specs
  async createProductSpec(data: schema.InsertProductSpec): Promise<schema.ProductSpec> {
    const [result] = await db.insert(schema.productSpecs).values(data).returning();
    return result;
  }

  async getProductSpecs(productId: number): Promise<schema.ProductSpec[]> {
    return await db.query.productSpecs.findMany({
      where: eq(schema.productSpecs.productId, productId),
    });
  }

  async updateProductSpec(id: number, data: Partial<schema.InsertProductSpec>): Promise<schema.ProductSpec | undefined> {
    const [result] = await db.update(schema.productSpecs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.productSpecs.id, id))
      .returning();
    return result;
  }

  async deleteProductSpec(id: number): Promise<void> {
    await db.delete(schema.productSpecs).where(eq(schema.productSpecs.id, id));
  }

  async deleteProductSpecsByProduct(productId: number): Promise<void> {
    await db.delete(schema.productSpecs).where(eq(schema.productSpecs.productId, productId));
  }

  // Industry Reviews
  async createIndustryReview(data: schema.InsertIndustryReview): Promise<schema.IndustryReview> {
    const [result] = await db.insert(schema.industryReviews).values(data).returning();
    return result;
  }

  async getIndustryReview(id: number): Promise<schema.IndustryReview | undefined> {
    return await db.query.industryReviews.findFirst({
      where: eq(schema.industryReviews.id, id),
    });
  }

  async getIndustryReviewsByOrbit(orbitId: number): Promise<schema.IndustryReview[]> {
    return await db.query.industryReviews.findMany({
      where: eq(schema.industryReviews.orbitId, orbitId),
      orderBy: [desc(schema.industryReviews.publishedAt)],
    });
  }

  async updateIndustryReview(id: number, data: Partial<schema.InsertIndustryReview>): Promise<schema.IndustryReview | undefined> {
    const [result] = await db.update(schema.industryReviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.industryReviews.id, id))
      .returning();
    return result;
  }

  async deleteIndustryReview(id: number): Promise<void> {
    await db.delete(schema.industryReviews).where(eq(schema.industryReviews.id, id));
  }

  // Industry Assets
  async createIndustryAsset(data: schema.InsertIndustryAsset): Promise<schema.IndustryAsset> {
    const [result] = await db.insert(schema.industryAssets).values(data).returning();
    return result;
  }

  async getIndustryAsset(id: number): Promise<schema.IndustryAsset | undefined> {
    return await db.query.industryAssets.findFirst({
      where: eq(schema.industryAssets.id, id),
    });
  }

  async getIndustryAssetsByOrbit(orbitId: number): Promise<schema.IndustryAsset[]> {
    return await db.query.industryAssets.findMany({
      where: eq(schema.industryAssets.orbitId, orbitId),
    });
  }

  async deleteIndustryAsset(id: number): Promise<void> {
    await db.delete(schema.industryAssets).where(eq(schema.industryAssets.id, id));
  }

  // Community Links
  async createCommunityLink(data: schema.InsertCommunityLink): Promise<schema.CommunityLink> {
    const [result] = await db.insert(schema.communityLinks).values(data).returning();
    return result;
  }

  async getCommunityLink(id: number): Promise<schema.CommunityLink | undefined> {
    return await db.query.communityLinks.findFirst({
      where: eq(schema.communityLinks.id, id),
    });
  }

  async getCommunityLinksByOrbit(orbitId: number): Promise<schema.CommunityLink[]> {
    return await db.query.communityLinks.findMany({
      where: eq(schema.communityLinks.orbitId, orbitId),
    });
  }

  async updateCommunityLink(id: number, data: Partial<schema.InsertCommunityLink>): Promise<schema.CommunityLink | undefined> {
    const [result] = await db.update(schema.communityLinks)
      .set(data)
      .where(eq(schema.communityLinks.id, id))
      .returning();
    return result;
  }

  async deleteCommunityLink(id: number): Promise<void> {
    await db.delete(schema.communityLinks).where(eq(schema.communityLinks.id, id));
  }

  // Topic Tiles
  async createTopicTile(data: schema.InsertTopicTile): Promise<schema.TopicTile> {
    const [result] = await db.insert(schema.topicTiles).values(data).returning();
    return result;
  }

  async getTopicTile(id: number): Promise<schema.TopicTile | undefined> {
    return await db.query.topicTiles.findFirst({
      where: eq(schema.topicTiles.id, id),
    });
  }

  async getTopicTilesByOrbit(orbitId: number): Promise<schema.TopicTile[]> {
    return await db.query.topicTiles.findMany({
      where: eq(schema.topicTiles.orbitId, orbitId),
      orderBy: [desc(schema.topicTiles.priority)],
    });
  }

  async updateTopicTile(id: number, data: Partial<schema.InsertTopicTile>): Promise<schema.TopicTile | undefined> {
    const [result] = await db.update(schema.topicTiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.topicTiles.id, id))
      .returning();
    return result;
  }

  async deleteTopicTile(id: number): Promise<void> {
    await db.delete(schema.topicTiles).where(eq(schema.topicTiles.id, id));
  }

  // Pulse Sources
  async createPulseSource(data: schema.InsertPulseSource): Promise<schema.PulseSource> {
    const [result] = await db.insert(schema.pulseSources).values(data).returning();
    return result;
  }

  async getPulseSource(id: number): Promise<schema.PulseSource | undefined> {
    return await db.query.pulseSources.findFirst({
      where: eq(schema.pulseSources.id, id),
    });
  }

  async getPulseSourcesByOrbit(orbitId: number): Promise<schema.PulseSource[]> {
    return await db.query.pulseSources.findMany({
      where: eq(schema.pulseSources.orbitId, orbitId),
    });
  }

  async getEnabledPulseSources(): Promise<schema.PulseSource[]> {
    return await db.query.pulseSources.findMany({
      where: eq(schema.pulseSources.isEnabled, true),
    });
  }

  async updatePulseSource(id: number, data: Partial<schema.InsertPulseSource>): Promise<schema.PulseSource | undefined> {
    const [result] = await db.update(schema.pulseSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.pulseSources.id, id))
      .returning();
    return result;
  }

  async deletePulseSource(id: number): Promise<void> {
    await db.delete(schema.pulseSources).where(eq(schema.pulseSources.id, id));
  }

  // Pulse Snapshots
  async createPulseSnapshot(data: schema.InsertPulseSnapshot): Promise<schema.PulseSnapshot> {
    const [result] = await db.insert(schema.pulseSnapshots).values(data).returning();
    return result;
  }

  async getLatestPulseSnapshot(sourceId: number): Promise<schema.PulseSnapshot | undefined> {
    return await db.query.pulseSnapshots.findFirst({
      where: eq(schema.pulseSnapshots.pulseSourceId, sourceId),
      orderBy: [desc(schema.pulseSnapshots.fetchedAt)],
    });
  }

  async getPulseSnapshots(sourceId: number, limit: number = 10): Promise<schema.PulseSnapshot[]> {
    return await db.query.pulseSnapshots.findMany({
      where: eq(schema.pulseSnapshots.pulseSourceId, sourceId),
      orderBy: [desc(schema.pulseSnapshots.fetchedAt)],
      limit,
    });
  }

  // Pulse Events
  async createPulseEvent(data: schema.InsertPulseEvent): Promise<schema.PulseEvent> {
    const [result] = await db.insert(schema.pulseEvents).values(data).returning();
    return result;
  }

  async getPulseEvent(id: number): Promise<schema.PulseEvent | undefined> {
    return await db.query.pulseEvents.findFirst({
      where: eq(schema.pulseEvents.id, id),
    });
  }

  async getPulseEventsByOrbit(orbitId: number, status?: schema.PulseEventStatus): Promise<schema.PulseEvent[]> {
    const conditions = [eq(schema.pulseEvents.orbitId, orbitId)];
    if (status) {
      conditions.push(eq(schema.pulseEvents.status, status));
    }
    return await db.query.pulseEvents.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.pulseEvents.detectedAt)],
    });
  }

  async updatePulseEvent(id: number, data: Partial<schema.InsertPulseEvent>): Promise<schema.PulseEvent | undefined> {
    const [result] = await db.update(schema.pulseEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.pulseEvents.id, id))
      .returning();
    return result;
  }

  // Alignments
  async createAlignment(data: schema.InsertAlignment): Promise<schema.Alignment> {
    const [result] = await db.insert(schema.alignments).values(data).returning();
    return result;
  }

  async getAlignment(orbitId: number, userId: number): Promise<schema.Alignment | undefined> {
    return await db.query.alignments.findFirst({
      where: and(
        eq(schema.alignments.orbitId, orbitId),
        eq(schema.alignments.userId, userId)
      ),
    });
  }

  async getAlignmentsByOrbit(orbitId: number): Promise<schema.Alignment[]> {
    return await db.query.alignments.findMany({
      where: eq(schema.alignments.orbitId, orbitId),
    });
  }

  async getAlignmentsByUser(userId: number): Promise<schema.Alignment[]> {
    return await db.query.alignments.findMany({
      where: eq(schema.alignments.userId, userId),
    });
  }

  async updateAlignment(id: number, data: Partial<schema.InsertAlignment>): Promise<schema.Alignment | undefined> {
    const [result] = await db.update(schema.alignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.alignments.id, id))
      .returning();
    return result;
  }

  async deleteAlignment(id: number): Promise<void> {
    await db.delete(schema.alignments).where(eq(schema.alignments.id, id));
  }

  // Core Concepts (CPAC)
  async createCoreConcept(data: schema.InsertCoreConcept): Promise<schema.CoreConcept> {
    const [result] = await db.insert(schema.coreConcepts).values(data).returning();
    return result;
  }

  async getCoreConceptsByOrbit(orbitId: number): Promise<schema.CoreConcept[]> {
    return await db.query.coreConcepts.findMany({
      where: eq(schema.coreConcepts.orbitId, orbitId),
    });
  }

  async getCoreConceptByConceptId(orbitId: number, conceptId: string): Promise<schema.CoreConcept | undefined> {
    return await db.query.coreConcepts.findFirst({
      where: and(
        eq(schema.coreConcepts.orbitId, orbitId),
        eq(schema.coreConcepts.conceptId, conceptId)
      ),
    });
  }

  async deleteCoreConcept(id: number): Promise<void> {
    await db.delete(schema.coreConcepts).where(eq(schema.coreConcepts.id, id));
  }

  async deleteCoreConceptsByOrbit(orbitId: number): Promise<void> {
    await db.delete(schema.coreConcepts).where(eq(schema.coreConcepts.orbitId, orbitId));
  }
}

export const storage = new DatabaseStorage();
