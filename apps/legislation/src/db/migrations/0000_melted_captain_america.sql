CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE SCHEMA "legislation";
--> statement-breakpoint
CREATE TABLE "legislation"."bill_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"description" text NOT NULL,
	"classification" text[] DEFAULT '{}'::text[] NOT NULL,
	"action_date" date,
	"action_at" timestamp with time zone,
	"chamber" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_actions_ordinal_check" CHECK ("legislation"."bill_actions"."ordinal" >= 0),
	CONSTRAINT "bill_actions_description_check" CHECK (length("legislation"."bill_actions"."description") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."bill_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"classification" text NOT NULL,
	"version_code" text,
	"title" text NOT NULL,
	"document_date" date,
	"source_url" text NOT NULL,
	"content_type" text,
	"blob_path" text,
	"text" text,
	"content_hash" char(64),
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_documents_title_check" CHECK (length("legislation"."bill_documents"."title") > 0),
	CONSTRAINT "bill_documents_hash_check" CHECK ("legislation"."bill_documents"."content_hash" is null or "legislation"."bill_documents"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "bill_documents_processing_status_check" CHECK ("legislation"."bill_documents"."processing_status" in ('pending', 'processing', 'processed', 'unsupported', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "legislation"."bill_relations" (
	"bill_id" text NOT NULL,
	"related_bill_id" text NOT NULL,
	"classification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_relations_bill_id_related_bill_id_classification_pk" PRIMARY KEY("bill_id","related_bill_id","classification"),
	CONSTRAINT "bill_relations_distinct_check" CHECK ("legislation"."bill_relations"."bill_id" <> "legislation"."bill_relations"."related_bill_id")
);
--> statement-breakpoint
CREATE TABLE "legislation"."bill_sponsors" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"person_id" text,
	"name" text NOT NULL,
	"classification" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_sponsors_name_check" CHECK (length("legislation"."bill_sponsors"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."bills" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"session_id" text NOT NULL,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"classification" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text,
	"subjects" text[] DEFAULT '{}'::text[] NOT NULL,
	"chamber" text,
	"introduced_at" date,
	"source_updated_at" timestamp with time zone,
	"source_url" text NOT NULL,
	"upstream_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_vector" "tsvector",
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_id_check" CHECK ("legislation"."bills"."id" ~ '^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$'),
	CONSTRAINT "bills_identifier_check" CHECK (length("legislation"."bills"."identifier") > 0),
	CONSTRAINT "bills_title_check" CHECK (length("legislation"."bills"."title") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."document_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"section_identifier" text,
	"heading" text,
	"text" text NOT NULL,
	"content_hash" char(64) NOT NULL,
	"search_vector" "tsvector",
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_sections_ordinal_check" CHECK ("legislation"."document_sections"."ordinal" >= 0),
	CONSTRAINT "document_sections_text_check" CHECK (length("legislation"."document_sections"."text") > 0),
	CONSTRAINT "document_sections_hash_check" CHECK ("legislation"."document_sections"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "legislation"."ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"operation" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_summary" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ingestion_runs_source_check" CHECK (length("legislation"."ingestion_runs"."source") > 0),
	CONSTRAINT "ingestion_runs_operation_check" CHECK (length("legislation"."ingestion_runs"."operation") > 0),
	CONSTRAINT "ingestion_runs_status_check" CHECK ("legislation"."ingestion_runs"."status" in ('running', 'succeeded', 'partial', 'failed')),
	CONSTRAINT "ingestion_runs_completion_check" CHECK (("legislation"."ingestion_runs"."status" = 'running' and "legislation"."ingestion_runs"."completed_at" is null) or ("legislation"."ingestion_runs"."status" <> 'running' and "legislation"."ingestion_runs"."completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "legislation"."jurisdictions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"classification" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"subdivision_code" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jurisdictions_id_check" CHECK (length("legislation"."jurisdictions"."id") > 0),
	CONSTRAINT "jurisdictions_name_check" CHECK (length("legislation"."jurisdictions"."name") > 0),
	CONSTRAINT "jurisdictions_classification_check" CHECK ("legislation"."jurisdictions"."classification" in ('country', 'state', 'district', 'territory')),
	CONSTRAINT "jurisdictions_country_code_check" CHECK ("legislation"."jurisdictions"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "legislation"."legislative_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legislative_sessions_id_check" CHECK (length("legislation"."legislative_sessions"."id") > 0),
	CONSTRAINT "legislative_sessions_identifier_check" CHECK (length("legislation"."legislative_sessions"."identifier") > 0),
	CONSTRAINT "legislative_sessions_dates_check" CHECK ("legislation"."legislative_sessions"."start_date" is null or "legislation"."legislative_sessions"."end_date" is null or "legislation"."legislative_sessions"."start_date" <= "legislation"."legislative_sessions"."end_date")
);
--> statement-breakpoint
CREATE TABLE "legislation"."people" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text,
	"name" text NOT NULL,
	"given_name" text,
	"family_name" text,
	"party" text,
	"source_url" text,
	"upstream_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_name_check" CHECK (length("legislation"."people"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."sync_checkpoints" (
	"source" text NOT NULL,
	"stream" text NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"watermark" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_checkpoints_source_stream_pk" PRIMARY KEY("source","stream"),
	CONSTRAINT "sync_checkpoints_source_check" CHECK (length("legislation"."sync_checkpoints"."source") > 0),
	CONSTRAINT "sync_checkpoints_stream_check" CHECK (length("legislation"."sync_checkpoints"."stream") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."vote_positions" (
	"vote_id" text NOT NULL,
	"person_id" text NOT NULL,
	"option" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_positions_vote_id_person_id_pk" PRIMARY KEY("vote_id","person_id"),
	CONSTRAINT "vote_positions_option_check" CHECK (length("legislation"."vote_positions"."option") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."votes" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"chamber" text,
	"motion" text NOT NULL,
	"result" text,
	"held_at" timestamp with time zone,
	"yes_count" integer,
	"no_count" integer,
	"other_count" integer,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_motion_check" CHECK (length("legislation"."votes"."motion") > 0),
	CONSTRAINT "votes_yes_count_check" CHECK ("legislation"."votes"."yes_count" is null or "legislation"."votes"."yes_count" >= 0),
	CONSTRAINT "votes_no_count_check" CHECK ("legislation"."votes"."no_count" is null or "legislation"."votes"."no_count" >= 0),
	CONSTRAINT "votes_other_count_check" CHECK ("legislation"."votes"."other_count" is null or "legislation"."votes"."other_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "legislation"."bill_actions" ADD CONSTRAINT "bill_actions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD CONSTRAINT "bill_documents_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."bill_relations" ADD CONSTRAINT "bill_relations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."bill_sponsors" ADD CONSTRAINT "bill_sponsors_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_sessions_jurisdiction_id_uidx" ON "legislation"."legislative_sessions" USING btree ("jurisdiction_id","id");--> statement-breakpoint
ALTER TABLE "legislation"."bills" ADD CONSTRAINT "bills_session_fk" FOREIGN KEY ("jurisdiction_id","session_id") REFERENCES "legislation"."legislative_sessions"("jurisdiction_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ADD CONSTRAINT "document_sections_document_id_bill_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "legislation"."bill_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_sessions" ADD CONSTRAINT "legislative_sessions_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD CONSTRAINT "people_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD CONSTRAINT "vote_positions_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "legislation"."votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD CONSTRAINT "vote_positions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_actions_ordinal_uidx" ON "legislation"."bill_actions" USING btree ("bill_id","ordinal");--> statement-breakpoint
CREATE INDEX "bill_actions_timeline_idx" ON "legislation"."bill_actions" USING btree ("bill_id","action_date","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_documents_source_uidx" ON "legislation"."bill_documents" USING btree ("bill_id","source_url");--> statement-breakpoint
CREATE INDEX "bill_documents_processing_idx" ON "legislation"."bill_documents" USING btree ("processing_status","updated_at");--> statement-breakpoint
CREATE INDEX "bill_documents_amendment_date_idx" ON "legislation"."bill_documents" USING btree ("classification",("document_date" is null),"document_date" DESC NULLS FIRST,"id");--> statement-breakpoint
CREATE INDEX "bill_relations_related_idx" ON "legislation"."bill_relations" USING btree ("related_bill_id","classification");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_sponsors_person_uidx" ON "legislation"."bill_sponsors" USING btree ("bill_id","person_id","classification") WHERE "legislation"."bill_sponsors"."person_id" is not null;--> statement-breakpoint
CREATE INDEX "bill_sponsors_bill_idx" ON "legislation"."bill_sponsors" USING btree ("bill_id","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_identifier_uidx" ON "legislation"."bills" USING btree ("jurisdiction_id","session_id","identifier");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "legislation"."bills" USING btree ("jurisdiction_id","session_id","status");--> statement-breakpoint
CREATE INDEX "bills_introduced_idx" ON "legislation"."bills" USING btree ("jurisdiction_id","introduced_at");--> statement-breakpoint
CREATE INDEX "bills_global_introduced_idx" ON "legislation"."bills" USING btree ("introduced_at" DESC NULLS FIRST,"id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_sections_ordinal_uidx" ON "legislation"."document_sections" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "document_sections_identifier_idx" ON "legislation"."document_sections" USING btree ("document_id","section_identifier");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_idx" ON "legislation"."ingestion_runs" USING btree ("source","operation","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdictions_subdivision_uidx" ON "legislation"."jurisdictions" USING btree ("country_code","subdivision_code") WHERE "legislation"."jurisdictions"."subdivision_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_sessions_identifier_uidx" ON "legislation"."legislative_sessions" USING btree ("jurisdiction_id","identifier");--> statement-breakpoint
CREATE INDEX "vote_positions_person_idx" ON "legislation"."vote_positions" USING btree ("person_id","option");--> statement-breakpoint
CREATE INDEX "votes_bill_idx" ON "legislation"."votes" USING btree ("bill_id","held_at");
