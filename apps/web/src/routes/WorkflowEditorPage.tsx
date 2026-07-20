import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  mergeClasses,
  Menu,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  SearchBox,
  Spinner,
  Tab,
  TabList,
  Textarea,
  Title3,
  tokens
} from "@fluentui/react-components"
import {
  AddFilled,
  AddRegular,
  ArrowLeftRegular,
  BeakerRegular,
  CheckmarkCircleRegular,
  ChevronRightRegular,
  CloudArrowUpRegular,
  CodeRegular,
  DataUsageRegular,
  DeleteRegular,
  DismissCircleRegular,
  PlayRegular,
  SaveRegular,
  SearchRegular,
  SettingsRegular,
  StopRegular,
  bundleIcon
} from "@fluentui/react-icons"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useEffect, useRef, useState } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  discoverRepositoryAgents,
  getIntegrationResourceInventory,
  getWorkflowDraft,
  listWorkflowStepDefinitions,
  listWorkflowModels,
  listProviderOperations,
  parseRepositoryAgentReference,
  publishWorkflow,
  startWorkflowRun,
  testWorkflowDraft,
  updateWorkflowDraft,
  validateWorkflow,
  type WorkflowDraftContent,
  type WorkflowDraftView,
  type JsonValue,
  type IntegrationResourceInventory,
  type RepositoryAgentReference,
  type WorkflowModelSnapshot,
  type ProviderOperation,
  type WorkflowSimulation,
  type WorkflowStep,
  type WorkflowStepDefinition,
  type WorkflowValidation
} from "@/services/api"

type CanvasNode = Node<{ step: WorkflowStep; definition: WorkflowStepDefinition }, "workflow">
type WorkflowConnection = WorkflowDraftContent["connections"][number]
type CanvasEdge = Edge<Pick<WorkflowConnection, "mappings" | "branchKey" | "loopBack">>
type SaveState = "loading" | "dirty" | "saving" | "saved" | "error"
type EditorView = "canvas" | "outline"

const AddIcon = bundleIcon(AddFilled, AddRegular)

function initialStepConfig(kind: string): Record<string, JsonValue> {
  if (kind === "set_fields") {
    return { fields: {} }
  }
  if (kind === "map_fields") {
    return { mappings: {} }
  }
  if (kind === "validate") {
    return { schema: { type: "object" } }
  }
  if (kind === "failure") {
    return { code: "workflow_failed", message: "Workflow failed" }
  }
  if (kind === "compose_markdown") {
    return { template: "# Report\n\n{{summary}}" }
  }
  if (kind === "collect") {
    return { mode: "array", maximumItems: 100 }
  }
  if (kind === "repository_data") {
    return { operation: "metadata", repository: { owner: "", name: "", ref: "main" } }
  }
  if (kind === "repository_agent") {
    return {}
  }
  if (kind === "ai_model") {
    return {
      modelId: "",
      messages: [
        { role: "system", content: "You are a careful workflow assistant." },
        { role: "user", content: "Use this workflow context: {{context}}" }
      ],
      outputMode: "text",
      parameters: { temperature: 0.2, max_tokens: 2_000 }
    }
  }
  if (kind === "structured_judgment") {
    return {
      modelId: "",
      criteria: "Evaluate the evidence against the stated requirements.",
      outputSchema: { type: "object", additionalProperties: false, properties: {}, required: [] }
    }
  }
  if (kind === "provider_event") {
    return { provider: "github", eventKey: "pull_request.created" }
  }
  if (kind === "schedule") {
    return { timezone: "UTC", intervalSeconds: 300 }
  }
  if (kind === "provider_data") {
    return { provider: "github", operation: "github.repository" }
  }
  if (kind === "provider_action") {
    return { provider: "github", operation: "github.add_pull_request_comment" }
  }
  if (kind === "condition") {
    return { expression: { path: [], operator: "truthy" }, joinStepId: "" }
  }
  if (kind === "switch") {
    return { cases: [{ key: "case", when: { path: [], operator: "truthy" } }], defaultKey: "default", joinStepId: "" }
  }
  if (kind === "exclusive_merge") {
    return {}
  }
  if (kind === "for_each") {
    return { maximumItems: 100, concurrency: 4, bodyStepId: "", joinStepId: "" }
  }
  if (kind === "join") {
    return { policy: "all" }
  }
  if (kind === "bounded_loop") {
    return {
      maximumIterations: 10,
      maximumActivations: 100,
      condition: { path: [], operator: "truthy" },
      bodyStepId: "",
      exitStepId: "",
      onExhaustion: "fail"
    }
  }
  if (kind === "wait") {
    return { correlation: "event:{{id}}", expiresAfterSeconds: 3600, eventSchema: { type: "object" } }
  }
  if (kind === "child_workflow") {
    return { packageDigest: "", interfaceDigest: "" }
  }
  return {}
}

function repositoryScopedConfig(
  kind: string,
  config: Record<string, JsonValue>,
  repository: WorkflowDraftContent["resourceBindings"][string] | undefined
): Record<string, JsonValue> {
  if (repository === undefined) {
    return config
  }
  if (kind === "repository_data") {
    return { ...config, repository: { ...repositoryParts(repository.name), ref: "main" } }
  }
  if (kind === "provider_event" || kind === "provider_data" || kind === "provider_action") {
    return { ...config, binding: repository }
  }
  return config
}

function categoryLabel(category: WorkflowStepDefinition["category"]) {
  if (category === "ai") {
    return "AI"
  }
  if (category === "terminal") {
    return "Outcomes"
  }
  return `${category[0]?.toUpperCase() ?? ""}${category.slice(1)}`
}

