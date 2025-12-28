import { storage } from "../storage";
import type { InsertNotification, NotificationType, OrbitMeta, OrbitTier } from "@shared/schema";
import crypto from "crypto";

const INSIGHT_TIERS: OrbitTier[] = ['insight', 'intelligence'];
const INTELLIGENCE_TIERS: OrbitTier[] = ['intelligence'];

interface TriggerContext {
  orbitId: number;
  businessSlug: string;
  ownerId: number;
  tier: OrbitTier;
}

export async function createNotification(
  data: Omit<InsertNotification, 'dedupeKey'> & { dedupeKey?: string }
): Promise<boolean> {
  if (data.dedupeKey) {
    const existing = await storage.findNotificationByDedupeKey(data.dedupeKey);
    if (existing) {
      return false;
    }
  }
  
  await storage.createNotification(data as InsertNotification);
  return true;
}

export async function triggerLeadCapturedNotification(
  context: TriggerContext,
  leadId: number,
  leadName: string,
  source: string
): Promise<boolean> {
  if (!INSIGHT_TIERS.includes(context.tier)) {
    return false;
  }

  const prefs = await storage.getNotificationPreferences(context.ownerId);
  if (prefs && !prefs.leadAlertsEnabled) {
    return false;
  }

  const dedupeKey = `lead_captured_${leadId}`;
  
  return createNotification({
    userId: context.ownerId,
    orbitId: context.orbitId,
    type: 'lead_captured',
    title: 'New lead captured',
    body: `${leadName} submitted a lead from ${source}`,
    actionUrl: `/orbit/${context.businessSlug}?hub=leads&lead=${leadId}`,
    meta: { leadId, leadName, source },
    severity: 'important',
    dedupeKey,
  });
}

export async function triggerConversationSpikeNotification(
  context: TriggerContext,
  todayCount: number,
  avgCount: number
): Promise<boolean> {
  if (!INSIGHT_TIERS.includes(context.tier)) {
    return false;
  }

  const prefs = await storage.getNotificationPreferences(context.ownerId);
  if (prefs && !prefs.conversationAlertsEnabled) {
    return false;
  }

  if (todayCount < 5 || todayCount < avgCount * 2) {
    return false;
  }

  const today = new Date().toISOString().split('T')[0];
  const dedupeKey = `conversation_spike_${context.businessSlug}_${today}`;

  return createNotification({
    userId: context.ownerId,
    orbitId: context.orbitId,
    type: 'conversation_spike',
    title: 'Conversation spike detected',
    body: `Your Orbit had ${todayCount} conversations today - ${Math.round((todayCount / avgCount) * 100)}% above average`,
    actionUrl: `/orbit/${context.businessSlug}?hub=conversations`,
    meta: { todayCount, avgCount },
    severity: 'info',
    dedupeKey,
  });
}

export async function triggerPatternShiftNotification(
  context: TriggerContext,
  changeDescription: string,
  changeType: 'theme' | 'path'
): Promise<boolean> {
  if (!INTELLIGENCE_TIERS.includes(context.tier)) {
    return false;
  }

  const prefs = await storage.getNotificationPreferences(context.ownerId);
  if (prefs && !prefs.intelligenceAlertsEnabled) {
    return false;
  }

  const today = new Date().toISOString().split('T')[0];
  const dedupeKey = `pattern_shift_${context.businessSlug}_${today}`;

  return createNotification({
    userId: context.ownerId,
    orbitId: context.orbitId,
    type: 'pattern_shift',
    title: 'Pattern shift detected',
    body: changeDescription,
    actionUrl: `/orbit/${context.businessSlug}?hub=intelligence`,
    meta: { changeType },
    severity: 'important',
    dedupeKey,
  });
}

export async function triggerFrictionDetectedNotification(
  context: TriggerContext,
  boxId: number,
  boxTitle: string,
  stallRate: number
): Promise<boolean> {
  if (!INTELLIGENCE_TIERS.includes(context.tier)) {
    return false;
  }

  const prefs = await storage.getNotificationPreferences(context.ownerId);
  if (prefs && !prefs.intelligenceAlertsEnabled) {
    return false;
  }

  const today = new Date().toISOString().split('T')[0];
  const dedupeKey = `friction_detected_${context.businessSlug}_${today}`;

  return createNotification({
    userId: context.ownerId,
    orbitId: context.orbitId,
    type: 'friction_detected',
    title: 'Friction point detected',
    body: `Users are stalling at "${boxTitle}" - ${Math.round(stallRate * 100)}% drop-off`,
    actionUrl: `/orbit/${context.businessSlug}?hub=intelligence`,
    meta: { boxId, boxTitle, stallRate },
    severity: 'info',
    dedupeKey,
  });
}

export async function triggerHighPerformingIceNotification(
  context: TriggerContext,
  iceId: number,
  iceTitle: string,
  engagementScore: number
): Promise<boolean> {
  if (!INTELLIGENCE_TIERS.includes(context.tier)) {
    return false;
  }

  const prefs = await storage.getNotificationPreferences(context.ownerId);
  if (prefs && !prefs.iceAlertsEnabled) {
    return false;
  }

  const weekStart = getWeekStartDate();
  const dedupeKey = `high_performing_ice_${iceId}_${weekStart}`;

  return createNotification({
    userId: context.ownerId,
    orbitId: context.orbitId,
    type: 'high_performing_ice',
    title: 'Top performing ICE',
    body: `"${iceTitle}" is your top engaged experience this week`,
    actionUrl: `/orbit/${context.businessSlug}?hub=ice&ice=${iceId}`,
    meta: { iceId, iceTitle, engagementScore },
    severity: 'info',
    dedupeKey,
  });
}

function getWeekStartDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function generateMagicLinkToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createMagicLink(
  userId: number,
  orbitId: number,
  purpose: 'view_lead' | 'view_conversation' | 'view_intelligence' | 'view_ice',
  targetId?: number,
  expiryDays: number = 7
): Promise<string> {
  const token = generateMagicLinkToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  await storage.createMagicLink({
    token,
    userId,
    orbitId,
    purpose,
    targetId: targetId || null,
    expiresAt,
  });

  return token;
}

export async function validateMagicLink(
  token: string,
  expectedPurpose: string
): Promise<{ valid: boolean; userId?: number; orbitId?: number; targetId?: number; error?: string }> {
  const link = await storage.getMagicLink(token);

  if (!link) {
    return { valid: false, error: 'Invalid link' };
  }

  if (new Date() > link.expiresAt) {
    return { valid: false, error: 'Link expired' };
  }

  if (link.purpose !== expectedPurpose) {
    return { valid: false, error: 'Invalid link purpose' };
  }

  await storage.markMagicLinkUsed(token);

  return {
    valid: true,
    userId: link.userId,
    orbitId: link.orbitId,
    targetId: link.targetId || undefined,
  };
}

export async function getDefaultPreferences(tier: OrbitTier) {
  const isInsight = INSIGHT_TIERS.includes(tier);
  const isIntelligence = INTELLIGENCE_TIERS.includes(tier);

  return {
    emailEnabled: isInsight,
    emailCadence: 'daily_digest' as const,
    leadAlertsEnabled: isInsight,
    conversationAlertsEnabled: false,
    intelligenceAlertsEnabled: isIntelligence,
    iceAlertsEnabled: false,
    quietHoursEnabled: false,
  };
}
