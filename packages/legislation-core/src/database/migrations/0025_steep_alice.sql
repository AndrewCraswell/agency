ALTER TABLE "legislation"."legislative_sessions" ALTER COLUMN "is_active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ALTER COLUMN "is_active" DROP NOT NULL;--> statement-breakpoint
UPDATE "legislation"."legislative_sessions" SET "is_active" = NULL;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "is_active" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "source_retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "source_is_official" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD COLUMN "provenance_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD COLUMN "classification" text;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD COLUMN "source_retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD COLUMN "source_is_official" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD COLUMN "provenance_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "jurisdictions_foundation_incomplete_idx" ON "legislation"."jurisdictions" USING btree ("id") WHERE not "legislation"."jurisdictions"."provenance_complete";--> statement-breakpoint
CREATE INDEX "legislative_sessions_foundation_incomplete_idx" ON "legislation"."legislative_sessions" USING btree ("id") WHERE not "legislation"."legislative_sessions"."provenance_complete";--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD CONSTRAINT "jurisdictions_timezone_check" CHECK ("legislation"."jurisdictions"."timezone" is null or length("legislation"."jurisdictions"."timezone") > 0);--> statement-breakpoint
ALTER TABLE "legislation"."jurisdictions" ADD CONSTRAINT "jurisdictions_provenance_complete_check" CHECK (not "legislation"."jurisdictions"."provenance_complete" or ("legislation"."jurisdictions"."source_url" ~ '^https://' and length(btrim("legislation"."jurisdictions"."source_provider")) > 0 and "legislation"."jurisdictions"."source_retrieved_at" is not null and "legislation"."jurisdictions"."source_is_official" is not null));--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD CONSTRAINT "legislative_sessions_classification_check" CHECK ("legislation"."legislative_sessions"."classification" is null or length("legislation"."legislative_sessions"."classification") > 0);--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD CONSTRAINT "legislative_sessions_provenance_complete_check" CHECK (not "legislation"."legislative_sessions"."provenance_complete" or ("legislation"."legislative_sessions"."source_url" ~ '^https://' and length(btrim("legislation"."legislative_sessions"."source_provider")) > 0 and "legislation"."legislative_sessions"."source_retrieved_at" is not null and "legislation"."legislative_sessions"."source_is_official" is not null));
