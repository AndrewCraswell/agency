CREATE TABLE "agentic"."workflow_schedules" (
	"schedule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workflow_version" integer NOT NULL,
	"trigger_node_id" text NOT NULL,
	"label" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"interval_seconds" integer,
	"schedule_expression" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"last_successful_at" timestamp with time zone,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"failure_code" text,
	"failure_details" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_schedules_enabled_check" CHECK ("agentic"."workflow_schedules"."enabled" in (0, 1)),
	CONSTRAINT "workflow_schedules_revision_check" CHECK ("agentic"."workflow_schedules"."revision" > 0),
	CONSTRAINT "workflow_schedules_definition_check" CHECK (("agentic"."workflow_schedules"."interval_seconds" is not null and "agentic"."workflow_schedules"."interval_seconds" >= 10 and "agentic"."workflow_schedules"."schedule_expression" is null) or ("agentic"."workflow_schedules"."interval_seconds" is null and "agentic"."workflow_schedules"."schedule_expression" is not null))
);
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflow_id_workflow_definitions_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflow_id_workflow_version_workflow_versions_workflow_id_version_fk" FOREIGN KEY ("workflow_id","workflow_version") REFERENCES "agentic"."workflow_versions"("workflow_id","version") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_schedules_trigger_uidx" ON "agentic"."workflow_schedules" USING btree ("workflow_id","trigger_node_id");
--> statement-breakpoint
CREATE INDEX "workflow_schedules_due_idx" ON "agentic"."workflow_schedules" USING btree ("enabled","next_run_at");
--> statement-breakpoint
CREATE INDEX "workflow_schedules_lease_idx" ON "agentic"."workflow_schedules" USING btree ("lease_expires_at");