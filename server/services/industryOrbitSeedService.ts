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

// Structured warning types
export type WarningSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type WarningCode = 
  | 'UNSUPPORTED_SECTIONS'
  | 'MISSING_MANUFACTURER_REF'
  | 'INVALID_ENUM_VALUE'
  | 'SKIPPED_RECORD';

export interface StructuredWarning {
  code: WarningCode;
  severity: WarningSeverity;
  message: string;
  path?: string;
  suggestedFix?: string;
}

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

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
  skipped: {
    products: number;
    entities: number;
    communities: number;
    tiles: number;
    pulseSources: number;
  };
  errors: string[];
  warnings: StructuredWarning[];
  quality: {
    score: number;
    grade: QualityGrade;
    summary: string;
    hasBlockingIssues: boolean;
  };
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

function calculateQuality(result: Omit<SeedResult, 'quality'>): SeedResult['quality'] {
  let score = 100;
  const issues: string[] = [];
  
  const errorCount = result.errors.length;
  const criticalWarnings = result.warnings.filter(w => w.severity === 'CRITICAL').length;
  const regularWarnings = result.warnings.filter(w => w.severity === 'WARNING').length;
  const infoWarnings = result.warnings.filter(w => w.severity === 'INFO').length;
  
  const totalImported = Object.values(result.imported).reduce((a, b) => a + b, 0);
  const totalSkipped = Object.values(result.skipped).reduce((a, b) => a + b, 0);
  const skipRate = totalImported + totalSkipped > 0 
    ? totalSkipped / (totalImported + totalSkipped) 
    : 0;
  
  if (errorCount > 0) {
    score -= 40;
    issues.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
  }
  if (criticalWarnings > 0) {
    score -= criticalWarnings * 15;
    issues.push(`${criticalWarnings} critical warning${criticalWarnings > 1 ? 's' : ''}`);
  }
  if (regularWarnings > 0) {
    score -= regularWarnings * 5;
    issues.push(`${regularWarnings} warning${regularWarnings > 1 ? 's' : ''}`);
  }
  if (skipRate > 0.5) {
    score -= 20;
    issues.push(`${Math.round(skipRate * 100)}% records skipped`);
  } else if (skipRate > 0.2) {
    score -= 10;
    issues.push(`${Math.round(skipRate * 100)}% records skipped`);
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let grade: QualityGrade;
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';
  
  const hasBlockingIssues = errorCount > 0 || criticalWarnings > 0;
  
  let summary: string;
  if (hasBlockingIssues) {
    summary = `Import has blocking issues: ${issues.join(', ')}`;
  } else if (issues.length > 0) {
    summary = `Import completed with issues: ${issues.join(', ')}`;
  } else if (totalImported === 0) {
    summary = 'No records imported';
  } else {
    summary = `Imported ${totalImported} record${totalImported > 1 ? 's' : ''} successfully`;
  }
  
  return { score, grade, summary, hasBlockingIssues };
}

export async function importSeedPack(orbitId: number, pack: SeedPack): Promise<SeedResult> {
  const baseResult = {
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
    skipped: {
      products: 0,
      entities: 0,
      communities: 0,
      tiles: 0,
      pulseSources: 0,
    },
    errors: [] as string[],
    warnings: [] as StructuredWarning[],
  };
  
  const result = baseResult;

  try {
    // Check for unsupported CPAC sections and group into single INFO warning
    const unsupportedSections: string[] = [];
    const orbitConfig = pack.orbit;
    const pulseSection = pack.pulse;
    
    if (pack.governance) unsupportedSections.push('governance');
    if (orbitConfig?.uiDefaults || orbitConfig?.ui_defaults) unsupportedSections.push('uiDefaults');
    if (pulseSection?.monitoringRules || pulseSection?.monitoring_rules) unsupportedSections.push('monitoringRules');
    if (pack.assets && pack.assets.length > 0) unsupportedSections.push(`assets (${pack.assets.length})`);
    
    if (unsupportedSections.length > 0) {
      result.warnings.push({
        code: 'UNSUPPORTED_SECTIONS',
        severity: 'INFO',
        message: `${unsupportedSections.length} unsupported sections provided and ignored: ${unsupportedSections.join(', ')}`,
        suggestedFix: 'These sections will be supported in a future update'
      });
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

    // Import products (Strict mode for Industry Orbits: skip products with missing manufacturer refs)
    const productIdMap = new Map<string, number>();
    if (pack.products) {
      for (let i = 0; i < pack.products.length; i++) {
        const product = pack.products[i];
        const productPath = `products[${i}]`;
        
        const rawCategory = product.category;
        const category = validateEnum(rawCategory, VALID_PRODUCT_CATEGORIES, 'category', 'consumer');
        const rawStatus = product.status;
        const status = validateEnum(rawStatus, VALID_PRODUCT_STATUSES, 'status', 'shipping');
        const releaseDate = getVal<string>(product, 'releaseDate', 'release_date');
        const primaryUrl = getVal<string>(product, 'primaryUrl', 'primary_url');
        const mediaRefs = getVal<ProductMediaRefs>(product, 'mediaRefs', 'media_refs');
        const referenceUrls = getVal<string[]>(product, 'referenceUrls', 'reference_urls');
        const intentTags = getVal<string[]>(product, 'intentTags', 'intent_tags');
        
        // Resolve manufacturer - STRICT MODE: skip product if ref provided but not found
        let manufacturerEntityId: number | undefined;
        const manufacturerRef = getVal<string>(product, 'manufacturerEntityId', 'manufacturer_entity_id') 
          ?? getVal<string>(product, 'manufacturerName', 'manufacturer_name');
        
        if (manufacturerRef) {
          manufacturerEntityId = entityIdMap.get(manufacturerRef);
          if (!manufacturerEntityId) {
            // Strict mode: skip this product entirely - CRITICAL because it indicates data integrity issues
            result.warnings.push({
              code: 'MISSING_MANUFACTURER_REF',
              severity: 'CRITICAL',
              message: `Product "${product.name}" skipped: manufacturer "${manufacturerRef}" not found in entities`,
              path: `${productPath}.manufacturerEntityId`,
              suggestedFix: `Add entity with id "${manufacturerRef}" to entities array, or remove manufacturerEntityId from product`
            });
            result.skipped.products++;
            continue; // Skip this product
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

  return {
    ...result,
    quality: calculateQuality(result),
  };
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

// Front page curated content for Industry Orbit UI
export interface FrontPageBrand {
  id: number;
  name: string;
  initials: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  productCount: number;
  trustLevel: string;
}

export interface FrontPageProduct {
  id: number;
  name: string;
  summary: string | null;
  status: string;
  category: string;
  manufacturerName: string | null;
  manufacturerInitials: string;
  referenceUrls: string[];
  intentTags: string[];
  specCount: number;
  primarySpec: { key: string; value: string } | null;
}

export interface FrontPageSection<T> {
  visible: boolean;
  count: number;
  items: T[];
}

export interface FrontPageData {
  hero: {
    title: string;
    subtitle: string;
    entityCount: number;
    productCount: number;
  };
  brands: FrontPageSection<FrontPageBrand>;
  featuredProducts: FrontPageSection<FrontPageProduct>;
  latestTiles: FrontPageSection<{
    id: number;
    label: string;
    sublabel: string | null;
    intentTags: string[];
    priority: number;
  }>;
  startHere: FrontPageSection<{
    id: number;
    label: string;
    whyItMatters: string | null;
    starterQuestions: string[];
  }>;
  communities: FrontPageSection<{
    id: number;
    name: string;
    url: string;
    communityType: string;
    regionTags: string[];
  }>;
  sources: FrontPageSection<{
    id: number;
    name: string;
    url: string;
    sourceType: string;
    trustLevel: string;
  }>;
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

export async function getOrbitFrontPage(orbitId: number, orbitName: string): Promise<FrontPageData> {
  const [entities, products, tiles, coreConcepts, communities, pulseSources] = await Promise.all([
    storage.getIndustryEntitiesByOrbit(orbitId),
    storage.getIndustryProductsByOrbit(orbitId),
    storage.getTopicTilesByOrbit(orbitId),
    storage.getCoreConceptsByOrbit(orbitId),
    storage.getCommunityLinksByOrbit(orbitId),
    storage.getPulseSourcesByOrbit(orbitId),
  ]);

  // Get specs for all products
  const productsWithSpecs = await Promise.all(
    products.map(async (product) => {
      const specs = await storage.getProductSpecs(product.id);
      return { ...product, specs };
    })
  );

  // Filter products: must have manufacturer (data quality requirement)
  const validProducts = productsWithSpecs.filter(p => p.manufacturerEntityId !== null);
  
  // Build entity lookup
  const entityMap = new Map(entities.map(e => [e.id, e]));
  
  // Count products per entity
  const productCountByEntity = new Map<number, number>();
  for (const p of validProducts) {
    if (p.manufacturerEntityId) {
      productCountByEntity.set(p.manufacturerEntityId, (productCountByEntity.get(p.manufacturerEntityId) || 0) + 1);
    }
  }

  // Brands section (manufacturers only, sorted by product count)
  const manufacturers = entities
    .filter(e => e.entityType === 'manufacturer')
    .map(e => ({
      id: e.id,
      name: e.name,
      initials: getInitials(e.name),
      logoUrl: e.logoAssetId ? `/api/assets/${e.logoAssetId}` : null,
      websiteUrl: e.websiteUrl,
      productCount: productCountByEntity.get(e.id) || 0,
      trustLevel: e.trustLevel || 'independent',
    }))
    .sort((a, b) => b.productCount - a.productCount);

  // Featured products selection logic:
  // 1. intentTags includes 'featured'
  // 2. Fallback: highest spec completeness, then newest
  const featuredProducts = validProducts
    .map(p => {
      const manufacturer = p.manufacturerEntityId ? entityMap.get(p.manufacturerEntityId) : null;
      return {
        id: p.id,
        name: p.name,
        summary: p.summary,
        status: p.status,
        category: p.category,
        manufacturerName: manufacturer?.name || null,
        manufacturerInitials: manufacturer ? getInitials(manufacturer.name) : '?',
        referenceUrls: (p.referenceUrls as string[]) || [],
        intentTags: (p.intentTags as string[]) || [],
        specCount: p.specs?.length || 0,
        primarySpec: p.specs?.[0] ? { key: p.specs[0].specKey, value: p.specs[0].specValue } : null,
        isFeatured: ((p.intentTags as string[]) || []).includes('featured'),
        createdAt: p.createdAt,
      };
    })
    .sort((a, b) => {
      // Featured first
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      // Then by spec count (more specs = more complete)
      if (a.specCount !== b.specCount) return b.specCount - a.specCount;
      // Then newest first
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    })
    .slice(0, 6)
    .map(({ isFeatured, createdAt, ...rest }) => rest);

  // Latest tiles (sorted by priority desc, then newest)
  const latestTiles = tiles
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 6)
    .map(t => ({
      id: t.id,
      label: t.label,
      sublabel: t.sublabel,
      intentTags: (t.intentTags as string[]) || [],
      priority: t.priority || 0,
    }));

  // Start here (core concepts with starter questions)
  const startHere = coreConcepts
    .filter(c => c.starterQuestions && (c.starterQuestions as string[]).length > 0)
    .slice(0, 4)
    .map(c => ({
      id: c.id,
      label: c.label,
      whyItMatters: c.whyItMatters,
      starterQuestions: (c.starterQuestions as string[]) || [],
    }));

  // Communities
  const communityItems = communities.slice(0, 6).map(c => ({
    id: c.id,
    name: c.name,
    url: c.url,
    communityType: c.communityType,
    regionTags: (c.regionTags as string[]) || [],
  }));

  // Sources (pulse sources, sorted by trust level)
  const trustOrder = { official: 0, trade: 1, independent: 2 };
  const sourceItems = pulseSources
    .filter(s => s.isEnabled)
    .sort((a, b) => (trustOrder[a.trustLevel as keyof typeof trustOrder] || 2) - (trustOrder[b.trustLevel as keyof typeof trustOrder] || 2))
    .slice(0, 6)
    .map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      sourceType: s.sourceType,
      trustLevel: s.trustLevel,
    }));

  return {
    hero: {
      title: orbitName,
      subtitle: `Discover ${validProducts.length} products from ${manufacturers.length} brands`,
      entityCount: manufacturers.length,
      productCount: validProducts.length,
    },
    brands: {
      visible: manufacturers.length > 0,
      count: manufacturers.length,
      items: manufacturers,
    },
    featuredProducts: {
      visible: featuredProducts.length > 0,
      count: featuredProducts.length,
      items: featuredProducts,
    },
    latestTiles: {
      visible: latestTiles.length > 0,
      count: latestTiles.length,
      items: latestTiles,
    },
    startHere: {
      visible: startHere.length > 0,
      count: startHere.length,
      items: startHere,
    },
    communities: {
      visible: communityItems.length > 0,
      count: communityItems.length,
      items: communityItems,
    },
    sources: {
      visible: sourceItems.length > 0,
      count: sourceItems.length,
      items: sourceItems,
    },
  };
}

export interface IndustryOrbitKnowledge {
  brand: {
    name: string;
    domain: string;
    tagline: string;
    primaryColor: string;
  };
  topics: never[];
  pages: never[];
  people: never[];
  proof: never[];
  actions: never[];
  blogs: never[];
  socials: never[];
  manufacturers: Array<{
    id: string;
    type: 'manufacturer';
    keywords: string[];
    name: string;
    initials: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    productCount: number;
    trustLevel: string;
    entityId: number;
  }>;
  products: Array<{
    id: string;
    type: 'product';
    keywords: string[];
    name: string;
    summary: string | null;
    status: string | null;
    category: string | null;
    manufacturerName: string | null;
    manufacturerInitials: string;
    primarySpec: { key: string; value: string } | null;
    specCount: number;
    productId: number;
    referenceUrls: string[];
    intentTags: string[];
  }>;
  concepts: Array<{
    id: string;
    type: 'concept';
    keywords: string[];
    label: string;
    whyItMatters: string | null;
    starterQuestions: string[];
    conceptId: number;
  }>;
  qas: Array<{
    id: string;
    type: 'qa';
    keywords: string[];
    question: string;
    answer: string;
    tileId: number;
    sublabel: string | null;
    priority: number;
  }>;
  communities: Array<{
    id: string;
    type: 'community';
    keywords: string[];
    name: string;
    url: string;
    communityType: string | null;
    regionTags: string[];
    communityId: number;
  }>;
  ctas: never[];
  sponsored: never[];
}

export async function getOrbitKnowledge(orbitId: number, orbitName: string): Promise<IndustryOrbitKnowledge> {
  const [entities, products, tiles, coreConcepts, communities] = await Promise.all([
    storage.getIndustryEntitiesByOrbit(orbitId),
    storage.getIndustryProductsByOrbit(orbitId),
    storage.getTopicTilesByOrbit(orbitId),
    storage.getCoreConceptsByOrbit(orbitId),
    storage.getCommunityLinksByOrbit(orbitId),
  ]);

  const productsWithSpecs = await Promise.all(
    products.map(async (product) => {
      const specs = await storage.getProductSpecs(product.id);
      return { ...product, specs };
    })
  );

  const validProducts = productsWithSpecs.filter(p => p.manufacturerEntityId !== null);
  const entityMap = new Map(entities.map(e => [e.id, e]));
  
  const productCountByEntity = new Map<number, number>();
  for (const p of validProducts) {
    if (p.manufacturerEntityId) {
      productCountByEntity.set(p.manufacturerEntityId, (productCountByEntity.get(p.manufacturerEntityId) || 0) + 1);
    }
  }

  const manufacturerItems = entities
    .filter(e => e.entityType === 'manufacturer')
    .map(e => ({
      id: `manufacturer-${e.id}`,
      type: 'manufacturer' as const,
      keywords: [e.name.toLowerCase(), e.entityType || '', ...(e.regionTags as string[] || [])],
      name: e.name,
      initials: getInitials(e.name),
      logoUrl: e.logoAssetId ? `/api/assets/${e.logoAssetId}` : null,
      websiteUrl: e.websiteUrl,
      productCount: productCountByEntity.get(e.id) || 0,
      trustLevel: e.trustLevel || 'independent',
      entityId: e.id,
    }))
    .sort((a, b) => b.productCount - a.productCount);

  const productItems = validProducts.map(p => {
    const manufacturer = p.manufacturerEntityId ? entityMap.get(p.manufacturerEntityId) : null;
    const manufacturerLogoUrl = manufacturer?.logoAssetId ? `/api/assets/${manufacturer.logoAssetId}` : null;
    return {
      id: `product-${p.id}`,
      type: 'product' as const,
      keywords: [
        p.name.toLowerCase(),
        manufacturer?.name.toLowerCase() || '',
        p.category?.toLowerCase() || '',
        p.status?.toLowerCase() || '',
        ...((p.intentTags as string[]) || []),
      ].filter(Boolean),
      name: p.name,
      summary: p.summary,
      status: p.status,
      category: p.category,
      manufacturerName: manufacturer?.name || null,
      manufacturerInitials: manufacturer ? getInitials(manufacturer.name) : '?',
      primarySpec: p.specs?.[0] ? { key: p.specs[0].specKey, value: p.specs[0].specValue } : null,
      specCount: p.specs?.length || 0,
      productId: p.id,
      referenceUrls: (p.referenceUrls as string[]) || [],
      intentTags: (p.intentTags as string[]) || [],
      imageUrl: p.heroImageUrl || null,
      manufacturerLogoUrl,
      releaseDate: p.releaseDate ? p.releaseDate.toISOString() : null,
    };
  });

  const conceptItems = coreConcepts.map(c => ({
    id: `concept-${c.id}`,
    type: 'concept' as const,
    keywords: [c.label.toLowerCase(), ...(c.starterQuestions as string[] || []).map(q => q.toLowerCase())],
    label: c.label,
    whyItMatters: c.whyItMatters,
    starterQuestions: (c.starterQuestions as string[]) || [],
    conceptId: c.id,
  }));

  const qaItems = tiles.map(t => ({
    id: `qa-${t.id}`,
    type: 'qa' as const,
    keywords: [t.label.toLowerCase(), t.sublabel?.toLowerCase() || '', ...((t.intentTags as string[]) || [])].filter(Boolean),
    question: t.label,
    answer: t.sublabel || '',
    tileId: t.id,
    sublabel: t.sublabel,
    priority: t.priority || 0,
  }));

  const communityItems = communities.map(c => ({
    id: `community-${c.id}`,
    type: 'community' as const,
    keywords: [c.name.toLowerCase(), c.communityType?.toLowerCase() || '', ...((c.regionTags as string[]) || [])].filter(Boolean),
    name: c.name,
    url: c.url,
    communityType: c.communityType,
    regionTags: (c.regionTags as string[]) || [],
    communityId: c.id,
    notes: c.notes || undefined,
  }));

  return {
    brand: {
      name: orbitName,
      domain: '',
      tagline: `Discover ${validProducts.length} products from ${manufacturerItems.length} brands`,
      primaryColor: '#ec4899',
    },
    topics: [],
    pages: [],
    people: [],
    proof: [],
    actions: [],
    blogs: [],
    socials: [],
    manufacturers: manufacturerItems,
    products: productItems,
    concepts: conceptItems,
    qas: qaItems,
    communities: communityItems,
    ctas: [],
    sponsored: [],
  };
}
