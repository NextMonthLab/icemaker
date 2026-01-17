import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { sql, eq, desc, gte, gt, and, isNotNull } from "drizzle-orm";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
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
import { startOrphanCleanupJob } from "./jobs/orphanCleanup";
import { startStorageReconciliationJob } from "./jobs/storageReconciliation";
import { startExportCleanupJob } from "./jobs/exportCleanup";
import { getFullEntitlements, dailyCapMiddleware } from "./entitlements";
import { 
  FREE_CONVERSATION_LIMIT, 
  FREE_CONVERSATION_SOFT_LIMIT, 
  conversationLimitCopy 
} from "@shared/uxCopy";
import { analyticsRateLimiter, activationRateLimiter, chatRateLimiter, getClientIp } from "./rateLimit";
import { logAuthFailure, logAccessDenied, logTokenError, logAdminAction } from "./securityLogger";
import { analyticsRequestValidator, chatRequestValidator, chatMessageValidator, analyticsMetadataValidator, analyticsTypeValidator, analyticsMetadataStringValidator, adminRequestValidator, adminReasonValidator } from "./requestValidation";
import { canReadUniverse, canWriteUniverse, canReadIcePreview, canWriteIcePreview, logAuditEvent, extractRequestInfo } from "./authPolicies";
import { ingestUrlAndGenerateTiles, groupTilesByCategory } from "./services/topicTileGenerator";

