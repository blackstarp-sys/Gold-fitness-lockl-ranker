ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "selected_google_account_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "selected_google_location_id" text;
ALTER TABLE "business_locations" ADD COLUMN IF NOT EXISTS "place_id" text;
ALTER TABLE "business_locations" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false;
