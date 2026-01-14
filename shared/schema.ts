import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, real, unique, index, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users
// User roles: viewer (default), creator (storytellers), influencer (can publish ICE), admin (full access)
export type UserRole = 'viewer' | 'creator' | 'influencer' | 'admin';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  username: text("username").notNull().unique(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(), // Legacy, use role instead
  role: text("role").$type<UserRole>().default("viewer").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Creator profiles for storytellers (linked to subscription tiers)
export const creatorProfiles = pgTable("creator_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  slug: text("slug").unique(), // URL-friendly identifier for public profile
  displayName: text("display_name").notNull(),
  headline: text("headline"), // Short tagline like "Tech Journalist" or "History Educator"
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  externalLink: text("external_link"), // Link to creator's website or social profile
  planId: integer("plan_id").references(() => plans.id), // Current subscription tier
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("inactive"), // 'active', 'past_due', 'cancelled', 'inactive'
  usedStorageBytes: bigint("used_storage_bytes", { mode: "number" }).default(0).notNull(), // Current storage usage
  storageLimitBytes: bigint("storage_limit_bytes", { mode: "number" }).default(5368709120).notNull(), // Default 5GB
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreatorProfileSchema = createInsertSchema(creatorProfiles).omit({ id: true, createdAt: true });
export type InsertCreatorProfile = z.infer<typeof insertCreatorProfileSchema>;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;

// Creator profile social links (multiple links per profile)
export const creatorProfileLinks = pgTable("creator_profile_links", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => creatorProfiles.id).notNull(),
  label: text("label").notNull(), // e.g., "Twitter", "LinkedIn", "Website"
  url: text("url").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreatorProfileLinkSchema = createInsertSchema(creatorProfileLinks).omit({ id: true, createdAt: true });
export type InsertCreatorProfileLink = z.infer<typeof insertCreatorProfileLinkSchema>;
export type CreatorProfileLink = typeof creatorProfileLinks.$inferSelect;

// Creator follows (social following system)
export const creatorFollows = pgTable("creator_follows", {
  id: serial("id").primaryKey(),
  followerProfileId: integer("follower_profile_id").references(() => creatorProfiles.id).notNull(),
  followedProfileId: integer("followed_profile_id").references(() => creatorProfiles.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreatorFollowSchema = createInsertSchema(creatorFollows).omit({ id: true, createdAt: true });
export type InsertCreatorFollow = z.infer<typeof insertCreatorFollowSchema>;
export type CreatorFollow = typeof creatorFollows.$inferSelect;

// ICE likes (users can like ICE previews)
export const iceLikes = pgTable("ice_likes", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => creatorProfiles.id).notNull(),
  iceId: text("ice_id").notNull(), // References ice_previews.id (text)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIceLikeSchema = createInsertSchema(iceLikes).omit({ id: true, createdAt: true });
export type InsertIceLike = z.infer<typeof insertIceLikeSchema>;
export type IceLike = typeof iceLikes.$inferSelect;

// Media asset status types
export type MediaAssetStatus = 'draft' | 'active' | 'orphan' | 'deleted';
export type MediaAssetCategory = 'image' | 'video' | 'audio' | 'document' | 'other';

// Media assets table (tracks all uploaded files for quota management)
export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => creatorProfiles.id).notNull(),
  iceId: text("ice_id"), // Optional reference to ICE preview
  fileKey: text("file_key").notNull(), // Object storage key
  fileName: text("file_name").notNull(), // Original filename
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
  mimeType: text("mime_type"),
  category: text("category").$type<MediaAssetCategory>().default("other").notNull(),
  status: text("status").$type<MediaAssetStatus>().default("draft").notNull(),
  expiresAt: timestamp("expires_at"), // For draft cleanup
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({ id: true, createdAt: true });
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;

// AI usage types
export type AiUsageType = 'image_gen' | 'video_gen' | 'audio_gen' | 'chat' | 'text_gen';

// AI usage events table (tracks all AI generation costs per ICE)
export const aiUsageEvents = pgTable("ai_usage_events", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => creatorProfiles.id).notNull(),
  iceId: text("ice_id"), // Which ICE this was for
  usageType: text("usage_type").$type<AiUsageType>().notNull(),
  creditsUsed: real("credits_used").notNull(), // Fractional credits
  model: text("model"), // e.g., "gpt-4o-mini", "dall-e-3"
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiUsageEventSchema = createInsertSchema(aiUsageEvents).omit({ id: true, createdAt: true });
export type InsertAiUsageEvent = z.infer<typeof insertAiUsageEventSchema>;
export type AiUsageEvent = typeof aiUsageEvents.$inferSelect;

// Universe ownership mapping (which creator owns which universes)
export const universeCreators = pgTable("universe_creators", {
  id: serial("id").primaryKey(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default("owner").notNull(), // 'owner', 'collaborator'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Visual Style Schema (for universe-level style constraints)
export const visualStyleSchema = z.object({
  stylePreset: z.string().optional(),
  basePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  aspectRatio: z.string().default("9:16"),
  renderModel: z.string().optional(),
  guidanceScale: z.number().optional(),
  steps: z.number().optional(),
  sampler: z.string().optional(),
  consistency: z.object({
    characterLock: z.boolean().optional(),
    locationLock: z.boolean().optional(),
    colourPaletteLock: z.boolean().optional(),
    referenceImages: z.array(z.string()).optional(),
  }).optional(),
}).optional();

export type VisualStyle = z.infer<typeof visualStyleSchema>;

// Visual Continuity Schema (for consistent character/location appearance)
export const visualContinuitySchema = z.object({
  artDirection: z.string().optional(),
  palette: z.string().optional(),
  cameraLanguage: z.string().optional(),
  lightingRules: z.string().optional(),
  textureRules: z.string().optional(),
  tabooList: z.array(z.string()).optional(),
  referenceTags: z.array(z.string()).optional(),
}).optional();

export type VisualContinuity = z.infer<typeof visualContinuitySchema>;

// Design Guide Schema (comprehensive visual bible for universe consistency)
export const designGuideSchema = z.object({
  // Core visual style
  artStyle: z.string().optional(), // e.g., "cinematic realism", "anime", "watercolor illustration"
  colorPalette: z.string().optional(), // e.g., "warm earth tones, muted greens, golden hour lighting"
  moodTone: z.string().optional(), // e.g., "mysterious, atmospheric, melancholic"
  
  // Camera and composition
  cameraStyle: z.string().optional(), // e.g., "handheld documentary", "static composed shots"
  defaultAspectRatio: z.string().default("9:16"),
  lightingNotes: z.string().optional(), // e.g., "natural diffused light, avoid harsh shadows"
  
  // Prompt construction
  basePrompt: z.string().optional(), // Always prepended to generation prompts
  negativePrompt: z.string().optional(), // Things to avoid in generation
  styleKeywords: z.array(z.string()).optional(), // e.g., ["35mm film grain", "shallow depth of field"]
  
  // Quality and technical
  qualityLevel: z.enum(["draft", "standard", "high", "ultra"]).default("standard"),
  consistencyPriority: z.enum(["speed", "balanced", "consistency"]).default("balanced"),
  
  // Constraints
  avoidList: z.array(z.string()).optional(), // Things to never show
  requiredElements: z.array(z.string()).optional(), // Things that should always be present
}).optional();

export type DesignGuide = z.infer<typeof designGuideSchema>;

// Reference Asset Types for universe visual bible
export type ReferenceAssetType = 'character' | 'location' | 'style' | 'prop' | 'color_palette';

// Character Visual Profile Schema (for consistent character appearance)
export const characterVisualProfileSchema = z.object({
  continuityDescription: z.string().optional(),
  ageRange: z.string().optional(),
  ethnicityOptional: z.string().optional(),
  build: z.string().optional(),
  faceFeatures: z.string().optional(),
  hair: z.string().optional(),
  wardrobe: z.string().optional(),
  accessories: z.string().optional(),
  mannerisms: z.string().optional(),
  doNotChange: z.array(z.string()).optional(),
  referenceImagePath: z.string().optional(),
}).optional();

export type CharacterVisualProfile = z.infer<typeof characterVisualProfileSchema>;

// Location Continuity Schema
export const locationContinuitySchema = z.object({
  continuityDescription: z.string().optional(),
  lighting: z.string().optional(),
  textures: z.string().optional(),
  doNotChange: z.array(z.string()).optional(),
}).optional();

export type LocationContinuity = z.infer<typeof locationContinuitySchema>;

// Chat Policy Schema v2 (universe-level guardrails with enhanced safety)
export const chatPolicySchema = z.object({
  rating: z.enum(["PG", "12", "15", "18"]).optional(),
  spoiler_policy: z.object({
    mode: z.enum(["hard", "soft"]).default("hard"),
    rule: z.string().optional(),
  }).optional(),
  truth_policy: z.object({
    allow_lies_in_character: z.boolean().default(true),
    lies_allowed_for: z.array(z.string()).optional(),
    lies_not_allowed_for: z.array(z.string()).optional(),
  }).optional(),
  refusal_style: z.object({
    in_character_deflection: z.boolean().default(true),
    deflection_templates: z.array(z.string()).optional(),
  }).optional(),
  safety_policy: z.object({
    disallowed: z.array(z.string()).optional(),
    escalation: z.string().optional(),
  }).optional(),
  real_person_policy: z.object({
    enabled: z.boolean().default(false),
    rule: z.string().optional(),
  }).optional(),
  disclaimer: z.string().optional(),
}).optional();

export type ChatPolicy = z.infer<typeof chatPolicySchema>;

// Character Secret Schema (things the character must not reveal)
export const characterSecretSchema = z.object({
  id: z.string(),
  never_reveal: z.boolean().default(true),
  trigger_patterns: z.array(z.string()).optional(),
  deflect_with: z.string().optional(),
});

export type CharacterSecret = z.infer<typeof characterSecretSchema>;

// Character Chat Profile Schema v2 (enhanced with system prompt and secrets)
export const chatProfileSchema = z.object({
  system_prompt: z.string().optional(),
  voice: z.string().optional(),
  speech_style: z.string().optional(),
  goals: z.array(z.string()).optional(),
  knowledge_cutoff: z.object({
    mode: z.enum(["dayIndex", "dynamic"]).default("dynamic"),
    max_day_index: z.number().optional(),
  }).optional(),
  secrets: z.array(characterSecretSchema).optional(),
  allowed_topics: z.array(z.string()).optional(),
  forbidden_topics: z.array(z.string()).optional(),
  hard_limits: z.array(z.string()).optional(),
  refusal_style: z.string().optional(),
}).optional();

export type ChatProfile = z.infer<typeof chatProfileSchema>;

// Spoiler Trap Schema (questions and deflections)
export const spoilerTrapSchema = z.object({
  trigger: z.string(),
  deflect_with: z.string(),
});

export type SpoilerTrap = z.infer<typeof spoilerTrapSchema>;

// Card Chat Override Schema v2 (per-character, per-card context)
export const cardChatOverrideSchema = z.object({
  emotional_state: z.enum([
    "guarded", "warm", "panicked", "confident", "ashamed", 
    "suspicious", "hopeful", "angry", "sad", "neutral"
  ]).optional(),
  scene_context: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  knows_up_to_day_index: z.number().optional(),
  taboo_for_this_scene: z.array(z.string()).optional(),
  can_reveal: z.array(z.string()).optional(),
  spoiler_traps: z.array(spoilerTrapSchema).optional(),
});

export type CardChatOverride = z.infer<typeof cardChatOverrideSchema>;

// Card Chat Overrides Schema (per-card, keyed by character id)
export const chatOverridesSchema = z.record(z.string(), cardChatOverrideSchema).optional();

export type ChatOverrides = z.infer<typeof chatOverridesSchema>;

// Release mode types for universe card visibility
export type ReleaseMode = 'daily' | 'all_at_once' | 'hybrid_intro_then_daily';

// Source Guardrails Schema (grounding rules extracted from source material)
export const sourceGuardrailsSchema = z.object({
  coreThemes: z.array(z.string()),
  toneConstraints: z.array(z.string()),
  factualBoundaries: z.array(z.string()),
  exclusions: z.array(z.string()),
  quotableElements: z.array(z.string()),
  sensitiveTopics: z.array(z.string()),
  creativeLatitude: z.enum(["strict", "moderate", "liberal"]),
  groundingStatement: z.string(),
});

export type SourceGuardrails = z.infer<typeof sourceGuardrailsSchema>;

// Universe (Story World)
// Narration mode for auto-generating narration text
export type NarrationMode = 'manual' | 'derive_from_sceneText' | 'derive_from_captions' | 'ai_summarise_from_card';

// Active Ice status for sustainable hosting model
export type IceStatus = 'draft' | 'active' | 'paused';

// Content visibility levels (applies to universes, ice_previews, orbits)
// private: only owner + admins can view
// unlisted: anyone with link can view (not discoverable)
// public: visible to everyone, discoverable
export type ContentVisibility = 'private' | 'unlisted' | 'public';

export const universes = pgTable("universes", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(), // Unique identifier for deterministic imports
  name: text("name").notNull(),
  description: text("description").notNull(),
  styleNotes: text("style_notes"),
  // Active Ice hosting model fields
  iceStatus: text("ice_status").$type<IceStatus>().default("draft").notNull(), // draft, active, paused
  activeSince: timestamp("active_since"), // When Ice was activated for public access
  pausedAt: timestamp("paused_at"), // When Ice was paused
  ownerUserId: integer("owner_user_id").references(() => users.id), // Owner of this experience
  visibility: text("visibility").$type<ContentVisibility>().default("private").notNull(), // Access control: private, unlisted, public
  visualMode: text("visual_mode").default("author_supplied"), // "engine_generated" | "author_supplied"
  visualStyle: jsonb("visual_style").$type<VisualStyle>(), // Universe-level style constraints
  visualContinuity: jsonb("visual_continuity").$type<VisualContinuity>(), // Style bible for consistent look
  designGuide: jsonb("design_guide").$type<DesignGuide>(), // Comprehensive visual bible for generation consistency
  chatPolicy: jsonb("chat_policy").$type<ChatPolicy>(), // Global chat guardrails and safety rules
  sourceGuardrails: jsonb("source_guardrails").$type<SourceGuardrails>(), // Grounding rules from source material
  // Release cadence settings for 3-card hook onboarding
  releaseMode: text("release_mode").$type<ReleaseMode>().default("daily"), // 'daily' | 'all_at_once' | 'hybrid_intro_then_daily'
  introCardsCount: integer("intro_cards_count").default(3), // Number of cards to unlock immediately in hybrid mode
  dailyReleaseStartsAtDayIndex: integer("daily_release_starts_at_day_index"), // When daily gating begins (defaults to introCardsCount + 1)
  timezone: text("timezone").default("UTC"), // Timezone for publishAt comparisons
  // Narration defaults for this universe
  defaultNarrationEnabled: boolean("default_narration_enabled").default(false),
  defaultNarrationVoice: text("default_narration_voice"),
  defaultNarrationSpeed: real("default_narration_speed").default(1.0),
  defaultNarrationMode: text("default_narration_mode").$type<NarrationMode>().default("manual"),
  narrationStyleNotes: text("narration_style_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUniverseSchema = createInsertSchema(universes).omit({ id: true, createdAt: true });
export type InsertUniverse = z.infer<typeof insertUniverseSchema>;
export type Universe = typeof universes.$inferSelect;

// Reference Assets (visual bible examples for consistent generation)
export const universeReferenceAssets = pgTable("universe_reference_assets", {
  id: serial("id").primaryKey(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  assetType: text("asset_type").$type<ReferenceAssetType>().notNull(), // 'character', 'location', 'style', 'prop', 'color_palette'
  name: text("name").notNull(), // Display name
  description: text("description"), // What this asset represents
  imagePath: text("image_path").notNull(), // Storage path or URL
  thumbnailPath: text("thumbnail_path"), // Smaller preview version
  promptNotes: text("prompt_notes"), // Notes to include when using this reference
  characterId: integer("character_id").references(() => characters.id), // Link to specific character (optional)
  locationId: integer("location_id").references(() => locations.id), // Link to specific location (optional)
  priority: integer("priority").default(0), // Higher priority = used first in prompts
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUniverseReferenceAssetSchema = createInsertSchema(universeReferenceAssets).omit({ id: true, createdAt: true });
export type InsertUniverseReferenceAsset = z.infer<typeof insertUniverseReferenceAssetSchema>;
export type UniverseReferenceAsset = typeof universeReferenceAssets.$inferSelect;

// Image Generation Schema (for per-card image generation)
export const imageGenerationSchema = z.object({
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  shotType: z.string().optional(), // "wide", "close_up", "handheld", "over_the_shoulder"
  lighting: z.string().optional(), // "natural overcast", "fluorescent clinical"
  seed: z.number().optional(),
  notes: z.string().optional(),
}).optional();

export type ImageGeneration = z.infer<typeof imageGenerationSchema>;

// Character knowledge document reference
export const characterKnowledgeDocSchema = z.object({
  fileName: z.string(),
  fileType: z.string(), // "pdf", "txt", "md", "url"
  uploadedAt: z.string(),
  storagePath: z.string().optional(), // R2 path for uploaded files
  sourceUrl: z.string().optional(), // Original URL if scraped
  contentPreview: z.string().optional(), // First ~200 chars for display
});

export type CharacterKnowledgeDoc = z.infer<typeof characterKnowledgeDocSchema>;

// Training status for custom characters
export type CharacterTrainingStatus = 'pending' | 'processing' | 'ready' | 'failed';

// Characters
export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  characterSlug: text("character_slug").notNull(), // e.g., "v", "detective-k"
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar"),
  description: text("description"),
  systemPrompt: text("system_prompt"), // AI character instructions
  secretsJson: jsonb("secrets_json").$type<string[]>(), // Things character can't reveal
  visualProfile: jsonb("visual_profile").$type<CharacterVisualProfile>(), // Visual appearance for image generation
  chatProfile: jsonb("chat_profile").$type<ChatProfile>(), // How character speaks + goals + limits
  isPublicFigureSimulation: boolean("is_public_figure_simulation").default(false), // Legal clearance for real individuals
  isActive: boolean("is_active").default(true).notNull(),
  // Custom character training fields (Pro/Business feature)
  isCustomCharacter: boolean("is_custom_character").default(false), // True for user-created characters
  knowledgeSourceUrl: text("knowledge_source_url"), // URL to scrape for training
  knowledgeDocuments: jsonb("knowledge_documents").$type<CharacterKnowledgeDoc[]>(), // Uploaded docs
  knowledgeContent: text("knowledge_content"), // Extracted text content for context
  trainingStatus: text("training_status").$type<CharacterTrainingStatus>().default("ready"),
  guardrails: text("guardrails"), // Custom guardrails/rules for the character
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true, createdAt: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// ============ AI CHARACTER CUSTOM FIELDS (Structured Data Capture) ============
// Business-tier feature for capturing structured data during AI conversations

export type CustomFieldType = 'text' | 'number' | 'single_select' | 'multi_select' | 'date' | 'boolean' | 'email' | 'phone';

// Custom field options for select fields
export const customFieldOptionsSchema = z.object({
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
});
export type CustomFieldOptions = z.infer<typeof customFieldOptionsSchema>;

// Character custom fields definition
export const aiCharacterCustomFields = pgTable("ai_character_custom_fields", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characters.id, { onDelete: "cascade" }).notNull(),
  fieldKey: text("field_key").notNull(), // Unique key within character (e.g., "company_name")
  label: text("label").notNull(), // Display label (e.g., "Company Name")
  fieldType: text("field_type").$type<CustomFieldType>().notNull().default("text"),
  placeholder: text("placeholder"), // Optional placeholder text
  required: boolean("required").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  options: jsonb("options").$type<CustomFieldOptions>(), // For select fields
  description: text("description"), // Help text shown to viewers
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiCharacterCustomFieldSchema = createInsertSchema(aiCharacterCustomFields).omit({ id: true, createdAt: true });
export type InsertAiCharacterCustomField = z.infer<typeof insertAiCharacterCustomFieldSchema>;
export type AiCharacterCustomField = typeof aiCharacterCustomFields.$inferSelect;

// Field responses captured during chat sessions
export const aiCharacterFieldResponses = pgTable("ai_character_field_responses", {
  id: serial("id").primaryKey(),
  icePreviewId: text("ice_preview_id").references(() => icePreviews.id, { onDelete: "cascade" }).notNull(),
  characterId: integer("character_id").references(() => characters.id, { onDelete: "cascade" }).notNull(),
  fieldId: integer("field_id").references(() => aiCharacterCustomFields.id, { onDelete: "cascade" }).notNull(),
  
  // Viewer identification (anonymous or authenticated)
  viewerSessionId: text("viewer_session_id").notNull(), // Unique session identifier
  viewerDisplayName: text("viewer_display_name"), // Optional display name
  viewerUserId: integer("viewer_user_id").references(() => users.id), // If authenticated
  
  // Response data
  value: jsonb("value").notNull(), // Flexible storage for any field type
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiCharacterFieldResponseSchema = createInsertSchema(aiCharacterFieldResponses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiCharacterFieldResponse = z.infer<typeof insertAiCharacterFieldResponseSchema>;
export type AiCharacterFieldResponse = typeof aiCharacterFieldResponses.$inferSelect;

// Locations (for consistent environments in engine_generated mode)
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  locationSlug: text("location_slug").notNull(), // e.g., "coffee-shop", "park-bench"
  name: text("name").notNull(),
  continuity: jsonb("continuity").$type<LocationContinuity>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Narration status for cards
export type NarrationStatus = 'none' | 'text_ready' | 'generating' | 'ready' | 'failed';

// Cards (Story Episodes)
export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  season: integer("season").default(1).notNull(),
  dayIndex: integer("day_index").notNull(), // Unique within universe/season
  title: text("title").notNull(),
  imagePath: text("image_path"), // URL or path to card image (author_supplied or generated)
  captionsJson: jsonb("captions_json").$type<string[]>().notNull(), // Array of caption lines
  sceneText: text("scene_text").notNull(),
  recapText: text("recap_text").notNull(),
  effectTemplate: text("effect_template").default("ken-burns"), // "ken-burns", "smoke", "glitch", etc.
  status: text("status").default("draft").notNull(), // "draft", "scheduled", "published"
  publishAt: timestamp("publish_at"),
  videoPath: text("video_path"), // Generated MP4 path
  
  // Engine-generated image fields
  sceneDescription: text("scene_description"), // Plain English description for image generation
  imageGeneration: jsonb("image_generation").$type<ImageGeneration>(), // Prompt settings
  generatedImageUrl: text("generated_image_url"), // URL of engine-generated image
  imageGenerated: boolean("image_generated").default(false), // Whether image has been generated
  
  // Engine-generated video fields
  generatedVideoUrl: text("generated_video_url"), // URL of engine-generated video
  videoGenerated: boolean("video_generated").default(false), // Whether video has been generated
  videoGenerationTaskId: text("video_generation_task_id"), // Kling task ID for polling
  videoGenerationMode: text("video_generation_mode").$type<'text-to-video' | 'image-to-video'>(), // Mode used for status polling
  videoGenerationStatus: text("video_generation_status").$type<'none' | 'pending' | 'processing' | 'completed' | 'failed'>().default("none"),
  videoGenerationError: text("video_generation_error"),
  videoGenerationModel: text("video_generation_model"), // e.g., "kling-v2"
  videoThumbnailUrl: text("video_thumbnail_url"),
  videoDurationSec: real("video_duration_sec"),
  videoGeneratedAt: timestamp("video_generated_at"),
  preferredMediaType: text("preferred_media_type").$type<'image' | 'video'>().default("image"), // Which media to display to viewers
  
  // Visual continuity references (for prompt composition)
  primaryCharacterIds: jsonb("primary_character_ids").$type<number[]>(), // Characters in this scene
  locationId: integer("location_id").references(() => locations.id), // Location for this scene
  
  // Chat overrides for this card (mood/knowledge per character)
  chatOverrides: jsonb("chat_overrides").$type<ChatOverrides>(),
  
  // Narration (Text-to-Speech) fields
  narrationEnabled: boolean("narration_enabled").default(false),
  narrationText: text("narration_text"),
  narrationVoice: text("narration_voice"),
  narrationSpeed: real("narration_speed").default(1.0),
  narrationStatus: text("narration_status").$type<NarrationStatus>().default("none"),
  narrationAudioUrl: text("narration_audio_url"),
  narrationAudioDurationSec: real("narration_audio_duration_sec"),
  narrationUpdatedAt: timestamp("narration_updated_at"),
  narrationError: text("narration_error"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardSchema = createInsertSchema(cards).omit({ id: true, createdAt: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;

// Card-Character Junction (which characters are available for chat after viewing this card)
export const cardCharacters = pgTable("card_characters", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  characterId: integer("character_id").references(() => characters.id).notNull(),
});

export const insertCardCharacterSchema = createInsertSchema(cardCharacters).omit({ id: true });
export type InsertCardCharacter = z.infer<typeof insertCardCharacterSchema>;
export type CardCharacter = typeof cardCharacters.$inferSelect;

// User Progress
export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  unlockedDayIndex: integer("unlocked_day_index").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  lastSeenAt: timestamp("last_seen_at"),
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;

// Chat Threads
export const chatThreads = pgTable("chat_threads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  characterId: integer("character_id").references(() => characters.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({ id: true, createdAt: true });
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type ChatThread = typeof chatThreads.$inferSelect;

// Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => chatThreads.id).notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Events (Analytics tracking)
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(), // "card_view", "card_complete", "chat_start", etc.
  metadataJson: jsonb("metadata_json").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Card Messages (Micro Message Board)
export const cardMessages = pgTable("card_messages", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  userId: integer("user_id").references(() => users.id), // nullable for anonymous
  displayName: text("display_name").notNull(),
  body: text("body").notNull(), // max 280 chars enforced at API level
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardMessageSchema = createInsertSchema(cardMessages).omit({ id: true, createdAt: true });
export type InsertCardMessage = z.infer<typeof insertCardMessageSchema>;
export type CardMessage = typeof cardMessages.$inferSelect;

// Card Message Reactions
export const cardMessageReactions = pgTable("card_message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => cardMessages.id).notNull(),
  userId: integer("user_id").references(() => users.id), // nullable for anon fingerprint
  anonFingerprint: text("anon_fingerprint"), // for anonymous users
  reactionType: text("reaction_type").notNull(), // "👍", "🤔", "😮"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardMessageReactionSchema = createInsertSchema(cardMessageReactions).omit({ id: true, createdAt: true });
export type InsertCardMessageReaction = z.infer<typeof insertCardMessageReactionSchema>;
export type CardMessageReaction = typeof cardMessageReactions.$inferSelect;

// ICE Card Messages (for ICE preview cards with text-based IDs)
export const iceCardMessages = pgTable("ice_card_messages", {
  id: serial("id").primaryKey(),
  iceCardId: text("ice_card_id").notNull(), // Text-based ICE card ID like "ice_xxx_card_0"
  icePreviewId: text("ice_preview_id").notNull(), // Parent ICE preview ID
  userId: integer("user_id").references(() => users.id), // nullable for anonymous
  displayName: text("display_name").notNull(),
  body: text("body").notNull(), // max 280 chars enforced at API level
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  iceCardIdIdx: index("idx_ice_card_messages_card").on(table.iceCardId),
  icePreviewIdIdx: index("idx_ice_card_messages_preview").on(table.icePreviewId),
}));

export const insertIceCardMessageSchema = createInsertSchema(iceCardMessages).omit({ id: true, createdAt: true });
export type InsertIceCardMessage = z.infer<typeof insertIceCardMessageSchema>;
export type IceCardMessage = typeof iceCardMessages.$inferSelect;

// ICE Card Message Reactions
export const iceCardMessageReactions = pgTable("ice_card_message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => iceCardMessages.id).notNull(),
  userId: integer("user_id").references(() => users.id), // nullable for anon fingerprint
  anonFingerprint: text("anon_fingerprint"), // for anonymous users
  reactionType: text("reaction_type").notNull(), // "like", "love", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIceCardMessageReactionSchema = createInsertSchema(iceCardMessageReactions).omit({ id: true, createdAt: true });
export type InsertIceCardMessageReaction = z.infer<typeof insertIceCardMessageReactionSchema>;
export type IceCardMessageReaction = typeof iceCardMessageReactions.$inferSelect;

// Audio Tracks (royalty-free soundtrack library)
export const audioTracks = pgTable("audio_tracks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist"),
  source: text("source").notNull().default("upload"), // "upload" | "external"
  licence: text("licence").default("Royalty Free"),
  licenceUrl: text("licence_url"),
  attributionRequired: boolean("attribution_required").default(false).notNull(),
  attributionText: text("attribution_text"),
  filePath: text("file_path"), // local file path
  fileUrl: text("file_url").notNull(), // served URL
  durationSeconds: integer("duration_seconds"),
  moodTags: jsonb("mood_tags").$type<string[]>().default([]),
  genreTags: jsonb("genre_tags").$type<string[]>().default([]),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAudioTrackSchema = createInsertSchema(audioTracks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAudioTrack = z.infer<typeof insertAudioTrackSchema>;
export type AudioTrack = typeof audioTracks.$inferSelect;

// Universe Audio Settings
export const universeAudioSettings = pgTable("universe_audio_settings", {
  id: serial("id").primaryKey(),
  universeId: integer("universe_id").references(() => universes.id).notNull().unique(),
  audioMode: text("audio_mode").notNull().default("off"), // "off" | "continuous" | "per_card"
  defaultTrackId: integer("default_track_id").references(() => audioTracks.id),
  allowedTrackIds: jsonb("allowed_track_ids").$type<number[]>().default([]),
  fadeInMs: integer("fade_in_ms").default(500).notNull(),
  fadeOutMs: integer("fade_out_ms").default(500).notNull(),
  crossfadeMs: integer("crossfade_ms").default(800).notNull(),
  duckingDuringVoiceOver: boolean("ducking_during_voice_over").default(true).notNull(),
  duckDb: integer("duck_db").default(12).notNull(),
});

export const insertUniverseAudioSettingsSchema = createInsertSchema(universeAudioSettings).omit({ id: true });
export type InsertUniverseAudioSettings = z.infer<typeof insertUniverseAudioSettingsSchema>;
export type UniverseAudioSettings = typeof universeAudioSettings.$inferSelect;

// Manifest validation schemas for ZIP import
export const manifestVisualStyleSchema = z.object({
  style_preset: z.string().optional(),
  base_prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  aspect_ratio: z.string().default("9:16"),
  render_model: z.string().optional(),
  guidance_scale: z.number().optional(),
  steps: z.number().optional(),
  sampler: z.string().optional(),
  consistency: z.object({
    character_lock: z.boolean().optional(),
    location_lock: z.boolean().optional(),
    colour_palette_lock: z.boolean().optional(),
    reference_images: z.array(z.string()).optional(),
  }).optional(),
}).optional();

export const manifestVisualContinuitySchema = z.object({
  art_direction: z.string().optional(),
  palette: z.string().optional(),
  camera_language: z.string().optional(),
  lighting_rules: z.string().optional(),
  texture_rules: z.string().optional(),
  taboo_list: z.array(z.string()).optional(),
  reference_tags: z.array(z.string()).optional(),
}).optional();

export const manifestCharacterVisualProfileSchema = z.object({
  continuity_description: z.string().optional(),
  age_range: z.string().optional(),
  ethnicity_optional: z.string().optional(),
  build: z.string().optional(),
  face_features: z.string().optional(),
  hair: z.string().optional(),
  wardrobe: z.string().optional(),
  accessories: z.string().optional(),
  mannerisms: z.string().optional(),
  do_not_change: z.array(z.string()).optional(),
  reference_image_path: z.string().optional(),
}).optional();

export const manifestLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  continuity_description: z.string().optional(),
  lighting: z.string().optional(),
  textures: z.string().optional(),
  do_not_change: z.array(z.string()).optional(),
});

export const manifestCardImageGenerationSchema = z.object({
  prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  shot_type: z.string().optional(),
  lighting: z.string().optional(),
  seed: z.number().optional(),
  notes: z.string().optional(),
}).optional();

// Manifest Chat Policy Schema (snake_case for JSON import)
export const manifestChatPolicySchema = z.object({
  mode: z.enum(["role_gated", "character_only"]).optional(),
  global_rules: z.array(z.string()).optional(),
  blocked_personas: z.array(z.string()).optional(),
  allowed_roles: z.array(z.string()).optional(),
  safety: z.object({
    no_harassment: z.boolean().optional(),
    no_self_harm_guidance: z.boolean().optional(),
    no_sexual_content: z.boolean().optional(),
    no_illegal_instructions: z.boolean().optional(),
  }).optional(),
  disclaimer: z.string().optional(),
}).optional();

// Manifest Chat Profile Schema (for characters)
export const manifestChatProfileSchema = z.object({
  voice: z.string().optional(),
  speech_style: z.string().optional(),
  goals: z.array(z.string()).optional(),
  knowledge: z.object({
    knows_up_to_dayIndex: z.union([z.number(), z.literal("dynamic")]).optional(),
    spoiler_protection: z.boolean().optional(),
  }).optional(),
  hard_limits: z.array(z.string()).optional(),
  allowed_topics: z.array(z.string()).optional(),
  blocked_topics: z.array(z.string()).optional(),
  refusal_style: z.string().optional(),
}).optional();

// Manifest Chat Overrides Schema (for cards)
export const manifestChatOverridesSchema = z.record(z.string(), z.object({
  mood: z.string().optional(),
  knows_up_to_dayIndex: z.number().optional(),
  refuse_topics: z.array(z.string()).optional(),
  can_reveal: z.array(z.string()).optional(),
})).optional();

export const manifestUniverseSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  styleNotes: z.string().optional(),
  visual_mode: z.enum(["engine_generated", "author_supplied"]).default("author_supplied"),
  visual_style: manifestVisualStyleSchema,
  visual_continuity: manifestVisualContinuitySchema,
  chat_policy: manifestChatPolicySchema,
});

export const manifestCharacterSchema = z.object({
  name: z.string(),
  role: z.string().default("Character"),
  personality: z.string().optional(),
  secretInfo: z.string().optional(),
  avatar: z.string().optional(),
  visual_profile: manifestCharacterVisualProfileSchema,
  chat_profile: manifestChatProfileSchema,
  is_public_figure_simulation: z.boolean().optional(),
});

export const manifestCardSchema = z.object({
  dayIndex: z.number(),
  title: z.string(),
  captions: z.array(z.string()).default([]),
  sceneText: z.string().default(""),
  recapText: z.string().default(""),
  effectTemplate: z.string().optional(),
  characters: z.array(z.string()).default([]),
  chat_unlocked_character_ids: z.array(z.string()).optional(), // Characters unlocked for chat after this card
  primary_character_ids: z.array(z.string()).optional(),
  location_id: z.string().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  imagePath: z.string().optional(),
  scene_description: z.string().optional(),
  image_generation: manifestCardImageGenerationSchema,
  chat_overrides: manifestChatOverridesSchema,
});

export const manifestSchema = z.object({
  universe: manifestUniverseSchema,
  season: z.number().default(1),
  startDate: z.string().optional(),
  characters: z.array(manifestCharacterSchema).default([]),
  locations: z.array(manifestLocationSchema).default([]),
  cards: z.array(manifestCardSchema).default([]),
});

export type ManifestData = z.infer<typeof manifestSchema>;

// ============ TRANSFORMATION JOBS (Universal Story Engine Pipeline) ============

export type TransformationStatus = 'queued' | 'running' | 'completed' | 'failed';

// Story length controls how many cards are generated
export type StoryLength = 'short' | 'medium' | 'long';
export const STORY_LENGTH_CARD_TARGETS = {
  short: 8,    // ~1 week of daily content
  medium: 16,  // ~2 weeks of daily content
  long: 24,    // ~3-4 weeks of daily content
} as const;
export type StageStatus = 'pending' | 'running' | 'done' | 'failed';
export type SourceType = 'script' | 'pdf' | 'ppt' | 'article' | 'transcript' | 'url' | 'unknown';

// Content metadata for URL-based transformations
export type ContentSourceType = 'website' | 'blog_post' | 'news_article' | 'documentation' | 'social_media' | 'press_release' | 'other';
export type ContentIndustry = 'technology' | 'healthcare' | 'finance' | 'entertainment' | 'education' | 'retail' | 'travel' | 'food' | 'sports' | 'real_estate' | 'other';
export type ContentCategory = 'news' | 'narrative' | 'marketing' | 'educational' | 'entertainment' | 'documentary' | 'promotional' | 'other';
export type ContentGoal = 'brand_awareness' | 'lead_generation' | 'audience_engagement' | 'product_launch' | 'thought_leadership' | 'storytelling' | 'education' | 'other';

export const stageArtifactsSchema = z.object({
  stage0: z.object({
    detected_type: z.string().optional(),
    parse_confidence: z.number().optional(),
    outline_count: z.number().optional(),
    warnings: z.array(z.string()).optional(),
  }).optional(),
  stage1: z.object({
    structure_summary: z.string().optional(),
    voice_notes: z.string().optional(),
    key_sections: z.array(z.string()).optional(),
  }).optional(),
  stage2: z.object({
    theme_statement: z.string().optional(),
    tone_tags: z.array(z.string()).optional(),
    genre_guess: z.string().optional(),
    audience_guess: z.string().optional(),
    guardrails: sourceGuardrailsSchema.optional(),
  }).optional(),
  stage3: z.object({
    characters: z.array(z.object({
      name: z.string(),
      role: z.string().optional(),
    })).optional(),
    locations: z.array(z.object({
      name: z.string(),
    })).optional(),
    world_rules: z.array(z.string()).optional(),
  }).optional(),
  stage4: z.object({
    card_count: z.number().optional(),
    hook_enabled: z.boolean().optional(),
    card_plan: z.array(z.object({
      dayIndex: z.number(),
      title: z.string(),
      intent: z.string().optional(),
    })).optional(),
  }).optional(),
  stage5: z.object({
    cards_drafted: z.boolean().optional(),
    image_prompts_ready: z.boolean().optional(),
    chat_prompts_ready: z.boolean().optional(),
    discussion_prompts_ready: z.boolean().optional(),
  }).optional(),
});

export type StageArtifacts = z.infer<typeof stageArtifactsSchema>;

export const stageStatusesSchema = z.object({
  stage0: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  stage1: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  stage2: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  stage3: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  stage4: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  stage5: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
});

export type StageStatuses = z.infer<typeof stageStatusesSchema>;

export const transformationJobs = pgTable("transformation_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  sourceType: text("source_type").$type<SourceType>().default("unknown"),
  sourceFileName: text("source_file_name"),
  sourceFilePath: text("source_file_path"),
  sourceUrl: text("source_url"),
  contentSourceType: text("content_source_type").$type<ContentSourceType>(),
  contentIndustry: text("content_industry").$type<ContentIndustry>(),
  contentCategory: text("content_category").$type<ContentCategory>(),
  contentGoal: text("content_goal").$type<ContentGoal>(),
  storyLength: text("story_length").$type<StoryLength>().default("medium"),
  status: text("status").$type<TransformationStatus>().default("queued").notNull(),
  currentStage: integer("current_stage").default(0).notNull(),
  stageStatuses: jsonb("stage_statuses").$type<StageStatuses>(),
  artifacts: jsonb("artifacts").$type<StageArtifacts>(),
  outputUniverseId: integer("output_universe_id").references(() => universes.id),
  errorCode: text("error_code"),
  errorMessageUser: text("error_message_user"),
  errorMessageDev: text("error_message_dev"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTransformationJobSchema = createInsertSchema(transformationJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransformationJob = z.infer<typeof insertTransformationJobSchema>;
export type TransformationJob = typeof transformationJobs.$inferSelect;

// ============ ICE PREVIEW (Guest Builder) ============
// Stores lightweight card previews for guest users before login

export type IcePreviewStatus = 'active' | 'promoted' | 'expired';
export type IcePreviewSourceType = 'url' | 'text' | 'file' | 'wizard';
export type IcePreviewTier = 'short' | 'medium' | 'long';
export type IceContentType = 'script' | 'article' | 'document' | 'unknown';
export type IceFidelityMode = 'script_exact' | 'interpretive';
export type IceContentContext = 'story' | 'article' | 'business' | 'auto';

// Scene map for structural ingest (scripts only)
export const iceSceneSchema = z.object({
  id: z.string(),
  order: z.number(),
  heading: z.string(), // e.g., "INT. STUDIO - NIGHT"
  location: z.string().optional(), // e.g., "STUDIO"
  timeOfDay: z.string().optional(), // e.g., "NIGHT"
  characters: z.array(z.string()), // Character names appearing in scene
  dialogue: z.array(z.object({
    character: z.string(),
    line: z.string(),
  })),
  action: z.string(), // Scene action/description
  isGenerated: z.boolean().default(false), // Whether card has been generated for this scene
});

export type IceScene = z.infer<typeof iceSceneSchema>;

export const iceSceneMapSchema = z.object({
  contentType: z.enum(['script', 'article', 'document', 'unknown']),
  fidelityMode: z.enum(['script_exact', 'interpretive']),
  totalScenes: z.number(),
  generatedScenes: z.number(),
  scenes: z.array(iceSceneSchema),
});

export type IceSceneMap = z.infer<typeof iceSceneMapSchema>;

// Media asset for ICE cards - supports multiple user uploads and AI generations
export const iceMediaAssetSchema = z.object({
  id: z.string(), // Unique ID for this asset
  kind: z.enum(['image', 'video']),
  source: z.enum(['upload', 'ai']), // User uploaded or AI generated
  url: z.string(), // Full URL or storage path
  thumbnailUrl: z.string().optional(), // Poster for video or thumb for image
  createdAt: z.string(), // ISO timestamp
  // For AI-generated assets
  prompt: z.string().optional(), // Base prompt used
  enhancedPrompt: z.string().optional(), // Enhanced prompt if used
  negativePrompt: z.string().optional(), // Negative prompt if used
  // Generation metadata
  status: z.enum(['ready', 'generating', 'failed']).default('ready'),
  predictionId: z.string().optional(), // For async generation tracking
  model: z.string().optional(), // Which AI model was used
  bibleVersionIdUsed: z.string().optional(), // Bible version for continuity tracking
});

export type IceMediaAsset = z.infer<typeof iceMediaAssetSchema>;

export const icePreviewCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number(),
  sceneId: z.string().optional(), // Links to scene in sceneMap (for script-exact mode)
  dialoguePreserved: z.array(z.string()).optional(), // Key dialogue lines preserved verbatim
  
  // New media asset system (multi-variant support)
  mediaAssets: z.array(iceMediaAssetSchema).optional(), // All media assets for this card
  selectedMediaAssetId: z.string().optional(), // Which asset is currently active
  
  // Legacy fields (backward compatibility - derived from mediaAssets for old clients)
  generatedImageUrl: z.string().optional(),
  generatedVideoUrl: z.string().optional(),
  videoGenerationStatus: z.string().optional(),
  videoPredictionId: z.string().optional(),
  narrationAudioUrl: z.string().optional(),
  
  // Prompt enhancement settings
  enhancePromptEnabled: z.boolean().optional(), // Whether to use enhanced prompts
  basePrompt: z.string().optional(), // The base prompt from card content
  enhancedPrompt: z.string().optional(), // LLM-enhanced prompt (editable)
  
  // Continuity tracking
  charactersPresent: z.array(z.string()).optional(), // Character IDs appearing in this card
  bibleVersionIdUsed: z.string().optional(), // Which bible version was used for media generation
});

export type IcePreviewCard = z.infer<typeof icePreviewCardSchema>;

// ============ PROJECT BIBLE (Continuity Guardrails) ============

// Character Bible Entry - defines a character's canonical appearance and traits
export const characterBibleEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(), // e.g., "protagonist", "antagonist", "supporting"
  physicalTraits: z.object({
    ageRange: z.string().optional(), // e.g., "late 30s"
    build: z.string().optional(), // e.g., "athletic", "slender", "stocky"
    skinTone: z.string().optional(),
    hairStyle: z.string().optional(),
    hairColor: z.string().optional(),
    facialFeatures: z.string().optional(), // e.g., "scar on left cheek", "sharp jawline"
    distinguishingMarks: z.string().optional(), // e.g., "tattoo on right arm"
  }).optional(),
  wardrobeRules: z.object({
    signatureItems: z.array(z.string()).optional(), // e.g., ["leather jacket", "red scarf"]
    colorPalette: z.array(z.string()).optional(), // e.g., ["black", "dark gray", "crimson"]
    style: z.string().optional(), // e.g., "formal", "streetwear", "victorian"
  }).optional(),
  mannerisms: z.string().optional(), // e.g., "nervous energy, constantly fidgeting"
  lockedTraits: z.array(z.string()).default([]), // Traits that must never change
  referenceImages: z.array(z.string()).optional(), // URLs to reference/model sheet images
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CharacterBibleEntry = z.infer<typeof characterBibleEntrySchema>;

// World Bible - defines the story's setting and visual language
export const worldBibleSchema = z.object({
  setting: z.object({
    place: z.string().optional(), // e.g., "Neo Tokyo", "Victorian London"
    era: z.string().optional(), // e.g., "2077", "1888", "medieval"
    culture: z.string().optional(), // e.g., "cyberpunk", "steampunk"
  }).optional(),
  visualLanguage: z.object({
    cinematicStyle: z.string().optional(), // e.g., "noir", "dreamlike", "gritty realism"
    lighting: z.string().optional(), // e.g., "neon-lit", "natural", "dramatic shadows"
    lensVibe: z.string().optional(), // e.g., "35mm film grain", "anamorphic", "telephoto compression"
    realismLevel: z.enum(['photorealistic', 'stylized', 'illustrated', 'animated']).optional(),
  }).optional(),
  environmentAnchors: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualDetails: z.string().optional(),
  })).optional(), // Recurring locations/props
  toneRules: z.object({
    mood: z.string().optional(), // e.g., "tense", "hopeful", "melancholic"
    genre: z.string().optional(), // e.g., "thriller", "comedy", "romance"
  }).optional(),
  lockedWorldTraits: z.array(z.string()).default([]), // e.g., ["no modern technology", "always night"]
  updatedAt: z.string().optional(),
});

export type WorldBible = z.infer<typeof worldBibleSchema>;

// Style Bible - defines technical generation settings
export const styleBibleSchema = z.object({
  aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:3', '3:4']).default('9:16'),
  noOnScreenText: z.boolean().default(true), // Critical: no text in AI images
  realismLevel: z.enum(['photorealistic', 'stylized', 'illustrated', 'animated']).optional(),
  colorGrading: z.string().optional(), // e.g., "warm tones", "desaturated", "high contrast"
  cameraMovement: z.string().optional(), // e.g., "steady", "handheld", "sweeping"
  additionalNegativePrompts: z.array(z.string()).optional(), // Always exclude these
  updatedAt: z.string().optional(),
});

export type StyleBible = z.infer<typeof styleBibleSchema>;

// Complete Project Bible with versioning
export const projectBibleSchema = z.object({
  versionId: z.string(), // UUID for this version
  version: z.number().default(1), // Incrementing version number
  characters: z.array(characterBibleEntrySchema).default([]),
  world: worldBibleSchema.optional(),
  style: styleBibleSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().optional(), // user ID or "system"
});

export type ProjectBible = z.infer<typeof projectBibleSchema>;

export const icePreviewCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  avatar: z.string().optional(),
  avatarEnabled: z.boolean().optional().default(false),
  systemPrompt: z.string(),
  openingMessage: z.string(),
});

export type IcePreviewCharacter = z.infer<typeof icePreviewCharacterSchema>;

export const iceInteractivityNodeSchema = z.object({
  id: z.string(),
  afterCardIndex: z.number(),
  isActive: z.boolean().default(false),
  selectedCharacterId: z.string().optional(),
});

export type IceInteractivityNode = z.infer<typeof iceInteractivityNodeSchema>;

export const icePreviews = pgTable("ice_previews", {
  id: text("id").primaryKey(), // e.g., ice_1234567890_abc123
  ownerIp: text("owner_ip"), // For rate limiting anonymous previews
  ownerUserId: integer("owner_user_id").references(() => users.id), // Linked after login
  
  // Secure claiming (prevents hijacking if preview URLs leak)
  claimTokenHash: text("claim_token_hash"), // bcrypt hash of claim token (single-use)
  claimTokenUsedAt: timestamp("claim_token_used_at"), // When token was used to claim
  
  // Source content
  sourceType: text("source_type").$type<IcePreviewSourceType>().notNull(),
  sourceValue: text("source_value").notNull(), // URL or text content
  
  // Structural ingest (Story Fidelity Modes)
  contentType: text("content_type").$type<IceContentType>().default("unknown"), // script, article, document
  fidelityMode: text("fidelity_mode").$type<IceFidelityMode>().default("interpretive"), // script_exact or interpretive
  sceneMap: jsonb("scene_map").$type<IceSceneMap>(), // Full scene structure for scripts
  contentContext: text("content_context").$type<IceContentContext>().default("auto"), // User-selected context for URL ingestion
  
  // Preview data
  title: text("title").notNull(),
  cards: jsonb("cards").$type<IcePreviewCard[]>().notNull(),
  characters: jsonb("characters").$type<IcePreviewCharacter[]>().default([]),
  interactivityNodes: jsonb("interactivity_nodes").$type<IceInteractivityNode[]>().default([]),
  tier: text("tier").$type<IcePreviewTier>().default("short").notNull(),
  
  // Project Bible (Continuity Guardrails)
  projectBible: jsonb("project_bible").$type<ProjectBible>(),
  
  // Audio settings (music + narration)
  musicTrackUrl: text("music_track_url"), // URL to background music file
  musicVolume: integer("music_volume").default(50), // 0-100 volume level
  narrationVolume: integer("narration_volume").default(100), // 0-100 volume level
  musicEnabled: boolean("music_enabled").default(false),
  
  // Typography settings (Title Packs - legacy)
  titlePackId: text("title_pack_id").default("cinematic-subtitles"), // Legacy title pack for visual style
  
  // Caption Engine settings (replaces Title Packs)
  captionSettings: jsonb("caption_settings").$type<{
    presetId?: string;
    animationId?: string;
    safeAreaProfileId?: string;
    karaokeEnabled?: boolean;
    karaokeStyle?: string;
  }>(),
  
  // Access control
  visibility: text("visibility").$type<ContentVisibility>().default("unlisted").notNull(), // Guest previews default to unlisted
  shareSlug: text("share_slug").unique(), // Human-friendly 8-char slug for published ICEs
  
  // Lead Gate settings
  leadGateEnabled: boolean("lead_gate_enabled").default(false), // Require email before viewing
  leadGatePrompt: text("lead_gate_prompt"), // Custom prompt for lead capture (e.g., "Enter your email to continue")
  
  // Logo Branding settings
  logoEnabled: boolean("logo_enabled").default(false), // Show logo on every card
  logoUrl: text("logo_url"), // URL to uploaded logo image
  logoPosition: text("logo_position").$type<"top-left" | "top-right" | "bottom-left" | "bottom-right">().default("top-right"), // Position on cards
  
  // Status
  status: text("status").$type<IcePreviewStatus>().default("active").notNull(),
  promotedToJobId: integer("promoted_to_job_id").references(() => transformationJobs.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 72 hours from creation
  promotedAt: timestamp("promoted_at"),
  publishedAt: timestamp("published_at"), // When ICE was first published (unlisted or public)
});

export const insertIcePreviewSchema = createInsertSchema(icePreviews).omit({ createdAt: true });
export type InsertIcePreview = z.infer<typeof insertIcePreviewSchema>;
export type IcePreview = typeof icePreviews.$inferSelect;

// ============ ICE LEADS (Lead capture for published ICEs) ============

export const iceLeads = pgTable("ice_leads", {
  id: serial("id").primaryKey(),
  iceId: text("ice_id").references(() => icePreviews.id).notNull(),
  
  // Lead information
  email: text("email").notNull(),
  name: text("name"), // Optional name if collected
  
  // Attribution
  visitorIp: text("visitor_ip"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIceLeadSchema = createInsertSchema(iceLeads).omit({ id: true, createdAt: true });
export type InsertIceLead = z.infer<typeof insertIceLeadSchema>;
export type IceLead = typeof iceLeads.$inferSelect;

// ============ ORBIT → ICE FLYWHEEL (Types Only - Tables in main ICE section) ============

// ICE Template types for Orbit-powered content
export type IceTemplateType = 'compare_ice' | 'shortlist_ice' | 'weekly_pulse_ice' | 'buyer_checklist_ice' | 'custom';

// View types from Orbit windscreen
export type OrbitViewType = 'compare' | 'shortlist' | 'timeline' | 'pulse' | 'evidence' | 'none';

// Orbit View State for deep linking
export const orbitViewStateSchema = z.object({
  question: z.string().optional(),
  viewType: z.enum(['compare', 'shortlist', 'timeline', 'pulse', 'evidence', 'none']).optional(),
  selectedEntities: z.array(z.string()).optional(), // product/brand IDs
  filters: z.record(z.string(), z.any()).optional(), // use-case chips, etc.
  highlightTarget: z.string().optional(), // row ID to highlight
});

export type OrbitViewState = z.infer<typeof orbitViewStateSchema>;

// ICE Draft Payload from Orbit capture
export const iceDraftPayloadSchema = z.object({
  orbitSlug: z.string(),
  orbitType: z.enum(['industry', 'standard']),
  sourceMessageId: z.string().optional(),
  viewType: z.enum(['compare', 'shortlist', 'timeline', 'pulse', 'evidence', 'none']),
  viewData: z.any().optional(), // structured JSON from view
  summaryText: z.string(),
  sources: z.array(z.string()).optional(),
  recommendedTemplate: z.enum(['compare_ice', 'shortlist_ice', 'weekly_pulse_ice', 'buyer_checklist_ice', 'custom']),
  deepLink: z.string(),
});

export type IceDraftPayload = z.infer<typeof iceDraftPayloadSchema>;

// ICE Analytics Events (for tracking flywheel metrics)
export type IceAnalyticsEventType = 'ice_view' | 'ice_share' | 'cta_click_to_orbit' | 'orbit_session_started_from_ice';

// Moderation status for influencer submissions
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

// ============ SUBSCRIPTION & ENTITLEMENTS ============

// Plans table (Free, Pro, Business)
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  monthlyPrice: integer("monthly_price").default(0).notNull(),
  yearlyPrice: integer("yearly_price"),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  features: jsonb("features").$type<PlanFeatures>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const planFeaturesSchema = z.object({
  maxCardsPerStory: z.number().default(5),
  storageDays: z.number().default(7),
  canUseCloudLlm: z.boolean().default(false),
  canGenerateImages: z.boolean().default(false),
  canExport: z.boolean().default(false),
  canUseCharacterChat: z.boolean().default(false),
  monthlyVideoCredits: z.number().default(0),
  monthlyVoiceCredits: z.number().default(0),
  collaborationRoles: z.boolean().default(false),
  canUploadMedia: z.boolean().default(false),
  storageQuotaBytes: z.number().default(0), // 0 = no uploads, Pro = 2GB, Business = 10GB
  maxIces: z.number().default(5), // ICE limit per tier: Starter=5, Creator=15, Studio=50
  aiBillingModel: z.enum(['included', 'pay_as_you_go', 'credits']).default('pay_as_you_go'),
});

export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

// Subscriptions table
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  planId: integer("plan_id").references(() => plans.id).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").$type<SubscriptionStatus>().default("active").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  lastCreditGrantPeriodEnd: timestamp("last_credit_grant_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing" | "paused";

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Entitlements table (computed from subscription + plan)
export const entitlements = pgTable("entitlements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  canUseCloudLlm: boolean("can_use_cloud_llm").default(false).notNull(),
  canGenerateImages: boolean("can_generate_images").default(false).notNull(),
  canExport: boolean("can_export").default(false).notNull(),
  canUseCharacterChat: boolean("can_use_character_chat").default(false).notNull(),
  maxCardsPerStory: integer("max_cards_per_story").default(5).notNull(),
  storageDays: integer("storage_days").default(7).notNull(),
  collaborationRoles: boolean("collaboration_roles").default(false).notNull(),
  canUploadMedia: boolean("can_upload_media").default(false).notNull(),
  storageQuotaBytes: integer("storage_quota_bytes").default(0).notNull(), // 0 = no uploads
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEntitlementSchema = createInsertSchema(entitlements).omit({ id: true, updatedAt: true });
export type InsertEntitlement = z.infer<typeof insertEntitlementSchema>;
export type Entitlement = typeof entitlements.$inferSelect;

// Credit Wallets table
export const creditWallets = pgTable("credit_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  videoCredits: integer("video_credits").default(0).notNull(),
  voiceCredits: integer("voice_credits").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCreditWalletSchema = createInsertSchema(creditWallets).omit({ id: true, updatedAt: true });
export type InsertCreditWallet = z.infer<typeof insertCreditWalletSchema>;
export type CreditWallet = typeof creditWallets.$inferSelect;

// Credit Events table (audit log)
export const creditEvents = pgTable("credit_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  eventType: text("event_type").$type<CreditEventType>().notNull(),
  creditType: text("credit_type").$type<CreditType>().notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  meta: jsonb("meta").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditEventType = "purchase" | "spend" | "refund" | "monthly_grant" | "admin_adjustment";
export type CreditType = "video" | "voice";

export const insertCreditEventSchema = createInsertSchema(creditEvents).omit({ id: true, createdAt: true });
export type InsertCreditEvent = z.infer<typeof insertCreditEventSchema>;
export type CreditEvent = typeof creditEvents.$inferSelect;

// Checkout Transactions table (idempotency for one-time charges)
export type CheckoutTransactionStatus = "pending" | "completed" | "failed" | "refunded";

export const checkoutTransactions = pgTable("checkout_transactions", {
  id: serial("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(), // Hash of (userId + previewId + options)
  userId: integer("user_id").references(() => users.id).notNull(),
  previewId: text("preview_id"), // Links to ice_previews
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  status: text("status").$type<CheckoutTransactionStatus>().default("pending").notNull(),
  amountCents: integer("amount_cents").notNull(), // Total amount in cents
  currency: text("currency").default("usd").notNull(),
  checkoutOptions: jsonb("checkout_options").$type<{
    mediaOptions: { images: boolean; video: boolean; music: boolean; voiceover: boolean };
    outputChoice: "download" | "publish";
    expansionScope: string;
    selectedPlan: string | null;
    interactivityNodeCount: number;
  }>(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCheckoutTransactionSchema = createInsertSchema(checkoutTransactions).omit({ id: true, createdAt: true });
export type InsertCheckoutTransaction = z.infer<typeof insertCheckoutTransactionSchema>;
export type CheckoutTransaction = typeof checkoutTransactions.$inferSelect;

// TTS Usage Log (for billing/usage tracking)
export const ttsUsage = pgTable("tts_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  universeId: integer("universe_id").references(() => universes.id).notNull(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  charsCount: integer("chars_count").notNull(),
  voiceId: text("voice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTtsUsageSchema = createInsertSchema(ttsUsage).omit({ id: true, createdAt: true });
export type InsertTtsUsage = z.infer<typeof insertTtsUsageSchema>;
export type TtsUsage = typeof ttsUsage.$inferSelect;

// ============ USER MEDIA UPLOADS ============

// Media asset types
export type MediaAssetType = 'image' | 'video';

// Media asset source type
export type MediaAssetSource = 'uploaded' | 'scraped' | 'ai_generated';

// Card media assets (user-uploaded images/videos for cards)
export const cardMediaAssets = pgTable("card_media_assets", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(), // Owner
  mediaType: text("media_type").$type<MediaAssetType>().notNull(),
  storageKey: text("storage_key").notNull(), // Object storage path
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  duration: integer("duration"), // For videos, in seconds
  isActive: boolean("is_active").default(true).notNull(), // Soft delete for quota reclaim
  // Source tracking for scraped images
  source: text("source").$type<MediaAssetSource>().default('uploaded').notNull(),
  sourceUrl: text("source_url"), // Original URL for scraped images
  attribution: text("attribution"), // Credit/source text
  altText: text("alt_text"), // Alt text from original image
  caption: text("caption"), // Caption or nearby text context
  relevanceScore: integer("relevance_score"), // 0-100 matching score for auto-assignment
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardMediaAssetSchema = createInsertSchema(cardMediaAssets).omit({ id: true, createdAt: true });
export type InsertCardMediaAsset = z.infer<typeof insertCardMediaAssetSchema>;
export type CardMediaAsset = typeof cardMediaAssets.$inferSelect;

// User storage usage (aggregated storage tracking for quota enforcement)
export const userStorageUsage = pgTable("user_storage_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  totalBytesUsed: integer("total_bytes_used").default(0).notNull(),
  imageCount: integer("image_count").default(0).notNull(),
  videoCount: integer("video_count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserStorageUsageSchema = createInsertSchema(userStorageUsage).omit({ id: true, updatedAt: true });
export type InsertUserStorageUsage = z.infer<typeof insertUserStorageUsageSchema>;
export type UserStorageUsage = typeof userStorageUsage.$inferSelect;

// File size limits (in bytes)
export const MEDIA_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10 MB max for images
  video: 200 * 1024 * 1024, // 200 MB max for videos
} as const;

// Storage quotas by tier (in bytes)
export const STORAGE_QUOTAS = {
  free: 0, // No uploads for free tier
  pro: 2 * 1024 * 1024 * 1024, // 2 GB
  business: 10 * 1024 * 1024 * 1024, // 10 GB
} as const;

// Allowed MIME types
export const ALLOWED_MEDIA_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
} as const;

// ============ USER ONBOARDING PROFILES ============

// Persona/Lens types for customized onboarding
// Legacy: news_outlet, business, influencer, educator, creator, other
// New lenses: brand (business), creator (creative), knowledge (learning)
export type UserPersona = 'news_outlet' | 'business' | 'influencer' | 'educator' | 'creator' | 'other' | 'brand' | 'knowledge';
export type UserIndustry = 'media' | 'technology' | 'healthcare' | 'finance' | 'entertainment' | 'education' | 'retail' | 'travel' | 'food' | 'sports' | 'real_estate' | 'nonprofit' | 'government' | 'other';

// First-run onboarding path types
export type OnboardingPath = 'orbit-first' | 'ice-first' | null;

export const userOnboardingProfiles = pgTable("user_onboarding_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  persona: text("persona").$type<UserPersona>().notNull(),
  industry: text("industry").$type<UserIndustry>(),
  companyName: text("company_name"),
  teamSize: text("team_size"), // 'solo', '2-10', '11-50', '51-200', '200+'
  goals: text("goals").array(), // e.g., ['brand_awareness', 'audience_engagement', 'lead_generation']
  targetAudience: text("target_audience"),
  contentFrequency: text("content_frequency"), // 'daily', 'weekly', 'monthly', 'occasional'
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingDismissed: boolean("onboarding_dismissed").default(false).notNull(),
  onboardingPath: text("onboarding_path").$type<OnboardingPath>(),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserOnboardingProfileSchema = createInsertSchema(userOnboardingProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserOnboardingProfile = z.infer<typeof insertUserOnboardingProfileSchema>;
export type UserOnboardingProfile = typeof userOnboardingProfiles.$inferSelect;

// Preview Instances for Micro Smart Site previews
export type PreviewStatus = 'active' | 'archived' | 'claimed';

export const validatedContentSchema = z.object({
  overview: z.string(),
  whatWeDo: z.array(z.string()),
  commonQuestions: z.array(z.object({
    question: z.string(),
    contextPrompt: z.string(),
  })),
  brandName: z.string(),
  passed: z.boolean(),
  issues: z.array(z.string()),
}).optional();

export type ValidatedContent = z.infer<typeof validatedContentSchema>;

export const testimonialSchema = z.object({
  quote: z.string(),
  author: z.string().nullable(),
  role: z.string().nullable(),
  company: z.string().nullable(),
  rating: z.number().nullable(),
  imageUrl: z.string().nullable(),
});

export type Testimonial = z.infer<typeof testimonialSchema>;

export const faqPairSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export type FaqPair = z.infer<typeof faqPairSchema>;

export const structuredDataSchema = z.object({
  organization: z.object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    logo: z.string().nullable(),
    sameAs: z.array(z.string()).default([]),
  }).nullable(),
  products: z.array(z.object({
    name: z.string(),
    description: z.string().nullable(),
    price: z.string().nullable(),
    imageUrl: z.string().nullable(),
  })).default([]),
  faqs: z.array(faqPairSchema).default([]),
  events: z.array(z.object({
    name: z.string(),
    description: z.string().nullable(),
    startDate: z.string().nullable(),
    location: z.string().nullable(),
  })).default([]),
  people: z.array(z.object({
    name: z.string(),
    jobTitle: z.string().nullable(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
  })).default([]),
});

export type StructuredData = z.infer<typeof structuredDataSchema>;

export const siteIdentitySchema = z.object({
  sourceDomain: z.string(),
  title: z.string().nullable(),
  heroHeadline: z.string().nullable(),
  heroDescription: z.string().nullable(),
  logoUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  primaryColour: z.string().default('#7c3aed'),
  serviceHeadings: z.array(z.string()).default([]),
  serviceBullets: z.array(z.string()).default([]),
  faqCandidates: z.array(z.string()).default([]),
  imagePool: z.array(z.string()).default([]),
  extractedAt: z.string(),
  validatedContent: validatedContentSchema,
  structuredData: structuredDataSchema.nullable().optional(),
  testimonials: z.array(testimonialSchema).default([]),
  enhancedFaqs: z.array(faqPairSchema).default([]),
  // Extraction metadata for quality monitoring (optional for backward compatibility)
  extractionMetadata: z.object({
    titleSource: z.enum(['json-ld', 'opengraph', 'twitter', 'microdata', 'dom', 'ai', 'fallback']),
    titleConfidence: z.number().min(0).max(1),
    descriptionSource: z.enum(['json-ld', 'opengraph', 'twitter', 'microdata', 'dom', 'ai', 'fallback']),
    descriptionConfidence: z.number().min(0).max(1),
    logoSource: z.enum(['json-ld', 'opengraph', 'twitter', 'microdata', 'dom', 'ai', 'fallback']),
    logoConfidence: z.number().min(0).max(1),
  }).optional(),
});

export type SiteIdentity = z.infer<typeof siteIdentitySchema>;

export const previewInstances = pgTable("preview_instances", {
  id: text("id").primaryKey(), // UUID
  ownerUserId: integer("owner_user_id").references(() => users.id), // Nullable for anonymous previews
  ownerIp: text("owner_ip"), // For rate limiting anonymous previews
  sourceUrl: text("source_url").notNull(),
  sourceDomain: text("source_domain").notNull(),
  status: text("status").$type<PreviewStatus>().default("active").notNull(),

  // Site identity for brand continuity
  siteIdentity: jsonb("site_identity").$type<SiteIdentity>(),

  // Legacy site summary fields (kept for compatibility)
  siteTitle: text("site_title"),
  siteSummary: text("site_summary"), // 1-3 paragraphs
  keyServices: text("key_services").array(), // Array of services/products
  contactInfo: jsonb("contact_info"), // Optional contact details

  // Usage caps
  messageCount: integer("message_count").default(0).notNull(),
  maxMessages: integer("max_messages").default(25).notNull(),
  ingestedPagesCount: integer("ingested_pages_count").default(0).notNull(),
  maxPages: integer("max_pages").default(4).notNull(),
  totalCharsIngested: integer("total_chars_ingested").default(0).notNull(),

  // Cost tracking
  costEstimatePence: integer("cost_estimate_pence").default(0),
  llmCallCount: integer("llm_call_count").default(0),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // createdAt + 48h
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
  claimedAt: timestamp("claimed_at"),

  // Claim details
  claimedPlanId: integer("claimed_plan_id").references(() => plans.id),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
});

export const insertPreviewInstanceSchema = createInsertSchema(previewInstances).omit({ createdAt: true, lastActiveAt: true });
export type InsertPreviewInstance = z.infer<typeof insertPreviewInstanceSchema>;
export type PreviewInstance = typeof previewInstances.$inferSelect;

// Preview chat messages (lightweight conversation history)
export const previewChatMessages = pgTable("preview_chat_messages", {
  id: serial("id").primaryKey(),
  previewId: text("preview_id").references(() => previewInstances.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPreviewChatMessageSchema = createInsertSchema(previewChatMessages).omit({ id: true, createdAt: true });
export type InsertPreviewChatMessage = z.infer<typeof insertPreviewChatMessageSchema>;
export type PreviewChatMessage = typeof previewChatMessages.$inferSelect;

// Export chat models for AI integrations
export * from "./models/chat";

// ============ ORBIT SYSTEM ============

// Generation status for Orbit pack generation
export type OrbitGenerationStatus = 'idle' | 'generating' | 'ready' | 'failed' | 'blocked';

// Orbit tier levels (locked decision)
export type OrbitTier = 'free' | 'grow' | 'insight' | 'intelligence';

// ============ ORBIT TYPE DOCTRINE (LOCKED - SYSTEM INVARIANT) ============
// This distinction is architectural, philosophical, and non-negotiable.
// 
// INDUSTRY ORBITS: Neutral, unowned, public intelligence spaces.
//   - Can NEVER be claimed, owned, or controlled by a user, brand, or organisation.
//   - "Inhabited, not owned" - users participate but don't control.
//   - Pre-seeded with foundational knowledge, continuously updated.
//   - Detect events even with zero user activity.
//
// STANDARD ORBITS: Claimable, owned by users/brands.
//   - May be claimed and grant ownership + editorial control.
//   - Intelligence emerges primarily through user interaction.
//   - May be opinionated, biased, commercial, or project-specific.
//
// FORBIDDEN ACTIONS (treat as hard errors):
//   - Claiming an Industry Orbit
//   - Assigning an "owner" to an Industry Orbit
//   - Allowing Industry Orbits to go dormant due to inactivity
// =========================================================================
export type OrbitType = 'industry' | 'standard';

// Orbit Meta - tracks business orbits and links to existing preview data
export const orbitMeta = pgTable("orbit_meta", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").notNull().unique(),
  sourceUrl: text("source_url").notNull(),
  
  // CRITICAL: Orbit Type (immutable after creation) - determines all permissions and lifecycle
  // 'industry' = neutral, unowned, public intelligence space (e.g., Smart Glasses)
  // 'standard' = claimable, ownable by users/brands (default for business orbits)
  orbitType: text("orbit_type").$type<OrbitType>().default("standard").notNull(),
  
  // Link to existing preview (uses existing preview system for rich data)
  previewId: text("preview_id").references(() => previewInstances.id),
  
  // Pack versioning (DB pointer, no mutable latest.json) - deprecated, use previewId
  currentPackVersion: text("current_pack_version"),
  currentPackKey: text("current_pack_key"),
  
  // Ownership (null = unclaimed preview)
  ownerId: integer("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  verifiedAt: timestamp("verified_at"),
  
  // Access control (unclaimed orbits are public by default for discovery)
  visibility: text("visibility").$type<ContentVisibility>().default("public").notNull(),
  
  // Generation job tracking
  generationStatus: text("generation_status").$type<OrbitGenerationStatus>().default("idle").notNull(),
  generationJobId: text("generation_job_id"),
  requestedAt: timestamp("requested_at"),
  completedAt: timestamp("completed_at"),
  lastError: text("last_error"),
  
  // Brand customization (after claiming)
  customLogo: text("custom_logo"),
  customAccent: text("custom_accent"),
  customTone: text("custom_tone"),
  customTitle: text("custom_title"),
  customDescription: text("custom_description"),
  
  // Tier (free | grow | insight | intelligence)
  planTier: text("plan_tier").default("free").notNull(),
  
  // Power-Up strength score (0-100, calculated from sources provided)
  strengthScore: integer("strength_score").default(0).notNull(),
  
  // ICE Allowance (Phase 2: bundled credits for Insight tier)
  iceAllowanceMonthly: integer("ice_allowance_monthly").default(0).notNull(),
  iceUsedThisPeriod: integer("ice_used_this_period").default(0).notNull(),
  icePeriodStart: timestamp("ice_period_start"),
  
  // Proof Capture Mode (auto-testimonial capture)
  proofCaptureEnabled: boolean("proof_capture_enabled").default(true).notNull(),
  
  // AI Discovery Settings
  aiIndexingEnabled: boolean("ai_indexing_enabled").default(true).notNull(),
  autoUpdateKnowledge: boolean("auto_update_knowledge").default(true).notNull(),
  
  // Notification Preferences
  aiAccuracyAlertsEnabled: boolean("ai_accuracy_alerts_enabled").default(true).notNull(),
  weeklyReportsEnabled: boolean("weekly_reports_enabled").default(false).notNull(),
  
  // Stats
  totalPackVersions: integer("total_pack_versions").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitMetaSchema = createInsertSchema(orbitMeta).omit({ id: true, createdAt: true, lastUpdated: true });
export type InsertOrbitMeta = z.infer<typeof insertOrbitMetaSchema>;
export type OrbitMeta = typeof orbitMeta.$inferSelect;

// Orbit Claim Tokens - magic link tokens for claiming ownership
export const orbitClaimTokens = pgTable("orbit_claim_tokens", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  domainMatch: boolean("domain_match").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitClaimTokenSchema = createInsertSchema(orbitClaimTokens).omit({ id: true, createdAt: true });
export type InsertOrbitClaimToken = z.infer<typeof insertOrbitClaimTokenSchema>;
export type OrbitClaimToken = typeof orbitClaimTokens.$inferSelect;

// Orbit Sources - Power-Up sources submitted via wizard (pages, socials, etc.)
export type OrbitSourceType = 'page_url' | 'page_text' | 'social_link';
export type OrbitSourceLabel = 'about' | 'services' | 'faq' | 'contact' | 'homepage' | 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube';

export const orbitSources = pgTable("orbit_sources", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  
  label: text("label").$type<OrbitSourceLabel>().notNull(),
  sourceType: text("source_type").$type<OrbitSourceType>().notNull(),
  value: text("value").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlugLabel: unique().on(table.businessSlug, table.label),
}));

export const insertOrbitSourceSchema = createInsertSchema(orbitSources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrbitSource = z.infer<typeof insertOrbitSourceSchema>;
export type OrbitSource = typeof orbitSources.$inferSelect;

// Orbit Documents - Uploaded documents (PDFs, presentations, manuals) for AI context
export type OrbitDocumentType = 'pdf' | 'ppt' | 'pptx' | 'doc' | 'docx' | 'txt' | 'md';
export type OrbitDocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';
export type OrbitDocumentCategory = 'product_manual' | 'presentation' | 'brochure' | 'specification' | 'guide' | 'other';

export const orbitDocuments = pgTable("orbit_documents", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id),
  
  // File info
  fileName: text("file_name").notNull(),
  fileType: text("file_type").$type<OrbitDocumentType>().notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  
  // Metadata
  title: text("title"),
  description: text("description"),
  category: text("category").$type<OrbitDocumentCategory>().default('other'),
  
  // Extracted content
  extractedText: text("extracted_text"),
  pageCount: integer("page_count"),
  
  // Processing status
  status: text("status").$type<OrbitDocumentStatus>().default('uploading').notNull(),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrbitDocumentSchema = createInsertSchema(orbitDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrbitDocument = z.infer<typeof insertOrbitDocumentSchema>;
export type OrbitDocument = typeof orbitDocuments.$inferSelect;

// Hero Posts - Curated high-performing social posts for learning and content generation
export type HeroPostPlatform = 'linkedin' | 'x' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'other';
export type HeroPostStatus = 'pending' | 'enriching' | 'needs_text' | 'ready' | 'error';
export type HeroPostAuthorType = 'business_voice' | 'company_page' | 'unknown';

export const heroPosts = pgTable("hero_posts", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  
  // Source info
  sourcePlatform: text("source_platform").$type<HeroPostPlatform>().notNull(),
  url: text("url").notNull(),
  
  // Author info
  authorName: text("author_name"),
  authorType: text("author_type").$type<HeroPostAuthorType>().default('unknown'),
  businessVoiceId: integer("business_voice_id"),
  
  // Content
  title: text("title"),
  text: text("text"),
  outcomeNote: text("outcome_note"),
  performedBecause: jsonb("performed_because").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>(),
  
  // OpenGraph metadata
  ogImageUrl: text("og_image_url"),
  ogDescription: text("og_description"),
  publishedAt: timestamp("published_at"),
  
  // Processing status
  status: text("status").$type<HeroPostStatus>().default('pending').notNull(),
  errorMessage: text("error_message"),
  
  // Extracted insights (populated by AI)
  extracted: jsonb("extracted").$type<{
    topics?: string[];
    hookType?: string;
    intent?: 'educate' | 'sell' | 'recruit' | 'culture' | 'proof';
    offers?: string[];
    proofPoints?: string[];
    entities?: string[];
    riskFlags?: string[];
    followUpIdeas?: Array<{ title: string; hook: string; linkBack: string }>;
  }>(),
  
  // Knowledge toggle - when true, post content is used as factual knowledge for chat
  useAsKnowledge: boolean("use_as_knowledge").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlugUrl: unique().on(table.businessSlug, table.url),
}));

export const insertHeroPostSchema = createInsertSchema(heroPosts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHeroPost = z.infer<typeof insertHeroPostSchema>;
export type HeroPost = typeof heroPosts.$inferSelect;

// Hero Post Insights - Aggregated patterns across all hero posts
export const heroPostInsights = pgTable("hero_post_insights", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull().unique(),
  
  // Aggregated analysis
  summary: text("summary"),
  topThemes: jsonb("top_themes").$type<Array<{ theme: string; count: number }>>(),
  topHooks: jsonb("top_hooks").$type<Array<{ hookType: string; count: number }>>(),
  topProofTypes: jsonb("top_proof_types").$type<Array<{ proofType: string; count: number }>>(),
  
  // Content suggestions
  suggestions: jsonb("suggestions").$type<Array<{
    title: string;
    hook: string;
    theme: string;
    basedOnPostId: number;
    linkBackSuggestion: string;
  }>>(),
  
  // Brand Voice / Tone of Voice analysis
  brandVoiceSummary: text("brand_voice_summary"),
  voiceTraits: jsonb("voice_traits").$type<string[]>(),
  audienceNotes: text("audience_notes"),
  toneGuidance: jsonb("tone_guidance").$type<{
    dosList?: string[];
    dontsList?: string[];
    keyPhrases?: string[];
  }>(),
  brandVoiceUpdatedAt: timestamp("brand_voice_updated_at"),
  
  // Cache management
  postCount: integer("post_count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHeroPostInsightSchema = createInsertSchema(heroPostInsights).omit({ id: true, updatedAt: true });
export type InsertHeroPostInsight = z.infer<typeof insertHeroPostInsightSchema>;
export type HeroPostInsight = typeof heroPostInsights.$inferSelect;

// Orbit Videos - YouTube videos that Orbit can serve during chat
export const orbitVideos = pgTable("orbit_videos", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  
  // YouTube info
  youtubeVideoId: text("youtube_video_id").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  
  // Metadata
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  
  // Matching/retrieval
  tags: jsonb("tags").$type<string[]>(),
  topics: jsonb("topics").$type<string[]>(),
  transcript: text("transcript"),
  
  // Status
  isEnabled: boolean("is_enabled").default(true).notNull(),
  
  // Analytics aggregates (denormalized for quick display)
  serveCount: integer("serve_count").default(0).notNull(),
  playCount: integer("play_count").default(0).notNull(),
  totalWatchTimeMs: integer("total_watch_time_ms").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrbitVideoSchema = createInsertSchema(orbitVideos).omit({ id: true, createdAt: true, updatedAt: true, serveCount: true, playCount: true, totalWatchTimeMs: true });
export type InsertOrbitVideo = z.infer<typeof insertOrbitVideoSchema>;
export type OrbitVideo = typeof orbitVideos.$inferSelect;

// Orbit Video Events - Analytics for video playback
export type OrbitVideoEventType = 'serve' | 'play' | 'pause' | 'complete' | 'cta_click';

export const orbitVideoEvents = pgTable("orbit_video_events", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").references(() => orbitVideos.id, { onDelete: "cascade" }).notNull(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }).notNull(),
  sessionId: text("session_id"),
  
  eventType: text("event_type").$type<OrbitVideoEventType>().notNull(),
  msWatched: integer("ms_watched").default(0),
  
  // Follow-up tracking
  followUpQuestion: text("follow_up_question"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitVideoEventSchema = createInsertSchema(orbitVideoEvents).omit({ id: true, createdAt: true });
export type InsertOrbitVideoEvent = z.infer<typeof insertOrbitVideoEventSchema>;
export type OrbitVideoEvent = typeof orbitVideoEvents.$inferSelect;

// Orbit Analytics - daily activity tracking for Data Hub
export const orbitAnalytics = pgTable("orbit_analytics", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  date: timestamp("date").notNull(),
  
  // Activity counts (free tier - visible)
  visits: integer("visits").default(0).notNull(),
  interactions: integer("interactions").default(0).notNull(),
  conversations: integer("conversations").default(0).notNull(),
  iceViews: integer("ice_views").default(0).notNull(),
  
  // Understanding metrics (paid tier - locked)
  uniqueVisitors: integer("unique_visitors").default(0).notNull(),
  avgSessionDuration: integer("avg_session_duration").default(0).notNull(),
  topQuestions: text("top_questions").array(),
  topTopics: text("top_topics").array(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitAnalyticsSchema = createInsertSchema(orbitAnalytics).omit({ id: true, createdAt: true });
export type InsertOrbitAnalytics = z.infer<typeof insertOrbitAnalyticsSchema>;
export type OrbitAnalytics = typeof orbitAnalytics.$inferSelect;

// Orbit Leads - contact requests from visitors
export const orbitLeads = pgTable("orbit_leads", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  
  // Contact information
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  message: text("message"),
  
  // Tracking
  source: text("source").default('orbit'), // orbit, chat, cta, ice
  isRead: boolean("is_read").default(false).notNull(),
  
  // Phase 2: Contextual linking for journey reconstruction
  sessionId: text("session_id"), // Links to orbitSessions
  boxId: integer("box_id"), // Which box triggered the lead
  conversationId: integer("conversation_id"), // Which conversation produced the lead
  lastQuestion: text("last_question"), // Last visitor question before conversion
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitLeadSchema = createInsertSchema(orbitLeads).omit({ id: true, createdAt: true, isRead: true });
export type InsertOrbitLead = z.infer<typeof insertOrbitLeadSchema>;
export type OrbitLead = typeof orbitLeads.$inferSelect;

// Orbit Boxes - grid curation for Business Hub
export type OrbitBoxType = 
  | 'url' | 'text' | 'testimonial' | 'pdf' | 'ice' | 'product' | 'menu_item'
  | 'faq' | 'team_member' | 'business_profile' | 'contact' | 'opening_hours' 
  | 'case_study' | 'social_link' | 'brand_voice' | 'trust_signal';

// Product/Menu item tags for filtering
export interface ProductTag {
  key: string;      // e.g., 'dietary', 'size', 'spice'
  value: string;    // e.g., 'vegetarian', 'large', 'mild'
  label?: string;   // Display label
}

export const orbitBoxes = pgTable("orbit_boxes", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  
  boxType: text("box_type").$type<OrbitBoxType>().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"),
  content: text("content"),
  imageUrl: text("image_url"),
  
  sortOrder: integer("sort_order").default(0).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(),
  
  iceId: integer("ice_id"),
  
  // Product/Menu item fields (used when boxType is 'product' or 'menu_item')
  price: text("price"),                                    // Price as string to handle formatting (e.g., "12.99")
  currency: text("currency").default("GBP"),               // ISO currency code
  category: text("category"),                              // Product category for clustering
  subcategory: text("subcategory"),                        // Optional subcategory
  tags: jsonb("tags").$type<ProductTag[]>(),               // Dietary, size, allergens, etc.
  sku: text("sku"),                                        // External reference/SKU
  availability: text("availability").default("available"), // 'available', 'out_of_stock', 'limited'
  popularityScore: integer("popularity_score").default(0), // For sorting by popularity
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrbitBoxSchema = createInsertSchema(orbitBoxes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrbitBox = z.infer<typeof insertOrbitBoxSchema>;
export type OrbitBox = typeof orbitBoxes.$inferSelect;

// ============ INGESTION V2: DOMAIN RISK & URL CACHE ============

// Domain Risk - per-host throttling state for adaptive ingestion
export type IngestionMode = 'light' | 'standard' | 'user_assisted';
export type IngestionOutcome = 'success' | 'partial' | 'blocked' | 'error';

export const domainRisk = pgTable("domain_risk", {
  id: serial("id").primaryKey(),
  hostname: text("hostname").notNull().unique(),
  
  // Throttling state
  lastAttemptAt: timestamp("last_attempt_at"),
  lastSuccessAt: timestamp("last_success_at"),
  recommendedDelayMs: integer("recommended_delay_ms").default(2000).notNull(),
  
  // Friction tracking
  frictionCount: integer("friction_count").default(0).notNull(),
  lastFrictionCodes: jsonb("last_friction_codes").$type<number[]>(),
  
  // Status history
  lastOutcome: text("last_outcome").$type<IngestionOutcome>(),
  successCount: integer("success_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDomainRiskSchema = createInsertSchema(domainRisk).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomainRisk = z.infer<typeof insertDomainRiskSchema>;
export type DomainRisk = typeof domainRisk.$inferSelect;

// URL Fetch Cache - per-URL content hash to avoid refetching unchanged pages
export const urlFetchCache = pgTable("url_fetch_cache", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  hostname: text("hostname").notNull(),
  
  // Content fingerprint
  contentHash: text("content_hash"),
  contentLength: integer("content_length"),
  lastHttpStatus: integer("last_http_status"),
  
  // Timing
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  
  // Metadata
  fetchCount: integer("fetch_count").default(1).notNull(),
});

export const insertUrlFetchCacheSchema = createInsertSchema(urlFetchCache).omit({ id: true });
export type InsertUrlFetchCache = z.infer<typeof insertUrlFetchCacheSchema>;
export type UrlFetchCache = typeof urlFetchCache.$inferSelect;

// Ingestion Run Log - records each ingestion attempt with evidence markers
export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  traceId: text("trace_id").notNull(),
  
  // Mode and configuration
  mode: text("mode").$type<IngestionMode>().notNull(),
  
  // Discovery sources used
  discoverySources: jsonb("discovery_sources").$type<string[]>(),
  
  // Counts
  pagesPlanned: integer("pages_planned").default(0).notNull(),
  pagesFetched: integer("pages_fetched").default(0).notNull(),
  pagesUsed: integer("pages_used").default(0).notNull(),
  
  // Cache stats
  cacheHits: integer("cache_hits").default(0).notNull(),
  cacheMisses: integer("cache_misses").default(0).notNull(),
  cacheWrites: integer("cache_writes").default(0).notNull(),
  
  // Outcome
  outcome: text("outcome").$type<IngestionOutcome>().notNull(),
  frictionSignals: jsonb("friction_signals").$type<string[]>(),
  domainRiskScore: integer("domain_risk_score"),
  
  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  
  // Error tracking
  lastError: text("last_error"),
});

export const insertIngestionRunSchema = createInsertSchema(ingestionRuns).omit({ id: true, startedAt: true });
export type InsertIngestionRun = z.infer<typeof insertIngestionRunSchema>;
export type IngestionRun = typeof ingestionRuns.$inferSelect;

// ============ ORBIT PHASE 2: SESSIONS, EVENTS, CONVERSATIONS ============

// Orbit Sessions - visitor journey tracking
export const orbitSessions = pgTable("orbit_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(), // UUID stored in cookie/localStorage
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  
  // Optional visitor identification
  visitorId: text("visitor_id"), // Can be linked to a user or anonymous
  
  // Session metadata
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  
  // Summary stats (updated on events)
  eventCount: integer("event_count").default(0).notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  leadGenerated: boolean("lead_generated").default(false).notNull(),
});

export const insertOrbitSessionSchema = createInsertSchema(orbitSessions).omit({ id: true, startedAt: true, lastActivityAt: true });
export type InsertOrbitSession = z.infer<typeof insertOrbitSessionSchema>;
export type OrbitSession = typeof orbitSessions.$inferSelect;

// Orbit Events - granular event log for journey reconstruction
export type OrbitEventType = 'visit' | 'box_open' | 'box_click' | 'chat_message' | 'ice_open' | 'lead_submit';

export const orbitEvents = pgTable("orbit_events", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  sessionId: text("session_id").references(() => orbitSessions.sessionId).notNull(),
  
  eventType: text("event_type").$type<OrbitEventType>().notNull(),
  
  // Optional linked entities
  boxId: integer("box_id").references(() => orbitBoxes.id),
  iceId: integer("ice_id"),
  conversationId: integer("conversation_id"), // Will reference orbitConversations
  
  // Event metadata
  metadataJson: jsonb("metadata_json").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitEventSchema = createInsertSchema(orbitEvents).omit({ id: true, createdAt: true });
export type InsertOrbitEvent = z.infer<typeof insertOrbitEventSchema>;
export type OrbitEvent = typeof orbitEvents.$inferSelect;

// Orbit Conversations - chat transcripts for Insight tier
export const orbitConversations = pgTable("orbit_conversations", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  sessionId: text("session_id").references(() => orbitSessions.sessionId),
  
  // Optional visitor identification
  visitorId: text("visitor_id"),
  
  // Conversation metadata
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  
  // Context: which boxes/ICEs were engaged
  engagedBoxIds: integer("engaged_box_ids").array(),
  engagedIceIds: integer("engaged_ice_ids").array(),
  
  // Lead linkage
  leadGenerated: boolean("lead_generated").default(false).notNull(),
  leadId: integer("lead_id"),
  
  // Clustering outputs (populated by batch job)
  extractedQuestions: text("extracted_questions").array(),
  extractedThemes: text("extracted_themes").array(),
  
  // Proof Capture (testimonial) tracking - only trigger once per conversation
  proofCaptureTriggeredAt: timestamp("proof_capture_triggered_at"),
  proofCaptureSocialProofId: integer("proof_capture_social_proof_id"),
});

export const insertOrbitConversationSchema = createInsertSchema(orbitConversations).omit({ id: true, startedAt: true, lastMessageAt: true });
export type InsertOrbitConversation = z.infer<typeof insertOrbitConversationSchema>;
export type OrbitConversation = typeof orbitConversations.$inferSelect;

// Orbit Messages - individual chat messages within conversations
export const orbitMessages = pgTable("orbit_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => orbitConversations.id, { onDelete: "cascade" }).notNull(),
  
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitMessageSchema = createInsertSchema(orbitMessages).omit({ id: true, createdAt: true });
export type InsertOrbitMessage = z.infer<typeof insertOrbitMessageSchema>;
export type OrbitMessage = typeof orbitMessages.$inferSelect;

// Orbit Insights Summary - aggregated analytics for Insight tier (per orbit, per period)
export const orbitInsightsSummary = pgTable("orbit_insights_summary", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  
  // Period (e.g., current month)
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Aggregated data
  conversationCount: integer("conversation_count").default(0).notNull(),
  leadsCount: integer("leads_count").default(0).notNull(),
  topQuestions: text("top_questions").array(),
  topThemes: text("top_themes").array(),
  unansweredQuestions: text("unanswered_questions").array(),
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertOrbitInsightsSummarySchema = createInsertSchema(orbitInsightsSummary).omit({ id: true, lastUpdated: true });
export type InsertOrbitInsightsSummary = z.infer<typeof insertOrbitInsightsSummarySchema>;
export type OrbitInsightsSummary = typeof orbitInsightsSummary.$inferSelect;

// ============ KNOWLEDGE COACH: Proactive Gap Detection & Question Generation ============

// Gap sources that triggered the question generation
export type KnowledgeGapSource = 
  | 'missing_category'      // No content in a common category (pricing, hours, etc.)
  | 'thin_content'          // Content exists but is sparse
  | 'chat_deflection'       // Visitor asked something Echo couldn't answer well
  | 'unanswered_intent'     // Common visitor intent with no good response
  | 'competitor_insight'    // Something competitors typically cover
  | 'industry_standard';    // Standard info for this business type

// Where the answer should be filed
export type KnowledgeFilingDestination = 
  | 'faq'                   // Add as new FAQ
  | 'box_enrich'            // Enrich existing box content
  | 'new_box'               // Create new content box
  | 'document'              // Upload supporting document
  | 'business_profile';     // Update business profile info

// Status of each knowledge prompt
export type KnowledgePromptStatus = 
  | 'pending'               // Awaiting business owner response
  | 'answered'              // Owner submitted an answer
  | 'filed'                 // Answer has been filed into knowledge base
  | 'dismissed'             // Owner dismissed without answering
  | 'expired';              // Prompt expired without response

// Knowledge Prompts - AI-generated questions to fill knowledge gaps
export const orbitKnowledgePrompts = pgTable("orbit_knowledge_prompts", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug).notNull(),
  
  // The question itself
  question: text("question").notNull(),
  rationale: text("rationale").notNull(),           // Why this question matters
  impactScore: integer("impact_score").default(5),  // 1-10 predicted impact on strength score
  
  // Gap detection context
  gapSource: text("gap_source").$type<KnowledgeGapSource>().notNull(),
  gapContext: jsonb("gap_context").$type<{
    category?: string;              // Which category is thin/missing
    sampleQuery?: string;           // Example visitor query that triggered this
    relatedBoxIds?: number[];       // Boxes that could be enriched
    deflectionCount?: number;       // How many times Echo struggled with this
  }>(),
  
  // Suggested filing
  suggestedDestination: text("suggested_destination").$type<KnowledgeFilingDestination>().notNull(),
  suggestedBoxId: integer("suggested_box_id").references(() => orbitBoxes.id),
  
  // Status tracking
  status: text("status").$type<KnowledgePromptStatus>().default("pending").notNull(),
  
  // Owner response
  answerText: text("answer_text"),
  filedDestination: text("filed_destination").$type<KnowledgeFilingDestination>(),
  filedBoxId: integer("filed_box_id").references(() => orbitBoxes.id),
  answeredAt: timestamp("answered_at"),
  filedAt: timestamp("filed_at"),
  
  // Generation batch tracking
  weekNumber: integer("week_number").notNull(),     // ISO week number for grouping
  batchId: text("batch_id"),                        // Links prompts generated together
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),               // Prompts expire after 2 weeks
});

export const insertOrbitKnowledgePromptSchema = createInsertSchema(orbitKnowledgePrompts).omit({ id: true, createdAt: true });
export type InsertOrbitKnowledgePrompt = z.infer<typeof insertOrbitKnowledgePromptSchema>;
export type OrbitKnowledgePrompt = typeof orbitKnowledgePrompts.$inferSelect;

// ICE Drafts - unified table for Launchpad and Orbit-sourced content
export type IceDraftSource = 'launchpad' | 'orbit';
export type IceDraftFormat = 'hook_bullets' | 'myth_reality' | 'checklist' | 'problem_solution_proof';
export type IceDraftTone = 'direct' | 'warm' | 'playful' | 'premium';
export type IceDraftOutputType = 'video_card' | 'interactive';
export type IceDraftStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export const iceDrafts = pgTable("ice_drafts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Source discriminator (launchpad vs orbit)
  source: text("source").$type<IceDraftSource>().default("launchpad").notNull(),
  
  // === LAUNCHPAD FIELDS (required when source='launchpad') ===
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug), // Optional for orbit source
  insightId: text("insight_id"), // Required for launchpad
  format: text("format").$type<IceDraftFormat>(), // Required for launchpad
  tone: text("tone").$type<IceDraftTone>(), // Required for launchpad
  outputType: text("output_type").$type<IceDraftOutputType>(), // Required for launchpad
  
  // Generated content (shared)
  headline: text("headline"),
  captions: text("captions").array(),
  ctaText: text("cta_text"),
  previewFrameUrl: text("preview_frame_url"),
  
  // === ORBIT FIELDS (required when source='orbit') ===
  orbitSlug: text("orbit_slug"), // Required for orbit source
  orbitType: text("orbit_type").$type<'industry' | 'standard'>(), // Required for orbit source
  sourceMessageId: text("source_message_id"), // Chat message that triggered this
  viewType: text("view_type").$type<OrbitViewType>(), // View context (compare, shortlist, etc.)
  viewData: jsonb("view_data"), // Structured data from view
  summaryText: text("summary_text"), // Assistant's summary text
  sources: jsonb("sources").$type<string[]>(), // Source references
  templateType: text("template_type").$type<IceTemplateType>(), // Orbit template type
  generatedCards: jsonb("generated_cards").$type<IcePreviewCard[]>(), // Generated card content
  deepLink: text("deep_link"), // Deep link back to Orbit state
  orbitViewState: jsonb("orbit_view_state").$type<OrbitViewState>(), // Full view state for restoration
  ctaLabel: text("cta_label").default("Ask in Orbit"), // CTA button label
  ctaLink: text("cta_link"), // CTA destination URL
  campaignId: text("campaign_id"), // For tracking campaigns
  
  // Published ICE reference
  publishedIceId: text("published_ice_id").references(() => icePreviews.id),
  
  // Status (extended for moderation)
  status: text("status").$type<IceDraftStatus>().default("draft").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const insertIceDraftSchema = createInsertSchema(iceDrafts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIceDraft = z.infer<typeof insertIceDraftSchema>;
export type IceDraft = typeof iceDrafts.$inferSelect;

// ICE Moderation Queue (for influencer submissions to industry orbits)
export const iceModeration = pgTable("ice_moderation", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").references(() => iceDrafts.id).notNull(),
  submittedBy: integer("submitted_by").references(() => users.id).notNull(),
  
  // Review status
  status: text("status").$type<ModerationStatus>().default("pending").notNull(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertIceModerationSchema = createInsertSchema(iceModeration).omit({ id: true, submittedAt: true });
export type InsertIceModeration = z.infer<typeof insertIceModerationSchema>;
export type IceModeration = typeof iceModeration.$inferSelect;

// ICE Analytics Events (for tracking flywheel metrics)
export const iceAnalyticsEvents = pgTable("ice_analytics_events", {
  id: serial("id").primaryKey(),
  iceId: text("ice_id").references(() => icePreviews.id),
  draftId: integer("draft_id").references(() => iceDrafts.id),
  
  eventType: text("event_type").$type<IceAnalyticsEventType>().notNull(),
  
  // Attribution
  orbitSlug: text("orbit_slug"),
  creatorId: integer("creator_id").references(() => users.id),
  campaignId: text("campaign_id"),
  ref: text("ref"), // influencer handle or channel
  
  // Context
  visitorIp: text("visitor_ip"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIceAnalyticsEventSchema = createInsertSchema(iceAnalyticsEvents).omit({ id: true, createdAt: true });
export type InsertIceAnalyticsEvent = z.infer<typeof insertIceAnalyticsEventSchema>;
export type IceAnalyticsEvent = typeof iceAnalyticsEvents.$inferSelect;

// Notification Types
export type NotificationType = 
  | 'lead_captured' 
  | 'conversation_spike' 
  | 'pattern_shift' 
  | 'friction_detected' 
  | 'high_performing_ice';

export type NotificationSeverity = 'info' | 'important';
export type EmailCadence = 'instant' | 'daily_digest' | 'weekly_digest';

// Notifications - in-app and email notifications for orbit owners
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type").$type<NotificationType>().notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  actionUrl: text("action_url").notNull(),
  meta: jsonb("meta").$type<Record<string, any>>(),
  
  severity: text("severity").$type<NotificationSeverity>().default("info").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentEmailAt: timestamp("sent_email_at"),
  dedupeKey: text("dedupe_key"),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Notification Preferences - user preferences for notification delivery
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  emailCadence: text("email_cadence").$type<EmailCadence>().default("daily_digest").notNull(),
  
  leadAlertsEnabled: boolean("lead_alerts_enabled").default(true).notNull(),
  conversationAlertsEnabled: boolean("conversation_alerts_enabled").default(false).notNull(),
  intelligenceAlertsEnabled: boolean("intelligence_alerts_enabled").default(false).notNull(),
  iceAlertsEnabled: boolean("ice_alerts_enabled").default(false).notNull(),
  
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
  quietStartHour: integer("quiet_start_hour"),
  quietEndHour: integer("quiet_end_hour"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Magic Links - secure, expiring links for email notifications
export type MagicLinkPurpose = 'view_lead' | 'view_conversation' | 'view_intelligence' | 'view_ice';

export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  purpose: text("purpose").$type<MagicLinkPurpose>().notNull(),
  targetId: integer("target_id"),
  
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinks).omit({ id: true, createdAt: true });
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type MagicLink = typeof magicLinks.$inferSelect;

// ============ DATA SOURCES (API Snapshot Ingestion) ============

// API Secrets - encrypted credentials stored out-of-row
export type ApiAuthType = 'none' | 'api_key' | 'bearer' | 'basic';

export const apiSecrets = pgTable("api_secrets", {
  id: serial("id").primaryKey(),
  orbitSlug: text("orbit_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  encryptedValue: text("encrypted_value").notNull(), // AES-256 encrypted
  authType: text("auth_type").$type<ApiAuthType>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rotatedAt: timestamp("rotated_at"),
});

export const insertApiSecretSchema = createInsertSchema(apiSecrets).omit({ id: true, createdAt: true });
export type InsertApiSecret = z.infer<typeof insertApiSecretSchema>;
export type ApiSecret = typeof apiSecrets.$inferSelect;

// API Connections - configured API sources
export type ConnectionStatus = 'active' | 'paused' | 'error';

export const apiConnections = pgTable("api_connections", {
  id: serial("id").primaryKey(),
  orbitSlug: text("orbit_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  baseUrl: text("base_url").notNull(), // Must be HTTPS, validated for SSRF
  authSecretId: integer("auth_secret_id").references(() => apiSecrets.id, { onDelete: "set null" }),
  status: text("status").$type<ConnectionStatus>().default("active").notNull(),
  lastRunAt: timestamp("last_run_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertApiConnectionSchema = createInsertSchema(apiConnections).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApiConnection = z.infer<typeof insertApiConnectionSchema>;
export type ApiConnection = typeof apiConnections.$inferSelect;

// API Endpoints - GET paths for a connection
export const apiEndpoints = pgTable("api_endpoints", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => apiConnections.id, { onDelete: "cascade" }).notNull(),
  path: text("path").notNull(), // e.g. /api/v1/products
  params: jsonb("params"), // query params configuration
  responseMapping: jsonb("response_mapping"), // how to extract items from response
  paginationConfig: jsonb("pagination_config"), // page/limit or cursor config
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApiEndpointSchema = createInsertSchema(apiEndpoints).omit({ id: true, createdAt: true });
export type InsertApiEndpoint = z.infer<typeof insertApiEndpointSchema>;
export type ApiEndpoint = typeof apiEndpoints.$inferSelect;

// API Snapshots - versioned fetch results
export type SnapshotStatus = 'pending' | 'processing' | 'ready' | 'failed';

export const apiSnapshots = pgTable("api_snapshots", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").references(() => apiEndpoints.id, { onDelete: "cascade" }).notNull(),
  connectionId: integer("connection_id").references(() => apiConnections.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  requestHash: text("request_hash").notNull(), // For idempotency/dedup
  rawPayloadRef: text("raw_payload_ref"), // Object storage path
  rawPayloadPreview: jsonb("raw_payload_preview"), // First 10KB truncated
  recordCount: integer("record_count"),
  status: text("status").$type<SnapshotStatus>().default("pending").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  error: text("error"),
}, (table) => ({
  uniqueEndpointHash: unique().on(table.endpointId, table.requestHash),
}));

export const insertApiSnapshotSchema = createInsertSchema(apiSnapshots).omit({ id: true, fetchedAt: true });
export type InsertApiSnapshot = z.infer<typeof insertApiSnapshotSchema>;
export type ApiSnapshot = typeof apiSnapshots.$inferSelect;

// API Curated Items - normalised Orbit-ready sources
export const apiCuratedItems = pgTable("api_curated_items", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").references(() => apiSnapshots.id, { onDelete: "cascade" }).notNull(),
  connectionId: integer("connection_id").references(() => apiConnections.id, { onDelete: "cascade" }).notNull(),
  endpointId: integer("endpoint_id").references(() => apiEndpoints.id, { onDelete: "cascade" }).notNull(),
  snapshotVersion: integer("snapshot_version").notNull(),
  orbitSlug: text("orbit_slug").notNull(),
  sourceType: text("source_type").notNull(), // e.g. 'shopify_product'
  externalId: text("external_id"), // Original ID from source
  title: text("title"),
  summary: text("summary"),
  content: jsonb("content"), // Flattened, searchable fields
  metadata: jsonb("metadata"), // Original fields preserved
  indexedAt: timestamp("indexed_at").defaultNow().notNull(),
});

export const insertApiCuratedItemSchema = createInsertSchema(apiCuratedItems).omit({ id: true, indexedAt: true });
export type InsertApiCuratedItem = z.infer<typeof insertApiCuratedItemSchema>;
export type ApiCuratedItem = typeof apiCuratedItems.$inferSelect;

// ============================================
// DEVICE SESSIONS (AgoraCube / Thin Clients)
// ============================================

// Device session scopes
export type DeviceScope = 'orbit:read' | 'orbit:ask' | 'orbit:voice';

// Device Sessions - for thin clients (AgoraCube, kiosk displays)
export const deviceSessions = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").unique().notNull(), // Server-issued UUID (NOT hardware fingerprint)
  orbitSlug: text("orbit_slug").notNull(),
  deviceLabel: text("device_label"), // Admin-friendly name ("Boardroom Cube")
  tokenHash: text("token_hash").notNull(), // Hashed device token
  scopes: text("scopes").array().$type<DeviceScope[]>().default(['orbit:read', 'orbit:ask']),
  pairingCode: text("pairing_code"), // One-time pairing code (cleared after use)
  pairingExpiresAt: timestamp("pairing_expires_at"),
  lastSeenAt: timestamp("last_seen_at"),
  lastSeenIp: text("last_seen_ip"),
  userAgent: text("user_agent"), // Non-unique hint for debugging
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDeviceSessionSchema = createInsertSchema(deviceSessions).omit({ id: true, createdAt: true });
export type InsertDeviceSession = z.infer<typeof insertDeviceSessionSchema>;
export type DeviceSession = typeof deviceSessions.$inferSelect;

// Device Events - audit log for device activity
export type DeviceEventType = 'auth' | 'ask' | 'scene' | 'pair' | 'revoke' | 'rate_limit';

export const deviceEvents = pgTable("device_events", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  orbitSlug: text("orbit_slug").notNull(),
  eventType: text("event_type").$type<DeviceEventType>().notNull(),
  requestSummary: jsonb("request_summary"), // Minimal context (e.g., question length, response status)
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDeviceEventSchema = createInsertSchema(deviceEvents).omit({ id: true, createdAt: true });
export type InsertDeviceEvent = z.infer<typeof insertDeviceEventSchema>;
export type DeviceEvent = typeof deviceEvents.$inferSelect;

// Rate limit tracking for token bucket algorithm
export const deviceRateLimits = pgTable("device_rate_limits", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  orbitSlug: text("orbit_slug").notNull(),
  tokens: integer("tokens").default(10).notNull(), // Current tokens in bucket
  lastRefillAt: timestamp("last_refill_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDeviceOrbit: unique().on(table.deviceId, table.orbitSlug),
}));

export const insertDeviceRateLimitSchema = createInsertSchema(deviceRateLimits).omit({ id: true });
export type InsertDeviceRateLimit = z.infer<typeof insertDeviceRateLimitSchema>;
export type DeviceRateLimit = typeof deviceRateLimits.$inferSelect;

// ============================================
// ORBIT CUBES (Physical Hardware Devices)
// ============================================

// Orbit Cube status
export type OrbitCubeStatus = 'pending_pairing' | 'online' | 'sleeping' | 'offline' | 'revoked';

// Orbit Cubes - hardware devices for kiosk display
export const orbitCubes = pgTable("orbit_cubes", {
  id: serial("id").primaryKey(),
  cubeUuid: text("cube_uuid").unique().notNull(), // Server-issued UUID
  orbitSlug: text("orbit_slug").references(() => orbitMeta.businessSlug).notNull(),
  ownerUserId: integer("owner_user_id").references(() => users.id),
  
  name: text("name").default("Orbit Cube").notNull(),
  status: text("status").$type<OrbitCubeStatus>().default("pending_pairing").notNull(),
  
  // Pairing
  pairingCode: text("pairing_code"), // Short-lived, regeneratable (6-10 chars uppercase)
  pairingCodeExpiresAt: timestamp("pairing_code_expires_at"),
  deviceTokenHash: text("device_token_hash"), // Null until paired
  
  // Settings
  sleepTimeoutMinutes: integer("sleep_timeout_minutes").default(30).notNull(),
  
  // Activity tracking
  lastSeenAt: timestamp("last_seen_at"),
  lastSeenIp: text("last_seen_ip"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const insertOrbitCubeSchema = createInsertSchema(orbitCubes).omit({ id: true, createdAt: true });
export type InsertOrbitCube = z.infer<typeof insertOrbitCubeSchema>;
export type OrbitCube = typeof orbitCubes.$inferSelect;

// Orbit Cube order status
export type OrbitCubeOrderStatus = 'created' | 'paid' | 'failed' | 'refunded';

// Orbit Cube Orders - purchase tracking
export const orbitCubeOrders = pgTable("orbit_cube_orders", {
  id: serial("id").primaryKey(),
  orbitSlug: text("orbit_slug").references(() => orbitMeta.businessSlug).notNull(),
  cubeId: integer("cube_id").references(() => orbitCubes.id),
  
  // Stripe integration
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  
  // Pricing (in GBP pence for precision)
  hardwarePriceGbp: integer("hardware_price_gbp").default(29900).notNull(), // £299.00
  monthlyPriceGbp: integer("monthly_price_gbp").default(2900).notNull(), // £29.00
  
  status: text("status").$type<OrbitCubeOrderStatus>().default("created").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitCubeOrderSchema = createInsertSchema(orbitCubeOrders).omit({ id: true, createdAt: true });
export type InsertOrbitCubeOrder = z.infer<typeof insertOrbitCubeOrderSchema>;
export type OrbitCubeOrder = typeof orbitCubeOrders.$inferSelect;

// ============ ORBIT SIGNAL ACCESS LOGGING ============

// Orbit Signal Access Log - tracks access to /.well-known/orbit.json for AI discovery metrics
export const orbitSignalAccessLog = pgTable("orbit_signal_access_log", {
  id: serial("id").primaryKey(),
  orbitSlug: text("orbit_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }).notNull(),
  
  // Access metadata
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
  userAgent: text("user_agent"),
  userAgentTruncated: text("user_agent_truncated"), // First 100 chars for display
  
  // Request info (no IP exposed in UI)
  requestMethod: text("request_method").default("GET").notNull(),
  responseStatus: integer("response_status").default(200).notNull(),
});

export const insertOrbitSignalAccessLogSchema = createInsertSchema(orbitSignalAccessLog).omit({ id: true, accessedAt: true });
export type InsertOrbitSignalAccessLog = z.infer<typeof insertOrbitSignalAccessLogSchema>;
export type OrbitSignalAccessLog = typeof orbitSignalAccessLog.$inferSelect;

// ============ BLOG SYSTEM ============

// Blog post status
export type BlogPostStatus = 'draft' | 'published';

// Blog posts - admin-managed content
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  
  // Content
  contentMarkdown: text("content_markdown").notNull(),
  contentHtml: text("content_html"), // Cached rendered HTML
  
  // Hero section
  heroImageUrl: text("hero_image_url"),
  heroAlt: text("hero_alt"),
  heroCaption: text("hero_caption"),
  
  // CTA
  ctaPrimaryLabel: text("cta_primary_label"),
  ctaPrimaryUrl: text("cta_primary_url"),
  ctaSecondaryLabel: text("cta_secondary_label"),
  ctaSecondaryUrl: text("cta_secondary_url"),
  
  // Metadata
  author: text("author"),
  tags: text("tags").array(),
  canonicalUrl: text("canonical_url"),
  internalLinks: text("internal_links").array(),
  
  // Status and timestamps
  status: text("status").$type<BlogPostStatus>().default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// ============ SECURITY AUDIT LOGGING ============

// Audit event types for security tracking
export type AuditEventType = 
  | 'content.viewed'
  | 'content.created'
  | 'content.edited'
  | 'content.deleted'
  | 'content.claimed'
  | 'visibility.changed'
  | 'permission.denied'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed';

// Audit logs for security tracking (content access, claims, permission denials)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  
  // Event type and details
  eventType: text("event_type").$type<AuditEventType>().notNull(),
  
  // Actor (who performed the action)
  userId: integer("user_id").references(() => users.id), // null for anonymous
  userIp: text("user_ip"), // For anonymous tracking
  userAgent: text("user_agent"),
  
  // Resource (what was accessed/modified)
  resourceType: text("resource_type").notNull(), // 'universe', 'ice_preview', 'orbit', 'user'
  resourceId: text("resource_id").notNull(), // ID of the resource
  
  // Additional context
  details: jsonb("details").$type<Record<string, unknown>>(), // Event-specific metadata
  oldValue: jsonb("old_value"), // Previous state for changes
  newValue: jsonb("new_value"), // New state for changes
  
  // Result
  success: boolean("success").default(true).notNull(),
  errorCode: text("error_code"), // For failed operations
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============ BILLING AUDIT LOGGING ============

export type BillingAuditEventType = 
  | 'checkout_session_created'
  | 'payment_verified'
  | 'payment_rejected_amount_mismatch'
  | 'subscription_status_changed'
  | 'ice_paused_due_to_subscription'
  | 'ice_restored'
  | 'subscription_reactivated'
  | 'credits_granted';

export const billingAuditLogs = pgTable("billing_audit_logs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  userId: integer("user_id").references(() => users.id),
  eventType: text("event_type").$type<BillingAuditEventType>().notNull(),
  
  stripeEventId: text("stripe_event_id"),
  checkoutSessionId: text("checkout_session_id"),
  paymentIntentId: text("payment_intent_id"),
  subscriptionId: text("subscription_id"),
  
  priceId: text("price_id"),
  currency: text("currency"),
  expectedAmountCents: integer("expected_amount_cents"),
  stripeAmountCents: integer("stripe_amount_cents"),
  discountAmountCents: integer("discount_amount_cents"),
  
  statusBefore: text("status_before"),
  statusAfter: text("status_after"),
  
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export const insertBillingAuditLogSchema = createInsertSchema(billingAuditLogs).omit({ id: true, createdAt: true });
export type InsertBillingAuditLog = z.infer<typeof insertBillingAuditLogSchema>;
export type BillingAuditLog = typeof billingAuditLogs.$inferSelect;

// ============ SOCIAL PROOF (Testimonial Capture) ============

// Social proof topic categories
export type SocialProofTopic = 'service' | 'delivery' | 'quality' | 'value' | 'staff' | 'product' | 'other';

// Consent status for testimonials
export type SocialProofConsentStatus = 'pending' | 'granted' | 'declined';

// Consent type when granted
export type SocialProofConsentType = 'name_town' | 'anonymous';

// Status of social proof item
export type SocialProofStatus = 'draft' | 'approved' | 'archived';

// Generated variants for different use cases
export interface SocialProofVariants {
  short: string;    // For overlays, <= 90 chars
  medium: string;   // Website block, <= 220 chars
  long: string;     // Case study seed, <= 500 chars
}

// Recommended placements for the testimonial
export type SocialProofPlacement = 'homepage' | 'product_page' | 'checkout_reassurance' | 'case_study';

// Social Proof Items - captured testimonials from Orbit conversations
export const socialProofItems = pgTable("social_proof_items", {
  id: serial("id").primaryKey(),
  
  // Link to Orbit and conversation
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }).notNull(),
  conversationId: integer("conversation_id").references(() => orbitConversations.id, { onDelete: "set null" }),
  sourceMessageId: integer("source_message_id").references(() => orbitMessages.id, { onDelete: "set null" }),
  
  // Quote content
  rawQuoteText: text("raw_quote_text").notNull(),
  cleanQuoteText: text("clean_quote_text"),
  
  // Classification
  topic: text("topic").$type<SocialProofTopic>().default("other").notNull(),
  specificityScore: real("specificity_score"),
  sentimentScore: real("sentiment_score"),
  
  // Consent tracking
  consentStatus: text("consent_status").$type<SocialProofConsentStatus>().default("pending").notNull(),
  consentType: text("consent_type").$type<SocialProofConsentType>(),
  consentTimestamp: timestamp("consent_timestamp"),
  
  // Attribution (only stored if consent granted with name_town)
  attributionName: text("attribution_name"),
  attributionTown: text("attribution_town"),
  
  // Generated content
  generatedVariants: jsonb("generated_variants").$type<SocialProofVariants>(),
  recommendedPlacements: text("recommended_placements").array().$type<SocialProofPlacement[]>(),
  
  // Workflow status
  status: text("status").$type<SocialProofStatus>().default("draft").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSocialProofItemSchema = createInsertSchema(socialProofItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSocialProofItem = z.infer<typeof insertSocialProofItemSchema>;
export type SocialProofItem = typeof socialProofItems.$inferSelect;

// ============ TITLE PACKS (Layout Prefabs for ICE Cards) ============

// Title Pack tier access levels
export type TitlePackTier = 'free' | 'grow' | 'insight' | 'intelligence';

// Layer types within a title pack
export type TitlePackLayerType = 'text' | 'shape' | 'gradient' | 'image';

// Text fitting strategies
export type TextFitStrategy = 'shrink' | 'truncate' | 'wrap' | 'smart';

// Animation timing functions
export type AnimationEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

// Layer definition for title pack
export const titlePackLayerSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'shape', 'gradient', 'image']),
  name: z.string(),
  
  // Geometry (percentages for responsive positioning)
  geometry: z.object({
    x: z.number().min(0).max(100), // % from left
    y: z.number().min(0).max(100), // % from top
    width: z.number().min(0).max(100).optional(),
    height: z.number().min(0).max(100).optional(),
    anchorX: z.enum(['left', 'center', 'right']).default('center'),
    anchorY: z.enum(['top', 'center', 'bottom']).default('center'),
    rotation: z.number().default(0),
  }),
  
  // Typography (for text layers)
  typography: z.object({
    fontFamily: z.string().default('Inter'),
    fontWeight: z.number().default(600),
    fontSize: z.number().default(32), // Base size in px
    lineHeight: z.number().default(1.2),
    letterSpacing: z.number().default(0),
    textAlign: z.enum(['left', 'center', 'right']).default('center'),
    textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).default('none'),
    color: z.string().default('#ffffff'),
    stroke: z.object({
      color: z.string(),
      width: z.number(),
    }).optional(),
    shadow: z.object({
      color: z.string(),
      blur: z.number(),
      offsetX: z.number(),
      offsetY: z.number(),
    }).optional(),
  }).optional(),
  
  // Text fitting rules
  textFit: z.object({
    strategy: z.enum(['shrink', 'truncate', 'wrap', 'smart']).default('smart'),
    minFontSize: z.number().default(12),
    maxLines: z.number().default(3),
  }).optional(),
  
  // Shape/gradient properties
  fill: z.object({
    type: z.enum(['solid', 'gradient']),
    color: z.string().optional(),
    gradient: z.object({
      type: z.enum(['linear', 'radial']),
      angle: z.number().default(0),
      stops: z.array(z.object({
        offset: z.number(),
        color: z.string(),
      })),
    }).optional(),
  }).optional(),
  
  // Animation
  animation: z.object({
    entrance: z.object({
      type: z.enum(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'pop', 'typewriter']),
      duration: z.number().default(0.5),
      delay: z.number().default(0),
      easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('ease-out'),
    }).optional(),
    exit: z.object({
      type: z.enum(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom']),
      duration: z.number().default(0.3),
      easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('ease-in'),
    }).optional(),
    loop: z.object({
      type: z.enum(['pulse', 'glow', 'shake', 'bounce']),
      duration: z.number().default(1),
      iterationCount: z.union([z.number(), z.literal('infinite')]).default('infinite'),
    }).optional(),
  }).optional(),
  
  // Layer z-order
  zIndex: z.number().default(0),
});

export type TitlePackLayer = z.infer<typeof titlePackLayerSchema>;

// Full title pack definition
export const titlePackDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(['impact', 'cinematic', 'editorial', 'fun', 'minimal']),
  
  // Preview thumbnail URL
  thumbnailUrl: z.string().optional(),
  
  // Layer stack
  layers: z.array(titlePackLayerSchema),
  
  // Global pack settings
  defaultDuration: z.number().default(4), // seconds per card
  backgroundColor: z.string().optional(),
  overlayOpacity: z.number().min(0).max(1).default(0.4),
});

export type TitlePackDefinition = z.infer<typeof titlePackDefinitionSchema>;

// Title Packs table (for custom/saved packs)
export const titlePacks = pgTable("title_packs", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  
  // Pack metadata
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("custom"),
  tier: text("tier").$type<TitlePackTier>().default("free").notNull(),
  
  // Is this a system preset or user-created?
  isSystem: boolean("is_system").default(false).notNull(),
  
  // Owner (null for system presets)
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // The full pack definition JSON
  definition: jsonb("definition").$type<TitlePackDefinition>().notNull(),
  
  // Preview/thumbnail
  thumbnailUrl: text("thumbnail_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTitlePackSchema = createInsertSchema(titlePacks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTitlePack = z.infer<typeof insertTitlePackSchema>;
export type TitlePack = typeof titlePacks.$inferSelect;

// ============ VIDEO EXPORT JOBS ============

// Video export job status
export type VideoExportStatus = 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';

// Video export quality options
export type VideoExportQuality = 'draft' | 'standard' | 'hd';

// Video export format options
export type VideoExportFormat = 'mp4' | 'webm';

// Video Export Jobs - background jobs for rendering ICE cards to video
export const videoExportJobs = pgTable("video_export_jobs", {
  id: serial("id").primaryKey(),
  
  // Job identification
  jobId: text("job_id").notNull().unique(), // UUID for external reference
  
  // Owner and source
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  businessSlug: text("business_slug").references(() => orbitMeta.businessSlug, { onDelete: "cascade" }),
  iceDraftId: integer("ice_draft_id").references(() => iceDrafts.id, { onDelete: "set null" }),
  
  // Export configuration
  quality: text("quality").$type<VideoExportQuality>().default("standard").notNull(),
  format: text("format").$type<VideoExportFormat>().default("mp4").notNull(),
  includeNarration: boolean("include_narration").default(true).notNull(),
  includeMusic: boolean("include_music").default(true).notNull(),
  
  // Title pack used (null for no captions)
  titlePackId: integer("title_pack_id").references(() => titlePacks.id, { onDelete: "set null" }),
  
  // Job status
  status: text("status").$type<VideoExportStatus>().default("queued").notNull(),
  progress: real("progress").default(0).notNull(), // 0-100
  currentStep: text("current_step"), // Human-readable current step
  
  // Error tracking
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  
  // Output artifact
  outputUrl: text("output_url"),
  outputSizeBytes: integer("output_size_bytes"),
  outputDurationSeconds: real("output_duration_seconds"),
  
  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // When the download link expires
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoExportJobSchema = createInsertSchema(videoExportJobs).omit({ id: true, createdAt: true });
export type InsertVideoExportJob = z.infer<typeof insertVideoExportJobSchema>;
export type VideoExportJob = typeof videoExportJobs.$inferSelect;

// ============ INDUSTRY ORBIT SYSTEM ============
// These tables support Industry Orbits - neutral, unowned public intelligence spaces
// Industry Orbits can NEVER be claimed or owned (this is a system invariant)

// Entity types within an Industry Orbit
export type IndustryEntityType = 
  | 'manufacturer' 
  | 'platform' 
  | 'standards' 
  | 'publication' 
  | 'influencer' 
  | 'community' 
  | 'retailer' 
  | 'distributor';

// Trust level for industry entities and sources
export type TrustLevel = 'official' | 'trade' | 'independent';

// Industry Entity - Manufacturers, platforms, standards bodies, communities, influencers
// Social URLs for entities (CPAC format)
export const entitySocialUrlsSchema = z.object({
  x: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
});
export type EntitySocialUrls = z.infer<typeof entitySocialUrlsSchema>;

export const industryEntities = pgTable("industry_entities", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  entityType: text("entity_type").$type<IndustryEntityType>().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  websiteUrl: text("website_url"),
  regionTags: jsonb("region_tags").$type<string[]>().default([]),
  trustLevel: text("trust_level").$type<TrustLevel>().default("independent").notNull(),
  logoAssetId: integer("logo_asset_id"), // FK to industryAssets, set after creation
  
  // CPAC additions
  socialUrls: jsonb("social_urls").$type<EntitySocialUrls>().default({}),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIndustryEntitySchema = createInsertSchema(industryEntities).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndustryEntity = z.infer<typeof insertIndustryEntitySchema>;
export type IndustryEntity = typeof industryEntities.$inferSelect;

// Product status
export type ProductStatus = 'shipping' | 'announced' | 'rumoured' | 'discontinued';

// Product category
export type ProductCategory = 'consumer' | 'enterprise' | 'developer';

// Media refs for products (CPAC format)
export const productMediaRefsSchema = z.object({
  imageAssetRefs: z.array(z.string()).optional(),
  videoAssetRefs: z.array(z.string()).optional(),
});
export type ProductMediaRefs = z.infer<typeof productMediaRefsSchema>;

// Product - Products within an Industry Orbit
export const industryProducts = pgTable("industry_products", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  manufacturerEntityId: integer("manufacturer_entity_id").references(() => industryEntities.id, { onDelete: "set null" }),
  
  name: text("name").notNull(),
  category: text("category").$type<ProductCategory>().default("consumer").notNull(),
  status: text("status").$type<ProductStatus>().default("announced").notNull(),
  releaseDate: timestamp("release_date"),
  primaryUrl: text("primary_url"),
  summary: text("summary"),
  heroAssetId: integer("hero_asset_id"), // FK to industryAssets
  
  // CPAC additions
  mediaRefs: jsonb("media_refs").$type<ProductMediaRefs>().default({}),
  referenceUrls: jsonb("reference_urls").$type<string[]>().default([]),
  intentTags: jsonb("intent_tags").$type<string[]>().default([]),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIndustryProductSchema = createInsertSchema(industryProducts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndustryProduct = z.infer<typeof insertIndustryProductSchema>;
export type IndustryProduct = typeof industryProducts.$inferSelect;

// Product Spec - Flexible key-value specs for products
export const productSpecs = pgTable("product_specs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => industryProducts.id, { onDelete: "cascade" }).notNull(),
  
  specKey: text("spec_key").notNull(),
  specValue: text("spec_value").notNull(),
  specUnit: text("spec_unit"),
  sourceUrl: text("source_url"),
  lastVerifiedAt: timestamp("last_verified_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSpecSchema = createInsertSchema(productSpecs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductSpec = z.infer<typeof insertProductSpecSchema>;
export type ProductSpec = typeof productSpecs.$inferSelect;

// Review sentiment
export type ReviewSentiment = 'positive' | 'mixed' | 'negative' | 'unknown';

// Industry Review - Reviews from publications and influencers
export const industryReviews = pgTable("industry_reviews", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => industryProducts.id, { onDelete: "set null" }),
  reviewerEntityId: integer("reviewer_entity_id").references(() => industryEntities.id, { onDelete: "set null" }),
  
  title: text("title").notNull(),
  url: text("url").notNull(),
  publishedAt: timestamp("published_at"),
  ratingValue: real("rating_value"),
  ratingScale: real("rating_scale"),
  summary: text("summary"),
  sentiment: text("sentiment").$type<ReviewSentiment>().default("unknown").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIndustryReviewSchema = createInsertSchema(industryReviews).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndustryReview = z.infer<typeof insertIndustryReviewSchema>;
export type IndustryReview = typeof industryReviews.$inferSelect;

// Asset type for industry assets
export type IndustryAssetType = 'image' | 'video' | 'document';

// Industry Asset - Images, videos, documents for Industry Orbits
export const industryAssets = pgTable("industry_assets", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  assetType: text("asset_type").$type<IndustryAssetType>().notNull(),
  storageUrl: text("storage_url").notNull(),
  thumbUrl: text("thumb_url"),
  sourceUrl: text("source_url"),
  title: text("title"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIndustryAssetSchema = createInsertSchema(industryAssets).omit({ id: true, createdAt: true });
export type InsertIndustryAsset = z.infer<typeof insertIndustryAssetSchema>;
export type IndustryAsset = typeof industryAssets.$inferSelect;

// Community type
export type CommunityType = 'forum' | 'subreddit' | 'discord' | 'slack' | 'community_site' | 'event_series';

// Community Link - Forums, subreddits, Discords, etc.
export const communityLinks = pgTable("community_links", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  name: text("name").notNull(),
  url: text("url").notNull(),
  communityType: text("community_type").$type<CommunityType>().notNull(),
  notes: text("notes"),
  
  // CPAC addition
  regionTags: jsonb("region_tags").$type<string[]>().default([]),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommunityLinkSchema = createInsertSchema(communityLinks).omit({ id: true, createdAt: true });
export type InsertCommunityLink = z.infer<typeof insertCommunityLinkSchema>;
export type CommunityLink = typeof communityLinks.$inferSelect;

// Badge state for topic tiles
export const topicTileBadgeSchema = z.object({
  trending: z.boolean().optional(),
  new: z.boolean().optional(),
  debated: z.boolean().optional(),
  updatedRecently: z.boolean().optional(),
});
export type TopicTileBadge = z.infer<typeof topicTileBadgeSchema>;

// Evidence refs for topic tiles (CPAC format)
export const tileEvidenceRefsSchema = z.object({
  productIds: z.array(z.string()).optional(),
  entityIds: z.array(z.string()).optional(),
  communityIds: z.array(z.string()).optional(),
});
export type TileEvidenceRefs = z.infer<typeof tileEvidenceRefsSchema>;

// Topic Tile - The orbit tiles for Industry Orbits
export const topicTiles = pgTable("topic_tiles", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  label: text("label").notNull(),
  sublabel: text("sublabel"),
  intentTags: jsonb("intent_tags").$type<string[]>().default([]),
  priority: integer("priority").default(0).notNull(),
  badgeState: jsonb("badge_state").$type<TopicTileBadge>().default({}),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  
  // CPAC addition
  evidenceRefs: jsonb("evidence_refs").$type<TileEvidenceRefs>().default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTopicTileSchema = createInsertSchema(topicTiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTopicTile = z.infer<typeof insertTopicTileSchema>;
export type TopicTile = typeof topicTiles.$inferSelect;

// ============ PULSE MONITORING SYSTEM ============
// Monitors industry sources for events and updates

// Pulse source type (mirrors entity types + more)
export type PulseSourceType = 
  | 'manufacturer' 
  | 'publication' 
  | 'influencer' 
  | 'standards' 
  | 'community' 
  | 'retailer';

// Monitoring method
export type MonitoringMethod = 'rss' | 'page_monitor';

// Update frequency
export type UpdateFrequency = 'daily' | 'twice_weekly' | 'weekly';

// Pulse event types
export type PulseEventType = 
  | 'product_launch' 
  | 'firmware_update' 
  | 'pricing_change' 
  | 'compatibility_change' 
  | 'regulatory_change' 
  | 'review' 
  | 'rumour' 
  | 'partnership' 
  | 'availability_change';

// Pulse event importance
export type PulseEventImportance = 'low' | 'medium' | 'high';

// Pulse event status
export type PulseEventStatus = 'new' | 'processed' | 'dismissed';

// Pulse Source - Monitored sources (RSS feeds, pages)
export const pulseSources = pgTable("pulse_sources", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  name: text("name").notNull(),
  sourceType: text("source_type").$type<PulseSourceType>().notNull(),
  url: text("url").notNull(),
  rssUrl: text("rss_url"),
  monitoringMethod: text("monitoring_method").$type<MonitoringMethod>().default("page_monitor").notNull(),
  updateFrequency: text("update_frequency").$type<UpdateFrequency>().default("weekly").notNull(),
  trustLevel: text("trust_level").$type<TrustLevel>().default("independent").notNull(),
  eventTypes: jsonb("event_types").$type<PulseEventType[]>().default([]),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  
  // CPAC additions
  keywordTriggers: jsonb("keyword_triggers").$type<string[]>().default([]),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPulseSourceSchema = createInsertSchema(pulseSources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPulseSource = z.infer<typeof insertPulseSourceSchema>;
export type PulseSource = typeof pulseSources.$inferSelect;

// Pulse Snapshot - For diffing page content
export const pulseSnapshots = pgTable("pulse_snapshots", {
  id: serial("id").primaryKey(),
  pulseSourceId: integer("pulse_source_id").references(() => pulseSources.id, { onDelete: "cascade" }).notNull(),
  
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  contentHash: text("content_hash").notNull(),
  contentExcerpt: text("content_excerpt"),
  rawStorageUrl: text("raw_storage_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPulseSnapshotSchema = createInsertSchema(pulseSnapshots).omit({ id: true, createdAt: true });
export type InsertPulseSnapshot = z.infer<typeof insertPulseSnapshotSchema>;
export type PulseSnapshot = typeof pulseSnapshots.$inferSelect;

// Entity references for pulse events
export const pulseEventEntityRefsSchema = z.object({
  manufacturerId: z.number().optional(),
  productId: z.number().optional(),
  entityIds: z.array(z.number()).optional(),
});
export type PulseEventEntityRefs = z.infer<typeof pulseEventEntityRefsSchema>;

// Pulse Event - Detected events from monitoring
export const pulseEvents = pgTable("pulse_events", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  pulseSourceId: integer("pulse_source_id").references(() => pulseSources.id, { onDelete: "cascade" }).notNull(),
  
  eventType: text("event_type").$type<PulseEventType>().notNull(),
  importance: text("importance").$type<PulseEventImportance>().default("medium").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  entityRefs: jsonb("entity_refs").$type<PulseEventEntityRefs>().default({}),
  summary: text("summary"),
  status: text("status").$type<PulseEventStatus>().default("new").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPulseEventSchema = createInsertSchema(pulseEvents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPulseEvent = z.infer<typeof insertPulseEventSchema>;
export type PulseEvent = typeof pulseEvents.$inferSelect;

// ============ ALIGNMENT SYSTEM ============
// How users relate to Industry Orbits (never ownership!)

// Alignment mode - how a user participates in an Industry Orbit
// DOCTRINE: Alignment NEVER equals ownership
export type AlignmentMode = 'friend' | 'influencer' | 'sponsor';

// Alignment status
export type AlignmentStatus = 'active' | 'paused';

// Alignment - User participation in Industry Orbits
export const alignments = pgTable("alignments", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  mode: text("mode").$type<AlignmentMode>().notNull(),
  status: text("status").$type<AlignmentStatus>().default("active").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrbitUser: unique().on(table.orbitId, table.userId),
}));

export const insertAlignmentSchema = createInsertSchema(alignments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAlignment = z.infer<typeof insertAlignmentSchema>;
export type Alignment = typeof alignments.$inferSelect;

// ============ CORE CONCEPTS ============
// Educational concepts for Industry Orbits (CPAC format)

export const coreConcepts = pgTable("core_concepts", {
  id: serial("id").primaryKey(),
  orbitId: integer("orbit_id").references(() => orbitMeta.id, { onDelete: "cascade" }).notNull(),
  
  conceptId: text("concept_id").notNull(), // e.g., "concept-privacy"
  label: text("label").notNull(),
  whyItMatters: text("why_it_matters"),
  starterQuestions: jsonb("starter_questions").$type<string[]>().default([]),
  intentTags: jsonb("intent_tags").$type<string[]>().default([]),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCoreConceptSchema = createInsertSchema(coreConcepts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCoreConcept = z.infer<typeof insertCoreConceptSchema>;
export type CoreConcept = typeof coreConcepts.$inferSelect;

// ============ CPAC SEED PACK SCHEMA ============
// Canonical Pulse And Content pack format for Industry Orbits

// Source agent metadata
export const cpacSourceAgentSchema = z.object({
  name: z.string(),
  model: z.string().optional(),
  notes: z.string().optional(),
});
export type CpacSourceAgent = z.infer<typeof cpacSourceAgentSchema>;

// UI defaults for orbit
export const cpacUiDefaultsSchema = z.object({
  showProofOfLife: z.boolean().optional(),
  proofOfLifeMode: z.enum(['updated_recently', 'always', 'never']).optional(),
  enableAmbientTileMotion: z.boolean().optional(),
  enableIntentGravity: z.boolean().optional(),
  enableEvidenceArtefacts: z.boolean().optional(),
});
export type CpacUiDefaults = z.infer<typeof cpacUiDefaultsSchema>;

// Governance rules
export const cpacGovernanceSchema = z.object({
  neutrality: z.object({
    isUnowned: z.boolean().optional(),
    sponsorsDoNotInfluenceIntelligence: z.boolean().optional(),
    influencersDoNotPublishConclusions: z.boolean().optional(),
  }).optional(),
  dataQuality: z.object({
    doNotInventRss: z.boolean().optional(),
    requireSourceUrlForSpecs: z.boolean().optional(),
    avoidFakeNumbers: z.boolean().optional(),
  }).optional(),
});
export type CpacGovernance = z.infer<typeof cpacGovernanceSchema>;

// Importance scoring rules
export const cpacImportanceScoringSchema = z.object({
  eventType: z.string(),
  high: z.string().optional(),
  medium: z.string().optional(),
  low: z.string().optional(),
});

// Monitoring rules
export const cpacMonitoringRulesSchema = z.object({
  dedupeRules: z.array(z.string()).optional(),
  importanceScoring: z.array(cpacImportanceScoringSchema).optional(),
  extractionHints: z.object({
    preferSelectors: z.array(z.string()).optional(),
    ignoreSelectors: z.array(z.string()).optional(),
  }).optional(),
});
export type CpacMonitoringRules = z.infer<typeof cpacMonitoringRulesSchema>;

// Asset licensing
export const cpacAssetLicensingSchema = z.object({
  status: z.enum(['unknown', 'public_domain', 'creative_commons', 'licensed', 'proprietary']).optional(),
  notes: z.string().optional(),
});
export type CpacAssetLicensing = z.infer<typeof cpacAssetLicensingSchema>;

// ============ SEED PACK SCHEMA ============
// JSON structure for importing Industry Orbit data (CPAC-compatible)

// Core concept for seed pack
export const seedPackCoreConceptSchema = z.object({
  id: z.string(),
  label: z.string(),
  whyItMatters: z.string().optional(),
  starterQuestions: z.array(z.string()).optional(),
  intentTags: z.array(z.string()).optional(),
});

// Entity with CPAC additions
export const seedPackEntitySchema = z.object({
  id: z.string().optional(), // CPAC entity ID like "ent-meta"
  entityType: z.enum(['manufacturer', 'platform', 'standards', 'publication', 'influencer', 'community', 'retailer', 'distributor']),
  name: z.string(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  regionTags: z.array(z.string()).optional(),
  trustLevel: z.enum(['official', 'trade', 'independent']).optional(),
  // CPAC additions
  logoAssetRef: z.string().nullable().optional(),
  socialUrls: z.object({
    x: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
    youtube: z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
  }).optional(),
  notes: z.string().optional(),
});

// Product with CPAC additions
export const seedPackProductSchema = z.object({
  id: z.string().optional(), // CPAC product ID like "prod-example-1"
  name: z.string(),
  manufacturerName: z.string().optional(), // Resolved to ID during import
  manufacturerEntityId: z.string().optional(), // CPAC reference like "ent-meta"
  category: z.enum(['consumer', 'enterprise', 'developer']).optional(),
  status: z.enum(['shipping', 'announced', 'rumoured', 'discontinued']).optional(),
  releaseDate: z.string().nullable().optional(), // ISO date string
  primaryUrl: z.string().optional(),
  summary: z.string().optional(),
  heroAssetRef: z.string().nullable().optional(),
  // CPAC additions
  mediaRefs: z.object({
    imageAssetRefs: z.array(z.string()).optional(),
    videoAssetRefs: z.array(z.string()).optional(),
  }).optional(),
  referenceUrls: z.array(z.string()).optional(),
  intentTags: z.array(z.string()).optional(),
  specs: z.array(z.object({
    specKey: z.string(),
    specValue: z.string(),
    specUnit: z.string().nullable().optional(),
    sourceUrl: z.string().optional(),
    lastVerifiedAt: z.string().nullable().optional(),
  })).optional(),
});

// Review with CPAC additions
export const seedPackReviewSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  url: z.string(),
  productName: z.string().optional(), // Resolved to ID during import
  productId: z.string().optional(), // CPAC reference
  reviewerName: z.string().optional(), // Resolved to entity ID
  reviewerEntityId: z.string().optional(), // CPAC reference
  publishedAt: z.string().nullable().optional(),
  ratingValue: z.number().nullable().optional(),
  ratingScale: z.number().nullable().optional(),
  summary: z.string().optional(),
  sentiment: z.enum(['positive', 'mixed', 'negative', 'unknown']).optional(),
});

// Community with CPAC additions
export const seedPackCommunitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  url: z.string(),
  communityType: z.enum(['forum', 'subreddit', 'discord', 'slack', 'community_site', 'event_series']),
  notes: z.string().optional(),
  // CPAC addition
  regionTags: z.array(z.string()).optional(),
});

// Tile with CPAC additions
export const seedPackTileSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  sublabel: z.string().optional(),
  intentTags: z.array(z.string()).optional(),
  priority: z.number().optional(),
  // CPAC addition
  evidenceRefs: z.object({
    productIds: z.array(z.string()).optional(),
    entityIds: z.array(z.string()).optional(),
    communityIds: z.array(z.string()).optional(),
  }).optional(),
});

// Pulse source with CPAC additions
export const seedPackPulseSourceSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  sourceType: z.enum(['manufacturer', 'publication', 'influencer', 'standards', 'community', 'retailer']),
  url: z.string(),
  rssUrl: z.string().nullable().optional(),
  monitoringMethod: z.enum(['rss', 'page_monitor']).optional(),
  updateFrequency: z.enum(['daily', 'twice_weekly', 'weekly']).optional(),
  trustLevel: z.enum(['official', 'trade', 'independent']).optional(),
  eventTypes: z.array(z.enum([
    'product_launch', 'firmware_update', 'pricing_change', 'compatibility_change',
    'regulatory_change', 'review', 'rumour', 'partnership', 'availability_change'
  ])).optional(),
  // CPAC additions
  keywordTriggers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// Asset with CPAC format
export const seedPackAssetSchema = z.object({
  assetRef: z.string(),
  assetType: z.enum(['image', 'video', 'document']),
  title: z.string().optional(),
  sourceUrl: z.string().optional(),
  licensing: cpacAssetLicensingSchema.optional(),
});

// Full CPAC-compatible seed pack schema
export const cpacSeedPackSchema = z.object({
  // CPAC metadata
  cpacVersion: z.string().optional(),
  packType: z.literal('industry_orbit_cpac').optional(),
  generatedAt: z.string().optional(),
  sourceAgent: cpacSourceAgentSchema.optional(),
  
  // Orbit configuration
  orbit: z.object({
    slug: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    regionFocus: z.array(z.string()).optional(),
    language: z.string().optional(),
    orbitType: z.literal('industry').optional(),
    visibility: z.enum(['public', 'private']).optional(),
    tags: z.array(z.string()).optional(),
    uiDefaults: cpacUiDefaultsSchema.optional(),
  }).optional(),
  
  // Seed pack content
  seedPack: z.object({
    coreConcepts: z.array(seedPackCoreConceptSchema).optional(),
    starterTiles: z.array(seedPackTileSchema).optional(),
  }).optional(),
  
  // Main data arrays
  entities: z.array(seedPackEntitySchema).optional(),
  products: z.array(seedPackProductSchema).optional(),
  reviews: z.array(seedPackReviewSchema).optional(),
  communities: z.array(seedPackCommunitySchema).optional(),
  assets: z.array(seedPackAssetSchema).optional(),
  
  // Pulse monitoring
  pulse: z.object({
    sources: z.array(seedPackPulseSourceSchema).optional(),
    monitoringRules: cpacMonitoringRulesSchema.optional(),
  }).optional(),
  
  // Governance
  governance: cpacGovernanceSchema.optional(),
});

export type CpacSeedPack = z.infer<typeof cpacSeedPackSchema>;

// Legacy seed pack schema (backwards compatible)
export const seedPackSchema = z.object({
  version: z.string().default("1.0"),
  orbitSlug: z.string(),
  title: z.string().optional(),
  summary: z.string().optional(),
  entities: z.array(seedPackEntitySchema).optional(),
  products: z.array(seedPackProductSchema).optional(),
  reviews: z.array(seedPackReviewSchema).optional(),
  communities: z.array(seedPackCommunitySchema).optional(),
  tiles: z.array(seedPackTileSchema).optional(),
  pulseSources: z.array(seedPackPulseSourceSchema).optional(),
});

export type SeedPack = z.infer<typeof seedPackSchema>;

// ============ CONVERSATION INSIGHTS (Business tier feature) ============

export const conversationInsights = pgTable("conversation_insights", {
  id: serial("id").primaryKey(),
  icePreviewId: text("ice_preview_id").references(() => icePreviews.id, { onDelete: "cascade" }).notNull(),
  
  // Insight data
  summary: text("summary").notNull(), // High-level summary of conversations
  topTopics: text("top_topics").array().notNull().default([]), // Most discussed topics
  commonQuestions: text("common_questions").array().notNull().default([]), // Frequently asked questions
  sentimentScore: integer("sentiment_score"), // -100 to 100
  engagementInsights: text("engagement_insights"), // AI-generated engagement observations
  actionableRecommendations: text("actionable_recommendations").array().default([]), // Suggested improvements
  
  // Metadata
  conversationCount: integer("conversation_count").notNull().default(0),
  messageCount: integer("message_count").notNull().default(0),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(), // Cache expiry (e.g., 24 hours)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationInsightSchema = createInsertSchema(conversationInsights).omit({ id: true, createdAt: true });
export type InsertConversationInsight = z.infer<typeof insertConversationInsightSchema>;
export type ConversationInsight = typeof conversationInsights.$inferSelect;
