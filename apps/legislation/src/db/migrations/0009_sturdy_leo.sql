CREATE TABLE "legislation"."legislative_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"organization_id" text,
	"source_id" text,
	"chamber" text NOT NULL,
	"district" text,
	"party" text,
	"role" text,
	"start_date" date,
	"end_date" date,
	"is_active" boolean,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legislative_terms_id_check" CHECK (length("legislation"."legislative_terms"."id") > 0),
	CONSTRAINT "legislative_terms_chamber_check" CHECK (length("legislation"."legislative_terms"."chamber") > 0),
	CONSTRAINT "legislative_terms_dates_check" CHECK ("legislation"."legislative_terms"."start_date" is null or "legislation"."legislative_terms"."end_date" is null or "legislation"."legislative_terms"."start_date" <= "legislation"."legislative_terms"."end_date")
);
--> statement-breakpoint
CREATE TABLE "legislation"."organization_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"person_id" text NOT NULL,
	"source_id" text,
	"title" text,
	"rank" text,
	"classification" text,
	"start_date" date,
	"end_date" date,
	"is_active" boolean,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_id_check" CHECK (length("legislation"."organization_memberships"."id") > 0),
	CONSTRAINT "organization_memberships_dates_check" CHECK ("legislation"."organization_memberships"."start_date" is null or "legislation"."organization_memberships"."end_date" is null or "legislation"."organization_memberships"."start_date" <= "legislation"."organization_memberships"."end_date")
);
--> statement-breakpoint
CREATE TABLE "legislation"."organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" text NOT NULL,
	"parent_organization_id" text,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"classification" text NOT NULL,
	"chamber" text,
	"is_active" boolean,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"upstream_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_id_check" CHECK (length("legislation"."organizations"."id") > 0),
	CONSTRAINT "organizations_source_id_check" CHECK (length("legislation"."organizations"."source_id") > 0),
	CONSTRAINT "organizations_name_check" CHECK (length("legislation"."organizations"."name") > 0),
	CONSTRAINT "organizations_classification_check" CHECK ("legislation"."organizations"."classification" in ('legislature', 'chamber', 'committee', 'subcommittee')),
	CONSTRAINT "organizations_parent_check" CHECK ("legislation"."organizations"."parent_organization_id" is null or "legislation"."organizations"."parent_organization_id" <> "legislation"."organizations"."id")
);
--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD COLUMN "is_active" boolean;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD CONSTRAINT "legislative_terms_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD CONSTRAINT "legislative_terms_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."legislative_terms" ADD CONSTRAINT "legislative_terms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD CONSTRAINT "organizations_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_terms_person_source_uidx" ON "legislation"."legislative_terms" USING btree ("person_id","source_id") WHERE "legislation"."legislative_terms"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "legislative_terms_person_dates_idx" ON "legislation"."legislative_terms" USING btree ("person_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "legislative_terms_jurisdiction_chamber_idx" ON "legislation"."legislative_terms" USING btree ("jurisdiction_id","chamber","district");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_source_uidx" ON "legislation"."organization_memberships" USING btree ("organization_id","source_id") WHERE "legislation"."organization_memberships"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "organization_memberships_person_idx" ON "legislation"."organization_memberships" USING btree ("person_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "organization_memberships_organization_idx" ON "legislation"."organization_memberships" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_jurisdiction_source_uidx" ON "legislation"."organizations" USING btree ("jurisdiction_id","source_id");--> statement-breakpoint
CREATE INDEX "organizations_parent_idx" ON "legislation"."organizations" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX "organizations_jurisdiction_classification_idx" ON "legislation"."organizations" USING btree ("jurisdiction_id","classification","chamber");--> statement-breakpoint
CREATE UNIQUE INDEX "people_jurisdiction_source_uidx" ON "legislation"."people" USING btree ("jurisdiction_id","source_id") WHERE "legislation"."people"."jurisdiction_id" is not null and "legislation"."people"."source_id" is not null;--> statement-breakpoint
ALTER TABLE "legislation"."people" ADD CONSTRAINT "people_source_id_check" CHECK ("legislation"."people"."source_id" is null or length("legislation"."people"."source_id") > 0);