ALTER TABLE "legislation"."supporting_material_sections" ADD COLUMN IF NOT EXISTS "page_start" integer;
--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_sections" ADD COLUMN IF NOT EXISTS "page_end" integer;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "legislation"."supporting_material_sections" ADD CONSTRAINT "supporting_material_sections_pages_check" CHECK (("page_start" IS NULL AND "page_end" IS NULL) OR ("page_start" >= 1 AND "page_end" >= "page_start"));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supporting_material_sections_page_range_idx" ON "legislation"."supporting_material_sections" USING btree ("material_id", "page_start", "page_end");
