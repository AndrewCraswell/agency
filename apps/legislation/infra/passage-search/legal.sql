-- Apply to the isolated search database. This does not modify the bill projection.
DO $$ BEGIN
  IF current_database() <> 'legislation_passage_search' THEN
    RAISE EXCEPTION 'Not the isolated passage search database';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS legislation;
CREATE TABLE legislation.legal_search_generations (
  id text PRIMARY KEY,
  metadata jsonb NOT NULL,
  copied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE legislation.legal_search_passages (
  id text PRIMARY KEY,
  generation_id text NOT NULL REFERENCES legislation.legal_search_generations(id),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  body text NOT NULL,
  input_text text NOT NULL,
  data jsonb NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english',input_text)) STORED,
  UNIQUE(generation_id,ordinal),
  CHECK(body=data->>'text' AND input_text=data->>'inputText' AND ordinal=(data->>'ordinal')::integer)
);
CREATE INDEX legal_search_passages_text_idx ON legislation.legal_search_passages USING gin(search_vector);
CREATE TABLE legislation.legal_search_memberships (
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  generation_id text NOT NULL REFERENCES legislation.legal_search_generations(id),
  PRIMARY KEY(scope_kind,scope_id,generation_id)
);
CREATE INDEX legal_search_memberships_generation_idx ON legislation.legal_search_memberships(generation_id);
CREATE TABLE legislation.legal_search_scopes (
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  preparation_id text NOT NULL,
  inventory_hash text NOT NULL,
  generation_count integer NOT NULL CHECK(generation_count > 0),
  passage_count integer NOT NULL CHECK(passage_count >= 0),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_kind,scope_id)
);
CREATE TABLE legislation.legal_search_revocations (
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_kind,scope_id)
);
