SET LOCAL lock_timeout = '1s';
--> statement-breakpoint
CREATE TABLE legislation.legal_rights_profiles (
  id text PRIMARY KEY,
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  policy jsonb NOT NULL CHECK (jsonb_typeof(policy) = 'object'),
  is_active boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE TABLE legislation.legal_sources (
  id text PRIMARY KEY,
  publisher text NOT NULL,
  authority text NOT NULL CHECK (authority IN ('official', 'licensed'))
);
--> statement-breakpoint
CREATE TABLE legislation.legal_import_manifests (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE TABLE legislation.legal_artifacts (
  hash text PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
  bytes bigint NOT NULL CHECK (bytes > 0),
  storage_locator text NOT NULL,
  acquired_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE legislation.legal_import_generations (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  manifest_id text NOT NULL REFERENCES legislation.legal_import_manifests(id),
  unit_key text NOT NULL,
  source_id text NOT NULL REFERENCES legislation.legal_sources(id),
  jurisdiction_id text NOT NULL REFERENCES legislation.jurisdictions(id),
  rights_profile_id text NOT NULL REFERENCES legislation.legal_rights_profiles(id),
  artifact_hash text NOT NULL REFERENCES legislation.legal_artifacts(hash),
  parser_hash text NOT NULL,
  contract text NOT NULL,
  unit jsonb NOT NULL,
  summary jsonb NOT NULL,
  expected_records integer NOT NULL CHECK (expected_records > 0 OR (expected_records = 0 AND contract = 'fr-html-import-2026-09-14')),
  state text NOT NULL DEFAULT 'staging' CHECK (state IN ('staging','validated','materialized','published','blocked')),
  blocked_reason text,
  fence integer NOT NULL DEFAULT 0 CHECK (fence >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,source_id,jurisdiction_id,rights_profile_id),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX legal_import_generations_work_idx ON legislation.legal_import_generations(state,lease_expires_at,id);
--> statement-breakpoint
CREATE TABLE legislation.legal_import_records (
  generation_id text NOT NULL REFERENCES legislation.legal_import_generations(id),
  record_key text NOT NULL,
  native_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  parent_key text,
  node_kind text NOT NULL,
  source_locator text NOT NULL,
  identity_key text NOT NULL,
  payload_bytes integer NOT NULL CHECK (payload_bytes > 0 AND payload_bytes <= 67108864),
  record_hash text NOT NULL CHECK (record_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL,
  PRIMARY KEY(generation_id,record_key),
  UNIQUE(generation_id,native_id),
  UNIQUE(generation_id,ordinal)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id text NOT NULL REFERENCES legislation.jurisdictions(id),
  code_key text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('regulation','statute')),
  UNIQUE(jurisdiction_id,code_key),
  UNIQUE(id,jurisdiction_id)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL,
  jurisdiction_id text NOT NULL,
  source_id text NOT NULL,
  generation_id text NOT NULL UNIQUE,
  rights_profile_id text NOT NULL,
  native_key text NOT NULL,
  source_revision text NOT NULL,
  issue_date date,
  currency_date date,
  published_at timestamptz,
  FOREIGN KEY(code_id,jurisdiction_id) REFERENCES legislation.legal_codes(id,jurisdiction_id),
  FOREIGN KEY(generation_id,source_id,jurisdiction_id,rights_profile_id)
    REFERENCES legislation.legal_import_generations(id,source_id,jurisdiction_id,rights_profile_id),
  UNIQUE(id,code_id),
  UNIQUE(id,code_id,source_id)
);
--> statement-breakpoint
CREATE INDEX legal_editions_source_idx ON legislation.legal_editions(code_id,source_id,issue_date,id);
--> statement-breakpoint
CREATE TABLE legislation.legal_annual_editions (
  id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  manifest_id text NOT NULL REFERENCES legislation.legal_import_manifests(id),
  code_id uuid NOT NULL REFERENCES legislation.legal_codes(id),
  package_year integer NOT NULL CHECK(package_year BETWEEN 1996 AND 9999),
  revision_date date NOT NULL,
  expected_volumes integer NOT NULL CHECK(expected_volumes BETWEEN 1 AND 200),
  coverage jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,code_id),
  UNIQUE(manifest_id,code_id,package_year)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_annual_edition_volumes (
  annual_edition_id text NOT NULL,
  code_id uuid NOT NULL,
  volume integer NOT NULL CHECK(volume > 0),
  edition_id uuid NOT NULL,
  PRIMARY KEY(annual_edition_id,volume),
  UNIQUE(annual_edition_id,edition_id),
  FOREIGN KEY(annual_edition_id,code_id) REFERENCES legislation.legal_annual_editions(id,code_id),
  FOREIGN KEY(edition_id,code_id) REFERENCES legislation.legal_editions(id,code_id)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES legislation.legal_codes(id),
  identity_key text NOT NULL,
  identity_basis text NOT NULL,
  UNIQUE(code_id,identity_key),
  UNIQUE(id,code_id)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_provision_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_id uuid NOT NULL,
  code_id uuid NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  input_contract text NOT NULL,
  heading text NOT NULL,
  body text NOT NULL,
  node_kind text NOT NULL,
  blocks jsonb NOT NULL,
  language text NOT NULL,
  FOREIGN KEY(provision_id,code_id) REFERENCES legislation.legal_provisions(id,code_id),
  UNIQUE(provision_id,content_hash,input_contract),
  UNIQUE(id,provision_id,code_id)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_edition_provisions (
  edition_id uuid NOT NULL,
  code_id uuid NOT NULL,
  provision_id uuid NOT NULL,
  version_id uuid NOT NULL,
  parent_id uuid,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  source_locator text NOT NULL,
  source_attributes jsonb NOT NULL,
  native_id text NOT NULL,
  PRIMARY KEY(edition_id,provision_id),
  UNIQUE(edition_id,ordinal),
  FOREIGN KEY(edition_id,code_id) REFERENCES legislation.legal_editions(id,code_id),
  FOREIGN KEY(version_id,provision_id,code_id) REFERENCES legislation.legal_provision_versions(id,provision_id,code_id),
  FOREIGN KEY(edition_id,parent_id) REFERENCES legislation.legal_edition_provisions(edition_id,provision_id),
  CHECK (parent_id IS DISTINCT FROM provision_id)
);
--> statement-breakpoint
CREATE INDEX legal_edition_provisions_version_idx ON legislation.legal_edition_provisions(version_id);
--> statement-breakpoint
CREATE INDEX legal_edition_provisions_parent_idx ON legislation.legal_edition_provisions(edition_id,parent_id,ordinal);
--> statement-breakpoint
CREATE TABLE legislation.legal_code_heads (
  code_id uuid NOT NULL,
  source_id text NOT NULL,
  edition_id uuid NOT NULL,
  PRIMARY KEY(code_id,source_id),
  FOREIGN KEY(edition_id,code_id,source_id) REFERENCES legislation.legal_editions(id,code_id,source_id)
);
--> statement-breakpoint
CREATE TABLE legislation.legal_derived_outbox (
  id bigserial PRIMARY KEY,
  edition_id uuid NOT NULL REFERENCES legislation.legal_editions(id),
  operation text NOT NULL CHECK (operation IN ('lexical','embedding','event')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','acknowledged')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(edition_id,operation)
);
--> statement-breakpoint
CREATE INDEX legal_derived_outbox_retry_idx ON legislation.legal_derived_outbox(state,retry_at,id);
--> statement-breakpoint
CREATE TABLE legislation.regulatory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id text NOT NULL REFERENCES legislation.jurisdictions(id),
  identity_namespace text NOT NULL,
  native_number text NOT NULL,
  UNIQUE(jurisdiction_id,identity_namespace,native_number)
);
--> statement-breakpoint
CREATE TABLE legislation.regulatory_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES legislation.regulatory_documents(id),
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  input_contract text NOT NULL,
  pdf_hash text NOT NULL REFERENCES legislation.legal_artifacts(hash),
  heading text NOT NULL,
  body text NOT NULL,
  blocks jsonb NOT NULL CHECK(jsonb_typeof(blocks)='array'),
  publication_kind text NOT NULL CHECK(publication_kind IN ('final_rule','proposed_rule','notice','other')),
  UNIQUE(document_id,content_hash,input_contract,pdf_hash),
  UNIQUE(id,document_id)
);
--> statement-breakpoint
CREATE TABLE legislation.regulatory_publication_batches (
  generation_id text PRIMARY KEY REFERENCES legislation.legal_import_generations(id),
  metadata_manifest_id text NOT NULL CHECK(metadata_manifest_id ~ '^[a-f0-9]{64}$'),
  metadata_manifest jsonb NOT NULL,
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  reconciliation jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE TABLE legislation.regulatory_document_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id text NOT NULL REFERENCES legislation.regulatory_publication_batches(generation_id),
  document_id uuid NOT NULL REFERENCES legislation.regulatory_documents(id),
  version_id uuid NOT NULL,
  source_id text NOT NULL,
  jurisdiction_id text NOT NULL,
  rights_profile_id text NOT NULL,
  publication_date date NOT NULL,
  metadata jsonb NOT NULL,
  source_locator text NOT NULL,
  pdf_receipt jsonb NOT NULL,
  pdf_inspection jsonb NOT NULL,
  FOREIGN KEY(version_id,document_id) REFERENCES legislation.regulatory_document_versions(id,document_id),
  FOREIGN KEY(generation_id,source_id,jurisdiction_id,rights_profile_id)
    REFERENCES legislation.legal_import_generations(id,source_id,jurisdiction_id,rights_profile_id),
  UNIQUE(generation_id,document_id)
);
--> statement-breakpoint
CREATE INDEX regulatory_document_observations_browse_idx ON legislation.regulatory_document_observations(publication_date,id);
--> statement-breakpoint
CREATE INDEX regulatory_document_observations_version_idx ON legislation.regulatory_document_observations(version_id);
--> statement-breakpoint
CREATE TABLE legislation.regulatory_publication_outbox (
  id bigserial PRIMARY KEY,
  observation_id uuid NOT NULL UNIQUE REFERENCES legislation.regulatory_document_observations(id),
  operation text NOT NULL CHECK(operation='lexical'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','acknowledged')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE INDEX regulatory_publication_outbox_retry_idx ON legislation.regulatory_publication_outbox(state,retry_at,id);
--> statement-breakpoint
CREATE TABLE legislation.legal_passage_generations (
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
CREATE INDEX legal_passage_generations_provision_idx ON legislation.legal_passage_generations(provision_version_id,id);
--> statement-breakpoint
CREATE INDEX legal_passage_generations_document_idx ON legislation.legal_passage_generations(document_version_id,id);
--> statement-breakpoint
CREATE TABLE legislation.legal_passages (
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
CREATE INDEX legal_passages_search_idx ON legislation.legal_passages USING gin(search_vector);
--> statement-breakpoint
CREATE TABLE legislation.legal_passage_preparations (
  id text PRIMARY KEY,
  edition_id uuid REFERENCES legislation.legal_editions(id),
  observation_id uuid REFERENCES legislation.regulatory_document_observations(id),
  tokenizer_id text NOT NULL,
  inventory_hash text NOT NULL,
  expected_count integer NOT NULL CHECK(expected_count > 0),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','prepared')),
  fence integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error text,
  CHECK(num_nonnulls(edition_id,observation_id)=1),
  CHECK((lease_token IS NULL)=(lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE TABLE legislation.legal_passage_preparation_items (
  preparation_id text NOT NULL REFERENCES legislation.legal_passage_preparations(id),
  ordinal integer NOT NULL,
  version_id uuid NOT NULL,
  context text NOT NULL,
  generation_id text REFERENCES legislation.legal_passage_generations(id),
  PRIMARY KEY(preparation_id,ordinal),
  UNIQUE(preparation_id,version_id)
);
--> statement-breakpoint
CREATE INDEX legal_passage_preparation_pending_idx ON legislation.legal_passage_preparation_items(preparation_id,ordinal) WHERE generation_id IS NULL;
