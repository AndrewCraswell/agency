import { createHash } from "node:crypto"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { AgentIdSchema } from "../contracts/agent"
import { ACTIVE_RUNTIME_SELECTION, RuntimeSelectionSchema, type RuntimeSelection } from "../contracts/runtimeSelection"
import type { TraceReference } from "../observability/tracing"
import type { WorkflowState } from "../orchestrator/state"
import {
  artifactRecords,
  reviewCycles,
  runtimeSelections,
  workflowEvents,
  workflowRuns,
  workspaceLeases
} from "./schema"

const RunStatusSchema = z.enum(["queued", "running", "blocked", "failed", "cancelled", "published"])
const RunStageSchema = z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"])
const AgentRoleSchema = z.enum(["scrum_master", "coder", "reviewer", "repairer"])
const EventOutcomeSchema = z.enum(["started", "completed", "failed", "skipped", "retried"])
const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const ReviewCycleStatusSchema = z.enum([
  "queued",
  "running",
  "approved",
  "changes_requested",
  "blocked",
  "merged",
  "abandoned"
])

export const WorkflowRunRecordSchema = createSelectSchema(workflowRuns, {
  requestDigest: Sha256DigestSchema,
  status: RunStatusSchema,
  stage: RunStageSchema,
  activeRole: AgentRoleSchema.nullable(),
  assignedAgentId: AgentIdSchema.nullable()
})
export const WorkspaceLeaseRecordSchema = createSelectSchema(workspaceLeases)
export const WorkflowEventRecordSchema = createSelectSchema(workflowEvents, {
  eventKey: Sha256DigestSchema,
  outcome: EventOutcomeSchema
})
export const ReviewCycleRecordSchema = createSelectSchema(reviewCycles, { status: ReviewCycleStatusSchema })

export type WorkflowRunRecord = z.infer<typeof WorkflowRunRecordSchema>
export type WorkspaceLeaseRecord = z.infer<typeof WorkspaceLeaseRecordSchema>
export type WorkflowEventRecord = z.infer<typeof WorkflowEventRecordSchema>
export type ReviewCycleRecord = z.infer<typeof ReviewCycleRecordSchema>

export type BindWorkflowRunInput = {
  runId: string
  requestDigest: string
  graphVersion: string
  repositoryOwner: string
  repositoryName: string
  sourceWorkItemId?: string
  sourceWorkItemIdentifier?: string
  assignedAgentId?: string
}

export type AssignWorkflowRunInput = {
  runId: string
  sourceWorkItemId: string
  sourceWorkItemIdentifier: string
  assignedAgentId: string
}

export type WorkspaceLeaseInput = {
  provider: "daytona" | "azure"
  workspaceId: string
  runId: string
  role: z.infer<typeof AgentRoleSchema>
  roleAttempt: number
  lifecycleState: "creating" | "running" | "stopped" | "archived" | "deleted" | "failed"
  labels: Record<string, string>
  conversationId?: string
  profileName?: string
  retentionUntil: Date
  expiresAt: Date
}

export type WorkspaceLeaseTransition = {
  provider: "daytona" | "azure"
  workspaceId: string
  expectedVersion: number
  lifecycleState: WorkspaceLeaseInput["lifecycleState"]
  conversationId?: string | null
  profileName?: string | null
  retentionUntil?: Date
  expiresAt?: Date
}

export type WorkflowEventInput = {
  sourceId: string
  node: string
  outcome: z.infer<typeof EventOutcomeSchema>
  summary: string
  details?: Record<string, unknown>
  createdAt: Date
}

export type ReviewCycleInput = {
  runId: string
  reviewRound: number
  candidateCommitSha: string
  reviewerAgentId: string
}

export type ReviewCycleUpdate = {
  runId: string
  reviewRound: number
  status: z.infer<typeof ReviewCycleStatusSchema>
  reviewerWorkspaceId?: string | null
  findings?: unknown[]
}

