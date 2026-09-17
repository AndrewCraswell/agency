-- Apply to the isolated search database. This does not modify the bill projection.
DO $$ BEGIN
  IF current_database() <> 'legislation_passage_search' THEN
    RAISE EXCEPTION 'Not the isolated passage search database';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS legislation;
CREATE EXTENSION IF NOT EXISTS vector;
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
  UNIQUE(generation_id,id),
  CHECK(body=data->>'text' AND input_text=data->>'inputText' AND ordinal=(data->>'ordinal')::integer)
);
CREATE INDEX legal_search_passages_text_idx ON legislation.legal_search_passages USING gin(search_vector);
CREATE TABLE legislation.legal_embedding_generations (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  passage_generation_id text NOT NULL REFERENCES legislation.legal_search_generations(id) ON DELETE CASCADE,
  model text NOT NULL,
  dimensions integer NOT NULL,
  input_contract text NOT NULL,
  manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
  expected_count integer NOT NULL CHECK(expected_count > 0),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','embedded','ready','blocked')),
  completed_at timestamptz,
  ready_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,model,dimensions),
  UNIQUE(id,passage_generation_id),
  UNIQUE(passage_generation_id,model,input_contract),
  CHECK((model='openai/text-embedding-3-small' AND dimensions=1536) OR (model='voyageai/voyage-4' AND dimensions=1024)),
  CHECK((completed_at IS NOT NULL)=(state IN ('embedded','ready'))),
  CHECK((ready_at IS NOT NULL)=(state='ready')),
  CHECK((last_error IS NOT NULL)=(state='blocked'))
);
CREATE INDEX legal_embedding_generations_state_idx ON legislation.legal_embedding_generations(state,created_at,id);
CREATE TABLE legislation.legal_openai_small_embeddings (
  generation_id text NOT NULL,
  passage_generation_id text NOT NULL,
  passage_id text NOT NULL,
  model text NOT NULL DEFAULT 'openai/text-embedding-3-small' CHECK(model='openai/text-embedding-3-small'),
  dimensions integer NOT NULL DEFAULT 1536 CHECK(dimensions=1536),
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  vector_hash text NOT NULL CHECK(vector_hash ~ '^[a-f0-9]{64}$'),
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(generation_id,passage_id),
  FOREIGN KEY(generation_id,model,dimensions) REFERENCES legislation.legal_embedding_generations(id,model,dimensions) ON DELETE CASCADE,
  FOREIGN KEY(generation_id,passage_generation_id) REFERENCES legislation.legal_embedding_generations(id,passage_generation_id) ON DELETE CASCADE,
  FOREIGN KEY(passage_generation_id,passage_id) REFERENCES legislation.legal_search_passages(generation_id,id) ON DELETE CASCADE
);
CREATE INDEX legal_openai_small_embeddings_passage_idx ON legislation.legal_openai_small_embeddings(passage_id,generation_id);
CREATE TABLE legislation.legal_voyage_4_embeddings (
  generation_id text NOT NULL,
  passage_generation_id text NOT NULL,
  passage_id text NOT NULL,
  model text NOT NULL DEFAULT 'voyageai/voyage-4' CHECK(model='voyageai/voyage-4'),
  dimensions integer NOT NULL DEFAULT 1024 CHECK(dimensions=1024),
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  vector_hash text NOT NULL CHECK(vector_hash ~ '^[a-f0-9]{64}$'),
  embedding vector(1024) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(generation_id,passage_id),
  FOREIGN KEY(generation_id,model,dimensions) REFERENCES legislation.legal_embedding_generations(id,model,dimensions) ON DELETE CASCADE,
  FOREIGN KEY(generation_id,passage_generation_id) REFERENCES legislation.legal_embedding_generations(id,passage_generation_id) ON DELETE CASCADE,
  FOREIGN KEY(passage_generation_id,passage_id) REFERENCES legislation.legal_search_passages(generation_id,id) ON DELETE CASCADE
);
CREATE INDEX legal_voyage_4_embeddings_passage_idx ON legislation.legal_voyage_4_embeddings(passage_id,generation_id);
CREATE TABLE legislation.legal_embedding_shards (
  generation_id text NOT NULL REFERENCES legislation.legal_embedding_generations(id) ON DELETE CASCADE,
  shard_count integer NOT NULL CHECK(shard_count=16),
  shard_index integer NOT NULL CHECK(shard_index>=0 AND shard_index<shard_count),
  cursor_passage_id text CHECK(cursor_passage_id IS NULL OR cursor_passage_id ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete','blocked')),
  fence integer NOT NULL DEFAULT 0 CHECK(fence>=0),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  last_attempt_state text NOT NULL DEFAULT 'idle' CHECK(last_attempt_state IN ('idle','requesting')),
  possible_repeated_paid_attempts integer NOT NULL DEFAULT 0 CHECK(possible_repeated_paid_attempts>=0),
  provider_prompt_tokens bigint NOT NULL DEFAULT 0 CHECK(provider_prompt_tokens>=0),
  provider_total_tokens bigint NOT NULL DEFAULT 0 CHECK(provider_total_tokens>=0),
  inserted_vectors integer NOT NULL DEFAULT 0 CHECK(inserted_vectors>=0),
  reused_vectors integer NOT NULL DEFAULT 0 CHECK(reused_vectors>=0),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(generation_id,shard_count,shard_index),
  CHECK((lease_token IS NULL)=(lease_expires_at IS NULL)),
  CHECK(state<>'complete' OR (lease_token IS NULL AND last_attempt_state='idle'))
);
CREATE INDEX legal_embedding_shards_pending_idx
  ON legislation.legal_embedding_shards(generation_id,shard_index) WHERE state='pending';
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
