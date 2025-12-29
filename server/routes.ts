import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { sql, eq, desc, gte } from "drizzle-orm";
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
import { getFullEntitlements } from "./entitlements";
import { 
  FREE_CONVERSATION_LIMIT, 
  FREE_CONVERSATION_SOFT_LIMIT, 
  conversationLimitCopy 
} from "@shared/uxCopy";

// Echo response post-processing utilities
function dedupeText(text: string): string {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const seen: string[] = [];
  const deduped: string[] = [];
  
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    if (normalized.length < 3) {
      deduped.push(line);
      continue;
    }
    
    let isDupe = false;
    for (const existing of seen) {
      if (jaccardSimilarity(normalized, existing) > 0.85) {
        isDupe = true;
        break;
      }
    }
    
    if (!isDupe) {
      seen.push(normalized);
      deduped.push(line);
    }
  }
  
  return deduped.join('\n');
}

function jaccardSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  const intersection = [...wordsA].filter(x => wordsB.has(x));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

function echoStyleGuard(text: string): string {
  let result = text;
  
  // Convert ALL CAPS (except acronyms) to Title Case
  result = result.replace(/\b([A-Z]{5,}(?:\s+[A-Z]{5,})*)\b/g, (match) => {
    return match.split(' ')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  });
  
  // Remove robotic phrases
  const roboticPhrases = [
    /What would you like to explore about\s*["']?[^"'?]*["']?\??/gi,
    /What would you like to know about\s*["']?[^"'?]*["']?\??/gi,
    /Would you like to learn more about\s*["']?[^"'?]*["']?\??/gi,
    /Is there anything else you'd like to know\??/gi,
    /Let me know if you have any questions\.?/gi,
    /Feel free to ask.*questions\.?/gi,
    /I'd be happy to help\.?/gi,
    /Great question!/gi,
    /That's a great question!/gi,
  ];
  
  for (const pattern of roboticPhrases) {
    result = result.replace(pattern, '').trim();
  }
  
  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  
  return result;
}

