import { describe, expect, it } from "vitest"
import {
  deterministicActivationId,
  EXECUTION_CONTRACT_VERSION,
  executionPackageDigest,
  type ExecutionPackageContent
} from "./executionContracts"

const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e30"

function executionPackage(graph: ExecutionPackageContent["graph"]): ExecutionPackageContent {
  return {
    schemaVersion: EXECUTION_CONTRACT_VERSION,
    workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
    source: { kind: "published", version: 1 },
    compilerVersion: "1.0.0",
    mappingExpressionVersion: "1",
    eventDecoderVersions: { "run.started": "1" },
    graph,
    stepDefinitions: [
      {
        kind: "set_fields",
        version: 1,
        executorDigest: "a".repeat(64),
        configSchema: { type: "object" },
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        errorSchema: { type: "object" },
        executionClass: "control",
        mutationPolicy: "none",
        capabilities: []
      }
    ],
    constants: {},
    resourceReferences: [],
    agentSnapshots: [],
    modelSnapshots: []
  }
}

describe("workflow execution contracts", () => {
  it("derives stable activation identities from logical scope", () => {
    const identity = deterministicActivationId({
      runId,
      stepId: "review-change",
      scope: [
        { kind: "branch", key: "approved" },
        { kind: "loop", key: "review-loop", iteration: 2 },
        { kind: "item", key: "src/index.ts" }
      ]
    })

    expect(identity).toMatch(/^[0-9a-f]{64}$/u)
    expect(
      deterministicActivationId({
        runId,
        stepId: "review-change",
        scope: [
          { kind: "branch", key: "approved" },
          { kind: "loop", key: "review-loop", iteration: 2 },
          { kind: "item", key: "src/index.ts" }
        ]
      })
    ).toBe(identity)
    expect(deterministicActivationId({ runId, stepId: "review-change", scope: [] })).not.toBe(identity)
  })

  it("produces stable package digests independent of object key order", () => {
    const left = executionPackage({ nodes: [{ id: "set", config: { beta: 2, alpha: 1 } }], edges: [] })
    const right = executionPackage({ edges: [], nodes: [{ config: { alpha: 1, beta: 2 }, id: "set" }] })

    expect(executionPackageDigest(left)).toBe(executionPackageDigest(right))
    expect(executionPackageDigest(left)).toMatch(/^[0-9a-f]{64}$/u)
  })

  it("rejects values outside the durable state machines", async () => {
    const contracts = await import("./executionContracts")

    expect(contracts.WorkflowAttemptStatusSchema.safeParse("retrying").success).toBe(false)
    expect(contracts.WorkflowEffectStatusSchema.safeParse("unknown").success).toBe(true)
    expect(contracts.WorkflowWaitStatusSchema.safeParse("resumed").success).toBe(true)
  })
})
