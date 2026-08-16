ALTER TABLE "legislation"."bills" ADD COLUMN "embedding_input_hash" char(64);--> statement-breakpoint
ALTER TABLE "legislation"."bills" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "legislation"."bills" ADD COLUMN "embedded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ADD COLUMN "embedding_input_hash" char(64);--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "legislation"."document_sections" ADD COLUMN "embedded_at" timestamp with time zone;