CREATE SCHEMA "agentic";
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
	CONSTRAINT "artifact_records_role_check" CHECK ("agentic"."artifact_records"."role" in ('scrum_master', 'coder', 'reviewer', 'repairer')),
	CONSTRAINT "artifact_records_role_attempt_check" CHECK ("agentic"."artifact_records"."role_attempt" > 0),
	CONSTRAINT "artifact_records_sha256_check" CHECK ("agentic"."artifact_records"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "artifact_records_byte_length_check" CHECK ("agentic"."artifact_records"."byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agentic"."integration_connections" (
	"connection_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_config_key" text NOT NULL,
	"nango_connection_id" text NOT NULL,
	"display_name" text,
	"status" text NOT NULL,
	"error_code" text,
	"last_checked_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connections_provider_check" CHECK ("agentic"."integration_connections"."provider" in ('github', 'linear')),
	CONSTRAINT "integration_connections_status_check" CHECK ("agentic"."integration_connections"."status" in ('connected', 'degraded', 'disconnected'))
);
--> statement-breakpoint
CREATE TABLE "agentic"."integration_resources" (
	"connection_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"stale" integer DEFAULT 0 NOT NULL,
	"last_discovered_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_resources_connection_id_resource_type_external_id_pk" PRIMARY KEY("connection_id","resource_type","external_id"),
	CONSTRAINT "integration_resources_type_check" CHECK ("agentic"."integration_resources"."resource_type" in ('repository', 'team')),
	CONSTRAINT "integration_resources_stale_check" CHECK ("agentic"."integration_resources"."stale" in (0, 1))
);
--> statement-breakpoint
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
	CONSTRAINT "review_cycles_run_id_review_round_pk" PRIMARY KEY("run_id","review_round"),
	CONSTRAINT "review_cycles_round_check" CHECK ("agentic"."review_cycles"."review_round" between 1 and 3),
	CONSTRAINT "review_cycles_commit_check" CHECK ("agentic"."review_cycles"."candidate_commit_sha" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "review_cycles_status_check" CHECK ("agentic"."review_cycles"."status" in ('queued', 'running', 'approved', 'changes_requested', 'blocked', 'merged', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "agentic"."runtime_selections" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"selection" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentic"."webhook_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"action" text,
	"installation_id" text,
	"repository_owner" text,
	"repository_name" text,
	"payload_digest" char(64) NOT NULL,
	"raw_payload" text NOT NULL,
	"normalized_envelope" jsonb NOT NULL,
	"processing_status" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"received_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_provider_check" CHECK ("agentic"."webhook_deliveries"."provider" = 'github'),
	CONSTRAINT "webhook_deliveries_digest_check" CHECK ("agentic"."webhook_deliveries"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "webhook_deliveries_status_check" CHECK ("agentic"."webhook_deliveries"."processing_status" in ('normalized', 'dispatching', 'dispatched', 'ignored', 'failed', 'quarantined')),
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK ("agentic"."webhook_deliveries"."attempt_count" >= 0)
);
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
	CONSTRAINT "workflow_activations_id_check" CHECK ("agentic"."workflow_activations"."activation_id" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_activations_status_check" CHECK ("agentic"."workflow_activations"."status" in ('blocked', 'ready', 'leased', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "workflow_activations_attempt_check" CHECK ("agentic"."workflow_activations"."selected_attempt_ordinal" is null or "agentic"."workflow_activations"."selected_attempt_ordinal" > 0),
	CONSTRAINT "workflow_activations_next_attempt_check" CHECK ("agentic"."workflow_activations"."next_attempt_ordinal" > 0),
	CONSTRAINT "workflow_activations_dependency_check" CHECK ("agentic"."workflow_activations"."dependency_count" >= 0)
);
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
	CONSTRAINT "workflow_attempts_activation_id_ordinal_pk" PRIMARY KEY("activation_id","ordinal"),
	CONSTRAINT "workflow_attempts_ordinal_check" CHECK ("agentic"."workflow_attempts"."ordinal" > 0),
	CONSTRAINT "workflow_attempts_status_check" CHECK ("agentic"."workflow_attempts"."status" in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'unknown')),
	CONSTRAINT "workflow_attempts_fencing_check" CHECK ("agentic"."workflow_attempts"."fencing_token" >= 0)
);
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
	CONSTRAINT "workflow_data_kind_check" CHECK ("agentic"."workflow_data"."kind" in ('value', 'artifact', 'external_reference', 'observation', 'secret_capability')),
	CONSTRAINT "workflow_data_digest_check" CHECK ("agentic"."workflow_data"."digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
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
	CONSTRAINT "workflow_effects_request_digest_check" CHECK ("agentic"."workflow_effects"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_effects_status_check" CHECK ("agentic"."workflow_effects"."status" in ('prepared', 'dispatching', 'confirmed', 'unknown', 'conflict', 'failed', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_events" (
	"event_id" bigserial PRIMARY KEY NOT NULL,
	"event_key" char(64) NOT NULL,
	"run_id" uuid NOT NULL,
	"node" text NOT NULL,
	"outcome" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_events_event_key_check" CHECK ("agentic"."workflow_events"."event_key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_events_outcome_check" CHECK ("agentic"."workflow_events"."outcome" in ('started', 'completed', 'failed', 'skipped', 'retried'))
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_execution_packages" (
	"package_digest" char(64) PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workflow_version" integer NOT NULL,
	"contract_version" text NOT NULL,
	"compiler_version" text NOT NULL,
	"compiled_plan_digest" char(64) NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_execution_packages_digest_check" CHECK ("agentic"."workflow_execution_packages"."package_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_execution_packages_plan_digest_check" CHECK ("agentic"."workflow_execution_packages"."compiled_plan_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_execution_packages_version_check" CHECK ("agentic"."workflow_execution_packages"."workflow_version" > 0)
);
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
	CONSTRAINT "workflow_journal_runs_request_digest_check" CHECK ("agentic"."workflow_journal_runs"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_journal_runs_status_check" CHECK ("agentic"."workflow_journal_runs"."status" in ('preparing', 'runnable', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'abandoned')),
	CONSTRAINT "workflow_journal_runs_cancellation_check" CHECK ("agentic"."workflow_journal_runs"."cancellation_generation" >= 0),
	CONSTRAINT "workflow_journal_runs_sequence_check" CHECK ("agentic"."workflow_journal_runs"."latest_sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_run_bindings" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_run_bindings_version_check" CHECK ("agentic"."workflow_run_bindings"."version" > 0),
	CONSTRAINT "workflow_run_bindings_trigger_check" CHECK ("agentic"."workflow_run_bindings"."trigger_type" in ('manual', 'webhook', 'schedule'))
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_run_events" (
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_parent_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_child_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("child_run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_child_package_digest_workflow_execution_packages_package_digest_fk" FOREIGN KEY ("child_package_digest") REFERENCES "agentic"."workflow_execution_packages"("package_digest") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_parent_activation_fk" FOREIGN KEY ("parent_run_id","parent_activation_id") REFERENCES "agentic"."workflow_activations"("run_id","activation_id") ON DELETE restrict ON UPDATE no action;
CREATE UNIQUE INDEX "workflow_run_links_child_uidx" ON "agentic"."workflow_run_links" USING btree ("child_run_id");
	"reducer_version" text NOT NULL,
	"causation_sequence" bigint,
	"correlation_id" text,
	"activation_id" char(64),
	"attempt_ordinal" integer,
	"payload" jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_run_events_run_id_sequence_pk" PRIMARY KEY("run_id","sequence"),
	CONSTRAINT "workflow_run_events_sequence_check" CHECK ("agentic"."workflow_run_events"."sequence" > 0),
	CONSTRAINT "workflow_run_events_version_check" CHECK ("agentic"."workflow_run_events"."event_version" > 0),
	CONSTRAINT "workflow_run_events_causation_check" CHECK ("agentic"."workflow_run_events"."causation_sequence" is null or "agentic"."workflow_run_events"."causation_sequence" < "agentic"."workflow_run_events"."sequence"),
	CONSTRAINT "workflow_run_events_attempt_identity_check" CHECK ("agentic"."workflow_run_events"."attempt_ordinal" is null or "agentic"."workflow_run_events"."activation_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_run_links" (
	"parent_run_id" uuid NOT NULL,
	"parent_activation_id" char(64) NOT NULL,
	"child_run_id" uuid NOT NULL,
	"child_package_digest" char(64) NOT NULL,
	"interface_digest" char(64) NOT NULL,
	"terminal_status" text,
	"result" jsonb,
	"error" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_run_links_parent_run_id_parent_activation_id_pk" PRIMARY KEY("parent_run_id","parent_activation_id"),
	CONSTRAINT "workflow_run_links_parent_activation_check" CHECK ("agentic"."workflow_run_links"."parent_activation_id" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_run_links_package_digest_check" CHECK ("agentic"."workflow_run_links"."child_package_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_run_links_interface_digest_check" CHECK ("agentic"."workflow_run_links"."interface_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_run_links_terminal_status_check" CHECK ("agentic"."workflow_run_links"."terminal_status" is null or "agentic"."workflow_run_links"."terminal_status" in ('succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_runs" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"request_digest" char(64) NOT NULL,
	"status" text NOT NULL,
	"stage" text NOT NULL,
	"active_role" text,
	"graph_version" text NOT NULL,
	"repository_owner" text NOT NULL,
	"repository_name" text NOT NULL,
	"source_work_item_id" uuid,
	"source_work_item_identifier" text,
	"assigned_agent_id" text,
	"pull_request_number" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_runs_status_check" CHECK ("agentic"."workflow_runs"."status" in ('queued', 'running', 'blocked', 'failed', 'cancelled', 'published')),
	CONSTRAINT "workflow_runs_stage_check" CHECK ("agentic"."workflow_runs"."stage" in ('intake', 'planning', 'coding', 'reviewing', 'repairing', 'publishing', 'completed')),
	CONSTRAINT "workflow_runs_active_role_check" CHECK ("agentic"."workflow_runs"."active_role" is null or "agentic"."workflow_runs"."active_role" in ('scrum_master', 'coder', 'reviewer', 'repairer')),
	CONSTRAINT "workflow_runs_request_digest_check" CHECK ("agentic"."workflow_runs"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_runs_retry_count_check" CHECK ("agentic"."workflow_runs"."retry_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agentic"."workflow_versions" (
	"workflow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"content_digest" char(64) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_versions_workflow_id_version_pk" PRIMARY KEY("workflow_id","version"),
	CONSTRAINT "workflow_versions_version_check" CHECK ("agentic"."workflow_versions"."version" > 0),
	CONSTRAINT "workflow_versions_digest_check" CHECK ("agentic"."workflow_versions"."content_digest" ~ '^[0-9a-f]{64}$')
);
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
	CONSTRAINT "workflow_waits_status_check" CHECK ("agentic"."workflow_waits"."status" in ('pending', 'claimed', 'resumed', 'timed_out', 'cancelled')),
	CONSTRAINT "workflow_waits_consuming_check" CHECK ("agentic"."workflow_waits"."consuming" in (0, 1))
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
	CONSTRAINT "workspace_leases_provider_check" CHECK ("agentic"."workspace_leases"."provider" in ('daytona', 'azure')),
	CONSTRAINT "workspace_leases_role_check" CHECK ("agentic"."workspace_leases"."role" in ('scrum_master', 'coder', 'reviewer', 'repairer')),
	CONSTRAINT "workspace_leases_lifecycle_check" CHECK ("agentic"."workspace_leases"."lifecycle_state" in ('creating', 'running', 'stopped', 'archived', 'deleted', 'failed')),
	CONSTRAINT "workspace_leases_role_attempt_check" CHECK ("agentic"."workspace_leases"."role_attempt" > 0),
	CONSTRAINT "workspace_leases_version_check" CHECK ("agentic"."workspace_leases"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "agentic"."artifact_records" ADD CONSTRAINT "artifact_records_run_id_workflow_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."integration_resources" ADD CONSTRAINT "integration_resources_connection_id_integration_connections_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "agentic"."integration_connections"("connection_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."review_cycles" ADD CONSTRAINT "review_cycles_run_id_workflow_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."runtime_selections" ADD CONSTRAINT "runtime_selections_run_id_workflow_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_activations" ADD CONSTRAINT "workflow_activations_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_attempts" ADD CONSTRAINT "workflow_attempts_activation_fk" FOREIGN KEY ("run_id","activation_id") REFERENCES "agentic"."workflow_activations"("run_id","activation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_data" ADD CONSTRAINT "workflow_data_attempt_fk" FOREIGN KEY ("run_id","activation_id","attempt_ordinal") REFERENCES "agentic"."workflow_attempts"("run_id","activation_id","ordinal") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_effects" ADD CONSTRAINT "workflow_effects_activation_fk" FOREIGN KEY ("run_id","activation_id") REFERENCES "agentic"."workflow_activations"("run_id","activation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_events" ADD CONSTRAINT "workflow_events_run_id_workflow_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_execution_packages" ADD CONSTRAINT "workflow_execution_packages_workflow_id_workflow_definitions_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_execution_packages" ADD CONSTRAINT "workflow_execution_packages_version_fk" FOREIGN KEY ("workflow_id","workflow_version") REFERENCES "agentic"."workflow_versions"("workflow_id","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_journal_runs" ADD CONSTRAINT "workflow_journal_runs_package_digest_workflow_execution_packages_package_digest_fk" FOREIGN KEY ("package_digest") REFERENCES "agentic"."workflow_execution_packages"("package_digest") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_bindings" ADD CONSTRAINT "workflow_run_bindings_run_id_workflow_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_bindings" ADD CONSTRAINT "workflow_run_bindings_workflow_id_workflow_definitions_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_activation_fk" FOREIGN KEY ("run_id","activation_id") REFERENCES "agentic"."workflow_activations"("run_id","activation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_attempt_fk" FOREIGN KEY ("run_id","activation_id","attempt_ordinal") REFERENCES "agentic"."workflow_attempts"("run_id","activation_id","ordinal") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_parent_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_child_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("child_run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_child_package_digest_workflow_execution_packages_package_digest_fk" FOREIGN KEY ("child_package_digest") REFERENCES "agentic"."workflow_execution_packages"("package_digest") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_parent_activation_fk" FOREIGN KEY ("parent_run_id","parent_activation_id") REFERENCES "agentic"."workflow_activations"("run_id","activation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_workflow_definitions_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "agentic"."workflow_definitions"("workflow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_waits" ADD CONSTRAINT "workflow_waits_attempt_fk" FOREIGN KEY ("run_id","activation_id","attempt_ordinal") REFERENCES "agentic"."workflow_attempts"("run_id","activation_id","ordinal") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workspace_leases" ADD CONSTRAINT "workspace_leases_run_id_workflow_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "agentic"."workflow_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_records_run_role_attempt_uri_uidx" ON "agentic"."artifact_records" USING btree ("run_id","role","role_attempt","uri");--> statement-breakpoint
CREATE INDEX "artifact_records_run_idx" ON "agentic"."artifact_records" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_nango_uidx" ON "agentic"."integration_connections" USING btree ("provider_config_key","nango_connection_id");--> statement-breakpoint
CREATE INDEX "integration_connections_provider_idx" ON "agentic"."integration_connections" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "integration_resources_connection_idx" ON "agentic"."integration_resources" USING btree ("connection_id","resource_type");--> statement-breakpoint
CREATE INDEX "review_cycles_status_idx" ON "agentic"."review_cycles" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "review_cycles_candidate_idx" ON "agentic"."review_cycles" USING btree ("candidate_commit_sha");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_received_idx" ON "agentic"."webhook_deliveries" USING btree ("processing_status","received_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_repository_idx" ON "agentic"."webhook_deliveries" USING btree ("repository_owner","repository_name");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_activations_run_id_uidx" ON "agentic"."workflow_activations" USING btree ("run_id","activation_id");--> statement-breakpoint
CREATE INDEX "workflow_activations_run_status_idx" ON "agentic"."workflow_activations" USING btree ("run_id","status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_attempts_run_activation_ordinal_uidx" ON "agentic"."workflow_attempts" USING btree ("run_id","activation_id","ordinal");--> statement-breakpoint
CREATE INDEX "workflow_attempts_lease_idx" ON "agentic"."workflow_attempts" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_data_producer_name_uidx" ON "agentic"."workflow_data" USING btree ("run_id","activation_id","attempt_ordinal","name");--> statement-breakpoint
CREATE INDEX "workflow_data_run_idx" ON "agentic"."workflow_data" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_definitions_status_idx" ON "agentic"."workflow_definitions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_effects_logical_uidx" ON "agentic"."workflow_effects" USING btree ("run_id","activation_id","effect_slot");--> statement-breakpoint
CREATE INDEX "workflow_effects_status_idx" ON "agentic"."workflow_effects" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_events_event_key_uidx" ON "agentic"."workflow_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "workflow_events_run_created_idx" ON "agentic"."workflow_events" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_execution_packages_version_uidx" ON "agentic"."workflow_execution_packages" USING btree ("workflow_id","workflow_version");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_journal_runs_trigger_uidx" ON "agentic"."workflow_journal_runs" USING btree ("package_digest","trigger_identity");--> statement-breakpoint
CREATE INDEX "workflow_journal_runs_status_idx" ON "agentic"."workflow_journal_runs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "workflow_run_bindings_workflow_idx" ON "agentic"."workflow_run_bindings" USING btree ("workflow_id","version","created_at");--> statement-breakpoint
CREATE INDEX "workflow_run_events_type_idx" ON "agentic"."workflow_run_events" USING btree ("event_type","recorded_at");--> statement-breakpoint
CREATE INDEX "workflow_run_events_transaction_idx" ON "agentic"."workflow_run_events" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_links_child_uidx" ON "agentic"."workflow_run_links" USING btree ("child_run_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_status_idx" ON "agentic"."workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_runs_repository_idx" ON "agentic"."workflow_runs" USING btree ("repository_owner","repository_name");--> statement-breakpoint
CREATE INDEX "workflow_runs_assigned_agent_idx" ON "agentic"."workflow_runs" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_pull_request_idx" ON "agentic"."workflow_runs" USING btree ("pull_request_number");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_waits_correlation_uidx" ON "agentic"."workflow_waits" USING btree ("run_id","correlation_key");--> statement-breakpoint
CREATE INDEX "workflow_waits_pending_idx" ON "agentic"."workflow_waits" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_leases_provider_workspace_uidx" ON "agentic"."workspace_leases" USING btree ("provider","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_leases_run_role_attempt_uidx" ON "agentic"."workspace_leases" USING btree ("run_id","role","role_attempt");--> statement-breakpoint
CREATE INDEX "workspace_leases_run_idx" ON "agentic"."workspace_leases" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workspace_leases_retention_idx" ON "agentic"."workspace_leases" USING btree ("retention_until");