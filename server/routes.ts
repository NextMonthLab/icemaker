import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { sql, eq, desc, gte, isNotNull } from "drizzle-orm";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
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
import { startWeeklyKnowledgeCoachJob } from "./jobs/weeklyKnowledgeCoach";
import { getFullEntitlements } from "./entitlements";
import { 
  FREE_CONVERSATION_LIMIT, 
  FREE_CONVERSATION_SOFT_LIMIT, 
  conversationLimitCopy 
} from "@shared/uxCopy";
import { analyticsRateLimiter, activationRateLimiter, chatRateLimiter, getClientIp } from "./rateLimit";
import { logAuthFailure, logAccessDenied, logTokenError, logAdminAction } from "./securityLogger";
import { analyticsRequestValidator, chatRequestValidator, chatMessageValidator, analyticsMetadataValidator, analyticsTypeValidator, analyticsMetadataStringValidator, adminRequestValidator, adminReasonValidator } from "./requestValidation";
import { canReadUniverse, canWriteUniverse, canReadIcePreview, canWriteIcePreview, canReadOrbit, canWriteOrbit, logAuditEvent, extractRequestInfo } from "./authPolicies";
import { ingestUrlAndGenerateTiles, groupTilesByCategory } from "./services/topicTileGenerator";
import { saveOrbitIngestion, loadOrbitIngestion, getOrbitTiles } from "./services/orbitTileStorage";
import { generateHealthReport, getContract } from "./services/orbitHealthRunner";

