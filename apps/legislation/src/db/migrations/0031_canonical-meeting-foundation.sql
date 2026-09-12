ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "publisher_local_date" date;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "is_remote" boolean;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "source_sequence" integer;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "source_provider" text;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "source_retrieved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "source_is_official" boolean;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "provenance_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "canonical_facts_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "session_relations_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD COLUMN IF NOT EXISTS "organization_relations_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legislation"."event_sessions" (
	"event_id" text NOT NULL,
	"session_id" text NOT NULL,
	CONSTRAINT "event_sessions_event_id_session_id_pk" PRIMARY KEY("event_id", "session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legislation"."event_organizations" (
	"event_id" text NOT NULL,
	"organization_id" text NOT NULL,
	CONSTRAINT "event_organizations_event_id_organization_id_pk" PRIMARY KEY("event_id", "organization_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."event_sessions" ADD CONSTRAINT "event_sessions_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."event_sessions" ADD CONSTRAINT "event_sessions_session_id_legislative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "legislation"."legislative_sessions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."event_organizations" ADD CONSTRAINT "event_organizations_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."event_organizations" ADD CONSTRAINT "event_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_sessions_session_idx" ON "legislation"."event_sessions" USING btree ("session_id", "event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_organizations_organization_idx" ON "legislation"."event_organizations" USING btree ("organization_id", "event_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."legislative_events" ADD CONSTRAINT "legislative_events_classification_vocabulary_check" CHECK ("classification" IS NULL OR "classification" IN ('meeting', 'hearing', 'session', 'other')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."legislative_events" ADD CONSTRAINT "legislative_events_status_vocabulary_check" CHECK ("status" IN ('scheduled', 'completed', 'cancelled', 'postponed', 'other')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."legislative_events" ADD CONSTRAINT "legislative_events_source_sequence_check" CHECK ("source_sequence" IS NULL OR "source_sequence" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."legislative_events" ADD CONSTRAINT "legislative_events_provenance_complete_check" CHECK (NOT "provenance_complete" OR ("source_url" IS NOT NULL AND "source_url" ~ '^https://' AND "source_provider" IS NOT NULL AND length(btrim("source_provider")) > 0 AND "source_retrieved_at" IS NOT NULL AND "source_is_official" IS NOT NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."legislative_events" ADD CONSTRAINT "legislative_events_canonical_facts_complete_check" CHECK (NOT "canonical_facts_complete" OR ("publisher_local_date" IS NOT NULL AND "classification" IS NOT NULL AND "provenance_complete")) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
