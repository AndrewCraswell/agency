ALTER TABLE "legislation"."bill_documents" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD CONSTRAINT "bill_documents_attempts_check" CHECK ("legislation"."bill_documents"."processing_attempts" >= 0);