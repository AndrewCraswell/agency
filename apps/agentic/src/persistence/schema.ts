import { sql } from "drizzle-orm"
import {
  bigint,
  bigserial,
  char,
  check,
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

export const agenticSchema = pgSchema("agentic")

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
