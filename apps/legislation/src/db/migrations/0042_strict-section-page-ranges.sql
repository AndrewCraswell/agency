UPDATE "legislation"."document_sections"
SET "page_start" = NULL, "page_end" = NULL
WHERE ("page_start" IS NULL) <> ("page_end" IS NULL);
--> statement-breakpoint
ALTER TABLE "legislation"."document_sections"
  DROP CONSTRAINT "document_sections_page_range_check";
--> statement-breakpoint
ALTER TABLE "legislation"."document_sections"
  ADD CONSTRAINT "document_sections_page_range_check"
  CHECK (
    ("page_start" IS NULL AND "page_end" IS NULL)
    OR (
      "page_start" IS NOT NULL
      AND "page_end" IS NOT NULL
      AND "page_start" > 0
      AND "page_end" >= "page_start"
    )
  );
--> statement-breakpoint
UPDATE "legislation"."supporting_material_sections"
SET "page_start" = NULL, "page_end" = NULL
WHERE ("page_start" IS NULL) <> ("page_end" IS NULL);
--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_sections"
  DROP CONSTRAINT "supporting_material_sections_pages_check";
--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_sections"
  ADD CONSTRAINT "supporting_material_sections_pages_check"
  CHECK (
    ("page_start" IS NULL AND "page_end" IS NULL)
    OR (
      "page_start" IS NOT NULL
      AND "page_end" IS NOT NULL
      AND "page_start" >= 1
      AND "page_end" >= "page_start"
    )
  );
