import { z } from "zod"
import { AgentDefinitionSchema, AgentIdSchema } from "../contracts/agent"
import { LinearTaskGraphNodeSchema } from "../contracts/linear"

export const CONTROL_PLANE_SCHEMA_VERSION = "1" as const

export const WorkflowRunViewSchema = z
  .object({
    runId: z.uuid(),
    status: z.enum(["queued", "running", "blocked", "failed", "cancelled", "published"]),
    stage: z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"]),
    activeRole: z.enum(["scrum_master", "coder", "reviewer", "repairer"]).nullable(),
    repository: z.string().min(3),
    sourceWorkItemId: z.uuid().nullable(),
    sourceWorkItemIdentifier: z.string().nullable(),
    assignedAgentId: AgentIdSchema.nullable(),
    pullRequestNumber: z.number().int().positive().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const ControlPlaneSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CONTROL_PLANE_SCHEMA_VERSION),
    fetchedAt: z.iso.datetime({ offset: true }),
    agents: z.array(AgentDefinitionSchema),
    tasks: z.array(LinearTaskGraphNodeSchema),
    runs: z.array(WorkflowRunViewSchema)
  })
  .strict()

export const WorkflowEventViewSchema = z
  .object({
    eventId: z.number().int().positive(),
    node: z.string().trim().min(1),
    outcome: z.enum(["started", "completed", "failed", "skipped", "retried"]),
    summary: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime({ offset: true })
  })
  .strict()

const WorkflowTopologyNodeIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
const WorkflowStageSchema = z.enum([
  "intake",
  "planning",
  "coding",
  "reviewing",
  "repairing",
  "publishing",
  "completed"
])

export const WorkflowTopologySchema = z
  .object({
    graphVersion: z.string().trim().min(1),
    name: z.string().trim().min(1),
    nodes: z.array(
      z
        .object({
          id: WorkflowTopologyNodeIdSchema,
          label: z.string().trim().min(1),
          description: z.string().trim().min(1),
          agentId: AgentIdSchema.nullable(),
          agentName: z.string().trim().min(1).nullable(),
          stages: z.array(WorkflowStageSchema).min(1)
        })
        .strict()
    ),
    edges: z.array(
      z
        .object({
          source: WorkflowTopologyNodeIdSchema,
          target: WorkflowTopologyNodeIdSchema,
          label: z.string().trim().min(1),
          kind: z.enum(["forward", "loop"])
        })
        .strict()
    )
  })
  .strict()

export const WorkflowRunDetailSchema = z
  .object({
    schemaVersion: z.literal(CONTROL_PLANE_SCHEMA_VERSION),
    run: WorkflowRunViewSchema,
    workflow: WorkflowTopologySchema,
    events: z.array(WorkflowEventViewSchema)
  })
  .strict()

export const AssignWorkItemRequestSchema = z.object({ workItemId: z.uuid(), agentId: AgentIdSchema }).strict()

export const AssignWorkItemResponseSchema = z
  .object({
    schemaVersion: z.literal(CONTROL_PLANE_SCHEMA_VERSION),
    created: z.boolean(),
    run: WorkflowRunViewSchema
  })
  .strict()

export const ApiErrorSchema = z.object({ error: z.string().trim().min(1) }).strict()

export type WorkflowRunView = z.infer<typeof WorkflowRunViewSchema>
