import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WorkflowDraftContent } from "@/services/api"
import { ApiMock } from "@/tests/server"
import { WorkflowEditorPage } from "./WorkflowEditorPage"

const workflowId = "3195de29-2774-4272-be07-6ed600cefd51"
const runId = "65382f80-2e36-424a-bb41-f7f54fa0f7cf"
const navigate = vi.hoisted(() => vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve()))

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useParams: () => ({ workflowId })
}))

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  type Point = { x: number; y: number }
  type MockNode = { id: string; type: string; position: Point; data: { step: { label: string } } }
  type MockEdge = { id: string; source: string; target: string }
  type MockNodeChange = { type: string; id: string; position?: Point; dragging?: boolean }
  type MockEdgeChange = { type: string; id: string }
  type MockProps = {
    nodes: MockNode[]
    edges: MockEdge[]
    nodeTypes: Record<string, React.ElementType>
    onNodeClick: (event: object, node: MockNode) => void
    onEdgeClick: (event: object, edge: MockEdge) => void
    onPaneClick: () => void
    onConnect: (connection: { source: string | undefined; target: string | undefined }) => void
    onReconnect: (edge: MockEdge, connection: { source: string; target: string }) => void
    onNodesChange: (changes: MockNodeChange[]) => void
    onEdgesChange: (changes: MockEdgeChange[]) => void
    children: React.ReactNode
  }
  function useNodesState(initial: MockNode[]) {
    const [nodes, setNodes] = React.useState(initial)
    return [
      nodes,
      setNodes,
      (changes: MockNodeChange[]) =>
        setNodes((current) =>
          current
            .filter((node) => !changes.some((change) => change.type === "remove" && change.id === node.id))
            .map((node) => {
              const change = changes.find((candidate) => candidate.type === "position" && candidate.id === node.id)
              return change?.position === undefined ? node : { ...node, position: change.position }
            })
        )
    ]
  }
  function useEdgesState(initial: MockEdge[]) {
    const [edges, setEdges] = React.useState(initial)
    return [
      edges,
      setEdges,
      (changes: MockEdgeChange[]) =>
        setEdges((current) =>
          current.filter((edge) => !changes.some((change) => change.type === "remove" && change.id === edge.id))
        )
    ]
  }
  function ReactFlow({
    nodes,
    edges,
    nodeTypes,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    onConnect,
    onReconnect,
    onNodesChange,
    onEdgesChange,
    children
  }: MockProps) {
    return React.createElement(
      "div",
      { "aria-label": "Workflow canvas" },
      nodes.map((node) =>
        React.createElement(
          "button",
          { key: `select-${node.id}`, type: "button", onClick: () => onNodeClick({}, node) },
          `Select ${node.data.step.label}`
        )
      ),
      nodes.map((node) => {
        const Component = nodeTypes[node.type]
        return Component === undefined
          ? null
          : React.createElement(Component, { key: `node-${node.id}`, id: node.id, data: node.data, selected: false })
      }),
      React.createElement("button", { type: "button", onClick: onPaneClick }, "Clear selection"),
      React.createElement(
        "button",
        { type: "button", onClick: () => onConnect({ source: nodes[0]?.id, target: nodes.at(-1)?.id }) },
        "Connect nodes"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            const edge = edges[0]
            if (edge !== undefined) {
              onEdgeClick({}, edge)
            }
          }
        },
        "Select connection"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            const edge = edges[0]
            const source = nodes[0]
            const target = nodes[2]
            if (edge !== undefined && source !== undefined && target !== undefined) {
              onReconnect(edge, { source: source.id, target: target.id })
            }
          }
        },
        "Reconnect connection"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onNodesChange([{ type: "position", id: nodes[0]?.id, position: { x: 20, y: 30 }, dragging: true }])
        },
        "Move node"
      ),
      React.createElement(
        "button",
        { type: "button", onClick: () => onEdgesChange([{ type: "remove", id: edges[0]?.id }]) },
        "Remove edge"
      ),
      children
    )
  }
  return {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge: (connection: MockEdge, edges: MockEdge[]) => [...edges, connection],
    Background: () => null,
    Controls: () => null,
    Handle: () => React.createElement("span"),
    BackgroundVariant: { Dots: "dots" },
    Position: { Left: "left", Right: "right" }
  }
})

