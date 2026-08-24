CREATE TABLE "legislation"."api_idempotency_records" (
	"principal_scope" char(64) NOT NULL,
	"method" text NOT NULL,
	"canonical_path" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" char(64) NOT NULL,
	"status_code" integer NOT NULL,
	"response_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_ciphertext" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_idempotency_records_principal_scope_method_canonical_path_key_pk" PRIMARY KEY("principal_scope","method","canonical_path","key"),
	CONSTRAINT "api_idempotency_records_scope_check" CHECK ("legislation"."api_idempotency_records"."principal_scope" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "api_idempotency_records_key_check" CHECK (length("legislation"."api_idempotency_records"."key") between 8 and 128),
	CONSTRAINT "api_idempotency_records_hash_check" CHECK ("legislation"."api_idempotency_records"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "api_idempotency_records_status_check" CHECK ("legislation"."api_idempotency_records"."status_code" between 200 and 599)
);
--> statement-breakpoint
CREATE TABLE "legislation"."subscription_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"subscription_event_ids" text[] NOT NULL,
	"channel" text NOT NULL,
	"destination_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failure_category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_deliveries_channel_check" CHECK ("legislation"."subscription_deliveries"."channel" in ('email', 'webhook', 'in-app')),
	CONSTRAINT "subscription_deliveries_status_check" CHECK ("legislation"."subscription_deliveries"."status" in ('pending', 'processing', 'delivered', 'failed', 'suppressed')),
	CONSTRAINT "subscription_deliveries_attempts_check" CHECK ("legislation"."subscription_deliveries"."attempt_count" >= 0 and "legislation"."subscription_deliveries"."attempt_count" <= 5)
);
--> statement-breakpoint
CREATE TABLE "legislation"."subscription_events" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"event_type" text NOT NULL,
	"change_event_id" text,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"source_urls" text[] NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_events_event_type_check" CHECK (length("legislation"."subscription_events"."event_type") > 0),
	CONSTRAINT "subscription_events_record_check" CHECK (length("legislation"."subscription_events"."record_type") > 0 and length("legislation"."subscription_events"."record_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"owner_organization_id" text,
	"name" text NOT NULL,
	"target" jsonb NOT NULL,
	"target_fingerprint" char(64) NOT NULL,
	"event_types" text[] NOT NULL,
	"delivery" jsonb NOT NULL,
	"frequency" text NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_name_check" CHECK (length("legislation"."subscriptions"."name") between 1 and 120),
	CONSTRAINT "subscriptions_owner_user_check" CHECK (length("legislation"."subscriptions"."owner_user_id") > 0),
	CONSTRAINT "subscriptions_owner_organization_check" CHECK ("legislation"."subscriptions"."owner_organization_id" is null or length("legislation"."subscriptions"."owner_organization_id") > 0),
	CONSTRAINT "subscriptions_frequency_check" CHECK ("legislation"."subscriptions"."frequency" in ('immediate', 'hourly', 'daily')),
	CONSTRAINT "subscriptions_status_check" CHECK ("legislation"."subscriptions"."status" in ('active', 'paused', 'cancelled')),
	CONSTRAINT "subscriptions_cancelled_at_check" CHECK (("legislation"."subscriptions"."status" = 'cancelled' and "legislation"."subscriptions"."cancelled_at" is not null) or ("legislation"."subscriptions"."status" <> 'cancelled' and "legislation"."subscriptions"."cancelled_at" is null))
);
--> statement-breakpoint
CREATE TABLE "legislation"."webhook_signing_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_signing_keys_ciphertext_check" CHECK (length("legislation"."webhook_signing_keys"."secret_ciphertext") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"owner_organization_id" text,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"event_types" text[] NOT NULL,
	"status" text DEFAULT 'pending-verification' NOT NULL,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"secret_last_four" char(4) NOT NULL,
	"overlap_ends_at" timestamp with time zone,
	"last_succeeded_at" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhooks_name_check" CHECK (length("legislation"."webhooks"."name") between 1 and 120),
	CONSTRAINT "webhooks_url_check" CHECK ("legislation"."webhooks"."url" ~ '^https://'),
	CONSTRAINT "webhooks_status_check" CHECK ("legislation"."webhooks"."status" in ('pending-verification', 'active', 'paused', 'cancelled')),
	CONSTRAINT "webhooks_cancelled_at_check" CHECK (("legislation"."webhooks"."status" = 'cancelled' and "legislation"."webhooks"."cancelled_at" is not null) or ("legislation"."webhooks"."status" <> 'cancelled' and "legislation"."webhooks"."cancelled_at" is null))
);
--> statement-breakpoint
ALTER TABLE "legislation"."subscription_deliveries" ADD CONSTRAINT "subscription_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "legislation"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "legislation"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."subscription_events" ADD CONSTRAINT "subscription_events_change_event_id_change_events_id_fk" FOREIGN KEY ("change_event_id") REFERENCES "legislation"."change_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."webhook_signing_keys" ADD CONSTRAINT "webhook_signing_keys_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "legislation"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_idempotency_records_expiry_idx" ON "legislation"."api_idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subscription_deliveries_subscription_created_idx" ON "legislation"."subscription_deliveries" USING btree ("subscription_id","created_at","id");--> statement-breakpoint
CREATE INDEX "subscription_events_subscription_matched_idx" ON "legislation"."subscription_events" USING btree ("subscription_id","matched_at","id");--> statement-breakpoint
CREATE INDEX "subscriptions_owner_updated_idx" ON "legislation"."subscriptions" USING btree ("owner_organization_id","owner_user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_exact_active_uidx" ON "legislation"."subscriptions" USING btree (coalesce("owner_organization_id", ''),"owner_user_id","target_fingerprint") WHERE "legislation"."subscriptions"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "webhook_signing_keys_active_idx" ON "legislation"."webhook_signing_keys" USING btree ("webhook_id","is_active","expires_at");--> statement-breakpoint
CREATE INDEX "webhooks_owner_updated_idx" ON "legislation"."webhooks" USING btree ("owner_organization_id","owner_user_id","updated_at");