function getAppBaseUrl(req: any): string {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
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

// ============ SCREENPLAY DETECTION ============
// Detects if content follows screenplay format (INT./EXT., character names in CAPS, dialogue structure)
function detectScreenplayFormat(text: string): boolean {
  const normalizedText = text.slice(0, 5000); // Check first 5000 chars
  
  // Strong indicators of screenplay format
  const sceneHeadingPattern = /^(INT\.|EXT\.|INT\/EXT\.)[\s]+.+[-–—].+$/gm;
  const characterCuePattern = /^[A-Z][A-Z\s]+(\s*\(.*\))?\s*$/gm;
  const fadePattern = /^(FADE IN|FADE OUT|FADE TO BLACK|CUT TO|DISSOLVE TO)/gm;
  const actionBlockPattern = /^[A-Z][a-z].+\.$|^[A-Z][a-z].+\.\s*$/gm;
  
  const sceneHeadings = (normalizedText.match(sceneHeadingPattern) || []).length;
  const characterCues = (normalizedText.match(characterCuePattern) || []).length;
  const fadeMatches = (normalizedText.match(fadePattern) || []).length;
  
  // Check for "FADE IN" at start (very strong screenplay indicator)
  const hasFadeIn = /^FADE IN/m.test(normalizedText);
  
  // Check for mixed case text after character cues (indicates dialogue)
  const hasDialogueStructure = /^[A-Z]{2,}(\s*\(.*\))?\s*\n[a-z]/m.test(normalizedText);
  
  // Strong evidence: 3+ scene headings OR (FADE IN + character cues)
  if (sceneHeadings >= 3) return true;
  if (hasFadeIn && characterCues >= 3) return true;
  if (fadeMatches >= 1 && sceneHeadings >= 1 && characterCues >= 5) return true;
  if (sceneHeadings >= 1 && characterCues >= 8 && hasDialogueStructure) return true;
  
  return false;
}

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
  
  // Trust proxy for secure cookies behind TLS-terminating proxies (Render, Replit, etc.)
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.set("trust proxy", 1);
  }
  
  // Session middleware with PostgreSQL store for persistence across restarts
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "storyflix-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true, // Prevents client-side JavaScript access
        sameSite: isProduction ? "strict" : "lax", // CSRF protection: strict in prod, lax for dev
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
    const ip = getClientIp(req);
    const userId = req.user?.id;
    logAccessDenied(req.path, 'Admin access required', undefined, undefined, ip, userId);
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

  app.get("/api/me/orbits", requireAuth, async (req, res) => {
    try {
      const orbits = await storage.getOrbitsByOwner(req.user!.id);
      
      const orbitsWithStats = await Promise.all(
        orbits.map(async (orbit) => {
          const stats = await storage.getOrbitAnalyticsSummary(orbit.businessSlug, 30);
          const leads = await storage.getOrbitLeads(orbit.businessSlug, 100);
          return {
            businessSlug: orbit.businessSlug,
            sourceUrl: orbit.sourceUrl,
            generationStatus: orbit.generationStatus,
            previewId: orbit.previewId,
            customTitle: orbit.customTitle,
            customDescription: orbit.customDescription,
            planTier: orbit.planTier,
            strengthScore: orbit.strengthScore ?? 0,
            verifiedAt: orbit.verifiedAt,
            lastUpdated: orbit.lastUpdated,
            stats: {
              visits: stats.visits,
              interactions: stats.interactions,
              conversations: stats.conversations,
              iceViews: stats.iceViews,
              leads: leads.length,
            },
          };
        })
      );
      
      res.json({ orbits: orbitsWithStats });
    } catch (error) {
      console.error("Error fetching owned orbits:", error);
      res.status(500).json({ message: "Error fetching owned orbits" });
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
  
  // Update first-run tour state (partial update - doesn't require full profile)
  app.patch("/api/me/onboarding/tour", requireAuth, async (req, res) => {
    try {
      const { onboardingCompleted, onboardingDismissed, onboardingPath } = req.body;
      
      // Validate path if provided
      const validPaths = ['orbit-first', 'ice-first'];
      if (onboardingPath && !validPaths.includes(onboardingPath)) {
        return res.status(400).json({ message: "Invalid onboarding path" });
      }
      
      // Get existing profile or create minimal one
      let profile = await storage.getUserOnboardingProfile(req.user!.id);
      
      if (!profile) {
        // Create a minimal profile if none exists
        profile = await storage.upsertUserOnboardingProfile({
          userId: req.user!.id,
          persona: 'other', // default placeholder
          onboardingCompleted: false,
          onboardingDismissed: false,
        });
      }
      
      // Build update object with only provided fields
      const updates: any = {};
      if (typeof onboardingCompleted === 'boolean') {
        updates.onboardingCompleted = onboardingCompleted;
        if (onboardingCompleted) {
          updates.onboardingCompletedAt = new Date();
        }
      }
      if (typeof onboardingDismissed === 'boolean') {
        updates.onboardingDismissed = onboardingDismissed;
      }
      if (onboardingPath) {
        updates.onboardingPath = onboardingPath;
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        profile = await storage.upsertUserOnboardingProfile({
          ...profile,
          ...updates,
        });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error updating tour state:", error);
      res.status(500).json({ message: "Error updating tour state" });
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
      const allUniverses = await storage.getAllUniverses();
      const user = req.user as schema.User | undefined;
      
      // Filter universes based on visibility and ownership
      const visibleUniverses = allUniverses.filter(universe => {
        // Admins see everything
        if (user?.isAdmin || user?.role === 'admin') return true;
        // Public universes visible to all
        if (universe.visibility === 'public') return true;
        // Unlisted universes visible to all (discoverable by URL)
        if (universe.visibility === 'unlisted') return true;
        // Private universes only visible to owner
        if (user && universe.ownerUserId === user.id) return true;
        return false;
      });
      
      res.json(visibleUniverses);
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
      
      // Check read permission
      const user = req.user as schema.User | undefined;
      const policy = canReadUniverse(user, universe);
      if (!policy.allowed) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'universe', String(id), {
          userId: user?.id,
          userIp,
          userAgent,
          details: { action: 'read', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason });
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
      
      // Check if Ice is active - only active experiences are publicly served
      if (universe.iceStatus !== 'active') {
        if (universe.iceStatus === 'paused') {
          const isOwner = req.user && universe.creatorId === req.user.id;
          return res.status(410).json({
            message: isOwner 
              ? "Paused due to subscription status. Reactivate your plan to restore this experience."
              : "This experience is temporarily unavailable.",
            status: "paused",
            reason: "paused_subscription",
            name: universe.name,
            ...(isOwner ? {} : { cta: "If you own this experience, sign in to reactivate." }),
          });
        }
        // Draft or other status - not publicly accessible
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
      
      // Generate signed public access token for analytics/chat ingestion
      const { generatePublicAccessToken } = await import('./publicAccessToken');
      const publicAccessToken = generatePublicAccessToken(universe.id, 'story');
      
      res.json({
        universe,
        cards: publishedCards,
        characters,
        creator,
        publicAccessToken, // Client must include this token for analytics/chat calls
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
  
  // ============ ANALYTICS ROUTES ============
  
  app.post("/api/public/analytics/event", analyticsRateLimiter, analyticsRequestValidator, analyticsTypeValidator, analyticsMetadataValidator, analyticsMetadataStringValidator, async (req, res) => {
    try {
      const { type, universeId, cardId, metadata, publicAccessToken } = req.body;
      const ip = getClientIp(req);
      
      if (!type || !universeId) {
        return res.status(400).json({ message: "type and universeId are required" });
      }
      
      // Validate public access token to prevent cross-tenant analytics poisoning
      if (!publicAccessToken) {
        logAuthFailure('/api/public/analytics/event', 'Missing access token', 'story', universeId, ip);
        return res.status(401).json({ message: "Public access token required" });
      }
      
      const { validateStoryToken } = await import('./publicAccessToken');
      if (!validateStoryToken(publicAccessToken, universeId)) {
        logTokenError('/api/public/analytics/event', 'Invalid or mismatched token', 'story', universeId, ip);
        return res.status(403).json({ message: "Invalid access token" });
      }
      
      // Verify universe exists and is active
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Experience not found" });
      }
      if (universe.iceStatus !== 'active') {
        return res.status(410).json({ message: "Experience is not active" });
      }
      
      const validTypes = ['experience_view', 'card_view', 'conversation_start', 'question_asked', 'chat_message'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid event type" });
      }
      
      await storage.logEvent({
        type,
        userId: (req.user as any)?.id || null,
        metadataJson: {
          universeId,
          cardId,
          ...metadata,
        },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging analytics event:", error);
      res.status(500).json({ message: "Error logging event" });
    }
  });
  
  app.get("/api/analytics/experience/:id/summary", requireAdmin, async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const days = parseInt(req.query.days as string) || 30;
      
      const summary = await storage.getExperienceAnalyticsSummary(universeId, days);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ message: "Error fetching analytics" });
    }
  });

  // ============ ADMIN EMERGENCY CONTROLS ============
  
  // Admin: Emergency pause any experience (bypasses ownership checks)
  app.post("/api/admin/experiences/:id/emergency-pause", requireAdmin, adminRequestValidator, adminReasonValidator, async (req, res) => {
    try {
      const universeId = parseInt(req.params.id);
      const { reason } = req.body;
      
      if (isNaN(universeId)) {
        return res.status(400).json({ message: "Invalid experience ID" });
      }
      
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Experience not found" });
      }
      
      // Log the admin action
      logAdminAction('/api/admin/experiences/:id/emergency-pause', 
        `Emergency pause: ${reason || 'No reason provided'}`, 
        req.user!.id, 
        'experience', 
        universeId,
        { previousStatus: universe.iceStatus, reason }
      );
      
      const updated = await storage.pauseIce(universeId);
      
      res.json({
        success: true,
        message: "Experience emergency paused",
        iceStatus: updated?.iceStatus,
        pausedAt: updated?.pausedAt,
        pausedBy: req.user!.id,
        reason,
      });
    } catch (error) {
      console.error("Error emergency pausing experience:", error);
      res.status(500).json({ message: "Error pausing experience" });
    }
  });

  // Admin: Emergency disable orbit public access
  app.post("/api/admin/orbits/:slug/emergency-disable", requireAdmin, adminRequestValidator, adminReasonValidator, async (req, res) => {
    try {
      const { slug } = req.params;
      const { reason } = req.body;
      
      const orbit = await storage.getOrbitMeta(slug);
      if (!orbit) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Log the admin action
      logAdminAction('/api/admin/orbits/:slug/emergency-disable',
        `Emergency disable orbit: ${reason || 'No reason provided'}`,
        req.user!.id,
        'orbit',
        slug,
        { previousStatus: orbit.isActive, reason }
      );
      
      // Disable the orbit by setting isActive to false
      await storage.updateOrbitMeta(slug, { isActive: false });
      
      res.json({
        success: true,
        message: "Orbit emergency disabled",
        disabledBy: req.user!.id,
        reason,
      });
    } catch (error) {
      console.error("Error emergency disabling orbit:", error);
      res.status(500).json({ message: "Error disabling orbit" });
    }
  });

  // Admin: Emergency archive/delete preview
  app.post("/api/admin/previews/:id/emergency-archive", requireAdmin, adminRequestValidator, adminReasonValidator, async (req, res) => {
    try {
      const previewId = req.params.id;
      const { reason } = req.body;
      
      const preview = await storage.getPreviewInstance(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Log the admin action
      logAdminAction('/api/admin/previews/:id/emergency-archive',
        `Emergency archive preview: ${reason || 'No reason provided'}`,
        req.user!.id,
        'preview',
        previewId,
        { previousStatus: preview.status, reason }
      );
      
      await storage.archivePreviewInstance(previewId);
      
      res.json({
        success: true,
        message: "Preview emergency archived",
        archivedBy: req.user!.id,
        reason,
      });
    } catch (error) {
      console.error("Error emergency archiving preview:", error);
      res.status(500).json({ message: "Error archiving preview" });
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
            // Parse PDF using PDFParse class
            const pdfParseModule = await import("pdf-parse") as any;
            const PDFParse = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse;
            if (!PDFParse) {
              throw new Error("PDFParse class not found in pdf-parse module");
            }
            const parser = new PDFParse({ data: req.file.buffer });
            await parser.load();
            const textResult = await parser.getText();
            let extractedText = '';
            if (typeof textResult === 'string') {
              extractedText = textResult;
            } else if (textResult && Array.isArray(textResult.pages)) {
              extractedText = textResult.pages.map((p: any) => p.text || '').join('\n\n');
            } else if (textResult && typeof textResult === 'object') {
              extractedText = JSON.stringify(textResult);
            } else {
              extractedText = String(textResult || '');
            }
            fileContent = extractedText.slice(0, 50000);
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
  
  app.post("/api/chat/threads/:threadId/messages", requireAuth, chatRateLimiter, async (req, res) => {
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
  
  app.post("/api/chat/send", requireAuth, chatRateLimiter, async (req, res) => {
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
          prompt: `${prompt}. No text, words, letters, titles, or captions in the video.`,
          imageUrl: sourceImage,
          negativePrompt: "blurry, low quality, distorted, watermark, text, words, letters, titles, captions, typography, writing",
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

  // ============ ADMIN COMMAND CENTER ROUTES ============
  
  // Get platform-wide metrics for admin dashboard
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    console.log("[admin-stats] Fetching platform metrics for user:", (req.user as any)?.username);
    try {
      const metrics = await storage.getPlatformMetrics();
      console.log("[admin-stats] Metrics result:", JSON.stringify(metrics));
      res.json(metrics);
    } catch (error) {
      console.error("[admin-stats] Error fetching platform metrics:", error);
      res.status(500).json({ message: "Error fetching platform metrics" });
    }
  });
  
  // Get all users for admin user management with detailed stats
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Get orbit ownership counts per user
      const orbitCounts = await db
        .select({
          ownerId: schema.orbitMeta.ownerId,
          count: sql<number>`count(*)`,
        })
        .from(schema.orbitMeta)
        .where(isNotNull(schema.orbitMeta.ownerId))
        .groupBy(schema.orbitMeta.ownerId);
      
      const orbitCountMap = new Map(orbitCounts.map(o => [o.ownerId, Number(o.count)]));
      
      // Get ICE draft counts per user
      const iceCounts = await db
        .select({
          userId: schema.iceDrafts.userId,
          count: sql<number>`count(*)`,
        })
        .from(schema.iceDrafts)
        .groupBy(schema.iceDrafts.userId);
      
      const iceCountMap = new Map(iceCounts.map(i => [i.userId, Number(i.count)]));
      
      // Return users without password hash, with orbit and ICE counts
      const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        orbitCount: orbitCountMap.get(u.id) || 0,
        iceCount: iceCountMap.get(u.id) || 0,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });
  
  // Get all industry orbits for admin management
  app.get("/api/admin/industry-orbits", requireAdmin, async (req, res) => {
    try {
      const orbits = await storage.getIndustryOrbits();
      res.json(orbits);
    } catch (error) {
      console.error("Error fetching industry orbits:", error);
      res.status(500).json({ message: "Error fetching industry orbits" });
    }
  });

  // Get all orbits for admin with basic stats
  app.get("/api/admin/all-orbits", requireAdmin, async (req, res) => {
    try {
      const allOrbits = await db.query.orbitMeta.findMany({
        orderBy: [desc(schema.orbitMeta.lastUpdated)],
      });
      
      // Get analytics for each orbit
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const analyticsData = await db
        .select({
          businessSlug: schema.orbitAnalytics.businessSlug,
          visits: sql<number>`COALESCE(SUM(visits), 0)`,
          conversations: sql<number>`COALESCE(SUM(conversations), 0)`,
        })
        .from(schema.orbitAnalytics)
        .where(gte(schema.orbitAnalytics.date, thirtyDaysAgo))
        .groupBy(schema.orbitAnalytics.businessSlug);
      
      const analyticsMap = new Map(
        analyticsData.map(a => [a.businessSlug, { visits: Number(a.visits), conversations: Number(a.conversations) }])
      );
      
      const orbitsWithStats = allOrbits.map(o => ({
        businessSlug: o.businessSlug,
        businessName: o.customTitle || o.businessSlug,
        sourceUrl: o.sourceUrl,
        orbitType: o.orbitType,
        generationStatus: o.generationStatus,
        planTier: o.planTier,
        lastUpdated: o.lastUpdated,
        visits30d: analyticsMap.get(o.businessSlug)?.visits || 0,
        conversations30d: analyticsMap.get(o.businessSlug)?.conversations || 0,
      }));
      
      res.json(orbitsWithStats);
    } catch (error) {
      console.error("Error fetching all orbits:", error);
      res.status(500).json({ message: "Error fetching all orbits" });
    }
  });

  // ============ ORBIT HEALTH DASHBOARD ROUTES ============
  
  app.get("/api/admin/orbits/health", requireAdmin, async (req, res) => {
    try {
      const orbitSlug = req.query.slug as string | undefined;
      const report = await generateHealthReport(orbitSlug);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating health report:", error);
      res.status(500).json({ message: "Error generating health report", error: error.message });
    }
  });
  
  app.get("/api/admin/orbits/health/contract", requireAdmin, async (req, res) => {
    try {
      const contract = getContract();
      res.json(contract);
    } catch (error: any) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Error fetching contract", error: error.message });
    }
  });
  
  app.get("/api/admin/orbits/health/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const report = await generateHealthReport(slug);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating health report for orbit:", error);
      res.status(500).json({ message: "Error generating health report", error: error.message });
    }
  });

  // ============ ORBIT → ICE FLYWHEEL ROUTES ============
  
  // Create ICE draft from Orbit context (admin or influencer only)
  app.post("/api/orbit/:slug/ice-drafts", async (req, res) => {
    try {
      const user = req.user as schema.User | undefined;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Check if user is admin or influencer
      const canCreate = user.role === 'admin' || user.role === 'influencer' || user.isAdmin;
      if (!canCreate) {
        return res.status(403).json({ message: "Only admins and influencers can create ICE from Orbit" });
      }
      
      const { slug } = req.params;
      const orbit = await storage.getOrbitMetaBySlug(slug);
      if (!orbit) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const { 
        sourceMessageId,
        viewType = 'none',
        viewData,
        summaryText,
        sources,
        templateType = 'custom',
        deepLink,
        orbitViewState,
        title,
      } = req.body;
      
      if (!summaryText) {
        return res.status(400).json({ message: "Summary text is required" });
      }
      
      // Create the ICE draft
      const draft = await storage.createIceDraft({
        userId: user.id,
        source: 'orbit',
        orbitSlug: slug,
        orbitType: orbit.orbitType || 'standard',
        sourceMessageId,
        viewType,
        viewData,
        summaryText,
        sources,
        templateType,
        deepLink: deepLink || `/orbit/${slug}`,
        orbitViewState,
        headline: title,
        status: 'draft',
      });
      
      res.status(201).json(draft);
    } catch (error) {
      console.error("Error creating ICE draft:", error);
      res.status(500).json({ message: "Error creating ICE draft" });
    }
  });
  
  // Get ICE drafts for an Orbit
  app.get("/api/orbit/:slug/ice-drafts", async (req, res) => {
    try {
      const user = req.user as schema.User | undefined;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { slug } = req.params;
      
      // Query ice drafts by orbit slug
      const drafts = await db.query.iceDrafts.findMany({
        where: eq(schema.iceDrafts.orbitSlug, slug),
        orderBy: [desc(schema.iceDrafts.createdAt)],
      });
      
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching ICE drafts:", error);
      res.status(500).json({ message: "Error fetching ICE drafts" });
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
  
  // ============================================================
  // PRICING CONFIGURATION (Single Source of Truth)
  // ============================================================
  const PRICING_CONFIG = {
    basePricePerIce: 9.99,
    mediaPerCard: {
      images: 2.99,
      video: 4.99,
      voiceover: 2.99,
    },
    mediaFlat: {
      music: 1.99,
    },
    interactivityPerNode: 0.99,
    sceneExpansionPerScene: 1.99,
    plans: {
      pro: { monthlyPrice: 19, stripePriceId: "price_1SjorwDrvHce9MJuRiVY0xFs" },
      business: { monthlyPrice: 49, stripePriceId: "price_1SjorwDrvHce9MJuZzNh4YVo" },
    },
  };

  // Calculate checkout totals (server-side authoritative pricing)
  app.post("/api/checkout/calculate", async (req, res) => {
    try {
      const { previewId, mediaOptions, outputChoice, interactivityNodeCount, expansionScope, selectedPlan } = req.body;

      if (!previewId || typeof previewId !== "string") {
        return res.status(400).json({ message: "Preview ID required" });
      }

      const validExpansionScopes = ["preview_only", "full_story", "act1", "selected"];
      const validOutputChoices = ["download", "publish", null];
      const validPlans = ["pro", "business", null];

      const safeInteractivityNodeCount = Math.max(0, Math.floor(Number(interactivityNodeCount) || 0));
      const safeExpansionScope = validExpansionScopes.includes(expansionScope) ? expansionScope : "preview_only";
      const safeOutputChoice = validOutputChoices.includes(outputChoice) ? outputChoice : null;
      const safePlan = validPlans.includes(selectedPlan) ? selectedPlan : null;
      const safeMediaOptions = {
        images: mediaOptions?.images === true,
        video: mediaOptions?.video === true,
        music: mediaOptions?.music === true,
        voiceover: mediaOptions?.voiceover === true,
      };

      // Try ICE preview first (ice_xxx format), then fall back to preview instance (UUID format)
      let preview: any = await storage.getIcePreview(previewId);
      if (!preview) {
        preview = await storage.getPreviewInstance(previewId);
      }
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      const cards = preview.cards || [];
      const cardCount = Array.isArray(cards) ? cards.length : 0;

      const sceneMap = preview.sceneMap as { totalScenes?: number; generatedScenes?: number } | null;
      const totalScenes = sceneMap?.totalScenes || cardCount;
      const generatedScenes = sceneMap?.generatedScenes || cardCount;

      let scenesToExpand = 0;
      if (safeExpansionScope === "full_story") {
        scenesToExpand = Math.max(0, totalScenes - generatedScenes);
      } else if (safeExpansionScope === "act1") {
        const act1Scenes = Math.ceil(totalScenes / 3);
        scenesToExpand = Math.max(0, act1Scenes - generatedScenes);
      }

      const breakdown = {
        basePrice: PRICING_CONFIG.basePricePerIce,
        cardCount,
        mediaBreakdown: {
          images: safeMediaOptions.images ? PRICING_CONFIG.mediaPerCard.images * cardCount : 0,
          video: safeMediaOptions.video ? PRICING_CONFIG.mediaPerCard.video * cardCount : 0,
          voiceover: safeMediaOptions.voiceover ? PRICING_CONFIG.mediaPerCard.voiceover * cardCount : 0,
          music: safeMediaOptions.music ? PRICING_CONFIG.mediaFlat.music : 0,
        },
        interactivity: safeOutputChoice === "publish" ? safeInteractivityNodeCount * PRICING_CONFIG.interactivityPerNode : 0,
        sceneExpansion: scenesToExpand * PRICING_CONFIG.sceneExpansionPerScene,
        subscription: 0,
        subscriptionPlan: null as string | null,
      };

      if (safeOutputChoice === "publish" && safePlan && PRICING_CONFIG.plans[safePlan as keyof typeof PRICING_CONFIG.plans]) {
        const planConfig = PRICING_CONFIG.plans[safePlan as keyof typeof PRICING_CONFIG.plans];
        breakdown.subscription = planConfig.monthlyPrice;
        breakdown.subscriptionPlan = safePlan;
      }

      const mediaTotal = breakdown.mediaBreakdown.images + breakdown.mediaBreakdown.video + breakdown.mediaBreakdown.voiceover + breakdown.mediaBreakdown.music;
      const oneTimeTotal = breakdown.basePrice + mediaTotal + breakdown.interactivity + breakdown.sceneExpansion;
      const total = oneTimeTotal + breakdown.subscription;

      res.json({
        breakdown,
        oneTimeTotal,
        subscriptionTotal: breakdown.subscription,
        grandTotal: total,
        pricingConfig: {
          basePricePerIce: PRICING_CONFIG.basePricePerIce,
          mediaPerCard: PRICING_CONFIG.mediaPerCard,
          mediaFlat: PRICING_CONFIG.mediaFlat,
          interactivityPerNode: PRICING_CONFIG.interactivityPerNode,
          sceneExpansionPerScene: PRICING_CONFIG.sceneExpansionPerScene,
          plans: Object.entries(PRICING_CONFIG.plans).map(([name, config]) => ({
            name,
            monthlyPrice: config.monthlyPrice,
          })),
        },
      });
    } catch (error) {
      console.error("Error calculating checkout:", error);
      res.status(500).json({ message: "Error calculating checkout" });
    }
  });

  // Get pricing configuration (for initial page load)
  app.get("/api/checkout/config", async (_req, res) => {
    res.json({
      basePricePerIce: PRICING_CONFIG.basePricePerIce,
      mediaPerCard: PRICING_CONFIG.mediaPerCard,
      mediaFlat: PRICING_CONFIG.mediaFlat,
      interactivityPerNode: PRICING_CONFIG.interactivityPerNode,
      sceneExpansionPerScene: PRICING_CONFIG.sceneExpansionPerScene,
      plans: Object.entries(PRICING_CONFIG.plans).map(([name, config]) => ({
        name,
        monthlyPrice: config.monthlyPrice,
      })),
    });
  });

  // Helper to generate idempotency key from checkout options
  async function generateIdempotencyKey(userId: number, previewId: string | undefined, options: any): Promise<string> {
    const crypto = await import('crypto');
    const payload = JSON.stringify({ userId, previewId, ...options });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // Create checkout session for subscription
  app.post("/api/checkout", requireAuth, async (req, res) => {
    try {
      const { priceId, planName, previewId, mediaOptions, outputChoice, interactivityNodeCount, expansionScope, devBypass } = req.body;
      
      // DEV BYPASS: Skip Stripe and directly upgrade the user (for testing)
      if (devBypass === true) {
        const targetPlanName = planName || "pro"; // Default to pro if no plan specified
        const plan = await storage.getPlanByName(targetPlanName);
        if (!plan) {
          return res.status(400).json({ message: "Invalid plan" });
        }
        
        // Directly update user subscription
        const existingSub = await storage.getSubscription(req.user!.id);
        if (existingSub) {
          await storage.updateSubscription(existingSub.id, {
            planId: plan.id,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
        } else {
          await storage.createSubscription({
            userId: req.user!.id,
            planId: plan.id,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            stripeSubscriptionId: `dev_bypass_${Date.now()}`,
            stripeCustomerId: `dev_customer_${req.user!.id}`,
          });
        }
        
        console.log(`[DEV BYPASS] User ${req.user!.id} upgraded to ${planName} plan`);
        
        return res.json({ 
          devBypass: true,
          success: true,
          redirectUrl: previewId ? `/checkout/success?session_id=dev_bypass&preview_id=${previewId}` : '/dashboard',
        });
      }
      
      const { getUncachableStripeClient, getStripePublishableKey } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const plan = await storage.getPlanByName(planName);
      if (!plan) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      
      // CRITICAL: Validate that priceId matches the expected Stripe price for this plan
      // This prevents attackers from submitting a cheaper priceId with an expensive plan
      const expectedPriceId = plan.stripePriceIdMonthly;
      if (!expectedPriceId) {
        return res.status(400).json({ message: "Plan not configured for billing" });
      }
      if (priceId !== expectedPriceId) {
        console.error(`[checkout] SECURITY: Price ID mismatch! Submitted=${priceId}, Expected=${expectedPriceId} for plan ${planName}`);
        return res.status(400).json({ 
          message: "Invalid price configuration",
          error: "PRICE_MISMATCH" 
        });
      }
      
      // Calculate server-side total for idempotency verification
      const planPrice = PRICING_CONFIG.plans[planName as keyof typeof PRICING_CONFIG.plans];
      const serverCalculatedAmountCents = planPrice ? planPrice.monthlyPrice * 100 : 0;
      
      // Generate idempotency key INCLUDING priceId and calculated amount for tamper detection
      const idempotencyKey = await generateIdempotencyKey(req.user!.id, previewId, {
        planName,
        priceId,
        amountCents: serverCalculatedAmountCents,
        mediaOptions,
        outputChoice,
        interactivityNodeCount,
        expansionScope,
      });
      
      // Check for existing transaction with this key
      const existingTransaction = await storage.getCheckoutTransactionByKey(idempotencyKey);
      if (existingTransaction) {
        // Verify amount hasn't been tampered (should match since key includes amount)
        if (existingTransaction.amountCents !== serverCalculatedAmountCents) {
          console.error(`[checkout] Amount mismatch: stored=${existingTransaction.amountCents}, calculated=${serverCalculatedAmountCents}`);
          return res.status(400).json({ 
            message: "Checkout validation failed - please refresh and try again",
            mismatch: true 
          });
        }
        
        if (existingTransaction.status === 'completed') {
          return res.status(400).json({ 
            message: "This checkout has already been completed",
            alreadyCompleted: true 
          });
        }
        if (existingTransaction.status === 'pending' && existingTransaction.stripeCheckoutSessionId) {
          // Return existing session URL if still valid
          try {
            const existingSession = await stripe.checkout.sessions.retrieve(existingTransaction.stripeCheckoutSessionId);
            if (existingSession.status === 'open' && existingSession.url) {
              return res.json({ 
                url: existingSession.url, 
                publishableKey: await getStripePublishableKey(),
                existingSession: true 
              });
            }
          } catch (e) {
            // Session expired or invalid, continue to create new one
          }
        }
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
        allow_promotion_codes: true,
        success_url: `${getAppBaseUrl(req)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getAppBaseUrl(req)}/checkout/cancel`,
        metadata: {
          userId: String(req.user!.id),
          planId: String(plan.id),
          idempotencyKey,
        },
      });
      
      // Create or update transaction record
      if (existingTransaction) {
        await storage.updateCheckoutTransaction(existingTransaction.id, {
          stripeCheckoutSessionId: session.id,
          status: 'pending',
        });
      } else {
        await storage.createCheckoutTransaction({
          idempotencyKey,
          userId: req.user!.id,
          previewId: previewId || null,
          stripeCheckoutSessionId: session.id,
          status: 'pending',
          amountCents: serverCalculatedAmountCents,
          currency: 'usd',
          checkoutOptions: {
            mediaOptions: mediaOptions || { images: true, video: true, music: true, voiceover: true },
            outputChoice: outputChoice || 'publish',
            expansionScope: expansionScope || 'preview_only',
            selectedPlan: planName,
            interactivityNodeCount: interactivityNodeCount || 0,
          },
        });
      }
      
      res.json({ url: session.url, publishableKey: await getStripePublishableKey() });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Error creating checkout session" });
    }
  });
  
  // Verify checkout session and create/update subscription
  app.post("/api/checkout/verify", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }
      
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer'],
      });
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: "Payment not completed" });
      }
      
      // Verify the session belongs to this user
      const userId = session.metadata?.userId;
      if (!userId || parseInt(userId) !== req.user!.id) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }
      
      const planId = session.metadata?.planId;
      if (!planId) {
        return res.status(400).json({ message: "Plan ID missing from session" });
      }
      
      const plan = await storage.getPlan(parseInt(planId));
      if (!plan) {
        return res.status(400).json({ message: "Plan not found" });
      }
      
      // Get subscription details
      const stripeSubscription = session.subscription as any;
      const stripeCustomer = session.customer as any;
      
      // Check if user already has a subscription
      let existingSubscription = await storage.getSubscription(req.user!.id);
      
      if (existingSubscription) {
        // Update existing subscription
        await storage.updateSubscription(existingSubscription.id, {
          planId: plan.id,
          stripeCustomerId: stripeCustomer?.id || existingSubscription.stripeCustomerId,
          stripeSubscriptionId: stripeSubscription?.id,
          status: 'active',
          currentPeriodStart: stripeSubscription?.current_period_start 
            ? new Date(stripeSubscription.current_period_start * 1000) 
            : new Date(),
          currentPeriodEnd: stripeSubscription?.current_period_end 
            ? new Date(stripeSubscription.current_period_end * 1000) 
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      } else {
        // Create new subscription
        await storage.createSubscription({
          userId: req.user!.id,
          planId: plan.id,
          stripeCustomerId: stripeCustomer?.id,
          stripeSubscriptionId: stripeSubscription?.id,
          status: 'active',
          currentPeriodStart: stripeSubscription?.current_period_start 
            ? new Date(stripeSubscription.current_period_start * 1000) 
            : new Date(),
          currentPeriodEnd: stripeSubscription?.current_period_end 
            ? new Date(stripeSubscription.current_period_end * 1000) 
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
      
      // Update entitlements based on plan features
      const features = plan.features as any;
      await storage.upsertEntitlements(req.user!.id, {
        canUseCloudLlm: features?.canUseCloudLlm || false,
        canGenerateImages: features?.canGenerateImages || false,
        canExport: features?.canExport || false,
        canUseCharacterChat: features?.canUseCharacterChat || false,
        maxCardsPerStory: features?.maxCardsPerStory || 5,
        storageDays: features?.storageDays || 7,
        collaborationRoles: features?.collaborationRoles || false,
      });
      
      // Grant initial monthly credits for NEW subscriptions only
      // Webhook handles renewals using lastCreditGrantPeriodEnd for idempotency
      const isNewSubscription = !existingSubscription;
      if (isNewSubscription && (features?.monthlyVideoCredits > 0 || features?.monthlyVoiceCredits > 0)) {
        await storage.grantMonthlyCredits(
          req.user!.id,
          features.monthlyVideoCredits || 0,
          features.monthlyVoiceCredits || 0
        );
        
        // Mark this period as having received credits
        const newSub = await storage.getSubscription(req.user!.id);
        if (newSub) {
          const periodEnd = stripeSubscription?.current_period_end 
            ? new Date(stripeSubscription.current_period_end * 1000) 
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await storage.updateSubscription(newSub.id, {
            lastCreditGrantPeriodEnd: periodEnd,
          });
        }
        console.log(`[checkout] Granted initial monthly credits for user ${req.user!.id}`);
      }
      
      console.log(`[checkout] User ${req.user!.id} subscribed to plan ${plan.name}`);
      
      // Retrieve the pending action from checkout transaction
      const checkoutTransaction = await storage.getCheckoutTransactionBySessionId(sessionId);
      const pendingAction = checkoutTransaction ? {
        previewId: checkoutTransaction.previewId,
        checkoutOptions: checkoutTransaction.checkoutOptions,
      } : null;
      
      res.json({ 
        success: true, 
        subscription: await storage.getSubscription(req.user!.id),
        plan,
        pendingAction,
      });
    } catch (error: any) {
      console.error("Error verifying checkout session:", error);
      res.status(500).json({ message: error.message || "Error verifying checkout session" });
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
        return_url: `${getAppBaseUrl(req)}/settings`,
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
        allow_promotion_codes: true,
        success_url: `${getAppBaseUrl(req)}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getAppBaseUrl(req)}/credits/cancel`,
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
            prompt: `${prompt}. No text, words, letters, titles, or captions in the video.`,
            imageUrl,
            negativePrompt: "blurry, low quality, distorted, watermark, text, words, letters, titles, captions, typography, writing",
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
              prompt: `${prompt}. No text, words, letters, titles, or captions in the video.`,
              negativePrompt: "blurry, low quality, distorted, watermark, text, words, letters, titles, captions, typography, writing",
              aspectRatio: aspectRatio || "9:16",
              duration: duration || 5,
              model: model || "kling-v1-6",
            });
          } else {
            taskId = await startTextToVideoGeneration({
              prompt: `${prompt}. No text, words, letters, titles, or captions in the video.`,
              negativePrompt: "blurry, low quality, distorted, watermark, text, words, letters, titles, captions, typography, writing",
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
      const { type, value, context } = req.body;
      
      if (!type || !value || typeof value !== "string") {
        return res.status(400).json({ message: "Type and value are required" });
      }
      
      if (!["url", "text"].includes(type)) {
        return res.status(400).json({ message: "Type must be 'url' or 'text'" });
      }
      
      const contentContext = context && ["story", "article", "business", "auto"].includes(context) 
        ? context 
        : "auto";
      
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
      
      // Generate cards using AI with context-specific prompts
      const openai = getOpenAI();
      
      const contextPrompts: Record<string, { system: string; focus: string }> = {
        story: {
          system: `You are an expert at breaking NARRATIVE content into cinematic story cards. Extract 4-8 key dramatic moments and format them as story cards.`,
          focus: `Guidelines:
- Focus on the narrative arc and dramatic tension
- Capture character moments and emotional beats
- Use vivid, cinematic language
- Build toward a climactic moment
- Each card represents a scene or pivotal moment`
        },
        article: {
          system: `You are an expert at breaking INFORMATIONAL content into engaging story cards. Extract 4-8 key insights or takeaways and format them as story cards.`,
          focus: `Guidelines:
- Focus on key insights and discoveries
- Present facts in an engaging, digestible way
- Each card should teach or reveal something new
- Build understanding progressively
- Use clear, accessible language`
        },
        business: {
          system: `You are an expert at breaking BUSINESS content into compelling story cards. Extract 4-8 key features, benefits, or value propositions and format them as story cards.`,
          focus: `Guidelines:
- Focus on features, benefits, and value
- Highlight what makes this business/product special
- Use persuasive but authentic language
- Address customer needs and pain points
- Each card should reinforce the brand message`
        },
        auto: {
          system: `You are an expert at breaking content into cinematic story cards. Given text content, extract 4-8 key moments/sections and format them as story cards.`,
          focus: `Guidelines:
- Keep cards concise and impactful
- Each card should stand alone as a moment
- Use vivid, engaging language
- Focus on the narrative arc
- Maximum 8 cards for a short preview`
        }
      };
      
      const selectedPrompt = contextPrompts[contentContext] || contextPrompts.auto;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${selectedPrompt.system}

Each card should have:
- A short, evocative title (3-6 words)
- Content that captures the essence of that moment (2-4 sentences)

Output as JSON array: [{"title": "...", "content": "..."}, ...]

${selectedPrompt.focus}`
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
      
      // Rate limiting by IP (userIp defined earlier)
      const dailyCount = await storage.countIpIcePreviewsToday(userIp);
      if (dailyCount >= 50) {
        return res.status(429).json({ message: "Daily preview limit reached (50 per day)" });
      }
      
      const previewCards = cards.map((card, idx) => ({
        id: `${previewId}_card_${idx}`,
        title: card.title,
        content: card.content,
        order: idx,
      }));
      
      // Generate characters from the story content
      const cardsSummary = cards.map(c => `${c.title}: ${c.content}`).join('\n\n');
      let storyCharacters: schema.IcePreviewCharacter[] = [];
      
      try {
        const charCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert at identifying characters from narrative content. Analyze the story and identify 2-4 key characters who could engage in conversation about this story.

For each character, provide:
- id: short lowercase identifier (e.g., "detective", "victim", "witness_1")
- name: Full name or title (e.g., "Detective Sarah Chen", "The Vanishing Victim")
- role: Brief role description (e.g., "Lead Investigator", "Missing Person", "Key Witness")
- description: 1-2 sentence character background
- openingMessage: A short in-character greeting (1 sentence, matches their personality)

Output as JSON: { "characters": [...] }

Guidelines:
- Create compelling, distinct personalities
- Make characters relevant to the story's themes
- Include a mix of perspectives (protagonist, supporting, etc.)
- If no clear characters exist, create narrator/guide archetypes appropriate to the content type`
            },
            {
              role: "user",
              content: `Story title: ${sourceTitle}\n\nStory content:\n${cardsSummary.slice(0, 4000)}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        });
        
        const charParsed = JSON.parse(charCompletion.choices[0].message.content || "{}");
        const rawChars = charParsed.characters || [];
        
        storyCharacters = rawChars.slice(0, 4).map((c: any) => ({
          id: c.id || `char_${Math.random().toString(36).slice(2, 6)}`,
          name: c.name || "Story Guide",
          role: c.role || "Narrator",
          description: c.description || "A guide to this story.",
          avatar: undefined,
          systemPrompt: `You are ${c.name}, ${c.role}. ${c.description}

CONTEXT: This is part of an interactive story experience titled "${sourceTitle}".

STORY CARDS:
${cardsSummary}

VOICE & PERSONALITY:
- Stay fully in character as ${c.name}
- Speak from your perspective within the story
- Reference events, people, and details from the story naturally
- Be engaging and draw the audience into the narrative
- Keep responses concise (2-4 sentences typically)
- If asked about things outside your knowledge, deflect in-character

STRICT RULES:
- Never break character or refer to yourself as an AI
- Never reference "cards" or "the story" directly - you ARE in the story
- Never use phrases like "as a character" or "in this story"`,
          openingMessage: c.openingMessage || `Hello, I'm ${c.name}. What would you like to know?`,
        }));
      } catch (charError) {
        console.error("Error generating characters:", charError);
        // Fallback: create a default narrator character
        storyCharacters = [{
          id: "narrator",
          name: "Story Guide",
          role: "Narrator",
          description: "Your guide through this experience.",
          systemPrompt: `You are a knowledgeable narrator guiding someone through the story "${sourceTitle}".

STORY CARDS:
${cardsSummary}

Stay engaging, reference story details, and help the audience understand the narrative.`,
          openingMessage: "Welcome to this story. What would you like to explore?",
        }];
      }
      
      // Persist to database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry for guest previews
      
      const savedPreview = await storage.createIcePreview({
        id: previewId,
        ownerIp: userIp,
        ownerUserId: req.user?.id || null,
        sourceType: type as any,
        sourceValue: type === "url" ? value : value.slice(0, 500),
        contentContext: contentContext as any,
        title: sourceTitle,
        cards: previewCards,
        characters: storyCharacters,
        tier: "short",
        status: "active",
        expiresAt,
      });
      
      res.json({
        id: savedPreview.id,
        title: savedPreview.title,
        cards: savedPreview.cards,
        characters: savedPreview.characters,
        sourceType: savedPreview.sourceType,
        sourceValue: savedPreview.sourceValue,
        createdAt: savedPreview.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Error creating ICE preview:", error);
      res.status(500).json({ message: "Error creating preview" });
    }
  });
  
  // File upload endpoint for ICE preview (PDF, PowerPoint, Word, Text)
  app.post("/api/ice/preview/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const userIp = req.ip || req.socket.remoteAddress || "unknown";
      
      // Rate limiting by IP
      const dailyCount = await storage.countIpIcePreviewsToday(userIp);
      if (dailyCount >= 50) {
        return res.status(429).json({ message: "Daily preview limit reached (50 per day)" });
      }
      
      let contentText = "";
      let sourceTitle = file.originalname.replace(/\.[^/.]+$/, "") || "Uploaded Document";
      
      const ext = file.originalname.toLowerCase().split('.').pop();
      
      if (ext === "pdf") {
        // Parse PDF using PDFParse class
        const pdfParseModule = await import("pdf-parse") as any;
        const PDFParse = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse;
        if (!PDFParse) {
          throw new Error("PDFParse class not found in pdf-parse module");
        }
        const parser = new PDFParse({ data: file.buffer });
        await parser.load();
        const textResult = await parser.getText();
        // getText returns an object with pages array - extract text from all pages
        if (typeof textResult === 'string') {
          contentText = textResult;
        } else if (textResult && Array.isArray(textResult.pages)) {
          contentText = textResult.pages.map((p: any) => p.text || '').join('\n\n');
        } else if (textResult && typeof textResult === 'object') {
          contentText = JSON.stringify(textResult);
        } else {
          contentText = String(textResult || '');
        }
      } else if (ext === "txt") {
        contentText = file.buffer.toString("utf-8");
      } else if (ext === "doc" || ext === "docx" || ext === "ppt" || ext === "pptx") {
        // For Office documents, extract text using basic parsing
        // This is a simplified approach - in production you'd use a proper library
        contentText = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
        if (contentText.length < 100) {
          return res.status(400).json({ message: "Could not extract text from this document format. Try PDF or paste the content directly." });
        }
      } else {
        return res.status(400).json({ message: "Unsupported file type. Please upload PDF, Word, PowerPoint, or text files." });
      }
      
      if (!contentText || contentText.trim().length < 50) {
        return res.status(400).json({ message: "Not enough content to create an experience" });
      }
      
      const openai = getOpenAI();
      const previewId = `ice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      // ============ STRUCTURAL INGEST STEP ============
      // Step 1: Detect content type (script vs article vs document)
      const isScreenplay = detectScreenplayFormat(contentText);
      const contentType: schema.IceContentType = isScreenplay ? 'script' : 'document';
      const fidelityMode: schema.IceFidelityMode = isScreenplay ? 'script_exact' : 'interpretive';
      
      let sceneMap: schema.IceSceneMap | undefined;
      let cards: Array<{title: string; content: string; sceneId?: string; dialoguePreserved?: string[]}> = [];
      
      if (isScreenplay && fidelityMode === 'script_exact') {
        // ============ SCRIPT-EXACT MODE ============
        // Parse screenplay structure using AI to extract scenes
        console.log('[ICE] Detected screenplay format - using Script-Exact mode');
        
        const structureCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert screenplay analyst. Parse this screenplay and extract its scene structure.

For each scene, identify:
- heading: The scene heading (e.g., "INT. STUDIO - NIGHT")
- location: The location name
- timeOfDay: Time of day if specified
- characters: Array of character names who appear/speak
- dialogue: Array of {character, line} for key dialogue lines (max 3 per scene)
- action: Brief summary of the scene action (1-2 sentences)

Output as JSON: {
  "title": "Script title",
  "scenes": [
    {
      "heading": "INT. STUDIO - NIGHT",
      "location": "STUDIO",
      "timeOfDay": "NIGHT", 
      "characters": ["MAYA"],
      "dialogue": [{"character": "MAYA", "line": "Every loop needs a failsafe."}],
      "action": "Maya faces the camera and explains system design principles."
    }
  ]
}

IMPORTANT:
- Preserve the EXACT order of scenes as they appear
- Keep dialogue verbatim - do not paraphrase
- Include ALL scenes, not just "key" ones
- This is structural analysis, NOT interpretation`
            },
            {
              role: "user",
              content: contentText.slice(0, 15000)
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });
        
        const structureParsed = JSON.parse(structureCompletion.choices[0].message.content || "{}");
        const parsedScenes = structureParsed.scenes || [];
        const scriptTitle = structureParsed.title || sourceTitle;
        sourceTitle = scriptTitle;
        
        // Build scene map
        const scenes: schema.IceScene[] = parsedScenes.map((s: any, idx: number) => ({
          id: `scene_${idx}`,
          order: idx,
          heading: s.heading || `SCENE ${idx + 1}`,
          location: s.location,
          timeOfDay: s.timeOfDay,
          characters: s.characters || [],
          dialogue: s.dialogue || [],
          action: s.action || '',
          isGenerated: idx < 5, // First 5 scenes will be generated for preview
        }));
        
        sceneMap = {
          contentType: 'script',
          fidelityMode: 'script_exact',
          totalScenes: scenes.length,
          generatedScenes: Math.min(5, scenes.length),
          scenes,
        };
        
        // Generate cards from first 5 scenes (faithful adaptation)
        const previewScenes = scenes.slice(0, 5);
        
        const cardCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a director and production designer adapting a screenplay into cinematic story cards.

CRITICAL RULES - SCRIPT-EXACT MODE:
- You are NOT summarizing or interpreting - you are STAGING the script
- Preserve the EXACT scene order
- Preserve character intent and dramatic beats
- Keep key dialogue VERBATIM
- Each card = one scene from the script
- Do NOT combine, reorder, or skip scenes

For each scene, create a card with:
- title: A cinematic title for the scene (evocative, 3-6 words)
- content: The scene's action and mood (2-4 sentences, preserving intent)
- dialoguePreserved: Array of 1-3 key dialogue lines from this scene (EXACT quotes)

Output as JSON: { "cards": [...] }`
            },
            {
              role: "user",
              content: `Adapt these ${previewScenes.length} scenes into cinematic cards:\n\n${previewScenes.map((s, i) => 
                `SCENE ${i + 1}: ${s.heading}\nAction: ${s.action}\nDialogue: ${s.dialogue.map((d: any) => `${d.character}: "${d.line}"`).join('\n')}`
              ).join('\n\n---\n\n')}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000,
        });
        
        const cardsParsed = JSON.parse(cardCompletion.choices[0].message.content || "{}");
        cards = (cardsParsed.cards || []).map((c: any, idx: number) => ({
          title: c.title || previewScenes[idx]?.heading || `Scene ${idx + 1}`,
          content: c.content || previewScenes[idx]?.action || '',
          sceneId: previewScenes[idx]?.id,
          dialoguePreserved: c.dialoguePreserved || previewScenes[idx]?.dialogue?.map((d: any) => `${d.character}: "${d.line}"`) || [],
        }));
        
      } else {
        // ============ INTERPRETIVE MODE ============
        // Original behavior for articles/documents
        console.log('[ICE] Using Interpretive mode for non-script content');
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert at breaking content into cinematic story cards. Given text content, extract 4-8 key moments/sections and format them as story cards.

Each card should have:
- A short, evocative title (3-6 words)
- Content that captures the essence of that moment (2-4 sentences)

Output as JSON: { "cards": [{"title": "...", "content": "..."}, ...] }

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
        
        try {
          const parsed = JSON.parse(completion.choices[0].message.content || "{}");
          cards = parsed.cards || parsed;
          if (!Array.isArray(cards)) {
            cards = Object.values(parsed).find(v => Array.isArray(v)) as any || [];
          }
        } catch (e) {
          const paragraphs = contentText.split(/\n\n+/).filter(p => p.trim().length > 20);
          cards = paragraphs.slice(0, 6).map((p, i) => ({
            title: `Part ${i + 1}`,
            content: p.slice(0, 300),
          }));
        }
      }
      
      cards = cards.slice(0, 8);
      
      const previewCards: schema.IcePreviewCard[] = cards.map((card, idx) => ({
        id: `${previewId}_card_${idx}`,
        title: card.title,
        content: card.content,
        order: idx,
        sceneId: card.sceneId,
        dialoguePreserved: card.dialoguePreserved,
      }));
      
      // Generate characters from the story content (same as URL/text endpoint)
      const cardsSummary = cards.map(c => `${c.title}: ${c.content}`).join('\n\n');
      let storyCharacters: schema.IcePreviewCharacter[] = [];
      
      try {
        const charCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert at identifying characters from narrative content. Analyze the story and identify 2-4 key characters who could engage in conversation about this story.

For each character, provide:
- id: short lowercase identifier (e.g., "detective", "victim", "witness_1")
- name: Full name or title (e.g., "Detective Sarah Chen", "The Vanishing Victim")
- role: Brief role description (e.g., "Lead Investigator", "Missing Person", "Key Witness")
- description: 1-2 sentence character background
- openingMessage: A short in-character greeting (1 sentence, matches their personality)

Output as JSON: { "characters": [...] }

Guidelines:
- Create compelling, distinct personalities
- Make characters relevant to the story's themes
- Include a mix of perspectives (protagonist, supporting, etc.)
- If no clear characters exist, create narrator/guide archetypes appropriate to the content type`
            },
            {
              role: "user",
              content: `Story title: ${sourceTitle}\n\nStory content:\n${cardsSummary.slice(0, 4000)}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        });
        
        const charParsed = JSON.parse(charCompletion.choices[0].message.content || "{}");
        const rawChars = charParsed.characters || [];
        
        storyCharacters = rawChars.slice(0, 4).map((c: any) => ({
          id: c.id || `char_${Math.random().toString(36).slice(2, 6)}`,
          name: c.name || "Story Guide",
          role: c.role || "Narrator",
          description: c.description || "A guide to this story.",
          avatar: undefined,
          systemPrompt: `You are ${c.name}, ${c.role}. ${c.description}

CONTEXT: This is part of an interactive story experience titled "${sourceTitle}".

STORY CARDS:
${cardsSummary}

VOICE & PERSONALITY:
- Stay fully in character as ${c.name}
- Speak from your perspective within the story
- Reference events, people, and details from the story naturally
- Be engaging and draw the audience into the narrative
- Keep responses concise (2-4 sentences typically)
- If asked about things outside your knowledge, deflect in-character

STRICT RULES:
- Never break character or refer to yourself as an AI
- Never reference "cards" or "the story" directly - you ARE in the story
- Never use phrases like "as a character" or "in this story"`,
          openingMessage: c.openingMessage || `Hello, I'm ${c.name}. What would you like to know?`,
        }));
      } catch (charError) {
        console.error("Error generating characters:", charError);
        storyCharacters = [{
          id: "narrator",
          name: "Story Guide",
          role: "Narrator",
          description: "Your guide through this experience.",
          systemPrompt: `You are a knowledgeable narrator guiding someone through the story "${sourceTitle}".

STORY CARDS:
${cardsSummary}

Stay engaging, reference story details, and help the audience understand the narrative.`,
          openingMessage: "Welcome to this story. What would you like to explore?",
        }];
      }
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const savedPreview = await storage.createIcePreview({
        id: previewId,
        ownerIp: userIp,
        ownerUserId: req.user?.id || null,
        sourceType: "file" as any,
        sourceValue: file.originalname,
        contentType,
        fidelityMode,
        sceneMap,
        title: sourceTitle,
        cards: previewCards,
        characters: storyCharacters,
        tier: "short",
        status: "active",
        expiresAt,
      });
      
      res.json({
        id: savedPreview.id,
        title: savedPreview.title,
        cards: savedPreview.cards,
        characters: savedPreview.characters,
        contentType: savedPreview.contentType,
        fidelityMode: savedPreview.fidelityMode,
        sceneMap: savedPreview.sceneMap,
        sourceType: savedPreview.sourceType,
        sourceValue: savedPreview.sourceValue,
        createdAt: savedPreview.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Error creating ICE preview from file:", error);
      res.status(500).json({ message: "Error processing uploaded file" });
    }
  });

  // Get user's own ICE previews for Library
  app.get("/api/ice/my-previews", requireAuth, async (req, res) => {
    try {
      const user = req.user as schema.User;
      const previews = await storage.getIcePreviewsByUser(user.id);
      
      res.json({
        previews: previews.map(p => ({
          id: p.id,
          title: p.title,
          cards: p.cards || [],
          status: p.status,
          visibility: p.visibility,
          createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching user previews:", error);
      res.status(500).json({ message: "Error fetching previews" });
    }
  });
  
  // Delete an ICE preview (owner only)
  app.delete("/api/ice/preview/:id", requireAuth, async (req, res) => {
    try {
      const preview = await storage.getIcePreview(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'delete', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized to delete this preview" });
      }
      
      await storage.deleteIcePreview(req.params.id);
      
      const { userIp, userAgent } = extractRequestInfo(req);
      await logAuditEvent('content.deleted', 'ice_preview', preview.id, {
        userId: user.id,
        userIp,
        userAgent,
        details: { title: preview.title },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting ICE preview:", error);
      res.status(500).json({ message: "Error deleting preview" });
    }
  });
  
  // Get a specific ICE preview by ID (visibility-controlled)
  app.get("/api/ice/preview/:id", async (req, res) => {
    try {
      const preview = await storage.getIcePreview(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check read permission
      const user = req.user as schema.User | undefined;
      const policy = canReadIcePreview(user, preview);
      if (!policy.allowed) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user?.id,
          userIp,
          userAgent,
          details: { action: 'read', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason });
      }
      
      // Check expiry
      if (preview.expiresAt < new Date() && preview.status !== "promoted") {
        return res.status(410).json({ message: "Preview has expired" });
      }
      
      res.json({
        id: preview.id,
        title: preview.title,
        cards: preview.cards,
        characters: preview.characters || [],
        interactivityNodes: preview.interactivityNodes || [],
        sourceType: preview.sourceType,
        sourceValue: preview.sourceValue,
        status: preview.status,
        visibility: preview.visibility,
        contentType: preview.contentType,
        fidelityMode: preview.fidelityMode,
        sceneMap: preview.sceneMap,
        createdAt: preview.createdAt.toISOString(),
        // Music and style settings
        musicTrackUrl: preview.musicTrackUrl,
        musicVolume: preview.musicVolume,
        musicEnabled: preview.musicEnabled,
        titlePackId: preview.titlePackId,
        narrationVolume: preview.narrationVolume,
        // Caption Engine settings
        captionSettings: preview.captionSettings,
        // Additional settings
        projectBible: preview.projectBible,
        previewAccessToken: preview.previewAccessToken,
      });
    } catch (error) {
      console.error("Error fetching ICE preview:", error);
      res.status(500).json({ message: "Error fetching preview" });
    }
  });
  
  // ICE Preview - Add custom character
  app.post("/api/ice/preview/:id/characters", async (req, res) => {
    try {
      const previewId = req.params.id;
      const { name, role, openingMessage, systemPrompt, knowledgeContext } = req.body;
      
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Character name is required" });
      }
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check expiry
      if (preview.expiresAt < new Date() && preview.status !== "promoted") {
        return res.status(410).json({ message: "Preview has expired" });
      }
      
      // Build the system prompt - combine user-provided persona with knowledge context
      let finalSystemPrompt = "";
      
      if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
        finalSystemPrompt = systemPrompt.trim();
      } else {
        finalSystemPrompt = `You are ${name}, ${role || "an AI assistant"}. You are helpful, friendly, and knowledgeable about the content in this experience. Answer questions naturally and stay in character.`;
      }
      
      // Append knowledge context if provided
      if (knowledgeContext && typeof knowledgeContext === "string" && knowledgeContext.trim()) {
        finalSystemPrompt += `\n\n## KNOWLEDGE BASE\nUse the following information to inform your responses:\n\n${knowledgeContext.trim()}`;
      }
      
      // Create new character
      const newCharacter: schema.IcePreviewCharacter = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        role: (role || "AI Assistant").trim(),
        description: `Custom character: ${name}`,
        systemPrompt: finalSystemPrompt,
        openingMessage: openingMessage || `Hello! I'm ${name}. How can I help you today?`,
      };
      
      // Add to existing characters
      const existingCharacters = (preview.characters || []) as schema.IcePreviewCharacter[];
      const updatedCharacters = [...existingCharacters, newCharacter];
      
      // Update the preview
      await storage.updateIcePreview(previewId, { characters: updatedCharacters });
      
      res.json({ 
        success: true, 
        id: newCharacter.id,
        character: newCharacter,
      });
    } catch (error) {
      console.error("Error adding custom character:", error);
      res.status(500).json({ message: "Error adding character" });
    }
  });
  
  // ICE Preview Chat - Talk to story characters
  app.post("/api/ice/preview/:id/chat", chatRateLimiter, async (req, res) => {
    try {
      const { message, characterId, previewAccessToken } = req.body;
      const previewId = req.params.id;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check expiry
      if (preview.expiresAt < new Date() && preview.status !== "promoted") {
        return res.json({
          capped: true,
          reason: "expired",
          message: "This preview has expired.",
        });
      }
      
      // Find the selected character or use first one
      const characters = (preview.characters || []) as schema.IcePreviewCharacter[];
      let character = characters.find(c => c.id === characterId);
      if (!character && characters.length > 0) {
        character = characters[0];
      }
      
      if (!character) {
        // Fallback: create an inline narrator
        const cardsSummary = (preview.cards as schema.IcePreviewCard[])
          .map(c => `${c.title}: ${c.content}`).join('\n\n');
        character = {
          id: "narrator",
          name: "Story Guide",
          role: "Narrator",
          description: "Your guide through this experience.",
          systemPrompt: `You are a knowledgeable narrator guiding someone through the story "${preview.title}".

STORY CARDS:
${cardsSummary}

Stay engaging, reference story details, and help the audience understand the narrative.`,
          openingMessage: "Welcome to this story. What would you like to explore?",
        };
      }
      
      // Call LLM with character persona
      const openai = getOpenAI();
      
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: character.systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 300,
        temperature: 0.85,
      });
      
      const reply = aiResponse.choices[0]?.message?.content || "...";
      
      res.json({
        reply,
        character: {
          id: character.id,
          name: character.name,
          role: character.role,
        },
      });
    } catch (error) {
      console.error("Error in ICE preview chat:", error);
      res.status(500).json({ message: "Error processing chat" });
    }
  });
  
  // Update cards and interactivity nodes for an ICE preview (reordering, editing)
  app.put("/api/ice/preview/:id/cards", async (req, res) => {
    try {
      const { cards, interactivityNodes } = req.body;
      if (!Array.isArray(cards)) {
        return res.status(400).json({ message: "Cards array is required" });
      }
      
      const preview = await storage.getIcePreview(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check write permission using policy function
      const user = req.user as schema.User | undefined;
      const policy = canWriteIcePreview(user, preview);
      
      // For guest previews (no owner yet), allow editing by original IP
      const userIp = req.ip || req.socket.remoteAddress || "unknown";
      const isGuestOwner = !preview.ownerUserId && preview.ownerIp === userIp;
      
      if (!policy.allowed && !isGuestOwner) {
        const { userIp: ip, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user?.id,
          userIp: ip,
          userAgent,
          details: { action: 'edit', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized to edit this preview" });
      }
      
      // Validate and sanitize cards - preserve generated media fields
      const existingCards = preview.cards || [];
      const existingCardMap = new Map(existingCards.map((c: any) => [c.id, c]));
      
      const sanitizedCards = cards.map((card: any, idx: number) => {
        const existingCard = existingCardMap.get(card.id) || {};
        return {
          id: card.id || `${preview.id}_card_${idx}`,
          title: String(card.title || "").slice(0, 100),
          content: String(card.content || "").slice(0, 2000),
          order: idx,
          // Preserve scene linkage
          sceneId: card.sceneId || existingCard.sceneId || undefined,
          dialoguePreserved: card.dialoguePreserved || existingCard.dialoguePreserved || undefined,
          // New media asset system - preserve arrays and selection
          mediaAssets: card.mediaAssets || existingCard.mediaAssets || undefined,
          selectedMediaAssetId: card.selectedMediaAssetId || existingCard.selectedMediaAssetId || undefined,
          // Legacy generated media fields (backward compatibility)
          generatedImageUrl: card.generatedImageUrl || existingCard.generatedImageUrl || undefined,
          generatedVideoUrl: card.generatedVideoUrl || existingCard.generatedVideoUrl || undefined,
          videoGenerationStatus: card.videoGenerationStatus || existingCard.videoGenerationStatus || undefined,
          videoPredictionId: card.videoPredictionId || existingCard.videoPredictionId || undefined,
          narrationAudioUrl: card.narrationAudioUrl || existingCard.narrationAudioUrl || undefined,
          // Prompt enhancement settings
          enhancePromptEnabled: card.enhancePromptEnabled ?? existingCard.enhancePromptEnabled ?? undefined,
          basePrompt: card.basePrompt || existingCard.basePrompt || undefined,
          enhancedPrompt: card.enhancedPrompt || existingCard.enhancedPrompt || undefined,
        };
      });
      
      // Validate and sanitize interactivity nodes if provided
      const updateData: any = { cards: sanitizedCards };
      if (Array.isArray(interactivityNodes)) {
        const sanitizedNodes = interactivityNodes.map((node: any) => ({
          id: String(node.id || `node_${Date.now()}`),
          afterCardIndex: Number(node.afterCardIndex) || 0,
          isActive: Boolean(node.isActive),
          selectedCharacterId: node.selectedCharacterId ? String(node.selectedCharacterId) : undefined,
        }));
        updateData.interactivityNodes = sanitizedNodes;
      }
      
      const updated = await storage.updateIcePreview(req.params.id, updateData);
      
      // Log successful edit
      const { userIp: logIp, userAgent } = extractRequestInfo(req);
      await logAuditEvent('content.edited', 'ice_preview', preview.id, {
        userId: user?.id,
        userIp: logIp,
        userAgent,
        details: { cardCount: sanitizedCards.length, nodeCount: updateData.interactivityNodes?.length },
      });
      
      res.json({
        id: updated!.id,
        title: updated!.title,
        cards: updated!.cards,
        interactivityNodes: updated!.interactivityNodes,
      });
    } catch (error) {
      console.error("Error updating ICE preview cards:", error);
      res.status(500).json({ message: "Error updating preview" });
    }
  });
  
  // Generate image for an ICE preview card (requires auth + entitlements)
  app.post("/api/ice/preview/:previewId/cards/:cardId/generate-image", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      const { prompt } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check write permission using policy function
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'generate-image', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized to edit this preview" });
      }
      
      // Check entitlements
      const entitlements = await getFullEntitlements(user.id);
      if (!entitlements.canGenerateImages) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'generate-image', reason: 'Missing image generation entitlement' },
          success: false,
          errorCode: '403',
        });
        return res.status(403).json({ 
          message: "Image generation requires a paid subscription",
          upgradeRequired: true,
        });
      }
      
      // Find the card
      const cards = preview.cards as any[];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ message: "Card not found" });
      }
      const card = cards[cardIndex];
      
      // Generate prompt from card content if not provided
      const imagePrompt = prompt || `${card.title}. ${card.content}`;
      
      // Check if OpenAI is configured
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "AI image generation is not configured" });
      }
      
      console.log(`[ICE] Generating image for preview ${previewId}, card ${cardId}`);
      
      // Call OpenAI image generation
      const response = await getOpenAI().images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt.substring(0, 3900),
        n: 1,
        size: "1024x1536", // Portrait for story cards
      });
      
      const imageData = response.data?.[0];
      const base64Image = imageData?.b64_json;
      const imageUrl = imageData?.url;
      
      let finalImageUrl: string;
      
      if (base64Image) {
        // Save to uploads folder
        const uploadsDir = path.join(process.cwd(), "uploads", "ice-generated");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filename = `ice-${previewId}-${cardId}-${Date.now()}.png`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, Buffer.from(base64Image, "base64"));
        
        finalImageUrl = `/uploads/ice-generated/${filename}`;
      } else if (imageUrl) {
        finalImageUrl = imageUrl;
      } else {
        throw new Error("No image data returned");
      }
      
      // Create new media asset
      const newAssetId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newAsset = {
        id: newAssetId,
        kind: 'image' as const,
        source: 'ai' as const,
        url: finalImageUrl,
        thumbnailUrl: finalImageUrl,
        createdAt: new Date().toISOString(),
        prompt: imagePrompt.substring(0, 500),
        status: 'ready' as const,
        model: 'gpt-image-1',
      };
      
      // Add to mediaAssets array and update legacy field for backward compatibility
      const existingAssets = card.mediaAssets || [];
      cards[cardIndex] = { 
        ...card, 
        mediaAssets: [...existingAssets, newAsset],
        selectedMediaAssetId: newAssetId, // Auto-select newly generated asset
        generatedImageUrl: finalImageUrl, // Keep legacy field updated
      };
      await storage.updateIcePreview(previewId, { cards });
      
      // Log successful generation
      const { userIp: successIp, userAgent: successAgent } = extractRequestInfo(req);
      await logAuditEvent('media.generated', 'ice_preview', preview.id, {
        userId: user.id,
        userIp: successIp,
        userAgent: successAgent,
        details: { cardId, type: 'image', assetId: newAssetId },
      });
      
      res.json({
        success: true,
        imageUrl: finalImageUrl,
        cardId,
        asset: newAsset,
      });
    } catch (error) {
      console.error("Error generating ICE preview card image:", error);
      res.status(500).json({ message: "Error generating image" });
    }
  });
  
  // Generate video for an ICE preview card (requires auth + entitlements)
  app.post("/api/ice/preview/:previewId/cards/:cardId/generate-video", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      const { mode, prompt, sourceImageUrl } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check write permission using policy function
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'generate-video', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized to edit this preview" });
      }
      
      // Check entitlements
      const entitlements = await getFullEntitlements(user.id);
      if (!entitlements.canGenerateVideos) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'generate-video', reason: 'Missing video generation entitlement' },
          success: false,
          errorCode: '403',
        });
        return res.status(403).json({ 
          message: "Video generation requires a Business subscription",
          upgradeRequired: true,
        });
      }
      
      // Find the card
      const cards = preview.cards as any[];
      const card = cards.find(c => c.id === cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Log start of video generation
      const { userIp, userAgent } = extractRequestInfo(req);
      await logAuditEvent('media.generation_started', 'ice_preview', preview.id, {
        userId: user.id,
        userIp,
        userAgent,
        details: { cardId, type: 'video', mode },
      });
      
      // Get video settings from request
      const { model, duration } = req.body;
      const basePrompt = prompt || `Cinematic scene: ${card.title}. ${card.content}`;
      // Enhance prompt to ensure no text is rendered in the video
      const videoPrompt = `${basePrompt}. IMPORTANT: Do not include any text, words, letters, titles, captions, watermarks, or typography in this video. Pure visual imagery only.`;
      
      // Import video generation functions
      const { isReplicateConfigured, startReplicateVideoAsync } = await import("./video");
      
      if (!isReplicateConfigured()) {
        return res.status(503).json({ message: "Video generation not configured" });
      }
      
      // Start async video generation
      const result = await startReplicateVideoAsync({
        prompt: videoPrompt,
        imageUrl: mode === "image-to-video" ? sourceImageUrl : undefined,
        model: model || "kling-v1.6-standard",
        duration: duration || 5,
        aspectRatio: "9:16",
        negativePrompt: "blurry, low quality, distorted, watermark, text, words, letters, titles, captions, typography, writing",
      });
      
      // Update the card with the prediction ID and track prompt used
      const cardIndex = cards.findIndex(c => c.id === cardId);
      cards[cardIndex] = { 
        ...card, 
        videoPredictionId: result.predictionId,
        videoGenerationStatus: "processing",
        videoGenerationMode: mode || "text-to-video",
        videoGenerationPrompt: videoPrompt.substring(0, 500), // Store for asset metadata
        videoGenerationModel: model || "kling-v1.6-standard",
      };
      await storage.updateIcePreview(previewId, { cards });
      
      console.log(`[ICE Video] Started prediction ${result.predictionId} for card ${cardId}`);
      
      res.json({
        success: true,
        message: "Video generation started",
        status: "processing",
        predictionId: result.predictionId,
        cardId,
      });
    } catch (error: any) {
      console.error("Error generating ICE preview card video:", error);
      res.status(500).json({ message: error.message || "Error generating video" });
    }
  });
  
  // Check video generation status for an ICE preview card
  app.get("/api/ice/preview/:previewId/cards/:cardId/video/status", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      const cards = preview.cards as any[];
      const card = cards.find(c => c.id === cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // If no prediction ID, return current status
      if (!card.videoPredictionId) {
        return res.json({
          status: card.videoGenerationStatus || "none",
          videoUrl: card.generatedVideoUrl,
        });
      }
      
      // Check prediction status
      const { checkReplicatePrediction } = await import("./video");
      const result = await checkReplicatePrediction(card.videoPredictionId);
      
      // Update card if status changed
      if (result.status === "completed" && result.videoUrl) {
        const cardIndex = cards.findIndex(c => c.id === cardId);
        
        // Create new video media asset
        const newAssetId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newAsset = {
          id: newAssetId,
          kind: 'video' as const,
          source: 'ai' as const,
          url: result.videoUrl,
          thumbnailUrl: card.generatedImageUrl || undefined, // Use image as poster if available
          createdAt: new Date().toISOString(),
          prompt: card.videoGenerationPrompt || undefined,
          status: 'ready' as const,
          model: card.videoGenerationModel || 'kling-v1.6-standard',
        };
        
        const existingAssets = card.mediaAssets || [];
        cards[cardIndex] = {
          ...card,
          mediaAssets: [...existingAssets, newAsset],
          selectedMediaAssetId: newAssetId, // Auto-select new video
          generatedVideoUrl: result.videoUrl, // Keep legacy field
          videoGenerationStatus: "completed",
          videoPredictionId: null, // Clear after completion
        };
        await storage.updateIcePreview(previewId, { cards });
        
        console.log(`[ICE Video] Completed for card ${cardId}: ${result.videoUrl}, asset ${newAssetId}`);
      } else if (result.status === "failed") {
        const cardIndex = cards.findIndex(c => c.id === cardId);
        cards[cardIndex] = {
          ...card,
          videoGenerationStatus: "failed",
          videoGenerationError: result.error,
          videoPredictionId: null,
        };
        await storage.updateIcePreview(previewId, { cards });
        
        console.log(`[ICE Video] Failed for card ${cardId}: ${result.error}`);
      }
      
      res.json({
        status: result.status,
        videoUrl: result.videoUrl,
        error: result.error,
      });
    } catch (error: any) {
      console.error("Error checking ICE video status:", error);
      res.status(500).json({ message: "Error checking video status" });
    }
  });
  
  // Preview narration for an ICE preview card (short audio, not stored)
  app.post("/api/ice/preview/:previewId/cards/:cardId/narration/preview", requireAuth, async (req, res) => {
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
      console.error("Error generating ICE narration preview:", error);
      res.status(500).json({ message: "Error generating preview" });
    }
  });
  
  // Generate narration for an ICE preview card (requires auth + entitlements)
  app.post("/api/ice/preview/:previewId/cards/:cardId/narration/generate", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      const { text, voice, speed } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check write permission using policy function
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'generate-narration', reason: policy.reason },
          success: false,
          errorCode: String(policy.statusCode),
        });
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized to edit this preview" });
      }
      
      // Check entitlements (TTS requires audio/voiceover entitlement)
      const entitlements = await getFullEntitlements(user.id);
      if (!entitlements.canUploadAudio) {
        const { userIp, userAgent } = extractRequestInfo(req);
        await logAuditEvent('permission.denied', 'ice_preview', preview.id, {
          userId: user.id,
          userIp,
          userAgent,
          details: { action: 'generate-narration', reason: 'Missing voiceover entitlement' },
          success: false,
          errorCode: '403',
        });
        return res.status(403).json({ 
          message: "Voiceover narration requires a paid subscription",
          upgradeRequired: true,
        });
      }
      
      // Find the card
      const cards = preview.cards as any[];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ message: "Card not found" });
      }
      const card = cards[cardIndex];
      
      // Use provided text or fall back to card content
      const narrationText = text || card.content;
      if (!narrationText || narrationText.trim() === "") {
        return res.status(400).json({ message: "Narration text is empty" });
      }
      
      const { isTTSConfigured, synthesiseSpeech, validateNarrationText } = await import("./tts");
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      
      if (!isTTSConfigured()) {
        return res.status(503).json({ message: "TTS not configured: OPENAI_API_KEY is missing" });
      }
      
      const objectStorage = new ObjectStorageService();
      if (!objectStorage.isConfigured()) {
        return res.status(503).json({ message: "Object storage not configured" });
      }
      
      const validation = validateNarrationText(narrationText);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      
      console.log(`[ICE] Generating narration for preview ${previewId}, card ${cardId}`);
      
      const result = await synthesiseSpeech({
        text: narrationText,
        voice: voice || "alloy",
        speed: speed || 1.0,
      });
      
      // Save to Replit object storage
      const fileName = `ice-narration-${previewId}-${cardId}-${Date.now()}.mp3`;
      const audioUrl = await objectStorage.uploadBuffer(result.audioBuffer, fileName, result.contentType, "ice-narration");
      
      // Update the card with the generated audio URL
      cards[cardIndex] = { ...card, narrationAudioUrl: audioUrl };
      await storage.updateIcePreview(previewId, { cards });
      
      // Log successful generation
      const { userIp: successIp, userAgent: successAgent } = extractRequestInfo(req);
      await logAuditEvent('media.generated', 'ice_preview', preview.id, {
        userId: user.id,
        userIp: successIp,
        userAgent: successAgent,
        details: { cardId, type: 'narration' },
      });
      
      res.json({
        success: true,
        audioUrl,
        cardId,
      });
    } catch (error) {
      console.error("Error generating ICE narration:", error);
      res.status(500).json({ message: "Error generating narration" });
    }
  });

  // Select a media asset as active for a card
  app.post("/api/ice/preview/:previewId/cards/:cardId/media/select", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      const { assetId } = req.body;
      
      if (!assetId) {
        return res.status(400).json({ message: "Asset ID is required" });
      }
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized" });
      }
      
      const cards = preview.cards as any[];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const card = cards[cardIndex];
      const assets = card.mediaAssets || [];
      const selectedAsset = assets.find((a: any) => a.id === assetId);
      
      if (!selectedAsset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Update selection and sync legacy fields for backward compatibility
      cards[cardIndex] = {
        ...card,
        selectedMediaAssetId: assetId,
        generatedImageUrl: selectedAsset.kind === 'image' ? selectedAsset.url : card.generatedImageUrl,
        generatedVideoUrl: selectedAsset.kind === 'video' ? selectedAsset.url : card.generatedVideoUrl,
      };
      
      await storage.updateIcePreview(previewId, { cards });
      
      res.json({
        success: true,
        selectedAssetId: assetId,
        asset: selectedAsset,
      });
    } catch (error) {
      console.error("Error selecting media asset:", error);
      res.status(500).json({ message: "Error selecting asset" });
    }
  });

  // Delete a media asset from a card
  app.delete("/api/ice/preview/:previewId/cards/:cardId/media/:assetId", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId, assetId } = req.params;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized" });
      }
      
      const cards = preview.cards as any[];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const card = cards[cardIndex];
      const assets = card.mediaAssets || [];
      const assetIndex = assets.findIndex((a: any) => a.id === assetId);
      
      if (assetIndex === -1) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Remove the asset
      const newAssets = assets.filter((a: any) => a.id !== assetId);
      
      // If deleted asset was selected, select the most recent remaining asset
      let newSelectedId = card.selectedMediaAssetId;
      if (card.selectedMediaAssetId === assetId) {
        const readyAssets = newAssets.filter((a: any) => a.status === 'ready');
        newSelectedId = readyAssets.length > 0 ? readyAssets[readyAssets.length - 1].id : undefined;
      }
      
      // Update legacy fields based on new selection
      const newSelectedAsset = newAssets.find((a: any) => a.id === newSelectedId);
      cards[cardIndex] = {
        ...card,
        mediaAssets: newAssets,
        selectedMediaAssetId: newSelectedId,
        generatedImageUrl: newSelectedAsset?.kind === 'image' ? newSelectedAsset.url : (newSelectedId ? card.generatedImageUrl : undefined),
        generatedVideoUrl: newSelectedAsset?.kind === 'video' ? newSelectedAsset.url : (newSelectedId ? card.generatedVideoUrl : undefined),
      };
      
      await storage.updateIcePreview(previewId, { cards });
      
      res.json({
        success: true,
        deletedAssetId: assetId,
        newSelectedAssetId: newSelectedId,
      });
    } catch (error) {
      console.error("Error deleting media asset:", error);
      res.status(500).json({ message: "Error deleting asset" });
    }
  });

  // ============ PROJECT BIBLE (Continuity Guardrails) ============
  
  // Get project bible for a preview
  app.get("/api/ice/preview/:previewId/bible", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check ownership
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      res.json({
        bible: preview.projectBible || null,
        hasProjectBible: !!preview.projectBible,
      });
    } catch (error) {
      console.error("Error fetching project bible:", error);
      res.status(500).json({ message: "Error fetching bible" });
    }
  });

  // Generate project bible from content
  app.post("/api/ice/preview/:previewId/bible/generate", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const { regenerate } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check ownership
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Don't regenerate if already exists unless explicitly requested
      if (preview.projectBible && !regenerate) {
        return res.json({
          bible: preview.projectBible,
          generated: false,
          message: "Bible already exists. Set regenerate=true to recreate.",
        });
      }
      
      // Import and call the bible generator
      const { generateProjectBible } = await import("./services/bibleGenerator");
      
      const bible = await generateProjectBible({
        title: preview.title,
        cards: preview.cards || [],
        sourceContent: preview.sourceValue,
      });
      
      // Save the bible
      await storage.updateIcePreview(previewId, { projectBible: bible });
      
      res.json({
        bible,
        generated: true,
        message: "Project Bible generated successfully",
      });
    } catch (error) {
      console.error("Error generating project bible:", error);
      res.status(500).json({ message: "Error generating bible" });
    }
  });

  // Update entire project bible
  app.put("/api/ice/preview/:previewId/bible", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const { bible } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (!bible) {
        return res.status(400).json({ message: "Bible data is required" });
      }
      
      // Increment version
      const crypto = await import("crypto");
      const updatedBible = {
        ...bible,
        versionId: crypto.randomUUID(),
        version: (preview.projectBible?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: String(req.user?.id),
      };
      
      await storage.updateIcePreview(previewId, { projectBible: updatedBible });
      
      res.json({
        bible: updatedBible,
        message: "Bible updated. Future generations will use this version.",
      });
    } catch (error) {
      console.error("Error updating project bible:", error);
      res.status(500).json({ message: "Error updating bible" });
    }
  });

  // Add/update a character in the bible
  app.put("/api/ice/preview/:previewId/bible/characters/:characterId?", requireAuth, async (req, res) => {
    try {
      const { previewId, characterId } = req.params;
      const characterData = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (!preview.projectBible) {
        return res.status(400).json({ message: "Project bible not found. Generate it first." });
      }
      
      const crypto = await import("crypto");
      const now = new Date().toISOString();
      let characters = [...(preview.projectBible.characters || [])];
      
      if (characterId) {
        // Update existing character
        const idx = characters.findIndex(c => c.id === characterId);
        if (idx === -1) {
          return res.status(404).json({ message: "Character not found" });
        }
        characters[idx] = {
          ...characters[idx],
          ...characterData,
          id: characterId,
          updatedAt: now,
        };
      } else {
        // Add new character
        characters.push({
          ...characterData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          lockedTraits: characterData.lockedTraits || [],
        });
      }
      
      const updatedBible = {
        ...preview.projectBible,
        characters,
        versionId: crypto.randomUUID(),
        version: preview.projectBible.version + 1,
        updatedAt: now,
        updatedBy: String(req.user?.id),
      };
      
      await storage.updateIcePreview(previewId, { projectBible: updatedBible });
      
      res.json({
        bible: updatedBible,
        character: characterId ? characters.find(c => c.id === characterId) : characters[characters.length - 1],
      });
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(500).json({ message: "Error updating character" });
    }
  });

  // Delete a character from the bible
  app.delete("/api/ice/preview/:previewId/bible/characters/:characterId", requireAuth, async (req, res) => {
    try {
      const { previewId, characterId } = req.params;
      
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (!preview.projectBible) {
        return res.status(400).json({ message: "Project bible not found" });
      }
      
      const crypto = await import("crypto");
      const now = new Date().toISOString();
      const characters = preview.projectBible.characters.filter(c => c.id !== characterId);
      
      const updatedBible = {
        ...preview.projectBible,
        characters,
        versionId: crypto.randomUUID(),
        version: preview.projectBible.version + 1,
        updatedAt: now,
        updatedBy: String(req.user?.id),
      };
      
      await storage.updateIcePreview(previewId, { projectBible: updatedBible });
      
      res.json({
        bible: updatedBible,
        deletedCharacterId: characterId,
      });
    } catch (error) {
      console.error("Error deleting character:", error);
      res.status(500).json({ message: "Error deleting character" });
    }
  });

  // Update world bible
  app.put("/api/ice/preview/:previewId/bible/world", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const worldData = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (!preview.projectBible) {
        return res.status(400).json({ message: "Project bible not found. Generate it first." });
      }
      
      const crypto = await import("crypto");
      const now = new Date().toISOString();
      
      const updatedBible = {
        ...preview.projectBible,
        world: {
          ...preview.projectBible.world,
          ...worldData,
          updatedAt: now,
        },
        versionId: crypto.randomUUID(),
        version: preview.projectBible.version + 1,
        updatedAt: now,
        updatedBy: String(req.user?.id),
      };
      
      await storage.updateIcePreview(previewId, { projectBible: updatedBible });
      
      res.json({
        bible: updatedBible,
        world: updatedBible.world,
      });
    } catch (error) {
      console.error("Error updating world bible:", error);
      res.status(500).json({ message: "Error updating world" });
    }
  });

  // Update style bible
  app.put("/api/ice/preview/:previewId/bible/style", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const styleData = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      if (preview.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (!preview.projectBible) {
        return res.status(400).json({ message: "Project bible not found. Generate it first." });
      }
      
      const crypto = await import("crypto");
      const now = new Date().toISOString();
      
      const updatedBible = {
        ...preview.projectBible,
        style: {
          ...preview.projectBible.style,
          ...styleData,
          noOnScreenText: true, // Always enforce no text
          updatedAt: now,
        },
        versionId: crypto.randomUUID(),
        version: preview.projectBible.version + 1,
        updatedAt: now,
        updatedBy: String(req.user?.id),
      };
      
      await storage.updateIcePreview(previewId, { projectBible: updatedBible });
      
      res.json({
        bible: updatedBible,
        style: updatedBible.style,
      });
    } catch (error) {
      console.error("Error updating style bible:", error);
      res.status(500).json({ message: "Error updating style" });
    }
  });

  // Update music and style settings for a preview
  app.put("/api/ice/preview/:previewId/settings", async (req, res) => {
    try {
      const { previewId } = req.params;
      const { musicTrackUrl, musicVolume, musicEnabled, titlePackId, narrationVolume, captionSettings } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (musicTrackUrl !== undefined) updateData.musicTrackUrl = musicTrackUrl;
      if (musicVolume !== undefined) updateData.musicVolume = musicVolume;
      if (musicEnabled !== undefined) updateData.musicEnabled = musicEnabled;
      if (titlePackId !== undefined) updateData.titlePackId = titlePackId;
      if (narrationVolume !== undefined) updateData.narrationVolume = narrationVolume;
      if (captionSettings !== undefined) updateData.captionSettings = captionSettings;
      
      await storage.updateIcePreview(previewId, updateData);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating preview settings:", error);
      res.status(500).json({ message: "Error updating settings" });
    }
  });

  // ============ VIDEO EXPORT ============

  // Create a video export job for an ICE preview
  app.post("/api/ice/preview/:previewId/export", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const { quality = "standard", includeNarration = true, includeMusic = true, titlePackId, captionState, useCaptionEngine = false } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      const user = req.user as schema.User;
      
      // Check ownership
      if (preview.ownerUserId !== user.id) {
        return res.status(403).json({ message: "Not authorized to export this preview" });
      }
      
      // Check entitlements for export capability
      const entitlements = await getFullEntitlements(user.id);
      if (!entitlements.canExport) {
        return res.status(403).json({ 
          message: "Video export requires a paid subscription",
          upgradeRequired: true,
        });
      }
      
      // Check if object storage is configured
      const objectStore = await import("./storage/objectStore");
      if (!objectStore.isObjectStorageConfigured()) {
        return res.status(503).json({ message: "Object storage not configured for exports" });
      }
      
      // Create the export job
      const { createExportJob } = await import("./video/exportService");
      
      const jobId = await createExportJob({
        userId: user.id,
        previewId,
        quality: quality as any,
        includeNarration,
        includeMusic,
        titlePackId: titlePackId || preview.titlePackId,
        musicTrackUrl: preview.musicTrackUrl || undefined,
        musicVolume: preview.musicVolume || 50,
        narrationVolume: preview.narrationVolume || 100,
        captionState,
        useCaptionEngine,
      });
      
      res.json({
        success: true,
        jobId,
        message: "Video export started",
      });
    } catch (error) {
      console.error("Error creating video export:", error);
      res.status(500).json({ message: "Error starting video export" });
    }
  });

  // Get video export job status
  app.get("/api/ice/export/:jobId", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const user = req.user as schema.User;
      
      const job = await storage.getVideoExportJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      
      // Check ownership
      if (job.userId !== user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      res.json({
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        outputUrl: job.outputUrl,
        outputSizeBytes: job.outputSizeBytes,
        outputDurationSeconds: job.outputDurationSeconds,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        expiresAt: job.expiresAt,
      });
    } catch (error) {
      console.error("Error fetching export status:", error);
      res.status(500).json({ message: "Error fetching export status" });
    }
  });

  // List user's video export jobs
  app.get("/api/ice/exports", requireAuth, async (req, res) => {
    try {
      const user = req.user as schema.User;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const jobs = await storage.getVideoExportJobsByUser(user.id, limit);
      
      res.json({
        exports: jobs.map(job => ({
          jobId: job.jobId,
          status: job.status,
          progress: job.progress,
          currentStep: job.currentStep,
          outputUrl: job.outputUrl,
          outputSizeBytes: job.outputSizeBytes,
          outputDurationSeconds: job.outputDurationSeconds,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          expiresAt: job.expiresAt,
        })),
      });
    } catch (error) {
      console.error("Error listing exports:", error);
      res.status(500).json({ message: "Error listing exports" });
    }
  });

  // AI Prompt Enhancement - generate production-grade prompts for better AI outputs
  app.post("/api/ai/enhance-prompt", requireAuth, async (req, res) => {
    try {
      const { cardTitle, cardContent, styleHints, mediaType } = req.body;
      
      if (!cardContent && !cardTitle) {
        return res.status(400).json({ message: "Card title or content is required" });
      }
      
      const basePrompt = `${cardTitle || ''}. ${cardContent || ''}`.trim();
      
      // Construct the enhancement prompt
      const systemPrompt = `You are a professional visual director and cinematographer. Your job is to transform story descriptions into production-grade prompts for AI image/video generation.

The output must be optimized for ${mediaType === 'video' ? 'AI video generation (Kling/Runway)' : 'AI image generation (DALL-E/GPT-Image)'}.

CRITICAL RULES:
- NEVER include text, words, letters, titles, captions, watermarks, or typography in the output
- Focus on pure visual imagery only
- Include specific camera angles, lighting, mood, and cinematic techniques
- Use 9:16 vertical aspect ratio framing
- Keep descriptions visual and actionable

Style preferences: ${styleHints || 'cinematic, professional, high production value'}

Return a JSON object with:
{
  "finalPrompt": "The optimized prompt ready for the AI generator",
  "negativePrompt": "Things to avoid in generation",
  "styleTags": ["array", "of", "style", "keywords"],
  "shotNotes": "Brief cinematography notes (optional)"
}`;

      const userPrompt = `Transform this into a production-grade visual prompt:

"${basePrompt}"`;

      // Call OpenAI for enhancement
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 500,
      });
      
      const responseText = completion.choices[0]?.message?.content || '{}';
      let enhanced;
      try {
        enhanced = JSON.parse(responseText);
      } catch {
        enhanced = { finalPrompt: responseText, negativePrompt: "", styleTags: [] };
      }
      
      res.json({
        success: true,
        basePrompt,
        enhancedPrompt: enhanced.finalPrompt || basePrompt,
        negativePrompt: enhanced.negativePrompt || "blurry, low quality, distorted, watermark, text, words, letters, titles, captions, typography, writing",
        styleTags: enhanced.styleTags || [],
        shotNotes: enhanced.shotNotes || "",
      });
    } catch (error) {
      console.error("Error enhancing prompt:", error);
      res.status(500).json({ message: "Error enhancing prompt" });
    }
  });

  // Promote ICE preview to full transformation (requires auth)
  app.post("/api/transformations/from-preview", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required to save your experience" });
    }
    
    try {
      const { previewId } = req.body;
      if (!previewId || typeof previewId !== "string") {
        return res.status(400).json({ message: "Preview ID is required" });
      }
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check expiry
      if (preview.expiresAt < new Date()) {
        return res.status(410).json({ message: "Preview has expired" });
      }
      
      if (preview.status === "promoted") {
        // If already promoted by this user, return the existing job
        if (preview.ownerUserId === req.user.id && preview.promotedToJobId) {
          return res.json({
            success: true,
            jobId: preview.promotedToJobId,
            message: "Experience already saved",
          });
        }
        return res.status(400).json({ message: "Preview already promoted by another user" });
      }
      
      // Verify ownership - must match original creator IP or be the authenticated owner
      const userIp = req.ip || req.socket.remoteAddress || "unknown";
      const isAuthenticatedOwner = preview.ownerUserId === req.user.id;
      const isOriginalIpCreator = preview.ownerIp === userIp;
      
      // Allow if: (1) already associated with this user, OR (2) created from same IP (same session)
      if (!isAuthenticatedOwner && !isOriginalIpCreator) {
        return res.status(403).json({ message: "You are not the owner of this preview" });
      }
      
      // Create a transformation job from the preview
      const job = await storage.createTransformationJob({
        userId: req.user.id,
        sourceType: preview.sourceType as any,
        sourceValue: preview.sourceValue,
        title: preview.title,
        status: "completed",
        currentStage: 5,
        totalStages: 6,
        artifacts: {
          extractedCards: preview.cards,
          fromPreview: true,
          previewId: preview.id,
        },
      });
      
      // Mark preview as promoted
      await storage.promoteIcePreview(previewId, req.user.id, job.id);
      
      res.json({
        success: true,
        jobId: job.id,
        message: "Experience saved successfully",
      });
    } catch (error) {
      console.error("Error promoting ICE preview:", error);
      res.status(500).json({ message: "Error saving experience" });
    }
  });

  // ============ PREVIEW INSTANCES (Micro Smart Site) ============
  const { validateUrlSafety: validatePreviewUrl, ingestSitePreview, generatePreviewId, calculateExpiresAt } = await import("./previewHelpers");

  // ============ Active Ice Hosting Endpoints ============
  
  // Activate an Ice (make it publicly accessible)
  app.post("/api/experiences/:id/activate", activationRateLimiter, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const universeId = parseInt(req.params.id);
      if (isNaN(universeId)) {
        return res.status(400).json({ message: "Invalid experience ID" });
      }
      
      // Check ownership - get universe and verify user has access
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Experience not found" });
      }
      
      // Only allow activation by owner or admin
      // If already owned, check ownership. If unowned (draft), any authenticated creator can claim it.
      if (universe.ownerUserId && universe.ownerUserId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to activate this experience" });
      }
      
      // Get entitlements
      const entitlements = await getFullEntitlements(req.user.id);
      
      // Check if already at limit
      const currentActiveCount = await storage.getActiveIceCount(req.user.id);
      const limit = entitlements.activeIceLimit;
      
      // -1 means unlimited
      if (limit !== -1 && currentActiveCount >= limit) {
        return res.status(403).json({
          message: `You've reached your active experience limit (${limit}). Upgrade your plan or pause another experience.`,
          currentActive: currentActiveCount,
          limit,
        });
      }
      
      // Activate the Ice
      const updated = await storage.activateIce(universeId, req.user.id);
      
      res.json({
        success: true,
        iceStatus: updated?.iceStatus,
        activeSince: updated?.activeSince,
        currentActive: currentActiveCount + 1,
        limit,
      });
    } catch (error) {
      console.error("Error activating Ice:", error);
      res.status(500).json({ message: "Error activating experience" });
    }
  });
  
  // Pause an Ice (remove from public access)
  app.post("/api/experiences/:id/pause", activationRateLimiter, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const universeId = parseInt(req.params.id);
      if (isNaN(universeId)) {
        return res.status(400).json({ message: "Invalid experience ID" });
      }
      
      // Check ownership
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Experience not found" });
      }
      
      if (universe.ownerUserId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to pause this experience" });
      }
      
      // Pause the Ice
      const updated = await storage.pauseIce(universeId);
      const currentActiveCount = await storage.getActiveIceCount(req.user.id);
      
      res.json({
        success: true,
        iceStatus: updated?.iceStatus,
        pausedAt: updated?.pausedAt,
        currentActive: currentActiveCount,
      });
    } catch (error) {
      console.error("Error pausing Ice:", error);
      res.status(500).json({ message: "Error pausing experience" });
    }
  });
  
  // Get Ice hosting status
  app.get("/api/experiences/:id/status", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const universeId = parseInt(req.params.id);
      if (isNaN(universeId)) {
        return res.status(400).json({ message: "Invalid experience ID" });
      }
      
      const universe = await storage.getUniverse(universeId);
      if (!universe) {
        return res.status(404).json({ message: "Experience not found" });
      }
      
      // Only allow status viewing by owner or admin
      if (universe.ownerUserId && universe.ownerUserId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to view this experience status" });
      }
      
      // Get owner's current limits
      const entitlements = await getFullEntitlements(req.user.id);
      const currentActive = await storage.getActiveIceCount(req.user.id);
      
      res.json({
        iceStatus: universe.iceStatus,
        activeSince: universe.activeSince,
        pausedAt: universe.pausedAt,
        ownerUserId: universe.ownerUserId,
        currentActive,
        limit: entitlements.activeIceLimit,
        analyticsEnabled: entitlements.analyticsEnabled,
        chatEnabled: entitlements.chatEnabled,
      });
    } catch (error) {
      console.error("Error getting Ice status:", error);
      res.status(500).json({ message: "Error fetching status" });
    }
  });
  
  // Get user's Active Ice summary
  app.get("/api/user/active-ices", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const entitlements = await getFullEntitlements(req.user.id);
      const currentActive = await storage.getActiveIceCount(req.user.id);
      
      res.json({
        currentActive,
        limit: entitlements.activeIceLimit,
        remaining: entitlements.activeIceLimit === -1 ? -1 : entitlements.activeIceLimit - currentActive,
        analyticsEnabled: entitlements.analyticsEnabled,
        chatEnabled: entitlements.chatEnabled,
      });
    } catch (error) {
      console.error("Error getting Active Ice summary:", error);
      res.status(500).json({ message: "Error fetching summary" });
    }
  });

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
      
      // Generate preview access token for chat
      const { generatePublicAccessToken } = await import("./publicAccessToken");
      const previewAccessToken = generatePublicAccessToken(preview.id, "preview");

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
        previewAccessToken,
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

  // DEPRECATED: Chat with preview (legacy endpoint)
  // Frontend now uses unified /api/orbit/:slug/chat with accessToken
  // This endpoint is kept for backward compatibility and will be removed in future
  app.post("/api/previews/:id/chat", chatRateLimiter, chatRequestValidator, chatMessageValidator, async (req, res) => {
    try {
      const { message, previewAccessToken } = req.body;
      const ip = getClientIp(req);
      const previewId = req.params.id;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Validate preview access token
      if (!previewAccessToken) {
        logAuthFailure('/api/previews/:id/chat', 'Missing access token', 'preview', previewId, ip);
        return res.status(401).json({ message: "Access token required" });
      }
      
      const { validatePreviewToken } = await import("./publicAccessToken");
      if (!validatePreviewToken(previewAccessToken, previewId)) {
        logTokenError('/api/previews/:id/chat', 'Invalid or mismatched token', 'preview', previewId, ip);
        return res.status(403).json({ message: "Invalid access token" });
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

      // Atomically increment message count and check cap (prevents race condition)
      // This must happen BEFORE processing to prevent concurrent requests from bypassing the limit
      const newMessageCount = await storage.incrementPreviewMessageCountIfUnderLimit(preview.id, preview.maxMessages);

      if (newMessageCount === null) {
        // Hit the limit
        return res.json({
          capped: true,
          reason: "message_limit",
          message: "You've reached the message limit for this preview. Claim it to continue.",
          messageCount: preview.maxMessages,
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

      // Use shared chat service for context building
      const { buildOrbitContext, buildSystemPrompt, generateChatResponse, processEchoResponse: processResponse } = await import('./services/orbitChatService');
      
      let productContext = '';
      let documentContext = '';
      let systemPrompt: string;
      
      if (orbit) {
        const orbitContext = await buildOrbitContext(storage, orbit.businessSlug);
        productContext = orbitContext.productContext;
        documentContext = orbitContext.documentContext;
        
        let sourceDomain = '';
        try {
          if (orbit.sourceUrl) {
            sourceDomain = new URL(orbit.sourceUrl).hostname.replace('www.', '');
          }
        } catch {
          sourceDomain = '';
        }
        
        systemPrompt = buildSystemPrompt(
          {
            slug: orbit.businessSlug,
            brandName: preview.siteTitle || orbit.customTitle || orbit.businessSlug,
            sourceDomain,
            siteSummary: preview.siteSummary,
            keyServices: preview.keyServices,
          },
          productContext,
          documentContext,
          orbitContext.businessType,
          orbitContext.businessTypeLabel,
          orbitContext.offeringsLabel,
          orbitContext.items,
          orbitContext.heroPostContext,
          orbitContext.videoContext
        );
      } else {
        systemPrompt = `You are Echo, a calm and knowledgeable guide for ${preview.siteTitle}.

CONTEXT:
${preview.siteSummary}

${preview.keyServices && preview.keyServices.length > 0 ? `SERVICES:
${preview.keyServices.map((s: string) => `• ${s}`).join('\n')}` : ''}

## Response Rules:
- Be friendly and helpful - never leave questions unanswered
- Keep responses concise (2-4 sentences max)
- Lead with value, not filler like "Great question!"
- If you genuinely don't have information, say so and suggest where to find it`;
      }
      
      const historyForAI = history.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const rawReply = await generateChatResponse(systemPrompt, historyForAI, message, { maxTokens: 200 });
      const reply = processResponse(rawReply);

      // Save assistant message
      await storage.addPreviewChatMessage({
        previewId: preview.id,
        role: "assistant",
        content: reply,
      });

      // Note: Message count already incremented atomically at the start of request
      // Update cost estimate (rough: ~0.01p per message for mini model)
      await storage.updatePreviewInstance(preview.id, {
        costEstimatePence: (preview.costEstimatePence || 0) + 1,
        llmCallCount: (preview.llmCallCount || 0) + 1,
      });
      
      // Detect product-related intents and log analytics
      let productQueryIntent: string | null = null;
      if (orbit) {
        const lowerMessage = message.toLowerCase();
        
        // Detect add-to-cart/purchase intent
        const purchasePatterns = [
          /\b(order|buy|purchase|get|want|add|cart)\b/i,
          /how much (is|are|does|do)/i,
          /price (of|for)/i,
          /can i (have|get|order)/i,
        ];
        
        // Detect dietary/filter queries
        const dietaryPatterns = [
          /\b(vegan|vegetarian|gluten.?free|dairy.?free|nut.?free|allerg)/i,
          /\b(organic|healthy|low.?calorie|keto|halal|kosher)\b/i,
        ];
        
        // Detect recommendation queries
        const recommendPatterns = [
          /\b(recommend|suggest|best|popular|what should|what do you)/i,
          /\b(similar to|like|instead of|alternative)\b/i,
        ];
        
        // Detect availability queries
        const availabilityPatterns = [
          /\b(available|in stock|out of stock|sold out|when)\b/i,
        ];
        
        if (purchasePatterns.some(p => p.test(lowerMessage))) {
          productQueryIntent = 'purchase_intent';
        } else if (dietaryPatterns.some(p => p.test(lowerMessage))) {
          productQueryIntent = 'dietary_filter';
        } else if (recommendPatterns.some(p => p.test(lowerMessage))) {
          productQueryIntent = 'recommendation_request';
        } else if (availabilityPatterns.some(p => p.test(lowerMessage))) {
          productQueryIntent = 'availability_check';
        }
        
        // Log product intent analytics asynchronously
        if (productQueryIntent) {
          storage.logOrbitProductEvent({
            businessSlug: orbit.businessSlug,
            eventType: 'product_query',
            intent: productQueryIntent,
            messageContent: message.slice(0, 200),
            conversationId: null,
          }).catch(err => console.error('Error logging product event:', err));
        }
      }
      
      // Increment orbit analytics AFTER message is successfully processed
      if (orbit && !isPaidOrbit) {
        await storage.incrementOrbitMetric(orbit.businessSlug, 'conversations');
      }

      // Check for testimonial-worthy praise in user message (if orbit exists)
      let proofCaptureFlow = null;
      let suggestionChip = null;
      
      if (orbit && orbit.proofCaptureEnabled !== false) {
        try {
          const { 
            classifyTestimonialMoment, 
            shouldTriggerProofCapture, 
            getContextQuestion, 
            getConsentRequest,
            isDetailedPraiseResponse,
            parseConsentResponse,
            getConsentFollowup
          } = await import('./services/proofCapture');
          
          const recentUserMessages = history
            .filter((m: any) => m.role === 'user')
            .slice(-5)
            .map((m: any) => m.content);
          
          const recentAssistantMessages = history
            .filter((m: any) => m.role === 'assistant')
            .slice(-3)
            .map((m: any) => m.content);
          
          // Check if we're in the middle of a proof capture flow by examining recent assistant messages
          const lastAssistantMsg = recentAssistantMessages[recentAssistantMessages.length - 1] || '';
          // Match context questions from proofCapture.ts TOPIC_QUESTIONS
          const isInContextQuestionStage = 
            lastAssistantMsg.includes("I'd love to know more") ||
            lastAssistantMsg.includes("what was the highlight") ||
            lastAssistantMsg.includes("what stood out") ||
            lastAssistantMsg.includes("what was the main thing") ||
            lastAssistantMsg.includes("what would you say") ||
            lastAssistantMsg.includes("Tell me more about what") ||
            lastAssistantMsg.includes("what is it about") ||
            lastAssistantMsg.includes("what impressed you") ||
            lastAssistantMsg.includes("what makes it special");
          const isInConsentStage = lastAssistantMsg.includes('Would you be happy for us to use your comment');
          
          console.log('[ProofCapture:Preview] Flow state - Context stage:', isInContextQuestionStage, 'Consent stage:', isInConsentStage);
          
          if (isInConsentStage) {
            // Handle consent response
            const consentResponse = parseConsentResponse(message);
            console.log('[ProofCapture:Preview] Consent response:', consentResponse);
            
            if (consentResponse) {
              const followup = getConsentFollowup(consentResponse);
              proofCaptureFlow = {
                stage: 'consent_received',
                consentType: consentResponse,
                followUpMessage: followup,
              };
            }
          } else if (isInContextQuestionStage) {
            // Handle detailed response after context question
            const detailCheck = await isDetailedPraiseResponse(message, recentUserMessages);
            console.log('[ProofCapture:Preview] Detail check:', JSON.stringify(detailCheck));
            
            if (detailCheck.hasDetail) {
              // Got a meaningful response, now ask for consent
              const consentInfo = getConsentRequest();
              proofCaptureFlow = {
                stage: 'consent_request',
                expandedQuote: detailCheck.combinedQuote,
                consentOptions: consentInfo.options,
              };
            } else {
              // Response wasn't detailed enough, ask clarifier
              proofCaptureFlow = {
                stage: 'clarifier',
                clarifierQuestion: "Was there a specific moment or thing that made you feel that way?",
              };
            }
          } else {
            // Check for new praise
            const classification = await classifyTestimonialMoment(message, recentUserMessages);
            
            console.log('[ProofCapture:Preview] Classification for message:', message);
            console.log('[ProofCapture:Preview] Result:', JSON.stringify(classification));
            
            const proofCaptureTrigger = shouldTriggerProofCapture(true, null, classification);
            
            console.log('[ProofCapture:Preview] Trigger decision:', JSON.stringify(proofCaptureTrigger));
            
            if (proofCaptureTrigger.shouldTrigger) {
              // Step 1: Ask contextual question to draw out more detail
              const topicQuestion = getContextQuestion(classification.topic);
              
              proofCaptureFlow = {
                stage: 'context_question',
                topic: classification.topic,
                originalMessage: message,
                confidence: classification.confidence,
                specificityScore: classification.specificityScore,
                followUpQuestion: topicQuestion,
              };
            } else if (proofCaptureTrigger.showSuggestionChip) {
              suggestionChip = {
                text: "Leave a testimonial",
                action: "testimonial",
              };
            }
          }
        } catch (err) {
          console.error('[ProofCapture:Preview] Error during classification:', err);
        }
      }

      // Build response with optional soft limit warning and testimonial flow
      const response: Record<string, any> = {
        reply,
        messageCount: newMessageCount,
        capped: newMessageCount >= preview.maxMessages,
      };
      
      // Add proof capture flow if triggered
      if (proofCaptureFlow) {
        response.proofCaptureFlow = proofCaptureFlow;
        
        if (proofCaptureFlow.stage === 'context_question') {
          // Step 1: Just ask the context question (no consent yet)
          response.reply = `${reply}\n\n${proofCaptureFlow.followUpQuestion}`;
        } else if (proofCaptureFlow.stage === 'clarifier') {
          // Clarifying question if response wasn't detailed enough
          response.reply = `${reply}\n\n${proofCaptureFlow.clarifierQuestion}`;
        } else if (proofCaptureFlow.stage === 'consent_request') {
          // Step 2: Now ask for consent after getting detailed feedback
          response.reply = `${reply}\n\nWould you be happy for us to use your comment as a testimonial?\n\n• ${proofCaptureFlow.consentOptions.join('\n• ')}`;
        } else if (proofCaptureFlow.stage === 'consent_received') {
          // Step 3: Confirm consent
          response.reply = proofCaptureFlow.followUpMessage;
        }
      } else if (suggestionChip) {
        response.suggestionChip = suggestionChip;
        response.reply = `${reply}\n\n💬 By the way, if you'd like to leave a testimonial, just let me know!`;
      }
      
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

  // Force re-extraction of preview site data (with deep scraping)
  app.post("/api/previews/:id/re-extract", async (req, res) => {
    try {
      const preview = await storage.getPreviewInstance(req.params.id);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      if (!preview.sourceUrl) {
        return res.status(400).json({ message: "No source URL to re-extract" });
      }

      console.log(`[Re-Extract] Starting forced deep extraction for preview ${preview.id} from ${preview.sourceUrl}`);

      // Force deep extraction by passing forceDeep: true
      const { ingestSitePreview } = await import("./previewHelpers");
      const siteData = await ingestSitePreview(preview.sourceUrl, { forceDeep: true });

      const imageCount = siteData.siteIdentity?.imagePool?.length || 0;
      const hasLogo = !!siteData.siteIdentity?.logoUrl;
      console.log(`[Re-Extract] Extraction complete: ${siteData.totalChars} chars, ${imageCount} images, logo: ${hasLogo}`);

      // Update the preview with new site identity
      const updatedPreview = await storage.updatePreviewInstance(preview.id, {
        siteTitle: siteData.title,
        siteSummary: siteData.summary,
        siteIdentity: siteData.siteIdentity as any,
      });

      // If there's a linked orbit, update its source metadata too
      const orbit = await storage.getOrbitMetaByPreviewId(preview.id);
      if (orbit) {
        console.log(`[Re-Extract] Also updating linked orbit: ${orbit.businessSlug}`);
        await storage.updateOrbitMeta(orbit.businessSlug, {
          lastUpdated: new Date(),
        });
      }

      res.json({ 
        success: true, 
        message: "Site data re-extracted with deep scraping",
        preview: updatedPreview,
        stats: {
          chars: siteData.totalChars,
          images: imageCount,
          hasLogo: hasLogo,
          pagesIngested: siteData.pagesIngested,
        }
      });
    } catch (error: any) {
      console.error("[Re-Extract] Error:", error);
      res.status(500).json({ message: error.message || "Error re-extracting site data" });
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
        allow_promotion_codes: true,
        line_items: [
          {
            price: plan.stripePriceIdMonthly!,
            quantity: 1,
          },
        ],
        success_url: `${getAppBaseUrl(req)}/preview/${preview.id}?claimed=true`,
        cancel_url: `${getAppBaseUrl(req)}/preview/${preview.id}`,
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
  
  // Auto-detect catalogue/menu from URL
  app.post("/api/orbit/detect", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      // SSRF protection
      const { validateUrlSafety } = await import("./previewHelpers");
      const validation = await validateUrlSafety(url.trim());
      if (!validation.safe) {
        return res.status(400).json({ message: validation.error || "Invalid URL" });
      }

      const { detectSiteType, deriveExtractionPlan } = await import("./services/catalogueDetection");
      
      console.log(`[Orbit] Starting auto-detection for: ${url}`);
      
      const scores = await detectSiteType(url);
      const plan = deriveExtractionPlan(scores);

      console.log(`[Orbit] Detection complete: ${plan.type} (confidence: ${(plan.confidence * 100).toFixed(1)}%)`);

      res.json({
        success: true,
        url,
        scores: {
          catalogue: scores.scoreCatalogue,
          menu: scores.scoreMenu,
          service: scores.scoreService,
          confidence: scores.confidence,
          primaryType: scores.primaryType,
        },
        plan,
        signals: {
          structuredData: scores.signals.structuredData.length,
          platforms: scores.signals.platform.map(p => p.platform),
          urlPatterns: scores.signals.urlPatterns.map(p => p.pattern),
          domHeuristics: scores.signals.domHeuristics.map(h => ({ type: h.type, count: h.count })),
        },
      });
    } catch (error: any) {
      console.error("Error detecting site type:", error);
      res.status(500).json({ message: error.message || "Error detecting site type" });
    }
  });

  // Helper to filter out bad images during extraction (delegates to shared mediaFilter)
  function isExtractionBadImage(url: string): boolean {
    const { isBadImageUrl } = require('./utils/mediaFilter');
    return isBadImageUrl(url);
  }

  // Auto-generate Orbit with detection and extraction
  app.post("/api/orbit/auto-generate", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      // SSRF protection
      const { validateUrlSafety } = await import("./previewHelpers");
      const validation = await validateUrlSafety(url.trim());
      if (!validation.safe) {
        return res.status(400).json({ message: validation.error || "Invalid URL" });
      }

      const { generateSlug } = await import("./orbitPackGenerator");
      const { detectSiteType, deriveExtractionPlan, extractCatalogueItems, extractMenuItemsMultiPage, validateExtractionQuality, fingerprintSite, extractMenuItemsWithAI, extractServiceConceptsMultiPage } = await import("./services/catalogueDetection");
      
      const businessSlug = generateSlug(url);

      // Create or get orbit meta
      let orbitMeta = await storage.getOrbitMeta(businessSlug);
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

      // Run auto-detection
      console.log(`[Orbit] Auto-generating orbit for: ${url}`);
      const scores = await detectSiteType(url);
      const plan = deriveExtractionPlan(scores);

      console.log(`[Orbit] Detected type: ${plan.type} (confidence: ${(plan.confidence * 100).toFixed(1)}%)`);

      // Site fingerprinting (logging only for now - to guide future strategy selection)
      try {
        const fingerprint = await fingerprintSite(url);
        console.log(`[Orbit] Fingerprint: ${fingerprint.platform} (${fingerprint.type}) - strategies: ${fingerprint.strategies.join(', ')}, confidence: ${(fingerprint.confidence * 100).toFixed(0)}%`);
      } catch (fpError) {
        console.log(`[Orbit] Fingerprint detection skipped: ${(fpError as Error).message}`);
      }

      let extractedItems: any[] = [];
      let qualityInfo: { score: number; passed: boolean; issues: string[] } | null = null;

      // Extract based on detection
      if (plan.type === 'catalogue' || plan.type === 'hybrid') {
        const products = await extractCatalogueItems(url);
        extractedItems.push(...products.map(p => ({
          ...p,
          boxType: 'product',
        })));
        console.log(`[Orbit] Extracted ${products.length} catalogue products`);
      }

      if (plan.type === 'menu' || plan.type === 'hybrid') {
        // Use multi-page extraction to follow category links and get actual menu items with images
        console.log(`[Orbit] Using multi-page extraction to follow category links...`);
        const menuItems = await extractMenuItemsMultiPage(url, 15); // Follow up to 15 category pages
        
        // Validate extraction quality
        const quality = validateExtractionQuality(menuItems);
        qualityInfo = { score: quality.score, passed: quality.passed, issues: quality.issues };
        console.log(`[Orbit] Extraction quality: ${quality.score}/100 (${quality.passed ? 'PASSED' : 'FAILED'})`);
        if (quality.issues.length > 0) {
          console.log(`[Orbit] Issues: ${quality.issues.join(', ')}`);
        }
        
        // QUALITY GATE: Only persist if quality passed
        if (!quality.passed) {
          console.log(`[Orbit] QUALITY GATE BLOCKED: Score ${quality.score}/100 below threshold. Recommendations: ${quality.recommendations.join(', ')}`);
          // Don't add items - quality gate blocks persistence
        } else {
          // Filter out bad images before adding to results
          const cleanedItems = menuItems.map(m => ({
            ...m,
            imageUrl: m.imageUrl && !isExtractionBadImage(m.imageUrl) ? m.imageUrl : null,
          }));
          
          extractedItems.push(...cleanedItems.map(m => ({
            title: m.name,
            description: m.description,
            price: m.price,
            currency: m.currency,
            category: m.category,
            imageUrl: m.imageUrl,
            sourceUrl: m.sourceUrl,
            tags: [],
            boxType: 'product',
            availability: 'available' as const,
          })));
          console.log(`[Orbit] Extracted ${menuItems.length} menu items with multi-page crawl`);
        }
      }

      if (plan.type === 'service') {
        // B2B service site - extract food concepts and solutions
        console.log(`[Orbit] Detected B2B service site, extracting concepts/solutions...`);
        const serviceConcepts = await extractServiceConceptsMultiPage(url, 10);
        
        extractedItems.push(...serviceConcepts.map(concept => ({
          title: concept.name,
          description: concept.description,
          price: null,
          currency: 'GBP',
          category: concept.category,
          imageUrl: concept.imageUrl,
          sourceUrl: concept.sourceUrl,
          tags: concept.features.map(f => ({ key: 'feature', value: f })),
          boxType: 'service',
          availability: 'available' as const,
        })));
        console.log(`[Orbit] Extracted ${serviceConcepts.length} service concepts`);
      }

      // Store extracted items as orbit boxes
      if (extractedItems.length > 0) {
        for (let i = 0; i < extractedItems.length; i++) {
          const item = extractedItems[i];
          await storage.createOrbitBox({
            businessSlug,
            boxType: item.boxType || 'product',
            title: item.title || 'Unknown Item',
            description: item.description || null,
            sourceUrl: item.sourceUrl || url,
            content: null,
            imageUrl: item.imageUrl || null,
            sortOrder: i + 1,
            isVisible: true,
            iceId: null,
            price: item.price || null,
            currency: item.currency || 'GBP',
            category: item.category || null,
            subcategory: null,
            tags: item.tags || [],
            sku: null,
            availability: item.availability || 'available',
          });
        }
      }

      await storage.setOrbitGenerationStatus(businessSlug, "ready");

      res.json({
        success: true,
        businessSlug,
        status: "ready",
        detection: {
          type: plan.type,
          confidence: plan.confidence,
          rationale: plan.rationale,
        },
        itemsExtracted: extractedItems.length,
        quality: qualityInfo,
        qualityGateBlocked: qualityInfo && !qualityInfo.passed,
      });
    } catch (error: any) {
      console.error("Error auto-generating orbit:", error);
      res.status(500).json({ message: error.message || "Error generating orbit" });
    }
  });

  // Generate Orbit from URL - UNIFIED with deep extraction (everyone gets the best experience)
  app.post("/api/orbit/generate", async (req, res) => {
    try {
      const { url, extractionIntent } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }
      
      // Validate extractionIntent if provided (null = auto-detect)
      type ExtractionIntent = 'menu' | 'catalogue' | 'service' | 'case_studies' | 'content' | 'locations' | null;
      const validIntents: ExtractionIntent[] = ['menu', 'catalogue', 'service', 'case_studies', 'content', 'locations', null];
      const userIntent: ExtractionIntent = validIntents.includes(extractionIntent) ? extractionIntent : null;
      
      if (userIntent !== null) {
        console.log(`[Orbit/generate] INTENT-DRIVEN: User selected "${userIntent}" extraction`);
      } else {
        console.log(`[Orbit/generate] AUTO-DETECT: No intent provided, will detect site type`);
      }

      // Import helpers
      const { validateUrlSafety, ingestSitePreview: ingestSite, generatePreviewId: genPreviewId } = await import("./previewHelpers");
      const { generateSlug } = await import("./orbitPackGenerator");
      const { detectSiteType, deriveExtractionPlan, extractCatalogueItems, extractMenuItemsMultiPage, validateExtractionQuality, fingerprintSite, extractMenuItemsWithAI, extractServiceConceptsMultiPage } = await import("./services/catalogueDetection");
      const { deepScrapeMultiplePages } = await import("./services/deepScraper");
      
      const businessSlug = generateSlug(url);

      // SSRF protection
      const validation = await validateUrlSafety(url.trim());
      if (!validation.safe) {
        // Check if orbit meta exists and mark as failed
        const existingMeta = await storage.getOrbitMeta(businessSlug);
        if (existingMeta) {
          await storage.setOrbitGenerationStatus(businessSlug, "failed", validation.error || "Invalid URL");
        }
        return res.status(400).json({ message: validation.error || "Invalid URL" });
      }

      // Check if orbit already exists with boxes
      let orbitMeta = await storage.getOrbitMeta(businessSlug);
      
      if (orbitMeta?.generationStatus === "ready") {
        // Check if we have actual content
        const existingBoxes = await storage.getOrbitBoxes(businessSlug);
        if (existingBoxes.length > 0) {
          const preview = orbitMeta.previewId ? await storage.getPreviewInstance(orbitMeta.previewId) : null;
          return res.json({
            success: true,
            businessSlug,
            previewId: orbitMeta.previewId,
            status: "ready",
            brandName: preview?.siteIdentity?.validatedContent?.brandName || preview?.siteTitle || businessSlug,
            itemsExtracted: existingBoxes.length,
          });
        }
        // Has orbit but no boxes - re-extract
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

      // Get user ID if authenticated (for creator tracking)
      const userId = req.isAuthenticated() ? (req.user as any)?.id : null;

      // First: Ingest site for brand metadata (preview data)
      let siteData;
      let crawlStatus: 'ok' | 'blocked' | 'not_found' | 'server_error' | 'timeout' | 'no_content' = 'ok';
      
      try {
        siteData = await ingestSite(url.trim());
      } catch (err: any) {
        // Check if this is a blocked/access denied situation
        const errMsg = err.message?.toLowerCase() || '';
        const isBlocked = errMsg.includes('403') || errMsg.includes('blocked') || errMsg.includes('access denied') || errMsg.includes('401');
        const isNotFound = errMsg.includes('404') || errMsg.includes('not found');
        const isTimeout = errMsg.includes('timeout');
        
        if (isBlocked) {
          crawlStatus = 'blocked';
          // Don't fail - return success with import options
          await storage.setOrbitGenerationStatus(businessSlug, "blocked");
          
          // Create minimal preview for tracking
          const preview = await storage.createPreviewInstance({
            id: genPreviewId(),
            ownerUserId: userId,
            ownerIp: userId ? null : req.ip || null,
            sourceUrl: url.trim(),
            sourceDomain: validation.domain!,
            siteTitle: businessSlug.replace(/-/g, ' '),
            siteSummary: null,
            keyServices: null,
            contactInfo: null,
            siteIdentity: null,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            ingestedPagesCount: 0,
            totalCharsIngested: 0,
            status: "active",
          });
          
          await storage.setOrbitPreviewId(businessSlug, preview.id);
          
          return res.json({
            success: true,
            businessSlug,
            previewId: preview.id,
            status: "blocked",
            crawlStatus: 'blocked',
            showImportOptions: true,
            message: "We couldn't read this site automatically. This website uses bot protection.",
            importOptions: ['paste', 'csv', 'connect'],
          });
        }
        
        // Other errors are actual failures
        crawlStatus = isNotFound ? 'not_found' : isTimeout ? 'timeout' : 'server_error';
        await storage.setOrbitGenerationStatus(businessSlug, "failed", err.message);
        return res.status(400).json({ 
          message: `Could not access website: ${err.message}`,
          crawlStatus,
        });
      }

      // Run extraction based on user intent OR auto-detect
      console.log(`[Orbit/generate] Starting extraction for: ${url}`);
      let scores, plan;
      try {
        // If user provided an intent, bypass detection and use it directly
        if (userIntent !== null) {
          console.log(`[Orbit/generate] INTENT-DRIVEN: Bypassing detection, using "${userIntent}" extractor`);
          
          // Map intent to extraction plan
          const intentToStrategies: Record<NonNullable<ExtractionIntent>, string[]> = {
            'menu': ['menu-dom', 'ai-menu'],
            'catalogue': ['catalogue-dom', 'ai-catalogue'],
            'service': ['service-ai'],
            'case_studies': ['content-ai'],
            'content': ['content-ai'],
            'locations': ['content-ai'],
          };
          
          plan = {
            type: userIntent as any, // Trust user intent
            confidence: 1.0, // User selection = 100% confident
            rationale: `User selected: ${userIntent}`,
            strategies: intentToStrategies[userIntent] || ['ai-fallback'],
            intentDriven: true,
          };
          scores = null; // Not used when intent provided
        } else {
          // Auto-detect
          scores = await detectSiteType(url);
          plan = { ...deriveExtractionPlan(scores), intentDriven: false };
          console.log(`[Orbit/generate] AUTO-DETECT: Detected type "${plan.type}" (confidence: ${(plan.confidence * 100).toFixed(1)}%)`);
        }
      } catch (detectErr: any) {
        await storage.setOrbitGenerationStatus(businessSlug, "failed", `Detection failed: ${detectErr.message}`);
        return res.status(400).json({ message: `Could not analyze website: ${detectErr.message}` });
      }

      // Site fingerprinting
      try {
        const fingerprint = await fingerprintSite(url);
        console.log(`[Orbit/generate] Fingerprint: ${fingerprint.platform} (${fingerprint.type}) - strategies: ${fingerprint.strategies.join(', ')}`);
      } catch (fpError) {
        console.log(`[Orbit/generate] Fingerprint detection skipped: ${(fpError as Error).message}`);
      }

      let extractedItems: any[] = [];
      let qualityInfo: { score: number; passed: boolean; issues: string[] } | null = null;

      // Extract based on detection (DEEP EXTRACTION FOR EVERYONE)
      if (plan.type === 'catalogue' || plan.type === 'hybrid') {
        const products = await extractCatalogueItems(url);
        extractedItems.push(...products.map(p => ({
          ...p,
          boxType: 'product',
        })));
        console.log(`[Orbit/generate] Extracted ${products.length} catalogue products`);
      }

      // Try menu extraction if: explicitly menu/hybrid, OR catalogue extraction returned 0 items (fallback)
      const shouldTryMenu = plan.type === 'menu' || plan.type === 'hybrid' || 
        (plan.type === 'catalogue' && extractedItems.length === 0);
      
      if (shouldTryMenu) {
        console.log(`[Orbit/generate] Using multi-page extraction to follow category links...`);
        const { deepScrapeMultiplePages, LINK_PATTERNS } = await import("./services/deepScraper");
        
        // Single crawl pass - reuse results for both DOM and AI extraction
        const crawlResult = await deepScrapeMultiplePages(url, {
          maxPages: 15,
          linkPatterns: LINK_PATTERNS.menu,
          timeout: 45000,
          sameDomainOnly: true,
          rateLimitMs: 300,
          stopAfterEmptyPages: 3
        });
        console.log(`[Orbit/generate] Crawled ${crawlResult.pages.length} pages`);
        
        // Use AI extraction directly with the crawled pages (avoids double-crawling)
        let menuItems = await extractMenuItemsWithAI(crawlResult);
        console.log(`[Orbit/generate] AI extraction found ${menuItems.length} items`);
        
        // Validate extraction quality
        const quality = validateExtractionQuality(menuItems);
        qualityInfo = { score: quality.score, passed: quality.passed, issues: quality.issues };
        console.log(`[Orbit/generate] Extraction quality: ${quality.score}/100 (${quality.passed ? 'PASSED' : 'FAILED'})`);
        
        // QUALITY GATE: Hard block if quality fails
        if (!quality.passed) {
          console.log(`[Orbit/generate] QUALITY GATE BLOCKED: Score ${quality.score}/100 below threshold. Issues: ${quality.issues.join(', ')}`);
          await storage.setOrbitGenerationStatus(businessSlug, "failed", `Quality gate failed: ${quality.issues.join(', ')}`);
          return res.status(400).json({ 
            message: `Extraction quality too low (${quality.score}/100). ${quality.issues.join('. ')}`,
            qualityGateBlocked: true,
            quality: qualityInfo,
          });
        }
        
        if (menuItems.length > 0) {
          const cleanedItems = menuItems.map(m => ({
            ...m,
            imageUrl: m.imageUrl && !isExtractionBadImage(m.imageUrl) ? m.imageUrl : null,
          }));
          
          extractedItems.push(...cleanedItems.map(m => ({
            title: m.name,
            description: m.description,
            price: m.price,
            currency: m.currency,
            category: m.category,
            imageUrl: m.imageUrl,
            sourceUrl: m.sourceUrl,
            tags: [],
            boxType: 'product',
            availability: 'available' as const,
          })));
          console.log(`[Orbit/generate] Extracted ${menuItems.length} menu items with multi-page crawl`);
        }
      }

      // Handle B2B service sites
      if (plan.type === 'service') {
        console.log(`[Orbit/generate] Extracting services & capabilities...`);
        const serviceConcepts = await extractServiceConceptsMultiPage(url, 10);
        
        extractedItems.push(...serviceConcepts.map(concept => ({
          title: concept.name,
          description: concept.description,
          price: null,
          currency: 'GBP',
          category: concept.category,
          imageUrl: concept.imageUrl,
          sourceUrl: concept.sourceUrl,
          tags: concept.features.map(f => ({ key: 'feature', value: f })),
          boxType: 'service',
          availability: 'available' as const,
        })));
        console.log(`[Orbit/generate] Extracted ${serviceConcepts.length} service concepts`);
      }

      // Handle content-based extractions (case_studies, content, locations)
      // These use general content extraction instead of price/product patterns
      const contentTypes = ['case_studies', 'content', 'locations'];
      if (contentTypes.includes(plan.type)) {
        console.log(`[Orbit/generate] Extracting ${plan.type} content...`);
        const { deepScrapeMultiplePages: deepScrape } = await import("./services/deepScraper");
        const deepResult = await deepScrape(url, { maxPages: 15 });
        
        // For content types, we're storing site sections/pages as boxes
        for (const page of deepResult.pages) {
          if (page.title && page.text && page.text.length > 100) {
            extractedItems.push({
              title: page.title,
              description: page.text.slice(0, 500),
              price: null,
              currency: 'GBP',
              category: plan.type,
              imageUrl: null, // Content types focus on text, not images
              sourceUrl: page.url,
              tags: [],
              boxType: plan.type === 'locations' ? 'location' : plan.type === 'case_studies' ? 'case_study' : 'content',
              availability: 'available' as const,
            });
          }
        }
        console.log(`[Orbit/generate] Extracted ${extractedItems.length} ${plan.type} items from ${deepResult.pages.length} pages`);
      }

      // If no catalogue/menu detected (type is 'none'), try deep scrape for general content
      if (extractedItems.length === 0 && plan.type === 'none') {
        console.log(`[Orbit/generate] No catalogue/menu found, running deep scrape for content...`);
        try {
          const { deepScrapeMultiplePages: deepScrape } = await import("./services/deepScraper");
          const deepResult = await deepScrape(url, { maxPages: 10 });
          
          // Check for HTTP errors in content
          const hasHttpErrors = deepResult.pages.some(p => {
            const content = (p.text || p.html || '').toLowerCase();
            return content.includes('403 forbidden') ||
              content.includes('404 not found') ||
              content.includes('access denied');
          });
          
          if (hasHttpErrors) {
            await storage.setOrbitGenerationStatus(businessSlug, "failed", "Website returned error pages (403/404)");
            return res.status(400).json({ 
              message: "Website returned error pages. Please ensure the URL is publicly accessible.",
              qualityGateBlocked: true,
            });
          }
          
          console.log(`[Orbit/generate] Deep scraped ${deepResult.pages.length} pages`);
        } catch (err) {
          console.log(`[Orbit/generate] Deep scrape failed: ${(err as Error).message}`);
        }
      }

      // QUALITY GATE with FALLBACK: If catalogue/menu extraction fails, try service extraction
      // Exception: Intent-driven service/content extractions should not fail on empty items
      // (per spec: "A lack of prices or products must never trigger a failure" for service/content extractors)
      const noQualityGateTypes = ['service', 'case_studies', 'content', 'locations'];
      const skipQualityGate = plan.intentDriven && noQualityGateTypes.includes(plan.type);
      
      // FALLBACK: If catalogue/menu extraction found nothing, try service extraction
      if (extractedItems.length === 0 && !skipQualityGate && (plan.type === 'catalogue' || plan.type === 'menu')) {
        console.log(`[Orbit/generate] FALLBACK: ${plan.type} extraction found 0 items, trying service extraction...`);
        try {
          const { extractServiceConceptsMultiPage } = await import("./services/catalogueDetection");
          const serviceResult = await extractServiceConceptsMultiPage(url);
          if (serviceResult.length > 0) {
            console.log(`[Orbit/generate] FALLBACK SUCCESS: Found ${serviceResult.length} service concepts`);
            extractedItems.push(...serviceResult.map((item: any) => ({
              title: item.name || item.title,
              description: item.description,
              price: null,
              currency: 'GBP',
              category: item.category || 'Services',
              imageUrl: null,
              sourceUrl: item.sourceUrl || url,
              tags: (item.features || []).map((f: string) => ({ key: 'feature', value: f })),
              boxType: 'service',
              availability: 'available' as const,
            })));
            // Update plan to reflect fallback
            plan.type = 'service';
            plan.rationale = `Fallback: No ${plan.type} items found, extracted services instead`;
          }
        } catch (fallbackErr: any) {
          console.log(`[Orbit/generate] FALLBACK FAILED: ${fallbackErr.message}`);
        }
      }
      
      // If still no items after fallback, use site identity data to create a basic presence
      if (extractedItems.length === 0) {
        console.log(`[Orbit/generate] Creating presence from site identity data...`);
        // Create boxes from validated content if available
        const validatedContent = siteData.siteIdentity?.validatedContent;
        if (validatedContent?.whatWeDo?.length > 0) {
          for (const service of validatedContent.whatWeDo) {
            extractedItems.push({
              title: service.slice(0, 60),
              description: service,
              price: null,
              currency: 'GBP',
              category: 'Services',
              imageUrl: null,
              sourceUrl: url,
              tags: [{ key: 'source', value: 'site-identity' }],
              boxType: 'service',
              availability: 'available' as const,
            });
          }
          console.log(`[Orbit/generate] Created ${extractedItems.length} boxes from site identity`);
        }
      }
      
      // For intent-driven content types with zero items, log but continue with site data
      if (extractedItems.length === 0 && skipQualityGate) {
        console.log(`[Orbit/generate] INTENT-DRIVEN: No structured items found for "${plan.type}", but continuing with site data`);
      }

      // UNIVERSAL ENRICHMENT: Always extract common pages (about, contact, blog) to enrich AI knowledge
      const commonPagePatterns = [
        { pattern: /\/(about|about-us|who-we-are|our-story|team|company)\/?$/i, boxType: 'page', category: 'About' },
        { pattern: /\/(contact|contact-us|get-in-touch|reach-us)\/?$/i, boxType: 'page', category: 'Contact' },
        { pattern: /\/(blog|news|articles|insights|resources|updates)/i, boxType: 'article', category: 'Blog' },
        { pattern: /\/(faq|faqs|frequently-asked|help)\/?$/i, boxType: 'page', category: 'FAQ' },
      ];
      
      try {
        console.log(`[Orbit/generate] UNIVERSAL ENRICHMENT: Scanning for common pages...`);
        const { deepScrapeMultiplePages } = await import("./services/deepScraper");
        const parsedUrl = new URL(url);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        
        // Candidate URLs to check
        const candidateUrls = [
          `${baseUrl}/about`, `${baseUrl}/about-us`, `${baseUrl}/who-we-are`, `${baseUrl}/our-story`,
          `${baseUrl}/contact`, `${baseUrl}/contact-us`,
          `${baseUrl}/blog`, `${baseUrl}/news`, `${baseUrl}/insights`,
          `${baseUrl}/faq`, `${baseUrl}/faqs`,
        ];
        
        // Use the existing deepScraper with explicit candidates
        const enrichResult = await deepScrapeMultiplePages(baseUrl, {
          maxPages: 8,
          candidates: candidateUrls,
          rateLimitMs: 300,
        });
        
        let enrichedCount = 0;
        for (const page of enrichResult.pages) {
          // Skip homepage (already captured) and very short pages
          if (page.url === baseUrl || page.url === `${baseUrl}/`) continue;
          const textLength = page.text?.length || 0;
          if (textLength < 200) continue;
          
          // Determine page type from URL
          let boxType = 'page';
          let category = 'General';
          for (const p of commonPagePatterns) {
            if (p.pattern.test(page.url)) {
              boxType = p.boxType;
              category = p.category;
              break;
            }
          }
          
          // Add as enrichment box
          extractedItems.push({
            title: page.title || `${category} Page`,
            description: page.text?.slice(0, 500) || null,
            price: null,
            currency: 'GBP',
            category: category,
            imageUrl: null,
            sourceUrl: page.url,
            tags: [{ key: 'enrichment', value: 'universal-page' }],
            boxType: boxType,
            availability: 'available' as const,
          });
          enrichedCount++;
        }
        console.log(`[Orbit/generate] UNIVERSAL ENRICHMENT: Added ${enrichedCount} common pages`);
      } catch (enrichError: any) {
        console.log(`[Orbit/generate] Universal enrichment skipped: ${enrichError.message}`);
      }

      // Store extracted items as orbit boxes
      // Clear existing boxes if re-extracting
      const existingBoxes = await storage.getOrbitBoxes(businessSlug);
      if (existingBoxes.length > 0) {
        for (const box of existingBoxes) {
          await storage.deleteOrbitBox(box.id);
        }
      }
      
      for (let i = 0; i < extractedItems.length; i++) {
        const item = extractedItems[i];
        await storage.createOrbitBox({
          businessSlug,
          boxType: item.boxType || 'product',
          title: item.title || 'Unknown Item',
          description: item.description || null,
          sourceUrl: item.sourceUrl || url,
          content: null,
          imageUrl: item.imageUrl || null,
          sortOrder: i + 1,
          isVisible: true,
          iceId: null,
          price: item.price || null,
          currency: item.currency || 'GBP',
          category: item.category || null,
          subcategory: null,
          tags: item.tags || [],
          sku: null,
          availability: item.availability || 'available',
        });
      }

      // Create preview instance with FULL brand metadata from ingestion
      const preview = await storage.createPreviewInstance({
        id: genPreviewId(),
        ownerUserId: userId,
        ownerIp: userId ? null : req.ip || null,
        sourceUrl: url.trim(),
        sourceDomain: validation.domain!,
        siteTitle: siteData.title,
        siteSummary: siteData.summary,
        keyServices: siteData.keyServices,
        contactInfo: null,
        siteIdentity: siteData.siteIdentity,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        ingestedPagesCount: siteData.pagesIngested,
        totalCharsIngested: siteData.totalChars,
        status: "active",
      });

      // Link preview to orbit and mark ready
      await storage.setOrbitPreviewId(businessSlug, preview.id);
      await storage.setOrbitGenerationStatus(businessSlug, "ready");

      res.json({
        success: true,
        businessSlug,
        previewId: preview.id,
        status: "ready",
        brandName: siteData.siteIdentity?.validatedContent?.brandName || siteData.title,
        detection: {
          type: plan.type,
          confidence: plan.confidence,
          rationale: plan.rationale,
        },
        itemsExtracted: extractedItems.length,
        quality: qualityInfo,
        pagesIngested: siteData.pagesIngested,
      });
    } catch (error: any) {
      console.error("Error generating orbit:", error);
      // Try to mark as failed if we have a businessSlug
      try {
        const { generateSlug } = await import("./orbitPackGenerator");
        const businessSlug = generateSlug(req.body.url || '');
        if (businessSlug) {
          await storage.setOrbitGenerationStatus(businessSlug, "failed", error.message);
        }
      } catch {}
      res.status(500).json({ message: error.message || "Error generating orbit" });
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

  // Viewer Context - determines role-based UI rendering
  app.get("/api/orbit/:slug/viewer-context", async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      const userId = req.isAuthenticated() ? (req.user as any)?.id : null;
      const user = req.isAuthenticated() ? (req.user as any) : null;
      // Check both email and username fields (username often stores email for email-based login)
      const userEmail = (user?.email || user?.username)?.toLowerCase() || null;
      
      // Claimed = has owner ID or owner email (verifiedAt just means generated, not claimed)
      const isClaimed = !!(orbitMeta.ownerId || orbitMeta.ownerEmail);
      
      // Determine viewer role: admin if authenticated and owner (by ID or email)
      const isOwnerById = userId && orbitMeta.ownerId === userId;
      const isOwnerByEmail = userEmail && orbitMeta.ownerEmail?.toLowerCase() === userEmail;
      const isAdmin = isOwnerById || isOwnerByEmail;
      
      // Also check if this is the creator (for unclaimed orbits created in same session)
      // We track this via the preview's ownerUserId field
      let isCreator = false;
      if (!isClaimed && userId && orbitMeta.previewId) {
        const preview = await storage.getPreviewInstance(orbitMeta.previewId);
        if (preview && preview.ownerUserId === userId) {
          isCreator = true;
        }
      }
      
      const viewerRole = (isAdmin || isCreator) ? 'admin' : 'public';
      
      // Plan tier checks
      const planTier = orbitMeta.planTier || 'free';
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const isPaidTier = PAID_TIERS.includes(planTier);
      
      // Permission flags based on hierarchy: viewerRole → claimStatus → planTier → orbitType
      const canEditAppearance = viewerRole === 'admin';
      const canDeepScan = viewerRole === 'admin' && isClaimed && isPaidTier;
      // DOCTRINE: Industry Orbits can NEVER be claimed - hide claim CTA
      const isIndustryOrbit = orbitMeta.orbitType === 'industry';
      const canSeeClaimCTA = viewerRole === 'public' && !isClaimed && !isIndustryOrbit;
      const canAccessHub = viewerRole === 'admin' && isClaimed;
      const isFirstRun = viewerRole === 'admin' && !isClaimed;
      
      res.json({
        viewerRole,
        isClaimed,
        isFirstRun,
        planTier,
        orbitType: orbitMeta.orbitType || 'standard',
        isIndustryOrbit,
        canEditAppearance,
        canDeepScan,
        canSeeClaimCTA,
        canAccessHub,
        businessSlug: orbitMeta.businessSlug,
        generationStatus: orbitMeta.generationStatus,
      });
    } catch (error) {
      console.error("Error getting viewer context:", error);
      res.status(500).json({ message: "Error getting viewer context" });
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
          customLogo: orbitMeta.customLogo,
          customAccent: orbitMeta.customAccent,
          customTone: orbitMeta.customTone,
          lastUpdated: orbitMeta.lastUpdated,
          previewId: orbitMeta.previewId,
          orbitType: orbitMeta.orbitType || 'standard',
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
            customLogo: orbitMeta.customLogo,
            customAccent: orbitMeta.customAccent,
            customTone: orbitMeta.customTone,
            lastUpdated: orbitMeta.lastUpdated,
            orbitType: orbitMeta.orbitType || 'standard',
            pack: packResult.pack,
            boxes,
          });
        }
      }

      // Products-only orbit (no previewId or pack, just imported boxes)
      if (boxes && boxes.length > 0) {
        return res.json({
          status: "ready",
          businessSlug: orbitMeta.businessSlug,
          ownerId: orbitMeta.ownerId,
          planTier: orbitMeta.planTier,
          customTitle: orbitMeta.customTitle,
          customDescription: orbitMeta.customDescription,
          customLogo: orbitMeta.customLogo,
          customAccent: orbitMeta.customAccent,
          customTone: orbitMeta.customTone,
          lastUpdated: orbitMeta.lastUpdated,
          orbitType: orbitMeta.orbitType || 'standard',
          boxes,
        });
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

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }

      // DOCTRINE GUARD: Industry Orbits can NEVER be claimed
      // This is a system invariant - Industry Orbits are neutral, unowned public spaces
      if (orbitMeta.orbitType === 'industry') {
        return res.status(403).json({ 
          message: "This is an Industry Orbit and cannot be claimed. Industry Orbits are neutral, community-owned spaces.",
          code: "INDUSTRY_ORBIT_CLAIM_FORBIDDEN"
        });
      }

      if (orbitMeta.ownerId || orbitMeta.verifiedAt) {
        return res.status(400).json({ message: "This orbit has already been claimed" });
      }

      const { sendEmail, orbitClaimMagicLink, isFreeEmailDomain } = await import("./services/email");

      const sourceUrl = new URL(orbitMeta.sourceUrl);
      const sourceDomain = sourceUrl.hostname.replace(/^www\./, '');
      const emailDomain = email.split('@')[1]?.toLowerCase();
      const domainMatch = emailDomain === sourceDomain;
      const isFreeDomain = isFreeEmailDomain(email);

      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      const expiryMinutes = 30;
      await storage.createClaimToken({
        businessSlug: slug,
        email: email.toLowerCase(),
        token,
        domainMatch,
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      });

      const baseUrl = getAppBaseUrl(req);
      const magicLink = `${baseUrl}/orbit/${slug}/claim?token=${token}`;
      
      console.log(`[Claim] Magic link generated for ${email.split('@')[1]}`);

      const emailResult = await sendEmail({
        to: email.toLowerCase(),
        template: orbitClaimMagicLink({
          businessName: sourceDomain,
          claimUrl: magicLink,
          expiryMinutes,
          isFreeEmailDomain: isFreeDomain,
        }),
      });

      if (!emailResult.success) {
        console.error('[Claim] Email send failed:', emailResult.error);
        return res.status(503).json({ 
          success: false,
          message: "Unable to send verification email. Please try again later.",
          error: "email_send_failed",
        });
      }

      res.json({
        success: true,
        domainMatch,
        isFreeEmailDomain: isFreeDomain,
        message: domainMatch 
          ? "Verification email sent! Check your inbox."
          : isFreeDomain
            ? "Verification email sent! Note: For organisations, we recommend using your work email."
            : "Your email domain doesn't match the business website. Verification email sent.",
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

      // Send confirmation email
      const { sendEmail, orbitClaimConfirmed } = await import("./services/email");
      const baseUrl = getAppBaseUrl(req);
      const hubUrl = `${baseUrl}/orbit/${slug}/hub`;
      const sourceUrl = new URL(orbitMeta.sourceUrl);
      const sourceDomain = sourceUrl.hostname.replace(/^www\./, '');
      
      await sendEmail({
        to: claimToken.email,
        template: orbitClaimConfirmed({
          businessName: sourceDomain,
          orbitUrl: hubUrl,
        }),
      });

      res.json({
        success: true,
        message: "Orbit claimed successfully!",
        domainMatch: claimToken.domainMatch,
        redirectUrl: `/orbit/${slug}/hub`,
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

  // Priority Setup Request - For businesses whose websites block automated access
  app.post("/api/orbit/:slug/priority-setup", async (req, res) => {
    try {
      const { slug } = req.params;
      const { name, email, phone, notes } = req.body;
      
      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ message: "Name is required (minimum 2 characters)" });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Store the priority setup request as a lead
      await storage.createOrbitLead({
        businessSlug: slug,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        message: `[Priority Setup Request]\n\n${notes?.trim() || 'No additional notes provided.'}\n\nSource URL: ${orbitMeta.sourceUrl}`,
        source: 'priority_setup',
      });
      
      // Send notification email to admin
      try {
        const { sendEmail } = await import("./services/email");
        await sendEmail({
          to: process.env.ADMIN_EMAIL || 'hello@nextmonth.io',
          subject: `Priority Setup Request: ${slug}`,
          html: `
            <h2>New Priority Setup Request</h2>
            <p><strong>Business:</strong> ${slug}</p>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Source URL:</strong> ${orbitMeta.sourceUrl}</p>
            <h3>Notes:</h3>
            <p>${notes || 'None provided'}</p>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send priority setup notification:", emailError);
        // Don't fail the request if email fails
      }
      
      console.log(`[Priority Setup] Request received for ${slug} from ${email}`);
      
      res.json({ 
        success: true, 
        message: "Priority setup request received. We'll be in touch within 24 hours." 
      });
    } catch (error) {
      console.error("Error processing priority setup request:", error);
      res.status(500).json({ message: "Error submitting request" });
    }
  });

  // Orbit Chat - Unified AI chat endpoint for both owners and public viewers
  // Supports: authenticated owners OR public access via accessToken
  app.post("/api/orbit/:slug/chat", chatRateLimiter, async (req, res) => {
    try {
      const { slug } = req.params;
      const { message, menuContext, history, proofCaptureTriggeredAt, accessToken } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Determine access mode: owner (authenticated) or public (token-based)
      const user = req.isAuthenticated() ? (req.user as any) : null;
      const isOwner = user && (orbitMeta.ownerId === user.id || orbitMeta.ownerEmail?.toLowerCase() === (user.email || user.username)?.toLowerCase());
      let isPublicAccess = false;
      let preview: any = null;
      let isPaidOrbit = false;
      let monthlyConversations = 0;
      let showSoftLimitWarning = false;
      
      // Check entitlements for paid tier
      if (orbitMeta.ownerId) {
        const entitlements = await getFullEntitlements(orbitMeta.ownerId);
        isPaidOrbit = entitlements.planName !== 'Free' && entitlements.planName !== 'Viewer';
      }
      
      // If not authenticated owner, check for public access
      if (!isOwner) {
        isPublicAccess = true;
        
        // For orbits with a preview, validate access token if provided
        if (orbitMeta.previewId) {
          preview = await storage.getPreviewInstance(orbitMeta.previewId);
          
          // If preview exists and has access token validation
          if (preview) {
            // Validate token if provided (optional for public viewing of claimed orbits)
            if (accessToken) {
              const { validatePreviewToken } = await import("./publicAccessToken");
              if (!validatePreviewToken(accessToken, orbitMeta.previewId)) {
                return res.status(403).json({ message: "Invalid access token" });
              }
            }
            
            // Check preview expiry and status for unclaimed orbits
            if (!orbitMeta.verifiedAt) {
              if (new Date() > new Date(preview.expiresAt)) {
                await storage.archivePreviewInstance(preview.id);
                return res.json({
                  capped: true,
                  reason: "expired",
                  response: "This preview has expired. Claim it to keep chatting.",
                  viewerType: 'public',
                });
              }
              
              if (preview.status !== "active") {
                return res.json({
                  capped: true,
                  reason: preview.status,
                  response: `This preview is ${preview.status}.`,
                  viewerType: 'public',
                });
              }

              // Atomically increment and check message cap for unclaimed previews (prevents race condition)
              const newPreviewMessageCount = await storage.incrementPreviewMessageCountIfUnderLimit(preview.id, preview.maxMessages);

              if (newPreviewMessageCount === null) {
                return res.json({
                  capped: true,
                  reason: "message_limit",
                  response: "You've reached the message limit for this preview. Claim it to continue.",
                  messageCount: preview.maxMessages,
                  viewerType: 'public',
                });
              }
            }
          }
        }
        
        // Monthly conversation limit for free/unclaimed orbits (regardless of preview)
        if (!isPaidOrbit) {
          monthlyConversations = await storage.getMonthlyConversationCount(slug);
          
          if (monthlyConversations >= FREE_CONVERSATION_LIMIT) {
            return res.json({
              capped: true,
              reason: "monthly_limit",
              ...conversationLimitCopy.hardLimit,
              monthlyCount: monthlyConversations,
              limit: FREE_CONVERSATION_LIMIT,
              upgradeRequired: true,
              viewerType: 'public',
            });
          }
          
          if (monthlyConversations >= FREE_CONVERSATION_SOFT_LIMIT) {
            showSoftLimitWarning = true;
          }
        }
      }
      
      // Import proof capture module for testimonial detection
      const { 
        classifyTestimonialMoment, 
        shouldTriggerProofCapture, 
        getContextQuestion, 
        getConsentRequest,
        isDetailedPraiseResponse,
        parseConsentResponse,
        getConsentFollowup
      } = await import('./services/proofCapture');
      
      // Check if this message is testimonial-worthy
      // Validate history structure to prevent undefined errors
      const recentUserMessages = (history || [])
        .filter((h: any) => h && typeof h === 'object' && h.role === 'user' && typeof h.content === 'string')
        .slice(-5)
        .map((h: any) => h.content);

      const recentAssistantMessages = (history || [])
        .filter((h: any) => h && typeof h === 'object' && h.role === 'assistant' && typeof h.content === 'string')
        .slice(-3)
        .map((h: any) => h.content);
      
      const proofCaptureEnabled = orbitMeta.proofCaptureEnabled !== false;
      const triggeredAt = proofCaptureTriggeredAt ? new Date(proofCaptureTriggeredAt) : null;
      
      // Check if we're in the middle of a proof capture flow
      const lastAssistantMsg = recentAssistantMessages[recentAssistantMessages.length - 1] || '';
      // Match context questions from proofCapture.ts TOPIC_QUESTIONS
      const isInContextQuestionStage = 
        lastAssistantMsg.includes("I'd love to know more") ||
        lastAssistantMsg.includes("what was the highlight") ||
        lastAssistantMsg.includes("what stood out") ||
        lastAssistantMsg.includes("what was the main thing") ||
        lastAssistantMsg.includes("what would you say") ||
        lastAssistantMsg.includes("Tell me more about what") ||
        lastAssistantMsg.includes("what is it about") ||
        lastAssistantMsg.includes("what impressed you") ||
        lastAssistantMsg.includes("what makes it special");
      const isInConsentStage = lastAssistantMsg.includes('Would you be happy for us to use your comment');
      
      console.log('[ProofCapture] Flow state - Context stage:', isInContextQuestionStage, 'Consent stage:', isInConsentStage);
      
      let proofCaptureFlow = null;
      let suggestionChip = null;
      let classificationResult: { praiseKeywordsFound: string[] } | null = null;
      
      if (isInConsentStage) {
        // Handle consent response
        const consentResponse = parseConsentResponse(message);
        console.log('[ProofCapture] Consent response:', consentResponse);
        
        if (consentResponse) {
          const followup = getConsentFollowup(consentResponse);
          return res.json({
            response: followup,
            proofCaptureFlow: {
              stage: 'consent_received',
              consentType: consentResponse,
            },
          });
        }
      } else if (isInContextQuestionStage) {
        // Handle detailed response after context question
        const detailCheck = await isDetailedPraiseResponse(message, recentUserMessages);
        console.log('[ProofCapture] Detail check:', JSON.stringify(detailCheck));
        
        if (detailCheck.hasDetail) {
          // Got a meaningful response, now ask for consent
          const consentInfo = getConsentRequest();
          return res.json({
            response: `That's wonderful feedback, thank you for sharing!\n\nWould you be happy for us to use your comment as a testimonial?\n\n• ${consentInfo.options.join('\n• ')}`,
            proofCaptureFlow: {
              stage: 'consent_request',
              expandedQuote: detailCheck.combinedQuote,
              consentOptions: consentInfo.options,
            },
          });
        } else {
          // Response wasn't detailed enough, ask clarifier
          proofCaptureFlow = {
            stage: 'clarifier',
          };
          // Continue to normal chat but append clarifier
        }
      } else if (!triggeredAt) {
        // Check for new praise (only if not already triggered in this session)
        const classification = await classifyTestimonialMoment(message, recentUserMessages);
        classificationResult = classification;
        
        console.log('[ProofCapture] Classification for message:', message);
        console.log('[ProofCapture] Result:', JSON.stringify(classification));
        
        const proofCaptureTrigger = shouldTriggerProofCapture(
          proofCaptureEnabled,
          triggeredAt,
          classification
        );
        
        console.log('[ProofCapture] Trigger decision:', JSON.stringify(proofCaptureTrigger));
        
        // If testimonial-worthy, ask contextual question (Step 1)
        if (proofCaptureTrigger.shouldTrigger) {
          const topicQuestion = getContextQuestion(classification.topic);
          
          return res.json({
            response: topicQuestion,
            proofCaptureFlow: {
              stage: 'context_question',
              topic: classification.topic,
              originalMessage: message,
              confidence: classification.confidence,
              specificityScore: classification.specificityScore,
            },
          });
        }
        
        // If we detected some praise but not high confidence, show a suggestion chip
        if (proofCaptureTrigger.showSuggestionChip) {
          suggestionChip = {
            text: "Leave a testimonial",
            action: "testimonial",
          };
        }
      }
      
      // Use shared chat service for context building
      const { buildOrbitContext, buildSystemPrompt, generateChatResponse, parseVideoSuggestion } = await import('./services/orbitChatService');
      
      const orbitContext = await buildOrbitContext(storage, slug);
      
      const brandName = orbitMeta.customTitle || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const sourceUrl = orbitMeta.sourceUrl || '';
      let sourceDomain = '';
      try {
        if (sourceUrl) {
          sourceDomain = new URL(sourceUrl).hostname.replace('www.', '');
        }
      } catch {
        sourceDomain = sourceUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || '';
      }
      
      const systemPrompt = buildSystemPrompt(
        {
          slug,
          brandName,
          sourceDomain,
        },
        orbitContext.productContext,
        orbitContext.documentContext,
        orbitContext.businessType,
        orbitContext.businessTypeLabel,
        orbitContext.offeringsLabel,
        orbitContext.items,
        orbitContext.heroPostContext,
        orbitContext.videoContext
      );
      
      const historyForAI = (history || [])
        .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-6)
        .map((msg: any) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
      
      const rawResponse = await generateChatResponse(systemPrompt, historyForAI, message, { maxTokens: 300 });
      
      // Parse video suggestions from response
      const { cleanResponse, suggestedVideo } = parseVideoSuggestion(rawResponse, orbitContext.videos);
      
      // If video was suggested, track the serve event
      if (suggestedVideo) {
        try {
          await storage.createVideoEvent({
            videoId: suggestedVideo.id,
            businessSlug: slug,
            sessionId: null,
            eventType: 'serve',
            msWatched: 0,
            followUpQuestion: null,
          });
          await storage.incrementVideoStats(suggestedVideo.id, { serve: true });
        } catch (err) {
          console.error('[VideoServe] Error tracking video serve:', err);
        }
      }
      
      // Track conversation metric (only on first message in conversation)
      if (!history || history.length === 0) {
        await storage.incrementOrbitMetric(slug, 'conversations');
      }
      
      // For public access with existing preview, update cost estimates
      // Note: Message count already incremented atomically at the start of request
      if (isPublicAccess && preview && !orbitMeta.verifiedAt) {
        try {
          await storage.updatePreviewInstance(preview.id, {
            costEstimatePence: (preview.costEstimatePence || 0) + 1,
            llmCallCount: (preview.llmCallCount || 0) + 1,
          });
        } catch (err) {
          console.error('[OrbitChat] Error updating preview stats:', err);
        }
      }
      
      // Build unified response
      const responsePayload: Record<string, any> = { 
        response: cleanResponse,
        suggestedVideo: suggestedVideo || null,
        suggestionChip,
        viewerType: isOwner ? 'owner' : 'public',
      };
      
      // Add praise detection for testimonial flow
      if (classificationResult?.praiseKeywordsFound?.length) {
        responsePayload.praiseDetected = classificationResult.praiseKeywordsFound;
      }
      
      // Add soft limit warning for public access approaching limits
      if (showSoftLimitWarning) {
        responsePayload.softLimitWarning = {
          ...conversationLimitCopy.softLimit,
          monthlyCount: monthlyConversations + 1,
          limit: FREE_CONVERSATION_LIMIT,
        };
      }
      
      // Add message count for public access with unclaimed preview
      if (isPublicAccess && preview && !orbitMeta.verifiedAt) {
        responsePayload.messageCount = preview.messageCount + 1;
        responsePayload.capped = (preview.messageCount + 1) >= preview.maxMessages;
      }
      
      res.json(responsePayload);
    } catch (error) {
      console.error("Error in orbit chat:", error);
      res.status(500).json({ message: "Error processing chat" });
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
      
      // Check if user is owner (by ID or email/username)
      const user = req.isAuthenticated() ? (req.user as any) : null;
      const userEmail = (user?.email || user?.username)?.toLowerCase() || null;
      const isOwnerById = user && orbitMeta.ownerId === user.id;
      const isOwnerByEmail = userEmail && orbitMeta.ownerEmail?.toLowerCase() === userEmail;
      const isOwner = isOwnerById || isOwnerByEmail;
      
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

  // Orbit Insights - Generate insights dynamically (owner only)
  app.get("/api/orbit/:slug/insights", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Check ownership
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view insights" });
      }
      
      // Generate insights from existing data sources
      const analytics = await storage.getOrbitAnalyticsSummary(slug, 30);
      const conversations = await storage.getOrbitConversations(slug, 20);
      const boxes = await storage.getOrbitBoxes(slug);
      const curatedItems = await storage.getApiCuratedItemsByOrbit(slug, 50);
      const leads = await storage.getOrbitLeads(slug, 50);
      
      type InsightKind = "signal" | "content_ready" | "ops";
      type ContentBrief = {
        audience: string;
        problem: string;
        promise: string;
        proof: string;
        cta: string;
        formatSuggestion: "hook" | "myth_bust" | "checklist" | "problem_solution" | "testimonial" | "story";
      };
      
      const insights: Array<{
        id: string;
        orbitId: string;
        title: string;
        meaning: string;
        confidence: "high" | "medium" | "low";
        topicTags: string[];
        segment?: string;
        source: string;
        kind?: "top" | "feed";
        insightKind: InsightKind;
        contentPotentialScore: number;
        contentBrief?: ContentBrief;
        createdAt: string;
      }> = [];
      
      // Helper to generate deterministic hash-based ID
      const generateInsightId = (parts: string[]) => {
        const str = parts.join('|');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return `insight-${Math.abs(hash).toString(36)}`;
      };
      
      const now = new Date().toISOString();
      
      // SIGNAL INSIGHTS - Internal metrics for operators
      
      // Insight from visit patterns (SIGNAL - internal metric)
      if (analytics.visits > 10) {
        insights.push({
          id: generateInsightId([slug, 'visits', String(analytics.visits)]),
          orbitId: slug,
          title: `${analytics.visits} visits in the last 30 days`,
          meaning: analytics.visits > 50 
            ? "Strong visitor engagement. Consider adding more interactive content to convert interest."
            : "Growing interest. Share your Orbit link more to boost discovery.",
          confidence: analytics.visits > 50 ? "high" : "medium",
          topicTags: ["traffic", "engagement"],
          source: "Analytics",
          kind: analytics.visits > 50 ? "top" : "feed",
          insightKind: "signal",
          contentPotentialScore: 10,
          createdAt: now,
        });
      }
      
      // Insight from conversation count (SIGNAL - internal metric)
      if (analytics.conversations > 0) {
        const convRate = Math.round((analytics.conversations / Math.max(analytics.visits, 1)) * 100);
        insights.push({
          id: generateInsightId([slug, 'conversations', String(analytics.conversations)]),
          orbitId: slug,
          title: `${analytics.conversations} conversations started`,
          meaning: convRate > 10 
            ? `${convRate}% of visitors engage in chat. Your content sparks curiosity.`
            : "Visitors are asking questions. Make sure your AI assistant has complete info.",
          confidence: analytics.conversations > 5 ? "high" : "medium",
          topicTags: ["conversations", "engagement"],
          source: "Chat Analytics",
          kind: convRate > 10 ? "top" : "feed",
          insightKind: "signal",
          contentPotentialScore: 15,
          createdAt: now,
        });
      }
      
      // OPS INSIGHTS - Operational/data status
      
      // Insight from menu/catalogue (OPS - data status)
      if (boxes.length > 0) {
        const categories = [...new Set(boxes.map(b => b.category).filter(Boolean))];
        insights.push({
          id: generateInsightId([slug, 'catalogue', String(boxes.length)]),
          orbitId: slug,
          title: `${boxes.length} items across ${categories.length} categories`,
          meaning: "Your catalogue is ready for AI discovery. Visitors can ask about specific items.",
          confidence: "high",
          topicTags: ["catalogue", "products"],
          source: "Knowledge Map",
          kind: "feed",
          insightKind: "ops",
          contentPotentialScore: 5,
          createdAt: now,
        });
      }
      
      // CONTENT-READY INSIGHTS - From real conversations, ready for external publishing
      
      // Analyze conversations for content-ready patterns
      if (conversations.length > 0) {
        // Look for questions with buying intent or key concerns
        const conversationTexts = conversations.map(c => 
          typeof c.context === 'string' ? c.context : JSON.stringify(c.context || '')
        ).join(' ').toLowerCase();
        
        // Detect pricing/cost questions - content-ready
        if (conversationTexts.includes('price') || conversationTexts.includes('cost') || conversationTexts.includes('how much')) {
          insights.push({
            id: generateInsightId([slug, 'conv-pricing', now.substring(0, 10)]),
            orbitId: slug,
            title: "Visitors are asking about pricing",
            meaning: "Cost clarity is a key concern. Consider a story that addresses value and pricing transparency.",
            confidence: "high",
            topicTags: ["pricing", "objection-handling"],
            source: "Conversations",
            kind: "top",
            insightKind: "content_ready",
            contentPotentialScore: 85,
            contentBrief: {
              audience: "Prospects evaluating cost",
              problem: "Uncertainty about pricing and what's included",
              promise: "Clear, transparent pricing with no hidden costs",
              proof: "Examples of value delivered to similar clients",
              cta: "Get a quote or view pricing page",
              formatSuggestion: "problem_solution",
            },
            createdAt: now,
          });
        }
        
        // Detect timeline/delivery questions - content-ready
        if (conversationTexts.includes('time') || conversationTexts.includes('deliver') || conversationTexts.includes('when') || conversationTexts.includes('deadline')) {
          insights.push({
            id: generateInsightId([slug, 'conv-timeline', now.substring(0, 10)]),
            orbitId: slug,
            title: "Delivery timelines are a key concern",
            meaning: "Visitors want certainty about when you can deliver. Perfect for a reliability-focused story.",
            confidence: "high",
            topicTags: ["delivery", "reliability"],
            source: "Conversations",
            kind: "top",
            insightKind: "content_ready",
            contentPotentialScore: 90,
            contentBrief: {
              audience: "Project managers and decision makers",
              problem: "Uncertainty about delivery timelines and reliability",
              promise: "On-time delivery with clear milestones",
              proof: "Track record and process that ensures punctuality",
              cta: "View our delivery process or book a planning call",
              formatSuggestion: "myth_bust",
            },
            createdAt: now,
          });
        }
        
        // Detect service capability questions - content-ready
        if (conversationTexts.includes('do you') || conversationTexts.includes('can you') || conversationTexts.includes('offer')) {
          insights.push({
            id: generateInsightId([slug, 'conv-capabilities', now.substring(0, 10)]),
            orbitId: slug,
            title: "Visitors want to know what you offer",
            meaning: "People are exploring your capabilities. A compelling services story could convert curiosity to action.",
            confidence: "medium",
            topicTags: ["services", "capabilities"],
            source: "Conversations",
            kind: "feed",
            insightKind: "content_ready",
            contentPotentialScore: 75,
            contentBrief: {
              audience: "Prospects exploring options",
              problem: "Not sure if you offer what they need",
              promise: "Comprehensive solutions tailored to their needs",
              proof: "Range of services and satisfied clients",
              cta: "Explore services or talk to an expert",
              formatSuggestion: "checklist",
            },
            createdAt: now,
          });
        }
        
        // Generic conversation insight (SIGNAL - not content-ready)
        const recentConv = conversations[0];
        insights.push({
          id: generateInsightId([slug, 'recent-conv', String(recentConv.id)]),
          orbitId: slug,
          title: "Recent visitor questions need answers",
          meaning: "Review your latest conversations to identify gaps in your knowledge base.",
          confidence: "medium",
          topicTags: ["conversations", "improvement"],
          source: "Conversation Review",
          kind: "feed",
          insightKind: "signal",
          contentPotentialScore: 20,
          createdAt: now,
        });
      }
      
      // Ice views insight (SIGNAL)
      if (analytics.iceViews > 0) {
        insights.push({
          id: generateInsightId([slug, 'ice-views', String(analytics.iceViews)]),
          orbitId: slug,
          title: `${analytics.iceViews} interactive experience views`,
          meaning: "Your published content is getting attention. Create more to drive engagement.",
          confidence: analytics.iceViews > 10 ? "high" : "medium",
          topicTags: ["content", "ice"],
          source: "Content Performance",
          kind: "feed",
          insightKind: "signal",
          contentPotentialScore: 15,
          createdAt: now,
        });
      }
      
      // LEAD INSIGHTS - From contact form submissions
      if (leads.length > 0) {
        // Aggregate leads count insight (SIGNAL)
        insights.push({
          id: generateInsightId([slug, 'leads', String(leads.length)]),
          orbitId: slug,
          title: `${leads.length} lead${leads.length > 1 ? 's' : ''} collected`,
          meaning: leads.length > 5 
            ? "Strong conversion. Review messages to understand what visitors are looking for."
            : "People are reaching out. Review their messages to spot opportunities.",
          confidence: leads.length > 3 ? "high" : "medium",
          topicTags: ["leads", "conversion"],
          source: "Contact Forms",
          kind: leads.length > 3 ? "top" : "feed",
          insightKind: "signal",
          contentPotentialScore: 25,
          createdAt: now,
        });
        
        // Analyze lead messages for content opportunities
        const leadMessages = leads
          .map(l => (l.message || '').toLowerCase())
          .filter(m => m.length > 0)
          .join(' ');
        
        // Detect job/career inquiries - CONTENT-READY
        if (leadMessages.includes('job') || leadMessages.includes('career') || leadMessages.includes('hiring') || leadMessages.includes('work') || leadMessages.includes('position') || leadMessages.includes('employ')) {
          const jobLeads = leads.filter(l => {
            const msg = (l.message || '').toLowerCase();
            return msg.includes('job') || msg.includes('career') || msg.includes('hiring') || msg.includes('work') || msg.includes('position') || msg.includes('employ');
          });
          insights.push({
            id: generateInsightId([slug, 'lead-jobs', now.substring(0, 10)]),
            orbitId: slug,
            title: `${jobLeads.length} visitor${jobLeads.length > 1 ? 's' : ''} asking about jobs`,
            meaning: "Career opportunities are on people's minds. A recruiting story could attract talent.",
            confidence: "high",
            topicTags: ["careers", "recruitment", "employer-brand"],
            source: "Lead Messages",
            kind: "top",
            insightKind: "content_ready",
            contentPotentialScore: 90,
            contentBrief: {
              audience: "Potential candidates and job seekers",
              problem: "Looking for career opportunities and company culture insights",
              promise: "Join a team that values and develops its people",
              proof: "Team culture, growth stories, employee testimonials",
              cta: "View open positions or apply now",
              formatSuggestion: "story",
            },
            createdAt: now,
          });
        }
        
        // Detect partnership/collaboration inquiries - CONTENT-READY
        if (leadMessages.includes('partner') || leadMessages.includes('collaborat') || leadMessages.includes('wholesale') || leadMessages.includes('supplier')) {
          insights.push({
            id: generateInsightId([slug, 'lead-partnership', now.substring(0, 10)]),
            orbitId: slug,
            title: "Visitors interested in partnerships",
            meaning: "There's interest in working together. A partnership-focused story could attract the right collaborators.",
            confidence: "high",
            topicTags: ["partnerships", "b2b"],
            source: "Lead Messages",
            kind: "top",
            insightKind: "content_ready",
            contentPotentialScore: 85,
            contentBrief: {
              audience: "Potential business partners",
              problem: "Looking for reliable partners to grow with",
              promise: "A partnership built on mutual success",
              proof: "Existing partnerships, success stories",
              cta: "Start a partnership conversation",
              formatSuggestion: "testimonial",
            },
            createdAt: now,
          });
        }
        
        // Show most recent lead as an individual insight if it has a message
        const recentLead = leads.find(l => l.message && l.message.length > 10);
        if (recentLead) {
          const messagePreview = recentLead.message!.slice(0, 50) + (recentLead.message!.length > 50 ? '...' : '');
          insights.push({
            id: generateInsightId([slug, 'recent-lead', String(recentLead.id)]),
            orbitId: slug,
            title: `New lead: "${messagePreview}"`,
            meaning: `${recentLead.name} reached out. Their message may reveal what visitors are looking for.`,
            confidence: "high",
            topicTags: ["lead", "opportunity"],
            source: "Recent Contact",
            kind: "feed",
            insightKind: "signal",
            contentPotentialScore: 30,
            createdAt: now,
          });
        }
      }
      
      // Insights from curated items (API data sources) - OPS
      if (curatedItems.length > 0) {
        const sourceTypes = [...new Set(curatedItems.map(c => c.sourceType))];
        insights.push({
          id: generateInsightId([slug, 'data-source', String(curatedItems.length)]),
          orbitId: slug,
          title: `${curatedItems.length} operational data items synced`,
          meaning: `Your connected data sources are feeding ${sourceTypes.length} type(s) of operational data. AI can now answer questions using this live information.`,
          confidence: curatedItems.length > 20 ? "high" : "medium",
          topicTags: ["operations", "data-sync", ...sourceTypes.slice(0, 3)],
          source: "Data Sources",
          kind: curatedItems.length > 30 ? "top" : "feed",
          insightKind: "ops",
          contentPotentialScore: 10,
          createdAt: now,
        });
        
        // Group by source type for more specific insights
        const typeGroups = curatedItems.reduce((acc, item) => {
          acc[item.sourceType] = (acc[item.sourceType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const topType = Object.entries(typeGroups).sort((a, b) => b[1] - a[1])[0];
        if (topType && topType[1] > 5) {
          insights.push({
            id: generateInsightId([slug, 'data-type', topType[0]]),
            orbitId: slug,
            title: `${topType[1]} ${topType[0].replace(/_/g, ' ')} records available`,
            meaning: "This data enriches your Orbit's knowledge base and helps answer visitor questions accurately.",
            confidence: "medium",
            topicTags: ["operations", topType[0]],
            source: "Data Sources",
            kind: "feed",
            insightKind: "ops",
            contentPotentialScore: 5,
            createdAt: now,
          });
        }
      }
      
      // If no insights, add a starter insight
      if (insights.length === 0) {
        insights.push({
          id: generateInsightId([slug, 'starter']),
          orbitId: slug,
          title: "Your Orbit is ready for insights",
          meaning: "As visitors interact with your Orbit, insights will appear here to help you create better content.",
          confidence: "low",
          topicTags: ["getting-started"],
          source: "System",
          kind: "top",
          insightKind: "signal",
          contentPotentialScore: 0,
          createdAt: now,
        });
      }
      
      // Sort: content-ready first, then by content potential score, then top insights
      insights.sort((a, b) => {
        // Content-ready always first
        if (a.insightKind === "content_ready" && b.insightKind !== "content_ready") return -1;
        if (b.insightKind === "content_ready" && a.insightKind !== "content_ready") return 1;
        // Then by content potential score
        if (a.contentPotentialScore !== b.contentPotentialScore) {
          return b.contentPotentialScore - a.contentPotentialScore;
        }
        // Then top insights
        if (a.kind === "top" && b.kind !== "top") return -1;
        if (b.kind === "top" && a.kind !== "top") return 1;
        return 0;
      });
      
      // Gate insights by tier and strength
      const planTier = orbitMeta.planTier || 'free';
      const strengthScore = orbitMeta.strengthScore ?? 0;
      const isPowered = strengthScore > 0 || (planTier !== 'free');
      const isUnderstand = ['understand', 'intelligence'].includes(planTier);
      
      let gatedInsights = insights;
      let locked = false;
      let upgradeMessage: string | undefined;
      
      if (!isPowered) {
        // Free/basic tier: max 3 insights, downgrade confidence
        gatedInsights = insights.slice(0, 3).map(i => ({
          ...i,
          confidence: 'low' as const,
        }));
        if (insights.length > 3) {
          locked = true;
          upgradeMessage = `Power up your Orbit to unlock ${insights.length - 3} more insights`;
        }
      } else if (!isUnderstand) {
        // Grow tier: max 8 insights
        gatedInsights = insights.slice(0, 8);
        if (insights.length > 8) {
          locked = true;
          upgradeMessage = `Upgrade to Understand for ${insights.length - 8} more insights`;
        }
      }
      // Understand+ tier: all insights, no gating
      
      res.json({ 
        insights: gatedInsights,
        total: insights.length,
        remaining: insights.length - gatedInsights.length,
        locked,
        upgradeMessage,
      });
    } catch (error) {
      console.error("Error generating orbit insights:", error);
      res.status(500).json({ message: "Error generating insights" });
    }
  });

  // Orbit Power-Up - Ingest sources from wizard (owner only)
  app.post("/api/orbit/:slug/ingest-sources", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { sources } = req.body;
      
      if (!sources || !Array.isArray(sources) || sources.length === 0) {
        return res.status(400).json({ message: "At least one source is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can update sources" });
      }
      
      // Validate sources
      const validSources = sources.filter((s: any) => 
        s.label && s.sourceType && s.value && s.value.trim() !== ''
      );
      
      if (validSources.length === 0) {
        return res.status(400).json({ message: "At least one valid source with content is required" });
      }
      
      // Upsert sources
      await storage.upsertOrbitSources(slug, validSources);
      
      // Get documents with extracted text to include in strength calculation
      const allDocs = await storage.getOrbitDocuments(slug);
      const docsWithText = allDocs.filter(d => d.extractedText && d.extractedText.length > 0);
      
      // Get hero posts marked as knowledge
      const heroPostKnowledgeCount = await storage.countHeroPostsAsKnowledge(slug);
      
      // Calculate strength score (includes documents and hero posts)
      const { calculateStrengthScore } = await import("./services/orbitStrength");
      const { strengthScore } = calculateStrengthScore(validSources, docsWithText.length, heroPostKnowledgeCount);
      
      // Determine new tier (flip from free to grow if powered up)
      const newTier = orbitMeta.planTier === 'free' && strengthScore > 0 ? 'grow' : orbitMeta.planTier;
      
      // Update orbit with new tier and strength
      const updated = await storage.updateOrbitTierAndStrength(slug, newTier, strengthScore);
      
      res.json({
        success: true,
        orbit: {
          id: updated?.id,
          businessSlug: slug,
          planTier: newTier,
          strengthScore,
        },
      });
    } catch (error) {
      console.error("Error ingesting orbit sources:", error);
      res.status(500).json({ message: "Error saving sources" });
    }
  });

  // Orbit Sources - Get saved sources (owner only)
  app.get("/api/orbit/:slug/sources", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view sources" });
      }
      
      const sources = await storage.getOrbitSources(slug);
      res.json({ sources });
    } catch (error) {
      console.error("Error getting orbit sources:", error);
      res.status(500).json({ message: "Error getting sources" });
    }
  });

  // Orbit Strength - Recalculate strength score (owner only)
  app.post("/api/orbit/:slug/recalculate-strength", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can recalculate strength" });
      }
      
      const sources = await storage.getOrbitSources(slug);
      const allDocs = await storage.getOrbitDocuments(slug);
      const docsWithText = allDocs.filter(d => d.extractedText && d.extractedText.length > 0);
      const heroPostKnowledgeCount = await storage.countHeroPostsAsKnowledge(slug);
      
      const { calculateStrengthScore } = await import("./services/orbitStrength");
      const { strengthScore, breakdown } = calculateStrengthScore(sources, docsWithText.length, heroPostKnowledgeCount);
      
      await storage.updateOrbitTierAndStrength(slug, orbitMeta.planTier || 'free', strengthScore);
      
      console.log(`[OrbitStrength] Recalculated for ${slug}: ${strengthScore} (${docsWithText.length} docs, ${sources.length} sources, ${heroPostKnowledgeCount} hero posts)`);
      
      res.json({ 
        strengthScore, 
        breakdown,
        documentsWithText: docsWithText.length,
        sourcesCount: sources.length,
        heroPostsAsKnowledge: heroPostKnowledgeCount
      });
    } catch (error) {
      console.error("Error recalculating strength:", error);
      res.status(500).json({ message: "Error recalculating strength" });
    }
  });

  // ==================== HERO POSTS ====================
  
  // Create a single Hero Post
  app.post("/api/orbit/:slug/hero-posts", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { url, platform, text, performedBecause, outcomeNote, tags, businessVoiceId } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can add Hero Posts" });
      }
      
      // Check for duplicate
      const existing = await storage.getHeroPostByUrl(slug, url);
      if (existing) {
        return res.status(409).json({ message: "This URL has already been added", heroPost: existing });
      }
      
      // Detect platform from URL if not provided
      const { detectPlatform } = await import("./services/heroPostEnrichment");
      const detectedPlatform = platform || detectPlatform(url);
      
      const heroPost = await storage.createHeroPost({
        businessSlug: slug,
        createdByUserId: user.id,
        url,
        sourcePlatform: detectedPlatform,
        text: text || null,
        performedBecause: performedBecause || null,
        outcomeNote: outcomeNote || null,
        tags: tags || null,
        businessVoiceId: businessVoiceId || null,
        status: 'pending',
      });
      
      // Trigger enrichment in background (don't await)
      (async () => {
        try {
          await storage.updateHeroPost(heroPost.id, { status: 'enriching' });
          const { enrichHeroPost } = await import("./services/heroPostEnrichment");
          const enriched = await enrichHeroPost(heroPost);
          await storage.updateHeroPost(heroPost.id, {
            ...enriched,
            status: enriched.extracted ? 'ready' : (heroPost.text ? 'needs_text' : 'error'),
          });
          console.log(`[HeroPosts] Auto-enriched post ${heroPost.id}`);
        } catch (err) {
          console.error(`[HeroPosts] Auto-enrich failed for ${heroPost.id}:`, err);
          await storage.updateHeroPost(heroPost.id, { 
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Enrichment failed'
          });
        }
      })();
      
      res.json(heroPost);
    } catch (error) {
      console.error("Error creating hero post:", error);
      res.status(500).json({ message: "Error creating Hero Post" });
    }
  });

  // Bulk create Hero Posts
  app.post("/api/orbit/:slug/hero-posts/bulk", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ message: "URLs array is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can add Hero Posts" });
      }
      
      const { detectPlatform } = await import("./services/heroPostEnrichment");
      const results: schema.HeroPost[] = [];
      const errors: Array<{ url: string; error: string }> = [];
      
      for (const url of urls.slice(0, 20)) { // Limit to 20 at once
        try {
          const existing = await storage.getHeroPostByUrl(slug, url);
          if (existing) {
            errors.push({ url, error: "Already exists" });
            continue;
          }
          
          const heroPost = await storage.createHeroPost({
            businessSlug: slug,
            createdByUserId: user.id,
            url,
            sourcePlatform: detectPlatform(url),
            status: 'pending',
          });
          results.push(heroPost);
        } catch (err) {
          errors.push({ url, error: "Failed to create" });
        }
      }
      
      res.json({ created: results, errors });
    } catch (error) {
      console.error("Error bulk creating hero posts:", error);
      res.status(500).json({ message: "Error creating Hero Posts" });
    }
  });

  // List Hero Posts
  app.get("/api/orbit/:slug/hero-posts", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { status, platform, limit } = req.query;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view Hero Posts" });
      }
      
      const posts = await storage.getHeroPosts(slug, {
        status: status as schema.HeroPostStatus | undefined,
        platform: platform as schema.HeroPostPlatform | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      
      res.json({ posts });
    } catch (error) {
      console.error("Error getting hero posts:", error);
      res.status(500).json({ message: "Error getting Hero Posts" });
    }
  });

  // Update a Hero Post
  app.put("/api/orbit/:slug/hero-posts/:id", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      const { text, outcomeNote, tags, performedBecause } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can update Hero Posts" });
      }
      
      const updated = await storage.updateHeroPost(parseInt(id), {
        text,
        outcomeNote,
        tags,
        performedBecause,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating hero post:", error);
      res.status(500).json({ message: "Error updating Hero Post" });
    }
  });

  // Delete a Hero Post
  app.delete("/api/orbit/:slug/hero-posts/:id", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can delete Hero Posts" });
      }
      
      await storage.deleteHeroPost(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hero post:", error);
      res.status(500).json({ message: "Error deleting Hero Post" });
    }
  });

  // Toggle Hero Post Knowledge - mark/unmark post as knowledge source
  app.patch("/api/orbit/:slug/hero-posts/:id/knowledge", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      const { useAsKnowledge } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can update Hero Posts" });
      }
      
      const heroPost = await storage.getHeroPost(parseInt(id));
      if (!heroPost) {
        return res.status(404).json({ message: "Hero Post not found" });
      }
      
      // Only allow knowledge toggle for ready posts with text
      if (!heroPost.text || heroPost.status !== 'ready') {
        return res.status(400).json({ message: "Only ready posts with text can be used as knowledge" });
      }
      
      const updated = await storage.toggleHeroPostKnowledge(parseInt(id), Boolean(useAsKnowledge));
      
      // Recalculate strength score
      try {
        const sources = await storage.getOrbitSources(slug);
        const allDocs = await storage.getOrbitDocuments(slug);
        const docsWithText = allDocs.filter(d => d.extractedText && d.extractedText.length > 0);
        const heroPostKnowledgeCount = await storage.countHeroPostsAsKnowledge(slug);
        
        const { calculateStrengthScore } = await import("./services/orbitStrength");
        const { strengthScore } = calculateStrengthScore(sources, docsWithText.length, heroPostKnowledgeCount);
        
        await storage.updateOrbitTierAndStrength(slug, orbitMeta.planTier || 'free', strengthScore);
        console.log(`[HeroPosts] Updated strength score to ${strengthScore} after knowledge toggle`);
      } catch (err) {
        console.error('[HeroPosts] Failed to update strength score:', err);
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error toggling hero post knowledge:", error);
      res.status(500).json({ message: "Error updating Hero Post" });
    }
  });

  // Enrich a Hero Post (fetch metadata + run AI extraction)
  app.post("/api/orbit/:slug/hero-posts/:id/enrich", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can enrich Hero Posts" });
      }
      
      const heroPost = await storage.getHeroPost(parseInt(id));
      if (!heroPost) {
        return res.status(404).json({ message: "Hero Post not found" });
      }
      
      // Mark as enriching
      await storage.updateHeroPost(heroPost.id, { status: 'enriching' });
      
      const { fetchOpenGraphData, extractInsights } = await import("./services/heroPostEnrichment");
      
      // Fetch OpenGraph metadata
      const ogData = await fetchOpenGraphData(heroPost.url);
      
      // Determine best available text
      const textForAnalysis = heroPost.text || ogData.description || '';
      
      // If no text available, mark as needs_text
      if (!textForAnalysis || textForAnalysis.length < 20) {
        const updated = await storage.updateHeroPost(heroPost.id, {
          status: 'needs_text',
          title: ogData.title || null,
          ogImageUrl: ogData.image || null,
          ogDescription: ogData.description || null,
        });
        return res.json(updated);
      }
      
      // Run AI extraction
      const extracted = await extractInsights(textForAnalysis, heroPost.url);
      
      const updated = await storage.updateHeroPost(heroPost.id, {
        status: 'ready',
        title: heroPost.title || ogData.title || null,
        ogImageUrl: ogData.image || null,
        ogDescription: ogData.description || null,
        extracted,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error enriching hero post:", error);
      
      // Mark as error
      await storage.updateHeroPost(parseInt(req.params.id), {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({ message: "Error enriching Hero Post" });
    }
  });

  // Get aggregated insights
  app.get("/api/orbit/:slug/hero-posts/insights", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view insights" });
      }
      
      // Get all posts
      const posts = await storage.getHeroPosts(slug);
      
      // Aggregate insights
      const { aggregateInsights } = await import("./services/heroPostEnrichment");
      const insights = aggregateInsights(posts);
      
      // Cache the insights
      await storage.upsertHeroPostInsights(slug, {
        ...insights,
        postCount: posts.length,
      });
      
      res.json({
        ...insights,
        postCount: posts.length,
        readyCount: posts.filter(p => p.status === 'ready').length,
      });
    } catch (error) {
      console.error("Error getting hero post insights:", error);
      res.status(500).json({ message: "Error getting insights" });
    }
  });

  // Get brand voice analysis
  app.get("/api/orbit/:slug/brand-voice", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view brand voice" });
      }
      
      const insights = await storage.getHeroPostInsights(slug);
      const posts = await storage.getHeroPosts(slug);
      
      const toneGuidance = insights?.toneGuidance && typeof insights.toneGuidance === 'object' 
        ? {
            dosList: Array.isArray((insights.toneGuidance as any).dosList) ? (insights.toneGuidance as any).dosList : [],
            dontsList: Array.isArray((insights.toneGuidance as any).dontsList) ? (insights.toneGuidance as any).dontsList : [],
            keyPhrases: Array.isArray((insights.toneGuidance as any).keyPhrases) ? (insights.toneGuidance as any).keyPhrases : [],
          }
        : null;
      
      res.json({
        brandVoiceSummary: insights?.brandVoiceSummary || null,
        voiceTraits: Array.isArray(insights?.voiceTraits) ? insights.voiceTraits : [],
        audienceNotes: insights?.audienceNotes || null,
        toneGuidance,
        brandVoiceUpdatedAt: insights?.brandVoiceUpdatedAt || null,
        heroPosts: posts,
        readyPostCount: posts.filter(p => p.status === 'ready').length,
      });
    } catch (error) {
      console.error("Error getting brand voice:", error);
      res.status(500).json({ message: "Error getting brand voice" });
    }
  });

  // Rebuild brand voice analysis
  app.post("/api/orbit/:slug/brand-voice/rebuild", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can rebuild brand voice" });
      }
      
      const posts = await storage.getHeroPosts(slug);
      const readyPosts = posts.filter(p => p.status === 'ready' && p.postText);
      
      if (readyPosts.length === 0) {
        return res.status(400).json({ 
          message: "No ready hero posts with text to analyze. Add hero posts first." 
        });
      }
      
      const { analyzeBrandVoice } = await import("./services/brandVoiceAnalysis");
      const analysis = await analyzeBrandVoice(readyPosts);
      
      if (!analysis) {
        return res.status(500).json({ message: "Failed to analyze brand voice" });
      }
      
      await storage.upsertHeroPostInsights(slug, {
        businessSlug: slug,
        brandVoiceSummary: analysis.brandVoiceSummary,
        voiceTraits: analysis.voiceTraits,
        audienceNotes: analysis.audienceNotes,
        toneGuidance: analysis.toneGuidance,
        brandVoiceUpdatedAt: new Date(),
      });
      
      res.json({
        ...analysis,
        brandVoiceUpdatedAt: new Date(),
        readyPostCount: readyPosts.length,
      });
    } catch (error) {
      console.error("Error rebuilding brand voice:", error);
      res.status(500).json({ message: "Error rebuilding brand voice" });
    }
  });

  // ==================== END HERO POSTS ====================

  // ==================== KNOWLEDGE COACH ====================
  
  // Get pending knowledge prompts for an Orbit
  app.get("/api/orbit/:slug/knowledge-coach/prompts", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const status = req.query.status as string | undefined;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view knowledge prompts" });
      }
      
      // Check tier eligibility (Grow or Intelligence only)
      const tier = orbitMeta.planTier;
      if (tier !== 'grow' && tier !== 'insight' && tier !== 'intelligence') {
        return res.status(403).json({ 
          message: "Knowledge Coach is available on Grow and Intelligence plans",
          upgradeRequired: true
        });
      }
      
      const prompts = await storage.getKnowledgePrompts(slug, status as any);
      const pendingCount = await storage.getPendingKnowledgePromptsCount(slug);
      
      res.json({ prompts, pendingCount });
    } catch (error) {
      console.error("Error getting knowledge prompts:", error);
      res.status(500).json({ message: "Error getting knowledge prompts" });
    }
  });
  
  // Generate fresh prompts for the current week
  app.post("/api/orbit/:slug/knowledge-coach/generate", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can generate prompts" });
      }
      
      const tier = orbitMeta.planTier;
      if (tier !== 'grow' && tier !== 'insight' && tier !== 'intelligence') {
        return res.status(403).json({ 
          message: "Knowledge Coach is available on Grow and Intelligence plans",
          upgradeRequired: true
        });
      }
      
      const { generateWeeklyPrompts, getCurrentWeekNumber } = await import("./services/knowledgeCoach");
      const tierMapping = tier === 'intelligence' ? 'intelligence' : 'grow';
      const prompts = await generateWeeklyPrompts(slug, tierMapping);
      
      res.json({ 
        prompts, 
        weekNumber: getCurrentWeekNumber(),
        message: prompts.length > 0 ? `Generated ${prompts.length} questions for this week` : "No gaps detected - your Orbit is looking great!"
      });
    } catch (error) {
      console.error("Error generating knowledge prompts:", error);
      res.status(500).json({ message: "Error generating prompts" });
    }
  });
  
  // Submit an answer to a knowledge prompt
  app.post("/api/orbit/:slug/knowledge-coach/prompts/:promptId/answer", requireAuth, async (req, res) => {
    try {
      const { slug, promptId } = req.params;
      const user = req.user as schema.User;
      const { answerText, filedDestination, filedBoxId } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can answer prompts" });
      }
      
      if (!answerText || typeof answerText !== 'string' || answerText.trim().length < 10) {
        return res.status(400).json({ message: "Answer must be at least 10 characters" });
      }
      
      const prompt = await storage.getKnowledgePrompt(parseInt(promptId));
      if (!prompt || prompt.businessSlug !== slug) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      const { processAnswer } = await import("./services/knowledgeCoach");
      const result = await processAnswer(
        parseInt(promptId), 
        answerText.trim(), 
        filedDestination || prompt.suggestedDestination,
        filedBoxId
      );
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      // Recalculate strength score after filing new content
      const boxes = await storage.getOrbitBoxes(slug);
      const sources = await storage.getOrbitSources(slug);
      const documents = await storage.getOrbitDocuments(slug);
      const heroPosts = await storage.getHeroPosts(slug);
      
      const { calculateStrengthScore } = await import("./services/orbitStrength");
      const heroPostKnowledgeCount = heroPosts.filter(p => p.useAsKnowledge).length;
      const strengthResult = calculateStrengthScore(sources, documents.length, heroPostKnowledgeCount);
      
      await storage.updateOrbitMeta(slug, { 
        strengthScore: strengthResult.strengthScore 
      });
      
      res.json({ 
        success: true, 
        message: "Answer saved and filed successfully",
        newStrengthScore: strengthResult.strengthScore
      });
    } catch (error) {
      console.error("Error processing answer:", error);
      res.status(500).json({ message: "Error processing answer" });
    }
  });
  
  // Dismiss a knowledge prompt
  app.post("/api/orbit/:slug/knowledge-coach/prompts/:promptId/dismiss", requireAuth, async (req, res) => {
    try {
      const { slug, promptId } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can dismiss prompts" });
      }
      
      const prompt = await storage.getKnowledgePrompt(parseInt(promptId));
      if (!prompt || prompt.businessSlug !== slug) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      const { dismissPrompt } = await import("./services/knowledgeCoach");
      const dismissed = await dismissPrompt(parseInt(promptId));
      
      res.json({ success: dismissed });
    } catch (error) {
      console.error("Error dismissing prompt:", error);
      res.status(500).json({ message: "Error dismissing prompt" });
    }
  });

  // ==================== END KNOWLEDGE COACH ====================

  // ==================== ORBIT DOCUMENTS ====================
  
  // Upload a document
  app.post("/api/orbit/:slug/documents", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const file = req.file;
      const { title, description, category } = req.body;
      
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can upload documents" });
      }
      
      const { detectDocumentType, isAllowedDocumentType, MAX_DOCUMENT_SIZE_BYTES } = await import("./services/documentProcessor");
      
      if (!isAllowedDocumentType(file.originalname)) {
        return res.status(400).json({ message: "File type not allowed. Supported: PDF, PPT, PPTX, DOC, DOCX, TXT, MD" });
      }
      
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        return res.status(400).json({ message: "File too large. Maximum size is 25MB" });
      }
      
      const fileType = detectDocumentType(file.originalname);
      const timestamp = Date.now();
      const safeFileName = `${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = `orbit/${slug}/documents/${safeFileName}`;
      
      // Upload to object storage using Replit integration
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      if (!objectStorage.isConfigured()) {
        return res.status(503).json({ message: "Object storage not configured. Please set up App Storage in the Replit tools panel." });
      }
      
      await objectStorage.uploadBuffer(file.buffer, safeFileName, file.mimetype || 'application/octet-stream', `orbit/${slug}/documents`);
      
      // Extract text BEFORE creating document record (synchronous, not background)
      const { extractDocumentText } = await import("./services/documentProcessor");
      let extractedText = '';
      let pageCount = 0;
      let extractionError = '';
      
      try {
        const result = await extractDocumentText(file.buffer, fileType);
        extractedText = result.text || '';
        pageCount = result.pageCount || 0;
        console.log(`[OrbitDocuments] Extracted ${extractedText.length} chars, ${pageCount} pages from ${file.originalname}`);
      } catch (error) {
        console.error('[OrbitDocuments] Text extraction error:', error);
        extractionError = error instanceof Error ? error.message : 'Text extraction failed';
      }
      
      // Create document record with extracted text already populated
      const doc = await storage.createOrbitDocument({
        businessSlug: slug,
        uploadedByUserId: user.id,
        fileName: file.originalname,
        fileType,
        fileSizeBytes: file.size,
        storagePath,
        title: title || file.originalname,
        description: description || null,
        category: category || 'other',
        status: extractionError ? 'error' : 'ready',
        extractedText: extractedText || null,
        pageCount: pageCount || null,
        errorMessage: extractionError || null,
      });
      
      // Recalculate strength score after document upload
      if (extractedText && extractedText.length > 0) {
        try {
          const sources = await storage.getOrbitSources(slug);
          const allDocs = await storage.getOrbitDocuments(slug);
          const docsWithText = allDocs.filter(d => d.extractedText && d.extractedText.length > 0);
          const heroPostKnowledgeCount = await storage.countHeroPostsAsKnowledge(slug);
          
          const { calculateStrengthScore } = await import("./services/orbitStrength");
          const { strengthScore } = calculateStrengthScore(sources, docsWithText.length, heroPostKnowledgeCount);
          
          await storage.updateOrbitTierAndStrength(slug, orbitMeta.planTier || 'free', strengthScore);
          console.log(`[OrbitDocuments] Updated strength score to ${strengthScore} (${docsWithText.length} docs with text)`);
        } catch (err) {
          console.error('[OrbitDocuments] Failed to update strength score:', err);
        }
      }
      
      res.json(doc);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Error uploading document" });
    }
  });

  // List documents
  app.get("/api/orbit/:slug/documents", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view documents" });
      }
      
      const documents = await storage.getOrbitDocuments(slug);
      res.json({ documents });
    } catch (error) {
      console.error("Error getting documents:", error);
      res.status(500).json({ message: "Error getting documents" });
    }
  });

  // Update document metadata
  app.put("/api/orbit/:slug/documents/:id", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      const { title, description, category } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can update documents" });
      }
      
      const updated = await storage.updateOrbitDocument(parseInt(id), {
        title,
        description,
        category,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "Error updating document" });
    }
  });

  // Delete document
  app.delete("/api/orbit/:slug/documents/:id", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can delete documents" });
      }
      
      const doc = await storage.getOrbitDocument(parseInt(id));
      if (doc && doc.storagePath) {
        try {
          const { deleteObject } = await import("./storage/objectStore");
          await deleteObject(doc.storagePath);
        } catch (err) {
          console.warn('[OrbitDocuments] Failed to delete file from storage:', err);
        }
      }
      
      await storage.deleteOrbitDocument(parseInt(id));
      
      // Recalculate strength score after document deletion
      try {
        const sources = await storage.getOrbitSources(slug);
        const allDocs = await storage.getOrbitDocuments(slug);
        const docsWithText = allDocs.filter(d => d.extractedText && d.extractedText.length > 0);
        const heroPostKnowledgeCount = await storage.countHeroPostsAsKnowledge(slug);
        
        const { calculateStrengthScore } = await import("./services/orbitStrength");
        const { strengthScore } = calculateStrengthScore(sources, docsWithText.length, heroPostKnowledgeCount);
        
        await storage.updateOrbitTierAndStrength(slug, orbitMeta.planTier || 'free', strengthScore);
        console.log(`[OrbitDocuments] Updated strength score to ${strengthScore} after deletion`);
      } catch (err) {
        console.error('[OrbitDocuments] Failed to update strength score after deletion:', err);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Error deleting document" });
    }
  });

  // Reprocess document (re-extract text)
  app.post("/api/orbit/:slug/documents/:id/reprocess", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can reprocess documents" });
      }
      
      const doc = await storage.getOrbitDocument(parseInt(id));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Download file from object storage
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      
      if (!objectStorage.isConfigured()) {
        return res.status(503).json({ message: "Object storage not configured" });
      }
      
      // Get the file path - extract just the filename from the full path
      const fileName = doc.storagePath.split('/').pop() || '';
      const directory = doc.storagePath.replace(`/${fileName}`, '').replace(fileName, '') || `orbit/${slug}/documents`;
      
      const buffer = await objectStorage.downloadBuffer(fileName, directory);
      if (!buffer) {
        return res.status(404).json({ message: "File not found in storage" });
      }
      
      // Extract text
      const { extractDocumentText } = await import("./services/documentProcessor");
      const { text, pageCount } = await extractDocumentText(buffer, doc.fileType as any);
      
      // Update document
      const updated = await storage.updateOrbitDocument(doc.id, {
        extractedText: text || null,
        pageCount: pageCount || null,
        status: 'ready',
      });
      
      console.log(`[OrbitDocuments] Reprocessed doc ${doc.id}: extracted ${text?.length || 0} chars`);
      
      res.json({ 
        success: true, 
        extractedLength: text?.length || 0,
        pageCount: pageCount || 0,
        document: updated,
      });
    } catch (error) {
      console.error("Error reprocessing document:", error);
      res.status(500).json({ message: "Error reprocessing document" });
    }
  });

  // ==================== END ORBIT DOCUMENTS ====================

  // ==================== ORBIT VIDEOS ====================
  
  // Add a YouTube video
  app.post("/api/orbit/:slug/videos", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { youtubeUrl, title, description, tags, topics } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can add videos" });
      }
      
      if (!youtubeUrl) {
        return res.status(400).json({ message: "YouTube URL is required" });
      }
      
      // Extract video ID from YouTube URL
      const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (!videoIdMatch) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }
      const youtubeVideoId = videoIdMatch[1];
      
      // Check for duplicate
      const existing = await storage.getOrbitVideos(slug);
      if (existing.some(v => v.youtubeVideoId === youtubeVideoId)) {
        return res.status(409).json({ message: "This video has already been added" });
      }
      
      // Fetch video metadata from YouTube oEmbed API
      let videoTitle = title || '';
      let thumbnailUrl = '';
      
      try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`;
        const response = await fetch(oEmbedUrl);
        if (response.ok) {
          const data = await response.json();
          videoTitle = title || data.title || 'Untitled Video';
          thumbnailUrl = data.thumbnail_url || `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
        }
      } catch (err) {
        console.log('[OrbitVideos] oEmbed fetch failed, using defaults');
        thumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
      }
      
      const video = await storage.createOrbitVideo({
        businessSlug: slug,
        createdByUserId: user.id,
        youtubeVideoId,
        youtubeUrl,
        title: videoTitle || 'Untitled Video',
        description: description || null,
        thumbnailUrl,
        tags: tags || [],
        topics: topics || [],
        isEnabled: true,
      });
      
      res.json(video);
    } catch (error) {
      console.error("Error adding video:", error);
      res.status(500).json({ message: "Error adding video" });
    }
  });

  // List videos
  app.get("/api/orbit/:slug/videos", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view videos" });
      }
      
      const videos = await storage.getOrbitVideos(slug);
      res.json({ videos });
    } catch (error) {
      console.error("Error getting videos:", error);
      res.status(500).json({ message: "Error getting videos" });
    }
  });

  // Update video
  app.put("/api/orbit/:slug/videos/:id", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      const { title, description, tags, topics, isEnabled } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can update videos" });
      }
      
      const updated = await storage.updateOrbitVideo(parseInt(id), {
        title,
        description,
        tags,
        topics,
        isEnabled,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating video:", error);
      res.status(500).json({ message: "Error updating video" });
    }
  });

  // Delete video
  app.delete("/api/orbit/:slug/videos/:id", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can delete videos" });
      }
      
      await storage.deleteOrbitVideo(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Error deleting video" });
    }
  });

  // Track video event (public - for analytics)
  app.post("/api/orbit/:slug/videos/:id/event", async (req, res) => {
    try {
      const { slug, id } = req.params;
      const { eventType, msWatched, followUpQuestion, sessionId } = req.body;
      
      if (!eventType || !['serve', 'play', 'pause', 'complete', 'cta_click'].includes(eventType)) {
        return res.status(400).json({ message: "Invalid event type" });
      }
      
      const video = await storage.getOrbitVideo(parseInt(id));
      if (!video || video.businessSlug !== slug) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Create event
      await storage.createVideoEvent({
        videoId: parseInt(id),
        businessSlug: slug,
        sessionId: sessionId || null,
        eventType,
        msWatched: msWatched || 0,
        followUpQuestion: followUpQuestion || null,
      });
      
      // Update aggregate stats
      await storage.incrementVideoStats(parseInt(id), {
        serve: eventType === 'serve',
        play: eventType === 'play',
        watchTimeMs: msWatched || 0,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking video event:", error);
      res.status(500).json({ message: "Error tracking event" });
    }
  });

  // Get video analytics (owner only)
  app.get("/api/orbit/:slug/videos/:id/analytics", requireAuth, async (req, res) => {
    try {
      const { slug, id } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view analytics" });
      }
      
      const video = await storage.getOrbitVideo(parseInt(id));
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      const events = await storage.getVideoEvents(parseInt(id), 50);
      
      // Calculate metrics
      const followUpQuestions = events
        .filter(e => e.followUpQuestion)
        .map(e => e.followUpQuestion);
      
      res.json({
        video,
        totalServes: video.serveCount,
        totalPlays: video.playCount,
        totalWatchTimeMs: video.totalWatchTimeMs,
        avgWatchTimeMs: video.playCount > 0 ? Math.round(video.totalWatchTimeMs / video.playCount) : 0,
        recentFollowUpQuestions: followUpQuestions.slice(0, 10),
      });
    } catch (error) {
      console.error("Error getting video analytics:", error);
      res.status(500).json({ message: "Error getting analytics" });
    }
  });

  // ==================== END ORBIT VIDEOS ====================

  // Orbit Meta - Get basic orbit info (owner only)
  app.get("/api/orbit/:slug/meta", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view meta" });
      }
      
      res.json({
        strengthScore: orbitMeta.strengthScore ?? 0,
        planTier: orbitMeta.planTier || 'free',
        customTitle: orbitMeta.customTitle,
        sourceUrl: orbitMeta.sourceUrl,
        aiIndexingEnabled: orbitMeta.aiIndexingEnabled ?? true,
        autoUpdateKnowledge: orbitMeta.autoUpdateKnowledge ?? true,
        aiAccuracyAlertsEnabled: orbitMeta.aiAccuracyAlertsEnabled ?? true,
        weeklyReportsEnabled: orbitMeta.weeklyReportsEnabled ?? false,
      });
    } catch (error) {
      console.error("Error getting orbit meta:", error);
      res.status(500).json({ message: "Error getting meta" });
    }
  });

  // Orbit ICE Draft - Generate draft from insight, URL, pasted content, or file (owner only)
  app.post("/api/orbit/:slug/ice/generate", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { insightId, sourceUrl, sourceContent, sourceFileName, format, tone, outputType } = req.body;
      
      // Must have at least one content source
      const hasContentSource = insightId || sourceUrl || sourceContent;
      if (!hasContentSource || !format || !tone || !outputType) {
        return res.status(400).json({ message: "Content source (insightId, sourceUrl, or sourceContent) plus format, tone, and outputType are required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can generate ICE drafts" });
      }
      
      // Generate headline based on format and source
      let headline = format === "hook_bullets" ? "Did you know...?" 
        : format === "myth_reality" ? "Common myths vs reality"
        : format === "checklist" ? "Your essential checklist"
        : "Your story awaits";
      
      // Use source info for the headline if available
      if (sourceFileName) {
        headline = `From: ${sourceFileName.replace(/\.[^/.]+$/, '')}`;
      } else if (sourceUrl) {
        try {
          const urlObj = new URL(sourceUrl);
          headline = `From: ${urlObj.hostname.replace('www.', '')}`;
        } catch {
          headline = "From your link";
        }
      }
      
      // Generate captions based on source content
      let captions = [
        "Your content is ready to transform",
        "Engage your audience with this story",
        "Share and inspire action",
      ];
      
      if (sourceContent) {
        // Extract first meaningful sentence as caption
        const firstSentence = sourceContent.trim().split(/[.!?]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
          captions[0] = firstSentence + (firstSentence.length < 100 ? '.' : '...');
        }
      }
      
      // Create persisted draft
      const draft = await storage.createIceDraft({
        businessSlug: slug,
        userId: user.id,
        insightId: insightId || `content_${Date.now()}`,
        format: format as schema.IceDraftFormat,
        tone: tone as schema.IceDraftTone,
        outputType: outputType as schema.IceDraftOutputType,
        headline,
        captions,
        ctaText: "View experience",
        status: "draft",
      });
      
      res.json({ draft });
    } catch (error) {
      console.error("Error generating ice draft:", error);
      res.status(500).json({ message: "Error generating draft" });
    }
  });

  // Orbit ICE Preview - Generate full preview from insight and route to editor
  app.post("/api/orbit/:slug/ice/generate-preview", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const { insightId, insightTitle, insightMeaning, format, tone, outputType } = req.body;
      
      if (!insightId || !format || !tone || !outputType) {
        return res.status(400).json({ message: "insightId, format, tone, and outputType are required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can generate ICE previews" });
      }
      
      // Generate cards from the insight
      const previewCards: { id: string; title: string; content: string; order: number }[] = [];
      const title = insightTitle || "Untitled Experience";
      const content = insightMeaning || "Your content here";
      
      // Create card structure based on format
      if (format === "hook_bullets") {
        previewCards.push({ id: `card_${Date.now()}_0`, title: "Did you know?", content: title, order: 0 });
        previewCards.push({ id: `card_${Date.now()}_1`, title: "Key Point 1", content: content, order: 1 });
        previewCards.push({ id: `card_${Date.now()}_2`, title: "Key Point 2", content: "Continue your story...", order: 2 });
        previewCards.push({ id: `card_${Date.now()}_3`, title: "Take Action", content: "Learn more about this topic.", order: 3 });
      } else if (format === "myth_reality") {
        previewCards.push({ id: `card_${Date.now()}_0`, title: "Common Myth", content: "What people often believe...", order: 0 });
        previewCards.push({ id: `card_${Date.now()}_1`, title: "The Reality", content: content, order: 1 });
        previewCards.push({ id: `card_${Date.now()}_2`, title: "Why It Matters", content: title, order: 2 });
      } else if (format === "checklist") {
        previewCards.push({ id: `card_${Date.now()}_0`, title: "Your Checklist", content: title, order: 0 });
        previewCards.push({ id: `card_${Date.now()}_1`, title: "Step 1", content: content, order: 1 });
        previewCards.push({ id: `card_${Date.now()}_2`, title: "Step 2", content: "Continue your checklist...", order: 2 });
      } else {
        previewCards.push({ id: `card_${Date.now()}_0`, title: "The Problem", content: "What challenge do you face?", order: 0 });
        previewCards.push({ id: `card_${Date.now()}_1`, title: "The Solution", content: title, order: 1 });
        previewCards.push({ id: `card_${Date.now()}_2`, title: "The Proof", content: content, order: 2 });
      }
      
      // Generate preview ID
      const previewId = `ice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry for insight previews
      
      // Create ice preview with source linking to insight (store origin for back-link)
      const savedPreview = await storage.createIcePreview({
        id: previewId,
        ownerUserId: user.id,
        sourceType: "insight" as any,
        sourceValue: JSON.stringify({
          insightId,
          insightTitle: title,
          insightMeaning: content,
          businessSlug: slug,
        }),
        title,
        cards: previewCards,
        tier: "short",
        status: "active",
        expiresAt,
      });
      
      // Also create an ice_draft for tracking in the Launchpad
      await storage.createIceDraft({
        businessSlug: slug,
        userId: user.id,
        insightId,
        format: format as schema.IceDraftFormat,
        tone: tone as schema.IceDraftTone,
        outputType: outputType as schema.IceDraftOutputType,
        headline: title,
        captions: previewCards.map(c => c.content).slice(0, 3),
        ctaText: "View experience",
        status: "draft",
      });
      
      res.json({ previewId: savedPreview.id, success: true });
    } catch (error) {
      console.error("Error generating ice preview from insight:", error);
      res.status(500).json({ message: "Error generating preview" });
    }
  });

  // Orbit ICE Drafts - List recent drafts (owner only)
  app.get("/api/orbit/:slug/ice/drafts", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const user = req.user as schema.User;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ message: "Only the orbit owner can view drafts" });
      }
      
      const drafts = await storage.getIceDraftsByOrbit(slug, limit);
      res.json({ drafts });
    } catch (error) {
      console.error("Error getting ice drafts:", error);
      res.status(500).json({ message: "Error getting drafts" });
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

  // Orbit High-Signal Enrichment - Extract FAQs, Contact, Team, Testimonials (owner only, Grow+ tier)
  app.post("/api/orbit/:slug/enrich", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can enrich data" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to enrich your orbit with business data" });
      }
      
      // Get source URL from orbit meta (primary) or preview (fallback)
      let sourceUrl: string | null = orbitMeta.sourceUrl || null;
      
      if (!sourceUrl && orbitMeta.previewId) {
        const preview = await storage.getIcePreview(orbitMeta.previewId);
        sourceUrl = preview?.sourceUrl || null;
      }
      
      if (!sourceUrl) {
        return res.status(400).json({ message: "No source URL available for enrichment. Please provide a website URL." });
      }
      
      console.log(`[Orbit/enrich] Starting high-signal extraction for ${slug} from ${sourceUrl}`);
      
      const { extractHighSignalPages } = await import("./services/catalogueDetection");
      const { composeSeedingResult, buildAIContextFromSeeding } = await import("./services/businessDataExtractor");
      const result = await extractHighSignalPages(sourceUrl, slug, 15);
      
      // Compose seeding summary from all extraction results
      const seedingSummary = composeSeedingResult(result.extractionResults);
      const aiContext = buildAIContextFromSeeding(seedingSummary);
      console.log(`[Orbit/enrich] Seeding summary: ${JSON.stringify(seedingSummary, null, 2)}`);
      console.log(`[Orbit/enrich] AI context: ${aiContext}`);
      
      // Insert new boxes (don't clear existing product/menu boxes)
      const insertedCount = { success: 0, skipped: 0 };
      
      for (const box of result.boxes) {
        try {
          await storage.createOrbitBox({
            businessSlug: slug,
            boxType: box.boxType as any,
            title: box.title,
            description: box.description,
            content: box.content,
            sourceUrl: box.sourceUrl,
            tags: box.tags,
            sortOrder: 1000 + insertedCount.success,
            isVisible: true,
          });
          insertedCount.success++;
        } catch (err: any) {
          console.log(`[Orbit/enrich] Failed to insert box: ${err.message}`);
          insertedCount.skipped++;
        }
      }
      
      console.log(`[Orbit/enrich] Completed: ${insertedCount.success} boxes added, ${insertedCount.skipped} skipped`);
      
      res.json({
        success: true,
        stats: result.stats,
        insertedCount: insertedCount.success,
        pagesVisited: result.pagesVisited.length,
        seedingSummary,
        aiContext,
      });
      
    } catch (error: any) {
      console.error("[Orbit/enrich] Error:", error);
      res.status(500).json({ message: error.message || "Failed to enrich orbit data" });
    }
  });

  // Orbit Catalogue Import - Bulk import products/menu items (owner only, Grow+ tier required)
  app.post("/api/orbit/:slug/import", async (req, res) => {
    try {
      const { slug } = req.params;
      const { items, clearExisting, boxType } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can import catalogue items" });
      }
      
      const PAID_TIERS = ['grow', 'insight', 'intelligence'];
      const tier = orbitMeta.planTier;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Grow to import catalogue items" });
      }
      
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "items must be an array" });
      }
      
      if (items.length > 200) {
        return res.status(400).json({ message: "Maximum 200 items per import" });
      }
      
      const validBoxType = boxType === 'menu_item' ? 'menu_item' : 'product';
      
      const validatedItems: schema.InsertOrbitBox[] = [];
      const errors: { index: number; error: string }[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (!item.title || typeof item.title !== 'string') {
          errors.push({ index: i, error: 'Title is required' });
          continue;
        }
        
        const priceValue = item.price != null ? String(item.price) : null;
        if (priceValue && isNaN(parseFloat(priceValue))) {
          errors.push({ index: i, error: 'Price must be a valid number' });
          continue;
        }
        
        validatedItems.push({
          businessSlug: slug,
          boxType: validBoxType,
          title: item.title.slice(0, 200),
          description: item.description?.slice(0, 1000) || null,
          content: item.content?.slice(0, 5000) || null,
          imageUrl: item.imageUrl || item.image_url || null,
          price: priceValue,
          currency: item.currency || 'GBP',
          category: item.category?.slice(0, 100) || null,
          subcategory: item.subcategory?.slice(0, 100) || null,
          tags: Array.isArray(item.tags) ? item.tags.map((t: any) => ({
            key: String(t.key || t.type || 'tag').slice(0, 50),
            value: String(t.value || t.name || '').slice(0, 100),
            label: t.label ? String(t.label).slice(0, 100) : undefined,
          })) : null,
          sku: item.sku?.slice(0, 100) || null,
          availability: ['available', 'out_of_stock', 'limited'].includes(item.availability) ? item.availability : 'available',
          isVisible: item.isVisible !== false,
        });
      }
      
      if (validatedItems.length === 0) {
        return res.status(400).json({ 
          message: "No valid items to import", 
          errors: errors.slice(0, 10) 
        });
      }
      
      const result = await storage.bulkImportOrbitBoxes(slug, validatedItems, clearExisting === true);
      
      console.log(`[Orbit Import] ${slug}: ${result.imported} imported, ${result.skipped} skipped, ${errors.length} validation errors`);
      
      res.json({
        success: true,
        imported: result.imported,
        skipped: result.skipped,
        validationErrors: errors.length,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error("Error importing orbit catalogue:", error);
      res.status(500).json({ message: "Error importing catalogue" });
    }
  });

  // Orbit Catalogue - Get items by category (for clustered display)
  app.get("/api/orbit/:slug/catalogue", async (req, res) => {
    try {
      const { slug } = req.params;
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const boxes = await storage.getOrbitBoxes(slug);
      const productBoxes = boxes.filter(b => b.boxType === 'product' || b.boxType === 'menu_item');
      
      const categories: Record<string, typeof productBoxes> = {};
      for (const box of productBoxes) {
        const cat = box.category || 'Uncategorized';
        if (!categories[cat]) {
          categories[cat] = [];
        }
        categories[cat].push(box);
      }
      
      const categoryList = Object.entries(categories).map(([name, items]) => ({
        name,
        itemCount: items.length,
        items: items.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0)),
      })).sort((a, b) => b.itemCount - a.itemCount);
      
      res.json({
        totalItems: productBoxes.length,
        categoryCount: categoryList.length,
        categories: categoryList,
      });
    } catch (error) {
      console.error("Error getting orbit catalogue:", error);
      res.status(500).json({ message: "Error fetching catalogue" });
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
      
      const { customTitle, customDescription, customLogo, customAccent, customTone } = req.body;
      
      const updated = await storage.updateOrbitMeta(slug, {
        customTitle: customTitle !== undefined ? customTitle : orbitMeta.customTitle,
        customDescription: customDescription !== undefined ? customDescription : orbitMeta.customDescription,
        customLogo: customLogo !== undefined ? customLogo : orbitMeta.customLogo,
        customAccent: customAccent !== undefined ? customAccent : orbitMeta.customAccent,
        customTone: customTone !== undefined ? customTone : orbitMeta.customTone,
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

  // ============ SOCIAL PROOF (Testimonial Capture) ============

  // Social Proof - List all items for an Orbit
  app.get("/api/orbit/:slug/social-proof", async (req, res) => {
    try {
      const { slug } = req.params;
      const { status, consentStatus, topic } = req.query;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Owner only
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view social proof" });
      }
      
      const filters: any = {};
      if (status) filters.status = status;
      if (consentStatus) filters.consentStatus = consentStatus;
      if (topic) filters.topic = topic;
      
      const items = await storage.getSocialProofItems(slug, Object.keys(filters).length > 0 ? filters : undefined);
      
      res.json({ items, total: items.length });
    } catch (error) {
      console.error("Error getting social proof:", error);
      res.status(500).json({ message: "Error getting social proof" });
    }
  });

  // Social Proof - Get single item
  app.get("/api/orbit/:slug/social-proof/:id", async (req, res) => {
    try {
      const { slug, id } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view social proof" });
      }
      
      const item = await storage.getSocialProofItem(parseInt(id));
      if (!item || item.businessSlug !== slug) {
        return res.status(404).json({ message: "Social proof item not found" });
      }
      
      res.json({ item });
    } catch (error) {
      console.error("Error getting social proof item:", error);
      res.status(500).json({ message: "Error getting social proof item" });
    }
  });

  // Social Proof - Manual create (capture a quote from selected message)
  app.post("/api/orbit/:slug/social-proof", async (req, res) => {
    try {
      const { slug } = req.params;
      const { conversationId, sourceMessageId, rawQuoteText, topic } = req.body;
      
      if (!rawQuoteText || typeof rawQuoteText !== 'string') {
        return res.status(400).json({ message: "rawQuoteText is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can create social proof" });
      }
      
      // Import proof capture service for classification and cleaning
      const { classifyTestimonialMoment, cleanAndGenerateVariants } = await import('./services/proofCapture');
      
      // Classify the quote
      const classification = await classifyTestimonialMoment(rawQuoteText);
      
      // Clean and generate variants
      const { cleanQuote, variants, recommendedPlacements } = await cleanAndGenerateVariants(rawQuoteText);
      
      const item = await storage.createSocialProofItem({
        businessSlug: slug,
        conversationId: conversationId ? parseInt(conversationId) : null,
        sourceMessageId: sourceMessageId ? parseInt(sourceMessageId) : null,
        rawQuoteText,
        cleanQuoteText: cleanQuote,
        topic: topic || classification.topic,
        specificityScore: classification.specificityScore,
        sentimentScore: classification.sentimentScore,
        consentStatus: 'pending',
        generatedVariants: variants,
        recommendedPlacements,
        status: 'draft',
      });
      
      res.json({ item });
    } catch (error) {
      console.error("Error creating social proof:", error);
      res.status(500).json({ message: "Error creating social proof" });
    }
  });

  // Social Proof - Update (edit, approve, archive, consent status)
  app.patch("/api/orbit/:slug/social-proof/:id", async (req, res) => {
    try {
      const { slug, id } = req.params;
      const { 
        cleanQuoteText, 
        status, 
        consentStatus, 
        consentType, 
        attributionName, 
        attributionTown,
        topic 
      } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can update social proof" });
      }
      
      const existing = await storage.getSocialProofItem(parseInt(id));
      if (!existing || existing.businessSlug !== slug) {
        return res.status(404).json({ message: "Social proof item not found" });
      }
      
      const updateData: any = {};
      if (cleanQuoteText !== undefined) updateData.cleanQuoteText = cleanQuoteText;
      if (status !== undefined) updateData.status = status;
      if (consentStatus !== undefined) {
        updateData.consentStatus = consentStatus;
        if (consentStatus === 'granted') {
          updateData.consentTimestamp = new Date();
        }
      }
      if (consentType !== undefined) updateData.consentType = consentType;
      if (attributionName !== undefined) updateData.attributionName = attributionName;
      if (attributionTown !== undefined) updateData.attributionTown = attributionTown;
      if (topic !== undefined) updateData.topic = topic;
      
      // Regenerate variants if cleanQuoteText changed
      if (cleanQuoteText && cleanQuoteText !== existing.cleanQuoteText) {
        const { cleanAndGenerateVariants } = await import('./services/proofCapture');
        const { variants, recommendedPlacements } = await cleanAndGenerateVariants(cleanQuoteText);
        updateData.generatedVariants = variants;
        updateData.recommendedPlacements = recommendedPlacements;
      }
      
      const updated = await storage.updateSocialProofItem(parseInt(id), updateData);
      
      res.json({ item: updated });
    } catch (error) {
      console.error("Error updating social proof:", error);
      res.status(500).json({ message: "Error updating social proof" });
    }
  });

  // Social Proof - Delete
  app.delete("/api/orbit/:slug/social-proof/:id", async (req, res) => {
    try {
      const { slug, id } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can delete social proof" });
      }
      
      const existing = await storage.getSocialProofItem(parseInt(id));
      if (!existing || existing.businessSlug !== slug) {
        return res.status(404).json({ message: "Social proof item not found" });
      }
      
      await storage.deleteSocialProofItem(parseInt(id));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting social proof:", error);
      res.status(500).json({ message: "Error deleting social proof" });
    }
  });

  // Social Proof - Export formatted
  app.post("/api/orbit/:slug/social-proof/:id/export", async (req, res) => {
    try {
      const { slug, id } = req.params;
      const { format } = req.body; // 'website', 'tiktok_overlay', 'case_study'
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can export social proof" });
      }
      
      const item = await storage.getSocialProofItem(parseInt(id));
      if (!item || item.businessSlug !== slug) {
        return res.status(404).json({ message: "Social proof item not found" });
      }
      
      if (item.consentStatus !== 'granted') {
        return res.status(400).json({ message: "Cannot export without consent" });
      }
      
      const variants = item.generatedVariants as any;
      const attribution = item.consentType === 'name_town' 
        ? `${item.attributionName || 'Customer'}${item.attributionTown ? `, ${item.attributionTown}` : ''}`
        : 'Verified Customer';
      
      let exportPayload: any;
      
      switch (format) {
        case 'tiktok_overlay':
          exportPayload = {
            text: variants?.short || item.cleanQuoteText?.substring(0, 90) || item.rawQuoteText.substring(0, 90),
            attribution,
            format: 'overlay'
          };
          break;
        case 'case_study':
          exportPayload = {
            quote: variants?.long || item.cleanQuoteText || item.rawQuoteText,
            attribution,
            topic: item.topic,
            format: 'case_study'
          };
          break;
        case 'website':
        default:
          exportPayload = {
            quote: variants?.medium || item.cleanQuoteText || item.rawQuoteText,
            attribution,
            topic: item.topic,
            format: 'website_block'
          };
      }
      
      res.json({ export: exportPayload });
    } catch (error) {
      console.error("Error exporting social proof:", error);
      res.status(500).json({ message: "Error exporting social proof" });
    }
  });

  // Social Proof Settings - Get/Update proof capture settings for an Orbit
  app.get("/api/orbit/:slug/social-proof/settings", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can view settings" });
      }
      
      res.json({ 
        proofCaptureEnabled: orbitMeta.proofCaptureEnabled ?? true 
      });
    } catch (error) {
      console.error("Error getting social proof settings:", error);
      res.status(500).json({ message: "Error getting settings" });
    }
  });

  app.patch("/api/orbit/:slug/social-proof/settings", async (req, res) => {
    try {
      const { slug } = req.params;
      const { proofCaptureEnabled } = req.body;
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const isOwner = req.isAuthenticated() && orbitMeta.ownerId === (req.user as any)?.id;
      if (!isOwner) {
        return res.status(403).json({ message: "Only the orbit owner can update settings" });
      }
      
      if (proofCaptureEnabled !== undefined) {
        await storage.updateOrbitMeta(slug, { proofCaptureEnabled });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating social proof settings:", error);
      res.status(500).json({ message: "Error updating settings" });
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

  // Update Orbit Settings (owner only)
  app.patch("/api/orbit/:slug/settings", requireOrbitOwner, async (req, res) => {
    try {
      const { slug } = req.params;
      const { 
        customTitle, 
        sourceUrl,
        aiIndexingEnabled, 
        autoUpdateKnowledge, 
        aiAccuracyAlertsEnabled, 
        weeklyReportsEnabled 
      } = req.body;
      
      const updateData: any = {};
      if (customTitle !== undefined) updateData.customTitle = customTitle;
      if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
      if (aiIndexingEnabled !== undefined) updateData.aiIndexingEnabled = aiIndexingEnabled;
      if (autoUpdateKnowledge !== undefined) updateData.autoUpdateKnowledge = autoUpdateKnowledge;
      if (aiAccuracyAlertsEnabled !== undefined) updateData.aiAccuracyAlertsEnabled = aiAccuracyAlertsEnabled;
      if (weeklyReportsEnabled !== undefined) updateData.weeklyReportsEnabled = weeklyReportsEnabled;
      
      const updated = await storage.updateOrbitMeta(slug, updateData);
      
      res.json({ 
        message: "Settings updated",
        customTitle: updated?.customTitle,
        sourceUrl: updated?.sourceUrl,
        aiIndexingEnabled: updated?.aiIndexingEnabled,
        autoUpdateKnowledge: updated?.autoUpdateKnowledge,
        aiAccuracyAlertsEnabled: updated?.aiAccuracyAlertsEnabled,
        weeklyReportsEnabled: updated?.weeklyReportsEnabled,
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Error updating settings" });
    }
  });

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
            allow_promotion_codes: true,
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
            success_url: `${getAppBaseUrl(req)}/orbit/${slug}/hub?panel=cubes&success=true&orderId=${order.id}`,
            cancel_url: `${getAppBaseUrl(req)}/orbit/${slug}/hub?panel=cubes&cancelled=true`,
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

  // ============ SMART GLASSES CATEGORY DISCOVERY ============
  // In-memory storage for mock data (would be database in production)
  const smartGlassesQuestions = [
    { id: "1", question: "Are smart glasses worth it in 2026?", heat: 95, updatedAt: new Date().toISOString() },
    { id: "2", question: "Which smart glasses have the best camera quality?", heat: 88, updatedAt: new Date().toISOString() },
    { id: "3", question: "Can I wear smart glasses with prescription lenses?", heat: 85, updatedAt: new Date().toISOString() },
    { id: "4", question: "How long does the battery last on smart glasses?", heat: 82, updatedAt: new Date().toISOString() },
    { id: "5", question: "Are smart glasses safe for daily use?", heat: 78, updatedAt: new Date().toISOString() },
    { id: "6", question: "What is the difference between smart glasses and AR glasses?", heat: 75, updatedAt: new Date().toISOString() },
    { id: "7", question: "Can smart glasses record video discreetly?", heat: 72, updatedAt: new Date().toISOString() },
    { id: "8", question: "Do smart glasses work with both iPhone and Android?", heat: 70, updatedAt: new Date().toISOString() },
    { id: "9", question: "What features should I look for in smart glasses?", heat: 68, updatedAt: new Date().toISOString() },
    { id: "10", question: "How do I clean and maintain smart glasses?", heat: 62, updatedAt: new Date().toISOString() },
  ];

  const smartGlassesAnswers: Record<string, any[]> = {
    "1": [
      { id: "a1-1", questionId: "1", answer: "Smart glasses have matured significantly. For content creators, audio-first models offer excellent value for hands-free capture. For AR enthusiasts, the technology is improving but still has trade-offs in battery life and display quality. Consider your primary use case before purchasing.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 42, downvotes: 3, productRefs: [] },
      { id: "a1-2", questionId: "1", answer: "I bought a pair for commuting and they have been genuinely useful. The audio quality is better than I expected and not having to fish out my earbuds is convenient. Worth it for me.", sourceType: "community", updatedAt: new Date().toISOString(), upvotes: 28, downvotes: 5, productRefs: [] },
    ],
    "2": [
      { id: "a2-1", questionId: "2", answer: "Camera quality varies significantly by price point. Budget models typically offer 720p or 1080p, while premium options reach 4K. Look for optical image stabilisation if you plan to record while moving. Consider low-light performance as well, as this is often where cheaper models struggle.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 35, downvotes: 2, productRefs: [] },
    ],
    "3": [
      { id: "a3-1", questionId: "3", answer: "Many smart glasses brands now offer prescription lens options. Some work with third-party opticians, while others have in-house programmes. Expect to pay an additional £100-300 for prescription lenses. Check compatibility before purchasing.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 56, downvotes: 1, productRefs: [] },
      { id: "a3-2", questionId: "3", answer: "I got prescription lenses fitted to mine through my local optician. Took about two weeks and works perfectly. Just make sure to check the frame compatibility first.", sourceType: "community", updatedAt: new Date().toISOString(), upvotes: 19, downvotes: 0, productRefs: [] },
    ],
    "4": [
      { id: "a4-1", questionId: "4", answer: "Battery life typically ranges from 4-8 hours depending on usage. Audio playback drains less than video recording. Most models charge via their case, similar to wireless earbuds. Plan for a mid-day charge if you use features heavily.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 31, downvotes: 4, productRefs: [] },
    ],
    "5": [
      { id: "a5-1", questionId: "5", answer: "Current smart glasses meet standard safety regulations. The main considerations are weight distribution (heavier frames can cause discomfort), audio exposure levels, and screen time for AR models. Take breaks as you would with any screen-based device.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 22, downvotes: 1, productRefs: [] },
    ],
    "6": [
      { id: "a6-1", questionId: "6", answer: "Smart glasses add digital features like audio, camera, and simple notifications to traditional eyewear. AR glasses go further by projecting visual information into your field of view. Smart glasses are generally lighter and have better battery life, while AR glasses offer more immersive experiences at higher cost.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 67, downvotes: 2, productRefs: [] },
    ],
    "7": [
      { id: "a7-1", questionId: "7", answer: "Most reputable smart glasses have visible recording indicators (LED lights) to signal when capture is active. This is both an ethical design choice and a legal requirement in many regions. Discreet recording without indicators raises privacy concerns and may be illegal in some jurisdictions.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 44, downvotes: 8, productRefs: [] },
    ],
    "8": [
      { id: "a8-1", questionId: "8", answer: "Most smart glasses support both iOS and Android, though some features may work better on one platform. Check the manufacturer's compatibility list, as certain models have deeper integration with specific ecosystems. Voice assistants like Siri or Google Assistant may have different levels of support.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 25, downvotes: 3, productRefs: [] },
    ],
    "9": [
      { id: "a9-1", questionId: "9", answer: "Key features to consider: audio quality and open-ear design, camera resolution and stabilisation, battery life, prescription lens compatibility, comfort and weight, water resistance, companion app quality, and ecosystem integration. Prioritise based on your primary use case.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 38, downvotes: 1, productRefs: [] },
    ],
    "10": [
      { id: "a10-1", questionId: "10", answer: "Clean lenses with a microfibre cloth, avoiding paper products that can scratch. Use the provided case for storage. Keep charging contacts clean and dry. Avoid extreme temperatures. Most frames can be cleaned with mild soap and water, but check manufacturer guidelines first.", sourceType: "editorial", updatedAt: new Date().toISOString(), upvotes: 15, downvotes: 0, productRefs: [] },
    ],
  };

  const smartGlassesSurfacedProducts = [
    { id: "sp1", name: "AudioVue Pro", pitch: "Premium open-ear audio with crystal clear calls and music", priceRange: "£299 - £349", tags: [{ label: "Audio-first", type: "best_for_comfort" }], sponsored: true, imageUrl: null, detailsUrl: null },
    { id: "sp2", name: "CreatorFrame X1", pitch: "4K capture with instant social sharing and editing tools", priceRange: "£399 - £449", tags: [{ label: "Best for creators", type: "best_for_creators" }], sponsored: true, imageUrl: null, detailsUrl: null },
    { id: "sp3", name: "LensLink Lite", pitch: "Affordable entry point with solid audio and basic camera", priceRange: "£149 - £199", tags: [{ label: "Budget friendly", type: "budget_friendly" }], sponsored: true, imageUrl: null, detailsUrl: null },
    { id: "sp4", name: "VisionArc Elite", pitch: "True AR display with productivity and navigation features", priceRange: "£899 - £999", tags: [{ label: "Premium", type: "premium" }, { label: "AR Display", type: "new" }], sponsored: true, imageUrl: null, detailsUrl: null },
    { id: "sp5", name: "WorkSight Pro", pitch: "Enterprise-grade with secure connectivity and long battery", priceRange: "£549 - £649", tags: [{ label: "For work", type: "best_for_comfort" }], sponsored: true, imageUrl: null, detailsUrl: null },
    { id: "sp6", name: "SportVision Active", pitch: "Sweat-resistant with real-time fitness metrics display", priceRange: "£329 - £379", tags: [{ label: "Fitness", type: "new" }], sponsored: true, imageUrl: null, detailsUrl: null },
  ];

  // GET /api/smartglasses/questions - return trending questions
  app.get("/api/smartglasses/questions", (req, res) => {
    res.json({ questions: smartGlassesQuestions });
  });

  // GET /api/smartglasses/answers - return answers for a question
  app.get("/api/smartglasses/answers", (req, res) => {
    const questionId = req.query.questionId as string;
    if (!questionId) {
      return res.status(400).json({ message: "questionId is required" });
    }
    const answers = smartGlassesAnswers[questionId] || [];
    const sorted = [...answers].sort((a, b) => {
      const scoreA = a.upvotes - a.downvotes;
      const scoreB = b.upvotes - b.downvotes;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    res.json({ answers: sorted });
  });

  // POST /api/smartglasses/answers/:answerId/vote - vote on an answer
  app.post("/api/smartglasses/answers/:answerId/vote", (req, res) => {
    const { answerId } = req.params;
    const { vote } = req.body;
    if (!vote || !["up", "down"].includes(vote)) {
      return res.status(400).json({ message: "vote must be 'up' or 'down'" });
    }
    for (const questionId of Object.keys(smartGlassesAnswers)) {
      const answers = smartGlassesAnswers[questionId];
      const answer = answers.find((a: any) => a.id === answerId);
      if (answer) {
        if (vote === "up") answer.upvotes++;
        else answer.downvotes++;
        return res.json({ answer });
      }
    }
    res.status(404).json({ message: "Answer not found" });
  });

  // GET /api/smartglasses/surfaced-products - return sponsored products
  app.get("/api/smartglasses/surfaced-products", (req, res) => {
    res.json({ products: smartGlassesSurfacedProducts });
  });

  // POST /api/smartglasses/partner-inquiry - submit partner inquiry
  app.post("/api/smartglasses/partner-inquiry", (req, res) => {
    const { name, company, product, website, email } = req.body;
    if (!name || !company || !product || !website || !email) {
      return res.status(400).json({ message: "All fields are required" });
    }
    console.log("[Smart Glasses Partner Inquiry]", { name, company, product, website, email });
    res.json({ success: true, message: "Thanks. We will be in touch within 2 working days." });
  });

  // ============ INDUSTRY ORBIT VIEW ENGINE CHAT ============
  
  // POST /api/industry-orbits/:slug/chat - View-enhanced chat for industry orbits
  app.post("/api/industry-orbits/:slug/chat", chatRateLimiter, async (req, res) => {
    try {
      const { slug } = req.params;
      const { message, history = [], category } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta || orbitMeta.orbitType !== 'industry') {
        return res.status(404).json({ message: "Industry orbit not found" });
      }
      
      const { runViewEnginePipeline } = await import('./services/orbitViewEngine');
      const { generateChatResponse } = await import('./services/orbitChatService');
      
      const categoryName = category || orbitMeta.customTitle || slug.replace(/-/g, ' ');
      
      const systemPrompt = `You are an expert assistant for the ${categoryName} category. You help users discover, compare, and understand products in this space.

Key behaviors:
- Be concise and factual
- When comparing products, highlight key differentiators
- When recommending, consider user's stated needs
- Include specific product names and attributes when relevant
- Format responses for readability with bullet points when appropriate

Current category: ${categoryName}`;

      const historyForAI = (history || [])
        .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-6)
        .map((msg: any) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
      
      const chatResponse = await generateChatResponse(systemPrompt, historyForAI, message, { maxTokens: 400 });
      
      const pipelineResult = await runViewEnginePipeline({
        userMessage: message,
        chatResponse,
        category: categoryName,
        recentTopics: historyForAI.slice(-2).map((m: any) => m.content),
        useMockData: false
      });
      
      console.log('[ViewEngine] Pipeline result:', {
        intent: pipelineResult.logs.intent.primary_intent,
        viewType: pipelineResult.response.view?.type || 'none',
        confidence: pipelineResult.logs.intent.confidence,
        reasonCodes: pipelineResult.logs.decision.reasonCodes
      });
      
      res.json({
        message: pipelineResult.response.message,
        view: pipelineResult.response.view || null,
        followups: pipelineResult.response.followups || [],
        disambiguation: pipelineResult.response.disambiguation || null,
        meta: pipelineResult.response.meta || null
      });
      
    } catch (error) {
      console.error("[IndustryOrbitChat] Error:", error);
      res.status(500).json({ message: "Error processing chat" });
    }
  });

  // ============ INDUSTRY ORBIT SEED API ============
  
  const { seedPackSchema, importSeedPack, getOrbitDefinition, getOrbitFrontPage, getOrbitKnowledge } = await import("./services/industryOrbitSeedService");
  
  // POST /api/industry-orbits/:slug/seed - Import seed pack
  app.post("/api/industry-orbits/:slug/seed", async (req, res) => {
    const { slug } = req.params;
    
    try {
      // Get orbit meta by slug
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Check if it's an industry orbit
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "Seed packs can only be imported into Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      // Validate the seed pack
      const parseResult = seedPackSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid seed pack format",
          errors: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        });
      }
      
      const seedPack = parseResult.data;
      
      // Verify the pack is for this orbit (support both CPAC orbit.slug and legacy orbitSlug)
      const packSlug = seedPack.orbit?.slug ?? seedPack.orbitSlug;
      if (packSlug && packSlug !== slug) {
        return res.status(400).json({
          message: `Seed pack is for orbit "${packSlug}" but you're importing to "${slug}"`,
        });
      }
      
      // Import the seed pack
      const result = await importSeedPack(orbitMeta.id, seedPack);
      
      console.log(`[Industry Orbit Seed] Imported to ${slug}:`, result.imported);
      if (result.skipped && Object.values(result.skipped).some(v => v > 0)) {
        console.log(`[Industry Orbit Seed] Skipped:`, result.skipped);
      }
      if (result.warnings && result.warnings.length > 0) {
        console.log(`[Industry Orbit Seed] Warnings:`, result.warnings.map(w => `[${w.severity}] ${w.message}`));
      }
      
      res.json({
        success: result.success,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
        warnings: result.warnings || [],
        quality: result.quality,
      });
      
    } catch (error) {
      console.error("[Industry Orbit Seed] Error:", error);
      res.status(500).json({ message: "Failed to import seed pack" });
    }
  });
  
  // GET /api/industry-orbits/:slug/definition - Get full definition
  app.get("/api/industry-orbits/:slug/definition", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      // Check if it's an industry orbit
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "Definition endpoint is only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const definition = await getOrbitDefinition(orbitMeta.id);
      
      res.json({
        orbitId: orbitMeta.id,
        slug: slug,
        name: orbitMeta.customTitle || orbitMeta.businessName,
        type: 'industry',
        definition,
      });
      
    } catch (error) {
      console.error("[Industry Orbit Definition] Error:", error);
      res.status(500).json({ message: "Failed to get orbit definition" });
    }
  });
  
  // GET /api/industry-orbits/:slug/front-page - Curated front page sections
  app.get("/api/industry-orbits/:slug/front-page", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "Front page endpoint is only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const frontPage = await getOrbitFrontPage(
        orbitMeta.id, 
        orbitMeta.customTitle || orbitMeta.businessName || slug
      );
      
      res.json({
        orbitId: orbitMeta.id,
        slug,
        type: 'industry',
        ...frontPage,
      });
      
    } catch (error) {
      console.error("[Industry Orbit Front Page] Error:", error);
      res.status(500).json({ message: "Failed to get front page" });
    }
  });
  
  // GET /api/industry-orbits/:slug/entities - List entities
  app.get("/api/industry-orbits/:slug/entities", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const entities = await storage.getIndustryEntitiesByOrbit(orbitMeta.id);
      res.json({ entities });
      
    } catch (error) {
      res.status(500).json({ message: "Failed to get entities" });
    }
  });
  
  // GET /api/industry-orbits/:slug/products - List products with specs
  app.get("/api/industry-orbits/:slug/products", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const products = await storage.getIndustryProductsByOrbit(orbitMeta.id);
      
      // Include specs for each product
      const productsWithSpecs = await Promise.all(
        products.map(async (product) => {
          const specs = await storage.getProductSpecs(product.id);
          return { ...product, specs };
        })
      );
      
      res.json({ products: productsWithSpecs });
      
    } catch (error) {
      res.status(500).json({ message: "Failed to get products" });
    }
  });
  
  // GET /api/industry-orbits/:slug/reviews - List reviews
  app.get("/api/industry-orbits/:slug/reviews", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const reviews = await storage.getIndustryReviewsByOrbit(orbitMeta.id);
      res.json({ reviews });
      
    } catch (error) {
      res.status(500).json({ message: "Failed to get reviews" });
    }
  });
  
  // GET /api/industry-orbits/:slug/communities - List community links
  app.get("/api/industry-orbits/:slug/communities", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const communities = await storage.getCommunityLinksByOrbit(orbitMeta.id);
      res.json({ communities });
      
    } catch (error) {
      res.status(500).json({ message: "Failed to get communities" });
    }
  });
  
  // GET /api/industry-orbits/:slug/tiles - List topic tiles
  app.get("/api/industry-orbits/:slug/tiles", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const tiles = await storage.getTopicTilesByOrbit(orbitMeta.id);
      res.json({ tiles });
      
    } catch (error) {
      res.status(500).json({ message: "Failed to get tiles" });
    }
  });
  
  // GET /api/industry-orbits/:slug/pulse-events - List pulse events
  app.get("/api/industry-orbits/:slug/pulse-events", async (req, res) => {
    const { slug } = req.params;
    const status = req.query.status as string | undefined;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      const validStatuses = ['new', 'processed', 'dismissed'] as const;
      const statusFilter = status && validStatuses.includes(status as any) 
        ? status as typeof validStatuses[number]
        : undefined;
      
      const events = await storage.getPulseEventsByOrbit(orbitMeta.id, statusFilter);
      res.json({ events });
      
    } catch (error) {
      res.status(500).json({ message: "Failed to get pulse events" });
    }
  });
  
  // GET /api/orbits/:slug/knowledge - Get knowledge items for RadarGrid (unified Orbit UI)
  app.get("/api/orbits/:slug/knowledge", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(400).json({ 
          message: "Knowledge endpoint is for Industry Orbits. Use standard orbit data for business orbits.",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const knowledge = await getOrbitKnowledge(
        orbitMeta.id, 
        orbitMeta.customTitle || slug
      );
      
      res.json({
        orbitId: orbitMeta.id,
        slug,
        type: 'industry',
        knowledge,
      });
      
    } catch (error) {
      console.error("[Orbit Knowledge] Error:", error);
      res.status(500).json({ message: "Failed to get orbit knowledge" });
    }
  });
  
  // ============ INDUSTRY ASSET SERVING ============
  
  // GET /api/assets/:id - Serve industry asset by ID (redirect to storage URL)
  app.get("/api/assets/:id", async (req, res) => {
    const { id } = req.params;
    const assetId = parseInt(id, 10);
    
    if (isNaN(assetId)) {
      return res.status(400).json({ message: "Invalid asset ID" });
    }
    
    try {
      const asset = await storage.getIndustryAsset(assetId);
      
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      if (!asset.storageUrl) {
        return res.status(404).json({ message: "Asset has no storage URL" });
      }
      
      // Redirect to the actual storage URL
      res.redirect(asset.storageUrl);
      
    } catch (error) {
      console.error("[Assets] Error serving asset:", error);
      res.status(500).json({ message: "Failed to serve asset" });
    }
  });
  
  // ============ CPAC EXPORT/IMPORT API ============
  
  // GET /api/industry-orbits - List all industry orbits
  app.get("/api/industry-orbits", async (req, res) => {
    try {
      const industryOrbits = await db.select({
        id: schema.orbitMeta.id,
        slug: schema.orbitMeta.businessSlug,
        title: schema.orbitMeta.customTitle,
      })
        .from(schema.orbitMeta)
        .where(eq(schema.orbitMeta.orbitType, 'industry'));
      
      res.json({ 
        orbits: industryOrbits.map(o => ({
          ...o,
          title: o.title || o.slug,
        }))
      });
    } catch (error) {
      console.error("[Industry Orbits] Error listing orbits:", error);
      res.status(500).json({ message: "Failed to list industry orbits" });
    }
  });
  
  const { exportCpac, exportAssetsReviewCsv, applyAssetApprovals, parseAssetApprovalsCsv, calculateCpacStats, generateClaudeExtensionPrompt, analyzeCpacDiff } = await import("./services/cpacExportService");
  
  // GET /api/industry-orbits/:slug/cpac - Export full CPAC JSON
  app.get("/api/industry-orbits/:slug/cpac", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "CPAC export is only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const cpac = await exportCpac(orbitMeta);
      
      // Set filename for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-cpac-v1.json"`);
      
      res.json(cpac);
      
    } catch (error) {
      console.error("[CPAC Export] Error:", error);
      res.status(500).json({ message: "Failed to export CPAC" });
    }
  });
  
  // GET /api/industry-orbits/:slug/assets-review.csv - Export assets review CSV
  app.get("/api/industry-orbits/:slug/assets-review.csv", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "Assets review export is only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const csv = await exportAssetsReviewCsv(orbitMeta);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-assets-review.csv"`);
      
      res.send(csv);
      
    } catch (error) {
      console.error("[Assets Review Export] Error:", error);
      res.status(500).json({ message: "Failed to export assets review CSV" });
    }
  });
  
  // POST /api/industry-orbits/:slug/assets-approvals - Apply asset approvals
  app.post("/api/industry-orbits/:slug/assets-approvals", async (req, res) => {
    const { slug } = req.params;
    const contentType = req.headers['content-type'] || '';
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "Asset approvals are only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      let approvals;
      
      if (contentType.includes('text/csv')) {
        // Parse CSV body
        const csvContent = typeof req.body === 'string' ? req.body : req.body.toString();
        approvals = parseAssetApprovalsCsv(csvContent);
      } else if (contentType.includes('application/json')) {
        // JSON array of approvals
        if (!Array.isArray(req.body)) {
          return res.status(400).json({ message: "Request body must be an array of approval rows" });
        }
        approvals = req.body;
      } else {
        return res.status(400).json({ 
          message: "Content-Type must be text/csv or application/json" 
        });
      }
      
      if (!approvals || approvals.length === 0) {
        return res.status(400).json({ message: "No approval rows provided" });
      }
      
      const result = await applyAssetApprovals(orbitMeta, approvals);
      
      console.log(`[Asset Approvals] Applied to ${slug}:`, {
        updated: result.updated,
        rejected: result.rejected,
        skipped: result.skipped,
      });
      
      if (result.errors.length > 0) {
        console.warn(`[Asset Approvals] Errors:`, result.errors);
      }
      
      res.json({
        success: result.errors.length === 0,
        updated: result.updated,
        rejected: result.rejected,
        skipped: result.skipped,
        errors: result.errors,
        warnings: result.warnings,
      });
      
    } catch (error) {
      console.error("[Asset Approvals] Error:", error);
      res.status(500).json({ message: "Failed to apply asset approvals" });
    }
  });
  
  // GET /api/industry-orbits/:slug/cpac/stats - Get CPAC stats and counts
  app.get("/api/industry-orbits/:slug/cpac/stats", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "CPAC stats are only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const cpac = await exportCpac(orbitMeta);
      const stats = calculateCpacStats(cpac);
      
      res.json({
        orbit: {
          slug: orbitMeta.businessSlug,
          title: orbitMeta.customTitle || orbitMeta.businessSlug,
        },
        stats,
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error("[CPAC Stats] Error:", error);
      res.status(500).json({ message: "Failed to get CPAC stats" });
    }
  });
  
  // GET /api/industry-orbits/:slug/cpac/claude-prompt - Generate Claude extension prompt
  app.get("/api/industry-orbits/:slug/cpac/claude-prompt", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "Claude prompt generation is only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const cpac = await exportCpac(orbitMeta);
      const stats = calculateCpacStats(cpac);
      const prompt = generateClaudeExtensionPrompt(cpac, stats);
      
      // Return as plain text for easy copying
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-claude-prompt.txt"`);
      
      res.send(prompt);
      
    } catch (error) {
      console.error("[Claude Prompt] Error:", error);
      res.status(500).json({ message: "Failed to generate Claude prompt" });
    }
  });
  
  // POST /api/industry-orbits/:slug/cpac/diff - Analyze diff between current and uploaded CPAC
  app.post("/api/industry-orbits/:slug/cpac/diff", async (req, res) => {
    const { slug } = req.params;
    
    try {
      const orbitMeta = await storage.getOrbitMeta(slug);
      if (!orbitMeta) {
        return res.status(404).json({ message: "Orbit not found" });
      }
      
      if (orbitMeta.orbitType !== 'industry') {
        return res.status(403).json({ 
          message: "CPAC diff is only available for Industry Orbits",
          code: "NOT_INDUSTRY_ORBIT"
        });
      }
      
      const incomingCpac = req.body;
      if (!incomingCpac || !incomingCpac.formatVersion) {
        return res.status(400).json({ message: "Invalid CPAC format" });
      }
      
      const existingCpac = await exportCpac(orbitMeta);
      const diff = analyzeCpacDiff(existingCpac, incomingCpac);
      
      res.json({
        orbit: {
          slug: orbitMeta.businessSlug,
          title: orbitMeta.customTitle || orbitMeta.businessSlug,
        },
        diff,
        summary: {
          totalAdditions: diff.newEntities.length + diff.newProducts.length + diff.newCommunities.length + diff.newTiles.length + diff.newPulseSources.length,
          potentialDuplicates: diff.potentialDuplicates.length,
          warnings: diff.warnings.length,
        },
        analyzedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error("[CPAC Diff] Error:", error);
      res.status(500).json({ message: "Failed to analyze CPAC diff" });
    }
  });

  // ============ TOPIC TILES URL INGESTION ============
  
  // POST /api/orbit/:slug/ingest-url - Ingest a website URL and generate topic tiles for a specific Orbit
  app.post("/api/orbit/:slug/ingest-url", async (req, res) => {
    try {
      const { slug } = req.params;
      const { url, forceRescan } = req.body;
      
      // Validate orbit exists
      const orbit = await storage.getOrbitMeta(slug);
      if (!orbit) {
        return res.status(404).json({
          success: false,
          message: `Orbit '${slug}' not found`,
        });
      }
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: "URL is required" 
        });
      }
      
      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      } catch {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid URL format" 
        });
      }
      
      // Check cache for this specific orbit (unless forceRescan)
      if (!forceRescan) {
        const cached = await loadOrbitIngestion(slug);
        if (cached) {
          const cacheAge = Date.now() - new Date(cached.scannedAt).getTime();
          const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours
          if (cacheAge < maxCacheAge) {
            console.log(`[IngestURL] Using cached result for orbit ${slug}`);
            return res.json({
              success: true,
              orbitId: slug,
              tiles: cached.tiles,
              crawlReport: cached.crawlReport,
              cached: true,
              message: `Using cached results from ${cached.scannedAt}`,
            });
          }
        }
      }
      
      console.log(`[IngestURL] Starting fresh ingestion for ${url} (orbit: ${slug})`);
      
      // Perform ingestion with the orbit slug as the ID
      const result = await ingestUrlAndGenerateTiles(parsedUrl.href, slug);
      
      // Save to storage under this orbit's slug
      await saveOrbitIngestion({
        ...result,
        orbitId: slug, // Override with orbit slug
      });
      
      res.json({
        success: true,
        orbitId: slug,
        tiles: result.tiles,
        crawlReport: result.crawlReport,
        cached: false,
        message: `Generated ${result.tiles.length} tiles from ${result.crawlReport.pagesSucceeded} pages`,
      });
      
    } catch (error: any) {
      console.error("[IngestURL] Error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to ingest URL" 
      });
    }
  });
  
  // GET /api/orbit/:orbitId/tiles - Get tiles for an orbit
  app.get("/api/orbit-tiles/:orbitId", async (req, res) => {
    try {
      const { orbitId } = req.params;
      
      const result = await loadOrbitIngestion(orbitId);
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: "Orbit not found" 
        });
      }
      
      const groupedTiles = groupTilesByCategory(result.tiles);
      
      res.json({
        success: true,
        orbitId: result.orbitId,
        inputUrl: result.inputUrl,
        scannedAt: result.scannedAt,
        tiles: result.tiles,
        groupedTiles,
        crawlReport: result.crawlReport,
      });
      
    } catch (error: any) {
      console.error("[GetTiles] Error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to get tiles" 
      });
    }
  });
  
  // GET /api/orbit-tiles/:orbitId/grouped - Get tiles grouped by category (for Netflix layout)
  app.get("/api/orbit-tiles/:orbitId/grouped", async (req, res) => {
    try {
      const { orbitId } = req.params;
      
      const tiles = await getOrbitTiles(orbitId);
      if (!tiles) {
        return res.status(404).json({ 
          success: false, 
          message: "Orbit not found" 
        });
      }
      
      const groupedTiles = groupTilesByCategory(tiles);
      
      res.json({
        success: true,
        orbitId,
        groupedTiles,
        rows: [
          { title: 'Top Insights', tiles: groupedTiles['Top Insights'] },
          { title: 'Services & Offers', tiles: groupedTiles['Services & Offers'] },
          { title: 'FAQs & Objections', tiles: groupedTiles['FAQs & Objections'] },
          { title: 'Proof & Trust', tiles: groupedTiles['Proof & Trust'] },
          { title: 'Recommendations', tiles: groupedTiles['Recommendations'] },
        ].filter(row => row.tiles.length > 0),
      });
      
    } catch (error: any) {
      console.error("[GetGroupedTiles] Error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to get grouped tiles" 
      });
    }
  });

  // Start background jobs
  startArchiveExpiredPreviewsJob(storage);
  startWeeklyKnowledgeCoachJob(storage);

  return httpServer;
}