const definitions = [
  {
    kind: "manual_trigger",
    version: 1,
    phase: 2,
    category: "trigger",
    label: "Manual run",
    description: "Starts with supplied input.",
    executionClass: "control",
    simulationPolicy: "fixture",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: [],
    outputs: [{ name: "input", label: "Workflow input", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "a".repeat(64)
  },
  {
    kind: "set_fields",
    version: 1,
    phase: 2,
    category: "data",
    label: "Set fields",
    description: "Creates a typed object.",
    executionClass: "control",
    simulationPolicy: "deterministic",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: [{ name: "input", label: "Input", schema: { type: "object" }, cardinality: "optional" }],
    outputs: [{ name: "value", label: "Value", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "b".repeat(64)
  },
  ...[
    {
      kind: "map_fields",
      category: "data",
      label: "Map fields",
      description: "Selects and renames fields without running code.",
      inputs: ["input"],
      outputs: ["value"]
    },
    {
      kind: "validate",
      category: "data",
      label: "Validate",
      description: "Checks a value against a JSON schema.",
      inputs: ["value"],
      outputs: ["value"]
    },
    {
      kind: "failure",
      category: "terminal",
      label: "Failure",
      description: "Ends the current path with an error.",
      inputs: ["error"],
      outputs: []
    }
  ].map((item, index) => ({
    kind: item.kind,
    version: 1,
    phase: 2,
    category: item.category,
    label: item.label,
    description: item.description,
    executionClass: "control",
    simulationPolicy: "deterministic",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: item.inputs.map((name) => ({ name, label: name, schema: { type: "object" }, cardinality: "one" })),
    outputs: item.outputs.map((name) => ({ name, label: name, schema: { type: "object" }, cardinality: "one" })),
    errorSchema: { type: "object" },
    executorDigest: String(index + 20)
      .repeat(64)
      .slice(0, 64)
  })),
  {
    kind: "success",
    version: 1,
    phase: 2,
    category: "terminal",
    label: "Success",
    description: "Ends the branch successfully.",
    executionClass: "control",
    simulationPolicy: "deterministic",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: [{ name: "result", label: "Result", schema: { type: "object" }, cardinality: "optional" }],
    outputs: [],
    errorSchema: { type: "object" },
    executorDigest: "c".repeat(64)
  },
  {
    kind: "compose_markdown",
    version: 1,
    phase: 3,
    category: "data",
    label: "Compose Markdown",
    description: "Creates an immutable Markdown artifact.",
    executionClass: "control",
    simulationPolicy: "deterministic",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: [{ name: "values", label: "Values", schema: { type: "object" }, cardinality: "one" }],
    outputs: [{ name: "markdown", label: "Markdown", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "d".repeat(64)
  },
  {
    kind: "collect",
    version: 1,
    phase: 3,
    category: "data",
    label: "Collect",
    description: "Collects bounded outputs in source order.",
    executionClass: "control",
    simulationPolicy: "deterministic",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: [{ name: "items", label: "Items", schema: { type: "object" }, cardinality: "many" }],
    outputs: [{ name: "collection", label: "Collection", schema: { type: "array" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "e".repeat(64)
  },
  {
    kind: "repository_data",
    version: 1,
    phase: 4,
    category: "data",
    label: "Repository data",
    description: "Reads bounded repository metadata or content.",
    executionClass: "provider",
    simulationPolicy: "read_only",
    mutationPolicy: "none",
    capabilities: ["repository.read"],
    configSchema: { type: "object" },
    inputs: [{ name: "query", label: "Query", schema: { type: "object" }, cardinality: "optional" }],
    outputs: [{ name: "result", label: "Repository result", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "f".repeat(64)
  },
  {
    kind: "repository_agent",
    version: 1,
    phase: 4,
    category: "ai",
    label: "Repository agent",
    description: "Runs one pinned repository agent.",
    executionClass: "workspace",
    simulationPolicy: "fixture",
    mutationPolicy: "none",
    capabilities: ["repository.read", "workspace.create"],
    configSchema: { type: "object" },
    inputs: [{ name: "context", label: "Agent context", schema: { type: "object" }, cardinality: "one" }],
    outputs: [{ name: "result", label: "Agent result", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "0".repeat(64)
  },
  {
    kind: "ai_model",
    version: 1,
    phase: 5,
    category: "ai",
    label: "AI model",
    description: "Runs a pinned OpenRouter model.",
    executionClass: "model",
    simulationPolicy: "fixture",
    mutationPolicy: "none",
    capabilities: ["model.inference"],
    configSchema: { type: "object" },
    inputs: [{ name: "context", label: "Prompt context", schema: { type: "object" }, cardinality: "optional" }],
    outputs: [{ name: "response", label: "Model response", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "1".repeat(64)
  },
  {
    kind: "structured_judgment",
    version: 1,
    phase: 5,
    category: "ai",
    label: "Structured judgment",
    description: "Produces a schema-validated decision.",
    executionClass: "model",
    simulationPolicy: "fixture",
    mutationPolicy: "none",
    capabilities: ["model.inference", "model.structured_output"],
    configSchema: { type: "object" },
    inputs: [{ name: "evidence", label: "Evidence", schema: { type: "object" }, cardinality: "one" }],
    outputs: [{ name: "judgment", label: "Judgment", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "2".repeat(64)
  },
  {
    kind: "provider_event",
    version: 1,
    phase: 6,
    category: "trigger",
    label: "Provider event",
    description: "Starts from a normalized provider event.",
    executionClass: "provider",
    simulationPolicy: "fixture",
    mutationPolicy: "none",
    capabilities: ["provider.events"],
    configSchema: { type: "object" },
    inputs: [],
    outputs: [{ name: "event", label: "Normalized event", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "3".repeat(64)
  },
  {
    kind: "schedule",
    version: 1,
    phase: 6,
    category: "trigger",
    label: "Schedule",
    description: "Starts from a durable schedule.",
    executionClass: "control",
    simulationPolicy: "fixture",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: [],
    outputs: [{ name: "fire", label: "Schedule fire", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "4".repeat(64)
  },
  {
    kind: "provider_data",
    version: 1,
    phase: 6,
    category: "data",
    label: "Provider data",
    description: "Reads connected provider records.",
    executionClass: "provider",
    simulationPolicy: "read_only",
    mutationPolicy: "none",
    capabilities: ["provider.read"],
    configSchema: { type: "object" },
    inputs: [{ name: "query", label: "Query", schema: { type: "object" }, cardinality: "optional" }],
    outputs: [{ name: "result", label: "Provider result", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "5".repeat(64)
  },
  {
    kind: "provider_action",
    version: 1,
    phase: 6,
    category: "action",
    label: "Provider action",
    description: "Performs one durable provider mutation.",
    executionClass: "provider",
    simulationPolicy: "blocked",
    mutationPolicy: "external_effect",
    capabilities: ["provider.write"],
    configSchema: { type: "object" },
    inputs: [{ name: "request", label: "Action request", schema: { type: "object" }, cardinality: "one" }],
    outputs: [{ name: "result", label: "Action result", schema: { type: "object" }, cardinality: "one" }],
    errorSchema: { type: "object" },
    executorDigest: "6".repeat(64)
  },
  ...[
    { kind: "condition", label: "Condition", inputs: ["input"], outputs: ["true", "false"] },
    { kind: "switch", label: "Switch", inputs: ["input"], outputs: ["branch"] },
    { kind: "exclusive_merge", label: "Exclusive merge", inputs: ["branches"], outputs: ["value"] },
    { kind: "for_each", label: "For each", inputs: ["items"], outputs: ["item"] },
    { kind: "join", label: "Join", inputs: ["branches"], outputs: ["results"] },
    { kind: "bounded_loop", label: "Bounded loop", inputs: ["state"], outputs: ["iteration", "result"] },
    { kind: "wait", label: "Wait", inputs: ["context"], outputs: ["event"] },
    { kind: "child_workflow", label: "Invoke workflow", inputs: ["input"], outputs: ["output"] }
  ].map((item, index) => ({
    kind: item.kind,
    version: 1,
    phase: 7,
    category: item.kind === "wait" || item.kind === "child_workflow" ? "action" : "logic",
    label: item.label,
    description: `Configure ${item.label}.`,
    executionClass: "control",
    simulationPolicy: "deterministic",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object" },
    inputs: item.inputs.map((name) => ({ name, label: name, schema: { type: "object" }, cardinality: "one" })),
    outputs: item.outputs.map((name) => ({ name, label: name, schema: { type: "object" }, cardinality: "one" })),
    errorSchema: { type: "object" },
    executorDigest: String(index + 7)
      .repeat(64)
      .slice(0, 64)
  }))
]

const connectionId = "9f336dbd-c1cb-4514-9b3e-9374b3524c98"
const repositoryBinding = {
  connectionId,
  provider: "github" as const,
  resourceType: "repository" as const,
  externalId: "repo-42",
  name: "octo/agency",
  capabilities: ["repository.read", "repository.write", "pull_request.write"]
}
const repositoryInventory = {
  schemaVersion: "2",
  resources: [
    {
      connectionId,
      provider: "github",
      resource: {
        resourceType: "repository",
        externalId: "repo-42",
        name: "octo/agency",
        capabilities: ["repository.read", "repository.write", "pull_request.write"],
        stale: false,
        lastDiscoveredAt: "2026-07-19T12:00:00.000Z"
      }
    },
    {
      connectionId: "2f4524b1-37e8-43e0-a598-708d268fc422",
      provider: "linear",
      resource: {
        resourceType: "team",
        externalId: "team-42",
        name: "Agency Engineering",
        capabilities: ["team.read", "issue.read", "issue.write"],
        stale: false,
        lastDiscoveredAt: "2026-07-19T12:00:00.000Z"
      }
    }
  ]
}
const agentReference = {
  connectionId,
  repositoryId: "repo-42",
  repositoryName: "octo/agency",
  ref: "main",
  path: ".github/agents/reviewer.agent.md",
  observedCommitSha: "1".repeat(40),
  blobSha: "2".repeat(40),
  contentDigest: "3".repeat(64),
  sourceUrl: "https://github.com/octo/agency/blob/main/.github/agents/reviewer.agent.md",
  name: "Code reviewer",
  description: "Reviews a candidate change.",
  requestedModel: "openai/gpt-5",
  requestedTools: ["read", "search"]
}
const modelCatalog = {
  schemaVersion: "1",
  models: [
    {
      modelId: "openai/gpt-test",
      name: "GPT Test",
      contextLength: 128000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { inputModalities: ["text"], outputModalities: ["text"] },
      supportedParameters: ["temperature", "max_tokens", "response_format"],
      observedAt: "2026-07-19T12:00:00.000Z"
    }
  ]
}
const providerOperations = {
  schemaVersion: "1",
  operations: [
    {
      operation: "github.repository",
      provider: "github",
      mode: "read",
      resourceType: "repository",
      capability: "repository.read",
      label: "Repository metadata"
    },
    {
      operation: "github.add_pull_request_comment",
      provider: "github",
      mode: "write",
      resourceType: "repository",
      capability: "pull_request.write",
      label: "Add pull request comment"
    },
    {
      operation: "linear.issue",
      provider: "linear",
      mode: "read",
      resourceType: "team",
      capability: "issue.read",
      label: "Task"
    },
    {
      operation: "linear.add_comment",
      provider: "linear",
      mode: "write",
      resourceType: "team",
      capability: "issue.write",
      label: "Add task comment"
    }
  ]
}

const content = {
  schemaVersion: "2",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  steps: [
    {
      id: "manual",
      label: "Manual run",
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
  ],
  constants: {},
  resourceBindings: { repository: repositoryBinding },
  fixtures: []
}

function draft(revision = 1, publishedVersion: number | null = 1) {
  return {
    schemaVersion: "2",
    workflowId,
    name: "Data preparation",
    description: "Prepare typed input.",
    status: publishedVersion === null ? "draft" : "published",
    draftRevision: revision,
    publishedVersion,
    content,
    versions:
      publishedVersion === null
        ? []
        : [{ version: publishedVersion, contentDigest: "a".repeat(64), publishedAt: "2026-07-19T12:00:00.000Z" }],
    updatedAt: "2026-07-19T12:00:00.000Z"
  }
}

function registerEditorApis(value = draft()) {
  ApiMock.get(`/api/workflows/${workflowId}/draft`, { data: value })
  ApiMock.get("/api/workflows/steps", { data: { schemaVersion: "1", definitions } })
}

afterEach(() => navigate.mockReset())

describe("WorkflowEditorPage V2", { timeout: 30_000 }, () => {
  it("loads the catalog and synchronizes canvas and outline selection", async () => {
    registerEditorApis()
    render(<WorkflowEditorPage />)

    expect(await screen.findByDisplayValue("Data preparation")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open details" })).toBeInTheDocument()
    expect(screen.queryByText("Workflow details")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: "Outline" }))
    expect(screen.getByRole("button", { name: /Set fields/u })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Set fields/u }))
    expect(screen.getByRole("textbox", { name: "Fields" })).toHaveValue('{\n  "answer": 42\n}')
    expect(screen.getByRole("button", { name: "Run to here" })).toBeInTheDocument()
  })

  it("autosaves graph and identity changes", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    const name = await screen.findByRole("textbox", { name: "Workflow name" })
    await userEvent.clear(name)
    await userEvent.type(name, "Prepared data")
    await userEvent.click(screen.getByRole("button", { name: "Move node" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove edge" }))

    await waitFor(() => expect(save.hits).toBeGreaterThan(0), { timeout: 2500 })
    expect(await screen.findByText("saved")).toBeInTheDocument()
  })

  it("reassigns and deletes a selected connection", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Select connection" }))
    expect(screen.getByText("Connection details")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "From" })).toHaveTextContent("Manual run")
    expect(screen.getByRole("combobox", { name: "To" })).toHaveTextContent("Set fields")

    await userEvent.click(screen.getByRole("button", { name: "Reconnect connection" }))
    await waitFor(() => expect(save.hits).toBeGreaterThan(0), { timeout: 2500 })

    await userEvent.click(screen.getByRole("button", { name: "Delete connection" }))
    expect(screen.getByText("The connected steps will remain in the workflow.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(
            ([body]) =>
              !(body as { content: WorkflowDraftContent }).content.connections.some(({ id }) => id === "manual-set")
          )
        ).toBe(true),
      { timeout: 2500 }
    )
  })

  it("opens the affected graph item from validation issues", async () => {
    registerEditorApis()
    ApiMock.post(`/api/workflows/${workflowId}/validate`, {
      data: {
        valid: false,
        issues: [
          {
            code: "agent_reference",
            message: "Set fields needs an agent definition.",
            nodeId: "set",
            connectionId: null
          }
        ]
      }
    })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Validate" }))
    expect(await screen.findByText("Fix workflow issues")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Set fields needs an agent definition." }))
    expect(screen.getByRole("textbox", { name: "Label" })).toHaveValue("Set fields")
    expect(screen.getByRole("complementary", { name: "Workflow details" })).toHaveFocus()
  })

  it("tests the draft, runs to a selected step, publishes, and starts a durable run", async () => {
    registerEditorApis()
    ApiMock.post(`/api/workflows/${workflowId}/validate`, { data: { valid: true, issues: [] } })
    ApiMock.post(`/api/workflows/${workflowId}/publish`, { data: draft(1, 2) })
    const testDraft = ApiMock.post(`/api/workflows/${workflowId}/test`, {
      data: {
        schemaVersion: "1",
        mode: "draft",
        simulated: true,
        draftRevision: 1,
        fixtureId: null,
        elapsedMs: 1,
        steps: [{ stepId: "manual", status: "succeeded", input: { input: {} }, output: { input: {} }, error: null }]
      }
    })
    const run = ApiMock.post(`/api/workflows/${workflowId}/runs`, { data: { runId, created: true, version: 2 } })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Test draft" }))
    await waitFor(() => expect(testDraft.hits).toBe(1))
    expect(screen.getByText("Simulated result")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Publish" }))
    await userEvent.click(screen.getByRole("button", { name: "Run" }))
    await waitFor(() => expect(run.hits).toBe(1))
    expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId } })
  })

  it("searches the authoritative catalog and adds an executable step", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    const search = screen.getByPlaceholderText("Find a step")
    await userEvent.type(search, "success")
    expect(screen.queryByRole("menuitem", { name: /Manual run/u })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("menuitem", { name: /Success/u }))
    expect(screen.getAllByRole("button", { name: "Select Success" })).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Run to here" })).toBeInTheDocument()
  })

  it("authors Phase 3 Markdown artifacts and bounded collections", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Compose Markdown/u }))
    const template = screen.getByRole("textbox", { name: "Markdown template" })
    expect(template).toHaveValue("# Report\n\n{{summary}}")
    await userEvent.clear(template)
    await userEvent.type(template, "# {{issue.id}}")

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Collect/u }))
    expect(screen.getByRole("combobox", { name: "Collection mode" })).toHaveTextContent("Ordered array")
    expect(screen.getByRole("spinbutton", { name: "Maximum items" })).toHaveValue(100)
    await userEvent.click(screen.getByRole("combobox", { name: "Collection mode" }))
    await userEvent.click(screen.getByRole("option", { name: "Keyed object" }))
    expect(screen.getByRole("textbox", { name: "Key field" })).toBeInTheDocument()
  })

  it("authors mapping, validation, failure, and switch control steps", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Map fields/u }))
    const mappings = screen.getByRole("textbox", { name: "Mappings" })
    fireEvent.change(mappings, { target: { value: "not-json" } })
    fireEvent.change(mappings, { target: { value: '{"title":"issue.title"}' } })

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Validate/u }))
    const validationSchema = screen.getByRole("textbox", { name: "Validation schema" })
    fireEvent.change(validationSchema, { target: { value: "{" } })
    fireEvent.change(validationSchema, { target: { value: '{"type":"string"}' } })

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Failure/u }))
    await userEvent.clear(screen.getByRole("textbox", { name: "Failure code" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Failure code" }), "review_failed")
    await userEvent.clear(screen.getByRole("textbox", { name: "Message" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Review did not pass")

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Exclusive merge/u }))
    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Switch/u }))
    const cases = screen.getByRole("textbox", { name: "Cases" })
    fireEvent.change(cases, { target: { value: "invalid" } })
    fireEvent.change(cases, {
      target: { value: '[{"key":"approved","when":{"path":["approved"],"operator":"truthy"}}]' }
    })
    await userEvent.clear(screen.getByRole("textbox", { name: "Default branch key" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Default branch key" }), "rejected")
    await userEvent.click(screen.getByRole("combobox", { name: "Merge step" }))
    await userEvent.click(screen.getByRole("option", { name: "Exclusive merge" }))

    expect(screen.getByRole("textbox", { name: "Default branch key" })).toHaveValue("rejected")
  })

  it("configures bounded repository data for the workflow repository", async () => {
    registerEditorApis(draft(1, null))
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Repository data/u }))
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    await userEvent.click(screen.getByRole("combobox", { name: "Operation" }))
    await userEvent.click(screen.getByRole("option", { name: "file content" }))
    await userEvent.clear(screen.getByRole("textbox", { name: "Repository ref" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Repository ref" }), "release")

    await waitFor(() => expect(save.hits).toBeGreaterThan(0), { timeout: 2500 })
    expect(save.spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              config: { operation: "file_content", repository: { owner: "octo", name: "agency", ref: "release" } }
            })
          ])
        })
      })
    )
  })

  it("discovers repository agents and persists the selected immutable reference", async () => {
    registerEditorApis(draft(1, null))
    const discover = ApiMock.post("/api/workflows/repository-agents/discover", {
      data: { schemaVersion: "1", agents: [agentReference] }
    })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Repository agent/u }))
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    await userEvent.click(screen.getByRole("button", { name: "Find agents" }))
    await waitFor(() => expect(discover.hits).toBe(1))
    expect(discover.spy).toHaveBeenCalledWith({
      connectionId,
      repositoryId: "repo-42",
      repositoryName: "octo/agency",
      ref: "HEAD"
    })
    await userEvent.click(await screen.findByRole("combobox", { name: "Agent definition" }))
    await userEvent.click(screen.getByRole("option", { name: /Code reviewer/u }))
    expect(screen.getByRole("link", { name: "Open in GitHub" })).toHaveAttribute("href", agentReference.sourceUrl)

    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) =>
            (body as { content: WorkflowDraftContent }).content.steps.some(
              ({ config }) => config.agentReference !== undefined
            )
          )
        ).toBe(true),
      { timeout: 2500 }
    )
  })

  it("shows explicit empty and discovery error states for repository agents", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.post("/api/workflows/repository-agents/discover", [
      { data: { schemaVersion: "1", agents: [] } },
      { status: 503, data: { error: "GitHub is unavailable" } }
    ])
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Repository agent/u }))
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    await userEvent.click(screen.getByRole("button", { name: "Find agents" }))
    expect(await screen.findByText("No repository agents were found.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Find agents" }))
    expect(await screen.findByText("GitHub is unavailable")).toBeInTheDocument()
  })

  it("authors catalog-backed model prompts, structured output, and guided parameters", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/workflows/models", { data: modelCatalog })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^AI model/u }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }))
    await userEvent.click(screen.getByRole("option", { name: /GPT Test/u }))
    await userEvent.click(screen.getByRole("button", { name: "Use workflow context" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Output format" }))
    await userEvent.click(screen.getByRole("option", { name: "Structured JSON" }))
    const schema = screen.getByRole("textbox", { name: "Output schema" })
    await userEvent.clear(schema)
    await userEvent.type(schema, "not-json")
    expect(screen.getByText("Enter valid JSON Schema")).toBeInTheDocument()
    await userEvent.clear(schema)
    fireEvent.change(schema, { target: { value: '{"type":"object","properties":{"label":{"type":"string"}}}' } })
    const temperature = screen.getByRole("spinbutton", { name: "Temperature" })
    await userEvent.clear(temperature)
    await userEvent.type(temperature, "0")

    await waitFor(
      () =>
        expect(save.spy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              steps: expect.arrayContaining([
                expect.objectContaining({
                  config: expect.objectContaining({
                    modelId: "openai/gpt-test",
                    outputMode: "structured",
                    outputSchema: { type: "object", properties: { label: { type: "string" } } },
                    parameters: { temperature: 0, max_tokens: 2000 }
                  })
                })
              ])
            })
          })
        ),
      { timeout: 2500 }
    )
  }, 30_000)

  it("authors structured judgments only from structured-output models", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/workflows/models", { data: modelCatalog })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Structured judgment/u }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }))
    await userEvent.click(screen.getByRole("option", { name: /GPT Test/u }))
    const criteria = screen.getByRole("textbox", { name: "Judgment criteria" })
    await userEvent.clear(criteria)
    await userEvent.type(criteria, "Approve only with passing tests.")

    await waitFor(() => expect(save.hits).toBeGreaterThan(0), { timeout: 2500 })
    expect(save.spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              config: expect.objectContaining({
                modelId: "openai/gpt-test",
                criteria: "Approve only with passing tests."
              })
            })
          ])
        })
      })
    )
  })

  it("authors provider events and durable schedules", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/integrations/resources", { data: repositoryInventory })
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider event/u }))
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent("pull_request.created")

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Schedule/u }))
    expect(screen.getByRole("spinbutton", { name: "Interval seconds" })).toHaveValue(300)
    await userEvent.click(screen.getByRole("combobox", { name: "Schedule mode" }))
    await userEvent.click(screen.getByRole("option", { name: "CRON" }))
    expect(screen.getByRole("textbox", { name: "CRON expression" })).toHaveValue("0 9 * * 1-5")
  })

  it("seals provider resources for reads and effect-ledger actions", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/integrations/resources", { data: repositoryInventory })
    ApiMock.get("/api/workflows/provider-operations", { data: providerOperations })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider data/u }))
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    await waitFor(() => expect(save.hits).toBeGreaterThan(0), { timeout: 2500 })
    const providerDataSave = save.spy.mock.calls.at(-1)?.[0] as { content: WorkflowDraftContent }
    const providerDataStep = providerDataSave.content.steps.find(
      ({ definition }) => definition.kind === "provider_data"
    )
    expect(providerDataStep).toBeDefined()
    expect(providerDataStep!.config.binding).toEqual(providerDataSave.content.resourceBindings.repository)
    expect(providerDataSave.content.resourceBindings[providerDataStep!.id]).toBeUndefined()

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider action/u }))
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    expect(screen.getByText(/retries pause until you confirm what happened/u)).toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) =>
            (body as { content: WorkflowDraftContent }).content.steps.some(
              ({ definition }) => definition.kind === "provider_action"
            )
          )
        ).toBe(true),
      { timeout: 2500 }
    )
    const providerActionSave = save.spy.mock.calls.at(-1)?.[0] as { content: WorkflowDraftContent }
    const providerActionStep = providerActionSave.content.steps.find(
      ({ definition }) => definition.kind === "provider_action"
    )
    expect(providerActionStep).toBeDefined()
    expect(providerActionStep!.config.binding).toEqual(providerActionSave.content.resourceBindings.repository)
    expect(providerActionSave.content.resourceBindings[providerActionStep!.id]).toBeUndefined()
  }, 15_000)

  it("selects Linear teams for provider triggers, reads, and actions", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/integrations/resources", { data: repositoryInventory })
    ApiMock.get("/api/workflows/provider-operations", { data: providerOperations })
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider event/u }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Provider" }))
    await userEvent.click(screen.getByRole("option", { name: "Linear" }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Team" }))
    await userEvent.click(screen.getByRole("option", { name: "Agency Engineering" }))
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent("task.created")

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider data/u }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Provider" }))
    await userEvent.click(screen.getByRole("option", { name: "Linear" }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Team" }))
    await userEvent.click(screen.getByRole("option", { name: "Agency Engineering" }))
    expect(screen.getByRole("combobox", { name: "Operation" })).toHaveTextContent("Task")

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider action/u }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Provider" }))
    await userEvent.click(screen.getByRole("option", { name: "Linear" }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Team" }))
    await userEvent.click(screen.getByRole("option", { name: "Agency Engineering" }))
    expect(screen.getByRole("combobox", { name: "Operation" })).toHaveTextContent("Add task comment")
  })

  it("shows empty and error states while loading provider resources", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/integrations/resources", [
      { data: { schemaVersion: "2", resources: [] } },
      { status: 503, data: { error: "Provider inventory unavailable" } }
    ])
    ApiMock.get("/api/workflows/provider-operations", { data: providerOperations })
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider data/u }))
    expect(await screen.findByText("No connected provider resources are available.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Provider action/u }))
    expect(await screen.findByText("Provider inventory unavailable")).toBeInTheDocument()
  })

  it("authors and persists Phase 7 orchestration boundaries and runtime bounds", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Exclusive merge/u }))
    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Condition/u }))
    fireEvent.change(screen.getByRole("textbox", { name: "Expression path" }), { target: { value: "score" } })
    await userEvent.click(screen.getByRole("combobox", { name: "Operator" }))
    await userEvent.click(screen.getByRole("option", { name: "greater than or equal" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Comparison value" }), { target: { value: "80" } })
    await userEvent.click(screen.getByRole("combobox", { name: "Merge step" }))
    await userEvent.click(screen.getByRole("option", { name: "Exclusive merge" }))

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Join/u }))
    await userEvent.click(screen.getByRole("combobox", { name: "Join policy" }))
    await userEvent.click(screen.getByRole("option", { name: "Quorum" }))
    const quorum = screen.getByRole("spinbutton", { name: "Quorum" })
    fireEvent.change(quorum, { target: { value: "2" } })

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^For each/u }))
    const concurrency = screen.getByRole("spinbutton", { name: "Concurrency" })
    fireEvent.change(concurrency, { target: { value: "3" } })
    await userEvent.click(screen.getByRole("combobox", { name: "Join step" }))
    await userEvent.click(screen.getByRole("option", { name: "Join" }))

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Bounded loop/u }))
    const maximumActivations = screen.getByRole("spinbutton", { name: "Maximum activations" })
    fireEvent.change(maximumActivations, { target: { value: "25" } })
    await userEvent.click(screen.getByRole("combobox", { name: "On exhaustion" }))
    await userEvent.click(screen.getByRole("option", { name: "Complete" }))

    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) => {
            const steps = (body as { content: WorkflowDraftContent }).content.steps
            return steps.some(
              ({ definition, config }) => definition.kind === "bounded_loop" && config.maximumActivations === 25
            )
          })
        ).toBe(true),
      { timeout: 2500 }
    )
    const saved = save.spy.mock.lastCall?.[0] as { content: WorkflowDraftContent }
    expect(saved.content.steps.find(({ definition }) => definition.kind === "condition")?.config).toMatchObject({
      expression: { path: ["score"], operator: "greater_than_or_equal", value: 80 }
    })
    expect(saved.content.steps.find(({ definition }) => definition.kind === "join")?.config).toEqual({
      policy: "quorum",
      quorum: 2
    })
    expect(saved.content.steps.find(({ definition }) => definition.kind === "for_each")?.config).toMatchObject({
      concurrency: 3
    })
    expect(saved.content.steps.find(({ definition }) => definition.kind === "bounded_loop")?.config).toMatchObject({
      maximumActivations: 25,
      onExhaustion: "complete"
    })
  }, 15_000)

  it("authors and persists durable wait and pinned child workflow contracts", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Wait/u }))
    const correlation = screen.getByRole("textbox", { name: "Correlation key" })
    fireEvent.change(correlation, { target: { value: "github:{{repository}}:{{number}}" } })
    const expiry = screen.getByRole("spinbutton", { name: "Expires after seconds" })
    fireEvent.change(expiry, { target: { value: "600" } })

    await userEvent.click(screen.getByRole("button", { name: "Add step" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /^Invoke workflow/u }))
    fireEvent.change(screen.getByRole("textbox", { name: "Execution package digest" }), {
      target: { value: "e".repeat(64) }
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Interface digest" }), { target: { value: "f".repeat(64) } })

    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) =>
            (body as { content: WorkflowDraftContent }).content.steps.some(
              ({ definition, config }) =>
                definition.kind === "child_workflow" && config.interfaceDigest === "f".repeat(64)
            )
          )
        ).toBe(true),
      { timeout: 2500 }
    )
    const saved = save.spy.mock.lastCall?.[0] as { content: WorkflowDraftContent }
    expect(saved.content.steps.find(({ definition }) => definition.kind === "wait")?.config).toMatchObject({
      correlation: "github:{{repository}}:{{number}}",
      expiresAfterSeconds: 600,
      eventSchema: { type: "object" }
    })
    expect(saved.content.steps.find(({ definition }) => definition.kind === "child_workflow")?.config).toEqual({
      packageDigest: "e".repeat(64),
      interfaceDigest: "f".repeat(64)
    })
  }, 15_000)
})
