/**
 * Video Engine Configuration and Plan-Based Gating
 *
 * Defines user-facing video engines, their underlying models,
 * and plan-based access rules.
 */

export type VideoEngine = 'auto' | 'standard' | 'advanced' | 'studio';
export type VideoModel =
  | 'kling-v1.6-standard'
  | 'kling-v1.6-pro'
  | 'minimax-video'
  | 'haiper-video-2';

export type PlanTier = 'free' | 'pro' | 'business' | 'starter';

export interface VideoEngineConfig {
  engine: VideoEngine;
  displayName: string;
  description: string;
  models: VideoModel[];
  minPlanTier: PlanTier;
  costMultiplier: number; // Relative cost compared to standard
}

export interface VideoModelConfig {
  model: VideoModel;
  provider: 'replicate';
  displayName: string;
  description: string;
  costPer5s: number; // USD per 5 seconds
  supportedDurations: number[]; // Supported durations in seconds
  minPlanTier: PlanTier;
}

/**
 * Video model configurations with pricing and access rules
 */
export const VIDEO_MODELS: Record<VideoModel, VideoModelConfig> = {
  'kling-v1.6-standard': {
    model: 'kling-v1.6-standard',
    provider: 'replicate',
    displayName: 'Kling 1.6 Standard',
    description: 'Good quality, reliable generation',
    costPer5s: 1.40,
    supportedDurations: [5, 10],
    minPlanTier: 'free',
  },
  'kling-v1.6-pro': {
    model: 'kling-v1.6-pro',
    provider: 'replicate',
    displayName: 'Kling 1.6 Pro',
    description: 'Higher quality, smoother motion',
    costPer5s: 2.00,
    supportedDurations: [5, 10],
    minPlanTier: 'pro',
  },
  'minimax-video': {
    model: 'minimax-video',
    provider: 'replicate',
    displayName: 'Minimax Video',
    description: 'Studio-grade realism and detail',
    costPer5s: 1.00,
    supportedDurations: [5, 10],
    minPlanTier: 'business',
  },
  'haiper-video-2': {
    model: 'haiper-video-2',
    provider: 'replicate',
    displayName: 'Haiper Video 2',
    description: 'Studio-grade, budget-friendly option',
    costPer5s: 0.25,
    supportedDurations: [5, 10],
    minPlanTier: 'business',
  },
};

/**
 * User-facing engine configurations
 */
export const VIDEO_ENGINES: Record<VideoEngine, VideoEngineConfig> = {
  auto: {
    engine: 'auto',
    displayName: 'Auto (Best for your plan)',
    description: 'Automatically selects the best model for your plan',
    models: Object.keys(VIDEO_MODELS) as VideoModel[],
    minPlanTier: 'free',
    costMultiplier: 1.0,
  },
  standard: {
    engine: 'standard',
    displayName: 'Standard',
    description: 'Good quality video generation',
    models: ['kling-v1.6-standard'],
    minPlanTier: 'free',
    costMultiplier: 1.0,
  },
  advanced: {
    engine: 'advanced',
    displayName: 'Advanced',
    description: 'Higher quality with improved motion',
    models: ['kling-v1.6-pro'],
    minPlanTier: 'pro',
    costMultiplier: 1.43,
  },
  studio: {
    engine: 'studio',
    displayName: 'Studio-grade',
    description: 'Premium quality with maximum realism',
    models: ['minimax-video', 'haiper-video-2'],
    minPlanTier: 'business',
    costMultiplier: 0.71, // Haiper is cheaper, Minimax is mid-range
  },
};

/**
 * Plan tier hierarchy for comparison
 */
const PLAN_TIER_HIERARCHY: Record<PlanTier, number> = {
  free: 0,
  starter: 0,
  pro: 1,
  business: 2,
};

/**
 * Normalize plan names to standard tiers
 */
export function normalizePlanTier(planName: string | undefined): PlanTier {
  if (!planName) return 'free';

  const normalized = planName.toLowerCase();

  if (normalized.includes('business') || normalized.includes('studio')) {
    return 'business';
  }
  if (normalized.includes('pro') || normalized.includes('creator')) {
    return 'pro';
  }
  if (normalized.includes('starter')) {
    return 'starter';
  }

  return 'free';
}

/**
 * Check if a plan tier has access to a specific tier requirement
 */
function hasAccessToTier(userTier: PlanTier, requiredTier: PlanTier): boolean {
  return PLAN_TIER_HIERARCHY[userTier] >= PLAN_TIER_HIERARCHY[requiredTier];
}

/**
 * Get all video models allowed for a specific plan tier
 */
export function getAllowedVideoModels(planTier: PlanTier): VideoModel[] {
  return (Object.keys(VIDEO_MODELS) as VideoModel[]).filter((model) => {
    const config = VIDEO_MODELS[model];
    return hasAccessToTier(planTier, config.minPlanTier);
  });
}

/**
 * Get all video engines allowed for a specific plan tier
 */