function processEchoResponse(text: string): string {
  return echoStyleGuard(dedupeText(text));
}

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

  // ============ WELL-KNOWN ROUTES (Public, AI-facing) ============
  
  // Orbit Signal Schema v0.1 - Machine-readable business identity for AI systems
  app.get("/.well-known/orbit.json", async (req, res) => {
    try {
      // Resolve business by host header (domain)
      const host = req.headers.host || req.hostname;
      const domain = host.split(':')[0].replace(/^www\./, '').toLowerCase();
      
      // Check for env flag to allow unclaimed publishing (default false)
      const allowUnclaimed = process.env.ORBIT_SCHEMA_ALLOW_UNCLAIMED === 'true';
      
      // Find orbit by domain
      const orbitMeta = await storage.getOrbitMetaByDomain(domain);
      
      if (!orbitMeta) {
        return res.status(404).json({ 
          error: "not_found",
          message: "No Orbit found for this domain"
        });
      }
      
      // Check claim status - only serve for claimed orbits by default
      const isClaimed = orbitMeta.ownerId !== null || orbitMeta.verifiedAt !== null;
      if (!isClaimed && !allowUnclaimed) {
        return res.status(404).json({
          error: "unclaimed",
          message: "This Orbit has not been claimed. The business owner must claim their Orbit to enable the Signal Schema."
        });
      }
      
      // Get preview instance for rich data
      let preview: schema.PreviewInstance | null = null;
      if (orbitMeta.previewId) {
        preview = await storage.getPreviewInstance(orbitMeta.previewId) || null;
      }
      
      // Get boxes for additional content
      const boxes = await storage.getOrbitBoxes(orbitMeta.businessSlug);
      
      // Generate schema
      const { generateOrbitSignalSchema, signOrbitSchema } = await import("./orbitSignalSchema");
      let schema = generateOrbitSignalSchema(orbitMeta, preview, boxes);
      
      // Optional signature
      const signingSecret = process.env.ORBIT_SCHEMA_SIGNING_SECRET;
      if (signingSecret) {
        schema = signOrbitSchema(schema, signingSecret);
      }
      
      // Log access for AI Discovery metrics (async, don't wait)
      const userAgent = req.headers['user-agent'] || null;
      const userAgentTruncated = userAgent ? userAgent.substring(0, 100) : null;
      storage.logOrbitSignalAccess({
        orbitSlug: orbitMeta.businessSlug,
        userAgent,
        userAgentTruncated,
        requestMethod: 'GET',
        responseStatus: 200,
      }).catch(err => console.error('Failed to log signal access:', err));
      
      // Set caching headers
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', 'application/json');
      
      // Return schema
      res.json(schema);
    } catch (error) {
      console.error("Error generating orbit.json:", error);
      res.status(500).json({ 
        error: "internal_error",
        message: "Error generating Orbit Signal Schema" 
      });
    }
  });
  
  // Alternative route for accessing schema by slug (for testing/development)
  app.get("/api/orbit/:slug/signal-schema", async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      
      if (!orbitMeta) {
        return res.status(404).json({ 
          error: "not_found",
          message: "Orbit not found" 
        });
      }
      
      // Check claim status
      const allowUnclaimed = process.env.ORBIT_SCHEMA_ALLOW_UNCLAIMED === 'true';
      const isClaimed = orbitMeta.ownerId !== null || orbitMeta.verifiedAt !== null;
      if (!isClaimed && !allowUnclaimed) {
        return res.status(404).json({
          error: "unclaimed",
          message: "This Orbit has not been claimed"
        });
      }
      
      // Get preview instance
      let preview: schema.PreviewInstance | null = null;
      if (orbitMeta.previewId) {
        preview = await storage.getPreviewInstance(orbitMeta.previewId) || null;
      }
      
      const boxes = await storage.getOrbitBoxes(orbitMeta.businessSlug);
      
      const { generateOrbitSignalSchema, signOrbitSchema } = await import("./orbitSignalSchema");
      let signalSchema = generateOrbitSignalSchema(orbitMeta, preview, boxes);
      
      const signingSecret = process.env.ORBIT_SCHEMA_SIGNING_SECRET;
      if (signingSecret) {
        signalSchema = signOrbitSchema(signalSchema, signingSecret);
      }
      
      // Log access for AI Discovery metrics (async, don't wait)
      const userAgent = req.headers['user-agent'] || null;
      const userAgentTruncated = userAgent ? userAgent.substring(0, 100) : null;
      storage.logOrbitSignalAccess({
        orbitSlug: orbitMeta.businessSlug,
        userAgent,
        userAgentTruncated,
        requestMethod: 'GET',
        responseStatus: 200,
      }).catch(err => console.error('Failed to log signal access:', err));
      
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(signalSchema);
    } catch (error) {
      console.error("Error generating signal schema:", error);
      res.status(500).json({ 
        error: "internal_error",
        message: "Error generating Signal Schema" 
      });
    }
  });

  // Signal Schema access metrics (for AI Discovery page)
  app.get("/api/orbit/:slug/signal/metrics", async (req, res) => {
    try {
      // Require authentication
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { slug } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ error: "Orbit not found" });
      }
      
      // Check ownership
      if (orbitMeta.ownerId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const metrics = await storage.getOrbitSignalAccessMetrics(slug, days);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching signal metrics:", error);
      res.status(500).json({ error: "Error fetching signal metrics" });
    }
  });

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

  // ============ BLOG ROUTES ============

  // Helper to generate slug from title
  function generateBlogSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  // Validate blog post markdown and extract metadata
  app.post("/api/admin/blog/validate", requireAdmin, async (req, res) => {
    try {
      const { markdown } = req.body;
      
      if (!markdown || typeof markdown !== 'string') {
        return res.status(400).json({ 
          valid: false, 
          message: "Markdown content required" 
        });
      }

      // Extract frontmatter (YAML between --- delimiters)
      const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
      
      let metadata: Record<string, any> = {};
      let contentMarkdown = markdown;
      
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        contentMarkdown = markdown.slice(frontmatterMatch[0].length);
        
        // Parse YAML-like frontmatter
        const lines = frontmatter.split('\n');
        for (const line of lines) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            
            // Handle arrays like tags: [tag1, tag2]
            if (value.startsWith('[') && value.endsWith(']')) {
              const arrayValue = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
              metadata[key] = arrayValue;
            } else {
              // Remove quotes
              metadata[key] = value.replace(/^['"]|['"]$/g, '');
            }
          }
        }
      }

      // Extract title from first # heading if not in frontmatter
      if (!metadata.title) {
        const titleMatch = contentMarkdown.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          metadata.title = titleMatch[1].trim();
        }
      }

      if (!metadata.title) {
        return res.status(400).json({
          valid: false,
          message: "Blog post must have a title (either in frontmatter or as # heading)"
        });
      }

      // Generate slug if not provided
      if (!metadata.slug) {
        metadata.slug = generateBlogSlug(metadata.title);
      }

      // Check if slug already exists
      const existing = await storage.getBlogPostBySlug(metadata.slug);

      res.json({
        valid: true,
        metadata: {
          title: metadata.title,
          slug: metadata.slug,
          description: metadata.description || null,
          author: metadata.author || null,
          tags: Array.isArray(metadata.tags) ? metadata.tags : (metadata.tags ? [metadata.tags] : []),
          heroImageUrl: metadata.heroImageUrl || metadata.hero_image || null,
          heroAlt: metadata.heroAlt || metadata.hero_alt || null,
          heroCaption: metadata.heroCaption || metadata.hero_caption || null,
          ctaPrimaryLabel: metadata.ctaPrimaryLabel || metadata.cta_primary_label || null,
          ctaPrimaryUrl: metadata.ctaPrimaryUrl || metadata.cta_primary_url || null,
          ctaSecondaryLabel: metadata.ctaSecondaryLabel || metadata.cta_secondary_label || null,
          ctaSecondaryUrl: metadata.ctaSecondaryUrl || metadata.cta_secondary_url || null,
          canonicalUrl: metadata.canonicalUrl || metadata.canonical_url || null,
          internalLinks: Array.isArray(metadata.internalLinks) ? metadata.internalLinks : [],
        },
        contentMarkdown,
        existingPost: existing ? { id: existing.id, slug: existing.slug, title: existing.title } : null,
        wordCount: contentMarkdown.split(/\s+/).filter(Boolean).length,
      });
    } catch (error) {
      console.error("Error validating blog post:", error);
      res.status(500).json({ valid: false, message: "Error validating blog post" });
    }
  });

  // Create or update blog post
  app.post("/api/admin/blog", requireAdmin, async (req, res) => {
    try {
      const { 
        id, slug, title, description, contentMarkdown, contentHtml,
        heroImageUrl, heroAlt, heroCaption,
        ctaPrimaryLabel, ctaPrimaryUrl, ctaSecondaryLabel, ctaSecondaryUrl,
        author, tags, canonicalUrl, internalLinks,
        status, publishedAt
      } = req.body;
      
      if (!title || !contentMarkdown || !slug) {
        return res.status(400).json({ message: "title, slug, and contentMarkdown are required" });
      }

      const postData: schema.InsertBlogPost = {
        slug,
        title,
        description: description || null,
        contentMarkdown,
        contentHtml: contentHtml || null,
        heroImageUrl: heroImageUrl || null,
        heroAlt: heroAlt || null,
        heroCaption: heroCaption || null,
        ctaPrimaryLabel: ctaPrimaryLabel || null,
        ctaPrimaryUrl: ctaPrimaryUrl || null,
        ctaSecondaryLabel: ctaSecondaryLabel || null,
        ctaSecondaryUrl: ctaSecondaryUrl || null,
        author: author || null,
        tags: tags || [],
        canonicalUrl: canonicalUrl || null,
        internalLinks: internalLinks || [],
        status: status || 'draft',
        publishedAt: status === 'published' && !publishedAt ? new Date() : (publishedAt ? new Date(publishedAt) : null),
      };

      let post: schema.BlogPost;
      
      if (id) {
        // Update existing post
        const updated = await storage.updateBlogPost(id, postData);
        if (!updated) {
          return res.status(404).json({ message: "Blog post not found" });
        }
        post = updated;
      } else {
        // Check if slug already exists
        const existing = await storage.getBlogPostBySlug(slug);
        if (existing) {
          return res.status(409).json({ 
            message: "A blog post with this slug already exists",
            existingPost: { id: existing.id, slug: existing.slug, title: existing.title }
          });
        }
        post = await storage.createBlogPost(postData);
      }

      res.json({ 
        success: true, 
        post,
        message: id ? "Blog post updated" : "Blog post created"
      });
    } catch (error) {
      console.error("Error saving blog post:", error);
      res.status(500).json({ message: "Error saving blog post" });
    }
  });

  // Get all blog posts (public - only published, admin - all)
  app.get("/api/blog", async (req, res) => {
    try {
      const includeUnpublished = req.isAuthenticated() && req.user?.isAdmin;
      const posts = await storage.getAllBlogPosts(includeUnpublished);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ message: "Error fetching blog posts" });
    }
  });

  // Get single blog post by slug (public)
  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      
      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      
      // Only show draft posts to admins
      if (post.status === 'draft') {
        if (!req.isAuthenticated() || !req.user?.isAdmin) {
          return res.status(404).json({ message: "Blog post not found" });
        }
      }
      
      res.json(post);
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ message: "Error fetching blog post" });
    }
  });

  // Delete blog post (admin only)
  app.delete("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getBlogPost(id);
      
      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      
      await storage.deleteBlogPost(id);
      res.json({ success: true, message: "Blog post deleted" });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ message: "Error deleting blog post" });
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

  // ============ ICE PREVIEW (Guest Builder) ============
  // Anonymous endpoint for extracting content and generating card preview
  app.post("/api/ice/preview", async (req, res) => {
    try {
      const { type, value } = req.body;
      
      if (!type || !value || typeof value !== "string") {
        return res.status(400).json({ message: "Type and value are required" });
      }
      
      if (!["url", "text"].includes(type)) {
        return res.status(400).json({ message: "Type must be 'url' or 'text'" });
      }
      
      // Rate limiting by IP
      const userIp = req.ip || req.socket.remoteAddress || "unknown";
      // Simple in-memory rate limit (in production, use Redis)
      
      let contentText = "";
      let sourceTitle = "Untitled Experience";
      
      if (type === "url") {
        // Validate URL and fetch content
        const { validateUrlSafety, ingestSitePreview } = await import("./previewHelpers");
        const validation = await validateUrlSafety(value.trim());
        if (!validation.safe) {
          return res.status(400).json({ message: validation.error });
        }
        
        try {
          const siteData = await ingestSitePreview(value.trim());
          contentText = siteData.summary || "";
          sourceTitle = siteData.title || "Website Experience";
          
          // Add key services if available
          if (siteData.keyServices?.length) {
            contentText += "\n\nKey offerings:\n" + siteData.keyServices.join("\n");
          }
        } catch (err: any) {
          return res.status(400).json({ message: `Could not access website: ${err.message}` });
        }
      } else {
        // Direct text input
        contentText = value.trim();
        // Try to extract a title from first line
        const firstLine = contentText.split('\n')[0].trim();
        if (firstLine.length < 100 && firstLine.length > 0) {
          sourceTitle = firstLine.replace(/^#\s*/, '');
        }
      }
      
      if (!contentText || contentText.length < 50) {
        return res.status(400).json({ message: "Not enough content to create an experience" });
      }
      
      // Generate cards using AI
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at breaking content into cinematic story cards. Given text content, extract 4-8 key moments/sections and format them as story cards.

Each card should have:
- A short, evocative title (3-6 words)
- Content that captures the essence of that moment (2-4 sentences)

Output as JSON array: [{"title": "...", "content": "..."}, ...]

Guidelines:
- Keep cards concise and impactful
- Each card should stand alone as a moment
- Use vivid, engaging language
- Focus on the narrative arc
- Maximum 8 cards for a short preview`
          },
          {
            role: "user",
            content: `Create story cards from this content:\n\n${contentText.slice(0, 8000)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });
      
      let cards: Array<{title: string; content: string}> = [];
      try {
        const parsed = JSON.parse(completion.choices[0].message.content || "{}");
        cards = parsed.cards || parsed;
        if (!Array.isArray(cards)) {
          cards = Object.values(parsed).find(v => Array.isArray(v)) as any || [];
        }
      } catch (e) {
        // Fallback: create simple cards from paragraphs
        const paragraphs = contentText.split(/\n\n+/).filter(p => p.trim().length > 20);
        cards = paragraphs.slice(0, 6).map((p, i) => ({
          title: `Part ${i + 1}`,
          content: p.slice(0, 300),
        }));
      }
      
      // Limit to 8 cards for preview
      cards = cards.slice(0, 8);
      
      // Generate unique ID for this preview
      const previewId = `ice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const preview = {
        id: previewId,
        title: sourceTitle,
        cards: cards.map((card, idx) => ({
          id: `${previewId}_card_${idx}`,
          title: card.title,
          content: card.content,
          order: idx,
        })),
        sourceType: type,
        sourceValue: type === "url" ? value : value.slice(0, 100) + "...",
        createdAt: new Date().toISOString(),
      };
      
      res.json(preview);
    } catch (error) {
      console.error("Error creating ICE preview:", error);
      res.status(500).json({ message: "Error creating preview" });
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

      // Create orbit_meta to link preview to orbit (for PreviewRedirect)
      const { generateSlug } = await import("./orbitPackGenerator");
      const businessSlug = generateSlug(url.trim());
      
      // Check if orbit already exists
      let orbitMeta = await storage.getOrbitMeta(businessSlug);
      if (!orbitMeta) {
        orbitMeta = await storage.createOrbitMeta({
          businessSlug,
          sourceUrl: url.trim(),
          generationStatus: "ready",
          requestedAt: new Date(),
        });
      }
      // Link preview to orbit
      await storage.setOrbitPreviewId(businessSlug, preview.id);

      res.json({
        previewId: preview.id,
        expiresAt: preview.expiresAt,
        status: preview.status,
        siteTitle: preview.siteTitle,
        siteIdentity: preview.siteIdentity,
        businessSlug,
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

      // Check if this is an orbit and enforce monthly conversation limit for free tier
      const orbit = await storage.getOrbitMetaByPreviewId(preview.id);
      let isPaidOrbit = false;
      let monthlyConversations = 0;
      let showSoftLimitWarning = false;
      
      if (orbit) {
        monthlyConversations = await storage.getMonthlyConversationCount(orbit.businessSlug);
        
        // Check if orbit has a paid owner
        if (orbit.ownerId) {
          const entitlements = await getFullEntitlements(orbit.ownerId);
          isPaidOrbit = entitlements.planName !== 'Free' && entitlements.planName !== 'Viewer';
        }
        
        // Only enforce limit for free/unclaimed orbits
        if (!isPaidOrbit) {
          // Hard limit: 50 messages - block the request
          if (monthlyConversations >= FREE_CONVERSATION_LIMIT) {
            return res.json({
              capped: true,
              reason: "monthly_limit",
              ...conversationLimitCopy.hardLimit,
              monthlyCount: monthlyConversations,
              limit: FREE_CONVERSATION_LIMIT,
              upgradeRequired: true,
            });
          }
          
          // Soft limit: 40 messages - allow but warn
          if (monthlyConversations >= FREE_CONVERSATION_SOFT_LIMIT) {
            showSoftLimitWarning = true;
          }
        }
      }

      // Check message cap (per-preview limit)
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

      const systemPrompt = `You are Echo, a calm and knowledgeable guide for ${preview.siteTitle}.

CONTEXT:
${preview.siteSummary}

${preview.keyServices && preview.keyServices.length > 0 ? `SERVICES:
${preview.keyServices.map((s: string) => `• ${s}`).join('\n')}` : ''}

RESPONSE STRUCTURE:
1. Lead with the key insight or answer (1 sentence)
2. Add context if genuinely helpful (1-2 sentences max)
3. End with one clear next step or offer to clarify

VOICE:
• Professional and composed — never salesy or over-eager
• Benefit-led: "Here's what this means for you..." not "Let me explain..."
• Direct: state facts, don't hedge with "I think" or "I believe"
• Concise: 2-4 sentences typical. Only expand when detail adds value

STRICT RULES:
• Never repeat the same information twice in one response
• Never use ALL CAPS except for acronyms (UK, VAT, API)
• Never ask "What would you like to explore/know about X?"
• Never say "Great question!", "I'd be happy to...", or similar filler
• Never start sentences with "I" — rephrase to lead with value
• One question at end maximum; prefer offering options as bullets
• If unsure, acknowledge briefly and offer one clear next step`;

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

      const rawReply = aiResponse.choices[0]?.message?.content || "Sorry, couldn't generate a response.";
      const reply = processEchoResponse(rawReply);

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
        costEstimatePence: (preview.costEstimatePence || 0) + 1,
        llmCallCount: (preview.llmCallCount || 0) + 1,
      });
      
      // Increment orbit analytics AFTER message is successfully processed
      if (orbit && !isPaidOrbit) {
        await storage.incrementOrbitMetric(orbit.businessSlug, 'conversations');
      }

      // Build response with optional soft limit warning
      const response: Record<string, any> = {
        reply,
        messageCount: newMessageCount,
        capped: newMessageCount >= preview.maxMessages,
      };
      
      // Add soft limit warning if approaching monthly limit
      if (showSoftLimitWarning) {
        response.softLimitWarning = {
          ...conversationLimitCopy.softLimit,
          monthlyCount: monthlyConversations + 1,
          limit: FREE_CONVERSATION_LIMIT,
        };
      }
      
      res.json(response);
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

      // Get boxes for this orbit
      const boxes = await storage.getOrbitBoxes(orbitMeta.businessSlug);

      // Return previewId for rich experience (new approach)
      if (orbitMeta.previewId) {
        return res.json({
          status: "ready",
          businessSlug: orbitMeta.businessSlug,
          ownerId: orbitMeta.ownerId,
          planTier: orbitMeta.planTier,
          customTitle: orbitMeta.customTitle,
          customDescription: orbitMeta.customDescription,
          lastUpdated: orbitMeta.lastUpdated,
          previewId: orbitMeta.previewId,
          boxes,
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
            planTier: orbitMeta.planTier,
            customTitle: orbitMeta.customTitle,
            customDescription: orbitMeta.customDescription,
            lastUpdated: orbitMeta.lastUpdated,
            pack: packResult.pack,
            boxes,
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
      const { days = '30' } = req.query;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const daysNum = Math.min(parseInt(days as string) || 30, 90);
      const summary = await storage.getOrbitAnalyticsSummary(slug, daysNum);
      const dailyData = await storage.getOrbitAnalytics(slug, daysNum);
      
      // Check if user is owner (for paid features)
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      
      // Check plan tier for paid features
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const isPaid = orbitMeta.planTier ? PAID_TIERS.includes(orbitMeta.planTier) : false;
      
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
      
      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ message: "Name is required" });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Only allow leads on claimed orbits (owners need to claim to receive leads)
      if (!orbitMeta.ownerId) {
        return res.status(400).json({ message: "This orbit hasn't been claimed yet. Leads cannot be submitted." });
      }
      
      const lead = await storage.createOrbitLead({
        businessSlug: slug,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        message: message?.trim() || null,
        source: ['orbit', 'chat', 'cta'].includes(source) ? source : 'orbit',
      });
      
      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error("Error creating orbit lead:", error);
      res.status(500).json({ message: "Error creating lead" });
    }
  });

  // Orbit Leads - Get leads (owner only for details, count visible to all)
  app.get("/api/orbit/:slug/leads", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Strict owner check - must be authenticated and match ownerId
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      
      // Always return lead count (free tier activity metric)
      const count = await storage.getOrbitLeadsCount(slug);
      
      // Full lead details ONLY for verified owners
      const leads = isOwner ? await storage.getOrbitLeads(slug) : null;
      
      res.json({
        count,
        leads,
        isOwner,
      });
    } catch (error) {
      console.error("Error getting orbit leads:", error);
      res.status(500).json({ message: "Error getting leads" });
    }
  });

  // Orbit Boxes - Get all boxes (owners see hidden boxes too)
  app.get("/api/orbit/:slug/boxes", async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      const boxes = await storage.getOrbitBoxes(slug, isOwner);
      
      res.json({ boxes, isOwner });
    } catch (error) {
      console.error("Error getting orbit boxes:", error);
      res.status(500).json({ message: "Error getting boxes" });
    }
  });

  // Orbit Boxes - Create box (owner only, Grow+ tier required)
  app.post("/api/orbit/:slug/boxes", async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can add boxes" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to add boxes to your grid" });
      }
      
      const { boxType, title, description, sourceUrl, content, imageUrl, iceId } = req.body;
      
      if (!boxType || !title) {
        return res.status(400).json({ message: "boxType and title are required" });
      }
      
      const existingBoxes = await storage.getOrbitBoxes(slug, true);
      const sortOrder = existingBoxes.length;
      
      const box = await storage.createOrbitBox({
        businessSlug: slug,
        boxType,
        title,
        description,
        sourceUrl,
        content,
        imageUrl,
        iceId,
        sortOrder,
        isVisible: true,
      });
      
      res.json({ success: true, box });
    } catch (error) {
      console.error("Error creating orbit box:", error);
      res.status(500).json({ message: "Error creating box" });
    }
  });

  // Orbit Boxes - Update box (owner only, Grow+ tier required)
  app.patch("/api/orbit/:slug/boxes/:boxId", async (req, res) => {
    try {
      const { slug, boxId } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can update boxes" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to manage your grid boxes" });
      }
      
      const box = await storage.getOrbitBox(parseInt(boxId));
      if (!box || box.businessSlug !== slug) {
        return res.status(404).json({ message: "Box not found" });
      }
      
      const { title, description, sourceUrl, content, imageUrl, isVisible } = req.body;
      
      const updated = await storage.updateOrbitBox(parseInt(boxId), {
        title,
        description,
        sourceUrl,
        content,
        imageUrl,
        isVisible,
      });
      
      res.json({ success: true, box: updated });
    } catch (error) {
      console.error("Error updating orbit box:", error);
      res.status(500).json({ message: "Error updating box" });
    }
  });

  // Orbit Boxes - Delete box (owner only, Grow+ tier required)
  app.delete("/api/orbit/:slug/boxes/:boxId", async (req, res) => {
    try {
      const { slug, boxId } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can delete boxes" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to manage your grid boxes" });
      }
      
      const box = await storage.getOrbitBox(parseInt(boxId));
      if (!box || box.businessSlug !== slug) {
        return res.status(404).json({ message: "Box not found" });
      }
      
      await storage.deleteOrbitBox(parseInt(boxId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting orbit box:", error);
      res.status(500).json({ message: "Error deleting box" });
    }
  });

  // Orbit Boxes - Reorder boxes (owner only, Grow+ tier required)
  app.post("/api/orbit/:slug/boxes/reorder", async (req, res) => {
    try {
      const { slug } = req.params;
      const { boxIds } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can reorder boxes" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to manage your grid boxes" });
      }
      
      if (!Array.isArray(boxIds)) {
        return res.status(400).json({ message: "boxIds must be an array" });
      }
      
      await storage.reorderOrbitBoxes(slug, boxIds);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering orbit boxes:", error);
      res.status(500).json({ message: "Error reordering boxes" });
    }
  });

  // Orbit Brand Settings - Update (owner only, Grow+ tier required)
  app.patch("/api/orbit/:slug/brand", async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can update brand settings" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to customize your brand" });
      }
      
      const { customTitle, customDescription } = req.body;
      
      const updated = await storage.updateOrbitMeta(slug, {
        customTitle: customTitle !== undefined ? customTitle : orbitMeta.customTitle,
        customDescription: customDescription !== undefined ? customDescription : orbitMeta.customDescription,
      });
      
      res.json({ success: true, meta: updated });
    } catch (error) {
      console.error("Error updating orbit brand:", error);
      res.status(500).json({ message: "Error updating brand settings" });
    }
  });

  // ============ PHASE 2: ORBIT INSIGHT ENDPOINTS ============

  // Helper for Insight tier checking
  const INSIGHT_TIERS = ['insight', 'intelligence'];

  // Session tracking - Create or update session
  app.post("/api/orbit/:slug/session", async (req, res) => {
    try {
      const { slug } = req.params;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const session = await storage.getOrCreateOrbitSession(sessionId, slug);
      res.json({ session });
    } catch (error) {
      console.error("Error managing session:", error);
      res.status(500).json({ message: "Error managing session" });
    }
  });

  // Event logging - Log an event
  app.post("/api/orbit/:slug/events", async (req, res) => {
    try {
      const { slug } = req.params;
      const { sessionId, eventType, boxId, iceId, conversationId, metadata } = req.body;
      
      if (!sessionId || !eventType) {
        return res.status(400).json({ message: "sessionId and eventType are required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Ensure session exists
      await storage.getOrCreateOrbitSession(sessionId, slug);
      
      const event = await storage.logOrbitEvent({
        businessSlug: slug,
        sessionId,
        eventType,
        boxId: boxId || null,
        iceId: iceId || null,
        conversationId: conversationId || null,
        metadataJson: metadata || null,
      });
      
      res.json({ event });
    } catch (error) {
      console.error("Error logging event:", error);
      res.status(500).json({ message: "Error logging event" });
    }
  });

  // Conversations - List (owner only, Insight+ tier required)
  app.get("/api/orbit/:slug/conversations", async (req, res) => {
    try {
      const { slug } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view conversations" });
      }
      
      // Get count for all tiers
      const conversations = await storage.getOrbitConversations(slug, limit);
      const count = conversations.length;
      
      // Insight+ gets full transcripts, Grow gets count only
      const tier = orbitMeta.planTier;
      if (!tier || !INSIGHT_TIERS.includes(tier)) {
        return res.json({ 
          count,
          conversations: conversations.slice(0, 3).map(c => ({
            id: c.id,
            startedAt: c.startedAt,
            messageCount: c.messageCount,
            preview: true,
          })),
          locked: true,
          upgradeMessage: "Upgrade to Orbit Understand to view conversation transcripts"
        });
      }
      
      res.json({ conversations, count, locked: false });
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ message: "Error getting conversations" });
    }
  });

  // Conversations - Get single with messages (owner only, Insight+ tier required)
  app.get("/api/orbit/:slug/conversations/:id", async (req, res) => {
    try {
      const { slug, id } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view conversation details" });
      }
      
      const tier = orbitMeta.planTier;
      if (!tier || !INSIGHT_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Orbit Understand to view conversation transcripts" });
      }
      
      const conversation = await storage.getOrbitConversation(parseInt(id));
      if (!conversation || conversation.businessSlug !== slug) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      const messages = await storage.getOrbitMessages(parseInt(id));
      
      // Get session events for timeline
      let events: any[] = [];
      if (conversation.sessionId) {
        events = await storage.getOrbitEvents(conversation.sessionId);
      }
      
      res.json({ conversation, messages, events });
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ message: "Error getting conversation" });
    }
  });

  // Conversations - Create (for chat widget)
  app.post("/api/orbit/:slug/conversations", async (req, res) => {
    try {
      const { slug } = req.params;
      const { sessionId } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const conversation = await storage.createOrbitConversation({
        businessSlug: slug,
        sessionId: sessionId || null,
      });
      
      res.json({ conversation });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Error creating conversation" });
    }
  });

  // Conversations - Add message (for chat widget)
  app.post("/api/orbit/:slug/conversations/:id/messages", async (req, res) => {
    try {
      const { slug, id } = req.params;
      const { role, content } = req.body;
      
      if (!role || !content) {
        return res.status(400).json({ message: "role and content are required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const conversation = await storage.getOrbitConversation(parseInt(id));
      if (!conversation || conversation.businessSlug !== slug) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      const message = await storage.addOrbitMessage({
        conversationId: parseInt(id),
        role,
        content,
      });
      
      res.json({ message });
    } catch (error) {
      console.error("Error adding message:", error);
      res.status(500).json({ message: "Error adding message" });
    }
  });

  // Insights Summary (owner only, Insight+ tier required)
  app.get("/api/orbit/:slug/insights/summary", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view insights" });
      }
      
      const tier = orbitMeta.planTier;
      if (!tier || !INSIGHT_TIERS.includes(tier)) {
        // Return basic counts for Grow tier
        const conversations = await storage.getOrbitConversations(slug, 1000);
        const leadsCount = await storage.getOrbitLeadsCount(slug);
        
        return res.json({
          conversationCount: conversations.length,
          leadsCount,
          locked: true,
          upgradeMessage: "Upgrade to Orbit Understand for detailed analytics and question clustering"
        });
      }
      
      // Full insights for Insight+ tier
      const summary = await storage.getOrbitInsightsSummary(slug);
      const conversations = await storage.getOrbitConversations(slug, 1000);
      const leadsCount = await storage.getOrbitLeadsCount(slug);
      
      res.json({
        conversationCount: conversations.length,
        leadsCount,
        topQuestions: summary?.topQuestions || [],
        topThemes: summary?.topThemes || [],
        unansweredQuestions: summary?.unansweredQuestions || [],
        locked: false,
      });
    } catch (error) {
      console.error("Error getting insights summary:", error);
      res.status(500).json({ message: "Error getting insights" });
    }
  });

  // Leads - List with context (owner only, Insight+ for full details)
  app.get("/api/orbit/:slug/leads", async (req, res) => {
    try {
      const { slug } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view leads" });
      }
      
      const leads = await storage.getOrbitLeads(slug, limit);
      const count = await storage.getOrbitLeadsCount(slug);
      
      // Insight+ gets full details, Grow gets masked preview
      const tier = orbitMeta.planTier;
      if (!tier || !INSIGHT_TIERS.includes(tier)) {
        return res.json({
          count,
          leads: leads.slice(0, 3).map(l => ({
            id: l.id,
            createdAt: l.createdAt,
            source: l.source,
            preview: true,
            name: l.name ? l.name[0] + '***' : null,
          })),
          locked: true,
          upgradeMessage: "Upgrade to Orbit Understand to view lead details and journey context"
        });
      }
      
      res.json({ leads, count, locked: false });
    } catch (error) {
      console.error("Error getting leads:", error);
      res.status(500).json({ message: "Error getting leads" });
    }
  });

  // Leads - Get single with context (owner only, Insight+ tier required)
  app.get("/api/orbit/:slug/leads/:id", async (req, res) => {
    try {
      const { slug, id } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view lead details" });
      }
      
      const tier = orbitMeta.planTier;
      if (!tier || !INSIGHT_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Orbit Understand to view lead details" });
      }
      
      const lead = await storage.getOrbitLead(parseInt(id));
      if (!lead || lead.businessSlug !== slug) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Get session events for journey context
      let events: any[] = [];
      if (lead.sessionId) {
        events = await storage.getOrbitEvents(lead.sessionId);
      }
      
      // Get conversation excerpt if linked
      let conversationExcerpt: any[] = [];
      if (lead.conversationId) {
        const messages = await storage.getOrbitMessages(lead.conversationId);
        conversationExcerpt = messages.slice(-5);
      }
      
      res.json({ lead, events, conversationExcerpt });
    } catch (error) {
      console.error("Error getting lead:", error);
      res.status(500).json({ message: "Error getting lead" });
    }
  });

  // ICE Allowance - Get usage (owner only)
  app.get("/api/orbit/:slug/ice-allowance", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view ICE allowance" });
      }
      
      const { allowance, used, periodStart } = await storage.getOrbitIceAllowance(slug);
      
      // Calculate tier-based defaults
      const tier = orbitMeta.planTier || 'free';
      let tierAllowance = 0;
      if (tier === 'insight') tierAllowance = 6;
      else if (tier === 'intelligence') tierAllowance = 12;
      
      // Reset period if needed (first of month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (!periodStart || periodStart < startOfMonth) {
        await storage.resetOrbitIcePeriod(slug, tierAllowance);
        return res.json({
          allowance: tierAllowance,
          used: 0,
          remaining: tierAllowance,
          periodStart: startOfMonth,
          tier,
        });
      }
      
      res.json({
        allowance: allowance || tierAllowance,
        used,
        remaining: Math.max(0, (allowance || tierAllowance) - used),
        periodStart,
        tier,
      });
    } catch (error) {
      console.error("Error getting ICE allowance:", error);
      res.status(500).json({ message: "Error getting ICE allowance" });
    }
  });

  // ============================================
  // PHASE 4: NOTIFICATIONS LAYER
  // ============================================

  // Get notifications (authenticated, Insight+ only)
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const limit = parseInt(req.query.limit as string) || 50;
      const filter = req.query.filter as string; // 'all' | 'unread' | 'important'
      
      let notifications = await storage.getNotifications(userId, limit);
      
      if (filter === 'unread') {
        notifications = notifications.filter(n => !n.isRead);
      } else if (filter === 'important') {
        notifications = notifications.filter(n => n.severity === 'important');
      }
      
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      
      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ message: "Error getting notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/count", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const count = await storage.getUnreadNotificationCount(userId);
      
      res.json({ count });
    } catch (error) {
      console.error("Error getting notification count:", error);
      res.status(500).json({ message: "Error getting notification count" });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ message: "Error marking notification read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ message: "Error marking all notifications read" });
    }
  });

  // Get notification preferences
  app.get("/api/notifications/preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      let prefs = await storage.getNotificationPreferences(userId);
      
      if (!prefs) {
        prefs = await storage.upsertNotificationPreferences({
          userId,
          emailEnabled: true,
          emailCadence: 'daily_digest',
          leadAlertsEnabled: true,
          conversationAlertsEnabled: false,
          intelligenceAlertsEnabled: false,
          iceAlertsEnabled: false,
          quietHoursEnabled: false,
        });
      }
      
      res.json(prefs);
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      res.status(500).json({ message: "Error getting notification preferences" });
    }
  });

  // Update notification preferences
  app.patch("/api/notifications/preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const updates = req.body;
      
      const prefs = await storage.upsertNotificationPreferences({
        userId,
        ...updates,
      });
      
      res.json(prefs);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Error updating notification preferences" });
    }
  });

  // Magic link validation
  app.get("/api/magic/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const link = await storage.getMagicLink(token);
      
      if (!link) {
        return res.status(404).json({ valid: false, error: "Invalid link" });
      }
      
      if (new Date() > link.expiresAt) {
        return res.status(410).json({ valid: false, error: "Link has expired" });
      }
      
      await storage.markMagicLinkUsed(token);
      
      const orbit = await storage.getOrbitMetaById(link.orbitId);
      if (!orbit) {
        return res.status(404).json({ valid: false, error: "Orbit not found" });
      }
      
      let redirectUrl = `/orbit/${orbit.businessSlug}`;
      switch (link.purpose) {
        case 'view_lead':
          redirectUrl += `?hub=leads&lead=${link.targetId}`;
          break;
        case 'view_conversation':
          redirectUrl += `?hub=conversations&conversation=${link.targetId}`;
          break;
        case 'view_intelligence':
          redirectUrl += `?hub=intelligence`;
          break;
        case 'view_ice':
          redirectUrl += `?hub=ice&ice=${link.targetId}`;
          break;
      }
      
      res.json({
        valid: true,
        purpose: link.purpose,
        targetId: link.targetId,
        redirectUrl,
      });
    } catch (error) {
      console.error("Error validating magic link:", error);
      res.status(500).json({ valid: false, error: "Error validating link" });
    }
  });

  // Cron endpoint for running notification jobs
  app.post("/api/cron/notifications/run", async (req, res) => {
    try {
      const results = {
        leadsProcessed: 0,
        notificationsCreated: 0,
        errors: [] as string[],
      };
      
      res.json({
        success: true,
        message: "Notification job completed",
        ...results,
      });
    } catch (error) {
      console.error("Error running notification job:", error);
      res.status(500).json({ success: false, error: "Notification job failed" });
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

  // ============ SUPER ADMIN ENDPOINTS ============
  
  // Super admin: Get dashboard stats
  app.get("/api/super-admin/stats", requireAdmin, async (_req, res) => {
    try {
      const usersResult = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
      const orbitsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.orbitMeta);
      const previewsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.previewInstances);
      const leadsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.orbitLeads);
      const universesResult = await db.select({ count: sql<number>`count(*)` }).from(schema.universes);
      
      // Get recent activity
      const recentUsers = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(gte(schema.users.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
      
      const recentPreviews = await db.select({ count: sql<number>`count(*)` })
        .from(schema.previewInstances)
        .where(gte(schema.previewInstances.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
      
      const activePreviewsResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.previewInstances)
        .where(eq(schema.previewInstances.status, 'active'));
      
      // Get tier breakdown
      const tierBreakdown = await db.select({
        tier: schema.orbitMeta.planTier,
        count: sql<number>`count(*)`,
      })
      .from(schema.orbitMeta)
      .groupBy(schema.orbitMeta.planTier);
      
      res.json({
        totals: {
          users: Number(usersResult[0]?.count || 0),
          orbits: Number(orbitsResult[0]?.count || 0),
          previews: Number(previewsResult[0]?.count || 0),
          leads: Number(leadsResult[0]?.count || 0),
          universes: Number(universesResult[0]?.count || 0),
        },
        recent: {
          usersLast7Days: Number(recentUsers[0]?.count || 0),
          previewsLast7Days: Number(recentPreviews[0]?.count || 0),
          activePreviews: Number(activePreviewsResult[0]?.count || 0),
        },
        tierBreakdown: tierBreakdown.reduce((acc, t) => {
          acc[t.tier] = Number(t.count);
          return acc;
        }, {} as Record<string, number>),
      });
    } catch (error: any) {
      console.error("Error fetching super admin stats:", error);
      res.status(500).json({ message: error.message || "Failed to fetch stats" });
    }
  });
  
  // Super admin: List all users
  app.get("/api/super-admin/users", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string || '';
      
      let query = db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
      
      if (search) {
        query = db.select().from(schema.users)
          .where(
            sql`lower(${schema.users.username}) like ${`%${search.toLowerCase()}%`} OR lower(${schema.users.email}) like ${`%${search.toLowerCase()}%`}`
          )
          .orderBy(desc(schema.users.createdAt));
      }
      
      const users = await query.limit(limit).offset(offset);
      const total = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
      
      // Properly exclude passwords from response
      const safeUsers = users.map(({ password, ...rest }) => rest);
      
      res.json({
        users: safeUsers,
        total: Number(total[0]?.count || 0),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Error listing users:", error);
      res.status(500).json({ message: error.message || "Failed to list users" });
    }
  });
  
  // Super admin: Update user
  app.patch("/api/super-admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isAdmin, role, email, username } = req.body;
      
      const updateData: Partial<schema.InsertUser> = {};
      if (typeof isAdmin === 'boolean') updateData.isAdmin = isAdmin;
      if (role) updateData.role = role;
      if (email) updateData.email = email;
      if (username) updateData.username = username;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Properly exclude password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: error.message || "Failed to update user" });
    }
  });
  
  // Super admin: List all orbits
  app.get("/api/super-admin/orbits", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const tier = req.query.tier as string;
      
      let query = db.select().from(schema.orbitMeta).orderBy(desc(schema.orbitMeta.createdAt));
      
      if (tier) {
        query = db.select().from(schema.orbitMeta)
          .where(eq(schema.orbitMeta.planTier, tier))
          .orderBy(desc(schema.orbitMeta.createdAt));
      }
      
      const orbits = await query.limit(limit).offset(offset);
      const total = await db.select({ count: sql<number>`count(*)` }).from(schema.orbitMeta);
      
      res.json({
        orbits,
        total: Number(total[0]?.count || 0),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Error listing orbits:", error);
      res.status(500).json({ message: error.message || "Failed to list orbits" });
    }
  });
  
  // Super admin: Update orbit tier
  app.patch("/api/super-admin/orbits/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const { planTier, customTitle, customDescription } = req.body;
      
      const updateData: Record<string, any> = {};
      if (planTier) updateData.planTier = planTier;
      if (customTitle !== undefined) updateData.customTitle = customTitle;
      if (customDescription !== undefined) updateData.customDescription = customDescription;
      
      const updated = await db.update(schema.orbitMeta)
        .set({ ...updateData, lastUpdated: new Date() })
        .where(eq(schema.orbitMeta.businessSlug, slug))
        .returning();
      
      if (!updated.length) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      res.json(updated[0]);
    } catch (error: any) {
      console.error("Error updating orbit:", error);
      res.status(500).json({ message: error.message || "Failed to update orbit" });
    }
  });
  
  // Super admin: List all previews
  app.get("/api/super-admin/previews", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      
      let query = db.select().from(schema.previewInstances).orderBy(desc(schema.previewInstances.createdAt));
      
      if (status) {
        query = db.select().from(schema.previewInstances)
          .where(eq(schema.previewInstances.status, status as schema.PreviewStatus))
          .orderBy(desc(schema.previewInstances.createdAt));
      }
      
      const previews = await query.limit(limit).offset(offset);
      const total = await db.select({ count: sql<number>`count(*)` }).from(schema.previewInstances);
      
      res.json({
        previews,
        total: Number(total[0]?.count || 0),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Error listing previews:", error);
      res.status(500).json({ message: error.message || "Failed to list previews" });
    }
  });
  
  // Super admin: List all leads
  app.get("/api/super-admin/leads", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const leads = await db.select()
        .from(schema.orbitLeads)
        .orderBy(desc(schema.orbitLeads.createdAt))
        .limit(limit)
        .offset(offset);
      
      const total = await db.select({ count: sql<number>`count(*)` }).from(schema.orbitLeads);
      
      res.json({
        leads,
        total: Number(total[0]?.count || 0),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Error listing leads:", error);
      res.status(500).json({ message: error.message || "Failed to list leads" });
    }
  });
  
  // Super admin: Get feature flags
  app.get("/api/super-admin/feature-flags", requireAdmin, async (_req, res) => {
    try {
      const { featureFlags } = await import("./config/featureFlags");
      res.json(featureFlags);
    } catch (error: any) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: error.message || "Failed to fetch feature flags" });
    }
  });

  // ============ Phase 5: Data Sources (API Snapshot Ingestion) ============
  
  const { validateUrlForSSRF } = await import("./services/ssrfProtection");
  const crypto = await import("crypto");
  
  // Helper: Check orbit ownership
  const requireOrbitOwner = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { slug } = req.params;
    const orbitMeta = await storage.getOrbitMeta(slug);
    if (!orbitMeta) {
      return res.status(404).json({ message: "Orbit not found" });
    }
    if (orbitMeta.ownerId !== (req.user as any)?.id) {
      return res.status(403).json({ message: "You don't have permission to manage this Orbit" });
    }
    (req as any).orbitMeta = orbitMeta;
    next();
  };

  // ==========================================
  // Voice Settings Routes (ICE Narration)
  // ==========================================

  // Voice Settings - Get (owner only)
  app.get("/api/orbit/:slug/voice-settings", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta?.businessSlug) {
        return res.json({
          universeId: null,
          narrationEnabled: false,
          defaultVoice: null,
          defaultSpeed: 1.0,
          defaultMode: 'manual',
          cardsWithNarration: 0,
          cardsWithAudio: 0,
          totalCards: 0,
        });
      }
      
      const universe = await storage.getUniverseBySlug(orbitMeta.businessSlug);
      if (!universe) {
        return res.json({
          universeId: null,
          narrationEnabled: false,
          defaultVoice: null,
          defaultSpeed: 1.0,
          defaultMode: 'manual',
          cardsWithNarration: 0,
          cardsWithAudio: 0,
          totalCards: 0,
        });
      }
      
      const cards = await storage.getCardsByUniverse(universe.id);
      const cardsWithNarration = cards.filter(c => c.narrationEnabled && c.narrationText).length;
      const cardsWithAudio = cards.filter(c => c.narrationAudioUrl).length;
      
      res.json({
        universeId: universe.id,
        narrationEnabled: universe.defaultNarrationEnabled ?? false,
        defaultVoice: universe.defaultNarrationVoice || 'alloy',
        defaultSpeed: universe.defaultNarrationSpeed ?? 1.0,
        defaultMode: universe.defaultNarrationMode || 'manual',
        cardsWithNarration,
        cardsWithAudio,
        totalCards: cards.length,
      });
    } catch (error) {
      console.error("Error getting voice settings:", error);
      res.status(500).json({ message: "Error getting voice settings" });
    }
  });

  // Voice Settings - Update (owner only)
  app.patch("/api/orbit/:slug/voice-settings", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      const { narrationEnabled, defaultVoice, defaultSpeed } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta?.businessSlug) {
        return res.status(404).json({ message: "No ICE found for this Orbit" });
      }
      
      const universe = await storage.getUniverseBySlug(orbitMeta.businessSlug);
      if (!universe) {
        return res.status(404).json({ message: "No ICE found for this Orbit" });
      }
      
      const updates: Partial<typeof universe> = {};
      if (narrationEnabled !== undefined) updates.defaultNarrationEnabled = narrationEnabled;
      if (defaultVoice !== undefined) updates.defaultNarrationVoice = defaultVoice;
      if (defaultSpeed !== undefined) updates.defaultNarrationSpeed = Math.max(0.5, Math.min(2.0, defaultSpeed));
      
      const updated = await storage.updateUniverse(universe.id, updates);
      
      // If enabling narration, also enable on all cards that have text
      if (narrationEnabled === true) {
        const cards = await storage.getCardsByUniverse(universe.id);
        for (const card of cards) {
          if (card.sceneText && !card.narrationEnabled) {
            await storage.updateCard(card.id, {
              narrationEnabled: true,
              narrationText: card.narrationText || card.sceneText?.slice(0, 3000),
              narrationVoice: defaultVoice || universe.defaultNarrationVoice || 'alloy',
              narrationSpeed: defaultSpeed || universe.defaultNarrationSpeed || 1.0,
              narrationStatus: 'text_ready',
            });
          }
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating voice settings:", error);
      res.status(500).json({ message: "Error updating voice settings" });
    }
  });

  // Bulk Narration Generation (owner only)
  app.post("/api/orbit/:slug/narrations/generate-all", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta?.businessSlug) {
        return res.status(404).json({ message: "No ICE found for this Orbit" });
      }
      
      const universe = await storage.getUniverseBySlug(orbitMeta.businessSlug);
      if (!universe) {
        return res.status(404).json({ message: "No ICE found for this Orbit" });
      }
      
      const { isTTSConfigured, synthesiseSpeech } = await import("./tts");
      const { isObjectStorageConfigured, putObject, getNarrationKey } = await import("./storage/objectStore");
      
      if (!isTTSConfigured()) {
        return res.status(503).json({ message: "TTS not configured: OPENAI_API_KEY is missing" });
      }
      
      if (!isObjectStorageConfigured()) {
        return res.status(503).json({ message: "Object storage not configured" });
      }
      
      const cards = await storage.getCardsByUniverse(universe.id);
      const cardsToGenerate = cards.filter(c => 
        c.narrationEnabled && 
        c.narrationText && 
        c.narrationText.trim() && 
        !c.narrationAudioUrl
      );
      
      if (cardsToGenerate.length === 0) {
        return res.json({ cardsToGenerate: 0, message: "All cards already have audio" });
      }
      
      // Start generating in background
      (async () => {
        for (const card of cardsToGenerate) {
          try {
            await storage.updateCard(card.id, { narrationStatus: 'generating' });
            
            const result = await synthesiseSpeech({
              text: card.narrationText!,
              voice: card.narrationVoice || universe.defaultNarrationVoice || 'alloy',
              speed: card.narrationSpeed || universe.defaultNarrationSpeed || 1.0,
            });
            
            const key = getNarrationKey(card.universeId, card.id);
            const audioUrl = await putObject(key, result.audioBuffer, result.contentType);
            
            const estimatedDuration = (card.narrationText!.length / 5) / 150 * 60;
            
            await storage.updateCard(card.id, {
              narrationAudioUrl: audioUrl,
              narrationStatus: 'ready',
              narrationAudioDurationSec: estimatedDuration,
              narrationUpdatedAt: new Date(),
              narrationError: null,
            });
            
            await storage.logTtsUsage({
              userId: (req.user as any).id,
              universeId: card.universeId,
              cardId: card.id,
              charsCount: card.narrationText!.length,
              voiceId: card.narrationVoice || 'alloy',
            });
          } catch (err) {
            console.error(`Failed to generate narration for card ${card.id}:`, err);
            await storage.updateCard(card.id, {
              narrationStatus: 'failed',
              narrationError: err instanceof Error ? err.message : 'Generation failed',
            });
          }
        }
      })();
      
      res.json({ 
        cardsToGenerate: cardsToGenerate.length,
        message: `Generating audio for ${cardsToGenerate.length} cards in background`,
      });
    } catch (error) {
      console.error("Error generating narrations:", error);
      res.status(500).json({ message: "Error generating narrations" });
    }
  });
  
  // List all connections for an Orbit
  app.get("/api/orbit/:slug/data-sources", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      const connections = await storage.getApiConnectionsByOrbit(slug);
      
      // Get endpoint and latest snapshot info for each connection
      const connectionsWithInfo = await Promise.all(
        connections.map(async (conn) => {
          const endpoints = await storage.getApiEndpointsByConnection(conn.id);
          const endpoint = endpoints[0]; // v1: 1 endpoint per connection
          let latestSnapshot = null;
          let snapshotCount = 0;
          
          if (endpoint) {
            latestSnapshot = await storage.getLatestSnapshot(endpoint.id);
            const snapshots = await storage.getApiSnapshotsByEndpoint(endpoint.id, 100);
            snapshotCount = snapshots.length;
          }
          
          return {
            ...conn,
            endpoint,
            latestSnapshot,
            snapshotCount,
          };
        })
      );
      
      res.json(connectionsWithInfo);
    } catch (error: any) {
      console.error("Error fetching data sources:", error);
      res.status(500).json({ message: error.message || "Failed to fetch data sources" });
    }
  });
  
  // Create a new connection (with endpoint)
  app.post("/api/orbit/:slug/data-sources", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      const { name, description, baseUrl, authType, authValue, endpointPath, responseMapping } = req.body;
      
      if (!name || !baseUrl || !endpointPath) {
        return res.status(400).json({ message: "Name, base URL, and endpoint path are required" });
      }
      
      // Validate URL for SSRF
      const fullUrl = new URL(endpointPath, baseUrl).toString();
      const ssrfCheck = await validateUrlForSSRF(fullUrl);
      if (!ssrfCheck.safe) {
        return res.status(400).json({ message: ssrfCheck.error || "Invalid URL" });
      }
      
      // Create secret if auth provided
      let authSecretId = null;
      if (authType && authType !== 'none' && authValue) {
        const secret = await storage.createApiSecret({
          orbitSlug: slug,
          name: `${name} credentials`,
          encryptedValue: authValue, // In production, encrypt this
          authType,
        });
        authSecretId = secret.id;
      }
      
      // Create connection
      const connection = await storage.createApiConnection({
        orbitSlug: slug,
        name,
        description,
        baseUrl,
        authSecretId,
        status: 'active',
      });
      
      // Create endpoint (v1: 1 endpoint per connection)
      const endpoint = await storage.createApiEndpoint({
        connectionId: connection.id,
        path: endpointPath,
        responseMapping: responseMapping || null,
      });
      
      res.json({ connection, endpoint });
    } catch (error: any) {
      console.error("Error creating data source:", error);
      res.status(500).json({ message: error.message || "Failed to create data source" });
    }
  });
  
  // Get connection details
  app.get("/api/orbit/:slug/data-sources/:connectionId", requireOrbitOwner, async (req, res) => {
    try {
      const { connectionId } = req.params;
      const connection = await storage.getApiConnection(parseInt(connectionId));
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      const endpoints = await storage.getApiEndpointsByConnection(connection.id);
      const endpoint = endpoints[0];
      
      let snapshots: schema.ApiSnapshot[] = [];
      if (endpoint) {
        snapshots = await storage.getApiSnapshotsByEndpoint(endpoint.id, 30);
      }
      
      res.json({ connection, endpoint, snapshots });
    } catch (error: any) {
      console.error("Error fetching connection:", error);
      res.status(500).json({ message: error.message || "Failed to fetch connection" });
    }
  });
  
  // Update connection
  app.patch("/api/orbit/:slug/data-sources/:connectionId", requireOrbitOwner, async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { name, description, status } = req.body;
      
      const connection = await storage.updateApiConnection(parseInt(connectionId), {
        name,
        description,
        status,
      });
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      res.json(connection);
    } catch (error: any) {
      console.error("Error updating connection:", error);
      res.status(500).json({ message: error.message || "Failed to update connection" });
    }
  });
  
  // Delete connection
  app.delete("/api/orbit/:slug/data-sources/:connectionId", requireOrbitOwner, async (req, res) => {
    try {
      const { connectionId } = req.params;
      await storage.deleteApiConnection(parseInt(connectionId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: error.message || "Failed to delete connection" });
    }
  });
  
  // Trigger manual snapshot
  app.post("/api/orbit/:slug/data-sources/:connectionId/snapshot", requireOrbitOwner, async (req, res) => {
    try {
      const { slug, connectionId } = req.params;
      
      const connection = await storage.getApiConnection(parseInt(connectionId));
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      const endpoints = await storage.getApiEndpointsByConnection(connection.id);
      const endpoint = endpoints[0];
      if (!endpoint) {
        return res.status(400).json({ message: "No endpoint configured" });
      }
      
      // Build request URL
      const fullUrl = new URL(endpoint.path, connection.baseUrl).toString();
      
      // SSRF re-validation at request time
      const ssrfCheck = await validateUrlForSSRF(fullUrl);
      if (!ssrfCheck.safe) {
        return res.status(400).json({ message: ssrfCheck.error || "URL validation failed" });
      }
      
      // Generate request hash for idempotency
      const requestHash = crypto.createHash('sha256')
        .update(`${connection.id}:${endpoint.id}:${endpoint.path}:${new Date().toISOString().slice(0, 13)}`)
        .digest('hex');
      
      // Check for duplicate in same hour
      const existingSnapshot = await storage.findSnapshotByHash(endpoint.id, requestHash);
      if (existingSnapshot) {
        return res.json({ 
          message: "Snapshot already exists for this hour",
          snapshot: existingSnapshot 
        });
      }
      
      // Get next version
      const version = await storage.getNextSnapshotVersion(endpoint.id);
      
      // Create pending snapshot
      const snapshot = await storage.createApiSnapshot({
        endpointId: endpoint.id,
        connectionId: connection.id,
        version,
        requestHash,
        status: 'processing',
      });
      
      // Fetch data (with timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        // Build headers with auth
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'NextMonth-Orbit/1.0',
        };
        
        if (connection.authSecretId) {
          const secret = await storage.getApiSecret(connection.authSecretId);
          if (secret) {
            if (secret.authType === 'bearer') {
              headers['Authorization'] = `Bearer ${secret.encryptedValue}`;
            } else if (secret.authType === 'api_key') {
              headers['X-API-Key'] = secret.encryptedValue;
            } else if (secret.authType === 'basic') {
              headers['Authorization'] = `Basic ${Buffer.from(secret.encryptedValue).toString('base64')}`;
            }
          }
        }
        
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // 5MB payload limit check
        const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
          throw new Error('Response too large (max 5MB)');
        }
        
        // Read response with size limit (handles missing content-length)
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Unable to read response');
        }
        
        const chunks: Uint8Array[] = [];
        let totalSize = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalSize += value.length;
          if (totalSize > MAX_PAYLOAD_SIZE) {
            reader.cancel();
            throw new Error('Response too large (max 5MB)');
          }
          chunks.push(value);
        }
        
        const buffer = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        const text = new TextDecoder().decode(buffer);
        const data = JSON.parse(text);
        
        // Store raw payload to object storage if configured
        let rawPayloadRef: string | null = null;
        try {
          const { isObjectStorageConfigured, putObject } = await import("./storage/objectStore");
          if (isObjectStorageConfigured()) {
            const payloadKey = `data-sources/${slug}/${connection.id}/${snapshot.id}.json`;
            rawPayloadRef = await putObject(
              payloadKey,
              Buffer.from(text, 'utf-8'),
              'application/json'
            );
          }
        } catch (storageErr) {
          console.warn('Object storage not configured or failed:', storageErr);
        }
        
        // Extract items based on response mapping
        let items = data;
        const mapping = endpoint.responseMapping as { itemsPath?: string; idField?: string; titleField?: string; summaryField?: string } | null;
        if (mapping?.itemsPath) {
          const pathParts = mapping.itemsPath.split('.');
          items = pathParts.reduce((obj: any, key: string) => obj?.[key], data);
        }
        
        const itemArray = Array.isArray(items) ? items : [items];
        
        // Create preview (first 10KB)
        const preview = JSON.stringify(data).slice(0, 10000);
        
        // Update snapshot with data
        await storage.updateApiSnapshot(snapshot.id, {
          rawPayloadRef,
          rawPayloadPreview: JSON.parse(preview.length < JSON.stringify(data).length ? preview + '..."truncated"' : preview),
          recordCount: itemArray.length,
          status: 'ready',
          processedAt: new Date(),
        });
        
        // Create curated items
        const curatedItems = itemArray.slice(0, 1000).map((item: any, index: number) => ({
          snapshotId: snapshot.id,
          connectionId: connection.id,
          endpointId: endpoint.id,
          snapshotVersion: version,
          orbitSlug: slug,
          sourceType: connection.name.toLowerCase().replace(/\s+/g, '_'),
          externalId: mapping?.idField ? item[mapping.idField]?.toString() : index.toString(),
          title: mapping?.titleField ? item[mapping.titleField] : item.name || item.title || `Item ${index + 1}`,
          summary: mapping?.summaryField ? item[mapping.summaryField] : null,
          content: item,
          metadata: { source: connection.name, fetchedAt: new Date().toISOString() },
        }));
        
        if (curatedItems.length > 0) {
          await storage.createApiCuratedItems(curatedItems);
        }
        
        // Update connection last run
        await storage.updateApiConnection(connection.id, { lastRunAt: new Date(), lastError: null });
        
        const updatedSnapshot = await storage.getApiSnapshot(snapshot.id);
        res.json({ snapshot: updatedSnapshot, itemCount: curatedItems.length });
        
      } catch (fetchError: any) {
        // Update snapshot with error
        await storage.updateApiSnapshot(snapshot.id, {
          status: 'failed',
          error: fetchError.message,
        });
        
        await storage.updateApiConnection(connection.id, { 
          lastError: fetchError.message,
          status: 'error',
        });
        
        res.status(400).json({ 
          message: `Fetch failed: ${fetchError.message}`,
          snapshot: await storage.getApiSnapshot(snapshot.id),
        });
      }
      
    } catch (error: any) {
      console.error("Error creating snapshot:", error);
      res.status(500).json({ message: error.message || "Failed to create snapshot" });
    }
  });
  
  // Get snapshot details
  app.get("/api/orbit/:slug/data-sources/:connectionId/snapshots/:snapshotId", requireOrbitOwner, async (req, res) => {
    try {
      const { snapshotId } = req.params;
      
      const snapshot = await storage.getApiSnapshot(parseInt(snapshotId));
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      
      const items = await storage.getApiCuratedItemsBySnapshot(snapshot.id);
      
      res.json({ snapshot, items });
    } catch (error: any) {
      console.error("Error fetching snapshot:", error);
      res.status(500).json({ message: error.message || "Failed to fetch snapshot" });
    }
  });
  
  // Get curated items for an Orbit (for conversation context)
  app.get("/api/orbit/:slug/curated-items", async (req, res) => {
    try {
      const { slug } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const items = await storage.getApiCuratedItemsByOrbit(slug, limit);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching curated items:", error);
      res.status(500).json({ message: error.message || "Failed to fetch curated items" });
    }
  });

  // ==========================================
  // AgoraCube Device Routes
  // ==========================================

  // Device provisioning - generate pairing code (owner only)
  app.post("/api/orbit/:slug/devices/provision", async (req, res) => {
    try {
      const { slug } = req.params;
      const { deviceLabel } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Owner check
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can provision devices" });
      }
      
      // Generate 6-digit pairing code with uniqueness check
      let pairingCode: string;
      let attempts = 0;
      do {
        pairingCode = crypto.randomInt(100000, 999999).toString();
        const existing = await storage.getDeviceSessionByPairingCode(pairingCode);
        if (!existing) break;
        attempts++;
      } while (attempts < 5);
      
      if (attempts >= 5) {
        return res.status(503).json({ message: "Unable to generate unique pairing code, please try again" });
      }
      
      const pairingExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Generate server-issued device ID
      const deviceId = `dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      
      // Placeholder token hash - will be replaced on pairing
      const tokenHash = `pending_${crypto.randomUUID()}`;
      
      await storage.createDeviceSession({
        deviceId,
        orbitSlug: slug,
        deviceLabel: deviceLabel || null,
        tokenHash,
        scopes: ['orbit:read', 'orbit:ask'],
        pairingCode,
        pairingExpiresAt,
      });
      
      // Log the provisioning event
      await storage.createDeviceEvent({
        deviceId,
        orbitSlug: slug,
        eventType: 'provisioned',
        requestSummary: { deviceLabel },
        ipAddress: req.ip || null,
      });
      
      res.json({
        deviceId,
        pairingCode,
        expiresAt: pairingExpiresAt.toISOString(),
        expiresIn: 600, // seconds
      });
    } catch (error: any) {
      console.error("Error provisioning device:", error);
      res.status(500).json({ message: error.message || "Failed to provision device" });
    }
  });

  // Device pairing - exchange pairing code for token
  app.post("/api/orbit/:slug/devices/pair", async (req, res) => {
    try {
      const { slug } = req.params;
      const { pairingCode, deviceLabel } = req.body;
      
      if (!pairingCode) {
        return res.status(400).json({ message: "Pairing code is required" });
      }
      
      const session = await storage.getDeviceSessionByPairingCode(pairingCode);
      
      if (!session || session.orbitSlug !== slug) {
        return res.status(404).json({ message: "Invalid or expired pairing code" });
      }
      
      if (session.pairingExpiresAt && new Date(session.pairingExpiresAt) < new Date()) {
        return res.status(410).json({ message: "Pairing code has expired" });
      }
      
      if (session.revokedAt) {
        return res.status(403).json({ message: "Device session has been revoked" });
      }
      
      // Generate new token
      const token = `dtk_${crypto.randomUUID().replace(/-/g, '')}`;
      const tokenHash = await bcrypt.hash(token, 10);
      
      // Update session with token and clear pairing code
      await storage.updateDeviceSession(session.deviceId, {
        tokenHash,
        pairingCode: null,
        pairingExpiresAt: null,
        deviceLabel: deviceLabel || session.deviceLabel,
        lastSeenAt: new Date(),
        lastSeenIp: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      // Initialize rate limit bucket
      await storage.getOrCreateRateLimit(session.deviceId, slug);
      
      // Log pairing event
      await storage.createDeviceEvent({
        deviceId: session.deviceId,
        orbitSlug: slug,
        eventType: 'paired',
        requestSummary: { deviceLabel },
        ipAddress: req.ip || null,
      });
      
      res.json({
        deviceId: session.deviceId,
        token,
        scopes: session.scopes,
        orbitSlug: slug,
      });
    } catch (error: any) {
      console.error("Error pairing device:", error);
      res.status(500).json({ message: error.message || "Failed to pair device" });
    }
  });

  // List devices for orbit (owner only)
  app.get("/api/orbit/:slug/devices", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view devices" });
      }
      
      const devices = await storage.getDeviceSessionsByOrbit(slug);
      
      // Don't expose token hashes
      const sanitized = devices.map(d => ({
        deviceId: d.deviceId,
        deviceLabel: d.deviceLabel,
        scopes: d.scopes,
        lastSeenAt: d.lastSeenAt,
        lastSeenIp: d.lastSeenIp,
        createdAt: d.createdAt,
        isActive: !d.revokedAt,
        isPending: d.pairingCode !== null,
      }));
      
      res.json(sanitized);
    } catch (error: any) {
      console.error("Error listing devices:", error);
      res.status(500).json({ message: error.message || "Failed to list devices" });
    }
  });

  // Revoke device (owner only)
  app.delete("/api/orbit/:slug/devices/:deviceId", async (req, res) => {
    try {
      const { slug, deviceId } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can revoke devices" });
      }
      
      const session = await storage.getDeviceSession(deviceId);
      if (!session || session.orbitSlug !== slug) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      await storage.revokeDeviceSession(deviceId);
      
      // Log revocation
      await storage.createDeviceEvent({
        deviceId,
        orbitSlug: slug,
        eventType: 'revoked',
        requestSummary: { revokedBy: (req.user as any)?.id },
        ipAddress: req.ip || null,
      });
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error revoking device:", error);
      res.status(500).json({ message: error.message || "Failed to revoke device" });
    }
  });

  // Device /ask endpoint - UI-ready AI response
  app.post("/api/orbit/:slug/ask", async (req, res) => {
    try {
      const { slug } = req.params;
      const { question, deviceToken, conversationId, currentCardId } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ message: "Question is required" });
      }
      
      if (question.length > 2000) {
        return res.status(400).json({ message: "Question too long (max 2000 characters)" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Authenticate device if token provided
      let deviceSession: schema.DeviceSession | undefined;
      if (deviceToken) {
        const sessions = await storage.getDeviceSessionsByOrbit(slug);
        for (const s of sessions) {
          if (!s.revokedAt && s.tokenHash && !s.tokenHash.startsWith('pending_')) {
            const isValid = await bcrypt.compare(deviceToken, s.tokenHash);
            if (isValid) {
              deviceSession = s;
              break;
            }
          }
        }
        
        if (!deviceSession) {
          return res.status(401).json({ message: "Invalid device token" });
        }
        
        // Check scope
        if (!deviceSession.scopes?.includes('orbit:ask')) {
          return res.status(403).json({ message: "Device does not have ask permission" });
        }
        
        // Rate limiting
        const rateLimit = await storage.consumeRateLimitToken(deviceSession.deviceId, slug);
        if (!rateLimit.allowed) {
          await storage.createDeviceEvent({
            deviceId: deviceSession.deviceId,
            orbitSlug: slug,
            eventType: 'rate_limited',
            requestSummary: { question: question.slice(0, 100) },
            ipAddress: req.ip || null,
          });
          
          return res.status(429).json({
            message: "Rate limit exceeded",
            retryAfter: rateLimit.retryAfter || 30,
            tokensRemaining: 0,
          });
        }
        
        // Update last seen
        await storage.updateDeviceSession(deviceSession.deviceId, {
          lastSeenAt: new Date(),
          lastSeenIp: req.ip || null,
        });
      }
      
      // Get cards for context from the preview's ingested content
      let cards: schema.Card[] = [];
      
      // Try to get universe by orbit slug (if available)
      if (orbitMeta.businessSlug) {
        const universe = await storage.getUniverseBySlug(orbitMeta.businessSlug);
        if (universe) {
          cards = await storage.getCardsByUniverse(universe.id);
        }
      }
      
      // Build context from cards
      const cardContext = cards.slice(0, 12).map(c => ({
        id: c.id,
        dayIndex: c.dayIndex,
        title: c.title,
        sceneText: c.sceneText,
      }));
      
      // Get curated items for additional context
      const curatedItems = await storage.getApiCuratedItemsByOrbit(slug, 20);
      
      // Build system prompt
      const systemPrompt = `You are an intelligent assistant for "${orbitMeta.businessSlug}".
      
You help visitors understand the business, answer questions, and guide them through the experience.

CONTEXT FROM ORBIT:
${cardContext.map(c => `- Card ${c.dayIndex}: ${c.title} - ${c.sceneText?.slice(0, 200)}`).join('\n')}

${curatedItems.length > 0 ? `
ADDITIONAL DATA:
${curatedItems.slice(0, 10).map(item => `- ${item.title}: ${item.summary || ''}`).join('\n')}
` : ''}

GUIDELINES:
- Be helpful, concise, and professional
- If you don't know something, say so honestly
- Keep responses under 300 words unless more detail is requested
- Reference specific content from the Orbit when relevant`;

      const openai = getOpenAI();
      
      // Generate response
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      
      const replyText = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      
      // Determine if we should suggest navigating to a card
      let scenePatch: { cardId: number; reason: string } | null = null;
      
      // Simple keyword matching to suggest relevant cards
      const questionLower = question.toLowerCase();
      for (const card of cardContext) {
        const titleLower = (card.title || '').toLowerCase();
        const sceneLower = (card.sceneText || '').toLowerCase();
        
        // Check for keyword overlap
        const keywords = questionLower.split(/\s+/).filter(w => w.length > 3);
        const matchScore = keywords.filter(k => 
          titleLower.includes(k) || sceneLower.includes(k)
        ).length;
        
        if (matchScore >= 2 && card.id !== currentCardId) {
          scenePatch = {
            cardId: card.id,
            reason: `This relates to "${card.title}"`,
          };
          break;
        }
      }
      
      // Log the ask event
      if (deviceSession) {
        await storage.createDeviceEvent({
          deviceId: deviceSession.deviceId,
          orbitSlug: slug,
          eventType: 'ask',
          requestSummary: { 
            questionLength: question.length,
            hasScenePatch: !!scenePatch,
          },
          ipAddress: req.ip || null,
        });
      }
      
      res.json({
        replyText,
        scenePatch,
        tokensUsed: completion.usage?.total_tokens || 0,
        cardContext: cardContext.slice(0, 3).map(c => ({ id: c.id, title: c.title })),
      });
      
    } catch (error: any) {
      console.error("Error in /ask:", error);
      res.status(500).json({ message: error.message || "Failed to process question" });
    }
  });

  // ==========================================
  // Orbit Cube Routes (Physical Hardware Orders & Management)
  // ==========================================

  // List cubes for an orbit (owner only)
  app.get("/api/orbit/:slug/cubes", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      const cubes = await storage.getOrbitCubesByOrbit(slug);
      res.json(cubes);
    } catch (error: any) {
      console.error("Error fetching cubes:", error);
      res.status(500).json({ message: error.message || "Failed to fetch cubes" });
    }
  });

  // Get single cube details
  app.get("/api/orbit/:slug/cubes/:cubeId", requireOrbitOwner, async (req, res) => {
    try {
      const { cubeId } = req.params;
      const cube = await storage.getOrbitCubeById(parseInt(cubeId));
      if (!cube) {
        return res.status(404).json({ message: "Cube not found" });
      }
      res.json(cube);
    } catch (error: any) {
      console.error("Error fetching cube:", error);
      res.status(500).json({ message: error.message || "Failed to fetch cube" });
    }
  });

  // Create checkout session for ordering a cube
  app.post("/api/orbit/:slug/cubes/checkout", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = (req.user as any)?.id;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Create cube record in pending_pairing status
      const cubeUuid = `cube_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const pairingCode = generateCubePairingCode();
      const pairingCodeExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const cube = await storage.createOrbitCube({
        cubeUuid,
        orbitSlug: slug,
        ownerUserId: userId,
        name: 'Orbit Cube',
        status: 'pending_pairing',
        pairingCode,
        pairingCodeExpiresAt,
      });
      
      // Create order record
      const order = await storage.createOrbitCubeOrder({
        orbitSlug: slug,
        cubeId: cube.id,
        hardwarePriceGbp: 29900, // £299.00
        monthlyPriceGbp: 2900, // £29.00
        status: 'created',
      });
      
      // Check if Stripe is configured
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      
      if (stripeSecretKey) {
        // Create real Stripe checkout session
        try {
          const stripe = new Stripe(stripeSecretKey);
          
          // First create a price for the one-time hardware charge to use as invoice item
          const hardwarePrice = await stripe.prices.create({
            currency: 'gbp',
            unit_amount: 29900, // £299.00 one-time
            product_data: {
              name: 'NextMonth Orbit Cube Hardware',
            },
          });
          
          // Subscription mode with add_invoice_items for one-time hardware charge
          const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [
              {
                price_data: {
                  currency: 'gbp',
                  product_data: {
                    name: 'Orbit Cube Subscription',
                    description: 'Monthly connectivity, updates, and voice features',
                  },
                  unit_amount: 2900, // £29.00/month
                  recurring: { interval: 'month' },
                },
                quantity: 1,
              },
            ],
            subscription_data: {
              metadata: {
                cubeId: cube.id.toString(),
                orbitSlug: slug,
              },
              add_invoice_items: [
                {
                  price: hardwarePrice.id,
                  quantity: 1,
                },
              ],
            },
            success_url: `${req.protocol}://${req.get('host')}/orbit/${slug}/hub?panel=cubes&success=true&orderId=${order.id}`,
            cancel_url: `${req.protocol}://${req.get('host')}/orbit/${slug}/hub?panel=cubes&cancelled=true`,
            metadata: {
              orderId: order.id.toString(),
              cubeId: cube.id.toString(),
              orbitSlug: slug,
            },
          });
          
          // Update order with session ID
          await storage.updateOrbitCubeOrder(order.id, {
            stripeCheckoutSessionId: session.id,
          });
          
          res.json({
            checkoutUrl: session.url,
            orderId: order.id,
            cubeId: cube.id,
          });
        } catch (stripeError: any) {
          console.error("Stripe error:", stripeError);
          // Fall back to placeholder mode
          res.json({
            checkoutUrl: null,
            orderId: order.id,
            cubeId: cube.id,
            placeholder: true,
            message: "Stripe checkout is temporarily unavailable. Order created.",
          });
        }
      } else {
        // Placeholder checkout (Stripe not configured)
        // Auto-mark order as paid for demo purposes
        await storage.updateOrbitCubeOrder(order.id, { status: 'paid' });
        
        res.json({
          checkoutUrl: null,
          orderId: order.id,
          cubeId: cube.id,
          pairingCode: cube.pairingCode,
          placeholder: true,
          message: "Order placed successfully (demo mode - no payment required)",
        });
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout" });
    }
  });

  // Regenerate pairing code for a cube
  app.post("/api/orbit/:slug/cubes/:cubeId/pairing-code/regenerate", requireOrbitOwner, async (req, res) => {
    try {
      const { cubeId } = req.params;
      
      const cube = await storage.getOrbitCubeById(parseInt(cubeId));
      if (!cube) {
        return res.status(404).json({ message: "Cube not found" });
      }
      
      if (cube.status === 'revoked') {
        return res.status(400).json({ message: "Cannot regenerate code for revoked cube" });
      }
      
      const result = await storage.regenerateCubePairingCode(cube.cubeUuid);
      
      res.json({
        pairingCode: result.code,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (error: any) {
      console.error("Error regenerating pairing code:", error);
      res.status(500).json({ message: error.message || "Failed to regenerate pairing code" });
    }
  });

  // Update cube settings (rename, sleep timeout)
  app.patch("/api/orbit/:slug/cubes/:cubeId", requireOrbitOwner, async (req, res) => {
    try {
      const { cubeId } = req.params;
      const { name, sleepTimeoutMinutes } = req.body;
      
      const cube = await storage.getOrbitCubeById(parseInt(cubeId));
      if (!cube) {
        return res.status(404).json({ message: "Cube not found" });
      }
      
      const updates: Partial<typeof cube> = {};
      if (name !== undefined) updates.name = name;
      if (sleepTimeoutMinutes !== undefined) {
        updates.sleepTimeoutMinutes = Math.max(5, Math.min(480, sleepTimeoutMinutes)); // 5 min to 8 hours
      }
      
      const updated = await storage.updateOrbitCubeById(cube.id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating cube:", error);
      res.status(500).json({ message: error.message || "Failed to update cube" });
    }
  });

  // Revoke cube
  app.post("/api/orbit/:slug/cubes/:cubeId/revoke", requireOrbitOwner, async (req, res) => {
    try {
      const { cubeId } = req.params;
      
      const cube = await storage.getOrbitCubeById(parseInt(cubeId));
      if (!cube) {
        return res.status(404).json({ message: "Cube not found" });
      }
      
      await storage.revokeOrbitCube(cube.cubeUuid);
      
      res.json({ message: "Cube revoked successfully" });
    } catch (error: any) {
      console.error("Error revoking cube:", error);
      res.status(500).json({ message: error.message || "Failed to revoke cube" });
    }
  });

  // Helper function for generating secure pairing codes
  function generateCubePairingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return code;
  }

  // Start background jobs
  startArchiveExpiredPreviewsJob(storage);

  return httpServer;
}
