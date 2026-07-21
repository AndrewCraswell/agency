import type { WorkflowDefinitionRecord } from "../../src/persistence/workflowStore"
import { WorkflowDefinitionSchema, type WorkflowDefinition } from "../../src/workflows/definition"
import { jsonValueDigest } from "../../src/workflows/executionContracts"

export const MANUAL_DATA_VALIDATION_WORKFLOW_ID = "019c230c-60c6-7bd8-a9f8-9e5f51b09e40"
export const PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID = "019c230c-60c6-7bd8-a9f8-9e5f51b09e41"

type ExampleWorkflowSeedStore = {
  get(workflowId: string): Promise<WorkflowDefinitionRecord | null>
  create(input: {
    workflowId?: string
    name: string
    description: string
    draft: WorkflowDefinitionRecord["draft"]
  }): Promise<WorkflowDefinitionRecord>
  updateDraft(input: {
    workflowId: string
    expectedRevision: number
    name: string
    description: string
    draft: WorkflowDefinitionRecord["draft"]
  }): Promise<WorkflowDefinitionRecord>
}

export type ExampleWorkflowSeedResult = {
  workflowId: string
  name: string
  status: "created" | "updated" | "unchanged"
}

export function createManualDataValidationWorkflow(): WorkflowDefinition {
  const valueSchema = {
    type: "object" as const,
    additionalProperties: false,
    required: ["requestId", "priority", "summary", "normalized"],
    properties: {
      requestId: { type: "string" as const, minLength: 1 },
      priority: { type: "string" as const, enum: ["urgent", "normal"] },
      summary: { type: "string" as const, minLength: 1 },
      normalized: { const: true }
    }
  }

  return WorkflowDefinitionSchema.parse({
    schemaVersion: "2",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requestId", "priority", "summary"],
      properties: {
        requestId: { type: "string", minLength: 1 },
        priority: { type: "string", enum: ["urgent", "normal"] },
        summary: { type: "string", minLength: 1 }
      }
    },
    outputSchema: { type: "object" },
    constants: {},
    resourceBindings: {},
    steps: [
      {
        id: "manual-start",
        label: "Manual request",
        position: { x: 40, y: 160 },
        definition: { kind: "manual_trigger", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "normalize-request",
        label: "Normalize request",
        position: { x: 280, y: 160 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: { normalized: true } },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "select-fields",
        label: "Select request fields",
        position: { x: 520, y: 160 },
        definition: { kind: "map_fields", version: 1 },
        config: {
          mappings: {
            requestId: "requestId",
            priority: "priority",
            summary: "summary",
            normalized: "normalized"
          }
        },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "validate-request",
        label: "Validate request",
        position: { x: 760, y: 160 },
        definition: { kind: "validate", version: 1 },
        config: { schema: valueSchema },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "route-priority",
        label: "Route by priority",
        position: { x: 1000, y: 160 },
        definition: { kind: "condition", version: 1 },
        config: {
          expression: { path: ["priority"], operator: "equals", value: "urgent" },
          joinStepId: "merge-route"
        },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "mark-urgent",
        label: "Mark urgent",
        position: { x: 1240, y: 60 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: { route: "urgent", responseTarget: "immediate" } },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "mark-normal",
        label: "Mark normal",
        position: { x: 1240, y: 260 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: { route: "normal", responseTarget: "standard" } },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "merge-route",
        label: "Merge selected route",
        position: { x: 1480, y: 160 },
        definition: { kind: "exclusive_merge", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "compose-report",
        label: "Compose request report",
        position: { x: 1720, y: 160 },
        definition: { kind: "compose_markdown", version: 1 },
        config: {
          template:
            "# Request {{requestId}}\n\nPriority: {{priority}}\n\nRoute: {{route}}\n\nResponse target: {{responseTarget}}\n\n{{summary}}"
        },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "success",
        label: "Report ready",
        position: { x: 1960, y: 160 },
        definition: { kind: "success", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      }
    ],
    connections: [
      connection("start-normalize", "manual-start", "input", "normalize-request", "input"),
      connection("normalize-select", "normalize-request", "value", "select-fields", "input"),
      connection("select-validate", "select-fields", "value", "validate-request", "value"),
      connection("validate-route", "validate-request", "value", "route-priority", "input"),
      connection("route-urgent", "route-priority", "true", "mark-urgent", "input"),
      connection("route-normal", "route-priority", "false", "mark-normal", "input"),
      connection("urgent-merge", "mark-urgent", "value", "merge-route", "branches"),
      connection("normal-merge", "mark-normal", "value", "merge-route", "branches"),
      connection("merge-compose", "merge-route", "value", "compose-report", "values"),
      connection("compose-success", "compose-report", "markdown", "success", "result")
    ]
  })
}

export function createParallelCollectionRoutingWorkflow(): WorkflowDefinition {
  const sectionSchema = {
    type: "object" as const,
    additionalProperties: true,
    required: ["sectionKey", "requestId", "reportFormat", "summary"],
    properties: {
      sectionKey: { type: "string" as const },
      requestId: { type: "string" as const, minLength: 1 },
      reportFormat: { type: "string" as const, minLength: 1 },
      summary: { type: "string" as const, minLength: 1 }
    }
  }
  return WorkflowDefinitionSchema.parse({
    schemaVersion: "2",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["requestId", "reportFormat", "summary"],
      properties: {
        requestId: { type: "string", minLength: 1 },
        reportFormat: { type: "string", minLength: 1 },
        summary: { type: "string", minLength: 1 }
      }
    },
    outputSchema: { type: "object" },
    constants: {},
    resourceBindings: {},
    steps: [
      step("manual-start", "Manual report request", 40, 220, "manual_trigger", {}),
      step("request-section", "Build request section", 280, 40, "set_fields", {
        fields: { sectionKey: "request", sectionLabel: "Request" }
      }),
      step("context-section", "Build context section", 280, 220, "set_fields", {
        fields: { sectionKey: "context", sectionLabel: "Context" }
      }),
      step("action-section", "Build action section", 280, 400, "set_fields", {
        fields: { sectionKey: "action", sectionLabel: "Action" }
      }),
      step("collect-sections", "Collect report sections", 520, 220, "collect", {
        mode: "keyed",
        keyField: "sectionKey",
        maximumItems: 3
      }),
      step("validate-sections", "Validate collected sections", 760, 220, "validate", {
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["request", "context", "action"],
          properties: { request: sectionSchema, context: sectionSchema, action: sectionSchema }
        }
      }),
      step("route-format", "Route report format", 1000, 220, "switch", {
        cases: [
          { key: "summary", when: { path: ["request", "reportFormat"], operator: "equals", value: "summary" } },
          {
            key: "detailed",
            when: { path: ["request", "reportFormat"], operator: "equals", value: "detailed" }
          }
        ],
        defaultKey: "fallback",
        joinStepId: "merge-format"
      }),
      step("summary-format", "Format summary report", 1240, 40, "set_fields", {
        fields: { selectedFormat: "summary", formatNote: "Concise report" }
      }),
      step("detailed-format", "Format detailed report", 1240, 220, "set_fields", {
        fields: { selectedFormat: "detailed", formatNote: "Detailed report" }
      }),
      step("fallback-format", "Format fallback report", 1240, 400, "set_fields", {
        fields: { selectedFormat: "fallback", formatNote: "Unknown format used the default route" }
      }),
      step("merge-format", "Merge selected format", 1480, 220, "exclusive_merge", {}),
      step("compose-report", "Compose collected report", 1720, 220, "compose_markdown", {
        template:
          "# Report {{request.requestId}}\n\nFormat: {{selectedFormat}}\n\n{{formatNote}}\n\nRequest: {{request.summary}}\n\nContext: {{context.summary}}\n\nAction: {{action.summary}}"
      }),
      step("success", "Report ready", 1960, 220, "success", {})
    ],
    connections: [
      connection("start-request", "manual-start", "input", "request-section", "input"),
      connection("start-context", "manual-start", "input", "context-section", "input"),
      connection("start-action", "manual-start", "input", "action-section", "input"),
      connection("request-collect", "request-section", "value", "collect-sections", "items"),
      connection("context-collect", "context-section", "value", "collect-sections", "items"),
      connection("action-collect", "action-section", "value", "collect-sections", "items"),
      connection("collect-validate", "collect-sections", "collection", "validate-sections", "value"),
      connection("validate-route", "validate-sections", "value", "route-format", "input"),
      branchConnection("route-summary", "route-format", "summary", "summary-format"),
      branchConnection("route-detailed", "route-format", "detailed", "detailed-format"),
      branchConnection("route-fallback", "route-format", "fallback", "fallback-format"),
      connection("summary-merge", "summary-format", "value", "merge-format", "branches"),
      connection("detailed-merge", "detailed-format", "value", "merge-format", "branches"),
      connection("fallback-merge", "fallback-format", "value", "merge-format", "branches"),
      connection("merge-compose", "merge-format", "value", "compose-report", "values"),
      connection("compose-success", "compose-report", "markdown", "success", "result")
    ]
  })
}

