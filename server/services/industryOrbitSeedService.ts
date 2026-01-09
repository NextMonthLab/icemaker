import { z } from "zod";
import { storage } from "../storage";
import type { 
  InsertIndustryEntity,
  InsertIndustryProduct,
  InsertProductSpec,
  InsertIndustryReview,
  InsertCommunityLink,
  InsertTopicTile,
  InsertPulseSource,
  InsertCoreConcept,
  EntitySocialUrls,
  ProductMediaRefs,
  TileEvidenceRefs,
  CpacUiDefaults,
  CpacGovernance,
  CpacMonitoringRules
} from "@shared/schema";

// CPAC-compatible schemas

const coreConceptSchema = z.object({
  id: z.string(),
  label: z.string(),
  whyItMatters: z.string().optional(),
  why_it_matters: z.string().optional(), // snake_case alias
  starterQuestions: z.array(z.string()).optional(),
  starter_questions: z.array(z.string()).optional(), // snake_case alias
  intentTags: z.array(z.string()).optional(),
  intent_tags: z.array(z.string()).optional(), // snake_case alias
});

const socialUrlsSchema = z.object({
  x: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
}).optional();

const entitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  entityType: z.string().optional(),
  entity_type: z.string().optional(), // snake_case alias
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  website_url: z.string().optional(), // snake_case alias
  regionTags: z.array(z.string()).optional(),
  region_tags: z.array(z.string()).optional(), // snake_case alias
  trustLevel: z.string().optional(),
  trust_level: z.string().optional(), // snake_case alias
  // CPAC additions
  logoAssetRef: z.string().nullable().optional(),
  logo_asset_ref: z.string().nullable().optional(),
  socialUrls: socialUrlsSchema,
  social_urls: socialUrlsSchema,
  notes: z.string().optional(),
});

const productSpecSchema = z.object({
  specKey: z.string().optional(),
  spec_key: z.string().optional(),
  specValue: z.string().optional(),
  spec_value: z.string().optional(),
  specUnit: z.string().nullable().optional(),
  spec_unit: z.string().nullable().optional(),
  sourceUrl: z.string().optional(),
  source_url: z.string().optional(),
  lastVerifiedAt: z.string().nullable().optional(),
  last_verified_at: z.string().nullable().optional(),
});

const mediaRefsSchema = z.object({
  imageAssetRefs: z.array(z.string()).optional(),
  image_asset_refs: z.array(z.string()).optional(),
  videoAssetRefs: z.array(z.string()).optional(),
  video_asset_refs: z.array(z.string()).optional(),
}).optional();

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  manufacturerName: z.string().optional(),
  manufacturer_name: z.string().optional(),
  manufacturerEntityId: z.string().optional(),
  manufacturer_entity_id: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  releaseDate: z.string().nullable().optional(),
  release_date: z.string().nullable().optional(),
  primaryUrl: z.string().optional(),
  primary_url: z.string().optional(),
  summary: z.string().optional(),
  heroAssetRef: z.string().nullable().optional(),
  hero_asset_ref: z.string().nullable().optional(),
  // CPAC additions
  mediaRefs: mediaRefsSchema,
  media_refs: mediaRefsSchema,
  referenceUrls: z.array(z.string()).optional(),
  reference_urls: z.array(z.string()).optional(),
  intentTags: z.array(z.string()).optional(),
  intent_tags: z.array(z.string()).optional(),
  specs: z.array(productSpecSchema).optional(),
});

const reviewSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  url: z.string(),
  productName: z.string().optional(),
  product_name: z.string().optional(),
  productId: z.string().optional(),
  product_id: z.string().optional(),
  reviewerName: z.string().optional(),
  reviewer_name: z.string().optional(),
  reviewerEntityId: z.string().optional(),
  reviewer_entity_id: z.string().optional(),
  publishedAt: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  ratingValue: z.number().nullable().optional(),
  rating_value: z.number().nullable().optional(),
  ratingScale: z.number().nullable().optional(),
  rating_scale: z.number().nullable().optional(),
  summary: z.string().optional(),
  sentiment: z.enum(["positive", "negative", "mixed", "unknown"]).optional(),
});

const communitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  url: z.string(),
  communityType: z.string().optional(),
  community_type: z.string().optional(),
  notes: z.string().optional(),
  // CPAC addition
  regionTags: z.array(z.string()).optional(),
  region_tags: z.array(z.string()).optional(),
});

