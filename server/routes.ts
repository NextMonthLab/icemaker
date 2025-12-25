import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

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

  return httpServer;
}