const examples = [
  {
    workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
    name: "Example: Manual data and validation",
    description: "Normalizes, validates, routes, and renders a manual request without external integrations.",
    draft: createManualDataValidationWorkflow()
  },
  {
    workflowId: PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
    name: "Example: Parallel collection and routing",
    description: "Builds report sections in parallel, collects and validates them, then routes the report format.",
    draft: createParallelCollectionRoutingWorkflow()
  }
]

export async function seedExampleWorkflows(store: ExampleWorkflowSeedStore): Promise<ExampleWorkflowSeedResult[]> {
  const results: ExampleWorkflowSeedResult[] = []
  for (const example of examples) {
    const existing = await store.get(example.workflowId)
    if (existing === null) {
      const created = await store.create(example)
      results.push({ workflowId: created.workflowId, name: created.name, status: "created" })
      continue
    }
    const unchanged =
      existing.name === example.name &&
      existing.description === example.description &&
      jsonValueDigest(existing.draft) === jsonValueDigest(example.draft)
    if (unchanged) {
      results.push({ workflowId: existing.workflowId, name: existing.name, status: "unchanged" })
      continue
    }
    const updated = await store.updateDraft({
      workflowId: example.workflowId,
      expectedRevision: existing.draftRevision,
      name: example.name,
      description: example.description,
      draft: example.draft
    })
    results.push({ workflowId: updated.workflowId, name: updated.name, status: "updated" })
  }
  return results
}

function connection(id: string, sourceStepId: string, sourcePort: string, targetStepId: string, targetPort: string) {
  return {
    id,
    source: { stepId: sourceStepId, port: sourcePort },
    target: { stepId: targetStepId, port: targetPort },
    outcome: "success" as const,
    mappings: [{ sourcePath: [], targetPath: [] }]
  }
}

function branchConnection(id: string, sourceStepId: string, branchKey: string, targetStepId: string) {
  return {
    id,
    source: { stepId: sourceStepId, port: "branch" },
    target: { stepId: targetStepId, port: "input" },
    outcome: "success" as const,
    branchKey,
    mappings: [{ sourcePath: ["value"], targetPath: [] }]
  }
}

function step(
  id: string,
  label: string,
  x: number,
  y: number,
  kind: string,
  config: Record<string, WorkflowDefinition["constants"][string]>
) {
  return {
    id,
    label,
    position: { x, y },
    definition: { kind, version: 1 },
    config,
    failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
  }
}
