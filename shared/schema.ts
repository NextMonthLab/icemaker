import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users
// User roles: viewer (default), creator (storytellers), admin (full access)
export type UserRole = 'viewer' | 'creator' | 'admin';

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreatorProfileSchema = createInsertSchema(creatorProfiles).omit({ id: true, createdAt: true });
export type InsertCreatorProfile = z.infer<typeof insertCreatorProfileSchema>;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;

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

export const universes = pgTable("universes", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(), // Unique identifier for deterministic imports
  name: text("name").notNull(),
  description: text("description").notNull(),
  styleNotes: text("style_notes"),
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
export type OrbitGenerationStatus = 'idle' | 'generating' | 'ready' | 'failed';

// Orbit Meta - tracks business orbits and links to existing preview data
export const orbitMeta = pgTable("orbit_meta", {
  id: serial("id").primaryKey(),
  businessSlug: text("business_slug").notNull().unique(),
  sourceUrl: text("source_url").notNull(),
  
  // Link to existing preview (uses existing preview system for rich data)
  previewId: text("preview_id").references(() => previewInstances.id),
  
  // Pack versioning (DB pointer, no mutable latest.json) - deprecated, use previewId
  currentPackVersion: text("current_pack_version"),
  currentPackKey: text("current_pack_key"),
  
  // Ownership (null = unclaimed preview)
  ownerId: integer("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  verifiedAt: timestamp("verified_at"),
  
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
  source: text("source").default('orbit'), // orbit, chat, cta
  isRead: boolean("is_read").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrbitLeadSchema = createInsertSchema(orbitLeads).omit({ id: true, createdAt: true, isRead: true });
export type InsertOrbitLead = z.infer<typeof insertOrbitLeadSchema>;
export type OrbitLead = typeof orbitLeads.$inferSelect;
