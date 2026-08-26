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
