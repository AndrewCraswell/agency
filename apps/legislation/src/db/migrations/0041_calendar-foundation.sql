CREATE TABLE "legislation"."calendars" (
  "id" text PRIMARY KEY NOT NULL,
  "jurisdiction_id" text NOT NULL,
  "organization_id" text,
  "source_provider" text NOT NULL,
  "source_id" text NOT NULL,
  "name" text NOT NULL,
  "classification" text NOT NULL,
  "timezone" text,
  "description" text,
  "coverage_from" date,
  "coverage_to" date,
  "source_url" text NOT NULL,
  "source_updated_at" timestamp with time zone,
  "source_retrieved_at" timestamp with time zone NOT NULL,
  "source_is_official" boolean NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "calendars_id_check" CHECK (length("id") > 0),
  CONSTRAINT "calendars_source_provider_check" CHECK (length(btrim("source_provider")) > 0),
  CONSTRAINT "calendars_source_id_check" CHECK (length(btrim("source_id")) > 0),
  CONSTRAINT "calendars_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "calendars_classification_check" CHECK (length(btrim("classification")) > 0),
  CONSTRAINT "calendars_source_url_check" CHECK ("source_url" ~ '^https://'),
  CONSTRAINT "calendars_coverage_bounds_check" CHECK ("coverage_from" IS NULL OR "coverage_to" IS NULL OR "coverage_from" <= "coverage_to")
);
--> statement-breakpoint
CREATE TABLE "legislation"."calendar_events" (
  "calendar_id" text NOT NULL,
  "event_id" text NOT NULL,
  "source_provider" text NOT NULL,
  "source_id" text NOT NULL,
  "source_url" text NOT NULL,
  "source_updated_at" timestamp with time zone,
  "source_retrieved_at" timestamp with time zone NOT NULL,
  "source_is_official" boolean NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "calendar_events_calendar_id_event_id_source_provider_source_id_pk" PRIMARY KEY("calendar_id", "event_id", "source_provider", "source_id"),
  CONSTRAINT "calendar_events_source_provider_check" CHECK (length(btrim("source_provider")) > 0),
  CONSTRAINT "calendar_events_source_id_check" CHECK (length(btrim("source_id")) > 0),
  CONSTRAINT "calendar_events_source_url_check" CHECK ("source_url" ~ '^https://')
);
--> statement-breakpoint
ALTER TABLE "legislation"."calendars" ADD CONSTRAINT "calendars_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legislation"."calendars" ADD CONSTRAINT "calendars_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legislation"."calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "legislation"."calendars"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legislation"."calendar_events" ADD CONSTRAINT "calendar_events_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "calendars_source_uidx" ON "legislation"."calendars" USING btree ("source_provider", "source_id");
--> statement-breakpoint
CREATE INDEX "calendars_browse_idx" ON "legislation"."calendars" USING btree ("jurisdiction_id", "organization_id", "name", "id");
--> statement-breakpoint
CREATE INDEX "calendars_organization_idx" ON "legislation"."calendars" USING btree ("organization_id", "name", "id");
--> statement-breakpoint
CREATE INDEX "calendar_events_calendar_idx" ON "legislation"."calendar_events" USING btree ("calendar_id", "event_id");
--> statement-breakpoint
CREATE INDEX "calendar_events_event_idx" ON "legislation"."calendar_events" USING btree ("event_id", "calendar_id");
