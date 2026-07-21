ALTER TABLE "agentic"."workflow_runs" ADD COLUMN "assigned_agent_id" text;
CREATE INDEX "workflow_runs_assigned_agent_idx" ON "agentic"."workflow_runs" USING btree ("assigned_agent_id");
CREATE UNIQUE INDEX "workflow_runs_active_agent_uidx" ON "agentic"."workflow_runs" USING btree ("assigned_agent_id")
WHERE "assigned_agent_id" IS NOT NULL AND "status" IN ('queued', 'running');
