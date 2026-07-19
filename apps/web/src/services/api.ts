import { z } from "zod"
import { env } from "./env"

const workflowRunSchema = z
  .object({
    runId: z.uuid(),
    status: z.enum(["queued", "running", "blocked", "failed", "cancelled", "published"]),
    stage: z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"]),
    activeRole: z.enum(["scrum_master", "coder", "reviewer", "repairer"]).nullable(),
    repository: z.string(),
    sourceWorkItemId: z.uuid().nullable(),
    sourceWorkItemIdentifier: z.string().nullable(),
    assignedAgentId: z.string().nullable(),
    pullRequestNumber: z.number().int().positive().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

const linearTaskReferenceSchema = z
  .object({
    id: z.uuid(),
    identifier: z.string(),
    stateType: z.enum(["triage", "backlog", "unstarted", "started", "completed", "canceled", "duplicate"])
  })
  .strict()

const linearTaskSchema = z
  .object({
    schemaVersion: z.literal("1"),
    source: z.literal("linear"),
    id: z.uuid(),
    identifier: z.string(),
    title: z.string(),
    description: z.string(),
    url: z.url(),
    priority: z.number().int(),
    state: z
      .object({ id: z.uuid(), name: z.string(), type: z.enum(["triage", "backlog", "unstarted", "started"]) })
      .strict(),
    team: z.object({ id: z.uuid(), key: z.string(), name: z.string() }).strict(),
    project: z.object({ id: z.uuid(), name: z.string() }).strict().nullable(),
    blockedBy: z.array(linearTaskReferenceSchema),
    blocks: z.array(linearTaskReferenceSchema)
  })
  .strict()

const snapshotSchema = z
  .object({
    schemaVersion: z.literal("1"),
    fetchedAt: z.iso.datetime({ offset: true }),
    agents: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          role: z.enum(["scrum_master", "engineer", "reviewer"]),
          description: z.string()
        })
        .strict()
    ),
    tasks: z.array(linearTaskSchema),
    runs: z.array(workflowRunSchema)
  })
  .strict()

const assignmentResponseSchema = z
  .object({ schemaVersion: z.literal("1"), created: z.boolean(), run: workflowRunSchema })
  .strict()

const workflowEventSchema = z
  .object({
    eventId: z.number().int().positive(),
    node: z.string(),
    outcome: z.enum(["started", "completed", "failed", "skipped", "retried"]),
    summary: z.string(),
    details: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime({ offset: true })
  })
  .strict()

const traceReferenceSchema = z
  .object({ traceId: z.uuid(), runId: z.uuid(), projectName: z.string(), name: z.string() })
  .strict()

const workflowTopologySchema = z
  .object({
    graphVersion: z.string(),
    name: z.string(),
    nodes: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          agentId: z.string().nullable(),
          agentName: z.string().nullable(),
          stages: z.array(z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"]))
        })
        .strict()
    ),
    edges: z.array(
      z
        .object({
          source: z.string(),
          target: z.string(),
          label: z.string(),
          kind: z.enum(["forward", "loop"])
        })
        .strict()
    )
  })
  .strict()

const runDetailSchema = z
  .object({
    schemaVersion: z.literal("1"),
    run: workflowRunSchema,
    workflow: workflowTopologySchema,
    events: z.array(workflowEventSchema)
  })
  .strict()

const apiErrorSchema = z.object({ error: z.string() })

export type WorkflowRun = z.infer<typeof workflowRunSchema>
export type LinearTask = z.infer<typeof linearTaskSchema>
export type ControlPlaneSnapshot = z.infer<typeof snapshotSchema>
export type WorkflowEvent = z.infer<typeof workflowEventSchema>
export type WorkflowRunDetail = z.infer<typeof runDetailSchema>

async function requestJson<Output>(path: string, schema: z.ZodType<Output>, init?: RequestInit): Promise<Output> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, init)
  const body: unknown = await response.json()
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body)
    throw new Error(parsedError.success ? parsedError.data.error : `Request failed with status ${response.status}`)
  }
  return schema.parse(body)
}

export function getControlPlaneSnapshot(): Promise<ControlPlaneSnapshot> {
  return requestJson("/api/control-plane", snapshotSchema)
}

export function assignWorkItem(workItemId: string, agentId: string) {
  return requestJson("/api/control-plane/assign", assignmentResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workItemId, agentId })
  })
}

export function getWorkflowRunDetail(runId: string): Promise<WorkflowRunDetail> {
  return requestJson(`/api/control-plane/runs/${encodeURIComponent(runId)}`, runDetailSchema)
}

export function langSmithTraceUrl(event: WorkflowEvent): string | null {
  const trace = traceReference(event)
  if (!trace.success || env.VITE_LANGSMITH_WORKSPACE_ID === undefined || env.VITE_LANGSMITH_PROJECT_ID === undefined) {
    return null
  }
  const baseUrl = env.VITE_LANGSMITH_BASE_URL.replace(/\/$/u, "")
  return `${baseUrl}/o/${encodeURIComponent(env.VITE_LANGSMITH_WORKSPACE_ID)}/projects/p/${encodeURIComponent(env.VITE_LANGSMITH_PROJECT_ID)}?peek=${encodeURIComponent(trace.data.runId)}`
}

export function traceReference(event: WorkflowEvent) {
  return traceReferenceSchema.safeParse(z.object({ trace: z.unknown() }).safeParse(event.details).data?.trace)
}
