import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

// OpenAI client for image generation - uses Replit AI Integrations (no API key needed)
// Charges are billed to your Replit credits
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ 
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "dummy",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Extend Express user type
declare global {
  namespace Express {
    interface User extends schema.User {}
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "storyflix-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    })
  );
  
  // Passport setup
  app.use(passport.initialize());
  app.use(passport.session());
  
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        if (!user.password) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );
  
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });
  
  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.isAdmin) {
      return next();
    }
    res.status(403).json({ message: "Forbidden - Admin access required" });
  };
  
  // ============ AUTH ROUTES ============
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email: email || null,
        isAdmin: false,
      });
      
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error logging in" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });
  
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Error logging in" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Error logging in" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    })(req, res, next);
  });
  
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const { password: _, ...userWithoutPassword } = req.user;
      res.json({ user: userWithoutPassword });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
  
  // ============ UNIVERSE ROUTES ============
  
  app.get("/api/universes", async (req, res) => {
    try {
      const universes = await storage.getAllUniverses();
      res.json(universes);
    } catch (error) {
      console.error("Error fetching universes:", error);
      res.status(500).json({ message: "Error fetching universes" });
    }
  });
  
  app.get("/api/universes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const universe = await storage.getUniverse(id);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      res.json(universe);
    } catch (error) {
      console.error("Error fetching universe:", error);
      res.status(500).json({ message: "Error fetching universe" });
    }
  });
  
  app.get("/api/story/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const universe = await storage.getUniverseBySlug(slug);
      if (!universe) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      const cards = await storage.getCardsByUniverse(universe.id);
      const characters = await storage.getCharactersByUniverse(universe.id);
      
      const now = new Date();
      const publishedCards = cards
        .filter(c => c.status === 'published' && (!c.publishAt || new Date(c.publishAt) <= now))
        .sort((a, b) => a.dayIndex - b.dayIndex);
      
      res.json({
        universe,
        cards: publishedCards,
        characters,
      });
    } catch (error) {
      console.error("Error fetching story by slug:", error);
      res.status(500).json({ message: "Error fetching story" });
    }
  });
  
  app.post("/api/universes", requireAdmin, async (req, res) => {
    try {
      const validated = schema.insertUniverseSchema.parse(req.body);
      const universe = await storage.createUniverse(validated);
      res.json(universe);
    } catch (error) {
      console.error("Error creating universe:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });
  
  app.patch("/api/universes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const universe = await storage.updateUniverse(id, req.body);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      res.json(universe);
    } catch (error) {
      console.error("Error updating universe:", error);
      res.status(500).json({ message: "Error updating universe" });
    }
  });
  
  app.delete("/api/universes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Delete all content first (cards, characters, locations), then the universe
      await storage.deleteUniverseContent(id);
      await storage.deleteUniverse(id);
      res.json({ message: "Universe deleted" });
    } catch (error) {
      console.error("Error deleting universe:", error);
      res.status(500).json({ message: "Error deleting universe" });
    }
  });
  
  // ============ CHARACTER ROUTES ============
  
  app.get("/api/characters", async (req, res) => {
    try {
      const universeId = req.query.universeId ? parseInt(req.query.universeId as string) : undefined;
      
      if (!universeId) {
        return res.status(400).json({ message: "universeId query parameter required" });
      }
      
      const characters = await storage.getCharactersByUniverse(universeId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching characters:", error);
      res.status(500).json({ message: "Error fetching characters" });
    }
  });

  // ============ LOCATIONS ROUTES ============
  
  app.get("/api/locations", async (req, res) => {
    try {
      const universeId = req.query.universeId ? parseInt(req.query.universeId as string) : undefined;
      
      if (!universeId) {
        return res.status(400).json({ message: "universeId query parameter required" });
      }
      
      const locations = await storage.getLocationsByUniverse(universeId);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Error fetching locations" });
    }
  });
  
  app.get("/api/characters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      console.error("Error fetching character:", error);
      res.status(500).json({ message: "Error fetching character" });
    }
  });
  
  app.post("/api/characters", requireAdmin, async (req, res) => {
    try {
      const validated = schema.insertCharacterSchema.parse(req.body);
      const character = await storage.createCharacter(validated);
      res.json(character);
    } catch (error) {
      console.error("Error creating character:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });
  
  app.patch("/api/characters/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.updateCharacter(id, req.body);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(500).json({ message: "Error updating character" });
    }
  });
  
  app.delete("/api/characters/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCharacter(id);
      res.json({ message: "Character deleted" });
    } catch (error) {
      console.error("Error deleting character:", error);
      res.status(500).json({ message: "Error deleting character" });
    }
  });
  
  // ============ CARD ROUTES ============
  
  app.get("/api/cards", async (req, res) => {
    try {
      const universeId = req.query.universeId ? parseInt(req.query.universeId as string) : undefined;
      const season = req.query.season ? parseInt(req.query.season as string) : undefined;
      
      if (!universeId) {
        return res.status(400).json({ message: "universeId query parameter required" });
      }
      
      let cards;
      if (season) {
        cards = await storage.getCardsBySeason(universeId, season);
      } else {
        cards = await storage.getCardsByUniverse(universeId);
      }
      
      res.json(cards);
    } catch (error) {
      console.error("Error fetching cards:", error);
      res.status(500).json({ message: "Error fetching cards" });
    }
  });
  
  app.get("/api/cards/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const card = await storage.getCard(id);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error fetching card:", error);
      res.status(500).json({ message: "Error fetching card" });
    }
  });
  
  app.post("/api/cards", requireAdmin, async (req, res) => {
    try {
      const validated = schema.insertCardSchema.parse(req.body);
      const card = await storage.createCard(validated);
      res.json(card);
    } catch (error) {
      console.error("Error creating card:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });
  
  app.patch("/api/cards/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const card = await storage.updateCard(id, req.body);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error updating card:", error);
      res.status(500).json({ message: "Error updating card" });
    }
  });
  
  app.delete("/api/cards/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCard(id);
      res.json({ message: "Card deleted" });
    } catch (error) {
      console.error("Error deleting card:", error);
      res.status(500).json({ message: "Error deleting card" });
    }
  });
  
  // ============ CARD FEED (with visibility resolver) ============
  
  // Helper to compute card visibility based on universe release settings
  function computeCardVisibility(
    card: schema.Card,
    universe: schema.Universe,
    now: Date = new Date()
  ): { isVisible: boolean; isLocked: boolean; unlockAt: Date | null; isIntroCard: boolean } {
    const releaseMode = universe.releaseMode || 'daily';
    const introCardsCount = universe.introCardsCount || 3;
    const dailyStartsAt = universe.dailyReleaseStartsAtDayIndex || (introCardsCount + 1);
    
    // Card must be published to be visible
    if (card.status !== 'published') {
      return { isVisible: false, isLocked: true, unlockAt: null, isIntroCard: false };
    }
    
    const isIntroCard = card.dayIndex <= introCardsCount;
    
    switch (releaseMode) {
      case 'all_at_once':
        // All published cards are immediately visible
        return { isVisible: true, isLocked: false, unlockAt: null, isIntroCard };
        
      case 'hybrid_intro_then_daily':
        // Intro cards (1 to introCardsCount) are always visible when published
        if (isIntroCard) {
          return { isVisible: true, isLocked: false, unlockAt: null, isIntroCard: true };
        }
        // Cards at dailyStartsAt and beyond follow publishAt gating
        if (card.dayIndex >= dailyStartsAt) {
          if (!card.publishAt || card.publishAt <= now) {
            return { isVisible: true, isLocked: false, unlockAt: null, isIntroCard: false };
          } else {
            return { isVisible: false, isLocked: true, unlockAt: card.publishAt, isIntroCard: false };
          }
        }
        // Cards between introCardsCount and dailyStartsAt (edge case) - treat as daily
        if (!card.publishAt || card.publishAt <= now) {
          return { isVisible: true, isLocked: false, unlockAt: null, isIntroCard: false };
        }
        return { isVisible: false, isLocked: true, unlockAt: card.publishAt, isIntroCard: false };
        
      case 'daily':
      default:
        // Traditional daily gating - all cards follow publishAt
        if (!card.publishAt || card.publishAt <= now) {
          return { isVisible: true, isLocked: false, unlockAt: null, isIntroCard: false };
        }
        return { isVisible: false, isLocked: true, unlockAt: card.publishAt, isIntroCard: false };
    }
  }
  
  // Get card feed with visibility info (for user-facing UI)
  app.get("/api/feed/:universeId", async (req, res) => {
    try {
      const universeId = parseInt(req.params.universeId);
      const season = req.query.season ? parseInt(req.query.season as string) : 1;
      
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      const cards = await storage.getCardsBySeason(universeId, season);
      const now = new Date();
      
      // Compute visibility for each card
      const feedCards = cards.map(card => {
        const visibility = computeCardVisibility(card, universe, now);
        return {
          ...card,
          ...visibility,
        };
      });
      
      // Sort by dayIndex
      feedCards.sort((a, b) => a.dayIndex - b.dayIndex);
      
      // Separate visible and locked cards
      const visibleCards = feedCards.filter(c => c.isVisible);
      const lockedCards = feedCards.filter(c => c.isLocked);
      
      res.json({
        universe: {
          id: universe.id,
          name: universe.name,
          slug: universe.slug,
          releaseMode: universe.releaseMode || 'daily',
          introCardsCount: universe.introCardsCount || 3,
          dailyReleaseStartsAtDayIndex: universe.dailyReleaseStartsAtDayIndex || 4,
        },
        cards: feedCards,
        visibleCount: visibleCards.length,
        lockedCount: lockedCards.length,
        nextUnlock: lockedCards.length > 0 ? lockedCards[0].unlockAt : null,
      });
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Error fetching feed" });
    }
  });
  
  // Delete all cards for a universe
  app.delete("/api/universes/:id/cards", requireAdmin, async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const deletedCount = await storage.deleteAllCardsByUniverse(universeId);
      res.json({ message: `Deleted ${deletedCount} cards`, deletedCount });
    } catch (error) {
      console.error("Error deleting all cards:", error);
      res.status(500).json({ message: "Error deleting cards" });
    }
  });
  
  // Card-Character relationships
  app.post("/api/cards/:cardId/characters/:characterId", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const characterId = parseInt(req.params.characterId);
      await storage.linkCardCharacter(cardId, characterId);
      res.json({ message: "Character linked to card" });
    } catch (error) {
      console.error("Error linking character:", error);
      res.status(500).json({ message: "Error linking character" });
    }
  });
  
  app.delete("/api/cards/:cardId/characters/:characterId", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const characterId = parseInt(req.params.characterId);
      await storage.unlinkCardCharacter(cardId, characterId);
      res.json({ message: "Character unlinked from card" });
    } catch (error) {
      console.error("Error unlinking character:", error);
      res.status(500).json({ message: "Error unlinking character" });
    }
  });
  
  app.get("/api/cards/:cardId/characters", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const characters = await storage.getCharactersForCard(cardId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching card characters:", error);
      res.status(500).json({ message: "Error fetching card characters" });
    }
  });
  
  // ============ USER PROGRESS ROUTES ============
  
  app.get("/api/progress", requireAuth, async (req, res) => {
    try {
      const universeId = req.query.universeId ? parseInt(req.query.universeId as string) : undefined;
      
      if (!universeId) {
        return res.status(400).json({ message: "universeId query parameter required" });
      }
      
      const progress = await storage.getUserProgress(req.user!.id, universeId);
      res.json(progress || { unlockedDayIndex: 0, currentStreak: 0 });
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Error fetching progress" });
    }
  });
  
  app.post("/api/progress/unlock", requireAuth, async (req, res) => {
    try {
      const { universeId } = req.body;
      
      if (!universeId) {
        return res.status(400).json({ message: "universeId required" });
      }
      
      const progress = await storage.unlockNextCard(req.user!.id, universeId);
      res.json(progress);
    } catch (error) {
      console.error("Error unlocking card:", error);
      res.status(500).json({ message: "Error unlocking card" });
    }
  });
  
  // ============ CHAT ROUTES ============
  
  app.get("/api/chat/threads", requireAuth, async (req, res) => {
    try {
      const universeId = req.query.universeId ? parseInt(req.query.universeId as string) : undefined;
      const characterId = req.query.characterId ? parseInt(req.query.characterId as string) : undefined;
      
      if (!universeId || !characterId) {
        return res.status(400).json({ message: "universeId and characterId required" });
      }
      
      let thread = await storage.getChatThread(req.user!.id, universeId, characterId);
      
      if (!thread) {
        thread = await storage.createChatThread({
          userId: req.user!.id,
          universeId,
          characterId,
        });
      }
      
      res.json(thread);
    } catch (error) {
      console.error("Error fetching chat thread:", error);
      res.status(500).json({ message: "Error fetching chat thread" });
    }
  });
  
  app.get("/api/chat/threads/:threadId/messages", requireAuth, async (req, res) => {
    try {
      const threadId = parseInt(req.params.threadId);
      const messages = await storage.getChatMessages(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });
  
  app.post("/api/chat/threads/:threadId/messages", requireAuth, async (req, res) => {
    try {
      const threadId = parseInt(req.params.threadId);
      const { role, content } = req.body;
      
      if (!role || !content) {
        return res.status(400).json({ message: "role and content required" });
      }
      
      const message = await storage.addChatMessage({
        threadId,
        role,
        content,
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error adding message:", error);
      res.status(500).json({ message: "Error adding message" });
    }
  });
  
  // ============ CARD MESSAGE BOARD ROUTES ============
  
  app.get("/api/cards/:cardId/messages", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const messages = await storage.getCardMessages(cardId, 50);
      
      const messagesWithReactions = await Promise.all(messages.map(async (msg) => {
        const reactions = await storage.getCardMessageReactions(msg.id);
        const reactionCounts: Record<string, number> = {};
        for (const r of reactions) {
          reactionCounts[r.reactionType] = (reactionCounts[r.reactionType] || 0) + 1;
        }
        return { ...msg, reactions: reactionCounts, reactionCount: reactions.length };
      }));
      
      res.json(messagesWithReactions);
    } catch (error) {
      console.error("Error fetching card messages:", error);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });
  
  app.post("/api/cards/:cardId/messages", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const { displayName, body, anonFingerprint } = req.body;
      
      if (!body || body.length === 0) {
        return res.status(400).json({ message: "Message body required" });
      }
      if (body.length > 280) {
        return res.status(400).json({ message: "Message too long (max 280 characters)" });
      }
      if (!displayName || displayName.length === 0) {
        return res.status(400).json({ message: "Display name required" });
      }
      
      const message = await storage.createCardMessage({
        cardId,
        userId: req.user?.id || null,
        displayName: displayName.slice(0, 50),
        body: body.slice(0, 280),
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error creating card message:", error);
      res.status(500).json({ message: "Error creating message" });
    }
  });
  
  app.post("/api/cards/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { reactionType, anonFingerprint } = req.body;
      
      if (!reactionType) {
        return res.status(400).json({ message: "Reaction type required" });
      }
      
      const reaction = await storage.addCardMessageReaction({
        messageId,
        userId: req.user?.id || null,
        anonFingerprint: req.user?.id ? null : anonFingerprint,
        reactionType,
      });
      
      res.json(reaction);
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({ message: "Error adding reaction" });
    }
  });
  
  app.delete("/api/cards/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { anonFingerprint } = req.body;
      
      await storage.removeCardMessageReaction(
        messageId,
        req.user?.id || null,
        req.user?.id ? null : anonFingerprint
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing reaction:", error);
      res.status(500).json({ message: "Error removing reaction" });
    }
  });
  
  app.post("/api/chat/send", requireAuth, async (req, res) => {
    try {
      const { threadId, message, characterId, universeId, cardId } = req.body;
      
      if (!threadId || !message || !characterId || !universeId) {
        return res.status(400).json({ message: "threadId, message, characterId, and universeId required" });
      }
      
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      let currentCard = null;
      if (cardId) {
        currentCard = await storage.getCard(cardId);
      }
      
      const progress = await storage.getUserProgress(req.user!.id, universeId);
      const userDayIndex = progress?.unlockedDayIndex || 0;
      
      const { buildChatSystemPrompt, getChatDisclaimer } = await import("./chat");
      
      const systemPrompt = buildChatSystemPrompt({
        universe,
        character,
        currentCard: currentCard || undefined,
        userDayIndex,
      });
      
      await storage.addChatMessage({
        threadId,
        role: "user",
        content: message,
      });
      
      const historyMessages = await storage.getChatMessages(threadId, 20);
      const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];
      
      for (const msg of historyMessages.slice(-19)) {
        openaiMessages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
      
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
        const fallbackResponse = `*${character.name} looks at you thoughtfully*\n\nI'd love to chat, but the storyteller hasn't connected to the AI service yet. Try again soon!`;
        const assistantMessage = await storage.addChatMessage({
          threadId,
          role: "assistant",
          content: fallbackResponse,
        });
        return res.json({
          message: assistantMessage,
          disclaimer: getChatDisclaimer(universe.chatPolicy as any),
        });
      }
      
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.9,
      });
      
      const aiResponse = completion.choices[0]?.message?.content || "...";
      
      const assistantMessage = await storage.addChatMessage({
        threadId,
        role: "assistant",
        content: aiResponse,
      });
      
      res.json({
        message: assistantMessage,
        disclaimer: getChatDisclaimer(universe.chatPolicy as any),
      });
    } catch (error) {
      console.error("Error in chat send:", error);
      res.status(500).json({ message: "Error processing chat" });
    }
  });
  
  // ============ ANALYTICS ROUTES ============
  
  app.post("/api/events", async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const { type, metadata } = req.body;
      
      await storage.logEvent({
        userId,
        type,
        metadataJson: metadata || {},
      });
      
      res.json({ message: "Event logged" });
    } catch (error) {
      console.error("Error logging event:", error);
      res.status(500).json({ message: "Error logging event" });
    }
  });
  
  // ============ SEED DATA ROUTE ============
  
  app.post("/api/seed", async (req, res) => {
    try {
      // Check if data already exists
      const existingUniverses = await storage.getAllUniverses();
      if (existingUniverses.length > 0) {
        return res.status(400).json({ message: "Database already seeded" });
      }
      
      // Create universe
      const universe = await storage.createUniverse({
        name: "Neon Rain",
        description: "A detective noir story set in the underbelly of Sector 7.",
        styleNotes: "Cinematic noir with cyberpunk elements, deep blacks, purple neon accents",
      });
      
      // Create characters
      const char1 = await storage.createCharacter({
        universeId: universe.id,
        characterSlug: "v",
        name: "V",
        role: "The Informant",
        avatar: "/placeholder-avatar-1.png",
        description: "Knows everything that happens in the lower levels. Doesn't give it up for free.",
        systemPrompt: "You are V, an informant in Sector 7. You know everything but you're cryptic and sarcastic. You charge for information.",
        secretsJson: ["The package contains corporate secrets", "You work for both sides"],
        isActive: true,
      });
      
      const char2 = await storage.createCharacter({
        universeId: universe.id,
        characterSlug: "detective-k",
        name: "Detective K",
        role: "The Lead",
        avatar: "/placeholder-avatar-2.png",
        description: "Burnt out, running on caffeine and synth-stims.",
        systemPrompt: "You are Detective K, a cynical detective investigating a mystery. You're tired but determined.",
        secretsJson: ["You suspect someone close to you"],
        isActive: true,
      });
      
      // Create cards
      const card1 = await storage.createCard({
        universeId: universe.id,
        season: 1,
        dayIndex: 1,
        title: "The Drop",
        imagePath: "/placeholder-card-1.jpg",
        captionsJson: [
          "It started with the rain...",
          "Always the rain in Sector 7.",
          "Then I saw the package.",
        ],
        sceneText: "The package was sitting in a puddle of neon-reflected oil. It didn't belong there. Nothing clean belongs in Sector 7.",
        recapText: "We found a mysterious package in Sector 7.",
        effectTemplate: "ken-burns",
        status: "published",
        publishAt: new Date(),
      });
      
      const card2 = await storage.createCard({
        universeId: universe.id,
        season: 1,
        dayIndex: 2,
        title: "The Decryption",
        imagePath: "/placeholder-card-2.jpg",
        captionsJson: [
          "Encrypted. Heavily.",
          "Corporate grade ICE.",
          "Someone doesn't want this opened.",
        ],
        sceneText: "I took it to V. She laughed when she saw the encryption headers. 'You're playing with fire, detective,' she said. But she took the credits anyway.",
        recapText: "V is attempting to decrypt the package.",
        effectTemplate: "ken-burns",
        status: "published",
        publishAt: new Date(),
      });
      
      const card3 = await storage.createCard({
        universeId: universe.id,
        season: 1,
        dayIndex: 3,
        title: "The Shadow",
        imagePath: "/placeholder-card-3.jpg",
        captionsJson: [
          "I'm being followed.",
          "Just a shadow in the reflection.",
          "They know I have it.",
        ],
        sceneText: "Walking back from V's place, I felt eyes on me. A black sedan with tinted windows. Arasaka? Militech? Or something worse?",
        recapText: "Someone is following the detective.",
        effectTemplate: "ken-burns",
        status: "published",
        publishAt: new Date(),
      });
      
      // Link characters to cards
      await storage.linkCardCharacter(card1.id, char1.id);
      await storage.linkCardCharacter(card1.id, char2.id);
      await storage.linkCardCharacter(card2.id, char1.id);
      await storage.linkCardCharacter(card2.id, char2.id);
      await storage.linkCardCharacter(card3.id, char1.id);
      await storage.linkCardCharacter(card3.id, char2.id);
      
      // Create admin user
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        email: "admin@storyflix.com",
        isAdmin: true,
      });
      
      res.json({ 
        message: "Database seeded successfully",
        data: {
          universe: universe.id,
          characters: [char1.id, char2.id],
          cards: [card1.id, card2.id, card3.id],
        }
      });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ message: "Error seeding database" });
    }
  });

  // ============ IMPORT ROUTES ============
  
  interface ManifestCard {
    dayIndex: number;
    title: string;
    image?: string;
    captions?: string[];
    sceneText?: string;
    recapText?: string;
    effectTemplate?: string;
    status?: string;
    publishDate?: string;
    chat_unlocked_character_ids?: string[];
    primary_character_ids?: string[];
    location_id?: string;
    scene_description?: string;
    image_generation?: {
      prompt?: string;
      negative_prompt?: string;
      shot_type?: string;
      lighting?: string;
      seed?: number;
      notes?: string;
    };
    chat?: {
      free_message_limit?: number;
      overrides?: Record<string, {
        emotional_state?: string;
        scene_context?: string;
        objectives?: string[];
        knows_up_to_day_index?: number;
        taboo_for_this_scene?: string[];
        can_reveal?: string[];
        spoiler_traps?: Array<{
          trigger: string;
          deflect_with: string;
        }>;
      }>;
    };
  }
  
  interface ManifestCharacterVisualProfile {
    continuity_description?: string;
    age_range?: string;
    ethnicity_optional?: string;
    build?: string;
    face_features?: string;
    hair?: string;
    wardrobe?: string;
    accessories?: string;
    mannerisms?: string;
    do_not_change?: string[];
    reference_image_path?: string;
  }
  
  interface ManifestChatProfile {
    system_prompt?: string;
    voice?: string;
    speech_style?: string;
    goals?: string[];
    knowledge_cutoff?: {
      mode?: "dayIndex" | "dynamic";
      max_day_index?: number;
    };
    secrets?: Array<{
      id: string;
      never_reveal?: boolean;
      trigger_patterns?: string[];
      deflect_with?: string;
    }>;
    allowed_topics?: string[];
    forbidden_topics?: string[];
    hard_limits?: string[];
    refusal_style?: string;
  }

  interface ManifestCharacter {
    id?: string;
    name: string;
    role?: string;
    avatar?: string;
    personality?: string;
    secretInfo?: string;
    visual_profile?: ManifestCharacterVisualProfile;
    chat_profile?: ManifestChatProfile;
    is_public_figure_simulation?: boolean;
  }
  
  interface ManifestLocation {
    id: string;
    name: string;
    continuity_description?: string;
    lighting?: string;
    textures?: string;
    do_not_change?: string[];
  }
  
  interface VisualContinuityManifest {
    art_direction?: string;
    palette?: string;
    camera_language?: string;
    lighting_rules?: string;
    texture_rules?: string;
    taboo_list?: string[];
    reference_tags?: string[];
  }
  
  interface VisualStyleManifest {
    style_preset?: string;
    base_prompt?: string;
    negative_prompt?: string;
    aspect_ratio?: string;
    render_model?: string;
    guidance_scale?: number;
    steps?: number;
    sampler?: string;
    consistency?: {
      character_lock?: boolean;
      location_lock?: boolean;
      colour_palette_lock?: boolean;
      reference_images?: string[];
    };
  }
  
  interface ManifestChatPolicy {
    rating?: "PG" | "12" | "15" | "18";
    spoiler_policy?: {
      mode?: "hard" | "soft";
      rule?: string;
    };
    truth_policy?: {
      allow_lies_in_character?: boolean;
      lies_allowed_for?: string[];
      lies_not_allowed_for?: string[];
    };
    refusal_style?: {
      in_character_deflection?: boolean;
      deflection_templates?: string[];
    };
    safety_policy?: {
      disallowed?: string[];
      escalation?: string;
    };
    real_person_policy?: {
      enabled?: boolean;
      rule?: string;
    };
    disclaimer?: string;
  }

  interface SeasonManifest {
    schemaVersion?: number;
    seasonId?: string;
    universe: {
      name: string;
      description?: string;
      slug?: string;
      styleNotes?: string;
      visual_mode?: "engine_generated" | "author_supplied";
      visual_style?: VisualStyleManifest;
      visual_continuity?: VisualContinuityManifest;
      chat_policy?: ManifestChatPolicy;
    };
    season?: number | string;
    startDate?: string;
    characters?: ManifestCharacter[];
    locations?: ManifestLocation[];
    cards?: ManifestCard[];
  }
  
  // Download sample manifest template for Season Pack imports
  app.get("/api/import/template", requireAdmin, async (_req, res) => {
    try {
      const templatePath = path.join(process.cwd(), "docs", "sample-time-spent-manifest.json");
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: "Template file not found" });
      }
      
      const template = fs.readFileSync(templatePath, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=manifest-template.json");
      res.send(template);
    } catch (error) {
      console.error("Error serving template:", error);
      res.status(500).json({ message: "Error serving template" });
    }
  });

  app.post("/api/import/validate", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();
      
      // Find manifest.json
      const manifestEntry = entries.find((e: AdmZip.IZipEntry) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json"));
      if (!manifestEntry) {
        return res.status(400).json({ 
          message: "Invalid ZIP: No manifest.json found",
          errors: ["manifest.json is required in the root of the ZIP file"]
        });
      }
      
      let manifest: SeasonManifest;
      try {
        manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
      } catch (_e) {
        return res.status(400).json({ 
          message: "Invalid manifest.json",
          errors: ["manifest.json contains invalid JSON"]
        });
      }
      
      const warnings: string[] = [];
      const errors: string[] = [];
      
      // Validate universe
      if (!manifest.universe?.name) {
        errors.push("manifest.universe.name is required");
      }
      
      // Detect visual mode
      const visualMode = manifest.universe?.visual_mode || "author_supplied";
      const isEngineGenerated = visualMode === "engine_generated";
      
      // Validate visual_style for engine_generated mode
      if (isEngineGenerated && !manifest.universe?.visual_style) {
        warnings.push("engine_generated mode: universe.visual_style is recommended for consistent image generation");
      }
      
      // Validate visual_style required fields for engine_generated mode
      if (isEngineGenerated) {
        const vs = manifest.universe?.visual_style;
        if (!vs?.base_prompt) {
          errors.push("engine_generated mode: universe.visual_style.base_prompt is required");
        }
        if (!vs?.negative_prompt) {
          warnings.push("engine_generated mode: universe.visual_style.negative_prompt is recommended");
        }
        if (!vs?.aspect_ratio) {
          warnings.push("engine_generated mode: universe.visual_style.aspect_ratio is recommended (defaults to 9:16)");
        }
      }
      
      // Validate visual_continuity required fields for engine_generated mode
      if (isEngineGenerated) {
        const vc = manifest.universe?.visual_continuity;
        if (!vc?.art_direction) {
          errors.push("engine_generated mode: universe.visual_continuity.art_direction is required");
        }
        if (!vc?.palette) {
          errors.push("engine_generated mode: universe.visual_continuity.palette is required");
        }
        if (!vc?.camera_language) {
          errors.push("engine_generated mode: universe.visual_continuity.camera_language is required");
        }
        if (!vc?.lighting_rules) {
          errors.push("engine_generated mode: universe.visual_continuity.lighting_rules is required");
        }
        if (!vc?.texture_rules) {
          errors.push("engine_generated mode: universe.visual_continuity.texture_rules is required");
        }
        if (!vc?.taboo_list || vc.taboo_list.length === 0) {
          warnings.push("engine_generated mode: universe.visual_continuity.taboo_list is recommended");
        }
      }
      
      // Validate v2 chat policy for schemaVersion 2
      const schemaVersion = manifest.schemaVersion || 1;
      if (schemaVersion >= 2) {
        const chatPolicy = manifest.universe?.chat_policy;
        if (!chatPolicy) {
          errors.push("schemaVersion 2: universe.chat_policy is required");
        } else {
          if (!chatPolicy.rating) {
            warnings.push("schemaVersion 2: universe.chat_policy.rating is recommended (PG/12/15/18)");
          }
          if (!chatPolicy.spoiler_policy) {
            warnings.push("schemaVersion 2: universe.chat_policy.spoiler_policy is recommended for story-driven content");
          }
          if (!chatPolicy.safety_policy) {
            warnings.push("schemaVersion 2: universe.chat_policy.safety_policy is recommended for content moderation");
          }
        }
      }
      
      // Build character ID/name mapping for reference validation
      // Characters can be referenced by id (preferred) or by name (fallback)
      const characterIds = new Set<string>();
      const characterNames = new Set<string>();
      for (const c of manifest.characters || []) {
        if (c.id) {
          characterIds.add(c.id.toLowerCase());
        }
        characterNames.add(c.name.toLowerCase());
      }
      
      // Build location id mapping for reference validation
      const locationIds = new Set((manifest.locations || []).map(l => l.id));
      
      // Validate characters
      const characters = manifest.characters || [];
      let charactersWithVisualProfiles = 0;
      let charactersMissingVisualProfiles = 0;
      
      for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        if (!char.name) {
          errors.push(`Character at index ${i} is missing a name`);
        }
        if (char.avatar) {
          const avatarEntry = entries.find((e: AdmZip.IZipEntry) => e.entryName.endsWith(char.avatar!));
          if (!avatarEntry) {
            warnings.push(`Character "${char.name}": avatar file "${char.avatar}" not found in ZIP`);
          }
        }
        
        // Check visual profile for engine_generated mode
        if (isEngineGenerated) {
          if (char.visual_profile?.continuity_description) {
            charactersWithVisualProfiles++;
          } else {
            charactersMissingVisualProfiles++;
            errors.push(`characters[${i}] "${char.name}": engine_generated mode requires visual_profile.continuity_description`);
          }
        }
        
        // Validate v2 chat profile for schemaVersion 2 - system_prompt is required
        if (schemaVersion >= 2) {
          if (!char.chat_profile?.system_prompt) {
            errors.push(`schemaVersion 2: characters[${i}] "${char.name}" requires chat_profile.system_prompt for credible AI chat`);
          }
        }
      }
      
      // Validate locations
      const locations = manifest.locations || [];
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        if (!loc.id) {
          errors.push(`Location at index ${i} is missing an id`);
        }
        if (!loc.name) {
          errors.push(`Location at index ${i} is missing a name`);
        }
      }
      
      // Validate cards
      const cards = manifest.cards || [];
      const schedule: { day: number; title: string; date: string; hasImagePrompt: boolean }[] = [];
      let cardsWithImagePrompts = 0;
      let cardsMissingImagePrompts = 0;
      let cardsWithCharacterRefs = 0;
      let cardsWithLocationRefs = 0;
      
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card.title) {
          errors.push(`Card at index ${i} is missing a title`);
        }
        if (card.dayIndex === undefined) {
          errors.push(`Card "${card.title || i}" is missing dayIndex`);
        }
        
        // Check for image source
        const hasImageFile = !!card.image;
        const hasSceneDescription = !!card.scene_description;
        const hasImagePrompt = !!card.image_generation?.prompt;
        
        if (hasImageFile) {
          const imageEntry = entries.find((e: AdmZip.IZipEntry) => e.entryName.endsWith(card.image!));
          if (!imageEntry) {
            warnings.push(`Card "${card.title}": image file "${card.image}" not found in ZIP`);
          }
        }
        
        // For engine_generated mode, check image prompts
        if (isEngineGenerated) {
          if (hasSceneDescription || hasImagePrompt) {
            cardsWithImagePrompts++;
          } else if (!hasImageFile) {
            cardsMissingImagePrompts++;
            errors.push(`cards[${i}] "${card.title}": engine_generated mode requires either scene_description or image_generation.prompt`);
          }
        }
        
        // Validate primary_character_ids references (can be ID or name)
        if (card.primary_character_ids && card.primary_character_ids.length > 0) {
          cardsWithCharacterRefs++;
          for (const charRef of card.primary_character_ids) {
            const refLower = charRef.toLowerCase();
            if (!characterIds.has(refLower) && !characterNames.has(refLower)) {
              warnings.push(`Card "${card.title}": primary_character_ids references unknown character "${charRef}"`);
            }
          }
        }
        
        // Validate location_id reference
        if (card.location_id) {
          cardsWithLocationRefs++;
          if (!locationIds.has(card.location_id)) {
            warnings.push(`Card "${card.title}": location_id references unknown location "${card.location_id}"`);
          }
        }
        
        // Build schedule
        const publishDate = card.publishDate || manifest.startDate;
        let dateStr = "Not scheduled";
        if (publishDate) {
          const baseDate = new Date(publishDate);
          baseDate.setDate(baseDate.getDate() + (card.dayIndex - 1));
          dateStr = baseDate.toISOString().split("T")[0];
        }
        schedule.push({
          day: card.dayIndex,
          title: card.title || `Untitled Card ${i + 1}`,
          date: dateStr,
          hasImagePrompt: hasSceneDescription || hasImagePrompt,
        });
      }
      
      // Sort schedule by day
      schedule.sort((a, b) => a.day - b.day);
      
      res.json({
        valid: errors.length === 0,
        universe: manifest.universe?.name || "Unknown",
        visualMode,
        createdCards: cards.length,
        createdCharacters: characters.length,
        createdLocations: locations.length,
        cardsWithImagePrompts,
        cardsMissingImagePrompts,
        charactersWithVisualProfiles,
        charactersMissingVisualProfiles,
        cardsWithCharacterRefs,
        cardsWithLocationRefs,
        warnings,
        errors,
        schedule,
      });
    } catch (error) {
      console.error("Import validation error:", error);
      res.status(500).json({ message: "Error validating import file" });
    }
  });
  
  app.post("/api/import/execute", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const universeId = req.body.universeId ? parseInt(req.body.universeId) : null;
      const overwrite = req.body.overwrite === "true" || req.body.overwrite === true;
      const dropImmediately = req.body.dropImmediately === "true" || req.body.dropImmediately === true;
      
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();
      
      // Find manifest.json
      const manifestEntry = entries.find((e: AdmZip.IZipEntry) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json"));
      if (!manifestEntry) {
        return res.status(400).json({ message: "No manifest.json found" });
      }
      
      const manifest: SeasonManifest = JSON.parse(manifestEntry.getData().toString("utf8"));
      const warnings: string[] = [];
      const createdItems: { characters: number[]; cards: number[] } = { characters: [], cards: [] };
      
      // Validate manifest structure
      if (!manifest.universe?.name) {
        return res.status(400).json({ message: "Invalid manifest: universe.name is required" });
      }
      
      // Generate slug from manifest (use explicit slug or derive from name)
      const universeSlug = manifest.universe.slug || 
        manifest.universe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Convert visual_style from manifest format to DB format
      const convertVisualStyle = (vs?: VisualStyleManifest): schema.VisualStyle | null => {
        if (!vs) return null;
        return {
          stylePreset: vs.style_preset,
          basePrompt: vs.base_prompt,
          negativePrompt: vs.negative_prompt,
          aspectRatio: vs.aspect_ratio || "9:16",
          renderModel: vs.render_model,
          guidanceScale: vs.guidance_scale,
          steps: vs.steps,
          sampler: vs.sampler,
          consistency: vs.consistency ? {
            characterLock: vs.consistency.character_lock,
            locationLock: vs.consistency.location_lock,
            colourPaletteLock: vs.consistency.colour_palette_lock,
            referenceImages: vs.consistency.reference_images,
          } : undefined,
        };
      };
      
      // Convert visual_continuity from manifest format to DB format
      const convertVisualContinuity = (vc?: VisualContinuityManifest): schema.VisualContinuity | null => {
        if (!vc) return null;
        return {
          artDirection: vc.art_direction,
          palette: vc.palette,
          cameraLanguage: vc.camera_language,
          lightingRules: vc.lighting_rules,
          textureRules: vc.texture_rules,
          tabooList: vc.taboo_list,
          referenceTags: vc.reference_tags,
        };
      };
      
      // Convert character visual_profile from manifest format to DB format
      const convertVisualProfile = (vp?: ManifestCharacterVisualProfile): schema.CharacterVisualProfile | null => {
        if (!vp) return null;
        return {
          continuityDescription: vp.continuity_description,
          ageRange: vp.age_range,
          ethnicityOptional: vp.ethnicity_optional,
          build: vp.build,
          faceFeatures: vp.face_features,
          hair: vp.hair,
          wardrobe: vp.wardrobe,
          accessories: vp.accessories,
          mannerisms: vp.mannerisms,
          doNotChange: vp.do_not_change,
          referenceImagePath: vp.reference_image_path,
        };
      };
      
      // Convert location continuity from manifest format to DB format
      const convertLocationContinuity = (loc: ManifestLocation): schema.LocationContinuity => {
        return {
          continuityDescription: loc.continuity_description,
          lighting: loc.lighting,
          textures: loc.textures,
          doNotChange: loc.do_not_change,
        };
      };
      
      // Create or use existing universe (check by slug first)
      let universe: schema.Universe;
      const existingBySlug = await storage.getUniverseBySlug(universeSlug);
      
      if (universeId) {
        const existing = await storage.getUniverse(universeId);
        if (!existing) {
          return res.status(400).json({ message: "Universe not found" });
        }
        universe = existing;
      } else if (existingBySlug) {
        // Slug already exists
        if (!overwrite) {
          return res.status(409).json({ 
            message: `Universe with slug "${universeSlug}" already exists. Enable "Overwrite existing" to replace it.`,
            existingUniverseId: existingBySlug.id
          });
        }
        // Overwrite: delete old content and update universe metadata
        await storage.deleteUniverseContent(existingBySlug.id);
        const updated = await storage.updateUniverse(existingBySlug.id, {
          name: manifest.universe.name,
          slug: universeSlug,
          description: manifest.universe.description || "",
          styleNotes: manifest.universe.styleNotes || null,
          visualMode: manifest.universe.visual_mode || "author_supplied",
          visualStyle: convertVisualStyle(manifest.universe.visual_style),
          visualContinuity: convertVisualContinuity(manifest.universe.visual_continuity),
          chatPolicy: manifest.universe.chat_policy || null,
        });
        universe = updated!;
        warnings.push(`Replaced existing universe "${existingBySlug.name}" (ID: ${existingBySlug.id})`);
      } else {
        universe = await storage.createUniverse({
          name: manifest.universe.name,
          slug: universeSlug,
          description: manifest.universe.description || "",
          styleNotes: manifest.universe.styleNotes || null,
          visualMode: manifest.universe.visual_mode || "author_supplied",
          visualStyle: convertVisualStyle(manifest.universe.visual_style),
          visualContinuity: convertVisualContinuity(manifest.universe.visual_continuity),
          chatPolicy: manifest.universe.chat_policy || null,
        });
      }
      
      // Create characters - map by ID (preferred) and name (fallback)
      const characterMap = new Map<string, number>();
      for (const charDef of manifest.characters || []) {
        const slug = charDef.id || charDef.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        const character = await storage.createCharacter({
          universeId: universe.id,
          characterSlug: slug,
          name: charDef.name,
          role: charDef.role || "Character",
          avatar: charDef.avatar || null,
          description: charDef.personality || null,
          secretsJson: charDef.secretInfo ? [charDef.secretInfo] : null,
          visualProfile: convertVisualProfile(charDef.visual_profile),
          chatProfile: charDef.chat_profile || null,
          isPublicFigureSimulation: charDef.is_public_figure_simulation || false,
        });
        // Store by ID if present, and always by name for fallback
        if (charDef.id) {
          characterMap.set(charDef.id.toLowerCase(), character.id);
        }
        characterMap.set(charDef.name.toLowerCase(), character.id);
        createdItems.characters.push(character.id);
      }
      
      // Create locations
      const locationMap = new Map<string, number>();
      for (const locDef of manifest.locations || []) {
        const location = await storage.createLocation({
          universeId: universe.id,
          locationSlug: locDef.id,
          name: locDef.name,
          continuity: convertLocationContinuity(locDef),
        });
        locationMap.set(locDef.id, location.id);
      }
      
      // Create cards
      const season = typeof manifest.season === 'string' ? parseInt(manifest.season, 10) : (manifest.season || 1);
      
      // Calculate publishAt: if dropImmediately is true OR no startDate, return null (publish immediately)
      const calculatePublishDate = (dayIndex: number): Date | null => {
        if (dropImmediately) return null; // Override: drop all cards immediately
        if (!manifest.startDate) return null; // null = publish immediately
        const baseDate = new Date(manifest.startDate);
        baseDate.setHours(0, 0, 0, 0); // Set to midnight for deterministic timing
        baseDate.setDate(baseDate.getDate() + (dayIndex - 1));
        return baseDate;
      };
      
      // Convert image_generation from manifest format to DB format
      const convertImageGeneration = (ig?: ManifestCard['image_generation']): schema.ImageGeneration | null => {
        if (!ig) return null;
        return {
          prompt: ig.prompt,
          negativePrompt: ig.negative_prompt,
          shotType: ig.shot_type,
          lighting: ig.lighting,
          seed: ig.seed,
          notes: ig.notes,
        };
      };
      
      for (const cardDef of manifest.cards || []) {
        const publishDate = calculatePublishDate(cardDef.dayIndex);
        
        // Resolve primary_character_ids to database IDs
        const primaryCharacterIds: number[] = [];
        if (cardDef.primary_character_ids) {
          for (const charName of cardDef.primary_character_ids) {
            const charId = characterMap.get(charName.toLowerCase());
            if (charId) {
              primaryCharacterIds.push(charId);
            } else {
              warnings.push(`Card "${cardDef.title}": primary_character_ids references unknown character "${charName}"`);
            }
          }
        }
        
        // Resolve location_id to database ID
        const locationId = cardDef.location_id ? locationMap.get(cardDef.location_id) : undefined;
        if (cardDef.location_id && !locationId) {
          warnings.push(`Card "${cardDef.title}": location_id references unknown location "${cardDef.location_id}"`);
        }
        
        const card = await storage.createCard({
          universeId: universe.id,
          season,
          dayIndex: cardDef.dayIndex,
          title: cardDef.title,
          imagePath: cardDef.image || null,
          captionsJson: cardDef.captions || [],
          sceneText: cardDef.sceneText || "",
          recapText: cardDef.recapText || `Day ${cardDef.dayIndex} - ${cardDef.title}`,
          effectTemplate: cardDef.effectTemplate || "ken-burns",
          status: cardDef.status || "draft",
          publishAt: publishDate,
          sceneDescription: cardDef.scene_description || null,
          imageGeneration: convertImageGeneration(cardDef.image_generation),
          imageGenerated: false,
          primaryCharacterIds: primaryCharacterIds.length > 0 ? primaryCharacterIds : null,
          locationId: locationId || null,
          chatOverrides: cardDef.chat?.overrides || null,
        });
        createdItems.cards.push(card.id);
        
        // Link characters to card for chat unlocking (case-insensitive, accepts ID or name)
        // Supports both chat_unlocked_character_ids (new) and characters (legacy)
        const chatCharRefs = cardDef.chat_unlocked_character_ids || (cardDef as any).characters || [];
        for (const charRef of chatCharRefs) {
          const charId = characterMap.get(charRef.toLowerCase());
          if (charId) {
            await storage.linkCardCharacter(card.id, charId);
          } else {
            warnings.push(`Card "${cardDef.title}": chat character references unknown character "${charRef}"`);
          }
        }
      }
      
      res.json({
        success: true,
        universeId: universe.id,
        universeName: universe.name,
        visualMode: manifest.universe.visual_mode || "author_supplied",
        createdCards: createdItems.cards.length,
        createdCharacters: createdItems.characters.length,
        warnings,
      });
    } catch (error) {
      console.error("Import execution error:", error);
      res.status(500).json({ message: "Error executing import" });
    }
  });

  // ============ IMAGE GENERATION ROUTES ============
  
  // Get cards pending image generation for a universe
  app.get("/api/universes/:id/cards/pending-images", requireAdmin, async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const universe = await storage.getUniverse(universeId);
      
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      const cards = await storage.getCardsByUniverse(universeId);
      const pendingCards = cards.filter((c: schema.Card) => 
        !c.imageGenerated && 
        !c.imagePath && 
        (c.sceneDescription || c.imageGeneration?.prompt)
      );
      
      res.json({
        universeId,
        universeName: universe.name,
        visualMode: universe.visualMode,
        totalCards: cards.length,
        pendingCount: pendingCards.length,
        generatedCount: cards.filter((c: schema.Card) => c.imageGenerated).length,
        pendingCards: pendingCards.map((c: schema.Card) => ({
          id: c.id,
          title: c.title,
          dayIndex: c.dayIndex,
          sceneDescription: c.sceneDescription,
          imageGeneration: c.imageGeneration,
        })),
      });
    } catch (error) {
      console.error("Error fetching pending images:", error);
      res.status(500).json({ message: "Error fetching pending images" });
    }
  });
  
  // Compose prompt for a card (combines universe style + continuity + card prompt)
  const composeImagePrompt = async (
    universe: schema.Universe, 
    card: schema.Card
  ): Promise<string> => {
    const parts: string[] = [];
    
    // 1. Universe base prompt
    if (universe.visualStyle?.basePrompt) {
      parts.push(universe.visualStyle.basePrompt);
    }
    
    // 2. Universe visual continuity (art direction, palette, camera language, lighting/texture rules)
    const vc = universe.visualContinuity;
    if (vc) {
      const continuityParts: string[] = [];
      if (vc.artDirection) continuityParts.push(`Art direction: ${vc.artDirection}`);
      if (vc.palette) continuityParts.push(`Color palette: ${vc.palette}`);
      if (vc.cameraLanguage) continuityParts.push(`Camera: ${vc.cameraLanguage}`);
      if (vc.lightingRules) continuityParts.push(`Lighting rules: ${vc.lightingRules}`);
      if (vc.textureRules) continuityParts.push(`Textures: ${vc.textureRules}`);
      if (continuityParts.length > 0) {
        parts.push(continuityParts.join(". "));
      }
    }
    
    // 3. Referenced character visual profiles
    if (card.primaryCharacterIds && card.primaryCharacterIds.length > 0) {
      for (const charId of card.primaryCharacterIds) {
        const character = await storage.getCharacter(charId);
        if (character?.visualProfile?.continuityDescription) {
          parts.push(`Character "${character.name}": ${character.visualProfile.continuityDescription}`);
        }
      }
    }
    
    // 4. Referenced location continuity
    if (card.locationId) {
      const location = await storage.getLocation(card.locationId);
      if (location?.continuity?.continuityDescription) {
        parts.push(`Location: ${location.continuity.continuityDescription}`);
      }
    }
    
    // 5. Card-specific prompt (prefer explicit prompt over scene_description)
    if (card.imageGeneration?.prompt) {
      parts.push(card.imageGeneration.prompt);
    } else if (card.sceneDescription) {
      parts.push(card.sceneDescription);
    }
    
    // 6. Shot type and lighting overrides
    if (card.imageGeneration?.shotType) {
      parts.push(`Shot type: ${card.imageGeneration.shotType}`);
    }
    if (card.imageGeneration?.lighting) {
      parts.push(`Lighting: ${card.imageGeneration.lighting}`);
    }
    
    return parts.join(". ");
  };
  
  const composeNegativePrompt = (universe: schema.Universe, card: schema.Card): string => {
    const parts: string[] = [];
    
    // Universe negative prompt
    if (universe.visualStyle?.negativePrompt) {
      parts.push(universe.visualStyle.negativePrompt);
    }
    
    // Universe taboo list (from visual continuity)
    if (universe.visualContinuity?.tabooList && universe.visualContinuity.tabooList.length > 0) {
      parts.push(...universe.visualContinuity.tabooList);
    }
    
    // Card-specific negative prompt
    if (card.imageGeneration?.negativePrompt) {
      parts.push(card.imageGeneration.negativePrompt);
    }
    
    return parts.join(", ");
  };
  
  // Preview composed prompt for a card (without generating)
  app.get("/api/cards/:id/preview-prompt", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const universe = await storage.getUniverse(card.universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      const prompt = await composeImagePrompt(universe, card);
      const negativePrompt = composeNegativePrompt(universe, card);
      const aspectRatio = universe.visualStyle?.aspectRatio || "9:16";
      
      res.json({
        cardId: card.id,
        cardTitle: card.title,
        composedPrompt: prompt,
        negativePrompt: negativePrompt || null,
        aspectRatio,
        hasPrompt: !!(card.sceneDescription || card.imageGeneration?.prompt),
        imageGenerated: card.imageGenerated,
        generatedImageUrl: card.generatedImageUrl,
      });
    } catch (error) {
      console.error("Error previewing prompt:", error);
      res.status(500).json({ message: "Error previewing prompt" });
    }
  });

  // Generate image for a single card using OpenAI DALL-E
  app.post("/api/cards/:id/generate-image", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const universe = await storage.getUniverse(card.universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      // Check if card has prompt data
      if (!card.sceneDescription && !card.imageGeneration?.prompt) {
        return res.status(400).json({ 
          message: "Card has no scene_description or image_generation.prompt",
          cardId,
        });
      }
      
      // Check if OpenAI is configured (either via Replit AI Integrations or direct API key)
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          message: "OpenAI is not configured. Please set up AI Integrations or add OPENAI_API_KEY.",
        });
      }
      
      // Compose prompts
      const prompt = await composeImagePrompt(universe, card);
      const negativePrompt = composeNegativePrompt(universe, card);
      
      // Determine size based on aspect ratio
      // gpt-image-1 supports: 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape), auto
      const aspectRatio = universe.visualStyle?.aspectRatio || "9:16";
      let size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1536"; // Default vertical for stories
      if (aspectRatio === "1:1") {
        size = "1024x1024";
      } else if (aspectRatio === "16:9" || aspectRatio === "4:3") {
        size = "1536x1024";
      }
      
      // Combine prompt with negative guidance (DALL-E doesn't have negative prompt, so we include it as avoidance)
      let fullPrompt = prompt;
      if (negativePrompt) {
        fullPrompt += `. Avoid: ${negativePrompt}`;
      }
      
      // Truncate if too long (DALL-E 3 has a 4000 char limit)
      if (fullPrompt.length > 3900) {
        fullPrompt = fullPrompt.substring(0, 3900) + "...";
      }
      
      console.log(`Generating image for card ${cardId}: ${card.title}`);
      console.log(`Prompt length: ${fullPrompt.length} chars`);
      console.log(`Aspect ratio: ${aspectRatio}, Size: ${size}`);
      
      // Call OpenAI image generation via Replit AI Integrations
      // gpt-image-1 supports: 1024x1024, 1024x1792 (portrait), 1792x1024 (landscape)
      const response = await getOpenAI().images.generate({
        model: "gpt-image-1",
        prompt: fullPrompt,
        n: 1,
        size: size,
      });
      
      // gpt-image-1 returns base64 instead of URL
      const imageData = response.data?.[0];
      const base64Image = imageData?.b64_json;
      const imageUrl = imageData?.url;
      
      let imageBuffer: Buffer;
      if (base64Image) {
        // Decode base64 image
        imageBuffer = Buffer.from(base64Image, "base64");
      } else if (imageUrl) {
        // Fallback to URL download
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: HTTP ${imageResponse.status}`);
        }
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      } else {
        throw new Error("No image data returned from OpenAI");
      }
      
      if (imageBuffer.length < 1000) {
        throw new Error("Generated image is too small, may be corrupt");
      }
      
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), "uploads", "generated");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Delete old generated image if it exists
      if (card.generatedImageUrl) {
        const oldFilename = card.generatedImageUrl.replace('/uploads/generated/', '');
        const oldFilepath = path.join(uploadsDir, oldFilename);
        if (fs.existsSync(oldFilepath)) {
          try {
            fs.unlinkSync(oldFilepath);
            console.log(`Deleted old image: ${oldFilepath}`);
          } catch (e) {
            console.warn(`Could not delete old image: ${oldFilepath}`);
          }
        }
      }
      
      // Save with unique filename
      const filename = `card-${cardId}-${Date.now()}.png`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, imageBuffer);
      
      // Update card with generated image path
      const generatedImageUrl = `/uploads/generated/${filename}`;
      await storage.updateCard(cardId, {
        generatedImageUrl,
        imageGenerated: true,
      });
      
      console.log(`Image generated and saved: ${generatedImageUrl}`);
      
      res.json({
        success: true,
        cardId: card.id,
        cardTitle: card.title,
        generatedImageUrl,
        promptUsed: fullPrompt.substring(0, 500) + (fullPrompt.length > 500 ? "..." : ""),
        size,
      });
    } catch (error: any) {
      console.error("Error generating image:", error);
      
      // Handle specific OpenAI errors
      if (error?.status === 400) {
        return res.status(400).json({ 
          message: "OpenAI rejected the prompt. It may contain prohibited content.",
          error: error.message,
        });
      }
      if (error?.status === 429) {
        return res.status(429).json({ 
          message: "Rate limit exceeded. Please wait a moment and try again.",
        });
      }
      if (error?.status === 401) {
        return res.status(401).json({ 
          message: "Invalid OpenAI configuration. Please check your AI Integrations setup.",
        });
      }
      
      res.status(500).json({ 
        message: "Error generating image",
        error: error.message || "Unknown error",
      });
    }
  });
  
  // Generate video for a single card (stub - placeholder for future Kling/video AI integration)
  app.post("/api/cards/:id/generate-video", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check if card has an image to generate video from
      const sourceImage = card.generatedImageUrl || card.imagePath;
      if (!sourceImage) {
        return res.status(400).json({ 
          message: "Card must have an image before generating video. Generate or upload an image first.",
        });
      }
      
      // Stub response - video generation not yet implemented
      // Future: integrate with Kling or other video AI provider
      return res.status(501).json({
        cardId: card.id,
        cardTitle: card.title,
        status: "not_implemented",
        message: "Video generation is coming soon. This feature will use the card image and captions to generate a short video clip.",
      });
      
    } catch (error: any) {
      console.error("Error generating video:", error);
      res.status(500).json({ 
        message: "Error generating video",
        error: error.message || "Unknown error",
      });
    }
  });

  // Update card with generated image URL (after external generation)
  app.patch("/api/cards/:id/set-generated-image", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { generatedImageUrl } = req.body;
      
      if (!generatedImageUrl) {
        return res.status(400).json({ message: "generatedImageUrl is required" });
      }
      
      const card = await storage.updateCard(cardId, {
        generatedImageUrl,
        imageGenerated: true,
      });
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      res.json({
        success: true,
        cardId: card.id,
        generatedImageUrl: card.generatedImageUrl,
      });
    } catch (error) {
      console.error("Error updating card image:", error);
      res.status(500).json({ message: "Error updating card image" });
    }
  });
  
  // Update card image generation settings
  app.patch("/api/cards/:id/image-settings", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { sceneDescription, imageGeneration } = req.body;
      
      const updates: Partial<schema.InsertCard> = {};
      
      if (sceneDescription !== undefined) {
        updates.sceneDescription = sceneDescription;
      }
      
      if (imageGeneration !== undefined) {
        updates.imageGeneration = imageGeneration;
      }
      
      const card = await storage.updateCard(cardId, updates);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      res.json({
        success: true,
        card: {
          id: card.id,
          title: card.title,
          sceneDescription: card.sceneDescription,
          imageGeneration: card.imageGeneration,
        },
      });
    } catch (error) {
      console.error("Error updating card image settings:", error);
      res.status(500).json({ message: "Error updating card image settings" });
    }
  });

  // ============ AUDIO LIBRARY ROUTES ============

  // Scan uploads/audio directory for unimported tracks
  app.get("/api/admin/audio/scan", requireAdmin, async (req, res) => {
    try {
      const audioDir = path.join(process.cwd(), "uploads", "audio");
      
      if (!fs.existsSync(audioDir)) {
        return res.json({ files: [] });
      }
      
      const files = fs.readdirSync(audioDir).filter(f => f.endsWith(".mp3"));
      const existingTracks = await storage.getAllAudioTracks();
      const existingPaths = new Set(existingTracks.map(t => t.filePath));
      
      const unimported = files
        .filter(f => !existingPaths.has(`uploads/audio/${f}`))
        .map(f => ({
          filename: f,
          path: `uploads/audio/${f}`,
          url: `/uploads/audio/${encodeURIComponent(f)}`,
          suggestedTitle: f.replace(/_\d+\.mp3$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        }));
      
      res.json({ files: unimported });
    } catch (error) {
      console.error("Error scanning audio:", error);
      res.status(500).json({ message: "Error scanning audio directory" });
    }
  });

  // Import scanned audio files
  app.post("/api/admin/audio/import", requireAdmin, async (req, res) => {
    try {
      const { files } = req.body;
      
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ message: "files array required" });
      }
      
      const imported: schema.AudioTrack[] = [];
      
      for (const file of files) {
        const track = await storage.createAudioTrack({
          title: file.title || file.suggestedTitle || file.filename,
          artist: file.artist,
          source: "upload",
          licence: file.licence || "Royalty Free",
          licenceUrl: file.licenceUrl,
          attributionRequired: file.attributionRequired || false,
          attributionText: file.attributionText,
          filePath: file.path,
          fileUrl: `/${file.path}`,
          moodTags: file.moodTags || [],
          genreTags: file.genreTags || [],
          createdByUserId: req.user!.id,
        });
        imported.push(track);
      }
      
      res.json({ imported, count: imported.length });
    } catch (error) {
      console.error("Error importing audio:", error);
      res.status(500).json({ message: "Error importing audio files" });
    }
  });

  // Upload new audio file
  app.post("/api/admin/audio/upload", requireAdmin, upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file uploaded" });
      }
      
      const audioDir = path.join(process.cwd(), "uploads", "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      
      const relativePath = `uploads/audio/${filename}`;
      const metadata = JSON.parse(req.body.metadata || "{}");
      
      const track = await storage.createAudioTrack({
        title: metadata.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
        artist: metadata.artist,
        source: "upload",
        licence: metadata.licence || "Royalty Free",
        licenceUrl: metadata.licenceUrl,
        attributionRequired: metadata.attributionRequired || false,
        attributionText: metadata.attributionText,
        filePath: relativePath,
        fileUrl: `/${relativePath}`,
        moodTags: metadata.moodTags || [],
        genreTags: metadata.genreTags || [],
        createdByUserId: req.user!.id,
      });
      
      res.json({ track });
    } catch (error) {
      console.error("Error uploading audio:", error);
      res.status(500).json({ message: "Error uploading audio file" });
    }
  });

  // Get all audio tracks
  app.get("/api/audio", async (req, res) => {
    try {
      const { mood, genre } = req.query;
      
      let tracks;
      if (mood || genre) {
        tracks = await storage.getAudioTracksByFilter(
          mood as string | undefined,
          genre as string | undefined
        );
      } else {
        tracks = await storage.getAllAudioTracks();
      }
      
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching audio tracks:", error);
      res.status(500).json({ message: "Error fetching audio tracks" });
    }
  });

  // Get single audio track
  app.get("/api/audio/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const track = await storage.getAudioTrack(id);
      
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      
      res.json(track);
    } catch (error) {
      console.error("Error fetching audio track:", error);
      res.status(500).json({ message: "Error fetching audio track" });
    }
  });

  // Update audio track
  app.patch("/api/audio/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const track = await storage.updateAudioTrack(id, updates);
      
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      
      res.json(track);
    } catch (error) {
      console.error("Error updating audio track:", error);
      res.status(500).json({ message: "Error updating audio track" });
    }
  });

  // Delete audio track
  app.delete("/api/audio/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const track = await storage.getAudioTrack(id);
      
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      
      // Optionally delete file from disk
      if (track.filePath && fs.existsSync(track.filePath)) {
        fs.unlinkSync(track.filePath);
      }
      
      await storage.deleteAudioTrack(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting audio track:", error);
      res.status(500).json({ message: "Error deleting audio track" });
    }
  });

  // Get universe audio settings
  app.get("/api/universes/:id/audio-settings", async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const settings = await storage.getUniverseAudioSettings(universeId);
      
      res.json(settings || {
        universeId,
        audioMode: "off",
        defaultTrackId: null,
        allowedTrackIds: [],
        fadeInMs: 500,
        fadeOutMs: 500,
        crossfadeMs: 800,
        duckingDuringVoiceOver: true,
        duckDb: 12,
      });
    } catch (error) {
      console.error("Error fetching universe audio settings:", error);
      res.status(500).json({ message: "Error fetching audio settings" });
    }
  });

  // Update universe audio settings
  app.put("/api/universes/:id/audio-settings", requireAdmin, async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const { audioMode, defaultTrackId, allowedTrackIds, fadeInMs, fadeOutMs, crossfadeMs, duckingDuringVoiceOver, duckDb } = req.body;
      
      const settings = await storage.createOrUpdateUniverseAudioSettings({
        universeId,
        audioMode: audioMode || "off",
        defaultTrackId: defaultTrackId || null,
        allowedTrackIds: allowedTrackIds || [],
        fadeInMs: fadeInMs ?? 500,
        fadeOutMs: fadeOutMs ?? 500,
        crossfadeMs: crossfadeMs ?? 800,
        duckingDuringVoiceOver: duckingDuringVoiceOver ?? true,
        duckDb: duckDb ?? 12,
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating universe audio settings:", error);
      res.status(500).json({ message: "Error updating audio settings" });
    }
  });

  // ============ TRANSFORMATION PIPELINE ROUTES ============
  
  const { runPipeline, resumeStaleJobs, extractTextFromFile } = await import("./pipeline/runner");
  
  // Resume any stale jobs on server start
  resumeStaleJobs().catch(console.error);
  
  // Create a new transformation job
  app.post("/api/transformations", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const { text, hookPackCount, releaseMode, startDate } = req.body;
      
      let sourceText = text || "";
      let sourceFileName = "text-input.txt";
      let sourceFilePath: string | null = null;
      
      if (req.file) {
        sourceFileName = req.file.originalname;
        
        // Save file for later reference
        const uploadDir = path.join(process.cwd(), "uploads", "transformations");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        sourceFilePath = path.join(uploadDir, `${Date.now()}-${sourceFileName}`);
        fs.writeFileSync(sourceFilePath, req.file.buffer);
        
        // Extract text from file (handles PDFs, text files, etc.)
        const ext = path.extname(sourceFileName).toLowerCase();
        if (ext === ".pdf") {
          sourceText = await extractTextFromFile(sourceFilePath);
        } else {
          sourceText = req.file.buffer.toString("utf8");
        }
      }
      
      if (!sourceText || sourceText.trim().length === 0) {
        return res.status(400).json({ message: "No content provided. Upload a file or provide text." });
      }
      
      const job = await storage.createTransformationJob({
        userId: req.user!.id,
        sourceType: "unknown",
        sourceFileName,
        sourceFilePath,
        status: "queued",
        currentStage: 0,
        stageStatuses: {
          stage0: "pending",
          stage1: "pending",
          stage2: "pending",
          stage3: "pending",
          stage4: "pending",
          stage5: "pending",
        },
        artifacts: {},
      });
      
      // Fire and forget - start pipeline async
      runPipeline(job.id, sourceText).catch((err) => {
        console.error(`Pipeline error for job ${job.id}:`, err);
      });
      
      res.json({ jobId: job.id });
    } catch (error) {
      console.error("Error creating transformation job:", error);
      res.status(500).json({ message: "Error creating transformation job" });
    }
  });
  
  // Get transformation job status (for polling)
  app.get("/api/transformations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getTransformationJob(id);
      
      if (!job) {
        return res.status(404).json({ message: "Transformation job not found" });
      }
      
      // Security: only allow owner or admin to view
      if (job.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Return safe response (no internal data)
      res.json({
        id: job.id,
        status: job.status,
        currentStage: job.currentStage,
        stageStatuses: job.stageStatuses,
        artifacts: job.artifacts,
        outputUniverseId: job.outputUniverseId,
        errorMessageUser: job.errorMessageUser,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching transformation job:", error);
      res.status(500).json({ message: "Error fetching transformation job" });
    }
  });
  
  // Retry a failed transformation job
  app.post("/api/transformations/:id/retry", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getTransformationJob(id);
      
      if (!job) {
        return res.status(404).json({ message: "Transformation job not found" });
      }
      
      if (job.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (job.status !== "failed") {
        return res.status(400).json({ message: "Only failed jobs can be retried" });
      }
      
      // Reset stages from the failed one onwards
      const failedStage = job.currentStage;
      const stageStatuses = { ...(job.stageStatuses as any) };
      for (let i = failedStage; i <= 5; i++) {
        stageStatuses[`stage${i}`] = "pending";
      }
      
      await storage.updateTransformationJob(id, {
        status: "queued",
        stageStatuses,
        errorCode: null,
        errorMessageUser: null,
        errorMessageDev: null,
      });
      
      // Re-read source and restart pipeline
      let sourceText = "";
      if (job.sourceFilePath && fs.existsSync(job.sourceFilePath)) {
        const ext = path.extname(job.sourceFilePath).toLowerCase();
        if (ext === ".pdf") {
          sourceText = await extractTextFromFile(job.sourceFilePath);
        } else {
          sourceText = fs.readFileSync(job.sourceFilePath, "utf8");
        }
      }
      
      if (sourceText) {
        runPipeline(id, sourceText).catch((err) => {
          console.error(`Pipeline retry error for job ${id}:`, err);
        });
      }
      
      res.json({ success: true, message: "Job retry started" });
    } catch (error) {
      console.error("Error retrying transformation job:", error);
      res.status(500).json({ message: "Error retrying transformation job" });
    }
  });
  
  // Get user's transformation jobs
  app.get("/api/transformations", requireAuth, async (req, res) => {
    try {
      const jobs = await storage.getTransformationJobsByUser(req.user!.id);
      
      // Return safe response
      res.json(jobs.map(job => ({
        id: job.id,
        status: job.status,
        currentStage: job.currentStage,
        sourceFileName: job.sourceFileName,
        outputUniverseId: job.outputUniverseId,
        createdAt: job.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching transformation jobs:", error);
      res.status(500).json({ message: "Error fetching transformation jobs" });
    }
  });

  // ============ STRIPE & SUBSCRIPTION ROUTES ============
  
  // Get all plans
  app.get("/api/plans", async (req, res) => {
    try {
      const plans = await storage.getAllPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Error fetching plans" });
    }
  });
  
  // Get user's subscription
  app.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getSubscription(req.user!.id);
      if (!subscription) {
        const freePlan = await storage.getPlanByName("free");
        return res.json({ subscription: null, plan: freePlan });
      }
      const plan = await storage.getPlan(subscription.planId);
      res.json({ subscription, plan });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Error fetching subscription" });
    }
  });
  
  // Get user's entitlements
  app.get("/api/entitlements", requireAuth, async (req, res) => {
    try {
      let entitlements = await storage.getEntitlements(req.user!.id);
      if (!entitlements) {
        entitlements = await storage.upsertEntitlements(req.user!.id, {
          canUseCloudLlm: false,
          canGenerateImages: false,
          canExport: false,
          canUseCharacterChat: false,
          maxCardsPerStory: 5,
          storageDays: 7,
          collaborationRoles: false,
        });
      }
      res.json(entitlements);
    } catch (error) {
      console.error("Error fetching entitlements:", error);
      res.status(500).json({ message: "Error fetching entitlements" });
    }
  });
  
  // Get user's credit wallet
  app.get("/api/credits", requireAuth, async (req, res) => {
    try {
      const wallet = await storage.getOrCreateCreditWallet(req.user!.id);
      res.json(wallet);
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ message: "Error fetching credits" });
    }
  });
  
  // Create checkout session for subscription
  app.post("/api/checkout", requireAuth, async (req, res) => {
    try {
      const { priceId, planName } = req.body;
      
      const { getUncachableStripeClient, getStripePublishableKey } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const plan = await storage.getPlanByName(planName);
      if (!plan) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      
      let customerId: string | undefined;
      const subscription = await storage.getSubscription(req.user!.id);
      if (subscription?.stripeCustomerId) {
        customerId = subscription.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: req.user!.email || undefined,
          metadata: { userId: String(req.user!.id) },
        });
        customerId = customer.id;
      }
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${req.protocol}://${req.get("host")}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/checkout/cancel`,
        metadata: {
          userId: String(req.user!.id),
          planId: String(plan.id),
        },
      });
      
      res.json({ url: session.url, publishableKey: await getStripePublishableKey() });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Error creating checkout session" });
    }
  });
  
  // Create customer portal session
  app.post("/api/billing-portal", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getSubscription(req.user!.id);
      if (!subscription?.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription" });
      }
      
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/settings`,
      });
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Error creating billing portal session" });
    }
  });
  
  // Buy credit pack
  app.post("/api/buy-credits", requireAuth, async (req, res) => {
    try {
      const { creditType, packSize } = req.body;
      
      const { getUncachableStripeClient, getStripePublishableKey } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const packs: Record<string, { amount: number; price: number }> = {
        "video_10": { amount: 10, price: 999 },
        "video_50": { amount: 50, price: 3999 },
        "voice_50": { amount: 50, price: 499 },
        "voice_200": { amount: 200, price: 1499 },
      };
      
      const packKey = `${creditType}_${packSize}`;
      const pack = packs[packKey];
      if (!pack) {
        return res.status(400).json({ message: "Invalid credit pack" });
      }
      
      let customerId: string | undefined;
      const subscription = await storage.getSubscription(req.user!.id);
      if (subscription?.stripeCustomerId) {
        customerId = subscription.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: req.user!.email || undefined,
          metadata: { userId: String(req.user!.id) },
        });
        customerId = customer.id;
      }
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `${pack.amount} ${creditType === "video" ? "Video" : "Voice"} Credits`,
            },
            unit_amount: pack.price,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${req.protocol}://${req.get("host")}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/credits/cancel`,
        metadata: {
          userId: String(req.user!.id),
          creditType,
          amount: String(pack.amount),
        },
      });
      
      res.json({ url: session.url, publishableKey: await getStripePublishableKey() });
    } catch (error) {
      console.error("Error creating credit checkout session:", error);
      res.status(500).json({ message: "Error creating credit checkout session" });
    }
  });

  return httpServer;
}
