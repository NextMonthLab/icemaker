/**
 * Video Engine Gating Configuration
 * 
 * Implements plan-based gating for AI video generation models.
 * Users see friendly engine names (Auto/Standard/Advanced/Studio-grade)
 * rather than confusing provider model names.
 */

export type PlanTier = 'free' | 'pro' | 'business' | 'admin';

export type VideoEngine = 'auto' | 'standard' | 'advanced' | 'studio';

export type VideoProviderModel = 
  | 'kling-v1.6-standard'
  | 'kling-v1.6-pro'
  | 'minimax-video'
  | 'haiper-video-2';

export interface VideoModelConfig {
  id: VideoProviderModel;
  name: string;
  description: string;
  provider: 'replicate';
  costPer5s: number;
  quality: 'budget' | 'standard' | 'pro' | 'studio';
}

export interface VideoEngineConfig {
  id: VideoEngine;
  name: string;
  description: string;
  defaultModel: VideoProviderModel;
  allowedModels: VideoProviderModel[];
}

export const VIDEO_MODELS: Record<VideoProviderModel, VideoModelConfig> = {
  'kling-v1.6-standard': {
    id: 'kling-v1.6-standard',
    name: 'Kling 1.6 Standard',
    description: 'High quality, reliable generation',
    provider: 'replicate',
    costPer5s: 1.40,
    quality: 'standard',
  },
  'kling-v1.6-pro': {
    id: 'kling-v1.6-pro',
    name: 'Kling 1.6 Pro',
    description: 'Professional quality, enhanced realism',
    provider: 'replicate',
    costPer5s: 2.00,
    quality: 'pro',
  },
  'minimax-video': {
    id: 'minimax-video',
    name: 'Minimax Video',
    description: 'Excellent quality, smooth motion',
    provider: 'replicate',
    costPer5s: 1.00,
    quality: 'studio',
  },
  'haiper-video-2': {
    id: 'haiper-video-2',
    name: 'Haiper Video 2',
    description: 'Fast budget option',
    provider: 'replicate',
    costPer5s: 0.25,
    quality: 'budget',
  },
};

export const VIDEO_ENGINES: Record<VideoEngine, VideoEngineConfig> = {
  'auto': {
    id: 'auto',
    name: 'Auto (Best for your plan)',
    description: 'Automatically selects the best available engine',
    defaultModel: 'kling-v1.6-standard',
    allowedModels: ['kling-v1.6-standard', 'kling-v1.6-pro', 'minimax-video', 'haiper-video-2'],
  },
  'standard': {
    id: 'standard',
    name: 'Standard',
    description: 'Reliable quality for everyday content',
    defaultModel: 'kling-v1.6-standard',
    allowedModels: ['kling-v1.6-standard'],
  },
  'advanced': {
    id: 'advanced',
    name: 'Advanced',
    description: 'Enhanced realism and motion quality',
    defaultModel: 'kling-v1.6-pro',
    allowedModels: ['kling-v1.6-pro'],
  },
  'studio': {
    id: 'studio',
    name: 'Studio-grade',
    description: 'Premium quality for professional productions',
    defaultModel: 'minimax-video',
    allowedModels: ['minimax-video', 'haiper-video-2'],
  },
};

export const PLAN_VIDEO_ACCESS: Record<PlanTier, {
  allowedModels: VideoProviderModel[];
  allowedEngines: VideoEngine[];
  canChooseProvider: boolean;
  defaultEngine: VideoEngine;
  autoModel: VideoProviderModel;
}> = {
  'free': {
    allowedModels: ['kling-v1.6-standard'],
    allowedEngines: ['auto', 'standard'],
    canChooseProvider: false,
    defaultEngine: 'auto',
    autoModel: 'kling-v1.6-standard',
  },
  'pro': {
    allowedModels: ['kling-v1.6-standard', 'kling-v1.6-pro'],
    allowedEngines: ['auto', 'standard', 'advanced'],
    canChooseProvider: true,
    defaultEngine: 'auto',
    autoModel: 'kling-v1.6-pro',
  },
  'business': {
    allowedModels: ['kling-v1.6-standard', 'kling-v1.6-pro', 'minimax-video', 'haiper-video-2'],
    allowedEngines: ['auto', 'standard', 'advanced', 'studio'],
    canChooseProvider: true,
    defaultEngine: 'auto',
    autoModel: 'minimax-video',
  },
  'admin': {
    allowedModels: ['kling-v1.6-standard', 'kling-v1.6-pro', 'minimax-video', 'haiper-video-2'],
    allowedEngines: ['auto', 'standard', 'advanced', 'studio'],
    canChooseProvider: true,
    defaultEngine: 'auto',
    autoModel: 'minimax-video',
  },
};

export interface VideoGatingResult {
  allowed: boolean;
  resolvedModel: VideoProviderModel;
  reason?: string;
  upgradeRequired?: boolean;
  suggestedTier?: PlanTier;
  allowedEngines?: VideoEngine[];
}

/**
 * Get allowed video models for a plan tier
 */
export function getAllowedVideoModels(planTier: PlanTier): VideoModelConfig[] {
  const access = PLAN_VIDEO_ACCESS[planTier] || PLAN_VIDEO_ACCESS.free;
  return access.allowedModels.map(id => VIDEO_MODELS[id]);
}

/**
 * Get allowed video engines for a plan tier
 */
export function getAllowedVideoEngines(planTier: PlanTier): VideoEngineConfig[] {
  const access = PLAN_VIDEO_ACCESS[planTier] || PLAN_VIDEO_ACCESS.free;
  return access.allowedEngines.map(id => VIDEO_ENGINES[id]);
}

/**
 * Check if a plan tier can choose provider models directly
 */