function getAppBaseUrl(req: any): string {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

// Format bytes to human readable string
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
  console.log('[session-config] NODE_ENV:', process.env.NODE_ENV);
  console.log('[session-config] isProduction:', isProduction);
  console.log('[session-config] DATABASE_URL exists:', !!process.env.DATABASE_URL);

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  // Session middleware with PostgreSQL store for persistence across restarts
  // Create a dedicated pool for session store (with SSL for Render)
  const sslConfig = isProduction ? { rejectUnauthorized: false } : undefined;
  console.log('[session-config] SSL config:', sslConfig ? 'ENABLED' : 'DISABLED');

  const sessionPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
  });

  // Log session store errors for debugging (capture full error object)
  sessionPool.on('error', (err) => {
    console.error('[session-store] Pool error:', err);
    if (err && err.stack) console.error('[session-store] Pool error stack:', err.stack);
  });

  // Test the connection and verify session table
  sessionPool.connect(async (err, client, release) => {
    if (err) {
      console.error('[session-store] Failed to connect to database:', err);
      if (err.stack) console.error('[session-store] Connection error stack:', err.stack);
    } else {
      console.log('[session-store] Successfully connected to database');
      
      // Verify/create session table manually to avoid silent failures
      try {
        if (client) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS "public"."session" (
              "sid" varchar NOT NULL COLLATE "default",
              "sess" json NOT NULL,
              "expire" timestamp(6) NOT NULL,
              CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
            ) WITH (OIDS=FALSE);
          `);
          await client.query(`
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "public"."session" ("expire");
          `);
          console.log('[session-store] Session table verified/created successfully');
        }
      } catch (tableErr: any) {
        console.error('[session-store] Failed to create session table:', tableErr);
      }
      
      if (client) release();
    }
  });

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        pool: sessionPool,           // Use pool instead of conString for SSL support
        schemaName: 'public',        // Explicit schema
        tableName: 'session',
        createTableIfMissing: true,
        errorLog: (err: any) => {
          // Capture full error details - err can be string, Error, or object
          if (err instanceof Error) {
            console.error('[session-store] Error:', err.message);
            if (err.stack) console.error('[session-store] Error stack:', err.stack);
          } else {
            console.error('[session-store] Error (raw):', JSON.stringify(err, null, 2));
          }
        },
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
  
  // Health check endpoint for Render and load balancers
  app.get("/api/health", async (_req, res) => {
    try {
      // Quick database connectivity check using raw SQL via Drizzle
      const result = await db.$client.query('SELECT 1 as ok');
      if (!result.rows || result.rows.length === 0) {
        throw new Error("Database query returned no rows");
      }
      res.status(200).json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
      });
    } catch (error: any) {
      console.error("[health] Database check failed:", error.message);
      res.status(503).json({ 
        status: "unhealthy",
        error: "Database connection failed",
        timestamp: new Date().toISOString()
      });
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
      
      // Claim any guest ICE previews from this IP address
      const userIp = req.ip || req.socket.remoteAddress || "";
      if (userIp) {
        try {
          const claimedCount = await storage.claimGuestPreviewsByIp(userIp, user.id);
          if (claimedCount > 0) {
            console.log(`[auth] Claimed ${claimedCount} guest ICE preview(s) for new user ${user.id} from IP ${userIp}`);
          }
        } catch (claimError) {
          console.error('[auth] Error claiming guest previews:', claimError);
          // Don't fail registration if claiming fails
        }
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('[auth] Register login error:', loginErr);
          if (!res.headersSent) {
            return res.status(500).json({ message: "Error logging in after registration" });
          }
          return;
        }
        // Explicitly save session to catch session store errors
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[auth] Register session save error:', saveErr);
            if (!res.headersSent) {
              return res.status(500).json({ message: "Error saving session" });
            }
            return;
          }
          if (!res.headersSent) {
            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword });
          }
        });
      });
    } catch (error) {
      console.error("Register error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error creating user" });
      }
    }
  });
  
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('[auth] Login passport error:', err);
        if (!res.headersSent) {
          return res.status(500).json({ message: "Error logging in" });
        }
        return;
      }
      if (!user) {
        if (!res.headersSent) {
          return res.status(401).json({ message: info?.message || "Invalid credentials" });
        }
        return;
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('[auth] Login session error:', loginErr);
          if (!res.headersSent) {
            return res.status(500).json({ message: "Error logging in" });
          }
          return;
        }
        // Explicitly save session to catch session store errors
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[auth] Session save error:', saveErr);
            if (!res.headersSent) {
              return res.status(500).json({ message: "Error saving session" });
            }
            return;
          }
          if (!res.headersSent) {
            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword });
          }
        });
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

  // ============ HEALTH & FEATURE FLAGS ============

  // Health check endpoint showing enabled features (admin only for security)
  app.get("/api/health/features", requireAdmin, async (_req, res) => {
    try {
      const { featureFlags, killSwitches, costLimits } = await import("./config/featureFlags");

      res.json({
        status: "healthy",
        features: {
          orbit: featureFlags.orbit,
          iceGeneration: featureFlags.iceGeneration,
          ai: featureFlags.ai,
          notifications: featureFlags.notifications,
          magicLinks: featureFlags.magicLinks,
          softLaunch: featureFlags.softLaunch,
        },
        killSwitches,
        costLimits,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: "Error fetching feature flags" });
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
  
  // Get creator stats (total ICEs, views, engagements)
  app.get("/api/me/creator-stats", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get all ICE previews owned by this user
      const userPreviews = await storage.getIcePreviewsByUser(userId);
      
      let totalViews = 0;
      let totalEngagements = 0;
      
      // Aggregate analytics across all user's ICEs
      for (const preview of userPreviews) {
        const analytics = await storage.getExperienceAnalytics(preview.id);
        if (analytics) {
          totalViews += analytics.totalViews || 0;
          totalEngagements += analytics.uniqueViewers || 0;
        }
      }
      
      res.json({
        totalIces: userPreviews.length,
        totalViews,
        totalEngagements,
      });
    } catch (error) {
      console.error("Error fetching creator stats:", error);
      res.status(500).json({ message: "Error fetching creator stats" });
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
      
      // Get social links for this profile
      const links = await storage.getCreatorProfileLinks(profile.id);
      
      // Get follower/following counts
      const followerCount = await storage.getFollowerCount(profile.id);
      const followingCount = await storage.getFollowingCount(profile.id);
      
      // Get public ICEs for this creator
      const allIces = await storage.getIcePreviewsByUser(profile.userId);
      const publicIces = allIces.filter(ice => ice.visibility === 'public');
      
      // Return public info only (exclude stripe IDs, etc.)
      res.json({
        id: profile.id,
        displayName: profile.displayName,
        slug: profile.slug,
        headline: profile.headline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        externalLink: profile.externalLink,
        links,
        followerCount,
        followingCount,
        iceCount: publicIces.length,
        universes: universes.map(u => ({
          id: u.id,
          slug: u.slug,
          title: u.title,
          description: u.description,
          coverImageUrl: u.coverImageUrl,
          genre: u.genre,
        })),
        ices: publicIces.map(ice => ({
          id: ice.id,
          title: ice.title,
          description: ice.description,
          coverImageUrl: ice.cards?.[0]?.generatedImageUrl || null,
          visibility: ice.visibility,
          createdAt: ice.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching public creator profile:", error);
      res.status(500).json({ message: "Error fetching creator profile" });
    }
  });
  
  // Get current user's profile links
  app.get("/api/me/creator-profile/links", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      const links = await storage.getCreatorProfileLinks(profile.id);
      res.json(links);
    } catch (error) {
      console.error("Error fetching profile links:", error);
      res.status(500).json({ message: "Error fetching profile links" });
    }
  });
  
  // Set profile links (replace all)
  app.put("/api/me/creator-profile/links", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      const { links } = req.body;
      if (!Array.isArray(links)) {
        return res.status(400).json({ message: "Links must be an array" });
      }
      const result = await storage.setCreatorProfileLinks(profile.id, links);
      res.json(result);
    } catch (error) {
      console.error("Error updating profile links:", error);
      res.status(500).json({ message: "Error updating profile links" });
    }
  });
  
  // Upload creator profile avatar
  app.post("/api/me/creator-profile/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const file = req.file;
      if (file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ message: "File too large. Maximum size is 2MB" });
      }
      
      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type. Allowed: PNG, JPEG, WebP" });
      }
      
      const ext = file.mimetype.split("/")[1];
      const filename = `creator-avatar-${profile.id}-${Date.now()}.${ext}`;
      
      let avatarUrl: string;
      
      if (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
        const { Client } = await import("@replit/object-storage");
        const client = new Client();
        const objectPath = `public/creator-avatars/${filename}`;
        await client.uploadFromBytes(objectPath, file.buffer);
        avatarUrl = `/objects/${objectPath}`;
      } else {
        const fs = await import("fs/promises");
        const path = await import("path");
        const dir = path.join(process.cwd(), "uploads", "creator-avatars");
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, filename);
        await fs.writeFile(filePath, file.buffer);
        avatarUrl = `/uploads/creator-avatars/${filename}`;
      }
      
      await storage.updateCreatorProfile(req.user!.id, { avatarUrl });
      
      res.json({ avatarUrl });
    } catch (error) {
      console.error("Error uploading creator avatar:", error);
      res.status(500).json({ message: "Error uploading avatar" });
    }
  });
  
  // Follow a creator
  app.post("/api/creators/:profileId/follow", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "You need a creator profile to follow others" });
      }
      const targetProfileId = parseInt(req.params.profileId);
      if (isNaN(targetProfileId)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }
      if (profile.id === targetProfileId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
      }
      await storage.followCreator(profile.id, targetProfileId);
      const followerCount = await storage.getFollowerCount(targetProfileId);
      res.json({ following: true, followerCount });
    } catch (error) {
      console.error("Error following creator:", error);
      res.status(500).json({ message: "Error following creator" });
    }
  });
  
  // Unfollow a creator
  app.delete("/api/creators/:profileId/follow", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "You need a creator profile to unfollow others" });
      }
      const targetProfileId = parseInt(req.params.profileId);
      if (isNaN(targetProfileId)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }
      await storage.unfollowCreator(profile.id, targetProfileId);
      const followerCount = await storage.getFollowerCount(targetProfileId);
      res.json({ following: false, followerCount });
    } catch (error) {
      console.error("Error unfollowing creator:", error);
      res.status(500).json({ message: "Error unfollowing creator" });
    }
  });
  
  // Check if following a creator
  app.get("/api/creators/:profileId/follow", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.json({ following: false });
      }
      const targetProfileId = parseInt(req.params.profileId);
      if (isNaN(targetProfileId)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }
      const isFollowing = await storage.isFollowing(profile.id, targetProfileId);
      res.json({ following: isFollowing });
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Error checking follow status" });
    }
  });
  
  // Get my followers
  app.get("/api/me/followers", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.json({ followers: [] });
      }
      const followers = await storage.getFollowers(profile.id);
      res.json({ followers: followers.map(f => ({
        id: f.profile.id,
        displayName: f.profile.displayName,
        slug: f.profile.slug,
        avatarUrl: f.profile.avatarUrl,
        headline: f.profile.headline,
      }))});
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Error fetching followers" });
    }
  });
  
  // Get who I'm following
  app.get("/api/me/following", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.json({ following: [] });
      }
      const following = await storage.getFollowing(profile.id);
      res.json({ following: following.map(f => ({
        id: f.profile.id,
        displayName: f.profile.displayName,
        slug: f.profile.slug,
        avatarUrl: f.profile.avatarUrl,
        headline: f.profile.headline,
      }))});
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Error fetching following" });
    }
  });
  
  // Like an ICE
  app.post("/api/ice/preview/:id/like", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "You need a creator profile to like ICEs" });
      }
      await storage.likeIce(profile.id, req.params.id);
      const likeCount = await storage.getIceLikeCount(req.params.id);
      res.json({ liked: true, likeCount });
    } catch (error) {
      console.error("Error liking ICE:", error);
      res.status(500).json({ message: "Error liking ICE" });
    }
  });
  
  // Unlike an ICE
  app.delete("/api/ice/preview/:id/like", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "You need a creator profile to unlike ICEs" });
      }
      await storage.unlikeIce(profile.id, req.params.id);
      const likeCount = await storage.getIceLikeCount(req.params.id);
      res.json({ liked: false, likeCount });
    } catch (error) {
      console.error("Error unliking ICE:", error);
      res.status(500).json({ message: "Error unliking ICE" });
    }
  });
  
  // Check if liked an ICE + get like count
  app.get("/api/ice/preview/:id/like", async (req, res) => {
    try {
      const likeCount = await storage.getIceLikeCount(req.params.id);
      let liked = false;
      if (req.user) {
        const profile = await storage.getCreatorProfile(req.user.id);
        if (profile) {
          liked = await storage.hasLikedIce(profile.id, req.params.id);
        }
      }
      res.json({ liked, likeCount });
    } catch (error) {
      console.error("Error checking ICE like status:", error);
      res.status(500).json({ message: "Error checking ICE like status" });
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
  
  // Update first-run tour state (partial update - doesn't require full profile)
  app.patch("/api/me/onboarding/tour", requireAuth, async (req, res) => {
    try {
      const { onboardingCompleted, onboardingDismissed, onboardingPath } = req.body;
      
      // Validate path if provided (ICE-first only; Orbit removed in v1)
      const validPaths = ['ice-first'];
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

  // ============ USAGE & QUOTA ENDPOINTS ============
  
  // Get current user's storage and AI usage summary
  app.get("/api/me/usage", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      // Get storage usage
      const usedStorageBytes = profile.usedStorageBytes ?? 0;
      const storageLimitBytes = profile.storageLimitBytes ?? 5368709120; // 5GB default

      // Get AI usage for current billing period (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const aiUsageSummary = await storage.getAiUsageSummary(profile.id, thirtyDaysAgo);

      // Get media asset counts
      const mediaAssets = await storage.getMediaAssetsByProfile(profile.id, 'active');
      const assetCounts = {
        images: mediaAssets.filter(a => a.category === 'image').length,
        videos: mediaAssets.filter(a => a.category === 'video').length,
        audio: mediaAssets.filter(a => a.category === 'audio').length,
        other: mediaAssets.filter(a => !['image', 'video', 'audio'].includes(a.category || '')).length,
      };

      res.json({
        storage: {
          usedBytes: usedStorageBytes,
          limitBytes: storageLimitBytes,
          usedPercent: Math.round((usedStorageBytes / storageLimitBytes) * 100),
          usedFormatted: formatBytes(usedStorageBytes),
          limitFormatted: formatBytes(storageLimitBytes),
        },
        assets: assetCounts,
        aiUsage: {
          totalCredits: aiUsageSummary.totalCredits,
          byType: aiUsageSummary.byType,
          billingPeriodStart: thirtyDaysAgo.toISOString(),
        },
      });
    } catch (error) {
      console.error("Error fetching usage summary:", error);
      res.status(500).json({ message: "Error fetching usage summary" });
    }
  });

  // Get usage details for a specific ICE
  app.get("/api/ice/:id/usage", requireAuth, async (req, res) => {
    try {
      const iceId = req.params.id;
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      // Verify user owns this ICE
      const ice = await storage.getIcePreview(iceId);
      if (!ice) {
        return res.status(404).json({ message: "ICE not found" });
      }
      if (ice.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get media assets for this ICE
      const mediaAssets = await storage.getMediaAssetsByIce(iceId);
      const totalStorageBytes = mediaAssets.reduce((sum, a) => sum + (a.fileSizeBytes ?? 0), 0);

      // Get AI usage for this ICE
      const aiUsage = await storage.getAiUsageByIce(iceId);
      const totalAiCredits = aiUsage.reduce((sum, e) => sum + e.creditsUsed, 0);

      // Group AI usage by type
      const aiByType = aiUsage.reduce((acc, e) => {
        if (!acc[e.usageType]) {
          acc[e.usageType] = { credits: 0, count: 0 };
        }
        acc[e.usageType].credits += e.creditsUsed;
        acc[e.usageType].count += 1;
        return acc;
      }, {} as Record<string, { credits: number; count: number }>);

      res.json({
        iceId,
        storage: {
          totalBytes: totalStorageBytes,
          formatted: formatBytes(totalStorageBytes),
          assetCount: mediaAssets.length,
          assets: mediaAssets.map(a => ({
            id: a.id,
            fileName: a.fileName,
            category: a.category,
            sizeBytes: a.fileSizeBytes,
            sizeFormatted: formatBytes(a.fileSizeBytes ?? 0),
            status: a.status,
            createdAt: a.createdAt,
          })),
        },
        aiUsage: {
          totalCredits: totalAiCredits,
          byType: Object.entries(aiByType).map(([type, data]) => ({
            usageType: type,
            ...data,
          })),
          events: aiUsage.slice(0, 50).map(e => ({
            id: e.id,
            usageType: e.usageType,
            creditsUsed: e.creditsUsed,
            model: e.model,
            createdAt: e.createdAt,
          })),
        },
      });
    } catch (error) {
      console.error("Error fetching ICE usage:", error);
      res.status(500).json({ message: "Error fetching ICE usage" });
    }
  });

  // Check storage quota before upload
  app.post("/api/me/storage/check", requireAuth, async (req, res) => {
    try {
      const { sizeBytes } = req.body;
      if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
        return res.status(400).json({ message: "Invalid file size" });
      }

      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      const usedBytes = profile.usedStorageBytes ?? 0;
      const limitBytes = profile.storageLimitBytes ?? 5368709120;
      const remainingBytes = limitBytes - usedBytes;

      const canUpload = sizeBytes <= remainingBytes;

      res.json({
        canUpload,
        usedBytes,
        limitBytes,
        remainingBytes,
        requestedBytes: sizeBytes,
        message: canUpload 
          ? "Storage quota available"
          : `Insufficient storage. Need ${formatBytes(sizeBytes)}, only ${formatBytes(remainingBytes)} available.`,
      });
    } catch (error) {
      console.error("Error checking storage quota:", error);
      res.status(500).json({ message: "Error checking storage quota" });
    }
  });

  // Get all user's media assets across all ICEs for cross-ICE reuse
  app.get("/api/me/media", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getCreatorProfile(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      // Get all active media assets for this user
      const mediaAssets = await storage.getMediaAssetsByProfile(profile.id, 'active');
      
      // Import the helper to construct public URLs from file keys
      const { getPublicUrlFromKey } = await import("./storage/objectStore");
      
      // Transform to client-friendly format with URLs
      const formattedAssets = mediaAssets.map(asset => ({
        id: asset.id,
        iceId: asset.iceId,
        url: getPublicUrlFromKey(asset.fileKey),
        fileKey: asset.fileKey,
        category: asset.category, // 'image' | 'video' | 'audio' | 'document' | 'other'
        sizeBytes: asset.sizeBytes,
        createdAt: asset.createdAt,
      }));

      res.json({
        assets: formattedAssets,
        total: formattedAssets.length,
      });
    } catch (error) {
      console.error("Error fetching user media:", error);
      res.status(500).json({ message: "Error fetching user media" });
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
  
  // ============ ICE CARD MESSAGE BOARD ROUTES (for text-based ICE card IDs) ============
  
  app.get("/api/ice/cards/:iceCardId/messages", async (req, res) => {
    try {
      const iceCardId = req.params.iceCardId;
      const messages = await storage.getIceCardMessages(iceCardId, 50);
      
      const messagesWithReactions = await Promise.all(messages.map(async (msg) => {
        const reactions = await storage.getIceCardMessageReactions(msg.id);
        const reactionCounts: Record<string, number> = {};
        for (const r of reactions) {
          reactionCounts[r.reactionType] = (reactionCounts[r.reactionType] || 0) + 1;
        }
        return { ...msg, reactions: reactionCounts, reactionCount: reactions.length };
      }));
      
      res.json(messagesWithReactions);
    } catch (error) {
      console.error("Error fetching ICE card messages:", error);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });
  
  app.post("/api/ice/cards/:iceCardId/messages", async (req, res) => {
    try {
      const iceCardId = req.params.iceCardId;
      const { displayName, body, icePreviewId } = req.body;
      
      if (!body || body.length === 0) {
        return res.status(400).json({ message: "Message body required" });
      }
      if (body.length > 280) {
        return res.status(400).json({ message: "Message too long (max 280 characters)" });
      }
      if (!displayName || displayName.length === 0) {
        return res.status(400).json({ message: "Display name required" });
      }
      if (!icePreviewId) {
        return res.status(400).json({ message: "ICE preview ID required" });
      }
      
      const message = await storage.createIceCardMessage({
        iceCardId,
        icePreviewId,
        userId: req.user?.id || null,
        displayName: displayName.slice(0, 50),
        body: body.slice(0, 280),
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error creating ICE card message:", error);
      res.status(500).json({ message: "Error creating message" });
    }
  });
  
  app.post("/api/ice/cards/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { reactionType, anonFingerprint } = req.body;
      
      if (!reactionType) {
        return res.status(400).json({ message: "Reaction type required" });
      }
      
      const reaction = await storage.addIceCardMessageReaction({
        messageId,
        userId: req.user?.id || null,
        anonFingerprint: req.user?.id ? null : anonFingerprint,
        reactionType,
      });
      
      res.json(reaction);
    } catch (error) {
      console.error("Error adding ICE reaction:", error);
      res.status(500).json({ message: "Error adding reaction" });
    }
  });
  
  app.delete("/api/ice/cards/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { anonFingerprint } = req.body;
      
      await storage.removeIceCardMessageReaction(
        messageId,
        req.user?.id || null,
        req.user?.id ? null : anonFingerprint
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing ICE reaction:", error);
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
      
      // Save with unique filename
      const filename = `card-${cardId}-${Date.now()}.png`;
      let generatedImageUrl: string;
      
      // Check if R2 is configured (production)
      const { isObjectStorageConfigured, putObject, deleteObject } = await import("./storage/objectStore");
      if (isObjectStorageConfigured()) {
        // Delete old generated image from R2 if it exists
        if (card.generatedImageUrl && card.generatedImageUrl.includes('r2.dev')) {
          try {
            const oldKey = card.generatedImageUrl.split('/').slice(-2).join('/');
            await deleteObject(`uploads/generated/${oldKey}`);
            console.log(`Deleted old image from R2: ${oldKey}`);
          } catch (e) {
            console.warn(`Could not delete old R2 image`);
          }
        }
        
        const key = `uploads/generated/${filename}`;
        generatedImageUrl = await putObject(key, imageBuffer, "image/png");
        console.log(`[Card] Saved image to R2: ${generatedImageUrl}`);
      } else {
        // Fallback to local filesystem (development)
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
        
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        generatedImageUrl = `/uploads/generated/${filename}`;
      }
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
            preferredMediaType: "video",
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
          preferredMediaType: "video",
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
      
      // Get ICE draft counts per user
      const iceCounts = await db
        .select({
          userId: schema.iceDrafts.userId,
          count: sql<number>`count(*)`,
        })
        .from(schema.iceDrafts)
        .groupBy(schema.iceDrafts.userId);
      
      const iceCountMap = new Map(iceCounts.map(i => [i.userId, Number(i.count)]));
      
      // Return users without password hash, with ICE counts and free pass info
      const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        iceCount: iceCountMap.get(u.id) || 0,
        freePassExpiresAt: u.freePassExpiresAt,
        hasFreePass: u.freePassExpiresAt && new Date(u.freePassExpiresAt) > new Date(),
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Grant or revoke free pass for a user
  app.post("/api/admin/users/:userId/free-pass", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { days } = req.body; // days: 1, 3, 7, or null to revoke
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let freePassExpiresAt: Date | null = null;
      
      if (days && typeof days === 'number' && days > 0) {
        freePassExpiresAt = new Date();
        freePassExpiresAt.setDate(freePassExpiresAt.getDate() + days);
      }
      
      // Update user's free pass
      await db.update(schema.users)
        .set({ freePassExpiresAt })
        .where(eq(schema.users.id, userId));
      
      const adminUser = req.user as any;
      console.log(`[admin] Free pass ${days ? `granted (${days} days)` : 'revoked'} for user ${userId} by admin ${adminUser?.username}`);
      
      res.json({
        success: true,
        freePassExpiresAt,
        message: days ? `Free pass granted for ${days} days` : 'Free pass revoked',
      });
    } catch (error) {
      console.error("Error updating free pass:", error);
      res.status(500).json({ message: "Error updating free pass" });
    }
  });

  // ============ API PROVIDERS STATUS ============
  
  // Get external API provider status for admin dashboard
  app.get("/api/admin/api-providers", requireAdmin, async (req, res) => {
    try {
      // Define all external API providers used in the app
      // IMPORTANT: Never expose actual API keys - only check if they exist
      const providers = [
        {
          id: 'openai',
          name: 'OpenAI',
          description: 'GPT-4, DALL-E, Whisper, TTS - core AI capabilities',
          envKey: 'OPENAI_API_KEY',
          altEnvKey: 'AI_INTEGRATIONS_OPENAI_API_KEY',
          category: 'ai' as const,
          dashboardUrl: 'https://platform.openai.com/usage',
          docsUrl: 'https://platform.openai.com/docs',
          usageInfo: {
            costPerUnit: '~$0.01/1K tokens (GPT-4o-mini)',
          },
        },
        {
          id: 'replicate',
          name: 'Replicate',
          description: 'Video generation models (Kling, Runway alternatives)',
          envKey: 'REPLICATE_API_TOKEN',
          category: 'ai' as const,
          dashboardUrl: 'https://replicate.com/account/billing',
          docsUrl: 'https://replicate.com/docs',
          usageInfo: {
            costPerUnit: 'Variable per model',
          },
        },
        {
          id: 'heygen',
          name: 'HeyGen',
          description: 'AI avatar video generation with realistic talking heads',
          envKey: 'HEYGEN_API_KEY',
          category: 'ai' as const,
          dashboardUrl: 'https://app.heygen.com/settings',
          docsUrl: 'https://docs.heygen.com/',
          usageInfo: {
            costPerUnit: '~$0.10/second of video',
          },
        },
        {
          id: 'elevenlabs',
          name: 'ElevenLabs',
          description: 'Premium text-to-speech voices',
          envKey: 'ELEVENLABS_API_KEY',
          category: 'ai' as const,
          dashboardUrl: 'https://elevenlabs.io/app/subscription',
          docsUrl: 'https://docs.elevenlabs.io/',
          usageInfo: {
            costPerUnit: '~$0.30/1K chars',
          },
        },
        {
          id: 'pexels',
          name: 'Pexels',
          description: 'Stock photos and videos',
          envKey: 'PEXELS_API_KEY',
          category: 'media' as const,
          dashboardUrl: 'https://www.pexels.com/api/new/',
          docsUrl: 'https://www.pexels.com/api/documentation/',
          usageInfo: {
            plan: 'Free tier (200 req/hr)',
          },
        },
        {
          id: 'stripe',
          name: 'Stripe',
          description: 'Payment processing and subscriptions',
          envKey: 'STRIPE_SECRET_KEY',
          category: 'payment' as const,
          dashboardUrl: 'https://dashboard.stripe.com/',
          docsUrl: 'https://stripe.com/docs',
        },
        {
          id: 'resend',
          name: 'Resend',
          description: 'Transactional email delivery',
          envKey: 'RESEND_API_KEY',
          category: 'email' as const,
          dashboardUrl: 'https://resend.com/emails',
          docsUrl: 'https://resend.com/docs',
          usageInfo: {
            plan: 'Free: 100 emails/day',
          },
        },
      ];

      // Check which providers are configured (key exists and is non-empty)
      const providerStatus = providers.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        configured: !!(process.env[p.envKey] || (p.altEnvKey && process.env[p.altEnvKey])),
        dashboardUrl: p.dashboardUrl,
        docsUrl: p.docsUrl,
        category: p.category,
        usageInfo: p.usageInfo,
      }));

      res.json({
        providers: providerStatus,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching API provider status:", error);
      res.status(500).json({ message: "Error fetching API provider status" });
    }
  });

  // ============ GUEST VIDEO (CAMEO) ROUTES ============
  
  // Generate guest cameo video using avatar provider
  app.post("/api/guest-video/generate", requireAuth, async (req, res) => {
    try {
      const { iceId, cardId } = req.body;
      
      if (!iceId || !cardId) {
        return res.status(400).json({ message: "iceId and cardId are required" });
      }
      
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const ice = await storage.getIcePreview(iceId);
      if (!ice) {
        return res.status(404).json({ message: "ICE not found" });
      }
      
      if (ice.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this ICE" });
      }
      
      const cards = ice.cards || [];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const card = cards[cardIndex];
      
      if (card.cardType !== 'guest') {
        return res.status(400).json({ message: "Card is not a guest card" });
      }
      
      if (!card.guestScript || card.guestScript.trim().length === 0) {
        return res.status(400).json({ message: "Guest script is required" });
      }
      
      const { getAvatarProvider } = await import('./avatar/providers');
      const provider = getAvatarProvider(card.guestProvider || 'heygen');
      
      if (!provider.isConfigured()) {
        return res.status(400).json({ 
          message: `${provider.name} is not configured. Please add the API key.` 
        });
      }
      
      const maxDurationSeconds = 10;
      
      const result = await provider.generateGuestVideo({
        script: card.guestScript,
        headshotUrl: card.guestHeadshotUrl,
        voiceId: card.guestVoiceId,
        audioUrl: card.guestAudioUrl,
        name: card.guestName,
        maxDurationSeconds,
      });
      
      if (result.status === 'failed') {
        cards[cardIndex] = {
          ...card,
          guestStatus: 'failed',
          guestError: result.error,
        };
        await storage.updateIcePreview(iceId, { cards });
        
        return res.status(500).json({ 
          message: result.error || 'Video generation failed',
          status: 'failed',
        });
      }
      
      cards[cardIndex] = {
        ...card,
        guestStatus: 'generating',
        guestProviderJobId: result.providerJobId,
        guestError: undefined,
      };
      await storage.updateIcePreview(iceId, { cards });
      
      console.log(`[guest-video] Started generation for card ${cardId}, job: ${result.providerJobId}`);
      
      res.json({
        status: 'generating',
        providerJobId: result.providerJobId,
        provider: provider.id,
      });
    } catch (error) {
      console.error("[guest-video] Generate error:", error);
      res.status(500).json({ message: "Error generating guest video" });
    }
  });
  
  // Check guest video generation status
  app.get("/api/guest-video/status", requireAuth, async (req, res) => {
    try {
      const { iceId, cardId } = req.query;
      
      if (!iceId || !cardId) {
        return res.status(400).json({ message: "iceId and cardId are required" });
      }
      
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const ice = await storage.getIcePreview(iceId as string);
      if (!ice) {
        return res.status(404).json({ message: "ICE not found" });
      }
      
      if (ice.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const cards = ice.cards || [];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const card = cards[cardIndex];
      
      if (card.cardType !== 'guest') {
        return res.status(400).json({ message: "Card is not a guest card" });
      }
      
      if (card.guestStatus === 'ready') {
        return res.json({
          status: 'ready',
          videoUrl: card.guestVideoUrl,
          durationSeconds: card.guestDurationSeconds,
        });
      }
      
      if (card.guestStatus === 'failed') {
        return res.json({
          status: 'failed',
          error: card.guestError,
        });
      }
      
      if (card.guestStatus === 'idle' || !card.guestProviderJobId) {
        return res.json({ status: 'idle' });
      }
      
      const { getAvatarProvider } = await import('./avatar/providers');
      const provider = getAvatarProvider(card.guestProvider || 'heygen');
      
      const result = await provider.getGuestVideoStatus(card.guestProviderJobId);
      
      if (result.status === 'completed' && result.videoUrl) {
        cards[cardIndex] = {
          ...card,
          guestStatus: 'ready',
          guestVideoUrl: result.videoUrl,
          guestDurationSeconds: result.durationSeconds,
          guestError: undefined,
        };
        await storage.updateIcePreview(iceId as string, { cards });
        
        console.log(`[guest-video] Completed for card ${cardId}: ${result.videoUrl}`);
        
        return res.json({
          status: 'ready',
          videoUrl: result.videoUrl,
          durationSeconds: result.durationSeconds,
        });
      }
      
      if (result.status === 'failed') {
        cards[cardIndex] = {
          ...card,
          guestStatus: 'failed',
          guestError: result.error,
        };
        await storage.updateIcePreview(iceId as string, { cards });
        
        return res.json({
          status: 'failed',
          error: result.error,
        });
      }
      
      res.json({
        status: 'generating',
        progress: result.progress,
      });
    } catch (error) {
      console.error("[guest-video] Status check error:", error);
      res.status(500).json({ message: "Error checking guest video status" });
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
      // Only allowed in development environment (Replit) to prevent production abuse
      // Render sets NODE_ENV=production so this won't trigger there
      const isReplitDev = process.env.NODE_ENV === 'development' && process.env.REPL_ID;
      if (devBypass === true && isReplitDev) {
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
      
      let stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>;
      try {
        stripe = await getUncachableStripeClient();
      } catch (stripeError: any) {
        console.error("[checkout] Stripe not configured:", stripeError.message);
        return res.status(503).json({
          message: "Payment processing is temporarily unavailable. Please try again later.",
          error: "STRIPE_NOT_CONFIGURED",
        });
      }
      
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
  
  // Check video providers configuration with plan-based gating
  app.get("/api/video/config", async (req, res) => {
    try {
      const { isReplicateConfigured } = await import("./video");
      const { getVideoEngineClientConfig } = await import("./config/videoEngines");
      
      // Determine user's plan tier based on entitlements (works for all user roles)
      let planTier: 'free' | 'pro' | 'business' | 'admin' = 'free';
      
      if (req.isAuthenticated() && req.user) {
        const user = req.user as schema.User;
        if (user.isAdmin || user.role === 'admin') {
          planTier = 'admin';
        } else {
          // Use entitlements for all authenticated users (not just creators)
          const entitlements = await getFullEntitlements(user.id);
          const planNameLower = entitlements.planName.toLowerCase();
          if (planNameLower.includes('business') || planNameLower.includes('enterprise') ||
              planNameLower === 'admin') {
            planTier = 'business';
          } else if (planNameLower.includes('pro') || planNameLower.includes('creator') ||
                     planNameLower.includes('premium')) {
            planTier = 'pro';
          } else if (entitlements.canGenerateVideos) {
            // If user has video generation but plan name doesn't match, default to pro
            planTier = 'pro';
          }
        }
      }
      
      const engineConfig = getVideoEngineClientConfig(planTier);
      
      res.json({
        configured: isReplicateConfigured(),
        providers: isReplicateConfigured() ? ['replicate'] : [],
        ...engineConfig,
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
              preferredMediaType: "video",
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
          preferredMediaType: "video",
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
  
  // Generic upload URL request for ICE preview media
  app.post("/api/uploads/request-url", requireAuth, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;
      
      if (!name || !size || !contentType) {
        return res.status(400).json({ message: "Missing required fields: name, size, contentType" });
      }
      
      // Validate file size (50MB limit)
      const MAX_SIZE = 50 * 1024 * 1024;
      if (size > MAX_SIZE) {
        return res.status(400).json({ message: "File too large. Maximum size is 50MB." });
      }
      
      // Check if R2 is configured
      const { isObjectStorageConfigured, getPresignedUploadUrl } = await import("./storage/objectStore");
      
      if (!isObjectStorageConfigured()) {
        return res.status(503).json({ message: "Object storage not configured" });
      }
      
      // Generate unique key for the upload
      const ext = name.split('.').pop() || 'bin';
      const key = `uploads/${req.user!.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { uploadURL, objectPath, publicUrl } = await getPresignedUploadUrl(key, contentType);
      
      res.json({
        uploadURL,
        objectPath,
        publicUrl,
      });
    } catch (error) {
      console.error("Error requesting upload URL:", error);
      res.status(500).json({ message: "Error generating upload URL" });
    }
  });
  
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
      
      // Get presigned upload URL from R2
      const { isObjectStorageConfigured, getPresignedUploadUrl } = await import("./storage/objectStore");
      
      if (!isObjectStorageConfigured()) {
        return res.status(503).json({ message: "Object storage not configured" });
      }
      
      const ext = name.split('.').pop() || 'bin';
      const key = `card-media/${cardId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { uploadURL, objectPath, publicUrl } = await getPresignedUploadUrl(key, contentType);
      
      res.json({
        uploadURL,
        objectPath,
        publicUrl,
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
  
  // Serve uploaded objects from Replit storage (legacy route - only works in Replit environment)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      if (!objectStorageService.isConfigured()) {
        return res.status(404).json({ message: "Legacy object storage not available" });
      }
      
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      // Download the file content from GCS
      const [content] = await objectFile.download();
      
      // Get metadata for content type
      const [metadata] = await objectFile.getMetadata();
      const contentType = metadata.contentType || "application/octet-stream";
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      res.send(content);
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
        
        storyCharacters = rawChars.slice(0, 4).map((c: any, idx: number) => ({
          id: c.id || `char_${Math.random().toString(36).slice(2, 6)}`,
          name: c.name || "Story Guide",
          role: c.role || "Narrator",
          description: c.description || "A guide to this story.",
          avatar: undefined,
          avatarEnabled: false,
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
          source: 'brief' as const, // AI-generated from content
          isPrimary: idx === 0, // First character is primary
        }));
      } catch (charError) {
        console.error("Error generating characters:", charError);
        // Fallback: create a default narrator character
        storyCharacters = [{
          id: "narrator",
          name: "Story Guide",
          role: "Narrator",
          description: "Your guide through this experience.",
          avatarEnabled: false,
          systemPrompt: `You are a knowledgeable narrator guiding someone through the story "${sourceTitle}".

STORY CARDS:
${cardsSummary}

Stay engaging, reference story details, and help the audience understand the narrative.`,
          openingMessage: "Welcome to this story. What would you like to explore?",
          source: 'system' as const, // Fallback character
          isPrimary: true,
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
  
  // Wizard-based ICE creation (from template blueprint)
  app.post("/api/ice/preview/wizard", async (req, res) => {
    try {
      const { blueprint, draft } = req.body;
      
      if (!blueprint || !draft) {
        return res.status(400).json({ message: "Blueprint and draft are required" });
      }
      
      // Validate blueprint structure
      if (!blueprint.templateFamily || !blueprint.structureId || !blueprint.length) {
        return res.status(400).json({ message: "Invalid blueprint: missing required fields" });
      }
      
      // Validate draft cards
      if (!draft.cards || !Array.isArray(draft.cards) || draft.cards.length === 0) {
        return res.status(400).json({ message: "Invalid draft: must have at least one card" });
      }
      
      // Limit card count
      if (draft.cards.length > 20) {
        return res.status(400).json({ message: "Too many cards (max 20)" });
      }
      
      // Sanitize card content (limit sizes)
      const sanitizedCards = draft.cards.slice(0, 20).map((card: any, i: number) => ({
        id: card.id || `card_${i}`,
        title: String(card.title || '').slice(0, 200),
        content: String(card.content || '').slice(0, 5000),
        order: i,
        sceneId: card.sceneId || `scene_${i}`,
      }));
      
      const sanitizedTitle = String(draft.title || 'New ICE').slice(0, 200);
      
      const userIp = req.ip || req.socket.remoteAddress || "unknown";
      
      // Rate limiting by IP
      const dailyCount = await storage.countIpIcePreviewsToday(userIp);
      if (dailyCount >= 50) {
        return res.status(429).json({ message: "Daily preview limit reached (50 per day)" });
      }
      
      // Generate unique preview ID
      const previewId = `ice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a default narrator character for wizard-created ICEs
      const defaultCharacter = {
        id: "guide",
        name: "Experience Guide",
        role: "Guide",
        description: "Your guide through this experience.",
        avatarEnabled: false,
        systemPrompt: `You are a helpful guide for this ${String(blueprint.templateFamily).slice(0, 50)} experience titled "${sanitizedTitle}".
Help users understand and explore the content in an engaging way.
Stay focused on the content and be helpful.`,
        openingMessage: `Welcome to ${sanitizedTitle}! I'm here to help you explore this experience. What would you like to know?`,
        source: 'system' as const, // Default wizard character
        isPrimary: true, // This is the main narrator
      };
      
      // Set expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // Save to database with sanitized values
      const savedPreview = await storage.createIcePreview({
        id: previewId,
        ownerIp: userIp,
        ownerUserId: req.user?.id || null,
        sourceType: "wizard" as any,
        sourceValue: JSON.stringify({
          templateFamily: String(blueprint.templateFamily).slice(0, 50),
          structureId: String(blueprint.structureId).slice(0, 50),
          length: String(blueprint.length).slice(0, 20),
          style: blueprint.style,
        }),
        title: sanitizedTitle,
        cards: sanitizedCards,
        characters: [defaultCharacter],
        tier: blueprint.length === "short" ? "short" : blueprint.length === "feature" ? "long" : "medium",
        status: "active",
        expiresAt,
      });
      
      res.json({
        previewId: savedPreview.id,
        title: savedPreview.title,
        cards: savedPreview.cards,
        characters: savedPreview.characters,
        sourceType: savedPreview.sourceType,
        createdAt: savedPreview.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Error creating wizard ICE:", error);
      res.status(500).json({ message: "Error creating ICE from wizard" });
    }
  });
  
  // Producer Brief Mode - Creates ICE from structured producer briefs with exact card counts
  app.post("/api/ice/preview/brief", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const { text: rawText, strictMode = true } = req.body;
      
      let contentText = "";
      
      if (file) {
        // Extract text from uploaded file
        const ext = file.originalname.toLowerCase().split('.').pop();
        if (ext === "txt" || ext === "md") {
          contentText = file.buffer.toString("utf-8");
        } else if (ext === "docx" || ext === "doc") {
          // Enhanced text extraction from docx that preserves table structure
          const AdmZip = (await import("adm-zip")).default;
          const zip = new AdmZip(file.buffer);
          const docXml = zip.getEntry("word/document.xml");
          if (docXml) {
            const xmlContent = docXml.getData().toString("utf-8");
            
            // Parse tables into markdown format to preserve structure
            let processedContent = xmlContent;
            
            // Extract and convert tables first
            const tablePattern = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/g;
            const tables: string[] = [];
            let tableMatch;
            
            while ((tableMatch = tablePattern.exec(xmlContent)) !== null) {
              const tableXml = tableMatch[0];
              const rows: string[] = [];
              
              // Extract each row
              const rowPattern = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
              let rowMatch;
              let isFirstRow = true;
              
              while ((rowMatch = rowPattern.exec(tableXml)) !== null) {
                const rowXml = rowMatch[0];
                const cells: string[] = [];
                
                // Extract each cell
                const cellPattern = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g;
                let cellMatch;
                
                while ((cellMatch = cellPattern.exec(rowXml)) !== null) {
                  // Get text from cell (extract <w:t> tags content)
                  const cellText = cellMatch[0]
                    .replace(/<w:t[^>]*>/g, '')
                    .replace(/<\/w:t>/g, ' ')
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                  cells.push(cellText);
                }
                
                if (cells.length > 0) {
                  rows.push('| ' + cells.join(' | ') + ' |');
                  
                  // Add separator after header row
                  if (isFirstRow && cells.length >= 2) {
                    rows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
                    isFirstRow = false;
                  }
                }
              }
              
              tables.push(rows.join('\n'));
            }
            
            // Remove tables from XML before general text extraction
            processedContent = processedContent.replace(/<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/g, '\n[TABLE_PLACEHOLDER]\n');
            
            // Extract paragraphs, preserving line breaks
            processedContent = processedContent
              .replace(/<w:p[^>]*>/g, '\n')
              .replace(/<\/w:p>/g, '')
              .replace(/<w:t[^>]*>/g, '')
              .replace(/<\/w:t>/g, '')
              .replace(/<[^>]+>/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            
            // Reinsert tables
            let tableIndex = 0;
            contentText = processedContent.replace(/\[TABLE_PLACEHOLDER\]/g, () => {
              return '\n\n' + (tables[tableIndex++] || '') + '\n\n';
            });
            
            console.log('[brief-parser] Extracted DOCX content length:', contentText.length);
            console.log('[brief-parser] Found', tables.length, 'tables');
          } else {
            return res.status(400).json({ message: "Could not read document content" });
          }
        } else {
          return res.status(400).json({ message: "Unsupported file type. Use .docx, .txt, or .md files." });
        }
      } else if (rawText) {
        contentText = rawText;
      } else {
        return res.status(400).json({ message: "No brief content provided. Upload a file or provide text." });
      }
      
      if (contentText.length < 200) {
        return res.status(400).json({ message: "Brief content too short. Producer briefs require detailed specifications." });
      }
      
      const userIp = req.ip || req.socket.remoteAddress || "unknown";
      
      // Rate limiting
      const dailyCount = await storage.countIpIcePreviewsToday(userIp);
      if (dailyCount >= 50) {
        return res.status(429).json({ message: "Daily preview limit reached (50 per day)" });
      }
      
      // Parse the producer brief
      const { parseProducerBrief } = await import("./services/briefParser");
      const parsedResult = parseProducerBrief(contentText);
      
      if (parsedResult.parseErrors.length > 0) {
        return res.status(400).json({ 
          message: "Error parsing producer brief", 
          errors: parsedResult.parseErrors,
          warnings: parsedResult.parseWarnings,
        });
      }
      
      const brief = parsedResult.brief;
      
      if (brief.stages.length === 0) {
        return res.status(400).json({ 
          message: "No stages found in producer brief. Ensure your brief has Stage 1, Stage 2, etc. sections with card tables." 
        });
      }
      
      if (brief.totalCardCount === 0) {
        return res.status(400).json({ 
          message: "No cards found in producer brief. Ensure each stage has a table with Card | Content | Visual columns." 
        });
      }
      
      // Build cards array from brief stages (STRICT: exact card count from brief)
      const previewCards: any[] = [];
      const interactivityNodes: any[] = [];
      let globalCardIndex = 0;
      
      for (const stage of brief.stages) {
        const stageStartCardIndex = globalCardIndex;
        
        for (const card of stage.cards) {
          previewCards.push({
            id: `card_${globalCardIndex}`,
            stageNumber: stage.stageNumber,
            stageName: stage.stageName,
            cardId: card.cardId,
            title: card.cardId,
            content: card.content,
            visualPrompt: card.visualPrompt,
            videoPrompt: card.videoPrompt,
            order: globalCardIndex,
            sceneId: `stage_${stage.stageNumber}`,
            isCheckpoint: false,
          });
          globalCardIndex++;
        }
        
        // Add AI checkpoint interactivity node at end of stage
        if (stage.hasAiCheckpoint && previewCards.length > 0) {
          const lastCardInStage = previewCards[previewCards.length - 1];
          lastCardInStage.isCheckpoint = true;
          lastCardInStage.checkpointDescription = stage.checkpointDescription;
          lastCardInStage.characterId = brief.aiCharacter?.name.toLowerCase().replace(/[^a-z0-9]/g, "_") || "guide";
          
          // Create interactivity node for this checkpoint
          // Frontend expects: afterCardIndex (number), isActive (boolean), selectedCharacterId (string)
          const lastCardIndex = globalCardIndex - 1; // globalCardIndex was incremented after adding the card
          interactivityNodes.push({
            id: `checkpoint_stage_${stage.stageNumber}`,
            afterCardIndex: lastCardIndex,
            isActive: true,
            selectedCharacterId: lastCardInStage.characterId,
            type: "ai_chat",
            stageNumber: stage.stageNumber,
            stageName: stage.stageName,
            description: stage.checkpointDescription || `Chat with your guide about ${stage.stageName}`,
            stageContext: brief.aiCharacter?.stageContexts.find(sc => sc.stageNumber === stage.stageNumber)?.contextAddition,
          });
        }
      }
      
      // Build AI character from brief (auto-create with full personality/prompts)
      const characters: any[] = [];
      
      if (brief.aiCharacter) {
        const char = brief.aiCharacter;
        
        // Build comprehensive system prompt
        let systemPrompt = char.systemPrompt;
        
        // Add behaviour rules
        if (char.behaviourRules.length > 0) {
          systemPrompt += "\n\nBEHAVIOUR RULES:\n" + char.behaviourRules.map(r => `- ${r}`).join("\n");
        }
        
        // Add example interactions as few-shot examples
        if (char.exampleInteractions.length > 0) {
          systemPrompt += "\n\nEXAMPLE INTERACTIONS:";
          for (const ex of char.exampleInteractions) {
            systemPrompt += `\n\nUser: ${ex.userMessage}\n${char.name}: ${ex.characterResponse}`;
          }
        }
        
        // Create base character from brief - this is the PRIMARY character
        characters.push({
          id: char.name.toLowerCase().replace(/[^a-z0-9]/g, "_") || "character",
          name: char.name,
          role: char.expertiseLevel || "Guide",
          description: char.personality,
          systemPrompt,
          openingMessage: `Hi! I'm ${char.name}. I'm here to help you through this experience. What would you like to know?`,
          stageContexts: char.stageContexts, // Pass stage-specific context
          source: 'brief' as const, // Character came from producer brief
          isPrimary: true, // Primary narrator character
        });
      } else {
        // Fallback character
        characters.push({
          id: "guide",
          name: "Experience Guide",
          role: "Guide",
          description: "Your guide through this experience.",
          systemPrompt: `You are a helpful guide for "${brief.title}". Help users understand and explore the content.`,
          openingMessage: `Welcome to ${brief.title}! I'm here to help you. What would you like to know?`,
          source: 'system' as const, // System-generated fallback
          isPrimary: true,
        });
      }
      
      // Generate preview ID
      const previewId = `ice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      // Set expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry for brief-created ICEs
      
      // Determine tier based on card count
      let tier: "short" | "medium" | "long" = "short";
      if (brief.totalCardCount > 15) tier = "long";
      else if (brief.totalCardCount > 8) tier = "medium";
      
      // Build projectBible with sceneLock from brief if provided
      let projectBible: any = undefined;
      if (brief.sceneLock) {
        projectBible = {
          versionId: `bible_${Date.now()}`,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sceneLock: {
            enabled: brief.sceneLock.enabled !== false,
            lockedScene: {
              sceneName: brief.sceneLock.sceneName || 'Default Scene',
              setDescription: brief.sceneLock.setDescription,
              cameraAngle: brief.sceneLock.cameraAngle,
              framingNotes: brief.sceneLock.framingNotes,
              lightingNotes: brief.sceneLock.lightingNotes,
            },
            lockFlags: {
              environment: true,
              camera: true,
              lighting: true,
              elements: false, // Allow per-card element variations
            },
          },
          characters: characters.map(c => ({
            id: c.id,
            name: c.name,
            role: c.role,
            description: c.description,
            isPrimary: c.isPrimary,
          })),
          visualDirection: brief.visualDirection,
        };
      }
      
      // Save to database
      const savedPreview = await storage.createIcePreview({
        id: previewId,
        ownerIp: userIp,
        ownerUserId: req.user?.id || null,
        sourceType: "brief" as any,
        sourceValue: JSON.stringify({
          title: brief.title,
          format: brief.format,
          totalCards: brief.totalCardCount,
          stages: brief.stages.length,
          hasAiCharacter: !!brief.aiCharacter,
          strictMode: strictMode,
          interactivityNodes,
        }),
        contentContext: {
          visualDirection: brief.visualDirection,
          targetAudience: brief.targetAudience,
          estimatedDuration: brief.estimatedDuration,
          interactivityNodes,
        } as any,
        projectBible,
        title: brief.title,
        cards: previewCards,
        characters,
        interactivityNodes, // Store nodes directly in the preview record
        tier,
        status: "active",
        expiresAt,
      });
      
      res.json({
        previewId: savedPreview.id,
        title: savedPreview.title,
        totalCards: previewCards.length,
        stages: brief.stages.length,
        cards: savedPreview.cards,
        characters: savedPreview.characters,
        interactivityNodes,
        sourceType: "brief",
        strictMode,
        parseWarnings: parsedResult.parseWarnings,
        briefSummary: {
          title: brief.title,
          format: brief.format,
          targetAudience: brief.targetAudience,
          stageBreakdown: brief.stages.map(s => ({
            stage: s.stageNumber,
            name: s.stageName,
            cardCount: s.cards.length,
            hasCheckpoint: s.hasAiCheckpoint,
          })),
          aiCharacter: brief.aiCharacter ? {
            name: brief.aiCharacter.name,
            personality: brief.aiCharacter.personality,
            stageContextCount: brief.aiCharacter.stageContexts.length,
          } : null,
        },
        createdAt: savedPreview.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Error creating ICE from producer brief:", error);
      res.status(500).json({ message: "Error processing producer brief" });
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
        
        storyCharacters = rawChars.slice(0, 4).map((c: any, idx: number) => ({
          id: c.id || `char_${Math.random().toString(36).slice(2, 6)}`,
          name: c.name || "Story Guide",
          role: c.role || "Narrator",
          description: c.description || "A guide to this story.",
          avatar: undefined,
          avatarEnabled: false,
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
          source: 'brief' as const, // AI-generated from file content
          isPrimary: idx === 0, // First character is primary
        }));
      } catch (charError) {
        console.error("Error generating characters:", charError);
        storyCharacters = [{
          id: "narrator",
          name: "Story Guide",
          role: "Narrator",
          description: "Your guide through this experience.",
          avatarEnabled: false,
          systemPrompt: `You are a knowledgeable narrator guiding someone through the story "${sourceTitle}".

STORY CARDS:
${cardsSummary}

Stay engaging, reference story details, and help the audience understand the narrative.`,
          openingMessage: "Welcome to this story. What would you like to explore?",
          source: 'system' as const, // Fallback character
          isPrimary: true,
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
  
  // Public discovery endpoint - list public ICEs for gallery
  app.get("/api/ice/discover", async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 20, 50));
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      
      const publicIces = await storage.getPublicIcePreviews(limit, offset);
      
      res.json({
        ices: publicIces.map(ice => ({
          id: ice.id,
          title: ice.title,
          shareSlug: ice.shareSlug,
          thumbnailUrl: (ice.cards as any[])?.[0]?.imageUrl || null,
          cardCount: (ice.cards as any[])?.length || 0,
          publishedAt: ice.publishedAt?.toISOString() || ice.createdAt.toISOString(),
        })),
        hasMore: publicIces.length === limit,
      });
    } catch (error) {
      console.error("Error fetching public ICEs:", error);
      res.status(500).json({ message: "Error fetching public ICEs" });
    }
  });
  
  // Get user's leads from their ICEs
  app.get("/api/ice/my-leads", requireAuth, async (req, res) => {
    try {
      const user = req.user as schema.User;
      const leads = await storage.getLeadsByUser(user.id);
      
      res.json({
        leads: leads.map(l => ({
          id: l.id,
          iceId: l.iceId,
          email: l.email,
          name: l.name,
          iceTitle: l.iceTitle,
          createdAt: l.createdAt.toISOString(),
        })),
        totalCount: leads.length,
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Error fetching leads" });
    }
  });
  
  // ICE Analytics - summary
  app.get("/api/ice/analytics/summary", requireAuth, async (req, res) => {
    try {
      const user = req.user as schema.User;
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      
      const summary = await storage.getIceAnalyticsSummary(user.id, days);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ message: "Error fetching analytics" });
    }
  });
  
  // ICE Analytics - by ICE
  app.get("/api/ice/analytics/by-ice", requireAuth, async (req, res) => {
    try {
      const user = req.user as schema.User;
      
      const analytics = await storage.getIceAnalyticsByIce(user.id);
      res.json(analytics.map(a => ({
        ...a,
        publishedAt: a.publishedAt?.toISOString() || null,
      })));
    } catch (error) {
      console.error("Error fetching analytics by ICE:", error);
      res.status(500).json({ message: "Error fetching analytics" });
    }
  });
  
  // Conversation Insights - get or generate insights for an ICE (Business tier only)
  app.get("/api/ice/:iceId/conversation-insights", requireAuth, async (req, res) => {
    try {
      const user = req.user as schema.User;
      const { iceId } = req.params;
      
      // Check entitlements
      const { getFullEntitlements } = await import('./entitlements');
      const entitlements = await getFullEntitlements(user.id);
      
      if (!entitlements.canViewConversationInsights) {
        return res.status(403).json({ 
          message: "Conversation insights require a Business tier subscription",
          upgradeRequired: true 
        });
      }
      
      // Verify ownership
      const preview = await storage.getIcePreview(iceId);
      if (!preview || preview.userId !== user.id) {
        return res.status(404).json({ message: "ICE not found" });
      }
      
      // Check for valid cached insights
      const cachedInsights = await storage.getConversationInsights(iceId);
      if (cachedInsights && new Date(cachedInsights.validUntil) > new Date()) {
        return res.json({
          ...cachedInsights,
          generatedAt: cachedInsights.generatedAt.toISOString(),
          validUntil: cachedInsights.validUntil.toISOString(),
          cached: true
        });
      }
      
      // Fetch chat messages for this ICE
      const messages = await storage.getPreviewChatMessages(iceId, 500);
      
      if (messages.length < 5) {
        return res.json({ 
          hasData: false,
          message: "Not enough conversation data yet. Insights require at least 5 chat messages.",
          messageCount: messages.length,
          summary: null,
          topTopics: [],
          commonQuestions: [],
          sentimentScore: null,
          engagementInsights: null,
          actionableRecommendations: [],
          conversationCount: 0,
          generatedAt: null,
          validUntil: null,
          cached: false
        });
      }
      
      // Group messages into conversations (by gaps of >30min)
      const conversations: Array<Array<{role: string; content: string}>> = [];
      let currentConvo: Array<{role: string; content: string}> = [];
      let lastTime: Date | null = null;
      
      for (const msg of messages) {
        const msgTime = new Date(msg.createdAt);
        if (lastTime && (msgTime.getTime() - lastTime.getTime()) > 30 * 60 * 1000) {
          if (currentConvo.length > 0) conversations.push(currentConvo);
          currentConvo = [];
        }
        currentConvo.push({ role: msg.role, content: msg.content });
        lastTime = msgTime;
      }
      if (currentConvo.length > 0) conversations.push(currentConvo);
      
      // Generate insights via shared OpenAI client
      const prompt = `Analyze these conversation transcripts from an interactive learning experience. Generate insights for the content creator.

Conversations:
${conversations.map((c, i) => `--- Conversation ${i + 1} ---\n${c.map(m => `${m.role}: ${m.content}`).join('\n')}`).join('\n\n')}

Provide a JSON response with:
{
  "summary": "2-3 sentence overall summary of what learners are asking about and engaging with",
  "topTopics": ["array of 3-5 most discussed topics"],
  "commonQuestions": ["array of 3-5 frequently asked questions from users"],
  "sentimentScore": number from -100 (very negative) to 100 (very positive),
  "engagementInsights": "paragraph about engagement patterns and learning behaviors observed",
  "actionableRecommendations": ["array of 3-5 specific suggestions for improving the content"]
}`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });
      
      const insightsData = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Cache insights for 24 hours
      const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const newInsights = await storage.upsertConversationInsights({
        icePreviewId: iceId,
        summary: insightsData.summary || 'No summary available',
        topTopics: insightsData.topTopics || [],
        commonQuestions: insightsData.commonQuestions || [],
        sentimentScore: insightsData.sentimentScore || 0,
        engagementInsights: insightsData.engagementInsights || null,
        actionableRecommendations: insightsData.actionableRecommendations || [],
        conversationCount: conversations.length,
        messageCount: messages.length,
        generatedAt: new Date(),
        validUntil
      });
      
      res.json({
        ...newInsights,
        generatedAt: newInsights.generatedAt.toISOString(),
        validUntil: newInsights.validUntil.toISOString(),
        cached: false
      });
    } catch (error) {
      console.error("Error generating conversation insights:", error);
      res.status(500).json({ message: "Error generating insights" });
    }
  });
  
  // Pexels API proxy (to protect API key) - requires auth to prevent abuse
  app.get("/api/pexels/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.query as string;
      const type = (req.query.type as string) || "photos";
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.per_page as string) || 15, 30);
      
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }
      
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Pexels API key not configured" });
      }
      
      const baseUrl = type === "videos" 
        ? "https://api.pexels.com/videos/search"
        : "https://api.pexels.com/v1/search";
      
      const response = await fetch(
        `${baseUrl}?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: apiKey,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Pexels API error: ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error searching Pexels:", error);
      res.status(500).json({ message: "Error searching Pexels" });
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
        shareSlug: preview.shareSlug,
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
        // Logo branding settings
        logoEnabled: preview.logoEnabled,
        logoUrl: preview.logoUrl,
        logoPosition: preview.logoPosition,
        adminCtaEnabled: preview.adminCtaEnabled,
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
      
      // Get avatar settings from request
      const { avatar, avatarEnabled } = req.body;
      
      // Create new character - marked as custom (user-created)
      const newCharacter: schema.IcePreviewCharacter = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        role: (role || "AI Assistant").trim(),
        description: `Custom character: ${name}`,
        systemPrompt: finalSystemPrompt,
        openingMessage: openingMessage || `Hello! I'm ${name}. How can I help you today?`,
        avatar: avatar || undefined,
        avatarEnabled: avatarEnabled === true,
        source: 'custom', // User-created character
        isPrimary: false, // Custom characters are not primary by default
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
  
  // ICE Preview - Update existing character
  app.patch("/api/ice/preview/:id/characters/:characterId", async (req, res) => {
    try {
      const { id: previewId, characterId } = req.params;
      const { name, role, openingMessage, systemPrompt, knowledgeContext, avatar, avatarEnabled } = req.body;
      
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
      
      const existingCharacters = (preview.characters || []) as schema.IcePreviewCharacter[];
      const charIndex = existingCharacters.findIndex(c => c.id === characterId);
      
      if (charIndex === -1) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Build the system prompt
      let finalSystemPrompt = "";
      if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
        finalSystemPrompt = systemPrompt.trim();
      } else {
        finalSystemPrompt = `You are ${name}, ${role || "an AI assistant"}. You are helpful, friendly, and knowledgeable about the content in this experience. Answer questions naturally and stay in character.`;
      }
      
      if (knowledgeContext && typeof knowledgeContext === "string" && knowledgeContext.trim()) {
        finalSystemPrompt += `\n\n## KNOWLEDGE BASE\nUse the following information to inform your responses:\n\n${knowledgeContext.trim()}`;
      }
      
      // Update the character
      const updatedCharacter: schema.IcePreviewCharacter = {
        ...existingCharacters[charIndex],
        name: name.trim(),
        role: (role || "AI Assistant").trim(),
        description: `Custom character: ${name}`,
        systemPrompt: finalSystemPrompt,
        openingMessage: openingMessage || `Hello! I'm ${name}. How can I help you today?`,
        avatar: avatar || existingCharacters[charIndex].avatar,
        avatarEnabled: avatarEnabled === true,
      };
      
      existingCharacters[charIndex] = updatedCharacter;
      
      // Update the preview
      await storage.updateIcePreview(previewId, { characters: existingCharacters });
      
      res.json({ 
        success: true, 
        character: updatedCharacter,
      });
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(500).json({ message: "Error updating character" });
    }
  });
  
  // ICE Preview - Upload character avatar
  app.post("/api/ice/preview/:id/character-avatar", upload.single("avatar"), async (req, res) => {
    try {
      const previewId = req.params.id;
      
      if (!req.file) {
        return res.status(400).json({ message: "No avatar file uploaded" });
      }
      
      // Validate file type
      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type. Only PNG, JPEG, and WebP are allowed." });
      }
      
      // Validate file size (2MB max)
      const maxSize = 2 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "File too large. Maximum size is 2MB." });
      }
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check expiry
      if (preview.expiresAt < new Date() && preview.status !== "promoted") {
        return res.status(410).json({ message: "Preview has expired" });
      }
      
      try {
        // Upload to R2 object storage
        const { isObjectStorageConfigured, putObject } = await import("./storage/objectStore");
        
        if (isObjectStorageConfigured()) {
          const ext = req.file.mimetype.split("/")[1] || "png";
          const key = `character-avatars/${previewId}/${Date.now()}.${ext}`;
          const avatarUrl = await putObject(key, req.file.buffer, req.file.mimetype);
          
          res.json({
            success: true,
            url: avatarUrl,
          });
        } else {
          // Fallback: Save to local filesystem
          const avatarDir = path.join(process.cwd(), "uploads", "avatars");
          if (!fs.existsSync(avatarDir)) {
            fs.mkdirSync(avatarDir, { recursive: true });
          }
          
          const ext = req.file.mimetype.split("/")[1] || "png";
          const filename = `char-${previewId}-${Date.now()}.${ext}`;
          const filePath = path.join(avatarDir, filename);
          fs.writeFileSync(filePath, req.file.buffer);
          
          const localUrl = `/uploads/avatars/${filename}`;
          
          res.json({
            success: true,
            url: localUrl,
          });
        }
      } catch (storageError) {
        console.error("Object storage upload failed:", storageError);
        
        // Fallback: Save to local filesystem
        const avatarDir = path.join(process.cwd(), "uploads", "avatars");
        if (!fs.existsSync(avatarDir)) {
          fs.mkdirSync(avatarDir, { recursive: true });
        }
        
        const ext = req.file.mimetype.split("/")[1] || "png";
        const filename = `char-${previewId}-${Date.now()}.${ext}`;
        const filePath = path.join(avatarDir, filename);
        fs.writeFileSync(filePath, req.file.buffer);
        
        const localUrl = `/uploads/avatars/${filename}`;
        
        res.json({
          success: true,
          url: localUrl,
        });
      }
    } catch (error) {
      console.error("Error uploading character avatar:", error);
      res.status(500).json({ message: "Error uploading avatar" });
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
          avatarEnabled: false,
          systemPrompt: `You are a knowledgeable narrator guiding someone through the story "${preview.title}".

STORY CARDS:
${cardsSummary}

Stay engaging, reference story details, and help the audience understand the narrative.`,
          openingMessage: "Welcome to this story. What would you like to explore?",
          source: 'system' as const,
          isPrimary: true,
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
          // Producer Brief prompts - must persist across edits
          visualPrompt: card.visualPrompt || existingCard.visualPrompt || undefined,
          videoPrompt: card.videoPrompt || existingCard.videoPrompt || undefined,
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
  
  // Generate image for an ICE preview card (requires auth + entitlements + daily cap)
  app.post("/api/ice/preview/:previewId/cards/:cardId/generate-image", requireAuth, dailyCapMiddleware('image'), async (req, res) => {
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
        const imageBuffer = Buffer.from(base64Image, "base64");
        const filename = `ice-${previewId}-${cardId}-${Date.now()}.png`;
        
        // Check if R2 is configured (production)
        const { isObjectStorageConfigured, putObject } = await import("./storage/objectStore");
        if (isObjectStorageConfigured()) {
          const key = `uploads/ice-generated/${filename}`;
          finalImageUrl = await putObject(key, imageBuffer, "image/png");
          console.log(`[ICE] Saved image to R2: ${finalImageUrl}`);
        } else {
          // Fallback to local filesystem (development)
          const uploadsDir = path.join(process.cwd(), "uploads", "ice-generated");
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const filepath = path.join(uploadsDir, filename);
          fs.writeFileSync(filepath, imageBuffer);
          finalImageUrl = `/uploads/ice-generated/${filename}`;
        }
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
      
      // Log AI usage for billing tracking
      try {
        const profile = await storage.getCreatorProfile(user.id);
        if (profile) {
          await storage.logAiUsageEvent({
            profileId: profile.id,
            iceId: previewId,
            usageType: 'image_gen',
            creditsUsed: 0.04, // ~$0.04 per 1024x1536 image
            model: 'gpt-image-1',
            metadata: { cardId, size: '1024x1536' },
          });
        }
      } catch (aiLogError) {
        console.warn('Failed to log AI usage:', aiLogError);
      }
      
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
  
  // AI-powered video prompt suggestions for multi-segment timelines
  // Simple in-memory cache for suggestions (keyed by hash of inputs)
  const clipSuggestionCache = new Map<string, { suggestions: any[]; timestamp: number }>();
  const SUGGESTION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  app.post("/api/ice/preview/:previewId/cards/:cardId/suggest-next-clip", async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      const { 
        cardTitle, 
        cardNarration, 
        currentSegmentIndex, 
        totalSegmentsPlanned, 
        priorPrompts,
        sceneLockDescription,
        visualBibleStyle
      } = req.body;
      
      // Validate required fields
      if (!cardTitle || !cardNarration || currentSegmentIndex === undefined || !totalSegmentsPlanned) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Create cache key from input hash
      const cacheKey = `${previewId}-${cardId}-${currentSegmentIndex}-${
        Buffer.from(cardNarration.slice(0, 200) + (priorPrompts || []).join('')).toString('base64').slice(0, 32)
      }`;
      
      // Check cache
      const cached = clipSuggestionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < SUGGESTION_CACHE_TTL) {
        console.log(`[ClipSuggestions] Cache hit for ${cacheKey}`);
        return res.json({ suggestions: cached.suggestions, cached: true });
      }
      
      // Determine story arc phase based on segment position
      const progress = (currentSegmentIndex + 1) / totalSegmentsPlanned;
      let arcPhase: 'setup' | 'build' | 'peak' | 'resolve';
      let phaseGuidance: string;
      
      if (progress <= 0.25) {
        arcPhase = 'setup';
        phaseGuidance = 'Set the scene, introduce the subject, establish mood and context';
      } else if (progress <= 0.5) {
        arcPhase = 'build';
        phaseGuidance = 'Build tension or interest, show progression, add visual energy';
      } else if (progress <= 0.75) {
        arcPhase = 'peak';
        phaseGuidance = 'Reach the climax, show the key moment, maximum visual impact';
      } else {
        arcPhase = 'resolve';
        phaseGuidance = 'Conclude the visual narrative, call to action, memorable ending';
      }
      
      // Build prompt for OpenAI
      const systemPrompt = `You are a creative director helping to plan video clips for a story card. 
The user is building a multi-clip timeline where each clip is about 5 seconds.
Your job is to suggest the next video prompt that:
1. Fits the narrative context (title and narration)
2. Maintains visual continuity with previous clips
3. Follows proper story pacing for this phase: ${arcPhase} - ${phaseGuidance}
4. Creates compelling, cinematic visuals

IMPORTANT: Suggest prompts for VIDEO generation - describe motion, camera movement, atmosphere. 
Do NOT include any text, titles, captions, or typography in your suggestions.

Respond with a JSON array of 2-3 suggestions, each with:
- prompt: The video generation prompt (50-150 words, cinematic and detailed)
- rationale: Brief 1-sentence explanation of why this fits the narrative
- continuityHints: Array of 2-3 visual elements to maintain from prior clips

Example format:
[
  {
    "prompt": "Cinematic tracking shot through a modern office...",
    "rationale": "Opens with establishing context before focusing on the main subject",
    "continuityHints": ["professional lighting", "corporate color palette", "steady camera movement"]
  }
]`;

      const userPrompt = `Card Title: "${cardTitle}"
Narration Script: "${cardNarration}"

This is clip ${currentSegmentIndex + 1} of ${totalSegmentsPlanned} (${arcPhase} phase).

${priorPrompts?.length ? `Previous clip prompts:\n${priorPrompts.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}` : 'This is the first clip.'}

${sceneLockDescription ? `Scene context: ${sceneLockDescription}` : ''}
${visualBibleStyle ? `Visual style: ${visualBibleStyle}` : ''}

Suggest 2-3 video prompts for the next clip that continue the visual narrative.`;

      // Call OpenAI
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      });
      
      const responseText = completion.choices[0]?.message?.content || '[]';
      
      // Parse suggestions from response
      let suggestions: any[] = [];
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.warn('[ClipSuggestions] Failed to parse AI response:', parseError);
        suggestions = [{
          id: `suggestion-fallback-${Date.now()}`,
          prompt: `Cinematic scene depicting "${cardTitle}". Smooth camera movement, professional lighting, atmospheric depth.`,
          rationale: 'Default suggestion based on card title',
          arcPhase,
          continuityHints: ['consistent lighting', 'smooth transitions']
        }];
      }
      
      // Add IDs and arc phase to each suggestion
      suggestions = suggestions.map((s: any, i: number) => ({
        id: `suggestion-${Date.now()}-${i}`,
        prompt: s.prompt || '',
        rationale: s.rationale || '',
        arcPhase,
        continuityHints: s.continuityHints || []
      }));
      
      // Cache the result
      clipSuggestionCache.set(cacheKey, { suggestions, timestamp: Date.now() });
      
      // Clean old cache entries periodically
      if (clipSuggestionCache.size > 100) {
        const now = Date.now();
        const keysToDelete: string[] = [];
        clipSuggestionCache.forEach((value, key) => {
          if (now - value.timestamp > SUGGESTION_CACHE_TTL) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => clipSuggestionCache.delete(key));
      }
      
      console.log(`[ClipSuggestions] Generated ${suggestions.length} suggestions for ${previewId}/${cardId} segment ${currentSegmentIndex}`);
      
      res.json({ suggestions, cached: false });
    } catch (error) {
      console.error("Error generating clip suggestions:", error);
      res.status(500).json({ message: "Error generating suggestions" });
    }
  });
  
  // Generate video for an ICE preview card (requires auth + entitlements + daily cap)
  app.post("/api/ice/preview/:previewId/cards/:cardId/generate-video", requireAuth, dailyCapMiddleware('video'), async (req, res) => {
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
      const { model, duration, engine } = req.body;
      const basePrompt = prompt || `Cinematic scene: ${card.title}. ${card.content}`;
      // Enhance prompt to ensure no text is rendered in the video
      const videoPrompt = `${basePrompt}. IMPORTANT: Do not include any text, words, letters, titles, captions, watermarks, or typography in this video. Pure visual imagery only.`;
      
      // Import video generation functions and gating
      const { isReplicateConfigured, startReplicateVideoAsync } = await import("./video");
      const { validateVideoRequest } = await import("./config/videoEngines");
      
      if (!isReplicateConfigured()) {
        return res.status(503).json({ message: "Video generation not configured" });
      }
      
      // Determine user's plan tier for video model gating (consistent with /api/video/config)
      let planTier: 'free' | 'pro' | 'business' | 'admin' = 'free';
      if (user.isAdmin || user.role === 'admin') {
        planTier = 'admin';
      } else {
        const planNameLower = entitlements.planName.toLowerCase();
        if (planNameLower.includes('business') || planNameLower.includes('enterprise') ||
            planNameLower === 'admin') {
          planTier = 'business';
        } else if (planNameLower.includes('pro') || planNameLower.includes('creator') ||
                   planNameLower.includes('premium')) {
          planTier = 'pro';
        } else if (entitlements.canGenerateVideos) {
          // If user has video generation but plan name doesn't match, default to pro
          planTier = 'pro';
        }
      }
      
      // Validate and resolve video model based on plan
      const gatingResult = validateVideoRequest(planTier, engine, model, duration, mode);
      
      if (!gatingResult.allowed) {
        console.log(`[Video Gating] Denied: user=${user.id}, planTier=${planTier}, requestedModel=${model}, requestedEngine=${engine}, reason=${gatingResult.reason}`);
        // Use 400 for unknown values (upgradeRequired=false), 403 for locked features (upgradeRequired=true)
        const statusCode = gatingResult.upgradeRequired ? 403 : 400;
        return res.status(statusCode).json({
          message: gatingResult.reason,
          errorCode: gatingResult.upgradeRequired ? 'VIDEO_MODEL_NOT_ALLOWED' : 'INVALID_VIDEO_MODEL',
          upgradeRequired: gatingResult.upgradeRequired || false,
          suggestedTier: gatingResult.suggestedTier,
          allowedEngines: gatingResult.allowedEngines,
        });
      }
      
      const resolvedModel = gatingResult.resolvedModel;
      console.log(`[Video Gating] Allowed: user=${user.id}, planTier=${planTier}, resolvedModel=${resolvedModel}, engine=${engine || 'auto'}`);
      
      // Start async video generation
      const result = await startReplicateVideoAsync({
        prompt: videoPrompt,
        imageUrl: mode === "image-to-video" ? sourceImageUrl : undefined,
        model: resolvedModel,
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
        videoGenerationModel: resolvedModel,
      };
      await storage.updateIcePreview(previewId, { cards });
      
      // Log AI usage for billing tracking (videos are expensive)
      try {
        const profile = await storage.getCreatorProfile(user.id);
        if (profile) {
          const videoDuration = duration || 5;
          // Get cost from video models config
          const { VIDEO_MODELS } = await import("./config/videoEngines");
          const modelConfig = VIDEO_MODELS[resolvedModel as keyof typeof VIDEO_MODELS];
          const videoCost = modelConfig ? modelConfig.costPer5s * (videoDuration / 5) : videoDuration * 0.15;
          
          await storage.logAiUsageEvent({
            profileId: profile.id,
            iceId: previewId,
            usageType: 'video_gen',
            creditsUsed: videoCost,
            model: resolvedModel,
            metadata: { 
              cardId, 
              duration: videoDuration, 
              mode: mode || 'text-to-video',
              engine: engine || 'auto',
              planTier,
              estimatedCost: videoCost,
            },
          });
        }
      } catch (aiLogError) {
        console.warn('Failed to log AI video usage:', aiLogError);
      }
      
      console.log(`[ICE Video] Started prediction ${result.predictionId} for card ${cardId}, model=${resolvedModel}, planTier=${planTier}`);
      
      res.json({
        success: true,
        message: "Video generation started",
        status: "processing",
        predictionId: result.predictionId,
        cardId,
        resolvedModel,
        engine: engine || 'auto',
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
  
  // Generate continuation still image for Cinematic Continuation feature
  // This creates a context-aware still image to display after video ends while narration continues
  app.post("/api/ice/preview/:previewId/cards/:cardId/generate-continuation-still", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check write permission
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      
      if (!policy.allowed) {
        return res.status(403).json({ message: policy.reason || "Permission denied" });
      }
      
      const cards = preview.cards as any[];
      const cardIndex = cards.findIndex(c => c.id === cardId);
      const card = cards[cardIndex];
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Idempotency check: if already has continuation image, return it
      if (card.continuationImageUrl) {
        return res.json({
          success: true,
          cardId,
          continuationImageUrl: card.continuationImageUrl,
          alreadyExists: true,
        });
      }
      
      // Prevent concurrent generation: check status
      if (card.continuationGenerationStatus === "pending") {
        return res.status(409).json({ 
          message: "Continuation still generation already in progress",
          status: "pending",
        });
      }
      
      // Check if card has video (continuation only makes sense for video cards)
      const hasVideo = !!card.generatedVideoUrl || (card.mediaAssets || []).some((a: any) => a.kind === 'video');
      if (!hasVideo) {
        return res.status(400).json({ message: "Card must have a video for continuation still generation" });
      }
      
      // Mark as pending before generating
      cards[cardIndex] = { ...card, continuationGenerationStatus: "pending" };
      await storage.updateIcePreview(previewId, { cards });
      
      // Check OpenAI configuration
      const { isOpenAIConfigured, getOpenAI } = await import("./ai");
      if (!isOpenAIConfigured()) {
        return res.status(503).json({ message: "OpenAI not configured" });
      }
      
      // Build a prompt for the continuation still - should match the video scene but with subtle variations
      const promptParts: string[] = [];
      
      // Use scene lock context if available (for visual continuity)
      // Note: We intentionally use only environment and lighting from Scene Lock
      // These are the primary drivers of visual consistency for still images.
      // Camera settings are less relevant for stills (no motion), and background
      // is usually captured in environment description.
      if (preview.sceneLockConfig && typeof preview.sceneLockConfig === 'object') {
        const lock = preview.sceneLockConfig as any;
        if (lock.environment?.enabled && lock.environment?.description) {
          promptParts.push(`Environment: ${lock.environment.description}`);
        }
        if (lock.lighting?.enabled && lock.lighting?.description) {
          promptParts.push(`Lighting: ${lock.lighting.description}`);
        }
        if (lock.background?.enabled && lock.background?.description) {
          promptParts.push(`Background: ${lock.background.description}`);
        }
      }
      
      // Use video generation prompt or scene description
      if (card.videoGenerationPrompt) {
        promptParts.push(card.videoGenerationPrompt);
      } else if (card.sceneDescription) {
        promptParts.push(card.sceneDescription);
      }
      
      // Fallback to card title/content
      if (promptParts.length === 0) {
        if (card.title) promptParts.push(card.title);
        if (card.captionsJson && Array.isArray(card.captionsJson)) {
          const captions = card.captionsJson.map((c: any) => c.text || c).slice(0, 3).join(" ");
          if (captions) promptParts.push(captions);
        }
      }
      
      // Add continuation-specific context
      const basePrompt = promptParts.join(". ") || "Cinematic atmosphere, dramatic lighting";
      const fullPrompt = `${basePrompt}. Same scene, slightly different angle or lighting, cinematic still frame, high quality, 9:16 aspect ratio.`;
      
      console.log(`[Continuation Still] Generating for card ${cardId}, prompt: ${fullPrompt.substring(0, 200)}...`);
      
      // Generate the image using OpenAI
      const response = await getOpenAI().images.generate({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1792", // 9:16 aspect ratio for vertical video
        quality: "standard",
      });
      
      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error("No image generated");
      }
      
      // Download and store the image
      let continuationImageUrl = imageUrl;
      
      const { isObjectStorageConfigured, uploadToObjectStorage } = await import("./objectStorage");
      if (isObjectStorageConfigured()) {
        // Upload to R2/Object Storage
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const filename = `continuation-${cardId}-${Date.now()}.png`;
        
        continuationImageUrl = await uploadToObjectStorage({
          buffer: imageBuffer,
          filename,
          contentType: "image/png",
          isPublic: true,
        });
        
        console.log(`[Continuation Still] Saved to R2: ${continuationImageUrl}`);
      }
      
      // Update the card with continuation image URL and metadata
      cards[cardIndex] = {
        ...cards[cardIndex],
        continuationImageUrl,
        cinematicContinuationEnabled: true, // Ensure it's enabled
        continuationGenerationStatus: "completed",
      };
      await storage.updateIcePreview(previewId, { cards });
      
      console.log(`[Continuation Still] Generated for card ${cardId}: ${continuationImageUrl}`);
      
      res.json({
        success: true,
        cardId,
        continuationImageUrl,
        promptUsed: fullPrompt.substring(0, 300),
      });
    } catch (error: any) {
      console.error("Error generating continuation still:", error);
      
      // Reset generation status on failure
      try {
        const latestPreview = await storage.getIcePreview(previewId);
        if (latestPreview) {
          const latestCards = latestPreview.cards as any[];
          const cIdx = latestCards.findIndex(c => c.id === cardId);
          if (cIdx !== -1) {
            latestCards[cIdx] = { ...latestCards[cIdx], continuationGenerationStatus: "failed" };
            await storage.updateIcePreview(previewId, { cards: latestCards });
          }
        }
      } catch (cleanupErr) {
        console.warn("Failed to reset continuation status:", cleanupErr);
      }
      
      if (error?.status === 400) {
        return res.status(400).json({
          message: "OpenAI rejected the prompt. It may contain prohibited content.",
          error: error.message,
          status: "failed",
        });
      }
      
      res.status(500).json({
        message: "Error generating continuation still",
        error: error.message || "Unknown error",
        status: "failed",
      });
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
  
  // Generate narration for an ICE preview card (requires auth + entitlements + daily cap)
  app.post("/api/ice/preview/:previewId/cards/:cardId/narration/generate", requireAuth, dailyCapMiddleware('tts'), async (req, res) => {
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
      const { isObjectStorageConfigured, putObject } = await import("./storage/objectStore");
      
      if (!isTTSConfigured()) {
        return res.status(503).json({ message: "TTS not configured: OPENAI_API_KEY is missing" });
      }
      
      if (!isObjectStorageConfigured()) {
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
      
      // Save to R2 object storage
      const fileName = `ice-narration/${previewId}/${cardId}/${Date.now()}.mp3`;
      const audioUrl = await putObject(fileName, result.audioBuffer, result.contentType);
      
      // Update the card with the generated audio URL and duration
      let updatedCard = { 
        ...card, 
        narrationAudioUrl: audioUrl,
        narrationDurationSec: result.durationSeconds || null, // Store narration duration for Cinematic Continuation
      };
      
      // Phase 2: Forced Alignment - align captions to audio if enabled
      const { isAlignmentEnabled, alignCardCaptions } = await import("./services/whisperAlignment");
      if (isAlignmentEnabled() && preview.captionTimingMode === 'aligned') {
        try {
          // Get captions - use same logic as frontend for consistency
          // Frontend uses: content.split('. ').filter(s => s.trim()).slice(0, 3)
          let captions: string[] = [];
          if (card.captionsJson && Array.isArray(card.captionsJson)) {
            // If captionsJson exists, use it
            captions = card.captionsJson.map((c: any) => typeof c === 'string' ? c : (c.text || ''));
          } else if (card.captions && Array.isArray(card.captions)) {
            captions = card.captions;
          } else if (card.content) {
            // Fallback: split content the same way frontend does (all sentences)
            captions = card.content.split('. ').filter((s: string) => s.trim());
          }
          
          if (captions.length > 0) {
            // Get audio duration from result if available, otherwise estimate
            const audioDurationMs = result.durationSeconds ? result.durationSeconds * 1000 : (narrationText.length / 15) * 1000;
            
            const alignment = await alignCardCaptions(captions, audioUrl, audioDurationMs);
            if (alignment) {
              updatedCard.captionTimings = alignment.timings;
              console.log(`[ICE] Caption alignment complete: ${alignment.alignedCount}/${alignment.totalCount} captions aligned`);
            }
          } else {
            console.log('[ICE] No captions found for alignment');
          }
        } catch (alignError) {
          console.warn('[ICE] Caption alignment failed (continuing without):', alignError);
        }
      }
      
      cards[cardIndex] = updatedCard;
      await storage.updateIcePreview(previewId, { cards });
      
      // Log successful generation
      const { userIp: successIp, userAgent: successAgent } = extractRequestInfo(req);
      await logAuditEvent('media.generated', 'ice_preview', preview.id, {
        userId: user.id,
        userIp: successIp,
        userAgent: successAgent,
        details: { cardId, type: 'narration' },
      });
      
      // Log AI usage for billing tracking
      try {
        const profile = await storage.getCreatorProfile(user.id);
        if (profile) {
          // TTS pricing: ~$0.015 per 1K characters for tts-1
          const charCount = narrationText.length;
          const ttsCost = (charCount / 1000) * 0.015;
          await storage.logAiUsageEvent({
            profileId: profile.id,
            iceId: previewId,
            usageType: 'audio_gen',
            creditsUsed: ttsCost,
            model: 'tts-1',
            metadata: { cardId, characterCount: charCount, voice: voice || 'alloy' },
          });
        }
      } catch (aiLogError) {
        console.warn('Failed to log AI TTS usage:', aiLogError);
      }
      
      // Check if Cinematic Continuation is needed (narration > video duration)
      const hasVideo = !!updatedCard.generatedVideoUrl || (updatedCard.mediaAssets || []).some((a: any) => a.kind === 'video');
      const narrationDuration = result.durationSeconds || 0;
      const videoDuration = updatedCard.videoDurationSec || 5; // Default 5 sec for video cap
      const needsContinuation = hasVideo && narrationDuration > videoDuration && !updatedCard.continuationImageUrl;
      const cinematicEnabled = updatedCard.cinematicContinuationEnabled !== false; // Default true
      
      res.json({
        success: true,
        audioUrl,
        cardId,
        narrationDurationSec: narrationDuration,
        needsContinuation: needsContinuation && cinematicEnabled, // Frontend can show continuation button
        hasVideo,
        videoDurationSec: videoDuration,
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
      
      // Get the asset being deleted to check its type
      const deletedAsset = assets[assetIndex];
      const deletedAssetKind = deletedAsset.kind;
      const wasActiveImage = deletedAssetKind === 'image' && 
        (card.selectedMediaAssetId === assetId || card.generatedImageUrl === deletedAsset.url);
      const wasActiveVideo = deletedAssetKind === 'video' && 
        (card.selectedMediaAssetId === assetId || card.generatedVideoUrl === deletedAsset.url);
      
      // Remove the asset
      const newAssets = assets.filter((a: any) => a.id !== assetId);
      
      // If deleted asset was selected, select the most recent remaining asset of same type
      let newSelectedId = card.selectedMediaAssetId;
      if (card.selectedMediaAssetId === assetId) {
        const readyAssets = newAssets.filter((a: any) => a.status === 'ready');
        newSelectedId = readyAssets.length > 0 ? readyAssets[readyAssets.length - 1].id : undefined;
      }
      
      // Find new active image/video based on remaining assets
      const remainingImages = newAssets.filter((a: any) => a.kind === 'image' && a.status === 'ready');
      const remainingVideos = newAssets.filter((a: any) => a.kind === 'video' && a.status === 'ready');
      
      // Determine new generatedImageUrl and generatedVideoUrl
      let newGeneratedImageUrl = card.generatedImageUrl;
      let newGeneratedVideoUrl = card.generatedVideoUrl;
      
      // If we deleted the active image, update to next image or clear
      if (wasActiveImage) {
        newGeneratedImageUrl = remainingImages.length > 0 
          ? remainingImages[remainingImages.length - 1].url 
          : undefined;
      }
      
      // If we deleted the active video, update to next video or clear
      if (wasActiveVideo) {
        newGeneratedVideoUrl = remainingVideos.length > 0 
          ? remainingVideos[remainingVideos.length - 1].url 
          : undefined;
      }
      
      cards[cardIndex] = {
        ...card,
        mediaAssets: newAssets,
        selectedMediaAssetId: newSelectedId,
        generatedImageUrl: newGeneratedImageUrl,
        generatedVideoUrl: newGeneratedVideoUrl,
      };
      
      await storage.updateIcePreview(previewId, { cards });
      
      res.json({
        success: true,
        deletedAssetId: assetId,
        newSelectedAssetId: newSelectedId,
        newGeneratedImageUrl: newGeneratedImageUrl || null,
        newGeneratedVideoUrl: newGeneratedVideoUrl || null,
      });
    } catch (error) {
      console.error("Error deleting media asset:", error);
      res.status(500).json({ message: "Error deleting asset" });
    }
  });

  // Regenerate an AI media asset in-place (keeps position, replaces content)
  app.post("/api/ice/preview/:previewId/cards/:cardId/regenerate-asset", requireAuth, async (req, res) => {
    try {
      const { previewId, cardId } = req.params;
      const { assetId, prompt, kind } = req.body;
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check write permission
      const user = req.user as schema.User;
      const policy = canWriteIcePreview(user, preview);
      if (!policy.allowed) {
        return res.status(policy.statusCode).json({ message: policy.reason || "Not authorized" });
      }
      
      // Find the card and asset
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
      
      const existingAsset = assets[assetIndex];
      if (existingAsset.source !== 'ai') {
        return res.status(400).json({ message: "Only AI-generated assets can be regenerated" });
      }
      
      // Check entitlements based on kind
      const entitlements = await getFullEntitlements(user.id);
      
      if (kind === 'image') {
        if (!entitlements.canGenerateImages) {
          return res.status(403).json({ message: "Image generation requires a paid subscription", upgradeRequired: true });
        }
        
        console.log(`[ICE] Regenerating image for asset ${assetId} in card ${cardId}`);
        
        const imagePrompt = prompt || existingAsset.prompt || `${card.title}. ${card.content}`;
        
        // Generate new image
        const response = await getOpenAI().images.generate({
          model: "gpt-image-1",
          prompt: imagePrompt.substring(0, 3900),
          n: 1,
          size: "1024x1536",
        });
        
        const imageData = response.data?.[0];
        const base64Image = imageData?.b64_json;
        const imageUrl = imageData?.url;
        
        let finalImageUrl: string;
        
        if (base64Image) {
          const imageBuffer = Buffer.from(base64Image, "base64");
          const filename = `ice-${previewId}-${cardId}-${Date.now()}.png`;
          
          const { isObjectStorageConfigured, putObject } = await import("./storage/objectStore");
          if (isObjectStorageConfigured()) {
            const key = `uploads/ice-generated/${filename}`;
            finalImageUrl = await putObject(key, imageBuffer, "image/png");
          } else {
            const uploadsDir = path.join(process.cwd(), "uploads", "ice-generated");
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const filepath = path.join(uploadsDir, filename);
            fs.writeFileSync(filepath, imageBuffer);
            finalImageUrl = `/uploads/ice-generated/${filename}`;
          }
        } else if (imageUrl) {
          finalImageUrl = imageUrl;
        } else {
          throw new Error("No image data returned");
        }
        
        // Update asset in place
        assets[assetIndex] = {
          ...existingAsset,
          url: finalImageUrl,
          thumbnailUrl: finalImageUrl,
          prompt: imagePrompt.substring(0, 500),
          updatedAt: new Date().toISOString(),
        };
        
        // Update active image if this was the active one
        let newGeneratedImageUrl = card.generatedImageUrl;
        if (card.selectedMediaAssetId === assetId || card.generatedImageUrl === existingAsset.url) {
          newGeneratedImageUrl = finalImageUrl;
        }
        
        cards[cardIndex] = {
          ...card,
          mediaAssets: assets,
          generatedImageUrl: newGeneratedImageUrl,
        };
        
        await storage.updateIcePreview(previewId, { cards });
        
        return res.json({
          success: true,
          assetId,
          newUrl: finalImageUrl,
          prompt: imagePrompt.substring(0, 500),
        });
        
      } else if (kind === 'video') {
        if (!entitlements.canGenerateVideos) {
          return res.status(403).json({ message: "Video generation requires a paid subscription", upgradeRequired: true });
        }
        
        console.log(`[ICE] Starting video regeneration for asset ${assetId} in card ${cardId}`);
        
        const videoPrompt = prompt || existingAsset.prompt || `Cinematic scene: ${card.title}. ${card.content}`;
        
        // Start video generation (async process)
        const { startReplicateVideoAsync } = await import("./video/replicate");
        const prediction = await startReplicateVideoAsync(videoPrompt, {
          duration: existingAsset.durationSec || 5,
          aspectRatio: "9:16",
        });
        
        // Mark asset as regenerating
        assets[assetIndex] = {
          ...existingAsset,
          status: 'generating',
          predictionId: prediction.id,
          prompt: videoPrompt.substring(0, 500),
          updatedAt: new Date().toISOString(),
        };
        
        cards[cardIndex] = {
          ...card,
          mediaAssets: assets,
        };
        
        await storage.updateIcePreview(previewId, { cards });
        
        return res.json({
          success: true,
          assetId,
          predictionId: prediction.id,
          status: 'generating',
          prompt: videoPrompt.substring(0, 500),
        });
      }
      
      return res.status(400).json({ message: "Invalid asset kind" });
      
    } catch (error: any) {
      console.error("Error regenerating asset:", error);
      res.status(500).json({ message: error.message || "Error regenerating asset" });
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
      const { musicTrackUrl, musicVolume, musicEnabled, titlePackId, narrationVolume, captionSettings, logoEnabled, logoUrl, logoPosition, adminCtaEnabled } = req.body;
      
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
      if (logoEnabled !== undefined) updateData.logoEnabled = logoEnabled;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (logoPosition !== undefined) updateData.logoPosition = logoPosition;
      // Admin CTA can only be set by admins - enforce server-side
      if (adminCtaEnabled !== undefined && req.user?.role === 'admin') {
        updateData.adminCtaEnabled = adminCtaEnabled;
      }
      
      await storage.updateIcePreview(previewId, updateData);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating preview settings:", error);
      res.status(500).json({ message: "Error updating settings" });
    }
  });

  // ============ ICE PUBLISHING ============

  // Generate a human-friendly 8-character share slug
  function generateShareSlug(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // Avoid confusing chars like 0/O, 1/l/I
    let slug = '';
    for (let i = 0; i < 8; i++) {
      slug += chars[Math.floor(Math.random() * chars.length)];
    }
    return slug;
  }

  // Publish/update visibility for an ICE preview
  app.put("/api/ice/preview/:previewId/publish", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const { visibility, leadGateEnabled, leadGatePrompt } = req.body;
      const user = req.user as schema.User;
      
      // Validate visibility
      const validVisibilities: schema.ContentVisibility[] = ['private', 'unlisted', 'public'];
      if (!visibility || !validVisibilities.includes(visibility)) {
        return res.status(400).json({ message: "Invalid visibility. Must be 'private', 'unlisted', or 'public'" });
      }
      
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }
      
      // Check ownership
      if (preview.ownerUserId !== user.id) {
        return res.status(403).json({ message: "Not authorized to publish this preview" });
      }
      
      const updateData: Partial<schema.InsertIcePreview> = {
        visibility,
      };
      
      // Update lead gate settings if provided
      if (typeof leadGateEnabled === 'boolean') {
        updateData.leadGateEnabled = leadGateEnabled;
      }
      if (typeof leadGatePrompt === 'string') {
        updateData.leadGatePrompt = leadGatePrompt || null;
      }
      
      // When reverting to private, invalidate share slug and lead gate to prevent continued access
      if (visibility === 'private') {
        updateData.shareSlug = null;
        updateData.leadGateEnabled = false;
        updateData.leadGatePrompt = null;
      }
      
      // First time publishing or re-publishing (moving from private to unlisted/public)
      const isFirstPublish = preview.visibility === 'private' && visibility !== 'private';
      if (visibility !== 'private' && !preview.shareSlug) {
        // Generate a unique share slug if publishing and no slug exists
        updateData.publishedAt = isFirstPublish ? new Date() : (preview.publishedAt || new Date());
        
        let slug = generateShareSlug();
        let attempts = 0;
        const maxAttempts = 10;
        
        // Ensure uniqueness
        while (attempts < maxAttempts) {
          const existing = await db.select().from(schema.icePreviews).where(eq(schema.icePreviews.shareSlug, slug)).limit(1);
          if (existing.length === 0) break;
          slug = generateShareSlug();
          attempts++;
        }
        
        updateData.shareSlug = slug;
      }
      
      await storage.updateIcePreview(previewId, updateData);
      
      // Log audit event
      await logAuditEvent(
        'visibility.changed',
        'ice_preview',
        previewId,
        {
          userId: user.id,
          details: { 
            isFirstPublish, 
            oldVisibility: preview.visibility, 
            newVisibility: visibility 
          },
          success: true,
        }
      );
      
      // Fetch updated preview
      const updatedPreview = await storage.getIcePreview(previewId);
      
      res.json({
        success: true,
        visibility: updatedPreview?.visibility,
        shareSlug: updatedPreview?.shareSlug,
        publishedAt: updatedPreview?.publishedAt,
        shareUrl: updatedPreview?.shareSlug 
          ? `${getAppBaseUrl(req)}/ice/${updatedPreview.shareSlug}`
          : null,
      });
    } catch (error) {
      console.error("Error publishing preview:", error);
      res.status(500).json({ message: "Error publishing preview" });
    }
  });

  // Get ICE by share slug (public access)
  app.get("/api/ice/s/:shareSlug", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      
      const [preview] = await db.select()
        .from(schema.icePreviews)
        .where(eq(schema.icePreviews.shareSlug, shareSlug))
        .limit(1);
      
      if (!preview) {
        return res.status(404).json({ message: "ICE not found" });
      }
      
      // Check visibility - only unlisted and public are accessible via share link
      if (preview.visibility === 'private') {
        return res.status(404).json({ message: "ICE not found" });
      }
      
      // Get creator profile for attribution
      let creatorProfile = null;
      if (preview.creatorProfileId) {
        const [profile] = await db.select({
          id: schema.creatorProfiles.id,
          displayName: schema.creatorProfiles.displayName,
          slug: schema.creatorProfiles.slug,
          avatarUrl: schema.creatorProfiles.avatarUrl,
        })
        .from(schema.creatorProfiles)
        .where(eq(schema.creatorProfiles.id, preview.creatorProfileId))
        .limit(1);
        creatorProfile = profile || null;
      }
      
      // Get like count
      const [likeResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.iceLikes)
        .where(eq(schema.iceLikes.iceId, preview.id));
      const likeCount = likeResult?.count || 0;
      
      // Return only public-safe fields (no owner details, internal flags, etc.)
      res.json({
        id: preview.id,
        title: preview.title,
        cards: preview.cards,
        characters: preview.characters,
        interactivityNodes: preview.interactivityNodes,
        visibility: preview.visibility,
        shareSlug: preview.shareSlug,
        publishedAt: preview.publishedAt,
        tier: preview.tier,
        musicTrackUrl: preview.musicTrackUrl,
        musicVolume: preview.musicVolume,
        musicEnabled: preview.musicEnabled,
        narrationVolume: preview.narrationVolume,
        captionSettings: preview.captionSettings,
        leadGateEnabled: preview.leadGateEnabled,
        leadGatePrompt: preview.leadGatePrompt,
        projectBible: preview.projectBible ? {
          characters: preview.projectBible.characters,
          world: preview.projectBible.world,
          style: preview.projectBible.style,
        } : null,
        creator: creatorProfile,
        likeCount,
      });
    } catch (error) {
      console.error("Error fetching ICE by slug:", error);
      res.status(500).json({ message: "Error fetching ICE" });
    }
  });
  
  // Submit lead for an ICE (public access)
  app.post("/api/ice/s/:shareSlug/lead", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const { email, name } = req.body;
      
      // Validate email with proper regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || typeof email !== 'string' || !emailRegex.test(email) || email.length > 254) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      
      // Sanitize name if provided
      const sanitizedName = typeof name === 'string' ? name.slice(0, 100).trim() : null;
      
      // Find the ICE
      const [preview] = await db.select()
        .from(schema.icePreviews)
        .where(eq(schema.icePreviews.shareSlug, shareSlug))
        .limit(1);
      
      if (!preview || preview.visibility === 'private') {
        return res.status(404).json({ message: "ICE not found" });
      }
      
      // Check if lead gate is enabled
      if (!preview.leadGateEnabled) {
        return res.status(400).json({ message: "Lead gate not enabled for this ICE" });
      }
      
      // Get visitor info
      const visitorIp = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const referrer = req.get('Referer') || null;
      
      // Check for duplicate leads (same email for same ICE within 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingLead = await db.select()
        .from(schema.iceLeads)
        .where(
          and(
            eq(schema.iceLeads.iceId, preview.id),
            eq(schema.iceLeads.email, email.toLowerCase()),
            gt(schema.iceLeads.createdAt, twentyFourHoursAgo)
          )
        )
        .limit(1);
      
      // If recent lead exists, just return success (don't create duplicate)
      if (existingLead.length > 0) {
        return res.json({ success: true, message: "Access granted" });
      }
      
      // Insert new lead
      await db.insert(schema.iceLeads).values({
        iceId: preview.id,
        email: email.toLowerCase(),
        name: sanitizedName,
        visitorIp,
        userAgent,
        referrer,
      });
      
      res.json({ success: true, message: "Lead captured successfully" });
    } catch (error) {
      console.error("Error capturing lead:", error);
      res.status(500).json({ message: "Error capturing lead" });
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
      
      // Check if object storage is configured (Replit integration OR R2/S3 for Render)
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objectStore = await import("./storage/objectStore");
      const replitStorage = new ObjectStorageService();
      const hasReplitStorage = replitStorage.isConfigured();
      const hasR2Storage = objectStore.isObjectStorageConfigured();
      
      if (!hasReplitStorage && !hasR2Storage) {
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
      const { cardTitle, cardContent, styleHints, mediaType, targetAudience } = req.body;
      
      if (!cardContent && !cardTitle) {
        return res.status(400).json({ message: "Card title or content is required" });
      }
      
      const basePrompt = `${cardTitle || ''}. ${cardContent || ''}`.trim();
      
      // Audience-specific style guidelines
      const audienceGuidelines: Record<string, string> = {
        general: "Balanced, universally appealing visuals suitable for all ages and backgrounds.",
        children: "Bright, colorful, playful imagery with friendly characters. Warm lighting, rounded shapes, cheerful atmosphere. Avoid anything scary, violent, or complex.",
        technical: "Clean, precise, professional visuals. Diagram-like clarity, muted professional colors, structured compositions. Focus on accuracy and clarity.",
        entertainment: "Dynamic, vibrant, eye-catching visuals. Bold colors, dramatic lighting, cinematic flair. High energy and emotional impact.",
        business: "Corporate, professional, trustworthy aesthetics. Clean lines, business-appropriate imagery, confident and polished. Subtle sophistication.",
        educational: "Clear, informative, engaging visuals. Good visual hierarchy, illustrative style, approachable complexity. Learning-focused.",
        luxury: "Premium, elegant, sophisticated imagery. Rich textures, refined color palettes, exclusive atmosphere. High-end production quality.",
        youth: "Trendy, bold, social-media-ready visuals. Vibrant colors, modern aesthetics, culturally relevant. Fast-paced and authentic.",
      };
      
      const audienceStyle = audienceGuidelines[targetAudience || 'general'] || audienceGuidelines.general;
      
      // Construct the enhancement prompt
      const systemPrompt = `You are a professional visual director and cinematographer. Your job is to transform story descriptions into production-grade prompts for AI image/video generation.

The output must be optimized for ${mediaType === 'video' ? 'AI video generation (Kling/Runway)' : 'AI image generation (DALL-E/GPT-Image)'}.

TARGET AUDIENCE: ${targetAudience || 'general'}
AUDIENCE STYLE GUIDELINES: ${audienceStyle}

CRITICAL RULES:
- NEVER include text, words, letters, titles, captions, watermarks, or typography in the output
- Focus on pure visual imagery only
- Include specific camera angles, lighting, mood, and cinematic techniques
- Use 9:16 vertical aspect ratio framing
- Keep descriptions visual and actionable
- Ensure the visual style resonates with the target audience

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

  // ========================================
  // AI Character Custom Fields (Structured Data Capture)
  // Business tier feature for capturing structured data during chat
  // ========================================

  // Get all custom fields for a character
  app.get("/api/characters/:characterId/custom-fields", requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      if (isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid character ID" });
      }

      // Verify user owns this character via its universe
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      const universe = await storage.getUniverse(character.universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }

      // Check ownership
      const creatorProfile = await storage.getCreatorProfile(req.user!.id);
      if (!creatorProfile && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const fields = await storage.getCharacterCustomFields(characterId);
      res.json(fields);
    } catch (error) {
      console.error("Error getting custom fields:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new custom field (business tier only)
  app.post("/api/characters/:characterId/custom-fields", requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      if (isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid character ID" });
      }

      // Check entitlements
      const { getEntitlementsForUser } = await import("./entitlements");
      const entitlements = await getEntitlementsForUser(req.user!.id);
      if (!entitlements.canConfigureStructuredCapture) {
        return res.status(403).json({ 
          message: "Custom field capture requires a Business tier subscription",
          upgradeRequired: true
        });
      }

      // Verify ownership
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      const universe = await storage.getUniverse(character.universeId);
      if (!universe) {
        return res.status(404).json({ message: "Universe not found" });
      }

      const creatorProfile = await storage.getCreatorProfile(req.user!.id);
      if (!creatorProfile && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { fieldKey, label, fieldType, placeholder, required, options, description } = req.body;

      if (!fieldKey || !label) {
        return res.status(400).json({ message: "Field key and label are required" });
      }

      // Get current field count for sort order
      const existingFields = await storage.getCharacterCustomFields(characterId);
      const sortOrder = existingFields.length;

      const field = await storage.createCustomField({
        characterId,
        fieldKey,
        label,
        fieldType: fieldType || "text",
        placeholder,
        required: required ?? false,
        sortOrder,
        options,
        description,
      });

      res.status(201).json(field);
    } catch (error) {
      console.error("Error creating custom field:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update a custom field
  app.patch("/api/characters/:characterId/custom-fields/:fieldId", requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const fieldId = parseInt(req.params.fieldId);
      
      if (isNaN(characterId) || isNaN(fieldId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      // Check entitlements
      const { getEntitlementsForUser } = await import("./entitlements");
      const entitlements = await getEntitlementsForUser(req.user!.id);
      if (!entitlements.canConfigureStructuredCapture) {
        return res.status(403).json({ 
          message: "Custom field capture requires a Business tier subscription",
          upgradeRequired: true
        });
      }

      // Verify ownership
      const field = await storage.getCustomField(fieldId);
      if (!field || field.characterId !== characterId) {
        return res.status(404).json({ message: "Field not found" });
      }

      const { label, fieldType, placeholder, required, options, description } = req.body;

      const updatedField = await storage.updateCustomField(fieldId, {
        label,
        fieldType,
        placeholder,
        required,
        options,
        description,
      });

      res.json(updatedField);
    } catch (error) {
      console.error("Error updating custom field:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a custom field
  app.delete("/api/characters/:characterId/custom-fields/:fieldId", requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const fieldId = parseInt(req.params.fieldId);
      
      if (isNaN(characterId) || isNaN(fieldId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      // Check entitlements
      const { getEntitlementsForUser } = await import("./entitlements");
      const entitlements = await getEntitlementsForUser(req.user!.id);
      if (!entitlements.canConfigureStructuredCapture) {
        return res.status(403).json({ 
          message: "Custom field capture requires a Business tier subscription",
          upgradeRequired: true
        });
      }

      // Verify ownership
      const field = await storage.getCustomField(fieldId);
      if (!field || field.characterId !== characterId) {
        return res.status(404).json({ message: "Field not found" });
      }

      await storage.deleteCustomField(fieldId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom field:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reorder custom fields
  app.post("/api/characters/:characterId/custom-fields/reorder", requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      if (isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid character ID" });
      }

      const { fieldIds } = req.body;
      if (!Array.isArray(fieldIds)) {
        return res.status(400).json({ message: "fieldIds must be an array" });
      }

      await storage.reorderCustomFields(characterId, fieldIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering custom fields:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // Field Response Capture (for chat sessions)
  // ========================================

  // Capture a field response during chat (public - works for anonymous viewers)
  app.post("/api/ice/preview/:previewId/field-responses", async (req, res) => {
    try {
      const { previewId } = req.params;
      const { fieldId, sessionId, displayName, value } = req.body;

      if (!fieldId || !sessionId || value === undefined) {
        return res.status(400).json({ message: "fieldId, sessionId, and value are required" });
      }

      // Verify preview exists
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      // Verify field exists
      const field = await storage.getCustomField(parseInt(fieldId));
      if (!field) {
        return res.status(404).json({ message: "Field not found" });
      }

      const response = await storage.upsertFieldResponse({
        icePreviewId: previewId,
        characterId: field.characterId,
        fieldId: parseInt(fieldId),
        viewerSessionId: sessionId,
        viewerDisplayName: displayName,
        viewerUserId: req.user?.id,
        value,
      });

      res.status(201).json(response);
    } catch (error) {
      console.error("Error capturing field response:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get field responses for an ICE (owner only, for analytics)
  app.get("/api/ice/preview/:previewId/field-responses", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;
      const { sessionId } = req.query;

      // Verify ownership
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      if (preview.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const responses = await storage.getFieldResponses(previewId, sessionId as string | undefined);
      res.json(responses);
    } catch (error) {
      console.error("Error getting field responses:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get aggregated field data for an ICE (for conversation insights)
  app.get("/api/ice/preview/:previewId/field-aggregates", requireAuth, async (req, res) => {
    try {
      const { previewId } = req.params;

      // Check entitlements for conversation insights
      const { getEntitlementsForUser } = await import("./entitlements");
      const entitlements = await getEntitlementsForUser(req.user!.id);
      if (!entitlements.canViewConversationInsights) {
        return res.status(403).json({ 
          message: "Viewing field aggregates requires a Business tier subscription",
          upgradeRequired: true
        });
      }

      // Verify ownership
      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      if (preview.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const aggregates = await storage.getFieldResponseAggregates(previewId);
      res.json(aggregates);
    } catch (error) {
      console.error("Error getting field aggregates:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get custom fields for an ICE (public - for chat UI to know what to capture)
  app.get("/api/ice/preview/:previewId/custom-fields", async (req, res) => {
    try {
      const { previewId } = req.params;

      const preview = await storage.getIcePreview(previewId);
      if (!preview) {
        return res.status(404).json({ message: "Preview not found" });
      }

      // Get the character for this ICE
      const cardsData = preview.cardsData as any;
      if (!cardsData?.aiCharacter?.id) {
        return res.json([]); // No AI character configured
      }

      const fields = await storage.getCharacterCustomFields(cardsData.aiCharacter.id);
      res.json(fields);
    } catch (error) {
      console.error("Error getting ICE custom fields:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get aggregated field data by ICE ID (for analytics page)
  app.get("/api/ice/:iceId/field-aggregates", requireAuth, async (req, res) => {
    try {
      const { iceId } = req.params;

      // Check entitlements for conversation insights
      const { getEntitlementsForUser } = await import("./entitlements");
      const entitlements = await getEntitlementsForUser(req.user!.id);
      if (!entitlements.canViewConversationInsights) {
        return res.status(403).json({ 
          message: "Viewing field aggregates requires a Business tier subscription",
          upgradeRequired: true
        });
      }

      // Find the preview by ICE ID
      const preview = await storage.getIcePreview(iceId);
      if (!preview) {
        return res.status(404).json({ message: "ICE not found" });
      }

      if (preview.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const aggregates = await storage.getFieldResponseAggregates(iceId);
      res.json(aggregates);
    } catch (error) {
      console.error("Error getting field aggregates by ICE ID:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Demo request contact form endpoint
  app.post("/api/contact/demo-request", async (req, res) => {
    try {
      const { name, email, company, message } = req.body;

      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Log the demo request
      console.log("[Demo Request] New demo request received:", {
        name,
        email,
        company: company || "Not provided",
        message: message || "No message",
        timestamp: new Date().toISOString(),
        ip: req.ip || req.socket.remoteAddress,
      });

      // Store in database for tracking
      try {
        await db.insert(schema.iceLeads).values({
          iceId: "demo_requests", // Special identifier for demo requests
          email,
          name,
          visitorIp: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get("user-agent") || null,
          referrer: company ? `Company: ${company} | Message: ${message || 'None'}` : message || null,
        });
      } catch (dbError) {
        console.error("[Demo Request] Failed to store in database:", dbError);
        // Continue anyway - we logged it
      }

      // Send notification email via Resend if configured
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          
          await resend.emails.send({
            from: "IceMaker <notifications@icemaker.app>",
            to: ["hello@icemaker.app"],
            subject: `Demo Request from ${name}${company ? ` (${company})` : ''}`,
            html: `
              <h2>New Demo Request</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Company:</strong> ${company || 'Not provided'}</p>
              <p><strong>Message:</strong></p>
              <p>${message || 'No message provided'}</p>
              <hr />
              <p style="color: #666; font-size: 12px;">
                Submitted at ${new Date().toISOString()}<br />
                IP: ${req.ip || req.socket.remoteAddress || 'Unknown'}
              </p>
            `,
          });
          console.log("[Demo Request] Notification email sent successfully");
        } catch (emailError) {
          console.error("[Demo Request] Failed to send notification email:", emailError);
          // Continue anyway - we have the data logged
        }
      }

      res.json({ 
        success: true, 
        message: "Demo request received. We'll be in touch within 24 hours." 
      });
    } catch (error) {
      console.error("Error processing demo request:", error);
      res.status(500).json({ message: "Failed to submit request" });
    }
  });

  // Enterprise branding enquiry endpoint
  app.post("/api/enterprise/branding-enquiry", async (req, res) => {
    try {
      const { name, company, email, customisations, notes } = req.body;

      if (!name || !company || !email) {
        return res.status(400).json({ message: "Name, company, and email are required" });
      }

      // Log the enquiry (TODO: Store in database or send via email when Resend is configured)
      console.log("[Enterprise Enquiry] Branding enquiry received:", {
        name,
        company,
        email,
        customisations: customisations || [],
        notes: notes || "",
        timestamp: new Date().toISOString(),
        ip: req.ip || req.socket.remoteAddress,
      });

      // TODO: Send notification email to sales team when Resend is fully configured
      // For now, log to console for manual follow-up

      res.json({ 
        success: true, 
        message: "Enquiry received. We'll be in touch within 2 business days." 
      });
    } catch (error) {
      console.error("Error processing branding enquiry:", error);
      res.status(500).json({ message: "Failed to submit enquiry" });
    }
  });

  // Start background jobs
  startArchiveExpiredPreviewsJob(storage);
  startOrphanCleanupJob(storage);
  startStorageReconciliationJob(storage);
  startExportCleanupJob(storage);

  return httpServer;
}
