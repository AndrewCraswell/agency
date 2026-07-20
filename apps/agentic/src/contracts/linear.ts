import { z } from "zod"

export const LINEAR_WORK_ITEM_SCHEMA_VERSION = "1" as const

export const LinearIssueStateTypeSchema = z.enum([
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "duplicate"
])

export const LinearTeamSchema = z
  .object({
    id: z.uuid(),
    key: z.string().regex(/^[A-Z][A-Z0-9]*$/u),
    name: z.string().trim().min(1)
  })
  .strict()

export const LinearWorkItemSchema = z
  .object({
    schemaVersion: z.literal(LINEAR_WORK_ITEM_SCHEMA_VERSION),
    source: z.literal("linear"),
    id: z.uuid(),
    identifier: z.string().regex(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/u),
    title: z.string().trim().min(1),
    description: z.string(),
    url: z.url(),
    priority: z.number().int().min(0).max(4),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    state: z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1),
        type: z.enum(["backlog", "unstarted"])
      })
      .strict(),
    team: LinearTeamSchema
  })
  .strict()

export const LinearTaskReferenceSchema = z
  .object({
    id: z.uuid(),
    identifier: z.string().regex(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/u),
    stateType: LinearIssueStateTypeSchema
  })
  .strict()

export const LinearTaskGraphNodeSchema = z
  .object({
    schemaVersion: z.literal(LINEAR_WORK_ITEM_SCHEMA_VERSION),
    source: z.literal("linear"),
    id: z.uuid(),
    identifier: z.string().regex(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/u),
    title: z.string().trim().min(1),
    description: z.string(),
    url: z.url(),
    priority: z.number().int().min(0).max(4),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    state: z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1),
        type: LinearIssueStateTypeSchema
      })
      .strict(),
    team: LinearTeamSchema,
    project: z
      .object({ id: z.uuid(), name: z.string().trim().min(1) })
      .strict()
      .nullable(),
    blockedBy: z.array(LinearTaskReferenceSchema),
    blocks: z.array(LinearTaskReferenceSchema)
  })
  .strict()

export const LinearDependencyEdgeSchema = z
  .object({
    blocker: LinearTaskReferenceSchema,
    blocked: LinearTaskReferenceSchema
  })
  .strict()

export const LinearDependencyLevelSchema = z
  .object({
    depth: z.number().int().nonnegative(),
    taskIds: z.array(z.uuid())
  })
  .strict()

export const LinearTaskGraphSchema = z
  .object({
    schemaVersion: z.literal(LINEAR_WORK_ITEM_SCHEMA_VERSION),
    fetchedAt: z.iso.datetime({ offset: true }),
    team: LinearTeamSchema,
    tasks: z.array(LinearTaskGraphNodeSchema),
    edges: z.array(LinearDependencyEdgeSchema),
    levels: z.array(LinearDependencyLevelSchema),
    readyTaskIds: z.array(z.uuid()),
    blockedTaskIds: z.array(z.uuid())
  })
  .strict()
  .superRefine((graph, context) => {
    const taskIds = new Set(graph.tasks.map((task) => task.id))
    for (const [index, taskId] of graph.readyTaskIds.entries()) {
      if (!taskIds.has(taskId)) {
        context.addIssue({
          code: "custom",
          message: "Ready task must belong to the graph",
          path: ["readyTaskIds", index]
        })
      }
    }
    const levelTaskIds = graph.levels.flatMap((level) => level.taskIds)
    if (new Set(levelTaskIds).size !== levelTaskIds.length) {
      context.addIssue({ code: "custom", message: "A task may appear in only one dependency level", path: ["levels"] })
    }
  })

export const LinearCandidateListSchema = z
  .object({
    schemaVersion: z.literal(LINEAR_WORK_ITEM_SCHEMA_VERSION),
    fetchedAt: z.iso.datetime({ offset: true }),
    team: LinearTeamSchema,
    issues: z.array(LinearWorkItemSchema).min(1).max(50)
  })
  .strict()
  .superRefine((candidateList, context) => {
    const issueIds = candidateList.issues.map((issue) => issue.id)
    if (new Set(issueIds).size !== issueIds.length) {
      context.addIssue({ code: "custom", message: "Linear candidate issue IDs must be unique", path: ["issues"] })
    }
    for (const [index, issue] of candidateList.issues.entries()) {
      if (issue.team.id !== candidateList.team.id) {
        context.addIssue({
          code: "custom",
          message: "Every Linear candidate must belong to the selected team",
          path: ["issues", index, "team", "id"]
        })
      }
    }
  })
