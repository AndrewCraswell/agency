import { randomUUID } from "node:crypto"
import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { CompiledWorkflowGraphSchema } from "../workflows/compiler"
import {
  ActivationScopeSegmentSchema,
  ExecutionPackageContentSchema,
  JsonValueSchema,
  WorkflowActivationStatusSchema,
  WorkflowAttemptStatusSchema,
  WorkflowDatumKindSchema,
  WorkflowEffectStatusSchema,
  WorkflowRunStatusSchema,
  WorkflowWaitStatusSchema,
  deterministicActivationId,
  executionPackageDigest,
  jsonValueDigest,
  type ActivationScopeSegment,
  type ExecutionPackageContent
} from "../workflows/executionContracts"
import { validateJsonValue } from "../workflows/jsonSchema"
import { getWorkflowStepDefinition } from "../workflows/stepRegistry"
import { downstreamActivations } from "../workflows/workflowExecutor"
import {
  workflowActivations,
  workflowAttempts,
  workflowData,
  workflowEffects,
  workflowExecutionPackages,
  workflowDefinitions,
  workflowJournalRuns,
  workflowRunEvents,
  workflowRunLinks,
  workflowWaits
} from "./schema"

const DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
const ExecutionPackageRecordSchema = createSelectSchema(workflowExecutionPackages, {
  packageDigest: DigestSchema,
  compiledPlanDigest: DigestSchema,
  content: ExecutionPackageContentSchema
})
const JournalRunRecordSchema = createSelectSchema(workflowJournalRuns, {
  packageDigest: DigestSchema,
  requestDigest: DigestSchema,
  sealedManifest: JsonObjectSchema,
  status: WorkflowRunStatusSchema
})
const ActivationRecordSchema = createSelectSchema(workflowActivations, {
  scope: z.array(ActivationScopeSegmentSchema),
  status: WorkflowActivationStatusSchema,
  inputBindings: JsonObjectSchema
})
const AttemptRecordSchema = createSelectSchema(workflowAttempts, {
  status: WorkflowAttemptStatusSchema,
  input: JsonObjectSchema,
  output: JsonObjectSchema.nullable(),
  error: JsonObjectSchema.nullable(),
  usage: JsonObjectSchema.nullable(),
  evidence: JsonObjectSchema
})
const EffectRecordSchema = createSelectSchema(workflowEffects, {
  requestDigest: DigestSchema,
  status: WorkflowEffectStatusSchema,
  request: JsonObjectSchema,
  result: JsonObjectSchema.nullable(),
  reconciliation: JsonObjectSchema.nullable()
})
const WaitRecordSchema = createSelectSchema(workflowWaits, {
  acceptedInputSchema: JsonObjectSchema,
  authorization: JsonObjectSchema.nullable(),
  status: WorkflowWaitStatusSchema
})
const DataRecordSchema = createSelectSchema(workflowData, {
  payload: JsonObjectSchema,
  digest: DigestSchema,
  kind: WorkflowDatumKindSchema
})
const RunLinkRecordSchema = createSelectSchema(workflowRunLinks, {
  childPackageDigest: DigestSchema,
  interfaceDigest: DigestSchema,
  terminalStatus: z.enum(["succeeded", "failed"]).nullable(),
  result: JsonObjectSchema.nullable(),
  error: JsonObjectSchema.nullable()
})
const RunEventRecordSchema = createSelectSchema(workflowRunEvents, { payload: JsonObjectSchema })

export type ExecutionPackageRecord = z.infer<typeof ExecutionPackageRecordSchema>
export type JournalRunRecord = z.infer<typeof JournalRunRecordSchema>
export type WorkflowActivationRecord = z.infer<typeof ActivationRecordSchema>
export type WorkflowAttemptRecord = z.infer<typeof AttemptRecordSchema>
export type WorkflowEffectRecord = z.infer<typeof EffectRecordSchema>
export type WorkflowWaitRecord = z.infer<typeof WaitRecordSchema>
export type WorkflowRunLinkRecord = z.infer<typeof RunLinkRecordSchema>
export type WorkflowRunEventRecord = z.infer<typeof RunEventRecordSchema>

type JournalPersistenceSchema = {
  workflowExecutionPackages: typeof workflowExecutionPackages
  workflowJournalRuns: typeof workflowJournalRuns
  workflowActivations: typeof workflowActivations
  workflowAttempts: typeof workflowAttempts
  workflowData: typeof workflowData
  workflowEffects: typeof workflowEffects
  workflowRunEvents: typeof workflowRunEvents
  workflowRunLinks: typeof workflowRunLinks
}

type InitialActivation = {
  stepId: string
  scope?: ActivationScopeSegment[]
  inputBindings?: Record<string, z.input<typeof JsonValueSchema>>
  dependencyCount?: number
  deferred?: boolean
}

type DownstreamActivation = InitialActivation

type CompleteAttemptInput = {
  runId: string
  activationId: string
  ordinal: number
  leaseOwner: string
  fencingToken: number
  output: Record<string, z.input<typeof JsonValueSchema>>
  usage?: Record<string, z.input<typeof JsonValueSchema>>
  evidence?: Record<string, z.input<typeof JsonValueSchema>>
  data?: Array<{
    name: string
    kind: z.infer<typeof WorkflowDatumKindSchema>
    payload: Record<string, z.input<typeof JsonValueSchema>>
  }>
  downstream?: DownstreamActivation[]
  releases?: Array<{ stepId: string; scope: ActivationScopeSegment[] }>
  loopBudgets?: Array<{ key: string; maximumActivations: number }>
  checkpoint: { cursor: string; committed: boolean }
  workflowResult?: Record<string, z.input<typeof JsonValueSchema>>
  transactionId?: string
}

function reachableStepIds(graph: z.infer<typeof CompiledWorkflowGraphSchema>, sourceStepId: string): string[] {
  const reachable = new Set<string>()
  const pending = [sourceStepId]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) continue
    for (const connection of graph.connections) {
      if (connection.source.stepId !== current || reachable.has(connection.target.stepId)) continue
      reachable.add(connection.target.stepId)
      pending.push(connection.target.stepId)
    }
  }
  reachable.delete(sourceStepId)
  return [...reachable]
}

export class StaleWorkflowLeaseError extends Error {
  constructor(activationId: string, ordinal: number) {
    super(`Attempt ${activationId}:${ordinal} no longer owns the active workflow lease`)
    this.name = "StaleWorkflowLeaseError"
  }
}

export type EffectReservation = {
  effect: WorkflowEffectRecord
  dispatchable: boolean
  reason: "prepared" | "confirmed" | "unknown" | "conflict" | "in_progress" | "failed"
}

function effectReservation(effect: WorkflowEffectRecord, requestDigest: string): EffectReservation {
  if (effect.requestDigest !== requestDigest || effect.status === "conflict") {
    return { effect, dispatchable: false, reason: "conflict" }
  }
  if (effect.status === "prepared") {
    return { effect, dispatchable: true, reason: "prepared" }
  }
  if (effect.status === "confirmed") {
    return { effect, dispatchable: false, reason: "confirmed" }
  }
  if (effect.status === "unknown") {
    return { effect, dispatchable: false, reason: "unknown" }
  }
  if (effect.status === "failed") {
    return { effect, dispatchable: false, reason: "failed" }
  }
  return { effect, dispatchable: false, reason: "in_progress" }
}

export class PostgresWorkflowJournalStore {
  async listRuns(limitInput = 100) {
    const limit = z.number().int().positive().max(500).parse(limitInput)
    return this.#database
      .select({
        runId: workflowJournalRuns.runId,
        workflowId: workflowExecutionPackages.workflowId,
        workflowName: workflowDefinitions.name,
        sourceKind: workflowExecutionPackages.sourceKind,
        workflowVersion: workflowExecutionPackages.workflowVersion,
        draftRevision: workflowExecutionPackages.draftRevision,
        triggerIdentity: workflowJournalRuns.triggerIdentity,
        status: workflowJournalRuns.status,
        createdAt: workflowJournalRuns.createdAt,
        updatedAt: workflowJournalRuns.updatedAt,
        terminalAt: workflowJournalRuns.terminalAt
      })
      .from(workflowJournalRuns)
      .innerJoin(
        workflowExecutionPackages,
        eq(workflowExecutionPackages.packageDigest, workflowJournalRuns.packageDigest)
      )
      .innerJoin(workflowDefinitions, eq(workflowDefinitions.workflowId, workflowExecutionPackages.workflowId))
      .orderBy(desc(workflowJournalRuns.updatedAt))
      .limit(limit)
  }

  readonly #database: NodePgDatabase<JournalPersistenceSchema>
  readonly #now: () => Date
  readonly #newId: () => string

  constructor(
    database: NodePgDatabase<JournalPersistenceSchema>,
    runtime: { now?: () => Date; newId?: () => string } = {}
  ) {
    this.#database = database
    this.#now = runtime.now ?? (() => new Date())
    this.#newId = runtime.newId ?? randomUUID
  }

