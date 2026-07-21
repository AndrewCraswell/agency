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
--> statement-breakpoint
CREATE TABLE "agentic"."provider_deliveries" (
	"delivery_key" char(64) PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"raw_payload_digest" char(64) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"dispatch_started_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"quarantined_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_deliveries_provider_check" CHECK ("agentic"."provider_deliveries"."provider" = 'nango'),
	CONSTRAINT "provider_deliveries_key_check" CHECK ("agentic"."provider_deliveries"."delivery_key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "provider_deliveries_digest_check" CHECK ("agentic"."provider_deliveries"."raw_payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "provider_deliveries_status_check" CHECK ("agentic"."provider_deliveries"."status" in ('pending', 'dispatching', 'dispatched', 'failed', 'quarantined')),
	CONSTRAINT "provider_deliveries_attempt_count_check" CHECK ("agentic"."provider_deliveries"."attempt_count" >= 0),
	CONSTRAINT "provider_deliveries_matched_count_check" CHECK ("agentic"."provider_deliveries"."matched_count" is null or "agentic"."provider_deliveries"."matched_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "provider_deliveries_status_received_idx" ON "agentic"."provider_deliveries" USING btree ("status","received_at");
--> statement-breakpoint
CREATE INDEX "provider_deliveries_retry_idx" ON "agentic"."provider_deliveries" USING btree ("status","next_attempt_at");