import { User, Universe, IcePreview, ContentVisibility, InsertAuditLog } from "@shared/schema";
import { storage } from "./storage";

type AuthUser = User | undefined;

interface PolicyResult {
  allowed: boolean;
  reason?: string;
  statusCode: 401 | 403 | 404;
}

const ALLOWED: PolicyResult = { allowed: true, statusCode: 200 as any };

function deny(statusCode: 401 | 403 | 404, reason: string): PolicyResult {
  return { allowed: false, reason, statusCode };
}

export function canReadByVisibility(
  user: AuthUser,
  ownerId: number | null | undefined,
  visibility: ContentVisibility,
  resourceType: string
): PolicyResult {
  if (visibility === "public") {
    return ALLOWED;
  }
  
  if (visibility === "unlisted") {
    return ALLOWED;
  }
  
  if (!user) {
    return deny(404, `${resourceType} not found`);
  }
  
  if (user.isAdmin || user.role === "admin") {
    return ALLOWED;
  }
  
  if (ownerId && user.id === ownerId) {
    return ALLOWED;
  }
  
  return deny(404, `${resourceType} not found`);
}

export function canWriteByOwnership(
  user: AuthUser,
  ownerId: number | null | undefined,
  resourceType: string
): PolicyResult {
  if (!user) {
    return deny(401, "Authentication required");
  }
  
  if (user.isAdmin || user.role === "admin") {
    return ALLOWED;
  }
  
  if (ownerId && user.id === ownerId) {
    return ALLOWED;
  }
  
  if (!ownerId) {
    return deny(403, `Cannot modify unclaimed ${resourceType}`);
  }
  
  return deny(403, `Not authorized to modify this ${resourceType}`);
}

export function canReadUniverse(user: AuthUser, universe: Universe): PolicyResult {
  return canReadByVisibility(
    user,
    universe.ownerUserId,
    (universe.visibility as ContentVisibility) || "private",
    "Universe"
  );
}

export function canWriteUniverse(user: AuthUser, universe: Universe): PolicyResult {
  return canWriteByOwnership(user, universe.ownerUserId, "Universe");
}

export function canReadIcePreview(user: AuthUser, preview: IcePreview): PolicyResult {
  return canReadByVisibility(
    user,
    preview.ownerUserId,
    (preview.visibility as ContentVisibility) || "unlisted",
    "Preview"
  );
}

export function canWriteIcePreview(
  user: AuthUser, 
  preview: IcePreview,
  claimToken?: string
): PolicyResult {
  if (!user) {
    return deny(401, "Authentication required");
  }
  
  if (user.isAdmin || user.role === "admin") {
    return ALLOWED;
  }
  
  if (preview.ownerUserId && user.id === preview.ownerUserId) {
    return ALLOWED;
  }
  
  if (!preview.ownerUserId && preview.ownerIp) {
    return deny(403, "This preview must be claimed first");
  }
  
  return deny(403, "Not authorized to modify this preview");
}

export function canClaimIcePreview(
  user: AuthUser,
  preview: IcePreview,
  claimToken?: string
): PolicyResult {
  if (!user) {
    return deny(401, "Authentication required to claim preview");
  }
  
  if (preview.ownerUserId) {
    if (preview.ownerUserId === user.id) {
      return ALLOWED;
    }
    return deny(403, "Preview already claimed by another user");
  }
  
  if (preview.claimTokenHash && preview.claimTokenUsedAt) {
    return deny(403, "Claim token already used");
  }
  
  return ALLOWED;
}

export async function logAuditEvent(
  eventType: InsertAuditLog["eventType"],
  resourceType: string,
  resourceId: string,
  options: {
    userId?: number;
    userIp?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
    oldValue?: unknown;
    newValue?: unknown;
    success?: boolean;
    errorCode?: string;
  } = {}
): Promise<void> {
  try {
    await storage.createAuditLog({
      eventType,
      resourceType,
      resourceId,
      userId: options.userId || null,
      userIp: options.userIp || null,
      userAgent: options.userAgent || null,
      details: options.details || null,
      oldValue: options.oldValue as any || null,
      newValue: options.newValue as any || null,
      success: options.success ?? true,
      errorCode: options.errorCode || null,
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

export function extractRequestInfo(req: any): { userIp: string; userAgent: string } {
  const userIp = req.ip || req.socket?.remoteAddress || "unknown";
  const userAgent = (req.headers?.["user-agent"] || "").slice(0, 500);
  return { userIp, userAgent };
}