const useStyles = makeStyles({
  page: {
    height: "100vh",
    minHeight: "680px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    "@media (max-width: 800px)": { height: "auto", minHeight: "calc(100vh - 52px)", overflow: "visible" }
  },
  toolbar: {
    minHeight: "96px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) max-content",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 1000px)": { gridTemplateColumns: "1fr", minHeight: "148px" }
  },
  identity: {
    display: "grid",
    gridTemplateColumns: "32px minmax(160px, 280px) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    minWidth: 0
  },
  nameInput: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  actions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  viewBar: {
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `0 ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2
  },
  workspace: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)" },
  workspaceDock: {
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    "@media (max-width: 800px)": { gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "520px auto" }
  },
  surface: {
    position: "relative",
    minWidth: 0,
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground3,
    "@media (max-width: 800px)": { minHeight: "520px" }
  },
  surfaceHidden: { display: "none" },
  inspector: {
    padding: tokens.spacingHorizontalL,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    "@media (max-width: 800px)": {
      borderLeft: 0,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      maxHeight: "none"
    }
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalS
  },
  fields: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  hint: { color: tokens.colorNeutralForeground3 },
  issue: {
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1
  },
  node: {
    width: "220px",
    minHeight: "78px",
    overflow: "visible"
  },
  nodeSelected: { outline: `2px solid ${tokens.colorBrandStroke1}`, boxShadow: tokens.shadow8 },
  nodeHeader: { minWidth: 0 },
  nodeIcon: { fontSize: "20px", color: tokens.colorBrandForeground1 },
  nodeCopy: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  nodeKind: { color: tokens.colorNeutralForeground3, textTransform: "uppercase" },
  fab: { position: "absolute", right: tokens.spacingHorizontalXL, bottom: tokens.spacingVerticalXL, zIndex: 5 },
  catalog: { width: "360px", maxHeight: "520px", overflowY: "auto", padding: tokens.spacingHorizontalS },
  catalogSearch: { marginBottom: tokens.spacingVerticalS },
  catalogItem: {
    height: "auto",
    alignItems: "flex-start",
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS
  },
  issueList: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  issueButton: { width: "100%", justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" },
  outline: {
    overflowY: "auto",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
    backgroundColor: tokens.colorNeutralBackground1
  },
  outlineList: {
    maxWidth: "840px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS
  },
  outlineStep: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "40px minmax(0, 1fr) max-content",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    textAlign: "left",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover }
  },
  outlineIndex: { color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums" },
  simulation: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  simulationStep: {
    display: "flex",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  }
})

function categoryIcon(category: WorkflowStepDefinition["category"]) {
  if (category === "trigger") {
    return <PlayRegular />
  }
  if (category === "data") {
    return <DataUsageRegular />
  }
  if (category === "terminal") {
    return <StopRegular />
  }
  return <CodeRegular />
}

function WorkflowCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const styles = useStyles()
  return (
    <Card appearance="filled" className={mergeClasses(styles.node, selected && styles.nodeSelected)} size="small">
      {data.definition.inputs.map((input, index) => (
        <Handle
          key={input.name}
          id={input.name}
          type="target"
          position={Position.Left}
          style={{ top: `${((index + 1) / (data.definition.inputs.length + 1)) * 100}%` }}
        />
      ))}
      <CardHeader
        className={styles.nodeHeader}
        image={<span className={styles.nodeIcon}>{categoryIcon(data.definition.category)}</span>}
        header={<Body1>{data.step.label}</Body1>}
        description={
          <span className={styles.nodeCopy}>
            <Caption1 className={styles.nodeKind}>{data.definition.category}</Caption1>
            <Caption1 className={styles.hint}>{data.definition.description}</Caption1>
          </span>
        }
      />
      {data.definition.outputs.map((output, index) => (
        <Handle
          key={output.name}
          id={output.name}
          type="source"
          position={Position.Right}
          style={{ top: `${((index + 1) / (data.definition.outputs.length + 1)) * 100}%` }}
        />
      ))}
    </Card>
  )
}

const nodeTypes = { workflow: WorkflowCanvasNode }

function toCanvasNodes(steps: WorkflowStep[], definitions: WorkflowStepDefinition[]): CanvasNode[] {
  return steps.flatMap((step) => {
    const definition = definitions.find(
      (candidate) => candidate.kind === step.definition.kind && candidate.version === step.definition.version
    )
    return definition === undefined
      ? []
      : [{ id: step.id, type: "workflow" as const, position: step.position, data: { step, definition } }]
  })
}

function toCanvasEdges(content: WorkflowDraftContent): CanvasEdge[] {
  return content.connections.map((connection) => ({
    id: connection.id,
    source: connection.source.stepId,
    sourceHandle: connection.source.port,
    target: connection.target.stepId,
    targetHandle: connection.target.port,
    label: connection.outcome === "failure" ? "Failure" : undefined,
    data: {
      mappings: connection.mappings,
      ...(connection.branchKey === undefined ? {} : { branchKey: connection.branchKey }),
      ...(connection.loopBack === undefined ? {} : { loopBack: connection.loopBack })
    }
  }))
}

function toContent(base: WorkflowDraftContent, nodes: CanvasNode[], edges: CanvasEdge[]): WorkflowDraftContent {
  const steps = nodes.map((node) => ({ ...node.data.step, position: node.position }))
  const connections = edges.flatMap((edge) => {
    const source = nodes.find((node) => node.id === edge.source)
    const target = nodes.find((node) => node.id === edge.target)
    const sourcePort = edge.sourceHandle ?? source?.data.definition.outputs[0]?.name
    const targetPort = edge.targetHandle ?? target?.data.definition.inputs[0]?.name
    if (sourcePort === undefined || targetPort === undefined) {
      return []
    }
    return [
      {
        id: edge.id,
        source: { stepId: edge.source, port: sourcePort },
        target: { stepId: edge.target, port: targetPort },
        outcome: edge.label === "Failure" ? ("failure" as const) : ("success" as const),
        mappings: edge.data?.mappings ?? [{ sourcePath: [], targetPath: [] }],
        ...(edge.data?.branchKey === undefined ? {} : { branchKey: edge.data.branchKey }),
        ...(edge.data?.loopBack === undefined ? {} : { loopBack: edge.data.loopBack })
      }
    ]
  })
  return { ...base, steps, connections }
}

function serializedDraft(name: string, description: string, content: WorkflowDraftContent): string {
  return JSON.stringify({ name, description, content })
}

function saveStateLabel(saveState: SaveState) {
  if (saveState === "saving") {
    return "Saving"
  }
  if (saveState === "dirty") {
    return "Unsaved"
  }
  return saveState
}

function uniqueStepId(kind: string) {
  return `${kind.replaceAll("_", "-")}-${crypto.randomUUID()}`
}

export function WorkflowEditorPage() {
  const styles = useStyles()
  const { workflowId } = useParams({ from: "/workflows/$workflowId" })
  const navigate = useNavigate()
  const dispatchToast = useAppToast()
  const [draft, setDraft] = useState<WorkflowDraftView>()
  const [definitions, setDefinitions] = useState<WorkflowStepDefinition[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [baseContent, setBaseContent] = useState<WorkflowDraftContent>()
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [dockOpen, setDockOpen] = useState(false)
  const [view, setView] = useState<EditorView>(() =>
    window.matchMedia("(max-width: 800px)").matches ? "outline" : "canvas"
  )
  const [saveState, setSaveState] = useState<SaveState>("loading")
  const [validation, setValidation] = useState<WorkflowValidation>()
  const [catalogQuery, setCatalogQuery] = useState("")
  const [testInput, setTestInput] = useState("{}")
  const [simulation, setSimulation] = useState<WorkflowSimulation>()
  const revisionRef = useRef(1)
  const lastSavedRef = useRef("")
  const initializedRef = useRef(false)
  const inspectorRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let active = true
    void Promise.all([getWorkflowDraft(workflowId), listWorkflowStepDefinitions()])
      .then(([loadedDraft, loadedDefinitions]) => {
        if (!active) {
          return
        }
        const canvasNodes = toCanvasNodes(loadedDraft.content.steps, loadedDefinitions)
        const canvasEdges = toCanvasEdges(loadedDraft.content)
        setDraft(loadedDraft)
        setDefinitions(loadedDefinitions)
        setName(loadedDraft.name)
        setDescription(loadedDraft.description)
        setBaseContent(loadedDraft.content)
        setNodes(canvasNodes)
        setEdges(canvasEdges)
        revisionRef.current = loadedDraft.draftRevision
        lastSavedRef.current = serializedDraft(
          loadedDraft.name,
          loadedDraft.description,
          toContent(loadedDraft.content, canvasNodes, canvasEdges)
        )
        initializedRef.current = true
        setSaveState("saved")
      })
      .catch((error: unknown) => {
        showAppToast(dispatchToast, {
          intent: "error",
          title: "Workflow unavailable",
          body: error instanceof Error ? error.message : "The workflow could not be loaded."
        })
        setSaveState("error")
      })
    return () => {
      active = false
    }
  }, [dispatchToast, setEdges, setNodes, workflowId])

  useEffect(() => {
    if (!initializedRef.current || saveState === "saving" || baseContent === undefined) {
      return
    }
    const content = toContent(baseContent, nodes, edges)
    const snapshot = serializedDraft(name, description, content)
    if (snapshot === lastSavedRef.current) {
      return
    }
    const timer = window.setTimeout(() => {
      setSaveState("saving")
      void updateWorkflowDraft(workflowId, revisionRef.current, name, description, content)
        .then((saved) => {
          revisionRef.current = saved.draftRevision
          lastSavedRef.current = snapshot
          setDraft(saved)
          setBaseContent(saved.content)
          setSaveState("saved")
        })
        .catch((error: unknown) => {
          showAppToast(dispatchToast, {
            intent: "error",
            id: `workflow-save-${workflowId}`,
            title: "Autosave failed",
            body: error instanceof Error ? error.message : "Changes could not be saved."
          })
          setSaveState("error")
        })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [baseContent, description, dispatchToast, edges, name, nodes, saveState, workflowId])

  useEffect(() => {
    if (dockOpen && (selectedNodeId !== undefined || selectedEdgeId !== undefined)) {
      inspectorRef.current?.focus()
    }
  }, [dockOpen, selectedEdgeId, selectedNodeId])

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  let detailsTitle = "Workflow details"
  if (selectedEdge !== undefined) {
    detailsTitle = "Connection details"
  }
  if (selectedNode !== undefined) {
    detailsTitle = selectedNode.data.step.label
  }
  const filteredDefinitions = definitions.filter((definition) =>
    `${definition.label} ${definition.description} ${definition.category}`
      .toLowerCase()
      .includes(catalogQuery.toLowerCase())
  )

  function changeStep(step: WorkflowStep, resourceBinding?: WorkflowDraftContent["resourceBindings"][string] | null) {
    setNodes((current) =>
      current.map((node) => (node.id === step.id ? { ...node, data: { ...node.data, step } } : node))
    )
    if (resourceBinding !== undefined) {
      setBaseContent((current) => {
        if (current === undefined) {
          return current
        }
        const resourceBindings = { ...current.resourceBindings }
        if (resourceBinding === null) {
          delete resourceBindings[step.id]
        } else {
          resourceBindings[step.id] = resourceBinding
        }
        return { ...current, resourceBindings }
      })
    }
    setSaveState("dirty")
  }

  function addStep(definition: WorkflowStepDefinition) {
    const id = uniqueStepId(definition.kind)
    const step: WorkflowStep = {
      id,
      label: definition.label,
      position: { x: 80 + nodes.length * 44, y: 80 + nodes.length * 36 },
      definition: { kind: definition.kind, version: definition.version },
      config: repositoryScopedConfig(
        definition.kind,
        initialStepConfig(definition.kind),
        baseContent?.resourceBindings.repository
      ),
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    }
    setNodes((current) => [...current, { id, type: "workflow", position: step.position, data: { step, definition } }])
    setSelectedNodeId(id)
    setSelectedEdgeId(undefined)
    setDockOpen(true)
    setSaveState("dirty")
  }

  function connect(connection: Connection) {
    const source = nodes.find((node) => node.id === connection.source)
    const target = nodes.find((node) => node.id === connection.target)
    const sourceHandle = connection.sourceHandle ?? source?.data.definition.outputs[0]?.name
    const targetHandle = connection.targetHandle ?? target?.data.definition.inputs[0]?.name
    if (sourceHandle === undefined || targetHandle === undefined) {
      return
    }
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          sourceHandle,
          targetHandle,
          id: `connection-${crypto.randomUUID()}`,
          data: { mappings: [{ sourcePath: [], targetPath: [] }] }
        },
        current
      )
    )
    setSaveState("dirty")
  }

  function reconnect(edge: CanvasEdge, connection: Connection) {
    const source = nodes.find((node) => node.id === connection.source)
    const target = nodes.find((node) => node.id === connection.target)
    const sourceHandle = connection.sourceHandle ?? source?.data.definition.outputs[0]?.name
    const targetHandle = connection.targetHandle ?? target?.data.definition.inputs[0]?.name
    if (
      connection.source === null ||
      connection.target === null ||
      sourceHandle === undefined ||
      targetHandle === undefined
    ) {
      return
    }
    const sourceId = connection.source
    const targetId = connection.target
    setEdges((current) =>
      current.map((candidate) =>
        candidate.id === edge.id
          ? {
              ...candidate,
              source: sourceId,
              sourceHandle,
              target: targetId,
              targetHandle
            }
          : candidate
      )
    )
    setSaveState("dirty")
  }

  function focusIssue(issue: WorkflowValidation["issues"][number]) {
    setDockOpen(true)
    if (issue.nodeId !== null) {
      setSelectedNodeId(issue.nodeId)
      setSelectedEdgeId(undefined)
      return
    }
    if (issue.connectionId !== null) {
      setSelectedNodeId(undefined)
      setSelectedEdgeId(issue.connectionId)
    }
  }

  async function check() {
    try {
      const result = await validateWorkflow(workflowId)
      setValidation(result)
      if (!result.valid) {
        setDockOpen(true)
      }
      showAppToast(
        dispatchToast,
        result.valid
          ? { intent: "success", title: "Ready to publish", body: "Validation found no issues." }
          : { intent: "warning", title: "Fix workflow issues", body: "Open the details pane to review each issue." }
      )
      return result
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Validation failed",
        body: error instanceof Error ? error.message : "Validation could not run."
      })
      return null
    }
  }

  async function publish() {
    const result = await check()
    if (result === null || !result.valid) {
      return
    }
    try {
      const published = await publishWorkflow(workflowId)
      setDraft(published)
      showAppToast(dispatchToast, {
        intent: "success",
        title: `Published version ${published.publishedVersion}`,
        body: "New runs now use this immutable version."
      })
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Publish failed",
        body: error instanceof Error ? error.message : "The workflow could not be published."
      })
    }
  }

  function parsedTestInput(): JsonValue {
    try {
      return JSON.parse(testInput) as JsonValue
    } catch {
      throw new Error("Test input must be valid JSON")
    }
  }

  async function test(stopAtStepId?: string) {
    try {
      const result = await testWorkflowDraft(workflowId, { input: parsedTestInput(), stopAtStepId })
      setSimulation(result)
      setDockOpen(true)
      showAppToast(dispatchToast, {
        intent: result.steps.some(({ status }) => status === "failed") ? "warning" : "success",
        title: stopAtStepId === undefined ? "Draft test complete" : "Path test complete",
        body: `${result.steps.length} simulated step${result.steps.length === 1 ? "" : "s"}.`
      })
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Test failed",
        body: error instanceof Error ? error.message : "The workflow test failed."
      })
    }
  }

  async function run() {
    try {
      const started = await startWorkflowRun(
        workflowId,
        { type: "manual", key: crypto.randomUUID() },
        parsedTestInput()
      )
      await navigate({ to: "/runs/$runId", params: { runId: started.runId } })
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Run failed",
        body: error instanceof Error ? error.message : "The workflow run could not be created."
      })
    }
  }

  if (draft === undefined || baseContent === undefined) {
    return (
      <div className={styles.page}>
        <Spinner label="Loading workflow editor" />
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            aria-label="Back to workflows"
            onClick={() => void navigate({ to: "/workflows" })}
          />
          <Input
            className={styles.nameInput}
            value={name}
            aria-label="Workflow name"
            onChange={(_, data) => {
              setName(data.value)
              setSaveState("dirty")
            }}
          />
          <Input
            value={description}
            aria-label="Workflow description"
            placeholder="Workflow description"
            onChange={(_, data) => {
              setDescription(data.value)
              setSaveState("dirty")
            }}
          />
        </div>
        <div className={styles.actions}>
          <Badge
            appearance="tint"
            color={saveState === "error" ? "danger" : "informative"}
            icon={saveState === "saved" ? <CheckmarkCircleRegular /> : <SaveRegular />}
          >
            {saveStateLabel(saveState)}
          </Badge>
          {draft.publishedVersion !== null && (
            <Badge appearance="tint" color="success">
              Version {draft.publishedVersion}
            </Badge>
          )}
          <Button icon={<BeakerRegular />} disabled={saveState !== "saved"} onClick={() => void test()}>
            Test draft
          </Button>
          <Button onClick={() => void check()}>Validate</Button>
          <Button icon={<CloudArrowUpRegular />} disabled={saveState !== "saved"} onClick={() => void publish()}>
            Publish
          </Button>
          <Button
            appearance="primary"
            icon={<PlayRegular />}
            disabled={draft.publishedVersion === null}
            onClick={() => void run()}
          >
            Run
          </Button>
        </div>
      </header>
      <div className={styles.viewBar}>
        <TabList selectedValue={view} onTabSelect={(_, data) => setView(data.value as EditorView)}>
          <Tab value="canvas">Canvas</Tab>
          <Tab value="outline">Outline</Tab>
        </TabList>
        <Button
          appearance="subtle"
          icon={dockOpen ? <ChevronRightRegular /> : <SettingsRegular />}
          onClick={() => setDockOpen((value) => !value)}
        >
          {dockOpen ? "Close details" : "Open details"}
        </Button>
      </div>
      <section className={`${styles.workspace} ${dockOpen ? styles.workspaceDock : ""}`}>
        <div className={`${styles.surface} ${view !== "canvas" ? styles.surfaceHidden : ""}`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              onNodesChange(changes)
              if (
                changes.some(
                  (change) => change.type === "remove" || (change.type === "position" && change.dragging === true)
                )
              ) {
                setSaveState("dirty")
              }
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes)
              if (changes.some((change) => change.type === "remove")) {
                setSaveState("dirty")
              }
            }}
            onConnect={connect}
            onReconnect={reconnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id)
              setSelectedEdgeId(undefined)
              setDockOpen(true)
            }}
            onEdgeClick={(_, edge) => {
              setSelectedNodeId(undefined)
              setSelectedEdgeId(edge.id)
              setDockOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return
              }
              const edge = (event.target as Element).closest('[aria-roledescription="edge"]')
              const edgeId = edge?.getAttribute("data-id")
              if (edgeId === null || edgeId === undefined) {
                return
              }
              event.preventDefault()
              setSelectedNodeId(undefined)
              setSelectedEdgeId(edgeId)
              setDockOpen(true)
            }}
            onPaneClick={() => {
              setSelectedNodeId(undefined)
              setSelectedEdgeId(undefined)
            }}
            fitView
            minZoom={0.4}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls />
          </ReactFlow>
          <StepCatalog
            definitions={filteredDefinitions}
            query={catalogQuery}
            setQuery={setCatalogQuery}
            addStep={addStep}
            buttonClassName={styles.fab}
            catalogClassName={styles.catalog}
            searchClassName={styles.catalogSearch}
          />
        </div>
        <div className={`${styles.outline} ${view !== "outline" ? styles.surfaceHidden : ""}`}>
          <div className={styles.outlineList}>
            {nodes.map((node, index) => (
              <button
                key={node.id}
                type="button"
                className={styles.outlineStep}
                onClick={() => {
                  setSelectedNodeId(node.id)
                  setDockOpen(true)
                }}
              >
                <span className={styles.outlineIndex}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.nodeCopy}>
                  <Body1>{node.data.step.label}</Body1>
                  <Caption1 className={styles.hint}>{node.data.definition.description}</Caption1>
                </span>
                <Badge appearance="outline">{node.data.definition.category}</Badge>
              </button>
            ))}
            <StepCatalog
              definitions={filteredDefinitions}
              query={catalogQuery}
              setQuery={setCatalogQuery}
              addStep={addStep}
              catalogClassName={styles.catalog}
              searchClassName={styles.catalogSearch}
            />
          </div>
        </div>
        {dockOpen && (
          <aside ref={inspectorRef} className={styles.inspector} tabIndex={-1} aria-label="Workflow details">
            <div className={styles.inspectorHeader}>
              <Title3>{detailsTitle}</Title3>
              <Button
                appearance="subtle"
                icon={<ChevronRightRegular />}
                aria-label="Close details"
                onClick={() => setDockOpen(false)}
              />
            </div>
            {selectedEdge !== undefined && (
              <SelectedConnectionInspector
                edge={selectedEdge}
                nodes={nodes}
                changeEdge={(edge) => {
                  setEdges((current) =>
                    current.map((candidate) => {
                      if (candidate.id === edge.id) {
                        return edge
                      }
                      return candidate
                    })
                  )
                  setSaveState("dirty")
                }}
                remove={() => {
                  setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id))
                  setSelectedEdgeId(undefined)
                  setSaveState("dirty")
                }}
              />
            )}
            {selectedEdge === undefined && selectedNode === undefined && (
              <div className={styles.fields}>
                <Field label="Test input">
                  <Textarea resize="vertical" value={testInput} onChange={(_, data) => setTestInput(data.value)} />
                </Field>
                <Body1>Draft revision {draft.draftRevision}</Body1>
                {draft.versions.map((version) => (
                  <Badge key={version.version} appearance="outline">
                    Version {version.version}
                  </Badge>
                ))}
              </div>
            )}
            {selectedEdge === undefined && selectedNode !== undefined && (
              <StepInspector
                node={selectedNode}
                nodes={nodes}
                edges={edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)}
                changeStep={changeStep}
                repository={baseContent.resourceBindings.repository}
                changeEdge={(edge) => {
                  setEdges((current) => current.map((candidate) => (candidate.id === edge.id ? edge : candidate)))
                  setSaveState("dirty")
                }}
                runToHere={() => void test(selectedNode.id)}
                remove={() => {
                  setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
                  setEdges((current) =>
                    current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
                  )
                  setBaseContent((current) => {
                    if (current === undefined) {
                      return current
                    }
                    const resourceBindings = { ...current.resourceBindings }
                    delete resourceBindings[selectedNode.id]
                    return { ...current, resourceBindings }
                  })
                  setSelectedNodeId(undefined)
                  setSaveState("dirty")
                }}
              />
            )}
            {validation !== undefined && !validation.valid && (
              <section className={styles.issueList} aria-labelledby="validation-issues-title">
                <Title3 id="validation-issues-title">Fix workflow issues</Title3>
                {validation.issues.map((issue) => (
                  <Button
                    key={`${issue.code}-${issue.nodeId ?? issue.connectionId ?? "workflow"}`}
                    className={styles.issueButton}
                    appearance="subtle"
                    onClick={() => focusIssue(issue)}
                  >
                    {issue.message}
                  </Button>
                ))}
              </section>
            )}
            {simulation !== undefined && (
              <div className={styles.simulation}>
                <Title3>Simulated result</Title3>
                <Caption1 className={styles.hint}>
                  Draft revision {simulation.draftRevision}, completed in {simulation.elapsedMs} ms
                </Caption1>
                {simulation.steps.map((step) => (
                  <div key={step.stepId} className={styles.simulationStep}>
                    <Body1>{nodes.find((node) => node.id === step.stepId)?.data.step.label ?? step.stepId}</Body1>
                    {step.status === "succeeded" ? (
                      <CheckmarkCircleRegular color={tokens.colorPaletteGreenForeground1} />
                    ) : (
                      <DismissCircleRegular color={tokens.colorPaletteRedForeground1} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </section>
    </main>
  )
}

function StepCatalog({
  definitions,
  query,
  setQuery,
  addStep,
  buttonClassName,
  catalogClassName,
  searchClassName
}: {
  definitions: WorkflowStepDefinition[]
  query: string
  setQuery: (value: string) => void
  addStep: (definition: WorkflowStepDefinition) => void
  buttonClassName?: string
  catalogClassName: string
  searchClassName: string
}) {
  const styles = useStyles()
  const categories = [...new Set(definitions.map(({ category }) => category))]
  return (
    <Menu positioning="above-end">
      <MenuTrigger disableButtonEnhancement>
        <Button className={buttonClassName} appearance="primary" icon={<AddIcon />}>
          Add step
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <div className={catalogClassName}>
          <SearchBox
            className={searchClassName}
            value={query}
            onChange={(_, data) => setQuery(data.value)}
            placeholder="Find a step"
            contentBefore={<SearchRegular />}
          />
          <MenuList>
            {categories.map((category) => (
              <MenuGroup key={category}>
                <MenuGroupHeader>{categoryLabel(category)}</MenuGroupHeader>
                {definitions
                  .filter((definition) => definition.category === category)
                  .map((definition) => (
                    <MenuItem
                      className={styles.catalogItem}
                      key={`${definition.kind}-${definition.version}`}
                      icon={categoryIcon(definition.category)}
                      secondaryContent={definition.description}
                      onClick={() => addStep(definition)}
                    >
                      {definition.label}
                    </MenuItem>
                  ))}
              </MenuGroup>
            ))}
          </MenuList>
        </div>
      </MenuPopover>
    </Menu>
  )
}

function StepInspector({
  node,
  nodes,
  edges,
  repository,
  changeStep,
  changeEdge,
  runToHere,
  remove
}: {
  node: CanvasNode
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  repository: WorkflowDraftContent["resourceBindings"][string] | undefined
  changeStep: (step: WorkflowStep, resourceBinding?: WorkflowDraftContent["resourceBindings"][string] | null) => void
  changeEdge: (edge: CanvasEdge) => void
  runToHere: () => void
  remove: () => void
}) {
  const styles = useStyles()
  const { step, definition } = node.data
  let expressionField: "cases" | "condition" | "expression" = "expression"
  if (definition.kind === "switch") {
    expressionField = "cases"
  }
  if (definition.kind === "bounded_loop") {
    expressionField = "condition"
  }
  return (
    <div className={styles.fields}>
      <Field label="Label">
        <Input value={step.label} onChange={(_, data) => changeStep({ ...step, label: data.value })} />
      </Field>
      <Caption1 className={styles.hint}>{definition.description}</Caption1>
      {definition.kind === "set_fields" && (
        <Field label="Fields" hint="JSON object merged into the incoming value">
          <Textarea
            resize="vertical"
            value={JSON.stringify(step.config.fields ?? {}, null, 2)}
            onChange={(_, data) => {
              try {
                changeStep({ ...step, config: { ...step.config, fields: JSON.parse(data.value) as JsonValue } })
              } catch {
                /* Keep the last valid configuration while typing. */
              }
            }}
          />
        </Field>
      )}
      {definition.kind === "map_fields" && (
        <Field label="Mappings" hint='JSON object such as {"title":"issue.title"}'>
          <Textarea
            resize="vertical"
            value={JSON.stringify(step.config.mappings ?? {}, null, 2)}
            onChange={(_, data) => {
              try {
                changeStep({ ...step, config: { ...step.config, mappings: JSON.parse(data.value) as JsonValue } })
              } catch {
                /* Keep the last valid configuration while typing. */
              }
            }}
          />
        </Field>
      )}
      {definition.kind === "validate" && (
        <Field label="Validation schema">
          <Textarea
            resize="vertical"
            value={JSON.stringify(step.config.schema ?? {}, null, 2)}
            onChange={(_, data) => {
              try {
                changeStep({ ...step, config: { ...step.config, schema: JSON.parse(data.value) as JsonValue } })
              } catch {
                /* Keep the last valid configuration while typing. */
              }
            }}
          />
        </Field>
      )}
      {definition.kind === "failure" && (
        <>
          <Field label="Failure code">
            <Input
              value={typeof step.config.code === "string" ? step.config.code : ""}
              onChange={(_, data) => changeStep({ ...step, config: { ...step.config, code: data.value } })}
            />
          </Field>
          <Field label="Message">
            <Textarea
              value={typeof step.config.message === "string" ? step.config.message : ""}
              onChange={(_, data) => changeStep({ ...step, config: { ...step.config, message: data.value } })}
            />
          </Field>
        </>
      )}
      {definition.kind === "compose_markdown" && (
        <Field label="Markdown template" hint="Insert declared values with {{path.to.value}}">
          <Textarea
            resize="vertical"
            value={typeof step.config.template === "string" ? step.config.template : ""}
            onChange={(_, data) => changeStep({ ...step, config: { ...step.config, template: data.value } })}
          />
        </Field>
      )}
      {definition.kind === "collect" && (
        <>
          <Field label="Collection mode">
            <Dropdown
              value={step.config.mode === "keyed" ? "Keyed object" : "Ordered array"}
              selectedOptions={[step.config.mode === "keyed" ? "keyed" : "array"]}
              onOptionSelect={(_, data) =>
                changeStep({ ...step, config: { ...step.config, mode: data.optionValue ?? "array" } })
              }
            >
              <Option value="array">Ordered array</Option>
              <Option value="keyed">Keyed object</Option>
            </Dropdown>
          </Field>
          {step.config.mode === "keyed" && (
            <Field label="Key field">
              <Input
                value={typeof step.config.keyField === "string" ? step.config.keyField : ""}
                onChange={(_, data) => changeStep({ ...step, config: { ...step.config, keyField: data.value } })}
              />
            </Field>
          )}
          <Field label="Maximum items">
            <Input
              type="number"
              min={1}
              max={1000}
              value={String(typeof step.config.maximumItems === "number" ? step.config.maximumItems : 100)}
              onChange={(_, data) => {
                const maximumItems = Number(data.value)
                if (Number.isInteger(maximumItems) && maximumItems >= 1 && maximumItems <= 1000) {
                  changeStep({ ...step, config: { ...step.config, maximumItems } })
                }
              }}
            />
          </Field>
        </>
      )}
      {definition.kind === "repository_data" && (
        <RepositoryDataInspector step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "repository_agent" && (
        <RepositoryAgentInspector step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "ai_model" && <AiModelInspector step={step} changeStep={changeStep} />}
      {definition.kind === "structured_judgment" && <StructuredJudgmentInspector step={step} changeStep={changeStep} />}
      {definition.kind === "provider_event" && (
        <ProviderEventInspector step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "schedule" && <ScheduleInspector step={step} changeStep={changeStep} />}
      {definition.kind === "provider_data" && (
        <ProviderStepInspector mode="read" step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "provider_action" && (
        <ProviderStepInspector mode="write" step={step} repository={repository} changeStep={changeStep} />
      )}
      {(definition.kind === "condition" || definition.kind === "switch" || definition.kind === "bounded_loop") && (
        <ExpressionInspector step={step} field={expressionField} changeStep={changeStep} />
      )}
      {definition.kind === "switch" && (
        <Field label="Default branch key">
          <Input
            value={typeof step.config.defaultKey === "string" ? step.config.defaultKey : ""}
            onChange={(_, data) => changeStep({ ...step, config: { ...step.config, defaultKey: data.value } })}
          />
        </Field>
      )}
      {(definition.kind === "condition" || definition.kind === "switch") && (
        <StepReferenceField
          label="Merge step"
          value={step.config.joinStepId}
          nodes={nodes}
          kinds={["exclusive_merge"]}
          onChange={(joinStepId) => changeStep({ ...step, config: { ...step.config, joinStepId } })}
        />
      )}
      {definition.kind === "for_each" && <ForEachInspector step={step} nodes={nodes} changeStep={changeStep} />}
      {definition.kind === "join" && <JoinInspector step={step} changeStep={changeStep} />}
      {definition.kind === "bounded_loop" && <BoundedLoopInspector step={step} nodes={nodes} changeStep={changeStep} />}
      {definition.kind === "wait" && <WaitInspector step={step} changeStep={changeStep} />}
      {definition.kind === "child_workflow" && <ChildWorkflowInspector step={step} changeStep={changeStep} />}
      {edges.length > 0 && <ConnectionInspector node={node} edges={edges} changeEdge={changeEdge} />}
      <Button icon={<BeakerRegular />} onClick={runToHere}>
        Run to here
      </Button>
      <Button appearance="subtle" icon={<DeleteRegular />} onClick={remove}>
        Delete step
      </Button>
      <Caption1 className={styles.hint}>
        {definition.inputs.length} input port{definition.inputs.length === 1 ? "" : "s"}. {definition.outputs.length}{" "}
        output port{definition.outputs.length === 1 ? "" : "s"}.
      </Caption1>
    </div>
  )
}

function StepReferenceField({
  label,
  value,
  nodes,
  kinds,
  onChange
}: {
  label: string
  value: JsonValue | undefined
  nodes: CanvasNode[]
  kinds?: string[]
  onChange: (stepId: string) => void
}) {
  const options = kinds === undefined ? nodes : nodes.filter(({ data }) => kinds.includes(data.definition.kind))
  const selected = typeof value === "string" ? value : ""
  const labelValue = options.find(({ id }) => id === selected)?.data.step.label ?? ""
  return (
    <Field label={label}>
      <Dropdown
        placeholder="Select a step"
        value={labelValue}
        selectedOptions={selected === "" ? [] : [selected]}
        onOptionSelect={(_, data) => onChange(data.optionValue ?? "")}
      >
        {options.map(({ id, data }) => (
          <Option key={id} value={id}>
            {data.step.label}
          </Option>
        ))}
      </Dropdown>
    </Field>
  )
}

function ExpressionInspector({
  step,
  field,
  changeStep
}: {
  step: WorkflowStep
  field: "expression" | "condition" | "cases"
  changeStep: (step: WorkflowStep) => void
}) {
  if (field === "cases") {
    return (
      <Field
        label="Cases"
        hint='Ordered JSON array with key and when, such as [{"key":"urgent","when":{"path":["priority"],"operator":"equals","value":"urgent"}}]'
      >
        <Textarea
          resize="vertical"
          value={JSON.stringify(step.config.cases ?? [], null, 2)}
          onChange={(_, data) => {
            try {
              changeStep({ ...step, config: { ...step.config, cases: JSON.parse(data.value) as JsonValue } })
            } catch {
              /* Keep the last valid cases while typing. */
            }
          }}
        />
      </Field>
    )
  }
  const raw = step.config[field]
  const expression = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  const path = Array.isArray(expression.path)
    ? expression.path.filter((item): item is string => typeof item === "string").join(".")
    : ""
  const operator = typeof expression.operator === "string" ? expression.operator : "truthy"
  return (
    <>
      <Field label="Expression path">
        <Input
          value={path}
          placeholder="issue.priority"
          onChange={(_, data) =>
            changeStep({
              ...step,
              config: { ...step.config, [field]: { ...expression, path: data.value.split(".").filter(Boolean) } }
            })
          }
        />
      </Field>
      <Field label="Operator">
        <Dropdown
          value={operator.replaceAll("_", " ")}
          selectedOptions={[operator]}
          onOptionSelect={(_, data) =>
            changeStep({
              ...step,
              config: { ...step.config, [field]: { ...expression, operator: data.optionValue ?? "truthy" } }
            })
          }
        >
          {[
            "equals",
            "not_equals",
            "greater_than",
            "greater_than_or_equal",
            "less_than",
            "less_than_or_equal",
            "exists",
            "truthy"
          ].map((item) => (
            <Option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {operator !== "exists" && operator !== "truthy" && (
        <Field label="Comparison value" hint="JSON value">
          <Input
            value={JSON.stringify(expression.value ?? null)}
            onChange={(_, data) => {
              try {
                changeStep({
                  ...step,
                  config: { ...step.config, [field]: { ...expression, value: JSON.parse(data.value) as JsonValue } }
                })
              } catch {
                /* Keep the last valid value while typing. */
              }
            }}
          />
        </Field>
      )}
    </>
  )
}

function ForEachInspector({
  step,
  nodes,
  changeStep
}: {
  step: WorkflowStep
  nodes: CanvasNode[]
  changeStep: (step: WorkflowStep) => void
}) {
  return (
    <>
      <Field label="Maximum items">
        <Input
          type="number"
          min={1}
          max={1000}
          value={String(step.config.maximumItems ?? 100)}
          onChange={(_, data) => {
            const maximumItems = Number(data.value)
            if (Number.isInteger(maximumItems) && maximumItems >= 1 && maximumItems <= 1000) {
              changeStep({ ...step, config: { ...step.config, maximumItems } })
            }
          }}
        />
      </Field>
      <Field label="Concurrency">
        <Input
          type="number"
          min={1}
          max={1000}
          value={String(step.config.concurrency ?? 4)}
          onChange={(_, data) => {
            const concurrency = Number(data.value)
            if (Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 1000) {
              changeStep({ ...step, config: { ...step.config, concurrency } })
            }
          }}
        />
      </Field>
      <StepReferenceField
        label="Body step"
        value={step.config.bodyStepId}
        nodes={nodes.filter(({ id }) => id !== step.id)}
        onChange={(bodyStepId) => changeStep({ ...step, config: { ...step.config, bodyStepId } })}
      />
      <StepReferenceField
        label="Join step"
        value={step.config.joinStepId}
        nodes={nodes}
        kinds={["join"]}
        onChange={(joinStepId) => changeStep({ ...step, config: { ...step.config, joinStepId } })}
      />
    </>
  )
}

function JoinInspector({ step, changeStep }: { step: WorkflowStep; changeStep: (step: WorkflowStep) => void }) {
  const policy = typeof step.config.policy === "string" ? step.config.policy : "all"
  return (
    <>
      <Field label="Join policy">
        <Dropdown
          value={policy}
          selectedOptions={[policy]}
          onOptionSelect={(_, data) => {
            const next = data.optionValue ?? "all"
            const config =
              next === "quorum"
                ? {
                    ...step.config,
                    policy: next,
                    quorum: typeof step.config.quorum === "number" ? step.config.quorum : 1
                  }
                : { policy: next }
            changeStep({ ...step, config })
          }}
        >
          <Option value="all">All</Option>
          <Option value="any">Any</Option>
          <Option value="quorum">Quorum</Option>
        </Dropdown>
      </Field>
      {policy === "quorum" && (
        <Field label="Quorum">
          <Input
            type="number"
            min={1}
            value={String(step.config.quorum ?? 1)}
            onChange={(_, data) => {
              const quorum = Number(data.value)
              if (Number.isInteger(quorum) && quorum >= 1) {
                changeStep({ ...step, config: { ...step.config, quorum } })
              }
            }}
          />
        </Field>
      )}
    </>
  )
}

function BoundedLoopInspector({
  step,
  nodes,
  changeStep
}: {
  step: WorkflowStep
  nodes: CanvasNode[]
  changeStep: (step: WorkflowStep) => void
}) {
  return (
    <>
      <Field label="Maximum iterations">
        <Input
          type="number"
          min={1}
          max={1000}
          value={String(step.config.maximumIterations ?? 10)}
          onChange={(_, data) => {
            const maximumIterations = Number(data.value)
            if (Number.isInteger(maximumIterations) && maximumIterations >= 1 && maximumIterations <= 1000) {
              changeStep({ ...step, config: { ...step.config, maximumIterations } })
            }
          }}
        />
      </Field>
      <Field label="Maximum activations">
        <Input
          type="number"
          min={1}
          max={100000}
          value={String(step.config.maximumActivations ?? 100)}
          onChange={(_, data) => {
            const maximumActivations = Number(data.value)
            if (Number.isInteger(maximumActivations) && maximumActivations >= 1 && maximumActivations <= 100000) {
              changeStep({ ...step, config: { ...step.config, maximumActivations } })
            }
          }}
        />
      </Field>
      <StepReferenceField
        label="Body step"
        value={step.config.bodyStepId}
        nodes={nodes.filter(({ id }) => id !== step.id)}
        onChange={(bodyStepId) => changeStep({ ...step, config: { ...step.config, bodyStepId } })}
      />
      <StepReferenceField
        label="Exit step"
        value={step.config.exitStepId}
        nodes={nodes.filter(({ id }) => id !== step.id)}
        onChange={(exitStepId) => changeStep({ ...step, config: { ...step.config, exitStepId } })}
      />
      <Field label="On exhaustion">
        <Dropdown
          value={step.config.onExhaustion === "complete" ? "Complete" : "Fail"}
          selectedOptions={[step.config.onExhaustion === "complete" ? "complete" : "fail"]}
          onOptionSelect={(_, data) =>
            changeStep({
              ...step,
              config: { ...step.config, onExhaustion: data.optionValue === "complete" ? "complete" : "fail" }
            })
          }
        >
          <Option value="fail">Fail</Option>
          <Option value="complete">Complete</Option>
        </Dropdown>
      </Field>
    </>
  )
}

function WaitInspector({ step, changeStep }: { step: WorkflowStep; changeStep: (step: WorkflowStep) => void }) {
  return (
    <>
      <Field label="Correlation key" hint="Use {{path}} placeholders from wait context">
        <Input
          value={typeof step.config.correlation === "string" ? step.config.correlation : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, correlation: data.value } })}
        />
      </Field>
      <Field label="Expires after seconds">
        <Input
          type="number"
          min={1}
          value={String(step.config.expiresAfterSeconds ?? 3600)}
          onChange={(_, data) => {
            const expiresAfterSeconds = Number(data.value)
            if (Number.isInteger(expiresAfterSeconds) && expiresAfterSeconds >= 1) {
              changeStep({ ...step, config: { ...step.config, expiresAfterSeconds } })
            }
          }}
        />
      </Field>
      <JsonSchemaField
        label="Resume event schema"
        value={step.config.eventSchema}
        onChange={(eventSchema) => changeStep({ ...step, config: { ...step.config, eventSchema } })}
      />
    </>
  )
}

function ChildWorkflowInspector({
  step,
  changeStep
}: {
  step: WorkflowStep
  changeStep: (step: WorkflowStep) => void
}) {
  return (
    <>
      <Field label="Execution package digest">
        <Input
          value={typeof step.config.packageDigest === "string" ? step.config.packageDigest : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, packageDigest: data.value.trim() } })}
        />
      </Field>
      <Field label="Interface digest">
        <Input
          value={typeof step.config.interfaceDigest === "string" ? step.config.interfaceDigest : ""}
          onChange={(_, data) =>
            changeStep({ ...step, config: { ...step.config, interfaceDigest: data.value.trim() } })
          }
        />
      </Field>
    </>
  )
}

function ConnectionInspector({
  node,
  edges,
  changeEdge
}: {
  node: CanvasNode
  edges: CanvasEdge[]
  changeEdge: (edge: CanvasEdge) => void
}) {
  const styles = useStyles()
  return (
    <>
      {edges.map((edge) => {
        const outgoing = edge.source === node.id
        return (
          <div key={edge.id}>
            <Caption1>{outgoing ? "Outgoing connection" : "Incoming connection"}</Caption1>
            <Caption1 className={styles.hint}>{edge.id}</Caption1>
            {outgoing && node.data.definition.kind === "switch" && (
              <Field label="Branch key">
                <Input
                  value={edge.data?.branchKey ?? ""}
                  onChange={(_, data) =>
                    changeEdge({
                      ...edge,
                      data: { mappings: edge.data?.mappings ?? [], ...edge.data, branchKey: data.value }
                    })
                  }
                />
              </Field>
            )}
            {edge.target === node.id && node.data.definition.kind === "bounded_loop" && (
              <Field label="Loop-back">
                <Dropdown
                  value={edge.data?.loopBack === true ? "Loop back" : "Initial state"}
                  selectedOptions={[edge.data?.loopBack === true ? "true" : "false"]}
                  onOptionSelect={(_, data) =>
                    changeEdge({
                      ...edge,
                      data: { mappings: edge.data?.mappings ?? [], ...edge.data, loopBack: data.optionValue === "true" }
                    })
                  }
                >
                  <Option value="false">Initial state</Option>
                  <Option value="true">Loop back</Option>
                </Dropdown>
              </Field>
            )}
          </div>
        )
      })}
    </>
  )
}

function SelectedConnectionInspector({
  edge,
  nodes,
  changeEdge,
  remove
}: {
  edge: CanvasEdge
  nodes: CanvasNode[]
  changeEdge: (edge: CanvasEdge) => void
  remove: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const source = nodes.find(({ id }) => id === edge.source)
  const target = nodes.find(({ id }) => id === edge.target)
  return (
    <div className={useStyles().fields}>
      <Field label="From">
        <Dropdown
          value={source?.data.step.label ?? ""}
          selectedOptions={[edge.source]}
          onOptionSelect={(_, data) => {
            const next = nodes.find(({ id }) => id === data.optionValue)
            const sourceHandle = next?.data.definition.outputs[0]?.name
            if (next !== undefined && sourceHandle !== undefined) {
              changeEdge({ ...edge, source: next.id, sourceHandle })
            }
          }}
        >
          {nodes
            .filter(({ data }) => data.definition.outputs.length > 0)
            .map(({ id, data }) => (
              <Option key={id} value={id}>
                {data.step.label}
              </Option>
            ))}
        </Dropdown>
      </Field>
      <Field label="To">
        <Dropdown
          value={target?.data.step.label ?? ""}
          selectedOptions={[edge.target]}
          onOptionSelect={(_, data) => {
            const next = nodes.find(({ id }) => id === data.optionValue)
            const targetHandle = next?.data.definition.inputs[0]?.name
            if (next !== undefined && targetHandle !== undefined) {
              changeEdge({ ...edge, target: next.id, targetHandle })
            }
          }}
        >
          {nodes
            .filter(({ data }) => data.definition.inputs.length > 0)
            .map(({ id, data }) => (
              <Option key={id} value={id}>
                {data.step.label}
              </Option>
            ))}
        </Dropdown>
      </Field>
      <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => setConfirmDelete(true)}>
        Delete connection
      </Button>
      <Dialog open={confirmDelete} onOpenChange={(_, data) => setConfirmDelete(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete connection?</DialogTitle>
            <DialogContent>The connected steps will remain in the workflow.</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={remove}>
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}

type RepositoryInventoryItem = IntegrationResourceInventory["resources"][number]
type RepositorySelection = { owner: string; name: string; ref: string }

function repositoryParts(name: string): Pick<RepositorySelection, "owner" | "name"> {
  const [owner = "", repositoryName = ""] = name.split("/")
  return { owner, name: repositoryName }
}

function selectedRepository(step: WorkflowStep): RepositorySelection {
  const repository = step.config.repository
  if (repository === null || typeof repository !== "object" || Array.isArray(repository)) {
    return { owner: "", name: "", ref: "main" }
  }
  return {
    owner: typeof repository.owner === "string" ? repository.owner : "",
    name: typeof repository.name === "string" ? repository.name : "",
    ref: typeof repository.ref === "string" ? repository.ref : "main"
  }
}

function RepositoryDataInspector({
  step,
  repository: workflowRepository,
  changeStep
}: {
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: (step: WorkflowStep) => void
}) {
  const repository = selectedRepository(step)
  const operations = [
    "metadata",
    "file_content",
    "commit",
    "code_search",
    "pull_request",
    "pull_request_files",
    "checks",
    "reviews",
    "comments"
  ]
  if (workflowRepository === undefined) {
    return <Caption1>This workflow has no repository.</Caption1>
  }
  return (
    <>
      <Field label="Repository">
        <Input readOnly value={workflowRepository.name} />
      </Field>
      <Field label="Operation">
        <Dropdown
          value={typeof step.config.operation === "string" ? step.config.operation.replaceAll("_", " ") : "metadata"}
          selectedOptions={[typeof step.config.operation === "string" ? step.config.operation : "metadata"]}
          onOptionSelect={(_, data) =>
            changeStep({ ...step, config: { ...step.config, operation: data.optionValue ?? "metadata" } })
          }
        >
          {operations.map((operation) => (
            <Option key={operation} value={operation}>
              {operation.replaceAll("_", " ")}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Repository ref">
        <Input
          value={repository.ref}
          onChange={(_, data) =>
            changeStep({ ...step, config: { ...step.config, repository: { ...repository, ref: data.value } } })
          }
        />
      </Field>
    </>
  )
}

function RepositoryAgentInspector({
  step,
  repository,
  changeStep
}: {
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: (step: WorkflowStep) => void
}) {
  const current = parseRepositoryAgentReference(step.config.agentReference)
  const [agents, setAgents] = useState<RepositoryAgentReference[]>([])
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")

  function discover() {
    if (repository === undefined) {
      return
    }
    setState("loading")
    setError("")
    void discoverRepositoryAgents({
      connectionId: repository.connectionId,
      repositoryId: repository.externalId,
      repositoryName: repository.name,
      ref: current?.ref ?? "HEAD"
    })
      .then((result) => {
        setAgents(result)
        setState("ready")
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Agent definitions could not be loaded")
        setState("error")
      })
  }

  if (repository === undefined) {
    return <Caption1>This workflow has no repository.</Caption1>
  }
  return (
    <>
      <Field label="Repository">
        <Input readOnly value={repository.name} />
      </Field>
      <Button disabled={state === "loading"} onClick={discover}>
        {state === "loading" ? "Finding agents" : "Find agents"}
      </Button>
      {state === "error" && <Caption1>{error}</Caption1>}
      {state === "ready" && agents.length === 0 && <Caption1>No repository agents were found.</Caption1>}
      {agents.length > 0 && (
        <Field label="Agent definition">
          <Dropdown
            placeholder="Select an agent"
            value={current?.name ?? ""}
            selectedOptions={current === undefined ? [] : [current.contentDigest]}
            onOptionSelect={(_, data) => {
              const selected = agents.find(({ contentDigest }) => contentDigest === data.optionValue)
              if (selected !== undefined) {
                changeStep({ ...step, config: { ...step.config, agentReference: selected } })
              }
            }}
          >
            {agents.map((agent) => (
              <Option key={agent.contentDigest} value={agent.contentDigest} text={`${agent.name}, ${agent.path}`}>
                {agent.name}
                <Caption1>{agent.path}</Caption1>
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
      {current !== undefined && (
        <>
          <Caption1>{current.description}</Caption1>
          <Caption1>Observed at {current.observedCommitSha.slice(0, 12)}</Caption1>
          <Link href={current.sourceUrl} target="_blank" rel="noreferrer">
            Open in GitHub
          </Link>
        </>
      )}
      <Field label="Instructions">
        <Textarea
          resize="vertical"
          value={typeof step.config.instructions === "string" ? step.config.instructions : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, instructions: data.value } })}
        />
      </Field>
    </>
  )
}

function useWorkflowModels() {
  const [models, setModels] = useState<WorkflowModelSnapshot[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void listWorkflowModels()
      .then((result) => {
        if (!active) {
          return
        }
        setModels(result)
        setState("ready")
      })
      .catch((reason: unknown) => {
        if (!active) {
          return
        }
        setError(reason instanceof Error ? reason.message : "Models could not be loaded")
        setState("error")
      })
    return () => {
      active = false
    }
  }, [])
  return { models, state, error }
}

function ModelPicker({
  models,
  value,
  onSelect
}: {
  models: WorkflowModelSnapshot[]
  value: string
  onSelect: (model: WorkflowModelSnapshot) => void
}) {
  const selected = models.find(({ modelId }) => modelId === value)
  return (
    <>
      <Field label="Model">
        <Dropdown
          placeholder="Search and select a model"
          value={selected?.name ?? value}
          selectedOptions={value === "" ? [] : [value]}
          onOptionSelect={(_, data) => {
            const model = models.find(({ modelId }) => modelId === data.optionValue)
            if (model !== undefined) {
              onSelect(model)
            }
          }}
        >
          {models.map((model) => (
            <Option key={model.modelId} value={model.modelId} text={`${model.name} ${model.modelId}`}>
              {model.name}
              <Caption1>{model.modelId}</Caption1>
            </Option>
          ))}
        </Dropdown>
      </Field>
      {selected !== undefined && (
        <Caption1>
          {selected.contextLength.toLocaleString()} token context. Observed{" "}
          {new Date(selected.observedAt).toLocaleDateString()}.
        </Caption1>
      )}
    </>
  )
}

type PromptMessage = { role: "system" | "developer" | "user"; content: string }

function promptMessages(value: JsonValue | undefined): PromptMessage[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (item === null || Array.isArray(item) || typeof item !== "object") {
      return []
    }
    if (
      (item.role !== "system" && item.role !== "developer" && item.role !== "user") ||
      typeof item.content !== "string"
    ) {
      return []
    }
    return [{ role: item.role, content: item.content }]
  })
}

function modelParameters(value: JsonValue | undefined): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value
}

function ModelCatalogState({
  state,
  error,
  models,
  children
}: {
  state: "loading" | "ready" | "error"
  error: string
  models: WorkflowModelSnapshot[]
  children: React.ReactNode
}) {
  if (state === "loading") {
    return <Spinner size="tiny" label="Loading models" />
  }
  if (state === "error") {
    return <Caption1>{error}</Caption1>
  }
  if (models.length === 0) {
    return <Caption1>No OpenRouter models are available.</Caption1>
  }
  return children
}

function AiModelInspector({ step, changeStep }: { step: WorkflowStep; changeStep: (step: WorkflowStep) => void }) {
  const { models, state, error } = useWorkflowModels()
  const messages = promptMessages(step.config.messages)
  const modelId = typeof step.config.modelId === "string" ? step.config.modelId : ""
  const selected = models.find((model) => model.modelId === modelId)
  const outputMode =
    step.config.outputMode === "markdown" || step.config.outputMode === "structured" ? step.config.outputMode : "text"
  const parameters = modelParameters(step.config.parameters)
  const promptCharacters = messages.reduce((total, message) => total + message.content.length, 0)

  function changeMessage(index: number, message: PromptMessage) {
    changeStep({
      ...step,
      config: {
        ...step.config,
        messages: messages.map((current, currentIndex) => (currentIndex === index ? message : current))
      }
    })
  }

  return (
    <ModelCatalogState state={state} error={error} models={models}>
      <ModelPicker
        models={models}
        value={modelId}
        onSelect={(model) => changeStep({ ...step, config: { ...step.config, modelId: model.modelId } })}
      />
      {messages.map((message, index) => (
        <div key={`${index}-${message.role}`}>
          <Field label={`Message ${index + 1}`}>
            <Dropdown
              value={message.role}
              selectedOptions={[message.role]}
              onOptionSelect={(_, data) =>
                changeMessage(index, {
                  ...message,
                  role: data.optionValue === "developer" || data.optionValue === "system" ? data.optionValue : "user"
                })
              }
            >
              <Option value="system">System</Option>
              <Option value="developer">Developer</Option>
              <Option value="user">User</Option>
            </Dropdown>
          </Field>
          <Field label={`${message.role} prompt`}>
            <Textarea
              resize="vertical"
              value={message.content}
              onChange={(_, data) => changeMessage(index, { ...message, content: data.value })}
            />
          </Field>
          <Button
            appearance="subtle"
            disabled={messages.length === 1}
            onClick={() =>
              changeStep({
                ...step,
                config: { ...step.config, messages: messages.filter((_, currentIndex) => currentIndex !== index) }
              })
            }
          >
            Remove message
          </Button>
        </div>
      ))}
      <Button
        onClick={() =>
          changeStep({ ...step, config: { ...step.config, messages: [...messages, { role: "user", content: "" }] } })
        }
      >
        Add message
      </Button>
      <Button
        appearance="subtle"
        onClick={() => {
          const lastIndex = Math.max(0, messages.length - 1)
          const current = messages[lastIndex] ?? { role: "user", content: "" }
          changeMessage(lastIndex, { ...current, content: `${current.content}{{context}}` })
        }}
      >
        Use workflow context
      </Button>
      <Caption1>
        Estimated prompt: {Math.ceil(promptCharacters / 4).toLocaleString()} tokens
        {selected === undefined ? "" : ` of ${selected.contextLength.toLocaleString()}`}
      </Caption1>
      <Field label="Output format">
        <Dropdown
          value={outputMode}
          selectedOptions={[outputMode]}
          onOptionSelect={(_, data) => {
            const next =
              data.optionValue === "markdown" || data.optionValue === "structured" ? data.optionValue : "text"
            changeStep({ ...step, config: { ...step.config, outputMode: next } })
          }}
        >
          <Option value="text">Text</Option>
          <Option value="markdown">Markdown artifact</Option>
          <Option
            value="structured"
            disabled={selected !== undefined && !selected.supportedParameters.includes("response_format")}
          >
            Structured JSON
          </Option>
        </Dropdown>
      </Field>
      {outputMode === "structured" && (
        <JsonSchemaField
          label="Output schema"
          value={step.config.outputSchema}
          onChange={(outputSchema) => changeStep({ ...step, config: { ...step.config, outputSchema } })}
        />
      )}
      <Field label="Temperature">
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={String(typeof parameters.temperature === "number" ? parameters.temperature : 0.2)}
          onChange={(_, data) => {
            const temperature = Number(data.value)
            if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) {
              changeStep({ ...step, config: { ...step.config, parameters: { ...parameters, temperature } } })
            }
          }}
        />
      </Field>
      <Field label="Maximum completion tokens">
        <Input
          type="number"
          min={1}
          max={65536}
          value={String(typeof parameters.max_tokens === "number" ? parameters.max_tokens : 2000)}
          onChange={(_, data) => {
            const maxTokens = Number(data.value)
            if (Number.isInteger(maxTokens) && maxTokens >= 1 && maxTokens <= 65536) {
              changeStep({ ...step, config: { ...step.config, parameters: { ...parameters, max_tokens: maxTokens } } })
            }
          }}
        />
      </Field>
    </ModelCatalogState>
  )
}

function JsonSchemaField({
  label,
  value,
  onChange
}: {
  label: string
  value: JsonValue | undefined
  onChange: (value: JsonValue) => void
}) {
  const [error, setError] = useState("")
  return (
    <Field label={label} validationState={error === "" ? "none" : "error"} validationMessage={error}>
      <Textarea
        resize="vertical"
        value={JSON.stringify(value ?? { type: "object", properties: {} }, null, 2)}
        onChange={(_, data) => {
          try {
            const next = JSON.parse(data.value) as JsonValue
            setError("")
            onChange(next)
          } catch {
            setError("Enter valid JSON Schema")
          }
        }}
      />
    </Field>
  )
}

function StructuredJudgmentInspector({
  step,
  changeStep
}: {
  step: WorkflowStep
  changeStep: (step: WorkflowStep) => void
}) {
  const { models, state, error } = useWorkflowModels()
  const modelId = typeof step.config.modelId === "string" ? step.config.modelId : ""
  return (
    <ModelCatalogState state={state} error={error} models={models}>
      <ModelPicker
        models={models.filter((model) => model.supportedParameters.includes("response_format"))}
        value={modelId}
        onSelect={(model) => changeStep({ ...step, config: { ...step.config, modelId: model.modelId } })}
      />
      <Field label="Judgment criteria">
        <Textarea
          resize="vertical"
          value={typeof step.config.criteria === "string" ? step.config.criteria : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, criteria: data.value } })}
        />
      </Field>
      <JsonSchemaField
        label="Judgment output schema"
        value={step.config.outputSchema}
        onChange={(outputSchema) => changeStep({ ...step, config: { ...step.config, outputSchema } })}
      />
      <Caption1>The model receives mapped evidence as untrusted data and must return this schema.</Caption1>
    </ModelCatalogState>
  )
}

type ResourceBinding = WorkflowDraftContent["resourceBindings"][string]
type ProviderChangeStep = (step: WorkflowStep, resourceBinding?: ResourceBinding | null) => void

function ProviderEventInspector({
  step,
  repository,
  changeStep
}: {
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: ProviderChangeStep
}) {
  const { inventory, state, error } = useProviderInventory()
  const provider = step.config.provider === "linear" ? "linear" : "github"
  const events =
    provider === "github"
      ? ["pull_request.created", "pull_request.updated", "pull_request.closed", "pull_request.merged"]
      : ["task.created", "task.updated", "task.comment.created"]
  return (
    <ProviderState state={state} error={error} inventory={inventory}>
      <Field label="Provider">
        <Dropdown
          value={provider === "github" ? "GitHub" : "Linear"}
          selectedOptions={[provider]}
          onOptionSelect={(_, data) => {
            const next = data.optionValue === "linear" ? "linear" : "github"
            changeStep(
              {
                ...step,
                config: { provider: next, eventKey: next === "github" ? "pull_request.created" : "task.created" }
              },
              null
            )
          }}
        >
          <Option value="github">GitHub</Option>
          <Option value="linear">Linear</Option>
        </Dropdown>
      </Field>
      <Field label="Event">
        <Dropdown
          value={typeof step.config.eventKey === "string" ? step.config.eventKey : events[0]}
          selectedOptions={[typeof step.config.eventKey === "string" ? step.config.eventKey : events[0]!]}
          onOptionSelect={(_, data) =>
            changeStep({ ...step, config: { ...step.config, eventKey: data.optionValue ?? events[0]! } })
          }
        >
          {events.map((event) => (
            <Option key={event} value={event}>
              {event.replaceAll("_", " ")}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {provider === "github" ? (
        <WorkflowRepositoryField repository={repository} />
      ) : (
        <ProviderResourcePicker
          step={step}
          provider={provider}
          inventory={inventory}
          capability="team.read"
          changeStep={changeStep}
        />
      )}
    </ProviderState>
  )
}

function ScheduleInspector({ step, changeStep }: { step: WorkflowStep; changeStep: ProviderChangeStep }) {
  const interval = typeof step.config.intervalSeconds === "number" ? step.config.intervalSeconds : 300
  const cron = typeof step.config.cron === "string" ? step.config.cron : ""
  return (
    <>
      <Field label="Schedule mode">
        <Dropdown
          value={cron === "" ? "Interval" : "CRON"}
          selectedOptions={[cron === "" ? "interval" : "cron"]}
          onOptionSelect={(_, data) => {
            if (data.optionValue === "cron") {
              changeStep({ ...step, config: { timezone: step.config.timezone ?? "UTC", cron: "0 9 * * 1-5" } })
            } else {
              changeStep({ ...step, config: { timezone: step.config.timezone ?? "UTC", intervalSeconds: interval } })
            }
          }}
        >
          <Option value="interval">Interval</Option>
          <Option value="cron">CRON</Option>
        </Dropdown>
      </Field>
      {cron === "" ? (
        <Field label="Interval seconds">
          <Input
            type="number"
            min={10}
            value={String(interval)}
            onChange={(_, data) => {
              const intervalSeconds = Number(data.value)
              if (Number.isInteger(intervalSeconds) && intervalSeconds >= 10) {
                changeStep({ ...step, config: { ...step.config, intervalSeconds } })
              }
            }}
          />
        </Field>
      ) : (
        <Field label="CRON expression">
          <Input
            value={cron}
            onChange={(_, data) => changeStep({ ...step, config: { ...step.config, cron: data.value } })}
          />
        </Field>
      )}
      <Field label="Timezone">
        <Input
          value={typeof step.config.timezone === "string" ? step.config.timezone : "UTC"}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, timezone: data.value } })}
        />
      </Field>
    </>
  )
}

function useProviderInventory() {
  const [inventory, setInventory] = useState<RepositoryInventoryItem[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void getIntegrationResourceInventory()
      .then(({ resources }) => {
        if (active) {
          setInventory(resources.filter(({ resource }) => !resource.stale))
          setState("ready")
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Provider resources could not be loaded")
          setState("error")
        }
      })
    return () => {
      active = false
    }
  }, [])
  return { inventory, state, error }
}

function useProviderOperations() {
  const [operations, setOperations] = useState<ProviderOperation[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void listProviderOperations()
      .then((result) => {
        if (active) {
          setOperations(result)
          setState("ready")
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Provider operations could not be loaded")
          setState("error")
        }
      })
    return () => {
      active = false
    }
  }, [])
  return { operations, state, error }
}

function ProviderState({
  state,
  error,
  inventory,
  children
}: {
  state: "loading" | "ready" | "error"
  error: string
  inventory: RepositoryInventoryItem[]
  children: React.ReactNode
}) {
  if (state === "loading") {
    return <Spinner size="tiny" label="Loading provider resources" />
  }
  if (state === "error") {
    return <Caption1>{error}</Caption1>
  }
  if (inventory.length === 0) {
    return <Caption1>No connected provider resources are available.</Caption1>
  }
  return children
}

function ProviderResourcePicker({
  step,
  provider,
  inventory,
  capability,
  changeStep
}: {
  step: WorkflowStep
  provider: "github" | "linear"
  inventory: RepositoryInventoryItem[]
  capability: string
  changeStep: ProviderChangeStep
}) {
  const binding = step.config.binding
  const selectedName =
    binding !== null && typeof binding === "object" && !Array.isArray(binding) && typeof binding.name === "string"
      ? binding.name
      : ""
  const available = inventory.filter(
    (item) =>
      item.provider === provider &&
      item.resource.capabilities.includes(
        capability as IntegrationResourceInventory["resources"][number]["resource"]["capabilities"][number]
      )
  )
  if (available.length === 0) {
    return (
      <Caption1>
        No connected {provider === "github" ? "repositories" : "teams"} grant {capability}.
      </Caption1>
    )
  }
  return (
    <Field label={provider === "github" ? "Repository" : "Team"}>
      <Dropdown
        placeholder="Select a connected resource"
        value={selectedName}
        selectedOptions={selectedName === "" ? [] : [selectedName]}
        onOptionSelect={(_, data) => {
          const item = available.find(({ resource }) => resource.name === data.optionValue)
          if (item === undefined) {
            return
          }
          const nextBinding: ResourceBinding = {
            connectionId: item.connectionId,
            provider: item.provider,
            resourceType: item.resource.resourceType,
            externalId: item.resource.externalId,
            name: item.resource.name,
            capabilities: item.resource.capabilities
          }
          changeStep({ ...step, config: { ...step.config, binding: nextBinding } }, nextBinding)
        }}
      >
        {available.map((item) => (
          <Option key={`${item.connectionId}-${item.resource.externalId}`} value={item.resource.name}>
            {item.resource.name}
          </Option>
        ))}
      </Dropdown>
    </Field>
  )
}

function WorkflowRepositoryField({ repository }: { repository: ResourceBinding | undefined }) {
  if (repository === undefined) {
    return <Caption1>This workflow has no repository.</Caption1>
  }
  return (
    <Field label="Repository">
      <Input readOnly value={repository.name} />
    </Field>
  )
}

function ProviderStepInspector({
  mode,
  step,
  repository,
  changeStep
}: {
  mode: "read" | "write"
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: ProviderChangeStep
}) {
  const inventoryState = useProviderInventory()
  const operationState = useProviderOperations()
  const provider = step.config.provider === "linear" ? "linear" : "github"
  const operations = operationState.operations.filter(
    (operation) => operation.mode === mode && operation.provider === provider
  )
  const operationId =
    typeof step.config.operation === "string" ? step.config.operation : (operations[0]?.operation ?? "")
  const operation = operations.find((candidate) => candidate.operation === operationId) ?? operations[0]
  let state: "loading" | "ready" | "error" = "ready"
  if (inventoryState.state === "loading" || operationState.state === "loading") {
    state = "loading"
  }
  if (inventoryState.state === "error" || operationState.state === "error") {
    state = "error"
  }
  const error = inventoryState.error || operationState.error
  return (
    <ProviderState state={state} error={error} inventory={inventoryState.inventory}>
      <Field label="Provider">
        <Dropdown
          value={provider === "github" ? "GitHub" : "Linear"}
          selectedOptions={[provider]}
          onOptionSelect={(_, data) => {
            const next = data.optionValue === "linear" ? "linear" : "github"
            const nextOperation = operationState.operations.find(
              (candidate) => candidate.mode === mode && candidate.provider === next
            )
            const binding = next === "github" ? repository : undefined
            changeStep(
              {
                ...step,
                config: {
                  provider: next,
                  operation: nextOperation?.operation ?? "",
                  ...(binding === undefined ? {} : { binding })
                }
              },
              null
            )
          }}
        >
          <Option value="github">GitHub</Option>
          <Option value="linear">Linear</Option>
        </Dropdown>
      </Field>
      <Field label="Operation">
        <Dropdown
          value={operation?.label ?? ""}
          selectedOptions={operation === undefined ? [] : [operation.operation]}
          onOptionSelect={(_, data) => {
            const selected = operations.find((candidate) => candidate.operation === data.optionValue)
            if (selected !== undefined) {
              changeStep(
                {
                  ...step,
                  config: {
                    provider,
                    operation: selected.operation,
                    ...(provider === "github" && repository !== undefined ? { binding: repository } : {})
                  }
                },
                null
              )
            }
          }}
        >
          {operations.map((item) => (
            <Option key={item.operation} value={item.operation}>
              {item.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {operation !== undefined &&
        (provider === "github" ? (
          <WorkflowRepositoryField repository={repository} />
        ) : (
          <ProviderResourcePicker
            step={step}
            provider={provider}
            inventory={inventoryState.inventory}
            capability={operation.capability}
            changeStep={changeStep}
          />
        ))}
      {mode === "write" && (
        <Caption1>
          Agency records the external change before it runs. If the result is unknown, retries pause until you confirm
          what happened.
        </Caption1>
      )}
    </ProviderState>
  )
}
