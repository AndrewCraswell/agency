import { createHash } from "node:crypto"
import { and, desc, eq, inArray, or } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { ACTIVE_RUNTIME_SELECTION } from "../contracts/runtimeSelection"
import { compileWorkflowDefinition } from "../workflows/compiler"
import { WorkflowContentSchema, WorkflowStatusSchema, type WorkflowContent } from "../workflows/contracts"
import { ExecutionPackageContentSchema, executionPackageDigest, jsonValueDigest } from "../workflows/executionContracts"
import type { WorkflowModelSnapshot } from "../workflows/modelCatalog"
import type { RepositoryAgentSnapshot } from "../workflows/repositoryAgents"
import { CURRENT_WORKFLOW_RELEASE_PHASE } from "../workflows/stepRegistry"
import {
  artifactRecords,
  reviewCycles,
  runtimeSelections,
  workflowActivations,
  workflowAttempts,
  workflowData,
  workflowDefinitions,
  workflowEffects,
  workflowEvents,
  workflowExecutionPackages,
  workflowJournalRuns,
  workflowRunBindings,
  workflowRunEvents,
  workflowRunLinks,
  workflowRuns,
  workflowSchedules,
  workflowWaits,
  workspaceLeases,
  workflowVersions
} from "./schema"

const WorkflowDefinitionRecordSchema = createSelectSchema(workflowDefinitions, {
  status: WorkflowStatusSchema,
  draft: WorkflowContentSchema
})
const WorkflowVersionRecordSchema = createSelectSchema(workflowVersions, { content: WorkflowContentSchema })
const WorkflowVersionSummaryRecordSchema = z.object({
  workflowId: z.uuid(),
  version: z.number().int().positive(),
  contentDigest: z.string().regex(/^[0-9a-f]{64}$/u),
  publishedAt: z.date()
})
const ExecutionPackageRecordSchema = createSelectSchema(workflowExecutionPackages, {
  content: ExecutionPackageContentSchema
})
export type WorkflowDefinitionRecord = z.infer<typeof WorkflowDefinitionRecordSchema>
export type WorkflowVersionRecord = z.infer<typeof WorkflowVersionRecordSchema>
export type WorkflowVersionSummaryRecord = z.infer<typeof WorkflowVersionSummaryRecordSchema>
export type WorkflowExecutionPackageRecord = z.infer<typeof ExecutionPackageRecordSchema>

type WorkflowDatabase = NodePgDatabase<{
  workflowDefinitions: typeof workflowDefinitions
  workflowVersions: typeof workflowVersions
  workflowExecutionPackages: typeof workflowExecutionPackages
  workflowRuns: typeof workflowRuns
  workflowRunBindings: typeof workflowRunBindings
  runtimeSelections: typeof runtimeSelections
}>

export class PostgresWorkflowStore {
  readonly #database: WorkflowDatabase

  constructor(database: WorkflowDatabase) {
    this.#database = database
  }

  async list(): Promise<WorkflowDefinitionRecord[]> {
    const rows = await this.#database.select().from(workflowDefinitions).orderBy(desc(workflowDefinitions.updatedAt))
    return rows.map((row) => WorkflowDefinitionRecordSchema.parse(row))
  }

