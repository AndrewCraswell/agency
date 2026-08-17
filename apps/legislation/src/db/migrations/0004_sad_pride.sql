ALTER TABLE "legislation"."bill_documents" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD COLUMN "processing_error_category" text;--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD CONSTRAINT "bill_documents_attempts_check" CHECK ("legislation"."bill_documents"."processing_attempts" >= 0);--> statement-breakpoint
ALTER TABLE "legislation"."bill_documents" ADD CONSTRAINT "bill_documents_error_category_check" CHECK ("legislation"."bill_documents"."processing_error_category" is null or "legislation"."bill_documents"."processing_error_category" in ('download-permanent', 'download-transient', 'malformed-document', 'not-found', 'oversized', 'processing-transient', 'unsafe-url', 'unsupported-format'));--> statement-breakpoint
CREATE INDEX "bill_documents_pending_claim_idx" ON "legislation"."bill_documents" USING btree ("id") WHERE "legislation"."bill_documents"."processing_status" = 'pending';--> statement-breakpoint
CREATE INDEX "bill_documents_failed_retry_idx" ON "legislation"."bill_documents" USING btree ("processing_error_category","next_attempt_at","id") WHERE "legislation"."bill_documents"."processing_status" = 'failed';
