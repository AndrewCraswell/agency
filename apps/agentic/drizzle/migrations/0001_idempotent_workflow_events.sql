ALTER TABLE "agentic"."workflow_events" ADD COLUMN "event_key" char(64);
--> statement-breakpoint
UPDATE "agentic"."workflow_events"
SET "event_key" = encode(sha256(("run_id"::text || ':' || "event_id"::text)::bytea), 'hex')
WHERE "event_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_events" ALTER COLUMN "event_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_events" ADD CONSTRAINT "workflow_events_event_key_check" CHECK ("event_key" ~ '^[0-9a-f]{64}$');
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_events_event_key_uidx" ON "agentic"."workflow_events" USING btree ("event_key");