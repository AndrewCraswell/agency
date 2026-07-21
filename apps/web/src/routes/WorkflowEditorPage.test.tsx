import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { IntegrationConnection, IntegrationSettings, WorkflowDraftContent } from "@/services/api"
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
    Handle: ({ id, type }: { id: string; type: string }) =>
      React.createElement("span", { "aria-label": `${type} handle ${id}` }),
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
      inputs: ["input"],
      outputs: ["true", "false"]
    }
  ].map((item, index) => ({
    kind: item.kind,
    version: 1,
    phase: 2,
    category: item.category,
    label: item.label,
    description: item.description,
    executionClass: "control",
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
    kind: "compose_markdown",
    version: 1,
    phase: 3,
    category: "data",
    label: "Compose Markdown",
    description: "Creates an immutable Markdown artifact.",
    executionClass: "control",
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
    { kind: "wait_event_github", label: "Wait event (GitHub)", inputs: ["input"], outputs: ["event", "timeout"] },
    { kind: "wait_event_linear", label: "Wait event (Linear)", inputs: ["input"], outputs: ["event", "timeout"] },
    { kind: "delay", label: "Delay", inputs: ["input"], outputs: ["continued"] },
    { kind: "child_workflow", label: "Invoke workflow", inputs: ["input"], outputs: ["output"] }
  ].map((item, index) => ({
    kind: item.kind,
    version: 1,
    phase: 7,
    category:
      item.kind.startsWith("wait_event_") || item.kind === "delay" || item.kind === "child_workflow"
        ? "action"
        : "logic",
    label: item.label,
    description: `Configure ${item.label}.`,
    executionClass: "control",
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
].map((definition) => {
  const fieldByKind: Record<string, { key: string; label: string; control: "text" | "number" | "multiline" }> = {
    bounded_loop: { key: "maximumIterations", label: "Maximum iterations", control: "number" },
    compose_markdown: { key: "template", label: "Markdown template", control: "multiline" },
    wait_event_github: { key: "eventKey", label: "Event", control: "text" },
    wait_event_linear: { key: "eventKey", label: "Event", control: "text" },
    delay: { key: "duration", label: "Duration", control: "number" }
  }
  const field = fieldByKind[definition.kind]
  return {
    ...definition,
    ui: {
      fields:
        field === undefined
          ? []
          : [
              {
                ...field,
                description: `Configure ${field.label}.`,
                group: "basic" as const,
                required: true,
                secret: false,
                immutable: false
              }
            ]
    }
  }
})

const connectionId = "9f336dbd-c1cb-4514-9b3e-9374b3524c98"
const linearConnectionId = "2f4524b1-37e8-43e0-a598-708d268fc422"
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
const integrationConnections: IntegrationConnection[] = [
  {
    connectionId,
    provider: "github",
    providerAccount: "Agency GitHub",
    status: "connected",
    lastSuccessfulSyncAt: "2026-07-19T12:00:00.000Z",
    latestError: null,
    lastCheckedAt: "2026-07-19T12:00:00.000Z",
    resourceCounts: { total: 1, active: 1, stale: 0 },
    capabilities: ["repository.read", "repository.write", "pull_request.write"],
    createdAt: "2026-07-19T12:00:00.000Z",
    updatedAt: "2026-07-19T12:00:00.000Z",
    resources: []
  },
  {
    connectionId: linearConnectionId,
    provider: "linear",
    providerAccount: "Agency Linear",
    status: "connected",
    lastSuccessfulSyncAt: "2026-07-19T12:00:00.000Z",
    latestError: null,
    lastCheckedAt: "2026-07-19T12:00:00.000Z",
    resourceCounts: { total: 1, active: 1, stale: 0 },
    capabilities: ["issue.read", "issue.write", "team.read"],
    createdAt: "2026-07-19T12:00:00.000Z",
    updatedAt: "2026-07-19T12:00:00.000Z",
    resources: []
  }
]
const integrationSettings: IntegrationSettings = {
  schemaVersion: "2",
  catalog: [
    { provider: "github", name: "GitHub", description: "GitHub", capabilities: [] },
    { provider: "linear", name: "Linear", description: "Linear", capabilities: [] }
  ],
  connections: integrationConnections
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
    },
    {
      modelId: "anthropic/fable-test",
      name: "Fable Test",
      contextLength: 128000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { inputModalities: ["text"], outputModalities: ["text"] },
      supportedParameters: ["max_tokens"],
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
const providerEvents = {
  schemaVersion: "2",
  events: [
    {
      provider: "github",
      resourceType: "repository",
      eventKey: "pull_request.created",
      label: "Pull request created"
    },
    { provider: "github", resourceType: "repository", eventKey: "issue.created", label: "Issue created" },
    { provider: "linear", resourceType: "team", eventKey: "task.created", label: "Issue created" },
    { provider: "linear", resourceType: "team", eventKey: "task.removed", label: "Issue removed" }
  ]
}

const content: WorkflowDraftContent = {
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
  ],
  constants: {},
  resourceBindings: { repository: repositoryBinding }
}

function draft(revision = 1, activePublishedVersion: number | null = 1) {
  return {
    schemaVersion: "3",
    workflowId,
    name: "Data preparation",
    description: "Prepare typed input.",
    status: "draft",
    draftRevision: revision,
    activePublishedVersion,
    content,
    versions:
      activePublishedVersion === null
        ? []
        : [{ version: activePublishedVersion, contentDigest: "a".repeat(64), publishedAt: "2026-07-19T12:00:00.000Z" }],
    updatedAt: "2026-07-19T12:00:00.000Z"
  }
}

function registerEditorApis(value = draft(), settings = integrationSettings) {
  ApiMock.get(`/api/workflows/${workflowId}/draft`, { data: value })
  ApiMock.get("/api/workflows/steps", { data: { schemaVersion: "1", definitions } })
  ApiMock.get("/api/integrations", { data: settings })
}

async function addStep(name: RegExp) {
  let catalog = screen.queryByRole("complementary", { name: "Step library" })
  if (catalog === null) {
    await userEvent.click(screen.getByRole("button", { name: "Open step library" }))
    catalog = await screen.findByRole("complementary", { name: "Step library" })
  }
  const search = within(catalog).getByPlaceholderText("Search steps")
  await userEvent.clear(search)
  await userEvent.type(
    search,
    name.source.replaceAll("^", "").replaceAll("$", "").replaceAll("\\(", "(").replaceAll("\\)", ")")
  )
  await userEvent.click(within(catalog).getByRole("button", { name }))
}

afterEach(() => navigate.mockReset())

describe("WorkflowEditorPage", { timeout: 30_000 }, () => {
  it("renders validation with Input, True, and False ports", async () => {
    const value = draft()
    value.content.steps[1] = {
      ...value.content.steps[1]!,
      definition: { kind: "validate", version: 1 },
      config: { schema: { type: "object" } }
    }
    registerEditorApis(value)
    render(<WorkflowEditorPage />)

    expect(await screen.findAllByLabelText("target handle input")).not.toHaveLength(0)
    expect(screen.getByLabelText("source handle true")).toBeInTheDocument()
    expect(screen.getByLabelText("source handle false")).toBeInTheDocument()
  })

  it("renders an ordinary sink with input and output handles", async () => {
    registerEditorApis()
    render(<WorkflowEditorPage />)

    expect(await screen.findByDisplayValue("Data preparation")).toBeInTheDocument()
    expect(screen.getAllByLabelText("target handle input")).not.toHaveLength(0)
    expect(screen.getAllByLabelText("source handle value")).not.toHaveLength(0)
  })

  it("loads the catalog and synchronizes canvas and outline selection", async () => {
    registerEditorApis()
    render(<WorkflowEditorPage />)

    expect(await screen.findByDisplayValue("Data preparation")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Data preparation" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open details" })).toBeInTheDocument()
    expect(screen.queryByText("Workflow details")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add step" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Problems" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Close step library" }))
    await userEvent.click(screen.getByRole("button", { name: "Open step library" }))
    await waitFor(() => expect(screen.getByPlaceholderText("Search steps")).toHaveFocus())
    await userEvent.click(screen.getByRole("button", { name: "Data" }))
    const stepLibrary = screen.getByRole("complementary", { name: "Step library" })
    expect(within(stepLibrary).getByRole("button", { name: /Provider data/u })).toBeInTheDocument()
    expect(within(stepLibrary).getByRole("button", { name: /Manual run/u })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Expand results" }))
    expect(screen.getByRole("heading", { name: "Problems 0" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Collapse results" }))
    expect(screen.getByRole("button", { name: "Expand results" })).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(screen.getByRole("tab", { name: "Outline" }))
    const topology = screen.getByRole("navigation", { name: "Workflow topology" })
    const setFields = topology.querySelector<HTMLButtonElement>('[data-outline-selection="set"]')
    expect(setFields).not.toBeNull()
    if (setFields === null) {
      throw new Error("Set fields outline item is unavailable")
    }
    expect(setFields).toBeInTheDocument()
    await userEvent.click(setFields)
    expect(screen.getByDisplayValue("Set fields")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Run to here" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Close properties" }))
    await waitFor(() => expect(setFields).toHaveFocus())
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
    expect(await screen.findByText("All changes saved")).toBeInTheDocument()
  })

  it("explains why a workflow without an active version cannot run", async () => {
    registerEditorApis(draft(1, null))
    render(<WorkflowEditorPage />)

    expect(await screen.findByText("Draft")).toBeInTheDocument()
    expect(screen.getByText("All changes saved")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Run published version" })).toBeDisabled()
    expect(screen.getByText("Publish a version before starting a run.")).toBeInTheDocument()
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
    expect(await screen.findByText("The connected steps will remain in the workflow.")).toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: "Delete", hidden: true }))
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
        schemaVersion: "1",
        draftRevision: 1,
        valid: false,
        issues: [
          {
            code: "step_label",
            message: "Set fields needs an agent definition.",
            nodeId: "set",
            connectionId: null,
            field: "Label"
          }
        ]
      }
    })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Check for issues" }))
    await userEvent.click(screen.getByRole("button", { name: "Expand results" }))
    expect(await screen.findByText("1 issue to fix for draft revision 1.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Set fields needs an agent definition." }))
    const label = screen.getByRole("textbox", { name: "Label" })
    expect(label).toHaveValue("Set fields")
    expect(label).toHaveFocus()
  })

  it("tests the draft through its trigger, publishes, and starts a durable run", async () => {
    registerEditorApis()
    ApiMock.post(`/api/workflows/${workflowId}/validate`, {
      data: { schemaVersion: "1", draftRevision: 1, valid: true, issues: [] }
    })
    ApiMock.post(`/api/workflows/${workflowId}/publish`, { data: draft(1, 2) })
    const testDraft = ApiMock.post(`/api/workflows/${workflowId}/test`, {
      data: {
        runId,
        created: true,
        source: { kind: "draft_test", draftRevision: 1 }
      }
    })
    const run = ApiMock.post(`/api/workflows/${workflowId}/runs`, {
      data: { runId, created: true, source: { kind: "published", version: 2 } }
    })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Test draft" }))
    expect(testDraft.hits).toBe(0)
    const confirmation = await screen.findByRole("alertdialog", { name: "Start live draft test?" })
    expect(within(confirmation).getByText("Resources: octo/agency.")).toBeInTheDocument()
    await userEvent.click(within(confirmation).getByRole("button", { name: "Start draft test", hidden: true }))
    await waitFor(() => expect(testDraft.hits).toBe(1))
    expect(testDraft.spy).toHaveBeenCalledWith({ expectedRevision: 1, triggerStepId: "manual", input: {} })
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId } }))

    await userEvent.click(screen.getByRole("button", { name: "Publish version 2" }))
    expect(await screen.findByText("Active version 2")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Run published version 2" }))
    await waitFor(() => expect(run.hits).toBe(1))
    expect(run.spy).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }))
    expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId } })
  })

  it("blocks draft testing and focuses the first missing required input", async () => {
    registerEditorApis({
      ...draft(),
      content: {
        ...content,
        inputSchema: {
          type: "object",
          required: ["requestId"],
          properties: { requestId: { type: "string", title: "Request ID" } }
        }
      }
    })
    const testDraft = ApiMock.post(`/api/workflows/${workflowId}/test`, {
      data: { runId, created: true, source: { kind: "draft_test", draftRevision: 1 } }
    })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Test draft" }))

    expect(testDraft.hits).toBe(0)
    expect(screen.queryByRole("alertdialog", { name: "Start live draft test?" })).not.toBeInTheDocument()
    const requestId = screen.getByRole("textbox", { name: "Request ID" })
    expect(requestId).toHaveAttribute("aria-invalid", "true")
    expect(requestId).toHaveFocus()
  })

  it("requires an explicit test trigger when the draft has multiple triggers", async () => {
    const schedule: WorkflowDraftContent["steps"][number] = {
      ...content.steps[0]!,
      id: "schedule",
      label: "Daily schedule",
      definition: { kind: "schedule", version: 1 },
      config: { timezone: "UTC", intervalSeconds: 86_400 }
    }
    const multiTriggerContent: WorkflowDraftContent = { ...content, steps: [...content.steps, schedule] }
    registerEditorApis({
      ...draft(),
      content: multiTriggerContent
    })
    const testDraft = ApiMock.post(`/api/workflows/${workflowId}/test`, {
      data: { runId, created: true, source: { kind: "draft_test", draftRevision: 1 } }
    })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Open details" }))
    const trigger = screen.getByRole("combobox", { name: "Test trigger" })
    expect(trigger).toHaveValue("")
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("option", { name: "Daily schedule" }))
    await userEvent.click(screen.getByRole("button", { name: "Test draft" }))
    expect(testDraft.hits).toBe(0)
    expect(await screen.findByText("This starts a durable server run from Daily schedule.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Start draft test" }))

    await waitFor(() => expect(testDraft.hits).toBe(1))
    expect(testDraft.spy).toHaveBeenCalledWith({ expectedRevision: 1, triggerStepId: "schedule", input: {} })
  })

  it("keeps validation problems revision-scoped and marks them stale after an edit", async () => {
    registerEditorApis()
    ApiMock.post(`/api/workflows/${workflowId}/validate`, {
      data: {
        schemaVersion: "1",
        draftRevision: 1,
        valid: false,
        issues: [
          {
            code: "step_label",
            message: "Set fields needs a label.",
            nodeId: "set",
            connectionId: null,
            field: "Label"
          }
        ]
      }
    })
    render(<WorkflowEditorPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Check for issues" }))
    await userEvent.click(screen.getByRole("button", { name: "Expand results" }))
    expect(screen.getByRole("heading", { name: "Problems 1" })).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Workflow description" }), {
      target: { value: "Changed after results" }
    })
    expect(screen.getByText("Out of date. Check the current draft again.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set fields needs a label." })).toBeInTheDocument()
  })

  it("searches the authoritative catalog and adds an executable step", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    const catalog = await screen.findByRole("complementary", { name: "Step library" })
    const search = within(catalog).getByPlaceholderText("Search steps")
    await userEvent.type(search, "compose markdown")
    expect(within(catalog).queryByRole("button", { name: /Manual run/u })).not.toBeInTheDocument()
    await userEvent.click(within(catalog).getByRole("button", { name: /Compose Markdown/u }))
    expect(screen.getByRole("button", { name: "Select Compose Markdown" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Run to here" })).not.toBeInTheDocument()
  })

  it("authors Phase 3 Markdown artifacts and bounded collections", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Compose Markdown/u)
    const template = screen.getByRole("textbox", { name: "Markdown template" })
    expect(template).toHaveValue("# Report\n\n{{summary}}")
    await userEvent.clear(template)
    await userEvent.type(template, "# {{issue.id}}")

    await addStep(/Collect/u)
    expect(screen.getByRole("combobox", { name: "Collection mode" })).toHaveTextContent("Ordered array")
    expect(screen.getByRole("spinbutton", { name: "Maximum items" })).toHaveValue(100)
    await userEvent.click(screen.getByRole("combobox", { name: "Collection mode" }))
    await userEvent.click(screen.getByRole("option", { name: "Keyed object" }))
    expect(screen.getByRole("textbox", { name: "Key field" })).toBeInTheDocument()
  })

  it("authors mapping, validation, merge, and switch control steps", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Map fields/u)
    await userEvent.click(screen.getByRole("button", { name: "Add row" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Output field" }), { target: { value: "title" } })
    fireEvent.change(screen.getByRole("textbox", { name: "Source path" }), { target: { value: "issue.title" } })

    await addStep(/^Validate/u)
    await userEvent.click(screen.getByText("Advanced schema"))
    const validationSchema = screen.getByRole("textbox", { name: "Validation schema" })
    fireEvent.change(validationSchema, { target: { value: "{" } })
    fireEvent.change(validationSchema, { target: { value: '{"type":"string"}' } })

    await addStep(/^Exclusive merge/u)
    await addStep(/^Switch/u)
    await userEvent.click(screen.getByRole("button", { name: "Add case" }))
    fireEvent.change(screen.getAllByRole("textbox", { name: "Branch key" }).at(-1)!, { target: { value: "approved" } })
    fireEvent.change(screen.getAllByRole("textbox", { name: "Input path" }).at(-1)!, { target: { value: "approved" } })
    await userEvent.clear(screen.getByRole("textbox", { name: "Default branch key" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Default branch key" }), "rejected")
    await userEvent.click(screen.getByRole("combobox", { name: "Merge step" }))
    await userEvent.click(screen.getByRole("option", { name: "Exclusive merge" }))

    expect(screen.getByRole("textbox", { name: "Default branch key" })).toHaveValue("rejected")
  }, 60_000)

  it("configures bounded repository data for the workflow repository", async () => {
    registerEditorApis(draft(1, null))
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Repository data/u)
    expect(await screen.findByRole("textbox", { name: "Repository" })).toHaveValue("octo/agency")
    await userEvent.click(screen.getByRole("combobox", { name: "Operation" }))
    await userEvent.click(screen.getByRole("option", { name: "file content" }))
    await userEvent.clear(screen.getByRole("textbox", { name: "Repository ref" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Repository ref" }), "release")

    await waitFor(
      () =>
        expect(save.spy).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              steps: expect.arrayContaining([
                expect.objectContaining({
                  config: {
                    operation: "file_content",
                    repository: { owner: "octo", name: "agency", ref: "release" }
                  }
                })
              ])
            })
          })
        ),
      { timeout: 5000 }
    )
  })

  it("discovers repository agents and persists the selected immutable reference", async () => {
    registerEditorApis(draft(1, null))
    const discover = ApiMock.post("/api/workflows/repository-agents/discover", {
      data: { schemaVersion: "1", agents: [agentReference] }
    })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Repository agent/u)
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

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Repository agent/u)
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

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^AI model/u)
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }))
    await userEvent.click(screen.getByRole("option", { name: /GPT Test/u }))
    await userEvent.click(screen.getByRole("button", { name: "Use workflow context" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Output format" }))
    await userEvent.click(screen.getByRole("option", { name: "Structured JSON" }))
    await userEvent.click(screen.getByText("Advanced schema"))
    const schema = screen.getByRole("textbox", { name: "Output schema" })
    await userEvent.clear(schema)
    await userEvent.type(schema, "not-json")
    expect(screen.getByText("Enter valid JSON Schema.")).toBeInTheDocument()
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
                    parameters: { temperature: 0 }
                  })
                })
              ])
            })
          })
        ),
      { timeout: 2500 }
    )
  }, 30_000)

  it("removes parameters unsupported by the selected model", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/workflows/models", { data: modelCatalog })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^AI model/u)
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }))
    await userEvent.click(screen.getByRole("option", { name: /GPT Test/u }))
    const temperature = screen.getByRole("spinbutton", { name: "Temperature" })
    const maxTokens = screen.getByRole("spinbutton", { name: "Maximum completion tokens" })
    await userEvent.type(temperature, "0.7")
    await userEvent.type(maxTokens, "500")

    await userEvent.click(screen.getByRole("combobox", { name: "Model" }))
    await userEvent.click(screen.getByRole("option", { name: /Fable Test/u }))

    expect(screen.queryByRole("spinbutton", { name: "Temperature" })).not.toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Maximum completion tokens" })).toHaveValue(500)
    await waitFor(() =>
      expect(save.spy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            steps: expect.arrayContaining([
              expect.objectContaining({
                config: expect.objectContaining({
                  modelId: "anthropic/fable-test",
                  parameters: { max_tokens: 500 }
                })
              })
            ])
          })
        })
      )
    )
  }, 30_000)

  it("reviews a generated schema proposal before applying it", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/workflows/models", { data: modelCatalog })
    const generate = ApiMock.post("/api/workflows/generate-schema", {
      data: {
        schemaVersion: "1",
        schema: {
          type: "object",
          properties: { decision: { type: "string" } },
          required: ["decision"],
          additionalProperties: false
        }
      }
    })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^AI model/u)
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }))
    await userEvent.click(screen.getByRole("option", { name: /GPT Test/u }))
    await userEvent.click(screen.getByRole("combobox", { name: "Output format" }))
    await userEvent.click(screen.getByRole("option", { name: "Structured JSON" }))
    await userEvent.click(screen.getByRole("button", { name: "Generate schema" }))

    expect(generate.hits).toBe(0)
    expect(screen.getByText(/may incur model charges/u)).toBeInTheDocument()
    const prompt = screen.getByRole("textbox", { name: "Output description or example" })
    await userEvent.type(prompt, "Return an approval decision.")
    await userEvent.click(screen.getByRole("button", { name: "Generate proposal" }))
    const proposal = await screen.findByRole("textbox", { name: "Schema proposal" })
    expect(generate.hits).toBe(1)
    expect((proposal as HTMLTextAreaElement).value).toContain('"decision"')

    const savesBeforeApply = save.hits
    await userEvent.click(screen.getByRole("button", { name: "Use schema" }))
    await waitFor(() => expect(save.hits).toBeGreaterThan(savesBeforeApply), { timeout: 2500 })
    expect(save.spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              config: expect.objectContaining({
                outputSchema: {
                  type: "object",
                  properties: { decision: { type: "string" } },
                  required: ["decision"],
                  additionalProperties: false
                }
              })
            })
          ])
        })
      })
    )
  }, 30_000)

  it("authors structured judgments only from structured-output models", async () => {
    registerEditorApis(draft(1, null))
    ApiMock.get("/api/workflows/models", { data: modelCatalog })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Structured judgment/u)
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
    ApiMock.get("/api/integrations/provider-events", { data: providerEvents })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/GitHub event/u)
    const eventPicker = await screen.findByRole("combobox", { name: "Event" })
    expect(eventPicker).toHaveTextContent("Pull request created")
    await userEvent.click(eventPicker)
    expect(screen.getByRole("option", { name: "Issue created" })).toBeInTheDocument()
    await waitFor(() =>
      expect(save.spy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            steps: expect.arrayContaining([
              expect.objectContaining({
                definition: { kind: "provider_event", version: 1 },
                config: expect.objectContaining({ provider: "github", eventKey: "pull_request.created" })
              })
            ])
          })
        })
      )
    )
    expect(
      within(screen.getByRole("complementary", { name: "Workflow details" })).getByText(
        "Starts the workflow from a GitHub event."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Repository" })).not.toBeInTheDocument()

    await addStep(/^Schedule/u)
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

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Provider data/u)
    await screen.findByRole("combobox", { name: "Operation" })
    expect(screen.queryByRole("textbox", { name: "Repository" })).not.toBeInTheDocument()
    await waitFor(() => expect(save.hits).toBeGreaterThan(0), { timeout: 2500 })
    const providerDataSave = save.spy.mock.calls.at(-1)?.[0] as { content: WorkflowDraftContent }
    const providerDataStep = providerDataSave.content.steps.find(
      ({ definition }) => definition.kind === "provider_data"
    )
    expect(providerDataStep).toBeDefined()
    expect(providerDataStep!.config.binding).toEqual(providerDataSave.content.resourceBindings.repository)
    expect(providerDataSave.content.resourceBindings[providerDataStep!.id]).toBeUndefined()

    await addStep(/Provider action/u)
    await screen.findByRole("combobox", { name: "Operation" })
    expect(screen.queryByRole("textbox", { name: "Repository" })).not.toBeInTheDocument()
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
    ApiMock.get("/api/integrations/provider-events", { data: providerEvents })
    ApiMock.get("/api/workflows/provider-operations", { data: providerOperations })
    ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2, null) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Linear event/u)
    expect(await screen.findByRole("combobox", { name: "Event" })).toHaveTextContent("Issue created")
    expect(
      within(screen.getByRole("complementary", { name: "Workflow details" })).getByText(
        "Starts the workflow from a Linear event."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole("combobox", { name: "Team" }))
    await userEvent.click(screen.getByRole("option", { name: "Agency Engineering" }))

    await addStep(/Provider data/u)
    await userEvent.click(await screen.findByRole("combobox", { name: "Provider" }))
    await userEvent.click(screen.getByRole("option", { name: "Linear" }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Team" }))
    await userEvent.click(screen.getByRole("option", { name: "Agency Engineering" }))
    expect(screen.getByRole("combobox", { name: "Operation" })).toHaveTextContent("Task")

    await addStep(/Provider action/u)
    await userEvent.click(await screen.findByRole("combobox", { name: "Provider" }))
    await userEvent.click(screen.getByRole("option", { name: "Linear" }))
    await userEvent.click(await screen.findByRole("combobox", { name: "Team" }))
    await userEvent.click(screen.getByRole("option", { name: "Agency Engineering" }))
    expect(screen.getByRole("combobox", { name: "Operation" })).toHaveTextContent("Add task comment")
  })

  it("disables integration events until that provider is connected", async () => {
    registerEditorApis(draft(1, null), {
      ...integrationSettings,
      connections: integrationConnections.filter(({ provider }) => provider === "linear")
    })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    const githubEvent = screen.getByRole("button", { name: /GitHub event/u })
    expect(githubEvent).toHaveAttribute("aria-disabled", "true")
    const prerequisite = screen.getByLabelText("GitHub event. Connect GitHub in Integrations before adding this event.")
    prerequisite.focus()
    expect(await screen.findByText("Connect GitHub in Integrations before adding this event.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Linear event/u })).toBeEnabled()
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

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/Provider data/u)
    expect(await screen.findByText("No connected provider resources are available.")).toBeInTheDocument()

    await addStep(/Provider action/u)
    expect(await screen.findByText("Provider inventory unavailable")).toBeInTheDocument()
  })

  it("authors and persists condition and exclusive-merge boundaries", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^Exclusive merge/u)
    await addStep(/^Condition/u)
    fireEvent.change(screen.getByRole("textbox", { name: "Expression path" }), { target: { value: "score" } })
    await userEvent.click(screen.getByRole("combobox", { name: "Operator" }))
    await userEvent.click(screen.getByRole("option", { name: "greater than or equal" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Comparison value" }), { target: { value: "80" } })
    await userEvent.click(screen.getByRole("combobox", { name: "Merge step" }))
    await userEvent.click(screen.getByRole("option", { name: "Exclusive merge" }))

    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) =>
            (body as { content: WorkflowDraftContent }).content.steps.some(
              ({ definition, config }) =>
                definition.kind === "condition" &&
                (config.expression as { operator?: string } | undefined)?.operator === "greater_than_or_equal"
            )
          )
        ).toBe(true),
      { timeout: 2500 }
    )
    const saved = save.spy.mock.lastCall?.[0] as { content: WorkflowDraftContent }
    expect(saved.content.steps.find(({ definition }) => definition.kind === "condition")?.config).toMatchObject({
      expression: { path: ["score"], operator: "greater_than_or_equal", value: 80 }
    })
  }, 15_000)

  it("authors and persists for-each and join runtime bounds", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^Join/u)
    await userEvent.click(screen.getByRole("combobox", { name: "Join policy" }))
    await userEvent.click(screen.getByRole("option", { name: "Quorum" }))
    const quorum = screen.getByRole("spinbutton", { name: "Quorum" })
    fireEvent.change(quorum, { target: { value: "2" } })

    await addStep(/^For each/u)
    const concurrency = screen.getByRole("spinbutton", { name: "Concurrency" })
    fireEvent.change(concurrency, { target: { value: "3" } })
    await userEvent.click(screen.getByRole("combobox", { name: "Join step" }))
    await userEvent.click(screen.getByRole("option", { name: "Join" }))

    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) => {
            const steps = (body as { content: WorkflowDraftContent }).content.steps
            return steps.some(({ definition, config }) => definition.kind === "for_each" && config.concurrency === 3)
          })
        ).toBe(true),
      { timeout: 2500 }
    )
    const saved = save.spy.mock.lastCall?.[0] as { content: WorkflowDraftContent }
    expect(saved.content.steps.find(({ definition }) => definition.kind === "join")?.config).toEqual({
      policy: "quorum",
      quorum: 2
    })
    expect(saved.content.steps.find(({ definition }) => definition.kind === "for_each")?.config).toMatchObject({
      concurrency: 3
    })
  }, 15_000)

  it("authors and persists bounded-loop runtime limits", async () => {
    registerEditorApis()
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^Bounded loop/u)
    const maximumActivations = screen.getByRole("spinbutton", { name: "Maximum activations" })
    fireEvent.change(maximumActivations, { target: { value: "25" } })
    await userEvent.click(screen.getByRole("combobox", { name: "On exhaustion" }))
    await userEvent.click(screen.getByRole("option", { name: "Route Exhausted" }))

    await waitFor(
      () =>
        expect(
          save.spy.mock.calls.some(([body]) =>
            (body as { content: WorkflowDraftContent }).content.steps.some(
              ({ definition, config }) =>
                definition.kind === "bounded_loop" &&
                config.maximumActivations === 25 &&
                config.onExhaustion === "route"
            )
          )
        ).toBe(true),
      { timeout: 2500 }
    )
    const saved = save.spy.mock.lastCall?.[0] as { content: WorkflowDraftContent }
    expect(saved.content.steps.find(({ definition }) => definition.kind === "bounded_loop")?.config).toMatchObject({
      maximumActivations: 25,
      onExhaustion: "route"
    })
  }, 15_000)

  it("authors and persists provider wait, delay, and pinned child workflow contracts", async () => {
    registerEditorApis()
    ApiMock.get("/api/integrations/resources", { data: repositoryInventory })
    ApiMock.get("/api/integrations/provider-events", { data: providerEvents })
    const save = ApiMock.patch(`/api/workflows/${workflowId}/draft`, { data: draft(2) })
    render(<WorkflowEditorPage />)

    await screen.findByRole("complementary", { name: "Step library" })
    await addStep(/^Wait event \(GitHub\)/u)
    fireEvent.change(screen.getByRole("textbox", { name: "Object ID from input" }), {
      target: { value: "pullRequest.id" }
    })
    fireEvent.change(screen.getByRole("spinbutton", { name: "Wait up to" }), { target: { value: "2" } })

    await addStep(/^Delay/u)
    fireEvent.change(screen.getByRole("spinbutton", { name: "Duration" }), { target: { value: "15" } })

    await addStep(/^Invoke workflow/u)
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
    expect(saved.content.steps.find(({ definition }) => definition.kind === "wait_event_github")?.config).toMatchObject(
      {
        objectIdPath: ["pullRequest", "id"],
        expiresAfterSeconds: 7200
      }
    )
    expect(saved.content.steps.find(({ definition }) => definition.kind === "delay")?.config).toEqual({
      duration: 15,
      unit: "minutes"
    })
    expect(saved.content.steps.find(({ definition }) => definition.kind === "child_workflow")?.config).toEqual({
      packageDigest: "e".repeat(64),
      interfaceDigest: "f".repeat(64),
      timeoutSeconds: 86400,
      maximumDepth: 5
    })
  }, 15_000)
})
