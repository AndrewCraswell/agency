ALTER TABLE "agentic"."integration_resources" DROP CONSTRAINT "integration_resources_selected_check";
--> statement-breakpoint
ALTER TABLE "agentic"."integration_resources" DROP COLUMN "selected";
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_execution_packages" (
  "package_digest" char(64) PRIMARY KEY NOT NULL,
  "workflow_id" uuid NOT NULL,
  "source_kind" text NOT NULL,
  "workflow_version" integer,
  "draft_revision" integer,
  "contract_version" text NOT NULL,
  "compiler_version" text NOT NULL,
  "compiled_plan_digest" char(64) NOT NULL,
  "content" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_execution_packages_workflow_id_workflow_definitions_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_execution_packages_version_fk" FOREIGN KEY ("workflow_id", "workflow_version") REFERENCES "agentic"."workflow_versions"("workflow_id", "version") ON DELETE RESTRICT,
  CONSTRAINT "workflow_execution_packages_digest_check" CHECK ("agentic"."workflow_execution_packages"."package_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workflow_execution_packages_plan_digest_check" CHECK ("agentic"."workflow_execution_packages"."compiled_plan_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workflow_execution_packages_source_check" CHECK (("agentic"."workflow_execution_packages"."source_kind" = 'published' and "agentic"."workflow_execution_packages"."workflow_version" > 0 and "agentic"."workflow_execution_packages"."draft_revision" is null) or ("agentic"."workflow_execution_packages"."source_kind" = 'draft_test' and "agentic"."workflow_execution_packages"."workflow_version" is null and "agentic"."workflow_execution_packages"."draft_revision" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_execution_packages_version_uidx" ON "agentic"."workflow_execution_packages" USING btree ("workflow_id", "workflow_version");
--> statement-breakpoint
CREATE INDEX "workflow_execution_packages_draft_idx" ON "agentic"."workflow_execution_packages" USING btree ("workflow_id", "draft_revision");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_journal_runs" (
  "run_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_digest" char(64) NOT NULL,
  "request_digest" char(64) NOT NULL,
  "trigger_identity" text NOT NULL,
  "sealed_manifest" jsonb NOT NULL,
  "status" text DEFAULT 'preparing' NOT NULL,
  "cancellation_generation" integer DEFAULT 0 NOT NULL,
  "latest_sequence" bigint DEFAULT 0 NOT NULL,
  "scheduler_cursor" text,
  "pending_checkpoint_cursor" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "terminal_at" timestamp with time zone,
  CONSTRAINT "workflow_journal_runs_package_digest_workflow_execution_packages_package_digest_fk" FOREIGN KEY ("package_digest") REFERENCES "agentic"."workflow_execution_packages"("package_digest") ON DELETE RESTRICT,
  CONSTRAINT "workflow_journal_runs_request_digest_check" CHECK ("agentic"."workflow_journal_runs"."request_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workflow_journal_runs_status_check" CHECK ("agentic"."workflow_journal_runs"."status" in ('preparing', 'runnable', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'abandoned')),
  CONSTRAINT "workflow_journal_runs_cancellation_check" CHECK ("agentic"."workflow_journal_runs"."cancellation_generation" >= 0),
  CONSTRAINT "workflow_journal_runs_sequence_check" CHECK ("agentic"."workflow_journal_runs"."latest_sequence" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_journal_runs_trigger_uidx" ON "agentic"."workflow_journal_runs" USING btree ("package_digest", "trigger_identity");
--> statement-breakpoint
CREATE INDEX "workflow_journal_runs_status_idx" ON "agentic"."workflow_journal_runs" USING btree ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_activations" (
  "activation_id" char(64) PRIMARY KEY NOT NULL,
  "run_id" uuid NOT NULL,
  "step_id" text NOT NULL,
  "scope" jsonb NOT NULL,
  "status" text DEFAULT 'blocked' NOT NULL,
  "input_bindings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "selected_attempt_ordinal" integer,
  "next_attempt_ordinal" integer DEFAULT 1 NOT NULL,
  "dependency_count" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_activations_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_activations_id_check" CHECK ("agentic"."workflow_activations"."activation_id" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workflow_activations_status_check" CHECK ("agentic"."workflow_activations"."status" in ('blocked', 'ready', 'leased', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT "workflow_activations_attempt_check" CHECK ("agentic"."workflow_activations"."selected_attempt_ordinal" is null or "agentic"."workflow_activations"."selected_attempt_ordinal" > 0),
  CONSTRAINT "workflow_activations_next_attempt_check" CHECK ("agentic"."workflow_activations"."next_attempt_ordinal" > 0),
  CONSTRAINT "workflow_activations_dependency_check" CHECK ("agentic"."workflow_activations"."dependency_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_activations_run_id_uidx" ON "agentic"."workflow_activations" USING btree ("run_id", "activation_id");
--> statement-breakpoint
CREATE INDEX "workflow_activations_run_status_idx" ON "agentic"."workflow_activations" USING btree ("run_id", "status", "available_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_attempts" (
  "run_id" uuid NOT NULL,
  "activation_id" char(64) NOT NULL,
  "ordinal" integer NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "fencing_token" bigint DEFAULT 0 NOT NULL,
  "lease_owner" text,
  "lease_expires_at" timestamp with time zone,
  "input" jsonb NOT NULL,
  "output" jsonb,
  "error" jsonb,
  "usage" jsonb,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  CONSTRAINT "workflow_attempts_activation_id_ordinal_pk" PRIMARY KEY("activation_id", "ordinal"),
  CONSTRAINT "workflow_attempts_activation_fk" FOREIGN KEY ("run_id", "activation_id") REFERENCES "agentic"."workflow_activations"("run_id", "activation_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_attempts_ordinal_check" CHECK ("agentic"."workflow_attempts"."ordinal" > 0),
  CONSTRAINT "workflow_attempts_status_check" CHECK ("agentic"."workflow_attempts"."status" in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'unknown')),
  CONSTRAINT "workflow_attempts_fencing_check" CHECK ("agentic"."workflow_attempts"."fencing_token" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_attempts_run_activation_ordinal_uidx" ON "agentic"."workflow_attempts" USING btree ("run_id", "activation_id", "ordinal");
--> statement-breakpoint
CREATE INDEX "workflow_attempts_lease_idx" ON "agentic"."workflow_attempts" USING btree ("status", "lease_expires_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_data" (
  "datum_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "activation_id" char(64) NOT NULL,
  "attempt_ordinal" integer NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL,
  "digest" char(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_data_attempt_fk" FOREIGN KEY ("run_id", "activation_id", "attempt_ordinal") REFERENCES "agentic"."workflow_attempts"("run_id", "activation_id", "ordinal") ON DELETE RESTRICT,
  CONSTRAINT "workflow_data_kind_check" CHECK ("agentic"."workflow_data"."kind" in ('value', 'artifact', 'external_reference', 'observation', 'secret_capability')),
  CONSTRAINT "workflow_data_digest_check" CHECK ("agentic"."workflow_data"."digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_data_producer_name_uidx" ON "agentic"."workflow_data" USING btree ("run_id", "activation_id", "attempt_ordinal", "name");
--> statement-breakpoint
CREATE INDEX "workflow_data_run_idx" ON "agentic"."workflow_data" USING btree ("run_id", "created_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_effects" (
  "effect_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "activation_id" char(64) NOT NULL,
  "effect_slot" text NOT NULL,
  "attempt_ordinal" integer,
  "provider" text NOT NULL,
  "request_digest" char(64) NOT NULL,
  "idempotency_key" text,
  "status" text DEFAULT 'prepared' NOT NULL,
  "request" jsonb NOT NULL,
  "result" jsonb,
  "reconciliation" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_effects_activation_fk" FOREIGN KEY ("run_id", "activation_id") REFERENCES "agentic"."workflow_activations"("run_id", "activation_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_effects_request_digest_check" CHECK ("agentic"."workflow_effects"."request_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workflow_effects_status_check" CHECK ("agentic"."workflow_effects"."status" in ('prepared', 'dispatching', 'confirmed', 'unknown', 'conflict', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_effects_logical_uidx" ON "agentic"."workflow_effects" USING btree ("run_id", "activation_id", "effect_slot");
--> statement-breakpoint
CREATE INDEX "workflow_effects_status_idx" ON "agentic"."workflow_effects" USING btree ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_waits" (
  "wait_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "activation_id" char(64) NOT NULL,
  "attempt_ordinal" integer NOT NULL,
  "correlation_key" text NOT NULL,
  "accepted_input_schema" jsonb NOT NULL,
  "authorization" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "consuming" integer DEFAULT 1 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "winning_event_sequence" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_waits_attempt_fk" FOREIGN KEY ("run_id", "activation_id", "attempt_ordinal") REFERENCES "agentic"."workflow_attempts"("run_id", "activation_id", "ordinal") ON DELETE RESTRICT,
  CONSTRAINT "workflow_waits_status_check" CHECK ("agentic"."workflow_waits"."status" in ('pending', 'claimed', 'resumed', 'completed', 'timed_out', 'cancelled')),
  CONSTRAINT "workflow_waits_consuming_check" CHECK ("agentic"."workflow_waits"."consuming" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_waits_correlation_uidx" ON "agentic"."workflow_waits" USING btree ("run_id", "correlation_key");
--> statement-breakpoint
CREATE INDEX "workflow_waits_pending_idx" ON "agentic"."workflow_waits" USING btree ("status", "expires_at");
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_run_events" (
  "run_id" uuid NOT NULL,
  "sequence" bigint NOT NULL,
  "transaction_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "event_version" integer NOT NULL,
  "reducer_version" text NOT NULL,
  "causation_sequence" bigint,
  "correlation_id" text,
  "activation_id" char(64),
  "attempt_ordinal" integer,
  "payload" jsonb NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_run_events_run_id_sequence_pk" PRIMARY KEY("run_id", "sequence"),
  CONSTRAINT "workflow_run_events_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_run_events_activation_fk" FOREIGN KEY ("run_id", "activation_id") REFERENCES "agentic"."workflow_activations"("run_id", "activation_id") ON DELETE RESTRICT,
  CONSTRAINT "workflow_run_events_attempt_fk" FOREIGN KEY ("run_id", "activation_id", "attempt_ordinal") REFERENCES "agentic"."workflow_attempts"("run_id", "activation_id", "ordinal") ON DELETE RESTRICT,
  CONSTRAINT "workflow_run_events_sequence_check" CHECK ("agentic"."workflow_run_events"."sequence" > 0),
  CONSTRAINT "workflow_run_events_version_check" CHECK ("agentic"."workflow_run_events"."event_version" > 0),
  CONSTRAINT "workflow_run_events_causation_check" CHECK ("agentic"."workflow_run_events"."causation_sequence" is null or "agentic"."workflow_run_events"."causation_sequence" < "agentic"."workflow_run_events"."sequence"),
  CONSTRAINT "workflow_run_events_attempt_identity_check" CHECK ("agentic"."workflow_run_events"."attempt_ordinal" is null or "agentic"."workflow_run_events"."activation_id" is not null)
);
--> statement-breakpoint
CREATE INDEX "workflow_run_events_type_idx" ON "agentic"."workflow_run_events" USING btree ("event_type", "recorded_at");
--> statement-breakpoint
CREATE INDEX "workflow_run_events_transaction_idx" ON "agentic"."workflow_run_events" USING btree ("transaction_id");