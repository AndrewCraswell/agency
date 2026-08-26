-- Add source-backed organization profile fields and completeness gates.
ALTER TABLE "legislation"."organizations"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "website_url" text,
  ADD COLUMN IF NOT EXISTS "public_contact_address" text,
  ADD COLUMN IF NOT EXISTS "public_contact_phone" text,
  ADD COLUMN IF NOT EXISTS "public_contact_email" text,
  ADD COLUMN IF NOT EXISTS "terms_of_reference" text,
  ADD COLUMN IF NOT EXISTS "detail_facts_complete" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "child_relations_complete" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "membership_relations_complete" boolean NOT NULL DEFAULT false;

ALTER TABLE "legislation"."organizations"
  DROP CONSTRAINT IF EXISTS "organizations_description_check",
  ADD CONSTRAINT "organizations_description_check"
    CHECK ("description" IS NULL OR length(btrim("description")) > 0),
  DROP CONSTRAINT IF EXISTS "organizations_website_url_check",
  ADD CONSTRAINT "organizations_website_url_check"
    CHECK ("website_url" IS NULL OR "website_url" ~ '^https://'),
  DROP CONSTRAINT IF EXISTS "organizations_public_contact_address_check",
  ADD CONSTRAINT "organizations_public_contact_address_check"
    CHECK ("public_contact_address" IS NULL OR length(btrim("public_contact_address")) > 0),
  DROP CONSTRAINT IF EXISTS "organizations_public_contact_phone_check",
  ADD CONSTRAINT "organizations_public_contact_phone_check"
    CHECK ("public_contact_phone" IS NULL OR length(btrim("public_contact_phone")) > 0),
  DROP CONSTRAINT IF EXISTS "organizations_public_contact_email_check",
  ADD CONSTRAINT "organizations_public_contact_email_check"
    CHECK ("public_contact_email" IS NULL OR length(btrim("public_contact_email")) > 0),
  DROP CONSTRAINT IF EXISTS "organizations_terms_of_reference_check",
  ADD CONSTRAINT "organizations_terms_of_reference_check"
    CHECK ("terms_of_reference" IS NULL OR length(btrim("terms_of_reference")) > 0);
