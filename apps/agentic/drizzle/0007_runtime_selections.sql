CREATE TABLE "agentic"."runtime_selections" (
  "run_id" uuid PRIMARY KEY NOT NULL,
  "selection" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "runtime_selections_run_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE RESTRICT
);
INSERT INTO "agentic"."runtime_selections" ("run_id", "selection", "created_at")
SELECT
  "run_id",
  '{"agentRuntime":{"provider":"openhands","version":"ghcr.io/openhands/agent-server@sha256:6301c75380733e83c7291a9a258de5fc04a99d940894db7b157e845a8cc03dcc"},"decisions":{"phase8":{"code":"no-approved-microsoft-candidate-or-parity-evidence","evidence":"docs/agent-platform/phase-8-microsoft-hosted-agent-runtime.md#41-capability-and-responsibility-assessment","status":"deferred"},"phase9":{"code":"no-qualifying-azure-workspace-entry-driver","evidence":"docs/agent-platform/phase-9-azure-native-workspaces.md#2-entry-gate","status":"deferred"}},"orchestrator":{"provider":"langgraph","version":"1.4.7"},"selectionVersion":1,"workspace":{"provider":"daytona","version":"0.196.0"}}'::jsonb,
  "created_at"
FROM "agentic"."workflow_runs";