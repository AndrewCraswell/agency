CREATE TABLE "legislation"."event_agenda_item_amendments" (
	"agenda_item_id" text NOT NULL,
	"amendment_id" text NOT NULL,
	CONSTRAINT "event_agenda_item_amendments_agenda_item_id_amendment_id_pk" PRIMARY KEY("agenda_item_id","amendment_id")
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_agenda_item_bills" (
	"agenda_item_id" text NOT NULL,
	"bill_id" text NOT NULL,
	CONSTRAINT "event_agenda_item_bills_agenda_item_id_bill_id_pk" PRIMARY KEY("agenda_item_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "legislation"."event_agenda_item_supporting_materials" (
	"agenda_item_id" text NOT NULL,
	"material_id" text NOT NULL,
	CONSTRAINT "event_agenda_item_supporting_materials_agenda_item_id_material_id_pk" PRIMARY KEY("agenda_item_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" DROP CONSTRAINT "event_agenda_items_description_check";--> statement-breakpoint
INSERT INTO "legislation"."event_agenda_item_bills" ("agenda_item_id", "bill_id")
SELECT "id", "bill_id"
FROM "legislation"."event_agenda_items"
WHERE "bill_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" DROP CONSTRAINT "event_agenda_items_bill_id_bills_id_fk";
--> statement-breakpoint
DROP INDEX "legislation"."event_agenda_items_bill_idx";--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD COLUMN "canonical_facts_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD COLUMN "bill_relations_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD COLUMN "amendment_relations_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD COLUMN "material_relations_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_item_amendments" ADD CONSTRAINT "event_agenda_item_amendments_agenda_item_id_event_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "legislation"."event_agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_item_amendments" ADD CONSTRAINT "event_agenda_item_amendments_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_item_bills" ADD CONSTRAINT "event_agenda_item_bills_agenda_item_id_event_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "legislation"."event_agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_item_bills" ADD CONSTRAINT "event_agenda_item_bills_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_item_supporting_materials" ADD CONSTRAINT "event_agenda_item_supporting_materials_agenda_item_id_event_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "legislation"."event_agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_item_supporting_materials" ADD CONSTRAINT "event_agenda_item_supporting_materials_material_id_supporting_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "legislation"."supporting_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_agenda_item_amendments_amendment_idx" ON "legislation"."event_agenda_item_amendments" USING btree ("amendment_id","agenda_item_id");--> statement-breakpoint
CREATE INDEX "event_agenda_item_bills_bill_idx" ON "legislation"."event_agenda_item_bills" USING btree ("bill_id","agenda_item_id");--> statement-breakpoint
CREATE INDEX "event_agenda_item_supporting_materials_material_idx" ON "legislation"."event_agenda_item_supporting_materials" USING btree ("material_id","agenda_item_id");--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" DROP COLUMN "bill_id";--> statement-breakpoint
ALTER TABLE "legislation"."event_agenda_items" ADD CONSTRAINT "event_agenda_items_canonical_facts_check" CHECK (not "legislation"."event_agenda_items"."canonical_facts_complete" or ("legislation"."event_agenda_items"."title" is not null and length(btrim("legislation"."event_agenda_items"."title")) > 0));
