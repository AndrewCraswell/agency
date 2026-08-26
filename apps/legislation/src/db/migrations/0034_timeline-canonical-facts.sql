-- Defaults deliberately preserve all existing rows as timeline-incomplete.
ALTER TABLE "legislation"."votes"
  ADD COLUMN IF NOT EXISTS "absent_count" integer,
  ADD COLUMN IF NOT EXISTS "abstain_count" integer,
  ADD COLUMN IF NOT EXISTS "not_voting_count" integer,
  ADD COLUMN IF NOT EXISTS "present_count" integer,
  ADD COLUMN IF NOT EXISTS "proxy_count" integer,
  ADD COLUMN IF NOT EXISTS "paired_count" integer,
  ADD COLUMN IF NOT EXISTS "source_provider" text,
  ADD COLUMN IF NOT EXISTS "source_updated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "source_retrieved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "source_is_official" boolean,
  ADD COLUMN IF NOT EXISTS "source_sequence" integer,
  ADD COLUMN IF NOT EXISTS "timeline_complete" boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_absent_count_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_absent_count_check" CHECK ("absent_count" IS NULL OR "absent_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_abstain_count_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_abstain_count_check" CHECK ("abstain_count" IS NULL OR "abstain_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_not_voting_count_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_not_voting_count_check" CHECK ("not_voting_count" IS NULL OR "not_voting_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_present_count_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_present_count_check" CHECK ("present_count" IS NULL OR "present_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_proxy_count_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_proxy_count_check" CHECK ("proxy_count" IS NULL OR "proxy_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_paired_count_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_paired_count_check" CHECK ("paired_count" IS NULL OR "paired_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_source_sequence_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_source_sequence_check" CHECK ("source_sequence" IS NULL OR "source_sequence" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_timeline_complete_check' AND conrelid = 'legislation.votes'::regclass) THEN
    ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_timeline_complete_check" CHECK (
      NOT "timeline_complete" OR (
        "held_at" IS NOT NULL AND "result" IN ('passed', 'failed', 'other') AND
        "yes_count" IS NOT NULL AND "no_count" IS NOT NULL AND "absent_count" IS NOT NULL AND
        "abstain_count" IS NOT NULL AND "not_voting_count" IS NOT NULL AND "present_count" IS NOT NULL AND
        "proxy_count" IS NOT NULL AND "paired_count" IS NOT NULL AND "other_count" IS NOT NULL AND
        "source_url" ~ '^https://' AND "source_provider" IS NOT NULL AND length(btrim("source_provider")) > 0 AND
        "source_retrieved_at" IS NOT NULL AND "source_is_official" IS NOT NULL AND "source_sequence" IS NOT NULL
      )
    );
  END IF;
END $$;

ALTER TABLE "legislation"."event_outcomes"
  ADD COLUMN IF NOT EXISTS "occurred_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "occurred_date" date,
  ADD COLUMN IF NOT EXISTS "timeline_complete" boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_outcomes_timeline_complete_check' AND conrelid = 'legislation.event_outcomes'::regclass) THEN
    ALTER TABLE "legislation"."event_outcomes" ADD CONSTRAINT "event_outcomes_timeline_complete_check" CHECK (
      NOT "timeline_complete" OR ("occurred_at" IS NOT NULL AND "occurred_date" IS NOT NULL)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "votes_bill_timeline_idx"
  ON "legislation"."votes" ("bill_id", "held_at", "source_sequence", "id");
CREATE INDEX IF NOT EXISTS "event_outcomes_timeline_idx"
  ON "legislation"."event_outcomes" ("occurred_at", "source_sequence", "id");
