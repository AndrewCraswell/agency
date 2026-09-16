-- Existing rows remain null and public readers reject them until refreshed by
-- a source that provides the original position array ordinal.
ALTER TABLE "legislation"."vote_positions"
  ADD COLUMN IF NOT EXISTS "source_sequence" integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vote_positions_source_sequence_check' AND conrelid = 'legislation.vote_positions'::regclass) THEN
    ALTER TABLE "legislation"."vote_positions" ADD CONSTRAINT "vote_positions_source_sequence_check" CHECK ("source_sequence" IS NULL OR "source_sequence" >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "vote_positions_vote_sequence_idx"
  ON "legislation"."vote_positions" ("vote_id", "source_sequence", "source_identity");
