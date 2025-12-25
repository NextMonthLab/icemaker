import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  username: text("username").notNull().unique(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

// Chat Policy Schema (universe-level guardrails)
export const chatPolicySchema = z.object({
  mode: z.enum(["role_gated", "character_only"]).default("character_only"),
  global_rules: z.array(z.string()).optional(),
  blocked_personas: z.array(z.string()).optional(),
  allowed_roles: z.array(z.string()).optional(),
  safety: z.object({
    no_harassment: z.boolean().default(true),
    no_self_harm_guidance: z.boolean().default(true),
    no_sexual_content: z.boolean().default(true),
    no_illegal_instructions: z.boolean().default(true),
  }).optional(),
  disclaimer: z.string().optional(),
}).optional();

export type ChatPolicy = z.infer<typeof chatPolicySchema>;

// Character Chat Profile Schema (how character speaks + goals + limits)
export const chatProfileSchema = z.object({
  voice: z.string().optional(),
  speech_style: z.string().optional(),
  goals: z.array(z.string()).optional(),
  knowledge: z.object({
    knows_up_to_dayIndex: z.union([z.number(), z.literal("dynamic")]).optional(),
    spoiler_protection: z.boolean().default(true),
  }).optional(),
  hard_limits: z.array(z.string()).optional(),
  allowed_topics: z.array(z.string()).optional(),
  blocked_topics: z.array(z.string()).optional(),
  refusal_style: z.string().optional(),
}).optional();

export type ChatProfile = z.infer<typeof chatProfileSchema>;

// Card Chat Overrides Schema (per-card mood/knowledge changes)
export const chatOverridesSchema = z.record(z.string(), z.object({
  mood: z.string().optional(),
  knows_up_to_dayIndex: z.number().optional(),
  refuse_topics: z.array(z.string()).optional(),
  can_reveal: z.array(z.string()).optional(),
})).optional();

export type ChatOverrides = z.infer<typeof chatOverridesSchema>;

// Release mode types for universe card visibility
export type ReleaseMode = 'daily' | 'all_at_once' | 'hybrid_intro_then_daily';

// Universe (Story World)
export const universes = pgTable("universes", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(), // Unique identifier for deterministic imports
  name: text("name").notNull(),
  description: text("description").notNull(),
  styleNotes: text("style_notes"),
  visualMode: text("visual_mode").default("author_supplied"), // "engine_generated" | "author_supplied"
  visualStyle: jsonb("visual_style").$type<VisualStyle>(), // Universe-level style constraints
  visualContinuity: jsonb("visual_continuity").$type<VisualContinuity>(), // Style bible for consistent look
  chatPolicy: jsonb("chat_policy").$type<ChatPolicy>(), // Global chat guardrails and safety rules
  // Release cadence settings for 3-card hook onboarding
  releaseMode: text("release_mode").$type<ReleaseMode>().default("daily"), // 'daily' | 'all_at_once' | 'hybrid_intro_then_daily'
  introCardsCount: integer("intro_cards_count").default(3), // Number of cards to unlock immediately in hybrid mode
  dailyReleaseStartsAtDayIndex: integer("daily_release_starts_at_day_index"), // When daily gating begins (defaults to introCardsCount + 1)
  timezone: text("timezone").default("UTC"), // Timezone for publishAt comparisons
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUniverseSchema = createInsertSchema(universes).omit({ id: true, createdAt: true });
export type InsertUniverse = z.infer<typeof insertUniverseSchema>;
export type Universe = typeof universes.$inferSelect;

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
  
  // Visual continuity references (for prompt composition)
  primaryCharacterIds: jsonb("primary_character_ids").$type<number[]>(), // Characters in this scene
  locationId: integer("location_id").references(() => locations.id), // Location for this scene
  
  // Chat overrides for this card (mood/knowledge per character)
  chatOverrides: jsonb("chat_overrides").$type<ChatOverrides>(),
  
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

// Export chat models for AI integrations
export * from "./models/chat";
