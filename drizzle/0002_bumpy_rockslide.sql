CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"recipient" text NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"message_template" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "citation_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"platform" text NOT NULL,
	"listing_url" text,
	"sync_status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_rank_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"recorded_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"business_name" text NOT NULL,
	"google_maps_url" text,
	"current_rank" integer,
	"rating" double precision,
	"review_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "keyword_rank_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"recorded_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seo_audit_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_id" integer NOT NULL,
	"check_key" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "seo_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"url" text NOT NULL,
	"score" integer,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"keyword" text NOT NULL,
	"current_rank" integer,
	"search_volume" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform_name" text NOT NULL,
	"access_token" text NOT NULL,
	"profile_id" text NOT NULL,
	"profile_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "business_locations" ADD COLUMN "business_hours" jsonb;--> statement-breakpoint
ALTER TABLE "business_locations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "sentiment_score" double precision;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "needs_attention" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "platforms" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "google_post_id" text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "last_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_scopes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_logs" ADD CONSTRAINT "campaign_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation_sources" ADD CONSTRAINT "citation_sources_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_rank_history" ADD CONSTRAINT "competitor_rank_history_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_rank_history" ADD CONSTRAINT "keyword_rank_history_keyword_id_seo_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."seo_keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_audit_items" ADD CONSTRAINT "seo_audit_items_audit_id_seo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."seo_audits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_audits" ADD CONSTRAINT "seo_audits_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;