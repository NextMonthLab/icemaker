import { storage } from './storage';
import type { Request, Response, NextFunction } from 'express';
import type { User, UserRole } from '@shared/schema';

export type EntitlementKey = 
  | 'canUseCloudLlm'
  | 'canGenerateImages'
  | 'canExport'
  | 'canUseCharacterChat'
  | 'collaborationRoles'
  | 'canCreateStory'
  | 'canCreateCharacter'
  | 'canUploadAudio'
  | 'canViewAnalytics'
  | 'canViewEngagement';

export interface FullEntitlements {
  canCreateStory: boolean;
  canCreateCharacter: boolean;
  canUploadAudio: boolean;
  canGenerateImages: boolean;
  canGenerateVideos: boolean;
  canExport: boolean;
  canUseCharacterChat: boolean;
  canUseCloudLlm: boolean;
  canViewAnalytics: boolean;
  canViewEngagement: boolean;
  maxUniverses: number;
  maxCardsPerStory: number;
  monthlyVideoCredits: number;
  monthlyVoiceCredits: number;
  planName: string;
  isAdmin: boolean;
  isCreator: boolean;
}

function detectTierFromSlug(slug: string | null | undefined): string {
  if (!slug) return 'free';
  const normalizedSlug = slug.toLowerCase();
  
  if (normalizedSlug.includes('business') || normalizedSlug.includes('enterprise')) {
    return 'business';
  }
  if (normalizedSlug.includes('pro') || normalizedSlug.includes('premium')) {
    return 'pro';
  }
  return 'free';
}

const TIER_DEFAULTS: Record<string, Partial<FullEntitlements>> = {
  free: {
    canCreateStory: true,
    canCreateCharacter: false,
    canUploadAudio: false,
    canGenerateImages: false,
    canGenerateVideos: false,
    canExport: false,
    canUseCharacterChat: false,
    canUseCloudLlm: false,
    canViewAnalytics: false,
    canViewEngagement: false, // Engagement metrics require Pro or Business
    maxUniverses: 1,
    maxCardsPerStory: 5,
    monthlyVideoCredits: 0,
    monthlyVoiceCredits: 0,
  },
  pro: {
    canCreateStory: true,
    canCreateCharacter: true,
    canUploadAudio: true,
    canGenerateImages: true,
    canGenerateVideos: false,
    canExport: true,
    canUseCharacterChat: true,
    canUseCloudLlm: true,
    canViewAnalytics: true,
    canViewEngagement: true,
    maxUniverses: -1,
    maxCardsPerStory: 50,
    monthlyVideoCredits: 0,
    monthlyVoiceCredits: 100,
  },
  business: {
    canCreateStory: true,
    canCreateCharacter: true,
    canUploadAudio: true,
    canGenerateImages: true,
    canGenerateVideos: true,
    canExport: true,
    canUseCharacterChat: true,
    canUseCloudLlm: true,
    canViewAnalytics: true,
    canViewEngagement: true,
    maxUniverses: -1,
    maxCardsPerStory: -1,
    monthlyVideoCredits: 50,
    monthlyVoiceCredits: 500,
  },
};

export async function getFullEntitlements(userId: number): Promise<FullEntitlements> {
  const user = await storage.getUser(userId);
  if (!user) {
    return getDefaultEntitlements();
  }
  
  if (user.role === 'admin' || user.isAdmin) {
    return getAdminEntitlements();
  }
  
  if (user.role === 'creator') {
    const creatorProfile = await storage.getCreatorProfile(userId);
    if (creatorProfile && creatorProfile.planId && creatorProfile.subscriptionStatus === 'active') {
      const plan = await storage.getPlan(creatorProfile.planId);
      if (plan) {
        const tierSlug = detectTierFromSlug(plan.slug);
        const tierDefaults = TIER_DEFAULTS[tierSlug] || TIER_DEFAULTS.free;
        const features = (plan.features as Record<string, any>) || {};
        
        return {
          canCreateStory: true,
          canCreateCharacter: features.canCreateCharacter ?? tierDefaults.canCreateCharacter ?? false,
          canUploadAudio: features.canUploadAudio ?? tierDefaults.canUploadAudio ?? false,
          canGenerateImages: features.canGenerateImages ?? tierDefaults.canGenerateImages ?? false,
          canGenerateVideos: features.canGenerateVideos ?? tierDefaults.canGenerateVideos ?? false,
          canExport: features.canExport ?? tierDefaults.canExport ?? false,
          canUseCharacterChat: features.canUseCharacterChat ?? tierDefaults.canUseCharacterChat ?? false,
          canUseCloudLlm: features.canUseCloudLlm ?? tierDefaults.canUseCloudLlm ?? false,
          canViewAnalytics: features.canViewAnalytics ?? tierDefaults.canViewAnalytics ?? false,
          canViewEngagement: features.canViewEngagement ?? tierDefaults.canViewEngagement ?? false,
          maxUniverses: features.maxUniverses ?? tierDefaults.maxUniverses ?? 1,
          maxCardsPerStory: features.maxCardsPerStory ?? tierDefaults.maxCardsPerStory ?? 5,
          monthlyVideoCredits: features.monthlyVideoCredits ?? tierDefaults.monthlyVideoCredits ?? 0,
          monthlyVoiceCredits: features.monthlyVoiceCredits ?? tierDefaults.monthlyVoiceCredits ?? 0,
          planName: plan.displayName,
          isAdmin: false,
          isCreator: true,
        };
      }
    }
    return getCreatorFreeEntitlements();
  }
  
  return getDefaultEntitlements();
}

