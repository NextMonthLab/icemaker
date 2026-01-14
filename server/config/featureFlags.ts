/**
 * Feature Flags & Kill-Switches for NextMonth
 * 
 * PRINCIPLE: Cost-aware operation with instant kill-switches for expensive features.
 * All flags can be overridden by environment variables for runtime control.
 */

export const featureFlags = {
  notifications: {
    enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
    emailDigestsEnabled: process.env.EMAIL_DIGESTS_ENABLED !== 'false',
  },

  magicLinks: {
    enabled: process.env.MAGIC_LINKS_ENABLED !== 'false',
    expiryDays: parseInt(process.env.MAGIC_LINK_EXPIRY_DAYS || '7', 10),
  },

  iceGeneration: {
    enabled: process.env.ICE_GENERATION_ENABLED !== 'false',
    videoGenerationEnabled: process.env.VIDEO_GENERATION_ENABLED !== 'false',
    maxVideoScenes: parseInt(process.env.MAX_VIDEO_SCENES || '4', 10),
  },

  ai: {
    chatEnabled: process.env.AI_CHAT_ENABLED !== 'false',
    imageGenerationEnabled: process.env.AI_IMAGE_GENERATION_ENABLED !== 'false',
    ttsEnabled: process.env.AI_TTS_ENABLED !== 'false',
  },

  // Orbit features: DISABLED for IceMaker v1 (ICE-first strategy)
  // Schema tables exist but API/UI abandoned mid-development
  // Re-enable via ORBIT_ENABLED=true if needed for internal testing
  orbit: {
    enabled: process.env.ORBIT_ENABLED === 'true', // Default: false
    smartGlassesEnabled: process.env.ORBIT_SMARTGLASSES_ENABLED === 'true',
  },

  softLaunch: {
    inviteOnlyMode: process.env.INVITE_ONLY_MODE === 'true',
    allowedDomains: (process.env.ALLOWED_DOMAINS || '').split(',').filter(Boolean),
    maxNewOrbitsPerDay: parseInt(process.env.MAX_NEW_ORBITS_PER_DAY || '100', 10),
  },
} as const;

export const costLimits = {
  freeConversationLimit: parseInt(process.env.FREE_CONVERSATION_LIMIT || '50', 10),
  freeConversationSoftLimit: parseInt(process.env.FREE_CONVERSATION_SOFT_LIMIT || '40', 10),
  
  dailyApiCallLimit: parseInt(process.env.DAILY_API_CALL_LIMIT || '10000', 10),
  dailyVideoGenerationLimit: parseInt(process.env.DAILY_VIDEO_GENERATION_LIMIT || '100', 10),
  dailyImageGenerationLimit: parseInt(process.env.DAILY_IMAGE_GENERATION_LIMIT || '1000', 10),
  
  maxCreditsPerPurchase: parseInt(process.env.MAX_CREDITS_PER_PURCHASE || '50', 10),
  maxConcurrentIceJobs: parseInt(process.env.MAX_CONCURRENT_ICE_JOBS || '10', 10),
} as const;

export const killSwitches = {
  emergencyStop: process.env.EMERGENCY_STOP === 'true',
  stopVideoGeneration: process.env.STOP_VIDEO_GENERATION === 'true',
  stopImageGeneration: process.env.STOP_IMAGE_GENERATION === 'true',
  stopAiChat: process.env.STOP_AI_CHAT === 'true',
  stopNewOrbits: process.env.STOP_NEW_ORBITS === 'true',
} as const;

export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  if (killSwitches.emergencyStop) {
    return false;
  }
  
  const config = featureFlags[feature];
  return 'enabled' in config ? config.enabled : true;
}

export function canGenerateVideo(): boolean {
  return !killSwitches.emergencyStop && 
         !killSwitches.stopVideoGeneration && 
         featureFlags.iceGeneration.videoGenerationEnabled;
}

export function canGenerateImage(): boolean {
  return !killSwitches.emergencyStop && 
         !killSwitches.stopImageGeneration && 
         featureFlags.ai.imageGenerationEnabled;
}

export function canUseAiChat(): boolean {
  return !killSwitches.emergencyStop && 
         !killSwitches.stopAiChat && 
         featureFlags.ai.chatEnabled;
}

export function canCreateNewOrbit(): boolean {
  return !killSwitches.emergencyStop && 
         !killSwitches.stopNewOrbits;
}

export function log(context: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${context}] ${message}`, data ? JSON.stringify(data) : '');
}

export function logCostEvent(
  event: 'video_generated' | 'image_generated' | 'ai_chat_used' | 'credits_consumed',
  userId: number,
  orbitId: number,
  details: Record<string, unknown>
): void {
  log('cost-event', event, { userId, orbitId, ...details });
}
