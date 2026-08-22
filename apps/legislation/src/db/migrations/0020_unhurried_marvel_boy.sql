ALTER TABLE "legislation"."ingestion_runs" DROP CONSTRAINT "ingestion_runs_status_check";--> statement-breakpoint
ALTER TABLE "legislation"."ingestion_runs" ADD CONSTRAINT "ingestion_runs_status_check" CHECK ("ingestion_runs"."status" in ('running', 'succeeded', 'partial', 'failed', 'deferred'));
