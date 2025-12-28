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
import dns from "dns/promises";
import { isKlingConfigured, startImageToVideoGeneration, checkVideoStatus, waitForVideoCompletion } from "./video";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import { startArchiveExpiredPreviewsJob } from "./jobs/archiveExpiredPreviews";

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

  // Helper function to validate URLs for SSRF protection
  async function validateUrlSafety(url: string): Promise<{ safe: boolean; error?: string }> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { safe: false, error: "Invalid URL format" };
    }

    // Only allow https
    if (parsedUrl.protocol !== "https:") {
      return { safe: false, error: "Only HTTPS URLs are allowed for security" };
    }

    // Block internal/private hostnames and IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^169\.254\./,
      /^0\./,
      /\.local$/i,
      /\.internal$/i,
      /\.localhost$/i,
      /^metadata\./i,
      /^169\.254\.169\.254$/,
    ];

    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      return { safe: false, error: "URLs to internal or private networks are not allowed" };
    }

    // Block IPv4 address literals
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, error: "Direct IP addresses are not allowed. Please use a domain name." };
    }

    // Block IPv6 address literals (URLs use [::1] format)
    if (hostname.startsWith('[') || /^[0-9a-f:]+$/i.test(hostname)) {
      return { safe: false, error: "IPv6 addresses are not allowed. Please use a domain name." };
    }

    // DNS resolution check - verify the resolved IP is public (prevents DNS rebinding)
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        const ip = addr.address;
        // Check IPv4 private/internal ranges
        if (addr.family === 4) {
          if (
            ip.startsWith('127.') ||
            ip.startsWith('10.') ||
            ip.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
            ip.startsWith('169.254.') ||
            ip.startsWith('0.') ||
            ip === '255.255.255.255'
          ) {
            return { safe: false, error: "URL resolves to a private or internal network address" };
          }
        }
        // Check IPv6 loopback, private ranges, and IPv4-mapped/translated addresses
        if (addr.family === 6) {
          const ipLower = ip.toLowerCase();

          // Helper to check if an IPv4 address is private/internal
          const isPrivateIPv4 = (ipv4: string): boolean => {
            return (
              ipv4.startsWith('127.') ||
              ipv4.startsWith('10.') ||
              ipv4.startsWith('192.168.') ||
              /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ipv4) ||
              ipv4.startsWith('169.254.') ||
              ipv4.startsWith('0.') ||
              ipv4 === '255.255.255.255'
            );
          };

          // Extract IPv4 from various mapped/translated formats
          const ipv4Patterns = [
            /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
            /^::ffff:0:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
            /^64:ff9b::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
            /^::ffff:0:0:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
          ];

          for (const pattern of ipv4Patterns) {
            const match = ipLower.match(pattern);
            if (match && isPrivateIPv4(match[1])) {
              return { safe: false, error: "URL resolves to a private or internal network address" };
            }
          }

          // Also check if IPv4 is embedded as hex octets
          const hexMappedMatch = ipLower.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/i);
          if (hexMappedMatch) {
            const high = parseInt(hexMappedMatch[1], 16);
            const low = parseInt(hexMappedMatch[2], 16);
            const embeddedIpv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
            if (isPrivateIPv4(embeddedIpv4)) {
              return { safe: false, error: "URL resolves to a private or internal network address" };
            }
          }

          // Block pure IPv6 private/loopback/link-local
          const isLinkLocal = /^fe[89ab][0-9a-f]:/i.test(ipLower);
          if (
            ipLower === '::1' ||
            ipLower === '::' ||
            ipLower.startsWith('fc') ||
            ipLower.startsWith('fd') ||
            isLinkLocal
          ) {
            return { safe: false, error: "URL resolves to a private or internal network address" };
          }
        }
      }
    } catch (dnsError: any) {
      console.error("DNS lookup error:", dnsError);
      return { safe: false, error: "Could not resolve URL hostname" };
    }

    return { safe: true };
  }

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
  
  // ============ CREATOR ROUTES ============
  
  // Get user's entitlements (subscription-based access)
  app.get("/api/me/entitlements", requireAuth, async (req, res) => {
    try {
      const { getFullEntitlements } = await import("./entitlements");
      const entitlements = await getFullEntitlements(req.user!.id);
      res.json(entitlements);
    } catch (error) {
      console.error("Error fetching entitlements:", error);
      res.status(500).json({ message: "Error fetching entitlements" });
    }
  });
  
  // Become a creator (upgrade from viewer to creator role)
  app.post("/api/me/become-creator", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      
      if (user.role === 'admin' || user.isAdmin) {
        return res.json({ message: "Already an admin", user });
      }
      
      if (user.role === 'creator') {
        const creatorProfile = await storage.getCreatorProfile(user.id);
        return res.json({ message: "Already a creator", user, creatorProfile });
      }
      
      // Upgrade user to creator role
      const updatedUser = await storage.updateUser(user.id, { role: 'creator' as any });
      
      // Create creator profile with free tier
      const creatorProfile = await storage.createCreatorProfile({
        userId: user.id,
        displayName: user.username,
        subscriptionStatus: 'inactive', // Free tier
      });
      
      const { password: _, ...userWithoutPassword } = updatedUser!;
      res.json({ 
        message: "You are now a creator!", 
        user: userWithoutPassword,
        creatorProfile 
      });
    } catch (error) {
      console.error("Error becoming creator:", error);
      res.status(500).json({ message: "Error updating account" });
    }
  });
  
  // Get creator profile
  app.get("/api/me/creator-profile", requireAuth, async (req, res) => {
    try {
      const creatorProfile = await storage.getCreatorProfile(req.user!.id);
      if (!creatorProfile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      res.json(creatorProfile);
    } catch (error) {
      console.error("Error fetching creator profile:", error);
      res.status(500).json({ message: "Error fetching creator profile" });
    }
  });
  
  // Update creator profile
  app.patch("/api/me/creator-profile", requireAuth, async (req, res) => {
    try {
      const creatorProfile = await storage.getCreatorProfile(req.user!.id);
      if (!creatorProfile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      
      const { displayName, headline, bio, avatarUrl, externalLink, slug } = req.body;
      
      // Validate slug uniqueness if changing
      if (slug && slug !== creatorProfile.slug) {
        const existing = await storage.getCreatorProfileBySlug(slug);
        if (existing) {
          return res.status(400).json({ message: "This profile URL is already taken" });
        }
      }
      
      const updated = await storage.updateCreatorProfile(req.user!.id, {
        displayName: displayName ?? creatorProfile.displayName,
        headline: headline !== undefined ? headline : creatorProfile.headline,
        bio: bio !== undefined ? bio : creatorProfile.bio,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : creatorProfile.avatarUrl,
        externalLink: externalLink !== undefined ? externalLink : creatorProfile.externalLink,
        slug: slug !== undefined ? slug : creatorProfile.slug,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating creator profile:", error);
      res.status(500).json({ message: "Error updating creator profile" });
    }
  });
  
  // Public: Get creator profile by slug
  app.get("/api/creators/:slug", async (req, res) => {
    try {
      const profile = await storage.getCreatorProfileBySlug(req.params.slug);
      if (!profile) {
        return res.status(404).json({ message: "Creator not found" });
      }
      
      // Get universes for this creator
      const universes = await storage.getUniversesByCreator(profile.userId);
      
      // Return public info only (exclude stripe IDs, etc.)
      res.json({
        id: profile.id,
        displayName: profile.displayName,
        slug: profile.slug,
        headline: profile.headline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        externalLink: profile.externalLink,
        universes: universes.map(u => ({
          id: u.id,
          slug: u.slug,
          title: u.title,
          description: u.description,
          coverImageUrl: u.coverImageUrl,
          genre: u.genre,
        })),
      });
    } catch (error) {
      console.error("Error fetching public creator profile:", error);
      res.status(500).json({ message: "Error fetching creator profile" });
    }
  });
  
  // Get user onboarding profile
  app.get("/api/me/onboarding", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getUserOnboardingProfile(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching onboarding profile:", error);
      res.status(500).json({ message: "Error fetching onboarding profile" });
    }
  });
  
  // Create or update user onboarding profile
  app.post("/api/me/onboarding", requireAuth, async (req, res) => {
    try {
      const { persona, industry, companyName, teamSize, goals, targetAudience, contentFrequency, onboardingCompleted } = req.body;
      
      // Validate persona (required)
      const validPersonas = ['news_outlet', 'business', 'influencer', 'educator', 'creator', 'other'];
      if (!persona || !validPersonas.includes(persona)) {
        return res.status(400).json({ message: "Invalid persona type" });
      }
      
      // Validate industry if provided
      const validIndustries = ['media', 'technology', 'healthcare', 'finance', 'entertainment', 'education', 'retail', 'travel', 'food', 'sports', 'real_estate', 'nonprofit', 'government', 'other'];
      if (industry && !validIndustries.includes(industry)) {
        return res.status(400).json({ message: "Invalid industry" });
      }
      
      const profile = await storage.upsertUserOnboardingProfile({
        userId: req.user!.id,
        persona,
        industry: industry || null,
        companyName: companyName || null,
        teamSize: teamSize || null,
        goals: goals || null,
        targetAudience: targetAudience || null,
        contentFrequency: contentFrequency || null,
        onboardingCompleted: onboardingCompleted ?? false,
      });
      
      res.json(profile);
    } catch (error) {
      console.error("Error updating onboarding profile:", error);
      res.status(500).json({ message: "Error updating onboarding profile" });
    }
  });
  
  // Get engagement metrics for universes (creators/admins only)
  app.get("/api/engagement", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { getFullEntitlements } = await import("./entitlements");
      const entitlements = await getFullEntitlements(user.id);
      
      if (!entitlements.canViewEngagement && !entitlements.isAdmin) {
        return res.status(403).json({ 
          message: "Engagement metrics require a creator account",
          upgradeRequired: true 
        });
      }
      
      // Get all universes for now (in future, filter by ownership)
      const universes = await storage.getAllUniverses();
      
      // Get engagement counts from user progress table
      const engagementData = await Promise.all(
        universes.map(async (universe) => {
          const cards = await storage.getCardsByUniverse(universe.id);
          const publishedCards = cards.filter(c => c.status === 'published');
          
          return {
            universeId: universe.id,
            universeName: universe.name,
            totalCards: publishedCards.length,
            publishedCards: publishedCards.length,
          };
        })
      );
      
      res.json({
        universes: engagementData,
        summary: {
          totalUniverses: universes.length,
          totalCards: engagementData.reduce((sum, u) => sum + u.totalCards, 0),
        }
      });
    } catch (error) {
      console.error("Error fetching engagement metrics:", error);
      res.status(500).json({ message: "Error fetching engagement metrics" });
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
      
      const creatorProfile = await storage.getCreatorForUniverse(universe.id);
      const creator = creatorProfile ? {
        displayName: creatorProfile.displayName,
        slug: creatorProfile.slug,
        headline: creatorProfile.headline,
        avatarUrl: creatorProfile.avatarUrl,
      } : null;
      
      const now = new Date();
      const publishedCards = cards
        .filter(c => c.status === 'published' && (!c.publishAt || new Date(c.publishAt) <= now))
        .sort((a, b) => a.dayIndex - b.dayIndex);
      
      res.json({
        universe,
        cards: publishedCards,
        characters,
        creator,
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
  
  // Create custom character with knowledge source (Pro/Business feature)
  app.post("/api/characters/custom", requireAdmin, upload.single("knowledgeFile"), async (req, res) => {
    try {
      const { name, role, description, systemPrompt, guardrails, universeId, knowledgeSourceUrl } = req.body;
      
      if (!name || !role || !universeId) {
        return res.status(400).json({ message: "Name, role, and universe are required" });
      }
      
      // Generate slug from name
      const characterSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      let knowledgeContent = "";
      let knowledgeDocuments: any[] = [];
      let trainingStatus: "pending" | "processing" | "ready" | "failed" = "ready";
      
      // Process knowledge source URL if provided
      if (knowledgeSourceUrl) {
        trainingStatus = "processing";
        try {
          // Fetch URL content
          const response = await fetch(knowledgeSourceUrl, {
            headers: { "User-Agent": "StoryFlix-Bot/1.0" },
          });
          if (response.ok) {
            const html = await response.text();
            // Extract text content (simple HTML stripping)
            knowledgeContent = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 50000); // Limit to 50k chars
            
            knowledgeDocuments.push({
              fileName: new URL(knowledgeSourceUrl).hostname,
              fileType: "url",
              uploadedAt: new Date().toISOString(),
              sourceUrl: knowledgeSourceUrl,
              contentPreview: knowledgeContent.slice(0, 200),
            });
            trainingStatus = "ready";
          } else {
            console.error("Failed to fetch knowledge URL:", response.status, response.statusText);
            trainingStatus = "failed";
          }
        } catch (err) {
          console.error("Error fetching knowledge URL:", err);
          trainingStatus = "failed";
        }
      }
      
      // Process uploaded file if provided
      if (req.file) {
        trainingStatus = "processing";
        try {
          let fileContent = "";
          
          if (req.file.mimetype === "application/pdf") {
            // Parse PDF
            const pdfParseModule = await import("pdf-parse") as any;
            const pdfParse = pdfParseModule.default || pdfParseModule;
            const pdfData = await pdfParse(req.file.buffer);
            fileContent = pdfData.text.slice(0, 50000);
          } else {
            // Plain text files
            fileContent = req.file.buffer.toString("utf-8").slice(0, 50000);
          }
          
          knowledgeContent += (knowledgeContent ? "\n\n" : "") + fileContent;
          knowledgeDocuments.push({
            fileName: req.file.originalname,
            fileType: req.file.originalname.split('.').pop() || "txt",
            uploadedAt: new Date().toISOString(),
            contentPreview: fileContent.slice(0, 200),
          });
          trainingStatus = "ready";
        } catch (err) {
          console.error("Error processing uploaded file:", err);
          trainingStatus = "failed";
        }
      }
      
      // Build enhanced system prompt with knowledge
      let enhancedSystemPrompt = systemPrompt || `You are ${name}, a ${role}.`;
      if (knowledgeContent) {
        enhancedSystemPrompt += `\n\n## Your Knowledge Base\nUse the following information to inform your responses:\n\n${knowledgeContent.slice(0, 30000)}`;
      }
      if (guardrails) {
        enhancedSystemPrompt += `\n\n## Important Rules\n${guardrails}`;
      }
      
      const character = await storage.createCharacter({
        universeId: parseInt(universeId),
        characterSlug,
        name,
        role,
        description: description || null,
        systemPrompt: enhancedSystemPrompt,
        isCustomCharacter: true,
        knowledgeSourceUrl: knowledgeSourceUrl || null,
        knowledgeDocuments: knowledgeDocuments.length > 0 ? knowledgeDocuments : null,
        knowledgeContent: knowledgeContent || null,
        trainingStatus,
        guardrails: guardrails || null,
        isActive: true,
      });
      
      res.json(character);
    } catch (error) {
      console.error("Error creating custom character:", error);
      res.status(500).json({ message: "Error creating character" });
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
  
  // Compose prompt for a card (combines universe style + design guide + continuity + card prompt)
  const composeImagePrompt = async (
    universe: schema.Universe, 
    card: schema.Card
  ): Promise<string> => {
    const parts: string[] = [];
    const dg = universe.designGuide as schema.DesignGuide | null;
    
    // 1. Design Guide base prompt (new system - takes priority)
    if (dg?.basePrompt) {
      parts.push(dg.basePrompt);
    } else if (universe.visualStyle?.basePrompt) {
      parts.push(universe.visualStyle.basePrompt);
    }
    
    // 2. Design Guide style elements
    if (dg) {
      const styleParts: string[] = [];
      if (dg.artStyle) styleParts.push(`Style: ${dg.artStyle}`);
      if (dg.colorPalette) styleParts.push(`Colors: ${dg.colorPalette}`);
      if (dg.moodTone) styleParts.push(`Mood: ${dg.moodTone}`);
      if (dg.cameraStyle) styleParts.push(`Camera: ${dg.cameraStyle}`);
      if (dg.lightingNotes) styleParts.push(`Lighting: ${dg.lightingNotes}`);
      if (styleParts.length > 0) {
        parts.push(styleParts.join(". "));
      }
      // Style keywords
      if (dg.styleKeywords?.length) {
        parts.push(dg.styleKeywords.join(", "));
      }
      // Required elements
      if (dg.requiredElements?.length) {
        parts.push(`Include: ${dg.requiredElements.join(", ")}`);
      }
    }
    
    // 3. Fallback to legacy visual continuity (art direction, palette, camera language, lighting/texture rules)
    const vc = universe.visualContinuity;
    if (vc && !dg) {
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
    
    // 4. Referenced character visual profiles
    if (card.primaryCharacterIds && card.primaryCharacterIds.length > 0) {
      for (const charId of card.primaryCharacterIds) {
        const character = await storage.getCharacter(charId);
        if (character?.visualProfile?.continuityDescription) {
          parts.push(`Character "${character.name}": ${character.visualProfile.continuityDescription}`);
        }
      }
    }
    
    // 5. Referenced location continuity
    if (card.locationId) {
      const location = await storage.getLocation(card.locationId);
      if (location?.continuity?.continuityDescription) {
        parts.push(`Location: ${location.continuity.continuityDescription}`);
      }
    }
    
    // 6. Card-specific prompt (prefer explicit prompt over scene_description)
    if (card.imageGeneration?.prompt) {
      parts.push(card.imageGeneration.prompt);
    } else if (card.sceneDescription) {
      parts.push(card.sceneDescription);
    }
    
    // 7. Shot type and lighting overrides
    if (card.imageGeneration?.shotType) {
      parts.push(`Shot type: ${card.imageGeneration.shotType}`);
    }
    if (card.imageGeneration?.lighting) {
      parts.push(`Lighting: ${card.imageGeneration.lighting}`);
    }
    
    // 8. Add minimum quality enhancers if prompt is sparse
    let prompt = parts.join(". ");
    if (prompt.length < 100) {
      const qualityTerms = ["high quality", "detailed", "professional"];
      const hasQuality = qualityTerms.some(t => prompt.toLowerCase().includes(t));
      if (!hasQuality) {
        prompt += ". High quality, detailed, professional lighting";
      }
    }
    
    return prompt;
  };
  
  const composeNegativePrompt = (universe: schema.Universe, card: schema.Card): string => {
    const parts: string[] = [];
    const dg = universe.designGuide as schema.DesignGuide | null;
    
    // Design Guide negative prompt (takes priority)
    if (dg?.negativePrompt) {
      parts.push(dg.negativePrompt);
    } else if (universe.visualStyle?.negativePrompt) {
      parts.push(universe.visualStyle.negativePrompt);
    }
    
    // Design Guide avoid list
    if (dg?.avoidList?.length) {
      parts.push(...dg.avoidList);
    }
    
    // Universe taboo list (from visual continuity - legacy)
    if (universe.visualContinuity?.tabooList && universe.visualContinuity.tabooList.length > 0) {
      parts.push(...universe.visualContinuity.tabooList);
    }
    
    // Card-specific negative prompt
    if (card.imageGeneration?.negativePrompt) {
      parts.push(card.imageGeneration.negativePrompt);
    }
    
    // Always include baseline quality negatives
    if (parts.length === 0) {
      parts.push("blurry", "low quality", "distorted", "ugly", "deformed");
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
  
  // Generate video for a single card (supports Replicate and Kling)
  app.post("/api/cards/:id/generate-video", requireAdmin, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const { isReplicateConfigured, generateVideoWithReplicate, getReplicateModels } = await import("./video");
      
      // Check if any video provider is configured
      if (!isReplicateConfigured() && !isKlingConfigured()) {
        return res.status(503).json({ 
          message: "Video generation is not configured. Set REPLICATE_API_TOKEN or KLING_ACCESS_KEY/KLING_SECRET_KEY.",
        });
      }
      
      // Check if card has an image to generate video from
      const sourceImage = card.generatedImageUrl || card.imagePath;
      if (!sourceImage) {
        return res.status(400).json({ 
          message: "Card must have an image before generating video. Generate or upload an image first.",
        });
      }
      
      // Build a prompt from card content
      const promptParts: string[] = [];
      if (card.sceneDescription) {
        promptParts.push(card.sceneDescription);
      }
      if (card.captionsJson && Array.isArray(card.captionsJson)) {
        const captions = card.captionsJson.map((c: any) => c.text || c).join(" ");
        if (captions) promptParts.push(captions);
      }
      const prompt = promptParts.join(". ") || "Subtle cinematic motion, atmospheric lighting";
      
      console.log(`Starting video generation for card ${cardId} with image: ${sourceImage}`);
      
      // Prefer Replicate if configured (pay-per-use, no balance issues)
      if (isReplicateConfigured()) {
        const models = getReplicateModels();
        const defaultModel = models[0]?.id || "kling-v1.6-standard";
        
        console.log(`[Video] Using Replicate provider with model: ${defaultModel}`);
        
        const result = await generateVideoWithReplicate({
          prompt,
          imageUrl: sourceImage,
          negativePrompt: "blurry, low quality, distorted, watermark, text overlay",
          aspectRatio: "9:16",
          duration: 5,
          model: defaultModel,
        });
        
        if (result.status === "completed" && result.videoUrl) {
          await storage.updateCard(cardId, {
            generatedVideoUrl: result.videoUrl,
            videoGenerated: true,
            videoGenerationStatus: "completed",
            videoGeneratedAt: new Date(),
          });
          
          return res.json({
            cardId: card.id,
            cardTitle: card.title,
            status: "completed",
            videoUrl: result.videoUrl,
          });
        } else {
          await storage.updateCard(cardId, {
            videoGenerationStatus: "failed",
            videoGenerationError: result.error || "Video generation failed",
          });
          return res.status(500).json({
            cardId: card.id,
            cardTitle: card.title,
            status: "failed",
            message: result.error || "Video generation failed",
          });
        }
      }
      
      // Fall back to Kling if Replicate not configured
      const taskId = await startImageToVideoGeneration({
        imageUrl: sourceImage,
        prompt,
        aspectRatio: "9:16",
        duration: 5,
        model: "kling-v1-6",
      });
      
      console.log(`Video generation task started: ${taskId}`);
      
      const result = await waitForVideoCompletion(taskId, (status) => {
        console.log(`Video generation status for ${cardId}: ${status.status}`);
      });
      
      if (result.status === "failed") {
        return res.status(500).json({
          cardId: card.id,
          cardTitle: card.title,
          status: "failed",
          message: result.error || "Video generation failed",
        });
      }
      
      if (result.status === "completed" && result.videoUrl) {
        await storage.updateCard(cardId, {
          generatedVideoUrl: result.videoUrl,
          videoGenerated: true,
        });
        
        return res.json({
          cardId: card.id,
          cardTitle: card.title,
          status: "completed",
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl,
        });
      }
      
      return res.status(500).json({
        cardId: card.id,
        cardTitle: card.title,
        status: result.status,
        message: "Video generation did not complete successfully",
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

  // ============ DESIGN GUIDE & REFERENCE ASSETS ROUTES ============
  
  // Update universe design guide
  app.put("/api/universes/:id/design-guide", requireAdmin, async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const designGuide = req.body;
      
      const updated = await storage.updateUniverse(universeId, { designGuide });
      if (!updated) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      res.json({ designGuide: updated.designGuide });
    } catch (error) {
      console.error("Error updating design guide:", error);
      res.status(500).json({ message: "Error updating design guide" });
    }
  });
  
  // Get reference assets for a universe
  app.get("/api/universes/:id/reference-assets", async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const assetType = req.query.type as string | undefined;
      
      let assets;
      if (assetType) {
        assets = await storage.getReferenceAssetsByType(universeId, assetType as any);
      } else {
        assets = await storage.getReferenceAssetsByUniverse(universeId);
      }
      
      res.json(assets);
    } catch (error) {
      console.error("Error fetching reference assets:", error);
      res.status(500).json({ message: "Error fetching reference assets" });
    }
  });
  
  // Create a reference asset
  app.post("/api/universes/:id/reference-assets", requireAdmin, upload.single("image"), async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const { name, description, assetType, promptNotes, characterId, locationId, priority, imagePath } = req.body;
      
      // Handle file upload or provided imagePath
      let finalImagePath = imagePath;
      if (req.file) {
        // Store the uploaded file (assuming base64 for simplicity)
        finalImagePath = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
      
      if (!finalImagePath) {
        return res.status(400).json({ message: "Image is required" });
      }
      
      const asset = await storage.createReferenceAsset({
        universeId,
        name,
        description: description || null,
        assetType: assetType || 'style',
        imagePath: finalImagePath,
        promptNotes: promptNotes || null,
        characterId: characterId ? parseInt(characterId) : null,
        locationId: locationId ? parseInt(locationId) : null,
        priority: priority ? parseInt(priority) : 0,
        isActive: true,
      });
      
      res.json(asset);
    } catch (error) {
      console.error("Error creating reference asset:", error);
      res.status(500).json({ message: "Error creating reference asset" });
    }
  });
  
  // Update a reference asset
  app.put("/api/reference-assets/:id", requireAdmin, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const { name, description, assetType, promptNotes, characterId, locationId, priority, isActive } = req.body;
      
      const updated = await storage.updateReferenceAsset(assetId, {
        name,
        description,
        assetType,
        promptNotes,
        characterId: characterId ?? undefined,
        locationId: locationId ?? undefined,
        priority: priority !== undefined ? parseInt(priority) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      });
      
      if (!updated) {
        return res.status(404).json({ message: "Reference asset not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating reference asset:", error);
      res.status(500).json({ message: "Error updating reference asset" });
    }
  });
  
  // Delete a reference asset
  app.delete("/api/reference-assets/:id", requireAdmin, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      await storage.deleteReferenceAsset(assetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reference asset:", error);
      res.status(500).json({ message: "Error deleting reference asset" });
    }
  });

  // ============ TRANSFORMATION PIPELINE ROUTES ============
  
  const { runPipeline, resumeStaleJobs, extractTextFromFile } = await import("./pipeline/runner");
  
  // Resume any stale jobs on server start
  resumeStaleJobs().catch(console.error);
  
  // Create a new transformation job
  app.post("/api/transformations", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const { text, hookPackCount, releaseMode, startDate, sourceUrl, contentSourceType, contentIndustry, contentCategory, contentGoal, storyLength } = req.body;
      
      let sourceText = text || "";
      let sourceFileName = "text-input.txt";
      let sourceFilePath: string | null = null;
      let detectedSourceType: "script" | "pdf" | "ppt" | "article" | "transcript" | "url" | "unknown" = "unknown";
      
      // Valid enum values for metadata fields
      const VALID_CONTENT_SOURCE_TYPES = ['website', 'blog_post', 'news_article', 'documentation', 'social_media', 'press_release', 'other'];
      const VALID_CONTENT_INDUSTRIES = ['technology', 'healthcare', 'finance', 'entertainment', 'education', 'retail', 'travel', 'food', 'sports', 'real_estate', 'other'];
      const VALID_CONTENT_CATEGORIES = ['news', 'narrative', 'marketing', 'educational', 'entertainment', 'documentary', 'promotional', 'other'];
      const VALID_CONTENT_GOALS = ['brand_awareness', 'lead_generation', 'audience_engagement', 'product_launch', 'thought_leadership', 'storytelling', 'education', 'other'];
      
      // Handle URL-based transformation
      if (sourceUrl && typeof sourceUrl === "string" && sourceUrl.trim()) {
        // Validate initial URL
        const initialValidation = await validateUrlSafety(sourceUrl.trim());
        if (!initialValidation.safe) {
          return res.status(400).json({ message: initialValidation.error });
        }

        // Validate metadata fields against enums
        if (contentSourceType && !VALID_CONTENT_SOURCE_TYPES.includes(contentSourceType)) {
          return res.status(400).json({ message: "Invalid content source type" });
        }
        if (contentIndustry && !VALID_CONTENT_INDUSTRIES.includes(contentIndustry)) {
          return res.status(400).json({ message: "Invalid content industry" });
        }
        if (contentCategory && !VALID_CONTENT_CATEGORIES.includes(contentCategory)) {
          return res.status(400).json({ message: "Invalid content category" });
        }
        if (contentGoal && !VALID_CONTENT_GOALS.includes(contentGoal)) {
          return res.status(400).json({ message: "Invalid content goal" });
        }

        try {
          // Follow redirects safely (max 5 redirects)
          let currentUrl = sourceUrl.trim();
          let redirectCount = 0;
          const maxRedirects = 5;
          let finalResponse: Response | null = null;

          while (redirectCount <= maxRedirects) {
            const urlResponse = await fetch(currentUrl, {
              headers: {
                "User-Agent": "StoryFlix-Bot/1.0 (Content Transformer)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
              signal: AbortSignal.timeout(30000), // 30s timeout
              redirect: "manual", // Handle redirects manually for security
            });

            // Check if this is a redirect
            if (urlResponse.status >= 300 && urlResponse.status < 400) {
              const redirectLocation = urlResponse.headers.get("location");
              if (!redirectLocation) {
                return res.status(400).json({ message: "Server returned a redirect without a Location header" });
              }

              // Resolve relative redirects
              let redirectUrl: string;
              try {
                redirectUrl = new URL(redirectLocation, currentUrl).toString();
              } catch {
                return res.status(400).json({ message: "Invalid redirect URL" });
              }

              // Validate the redirect destination
              const redirectValidation = await validateUrlSafety(redirectUrl);
              if (!redirectValidation.safe) {
                return res.status(400).json({
                  message: `Redirect blocked for security: ${redirectValidation.error}. Original URL redirects to: ${redirectUrl}`
                });
              }

              redirectCount++;
              if (redirectCount > maxRedirects) {
                return res.status(400).json({ message: "Too many redirects (maximum 5 allowed)" });
              }

              console.log(`Following redirect ${redirectCount}: ${currentUrl} -> ${redirectUrl}`);
              currentUrl = redirectUrl;
              continue;
            }

            // Not a redirect, this is our final response
            if (!urlResponse.ok) {
              return res.status(400).json({ message: `Failed to fetch URL: ${urlResponse.status} ${urlResponse.statusText}` });
            }

            finalResponse = urlResponse;
            break;
          }

          if (!finalResponse) {
            return res.status(400).json({ message: "Failed to fetch URL after following redirects" });
          }

          const htmlContent = await finalResponse.text();

          // Basic HTML to text extraction (strip tags, normalize whitespace)
          sourceText = htmlContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, " ")
            .trim();

          detectedSourceType = "url";
          sourceFileName = new URL(currentUrl).hostname;
        } catch (fetchError: any) {
          console.error("URL fetch error:", fetchError);
          return res.status(400).json({ message: `Failed to fetch URL: ${fetchError.message || "Network error"}` });
        }
      } else if (req.file) {
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
          detectedSourceType = "pdf";
        } else {
          sourceText = req.file.buffer.toString("utf8");
        }
      }
      
      if (!sourceText || sourceText.trim().length === 0) {
        return res.status(400).json({ message: "No content provided. Upload a file, provide text, or enter a URL." });
      }
      
      const job = await storage.createTransformationJob({
        userId: req.user!.id,
        sourceType: detectedSourceType,
        sourceFileName,
        sourceFilePath,
        sourceUrl: sourceUrl?.trim() || null,
        contentSourceType: contentSourceType || null,
        contentIndustry: contentIndustry || null,
        contentCategory: contentCategory || null,
        contentGoal: contentGoal || null,
        storyLength: ['short', 'medium', 'long'].includes(storyLength) ? storyLength : 'medium',
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
        storyLength: job.storyLength,
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

  // ============ TTS (TEXT-TO-SPEECH) ROUTES ============
  
  // Get available voices
  app.get("/api/tts/voices", async (req, res) => {
    try {
      const { listVoices, isTTSConfigured } = await import("./tts");
      
      if (!isTTSConfigured()) {
        return res.status(503).json({ 
          message: "TTS not configured", 
          configured: false,
          voices: [] 
        });
      }
      
      const voices = listVoices();
      res.json({ configured: true, voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ message: "Error fetching voices" });
    }
  });
  
  // Update card narration text and settings
  app.post("/api/cards/:id/narration/text", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { narrationEnabled, narrationText, narrationVoice, narrationSpeed } = req.body;
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const universe = await storage.getUniverse(card.universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }
      
      const { canUseTTS } = await import("./tts/guards");
      const permission = await canUseTTS(req.user, card.universeId);
      if (!permission.allowed) {
        return res.status(403).json({ message: permission.reason || "TTS not allowed" });
      }
      
      let finalText = narrationText;
      
      // Auto-fill narration text based on universe mode if enabled but text is empty
      if (narrationEnabled && (!finalText || finalText.trim() === "")) {
        const mode = universe.defaultNarrationMode || "manual";
        
        if (mode === "derive_from_sceneText") {
          finalText = card.sceneText || "";
        } else if (mode === "derive_from_captions") {
          const captions = card.captionsJson as string[] || [];
          finalText = captions.join(" ");
        } else if (mode === "ai_summarise_from_card") {
          // Use OpenAI to summarize from card fields (no hallucination - only existing fields)
          try {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI();
            
            const prompt = `Summarize the following scene into a concise 1-paragraph narration suitable for text-to-speech. 
Use ONLY the information provided below. Do NOT add any new facts, characters, or events.

Title: ${card.title}
Scene Text: ${card.sceneText}
Recap: ${card.recapText}
Captions: ${(card.captionsJson as string[] || []).join(", ")}

Output only the narration paragraph, nothing else.`;

            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: 500,
              temperature: 0.5,
            });
            
            finalText = response.choices[0]?.message?.content?.trim() || card.sceneText || "";
          } catch (err) {
            console.error("AI summarization failed:", err);
            finalText = card.sceneText || "";
          }
        }
      }
      
      const { validateNarrationText, MAX_NARRATION_TEXT_LENGTH } = await import("./tts");
      
      if (finalText && finalText.length > MAX_NARRATION_TEXT_LENGTH) {
        return res.status(400).json({ 
          message: `Narration text exceeds maximum length of ${MAX_NARRATION_TEXT_LENGTH} characters` 
        });
      }
      
      // Determine if text has changed (requires regeneration)
      const textChanged = finalText !== card.narrationText;
      const isEnabled = narrationEnabled ?? card.narrationEnabled;
      const hasText = finalText && finalText.trim();
      
      // Build update object
      const updateData: Record<string, any> = {
        narrationEnabled: isEnabled,
        narrationText: finalText ?? card.narrationText,
        narrationVoice: narrationVoice ?? card.narrationVoice ?? universe.defaultNarrationVoice,
        narrationSpeed: narrationSpeed ?? card.narrationSpeed ?? universe.defaultNarrationSpeed,
      };
      
      // If disabled or no text, clear everything
      if (!isEnabled || !hasText) {
        updateData.narrationStatus = "none";
        updateData.narrationAudioUrl = null;
        updateData.narrationAudioDurationSec = null;
        updateData.narrationError = null;
      } 
      // If text changed but enabled, reset to text_ready and clear audio
      else if (textChanged && card.narrationAudioUrl) {
        updateData.narrationStatus = "text_ready";
        updateData.narrationAudioUrl = null;
        updateData.narrationAudioDurationSec = null;
        updateData.narrationError = null;
      }
      // Otherwise just set to text_ready if not already ready
      else if (hasText && card.narrationStatus === "none") {
        updateData.narrationStatus = "text_ready";
      }
      
      const updatedCard = await storage.updateCard(cardId, updateData);
      
      res.json(updatedCard);
    } catch (error) {
      console.error("Error updating narration text:", error);
      res.status(500).json({ message: "Error updating narration text" });
    }
  });
  
  // Preview narration (short audio, not stored)
  app.post("/api/cards/:id/narration/preview", requireAuth, async (req, res) => {
    try {
      const { text, voice, speed } = req.body;
      
      const { isTTSConfigured, synthesiseSpeech } = await import("./tts");
      
      if (!isTTSConfigured()) {
        return res.status(503).json({ message: "TTS not configured" });
      }
      
      // Limit preview to first 300 characters
      const previewText = (text || "").slice(0, 300);
      if (!previewText.trim()) {
        return res.status(400).json({ message: "Preview text cannot be empty" });
      }
      
      const result = await synthesiseSpeech({
        text: previewText,
        voice: voice || "alloy",
        speed: speed || 1.0,
      });
      
      res.set("Content-Type", result.contentType);
      res.send(result.audioBuffer);
    } catch (error) {
      console.error("Error generating preview:", error);
      res.status(500).json({ message: "Error generating preview" });
    }
  });
  
  // Generate full narration audio and store in R2
  app.post("/api/cards/:id/narration/generate", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      if (!card.narrationEnabled) {
        return res.status(400).json({ message: "Narration is not enabled for this card" });
      }
      
      if (!card.narrationText || card.narrationText.trim() === "") {
        return res.status(400).json({ message: "Narration text is empty. Please add text first." });
      }
      
      const { canUseTTS } = await import("./tts/guards");
      const permission = await canUseTTS(req.user, card.universeId);
      if (!permission.allowed) {
        return res.status(403).json({ message: permission.reason || "TTS not allowed" });
      }
      
      const { isTTSConfigured, synthesiseSpeech, validateNarrationText } = await import("./tts");
      const { isObjectStorageConfigured, putObject, getNarrationKey } = await import("./storage/objectStore");
      
      if (!isTTSConfigured()) {
        return res.status(503).json({ message: "TTS not configured: OPENAI_API_KEY is missing" });
      }
      
      if (!isObjectStorageConfigured()) {
        return res.status(503).json({ message: "Object storage not configured: R2 credentials are missing" });
      }
      
      const validation = validateNarrationText(card.narrationText);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Set status to generating
      await storage.updateCard(cardId, { 
        narrationStatus: "generating",
        narrationError: null,
      });
      
      try {
        const result = await synthesiseSpeech({
          text: card.narrationText,
          voice: card.narrationVoice || "alloy",
          speed: card.narrationSpeed || 1.0,
        });
        
        const key = getNarrationKey(card.universeId, cardId);
        const audioUrl = await putObject(key, result.audioBuffer, result.contentType);
        
        // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
        const estimatedDuration = (card.narrationText.length / 5) / 150 * 60;
        
        const updatedCard = await storage.updateCard(cardId, {
          narrationAudioUrl: audioUrl,
          narrationStatus: "ready",
          narrationAudioDurationSec: estimatedDuration,
          narrationUpdatedAt: new Date(),
          narrationError: null,
        });
        
        // Log TTS usage
        await storage.logTtsUsage({
          userId: req.user!.id,
          universeId: card.universeId,
          cardId,
          charsCount: card.narrationText.length,
          voiceId: card.narrationVoice || "alloy",
        });
        
        res.json(updatedCard);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Generation failed";
        await storage.updateCard(cardId, {
          narrationStatus: "failed",
          narrationError: errorMessage,
        });
        throw err;
      }
    } catch (error) {
      console.error("Error generating narration:", error);
      res.status(500).json({ message: "Error generating narration audio" });
    }
  });
  
  // Delete narration audio
  app.delete("/api/cards/:id/narration", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const { canUseTTS } = await import("./tts/guards");
      const permission = await canUseTTS(req.user, card.universeId);
      if (!permission.allowed) {
        return res.status(403).json({ message: permission.reason || "TTS not allowed" });
      }
      
      // Delete from R2 if URL exists
      if (card.narrationAudioUrl) {
        try {
          const { deleteObject, extractKeyFromUrl } = await import("./storage/objectStore");
          const key = extractKeyFromUrl(card.narrationAudioUrl);
          if (key) {
            await deleteObject(key);
          }
        } catch (err) {
          console.error("Error deleting audio from R2:", err);
        }
      }
      
      const updatedCard = await storage.updateCard(cardId, {
        narrationAudioUrl: null,
        narrationStatus: "none",
        narrationAudioDurationSec: null,
        narrationUpdatedAt: null,
        narrationError: null,
      });
      
      res.json(updatedCard);
    } catch (error) {
      console.error("Error deleting narration:", error);
      res.status(500).json({ message: "Error deleting narration" });
    }
  });

  // ============ VIDEO GENERATION ROUTES ============
  
  // Check video providers configuration
  app.get("/api/video/config", async (req, res) => {
    try {
      const { isKlingConfigured, getKlingModels, isReplicateConfigured, getReplicateModels } = await import("./video");
      
      const models: any[] = [];
      const providers: string[] = [];
      
      if (isReplicateConfigured()) {
        providers.push("replicate");
        models.push(...getReplicateModels());
      }
      
      if (isKlingConfigured()) {
        providers.push("kling");
        models.push(...getKlingModels().map(m => ({ ...m, provider: "kling" })));
      }
      
      res.json({
        configured: providers.length > 0,
        providers,
        models,
      });
    } catch (error) {
      console.error("Error checking video config:", error);
      res.status(500).json({ message: "Error checking video configuration" });
    }
  });
  
  // Start video generation for a card
  app.post("/api/cards/:id/video/generate", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { mode, model, duration, aspectRatio, provider } = req.body;
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { 
        isKlingConfigured, startTextToVideoGeneration, startImageToVideoGeneration,
        isReplicateConfigured, generateVideoWithReplicate, getReplicateModels
      } = await import("./video");
      
      const useReplicate = provider === "replicate" || 
        (isReplicateConfigured() && getReplicateModels().some(m => m.id === model));
      
      if (!useReplicate && !isKlingConfigured()) {
        return res.status(503).json({ message: "No video generation provider configured" });
      }
      
      if (useReplicate && !isReplicateConfigured()) {
        return res.status(503).json({ message: "Replicate not configured: REPLICATE_API_TOKEN is missing" });
      }
      
      await storage.updateCard(cardId, {
        videoGenerationStatus: "pending",
        videoGenerationError: null,
        videoGenerationModel: model || "kling-v1.6-standard",
      });
      
      try {
        const prompt = card.sceneDescription || `${card.title}. ${card.sceneText}`;
        const imageUrl = (mode === "image-to-video" && card.generatedImageUrl) ? card.generatedImageUrl : undefined;
        
        if (useReplicate) {
          console.log(`[Video] Using Replicate provider with model: ${model}`);
          
          const result = await generateVideoWithReplicate({
            prompt,
            imageUrl,
            negativePrompt: "blurry, low quality, distorted, watermark, text overlay",
            aspectRatio: aspectRatio || "9:16",
            duration: duration || 5,
            model: model || "kling-v1.6-standard",
          });
          
          if (result.status === "completed" && result.videoUrl) {
            const updatedCard = await storage.updateCard(cardId, {
              generatedVideoUrl: result.videoUrl,
              videoGenerated: true,
              videoGenerationStatus: "completed",
              videoGenerationMode: imageUrl ? "image-to-video" : "text-to-video",
              videoGeneratedAt: new Date(),
            });
            
            return res.json({
              status: "completed",
              videoUrl: result.videoUrl,
              card: updatedCard,
            });
          } else {
            await storage.updateCard(cardId, {
              videoGenerationStatus: "failed",
              videoGenerationError: result.error || "Video generation failed",
            });
            return res.status(500).json({ message: result.error || "Video generation failed" });
          }
        } else {
          let taskId: string;
          if (imageUrl) {
            taskId = await startImageToVideoGeneration({
              imageUrl,
              prompt,
              negativePrompt: "blurry, low quality, distorted, watermark, text overlay",
              aspectRatio: aspectRatio || "9:16",
              duration: duration || 5,
              model: model || "kling-v1-6",
            });
          } else {
            taskId = await startTextToVideoGeneration({
              prompt,
              negativePrompt: "blurry, low quality, distorted, watermark, text overlay",
              aspectRatio: aspectRatio || "9:16",
              duration: duration || 5,
              model: model || "kling-v1-6",
            });
          }
          
          const actualMode = imageUrl ? "image-to-video" : "text-to-video";
          const updatedCard = await storage.updateCard(cardId, {
            videoGenerationTaskId: taskId,
            videoGenerationMode: actualMode,
            videoGenerationStatus: "processing",
          });
          
          res.json({ taskId, card: updatedCard });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to start video generation";
        await storage.updateCard(cardId, {
          videoGenerationStatus: "failed",
          videoGenerationError: errorMessage,
        });
        throw err;
      }
    } catch (error: any) {
      console.error("Error starting video generation:", error);
      res.status(500).json({ message: error.message || "Error starting video generation" });
    }
  });
  
  // Check video generation status
  app.get("/api/cards/:id/video/status", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      if (!card.videoGenerationTaskId) {
        return res.json({
          status: card.videoGenerationStatus || "none",
          videoUrl: card.generatedVideoUrl,
          thumbnailUrl: card.videoThumbnailUrl,
        });
      }
      
      const { checkVideoStatus } = await import("./video");
      const mode = (card.videoGenerationMode as "text-to-video" | "image-to-video") || "text-to-video";
      const result = await checkVideoStatus(card.videoGenerationTaskId, mode);
      
      // Update card if status changed
      if (result.status === "completed" && !card.videoGenerated) {
        await storage.updateCard(cardId, {
          videoGenerationStatus: "completed",
          generatedVideoUrl: result.videoUrl,
          videoThumbnailUrl: result.thumbnailUrl,
          videoDurationSec: result.duration,
          videoGenerated: true,
          videoGeneratedAt: new Date(),
          videoGenerationError: null,
        });
      } else if (result.status === "failed" && card.videoGenerationStatus !== "failed") {
        await storage.updateCard(cardId, {
          videoGenerationStatus: "failed",
          videoGenerationError: result.error || "Video generation failed",
        });
      }
      
      res.json({
        status: result.status,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        duration: result.duration,
        error: result.error,
      });
    } catch (error) {
      console.error("Error checking video status:", error);
      res.status(500).json({ message: "Error checking video status" });
    }
  });
  
  // Delete generated video
  app.delete("/api/cards/:id/video", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const updatedCard = await storage.updateCard(cardId, {
        generatedVideoUrl: null,
        videoGenerated: false,
        videoGenerationTaskId: null,
        videoGenerationStatus: "none",
        videoGenerationError: null,
        videoThumbnailUrl: null,
        videoDurationSec: null,
        videoGeneratedAt: null,
      });
      
      res.json(updatedCard);
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Error deleting video" });
    }
  });

  // ============ CARD MEDIA UPLOADS ============
  
  // Get user storage usage and quota
  app.get("/api/storage/usage", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const usage = await storage.getOrCreateUserStorageUsage(userId);
      const entitlements = await storage.getEntitlements(userId);
      
      res.json({
        bytesUsed: usage.totalBytesUsed,
        quotaBytes: entitlements?.storageQuotaBytes || 0,
        canUploadMedia: entitlements?.canUploadMedia || false,
        imageCount: usage.imageCount,
        videoCount: usage.videoCount,
      });
    } catch (error) {
      console.error("Error getting storage usage:", error);
      res.status(500).json({ message: "Error getting storage usage" });
    }
  });
  
  // Request presigned upload URL (with tier/quota validation)
  app.post("/api/cards/:cardId/media/request-upload", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const userId = req.user!.id;
      const { name, size, contentType, mediaType } = req.body;
      
      // Validate card exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check admin access
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Check tier allows uploads
      const entitlements = await storage.getEntitlements(userId);
      if (!entitlements?.canUploadMedia) {
        return res.status(403).json({ 
          message: "Media uploads require a Pro or Business subscription",
          code: "UPGRADE_REQUIRED",
        });
      }
      
      // Validate media type
      const type = mediaType as 'image' | 'video';
      if (!['image', 'video'].includes(type)) {
        return res.status(400).json({ message: "Invalid media type" });
      }
      
      // Check file size limits
      const { MEDIA_SIZE_LIMITS, ALLOWED_MEDIA_TYPES } = await import("@shared/schema");
      if (size > MEDIA_SIZE_LIMITS[type]) {
        const limitMB = MEDIA_SIZE_LIMITS[type] / (1024 * 1024);
        return res.status(400).json({ 
          message: `File too large. Maximum ${type} size is ${limitMB} MB`,
          code: "FILE_TOO_LARGE",
        });
      }
      
      // Validate MIME type
      if (!ALLOWED_MEDIA_TYPES[type].includes(contentType)) {
        return res.status(400).json({ 
          message: `Invalid file type. Allowed: ${ALLOWED_MEDIA_TYPES[type].join(', ')}`,
          code: "INVALID_FILE_TYPE",
        });
      }
      
      // Check quota
      const usage = await storage.getOrCreateUserStorageUsage(userId);
      const quotaBytes = entitlements.storageQuotaBytes || 0;
      if (usage.totalBytesUsed + size > quotaBytes) {
        const usedGB = (usage.totalBytesUsed / (1024 * 1024 * 1024)).toFixed(2);
        const quotaGB = (quotaBytes / (1024 * 1024 * 1024)).toFixed(2);
        return res.status(403).json({ 
          message: `Storage quota exceeded. Used ${usedGB} GB of ${quotaGB} GB`,
          code: "QUOTA_EXCEEDED",
        });
      }
      
      // Get presigned upload URL
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      
      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType, mediaType },
      });
    } catch (error) {
      console.error("Error requesting upload URL:", error);
      res.status(500).json({ message: "Error generating upload URL" });
    }
  });
  
  // Complete upload - record in database
  app.post("/api/cards/:cardId/media/complete", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const userId = req.user!.id;
      const { objectPath, name, size, contentType, mediaType, width, height, duration } = req.body;
      
      // Validate card exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check admin access
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Create media asset record
      const asset = await storage.createCardMediaAsset({
        cardId,
        userId,
        mediaType: mediaType as 'image' | 'video',
        storageKey: objectPath,
        originalFilename: name,
        mimeType: contentType,
        sizeBytes: size,
        width,
        height,
        duration,
        isActive: true,
      });
      
      // Update storage usage
      const deltaImages = mediaType === 'image' ? 1 : 0;
      const deltaVideos = mediaType === 'video' ? 1 : 0;
      await storage.updateStorageUsage(userId, size, deltaImages, deltaVideos);
      
      res.json(asset);
    } catch (error) {
      console.error("Error completing upload:", error);
      res.status(500).json({ message: "Error recording upload" });
    }
  });
  
  // Get media assets for a card
  app.get("/api/cards/:cardId/media", requireAuth, async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const assets = await storage.getCardMediaAssets(cardId);
      res.json(assets);
    } catch (error) {
      console.error("Error getting card media:", error);
      res.status(500).json({ message: "Error getting card media" });
    }
  });
  
  // Delete media asset
  app.delete("/api/cards/:cardId/media/:assetId", requireAuth, async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const userId = req.user!.id;
      
      // Check admin access
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Get asset
      const asset = await storage.getCardMediaAsset(assetId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Soft delete asset
      await storage.softDeleteCardMediaAsset(assetId);
      
      // Update storage usage (reclaim space)
      const deltaImages = asset.mediaType === 'image' ? -1 : 0;
      const deltaVideos = asset.mediaType === 'video' ? -1 : 0;
      await storage.updateStorageUsage(asset.userId, -asset.sizeBytes, deltaImages, deltaVideos);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting media:", error);
      res.status(500).json({ message: "Error deleting media" });
    }
  });
  
  // Serve uploaded objects from storage
  const objectStorageService = new ObjectStorageService();
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      res.setHeader("Content-Type", objectFile.contentType || "application/octet-stream");
      res.send(Buffer.from(objectFile.content));
    } catch (error) {
      console.error("Error fetching object:", error);
      res.status(404).json({ message: "Object not found" });
    }
  });

  // ============ PREVIEW INSTANCES (Micro Smart Site) ============
  const { validateUrlSafety: validatePreviewUrl, ingestSitePreview, generatePreviewId, calculateExpiresAt } = await import("./previewHelpers");

  // Create a preview instance
  app.post("/api/previews", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      // Get user ID and IP for rate limiting
      const userId = req.user?.id;
      const userIp = req.ip || req.socket.remoteAddress || "unknown";

      // Rate limiting: check daily caps (increased for testing)
      if (userId) {
        const userCount = await storage.countUserPreviewsToday(userId);
        if (userCount >= 20) {
          return res.status(429).json({ message: "Daily limit reached (20 previews per day)" });
        }
      } else {
        const ipCount = await storage.countIpPreviewsToday(userIp);
        if (ipCount >= 20) {
          return res.status(429).json({ message: "Daily limit reached (20 previews per IP per day)" });
        }
      }

      // Validate URL (SSRF protection)
      const validation = await validatePreviewUrl(url.trim());
      if (!validation.safe) {
        return res.status(400).json({ message: validation.error });
      }

      // Ingest site (lightweight, max 4 pages, 80k chars)
      let siteData;
      try {
        siteData = await ingestSitePreview(url.trim());
      } catch (err: any) {
        return res.status(400).json({ message: `Could not access website: ${err.message}` });
      }

      // Create preview instance with site identity
      const preview = await storage.createPreviewInstance({
        id: generatePreviewId(),
        ownerUserId: userId || null,
        ownerIp: userId ? null : userIp,
        sourceUrl: url.trim(),
        sourceDomain: validation.domain!,
        siteTitle: siteData.title,
        siteSummary: siteData.summary,
        keyServices: siteData.keyServices,
        contactInfo: null,
        siteIdentity: siteData.siteIdentity,
        expiresAt: calculateExpiresAt(),
        ingestedPagesCount: siteData.pagesIngested,
        totalCharsIngested: siteData.totalChars,
        status: "active",
      });

      res.json({
        previewId: preview.id,
        expiresAt: preview.expiresAt,
        status: preview.status,
        siteTitle: preview.siteTitle,
        siteIdentity: preview.siteIdentity,
      });
    } catch (error) {
      console.error("Error creating preview:", error);
      res.status(500).json({ message: "Error creating preview" });
    }
  });

  // Get preview metadata
  app.get("/api/previews/:id", async (req, res) => {
    try {
      const preview = await storage.getPreviewInstance(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      // Check if expired
      if (preview.status === "active" && new Date() > new Date(preview.expiresAt)) {
        await storage.archivePreviewInstance(preview.id);
        preview.status = "archived";
      }

      res.json({
        id: preview.id,
        status: preview.status,
        sourceUrl: preview.sourceUrl,
        sourceDomain: preview.sourceDomain,
        siteTitle: preview.siteTitle,
        siteSummary: preview.siteSummary,
        keyServices: preview.keyServices,
        siteIdentity: preview.siteIdentity,
        messageCount: preview.messageCount,
        maxMessages: preview.maxMessages,
        expiresAt: preview.expiresAt,
        createdAt: preview.createdAt,
      });
    } catch (error) {
      console.error("Error getting preview:", error);
      res.status(500).json({ message: "Error getting preview" });
    }
  });

  // Get orbit slug from preview ID (for redirect)
  app.get("/api/previews/:id/orbit-slug", async (req, res) => {
    try {
      const orbit = await storage.getOrbitMetaByPreviewId(req.params.id);
      if (!orbit) {
        return res.status(404).json({ message: "No orbit found for this preview" });
      }
      res.json({ businessSlug: orbit.businessSlug });
    } catch (error) {
      console.error("Error getting orbit slug:", error);
      res.status(500).json({ message: "Error getting orbit slug" });
    }
  });

  // Chat with preview
  app.post("/api/previews/:id/chat", async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      const preview = await storage.getPreviewInstance(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      // Check if expired
      if (new Date() > new Date(preview.expiresAt)) {
        await storage.archivePreviewInstance(preview.id);
        return res.json({
          capped: true,
          reason: "expired",
          message: "This preview has expired. Claim it to keep chatting.",
        });
      }

      // Check status
      if (preview.status !== "active") {
        return res.json({
          capped: true,
          reason: preview.status,
          message: `This preview is ${preview.status}.`,
        });
      }

      // Check message cap
      if (preview.messageCount >= preview.maxMessages) {
        return res.json({
          capped: true,
          reason: "message_limit",
          message: "You've reached the message limit for this preview. Claim it to continue.",
          messageCount: preview.messageCount,
        });
      }

      // Get conversation history (last 10 messages for context)
      const history = await storage.getPreviewChatMessages(preview.id, 10);

      // Save user message
      await storage.addPreviewChatMessage({
        previewId: preview.id,
        role: "user",
        content: message,
      });

      // Call LLM with site context
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are a helpful AI assistant representing ${preview.siteTitle}.

Site Summary:
${preview.siteSummary}

${preview.keyServices && preview.keyServices.length > 0 ? `Key Services/Products:
${preview.keyServices.map((s: string) => `- ${s}`).join('\n')}` : ''}

Your role:
- Answer questions about the business, its services, and offerings
- Be helpful, professional, and conversational
- Qualify leads by understanding their needs
- If asked about something not in the summary, politely say you don't have that specific information but would be happy to connect them with the team

Keep responses concise (2-3 sentences maximum).`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m: any) => ({ role: m.role as any, content: m.content })),
        { role: "user" as const, content: message },
      ];

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 200,
        temperature: 0.7,
      });

      const reply = aiResponse.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      // Save assistant message
      await storage.addPreviewChatMessage({
        previewId: preview.id,
        role: "assistant",
        content: reply,
      });

      // Increment message count
      await storage.incrementPreviewMessageCount(preview.id);

      // Update cost estimate (rough: ~0.01p per message for mini model)
      const newMessageCount = preview.messageCount + 1;
      await storage.updatePreviewInstance(preview.id, {
        costEstimatePence: preview.costEstimatePence + 1,
        llmCallCount: preview.llmCallCount + 1,
      });

      res.json({
        reply,
        messageCount: newMessageCount,
        capped: newMessageCount >= preview.maxMessages,
      });
    } catch (error) {
      console.error("Error in preview chat:", error);
      res.status(500).json({ message: "Error processing chat" });
    }
  });

  // Archive preview
  app.post("/api/previews/:id/archive", async (req, res) => {
    try {
      const preview = await storage.getPreviewInstance(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      await storage.archivePreviewInstance(preview.id);
      res.json({ success: true, message: "Preview archived" });
    } catch (error) {
      console.error("Error archiving preview:", error);
      res.status(500).json({ message: "Error archiving preview" });
    }
  });

  // Claim preview (start checkout)
  app.post("/api/previews/:id/claim", requireAuth, async (req, res) => {
    try {
      const preview = await storage.getPreviewInstance(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      if (preview.status === "claimed") {
        return res.status(400).json({ message: "Preview already claimed" });
      }

      // Get Business plan
      const plan = await storage.getPlanByName("Business");
      if (!plan) {
        return res.status(500).json({ message: "Business plan not found" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      // Create or get customer
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

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: plan.stripePriceId!,
            quantity: 1,
          },
        ],
        success_url: `${req.protocol}://${req.get("host")}/preview/${preview.id}?claimed=true`,
        cancel_url: `${req.protocol}://${req.get("host")}/preview/${preview.id}`,
        metadata: {
          userId: String(req.user!.id),
          previewId: preview.id,
          planId: String(plan.id),
        },
      });

      // Update preview with checkout session ID
      await storage.updatePreviewInstance(preview.id, {
        stripeCheckoutSessionId: session.id,
      });

      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Error claiming preview:", error);
      res.status(500).json({ message: "Error creating checkout session" });
    }
  });

  // ============ ORBIT ROUTES ============
  
  // Generate Orbit from URL - creates/reuses preview and links to orbit
  app.post("/api/orbit/generate", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      const { generateSlug } = await import("./orbitPackGenerator");
      const businessSlug = generateSlug(url);

      // Check if orbit already exists with a preview
      let orbitMeta = await storage.getOrbitMeta(businessSlug);
      
      if (orbitMeta?.previewId && orbitMeta.generationStatus === "ready") {
        // Return existing orbit with preview
        const preview = await storage.getPreviewInstance(orbitMeta.previewId);
        if (preview) {
          return res.json({
            success: true,
            businessSlug,
            previewId: orbitMeta.previewId,
            status: "ready",
            brandName: preview.siteIdentity?.validatedContent?.brandName || preview.siteTitle,
          });
        }
      }

      // Create or update orbit meta
      if (!orbitMeta) {
        orbitMeta = await storage.createOrbitMeta({
          businessSlug,
          sourceUrl: url.trim(),
          generationStatus: "generating",
          requestedAt: new Date(),
        });
      } else {
        await storage.setOrbitGenerationStatus(businessSlug, "generating");
      }

      // Import preview helpers
      const { validateUrlSafety, ingestSitePreview: ingestSite, generatePreviewId: genPreviewId } = await import("./previewHelpers");

      // Validate URL (SSRF protection)
      const validation = await validateUrlSafety(url.trim());
      if (!validation.safe) {
        await storage.setOrbitGenerationStatus(businessSlug, "failed", validation.error);
        return res.status(400).json({ message: validation.error || "Invalid URL" });
      }

      // Ingest site using existing preview pipeline
      let siteData;
      try {
        siteData = await ingestSite(url.trim());
      } catch (err: any) {
        await storage.setOrbitGenerationStatus(businessSlug, "failed", err.message);
        return res.status(400).json({ message: `Could not access website: ${err.message}` });
      }

      // Create preview instance using existing system
      const preview = await storage.createPreviewInstance({
        id: genPreviewId(),
        ownerUserId: null,
        ownerIp: null,
        sourceUrl: url.trim(),
        sourceDomain: validation.domain!,
        siteTitle: siteData.title,
        siteSummary: siteData.summary,
        keyServices: siteData.keyServices,
        contactInfo: null,
        siteIdentity: siteData.siteIdentity,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for orbits
        ingestedPagesCount: siteData.pagesIngested,
        totalCharsIngested: siteData.totalChars,
        status: "active",
      });

      // Link preview to orbit
      await storage.setOrbitPreviewId(businessSlug, preview.id);
      await storage.setOrbitGenerationStatus(businessSlug, "ready");

      res.json({
        success: true,
        businessSlug,
        previewId: preview.id,
        status: "ready",
        brandName: siteData.siteIdentity?.validatedContent?.brandName || siteData.title,
        pagesIngested: siteData.pagesIngested,
        totalChars: siteData.totalChars,
      });
    } catch (error) {
      console.error("Error generating orbit:", error);
      res.status(500).json({ message: "Error generating orbit" });
    }
  });

  // Get Orbit metadata and status
  app.get("/api/orbit/:slug/status", async (req, res) => {
    try {
      const orbitMeta = await storage.getOrbitMeta(req.params.slug);
      
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      res.json({
        businessSlug: orbitMeta.businessSlug,
        sourceUrl: orbitMeta.sourceUrl,
        generationStatus: orbitMeta.generationStatus,
        currentPackVersion: orbitMeta.currentPackVersion,
        lastUpdated: orbitMeta.lastUpdated,
        lastError: orbitMeta.lastError,
        ownerId: orbitMeta.ownerId,
        totalPackVersions: orbitMeta.totalPackVersions,
      });
    } catch (error) {
      console.error("Error getting orbit status:", error);
      res.status(500).json({ message: "Error getting orbit status" });
    }
  });

  // Get Orbit - returns previewId for rich experience
  app.get("/api/orbit/:slug", async (req, res) => {
    try {
      const orbitMeta = await storage.getOrbitMeta(req.params.slug);
      
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      if (orbitMeta.generationStatus === "generating") {
        return res.json({
          status: "generating",
          businessSlug: orbitMeta.businessSlug,
          requestedAt: orbitMeta.requestedAt,
        });
      }

      if (orbitMeta.generationStatus === "failed") {
        return res.json({
          status: "failed",
          businessSlug: orbitMeta.businessSlug,
          error: orbitMeta.lastError,
        });
      }

      // Return previewId for rich experience (new approach)
      if (orbitMeta.previewId) {
        return res.json({
          status: "ready",
          businessSlug: orbitMeta.businessSlug,
          ownerId: orbitMeta.ownerId,
          lastUpdated: orbitMeta.lastUpdated,
          previewId: orbitMeta.previewId,
        });
      }

      // Legacy fallback: load pack from object storage
      if (orbitMeta.currentPackKey) {
        const { fetchOrbitPackByKey } = await import("./orbitStorage");
        const packResult = await fetchOrbitPackByKey(orbitMeta.currentPackKey);

        if (packResult.success && packResult.pack) {
          return res.json({
            status: "ready",
            businessSlug: orbitMeta.businessSlug,
            ownerId: orbitMeta.ownerId,
            lastUpdated: orbitMeta.lastUpdated,
            pack: packResult.pack,
          });
        }
      }

      return res.status(404).json({ message: "No experience available" });
    } catch (error) {
      console.error("Error fetching orbit:", error);
      res.status(500).json({ message: "Error fetching orbit" });
    }
  });

  // List pack versions for an orbit
  app.get("/api/orbit/:slug/versions", async (req, res) => {
    try {
      const orbitMeta = await storage.getOrbitMeta(req.params.slug);
      
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      const { listOrbitPackVersions } = await import("./orbitStorage");
      const result = await listOrbitPackVersions(req.params.slug);

      res.json({
        businessSlug: orbitMeta.businessSlug,
        currentVersion: orbitMeta.currentPackVersion,
        versions: result.versions,
      });
    } catch (error) {
      console.error("Error listing orbit versions:", error);
      res.status(500).json({ message: "Error listing orbit versions" });
    }
  });

  // Request claim - sends magic link email
  app.post("/api/orbit/:slug/claim/request", async (req, res) => {
    try {
      const { email } = req.body;
      const slug = req.params.slug;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      if (orbitMeta.ownerId || orbitMeta.verifiedAt) {
        return res.status(400).json({ message: "This orbit has already been claimed" });
      }

      // Extract domain from source URL and email
      const sourceUrl = new URL(orbitMeta.sourceUrl);
      const sourceDomain = sourceUrl.hostname.replace(/^www\./, '');
      const emailDomain = email.split('@')[1]?.toLowerCase();
      const domainMatch = emailDomain === sourceDomain;

      // Generate secure token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Create claim token (expires in 24 hours)
      await storage.createClaimToken({
        businessSlug: slug,
        email: email.toLowerCase(),
        token,
        domainMatch,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // For MVP, we'll log the magic link (in production, send email)
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const magicLink = `${baseUrl}/orbit/${slug}/claim?token=${token}`;
      
      console.log(`[Claim] Magic link for ${email}: ${magicLink}`);

      res.json({
        success: true,
        domainMatch,
        message: domainMatch 
          ? "Verification email sent! Check your inbox."
          : "Your email domain doesn't match the business. Verification email sent, but additional review may be required.",
      });
    } catch (error) {
      console.error("Error requesting claim:", error);
      res.status(500).json({ message: "Error processing claim request" });
    }
  });

  // Verify claim token and claim orbit
  app.post("/api/orbit/:slug/claim/verify", async (req, res) => {
    try {
      const { token } = req.body;
      const slug = req.params.slug;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const claimToken = await storage.getClaimToken(token);
      if (!claimToken) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      if (claimToken.businessSlug !== slug) {
        return res.status(400).json({ message: "Token does not match this orbit" });
      }

      if (claimToken.usedAt) {
        return res.status(400).json({ message: "Token has already been used" });
      }

      if (new Date() > new Date(claimToken.expiresAt)) {
        return res.status(400).json({ message: "Token has expired" });
      }

      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      if (orbitMeta.ownerId || orbitMeta.verifiedAt) {
        return res.status(400).json({ message: "This orbit has already been claimed" });
      }

      // Mark token as used
      await storage.markClaimTokenUsed(token);

      // Get or create user by email (for MVP, just store email without creating user)
      const user = await storage.getUserByEmail(claimToken.email);
      
      // Claim the orbit
      await storage.claimOrbit(slug, claimToken.email, user?.id);

      res.json({
        success: true,
        message: "Orbit claimed successfully!",
        domainMatch: claimToken.domainMatch,
      });
    } catch (error) {
      console.error("Error verifying claim:", error);
      res.status(500).json({ message: "Error verifying claim" });
    }
  });

  // Orbit Analytics - Track metrics
  app.post("/api/orbit/:slug/track", async (req, res) => {
    try {
      const { slug } = req.params;
      const { metric } = req.body;
      
      if (!['visits', 'interactions', 'conversations', 'iceViews'].includes(metric)) {
        return res.status(400).json({ message: "Invalid metric" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      await storage.incrementOrbitMetric(slug, metric);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking orbit metric:", error);
      res.status(500).json({ message: "Error tracking metric" });
    }
  });

  // Orbit Data Hub - Get analytics summary (owner only for full data, public for counts)
  app.get("/api/orbit/:slug/hub", async (req, res) => {
    try {
      const { slug } = req.params;
      const { days = '30', preview = '' } = req.query;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const daysNum = Math.min(parseInt(days as string) || 30, 90);
      const summary = await storage.getOrbitAnalyticsSummary(slug, daysNum);
      const dailyData = await storage.getOrbitAnalytics(slug, daysNum);
      
      // Check if user is owner (for paid features) - preview mode bypasses auth for testing
      const isPreviewMode = preview === 'true';
      const isOwner = isPreviewMode || (req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id);
      const isPaid = false; // TODO: Check subscription tier
      
      res.json({
        businessSlug: slug,
        isClaimed: !!orbitMeta.verifiedAt,
        isOwner,
        isPaid,
        days: daysNum,
        
        // Free tier - activity counts (always visible)
        activity: {
          visits: summary.visits,
          interactions: summary.interactions,
          conversations: summary.conversations,
          iceViews: summary.iceViews,
        },
        
        // Daily breakdown (free tier)
        daily: dailyData.map(d => ({
          date: d.date,
          visits: d.visits,
          interactions: d.interactions,
          conversations: d.conversations,
          iceViews: d.iceViews,
        })),
        
        // Paid tier - understanding (locked for free)
        insights: isPaid ? {
          uniqueVisitors: dailyData.reduce((sum, d) => sum + d.uniqueVisitors, 0),
          avgSessionDuration: Math.round(dailyData.reduce((sum, d) => sum + d.avgSessionDuration, 0) / Math.max(dailyData.length, 1)),
          topQuestions: dailyData.flatMap(d => d.topQuestions || []).slice(0, 10),
          topTopics: dailyData.flatMap(d => d.topTopics || []).slice(0, 10),
        } : null,
      });
    } catch (error) {
      console.error("Error getting orbit hub data:", error);
      res.status(500).json({ message: "Error getting hub data" });
    }
  });

  // Orbit Leads - Submit a lead
  app.post("/api/orbit/:slug/leads", async (req, res) => {
    try {
      const { slug } = req.params;
      const { name, email, phone, company, message, source = 'orbit' } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const lead = await storage.createOrbitLead({
        businessSlug: slug,
        name,
        email,
        phone: phone || null,
        company: company || null,
        message: message || null,
        source,
      });
      
      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error("Error creating orbit lead:", error);
      res.status(500).json({ message: "Error creating lead" });
    }
  });

  // Orbit Leads - Get leads (owner only)
  app.get("/api/orbit/:slug/leads", async (req, res) => {
    try {
      const { slug } = req.params;
      const { preview = '' } = req.query;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isPreviewMode = preview === 'true';
      const isOwner = isPreviewMode || (req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id);
      
      // Always return lead count (free tier)
      const count = await storage.getOrbitLeadsCount(slug);
      
      // Full lead details only for owners (paid feature in future)
      const leads = isOwner ? await storage.getOrbitLeads(slug) : [];
      
      res.json({
        count,
        leads: isOwner ? leads : null,
        isOwner,
      });
    } catch (error) {
      console.error("Error getting orbit leads:", error);
      res.status(500).json({ message: "Error getting leads" });
    }
  });

  // Health check endpoint for debugging
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: process.env.GIT_COMMIT_HASH || 'unknown',
      nodeEnv: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });

  // Start background jobs
  startArchiveExpiredPreviewsJob(storage);

  return httpServer;
}
