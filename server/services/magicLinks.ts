import { storage } from "../storage";
import crypto from "crypto";

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function create(
  userId: number,
  orbitId: number,
  purpose: 'view_lead' | 'view_conversation' | 'view_intelligence' | 'view_ice',
  targetId?: number,
  expiryDays: number = 7
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  await storage.createMagicLink({
    token,
    userId,
    orbitId,
    purpose,
    targetId: targetId ?? null,
    expiresAt,
  });

  return token;
}

export async function validate(
  token: string,
  expectedPurpose?: string
): Promise<{
  valid: boolean;
  userId?: number;
  orbitId?: number;
  targetId?: number;
  purpose?: string;
  error?: string;
}> {
  const link = await storage.getMagicLink(token);

  if (!link) {
    return { valid: false, error: 'Invalid link' };
  }

  if (new Date() > link.expiresAt) {
    return { valid: false, error: 'Link has expired' };
  }

  if (expectedPurpose && link.purpose !== expectedPurpose) {
    return { valid: false, error: 'Link purpose mismatch' };
  }

  await storage.markMagicLinkUsed(token);

  return {
    valid: true,
    userId: link.userId,
    orbitId: link.orbitId,
    targetId: link.targetId ?? undefined,
    purpose: link.purpose,
  };
}

export async function cleanup(): Promise<number> {
  return storage.cleanupExpiredMagicLinks();
}
