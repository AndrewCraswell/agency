-- Converge databases that recorded the original 0048 migration before later regulatory objects were added to that file.
-- Every creation is idempotent so freshly provisioned databases that already received the expanded 0048 remain unchanged.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE legislation.legal_import_generations DROP CONSTRAINT IF EXISTS legal_import_generations_state_check;
--> statement-breakpoint
ALTER TABLE legislation.legal_import_generations ADD CONSTRAINT legal_import_generations_state_check
  CHECK(state IN ('staging','validated','materialized','published','blocked','observed')) NOT VALID;
--> statement-breakpoint
ALTER TABLE legislation.legal_import_generations VALIDATE CONSTRAINT legal_import_generations_state_check;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_discovery_checkpoints (
  source_id text NOT NULL REFERENCES legislation.legal_sources(id),
  scope_key text NOT NULL CHECK(scope_key ~ '^[a-f0-9]{64}$'),
  query_hash text NOT NULL CHECK(query_hash ~ '^[a-f0-9]{64}$'),
  query jsonb NOT NULL CHECK(jsonb_typeof(query)='object'),
  committed_cursor jsonb,
  window_started_at timestamptz,
  window_ended_at timestamptz,
  overlap_started_at timestamptz,
  source_cutoff jsonb,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_page_id text CHECK(last_page_id IS NULL OR last_page_id ~ '^[a-f0-9]{64}$'),
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(source_id,scope_key),
  CHECK((window_started_at IS NULL)=(window_ended_at IS NULL)),
  CHECK(window_started_at IS NULL OR window_started_at<=window_ended_at),
  CHECK(overlap_started_at IS NULL OR window_started_at IS NULL OR overlap_started_at<=window_started_at)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_discovery_pages (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  source_id text NOT NULL,
  scope_key text NOT NULL,
  expected_revision bigint NOT NULL CHECK(expected_revision>=0),
  expected_cursor jsonb,
  next_cursor jsonb,
  unit_count integer NOT NULL CHECK(unit_count BETWEEN 0 AND 100),
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(source_id,scope_key) REFERENCES legislation.legal_discovery_checkpoints(source_id,scope_key),
  UNIQUE(source_id,scope_key,expected_revision)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_discovery_units (
  source_id text NOT NULL,
  scope_key text NOT NULL,
  unit_key text NOT NULL CHECK(unit_key ~ '^[a-f0-9]{64}$'),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  unit jsonb NOT NULL CHECK(jsonb_typeof(unit)='object'),
  manifest_id text,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','registered','acquired','parsed','published','quarantined')),
  discovered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  registered_at timestamptz,
  artifact_hash text CHECK(artifact_hash IS NULL OR artifact_hash ~ '^[a-f0-9]{64}$'),
  artifact_bytes bigint CHECK(artifact_bytes IS NULL OR artifact_bytes>0),
  storage_locator text,
  acquisition_receipt jsonb,
  acquired_at timestamptz,
  parser_hash text CHECK(parser_hash IS NULL OR parser_hash ~ '^[a-f0-9]{64}$'),
  normalized_generation text CHECK(normalized_generation IS NULL OR normalized_generation ~ '^[a-f0-9]{64}$'),
  normalized_locator text,
  parse_summary jsonb,
  parsed_at timestamptz,
  publication_generation_id text,
  edition_id uuid,
  published_at timestamptz,
  PRIMARY KEY(source_id,scope_key,unit_key),
  FOREIGN KEY(source_id,scope_key) REFERENCES legislation.legal_discovery_checkpoints(source_id,scope_key),
  CHECK(
    (state='pending' AND registered_at IS NULL) OR
    (state IN ('registered','acquired','parsed','published') AND registered_at IS NOT NULL) OR
    state='quarantined'
  ),
  CHECK(
    (state='pending' AND manifest_id IS NULL) OR
    (state IN ('registered','acquired','parsed','published') AND manifest_id IS NOT NULL) OR
    state='quarantined'
  ),
  CHECK(
    (state IN ('acquired','parsed','published'))=(artifact_hash IS NOT NULL AND artifact_bytes IS NOT NULL AND storage_locator IS NOT NULL AND
      acquisition_receipt IS NOT NULL AND acquired_at IS NOT NULL)
  ),
  CHECK(
    (state IN ('parsed','published'))=(parser_hash IS NOT NULL AND normalized_generation IS NOT NULL AND normalized_locator IS NOT NULL AND
      parse_summary IS NOT NULL AND parsed_at IS NOT NULL)
  ),
  CHECK(
    (state='published')=(publication_generation_id IS NOT NULL AND edition_id IS NOT NULL AND published_at IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_discovery_units_pending_idx ON legislation.legal_discovery_units(source_id,scope_key,discovered_at,unit_key)
  WHERE state='pending';
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='legal_discovery_units_manifest_fk' AND conrelid='legislation.legal_discovery_units'::regclass) THEN
    ALTER TABLE legislation.legal_discovery_units ADD CONSTRAINT legal_discovery_units_manifest_fk
  FOREIGN KEY(manifest_id) REFERENCES legislation.legal_import_manifests(id);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_discovery_dispatches (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  source_id text NOT NULL,
  scope_key text NOT NULL,
  unit_key text NOT NULL,
  manifest_id text NOT NULL REFERENCES legislation.legal_import_manifests(id),
  stage text NOT NULL CHECK(stage IN ('acquisition','parsing','publication')),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','submitting','submitted')),
  attempt integer NOT NULL DEFAULT 0 CHECK(attempt>=0),
  first_attempt_at timestamptz,
  run_id text,
  run_history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(run_history)='array'),
  last_observed_status text,
  last_observed_at timestamptz,
  completed_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(source_id,scope_key,unit_key)
    REFERENCES legislation.legal_discovery_units(source_id,scope_key,unit_key),
  UNIQUE(manifest_id,unit_key,stage),
  CHECK((lease_token IS NULL)=(lease_expires_at IS NULL)),
  CHECK((state='submitted')=(run_id IS NOT NULL)),
  CHECK(state='pending' OR first_attempt_at IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_discovery_dispatches_pending_idx ON legislation.legal_discovery_dispatches(created_at,id)
  WHERE state<>'submitted';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_discovery_dispatches_recovery_idx
  ON legislation.legal_discovery_dispatches(source_id,scope_key,id)
  WHERE completed_at IS NULL AND state IN ('submitting','submitted');
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='legal_discovery_units_artifact_fk' AND conrelid='legislation.legal_discovery_units'::regclass) THEN
    ALTER TABLE legislation.legal_discovery_units ADD CONSTRAINT legal_discovery_units_artifact_fk
  FOREIGN KEY(artifact_hash) REFERENCES legislation.legal_artifacts(hash);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_import_generations_work_idx ON legislation.legal_import_generations(state,lease_expires_at,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_import_generations_annual_anchor_idx ON legislation.legal_import_generations
  (artifact_hash,parser_hash,(unit->>'nativeId')) WHERE source_id='govinfo-cfr' AND state='published';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_editions_source_idx ON legislation.legal_editions(code_id,source_id,issue_date,id);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='legal_discovery_units_publication_generation_fk' AND conrelid='legislation.legal_discovery_units'::regclass) THEN
    ALTER TABLE legislation.legal_discovery_units ADD CONSTRAINT legal_discovery_units_publication_generation_fk
  FOREIGN KEY(publication_generation_id) REFERENCES legislation.legal_import_generations(id);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='legal_discovery_units_edition_fk' AND conrelid='legislation.legal_discovery_units'::regclass) THEN
    ALTER TABLE legislation.legal_discovery_units ADD CONSTRAINT legal_discovery_units_edition_fk
  FOREIGN KEY(edition_id) REFERENCES legislation.legal_editions(id);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_annual_source_observations (
  generation_id text PRIMARY KEY REFERENCES legislation.legal_import_generations(id),
  anchor_edition_id uuid NOT NULL REFERENCES legislation.legal_editions(id),
  package_year integer NOT NULL CHECK(package_year BETWEEN 1996 AND 9999),
  revision_date date NOT NULL,
  disposition text NOT NULL CHECK(disposition = 'duplicate_revision'),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(package_year > extract(year FROM revision_date))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_annual_source_observations_anchor_idx ON legislation.legal_annual_source_observations(anchor_edition_id,generation_id);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='legal_edition_provisions_edition_id_version_id_key'
      AND conrelid='legislation.legal_edition_provisions'::regclass
  ) THEN
    ALTER TABLE legislation.legal_edition_provisions
      ADD CONSTRAINT legal_edition_provisions_edition_id_version_id_key UNIQUE(edition_id,version_id);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_provision_source_reviews (
  edition_id uuid NOT NULL,
  version_id uuid NOT NULL,
  table_index integer NOT NULL CHECK (table_index >= 0),
  block_hash text NOT NULL CHECK (block_hash ~ '^[a-f0-9]{64}$'),
  review_hash text NOT NULL CHECK (review_hash ~ '^[a-f0-9]{64}$'),
  disposition text NOT NULL CHECK (disposition IN ('accepted_context','quarantined_source_gap','non_data_table')),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(edition_id,version_id,table_index),
  FOREIGN KEY(edition_id,version_id) REFERENCES legislation.legal_edition_provisions(edition_id,version_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_edition_provisions_children_idx
  ON legislation.legal_edition_provisions(edition_id,parent_id,ordinal);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.regulatory_source_inventories (
  generation_id text PRIMARY KEY REFERENCES legislation.legal_import_generations(id),
  metadata_manifest_id text NOT NULL CHECK(metadata_manifest_id ~ '^[a-f0-9]{64}$'),
  metadata_manifest jsonb NOT NULL,
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  coverage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.regulatory_source_documents (
  generation_id text NOT NULL REFERENCES legislation.regulatory_source_inventories(generation_id),
  record_key text NOT NULL,
  document_id uuid NOT NULL REFERENCES legislation.regulatory_documents(id),
  source_observation_key text NOT NULL CHECK(source_observation_key ~ '^[a-f0-9]{64}$'),
  publisher_number text NOT NULL,
  publication_date date NOT NULL,
  citation_key text,
  metadata_status text NOT NULL CHECK(metadata_status IN ('candidate','missing','ambiguous','conflict')),
  evidence jsonb NOT NULL,
  PRIMARY KEY(generation_id,record_key),
  UNIQUE(generation_id,source_observation_key),
  FOREIGN KEY(generation_id,record_key) REFERENCES legislation.legal_import_records(generation_id,record_key)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS regulatory_source_documents_number_idx ON legislation.regulatory_source_documents(publication_date,publisher_number,document_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.regulatory_source_reviews (
  generation_id text NOT NULL,
  record_key text NOT NULL,
  review_hash text NOT NULL CHECK(review_hash ~ '^[a-f0-9]{64}$'),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(generation_id,record_key),
  FOREIGN KEY(generation_id,record_key) REFERENCES legislation.regulatory_source_documents(generation_id,record_key)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.regulatory_source_renditions (
  generation_id text NOT NULL,
  record_key text NOT NULL,
  evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(generation_id,record_key),
  FOREIGN KEY(generation_id,record_key) REFERENCES legislation.regulatory_source_documents(generation_id,record_key)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS regulatory_document_observations_browse_idx ON legislation.regulatory_document_observations(publication_date,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS regulatory_document_observations_version_idx ON legislation.regulatory_document_observations(version_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_passage_generations (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  provision_version_id uuid REFERENCES legislation.legal_provision_versions(id),
  document_version_id uuid REFERENCES legislation.regulatory_document_versions(id),
  contract text NOT NULL,
  body_hash text NOT NULL CHECK(body_hash ~ '^[a-f0-9]{64}$'),
  tokenizer_id text NOT NULL,
  context text NOT NULL,
  manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
  passage_count integer NOT NULL CHECK(passage_count >= 0),
  eligibility text NOT NULL CHECK(eligibility IN ('eligible','empty_text')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(num_nonnulls(provision_version_id,document_version_id)=1),
  CHECK((passage_count=0)=(eligibility='empty_text'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_passage_generations_provision_idx ON legislation.legal_passage_generations(provision_version_id,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_passage_generations_document_idx ON legislation.legal_passage_generations(document_version_id,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_passages (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  generation_id text NOT NULL REFERENCES legislation.legal_passage_generations(id),
  ordinal integer NOT NULL CHECK(ordinal >= 0),
  body text NOT NULL,
  input_text text NOT NULL,
  data jsonb NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig,input_text)) STORED,
  UNIQUE(generation_id,ordinal),
  CHECK(body=data->>'text' AND input_text=data->>'inputText' AND ordinal=(data->>'ordinal')::integer)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_passages_search_idx ON legislation.legal_passages USING gin(search_vector);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_passage_preparations (
  id text PRIMARY KEY,
  edition_id uuid REFERENCES legislation.legal_editions(id),
  observation_id uuid REFERENCES legislation.regulatory_document_observations(id),
  tokenizer_id text NOT NULL,
  inventory_hash text NOT NULL,
  expected_count integer NOT NULL CHECK(expected_count > 0),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','prepared','blocked')),
  fence integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error text,
  CHECK(num_nonnulls(edition_id,observation_id)=1),
  CHECK((lease_token IS NULL)=(lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_passage_preparation_items (
  preparation_id text NOT NULL REFERENCES legislation.legal_passage_preparations(id),
  ordinal integer NOT NULL,
  version_id uuid NOT NULL,
  context text NOT NULL,
  generation_id text REFERENCES legislation.legal_passage_generations(id),
  failure_code text CHECK(failure_code ~ '^[a-z_]+$'),
  failed_at timestamptz,
  CHECK((failure_code IS NULL)=(failed_at IS NULL)),
  CHECK(generation_id IS NULL OR failure_code IS NULL),
  PRIMARY KEY(preparation_id,ordinal),
  UNIQUE(preparation_id,version_id)
);
--> statement-breakpoint
ALTER TABLE legislation.legal_passage_preparation_items ADD COLUMN IF NOT EXISTS failure_code text;
--> statement-breakpoint
ALTER TABLE legislation.legal_passage_preparation_items ADD COLUMN IF NOT EXISTS failed_at timestamptz;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='legislation.legal_passage_preparation_items'::regclass
      AND conname IN ('legal_passage_preparation_items_failure_code_check','legal_passage_preparation_items_convergence_failure_code_check')
  ) THEN
    ALTER TABLE legislation.legal_passage_preparation_items
      ADD CONSTRAINT legal_passage_preparation_items_convergence_failure_code_check
      CHECK(failure_code ~ '^[a-z_]+$');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='legislation.legal_passage_preparation_items'::regclass
      AND conname IN ('legal_passage_preparation_items_check','legal_passage_preparation_items_convergence_failure_pair_check')
  ) THEN
    ALTER TABLE legislation.legal_passage_preparation_items
      ADD CONSTRAINT legal_passage_preparation_items_convergence_failure_pair_check
      CHECK((failure_code IS NULL)=(failed_at IS NULL));
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='legislation.legal_passage_preparation_items'::regclass
      AND conname IN ('legal_passage_preparation_items_check1','legal_passage_preparation_items_convergence_generation_failure_check')
  ) THEN
    ALTER TABLE legislation.legal_passage_preparation_items
      ADD CONSTRAINT legal_passage_preparation_items_convergence_generation_failure_check
      CHECK(generation_id IS NULL OR failure_code IS NULL);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_passage_preparation_pending_idx ON legislation.legal_passage_preparation_items(preparation_id,ordinal) WHERE generation_id IS NULL AND failure_code IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_preparation_dispatches (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  wave_id uuid NOT NULL,
  scope_kind text NOT NULL CHECK(scope_kind IN ('edition','publication')),
  scope_id uuid NOT NULL,
  model text NOT NULL CHECK(model IN ('openai/text-embedding-3-small','voyageai/voyage-4')),
  preparation_id text NOT NULL CHECK(preparation_id ~ '^[a-f0-9]{64}$'),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','submitting','submitted')),
  attempt integer NOT NULL DEFAULT 0 CHECK(attempt>=0),
  first_attempt_at timestamptz,
  run_id text,
  run_history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(run_history)='array'),
  last_observed_status text,
  last_observed_at timestamptz,
  completed_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(wave_id,scope_kind,scope_id,model),
  CHECK((lease_token IS NULL)=(lease_expires_at IS NULL)),
  CHECK((state='submitted')=(run_id IS NOT NULL)),
  CHECK(state='pending' OR first_attempt_at IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_preparation_dispatches_pending_idx ON legislation.legal_preparation_dispatches(created_at,id)
  WHERE state<>'submitted';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_preparation_dispatches_wave_idx ON legislation.legal_preparation_dispatches(wave_id,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_preparation_dispatches_preparation_idx
  ON legislation.legal_preparation_dispatches(preparation_id,wave_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_preparation_dispatches_recovery_idx ON legislation.legal_preparation_dispatches(wave_id,id)
  WHERE completed_at IS NULL AND state IN ('submitting','submitted');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_preparation_plans (
  wave_id uuid PRIMARY KEY,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'),
  after_id uuid,
  exhausted boolean NOT NULL DEFAULT false,
  selected_count integer NOT NULL DEFAULT 0 CHECK(selected_count>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS legal_editions_preparation_selection_idx ON legislation.legal_editions(source_id,id)
  INCLUDE(published_at) WHERE jurisdiction_id='jurisdiction:us' AND published_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS regulatory_observations_preparation_selection_idx
  ON legislation.regulatory_document_observations(source_id,id) INCLUDE(generation_id)
  WHERE jurisdiction_id='jurisdiction:us';
--> statement-breakpoint
-- Retain tombstones: deleting and recreating a generation must not reuse its verification revision.
CREATE TABLE IF NOT EXISTS legislation.legal_copy_revisions (
  generation_id text PRIMARY KEY CHECK(generation_id ~ '^[a-f0-9]{64}$'),
  revision bigint NOT NULL CHECK(revision>0)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION legislation.advance_legal_copy_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_id text; next_id text;
BEGIN
  IF TG_OP='TRUNCATE' THEN
    UPDATE legislation.legal_copy_revisions SET revision=revision+1;
    RETURN NULL;
  END IF;
  IF TG_OP<>'INSERT' THEN previous_id=to_jsonb(OLD)->>TG_ARGV[0]; END IF;
  IF TG_OP<>'DELETE' THEN next_id=to_jsonb(NEW)->>TG_ARGV[0]; END IF;
  IF TG_ARGV[0]='version' THEN
    previous_id=NULL; next_id=NULL;
    IF TG_OP<>'INSERT' THEN previous_id=OLD.id::text; END IF;
    IF TG_OP<>'DELETE' THEN next_id=NEW.id::text; END IF;
    INSERT INTO legislation.legal_copy_revisions(generation_id,revision)
    SELECT id,1 FROM legislation.legal_passage_generations
    WHERE (TG_TABLE_NAME='legal_provision_versions' AND provision_version_id IN (previous_id::uuid,next_id::uuid))
       OR (TG_TABLE_NAME='regulatory_document_versions' AND document_version_id IN (previous_id::uuid,next_id::uuid))
    ORDER BY id
    ON CONFLICT(generation_id) DO UPDATE SET revision=legislation.legal_copy_revisions.revision+1;
  ELSE
    INSERT INTO legislation.legal_copy_revisions(generation_id,revision)
    SELECT DISTINCT id,1 FROM unnest(ARRAY[previous_id,next_id]) AS changed(id) WHERE id IS NOT NULL ORDER BY id
    ON CONFLICT(generation_id) DO UPDATE SET revision=legislation.legal_copy_revisions.revision+1;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_generation_revision ON legislation.legal_passage_generations;
CREATE TRIGGER legal_copy_generation_revision AFTER INSERT OR UPDATE OR DELETE ON legislation.legal_passage_generations
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_passage_revision ON legislation.legal_passages;
CREATE TRIGGER legal_copy_passage_revision AFTER INSERT OR UPDATE OR DELETE ON legislation.legal_passages
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_provision_revision ON legislation.legal_provision_versions;
CREATE TRIGGER legal_copy_provision_revision AFTER UPDATE OR DELETE ON legislation.legal_provision_versions
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('version');
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_publication_revision ON legislation.regulatory_document_versions;
CREATE TRIGGER legal_copy_publication_revision AFTER UPDATE OR DELETE ON legislation.regulatory_document_versions
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('version');
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_generation_truncate ON legislation.legal_passage_generations;
CREATE TRIGGER legal_copy_generation_truncate AFTER TRUNCATE ON legislation.legal_passage_generations
  FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_passage_truncate ON legislation.legal_passages;
CREATE TRIGGER legal_copy_passage_truncate AFTER TRUNCATE ON legislation.legal_passages
  FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION legislation.legal_passage_source_hash(body text,heading text,blocks jsonb,input_contract text)
RETURNS text LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object('body',body,'heading',heading,'blocks',blocks,'input_contract',input_contract)::text,'UTF8')),'hex')
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS legislation.legal_passage_source_provenance (
  generation_id text PRIMARY KEY REFERENCES legislation.legal_passage_generations(id) ON DELETE CASCADE,
  source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
INSERT INTO legislation.legal_passage_source_provenance(generation_id,source_hash)
SELECT generation.id,
  legislation.legal_passage_source_hash(version.body,version.heading,version.blocks,version.input_contract)
FROM legislation.legal_passage_generations generation
JOIN legislation.legal_provision_versions version ON version.id=generation.provision_version_id
ON CONFLICT(generation_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO legislation.legal_passage_source_provenance(generation_id,source_hash)
SELECT generation.id,
  legislation.legal_passage_source_hash(version.body,version.heading,version.blocks,version.input_contract)
FROM legislation.legal_passage_generations generation
JOIN legislation.regulatory_document_versions version ON version.id=generation.document_version_id
ON CONFLICT(generation_id) DO NOTHING;
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_provenance_revision ON legislation.legal_passage_source_provenance;
CREATE TRIGGER legal_copy_provenance_revision AFTER INSERT OR UPDATE OR DELETE ON legislation.legal_passage_source_provenance
  FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS legal_copy_provenance_truncate ON legislation.legal_passage_source_provenance;
CREATE TRIGGER legal_copy_provenance_truncate AFTER TRUNCATE ON legislation.legal_passage_source_provenance
  FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');