const evidenceRefsSchema = z.object({
  productIds: z.array(z.string()).optional(),
  product_ids: z.array(z.string()).optional(),
  entityIds: z.array(z.string()).optional(),
  entity_ids: z.array(z.string()).optional(),
  communityIds: z.array(z.string()).optional(),
  community_ids: z.array(z.string()).optional(),
}).optional();

const tileSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  sublabel: z.string().optional(),
  intentTags: z.array(z.string()).optional(),
  intent_tags: z.array(z.string()).optional(),
  priority: z.number().optional(),
  badgeState: z.object({
    new: z.boolean().optional(),
    trending: z.boolean().optional(),
    debated: z.boolean().optional(),
    updatedRecently: z.boolean().optional(),
  }).optional(),
  // CPAC addition
  evidenceRefs: evidenceRefsSchema,
  evidence_refs: evidenceRefsSchema,
});

const pulseSourceSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  sourceType: z.string().optional(),
  source_type: z.string().optional(),
  url: z.string(),
  rssUrl: z.string().nullable().optional(),
  rss_url: z.string().nullable().optional(),
  monitoringMethod: z.string().optional(),
  monitoring_method: z.string().optional(),
  updateFrequency: z.string().optional(),
  update_frequency: z.string().optional(),
  trustLevel: z.string().optional(),
  trust_level: z.string().optional(),
  eventTypes: z.array(z.string()).optional(),
  event_types: z.array(z.string()).optional(),
  isEnabled: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  // CPAC additions
  keywordTriggers: z.array(z.string()).optional(),
  keyword_triggers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const assetSchema = z.object({
  assetRef: z.string().optional(),
  asset_ref: z.string().optional(),
  assetType: z.string().optional(),
  asset_type: z.string().optional(),
  title: z.string().optional(),
  sourceUrl: z.string().optional(),
  source_url: z.string().optional(),
  licensing: z.object({
    status: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

// Orbit configuration from CPAC
const orbitConfigSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  regionFocus: z.array(z.string()).optional(),
  region_focus: z.array(z.string()).optional(),
  language: z.string().optional(),
  orbitType: z.string().optional(),
  orbit_type: z.string().optional(),
  visibility: z.string().optional(),
  tags: z.array(z.string()).optional(),
  uiDefaults: z.object({
    showProofOfLife: z.boolean().optional(),
    show_proof_of_life: z.boolean().optional(),
    proofOfLifeMode: z.string().optional(),
    proof_of_life_mode: z.string().optional(),
    enableAmbientTileMotion: z.boolean().optional(),
    enable_ambient_tile_motion: z.boolean().optional(),
    enableIntentGravity: z.boolean().optional(),
    enable_intent_gravity: z.boolean().optional(),
    enableEvidenceArtefacts: z.boolean().optional(),
    enable_evidence_artefacts: z.boolean().optional(),
  }).optional(),
  ui_defaults: z.object({
    show_proof_of_life: z.boolean().optional(),
    proof_of_life_mode: z.string().optional(),
    enable_ambient_tile_motion: z.boolean().optional(),
    enable_intent_gravity: z.boolean().optional(),
    enable_evidence_artefacts: z.boolean().optional(),
  }).optional(),
}).optional();

// Seed pack section from CPAC
const seedPackSectionSchema = z.object({
  coreConcepts: z.array(coreConceptSchema).optional(),
  core_concepts: z.array(coreConceptSchema).optional(),
  starterTiles: z.array(tileSchema).optional(),
  starter_tiles: z.array(tileSchema).optional(),
}).optional();

// Pulse section from CPAC
const pulseSectionSchema = z.object({
  sources: z.array(pulseSourceSchema).optional(),
  monitoringRules: z.object({
    dedupeRules: z.array(z.string()).optional(),
    dedupe_rules: z.array(z.string()).optional(),
    importanceScoring: z.array(z.any()).optional(),
    importance_scoring: z.array(z.any()).optional(),
    extractionHints: z.object({
      preferSelectors: z.array(z.string()).optional(),
      prefer_selectors: z.array(z.string()).optional(),
      ignoreSelectors: z.array(z.string()).optional(),
      ignore_selectors: z.array(z.string()).optional(),
    }).optional(),
    extraction_hints: z.any().optional(),
  }).optional(),
  monitoring_rules: z.any().optional(),
}).optional();

// Governance section from CPAC
const governanceSectionSchema = z.object({
  neutrality: z.object({
    isUnowned: z.boolean().optional(),
    is_unowned: z.boolean().optional(),
    sponsorsDoNotInfluenceIntelligence: z.boolean().optional(),
    sponsors_do_not_influence_intelligence: z.boolean().optional(),
    influencersDoNotPublishConclusions: z.boolean().optional(),
    influencers_do_not_publish_conclusions: z.boolean().optional(),
  }).optional(),
  dataQuality: z.object({
    doNotInventRss: z.boolean().optional(),
    do_not_invent_rss: z.boolean().optional(),
    requireSourceUrlForSpecs: z.boolean().optional(),
    require_source_url_for_specs: z.boolean().optional(),
    avoidFakeNumbers: z.boolean().optional(),
    avoid_fake_numbers: z.boolean().optional(),
  }).optional(),
  data_quality: z.any().optional(),
}).optional();

// Full CPAC schema (supports both CPAC format and legacy format)
export const seedPackSchema = z.object({
  // CPAC metadata
  cpacVersion: z.string().optional(),
  cpac_version: z.string().optional(),
  packType: z.string().optional(),
  pack_type: z.string().optional(),
  generatedAt: z.string().optional(),
  generated_at: z.string().optional(),
  sourceAgent: z.object({
    name: z.string(),
    model: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  source_agent: z.object({
    name: z.string(),
    model: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  
  // CPAC orbit config
  orbit: orbitConfigSchema,
  
  // CPAC seed pack section
  seedPack: seedPackSectionSchema,
  seed_pack: seedPackSectionSchema,
  
  // Legacy format fields
  version: z.string().optional(),
  orbitSlug: z.string().optional(),
  
  // Main data arrays (both CPAC and legacy)
  entities: z.array(entitySchema).optional(),
  products: z.array(productSchema).optional(),
  reviews: z.array(reviewSchema).optional(),
  communities: z.array(communitySchema).optional(),
  tiles: z.array(tileSchema).optional(), // Legacy
  assets: z.array(assetSchema).optional(),
  
  // Pulse (CPAC format)
  pulse: pulseSectionSchema,
  pulseSources: z.array(pulseSourceSchema).optional(), // Legacy
  
  // Governance
  governance: governanceSectionSchema,
});

export type SeedPack = z.infer<typeof seedPackSchema>;

export interface SeedResult {
  success: boolean;
  imported: {
    coreConcepts: number;
    entities: number;
    products: number;
    productSpecs: number;
    reviews: number;
    communities: number;
    tiles: number;
    pulseSources: number;
    assets: number;
  };
  errors: string[];
  warnings: string[];
}

// Helper to get value with snake_case fallback
function getVal<T>(obj: any, camelKey: string, snakeKey: string): T | undefined {
  return obj[camelKey] ?? obj[snakeKey];
}

// Validation enums (strict allow-lists to preserve data integrity)
const VALID_ENTITY_TYPES = ['manufacturer', 'platform', 'standards', 'publication', 'influencer', 'community', 'retailer', 'distributor'] as const;
const VALID_TRUST_LEVELS = ['official', 'trade', 'independent'] as const;
const VALID_PRODUCT_CATEGORIES = ['consumer', 'enterprise', 'developer'] as const;
const VALID_PRODUCT_STATUSES = ['shipping', 'announced', 'rumoured', 'discontinued'] as const;
const VALID_COMMUNITY_TYPES = ['forum', 'subreddit', 'discord', 'slack', 'community_site', 'event_series'] as const;
const VALID_REVIEW_SENTIMENTS = ['positive', 'mixed', 'negative', 'unknown'] as const;
const VALID_PULSE_SOURCE_TYPES = ['manufacturer', 'publication', 'influencer', 'standards', 'community', 'retailer'] as const;
const VALID_MONITORING_METHODS = ['rss', 'page_monitor'] as const;
const VALID_UPDATE_FREQUENCIES = ['daily', 'twice_weekly', 'weekly'] as const;

// Validation helpers
function validateEnum<T extends readonly string[]>(value: string | undefined, validValues: T, fieldName: string, fallback: T[number]): T[number] {
  if (!value) return fallback;
  if (validValues.includes(value as any)) return value as T[number];
  console.warn(`[CPAC Import] Invalid ${fieldName}: "${value}". Using "${fallback}" instead.`);
  return fallback;
}

export async function importSeedPack(orbitId: number, pack: SeedPack): Promise<SeedResult> {
  const result: SeedResult = {
    success: true,
    imported: {
      coreConcepts: 0,
      entities: 0,
      products: 0,
      productSpecs: 0,
      reviews: 0,
      communities: 0,
      tiles: 0,
      pulseSources: 0,
      assets: 0,
    },
    errors: [],
    warnings: [],
  };

  try {
    // Check for unsupported CPAC sections and warn
    if (pack.governance) {
      result.warnings.push('governance section provided but not persisted (not yet implemented)');
    }
    const orbitConfig = pack.orbit;
    if (orbitConfig?.uiDefaults || orbitConfig?.ui_defaults) {
      result.warnings.push('orbit.uiDefaults provided but not persisted (not yet implemented)');
    }
    const pulseSection = pack.pulse;
    if (pulseSection?.monitoringRules || pulseSection?.monitoring_rules) {
      result.warnings.push('pulse.monitoringRules provided but not persisted (not yet implemented)');
    }
    if (pack.assets && pack.assets.length > 0) {
      result.warnings.push(`${pack.assets.length} assets provided but not persisted (not yet implemented)`);
    }
    
    // Import core concepts from CPAC seed_pack section
    const seedPackSection = pack.seedPack ?? pack.seed_pack;
    const coreConcepts = getVal<any[]>(seedPackSection ?? {}, 'coreConcepts', 'core_concepts');
    
    if (coreConcepts && coreConcepts.length > 0) {
      for (const concept of coreConcepts) {
        const conceptId = concept.id;
        const existing = await storage.getCoreConceptByConceptId(orbitId, conceptId);
        
        if (!existing) {
          await storage.createCoreConcept({
            orbitId,
            conceptId,
            label: concept.label,
            whyItMatters: getVal(concept, 'whyItMatters', 'why_it_matters'),
            starterQuestions: getVal(concept, 'starterQuestions', 'starter_questions') ?? [],
            intentTags: getVal(concept, 'intentTags', 'intent_tags') ?? [],
          });
          result.imported.coreConcepts++;
        }
      }
    }

    // Import entities
    if (pack.entities) {
      for (const entity of pack.entities) {
        const rawEntityType = getVal<string>(entity, 'entityType', 'entity_type');
        const entityType = validateEnum(rawEntityType, VALID_ENTITY_TYPES, 'entityType', 'manufacturer');
        const websiteUrl = getVal<string>(entity, 'websiteUrl', 'website_url');
        const regionTags = getVal<string[]>(entity, 'regionTags', 'region_tags');
        const rawTrustLevel = getVal<string>(entity, 'trustLevel', 'trust_level');
        const trustLevel = validateEnum(rawTrustLevel, VALID_TRUST_LEVELS, 'trustLevel', 'independent');
        const socialUrls = getVal<EntitySocialUrls>(entity, 'socialUrls', 'social_urls');
        
        const existing = await storage.getIndustryEntityByName(orbitId, entity.name);
        if (existing) {
          await storage.updateIndustryEntity(existing.id, {
            entityType: entityType as any,
            description: entity.description,
            websiteUrl,
            regionTags,
            trustLevel: trustLevel as any,
            socialUrls,
            notes: entity.notes,
          });
        } else {
          await storage.createIndustryEntity({
            orbitId,
            name: entity.name,
            entityType: entityType as any,
            description: entity.description,
            websiteUrl,
            regionTags,
            trustLevel: trustLevel as any,
            socialUrls,
            notes: entity.notes,
          });
        }
        result.imported.entities++;
      }
    }

    // Build entity ID map for references
    const entityIdMap = new Map<string, number>();
    const allEntities = await storage.getIndustryEntitiesByOrbit(orbitId);
    for (const entity of allEntities) {
      entityIdMap.set(entity.name, entity.id);
    }
    // Also map CPAC IDs to DB IDs
    if (pack.entities) {
      for (const entity of pack.entities) {
        if (entity.id) {
          const dbEntity = allEntities.find(e => e.name === entity.name);
          if (dbEntity) {
            entityIdMap.set(entity.id, dbEntity.id);
          }
        }
      }
    }

    // Import products
    const productIdMap = new Map<string, number>();
    if (pack.products) {
      for (const product of pack.products) {
        const rawCategory = product.category;
        const category = validateEnum(rawCategory, VALID_PRODUCT_CATEGORIES, 'category', 'consumer');
        const rawStatus = product.status;
        const status = validateEnum(rawStatus, VALID_PRODUCT_STATUSES, 'status', 'shipping');
        const releaseDate = getVal<string>(product, 'releaseDate', 'release_date');
        const primaryUrl = getVal<string>(product, 'primaryUrl', 'primary_url');
        const mediaRefs = getVal<ProductMediaRefs>(product, 'mediaRefs', 'media_refs');
        const referenceUrls = getVal<string[]>(product, 'referenceUrls', 'reference_urls');
        const intentTags = getVal<string[]>(product, 'intentTags', 'intent_tags');
        
        // Resolve manufacturer with error reporting
        let manufacturerEntityId: number | undefined;
        const manufacturerRef = getVal<string>(product, 'manufacturerEntityId', 'manufacturer_entity_id') 
          ?? getVal<string>(product, 'manufacturerName', 'manufacturer_name');
        if (manufacturerRef) {
          manufacturerEntityId = entityIdMap.get(manufacturerRef);
          if (!manufacturerEntityId) {
            result.warnings.push(`Product "${product.name}": manufacturer reference "${manufacturerRef}" not found in entities`);
          }
        }
        
        const existing = await storage.getIndustryProductByName(orbitId, product.name);
        
        let productId: number;
        if (existing) {
          await storage.updateIndustryProduct(existing.id, {
            category: category as any,
            status: status as any,
            releaseDate: releaseDate ? new Date(releaseDate) : undefined,
            primaryUrl,
            summary: product.summary,
            manufacturerEntityId,
            mediaRefs,
            referenceUrls,
            intentTags,
          });
          productId = existing.id;
        } else {
          const created = await storage.createIndustryProduct({
            orbitId,
            name: product.name,
            category: category as any,
            status: status as any,
            releaseDate: releaseDate ? new Date(releaseDate) : undefined,
            primaryUrl,
            summary: product.summary,
            manufacturerEntityId,
            mediaRefs,
            referenceUrls,
            intentTags,
          });
          productId = created.id;
        }
        
        productIdMap.set(product.name, productId);
        if (product.id) {
          productIdMap.set(product.id, productId);
        }
        result.imported.products++;

        // Import specs
        if (product.specs) {
          await storage.deleteProductSpecsByProduct(productId);
          
          for (const spec of product.specs) {
            const specKey = getVal<string>(spec, 'specKey', 'spec_key');
            const specValue = getVal<string>(spec, 'specValue', 'spec_value');
            const specUnit = getVal<string>(spec, 'specUnit', 'spec_unit');
            const sourceUrl = getVal<string>(spec, 'sourceUrl', 'source_url');
            
            if (specKey && specValue) {
              await storage.createProductSpec({
                productId,
                specKey,
                specValue,
                specUnit,
                sourceUrl,
              });
              result.imported.productSpecs++;
            }
          }
        }
      }
    }

    // Import reviews
    if (pack.reviews) {
      for (const review of pack.reviews) {
        const publishedAt = getVal<string>(review, 'publishedAt', 'published_at');
        const ratingValue = getVal<number>(review, 'ratingValue', 'rating_value');
        const ratingScale = getVal<number>(review, 'ratingScale', 'rating_scale');
        const rawSentiment = review.sentiment;
        const sentiment = validateEnum(rawSentiment, VALID_REVIEW_SENTIMENTS, 'sentiment', 'unknown');
        
        await storage.createIndustryReview({
          orbitId,
          title: review.title,
          url: review.url,
          publishedAt: publishedAt ? new Date(publishedAt) : undefined,
          ratingValue,
          ratingScale,
          summary: review.summary,
          sentiment,
        });
        result.imported.reviews++;
      }
    }

    // Import communities
    if (pack.communities) {
      for (const community of pack.communities) {
        const rawCommunityType = getVal<string>(community, 'communityType', 'community_type');
        const communityType = validateEnum(rawCommunityType, VALID_COMMUNITY_TYPES, 'communityType', 'community_site');
        const regionTags = getVal<string[]>(community, 'regionTags', 'region_tags');
        
        await storage.createCommunityLink({
          orbitId,
          name: community.name,
          url: community.url,
          communityType: communityType as any,
          notes: community.notes,
          regionTags,
        });
        result.imported.communities++;
      }
    }

    // Import tiles (from legacy tiles array or CPAC starter_tiles)
    const tiles = pack.tiles ?? getVal<any[]>(seedPackSection ?? {}, 'starterTiles', 'starter_tiles');
    if (tiles) {
      for (const tile of tiles) {
        const intentTags = getVal<string[]>(tile, 'intentTags', 'intent_tags');
        const evidenceRefs = getVal<TileEvidenceRefs>(tile, 'evidenceRefs', 'evidence_refs');
        
        await storage.createTopicTile({
          orbitId,
          label: tile.label,
          sublabel: tile.sublabel,
          intentTags,
          priority: tile.priority ?? 0,
          badgeState: tile.badgeState,
          evidenceRefs,
        });
        result.imported.tiles++;
      }
    }

    // Import pulse sources (from legacy pulseSources or CPAC pulse.sources)
    const pulseSources = pack.pulseSources ?? pack.pulse?.sources;
    if (pulseSources) {
      for (const source of pulseSources) {
        const rawSourceType = getVal<string>(source, 'sourceType', 'source_type');
        const sourceType = validateEnum(rawSourceType, VALID_PULSE_SOURCE_TYPES, 'sourceType', 'publication');
        const rssUrl = getVal<string>(source, 'rssUrl', 'rss_url');
        const rawMonitoringMethod = getVal<string>(source, 'monitoringMethod', 'monitoring_method');
        const monitoringMethod = validateEnum(rawMonitoringMethod, VALID_MONITORING_METHODS, 'monitoringMethod', 'page_monitor');
        const rawUpdateFrequency = getVal<string>(source, 'updateFrequency', 'update_frequency');
        const updateFrequency = validateEnum(rawUpdateFrequency, VALID_UPDATE_FREQUENCIES, 'updateFrequency', 'weekly');
        const rawTrustLevel = getVal<string>(source, 'trustLevel', 'trust_level');
        const trustLevel = validateEnum(rawTrustLevel, VALID_TRUST_LEVELS, 'trustLevel', 'independent');
        const eventTypes = getVal<string[]>(source, 'eventTypes', 'event_types');
        const keywordTriggers = getVal<string[]>(source, 'keywordTriggers', 'keyword_triggers');
        const isEnabled = getVal<boolean>(source, 'isEnabled', 'is_enabled');
        
        await storage.createPulseSource({
          orbitId,
          name: source.name,
          sourceType: sourceType as any,
          url: source.url,
          rssUrl,
          monitoringMethod: monitoringMethod as any,
          updateFrequency: updateFrequency as any,
          trustLevel: trustLevel as any,
          eventTypes: eventTypes as any,
          isEnabled: isEnabled ?? true,
          keywordTriggers,
          notes: source.notes,
        });
        result.imported.pulseSources++;
      }
    }

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

export async function getOrbitDefinition(orbitId: number) {
  const [coreConcepts, entities, products, reviews, communities, tiles, pulseSources] = await Promise.all([
    storage.getCoreConceptsByOrbit(orbitId),
    storage.getIndustryEntitiesByOrbit(orbitId),
    storage.getIndustryProductsByOrbit(orbitId),
    storage.getIndustryReviewsByOrbit(orbitId),
    storage.getCommunityLinksByOrbit(orbitId),
    storage.getTopicTilesByOrbit(orbitId),
    storage.getPulseSourcesByOrbit(orbitId),
  ]);

  const productsWithSpecs = await Promise.all(
    products.map(async (product) => {
      const specs = await storage.getProductSpecs(product.id);
      return { ...product, specs };
    })
  );

  return {
    coreConcepts,
    entities,
    products: productsWithSpecs,
    reviews,
    communities,
    tiles,
    pulseSources,
    stats: {
      totalCoreConcepts: coreConcepts.length,
      totalEntities: entities.length,
      totalProducts: products.length,
      totalReviews: reviews.length,
      totalCommunities: communities.length,
      totalTiles: tiles.length,
      totalPulseSources: pulseSources.length,
    },
  };
}
