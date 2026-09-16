CREATE TABLE "legislation"."calendar_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"organization_id" text,
	"session_id" text,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"classification" text,
	"status" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"timezone" text,
	"description" text,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_entries_source_id_check" CHECK (length("legislation"."calendar_entries"."source_id") > 0),
	CONSTRAINT "calendar_entries_title_check" CHECK (length("legislation"."calendar_entries"."title") > 0),
	CONSTRAINT "calendar_entries_dates_check" CHECK ("legislation"."calendar_entries"."end_at" is null or "legislation"."calendar_entries"."start_at" <= "legislation"."calendar_entries"."end_at")
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_agenda_items" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"description" text NOT NULL,
	"classification" text,
	"bill_id" text,
	"organization_id" text,
	"document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_agenda_items_ordinal_check" CHECK ("legislation"."event_agenda_items"."ordinal" >= 0),
	CONSTRAINT "event_agenda_items_description_check" CHECK (length("legislation"."event_agenda_items"."description") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_bills" (
	"event_id" text NOT NULL,
	"bill_id" text NOT NULL,
	"classification" text DEFAULT 'related' NOT NULL,
	CONSTRAINT "event_bills_event_id_bill_id_classification_pk" PRIMARY KEY("event_id","bill_id","classification")
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_continuations" (
	"event_id" text NOT NULL,
	"continuation_event_id" text,
	"continuation_at" timestamp with time zone,
	"source_id" text NOT NULL,
	CONSTRAINT "event_continuations_event_id_source_id_pk" PRIMARY KEY("event_id","source_id"),
	CONSTRAINT "event_continuations_source_id_check" CHECK (length("legislation"."event_continuations"."source_id") > 0),
	CONSTRAINT "event_continuations_distinct_check" CHECK ("legislation"."event_continuations"."continuation_event_id" is null or "legislation"."event_continuations"."event_id" <> "legislation"."event_continuations"."continuation_event_id")
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"classification" text,
	"source_url" text NOT NULL,
	"document_date" date,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_documents_title_check" CHECK (length("legislation"."event_documents"."title") > 0),
	CONSTRAINT "event_documents_source_url_check" CHECK (length("legislation"."event_documents"."source_url") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"person_id" text,
	"organization_id" text,
	"name" text NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_participants_name_check" CHECK (length("legislation"."event_participants"."name") > 0),
	CONSTRAINT "event_participants_target_check" CHECK ("legislation"."event_participants"."person_id" is not null or "legislation"."event_participants"."organization_id" is not null or length("legislation"."event_participants"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."legislative_events" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"classification" text,
	"status" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"timezone" text,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" jsonb,
	"virtual_access" jsonb,
	"description" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"upstream_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legislative_events_id_check" CHECK (length("legislation"."legislative_events"."id") > 0),
	CONSTRAINT "legislative_events_source_id_check" CHECK (length("legislation"."legislative_events"."source_id") > 0),
	CONSTRAINT "legislative_events_name_check" CHECK (length("legislation"."legislative_events"."name") > 0),
	CONSTRAINT "legislative_events_status_check" CHECK (length("legislation"."legislative_events"."status") > 0),
	CONSTRAINT "legislative_events_dates_check" CHECK ("legislation"."legislative_events"."end_at" is null or "legislation"."legislative_events"."start_at" <= "legislation"."legislative_events"."end_at")
);
--> statement-breakpoint
ALTER TABLE "legislation"."calendar_entries" ADD CONSTRAINT "calendar_entries_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."calendar_entries" ADD CONSTRAINT "calendar_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."calendar_entries" ADD CONSTRAINT "calendar_entries_session_id_legislative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "legislation"."legislative_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD CONSTRAINT "event_agenda_items_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD CONSTRAINT "event_agenda_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD CONSTRAINT "event_agenda_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD CONSTRAINT "event_agenda_items_document_id_event_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "legislation"."event_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_bills" ADD CONSTRAINT "event_bills_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_bills" ADD CONSTRAINT "event_bills_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_continuations" ADD CONSTRAINT "event_continuations_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_continuations" ADD CONSTRAINT "event_continuations_continuation_event_id_legislative_events_id_fk" FOREIGN KEY ("continuation_event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_documents" ADD CONSTRAINT "event_documents_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_participants" ADD CONSTRAINT "event_participants_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_participants" ADD CONSTRAINT "event_participants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_participants" ADD CONSTRAINT "event_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_events" ADD CONSTRAINT "legislative_events_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_entries_jurisdiction_source_uidx" ON "legislation"."calendar_entries" USING btree ("jurisdiction_id","source_id");--> statement-breakpoint
CREATE INDEX "calendar_entries_schedule_idx" ON "legislation"."calendar_entries" USING btree ("jurisdiction_id","start_at","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_agenda_items_ordinal_uidx" ON "legislation"."event_agenda_items" USING btree ("event_id","ordinal");--> statement-breakpoint
CREATE INDEX "event_agenda_items_bill_idx" ON "legislation"."event_agenda_items" USING btree ("bill_id","event_id");--> statement-breakpoint
CREATE INDEX "event_bills_bill_idx" ON "legislation"."event_bills" USING btree ("bill_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_documents_source_uidx" ON "legislation"."event_documents" USING btree ("event_id","source_url");--> statement-breakpoint
CREATE INDEX "event_participants_event_idx" ON "legislation"."event_participants" USING btree ("event_id","role");--> statement-breakpoint
CREATE INDEX "event_participants_person_idx" ON "legislation"."event_participants" USING btree ("person_id","event_id");--> statement-breakpoint
CREATE INDEX "event_participants_organization_idx" ON "legislation"."event_participants" USING btree ("organization_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_events_jurisdiction_source_uidx" ON "legislation"."legislative_events" USING btree ("jurisdiction_id","source_id");--> statement-breakpoint
CREATE INDEX "legislative_events_schedule_idx" ON "legislation"."legislative_events" USING btree ("jurisdiction_id","start_at","status");--> statement-breakpoint
CREATE INDEX "legislative_events_deleted_idx" ON "legislation"."legislative_events" USING btree ("jurisdiction_id","is_deleted","start_at");