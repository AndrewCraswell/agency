CREATE TABLE "agentic"."review_cycles" (
  "run_id" uuid NOT NULL,
  "review_round" integer NOT NULL,
  "candidate_commit_sha" char(40) NOT NULL,
  "reviewer_agent_id" text NOT NULL,
  "status" text NOT NULL,
  "reviewer_workspace_id" text,
  "findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "review_cycles_run_round_pk" PRIMARY KEY("run_id", "review_round"),
  CONSTRAINT "review_cycles_run_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE RESTRICT,
  CONSTRAINT "review_cycles_round_check" CHECK ("review_round" between 1 and 3),
  CONSTRAINT "review_cycles_commit_check" CHECK ("candidate_commit_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "review_cycles_status_check" CHECK ("status" in ('queued', 'running', 'approved', 'changes_requested', 'blocked', 'merged', 'abandoned'))
);
CREATE INDEX "review_cycles_status_idx" ON "agentic"."review_cycles" USING btree ("status", "updated_at");
CREATE INDEX "review_cycles_candidate_idx" ON "agentic"."review_cycles" USING btree ("candidate_commit_sha");