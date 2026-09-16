ALTER TABLE "legislation"."document_sections" ADD COLUMN "source_start_offset" integer;--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ADD COLUMN "source_end_offset" integer;--> statement-breakpoint
UPDATE "legislation"."document_sections"
SET "source_start_offset" = 0, "source_end_offset" = char_length("text");--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ALTER COLUMN "source_start_offset" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ALTER COLUMN "source_end_offset" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ADD CONSTRAINT "document_sections_offsets_check" CHECK ("legislation"."document_sections"."source_start_offset" >= 0 and "legislation"."document_sections"."source_end_offset" >= "legislation"."document_sections"."source_start_offset");
