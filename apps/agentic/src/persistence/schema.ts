import { sql } from "drizzle-orm"
import {
  bigint,
  bigserial,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"
import type { RuntimeSelection } from "../contracts/runtimeSelection"
import type { WorkflowContent } from "../workflows/contracts"
import type { ActivationScopeSegment, ExecutionPackageContent } from "../workflows/executionContracts"

export const agenticSchema = pgSchema("agentic")

export const integrationConnections = agenticSchema.table(
  "integration_connections",
  {
    connectionId: uuid("connection_id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerConfigKey: text("provider_config_key").notNull(),
    nangoConnectionId: text("nango_connection_id").notNull(),
    displayName: text("display_name"),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("integration_connections_provider_check", sql`${table.provider} in ('github', 'linear')`),
    check("integration_connections_status_check", sql`${table.status} in ('connected', 'degraded', 'disconnected')`),
    uniqueIndex("integration_connections_nango_uidx").on(table.providerConfigKey, table.nangoConnectionId),
    index("integration_connections_provider_idx").on(table.provider, table.status)
  ]
)

export const integrationResources = agenticSchema.table(
  "integration_resources",
  {
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.connectionId, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    stale: integer("stale").notNull().default(0),
    lastDiscoveredAt: timestamp("last_discovered_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.connectionId, table.resourceType, table.externalId] }),
    check("integration_resources_type_check", sql`${table.resourceType} in ('repository', 'team')`),
    check("integration_resources_stale_check", sql`${table.stale} in (0, 1)`),
    index("integration_resources_connection_idx").on(table.connectionId, table.resourceType)
  ]
)

export const workflowDefinitions = agenticSchema.table(
  "workflow_definitions",
  {
    workflowId: uuid("workflow_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("draft"),
    draftRevision: integer("draft_revision").notNull().default(1),
    draft: jsonb("draft").$type<WorkflowContent>().notNull(),
    activePublishedVersion: integer("active_published_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("workflow_definitions_status_check", sql`${table.status} in ('draft', 'archived')`),
    check("workflow_definitions_revision_check", sql`${table.draftRevision} > 0`),
    check(
      "workflow_definitions_active_published_version_check",
      sql`${table.activePublishedVersion} is null or ${table.activePublishedVersion} > 0`
    ),
    index("workflow_definitions_status_idx").on(table.status, table.updatedAt)
  ]
)

export const workflowVersions = agenticSchema.table(
  "workflow_versions",
  {
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowDefinitions.workflowId, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<WorkflowContent>().notNull(),
    contentDigest: char("content_digest", { length: 64 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.workflowId, table.version] }),
    check("workflow_versions_version_check", sql`${table.version} > 0`),
    check("workflow_versions_digest_check", sql`${table.contentDigest} ~ '^[0-9a-f]{64}$'`)
  ]
)

export const workflowSchedules = agenticSchema.table(
  "workflow_schedules",
  {
    scheduleId: uuid("schedule_id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowDefinitions.workflowId, { onDelete: "cascade" }),
    workflowVersion: integer("workflow_version").notNull(),
    triggerNodeId: text("trigger_node_id").notNull(),
    label: text("label").notNull(),
    enabled: integer("enabled").notNull().default(1),
    intervalSeconds: integer("interval_seconds"),
    scheduleExpression: text("schedule_expression"),
    timezone: text("timezone").notNull().default("UTC"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureDetails: text("failure_details"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.workflowId, table.workflowVersion],
      foreignColumns: [workflowVersions.workflowId, workflowVersions.version]
    }).onDelete("cascade"),
    check("workflow_schedules_enabled_check", sql`${table.enabled} in (0, 1)`),
    check("workflow_schedules_revision_check", sql`${table.revision} > 0`),
    check(
      "workflow_schedules_definition_check",
      sql`(${table.intervalSeconds} is not null and ${table.intervalSeconds} >= 10 and ${table.scheduleExpression} is null) or (${table.intervalSeconds} is null and ${table.scheduleExpression} is not null)`
    ),
    uniqueIndex("workflow_schedules_trigger_uidx").on(table.workflowId, table.triggerNodeId),
    index("workflow_schedules_due_idx").on(table.enabled, table.nextRunAt),
    index("workflow_schedules_lease_idx").on(table.leaseExpiresAt)
  ]
)

export const workflowScheduleOccurrences = agenticSchema.table(
  "workflow_schedule_occurrences",
  {
    occurrenceId: text("occurrence_id").primaryKey(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => workflowSchedules.scheduleId, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default("dispatching"),
    attemptCount: integer("attempt_count").notNull().default(1),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    latenessMs: integer("lateness_ms").notNull(),
    disposition: text("disposition").notNull(),
    runId: uuid("run_id"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("workflow_schedule_occurrences_status_check", sql`${table.status} in ('dispatching', 'started', 'failed')`),
    check("workflow_schedule_occurrences_attempt_check", sql`${table.attemptCount} > 0`),
    check("workflow_schedule_occurrences_lateness_check", sql`${table.latenessMs} >= 0`),
    uniqueIndex("workflow_schedule_occurrences_schedule_time_uidx").on(table.scheduleId, table.scheduledAt),
    index("workflow_schedule_occurrences_schedule_created_idx").on(table.scheduleId, table.createdAt)
  ]
)

export const workflowRuns = agenticSchema.table(
  "workflow_runs",
  {
    runId: uuid("run_id").primaryKey(),
    requestDigest: char("request_digest", { length: 64 }).notNull(),
    status: text("status").notNull(),
    stage: text("stage").notNull(),
    activeRole: text("active_role"),
    graphVersion: text("graph_version").notNull(),
    repositoryOwner: text("repository_owner").notNull(),
    repositoryName: text("repository_name").notNull(),
    sourceWorkItemId: uuid("source_work_item_id"),
    sourceWorkItemIdentifier: text("source_work_item_identifier"),
    assignedAgentId: text("assigned_agent_id"),
    pullRequestNumber: integer("pull_request_number"),
    retryCount: integer("retry_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check(
      "workflow_runs_status_check",
      sql`${table.status} in ('queued', 'running', 'blocked', 'failed', 'cancelled', 'published')`
    ),
    check(
      "workflow_runs_stage_check",
      sql`${table.stage} in ('intake', 'planning', 'coding', 'reviewing', 'repairing', 'publishing', 'completed')`
    ),
    check(
      "workflow_runs_active_role_check",
      sql`${table.activeRole} is null or ${table.activeRole} in ('scrum_master', 'coder', 'reviewer', 'repairer')`
    ),
    check("workflow_runs_request_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
    check("workflow_runs_retry_count_check", sql`${table.retryCount} >= 0`),
    index("workflow_runs_status_idx").on(table.status),
    index("workflow_runs_repository_idx").on(table.repositoryOwner, table.repositoryName),
    index("workflow_runs_assigned_agent_idx").on(table.assignedAgentId),
    index("workflow_runs_pull_request_idx").on(table.pullRequestNumber)
  ]
)

export const runtimeSelections = agenticSchema.table("runtime_selections", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => workflowRuns.runId, { onDelete: "restrict" }),
  selection: jsonb("selection").$type<RuntimeSelection>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const workflowRunBindings = agenticSchema.table(
  "workflow_run_bindings",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => workflowRuns.runId, { onDelete: "restrict" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowDefinitions.workflowId, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    triggerType: text("trigger_type").notNull(),
    triggerKey: text("trigger_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("workflow_run_bindings_version_check", sql`${table.version} > 0`),
    check("workflow_run_bindings_trigger_check", sql`${table.triggerType} in ('manual', 'webhook', 'schedule')`),
    index("workflow_run_bindings_workflow_idx").on(table.workflowId, table.version, table.createdAt)
  ]
)

export const workflowExecutionPackages = agenticSchema.table(
  "workflow_execution_packages",
  {
    packageDigest: char("package_digest", { length: 64 }).primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowDefinitions.workflowId, { onDelete: "restrict" }),
    sourceKind: text("source_kind").notNull(),
    workflowVersion: integer("workflow_version"),
    draftRevision: integer("draft_revision"),
    contractVersion: text("contract_version").notNull(),
    compilerVersion: text("compiler_version").notNull(),
    compiledPlanDigest: char("compiled_plan_digest", { length: 64 }).notNull(),
    content: jsonb("content").$type<ExecutionPackageContent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.workflowId, table.workflowVersion],
      foreignColumns: [workflowVersions.workflowId, workflowVersions.version],
      name: "workflow_execution_packages_version_fk"
    }).onDelete("restrict"),
    check("workflow_execution_packages_digest_check", sql`${table.packageDigest} ~ '^[0-9a-f]{64}$'`),
    check("workflow_execution_packages_plan_digest_check", sql`${table.compiledPlanDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "workflow_execution_packages_source_check",
      sql`(${table.sourceKind} = 'published' and ${table.workflowVersion} > 0 and ${table.draftRevision} is null) or (${table.sourceKind} = 'draft_test' and ${table.workflowVersion} is null and ${table.draftRevision} > 0)`
    ),
    uniqueIndex("workflow_execution_packages_version_uidx").on(table.workflowId, table.workflowVersion),
    index("workflow_execution_packages_draft_idx").on(table.workflowId, table.draftRevision)
  ]
)

export const workflowJournalRuns = agenticSchema.table(
  "workflow_journal_runs",
  {
    runId: uuid("run_id").primaryKey().defaultRandom(),
    packageDigest: char("package_digest", { length: 64 })
      .notNull()
      .references(() => workflowExecutionPackages.packageDigest, { onDelete: "restrict" }),
    requestDigest: char("request_digest", { length: 64 }).notNull(),
    triggerIdentity: text("trigger_identity").notNull(),
    sealedManifest: jsonb("sealed_manifest").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("preparing"),
    cancellationGeneration: integer("cancellation_generation").notNull().default(0),
    latestSequence: bigint("latest_sequence", { mode: "number" }).notNull().default(0),
    schedulerCursor: text("scheduler_cursor"),
    pendingCheckpointCursor: text("pending_checkpoint_cursor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    terminalAt: timestamp("terminal_at", { withTimezone: true })
  },
  (table) => [
    check("workflow_journal_runs_request_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "workflow_journal_runs_status_check",
      sql`${table.status} in ('preparing', 'runnable', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'abandoned')`
    ),
    check("workflow_journal_runs_cancellation_check", sql`${table.cancellationGeneration} >= 0`),
    check("workflow_journal_runs_sequence_check", sql`${table.latestSequence} >= 0`),
    uniqueIndex("workflow_journal_runs_trigger_uidx").on(table.packageDigest, table.triggerIdentity),
    index("workflow_journal_runs_status_idx").on(table.status, table.updatedAt)
  ]
)

export const workflowActivations = agenticSchema.table(
  "workflow_activations",
  {
    activationId: char("activation_id", { length: 64 }).primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowJournalRuns.runId, { onDelete: "restrict" }),
    stepId: text("step_id").notNull(),
    scope: jsonb("scope").$type<ActivationScopeSegment[]>().notNull(),
    status: text("status").notNull().default("blocked"),
    inputBindings: jsonb("input_bindings").$type<Record<string, unknown>>().notNull().default({}),
    selectedAttemptOrdinal: integer("selected_attempt_ordinal"),
    nextAttemptOrdinal: integer("next_attempt_ordinal").notNull().default(1),
    dependencyCount: integer("dependency_count").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("workflow_activations_id_check", sql`${table.activationId} ~ '^[0-9a-f]{64}$'`),
    check(
      "workflow_activations_status_check",
      sql`${table.status} in ('blocked', 'ready', 'leased', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')`
    ),
    check(
      "workflow_activations_attempt_check",
      sql`${table.selectedAttemptOrdinal} is null or ${table.selectedAttemptOrdinal} > 0`
    ),
    check("workflow_activations_next_attempt_check", sql`${table.nextAttemptOrdinal} > 0`),
    check("workflow_activations_dependency_check", sql`${table.dependencyCount} >= 0`),
    uniqueIndex("workflow_activations_run_id_uidx").on(table.runId, table.activationId),
    index("workflow_activations_run_status_idx").on(table.runId, table.status, table.availableAt)
  ]
)

export const workflowRunLinks = agenticSchema.table(
  "workflow_run_links",
  {
    parentRunId: uuid("parent_run_id")
      .notNull()
      .references(() => workflowJournalRuns.runId, { onDelete: "restrict" }),
    parentActivationId: char("parent_activation_id", { length: 64 }).notNull(),
    childRunId: uuid("child_run_id")
      .notNull()
      .references(() => workflowJournalRuns.runId, { onDelete: "restrict" }),
    childPackageDigest: char("child_package_digest", { length: 64 })
      .notNull()
      .references(() => workflowExecutionPackages.packageDigest, { onDelete: "restrict" }),
    interfaceDigest: char("interface_digest", { length: 64 }).notNull(),
    terminalStatus: text("terminal_status"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: jsonb("error").$type<Record<string, unknown>>(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.parentRunId, table.parentActivationId] }),
    foreignKey({
      columns: [table.parentRunId, table.parentActivationId],
      foreignColumns: [workflowActivations.runId, workflowActivations.activationId],
      name: "workflow_run_links_parent_activation_fk"
    }).onDelete("restrict"),
    check("workflow_run_links_parent_activation_check", sql`${table.parentActivationId} ~ '^[0-9a-f]{64}$'`),
    check("workflow_run_links_package_digest_check", sql`${table.childPackageDigest} ~ '^[0-9a-f]{64}$'`),
    check("workflow_run_links_interface_digest_check", sql`${table.interfaceDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "workflow_run_links_terminal_status_check",
      sql`${table.terminalStatus} is null or ${table.terminalStatus} in ('succeeded', 'failed')`
    ),
    uniqueIndex("workflow_run_links_child_uidx").on(table.childRunId)
  ]
)

export const workflowAttempts = agenticSchema.table(
  "workflow_attempts",
  {
    runId: uuid("run_id").notNull(),
    activationId: char("activation_id", { length: 64 }).notNull(),
    ordinal: integer("ordinal").notNull(),
    status: text("status").notNull().default("queued"),
    fencingToken: bigint("fencing_token", { mode: "number" }).notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: jsonb("error").$type<Record<string, unknown>>(),
    usage: jsonb("usage").$type<Record<string, unknown>>(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.activationId, table.ordinal] }),
    foreignKey({
      columns: [table.runId, table.activationId],
      foreignColumns: [workflowActivations.runId, workflowActivations.activationId],
      name: "workflow_attempts_activation_fk"
    }).onDelete("restrict"),
    check("workflow_attempts_ordinal_check", sql`${table.ordinal} > 0`),
    check(
      "workflow_attempts_status_check",
      sql`${table.status} in ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'unknown')`
    ),
    check("workflow_attempts_fencing_check", sql`${table.fencingToken} >= 0`),
    uniqueIndex("workflow_attempts_run_activation_ordinal_uidx").on(table.runId, table.activationId, table.ordinal),
    index("workflow_attempts_lease_idx").on(table.status, table.leaseExpiresAt)
  ]
)

export const workflowData = agenticSchema.table(
  "workflow_data",
  {
    datumId: uuid("datum_id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    activationId: char("activation_id", { length: 64 }).notNull(),
    attemptOrdinal: integer("attempt_ordinal").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    digest: char("digest", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.runId, table.activationId, table.attemptOrdinal],
      foreignColumns: [workflowAttempts.runId, workflowAttempts.activationId, workflowAttempts.ordinal],
      name: "workflow_data_attempt_fk"
    }).onDelete("restrict"),
    check(
      "workflow_data_kind_check",
      sql`${table.kind} in ('value', 'artifact', 'external_reference', 'observation', 'secret_capability')`
    ),
    check("workflow_data_digest_check", sql`${table.digest} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("workflow_data_producer_name_uidx").on(
      table.runId,
      table.activationId,
      table.attemptOrdinal,
      table.name
    ),
    index("workflow_data_run_idx").on(table.runId, table.createdAt)
  ]
)

export const workflowEffects = agenticSchema.table(
  "workflow_effects",
  {
    effectId: uuid("effect_id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    activationId: char("activation_id", { length: 64 }).notNull(),
    effectSlot: text("effect_slot").notNull(),
    attemptOrdinal: integer("attempt_ordinal"),
    provider: text("provider").notNull(),
    requestDigest: char("request_digest", { length: 64 }).notNull(),
    idempotencyKey: text("idempotency_key"),
    status: text("status").notNull().default("prepared"),
    request: jsonb("request").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    reconciliation: jsonb("reconciliation").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.runId, table.activationId],
      foreignColumns: [workflowActivations.runId, workflowActivations.activationId],
      name: "workflow_effects_activation_fk"
    }).onDelete("restrict"),
    check("workflow_effects_request_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "workflow_effects_status_check",
      sql`${table.status} in ('prepared', 'dispatching', 'confirmed', 'unknown', 'conflict', 'failed')`
    ),
    uniqueIndex("workflow_effects_logical_uidx").on(table.runId, table.activationId, table.effectSlot),
    index("workflow_effects_status_idx").on(table.status, table.updatedAt)
  ]
)

export const workflowWaits = agenticSchema.table(
  "workflow_waits",
  {
    waitId: uuid("wait_id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    activationId: char("activation_id", { length: 64 }).notNull(),
    attemptOrdinal: integer("attempt_ordinal").notNull(),
    correlationKey: text("correlation_key").notNull(),
    acceptedInputSchema: jsonb("accepted_input_schema").$type<Record<string, unknown>>().notNull(),
    authorization: jsonb("authorization").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("pending"),
    consuming: integer("consuming").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    winningEventSequence: bigint("winning_event_sequence", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.runId, table.activationId, table.attemptOrdinal],
      foreignColumns: [workflowAttempts.runId, workflowAttempts.activationId, workflowAttempts.ordinal],
      name: "workflow_waits_attempt_fk"
    }).onDelete("restrict"),
    check(
      "workflow_waits_status_check",
      sql`${table.status} in ('pending', 'claimed', 'resumed', 'completed', 'timed_out', 'cancelled')`
    ),
    check("workflow_waits_consuming_check", sql`${table.consuming} in (0, 1)`),
    uniqueIndex("workflow_waits_correlation_uidx").on(table.runId, table.correlationKey),
    index("workflow_waits_pending_idx").on(table.status, table.expiresAt)
  ]
)

export const workflowRunEvents = agenticSchema.table(
  "workflow_run_events",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowJournalRuns.runId, { onDelete: "restrict" }),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    transactionId: uuid("transaction_id").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    reducerVersion: text("reducer_version").notNull(),
    causationSequence: bigint("causation_sequence", { mode: "number" }),
    correlationId: text("correlation_id"),
    activationId: char("activation_id", { length: 64 }),
    attemptOrdinal: integer("attempt_ordinal"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.sequence] }),
    foreignKey({
      columns: [table.runId, table.activationId],
      foreignColumns: [workflowActivations.runId, workflowActivations.activationId],
      name: "workflow_run_events_activation_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.runId, table.activationId, table.attemptOrdinal],
      foreignColumns: [workflowAttempts.runId, workflowAttempts.activationId, workflowAttempts.ordinal],
      name: "workflow_run_events_attempt_fk"
    }).onDelete("restrict"),
    check("workflow_run_events_sequence_check", sql`${table.sequence} > 0`),
    check("workflow_run_events_version_check", sql`${table.eventVersion} > 0`),
    check(
      "workflow_run_events_causation_check",
      sql`${table.causationSequence} is null or ${table.causationSequence} < ${table.sequence}`
    ),
    check(
      "workflow_run_events_attempt_identity_check",
      sql`${table.attemptOrdinal} is null or ${table.activationId} is not null`
    ),
    index("workflow_run_events_type_idx").on(table.eventType, table.recordedAt),
    index("workflow_run_events_transaction_idx").on(table.transactionId)
  ]
)

