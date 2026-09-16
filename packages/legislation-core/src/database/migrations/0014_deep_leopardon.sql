CREATE TABLE "legislation"."canonical_record_fingerprints" (
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"fingerprint" char(64) NOT NULL,
	"fields" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_record_fingerprints_record_type_record_id_pk" PRIMARY KEY("record_type","record_id"),
	CONSTRAINT "canonical_record_fingerprints_type_check" CHECK (length("legislation"."canonical_record_fingerprints"."record_type") > 0),
	CONSTRAINT "canonical_record_fingerprints_id_check" CHECK (length("legislation"."canonical_record_fingerprints"."record_id") > 0),
	CONSTRAINT "canonical_record_fingerprints_hash_check" CHECK ("legislation"."canonical_record_fingerprints"."fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "legislation"."change_events" (
	"id" text PRIMARY KEY NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"change_type" text NOT NULL,
	"jurisdiction_id" text,
	"organization_id" text,
	"person_id" text,
	"changed_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"source_updated_at" timestamp with time zone,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_events_id_check" CHECK (length("legislation"."change_events"."id") > 0),
	CONSTRAINT "change_events_record_type_check" CHECK (length("legislation"."change_events"."record_type") > 0),
	CONSTRAINT "change_events_record_id_check" CHECK (length("legislation"."change_events"."record_id") > 0),
	CONSTRAINT "change_events_change_type_check" CHECK ("legislation"."change_events"."change_type" in ('create', 'update', 'delete', 'cancel', 'reschedule', 'relationship-change'))
);
--> statement-breakpoint
ALTER TABLE "legislation"."change_events" ADD CONSTRAINT "change_events_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "legislation"."ingestion_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."change_events" ADD CONSTRAINT "change_events_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."change_events" ADD CONSTRAINT "change_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."change_events" ADD CONSTRAINT "change_events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canonical_record_fingerprints_observed_idx" ON "legislation"."canonical_record_fingerprints" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "change_events_record_idx" ON "legislation"."change_events" USING btree ("record_type","record_id","observed_at");--> statement-breakpoint
CREATE INDEX "change_events_jurisdiction_idx" ON "legislation"."change_events" USING btree ("jurisdiction_id","observed_at");--> statement-breakpoint
CREATE INDEX "change_events_organization_idx" ON "legislation"."change_events" USING btree ("organization_id","observed_at");--> statement-breakpoint
CREATE INDEX "change_events_person_idx" ON "legislation"."change_events" USING btree ("person_id","observed_at");--> statement-breakpoint
CREATE INDEX "change_events_run_idx" ON "legislation"."change_events" USING btree ("ingestion_run_id","observed_at");