  async publishExecutionPackage(contentInput: ExecutionPackageContent): Promise<ExecutionPackageRecord> {
    const content = ExecutionPackageContentSchema.parse(contentInput)
    const workflowVersion = content.source.kind === "published" ? content.source.version : null
    const draftRevision = content.source.kind === "draft_test" ? content.source.draftRevision : null
    const packageDigest = executionPackageDigest(content)
    const compiledPlanDigest = jsonValueDigest(content.graph)
    return this.#database.transaction(async (transaction) => {
      await transaction
        .insert(workflowExecutionPackages)
        .values({
          packageDigest,
          workflowId: content.workflowId,
          sourceKind: content.source.kind,
          workflowVersion,
          draftRevision,
          contractVersion: content.schemaVersion,
          compilerVersion: content.compilerVersion,
          compiledPlanDigest,
          content,
          createdAt: this.#now()
        })
        .onConflictDoNothing({
          target:
            content.source.kind === "published"
              ? [workflowExecutionPackages.workflowId, workflowExecutionPackages.workflowVersion]
              : workflowExecutionPackages.packageDigest
        })
      const rows = await transaction
        .select()
        .from(workflowExecutionPackages)
        .where(
          content.source.kind === "published"
            ? and(
                eq(workflowExecutionPackages.workflowId, content.workflowId),
                eq(workflowExecutionPackages.workflowVersion, content.source.version)
              )
            : eq(workflowExecutionPackages.packageDigest, packageDigest)
        )
        .limit(1)
      const executionPackage = ExecutionPackageRecordSchema.parse(rows[0])
      if (executionPackage.packageDigest !== packageDigest) {
        const source =
          content.source.kind === "published"
            ? `version ${content.source.version}`
            : `draft revision ${content.source.draftRevision}`
        throw new Error(`Workflow ${content.workflowId} ${source} already has a different execution package`)
      }
      return executionPackage
    })
  }

  async getExecutionPackage(packageDigestInput: string): Promise<ExecutionPackageRecord | null> {
    const packageDigest = DigestSchema.parse(packageDigestInput)
    const rows = await this.#database
      .select()
      .from(workflowExecutionPackages)
      .where(eq(workflowExecutionPackages.packageDigest, packageDigest))
      .limit(1)
    return rows[0] === undefined ? null : ExecutionPackageRecordSchema.parse(rows[0])
  }

  async getRun(runIdInput: string): Promise<JournalRunRecord | null> {
    const runId = z.uuid().parse(runIdInput)
    const rows = await this.#database
      .select()
      .from(workflowJournalRuns)
      .where(eq(workflowJournalRuns.runId, runId))
      .limit(1)
    return rows[0] === undefined ? null : JournalRunRecordSchema.parse(rows[0])
  }

  async getRunDetail(runIdInput: string) {
    const runId = z.uuid().parse(runIdInput)
    const run = await this.getRun(runId)
    if (run === null) return null
    const executionPackage = await this.getExecutionPackage(run.packageDigest)
    if (executionPackage === null) throw new Error(`Execution package ${run.packageDigest} is unavailable`)
    const [activationRows, attemptRows, effectRows, waitRows, dataRows, eventRows, childLinkRows] = await Promise.all([
      this.#database
        .select()
        .from(workflowActivations)
        .where(eq(workflowActivations.runId, runId))
        .orderBy(asc(workflowActivations.createdAt)),
      this.#database
        .select()
        .from(workflowAttempts)
        .where(eq(workflowAttempts.runId, runId))
        .orderBy(asc(workflowAttempts.createdAt)),
      this.#database
        .select()
        .from(workflowEffects)
        .where(eq(workflowEffects.runId, runId))
        .orderBy(asc(workflowEffects.createdAt)),
      this.#database
        .select()
        .from(workflowWaits)
        .where(eq(workflowWaits.runId, runId))
        .orderBy(asc(workflowWaits.createdAt)),
      this.#database
        .select()
        .from(workflowData)
        .where(eq(workflowData.runId, runId))
        .orderBy(asc(workflowData.createdAt)),
      this.#database
        .select()
        .from(workflowRunEvents)
        .where(eq(workflowRunEvents.runId, runId))
        .orderBy(asc(workflowRunEvents.sequence)),
      this.#database
        .select()
        .from(workflowRunLinks)
        .where(eq(workflowRunLinks.parentRunId, runId))
        .orderBy(asc(workflowRunLinks.createdAt))
    ])
    return {
      run,
      executionPackage,
      graph: CompiledWorkflowGraphSchema.parse(executionPackage.content.graph),
      activations: z.array(ActivationRecordSchema).parse(activationRows),
      attempts: z.array(AttemptRecordSchema).parse(attemptRows),
      effects: z.array(EffectRecordSchema).parse(effectRows),
      waits: z.array(WaitRecordSchema).parse(waitRows),
      data: z.array(DataRecordSchema).parse(dataRows),
      events: z.array(RunEventRecordSchema).parse(eventRows),
      childLinks: z.array(RunLinkRecordSchema).parse(childLinkRows)
    }
  }

  async cancelRun(input: { runId: string; reason?: string; transactionId?: string }): Promise<JournalRunRecord> {
    const runId = z.uuid().parse(input.runId)
    const reason = z
      .string()
      .trim()
      .min(1)
      .max(500)
      .parse(input.reason ?? "Cancelled by operator")
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      if (["succeeded", "failed", "cancelled", "abandoned"].includes(run.status)) return run
      await transaction
        .update(workflowAttempts)
        .set({ status: "cancelled", leaseOwner: null, leaseExpiresAt: null, finishedAt: now })
        .where(
          and(eq(workflowAttempts.runId, runId), inArray(workflowAttempts.status, ["queued", "running", "waiting"]))
        )
      await transaction
        .update(workflowActivations)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            inArray(workflowActivations.status, ["blocked", "ready", "leased", "running", "waiting"])
          )
        )
      await transaction
        .update(workflowWaits)
        .set({ status: "cancelled", updatedAt: now })
        .where(and(eq(workflowWaits.runId, runId), inArray(workflowWaits.status, ["pending", "claimed"])))
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "run.cancelled",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        payload: { reason, priorStatus: run.status, cancellationGeneration: run.cancellationGeneration + 1 },
        recordedAt: now
      })
      const updatedRows = await transaction
        .update(workflowJournalRuns)
        .set({
          status: "cancelled",
          cancellationGeneration: run.cancellationGeneration + 1,
          latestSequence: nextSequence,
          updatedAt: now,
          terminalAt: now
        })
        .where(
          and(
            eq(workflowJournalRuns.runId, runId),
            eq(workflowJournalRuns.cancellationGeneration, run.cancellationGeneration)
          )
        )
        .returning()
      return JournalRunRecordSchema.parse(updatedRows[0])
    })
  }

  async retryActivation(input: {
    runId: string
    activationId: string
    transactionId?: string
  }): Promise<WorkflowActivationRecord> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      if (run.status === "cancelled" || run.status === "abandoned" || run.status === "succeeded")
        throw new Error(`Run ${runId} cannot retry from ${run.status}`)
      const activationRows = await transaction
        .select()
        .from(workflowActivations)
        .where(and(eq(workflowActivations.runId, runId), eq(workflowActivations.activationId, activationId)))
        .limit(1)
        .for("update")
      const activation = ActivationRecordSchema.parse(activationRows[0])
      if (activation.status !== "failed" || activation.selectedAttemptOrdinal !== null) {
        throw new Error(`Activation ${activationId} has no retryable failed output`)
      }
      const uncertainEffects = await transaction
        .select({ effectId: workflowEffects.effectId })
        .from(workflowEffects)
        .where(
          and(
            eq(workflowEffects.runId, runId),
            eq(workflowEffects.activationId, activationId),
            inArray(workflowEffects.status, ["dispatching", "unknown", "conflict"])
          )
        )
        .limit(1)
      if (uncertainEffects[0] !== undefined)
        throw new Error(`Activation ${activationId} has an unresolved external effect`)
      const retriedRows = await transaction
        .update(workflowActivations)
        .set({ status: "ready", availableAt: now, updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, activationId),
            eq(workflowActivations.status, "failed"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning()
      const retried = ActivationRecordSchema.parse(retriedRows[0])
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "activation.retry_requested",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        activationId,
        payload: { priorStatus: activation.status, nextAttemptOrdinal: activation.nextAttemptOrdinal },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ status: "running", latestSequence: nextSequence, updatedAt: now, terminalAt: null })
        .where(eq(workflowJournalRuns.runId, runId))
      return retried
    })
  }

  async retryFromHere(input: {
    runId: string
    activationId: string
    transactionId?: string
  }): Promise<{ activation: WorkflowActivationRecord; affectedDescendantIds: string[] }> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      if (run.status === "cancelled" || run.status === "abandoned" || run.status === "succeeded")
        throw new Error(`Run ${runId} cannot retry from ${run.status}`)
      const packageRows = await transaction
        .select()
        .from(workflowExecutionPackages)
        .where(eq(workflowExecutionPackages.packageDigest, run.packageDigest))
        .limit(1)
      const executionPackage = ExecutionPackageRecordSchema.parse(packageRows[0])
      const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
      const sourceRows = await transaction
        .select()
        .from(workflowActivations)
        .where(and(eq(workflowActivations.runId, runId), eq(workflowActivations.activationId, activationId)))
        .limit(1)
        .for("update")
      const source = ActivationRecordSchema.parse(sourceRows[0])
      if (source.status !== "failed" || source.selectedAttemptOrdinal !== null)
        throw new Error(`Activation ${activationId} has no retryable failed output`)
      const descendantStepIds = reachableStepIds(graph, source.stepId)
      let descendants: WorkflowActivationRecord[] = []
      if (descendantStepIds.length > 0) {
        const descendantRows = await transaction
          .select()
          .from(workflowActivations)
          .where(and(eq(workflowActivations.runId, runId), inArray(workflowActivations.stepId, descendantStepIds)))
          .for("update")
        descendants = z.array(ActivationRecordSchema).parse(descendantRows)
      }
      const unsafeDescendant = descendants.find(
        (candidate) => candidate.selectedAttemptOrdinal !== null || candidate.status !== "blocked"
      )
      if (unsafeDescendant !== undefined)
        throw new Error(
          `Descendant activation ${unsafeDescendant.activationId} has consumed or ambiguous work; run again instead`
        )
      const affectedIds = [activationId, ...descendants.map(({ activationId: descendantId }) => descendantId)]
      const uncertainEffects = await transaction
        .select({ effectId: workflowEffects.effectId })
        .from(workflowEffects)
        .where(
          and(
            eq(workflowEffects.runId, runId),
            inArray(workflowEffects.activationId, affectedIds),
            inArray(workflowEffects.status, ["dispatching", "unknown", "conflict"])
          )
        )
        .limit(1)
      if (uncertainEffects[0] !== undefined) throw new Error("Affected work has an unresolved external effect")
      const retriedRows = await transaction
        .update(workflowActivations)
        .set({ status: "ready", availableAt: now, updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, activationId),
            eq(workflowActivations.status, "failed"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning()
      const retried = ActivationRecordSchema.parse(retriedRows[0])
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "activation.retry_from_here_requested",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        activationId,
        payload: { affectedDescendantIds: descendants.map(({ activationId: descendantId }) => descendantId) },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ status: "running", latestSequence: nextSequence, updatedAt: now, terminalAt: null })
        .where(eq(workflowJournalRuns.runId, runId))
      return {
        activation: retried,
        affectedDescendantIds: descendants.map(({ activationId: descendantId }) => descendantId)
      }
    })
  }

  async listReadyActivations(limitInput = 25): Promise<WorkflowActivationRecord[]> {
    const limit = z.number().int().min(1).max(100).parse(limitInput)
    const rows = await this.#database
      .select()
      .from(workflowActivations)
      .where(eq(workflowActivations.status, "ready"))
      .orderBy(asc(workflowActivations.availableAt), asc(workflowActivations.createdAt))
      .limit(limit)
    return z.array(ActivationRecordSchema).parse(rows)
  }

  async prepareRun(input: {
    packageDigest: string
    requestDigest: string
    triggerIdentity: string
    sealedManifest: Record<string, z.input<typeof JsonValueSchema>>
    initialActivations: InitialActivation[]
  }): Promise<{ run: JournalRunRecord; created: boolean }> {
    const packageDigest = DigestSchema.parse(input.packageDigest)
    const requestDigest = DigestSchema.parse(input.requestDigest)
    const triggerIdentity = z.string().trim().min(1).parse(input.triggerIdentity)
    const sealedManifest = JsonObjectSchema.parse(input.sealedManifest)
    const runId = z.uuid().parse(this.#newId())
    return this.#database.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(workflowJournalRuns)
        .values({
          runId,
          packageDigest,
          requestDigest,
          triggerIdentity,
          sealedManifest,
          status: "runnable",
          latestSequence: 1,
          createdAt: this.#now(),
          updatedAt: this.#now()
        })
        .onConflictDoNothing({
          target: [workflowJournalRuns.packageDigest, workflowJournalRuns.triggerIdentity]
        })
        .returning()
      if (inserted[0] === undefined) {
        const existing = await transaction
          .select()
          .from(workflowJournalRuns)
          .where(
            and(
              eq(workflowJournalRuns.packageDigest, packageDigest),
              eq(workflowJournalRuns.triggerIdentity, triggerIdentity)
            )
          )
          .limit(1)
        const run = JournalRunRecordSchema.parse(existing[0])
        if (run.requestDigest !== requestDigest) {
          throw new Error(`Trigger identity ${triggerIdentity} was reused with a different request digest`)
        }
        return { run, created: false }
      }

      const activations = input.initialActivations.map((activation) => {
        const scope = activation.scope ?? []
        const dependencyCount = z
          .number()
          .int()
          .nonnegative()
          .parse(activation.dependencyCount ?? 0)
        return {
          activationId: deterministicActivationId({ runId, stepId: activation.stepId, scope }),
          runId,
          stepId: z.string().trim().min(1).parse(activation.stepId),
          scope,
          status: dependencyCount === 0 ? ("ready" as const) : ("blocked" as const),
          inputBindings: JsonObjectSchema.parse(activation.inputBindings ?? {}),
          dependencyCount,
          availableAt: dependencyCount === 0 ? this.#now() : null,
          createdAt: this.#now(),
          updatedAt: this.#now()
        }
      })
      if (activations.length > 0) {
        await transaction.insert(workflowActivations).values(activations)
      }
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: 1,
        transactionId: this.#newId(),
        eventType: "run.prepared",
        eventVersion: 1,
        reducerVersion: "1",
        payload: { activationCount: activations.length },
        recordedAt: this.#now()
      })
      return { run: JournalRunRecordSchema.parse(inserted[0]), created: true }
    })
  }

  async leaseActivation(input: {
    runId: string
    activationId: string
    leaseOwner: string
    leaseDurationMs: number
  }): Promise<WorkflowAttemptRecord> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const leaseOwner = z.string().trim().min(1).parse(input.leaseOwner)
    const leaseDurationMs = z.number().int().min(1_000).max(3_600_000).parse(input.leaseDurationMs)
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      if (["succeeded", "failed", "cancelled", "abandoned"].includes(run.status)) {
        throw new Error(`Run ${runId} is ${run.status} and cannot lease activations`)
      }
      const rows = await transaction
        .select()
        .from(workflowActivations)
        .where(and(eq(workflowActivations.runId, runId), eq(workflowActivations.activationId, activationId)))
        .limit(1)
        .for("update")
      const activation = ActivationRecordSchema.parse(rows[0])
      if (activation.status !== "ready") {
        throw new Error(`Activation ${activationId} is ${activation.status}, not ready`)
      }
      const ordinal = activation.nextAttemptOrdinal
      const now = this.#now()
      const inserted = await transaction
        .insert(workflowAttempts)
        .values({
          runId,
          activationId,
          ordinal,
          status: "running",
          fencingToken: ordinal,
          leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
          input: activation.inputBindings,
          evidence: {},
          createdAt: now,
          startedAt: now
        })
        .returning()
      await transaction
        .update(workflowActivations)
        .set({ status: "running", nextAttemptOrdinal: ordinal + 1, updatedAt: now })
        .where(and(eq(workflowActivations.runId, runId), eq(workflowActivations.activationId, activationId)))
      return AttemptRecordSchema.parse(inserted[0])
    })
  }

  async completeAttempt(input: CompleteAttemptInput): Promise<void> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const ordinal = z.number().int().positive().parse(input.ordinal)
    const fencingToken = z.number().int().nonnegative().parse(input.fencingToken)
    const leaseOwner = z.string().trim().min(1).parse(input.leaseOwner)
    const output = JsonObjectSchema.parse(input.output)
    const usage = input.usage === undefined ? undefined : JsonObjectSchema.parse(input.usage)
    const evidence = input.evidence === undefined ? undefined : JsonObjectSchema.parse(input.evidence)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const checkpointCursor = z.string().trim().min(1).parse(input.checkpoint.cursor)
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      if (["succeeded", "failed", "cancelled", "abandoned"].includes(run.status)) {
        throw new StaleWorkflowLeaseError(activationId, ordinal)
      }
      const completed = await transaction
        .update(workflowAttempts)
        .set({ status: "succeeded", output, usage, evidence, finishedAt: now })
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, activationId),
            eq(workflowAttempts.ordinal, ordinal),
            eq(workflowAttempts.status, "running"),
            eq(workflowAttempts.leaseOwner, leaseOwner),
            eq(workflowAttempts.fencingToken, fencingToken),
            gt(workflowAttempts.leaseExpiresAt, now)
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (completed[0] === undefined) {
        throw new StaleWorkflowLeaseError(activationId, ordinal)
      }
      const selected = await transaction
        .update(workflowActivations)
        .set({ status: "succeeded", selectedAttemptOrdinal: ordinal, updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, activationId),
            eq(workflowActivations.status, "running"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning({ activationId: workflowActivations.activationId })
      if (selected[0] === undefined) {
        throw new StaleWorkflowLeaseError(activationId, ordinal)
      }
      const data = (input.data ?? []).map((datum) => {
        const payload = JsonObjectSchema.parse(datum.payload)
        return {
          runId,
          activationId,
          attemptOrdinal: ordinal,
          name: z.string().trim().min(1).parse(datum.name),
          kind: WorkflowDatumKindSchema.parse(datum.kind),
          payload,
          digest: jsonValueDigest(payload),
          createdAt: now
        }
      })
      if (data.length > 0) {
        await transaction.insert(workflowData).values(data)
      }

      const downstream = (input.downstream ?? []).map((activation) => {
        const scope = activation.scope ?? []
        const dependencyCount = z
          .number()
          .int()
          .nonnegative()
          .parse(activation.dependencyCount ?? 0)
        const inputBindings = JsonObjectSchema.parse(activation.inputBindings ?? {})
        const isReady = input.checkpoint.committed && dependencyCount === 0 && activation.deferred !== true
        return {
          activationId: deterministicActivationId({ runId, stepId: activation.stepId, scope }),
          runId,
          stepId: z.string().trim().min(1).parse(activation.stepId),
          scope,
          status: isReady ? ("ready" as const) : ("blocked" as const),
          inputBindings,
          dependencyCount,
          availableAt: isReady ? now : null,
          createdAt: now,
          updatedAt: now
        }
      })
      const loopBudgets = z
        .array(
          z
            .object({
              key: z.string().trim().min(1),
              maximumActivations: z.number().int().min(1).max(100_000)
            })
            .strict()
        )
        .parse(input.loopBudgets ?? [])
      if (loopBudgets.length > 0 && downstream.length > 0) {
        const existingRows = await transaction
          .select({ activationId: workflowActivations.activationId, scope: workflowActivations.scope })
          .from(workflowActivations)
          .where(eq(workflowActivations.runId, runId))
        const existingIds = new Set(existingRows.map(({ activationId: existingActivationId }) => existingActivationId))
        for (const budget of loopBudgets) {
          const existingCount = existingRows.filter(({ scope }) =>
            z
              .array(ActivationScopeSegmentSchema)
              .parse(scope)
              .some((segment) => segment.kind === "loop" && segment.key === budget.key)
          ).length
          const newCount = downstream.filter(
            (candidate) =>
              !existingIds.has(candidate.activationId) &&
              candidate.scope.some((segment) => segment.kind === "loop" && segment.key === budget.key)
          ).length
          if (existingCount + newCount > budget.maximumActivations) {
            throw new Error(`Loop ${budget.key} exceeded its maximum of ${budget.maximumActivations} activations`)
          }
        }
      }
      if (downstream.length > 0) {
        const contributionCount = sql`jsonb_array_length(jsonb_path_query_array(excluded.input_bindings, '$.*'))`
        await transaction
          .insert(workflowActivations)
          .values(downstream)
          .onConflictDoUpdate({
            target: workflowActivations.activationId,
            set: {
              inputBindings: sql`case when ${workflowActivations.status} = 'blocked' then ${workflowActivations.inputBindings} || excluded.input_bindings else ${workflowActivations.inputBindings} end`,
              dependencyCount: sql`case when ${workflowActivations.status} = 'blocked' then greatest(${workflowActivations.dependencyCount} - ${contributionCount}, 0) else ${workflowActivations.dependencyCount} end`,
              status: sql`case when ${workflowActivations.status} = 'blocked' and ${workflowActivations.dependencyCount} <= ${contributionCount} then 'ready' else ${workflowActivations.status} end`,
              availableAt: sql`case when ${workflowActivations.status} = 'blocked' and ${workflowActivations.dependencyCount} <= ${contributionCount} then ${now} else ${workflowActivations.availableAt} end`,
              updatedAt: now
            }
          })
      }
      for (const release of input.releases ?? []) {
        const releaseActivationId = deterministicActivationId({
          runId,
          stepId: z.string().trim().min(1).parse(release.stepId),
          scope: z.array(ActivationScopeSegmentSchema).parse(release.scope)
        })
        await transaction
          .update(workflowActivations)
          .set({ status: "ready", availableAt: now, updatedAt: now })
          .where(
            and(
              eq(workflowActivations.runId, runId),
              eq(workflowActivations.activationId, releaseActivationId),
              eq(workflowActivations.status, "blocked"),
              eq(workflowActivations.dependencyCount, 0)
            )
          )
      }

      if (input.workflowResult !== undefined) {
        const workflowResult = JsonObjectSchema.parse(input.workflowResult)
        const packageRows = await transaction
          .select()
          .from(workflowExecutionPackages)
          .where(eq(workflowExecutionPackages.packageDigest, run.packageDigest))
          .limit(1)
        const executionPackage = ExecutionPackageRecordSchema.parse(packageRows[0])
        const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
        if (validateJsonValue(graph.outputSchema, workflowResult).length > 0) {
          throw new Error("Workflow result does not match the compiled output schema")
        }
        await transaction
          .update(workflowAttempts)
          .set({ status: "cancelled", leaseOwner: null, leaseExpiresAt: null, finishedAt: now })
          .where(
            and(eq(workflowAttempts.runId, runId), inArray(workflowAttempts.status, ["queued", "running", "waiting"]))
          )
        await transaction
          .update(workflowActivations)
          .set({ status: "cancelled", updatedAt: now })
          .where(
            and(
              eq(workflowActivations.runId, runId),
              inArray(workflowActivations.status, ["blocked", "ready", "leased", "running", "waiting"])
            )
          )
        await transaction
          .update(workflowWaits)
          .set({ status: "cancelled", updatedAt: now })
          .where(and(eq(workflowWaits.runId, runId), inArray(workflowWaits.status, ["pending", "claimed"])))
      }

      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "attempt.succeeded",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        activationId,
        attemptOrdinal: ordinal,
        payload: { dataCount: data.length, downstreamCount: downstream.length },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({
          status: input.workflowResult === undefined ? (downstream.length === 0 ? run.status : "running") : "succeeded",
          latestSequence: nextSequence,
          schedulerCursor: input.checkpoint.committed ? checkpointCursor : run.schedulerCursor,
          pendingCheckpointCursor: input.checkpoint.committed ? null : checkpointCursor,
          updatedAt: now,
          terminalAt: input.workflowResult === undefined ? run.terminalAt : now
        })
        .where(eq(workflowJournalRuns.runId, runId))
    })
  }

  async failAttempt(input: {
    runId: string
    activationId: string
    ordinal: number
    leaseOwner: string
    fencingToken: number
    error: Record<string, z.input<typeof JsonValueSchema>>
    transactionId?: string
  }): Promise<void> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const ordinal = z.number().int().positive().parse(input.ordinal)
    const leaseOwner = z.string().trim().min(1).parse(input.leaseOwner)
    const fencingToken = z.number().int().nonnegative().parse(input.fencingToken)
    const error = JsonObjectSchema.parse(input.error)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    await this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      if (["succeeded", "failed", "cancelled", "abandoned"].includes(run.status)) {
        throw new StaleWorkflowLeaseError(activationId, ordinal)
      }
      const failed = await transaction
        .update(workflowAttempts)
        .set({ status: "failed", error, finishedAt: now })
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, activationId),
            eq(workflowAttempts.ordinal, ordinal),
            eq(workflowAttempts.status, "running"),
            eq(workflowAttempts.leaseOwner, leaseOwner),
            eq(workflowAttempts.fencingToken, fencingToken),
            gt(workflowAttempts.leaseExpiresAt, now)
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (failed[0] === undefined) throw new StaleWorkflowLeaseError(activationId, ordinal)
      const updatedActivation = await transaction
        .update(workflowActivations)
        .set({ status: "failed", updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, activationId),
            inArray(workflowActivations.status, ["running", "leased"]),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning({ activationId: workflowActivations.activationId })
      if (updatedActivation[0] === undefined) throw new StaleWorkflowLeaseError(activationId, ordinal)
      await transaction
        .update(workflowAttempts)
        .set({ status: "cancelled", leaseOwner: null, leaseExpiresAt: null, finishedAt: now })
        .where(
          and(eq(workflowAttempts.runId, runId), inArray(workflowAttempts.status, ["queued", "running", "waiting"]))
        )
      await transaction
        .update(workflowActivations)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            inArray(workflowActivations.status, ["blocked", "ready", "leased", "running", "waiting"])
          )
        )
      await transaction
        .update(workflowWaits)
        .set({ status: "cancelled", updatedAt: now })
        .where(and(eq(workflowWaits.runId, runId), inArray(workflowWaits.status, ["pending", "claimed"])))
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "attempt.failed",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        activationId,
        attemptOrdinal: ordinal,
        payload: { code: error.code ?? "step_failed" },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({
          status: "failed",
          latestSequence: nextSequence,
          updatedAt: now,
          terminalAt: now
        })
        .where(eq(workflowJournalRuns.runId, runId))
    })
  }

  async suspendAttempt(input: {
    runId: string
    activationId: string
    ordinal: number
    leaseOwner: string
    fencingToken: number
    correlationKey: string
    acceptedInputSchema: Record<string, z.input<typeof JsonValueSchema>>
    expiresAt: Date
    suspendedInput?: Record<string, z.input<typeof JsonValueSchema>>
    transactionId?: string
  }): Promise<WorkflowWaitRecord> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const ordinal = z.number().int().positive().parse(input.ordinal)
    const leaseOwner = z.string().trim().min(1).parse(input.leaseOwner)
    const fencingToken = z.number().int().nonnegative().parse(input.fencingToken)
    const correlationKey = z.string().trim().min(1).parse(input.correlationKey)
    const acceptedInputSchema = JsonObjectSchema.parse(input.acceptedInputSchema)
    const suspendedInput = input.suspendedInput === undefined ? undefined : JsonObjectSchema.parse(input.suspendedInput)
    const expiresAt = z.date().parse(input.expiresAt)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    if (expiresAt <= now) throw new Error("Wait expiry must be in the future")
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      const suspended = await transaction
        .update(workflowAttempts)
        .set({
          status: "waiting",
          leaseOwner: null,
          leaseExpiresAt: null,
          ...(suspendedInput === undefined ? {} : { input: suspendedInput })
        })
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, activationId),
            eq(workflowAttempts.ordinal, ordinal),
            eq(workflowAttempts.status, "running"),
            eq(workflowAttempts.leaseOwner, leaseOwner),
            eq(workflowAttempts.fencingToken, fencingToken),
            gt(workflowAttempts.leaseExpiresAt, now)
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (suspended[0] === undefined) throw new StaleWorkflowLeaseError(activationId, ordinal)
      const activationRows = await transaction
        .update(workflowActivations)
        .set({ status: "waiting", updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, activationId),
            eq(workflowActivations.status, "running"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning({ activationId: workflowActivations.activationId })
      if (activationRows[0] === undefined) throw new StaleWorkflowLeaseError(activationId, ordinal)
      const waits = await transaction
        .insert(workflowWaits)
        .values({
          runId,
          activationId,
          attemptOrdinal: ordinal,
          correlationKey,
          acceptedInputSchema,
          status: "pending",
          consuming: 1,
          expiresAt,
          createdAt: now,
          updatedAt: now
        })
        .returning()
      const wait = WaitRecordSchema.parse(waits[0])
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "attempt.waiting",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        correlationId: correlationKey,
        activationId,
        attemptOrdinal: ordinal,
        payload: { waitId: wait.waitId, expiresAt: expiresAt.toISOString() },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ status: "waiting", latestSequence: nextSequence, updatedAt: now })
        .where(eq(workflowJournalRuns.runId, runId))
      return wait
    })
  }

  async invokeChildWorkflow(input: {
    parentRunId: string
    parentActivationId: string
    parentAttemptOrdinal: number
    leaseOwner: string
    fencingToken: number
    childPackageDigest: string
    interfaceDigest: string
    childInput: Record<string, z.input<typeof JsonValueSchema>>
    childTriggerStepId: string
    childTriggerPort: string
    timeoutSeconds: number
    maximumDepth: number
    transactionId?: string
  }): Promise<WorkflowRunLinkRecord> {
    const parentRunId = z.uuid().parse(input.parentRunId)
    const parentActivationId = DigestSchema.parse(input.parentActivationId)
    const parentAttemptOrdinal = z.number().int().positive().parse(input.parentAttemptOrdinal)
    const childPackageDigest = DigestSchema.parse(input.childPackageDigest)
    const interfaceDigest = DigestSchema.parse(input.interfaceDigest)
    const childInput = JsonObjectSchema.parse(input.childInput)
    const childTriggerStepId = z.string().trim().min(1).parse(input.childTriggerStepId)
    const childTriggerPort = z.string().trim().min(1).parse(input.childTriggerPort)
    const timeoutSeconds = z.number().int().min(1).max(604_800).parse(input.timeoutSeconds)
    const maximumDepth = z.number().int().min(1).max(20).parse(input.maximumDepth)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const childRunId = z.uuid().parse(this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const parentRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, parentRunId))
        .limit(1)
        .for("update")
      const parent = JournalRunRecordSchema.parse(parentRows[0])
      if (parent.packageDigest === childPackageDigest) throw new Error("A workflow cannot invoke its own package")
      const parentDepth = z
        .number()
        .int()
        .nonnegative()
        .parse(parent.sealedManifest.invocationDepth ?? 0)
      if (parentDepth + 1 > maximumDepth) {
        throw new Error(`Child workflow invocation exceeds maximum depth ${maximumDepth}`)
      }
      const existingRows = await transaction
        .select()
        .from(workflowRunLinks)
        .where(
          and(
            eq(workflowRunLinks.parentRunId, parentRunId),
            eq(workflowRunLinks.parentActivationId, parentActivationId)
          )
        )
        .limit(1)
        .for("update")
      if (existingRows[0] !== undefined) {
        const existing = RunLinkRecordSchema.parse(existingRows[0])
        if (existing.childPackageDigest !== childPackageDigest || existing.interfaceDigest !== interfaceDigest) {
          throw new Error(`Child workflow invocation ${parentActivationId} conflicts with its immutable link`)
        }
        return existing
      }
      const packageRows = await transaction
        .select()
        .from(workflowExecutionPackages)
        .where(eq(workflowExecutionPackages.packageDigest, childPackageDigest))
        .limit(1)
      const childPackage = ExecutionPackageRecordSchema.parse(packageRows[0])
      const childGraph = CompiledWorkflowGraphSchema.parse(childPackage.content.graph)
      const actualInterfaceDigest = jsonValueDigest({
        inputSchema: childGraph.inputSchema,
        outputSchema: childGraph.outputSchema
      })
      if (actualInterfaceDigest !== interfaceDigest)
        throw new Error("Child workflow interface digest does not match its pinned package")
      const inputIssues = validateJsonValue(childGraph.inputSchema, childInput)
      if (inputIssues.length > 0)
        throw new Error(inputIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" "))
      const childRequestDigest = jsonValueDigest({ childPackageDigest, interfaceDigest, childInput })
      const childTriggerIdentity = `child:${parentRunId}:${parentActivationId}`
      const childRunRows = await transaction
        .insert(workflowJournalRuns)
        .values({
          runId: childRunId,
          packageDigest: childPackageDigest,
          requestDigest: childRequestDigest,
          triggerIdentity: childTriggerIdentity,
          sealedManifest: { input: childInput, parentRunId, parentActivationId, invocationDepth: parentDepth + 1 },
          status: "runnable",
          latestSequence: 1,
          createdAt: now,
          updatedAt: now
        })
        .returning()
      const childRun = JournalRunRecordSchema.parse(childRunRows[0])
      await transaction.insert(workflowActivations).values({
        activationId: deterministicActivationId({ runId: childRun.runId, stepId: childTriggerStepId, scope: [] }),
        runId: childRun.runId,
        stepId: childTriggerStepId,
        scope: [],
        status: "ready",
        inputBindings: { [childTriggerPort]: childInput },
        dependencyCount: 0,
        availableAt: now,
        createdAt: now,
        updatedAt: now
      })
      await transaction.insert(workflowRunEvents).values({
        runId: childRun.runId,
        sequence: 1,
        transactionId,
        eventType: "run.prepared",
        eventVersion: 1,
        reducerVersion: "1",
        correlationId: childTriggerIdentity,
        payload: { activationCount: 1, parentRunId, parentActivationId },
        recordedAt: now
      })
      const links = await transaction
        .insert(workflowRunLinks)
        .values({
          parentRunId,
          parentActivationId,
          childRunId: childRun.runId,
          childPackageDigest,
          interfaceDigest,
          createdAt: now
        })
        .returning()
      const link = RunLinkRecordSchema.parse(links[0])
      const suspended = await transaction
        .update(workflowAttempts)
        .set({ status: "waiting", leaseOwner: null, leaseExpiresAt: null })
        .where(
          and(
            eq(workflowAttempts.runId, parentRunId),
            eq(workflowAttempts.activationId, parentActivationId),
            eq(workflowAttempts.ordinal, parentAttemptOrdinal),
            eq(workflowAttempts.status, "running"),
            eq(workflowAttempts.leaseOwner, z.string().trim().min(1).parse(input.leaseOwner)),
            eq(workflowAttempts.fencingToken, z.number().int().nonnegative().parse(input.fencingToken)),
            gt(workflowAttempts.leaseExpiresAt, now)
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (suspended[0] === undefined) throw new StaleWorkflowLeaseError(parentActivationId, parentAttemptOrdinal)
      await transaction
        .update(workflowActivations)
        .set({ status: "waiting", updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, parentRunId),
            eq(workflowActivations.activationId, parentActivationId),
            eq(workflowActivations.status, "running")
          )
        )
      const correlationKey = `child:${childRun.runId}`
      await transaction.insert(workflowWaits).values({
        runId: parentRunId,
        activationId: parentActivationId,
        attemptOrdinal: parentAttemptOrdinal,
        correlationKey,
        acceptedInputSchema: childGraph.outputSchema,
        status: "pending",
        consuming: 1,
        expiresAt: new Date(now.getTime() + timeoutSeconds * 1000),
        createdAt: now,
        updatedAt: now
      })
      const parentSequence = parent.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId: parentRunId,
        sequence: parentSequence,
        transactionId,
        eventType: "child.invoked",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: parent.latestSequence === 0 ? null : parent.latestSequence,
        correlationId: correlationKey,
        activationId: parentActivationId,
        attemptOrdinal: parentAttemptOrdinal,
        payload: { childRunId: childRun.runId, childPackageDigest, interfaceDigest },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ status: "waiting", latestSequence: parentSequence, updatedAt: now })
        .where(eq(workflowJournalRuns.runId, parentRunId))
      return link
    })
  }

  async listChildRunLinks(limitInput = 100): Promise<WorkflowRunLinkRecord[]> {
    const limit = z.number().int().min(1).max(1000).parse(limitInput)
    const rows = await this.#database
      .select()
      .from(workflowRunLinks)
      .orderBy(asc(workflowRunLinks.createdAt))
      .limit(limit)
    return z.array(RunLinkRecordSchema).parse(rows)
  }

  async getChildRunCompletion(childRunIdInput: string): Promise<{
    status: "succeeded" | "failed"
    output: z.infer<typeof JsonObjectSchema>
    error: z.infer<typeof JsonObjectSchema> | null
  } | null> {
    const childRunId = z.uuid().parse(childRunIdInput)
    const run = await this.getRun(childRunId)
    if (run === null || (run.status !== "succeeded" && run.status !== "failed")) return null
    if (run.status === "failed") {
      const attemptRows = await this.#database
        .select()
        .from(workflowAttempts)
        .where(and(eq(workflowAttempts.runId, childRunId), eq(workflowAttempts.status, "failed")))
        .orderBy(sql`${workflowAttempts.finishedAt} desc nulls last`, sql`${workflowAttempts.ordinal} desc`)
        .limit(1)
      const attempt = AttemptRecordSchema.parse(attemptRows[0])
      return { status: "failed", output: attempt.output ?? {}, error: attempt.error }
    }
    const executionPackage = await this.getExecutionPackage(run.packageDigest)
    if (executionPackage === null) throw new Error(`Child execution package ${run.packageDigest} is unavailable`)
    const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
    const sink = graph.steps.find(({ id }) => id === graph.sinkStepId)
    if (sink === undefined) throw new Error(`Child run ${childRunId} has no compiled sink step`)
    const activationRows = await this.#database
      .select()
      .from(workflowActivations)
      .where(
        and(
          eq(workflowActivations.runId, childRunId),
          eq(workflowActivations.stepId, graph.sinkStepId),
          eq(workflowActivations.status, run.status)
        )
      )
      .limit(1)
    const activation = ActivationRecordSchema.parse(activationRows[0])
    if (activation.selectedAttemptOrdinal === null)
      throw new Error(`Child sink activation ${activation.activationId} has no selected attempt`)
    const attemptRows = await this.#database
      .select()
      .from(workflowAttempts)
      .where(
        and(
          eq(workflowAttempts.runId, childRunId),
          eq(workflowAttempts.activationId, activation.activationId),
          eq(workflowAttempts.ordinal, activation.selectedAttemptOrdinal)
        )
      )
      .limit(1)
    const attempt = AttemptRecordSchema.parse(attemptRows[0])
    const sinkDefinition = getWorkflowStepDefinition(sink.definition.kind, sink.definition.version)
    const outputPort = sinkDefinition.outputs[0]
    if (outputPort === undefined || sinkDefinition.outputs.length !== 1) {
      throw new Error(`Child sink ${sink.id} does not have exactly one output port`)
    }
    const output = JsonObjectSchema.parse(attempt.output)
    return {
      status: run.status,
      output: JsonObjectSchema.parse(output[outputPort.name]),
      error: attempt.error
    }
  }

  async recordChildRunCompletion(input: {
    childRunId: string
    status: "succeeded" | "failed"
    output: Record<string, z.input<typeof JsonValueSchema>>
    error: Record<string, z.input<typeof JsonValueSchema>> | null
  }): Promise<WorkflowRunLinkRecord> {
    const childRunId = z.uuid().parse(input.childRunId)
    const status = z.enum(["succeeded", "failed"]).parse(input.status)
    const output = JsonObjectSchema.parse(input.output)
    const error = input.error === null ? null : JsonObjectSchema.parse(input.error)
    const rows = await this.#database
      .update(workflowRunLinks)
      .set({ terminalStatus: status, result: output, error, completedAt: this.#now() })
      .where(and(eq(workflowRunLinks.childRunId, childRunId), isNull(workflowRunLinks.terminalStatus)))
      .returning()
    if (rows[0] !== undefined) return RunLinkRecordSchema.parse(rows[0])
    const existing = await this.#database
      .select()
      .from(workflowRunLinks)
      .where(eq(workflowRunLinks.childRunId, childRunId))
      .limit(1)
    const link = RunLinkRecordSchema.parse(existing[0])
    if (link.terminalStatus !== status || jsonValueDigest(link.result ?? {}) !== jsonValueDigest(output)) {
      throw new Error(`Child run ${childRunId} completion conflicts with its immutable link`)
    }
    return link
  }

  async resumeWait(input: {
    runId: string
    correlationKey: string
    event: Record<string, z.input<typeof JsonValueSchema>>
    outputPort?: string
    transactionId?: string
  }): Promise<WorkflowWaitRecord | null> {
    const runId = z.uuid().parse(input.runId)
    const correlationKey = z.string().trim().min(1).parse(input.correlationKey)
    const event = JsonObjectSchema.parse(input.event)
    const outputPort = z
      .string()
      .trim()
      .min(1)
      .parse(input.outputPort ?? "event")
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      const waitRows = await transaction
        .update(workflowWaits)
        .set({ status: "resumed", winningEventSequence: run.latestSequence + 1, updatedAt: now })
        .where(
          and(
            eq(workflowWaits.runId, runId),
            eq(workflowWaits.correlationKey, correlationKey),
            eq(workflowWaits.status, "pending"),
            gt(workflowWaits.expiresAt, now)
          )
        )
        .returning()
      if (waitRows[0] === undefined) return null
      const wait = WaitRecordSchema.parse(waitRows[0])
      const issues = validateJsonValue(wait.acceptedInputSchema, event)
      if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join(" "))
      const output = { [outputPort]: event }
      const activationRows = await transaction
        .select()
        .from(workflowActivations)
        .where(and(eq(workflowActivations.runId, runId), eq(workflowActivations.activationId, wait.activationId)))
        .limit(1)
        .for("update")
      const activation = ActivationRecordSchema.parse(activationRows[0])
      const packageRows = await transaction
        .select()
        .from(workflowExecutionPackages)
        .where(eq(workflowExecutionPackages.packageDigest, run.packageDigest))
        .limit(1)
      const executionPackage = ExecutionPackageRecordSchema.parse(packageRows[0])
      const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
      const downstreamInput = downstreamActivations(graph, activation.stepId, output, activation.scope)
      const attempts = await transaction
        .update(workflowAttempts)
        .set({ status: "succeeded", output, finishedAt: now })
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, wait.activationId),
            eq(workflowAttempts.ordinal, wait.attemptOrdinal),
            eq(workflowAttempts.status, "waiting")
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (attempts[0] === undefined) throw new StaleWorkflowLeaseError(wait.activationId, wait.attemptOrdinal)
      const selectedActivations = await transaction
        .update(workflowActivations)
        .set({ status: "succeeded", selectedAttemptOrdinal: wait.attemptOrdinal, updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, wait.activationId),
            eq(workflowActivations.status, "waiting"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning({ activationId: workflowActivations.activationId })
      if (selectedActivations[0] === undefined)
        throw new StaleWorkflowLeaseError(wait.activationId, wait.attemptOrdinal)
      const downstream = downstreamInput.map((activation) => {
        const scope = activation.scope ?? []
        const dependencyCount = z
          .number()
          .int()
          .nonnegative()
          .parse(activation.dependencyCount ?? 0)
        const inputBindings = JsonObjectSchema.parse(activation.inputBindings ?? {})
        return {
          activationId: deterministicActivationId({ runId, stepId: activation.stepId, scope }),
          runId,
          stepId: z.string().trim().min(1).parse(activation.stepId),
          scope,
          status: dependencyCount === 0 ? ("ready" as const) : ("blocked" as const),
          inputBindings,
          dependencyCount,
          availableAt: dependencyCount === 0 ? now : null,
          createdAt: now,
          updatedAt: now
        }
      })
      if (downstream.length > 0) await transaction.insert(workflowActivations).values(downstream).onConflictDoNothing()
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "wait.resumed",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        correlationId: correlationKey,
        activationId: wait.activationId,
        attemptOrdinal: wait.attemptOrdinal,
        payload: { waitId: wait.waitId, downstreamCount: downstream.length },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ status: downstream.length === 0 ? run.status : "running", latestSequence: nextSequence, updatedAt: now })
        .where(eq(workflowJournalRuns.runId, runId))
      return wait
    })
  }

  async listExpiredWaits(limitInput = 25): Promise<WorkflowWaitRecord[]> {
    const limit = z.number().int().min(1).max(100).parse(limitInput)
    const rows = await this.#database
      .select()
      .from(workflowWaits)
      .where(and(eq(workflowWaits.status, "pending"), lte(workflowWaits.expiresAt, this.#now())))
      .orderBy(asc(workflowWaits.expiresAt), asc(workflowWaits.createdAt))
      .limit(limit)
    return z.array(WaitRecordSchema).parse(rows)
  }

  async listPendingWaits(correlationKeyInput: string): Promise<WorkflowWaitRecord[]> {
    const correlationKey = z.string().trim().min(1).parse(correlationKeyInput)
    const rows = await this.#database
      .select()
      .from(workflowWaits)
      .where(
        and(
          eq(workflowWaits.correlationKey, correlationKey),
          eq(workflowWaits.status, "pending"),
          gt(workflowWaits.expiresAt, this.#now())
        )
      )
      .orderBy(asc(workflowWaits.createdAt))
    return z.array(WaitRecordSchema).parse(rows)
  }

  async timeoutWait(input: {
    runId: string
    correlationKey: string
    transactionId?: string
  }): Promise<WorkflowWaitRecord | null> {
    const runId = z.uuid().parse(input.runId)
    const correlationKey = z.string().trim().min(1).parse(input.correlationKey)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      const waitRows = await transaction
        .update(workflowWaits)
        .set({ status: "timed_out", winningEventSequence: run.latestSequence + 1, updatedAt: now })
        .where(
          and(
            eq(workflowWaits.runId, runId),
            eq(workflowWaits.correlationKey, correlationKey),
            eq(workflowWaits.status, "pending"),
            lte(workflowWaits.expiresAt, now)
          )
        )
        .returning()
      if (waitRows[0] === undefined) return null
      let wait = WaitRecordSchema.parse(waitRows[0])
      const activationRows = await transaction
        .select()
        .from(workflowActivations)
        .where(and(eq(workflowActivations.runId, runId), eq(workflowActivations.activationId, wait.activationId)))
        .limit(1)
        .for("update")
      const activation = ActivationRecordSchema.parse(activationRows[0])
      const packageRows = await transaction
        .select()
        .from(workflowExecutionPackages)
        .where(eq(workflowExecutionPackages.packageDigest, run.packageDigest))
        .limit(1)
      const executionPackage = ExecutionPackageRecordSchema.parse(packageRows[0])
      const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
      const step = graph.steps.find(({ id }) => id === activation.stepId)
      const providerWait =
        step?.definition.kind === "wait_event_github" || step?.definition.kind === "wait_event_linear"
      const delay = step?.definition.kind === "delay"
      if (!providerWait && !delay && step?.definition.kind !== "child_workflow") {
        throw new Error(`Wait activation ${activation.activationId} is invalid`)
      }
      if (delay) {
        const completedRows = await transaction
          .update(workflowWaits)
          .set({ status: "completed", updatedAt: now })
          .where(and(eq(workflowWaits.waitId, wait.waitId), eq(workflowWaits.status, "timed_out")))
          .returning()
        wait = WaitRecordSchema.parse(completedRows[0])
      }
      const routeTimeout = providerWait && step.config.onTimeout === "route"
      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - wait.createdAt.getTime()) / 1000))
      const attemptRows = await transaction
        .select({ input: workflowAttempts.input })
        .from(workflowAttempts)
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, wait.activationId),
            eq(workflowAttempts.ordinal, wait.attemptOrdinal)
          )
        )
        .limit(1)
      const suspendedInput = JsonObjectSchema.parse(attemptRows[0]?.input)
      let output: z.infer<typeof JsonObjectSchema>
      if (delay) {
        output = { continued: JsonObjectSchema.parse(suspendedInput.input) }
      } else {
        output = {
          timeout: {
            deadline: wait.expiresAt.toISOString(),
            elapsedSeconds,
            correlationDigest: jsonValueDigest(wait.correlationKey)
          }
        }
      }
      const succeeds = delay || routeTimeout
      const error = { code: "wait_timed_out", message: `Wait ${correlationKey} expired` }
      const attempts = await transaction
        .update(workflowAttempts)
        .set(succeeds ? { status: "succeeded", output, finishedAt: now } : { status: "failed", error, finishedAt: now })
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, wait.activationId),
            eq(workflowAttempts.ordinal, wait.attemptOrdinal),
            eq(workflowAttempts.status, "waiting")
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (attempts[0] === undefined) throw new StaleWorkflowLeaseError(wait.activationId, wait.attemptOrdinal)
      const selectedActivations = await transaction
        .update(workflowActivations)
        .set(
          succeeds
            ? { status: "succeeded", selectedAttemptOrdinal: wait.attemptOrdinal, updatedAt: now }
            : { status: "failed", updatedAt: now }
        )
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, wait.activationId),
            eq(workflowActivations.status, "waiting"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning({ activationId: workflowActivations.activationId })
      if (selectedActivations[0] === undefined)
        throw new StaleWorkflowLeaseError(wait.activationId, wait.attemptOrdinal)
      const downstreamInput = succeeds ? downstreamActivations(graph, activation.stepId, output, activation.scope) : []
      const downstream = downstreamInput.map((candidate) => {
        const scope = candidate.scope ?? []
        const dependencyCount = z
          .number()
          .int()
          .nonnegative()
          .parse(candidate.dependencyCount ?? 0)
        return {
          activationId: deterministicActivationId({ runId, stepId: candidate.stepId, scope }),
          runId,
          stepId: z.string().trim().min(1).parse(candidate.stepId),
          scope,
          status: dependencyCount === 0 ? ("ready" as const) : ("blocked" as const),
          inputBindings: JsonObjectSchema.parse(candidate.inputBindings ?? {}),
          dependencyCount,
          availableAt: dependencyCount === 0 ? now : null,
          createdAt: now,
          updatedAt: now
        }
      })
      if (downstream.length > 0) await transaction.insert(workflowActivations).values(downstream).onConflictDoNothing()
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: delay ? "delay.completed" : "wait.timed_out",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        correlationId: correlationKey,
        activationId: wait.activationId,
        attemptOrdinal: wait.attemptOrdinal,
        payload: {
          waitId: wait.waitId,
          disposition: succeeds ? "routed" : "failed",
          downstreamCount: downstream.length,
          ...(delay ? { deadline: wait.expiresAt.toISOString(), elapsedSeconds } : {})
        },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set(
          succeeds
            ? { status: downstream.length === 0 ? run.status : "running", latestSequence: nextSequence, updatedAt: now }
            : { status: "failed", latestSequence: nextSequence, updatedAt: now, terminalAt: now }
        )
        .where(eq(workflowJournalRuns.runId, runId))
      return wait
    })
  }

  async failWait(input: {
    runId: string
    correlationKey: string
    error: Record<string, z.input<typeof JsonValueSchema>>
    transactionId?: string
  }): Promise<WorkflowWaitRecord | null> {
    const runId = z.uuid().parse(input.runId)
    const correlationKey = z.string().trim().min(1).parse(input.correlationKey)
    const error = JsonObjectSchema.parse(input.error)
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      const waitRows = await transaction
        .update(workflowWaits)
        .set({ status: "cancelled", winningEventSequence: run.latestSequence + 1, updatedAt: now })
        .where(
          and(
            eq(workflowWaits.runId, runId),
            eq(workflowWaits.correlationKey, correlationKey),
            eq(workflowWaits.status, "pending")
          )
        )
        .returning()
      if (waitRows[0] === undefined) return null
      const wait = WaitRecordSchema.parse(waitRows[0])
      const attempts = await transaction
        .update(workflowAttempts)
        .set({ status: "failed", error, finishedAt: now })
        .where(
          and(
            eq(workflowAttempts.runId, runId),
            eq(workflowAttempts.activationId, wait.activationId),
            eq(workflowAttempts.ordinal, wait.attemptOrdinal),
            eq(workflowAttempts.status, "waiting")
          )
        )
        .returning({ ordinal: workflowAttempts.ordinal })
      if (attempts[0] === undefined) throw new StaleWorkflowLeaseError(wait.activationId, wait.attemptOrdinal)
      const activations = await transaction
        .update(workflowActivations)
        .set({ status: "failed", updatedAt: now })
        .where(
          and(
            eq(workflowActivations.runId, runId),
            eq(workflowActivations.activationId, wait.activationId),
            eq(workflowActivations.status, "waiting"),
            isNull(workflowActivations.selectedAttemptOrdinal)
          )
        )
        .returning({ activationId: workflowActivations.activationId })
      if (activations[0] === undefined) throw new StaleWorkflowLeaseError(wait.activationId, wait.attemptOrdinal)
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "wait.failed",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        correlationId: correlationKey,
        activationId: wait.activationId,
        attemptOrdinal: wait.attemptOrdinal,
        payload: { waitId: wait.waitId, code: error.code ?? "wait_failed" },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ status: "failed", latestSequence: nextSequence, updatedAt: now, terminalAt: now })
        .where(eq(workflowJournalRuns.runId, runId))
      return wait
    })
  }

  async reserveEffect(input: {
    runId: string
    activationId: string
    effectSlot: string
    attemptOrdinal?: number
    provider: string
    request: Record<string, z.input<typeof JsonValueSchema>>
    idempotencyKey?: string
  }): Promise<EffectReservation> {
    const runId = z.uuid().parse(input.runId)
    const activationId = DigestSchema.parse(input.activationId)
    const effectSlot = z.string().trim().min(1).parse(input.effectSlot)
    const request = JsonObjectSchema.parse(input.request)
    const requestDigest = jsonValueDigest(request)
    return this.#database.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(workflowEffects)
        .values({
          runId,
          activationId,
          effectSlot,
          attemptOrdinal: input.attemptOrdinal,
          provider: z.string().trim().min(1).parse(input.provider),
          requestDigest,
          idempotencyKey: input.idempotencyKey,
          status: "prepared",
          request,
          createdAt: this.#now(),
          updatedAt: this.#now()
        })
        .onConflictDoNothing({
          target: [workflowEffects.runId, workflowEffects.activationId, workflowEffects.effectSlot]
        })
        .returning()
      if (inserted[0] !== undefined) {
        return effectReservation(EffectRecordSchema.parse(inserted[0]), requestDigest)
      }
      const rows = await transaction
        .select()
        .from(workflowEffects)
        .where(
          and(
            eq(workflowEffects.runId, runId),
            eq(workflowEffects.activationId, activationId),
            eq(workflowEffects.effectSlot, effectSlot)
          )
        )
        .limit(1)
        .for("update")
      const existing = EffectRecordSchema.parse(rows[0])
      if (existing.requestDigest !== requestDigest && existing.status !== "conflict") {
        await transaction
          .update(workflowEffects)
          .set({ status: "conflict", updatedAt: this.#now() })
          .where(eq(workflowEffects.effectId, existing.effectId))
        return effectReservation({ ...existing, status: "conflict" }, requestDigest)
      }
      return effectReservation(existing, requestDigest)
    })
  }

  async beginEffectDispatch(effectIdInput: string): Promise<WorkflowEffectRecord> {
    const effectId = z.uuid().parse(effectIdInput)
    const rows = await this.#database
      .update(workflowEffects)
      .set({ status: "dispatching", updatedAt: this.#now() })
      .where(and(eq(workflowEffects.effectId, effectId), eq(workflowEffects.status, "prepared")))
      .returning()
    if (rows[0] === undefined) throw new Error(`Effect ${effectId} is not prepared for dispatch`)
    return EffectRecordSchema.parse(rows[0])
  }

  async confirmEffect(
    effectIdInput: string,
    resultInput: Record<string, z.input<typeof JsonValueSchema>>
  ): Promise<WorkflowEffectRecord> {
    const effectId = z.uuid().parse(effectIdInput)
    const result = JsonObjectSchema.parse(resultInput)
    const rows = await this.#database
      .update(workflowEffects)
      .set({ status: "confirmed", result, updatedAt: this.#now() })
      .where(and(eq(workflowEffects.effectId, effectId), eq(workflowEffects.status, "dispatching")))
      .returning()
    if (rows[0] === undefined) throw new Error(`Effect ${effectId} is not dispatching`)
    return EffectRecordSchema.parse(rows[0])
  }

  async classifyEffectFailure(
    effectIdInput: string,
    statusInput: "unknown" | "failed",
    reconciliationInput: Record<string, z.input<typeof JsonValueSchema>>
  ): Promise<WorkflowEffectRecord> {
    const effectId = z.uuid().parse(effectIdInput)
    const status = z.enum(["unknown", "failed"]).parse(statusInput)
    const reconciliation = JsonObjectSchema.parse(reconciliationInput)
    const rows = await this.#database
      .update(workflowEffects)
      .set({ status, reconciliation, updatedAt: this.#now() })
      .where(and(eq(workflowEffects.effectId, effectId), eq(workflowEffects.status, "dispatching")))
      .returning()
    if (rows[0] === undefined) throw new Error(`Effect ${effectId} is not dispatching`)
    return EffectRecordSchema.parse(rows[0])
  }

  async reconcileStaleEffects(staleBeforeInput: Date): Promise<number> {
    const staleBefore = z.date().parse(staleBeforeInput)
    const now = this.#now()
    const rows = await this.#database
      .update(workflowEffects)
      .set({
        status: "unknown",
        reconciliation: {
          code: "dispatch_lease_expired",
          message: "Provider dispatch did not complete before the recovery deadline",
          detectedAt: now.toISOString()
        },
        updatedAt: now
      })
      .where(and(eq(workflowEffects.status, "dispatching"), lte(workflowEffects.updatedAt, staleBefore)))
      .returning({ effectId: workflowEffects.effectId })
    return rows.length
  }

  async resolveEffect(input: {
    runId: string
    effectId: string
    outcome: "occurred" | "absent" | "indeterminate"
    reason: string
    result?: Record<string, z.input<typeof JsonValueSchema>>
    transactionId?: string
  }): Promise<WorkflowEffectRecord> {
    const runId = z.uuid().parse(input.runId)
    const effectId = z.uuid().parse(input.effectId)
    const outcome = z.enum(["occurred", "absent", "indeterminate"]).parse(input.outcome)
    const reason = z.string().trim().min(1).max(2_000).parse(input.reason)
    const result = input.result === undefined ? undefined : JsonObjectSchema.parse(input.result)
    if (outcome === "occurred" && result === undefined)
      throw new Error("Confirmed occurrence requires the external result")
    const transactionId = z.uuid().parse(input.transactionId ?? this.#newId())
    const now = this.#now()
    return this.#database.transaction(async (transaction) => {
      const runRows = await transaction
        .select()
        .from(workflowJournalRuns)
        .where(eq(workflowJournalRuns.runId, runId))
        .limit(1)
        .for("update")
      const run = JournalRunRecordSchema.parse(runRows[0])
      const effectRows = await transaction
        .select()
        .from(workflowEffects)
        .where(and(eq(workflowEffects.runId, runId), eq(workflowEffects.effectId, effectId)))
        .limit(1)
        .for("update")
      const effect = EffectRecordSchema.parse(effectRows[0])
      if (effect.status !== "unknown" && effect.status !== "conflict")
        throw new Error(`Effect ${effectId} does not need confirmation`)
      const previousHistory = z.array(JsonObjectSchema).catch([]).parse(effect.reconciliation?.history)
      const decision = { source: "operator", outcome, reason, recordedAt: now.toISOString() }
      const status = outcome === "occurred" ? "confirmed" : outcome === "absent" ? "prepared" : "unknown"
      const updatedRows = await transaction
        .update(workflowEffects)
        .set({
          status,
          ...(result === undefined ? {} : { result }),
          reconciliation: { ...effect.reconciliation, latest: decision, history: [...previousHistory, decision] },
          updatedAt: now
        })
        .where(
          and(
            eq(workflowEffects.runId, runId),
            eq(workflowEffects.effectId, effectId),
            inArray(workflowEffects.status, ["unknown", "conflict"])
          )
        )
        .returning()
      const updated = EffectRecordSchema.parse(updatedRows[0])
      const nextSequence = run.latestSequence + 1
      await transaction.insert(workflowRunEvents).values({
        runId,
        sequence: nextSequence,
        transactionId,
        eventType: "effect.operator_resolved",
        eventVersion: 1,
        reducerVersion: "1",
        causationSequence: run.latestSequence === 0 ? null : run.latestSequence,
        activationId: effect.activationId,
        attemptOrdinal: effect.attemptOrdinal,
        payload: { effectId, outcome, reason },
        recordedAt: now
      })
      await transaction
        .update(workflowJournalRuns)
        .set({ latestSequence: nextSequence, updatedAt: now })
        .where(eq(workflowJournalRuns.runId, runId))
      return updated
    })
  }

  async listRunEvents(runIdInput: string): Promise<WorkflowRunEventRecord[]> {
    const runId = z.uuid().parse(runIdInput)
    const rows = await this.#database
      .select()
      .from(workflowRunEvents)
      .where(eq(workflowRunEvents.runId, runId))
      .orderBy(asc(workflowRunEvents.sequence))
    return z.array(RunEventRecordSchema).parse(rows)
  }

  async replay<T>(runId: string, initial: T, reduce: (projection: T, event: WorkflowRunEventRecord) => T): Promise<T> {
    const events = await this.listRunEvents(runId)
    return events.reduce(reduce, initial)
  }
}