export interface ReviewControlPlaneStore {
  findWorkflowRunByPullRequest(
    repositoryOwner: string,
    repositoryName: string,
    pullRequestNumber: number
  ): Promise<WorkflowRunRecord | null>
  getWorkspaceLease(
    runId: string,
    role: z.infer<typeof AgentRoleSchema>,
    roleAttempt: number
  ): Promise<WorkspaceLeaseRecord | null>
  createReviewCycle(input: ReviewCycleInput): Promise<ReviewCycleRecord>
  updateReviewCycle(input: ReviewCycleUpdate): Promise<ReviewCycleRecord>
  latestReviewCycle(runId: string): Promise<ReviewCycleRecord | null>
  listReviewCyclesForRun(runId: string): Promise<ReviewCycleRecord[]>
  listReviewCycles(
    statuses: Array<z.infer<typeof ReviewCycleStatusSchema>>,
    limit?: number
  ): Promise<ReviewCycleRecord[]>
}

export interface ControlPlaneStore {
  bindWorkflowRun(input: BindWorkflowRunInput): Promise<WorkflowRunRecord>
  assignWorkflowRun(input: AssignWorkflowRunInput): Promise<WorkflowRunRecord>
  setWorkflowProgress(
    runId: string,
    status: z.infer<typeof RunStatusSchema>,
    stage: z.infer<typeof RunStageSchema>,
    activeRole: z.infer<typeof AgentRoleSchema> | null
  ): Promise<WorkflowRunRecord>
  persistWorkflowState(state: WorkflowState): Promise<WorkflowRunRecord>
  listWorkflowRuns(limit?: number): Promise<WorkflowRunRecord[]>
  getWorkflowRun(runId: string): Promise<WorkflowRunRecord | null>
  listWorkflowEvents(runId: string, limit?: number): Promise<WorkflowEventRecord[]>
  recordWorkflowEvent(runId: string, input: WorkflowEventInput): Promise<void>
  recordTrace(runId: string, reference: TraceReference): Promise<void>
  findActiveWorkflowRunByWorkItem(workItemId: string): Promise<WorkflowRunRecord | null>
  createWorkspaceLease(input: WorkspaceLeaseInput): Promise<WorkspaceLeaseRecord>
  transitionWorkspaceLease(input: WorkspaceLeaseTransition): Promise<WorkspaceLeaseRecord>
}

type PersistenceSchema = {
  workflowRuns: typeof workflowRuns
  workspaceLeases: typeof workspaceLeases
  artifactRecords: typeof artifactRecords
  workflowEvents: typeof workflowEvents
  reviewCycles: typeof reviewCycles
  runtimeSelections: typeof runtimeSelections
}

function eventKey(runId: string, sequence: number, event: WorkflowState["events"][number]): string {
  return createHash("sha256").update(JSON.stringify({ runId, sequence, event })).digest("hex")
}

function terminalProgress(state: WorkflowState): {
  status: z.infer<typeof RunStatusSchema>
  stage: z.infer<typeof RunStageSchema>
} {
  if (state.terminalStatus === "running") {
    return { status: "running", stage: "coding" }
  }
  if (state.terminalStatus === "published") {
    return { status: "published", stage: "completed" }
  }
  if (state.terminalStatus === "cancelled") {
    return { status: "cancelled", stage: "completed" }
  }
  return { status: "failed", stage: "completed" }
}

export class PostgresControlPlaneStore implements ControlPlaneStore {
  readonly #database: NodePgDatabase<PersistenceSchema>
  readonly #now: () => Date
  readonly #runtimeSelection: RuntimeSelection

  constructor(
    database: NodePgDatabase<PersistenceSchema>,
    runtime: { now?: () => Date; runtimeSelection?: RuntimeSelection } = {}
  ) {
    this.#database = database
    this.#now = runtime.now ?? (() => new Date())
    this.#runtimeSelection = RuntimeSelectionSchema.parse(runtime.runtimeSelection ?? ACTIVE_RUNTIME_SELECTION)
  }