  async get(workflowId: string): Promise<WorkflowDefinitionRecord | null> {
    const rows = await this.#database
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.workflowId, z.uuid().parse(workflowId)))
      .limit(1)
    return rows[0] === undefined ? null : WorkflowDefinitionRecordSchema.parse(rows[0])
  }

  async create(input: { workflowId?: string; name: string; description: string; draft: WorkflowContent }) {
    const rows = await this.#database
      .insert(workflowDefinitions)
      .values({
        ...input,
        workflowId: input.workflowId === undefined ? undefined : z.uuid().parse(input.workflowId),
        draft: WorkflowContentSchema.parse(input.draft)
      })
      .returning()
    return WorkflowDefinitionRecordSchema.parse(rows[0])
  }

  async delete(workflowIdInput: string): Promise<void> {
    const workflowId = z.uuid().parse(workflowIdInput)
    await this.#database.transaction(async (transaction) => {
      const rows = await transaction
        .select()
        .from(workflowDefinitions)
        .where(eq(workflowDefinitions.workflowId, workflowId))
        .limit(1)
        .for("update")
      WorkflowDefinitionRecordSchema.parse(rows[0])

      const packageRows = await transaction
        .select({ packageDigest: workflowExecutionPackages.packageDigest })
        .from(workflowExecutionPackages)
        .where(eq(workflowExecutionPackages.workflowId, workflowId))
      const packageDigests = packageRows.map(({ packageDigest }) => packageDigest)
      if (packageDigests.length > 0) {
        const journalRunRows = await transaction
          .select({ runId: workflowJournalRuns.runId })
          .from(workflowJournalRuns)
          .where(inArray(workflowJournalRuns.packageDigest, packageDigests))
        const journalRunIds = journalRunRows.map(({ runId }) => runId)
        if (journalRunIds.length > 0) {
          await transaction
            .delete(workflowRunLinks)
            .where(
              or(
                inArray(workflowRunLinks.parentRunId, journalRunIds),
                inArray(workflowRunLinks.childRunId, journalRunIds),
                inArray(workflowRunLinks.childPackageDigest, packageDigests)
              )
            )
          await transaction.delete(workflowRunEvents).where(inArray(workflowRunEvents.runId, journalRunIds))
          await transaction.delete(workflowWaits).where(inArray(workflowWaits.runId, journalRunIds))
          await transaction.delete(workflowData).where(inArray(workflowData.runId, journalRunIds))
          await transaction.delete(workflowEffects).where(inArray(workflowEffects.runId, journalRunIds))
          await transaction.delete(workflowAttempts).where(inArray(workflowAttempts.runId, journalRunIds))
          await transaction.delete(workflowActivations).where(inArray(workflowActivations.runId, journalRunIds))
          await transaction.delete(workflowJournalRuns).where(inArray(workflowJournalRuns.runId, journalRunIds))
        } else {
          await transaction.delete(workflowRunLinks).where(inArray(workflowRunLinks.childPackageDigest, packageDigests))
        }
        await transaction
          .delete(workflowExecutionPackages)
          .where(inArray(workflowExecutionPackages.packageDigest, packageDigests))
      }

      const legacyBindingRows = await transaction
        .select({ runId: workflowRunBindings.runId })
        .from(workflowRunBindings)
        .where(eq(workflowRunBindings.workflowId, workflowId))
      const legacyRunIds = legacyBindingRows.map(({ runId }) => runId)
      if (legacyRunIds.length > 0) {
        await transaction.delete(workspaceLeases).where(inArray(workspaceLeases.runId, legacyRunIds))
        await transaction.delete(artifactRecords).where(inArray(artifactRecords.runId, legacyRunIds))
        await transaction.delete(workflowEvents).where(inArray(workflowEvents.runId, legacyRunIds))
        await transaction.delete(reviewCycles).where(inArray(reviewCycles.runId, legacyRunIds))
        await transaction.delete(runtimeSelections).where(inArray(runtimeSelections.runId, legacyRunIds))
        await transaction.delete(workflowRunBindings).where(inArray(workflowRunBindings.runId, legacyRunIds))
        await transaction.delete(workflowRuns).where(inArray(workflowRuns.runId, legacyRunIds))
      }

      await transaction.delete(workflowSchedules).where(eq(workflowSchedules.workflowId, workflowId))
      await transaction.delete(workflowVersions).where(eq(workflowVersions.workflowId, workflowId))
      const deleted = await transaction
        .delete(workflowDefinitions)
        .where(eq(workflowDefinitions.workflowId, workflowId))
        .returning({ workflowId: workflowDefinitions.workflowId })
      if (deleted[0] === undefined) throw new Error("Workflow was not deleted")
    })
  }

  async updateDraft(input: {
    workflowId: string
    expectedRevision: number
    name: string
    description: string
    draft: WorkflowContent
  }) {
    const rows = await this.#database
      .update(workflowDefinitions)
      .set({
        name: input.name,
        description: input.description,
        draft: WorkflowContentSchema.parse(input.draft),
        draftRevision: input.expectedRevision + 1,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(workflowDefinitions.workflowId, z.uuid().parse(input.workflowId)),
          eq(workflowDefinitions.draftRevision, input.expectedRevision)
        )
      )
      .returning()
    if (rows[0] === undefined) {
      throw new Error("Workflow draft revision conflict")
    }
    return WorkflowDefinitionRecordSchema.parse(rows[0])
  }

  async listVersions(workflowId: string): Promise<WorkflowVersionSummaryRecord[]> {
    const rows = await this.#database
      .select({
        workflowId: workflowVersions.workflowId,
        version: workflowVersions.version,
        contentDigest: workflowVersions.contentDigest,
        publishedAt: workflowVersions.publishedAt
      })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, z.uuid().parse(workflowId)))
      .orderBy(desc(workflowVersions.version))
    return rows.map((row) => WorkflowVersionSummaryRecordSchema.parse(row))
  }

  async publish(
    workflowIdInput: string,
    agentSnapshots: RepositoryAgentSnapshot[] = [],
    modelSnapshots: WorkflowModelSnapshot[] = [],
    expectedRevision?: number
  ): Promise<WorkflowVersionRecord> {
    const workflowId = z.uuid().parse(workflowIdInput)
    return this.#database.transaction(async (transaction) => {
      const rows = await transaction
        .select()
        .from(workflowDefinitions)
        .where(eq(workflowDefinitions.workflowId, workflowId))
        .limit(1)
        .for("update")
      const workflow = WorkflowDefinitionRecordSchema.parse(rows[0])
      if (expectedRevision !== undefined && workflow.draftRevision !== expectedRevision) {
        throw new Error("Workflow draft changed during publication")
      }
      const latestVersions = await transaction
        .select({ version: workflowVersions.version })
        .from(workflowVersions)
        .where(eq(workflowVersions.workflowId, workflowId))
        .orderBy(desc(workflowVersions.version))
        .limit(1)
      const version = (latestVersions[0]?.version ?? 0) + 1
      const contentDigest = jsonValueDigest(workflow.draft)
      const inserted = await transaction
        .insert(workflowVersions)
        .values({ workflowId, version, content: workflow.draft, contentDigest })
        .returning()
      const executionPackage = compileWorkflowDefinition({
        workflowId,
        source: { kind: "published", version },
        definition: workflow.draft,
        maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE,
        agentSnapshots,
        modelSnapshots
      }).content
      await transaction.insert(workflowExecutionPackages).values({
        packageDigest: executionPackageDigest(executionPackage),
        workflowId,
        sourceKind: "published",
        workflowVersion: version,
        draftRevision: null,
        contractVersion: executionPackage.schemaVersion,
        compilerVersion: executionPackage.compilerVersion,
        compiledPlanDigest: jsonValueDigest(executionPackage.graph),
        content: executionPackage
      })
      await transaction
        .update(workflowDefinitions)
        .set({ activePublishedVersion: version, updatedAt: new Date() })
        .where(eq(workflowDefinitions.workflowId, workflowId))
      return WorkflowVersionRecordSchema.parse(inserted[0])
    })
  }

  async getActivePublishedVersion(workflowIdInput: string): Promise<WorkflowVersionRecord | null> {
    const workflow = await this.get(workflowIdInput)
    if (workflow?.activePublishedVersion === null || workflow === null) {
      return null
    }
    const rows = await this.#database
      .select()
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.workflowId, workflow.workflowId),
          eq(workflowVersions.version, workflow.activePublishedVersion)
        )
      )
      .limit(1)
    return rows[0] === undefined ? null : WorkflowVersionRecordSchema.parse(rows[0])
  }

  async getExecutionPackage(workflowIdInput: string, workflowVersionInput: number) {
    const workflowId = z.uuid().parse(workflowIdInput)
    const workflowVersion = z.number().int().positive().parse(workflowVersionInput)
    const rows = await this.#database
      .select()
      .from(workflowExecutionPackages)
      .where(
        and(
          eq(workflowExecutionPackages.workflowId, workflowId),
          eq(workflowExecutionPackages.workflowVersion, workflowVersion)
        )
      )
      .limit(1)
    return rows[0] === undefined ? null : ExecutionPackageRecordSchema.parse(rows[0])
  }

  async startRun(input: {
    runId: string
    workflowId: string
    version: number
    contentDigest: string
    repositoryOwner: string
    repositoryName: string
    triggerType: "manual" | "webhook" | "schedule"
    triggerKey: string
    sourceWorkItemId?: string
    sourceWorkItemIdentifier?: string
  }): Promise<boolean> {
    return this.#database.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(workflowRuns)
        .values({
          runId: input.runId,
          requestDigest: createHash("sha256")
            .update(`${input.contentDigest}:${input.triggerType}:${input.triggerKey}`)
            .digest("hex"),
          status: "queued",
          stage: "intake",
          graphVersion: `workflow:${input.workflowId}:v${input.version}`,
          repositoryOwner: input.repositoryOwner,
          repositoryName: input.repositoryName,
          sourceWorkItemId: input.sourceWorkItemId,
          sourceWorkItemIdentifier: input.sourceWorkItemIdentifier,
          assignedAgentId: input.sourceWorkItemId === undefined ? undefined : "engineer"
        })
        .onConflictDoNothing({ target: workflowRuns.runId })
        .returning({ runId: workflowRuns.runId })
      if (inserted.length === 0) {
        return false
      }
      await transaction.insert(runtimeSelections).values({ runId: input.runId, selection: ACTIVE_RUNTIME_SELECTION })
      await transaction.insert(workflowRunBindings).values({
        runId: input.runId,
        workflowId: input.workflowId,
        version: input.version,
        triggerType: input.triggerType,
        triggerKey: input.triggerKey
      })
      return true
    })
  }
}
