-- Legacy change rows intentionally remain nullable. The change feed rejects rows
-- without a complete captured snapshot rather than joining the mutable record.
ALTER TABLE legislation.change_events
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_is_official boolean;

DO $$
BEGIN
  ALTER TABLE legislation.change_events
    ADD CONSTRAINT change_events_source_snapshot_check
    CHECK (
      (source_url IS NULL AND source_provider IS NULL AND source_retrieved_at IS NULL AND source_is_official IS NULL)
      OR
      (source_url ~ '^https://' AND source_provider IS NOT NULL AND length(btrim(source_provider)) > 0 AND source_retrieved_at IS NOT NULL AND source_is_official IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