export function getAllowedVideoEngines(planTier: PlanTier): VideoEngine[] {
  return (Object.keys(VIDEO_ENGINES) as VideoEngine[]).filter((engine) => {
    const config = VIDEO_ENGINES[engine];
    return hasAccessToTier(planTier, config.minPlanTier);
  });
}

/**
 * Check if a specific model is allowed for a plan tier
 */
export function isModelAllowedForPlan(model: VideoModel, planTier: PlanTier): boolean {
  const modelConfig = VIDEO_MODELS[model];
  if (!modelConfig) return false;

  return hasAccessToTier(planTier, modelConfig.minPlanTier);
}

/**
 * Check if a specific engine is allowed for a plan tier
 */
export function isEngineAllowedForPlan(engine: VideoEngine, planTier: PlanTier): boolean {
  const engineConfig = VIDEO_ENGINES[engine];
  if (!engineConfig) return false;

  return hasAccessToTier(planTier, engineConfig.minPlanTier);
}

/**
 * Resolve the best video model for "auto" mode
 *
 * Selection logic:
 * - Prefers the highest quality model allowed for the user's plan
 * - Considers duration constraints (some models may not support longer durations)
 * - Falls back to kling-v1.6-standard if nothing else is available
 */
export function resolveAutoVideoModel(
  planTier: PlanTier,
  duration: number = 5,
  mode: 'text-to-video' | 'image-to-video' = 'text-to-video',
  userPreference?: VideoModel
): VideoModel {
  // If user has a preference and it's allowed, use it
  if (userPreference && isModelAllowedForPlan(userPreference, planTier)) {
    const modelConfig = VIDEO_MODELS[userPreference];
    if (modelConfig.supportedDurations.includes(duration)) {
      return userPreference;
    }
  }

  const allowedModels = getAllowedVideoModels(planTier);

  // Filter by supported duration
  const compatibleModels = allowedModels.filter((model) => {
    const config = VIDEO_MODELS[model];
    return config.supportedDurations.includes(duration);
  });

  if (compatibleModels.length === 0) {
    // Fallback to standard if nothing supports the duration
    return 'kling-v1.6-standard';
  }

  // Priority order: business tier prefers Kling Pro > Minimax > Haiper
  // Pro tier gets Kling Pro
  // Free/Starter get Kling Standard

  if (planTier === 'business') {
    // Business users get best available
    if (compatibleModels.includes('kling-v1.6-pro')) {
      return 'kling-v1.6-pro';
    }
    if (compatibleModels.includes('minimax-video')) {
      return 'minimax-video';
    }
    if (compatibleModels.includes('haiper-video-2')) {
      return 'haiper-video-2';
    }
  }

  if (planTier === 'pro') {
    // Pro users get Kling Pro if available
    if (compatibleModels.includes('kling-v1.6-pro')) {
      return 'kling-v1.6-pro';
    }
  }

  // Default to standard for everyone
  return 'kling-v1.6-standard';
}

/**
 * Get suggested upgrade tier for accessing a specific model
 */
export function getSuggestedUpgradeTier(model: VideoModel): PlanTier {
  const modelConfig = VIDEO_MODELS[model];
  return modelConfig.minPlanTier;
}

/**
 * Get suggested upgrade tier for accessing a specific engine
 */
export function getSuggestedUpgradeTierForEngine(engine: VideoEngine): PlanTier {
  const engineConfig = VIDEO_ENGINES[engine];
  return engineConfig.minPlanTier;
}

/**
 * Estimate cost for a video generation
 */
export function estimateVideoCost(
  model: VideoModel,
  duration: number
): number {
  const modelConfig = VIDEO_MODELS[model];
  if (!modelConfig) return 0;

  // Calculate cost based on duration
  const units = Math.ceil(duration / 5); // Each 5s is one unit
  return modelConfig.costPer5s * units;
}

/**
 * Get the best model from an engine based on plan
 */
export function getModelForEngine(
  engine: VideoEngine,
  planTier: PlanTier,
  duration: number = 5
): VideoModel {
  if (engine === 'auto') {
    return resolveAutoVideoModel(planTier, duration);
  }

  const engineConfig = VIDEO_ENGINES[engine];
  if (!engineConfig) {
    return 'kling-v1.6-standard';
  }

  // Get allowed models for this plan
  const allowedModels = getAllowedVideoModels(planTier);

  // Find the first model from the engine that the user can access
  const availableModel = engineConfig.models.find((model) =>
    allowedModels.includes(model)
  );

  return availableModel || 'kling-v1.6-standard';
}

/**
 * Get maximum allowed duration for a plan tier
 * This can be used for future duration gating
 */
export function getMaxDurationForPlan(planTier: PlanTier): number {
  switch (planTier) {
    case 'free':
    case 'starter':
      return 5; // 5s max for free/starter
    case 'pro':
      return 10; // 10s max for pro
    case 'business':
      return 10; // 10s max for business (can increase to 15s if needed)
    default:
      return 5;
  }
}

/**
 * Validate if a duration is allowed for a plan tier
 */
export function isDurationAllowedForPlan(duration: number, planTier: PlanTier): boolean {
  return duration <= getMaxDurationForPlan(planTier);
}
