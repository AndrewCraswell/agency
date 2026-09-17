-- Apply explicitly when upgrading an existing isolated legal passage-search database.
DO $$ BEGIN
  IF current_database() NOT IN ('legislation_passage_search', 'legislation_passage_search_destructive_test') THEN
    RAISE EXCEPTION 'Not the isolated passage search database';
  END IF;
  IF to_regclass('legislation.legal_search_scopes') IS NULL THEN
    RAISE EXCEPTION 'Legal passage-search baseline is missing';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS legislation.legal_search_scope_projections (
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  projection jsonb NOT NULL CHECK(jsonb_typeof(projection)='object'),
  projection_hash text NOT NULL CHECK(projection_hash ~ '^[a-f0-9]{64}$'),
  projected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_kind,scope_id),
  FOREIGN KEY(scope_kind,scope_id) REFERENCES legislation.legal_search_scopes(scope_kind,scope_id) ON DELETE CASCADE,
  CHECK(projection->>'scope_kind'=scope_kind AND projection->>'scope_id'=scope_id::text)
);
CREATE INDEX IF NOT EXISTS legal_search_scope_projection_common_idx ON legislation.legal_search_scope_projections
  ((projection->>'corpus'),(projection->>'jurisdiction_id'),(projection->>'source_id'),scope_id);
CREATE INDEX IF NOT EXISTS legal_search_scope_projection_publication_idx ON legislation.legal_search_scope_projections
  ((projection->>'publication_kind'),(projection->>'publication_date'),scope_id)
  WHERE scope_kind='publication';
