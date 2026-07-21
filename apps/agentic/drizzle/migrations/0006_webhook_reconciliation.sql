ALTER TABLE "agentic"."webhook_deliveries"
  ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "next_attempt_at" timestamp with time zone;
ALTER TABLE "agentic"."webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK ("attempt_count" >= 0);