export const workspaceLeases = agenticSchema.table(
  "workspace_leases",
  {
    provider: text("provider").notNull(),
    workspaceId: text("workspace_id").notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.runId, { onDelete: "restrict" }),
    role: text("role").notNull(),
    roleAttempt: integer("role_attempt").notNull(),
    lifecycleState: text("lifecycle_state").notNull(),
    labels: jsonb("labels").$type<Record<string, string>>().notNull(),
    conversationId: text("conversation_id"),
    profileName: text("profile_name"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("workspace_leases_provider_check", sql`${table.provider} in ('daytona', 'azure')`),
    check("workspace_leases_role_check", sql`${table.role} in ('scrum_master', 'coder', 'reviewer', 'repairer')`),
    check(
      "workspace_leases_lifecycle_check",
      sql`${table.lifecycleState} in ('creating', 'running', 'stopped', 'archived', 'deleted', 'failed')`
    ),
    check("workspace_leases_role_attempt_check", sql`${table.roleAttempt} > 0`),
    check("workspace_leases_version_check", sql`${table.version} >= 0`),
    uniqueIndex("workspace_leases_provider_workspace_uidx").on(table.provider, table.workspaceId),
    uniqueIndex("workspace_leases_run_role_attempt_uidx").on(table.runId, table.role, table.roleAttempt),
    index("workspace_leases_run_idx").on(table.runId),
    index("workspace_leases_retention_idx").on(table.retentionUntil)
  ]
)

