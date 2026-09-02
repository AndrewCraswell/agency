ALTER TABLE "legislation"."document_section_embeddings"
ADD COLUMN "document_classification" text;
--> statement-breakpoint
ALTER TABLE "legislation"."document_section_embeddings"
ADD CONSTRAINT "document_section_embeddings_classification_check"
CHECK (
  "document_classification" IS NULL
  OR "document_classification" IN ('amendment', 'analysis', 'fiscal-note', 'supplemental', 'version')
) NOT VALID;
