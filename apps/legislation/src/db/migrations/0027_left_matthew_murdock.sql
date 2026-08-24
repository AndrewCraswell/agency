ALTER TABLE "legislation"."organizations" DROP CONSTRAINT "organizations_classification_check";--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ALTER COLUMN "chamber" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ALTER COLUMN "classification" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD COLUMN "office_title" text;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD COLUMN "source_retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD COLUMN "source_is_official" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD COLUMN "provenance_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "source_retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "source_is_official" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "provenance_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD COLUMN "source_retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD COLUMN "source_is_official" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD COLUMN "provenance_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "source_retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "source_is_official" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "provenance_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD CONSTRAINT "legislative_terms_chamber_vocabulary_check" CHECK ("legislation"."legislative_terms"."chamber" is null or "legislation"."legislative_terms"."chamber" in ('lower', 'upper', 'unicameral', 'legislature')) NOT VALID;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD CONSTRAINT "legislative_terms_provenance_complete_check" CHECK (not "legislation"."legislative_terms"."provenance_complete" or ("legislation"."legislative_terms"."source_url" is not null and "legislation"."legislative_terms"."source_url" ~ '^https://' and "legislation"."legislative_terms"."source_provider" is not null and length(btrim("legislation"."legislative_terms"."source_provider")) > 0 and "legislation"."legislative_terms"."source_retrieved_at" is not null and "legislation"."legislative_terms"."source_is_official" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_provenance_complete_check" CHECK (not "legislation"."organization_memberships"."provenance_complete" or ("legislation"."organization_memberships"."source_url" is not null and "legislation"."organization_memberships"."source_url" ~ '^https://' and "legislation"."organization_memberships"."source_provider" is not null and length(btrim("legislation"."organization_memberships"."source_provider")) > 0 and "legislation"."organization_memberships"."source_retrieved_at" is not null and "legislation"."organization_memberships"."source_is_official" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD CONSTRAINT "organizations_chamber_check" CHECK ("legislation"."organizations"."chamber" is null or "legislation"."organizations"."chamber" in ('lower', 'upper', 'unicameral', 'legislature')) NOT VALID;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD CONSTRAINT "organizations_provenance_complete_check" CHECK (not "legislation"."organizations"."provenance_complete" or ("legislation"."organizations"."source_url" is not null and "legislation"."organizations"."source_url" ~ '^https://' and "legislation"."organizations"."source_provider" is not null and length(btrim("legislation"."organizations"."source_provider")) > 0 and "legislation"."organizations"."source_retrieved_at" is not null and "legislation"."organizations"."source_is_official" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD CONSTRAINT "organizations_classification_check" CHECK ("legislation"."organizations"."classification" is null or "legislation"."organizations"."classification" in ('legislature', 'chamber', 'committee', 'subcommittee', 'commission', 'agency', 'other')) NOT VALID;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD CONSTRAINT "people_provenance_complete_check" CHECK (not "legislation"."people"."provenance_complete" or ("legislation"."people"."source_url" is not null and "legislation"."people"."source_url" ~ '^https://' and "legislation"."people"."source_provider" is not null and length(btrim("legislation"."people"."source_provider")) > 0 and "legislation"."people"."source_retrieved_at" is not null and "legislation"."people"."source_is_official" is not null)) NOT VALID;
