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
CREATE TABLE legislation.legal_search_results (
  id uuid PRIMARY KEY,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  generation text NOT NULL CHECK(generation ~ '^[a-f0-9]{64}$'),
  candidates jsonb NOT NULL CHECK(jsonb_typeof(candidates)='array' AND jsonb_array_length(candidates) BETWEEN 1 AND 1000),
  candidate_hash text NOT NULL CHECK(candidate_hash ~ '^[a-f0-9]{64}$'),
  window_truncated boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '15 minutes'),
  CHECK(expires_at > created_at)
);
CREATE INDEX legal_search_results_expiry_idx ON legislation.legal_search_results(expires_at,id);

-- Independent from metadata serialization; tombstones survive generation deletion and recreation.
CREATE TABLE legislation.legal_copy_revisions (
  generation_id text PRIMARY KEY CHECK(generation_id ~ '^[a-f0-9]{64}$'),
  revision bigint NOT NULL CHECK(revision>0)
);
CREATE FUNCTION legislation.advance_legal_copy_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_id text; next_id text;
BEGIN
  IF TG_OP='TRUNCATE' THEN
    UPDATE legislation.legal_copy_revisions SET revision=revision+1;
    RETURN NULL;
  END IF;
  IF TG_OP<>'INSERT' THEN previous_id=to_jsonb(OLD)->>TG_ARGV[0]; END IF;
  IF TG_OP<>'DELETE' THEN next_id=to_jsonb(NEW)->>TG_ARGV[0]; END IF;
  INSERT INTO legislation.legal_copy_revisions(generation_id,revision)
  SELECT DISTINCT id,1 FROM unnest(ARRAY[previous_id,next_id]) AS changed(id) WHERE id IS NOT NULL ORDER BY id
  ON CONFLICT(generation_id) DO UPDATE SET revision=legislation.legal_copy_revisions.revision+1;
  RETURN NULL;
END $$;
CREATE TRIGGER legal_copy_generation_revision AFTER INSERT OR UPDATE OR DELETE ON legislation.legal_search_generations
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('id');
CREATE TRIGGER legal_copy_passage_revision AFTER INSERT OR UPDATE OR DELETE ON legislation.legal_search_passages
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
CREATE TRIGGER legal_copy_membership_revision AFTER INSERT OR UPDATE OR DELETE ON legislation.legal_search_memberships
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
CREATE TRIGGER legal_copy_generation_truncate AFTER TRUNCATE ON legislation.legal_search_generations
  FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('id');
CREATE TRIGGER legal_copy_passage_truncate AFTER TRUNCATE ON legislation.legal_search_passages
  FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
CREATE TRIGGER legal_copy_membership_truncate AFTER TRUNCATE ON legislation.legal_search_memberships
  FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');

CREATE TABLE legislation.legal_copy_validation_items (
  preparation_id text NOT NULL CHECK(preparation_id ~ '^[a-f0-9]{64}$'),
  ordinal integer NOT NULL CHECK(ordinal>=0),
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  inventory_hash text NOT NULL CHECK(inventory_hash ~ '^[a-f0-9]{64}$'),
  generation_id text NOT NULL CHECK(generation_id ~ '^[a-f0-9]{64}$'),
  metadata_hash text NOT NULL CHECK(metadata_hash ~ '^[a-f0-9]{64}$'),
  source_revision bigint NOT NULL CHECK(source_revision>=0),
  target_revision bigint NOT NULL CHECK(target_revision>=0),
  passage_count integer NOT NULL CHECK(passage_count>=0),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(preparation_id,ordinal)
);

-- Acknowledgement snapshots are independent of replaceable validation-page checkpoints.
CREATE TABLE legislation.legal_search_scope_revisions (
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  generation_id text NOT NULL CHECK(generation_id ~ '^[a-f0-9]{64}$'),
  source_revision bigint NOT NULL CHECK(source_revision>0),
  target_revision bigint NOT NULL CHECK(target_revision>0),
  PRIMARY KEY(scope_kind,scope_id,generation_id),
  FOREIGN KEY(scope_kind,scope_id) REFERENCES legislation.legal_search_scopes(scope_kind,scope_id) ON DELETE CASCADE
);