export function canChooseProvider(planTier: PlanTier): boolean {
  const access = PLAN_VIDEO_ACCESS[planTier] || PLAN_VIDEO_ACCESS.free;
  return access.canChooseProvider;
}

/**
 * Resolve the auto model for a plan tier
 */
export function resolveAutoVideoModel(
  planTier: PlanTier,
  _duration?: number,
  _mode?: string,
  preferredModel?: VideoProviderModel
): VideoProviderModel {
  const access = PLAN_VIDEO_ACCESS[planTier] || PLAN_VIDEO_ACCESS.free;
  
  if (preferredModel && access.allowedModels.includes(preferredModel)) {
    return preferredModel;
  }
  
  return access.autoModel;
}

/**
 * Get the suggested upgrade tier for accessing a model
 */
function getSuggestedTierForModel(model: VideoProviderModel): PlanTier {
  if (model === 'minimax-video' || model === 'haiper-video-2') {
    return 'business';
  }
  if (model === 'kling-v1.6-pro') {
    return 'pro';
  }
  return 'free';
}

/**
 * Check if a value is a valid VideoProviderModel
 */
export function isValidVideoModel(model: string): model is VideoProviderModel {
  return model in VIDEO_MODELS;
}

/**
 * Check if a value is a valid VideoEngine
 */
export function isValidVideoEngine(engine: string): engine is VideoEngine {
  return engine in VIDEO_ENGINES;
}

/**
 * Validate and resolve a video generation request
 */
export function validateVideoRequest(
  planTier: PlanTier,
  requestedEngine?: string,
  requestedModel?: string,
  duration?: number,
  mode?: string
): VideoGatingResult {
  const access = PLAN_VIDEO_ACCESS[planTier] || PLAN_VIDEO_ACCESS.free;
  
  // Validate requested model if provided
  if (requestedModel) {
    // Check if it's a valid model
    if (!isValidVideoModel(requestedModel)) {
      return {
        allowed: false,
        resolvedModel: access.autoModel,
        reason: `Unknown video model: ${requestedModel}`,
        upgradeRequired: false,
        allowedEngines: access.allowedEngines,
      };
    }
    
    if (!access.allowedModels.includes(requestedModel)) {
      const suggestedTier = getSuggestedTierForModel(requestedModel);
      return {
        allowed: false,
        resolvedModel: access.autoModel,
        reason: `${VIDEO_MODELS[requestedModel].name} requires a ${suggestedTier} plan or higher`,
        upgradeRequired: true,
        suggestedTier,
        allowedEngines: access.allowedEngines,
      };
    }
    return {
      allowed: true,
      resolvedModel: requestedModel,
    };
  }
  
  // Validate requested engine if provided
  if (requestedEngine && requestedEngine !== 'auto') {
    // Check if it's a valid engine
    if (!isValidVideoEngine(requestedEngine)) {
      return {
        allowed: false,
        resolvedModel: access.autoModel,
        reason: `Unknown video engine: ${requestedEngine}`,
        upgradeRequired: false,
        allowedEngines: access.allowedEngines,
      };
    }
    
    if (!access.allowedEngines.includes(requestedEngine)) {
      const engineConfig = VIDEO_ENGINES[requestedEngine];
      const requiredModel = engineConfig.defaultModel;
      const suggestedTier = getSuggestedTierForModel(requiredModel);
      return {
        allowed: false,
        resolvedModel: access.autoModel,
        reason: `${engineConfig.name} engine requires a ${suggestedTier} plan or higher`,
        upgradeRequired: true,
        suggestedTier,
        allowedEngines: access.allowedEngines,
      };
    }
    
    const engineConfig = VIDEO_ENGINES[requestedEngine];
    const resolvedModel = engineConfig.allowedModels.find(m => access.allowedModels.includes(m)) 
      || engineConfig.defaultModel;
    
    if (!access.allowedModels.includes(resolvedModel)) {
      const suggestedTier = getSuggestedTierForModel(resolvedModel);
      return {
        allowed: false,
        resolvedModel: access.autoModel,
        reason: `Selected engine requires a ${suggestedTier} plan or higher`,
        upgradeRequired: true,
        suggestedTier,
        allowedEngines: access.allowedEngines,
      };
    }
    
    return {
      allowed: true,
      resolvedModel,
    };
  }
  
  const autoModel = resolveAutoVideoModel(planTier, duration, mode);
  return {
    allowed: true,
    resolvedModel: autoModel,
  };
}

/**
 * Get video engine configuration for the client
 */
export function getVideoEngineClientConfig(planTier: PlanTier) {
  const access = PLAN_VIDEO_ACCESS[planTier] || PLAN_VIDEO_ACCESS.free;
  
  return {
    planTier,
    defaultEngine: access.defaultEngine,
    canChooseProvider: access.canChooseProvider,
    engines: Object.values(VIDEO_ENGINES).map(engine => ({
      id: engine.id,
      name: engine.name,
      description: engine.description,
      locked: !access.allowedEngines.includes(engine.id),
      requiredTier: engine.id === 'studio' ? 'business' : engine.id === 'advanced' ? 'pro' : 'free',
      poweredBy: VIDEO_MODELS[engine.defaultModel]?.name || '',
    })),
    models: access.allowedModels.map(id => ({
      id,
      name: VIDEO_MODELS[id].name,
      description: VIDEO_MODELS[id].description,
      costPer5s: VIDEO_MODELS[id].costPer5s,
    })),
    allModels: Object.values(VIDEO_MODELS).map(model => ({
      id: model.id,
      name: model.name,
      description: model.description,
      costPer5s: model.costPer5s,
      locked: !access.allowedModels.includes(model.id),
      requiredTier: getSuggestedTierForModel(model.id),
    })),
  };
}