export const artifactRecords = agenticSchema.table(
  "artifact_records",
  {
    artifactId: uuid("artifact_id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.runId, { onDelete: "restrict" }),
    role: text("role").notNull(),
    roleAttempt: integer("role_attempt").notNull(),
    artifactType: text("artifact_type").notNull(),
    uri: text("uri").notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    mediaType: text("media_type").notNull(),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("artifact_records_role_check", sql`${table.role} in ('scrum_master', 'coder', 'reviewer', 'repairer')`),
    check("artifact_records_role_attempt_check", sql`${table.roleAttempt} > 0`),
    check("artifact_records_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check("artifact_records_byte_length_check", sql`${table.byteLength} >= 0`),
    uniqueIndex("artifact_records_run_role_attempt_uri_uidx").on(table.runId, table.role, table.roleAttempt, table.uri),
    index("artifact_records_run_idx").on(table.runId)
  ]
)

export const workflowEvents = agenticSchema.table(
  "workflow_events",
  {
    eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
    eventKey: char("event_key", { length: 64 }).notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.runId, { onDelete: "restrict" }),
    node: text("node").notNull(),
    outcome: text("outcome").notNull(),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("workflow_events_event_key_check", sql`${table.eventKey} ~ '^[0-9a-f]{64}$'`),
    check(
      "workflow_events_outcome_check",
      sql`${table.outcome} in ('started', 'completed', 'failed', 'skipped', 'retried')`
    ),
    uniqueIndex("workflow_events_event_key_uidx").on(table.eventKey),
    index("workflow_events_run_created_idx").on(table.runId, table.createdAt)
  ]
)

export const webhookDeliveries = agenticSchema.table(
  "webhook_deliveries",
  {
    deliveryId: text("delivery_id").primaryKey(),
    provider: text("provider").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    eventName: text("event_name").notNull(),
    action: text("action"),
    installationId: text("installation_id"),
    repositoryOwner: text("repository_owner"),
    repositoryName: text("repository_name"),
    payloadDigest: char("payload_digest", { length: 64 }).notNull(),
    rawPayload: text("raw_payload").notNull(),
    normalizedEnvelope: jsonb("normalized_envelope").$type<Record<string, unknown>>().notNull(),
    processingStatus: text("processing_status").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("webhook_deliveries_provider_check", sql`${table.provider} = 'github'`),
    check("webhook_deliveries_digest_check", sql`${table.payloadDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "webhook_deliveries_status_check",
      sql`${table.processingStatus} in ('normalized', 'dispatching', 'dispatched', 'ignored', 'failed', 'quarantined')`
    ),
    check("webhook_deliveries_attempt_count_check", sql`${table.attemptCount} >= 0`),
    index("webhook_deliveries_status_received_idx").on(table.processingStatus, table.receivedAt),
    index("webhook_deliveries_repository_idx").on(table.repositoryOwner, table.repositoryName)
  ]
)

export const providerDeliveries = agenticSchema.table(
  "provider_deliveries",
  {
    deliveryKey: char("delivery_key", { length: 64 }).primaryKey(),
    provider: text("provider").notNull(),
    receipt: jsonb("receipt").$type<Record<string, unknown>>().notNull(),
    rawPayloadDigest: char("raw_payload_digest", { length: 64 }).notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    matchedCount: integer("matched_count"),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    dispatchStartedAt: timestamp("dispatch_started_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("provider_deliveries_provider_check", sql`${table.provider} = 'nango'`),
    check("provider_deliveries_key_check", sql`${table.deliveryKey} ~ '^[0-9a-f]{64}$'`),
    check("provider_deliveries_digest_check", sql`${table.rawPayloadDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "provider_deliveries_status_check",
      sql`${table.status} in ('pending', 'dispatching', 'dispatched', 'failed', 'quarantined')`
    ),
    check("provider_deliveries_attempt_count_check", sql`${table.attemptCount} >= 0`),
    check("provider_deliveries_matched_count_check", sql`${table.matchedCount} is null or ${table.matchedCount} >= 0`),
    index("provider_deliveries_status_received_idx").on(table.status, table.receivedAt),
    index("provider_deliveries_retry_idx").on(table.status, table.nextAttemptAt)
  ]
)

export const reviewCycles = agenticSchema.table(
  "review_cycles",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.runId, { onDelete: "restrict" }),
    reviewRound: integer("review_round").notNull(),
    candidateCommitSha: char("candidate_commit_sha", { length: 40 }).notNull(),
    reviewerAgentId: text("reviewer_agent_id").notNull(),
    status: text("status").notNull(),
    reviewerWorkspaceId: text("reviewer_workspace_id"),
    findings: jsonb("findings").$type<unknown[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.reviewRound] }),
    check("review_cycles_round_check", sql`${table.reviewRound} between 1 and 3`),
    check("review_cycles_commit_check", sql`${table.candidateCommitSha} ~ '^[0-9a-f]{40}$'`),
    check(
      "review_cycles_status_check",
      sql`${table.status} in ('queued', 'running', 'approved', 'changes_requested', 'blocked', 'merged', 'abandoned')`
    ),
    index("review_cycles_status_idx").on(table.status, table.updatedAt),
    index("review_cycles_candidate_idx").on(table.candidateCommitSha)
  ]
)
