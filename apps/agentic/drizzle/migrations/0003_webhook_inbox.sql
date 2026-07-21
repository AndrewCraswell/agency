CREATE TABLE "agentic"."webhook_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"action" text,
	"installation_id" text,
	"repository_owner" text,
	"repository_name" text,
	"payload_digest" char(64) NOT NULL,
	"raw_payload" text NOT NULL,
	"normalized_envelope" jsonb NOT NULL,
	"processing_status" text NOT NULL,
	"last_error" text,
	"received_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_provider_check" CHECK ("agentic"."webhook_deliveries"."provider" = 'github'),
	CONSTRAINT "webhook_deliveries_digest_check" CHECK ("agentic"."webhook_deliveries"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "webhook_deliveries_status_check" CHECK ("agentic"."webhook_deliveries"."processing_status" in ('normalized', 'dispatching', 'dispatched', 'ignored', 'failed', 'quarantined'))
);
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_received_idx" ON "agentic"."webhook_deliveries" USING btree ("processing_status","received_at");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_repository_idx" ON "agentic"."webhook_deliveries" USING btree ("repository_owner","repository_name");