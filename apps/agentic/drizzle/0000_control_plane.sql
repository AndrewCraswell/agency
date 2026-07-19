CREATE SCHEMA IF NOT EXISTS "agentic";
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_runs" (
  "run_id" uuid PRIMARY KEY NOT NULL,
  "request_digest" char(64) NOT NULL,
  "status" text NOT NULL,
  "graph_version" text NOT NULL,
  "repository_owner" text NOT NULL,
  "repository_name" text NOT NULL,
  "source_work_item_id" uuid,
  "source_work_item_identifier" text,
  "pull_request_number" integer,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_runs_status_check" CHECK ("status" in ('queued', 'running', 'blocked', 'failed', 'cancelled', 'published')),
  CONSTRAINT "workflow_runs_request_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workflow_runs_retry_count_check" CHECK ("retry_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agentic"."workspace_leases" (
  "provider" text NOT NULL,
  "workspace_id" text NOT NULL,
  "run_id" uuid NOT NULL,
  "role" text NOT NULL,
  "role_attempt" integer NOT NULL,
  "lifecycle_state" text NOT NULL,
  "labels" jsonb NOT NULL,
  "conversation_id" text,
  "profile_name" text,
  "retention_until" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_leases_provider_check" CHECK ("provider" in ('daytona', 'azure')),
  CONSTRAINT "workspace_leases_role_check" CHECK ("role" in ('scrum_master', 'coder', 'reviewer', 'repairer')),
  CONSTRAINT "workspace_leases_lifecycle_check" CHECK ("lifecycle_state" in ('creating', 'running', 'stopped', 'archived', 'deleted', 'failed')),
  CONSTRAINT "workspace_leases_role_attempt_check" CHECK ("role_attempt" > 0),
  CONSTRAINT "workspace_leases_version_check" CHECK ("version" >= 0),
  CONSTRAINT "workspace_leases_workflow_run_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE "agentic"."artifact_records" (
  "artifact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "role" text NOT NULL,
  "role_attempt" integer NOT NULL,
  "artifact_type" text NOT NULL,
  "uri" text NOT NULL,
  "sha256" char(64) NOT NULL,
  "media_type" text NOT NULL,
  "byte_length" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artifact_records_role_check" CHECK ("role" in ('scrum_master', 'coder', 'reviewer', 'repairer')),
  CONSTRAINT "artifact_records_role_attempt_check" CHECK ("role_attempt" > 0),
  CONSTRAINT "artifact_records_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "artifact_records_byte_length_check" CHECK ("byte_length" >= 0),
  CONSTRAINT "artifact_records_workflow_run_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_events" (
  "event_id" bigserial PRIMARY KEY NOT NULL,
  "run_id" uuid NOT NULL,
  "node" text NOT NULL,
  "outcome" text NOT NULL,
  "summary" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_events_outcome_check" CHECK ("outcome" in ('completed', 'failed', 'skipped', 'retried')),
  CONSTRAINT "workflow_events_workflow_run_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX "workflow_runs_status_idx" ON "agentic"."workflow_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "workflow_runs_repository_idx" ON "agentic"."workflow_runs" USING btree ("repository_owner", "repository_name");
--> statement-breakpoint
CREATE INDEX "workflow_runs_pull_request_idx" ON "agentic"."workflow_runs" USING btree ("pull_request_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_leases_provider_workspace_uidx" ON "agentic"."workspace_leases" USING btree ("provider", "workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_leases_run_role_attempt_uidx" ON "agentic"."workspace_leases" USING btree ("run_id", "role", "role_attempt");
--> statement-breakpoint
CREATE INDEX "workspace_leases_run_idx" ON "agentic"."workspace_leases" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "workspace_leases_retention_idx" ON "agentic"."workspace_leases" USING btree ("retention_until");
--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_records_run_role_attempt_uri_uidx" ON "agentic"."artifact_records" USING btree ("run_id", "role", "role_attempt", "uri");
--> statement-breakpoint
CREATE INDEX "artifact_records_run_idx" ON "agentic"."artifact_records" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "workflow_events_run_created_idx" ON "agentic"."workflow_events" USING btree ("run_id", "created_at");