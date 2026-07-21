import { describe, expect, it, vi } from "vitest"
import type { WorkflowDefinitionRecord } from "../../src/persistence/workflowStore"
import { compileWorkflowDefinition } from "../../src/workflows/compiler"
import { CURRENT_WORKFLOW_RELEASE_PHASE } from "../../src/workflows/stepRegistry"
import {
  createManualDataValidationWorkflow,
  createParallelCollectionRoutingWorkflow,
  MANUAL_DATA_VALIDATION_WORKFLOW_ID,
  PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
  seedExampleWorkflows
} from "./examples"

const now = new Date("2026-07-20T12:00:00.000Z")

function record(overrides: Partial<WorkflowDefinitionRecord> = {}): WorkflowDefinitionRecord {
  return {
    workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
    name: "Example: Manual data and validation",
    description: "Normalizes, validates, routes, and renders a manual request without external integrations.",
    status: "draft",
    draftRevision: 1,
    draft: createManualDataValidationWorkflow(),
    activePublishedVersion: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function parallelRecord(overrides: Partial<WorkflowDefinitionRecord> = {}): WorkflowDefinitionRecord {
  return {
    ...record(),
    workflowId: PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
    name: "Example: Parallel collection and routing",
    description: "Builds report sections in parallel, collects and validates them, then routes the report format.",
    draft: createParallelCollectionRoutingWorkflow(),
    ...overrides
  }
}

describe("example workflow seeds", () => {
  it("builds the manual data and validation workflow as a compilable draft", () => {
    const definition = createManualDataValidationWorkflow()

    expect(definition.resourceBindings).toEqual({})
    expect(definition.steps.map(({ definition: step }) => step.kind)).toEqual([
      "manual_trigger",
      "set_fields",
      "map_fields",
      "validate",
      "condition",
      "set_fields",
      "set_fields",
      "exclusive_merge",
      "compose_markdown",
      "set_fields"
    ])
    expect(() =>
      compileWorkflowDefinition({
        workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
        source: { kind: "draft_test", draftRevision: 1 },
        definition,
        maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE
      })
    ).not.toThrow()
  })

  it("builds the parallel collection and routing workflow as a compilable draft", () => {
    const definition = createParallelCollectionRoutingWorkflow()

    expect(definition.resourceBindings).toEqual({})
    expect(() =>
      compileWorkflowDefinition({
        workflowId: PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
        source: { kind: "draft_test", draftRevision: 1 },
        definition,
        maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE
      })
    ).not.toThrow()
  })

  it("creates a missing example with its stable workflow ID", async () => {
    const create = vi.fn(async (input: { workflowId?: string }) =>
      input.workflowId === PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID ? parallelRecord() : record()
    )
    const store = { get: vi.fn(async () => null), create, updateDraft: vi.fn() }

    await expect(seedExampleWorkflows(store)).resolves.toEqual([
      {
        workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
        name: "Example: Manual data and validation",
        status: "created"
      },
      {
        workflowId: PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
        name: "Example: Parallel collection and routing",
        status: "created"
      }
    ])
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID }))
  })

  it("leaves an unchanged example at its current revision", async () => {
    const updateDraft = vi.fn()
    const store = {
      get: vi.fn(async (workflowId: string) =>
        workflowId === PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID
          ? parallelRecord({ draftRevision: 4 })
          : record({ draftRevision: 4 })
      ),
      create: vi.fn(),
      updateDraft
    }

    await expect(seedExampleWorkflows(store)).resolves.toEqual([
      {
        workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
        name: "Example: Manual data and validation",
        status: "unchanged"
      },
      {
        workflowId: PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
        name: "Example: Parallel collection and routing",
        status: "unchanged"
      }
    ])
    expect(updateDraft).not.toHaveBeenCalled()
  })

  it("updates changed seed-owned metadata and draft content", async () => {
    const updateDraft = vi.fn(async (input: { workflowId: string }) =>
      input.workflowId === PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID
        ? parallelRecord({ draftRevision: 3 })
        : record({ draftRevision: 3 })
    )
    const store = {
      get: vi.fn(async (workflowId: string) =>
        workflowId === PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID
          ? parallelRecord({ draftRevision: 2 })
          : record({ name: "Old example", draftRevision: 2 })
      ),
      create: vi.fn(),
      updateDraft
    }

    await expect(seedExampleWorkflows(store)).resolves.toEqual([
      {
        workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
        name: "Example: Manual data and validation",
        status: "updated"
      },
      {
        workflowId: PARALLEL_COLLECTION_ROUTING_WORKFLOW_ID,
        name: "Example: Parallel collection and routing",
        status: "unchanged"
      }
    ])
    expect(updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: MANUAL_DATA_VALIDATION_WORKFLOW_ID,
        expectedRevision: 2,
        name: "Example: Manual data and validation"
      })
    )
  })
})
