ALTER TABLE "legislation"."ingestion_runs" ADD COLUMN "correlation_id" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."ingestion_runs" ADD COLUMN "workflow_execution_id" text;--> statement-breakpoint
CREATE INDEX "ingestion_runs_correlation_idx" ON "legislation"."ingestion_runs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "ingestion_runs_workflow_execution_idx" ON "legislation"."ingestion_runs" USING btree ("workflow_execution_id");--> statement-breakpoint
ALTER TABLE "legislation"."ingestion_runs" ADD CONSTRAINT "ingestion_runs_correlation_id_check" CHECK (length("legislation"."ingestion_runs"."correlation_id") > 0);