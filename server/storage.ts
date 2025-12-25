import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, desc, inArray } from "drizzle-orm";
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
      
      // Delete all card-character links in one query
      if (cardIds.length > 0) {
        await tx.delete(schema.cardCharacters).where(inArray(schema.cardCharacters.cardId, cardIds));
      }
      
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
}

export const storage = new DatabaseStorage();
