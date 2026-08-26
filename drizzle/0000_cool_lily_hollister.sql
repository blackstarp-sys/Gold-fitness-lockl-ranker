CREATE TABLE "business_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"google_location_id" text NOT NULL,
	"business_name" text NOT NULL,
	"address" text,
	"category" text,
	"phone" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "business_locations_google_location_id_unique" UNIQUE("google_location_id")
);
--> statement-breakpoint
CREATE TABLE "metric_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"profile_views" integer DEFAULT 0 NOT NULL,
	"search_views" integer DEFAULT 0 NOT NULL,
	"website_clicks" integer DEFAULT 0 NOT NULL,
	"call_clicks" integer DEFAULT 0 NOT NULL,
	"recorded_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"google_review_id" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"star_rating" integer NOT NULL,
	"comment" text,
	"ai_draft_reply" text,
	"published_reply" text,
	"reply_status" text DEFAULT 'PENDING' NOT NULL,
	"review_timestamp" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "reviews_google_review_id_unique" UNIQUE("google_review_id")
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"access_token" text,
	"refresh_token" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "business_locations" ADD CONSTRAINT "business_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_location_id_business_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."business_locations"("id") ON DELETE no action ON UPDATE no action;