  async bindWorkflowRun(input: BindWorkflowRunInput): Promise<WorkflowRunRecord> {
    const requestDigest = Sha256DigestSchema.parse(input.requestDigest)
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      await transaction
        .insert(workflowRuns)
        .values({
          ...input,
          requestDigest,
          status: "queued",
          stage: "intake",
          graphVersion: input.graphVersion,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoNothing({ target: workflowRuns.runId })
      await transaction
        .insert(runtimeSelections)
        .values({ runId: input.runId, selection: this.#runtimeSelection, createdAt: now })
        .onConflictDoNothing({ target: runtimeSelections.runId })
    })

    const [row, runtimeSelection] = await Promise.all([
      this.#workflowRun(input.runId),
      this.#runtimeSelectionForRun(input.runId)
    ])
    if (row.requestDigest !== requestDigest) {
      throw new Error(`Run ${input.runId} is already bound to a different request digest`)
    }
    if (JSON.stringify(runtimeSelection) !== JSON.stringify(this.#runtimeSelection)) {
      throw new Error(`Run ${input.runId} is already bound to a different runtime selection`)
    }
    return row
  }

  async assignWorkflowRun(input: AssignWorkflowRunInput): Promise<WorkflowRunRecord> {
    const current = await this.#workflowRun(input.runId)
    if (current.sourceWorkItemId !== null || current.assignedAgentId !== null) {
      if (
        current.sourceWorkItemId === input.sourceWorkItemId &&
        current.sourceWorkItemIdentifier === input.sourceWorkItemIdentifier &&
        current.assignedAgentId === input.assignedAgentId
      ) {
        return current
      }
      throw new Error(`Run ${input.runId} already has a different work-item or agent assignment`)
    }
    const rows = await this.#database
      .update(workflowRuns)
      .set({
        sourceWorkItemId: z.uuid().parse(input.sourceWorkItemId),
        sourceWorkItemIdentifier: z.string().trim().min(1).parse(input.sourceWorkItemIdentifier),
        assignedAgentId: AgentIdSchema.parse(input.assignedAgentId),
        updatedAt: this.#now()
      })
      .where(eq(workflowRuns.runId, z.uuid().parse(input.runId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Workflow run ${input.runId} does not exist`)
    }
    return WorkflowRunRecordSchema.parse(row)
  }

  async setWorkflowProgress(
    runId: string,
    status: z.infer<typeof RunStatusSchema>,
    stage: z.infer<typeof RunStageSchema>,
    activeRole: z.infer<typeof AgentRoleSchema> | null
  ): Promise<WorkflowRunRecord> {
    const rows = await this.#database
      .update(workflowRuns)
      .set({
        status: RunStatusSchema.parse(status),
        stage: RunStageSchema.parse(stage),
        activeRole: activeRole === null ? null : AgentRoleSchema.parse(activeRole),
        updatedAt: this.#now()
      })
      .where(eq(workflowRuns.runId, runId))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Workflow run ${runId} does not exist`)
    }
    return WorkflowRunRecordSchema.parse(row)
  }

  async persistWorkflowState(state: WorkflowState): Promise<WorkflowRunRecord> {
    const progress = terminalProgress(state)
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      if (state.events.length > 0) {
        await transaction
          .insert(workflowEvents)
          .values(
            state.events.map((graphEvent, sequence) => ({
              eventKey: eventKey(state.runId, sequence, graphEvent),
              runId: state.runId,
              node: graphEvent.node,
              outcome: graphEvent.outcome,
              summary: graphEvent.summary,
              details: {},
              createdAt: new Date(graphEvent.at)
            }))
          )
          .onConflictDoNothing({ target: workflowEvents.eventKey })
      }

      await transaction
        .update(workflowRuns)
        .set({
          status: progress.status,
          stage: progress.stage,
          activeRole: null,
          pullRequestNumber: state.publicationResult?.pullRequestNumber ?? null,
          updatedAt: now
        })
        .where(eq(workflowRuns.runId, state.runId))
    })
    return this.#workflowRun(state.runId)
  }

  async listWorkflowRuns(limit = 50): Promise<WorkflowRunRecord[]> {
    const boundedLimit = z.number().int().positive().max(200).parse(limit)
    const rows = await this.#database
      .select()
      .from(workflowRuns)
      .orderBy(desc(workflowRuns.updatedAt))
      .limit(boundedLimit)
    return z.array(WorkflowRunRecordSchema).parse(rows)
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRunRecord | null> {
    const rows = await this.#database
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.runId, z.uuid().parse(runId)))
      .limit(1)
    const row = rows[0]
    return row === undefined ? null : WorkflowRunRecordSchema.parse(row)
  }

  async listWorkflowEvents(runId: string, limit = 200): Promise<WorkflowEventRecord[]> {
    const boundedLimit = z.number().int().positive().max(500).parse(limit)
    const rows = await this.#database
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.runId, z.uuid().parse(runId)))
      .orderBy(workflowEvents.eventId)
      .limit(boundedLimit)
    return z.array(WorkflowEventRecordSchema).parse(rows)
  }

  async recordWorkflowEvent(runId: string, input: WorkflowEventInput): Promise<void> {
    const key = createHash("sha256")
      .update(JSON.stringify({ runId, sourceId: input.sourceId }))
      .digest("hex")
    await this.#database
      .insert(workflowEvents)
      .values({
        eventKey: key,
        runId: z.uuid().parse(runId),
        node: z.string().trim().min(1).parse(input.node),
        outcome: EventOutcomeSchema.parse(input.outcome),
        summary: z.string().trim().min(1).parse(input.summary),
        details: input.details ?? {},
        createdAt: input.createdAt
      })
      .onConflictDoNothing({ target: workflowEvents.eventKey })
  }

  async recordTrace(runId: string, reference: TraceReference): Promise<void> {
    const key = createHash("sha256").update(JSON.stringify({ runId, reference })).digest("hex")
    await this.#database
      .insert(workflowEvents)
      .values({
        eventKey: key,
        runId: z.uuid().parse(runId),
        node: reference.name,
        outcome: "started",
        summary: `Started ${reference.name} trace`,
        details: { trace: reference },
        createdAt: this.#now()
      })
      .onConflictDoNothing({ target: workflowEvents.eventKey })
  }

  async findActiveWorkflowRunByWorkItem(workItemId: string): Promise<WorkflowRunRecord | null> {
    const rows = await this.#database
      .select()
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.sourceWorkItemId, z.uuid().parse(workItemId)),
          inArray(workflowRuns.status, ["queued", "running"])
        )
      )
      .orderBy(desc(workflowRuns.createdAt))
      .limit(1)
    const row = rows[0]
    return row === undefined ? null : WorkflowRunRecordSchema.parse(row)
  }

  async findWorkflowRunByPullRequest(
    repositoryOwner: string,
    repositoryName: string,
    pullRequestNumber: number
  ): Promise<WorkflowRunRecord | null> {
    const rows = await this.#database
      .select()
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.repositoryOwner, repositoryOwner),
          eq(workflowRuns.repositoryName, repositoryName),
          eq(workflowRuns.pullRequestNumber, pullRequestNumber)
        )
      )
      .limit(1)
    return rows[0] === undefined ? null : WorkflowRunRecordSchema.parse(rows[0])
  }

  async getWorkspaceLease(
    runId: string,
    role: z.infer<typeof AgentRoleSchema>,
    roleAttempt: number
  ): Promise<WorkspaceLeaseRecord | null> {
    const rows = await this.#database
      .select()
      .from(workspaceLeases)
      .where(
        and(
          eq(workspaceLeases.runId, z.uuid().parse(runId)),
          eq(workspaceLeases.role, AgentRoleSchema.parse(role)),
          eq(workspaceLeases.roleAttempt, z.number().int().positive().parse(roleAttempt))
        )
      )
      .limit(1)
    return rows[0] === undefined ? null : WorkspaceLeaseRecordSchema.parse(rows[0])
  }

  async createReviewCycle(input: ReviewCycleInput): Promise<ReviewCycleRecord> {
    const values = {
      runId: z.uuid().parse(input.runId),
      reviewRound: z.number().int().min(1).max(3).parse(input.reviewRound),
      candidateCommitSha: z
        .string()
        .regex(/^[0-9a-f]{40}$/u)
        .parse(input.candidateCommitSha),
      reviewerAgentId: AgentIdSchema.parse(input.reviewerAgentId),
      status: "queued"
    }
    await this.#database.insert(reviewCycles).values(values).onConflictDoNothing()
    const row = await this.#reviewCycle(values.runId, values.reviewRound)
    if (row.candidateCommitSha !== values.candidateCommitSha || row.reviewerAgentId !== values.reviewerAgentId) {
      throw new Error(`Review round ${values.reviewRound} for run ${values.runId} is already bound differently`)
    }
    return row
  }

  async updateReviewCycle(input: ReviewCycleUpdate): Promise<ReviewCycleRecord> {
    const runId = z.uuid().parse(input.runId)
    const reviewRound = z.number().int().min(1).max(3).parse(input.reviewRound)
    const rows = await this.#database
      .update(reviewCycles)
      .set({
        status: ReviewCycleStatusSchema.parse(input.status),
        ...(input.reviewerWorkspaceId === undefined ? {} : { reviewerWorkspaceId: input.reviewerWorkspaceId }),
        ...(input.findings === undefined ? {} : { findings: input.findings }),
        updatedAt: this.#now()
      })
      .where(and(eq(reviewCycles.runId, runId), eq(reviewCycles.reviewRound, reviewRound)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Review round ${reviewRound} for run ${runId} does not exist`)
    }
    return ReviewCycleRecordSchema.parse(row)
  }

  async latestReviewCycle(runId: string): Promise<ReviewCycleRecord | null> {
    const rows = await this.#database
      .select()
      .from(reviewCycles)
      .where(eq(reviewCycles.runId, z.uuid().parse(runId)))
      .orderBy(desc(reviewCycles.reviewRound))
      .limit(1)
    return rows[0] === undefined ? null : ReviewCycleRecordSchema.parse(rows[0])
  }

  async listReviewCyclesForRun(runId: string): Promise<ReviewCycleRecord[]> {
    const rows = await this.#database
      .select()
      .from(reviewCycles)
      .where(eq(reviewCycles.runId, z.uuid().parse(runId)))
      .orderBy(reviewCycles.reviewRound)
    return z.array(ReviewCycleRecordSchema).parse(rows)
  }

  async listReviewCycles(
    statuses: Array<z.infer<typeof ReviewCycleStatusSchema>>,
    limit = 50
  ): Promise<ReviewCycleRecord[]> {
    const parsedStatuses = z.array(ReviewCycleStatusSchema).min(1).parse(statuses)
    const rows = await this.#database
      .select()
      .from(reviewCycles)
      .where(inArray(reviewCycles.status, parsedStatuses))
      .orderBy(reviewCycles.createdAt)
      .limit(z.number().int().positive().max(200).parse(limit))
    return z.array(ReviewCycleRecordSchema).parse(rows)
  }

  async createWorkspaceLease(input: WorkspaceLeaseInput): Promise<WorkspaceLeaseRecord> {
    const rows = await this.#database
      .insert(workspaceLeases)
      .values({ ...input, version: 0, createdAt: this.#now(), updatedAt: this.#now() })
      .returning()
    return WorkspaceLeaseRecordSchema.parse(rows[0])
  }

  async transitionWorkspaceLease(input: WorkspaceLeaseTransition): Promise<WorkspaceLeaseRecord> {
    const rows = await this.#database
      .update(workspaceLeases)
      .set({
        lifecycleState: input.lifecycleState,
        version: sql`${workspaceLeases.version} + 1`,
        updatedAt: this.#now(),
        ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
        ...(input.profileName === undefined ? {} : { profileName: input.profileName }),
        ...(input.retentionUntil === undefined ? {} : { retentionUntil: input.retentionUntil }),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt })
      })
      .where(
        and(
          eq(workspaceLeases.provider, input.provider),
          eq(workspaceLeases.workspaceId, input.workspaceId),
          eq(workspaceLeases.version, input.expectedVersion)
        )
      )
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error(
        `Workspace lease ${input.provider}/${input.workspaceId} was changed by another orchestrator process`
      )
    }
    return WorkspaceLeaseRecordSchema.parse(row)
  }

  async #workflowRun(runId: string): Promise<WorkflowRunRecord> {
    const rows = await this.#database.select().from(workflowRuns).where(eq(workflowRuns.runId, runId)).limit(1)
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Workflow run ${runId} does not exist`)
    }
    return WorkflowRunRecordSchema.parse(row)
  }

  async #reviewCycle(runId: string, reviewRound: number): Promise<ReviewCycleRecord> {
    const rows = await this.#database
      .select()
      .from(reviewCycles)
      .where(and(eq(reviewCycles.runId, runId), eq(reviewCycles.reviewRound, reviewRound)))
      .limit(1)
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Review round ${reviewRound} for run ${runId} does not exist`)
    }
    return ReviewCycleRecordSchema.parse(row)
  }

  async #runtimeSelectionForRun(runId: string): Promise<RuntimeSelection> {
    const rows = await this.#database
      .select({ selection: runtimeSelections.selection })
      .from(runtimeSelections)
      .where(eq(runtimeSelections.runId, runId))
      .limit(1)
    return RuntimeSelectionSchema.parse(rows[0]?.selection)
  }
}
