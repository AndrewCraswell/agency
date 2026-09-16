-- Existing relation rows remain incomplete and are never assigned inferred facts.

ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "direction" text;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "source_url" text;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "source_provider" text;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "source_updated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "source_retrieved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "source_is_official" boolean;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "provenance_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD COLUMN IF NOT EXISTS "canonical_facts_complete" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "legislation"."bill_relations" ADD CONSTRAINT "bill_relations_classification_check"
    CHECK ("classification" IN ('companion', 'replacement', 'replaced-by', 'prior-session', 'related', 'other')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "legislation"."bill_relations" ADD CONSTRAINT "bill_relations_direction_check"
    CHECK ("direction" IS NULL OR "direction" IN ('outgoing', 'incoming')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "legislation"."bill_relations" ADD CONSTRAINT "bill_relations_provenance_complete_check"
    CHECK (NOT "provenance_complete" OR ("source_url" IS NOT NULL AND "source_url" ~ '^https://' AND "source_provider" IS NOT NULL AND length(btrim("source_provider")) > 0 AND "source_retrieved_at" IS NOT NULL AND "source_is_official" IS NOT NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "legislation"."bill_relations" ADD CONSTRAINT "bill_relations_canonical_facts_complete_check"
    CHECK (NOT "canonical_facts_complete" OR ("direction" IS NOT NULL AND "provenance_complete" AND "source_updated_at" IS NOT NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_relations_lookup_idx"
  ON "legislation"."bill_relations" USING btree ("bill_id", "direction", "classification", "related_bill_id");
