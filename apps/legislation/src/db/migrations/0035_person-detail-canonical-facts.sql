-- Intentionally unnumbered: the root integration pass assigns its sequence
-- after reviewing concurrent API migrations and updates the Drizzle journal.

CREATE TABLE IF NOT EXISTS "legislation"."person_details" (
  "person_id" text PRIMARY KEY NOT NULL REFERENCES "legislation"."people"("id") ON DELETE cascade,
  "image_url" text,
  "public_email" text,
  "official_url" text,
  "source_url" text,
  "source_provider" text,
  "source_updated_at" timestamp with time zone,
  "source_retrieved_at" timestamp with time zone,
  "source_is_official" boolean,
  "provenance_complete" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "person_details_provenance_complete_check" CHECK (not "provenance_complete" or ("source_url" is not null and "source_url" ~ '^https://' and "source_provider" is not null and length(btrim("source_provider")) > 0 and "source_retrieved_at" is not null and "source_is_official" is not null)),
  CONSTRAINT "person_details_image_url_check" CHECK ("image_url" is null or "image_url" ~ '^https://'),
  CONSTRAINT "person_details_official_url_check" CHECK ("official_url" is null or "official_url" ~ '^https://'),
  CONSTRAINT "person_details_public_email_check" CHECK ("public_email" is null or length(btrim("public_email")) > 0)
);

CREATE TABLE IF NOT EXISTS "legislation"."person_external_identifiers" (
  "person_id" text NOT NULL REFERENCES "legislation"."people"("id") ON DELETE cascade,
  "source_identity" text NOT NULL,
  "scheme" text NOT NULL,
  "value" text NOT NULL,
  "source_url" text,
  "source_provider" text,
  "source_updated_at" timestamp with time zone,
  "source_retrieved_at" timestamp with time zone,
  "source_is_official" boolean,
  "provenance_complete" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "person_external_identifiers_pk" PRIMARY KEY ("person_id", "source_identity"),
  CONSTRAINT "person_external_identifiers_scheme_check" CHECK (length(btrim("scheme")) > 0),
  CONSTRAINT "person_external_identifiers_value_check" CHECK (length(btrim("value")) > 0),
  CONSTRAINT "person_external_identifiers_provenance_complete_check" CHECK (not "provenance_complete" or ("source_url" is not null and "source_url" ~ '^https://' and "source_provider" is not null and length(btrim("source_provider")) > 0 and "source_retrieved_at" is not null and "source_is_official" is not null))
);
CREATE INDEX IF NOT EXISTS "person_external_identifiers_person_idx" ON "legislation"."person_external_identifiers" ("person_id");

CREATE TABLE IF NOT EXISTS "legislation"."person_jurisdictions" (
  "person_id" text NOT NULL REFERENCES "legislation"."people"("id") ON DELETE cascade,
  "jurisdiction_id" text NOT NULL REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict,
  "source_identity" text NOT NULL,
  "source_url" text,
  "source_provider" text,
  "source_updated_at" timestamp with time zone,
  "source_retrieved_at" timestamp with time zone,
  "source_is_official" boolean,
  "provenance_complete" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "person_jurisdictions_pk" PRIMARY KEY ("person_id", "jurisdiction_id", "source_identity"),
  CONSTRAINT "person_jurisdictions_source_identity_check" CHECK (length(btrim("source_identity")) > 0),
  CONSTRAINT "person_jurisdictions_provenance_complete_check" CHECK (not "provenance_complete" or ("source_url" is not null and "source_url" ~ '^https://' and "source_provider" is not null and length(btrim("source_provider")) > 0 and "source_retrieved_at" is not null and "source_is_official" is not null))
);
CREATE INDEX IF NOT EXISTS "person_jurisdictions_person_idx" ON "legislation"."person_jurisdictions" ("person_id", "jurisdiction_id");
