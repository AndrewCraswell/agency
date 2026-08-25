ALTER TABLE "legislation"."bill_sponsors" ADD COLUMN IF NOT EXISTS "first_observed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_sponsors" ADD COLUMN IF NOT EXISTS "latest_observed_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."bill_sponsors" ADD CONSTRAINT "bill_sponsors_observation_bounds_check" CHECK (("first_observed_at" IS NULL AND "latest_observed_at" IS NULL) OR ("first_observed_at" IS NOT NULL AND "latest_observed_at" IS NOT NULL AND "first_observed_at" <= "latest_observed_at"));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_sponsors_person_activity_idx" ON "legislation"."bill_sponsors" USING btree ("person_id", "latest_observed_at", "bill_id") WHERE "person_id" IS NOT NULL AND "latest_observed_at" IS NOT NULL;
