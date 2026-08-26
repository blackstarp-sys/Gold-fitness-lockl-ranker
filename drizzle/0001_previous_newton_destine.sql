ALTER TABLE "business_locations" ADD COLUMN "google_account_id" text;--> statement-breakpoint
ALTER TABLE "business_locations" ADD COLUMN "website_uri" text;--> statement-breakpoint
ALTER TABLE "business_locations" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "business_locations" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "metric_logs" ADD COLUMN "searches_maps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "reviewer_photo" text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "call_to_action" text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "error_message" text;