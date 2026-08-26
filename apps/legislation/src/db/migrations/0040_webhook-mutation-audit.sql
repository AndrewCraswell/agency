CREATE TABLE "legislation"."webhook_audit_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_organization_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_audit_records_action_check" CHECK (length("legislation"."webhook_audit_records"."action") > 0),
	CONSTRAINT "webhook_audit_records_actor_check" CHECK (length("legislation"."webhook_audit_records"."actor_user_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "legislation"."webhook_audit_records" ADD CONSTRAINT "webhook_audit_records_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "legislation"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "webhook_audit_records_webhook_occurred_idx" ON "legislation"."webhook_audit_records" USING btree ("webhook_id","occurred_at","id");
