CREATE TABLE "agentic"."workflow_definitions" (
  "workflow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "draft_revision" integer DEFAULT 1 NOT NULL,
  "draft" jsonb NOT NULL,
  "published_version" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_definitions_status_check" CHECK ("agentic"."workflow_definitions"."status" in ('draft', 'published', 'archived')),
  CONSTRAINT "workflow_definitions_revision_check" CHECK ("agentic"."workflow_definitions"."draft_revision" > 0),
  CONSTRAINT "workflow_definitions_published_version_check" CHECK ("agentic"."workflow_definitions"."published_version" is null or "agentic"."workflow_definitions"."published_version" > 0)
);
--> statement-breakpoint
CREATE INDEX "workflow_definitions_status_idx" ON "agentic"."workflow_definitions" USING btree ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_versions" (
  "workflow_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "content" jsonb NOT NULL,
  "content_digest" char(64) NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_versions_workflow_id_version_pk" PRIMARY KEY("workflow_id", "version"),
  CONSTRAINT "workflow_versions_workflow_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_versions_version_check" CHECK ("agentic"."workflow_versions"."version" > 0),
  CONSTRAINT "workflow_versions_digest_check" CHECK ("agentic"."workflow_versions"."content_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_run_bindings" (
  "run_id" uuid PRIMARY KEY NOT NULL,
  "workflow_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "trigger_type" text NOT NULL,
  "trigger_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_run_bindings_run_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_run_bindings_workflow_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_run_bindings_version_check" CHECK ("agentic"."workflow_run_bindings"."version" > 0),
  CONSTRAINT "workflow_run_bindings_trigger_check" CHECK ("agentic"."workflow_run_bindings"."trigger_type" in ('manual', 'webhook', 'schedule'))
);
--> statement-breakpoint
CREATE INDEX "workflow_run_bindings_workflow_idx" ON "agentic"."workflow_run_bindings" USING btree ("workflow_id", "version", "created_at");