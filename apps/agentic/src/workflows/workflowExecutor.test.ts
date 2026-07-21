import { describe, expect, it, vi } from "vitest"
import { CompiledWorkflowGraphSchema } from "./compiler"
import type { WorkflowDefinition } from "./definition"
import { WorkflowModelExecutionError } from "./modelExecutor"
import { WorkflowProviderExecutionError } from "./providerExecutor"
import {
  downstreamActivations,
  executeWorkflowStep,
  WorkflowDispatcher,
  projectConnectionOutput
} from "./workflowExecutor"

const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e30"
const activationId = "a".repeat(64)

function definition(): WorkflowDefinition {
  return {
    schemaVersion: "2",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    constants: {},
    resourceBindings: {},
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
        label: "Set",
        position: { x: 200, y: 0 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: { answer: 42 } },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "success",
        label: "Result",
        position: { x: 400, y: 0 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: {} },
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
        target: { stepId: "success", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
  }
}

function childReconciliationJournal() {
  return {
    listChildRunLinks: vi.fn(async () => []),
    getChildRunCompletion: vi.fn(async () => null),
    recordChildRunCompletion: vi.fn(async () => undefined),
    resumeWait: vi.fn(async () => null),
    failWait: vi.fn(async () => null)
  }
}

describe("workflow execution", () => {
  it("executes deterministic data steps including an ordinary sink", async () => {
    const source = definition()
    await expect(executeWorkflowStep(source.steps[1]!, { input: { issue: "FEN-423" } })).resolves.toEqual({
      output: { value: { issue: "FEN-423", answer: 42 } },
      error: null,
      data: []
    })
    await expect(executeWorkflowStep(source.steps[2]!, { input: { answer: 42 } })).resolves.toEqual({
      output: { value: { answer: 42 } },
      error: null,
      data: []
    })
  })

  it("projects declared edge mappings without exposing other output", () => {
    const connection = definition().connections[0]!
    expect(projectConnectionOutput(connection, { input: { visible: true }, secret: "hidden" })).toEqual({
      input: { visible: true }
    })
  })

  it("stages a bounded Markdown artifact and emits its durable datum", async () => {
    const write = vi.fn(async () => "artifact.md")
    const step = {
      id: "report",
      label: "Report",
      position: { x: 0, y: 0 },
      definition: { kind: "compose_markdown", version: 1 },
      config: { template: "# {{issue.id}}\n\n{{summary}}" },
      failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
    }
    const result = await executeWorkflowStep(
      step,
      { values: { issue: { id: "FEN-423" }, summary: "Ready" } },
      {
        activationId,
        attemptOrdinal: 1,
        artifactStore: { write, read: vi.fn(), manifest: () => [] }
      }
    )

    expect(write).toHaveBeenCalledWith(
      expect.stringMatching(/^workflow\/a{64}\/1\/[0-9a-f]{64}\.md$/u),
      Buffer.from("# FEN-423\n\nReady"),
      "text/markdown"
    )
    expect(result.output.markdown).toMatchObject({ kind: "markdown", producerActivationId: activationId })
    expect(result.data).toEqual([{ name: "markdown", kind: "artifact", payload: result.output.markdown }])
  })

  it("collects bounded items as arrays or keyed objects", async () => {
    const step = {
      id: "collect",
      label: "Collect",
      position: { x: 0, y: 0 },
      definition: { kind: "collect", version: 1 },
      config: { mode: "keyed", keyField: "id", maximumItems: 2 },
      failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
    }
    await expect(
      executeWorkflowStep(step, {
        items: [
          { id: "a", value: 1 },
          { id: "b", value: 2 }
        ]
      })
    ).resolves.toMatchObject({
      output: { collection: { a: { id: "a", value: 1 }, b: { id: "b", value: 2 } } }
    })
    await expect(executeWorkflowStep(step, { items: [{ id: "a" }, { id: "b" }, { id: "c" }] })).rejects.toThrow(
      "maximum is 2"
    )
  })

  it("maps selected input fields and fails when a source path is missing", async () => {
    const source = definition()
    const step = {
      ...source.steps[1]!,
      definition: { kind: "map_fields", version: 1 },
      config: { mappings: { issueId: "issue.id", title: "issue.title" } }
    }
    await expect(
      executeWorkflowStep(step, {
        input: { issue: { id: "FEN-423", title: "Fix flaky test", ignored: true }, actor: { login: "octocat" } }
      })
    ).resolves.toMatchObject({
      output: { value: { issueId: "FEN-423", title: "Fix flaky test" } }
    })

    await expect(executeWorkflowStep(step, { input: { issue: { title: "Missing id" } } })).rejects.toThrow(
      "Mapping source path issue.id is unavailable"
    )
  })

  it("routes valid and invalid values and rejects invalid validate step config", async () => {
    const source = definition()
    const step = {
      ...source.steps[1]!,
      definition: { kind: "validate", version: 1 },
      config: {
        schema: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["open", "closed"] }
          }
        }
      }
    }
    await expect(executeWorkflowStep(step, { input: { status: "pending" } })).resolves.toMatchObject({
      output: {
        false: {
          value: { status: "pending" },
          issues: [{ path: "$.status", message: "Value is not one of the allowed values" }],
          schemaDigest: expect.stringMatching(/^[0-9a-f]{64}$/u)
        }
      }
    })
    await expect(executeWorkflowStep(step, { input: { status: "open" } })).resolves.toMatchObject({
      output: { true: { status: "open" } },
      error: null
    })
    await expect(executeWorkflowStep(step, {})).rejects.toThrow("Validate requires input")

    const invalidSchemaStep = {
      ...step,
      config: { schema: "not-an-object" }
    }
    await expect(executeWorkflowStep(invalidSchemaStep, { value: { status: "open" } })).rejects.toThrow(
      "$.schema: Expected object"
    )
  })

  it("routes deterministic conditions and selects one switch branch", async () => {
    const source = definition()
    const condition = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: { expression: { path: ["score"], operator: "greater_than_or_equal", value: 80 }, joinStepId: "merge" }
    }
    await expect(executeWorkflowStep(condition, { input: { score: 91 } })).resolves.toMatchObject({
      output: { true: { score: 91 } }
    })
    await expect(executeWorkflowStep(condition, { input: { score: 42 } })).resolves.toMatchObject({
      output: { false: { score: 42 } }
    })

    const switchStep = {
      ...source.steps[1]!,
      definition: { kind: "switch", version: 1 },
      config: {
        cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
        defaultKey: "normal",
        joinStepId: "merge"
      }
    }
    await expect(executeWorkflowStep(switchStep, { input: { priority: "urgent" } })).resolves.toMatchObject({
      output: { branch: { key: "urgent", value: { priority: "urgent" } } }
    })
    await expect(executeWorkflowStep(switchStep, { input: { priority: "low" } })).resolves.toMatchObject({
      output: { branch: { key: "normal", value: { priority: "low" } } }
    })
    await expect(
      executeWorkflowStep(
        { ...source.steps[1]!, definition: { kind: "exclusive_merge", version: 1 }, config: {} },
        { branches: [{ id: "one" }] }
      )
    ).resolves.toMatchObject({ output: { value: { id: "one" } } })
    await expect(
      executeWorkflowStep(
        { ...source.steps[1]!, definition: { kind: "join", version: 1 }, config: { policy: "all" } },
        { branches: [{ id: "one" }, { id: "two" }] }
      )
    ).resolves.toMatchObject({ output: { results: [{ id: "one" }, { id: "two" }] } })
  })

  it("evaluates additional condition comparators and routes condition and switch branches downstream", async () => {
    const source = definition()
    const conditionExists = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: { expression: { path: ["issue", "id"], operator: "exists" }, joinStepId: "merge" }
    }
    const conditionTruthy = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: { expression: { path: ["count"], operator: "truthy" }, joinStepId: "merge" }
    }
    const conditionNotEquals = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: { expression: { path: ["status"], operator: "not_equals", value: "done" }, joinStepId: "merge" }
    }
    const conditionLessThan = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: { expression: { path: ["score"], operator: "less_than", value: 10 }, joinStepId: "merge" }
    }

    await expect(executeWorkflowStep(conditionExists, { input: { issue: { id: "FEN-423" } } })).resolves.toMatchObject({
      output: { true: { issue: { id: "FEN-423" } } }
    })
    await expect(executeWorkflowStep(conditionTruthy, { input: { count: 0 } })).resolves.toMatchObject({
      output: { false: { count: 0 } }
    })
    await expect(executeWorkflowStep(conditionNotEquals, { input: { status: "queued" } })).resolves.toMatchObject({
      output: { true: { status: "queued" } }
    })
    await expect(executeWorkflowStep(conditionLessThan, { input: { score: 7 } })).resolves.toMatchObject({
      output: { true: { score: 7 } }
    })

    const conditionGraph = CompiledWorkflowGraphSchema.parse({
      schemaVersion: "2" as const,
      inputSchema: { type: "object" as const },
      outputSchema: { type: "object" as const },
      steps: [
        {
          ...source.steps[1]!,
          id: "condition",
          definition: { kind: "condition", version: 1 },
          config: { expression: { path: ["ok"], operator: "truthy" }, joinStepId: "join" }
        },
        { ...source.steps[2]!, id: "on-true" },
        { ...source.steps[2]!, id: "on-false" }
      ],
      connections: [
        {
          id: "condition-true",
          source: { stepId: "condition", port: "true" },
          target: { stepId: "on-true", port: "result" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        },
        {
          id: "condition-false",
          source: { stepId: "condition", port: "false" },
          target: { stepId: "on-false", port: "result" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      sinkStepId: "on-true",
      topologicalOrder: ["condition", "on-true", "on-false"]
    })
    expect(downstreamActivations(conditionGraph, "condition", { true: { ok: true } }, [])).toEqual([
      {
        stepId: "on-true",
        scope: [{ kind: "branch", key: "condition:true" }],
        inputBindings: { "condition-true": { result: { ok: true } } },
        dependencyCount: 0
      }
    ])

    const switchGraph = CompiledWorkflowGraphSchema.parse({
      schemaVersion: "2" as const,
      inputSchema: { type: "object" as const },
      outputSchema: { type: "object" as const },
      steps: [
        {
          ...source.steps[1]!,
          id: "switch",
          definition: { kind: "switch", version: 1 },
          config: {
            cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
            defaultKey: "normal",
            joinStepId: "join"
          }
        },
        { ...source.steps[2]!, id: "urgent-target" },
        { ...source.steps[2]!, id: "normal-target" }
      ],
      connections: [
        {
          id: "switch-urgent",
          source: { stepId: "switch", port: "branch" },
          target: { stepId: "urgent-target", port: "result" },
          outcome: "success",
          branchKey: "urgent",
          mappings: [{ sourcePath: ["value"], targetPath: [] }]
        },
        {
          id: "switch-normal",
          source: { stepId: "switch", port: "branch" },
          target: { stepId: "normal-target", port: "result" },
          outcome: "success",
          branchKey: "normal",
          mappings: [{ sourcePath: ["value"], targetPath: [] }]
        }
      ],
      sinkStepId: "urgent-target",
      topologicalOrder: ["switch", "urgent-target", "normal-target"]
    })
    expect(
      downstreamActivations(switchGraph, "switch", { branch: { key: "urgent", value: { priority: "urgent" } } }, [])
    ).toEqual([
      {
        stepId: "urgent-target",
        scope: [{ kind: "branch", key: "switch:urgent" }],
        inputBindings: { "switch-urgent": { result: { priority: "urgent" } } },
        dependencyCount: 0
      }
    ])
  })

  it("fails hard when a loop-back edge is routed without loop scope", () => {
    const source = definition()
    const graph = CompiledWorkflowGraphSchema.parse({
      schemaVersion: "2" as const,
      inputSchema: { type: "object" as const },
      outputSchema: { type: "object" as const },
      steps: [
        {
          ...source.steps[1]!,
          id: "loop",
          definition: { kind: "bounded_loop", version: 1 },
          config: {
            maximumIterations: 2,
            maximumActivations: 10,
            condition: { path: ["remaining"], operator: "greater_than", value: 0 },
            bodyStepId: "body",
            exitStepId: "exit",
            onExhaustion: "fail"
          }
        },
        { ...source.steps[1]!, id: "body", definition: { kind: "set_fields", version: 1 }, config: { fields: {} } },
        { ...source.steps[2]!, id: "exit" }
      ],
      connections: [
        {
          id: "body-loop-back",
          source: { stepId: "body", port: "value" },
          target: { stepId: "loop", port: "state" },
          outcome: "success",
          loopBack: true,
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      sinkStepId: "exit",
      topologicalOrder: ["loop", "body", "exit"]
    })

    expect(() => downstreamActivations(graph, "body", { value: { remaining: 1 } }, [])).toThrow(
      "Loop-back body-loop-back has no iteration scope"
    )
  })

  it("executes bounded loop iterations and deterministic exhaustion", async () => {
    const source = definition()
    const loop = {
      ...source.steps[1]!,
      definition: { kind: "bounded_loop", version: 1 },
      config: {
        maximumIterations: 2,
        maximumActivations: 10,
        condition: { path: ["remaining"], operator: "greater_than", value: 0 },
        bodyStepId: "body",
        exitStepId: "exit",
        onExhaustion: "fail"
      }
    }
    await expect(
      executeWorkflowStep(loop, { state: { remaining: 2 } }, { activationId, attemptOrdinal: 1, scope: [] })
    ).resolves.toMatchObject({
      output: { iteration: { state: { remaining: 2 }, index: 0 } }
    })
    await expect(
      executeWorkflowStep(
        loop,
        { state: { remaining: 0 } },
        { activationId, attemptOrdinal: 1, scope: [{ kind: "loop", key: "set", iteration: 1 }] }
      )
    ).resolves.toMatchObject({
      output: { result: { remaining: 0 } }
    })
    await expect(
      executeWorkflowStep(
        loop,
        { state: { remaining: 1 } },
        { activationId, attemptOrdinal: 1, scope: [{ kind: "loop", key: "set", iteration: 2 }] }
      )
    ).resolves.toMatchObject({
      error: { code: "loop_exhausted" }
    })
    await expect(
      executeWorkflowStep(
        { ...loop, config: { ...loop.config, onExhaustion: "route" } },
        { state: { remaining: 1 } },
        { activationId, attemptOrdinal: 1, scope: [{ kind: "loop", key: "set", iteration: 2 }] }
      )
    ).resolves.toMatchObject({
      output: {
        exhausted: { state: { remaining: 1 }, iterations: 2, maximumIterations: 2 }
      },
      error: null
    })
  })

  it("evaluates equals and rejects non-numeric operands for numeric comparators", async () => {
    const source = definition()
    const equalsStep = {
      ...source.steps[1]!,
      definition: { kind: "condition", version: 1 },
      config: {
        expression: { path: ["payload"], operator: "equals", value: { id: "FEN-423" } },
        joinStepId: "merge"
      }
    }
    await expect(executeWorkflowStep(equalsStep, { input: { payload: { id: "FEN-423" } } })).resolves.toMatchObject({
      output: { true: { payload: { id: "FEN-423" } } }
    })

    const greaterThanStep = {
      ...equalsStep,
      config: { expression: { path: ["score"], operator: "greater_than", value: "2" }, joinStepId: "merge" }
    }
    const greaterThanOrEqualStep = {
      ...equalsStep,
      config: { expression: { path: ["score"], operator: "greater_than_or_equal", value: 2 }, joinStepId: "merge" }
    }
    const lessThanOrEqualStep = {
      ...equalsStep,
      config: { expression: { path: ["score"], operator: "less_than_or_equal", value: 2 }, joinStepId: "merge" }
    }

    await expect(executeWorkflowStep(greaterThanStep, { input: { score: 3 } })).rejects.toThrow(
      "greater_than requires numeric operands"
    )
    await expect(executeWorkflowStep(greaterThanOrEqualStep, { input: { score: "3" } })).rejects.toThrow(
      "greater_than_or_equal requires numeric operands"
    )
    await expect(executeWorkflowStep(lessThanOrEqualStep, { input: { score: "3" } })).rejects.toThrow(
      "less_than_or_equal requires numeric operands"
    )
  })

  it("requires a default branch when switch does not match any case", async () => {
    const source = definition()
    const switchStep = {
      ...source.steps[1]!,
      definition: { kind: "switch", version: 1 },
      config: {
        cases: [{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }],
        joinStepId: "merge"
      }
    }
    await expect(executeWorkflowStep(switchStep, { input: { priority: "low" } })).rejects.toThrow(
      "Switch matched no case and has no default branch"
    )
  })

  it("collects array and keyed outputs and enforces keyed scalar keys", async () => {
    const source = definition()
    const arrayCollect = {
      ...source.steps[1]!,
      definition: { kind: "collect", version: 1 },
      config: { mode: "array", maximumItems: 3 },
      failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
    }
    const keyedCollect = {
      ...source.steps[1]!,
      definition: { kind: "collect", version: 1 },
      config: { mode: "keyed", keyField: "id", maximumItems: 3 },
      failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
    }

    await expect(executeWorkflowStep(arrayCollect, { items: [{ id: "a" }, { id: "b" }] })).resolves.toMatchObject({
      output: { collection: [{ id: "a" }, { id: "b" }] }
    })
    await expect(executeWorkflowStep(keyedCollect, { items: [{ id: { nested: true } }] })).rejects.toThrow(
      "Collect item is missing scalar key field id"
    )
    await expect(executeWorkflowStep(keyedCollect, { items: [{ id: 1 }, { id: "1" }] })).rejects.toThrow(
      "Collect key 1 is duplicated by items 0 and 1"
    )
  })

  it("requires compose markdown provenance and enforces markdown size limits", async () => {
    const source = definition()
    const compose = {
      ...source.steps[1]!,
      definition: { kind: "compose_markdown", version: 1 },
      config: { template: "{{body}}" }
    }

    await expect(executeWorkflowStep(compose, { values: { body: "ok" } })).rejects.toThrow(
      "Compose Markdown requires attempt provenance"
    )
    await expect(
      executeWorkflowStep(compose, { values: { body: "ok" } }, { activationId, attemptOrdinal: 1 })
    ).rejects.toThrow("Compose Markdown requires artifact storage")
    await expect(
      executeWorkflowStep(
        compose,
        { values: { body: "a".repeat(65_537) } },
        { activationId, attemptOrdinal: 1, artifactStore: { write: vi.fn(), read: vi.fn(), manifest: () => [] } }
      )
    ).rejects.toThrow("Markdown artifact exceeds 65536 bytes")
  })

  it("fans out for-each body scopes and computes join dependency counts for any and quorum", () => {
    const source = definition()
    const graphAny = CompiledWorkflowGraphSchema.parse({
      schemaVersion: "2" as const,
      inputSchema: { type: "object" as const },
      outputSchema: { type: "object" as const },
      steps: [
        {
          ...source.steps[1]!,
          id: "for-each",
          definition: { kind: "for_each", version: 1 },
          config: { maximumItems: 10, concurrency: 2, bodyStepId: "body", joinStepId: "join" }
        },
        { ...source.steps[1]!, id: "body", definition: { kind: "set_fields", version: 1 }, config: { fields: {} } },
        { ...source.steps[2]!, id: "join", definition: { kind: "join", version: 1 }, config: { policy: "any" } }
      ],
      connections: [
        {
          id: "for-each-body",
          source: { stepId: "for-each", port: "item" },
          target: { stepId: "body", port: "input" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        },
        {
          id: "body-join",
          source: { stepId: "body", port: "value" },
          target: { stepId: "join", port: "branches" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      sinkStepId: "join",
      topologicalOrder: ["for-each", "body", "join"]
    })
    expect(downstreamActivations(graphAny, "for-each", { item: [{ id: "a" }, { id: "b" }, { id: "c" }] }, [])).toEqual([
      {
        stepId: "body",
        scope: [{ kind: "item", key: "for-each:000000" }],
        inputBindings: { "for-each-body": { input: { id: "a" } } },
        dependencyCount: 0
      },
      {
        stepId: "body",
        scope: [{ kind: "item", key: "for-each:000001" }],
        inputBindings: { "for-each-body": { input: { id: "b" } } },
        dependencyCount: 0
      },
      {
        stepId: "body",
        scope: [{ kind: "item", key: "for-each:000002" }],
        inputBindings: { "for-each-body": { input: { id: "c" } } },
        dependencyCount: 0,
        deferred: true
      },
      { stepId: "join", scope: [], inputBindings: {}, dependencyCount: 1 }
    ])

    const graphQuorum = CompiledWorkflowGraphSchema.parse({
      ...graphAny,
      steps: graphAny.steps.map((step) =>
        step.id === "join"
          ? {
              ...step,
              config: { policy: "quorum", quorum: 2 }
            }
          : step
      )
    })
    expect(
      downstreamActivations(graphQuorum, "for-each", { item: [{ id: "a" }, { id: "b" }, { id: "c" }] }, [])
    ).toContainEqual({ stepId: "join", scope: [], inputBindings: {}, dependencyCount: 2 })
    expect(() => downstreamActivations(graphQuorum, "for-each", { item: [{ id: "a" }] }, [])).toThrow(
      "Join quorum 2 cannot be met by 1 items"
    )

    const emptyGraph = CompiledWorkflowGraphSchema.parse({
      ...graphAny,
      steps: [
        ...graphAny.steps.map((step) => (step.id === "join" ? { ...step, config: { policy: "all" as const } } : step)),
        { ...source.steps[2]!, id: "done" }
      ],
      connections: [
        ...graphAny.connections,
        {
          id: "join-done",
          source: { stepId: "join", port: "results" },
          target: { stepId: "done", port: "result" },
          outcome: "success" as const,
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      sinkStepId: "done",
      topologicalOrder: ["for-each", "body", "join", "done"]
    })
    expect(downstreamActivations(emptyGraph, "for-each", { item: [] }, [])).toEqual([
      {
        stepId: "done",
        scope: [],
        inputBindings: { "join-done": { result: [] } },
        dependencyCount: 0
      }
    ])
    expect(() => downstreamActivations(graphQuorum, "for-each", { item: [] }, [])).toThrow(
      "Join quorum 2 cannot be met by 0 items"
    )
  })

  it("applies any and quorum thresholds to ordinary join fan-in", () => {
    const source = definition()
    const graph = CompiledWorkflowGraphSchema.parse({
      schemaVersion: "2" as const,
      inputSchema: { type: "object" as const },
      outputSchema: { type: "object" as const },
      steps: [
        { ...source.steps[1]!, id: "first", definition: { kind: "set_fields", version: 1 }, config: { fields: {} } },
        { ...source.steps[1]!, id: "second", definition: { kind: "set_fields", version: 1 }, config: { fields: {} } },
        { ...source.steps[2]!, id: "join", definition: { kind: "join", version: 1 }, config: { policy: "any" } }
      ],
      connections: [
        {
          id: "first-join",
          source: { stepId: "first", port: "value" },
          target: { stepId: "join", port: "branches" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        },
        {
          id: "second-join",
          source: { stepId: "second", port: "value" },
          target: { stepId: "join", port: "branches" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      sinkStepId: "join",
      topologicalOrder: ["first", "second", "join"]
    })

    expect(downstreamActivations(graph, "first", { value: { id: "a" } }, [])).toContainEqual(
      expect.objectContaining({ stepId: "join", dependencyCount: 0 })
    )
    const quorum = CompiledWorkflowGraphSchema.parse({
      ...graph,
      steps: graph.steps.map((step) =>
        step.id === "join" ? { ...step, config: { policy: "quorum", quorum: 2 } } : step
      )
    })
    expect(downstreamActivations(quorum, "first", { value: { id: "a" } }, [])).toContainEqual(
      expect.objectContaining({ stepId: "join", dependencyCount: 1 })
    )
  })

  it("propagates bounded loop iteration scope and then exits to parent scope", () => {
    const source = definition()
    const graph = CompiledWorkflowGraphSchema.parse({
      schemaVersion: "2" as const,
      inputSchema: { type: "object" as const },
      outputSchema: { type: "object" as const },
      steps: [
        {
          ...source.steps[1]!,
          id: "loop",
          definition: { kind: "bounded_loop", version: 1 },
          config: {
            maximumIterations: 2,
            maximumActivations: 10,
            condition: { path: ["remaining"], operator: "greater_than", value: 0 },
            bodyStepId: "body",
            exitStepId: "exit",
            onExhaustion: "route"
          }
        },
        { ...source.steps[1]!, id: "body", definition: { kind: "set_fields", version: 1 }, config: { fields: {} } },
        { ...source.steps[2]!, id: "exit" }
      ],
      connections: [
        {
          id: "loop-body",
          source: { stepId: "loop", port: "iteration" },
          target: { stepId: "body", port: "input" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        },
        {
          id: "loop-exit",
          source: { stepId: "loop", port: "result" },
          target: { stepId: "exit", port: "result" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      sinkStepId: "exit",
      topologicalOrder: ["loop", "body", "exit"]
    })

    expect(downstreamActivations(graph, "loop", { iteration: { state: { remaining: 1 }, index: 0 } }, [])).toEqual([
      {
        stepId: "body",
        scope: [{ kind: "loop", key: "loop", iteration: 0 }],
        inputBindings: { "loop-body": { input: { state: { remaining: 1 }, index: 0 } } },
        dependencyCount: 0
      }
    ])
    expect(
      downstreamActivations(graph, "loop", { result: { remaining: 0 } }, [{ kind: "loop", key: "loop", iteration: 1 }])
    ).toEqual([
      {
        stepId: "exit",
        scope: [],
        inputBindings: { "loop-exit": { result: { remaining: 0 } } },
        dependencyCount: 0
      }
    ])
  })

  it("delegates repository, model, and provider executor steps and commits typed outputs", async () => {
    const source = definition()
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "repository_agent", version: 1 },
      config: { prompt: "Summarize" }
    }
    const completeAttempt = vi.fn(async () => undefined)
    const repositoryAgentExecutor = vi.fn(async () => ({ response: { summary: "ok" } }))
    const modelExecutor = vi.fn(async () => ({
      output: { response: { mode: "text", text: "answer" } },
      data: [{ name: "trace", kind: "artifact" as const, payload: { id: "trace-1" } }],
      usage: { totalTokens: 7 },
      evidence: { provider: "openrouter" }
    }))
    const providerDataExecutor = vi.fn(async () => ({ result: { state: "ok" } }))
    const providerActionExecutor = vi.fn(async () => ({ result: { accepted: true } }))
    const getExecutionPackage = vi.fn(async () => ({
      packageDigest: "b".repeat(64),
      workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
      source: { kind: "published" as const, version: 1 },
      contractVersion: "1",
      compilerVersion: "1",
      compiledPlanDigest: "d".repeat(64),
      content: {
        schemaVersion: "1" as const,
        workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
        source: { kind: "published" as const, version: 1 },
        compilerVersion: "1",
        mappingExpressionVersion: "1",
        eventDecoderVersions: {},
        graph: {
          schemaVersion: source.schemaVersion,
          inputSchema: source.inputSchema,
          outputSchema: source.outputSchema,
          steps: source.steps,
          connections: source.connections,
          sinkStepId: "success",
          topologicalOrder: ["manual", "set", "success"]
        },
        stepDefinitions: [],
        constants: {},
        resourceReferences: [],
        agentSnapshots: [],
        modelSnapshots: []
      },
      createdAt: new Date()
    }))
    const listReadyActivations = vi
      .fn()
      .mockResolvedValueOnce([
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { input: { issue: "FEN-423" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
      .mockResolvedValueOnce([
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { context: { issue: "FEN-423" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
      .mockResolvedValueOnce([
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { query: { issue: "FEN-423" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
      .mockResolvedValueOnce([
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { request: { note: "ship" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
      .mockResolvedValue([])
    const journal = {
      listReadyActivations,
      getRun: vi.fn(async () => ({
        runId,
        packageDigest: "b".repeat(64),
        requestDigest: "c".repeat(64),
        triggerIdentity: "manual:1",
        sealedManifest: {},
        status: "running" as const,
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        terminalAt: null
      })),
      getExecutionPackage,
      leaseActivation: vi.fn(async () => ({
        runId,
        activationId,
        ordinal: 1,
        status: "running" as const,
        fencingToken: 1,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date(),
        input: { input: { issue: "FEN-423" }, context: { issue: "FEN-423" }, query: {}, request: { note: "ship" } },
        output: null,
        error: null,
        usage: null,
        evidence: {},
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null
      })),
      completeAttempt,
      failAttempt: vi.fn(async () => undefined),
      suspendAttempt: vi.fn(async () => undefined),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(async () => undefined),
      ...childReconciliationJournal()
    }

    const dispatcher = new WorkflowDispatcher(
      journal,
      "worker-1",
      undefined,
      repositoryAgentExecutor,
      vi.fn(async () => ({ result: { rows: [] } })),
      modelExecutor,
      providerDataExecutor,
      providerActionExecutor
    )

    await expect(dispatcher.dispatchReady()).resolves.toBe(1)
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "ai_model", version: 1 },
      config: { modelId: "m", messages: [], outputMode: "text" }
    }
    await expect(dispatcher.dispatchReady()).resolves.toBe(1)
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "provider_data", version: 1 },
      config: {
        provider: "github",
        operation: "github.repository",
        binding: {
          provider: "github",
          resourceType: "repository",
          connectionId: "1",
          externalId: "1",
          name: "o/r",
          capabilities: ["read"]
        }
      }
    }
    await expect(dispatcher.dispatchReady()).resolves.toBe(1)
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "provider_action", version: 1 },
      config: {
        provider: "github",
        operation: "github.add_pull_request_comment",
        binding: {
          provider: "github",
          resourceType: "repository",
          connectionId: "1",
          externalId: "1",
          name: "o/r",
          capabilities: ["write"]
        }
      }
    }
    await expect(dispatcher.dispatchReady()).resolves.toBe(1)

    expect(repositoryAgentExecutor).toHaveBeenCalledTimes(1)
    expect(modelExecutor).toHaveBeenCalledTimes(1)
    expect(providerDataExecutor).toHaveBeenCalledTimes(1)
    expect(providerActionExecutor).toHaveBeenCalledTimes(1)
    expect(completeAttempt).toHaveBeenCalledTimes(4)
    expect(completeAttempt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        output: { response: { mode: "text", text: "answer" } },
        usage: { totalTokens: 7 },
        evidence: { provider: "openrouter" }
      })
    )
  })

  it("maps typed model and provider errors to failAttempt codes", async () => {
    const source = definition()
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "ai_model", version: 1 },
      config: { modelId: "openai/gpt-test", messages: [{ role: "user", content: "Hi" }], outputMode: "text" }
    }
    const failAttempt = vi.fn(async () => undefined)
    const getExecutionPackage = vi.fn(async () => ({
      packageDigest: "b".repeat(64),
      workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
      source: { kind: "published" as const, version: 1 },
      contractVersion: "1",
      compilerVersion: "1",
      compiledPlanDigest: "d".repeat(64),
      content: {
        schemaVersion: "1" as const,
        workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
        source: { kind: "published" as const, version: 1 },
        compilerVersion: "1",
        mappingExpressionVersion: "1",
        eventDecoderVersions: {},
        graph: {
          schemaVersion: source.schemaVersion,
          inputSchema: source.inputSchema,
          outputSchema: source.outputSchema,
          steps: source.steps,
          connections: source.connections,
          sinkStepId: "success",
          topologicalOrder: ["manual", "set", "success"]
        },
        stepDefinitions: [],
        constants: {},
        resourceReferences: [],
        agentSnapshots: [],
        modelSnapshots: []
      },
      createdAt: new Date()
    }))
    const baseJournal = {
      listReadyActivations: vi.fn(async () => [
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { context: { issue: "FEN-423" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      getRun: vi.fn(async () => ({
        runId,
        packageDigest: "b".repeat(64),
        requestDigest: "c".repeat(64),
        triggerIdentity: "manual:1",
        sealedManifest: {},
        status: "running" as const,
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        terminalAt: null
      })),
      getExecutionPackage,
      leaseActivation: vi.fn(async () => ({
        runId,
        activationId,
        ordinal: 1,
        status: "running" as const,
        fencingToken: 1,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date(),
        input: { context: { issue: "FEN-423" }, request: { note: "ship" } },
        output: null,
        error: null,
        usage: null,
        evidence: {},
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null
      })),
      completeAttempt: vi.fn(async () => undefined),
      failAttempt,
      suspendAttempt: vi.fn(async () => undefined),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(async () => undefined),
      ...childReconciliationJournal()
    }

    await expect(
      new WorkflowDispatcher(
        baseJournal,
        "worker-1",
        undefined,
        undefined,
        undefined,
        vi.fn(async () => {
          throw new WorkflowModelExecutionError("model_overloaded", "Model overloaded")
        })
      ).dispatchReady()
    ).resolves.toBe(1)
    expect(failAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "model_overloaded" }) })
    )

    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "provider_data", version: 1 },
      config: {
        provider: "github",
        operation: "github.repository",
        binding: {
          provider: "github",
          resourceType: "repository",
          connectionId: "1",
          externalId: "1",
          name: "o/r",
          capabilities: ["read"]
        }
      }
    }
    await expect(
      new WorkflowDispatcher(
        {
          ...baseJournal,
          listReadyActivations: vi.fn(async () => [{ ...(await baseJournal.listReadyActivations())[0] }])
        },
        "worker-1",
        undefined,
        undefined,
        undefined,
        undefined,
        vi.fn(async () => {
          throw new WorkflowProviderExecutionError("provider_throttled", "Provider throttled")
        })
      ).dispatchReady()
    ).resolves.toBe(1)
    expect(failAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "provider_throttled" }) })
    )
  })

  it("continues on not-ready lease errors and rethrows non-ready dispatcher errors", async () => {
    const readyActivation = {
      activationId,
      runId,
      stepId: "manual",
      scope: [],
      status: "ready" as const,
      inputBindings: { input: {} },
      selectedAttemptOrdinal: null,
      nextAttemptOrdinal: 1,
      dependencyCount: 0,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const continueJournal = {
      listReadyActivations: vi.fn(async () => [readyActivation]),
      getRun: vi.fn(async () => {
        throw new Error("activation not ready for lease")
      }),
      getExecutionPackage: vi.fn(),
      leaseActivation: vi.fn(),
      completeAttempt: vi.fn(),
      failAttempt: vi.fn(),
      suspendAttempt: vi.fn(),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(),
      ...childReconciliationJournal()
    }
    await expect(new WorkflowDispatcher(continueJournal, "worker-1").dispatchReady()).resolves.toBe(0)

    const failJournal = {
      ...continueJournal,
      getRun: vi.fn(async () => {
        throw new Error("database unavailable")
      })
    }
    await expect(new WorkflowDispatcher(failJournal, "worker-1").dispatchReady()).rejects.toThrow(
      "database unavailable"
    )
  })

  it("leases and commits one durable activation with projected downstream input", async () => {
    const completeAttempt = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => [
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { input: { issue: "FEN-423" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      getRun: vi.fn(async () => ({
        runId,
        packageDigest: "b".repeat(64),
        requestDigest: "c".repeat(64),
        triggerIdentity: "manual:1",
        sealedManifest: {},
        status: "runnable" as const,
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        terminalAt: null
      })),
      getExecutionPackage: vi.fn(async () => {
        const source = definition()
        return {
          packageDigest: "b".repeat(64),
          workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
          source: { kind: "published" as const, version: 1 },
          contractVersion: "1",
          compilerVersion: "1",
          compiledPlanDigest: "d".repeat(64),
          content: {
            schemaVersion: "1" as const,
            workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
            source: { kind: "published" as const, version: 1 },
            compilerVersion: "1",
            mappingExpressionVersion: "1",
            eventDecoderVersions: {},
            graph: {
              schemaVersion: source.schemaVersion,
              inputSchema: source.inputSchema,
              outputSchema: source.outputSchema,
              steps: source.steps,
              connections: source.connections,
              sinkStepId: "success",
              topologicalOrder: ["manual", "set", "success"]
            },
            stepDefinitions: [],
            constants: {},
            resourceReferences: [],
            agentSnapshots: [],
            modelSnapshots: []
          },
          createdAt: new Date()
        }
      }),
      leaseActivation: vi.fn(async () => ({
        runId,
        activationId,
        ordinal: 1,
        status: "running" as const,
        fencingToken: 1,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date(),
        input: { input: { issue: "FEN-423" } },
        output: null,
        error: null,
        usage: null,
        evidence: {},
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null
      })),
      completeAttempt,
      failAttempt: vi.fn(async () => undefined),
      suspendAttempt: vi.fn(async () => undefined),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(async () => undefined),
      ...childReconciliationJournal()
    }
    const log = vi.fn()
    const dispatcher = new WorkflowDispatcher(
      journal,
      "worker-1",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      log
    )

    await expect(dispatcher.dispatchReady()).resolves.toBe(1)
    expect(log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "started", stepId: "manual", input: { input: { issue: "FEN-423" } } })
    )
    expect(log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "succeeded", stepId: "manual", output: { input: { issue: "FEN-423" } } })
    )
    expect(completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        downstream: [
          {
            stepId: "set",
            scope: [],
            inputBindings: { "manual-set": { input: { issue: "FEN-423" } } },
            dependencyCount: 0
          }
        ]
      })
    )
  })

  it("commits deterministic item scopes and a sealed for-each join", async () => {
    const source = definition()
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "for_each", version: 1 },
      config: { maximumItems: 10, concurrency: 2, bodyStepId: "set", joinStepId: "success" }
    }
    source.steps[2] = {
      ...source.steps[2]!,
      definition: { kind: "join", version: 1 },
      config: { policy: "all" }
    }
    source.connections[0] = {
      ...source.connections[0]!,
      source: { stepId: "manual", port: "item" }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      target: { stepId: "success", port: "branches" }
    }
    const completeAttempt = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => [
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { items: [{ id: "a" }, { id: "b" }, { id: "c" }] },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      getRun: vi.fn(async () => ({
        runId,
        packageDigest: "b".repeat(64),
        requestDigest: "c".repeat(64),
        triggerIdentity: "manual:1",
        sealedManifest: {},
        status: "runnable" as const,
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        terminalAt: null
      })),
      getExecutionPackage: vi.fn(async () => ({
        packageDigest: "b".repeat(64),
        workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
        source: { kind: "published" as const, version: 1 },
        contractVersion: "1",
        compilerVersion: "1",
        compiledPlanDigest: "d".repeat(64),
        content: {
          schemaVersion: "1" as const,
          workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
          source: { kind: "published" as const, version: 1 },
          compilerVersion: "1",
          mappingExpressionVersion: "1",
          eventDecoderVersions: {},
          graph: {
            schemaVersion: source.schemaVersion,
            inputSchema: source.inputSchema,
            outputSchema: source.outputSchema,
            steps: source.steps,
            connections: source.connections,
            sinkStepId: "success",
            topologicalOrder: ["manual", "set", "success"]
          },
          stepDefinitions: [],
          constants: {},
          resourceReferences: [],
          agentSnapshots: [],
          modelSnapshots: []
        },
        createdAt: new Date()
      })),
      leaseActivation: vi.fn(async () => ({
        runId,
        activationId,
        ordinal: 1,
        status: "running" as const,
        fencingToken: 1,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date(),
        input: { items: [{ id: "a" }, { id: "b" }, { id: "c" }] },
        output: null,
        error: null,
        usage: null,
        evidence: {},
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null
      })),
      completeAttempt,
      failAttempt: vi.fn(async () => undefined),
      suspendAttempt: vi.fn(async () => undefined),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(async () => undefined),
      ...childReconciliationJournal()
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(1)
    expect(completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        downstream: [
          expect.objectContaining({ stepId: "set", scope: [{ kind: "item", key: "manual:000000" }] }),
          expect.objectContaining({ stepId: "set", scope: [{ kind: "item", key: "manual:000001" }] }),
          expect.objectContaining({ stepId: "set", scope: [{ kind: "item", key: "manual:000002" }], deferred: true }),
          expect.objectContaining({ stepId: "success", scope: [], dependencyCount: 3 })
        ]
      })
    )
  })

  it("derives a GitHub wait event correlation from its sealed repository and input object ID", async () => {
    const source = definition()
    source.steps[0] = {
      ...source.steps[0]!,
      definition: { kind: "wait_event_github", version: 1 },
      config: {
        eventKey: "pull_request.updated",
        objectIdPath: ["pullRequest", "id"],
        binding: { externalId: "repo-42" },
        expiresAfterSeconds: 300,
        onTimeout: "fail"
      }
    }
    const suspendAttempt = vi.fn(async () => undefined)
    const completeAttempt = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => [
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { input: { pullRequest: { id: "84" } } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      getRun: vi.fn(async () => ({
        runId,
        packageDigest: "b".repeat(64),
        requestDigest: "c".repeat(64),
        triggerIdentity: "manual:1",
        sealedManifest: {},
        status: "running" as const,
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        terminalAt: null
      })),
      getExecutionPackage: vi.fn(async () => ({
        packageDigest: "b".repeat(64),
        workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
        source: { kind: "published" as const, version: 1 },
        contractVersion: "1",
        compilerVersion: "1",
        compiledPlanDigest: "d".repeat(64),
        content: {
          schemaVersion: "1" as const,
          workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
          source: { kind: "published" as const, version: 1 },
          compilerVersion: "1",
          mappingExpressionVersion: "1",
          eventDecoderVersions: {},
          graph: {
            schemaVersion: source.schemaVersion,
            inputSchema: source.inputSchema,
            outputSchema: source.outputSchema,
            steps: source.steps,
            connections: source.connections,
            sinkStepId: "success",
            topologicalOrder: ["manual", "set", "success"]
          },
          stepDefinitions: [],
          constants: {},
          resourceReferences: [],
          agentSnapshots: [],
          modelSnapshots: []
        },
        createdAt: new Date()
      })),
      leaseActivation: vi.fn(async () => ({
        runId,
        activationId,
        ordinal: 1,
        status: "running" as const,
        fencingToken: 1,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date(),
        input: { input: { pullRequest: { id: "84" } } },
        output: null,
        error: null,
        usage: null,
        evidence: {},
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null
      })),
      completeAttempt,
      failAttempt: vi.fn(async () => undefined),
      suspendAttempt,
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(async () => undefined),
      ...childReconciliationJournal()
    }

    await expect(
      new WorkflowDispatcher(
        journal,
        "worker-1",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        () => new Date("2026-07-19T12:00:00.000Z")
      ).dispatchReady()
    ).resolves.toBe(1)
    expect(suspendAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationKey: "github:repo-42:pull_request.updated:84",
        expiresAt: new Date("2026-07-19T12:05:00.000Z")
      })
    )
    expect(completeAttempt).not.toHaveBeenCalled()
  })

  it("invokes a pinned child package and suspends parent completion", async () => {
    const parent = definition()
    const child = definition()
    const childPackageDigest = "e".repeat(64)
    const interfaceDigest = "f".repeat(64)
    parent.steps[0] = {
      ...parent.steps[0]!,
      definition: { kind: "child_workflow", version: 1 },
      config: { packageDigest: childPackageDigest, interfaceDigest, timeoutSeconds: 86400, maximumDepth: 5 }
    }
    const invokeChildWorkflow = vi.fn(async () => undefined)
    const completeAttempt = vi.fn(async () => undefined)
    const parentPackage = {
      schemaVersion: "1" as const,
      workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
      source: { kind: "published" as const, version: 1 },
      compilerVersion: "1",
      mappingExpressionVersion: "1",
      eventDecoderVersions: {},
      graph: {
        schemaVersion: parent.schemaVersion,
        inputSchema: parent.inputSchema,
        outputSchema: parent.outputSchema,
        steps: parent.steps,
        connections: parent.connections,
        sinkStepId: "success",
        topologicalOrder: ["manual", "set", "success"]
      },
      stepDefinitions: [],
      constants: {},
      resourceReferences: [],
      agentSnapshots: [],
      modelSnapshots: []
    }
    const childPackage = {
      ...parentPackage,
      graph: {
        schemaVersion: child.schemaVersion,
        inputSchema: child.inputSchema,
        outputSchema: child.outputSchema,
        steps: child.steps,
        connections: child.connections,
        sinkStepId: "success",
        topologicalOrder: ["manual", "set", "success"]
      }
    }
    const journal = {
      listReadyActivations: vi.fn(async () => [
        {
          activationId,
          runId,
          stepId: "manual",
          scope: [],
          status: "ready" as const,
          inputBindings: { input: { issue: "FEN-423" } },
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 1,
          dependencyCount: 0,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      getRun: vi.fn(async () => ({
        runId,
        packageDigest: "b".repeat(64),
        requestDigest: "c".repeat(64),
        triggerIdentity: "manual:1",
        sealedManifest: {},
        status: "running" as const,
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        terminalAt: null
      })),
      getExecutionPackage: vi.fn(async (digest: string) => ({
        packageDigest: digest,
        workflowId: parentPackage.workflowId,
        source: { kind: "published" as const, version: 1 },
        contractVersion: "1",
        compilerVersion: "1",
        compiledPlanDigest: "d".repeat(64),
        content: digest === childPackageDigest ? childPackage : parentPackage,
        createdAt: new Date()
      })),
      leaseActivation: vi.fn(async () => ({
        runId,
        activationId,
        ordinal: 1,
        status: "running" as const,
        fencingToken: 1,
        leaseOwner: "worker-1",
        leaseExpiresAt: new Date(),
        input: { input: { issue: "FEN-423" } },
        output: null,
        error: null,
        usage: null,
        evidence: {},
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null
      })),
      completeAttempt,
      failAttempt: vi.fn(async () => undefined),
      suspendAttempt: vi.fn(async () => undefined),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow,
      ...childReconciliationJournal()
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(1)
    expect(invokeChildWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        parentRunId: runId,
        childPackageDigest,
        interfaceDigest,
        childInput: { issue: "FEN-423" },
        childTriggerStepId: "manual"
      })
    )
    expect(completeAttempt).not.toHaveBeenCalled()
  })

  it("records child success and resumes the parent on the child output port", async () => {
    const childRunId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
    const recordChildRunCompletion = vi.fn(async () => undefined)
    const resumeWait = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => []),
      getRun: vi.fn(),
      getExecutionPackage: vi.fn(),
      leaseActivation: vi.fn(),
      completeAttempt: vi.fn(),
      failAttempt: vi.fn(),
      suspendAttempt: vi.fn(),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(),
      listChildRunLinks: vi.fn(async () => [
        { parentRunId: runId, childRunId, terminalStatus: null, result: null, error: null }
      ]),
      getChildRunCompletion: vi.fn(async () => ({
        status: "succeeded" as const,
        output: { answer: 42 },
        error: null
      })),
      recordChildRunCompletion,
      resumeWait,
      failWait: vi.fn()
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(0)
    expect(recordChildRunCompletion).toHaveBeenCalledWith({
      childRunId,
      status: "succeeded",
      output: { answer: 42 },
      error: null
    })
    expect(resumeWait).toHaveBeenCalledWith({
      runId,
      correlationKey: `child:${childRunId}`,
      event: { answer: 42 },
      outputPort: "output"
    })
  })

  it("records child failure and fails the pending parent wait", async () => {
    const childRunId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
    const error = { code: "child_failed", message: "Child failed" }
    const recordChildRunCompletion = vi.fn(async () => undefined)
    const failWait = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => []),
      getRun: vi.fn(),
      getExecutionPackage: vi.fn(),
      leaseActivation: vi.fn(),
      completeAttempt: vi.fn(),
      failAttempt: vi.fn(),
      suspendAttempt: vi.fn(),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(),
      listChildRunLinks: vi.fn(async () => [
        { parentRunId: runId, childRunId, terminalStatus: null, result: null, error: null }
      ]),
      getChildRunCompletion: vi.fn(async () => ({ status: "failed" as const, output: {}, error })),
      recordChildRunCompletion,
      resumeWait: vi.fn(),
      failWait
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(0)
    expect(recordChildRunCompletion).toHaveBeenCalledWith({ childRunId, status: "failed", output: {}, error })
    expect(failWait).toHaveBeenCalledWith({
      runId,
      correlationKey: `child:${childRunId}`,
      error
    })
  })

  it("uses default child-workflow failure details when child completion omits an error", async () => {
    const childRunId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
    const failWait = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => []),
      getRun: vi.fn(),
      getExecutionPackage: vi.fn(),
      leaseActivation: vi.fn(),
      completeAttempt: vi.fn(),
      failAttempt: vi.fn(),
      suspendAttempt: vi.fn(),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(),
      listChildRunLinks: vi.fn(async () => [
        { parentRunId: runId, childRunId, terminalStatus: null, result: null, error: null }
      ]),
      getChildRunCompletion: vi.fn(async () => ({ status: "failed" as const, output: {}, error: null })),
      recordChildRunCompletion: vi.fn(async () => undefined),
      resumeWait: vi.fn(),
      failWait
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(0)
    expect(failWait).toHaveBeenCalledWith({
      runId,
      correlationKey: `child:${childRunId}`,
      error: { code: "child_workflow_failed", message: `Child workflow ${childRunId} failed` }
    })
  })

  it("repairs parent resume after child completion was already recorded", async () => {
    const childRunId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
    const getChildRunCompletion = vi.fn()
    const recordChildRunCompletion = vi.fn()
    const resumeWait = vi.fn(async () => undefined)
    const journal = {
      listReadyActivations: vi.fn(async () => []),
      getRun: vi.fn(),
      getExecutionPackage: vi.fn(),
      leaseActivation: vi.fn(),
      completeAttempt: vi.fn(),
      failAttempt: vi.fn(),
      suspendAttempt: vi.fn(),
      listExpiredWaits: vi.fn(async () => []),
      timeoutWait: vi.fn(async () => null),
      invokeChildWorkflow: vi.fn(),
      listChildRunLinks: vi.fn(async () => [
        {
          parentRunId: runId,
          childRunId,
          terminalStatus: "succeeded" as const,
          result: { answer: 42 },
          error: null
        }
      ]),
      getChildRunCompletion,
      recordChildRunCompletion,
      resumeWait,
      failWait: vi.fn()
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(0)
    expect(getChildRunCompletion).not.toHaveBeenCalled()
    expect(recordChildRunCompletion).not.toHaveBeenCalled()
    expect(resumeWait).toHaveBeenCalledWith({
      runId,
      correlationKey: `child:${childRunId}`,
      event: { answer: 42 },
      outputPort: "output"
    })
  })

  it("times out expired waits before scanning ready activations", async () => {
    const timeoutWait = vi.fn(async () => null)
    const journal = {
      listReadyActivations: vi.fn(async () => []),
      getRun: vi.fn(),
      getExecutionPackage: vi.fn(),
      leaseActivation: vi.fn(),
      completeAttempt: vi.fn(),
      failAttempt: vi.fn(),
      suspendAttempt: vi.fn(),
      listExpiredWaits: vi.fn(async () => [{ runId, correlationKey: "wait:github:octo/agency:42" }]),
      timeoutWait,
      invokeChildWorkflow: vi.fn(),
      ...childReconciliationJournal()
    }

    await expect(new WorkflowDispatcher(journal, "worker-1").dispatchReady()).resolves.toBe(0)
    expect(timeoutWait).toHaveBeenCalledWith({ runId, correlationKey: "wait:github:octo/agency:42" })
    expect(journal.listReadyActivations).toHaveBeenCalledTimes(1)
  })
})
