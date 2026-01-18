CREATE TABLE "ai_character_custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"placeholder" text,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"options" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_character_field_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ice_preview_id" text NOT NULL,
	"character_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"viewer_session_id" text NOT NULL,
	"viewer_display_name" text,
	"viewer_user_id" integer,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"ice_id" text,
	"usage_type" text NOT NULL,
	"credits_used" real NOT NULL,
	"model" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"ice_preview_id" text NOT NULL,
	"summary" text NOT NULL,
	"top_topics" text[] DEFAULT '{}' NOT NULL,
	"common_questions" text[] DEFAULT '{}' NOT NULL,
	"sentiment_score" integer,
	"engagement_insights" text,
	"actionable_recommendations" text[] DEFAULT '{}',
	"conversation_count" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_profile_id" integer NOT NULL,
	"followed_profile_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profile_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_risk" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostname" text NOT NULL,
	"last_attempt_at" timestamp,
	"last_success_at" timestamp,
	"recommended_delay_ms" integer DEFAULT 2000 NOT NULL,
	"friction_count" integer DEFAULT 0 NOT NULL,
	"last_friction_codes" jsonb,
	"last_outcome" text,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_risk_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
CREATE TABLE "ice_card_message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer,
	"anon_fingerprint" text,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ice_card_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ice_card_id" text NOT NULL,
	"ice_preview_id" text NOT NULL,
	"user_id" integer,
	"display_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ice_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"ice_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"visitor_ip" text,
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ice_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"ice_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_slug" text NOT NULL,
	"trace_id" text NOT NULL,
	"mode" text NOT NULL,
	"discovery_sources" jsonb,
	"pages_planned" integer DEFAULT 0 NOT NULL,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"pages_used" integer DEFAULT 0 NOT NULL,
	"cache_hits" integer DEFAULT 0 NOT NULL,
	"cache_misses" integer DEFAULT 0 NOT NULL,
	"cache_writes" integer DEFAULT 0 NOT NULL,
	"outcome" text NOT NULL,
	"friction_signals" jsonb,
	"domain_risk_score" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"ice_id" text,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"mime_type" text,
	"category" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "url_fetch_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"hostname" text NOT NULL,
	"content_hash" text,
	"content_length" integer,
	"last_http_status" integer,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"fetch_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "url_fetch_cache_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "ice_previews" ALTER COLUMN "music_volume" SET DEFAULT 15;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "used_storage_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "storage_limit_bytes" bigint DEFAULT 5368709120 NOT NULL;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "content_context" text DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "caption_settings" jsonb;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "caption_timing_mode" text DEFAULT 'aligned';--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "alignment_transcript" jsonb;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "alignment_status" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "share_slug" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "lead_gate_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "lead_gate_prompt" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "logo_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "logo_position" text DEFAULT 'top-right';--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "brand_accent_color" text;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "admin_cta_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ice_previews" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "free_pass_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_character_custom_fields" ADD CONSTRAINT "ai_character_custom_fields_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_character_field_responses" ADD CONSTRAINT "ai_character_field_responses_ice_preview_id_ice_previews_id_fk" FOREIGN KEY ("ice_preview_id") REFERENCES "public"."ice_previews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_character_field_responses" ADD CONSTRAINT "ai_character_field_responses_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_character_field_responses" ADD CONSTRAINT "ai_character_field_responses_field_id_ai_character_custom_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."ai_character_custom_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_character_field_responses" ADD CONSTRAINT "ai_character_field_responses_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_profile_id_creator_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_ice_preview_id_ice_previews_id_fk" FOREIGN KEY ("ice_preview_id") REFERENCES "public"."ice_previews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_follows" ADD CONSTRAINT "creator_follows_follower_profile_id_creator_profiles_id_fk" FOREIGN KEY ("follower_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_follows" ADD CONSTRAINT "creator_follows_followed_profile_id_creator_profiles_id_fk" FOREIGN KEY ("followed_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profile_links" ADD CONSTRAINT "creator_profile_links_profile_id_creator_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_card_message_reactions" ADD CONSTRAINT "ice_card_message_reactions_message_id_ice_card_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ice_card_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_card_message_reactions" ADD CONSTRAINT "ice_card_message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_card_messages" ADD CONSTRAINT "ice_card_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_leads" ADD CONSTRAINT "ice_leads_ice_id_ice_previews_id_fk" FOREIGN KEY ("ice_id") REFERENCES "public"."ice_previews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ice_likes" ADD CONSTRAINT "ice_likes_profile_id_creator_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_business_slug_orbit_meta_business_slug_fk" FOREIGN KEY ("business_slug") REFERENCES "public"."orbit_meta"("business_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_profile_id_creator_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ice_card_messages_card" ON "ice_card_messages" USING btree ("ice_card_id");--> statement-breakpoint
CREATE INDEX "idx_ice_card_messages_preview" ON "ice_card_messages" USING btree ("ice_preview_id");--> statement-breakpoint
ALTER TABLE "ice_previews" ADD CONSTRAINT "ice_previews_share_slug_unique" UNIQUE("share_slug");