DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid='legislation.legal_discovery_units'::regclass
    AND contype='c'
    AND pg_get_constraintdef(oid) LIKE '%publication_generation_id%'
    AND pg_get_constraintdef(oid) LIKE '%edition_id%'
    AND pg_get_constraintdef(oid) LIKE '%published_at%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE legislation.legal_discovery_units DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE legislation.legal_discovery_units
  ADD CONSTRAINT legal_discovery_units_published_check CHECK(
    (state='published')=(publication_generation_id IS NOT NULL AND published_at IS NOT NULL AND
      ((source_id='govinfo-fr' AND edition_id IS NULL) OR (source_id<>'govinfo-fr' AND edition_id IS NOT NULL)))
  );
--> statement-breakpoint
CREATE TABLE legislation.legal_fr_issue_preparations (
  source_id text NOT NULL DEFAULT 'govinfo-fr' CHECK(source_id='govinfo-fr'),
  scope_key text NOT NULL,
  unit_key text NOT NULL CHECK(unit_key ~ '^[a-f0-9]{64}$'),
  manifest_id text NOT NULL CHECK(manifest_id ~ '^[a-f0-9]{64}$'),
  issue_date date NOT NULL,
  generation_id text NOT NULL CHECK(generation_id ~ '^[a-f0-9]{64}$'),
  metadata_manifest_id text NOT NULL CHECK(metadata_manifest_id ~ '^[a-f0-9]{64}$'),
  metadata_locator text NOT NULL,
  metadata_records integer NOT NULL CHECK(metadata_records>=0),
  expected_renditions integer NOT NULL CHECK(expected_renditions>0 AND expected_renditions<=1000),
  validated_renditions integer NOT NULL DEFAULT 0 CHECK(validated_renditions>=0 AND validated_renditions<=expected_renditions),
  state text NOT NULL DEFAULT 'renditions_pending' CHECK(state IN ('renditions_pending','ready','published','quarantined')),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(source_id,scope_key,unit_key),
  FOREIGN KEY(source_id,scope_key,unit_key)
    REFERENCES legislation.legal_discovery_units(source_id,scope_key,unit_key) ON DELETE CASCADE,
  FOREIGN KEY(manifest_id) REFERENCES legislation.legal_import_manifests(id),
  FOREIGN KEY(generation_id) REFERENCES legislation.legal_import_generations(id),
  CHECK((state='quarantined')=(failure_code IS NOT NULL)),
  CHECK(state<>'ready' OR validated_renditions=expected_renditions),
  CHECK(state<>'published' OR validated_renditions=expected_renditions)
);
--> statement-breakpoint
CREATE INDEX legal_fr_issue_preparations_pending_idx
  ON legislation.legal_fr_issue_preparations(updated_at,unit_key)
  WHERE state IN ('renditions_pending','ready');
--> statement-breakpoint
CREATE TABLE legislation.legal_fr_issue_renditions (
  source_id text NOT NULL DEFAULT 'govinfo-fr' CHECK(source_id='govinfo-fr'),
  scope_key text NOT NULL,
  unit_key text NOT NULL CHECK(unit_key ~ '^[a-f0-9]{64}$'),
  document_number text NOT NULL CHECK(document_number ~ '^[A-Z0-9]+(-[A-Z0-9]+)+$'),
  metadata_manifest_id text NOT NULL CHECK(metadata_manifest_id ~ '^[a-f0-9]{64}$'),
  metadata_record jsonb NOT NULL CHECK(jsonb_typeof(metadata_record)='object'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','acquired','validated','quarantined')),
  receipt jsonb,
  inspection jsonb,
  storage_locator text,
  attempt integer NOT NULL DEFAULT 0 CHECK(attempt>=0),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(source_id,scope_key,unit_key,document_number),
  FOREIGN KEY(source_id,scope_key,unit_key)
    REFERENCES legislation.legal_fr_issue_preparations(source_id,scope_key,unit_key) ON DELETE CASCADE,
  CHECK((state IN ('acquired','validated'))=(receipt IS NOT NULL AND storage_locator IS NOT NULL)),
  CHECK((state='validated')=(inspection IS NOT NULL)),
  CHECK((state='quarantined')=(failure_code IS NOT NULL)),
  CHECK((lease_token IS NULL)=(lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX legal_fr_issue_renditions_pending_idx
  ON legislation.legal_fr_issue_renditions(updated_at,unit_key,document_number)
  WHERE state IN ('pending','acquired');
