import { describe, expect, it } from "vitest"
import { compileWorkflowDefinition, WorkflowCompilationError } from "./compiler"
import type { WorkflowDefinitionV2 } from "./definitionV2"
import type { WorkflowModelSnapshot } from "./modelCatalog"
import type { RepositoryAgentSnapshot } from "./repositoryAgents"

const workflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"

function definition(): WorkflowDefinitionV2 {
  return {
    schemaVersion: "2",
    inputSchema: { type: "object", additionalProperties: false },
    outputSchema: { type: "object" },
    constants: {},
    resourceBindings: {},
    fixtures: [],
    steps: [
      {
        id: "manual",
        label: "Manual",
        position: { x: 0, y: 0 },
        definition: { kind: "manual_trigger", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "set",
        label: "Set fields",
        position: { x: 200, y: 0 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: { answer: 42 } },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "success",
        label: "Success",
        position: { x: 400, y: 0 },
        definition: { kind: "success", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      }
    ],
    connections: [
      {
        id: "manual-set",
        source: { stepId: "manual", port: "input" },
        target: { stepId: "set", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "set-success",
        source: { stepId: "set", port: "value" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
  }
}

describe("compileWorkflowDefinition", () => {
  function compileIssues(source: WorkflowDefinitionV2, maximumPhase: 2 | 3 | 4 | 5 | 6 | 7) {
    try {
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase })
      throw new Error("Expected compilation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowCompilationError)
      return (error as WorkflowCompilationError).issues
    }
  }

  function expectIssueCodes(
    source: WorkflowDefinitionV2,
    maximumPhase: 2 | 3 | 4 | 5 | 6 | 7,
    expectedCodes: string[]
  ) {
    const issues = compileIssues(source, maximumPhase)
    const actualCodes = [...new Set(issues.map(({ code }) => code))].sort()
    expect(actualCodes).toEqual([...expectedCodes].sort())
  }

  it("builds a canonical Phase 2 execution package", () => {
    const source = definition()
    const first = compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 2 })
    const reordered = { ...source, steps: [...source.steps].reverse(), connections: [...source.connections].reverse() }
    const second = compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: reordered, maximumPhase: 2 })

    expect(first.digest).toBe(second.digest)
    expect(first.content.stepDefinitions.map(({ kind }) => kind)).toEqual(["manual_trigger", "set_fields", "success"])
    expect(first.content.graph).toMatchObject({ topologicalOrder: ["manual", "set", "success"] })
  })

  it("rejects step families before their release phase", () => {
    const source = definition()
    source.steps[1] = { ...source.steps[1]!, definition: { kind: "ai_model", version: 1 } }

    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 2 })
    ).toThrow(WorkflowCompilationError)
  })

  it("rejects incompatible ports, unreachable steps, and cycles", () => {
    const source = definition()
    source.connections[0] = { ...source.connections[0]!, source: { stepId: "manual", port: "missing" } }
    source.connections.push({
      id: "success-set",
      source: { stepId: "success", port: "result" },
      target: { stepId: "set", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })

    try {
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 2 })
      throw new Error("Expected compilation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowCompilationError)
      expect((error as WorkflowCompilationError).issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["source_port", "cycle"])
      )
    }
  })

  it("requires switch edges to name unique declared branches", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "switch", version: 1 },
      config: {
        cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
        defaultKey: "normal",
        joinStepId: "success"
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "input" } }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "set", port: "branch" },
      branchKey: "missing"
    }

    try {
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 7 })
      throw new Error("Expected compilation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowCompilationError)
      expect((error as WorkflowCompilationError).issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["switch_branch_unknown", "switch_branch_unconnected"])
      )
    }
  })

  it("allows only an explicit bounded-loop back edge", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "bounded_loop", version: 1 },
      config: {
        maximumIterations: 3,
        maximumActivations: 20,
        condition: { path: ["continue"], operator: "truthy" },
        bodyStepId: "body",
        exitStepId: "success",
        onExhaustion: "fail"
      }
    }
    source.steps.splice(2, 0, {
      id: "body",
      label: "Body",
      position: { x: 300, y: 100 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections = [
      { ...source.connections[0]!, target: { stepId: "set", port: "state" } },
      {
        id: "loop-body",
        source: { stepId: "set", port: "iteration" },
        target: { stepId: "body", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: ["state"], targetPath: [] }]
      },
      {
        id: "body-loop",
        source: { stepId: "body", port: "value" },
        target: { stepId: "set", port: "state" },
        outcome: "success",
        loopBack: true,
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "loop-success",
        source: { stepId: "set", port: "result" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]

    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 7 })
    ).not.toThrow()
  })

  it("rejects a join quorum larger than its incoming success paths", () => {
    const source = definition()
    source.steps[2] = {
      ...source.steps[2]!,
      definition: { kind: "join", version: 1 },
      config: { policy: "quorum", quorum: 2 }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      target: { stepId: "success", port: "branches" }
    }

    try {
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 7 })
      throw new Error("Expected compilation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowCompilationError)
      expect((error as WorkflowCompilationError).issues).toContainEqual(
        expect.objectContaining({
          code: "join_quorum_unsatisfiable",
          stepId: "success"
        })
      )
    }
  })

  it("pins exactly the approved repository-agent snapshot", () => {
    const source = definition()
    const contentDigest = "d".repeat(64)
    const reference = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      repositoryId: "42",
      repositoryName: "agency/repository",
      ref: "main",
      path: ".github/reviewer.agent.md",
      observedCommitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      contentDigest,
      sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
      name: "Reviewer",
      description: "Reviews candidate changes",
      requestedTools: ["read"]
    }
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "repository_agent", version: 1 },
      config: { agentReference: reference }
    }
    source.connections[0] = {
      ...source.connections[0]!,
      target: { stepId: "set", port: "context" }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "set", port: "result" }
    }
    const snapshot: RepositoryAgentSnapshot = {
      reference,
      content: "---\nname: Reviewer\ndescription: Reviews candidate changes\n---\nReview.",
      body: "Review.",
      parserVersion: "1",
      effectiveModel: null,
      effectiveTools: ["read"]
    }

    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 4 })
    ).toThrow("no approved repository agent snapshot")
    const compiled = compileWorkflowDefinition({
      workflowId,
      workflowVersion: 1,
      definition: source,
      maximumPhase: 4,
      agentSnapshots: [snapshot]
    })
    expect(compiled.content.agentSnapshots).toEqual([snapshot])
  })

  it("pins a capability-compatible model catalog snapshot", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "ai_model", version: 1 },
      config: {
        modelId: "openai/gpt-test",
        messages: [{ role: "user", content: "Return the issue classification." }],
        outputMode: "structured",
        outputSchema: { type: "object", required: ["label"], properties: { label: { type: "string" } } },
        parameters: { temperature: 0 }
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "context" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "response" } }
    const snapshot: WorkflowModelSnapshot = {
      modelId: "openai/gpt-test",
      name: "GPT Test",
      contextLength: 128_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { inputModalities: ["text"], outputModalities: ["text"] },
      supportedParameters: ["temperature", "response_format"],
      observedAt: "2026-07-19T12:00:00.000Z"
    }

    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 5 })
    ).toThrow("no approved model catalog snapshot")
    source.steps[1]!.config.parameters = { top_p: 0.8 }
    expect(() =>
      compileWorkflowDefinition({
        workflowId,
        workflowVersion: 1,
        definition: source,
        maximumPhase: 5,
        modelSnapshots: [snapshot]
      })
    ).toThrow("does not advertise top_p")
    source.steps[1]!.config.parameters = { temperature: 0 }
    const compiled = compileWorkflowDefinition({
      workflowId,
      workflowVersion: 1,
      definition: source,
      maximumPhase: 5,
      modelSnapshots: [snapshot]
    })
    expect(compiled.content.modelSnapshots).toEqual([snapshot])
  })

  it("rejects provider steps without a valid binding object", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "provider_data", version: 1 },
      config: {
        provider: "github",
        operation: "github.repository"
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "query" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "result" } }

    const issues = compileIssues(source, 6)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "provider_binding",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it("rejects provider bindings that are not sealed in resource bindings", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "provider_data", version: 1 },
      config: {
        provider: "github",
        operation: "github.repository",
        binding: {
          connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e11",
          externalId: "agency/repository"
        }
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "query" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "result" } }

    const issues = compileIssues(source, 6)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "provider_binding_unsealed",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it("rejects unreferenced sealed resource bindings", () => {
    const source = definition()
    source.resourceBindings = {
      team: {
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e77",
        provider: "linear",
        resourceType: "team",
        externalId: "TEAM",
        name: "Linear Team",
        capabilities: ["issue.read"]
      }
    }

    const issues = compileIssues(source, 6)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "provider_binding_unreferenced",
        stepId: null,
        connectionId: null
      })
    )
  })

  it("rejects unreferenced repository-agent and model snapshots", () => {
    const source = definition()
    const modelSnapshot: WorkflowModelSnapshot = {
      modelId: "openai/gpt-test",
      name: "GPT Test",
      contextLength: 128_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { inputModalities: ["text"], outputModalities: ["text"] },
      supportedParameters: ["temperature", "response_format"],
      observedAt: "2026-07-19T12:00:00.000Z"
    }
    const contentDigest = "c".repeat(64)
    const agentSnapshot: RepositoryAgentSnapshot = {
      reference: {
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e88",
        repositoryId: "42",
        repositoryName: "agency/repository",
        ref: "main",
        path: ".github/reviewer.agent.md",
        observedCommitSha: "a".repeat(40),
        blobSha: "b".repeat(40),
        contentDigest,
        sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
        name: "Reviewer",
        description: "Reviews candidate changes",
        requestedTools: ["read"]
      },
      content: "---\nname: Reviewer\ndescription: Reviews candidate changes\n---\nReview.",
      body: "Review.",
      parserVersion: "1",
      effectiveModel: null,
      effectiveTools: ["read"]
    }

    try {
      compileWorkflowDefinition({
        workflowId,
        workflowVersion: 1,
        definition: source,
        maximumPhase: 5,
        modelSnapshots: [modelSnapshot],
        agentSnapshots: [agentSnapshot]
      })
      throw new Error("Expected compilation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowCompilationError)
      const issues = (error as WorkflowCompilationError).issues
      expect(issues).toContainEqual(
        expect.objectContaining({
          code: "model_snapshot_unreferenced",
          stepId: null,
          connectionId: null
        })
      )
      expect(issues).toContainEqual(
        expect.objectContaining({
          code: "agent_snapshot_unreferenced",
          stepId: null,
          connectionId: null
        })
      )
    }
  })

  it("requires condition steps to join through an exclusive merge", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: {
        expression: { path: ["priority"], operator: "equals", value: "urgent" },
        joinStepId: "success"
      }
    }
    source.connections = [
      { ...source.connections[0]!, target: { stepId: "set", port: "input" } },
      {
        ...source.connections[1]!,
        source: { stepId: "set", port: "true" },
        target: { stepId: "success", port: "result" }
      }
    ]

    const issues = compileIssues(source, 7)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "branch_merge",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it("requires switch steps to join through an exclusive merge", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "switch", version: 1 },
      config: {
        cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
        defaultKey: "normal",
        joinStepId: "success"
      }
    }
    source.steps.splice(2, 0, {
      id: "failure",
      label: "Failure",
      position: { x: 400, y: 100 },
      definition: { kind: "failure", version: 1 },
      config: { code: "FAILED", message: "failed" },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections = [
      { ...source.connections[0]!, target: { stepId: "set", port: "input" } },
      {
        ...source.connections[1]!,
        source: { stepId: "set", port: "branch" },
        target: { stepId: "success", port: "result" },
        branchKey: "urgent"
      },
      {
        id: "switch-default",
        source: { stepId: "set", port: "branch" },
        target: { stepId: "failure", port: "error" },
        outcome: "success",
        branchKey: "normal",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]

    const issues = compileIssues(source, 7)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "branch_merge",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it("rejects for-each steps with missing body or non-join aggregation target", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "for_each", version: 1 },
      config: {
        maximumItems: 10,
        concurrency: 2,
        bodyStepId: "missing-body",
        joinStepId: "success"
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "items" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "item" } }

    const issues = compileIssues(source, 7)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "for_each_body",
        stepId: "set",
        connectionId: null
      })
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "for_each_join",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it("rejects for-each steps when the body cannot reach the configured join", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "for_each", version: 1 },
      config: {
        maximumItems: 10,
        concurrency: 2,
        bodyStepId: "body",
        joinStepId: "join"
      }
    }
    source.steps.splice(2, 0, {
      id: "body",
      label: "Body",
      position: { x: 320, y: -100 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.steps.splice(3, 0, {
      id: "join",
      label: "Join",
      position: { x: 320, y: 100 },
      definition: { kind: "join", version: 1 },
      config: { policy: "any" },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections = [
      { ...source.connections[0]!, target: { stepId: "set", port: "items" } },
      {
        id: "for-each-body",
        source: { stepId: "set", port: "item" },
        target: { stepId: "body", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "manual-join",
        source: { stepId: "manual", port: "input" },
        target: { stepId: "join", port: "branches" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "join-success",
        source: { stepId: "join", port: "results" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]

    const issues = compileIssues(source, 7)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "for_each_body_exit",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it("rejects bounded loops with missing body and exit targets", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "bounded_loop", version: 1 },
      config: {
        maximumIterations: 3,
        maximumActivations: 20,
        condition: { path: ["continue"], operator: "truthy" },
        bodyStepId: "missing-body",
        exitStepId: "missing-exit",
        onExhaustion: "fail"
      }
    }
    source.connections = [
      { ...source.connections[0]!, target: { stepId: "set", port: "state" } },
      {
        ...source.connections[1]!,
        source: { stepId: "set", port: "result" },
        target: { stepId: "success", port: "result" }
      }
    ]

    const issues = compileIssues(source, 7)
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "loop_body",
        stepId: "set",
        connectionId: null
      })
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "loop_exit",
        stepId: "set",
        connectionId: null
      })
    )
  })

  it.each([
    {
      name: "duplicate step IDs",
      maximumPhase: 2 as const,
      expectedCodes: ["duplicate_step"],
      build(source: WorkflowDefinitionV2) {
        source.steps.push({
          ...source.steps[1]!,
          id: "set",
          label: "Duplicate set",
          position: { x: 220, y: 120 }
        })
      }
    },
    {
      name: "duplicate connection IDs",
      maximumPhase: 2 as const,
      expectedCodes: ["duplicate_connection"],
      build(source: WorkflowDefinitionV2) {
        source.steps.push({
          id: "failure",
          label: "Failure",
          position: { x: 420, y: 120 },
          definition: { kind: "failure", version: 1 },
          config: { code: "FAILED", message: "failed" },
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        })
        source.connections.push({
          id: "set-success",
          source: { stepId: "manual", port: "input" },
          target: { stepId: "failure", port: "error" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        })
      }
    },
    {
      name: "connection references a missing source step",
      maximumPhase: 2 as const,
      expectedCodes: ["missing_step"],
      build(source: WorkflowDefinitionV2) {
        source.connections.push({
          id: "missing-success",
          source: { stepId: "ghost", port: "input" },
          target: { stepId: "success", port: "result" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        })
      }
    },
    {
      name: "connection references an unavailable source port",
      maximumPhase: 2 as const,
      expectedCodes: ["source_port"],
      build(source: WorkflowDefinitionV2) {
        source.steps.push({
          id: "failure",
          label: "Failure",
          position: { x: 420, y: 120 },
          definition: { kind: "failure", version: 1 },
          config: { code: "FAILED", message: "failed" },
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        })
        source.connections.push({
          id: "manual-failure",
          source: { stepId: "manual", port: "missing" },
          target: { stepId: "failure", port: "error" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        })
      }
    },
    {
      name: "connection references an unavailable target port",
      maximumPhase: 2 as const,
      expectedCodes: ["target_port"],
      build(source: WorkflowDefinitionV2) {
        source.connections.push({
          id: "manual-success-missing",
          source: { stepId: "manual", port: "input" },
          target: { stepId: "success", port: "missing" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        })
      }
    },
    {
      name: "connection mapping has incompatible schemas",
      maximumPhase: 7 as const,
      expectedCodes: ["mapping_type"],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "join", version: 1 },
          config: { policy: "any" }
        }
        source.connections[0] = {
          ...source.connections[0]!,
          target: { stepId: "set", port: "branches" }
        }
        source.connections[1] = {
          ...source.connections[1]!,
          source: { stepId: "set", port: "results" },
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      }
    },
    {
      name: "single-cardinality input receives multiple edges",
      maximumPhase: 2 as const,
      expectedCodes: ["input_cardinality"],
      build(source: WorkflowDefinitionV2) {
        source.steps.splice(2, 0, {
          id: "map",
          label: "Map",
          position: { x: 200, y: 120 },
          definition: { kind: "map_fields", version: 1 },
          config: { mappings: {} },
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        })
        source.connections = [
          { ...source.connections[0]! },
          {
            id: "manual-map",
            source: { stepId: "manual", port: "input" },
            target: { stepId: "map", port: "input" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "map-set",
            source: { stepId: "map", port: "value" },
            target: { stepId: "set", port: "input" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          { ...source.connections[1]! }
        ]
      }
    },
    {
      name: "arbitrary non-loop cycle in graph",
      maximumPhase: 7 as const,
      expectedCodes: ["cycle"],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "exclusive_merge", version: 1 },
          config: {}
        }
        source.steps.splice(2, 0, {
          id: "body",
          label: "Body",
          position: { x: 300, y: 120 },
          definition: { kind: "set_fields", version: 1 },
          config: { fields: {} },
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        })
        source.connections = [
          {
            id: "manual-merge",
            source: { stepId: "manual", port: "input" },
            target: { stepId: "set", port: "branches" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "merge-body",
            source: { stepId: "set", port: "value" },
            target: { stepId: "body", port: "input" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "body-merge",
            source: { stepId: "body", port: "value" },
            target: { stepId: "set", port: "branches" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "body-success",
            source: { stepId: "body", port: "value" },
            target: { stepId: "success", port: "result" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          }
        ]
      }
    },
    {
      name: "orphaned step is unreachable and cannot reach a terminal",
      maximumPhase: 2 as const,
      expectedCodes: ["terminal_unreachable", "unreachable_step"],
      build(source: WorkflowDefinitionV2) {
        source.steps.push({
          id: "orphan",
          label: "Orphan",
          position: { x: 620, y: 0 },
          definition: { kind: "set_fields", version: 1 },
          config: { fields: {} },
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        })
      }
    },
    {
      name: "workflow requires at least one trigger",
      maximumPhase: 2 as const,
      expectedCodes: ["trigger_required", "unreachable_step"],
      build(source: WorkflowDefinitionV2) {
        source.steps[0] = {
          ...source.steps[0]!,
          definition: { kind: "set_fields", version: 1 },
          config: { fields: {} }
        }
        source.connections[0] = {
          ...source.connections[0]!,
          source: { stepId: "manual", port: "value" }
        }
      }
    },
    {
      name: "workflow requires at least one terminal",
      maximumPhase: 2 as const,
      expectedCodes: ["terminal_required", "terminal_unreachable"],
      build(source: WorkflowDefinitionV2) {
        source.steps[2] = {
          ...source.steps[2]!,
          definition: { kind: "set_fields", version: 1 },
          config: { fields: {} }
        }
        source.connections[1] = {
          ...source.connections[1]!,
          target: { stepId: "success", port: "input" }
        }
      }
    }
  ])("table-driven graph/compiler branch: $name", ({ maximumPhase, expectedCodes, build }) => {
    const source = definition()
    build(source)
    expectIssueCodes(source, maximumPhase, expectedCodes)
  })

  it.each([
    {
      name: "switch connection without a branch key",
      expectedCodes: ["switch_branch_required", "switch_branch_unconnected"],
      mutate(source: WorkflowDefinitionV2) {
        source.connections[1] = { ...source.connections[1]!, branchKey: undefined }
      }
    },
    {
      name: "switch connection with an undeclared branch key",
      expectedCodes: ["switch_branch_unknown", "switch_branch_unconnected"],
      mutate(source: WorkflowDefinitionV2) {
        source.connections[1] = { ...source.connections[1]!, branchKey: "other" }
      }
    },
    {
      name: "switch declares duplicate case/default keys",
      expectedCodes: ["switch_branch_duplicate"],
      mutate(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          config: {
            cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
            defaultKey: "urgent",
            joinStepId: "merge"
          }
        }
        source.connections[2] = {
          ...source.connections[2]!,
          source: { stepId: "set", port: "branch" },
          branchKey: "urgent"
        }
      }
    }
  ])("table-driven switch branch validation: $name", ({ expectedCodes, mutate }) => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "switch", version: 1 },
      config: {
        cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
        defaultKey: "normal",
        joinStepId: "merge"
      }
    }
    source.steps.splice(2, 0, {
      id: "merge",
      label: "Merge",
      position: { x: 360, y: 0 },
      definition: { kind: "exclusive_merge", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections = [
      {
        id: "manual-switch",
        source: { stepId: "manual", port: "input" },
        target: { stepId: "set", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "switch-urgent",
        source: { stepId: "set", port: "branch" },
        target: { stepId: "merge", port: "branches" },
        outcome: "success",
        branchKey: "urgent",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "switch-normal",
        source: { stepId: "set", port: "branch" },
        target: { stepId: "merge", port: "branches" },
        outcome: "success",
        branchKey: "normal",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "merge-success",
        source: { stepId: "merge", port: "value" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
    mutate(source)
    expectIssueCodes(source, 7, expectedCodes)
  })

  it("flags non-switch branch keys and branch paths that cannot reach their configured merge", () => {
    const nonSwitchSource = definition()
    nonSwitchSource.connections[1] = { ...nonSwitchSource.connections[1]!, branchKey: "unexpected" }
    expectIssueCodes(nonSwitchSource, 2, ["branch_key_invalid"])

    const conditionSource = definition()
    conditionSource.steps[1] = {
      ...conditionSource.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: {
        expression: { path: ["priority"], operator: "equals", value: "urgent" },
        joinStepId: "merge"
      }
    }
    conditionSource.steps.splice(2, 0, {
      id: "merge",
      label: "Merge",
      position: { x: 340, y: -100 },
      definition: { kind: "exclusive_merge", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    conditionSource.steps.push({
      id: "failure",
      label: "Failure",
      position: { x: 540, y: 100 },
      definition: { kind: "failure", version: 1 },
      config: { code: "FAILED", message: "failed" },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    conditionSource.connections = [
      {
        id: "manual-condition",
        source: { stepId: "manual", port: "input" },
        target: { stepId: "set", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "condition-true",
        source: { stepId: "set", port: "true" },
        target: { stepId: "failure", port: "error" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "condition-false",
        source: { stepId: "set", port: "false" },
        target: { stepId: "merge", port: "branches" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "merge-success",
        source: { stepId: "merge", port: "value" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
    expectIssueCodes(conditionSource, 7, ["branch_merge_unreachable"])
  })

  it.each([
    {
      name: "join any",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "join", version: 1 },
          config: { policy: "any" }
        }
        source.connections = [
          {
            id: "manual-join",
            source: { stepId: "manual", port: "input" },
            target: { stepId: "set", port: "branches" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "join-success",
            source: { stepId: "set", port: "results" },
            target: { stepId: "success", port: "result" },
            outcome: "success",
            mappings: [{ sourcePath: ["[]"], targetPath: [] }]
          }
        ]
      }
    },
    {
      name: "join all",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "join", version: 1 },
          config: { policy: "all" }
        }
        source.connections = [
          {
            id: "manual-join",
            source: { stepId: "manual", port: "input" },
            target: { stepId: "set", port: "branches" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "join-success",
            source: { stepId: "set", port: "results" },
            target: { stepId: "success", port: "result" },
            outcome: "success",
            mappings: [{ sourcePath: ["[]"], targetPath: [] }]
          }
        ]
      }
    },
    {
      name: "join quorum",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "join", version: 1 },
          config: { policy: "quorum", quorum: 2 }
        }
        source.steps.splice(1, 0, {
          id: "schedule",
          label: "Schedule",
          position: { x: 0, y: 120 },
          definition: { kind: "schedule", version: 1 },
          config: { timezone: "UTC", intervalSeconds: 60 },
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        })
        source.connections = [
          {
            id: "manual-join",
            source: { stepId: "manual", port: "input" },
            target: { stepId: "set", port: "branches" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "schedule-join",
            source: { stepId: "schedule", port: "fire" },
            target: { stepId: "set", port: "branches" },
            outcome: "success",
            mappings: [{ sourcePath: [], targetPath: [] }]
          },
          {
            id: "join-success",
            source: { stepId: "set", port: "results" },
            target: { stepId: "success", port: "result" },
            outcome: "success",
            mappings: [{ sourcePath: ["[]"], targetPath: [] }]
          }
        ]
      }
    }
  ])("compiles valid join policy configuration: $name", ({ maximumPhase, build }) => {
    const source = definition()
    build(source)
    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase })
    ).not.toThrow()
  })

  it("supports multiple triggers when each route remains valid", () => {
    const source = definition()
    source.steps.splice(1, 0, {
      id: "schedule",
      label: "Schedule",
      position: { x: 0, y: 120 },
      definition: { kind: "schedule", version: 1 },
      config: { timezone: "UTC", intervalSeconds: 60 },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.steps.push({
      id: "failure",
      label: "Failure",
      position: { x: 420, y: 120 },
      definition: { kind: "failure", version: 1 },
      config: { code: "FAILED", message: "failed" },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections.push({
      id: "schedule-failure",
      source: { stepId: "schedule", port: "fire" },
      target: { stepId: "failure", port: "error" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })

    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase: 7 })
    ).not.toThrow()
  })

  it("rejects unavailable step versions and phase-gated kinds", () => {
    const unknownVersion = definition()
    unknownVersion.steps.push({
      id: "future",
      label: "Future",
      position: { x: 620, y: 0 },
      definition: { kind: "set_fields", version: 99 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    expectIssueCodes(unknownVersion, 7, ["step_unavailable", "terminal_unreachable", "unreachable_step"])

    const phaseGated = definition()
    phaseGated.steps.push({
      id: "late",
      label: "Late phase",
      position: { x: 620, y: 0 },
      definition: { kind: "wait", version: 1 },
      config: { correlation: "run.id", expiresAfterSeconds: 30, eventSchema: { type: "object" } },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    expectIssueCodes(phaseGated, 6, ["step_unavailable", "terminal_unreachable", "unreachable_step"])
  })

  it("flags duplicate loop-back edges on bounded loops", () => {
    const source = definition()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "bounded_loop", version: 1 },
      config: {
        maximumIterations: 3,
        maximumActivations: 20,
        condition: { path: ["continue"], operator: "truthy" },
        bodyStepId: "body",
        exitStepId: "success",
        onExhaustion: "fail"
      }
    }
    source.steps.splice(2, 0, {
      id: "body",
      label: "Body",
      position: { x: 300, y: 100 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.steps.splice(3, 0, {
      id: "body-two",
      label: "Body two",
      position: { x: 420, y: 100 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections = [
      { ...source.connections[0]!, target: { stepId: "set", port: "state" } },
      {
        id: "loop-body",
        source: { stepId: "set", port: "iteration" },
        target: { stepId: "body", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: ["state"], targetPath: [] }]
      },
      {
        id: "body-body-two",
        source: { stepId: "body", port: "value" },
        target: { stepId: "body-two", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "body-loop",
        source: { stepId: "body", port: "value" },
        target: { stepId: "set", port: "state" },
        outcome: "success",
        loopBack: true,
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "body-two-loop",
        source: { stepId: "body-two", port: "value" },
        target: { stepId: "set", port: "state" },
        outcome: "success",
        loopBack: true,
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "loop-success",
        source: { stepId: "set", port: "result" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]

    expectIssueCodes(source, 7, ["loop_back", "loop_back_duplicate"])
  })

  it.each([
    {
      name: "failure policy maximum attempts above limit",
      maximumPhase: 2 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          failurePolicy: { mode: "stop", maximumAttempts: 11 }
        }
      }
    },
    {
      name: "for-each limits below minimum",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "for_each", version: 1 },
          config: {
            maximumItems: 0,
            concurrency: 0,
            bodyStepId: "set",
            joinStepId: "success"
          }
        }
      }
    },
    {
      name: "bounded-loop exhaustion policy outside enum",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "bounded_loop", version: 1 },
          config: {
            maximumIterations: 2,
            maximumActivations: 10,
            condition: { path: ["continue"], operator: "truthy" },
            bodyStepId: "set",
            exitStepId: "success",
            onExhaustion: "halt"
          }
        }
      }
    },
    {
      name: "wait timeout below minimum",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "wait", version: 1 },
          config: {
            correlation: "run.id",
            expiresAfterSeconds: 0,
            eventSchema: { type: "object" }
          }
        }
      }
    },
    {
      name: "child workflow digest constraints",
      maximumPhase: 7 as const,
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "child_workflow", version: 1 },
          config: {
            packageDigest: "not-a-digest",
            interfaceDigest: "still-not-a-digest"
          }
        }
      }
    }
  ])("rejects invalid schema-constrained config: $name", ({ maximumPhase, build }) => {
    const source = definition()
    build(source)
    expect(() =>
      compileWorkflowDefinition({ workflowId, workflowVersion: 1, definition: source, maximumPhase })
    ).toThrow()
  })

  it.each([
    {
      name: "repository agent reference must include a content digest",
      maximumPhase: 4 as const,
      expectedCodes: ["agent_reference"],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "repository_agent", version: 1 },
          config: { agentReference: { name: "Reviewer" } }
        }
        source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "context" } }
        source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "result" } }
      }
    },
    {
      name: "model steps require a string model ID",
      maximumPhase: 5 as const,
      expectedCodes: ["model_reference"],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "ai_model", version: 1 },
          config: {
            modelId: 123,
            messages: [{ role: "user", content: "classify" }],
            outputMode: "text"
          }
        }
        source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "context" } }
        source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "response" } }
      }
    },
    {
      name: "structured output requires response_format support",
      maximumPhase: 5 as const,
      expectedCodes: ["model_structured_output"],
      modelSnapshots: [
        {
          modelId: "openai/gpt-test",
          name: "GPT Test",
          contextLength: 128_000,
          pricing: { prompt: "0.000001", completion: "0.000002" },
          architecture: { inputModalities: ["text"], outputModalities: ["text"] },
          supportedParameters: ["temperature"],
          observedAt: "2026-07-19T12:00:00.000Z"
        }
      ] as WorkflowModelSnapshot[],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "ai_model", version: 1 },
          config: {
            modelId: "openai/gpt-test",
            messages: [{ role: "user", content: "classify" }],
            outputMode: "structured",
            outputSchema: { type: "object", properties: { label: { type: "string" } }, required: ["label"] }
          }
        }
        source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "context" } }
        source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "response" } }
      }
    },
    {
      name: "model parameters must be an object",
      maximumPhase: 5 as const,
      expectedCodes: ["model_parameters"],
      modelSnapshots: [
        {
          modelId: "openai/gpt-test",
          name: "GPT Test",
          contextLength: 128_000,
          pricing: { prompt: "0.000001", completion: "0.000002" },
          architecture: { inputModalities: ["text"], outputModalities: ["text"] },
          supportedParameters: ["temperature", "response_format"],
          observedAt: "2026-07-19T12:00:00.000Z"
        }
      ] as WorkflowModelSnapshot[],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "ai_model", version: 1 },
          config: {
            modelId: "openai/gpt-test",
            messages: [{ role: "user", content: "classify" }],
            outputMode: "text",
            parameters: []
          }
        }
        source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "context" } }
        source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "response" } }
      }
    },
    {
      name: "model parameters must be declared in the snapshot",
      maximumPhase: 5 as const,
      expectedCodes: ["model_parameter_unsupported"],
      modelSnapshots: [
        {
          modelId: "openai/gpt-test",
          name: "GPT Test",
          contextLength: 128_000,
          pricing: { prompt: "0.000001", completion: "0.000002" },
          architecture: { inputModalities: ["text"], outputModalities: ["text"] },
          supportedParameters: ["temperature", "response_format"],
          observedAt: "2026-07-19T12:00:00.000Z"
        }
      ] as WorkflowModelSnapshot[],
      build(source: WorkflowDefinitionV2) {
        source.steps[1] = {
          ...source.steps[1]!,
          definition: { kind: "ai_model", version: 1 },
          config: {
            modelId: "openai/gpt-test",
            messages: [{ role: "user", content: "classify" }],
            outputMode: "text",
            parameters: { top_p: 0.9 }
          }
        }
        source.connections[0] = { ...source.connections[0]!, target: { stepId: "set", port: "context" } }
        source.connections[1] = { ...source.connections[1]!, source: { stepId: "set", port: "response" } }
      }
    }
  ])("table-driven snapshot pinning/config checks: $name", ({ maximumPhase, expectedCodes, modelSnapshots, build }) => {
    const source = definition()
    build(source)
    let issues: WorkflowCompilationError["issues"]
    try {
      compileWorkflowDefinition({
        workflowId,
        workflowVersion: 1,
        definition: source,
        maximumPhase,
        modelSnapshots: modelSnapshots ?? []
      })
      throw new Error("Expected compilation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowCompilationError)
      issues = (error as WorkflowCompilationError).issues
    }
    const actualCodes = [...new Set(issues.map(({ code }) => code))].sort()
    expect(actualCodes).toEqual([...expectedCodes].sort())
  })
})
