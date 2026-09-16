CREATE TABLE "legislation"."person_aliases" (
	"person_id" text NOT NULL,
	"source_identity" text NOT NULL,
	"name" text NOT NULL,
	"source_url" text,
	"source_provider" text,
	"source_updated_at" timestamp with time zone,
	"source_retrieved_at" timestamp with time zone,
	"source_is_official" boolean,
	"provenance_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_aliases_person_id_source_identity_pk" PRIMARY KEY("person_id","source_identity"),
	CONSTRAINT "person_aliases_name_check" CHECK (length(btrim("legislation"."person_aliases"."name")) > 0),
	CONSTRAINT "person_aliases_source_identity_check" CHECK (length(btrim("legislation"."person_aliases"."source_identity")) > 0),
	CONSTRAINT "person_aliases_provenance_complete_check" CHECK (not "legislation"."person_aliases"."provenance_complete" or ("legislation"."person_aliases"."source_url" is not null and "legislation"."person_aliases"."source_url" ~ '^https://' and "legislation"."person_aliases"."source_provider" is not null and length(btrim("legislation"."person_aliases"."source_provider")) > 0 and "legislation"."person_aliases"."source_retrieved_at" is not null and "legislation"."person_aliases"."source_is_official" is not null))
);
--> statement-breakpoint
ALTER TABLE "legislation"."person_aliases" ADD CONSTRAINT "person_aliases_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "legislation"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_aliases_name_idx" ON "legislation"."person_aliases" USING btree ("name");--> statement-breakpoint
CREATE INDEX "person_aliases_person_idx" ON "legislation"."person_aliases" USING btree ("person_id");