function getAdminEntitlements(): FullEntitlements {
  return {
    canCreateStory: true,
    canCreateCharacter: true,
    canUploadAudio: true,
    canGenerateImages: true,
    canGenerateVideos: true,
    canExport: true,
    canUseCharacterChat: true,
    canUseCloudLlm: true,
    canViewAnalytics: true,
    canViewEngagement: true,
    maxUniverses: -1,
    maxCardsPerStory: -1,
    monthlyVideoCredits: -1,
    monthlyVoiceCredits: -1,
    planName: 'Admin',
    isAdmin: true,
    isCreator: true,
  };
}

function getCreatorFreeEntitlements(): FullEntitlements {
  return {
    canCreateStory: true,
    canCreateCharacter: false,
    canUploadAudio: false,
    canGenerateImages: false,
    canGenerateVideos: false,
    canExport: false,
    canUseCharacterChat: false,
    canUseCloudLlm: false,
    canViewAnalytics: false,
    canViewEngagement: false, // Engagement metrics require Pro or Business
    maxUniverses: 1,
    maxCardsPerStory: 5,
    monthlyVideoCredits: 0,
    monthlyVoiceCredits: 0,
    planName: 'Free',
    isAdmin: false,
    isCreator: true,
  };
}

function getDefaultEntitlements(): FullEntitlements {
  return {
    canCreateStory: false,
    canCreateCharacter: false,
    canUploadAudio: false,
    canGenerateImages: false,
    canGenerateVideos: false,
    canExport: false,
    canUseCharacterChat: false,
    canUseCloudLlm: false,
    canViewAnalytics: false,
    canViewEngagement: false,
    maxUniverses: 0,
    maxCardsPerStory: 0,
    monthlyVideoCredits: 0,
    monthlyVoiceCredits: 0,
    planName: 'Viewer',
    isAdmin: false,
    isCreator: false,
  };
}

export async function requireEntitlement(
  userId: number,
  key: EntitlementKey
): Promise<{ allowed: boolean; reason?: string }> {
  const entitlements = await getFullEntitlements(userId);
  
  const keyMap: Record<EntitlementKey, keyof FullEntitlements> = {
    canUseCloudLlm: 'canUseCloudLlm',
    canGenerateImages: 'canGenerateImages',
    canExport: 'canExport',
    canUseCharacterChat: 'canUseCharacterChat',
    collaborationRoles: 'isCreator',
    canCreateStory: 'canCreateStory',
    canCreateCharacter: 'canCreateCharacter',
    canUploadAudio: 'canUploadAudio',
    canViewAnalytics: 'canViewAnalytics',
    canViewEngagement: 'canViewEngagement',
  };
  
  const entitlementKey = keyMap[key];
  const allowed = entitlements[entitlementKey] === true;
  
  if (!allowed) {
    return { 
      allowed: false, 
      reason: `This feature requires a Pro or Business plan. Please upgrade to access.` 
    };
  }

  return { allowed: true };
}

export async function checkMaxCards(userId: number, currentCardCount: number): Promise<{ allowed: boolean; limit: number }> {
  const entitlements = await getFullEntitlements(userId);
  const limit = entitlements.maxCardsPerStory === -1 ? Infinity : entitlements.maxCardsPerStory;
  
  return {
    allowed: currentCardCount < limit,
    limit: entitlements.maxCardsPerStory
  };
}

export async function checkCredits(
  userId: number,
  creditType: 'video' | 'voice',
  amount: number = 1
): Promise<{ allowed: boolean; balance: number }> {
  const wallet = await storage.getCreditWallet(userId);
  const balance = creditType === 'video' ? wallet?.videoCredits || 0 : wallet?.voiceCredits || 0;
  
  return {
    allowed: balance >= amount,
    balance
  };
}

export function entitlementMiddleware(key: EntitlementKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await requireEntitlement((req.user as any).id, key);
    
    if (!result.allowed) {
      return res.status(403).json({ 
        message: result.reason,
        upgradeRequired: true,
        feature: key
      });
    }

    next();
  };
}

export function creditMiddleware(creditType: 'video' | 'voice', amount: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await checkCredits((req.user as any).id, creditType, amount);
    
    if (!result.allowed) {
      return res.status(403).json({ 
        message: `Insufficient ${creditType} credits. You have ${result.balance}, need ${amount}.`,
        creditsRequired: true,
        creditType,
        balance: result.balance,
        needed: amount
      });
    }

    next();
  };
}

export function requireCreatorOrAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = req.user as User;
    if (user.role === 'admin' || user.isAdmin || user.role === 'creator') {
      return next();
    }
    
    return res.status(403).json({ 
      message: 'Creator or Admin access required. Become a creator to access this feature.',
      becomeCreator: true
    });
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = req.user as User;
    if (user.isAdmin || allowedRoles.includes(user.role as UserRole)) {
      return next();
    }
    
    return res.status(403).json({ 
      message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
    });
  };
}
