CREATE TABLE "legislation"."amendment_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"amendment_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"description" text NOT NULL,
	"classification" text[] DEFAULT '{}'::text[] NOT NULL,
	"action_date" date,
	"action_at" timestamp with time zone,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amendment_actions_ordinal_check" CHECK ("legislation"."amendment_actions"."ordinal" >= 0),
	CONSTRAINT "amendment_actions_description_check" CHECK (length("legislation"."amendment_actions"."description") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."amendment_relations" (
	"amendment_id" text NOT NULL,
	"related_amendment_id" text NOT NULL,
	"classification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amendment_relations_amendment_id_related_amendment_id_classification_pk" PRIMARY KEY("amendment_id","related_amendment_id","classification"),
	CONSTRAINT "amendment_relations_distinct_check" CHECK ("legislation"."amendment_relations"."amendment_id" <> "legislation"."amendment_relations"."related_amendment_id")
);
--> statement-breakpoint
CREATE TABLE "legislation"."amendments" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"session_id" text,
	"bill_id" text,
	"sponsor_person_id" text,
	"source_id" text NOT NULL,
	"printed_identifier" text NOT NULL,
	"amendment_type" text NOT NULL,
	"amendment_number" text NOT NULL,
	"chamber" text,
	"purpose" text,
	"description" text,
	"status" text,
	"sponsor_name" text,
	"sponsor_source_id" text,
	"submitted_date" date,
	"source_url" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"upstream_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amendments_id_check" CHECK (length("legislation"."amendments"."id") > 0),
	CONSTRAINT "amendments_source_id_check" CHECK (length("legislation"."amendments"."source_id") > 0),
	CONSTRAINT "amendments_identifier_check" CHECK (length("legislation"."amendments"."printed_identifier") > 0),
	CONSTRAINT "amendments_type_check" CHECK (length("legislation"."amendments"."amendment_type") > 0),
	CONSTRAINT "amendments_number_check" CHECK (length("legislation"."amendments"."amendment_number") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."supporting_material_links" (
	"material_id" text NOT NULL,
	"bill_id" text,
	"amendment_id" text,
	"event_id" text,
	"organization_id" text,
	"classification" text DEFAULT 'related' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supporting_material_links_target_check" CHECK ("legislation"."supporting_material_links"."bill_id" is not null or "legislation"."supporting_material_links"."amendment_id" is not null or "legislation"."supporting_material_links"."event_id" is not null or "legislation"."supporting_material_links"."organization_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "legislation"."supporting_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"source_id" text NOT NULL,
	"classification" text NOT NULL,
	"title" text NOT NULL,
	"document_date" date,
	"source_url" text NOT NULL,
	"content_type" text,
	"blob_path" text,
	"text" text,
	"content_hash" char(64),
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"processing_error" text,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supporting_materials_source_id_check" CHECK (length("legislation"."supporting_materials"."source_id") > 0),
	CONSTRAINT "supporting_materials_classification_check" CHECK (length("legislation"."supporting_materials"."classification") > 0),
	CONSTRAINT "supporting_materials_title_check" CHECK (length("legislation"."supporting_materials"."title") > 0),
	CONSTRAINT "supporting_materials_hash_check" CHECK ("legislation"."supporting_materials"."content_hash" is null or "legislation"."supporting_materials"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "supporting_materials_attempts_check" CHECK ("legislation"."supporting_materials"."processing_attempts" >= 0),
	CONSTRAINT "supporting_materials_processing_status_check" CHECK ("legislation"."supporting_materials"."processing_status" in ('pending', 'processing', 'processed', 'unsupported', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "legislation"."amendment_actions" ADD CONSTRAINT "amendment_actions_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."amendment_relations" ADD CONSTRAINT "amendment_relations_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."amendment_relations" ADD CONSTRAINT "amendment_relations_related_amendment_id_amendments_id_fk" FOREIGN KEY ("related_amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."amendments" ADD CONSTRAINT "amendments_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."amendments" ADD CONSTRAINT "amendments_session_id_legislative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "legislation"."legislative_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."amendments" ADD CONSTRAINT "amendments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."amendments" ADD CONSTRAINT "amendments_sponsor_person_id_people_id_fk" FOREIGN KEY ("sponsor_person_id") REFERENCES "legislation"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_links" ADD CONSTRAINT "supporting_material_links_material_id_supporting_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "legislation"."supporting_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_links" ADD CONSTRAINT "supporting_material_links_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_links" ADD CONSTRAINT "supporting_material_links_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_links" ADD CONSTRAINT "supporting_material_links_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_links" ADD CONSTRAINT "supporting_material_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_materials" ADD CONSTRAINT "supporting_materials_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amendment_actions_ordinal_uidx" ON "legislation"."amendment_actions" USING btree ("amendment_id","ordinal");--> statement-breakpoint
CREATE INDEX "amendment_relations_related_idx" ON "legislation"."amendment_relations" USING btree ("related_amendment_id","classification");--> statement-breakpoint
CREATE UNIQUE INDEX "amendments_jurisdiction_source_uidx" ON "legislation"."amendments" USING btree ("jurisdiction_id","source_id");--> statement-breakpoint
CREATE INDEX "amendments_bill_idx" ON "legislation"."amendments" USING btree ("bill_id","submitted_date");--> statement-breakpoint
CREATE INDEX "amendments_sponsor_idx" ON "legislation"."amendments" USING btree ("sponsor_person_id","submitted_date");--> statement-breakpoint
CREATE INDEX "amendments_session_idx" ON "legislation"."amendments" USING btree ("session_id","chamber","submitted_date");--> statement-breakpoint
CREATE UNIQUE INDEX "supporting_material_links_identity_uidx" ON "legislation"."supporting_material_links" USING btree ("material_id","bill_id","amendment_id","event_id","organization_id","classification");--> statement-breakpoint
CREATE INDEX "supporting_material_links_bill_idx" ON "legislation"."supporting_material_links" USING btree ("bill_id","material_id");--> statement-breakpoint
CREATE INDEX "supporting_material_links_amendment_idx" ON "legislation"."supporting_material_links" USING btree ("amendment_id","material_id");--> statement-breakpoint
CREATE INDEX "supporting_material_links_event_idx" ON "legislation"."supporting_material_links" USING btree ("event_id","material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supporting_materials_jurisdiction_source_uidx" ON "legislation"."supporting_materials" USING btree ("jurisdiction_id","source_id");--> statement-breakpoint
CREATE INDEX "supporting_materials_processing_idx" ON "legislation"."supporting_materials" USING btree ("processing_status","updated_at");--> statement-breakpoint
CREATE INDEX "supporting_materials_classification_idx" ON "legislation"."supporting_materials" USING btree ("jurisdiction_id","classification","document_date");--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE set null ON UPDATE no action;