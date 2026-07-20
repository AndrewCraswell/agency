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

export const ControlPlaneRunSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CONTROL_PLANE_SCHEMA_VERSION),
    fetchedAt: z.iso.datetime({ offset: true }),
    agents: z.array(AgentDefinitionSchema),
    runs: z.array(WorkflowRunViewSchema)
  })
  .strict()

export const WorkflowTopologySchema = z
  .object({
    graphVersion: z.string().min(1),
    name: z.string().min(1),
    nodes: z.array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1),
          description: z.string().min(1),
          agentId: AgentIdSchema.nullable(),
          agentName: z.string().min(1).nullable(),
          stages: z.array(z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"]))
        })
        .strict()
    ),
    edges: z.array(
      z
        .object({
          source: z.string().min(1),
          target: z.string().min(1),
          label: z.string().min(1),
          kind: z.enum(["forward", "loop"])
        })
        .strict()
    )
  })
  .strict()

export const WorkItemQueueStatusSchema = z.enum(["todo", "in_progress", "blocked"])
export const WorkItemQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: WorkItemQueueStatusSchema.optional(),
    repository: z.string().trim().min(1).optional(),
    assignee: AgentIdSchema.optional(),
    priority: z.coerce.number().int().min(0).max(4).optional(),
    age: z.enum(["day", "week", "month"]).optional(),
    sort: z.enum(["priority", "created", "updated", "identifier"]).default("priority"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    cursor: z.string().trim().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict()

const WorkItemFacetSchema = z.object({ value: z.string(), count: z.number().int().nonnegative() }).strict()
const WorkItemPriorityFacetSchema = z
  .object({ value: z.number().int().min(0).max(4), count: z.number().int().nonnegative() })
  .strict()

export const WorkItemQueryResponseSchema = z
  .object({
    schemaVersion: z.literal(CONTROL_PLANE_SCHEMA_VERSION),
    fetchedAt: z.iso.datetime({ offset: true }),
    items: z.array(
      z
        .object({
          task: LinearTaskGraphNodeSchema,
          run: WorkflowRunViewSchema.nullable(),
          status: WorkItemQueueStatusSchema
        })
        .strict()
    ),
    total: z.number().int().nonnegative(),
    previousCursor: z.string().nullable(),
    nextCursor: z.string().nullable(),
    aggregates: z
      .object({
        all: z.number().int().nonnegative(),
        todo: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
        repositories: z.array(WorkItemFacetSchema),
        assignees: z.array(WorkItemFacetSchema),
        priorities: z.array(WorkItemPriorityFacetSchema)
      })
      .strict()
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

export const ApiErrorSchema = z
  .object({
    error: z.string().trim().min(1),
    fieldErrors: z
      .array(z.object({ field: z.string().trim().min(1), message: z.string().trim().min(1) }).strict())
      .optional()
  })
  .strict()

export type WorkflowRunView = z.infer<typeof WorkflowRunViewSchema>
export type WorkItemQueueStatus = z.infer<typeof WorkItemQueueStatusSchema>
export type WorkItemQuery = z.infer<typeof WorkItemQuerySchema>
export type WorkItemQueryResponse = z.infer<typeof WorkItemQueryResponseSchema>
