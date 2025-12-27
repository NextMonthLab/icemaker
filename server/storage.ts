import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();
