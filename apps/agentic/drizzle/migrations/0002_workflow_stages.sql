ALTER TABLE "agentic"."workflow_runs" ADD COLUMN "stage" text DEFAULT 'intake' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_runs" ADD COLUMN "active_role" text;
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_runs" ADD CONSTRAINT "workflow_runs_stage_check" CHECK ("stage" in ('intake', 'planning', 'coding', 'reviewing', 'repairing', 'publishing', 'completed'));
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_runs" ADD CONSTRAINT "workflow_runs_active_role_check" CHECK ("active_role" is null or "active_role" in ('scrum_master', 'coder', 'reviewer', 'repairer'));
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_events" DROP CONSTRAINT "workflow_events_outcome_check";
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_events" ADD CONSTRAINT "workflow_events_outcome_check" CHECK ("outcome" in ('started', 'completed', 'failed', 'skipped', 'retried'));