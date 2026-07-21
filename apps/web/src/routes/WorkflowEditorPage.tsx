import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
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
  Input,
  mergeClasses,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Overflow,
  OverflowItem,
  SearchBox,
  Spinner,
  Tab,
  TabList,
  Toolbar,
  ToolbarButton,
  Tooltip,
  useIsOverflowItemVisible,
  useOverflowMenu
} from "@fluentui/react-components"
import {
  ArrowLeftRegular,
  BeakerRegular,
  BotRegular,
  BranchForkRegular,
  ChevronRightRegular,
  CloudArrowUpRegular,
  DataUsageRegular,
  DismissRegular,
  FlashRegular,
  MoreHorizontalRegular,
  PlayRegular,
  PlugConnectedRegular,
  SearchRegular,
  SettingsRegular,
  StopRegular
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
import { AsyncStatus } from "@/components/AsyncStatus/AsyncStatus"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  getIntegrationSettings,
  getWorkflowDraft,
  listWorkflowStepDefinitions,
  publishWorkflow,
  startWorkflowRun,
  testWorkflowDraft,
  updateWorkflowDraft,
  validateWorkflow,
  type WorkflowDraftContent,
  type WorkflowDraftView,
  type JsonValue,
  type IntegrationProvider,
  type WorkflowStep,
  type WorkflowStepDefinition,
  type WorkflowValidation
} from "@/services/api"
import { missingRequiredTestInputs } from "./workflowEditor/WorkflowTestInputEditor"
import { WorkflowEditorInspector } from "./WorkflowEditorInspector"
import { WorkflowEditorOutline } from "./WorkflowEditorOutline"
import { projectWorkflowOutline } from "./WorkflowEditorOutline.utils"
import { useWorkflowEditorPageStyles } from "./WorkflowEditorPage.styles"
import { resultValue, WorkflowEditorResults, type EditorResultState } from "./WorkflowEditorResults"

type CanvasNode = Node<{ step: WorkflowStep; definition: WorkflowStepDefinition }, "workflow">
type WorkflowConnection = WorkflowDraftContent["connections"][number]
type CanvasEdge = Edge<Pick<WorkflowConnection, "mappings" | "branchKey" | "loopBack">>
type SaveState = "loading" | "dirty" | "saving" | "saved" | "error"
type EditorView = "canvas" | "outline"
type StepCatalogEntry = {
  key: string
  definition: WorkflowStepDefinition
  label: string
  description: string
  provider?: IntegrationProvider
  config?: Record<string, JsonValue>
}

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
    return { provider: "github", eventKey: "" }
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

function repositoryParts(name: string): { owner: string; name: string } {
  const [owner = "", repositoryName = ""] = name.split("/")
  return { owner, name: repositoryName }
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
    if (config.provider !== repository.provider) {
      return config
    }
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

function OverflowCommand({
  id,
  children,
  disabled,
  onClick
}: {
  id: string
  children: string
  disabled?: boolean
  onClick: () => void
}) {
  const visible = useIsOverflowItemVisible(id)
  if (visible) {
    return null
  }
  return (
    <MenuItem disabled={disabled} onClick={onClick}>
      {children}
    </MenuItem>
  )
}

function WorkflowCommandOverflow({ canTest, check, test }: { canTest: boolean; check: () => void; test: () => void }) {
  const { ref, isOverflowing } = useOverflowMenu<HTMLButtonElement>()
  if (!isOverflowing) {
    return null
  }
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          ref={ref}
          appearance="subtle"
          size="small"
          aria-label="More workflow commands"
          icon={<MoreHorizontalRegular />}
        />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <OverflowCommand id="test-draft" disabled={!canTest} onClick={test}>
            Test draft
          </OverflowCommand>
          <OverflowCommand id="check-issues" onClick={check}>
            Check for issues
          </OverflowCommand>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

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
  if (category === "ai") {
    return <BotRegular />
  }
  if (category === "action") {
    return <FlashRegular />
  }
  return <BranchForkRegular />
}

function WorkflowCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const styles = useWorkflowEditorPageStyles()
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
      {data.definition.category === "terminal"
        ? null
        : data.definition.outputs.map((output, index) => (
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

function contextualStepDefinition(step: WorkflowStep, definition: WorkflowStepDefinition): WorkflowStepDefinition {
  if (definition.kind !== "provider_event") {
    return definition
  }
  const provider = step.config.provider
  if (provider !== "github" && provider !== "linear") {
    return definition
  }
  const name = provider === "github" ? "GitHub" : "Linear"
  return { ...definition, description: `Starts the workflow from a ${name} event.` }
}

function toCanvasNodes(steps: WorkflowStep[], definitions: WorkflowStepDefinition[]): CanvasNode[] {
  return steps.flatMap((step) => {
    const definition = definitions.find(
      (candidate) => candidate.kind === step.definition.kind && candidate.version === step.definition.version
    )
    return definition === undefined
      ? []
      : [
          {
            id: step.id,
            type: "workflow" as const,
            position: step.position,
            data: { step, definition: contextualStepDefinition(step, definition) }
          }
        ]
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
    return "Saving changes"
  }
  if (saveState === "dirty") {
    return "Unsaved changes"
  }
  if (saveState === "saved") {
    return "All changes saved"
  }
  if (saveState === "error") {
    return "Changes could not be saved"
  }
  return "Loading draft"
}

function uniqueStepId(kind: string) {
  return `${kind.replaceAll("_", "-")}-${crypto.randomUUID()}`
}

export function WorkflowEditorPage() {
  const styles = useWorkflowEditorPageStyles()
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
  const [validation, setValidation] = useState<EditorResultState<WorkflowValidation>>({ status: "idle" })
  const [catalogOpen, setCatalogOpen] = useState(() => !window.matchMedia("(max-width: 800px)").matches)
  const [catalogQuery, setCatalogQuery] = useState("")
  const [connectedProviders, setConnectedProviders] = useState<ReadonlySet<IntegrationProvider>>(new Set())
  const [testInput, setTestInput] = useState("{}")
  const [testTriggerId, setTestTriggerId] = useState<string>()
  const [testConfirmationOpen, setTestConfirmationOpen] = useState(false)
  const [showTestInputValidation, setShowTestInputValidation] = useState(false)
  const [activeCommand, setActiveCommand] = useState<"publishing" | "starting-run" | "testing-draft">()
  const revisionRef = useRef(1)
  const lastSavedRef = useRef("")
  const initializedRef = useRef(false)
  const inspectorRef = useRef<HTMLElement>(null)
  const stepLibraryButtonRef = useRef<HTMLButtonElement>(null)
  const catalogSearchRef = useRef<HTMLInputElement>(null)
  const detailsButtonRef = useRef<HTMLButtonElement>(null)
  const pendingFocusLabelRef = useRef<string | null>(null)

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
        const triggers = loadedDraft.content.steps.filter(({ definition }) =>
          ["manual_trigger", "provider_event", "schedule"].includes(definition.kind)
        )
        setTestTriggerId(triggers.length === 1 ? triggers[0]?.id : undefined)
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
    let active = true
    void getIntegrationSettings()
      .then((settings) => {
        if (active) {
          setConnectedProviders(
            new Set(
              settings.connections.filter(({ status }) => status !== "disconnected").map(({ provider }) => provider)
            )
          )
        }
      })
      .catch(() => {
        if (active) {
          setConnectedProviders(new Set())
        }
      })
    return () => {
      active = false
    }
  }, [])

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
    if (dockOpen && pendingFocusLabelRef.current !== null) {
      const focusLabel = pendingFocusLabelRef.current
      pendingFocusLabelRef.current = null
      if (focusLabel !== null && inspectorRef.current !== null) {
        const matchingLabel = [...inspectorRef.current.querySelectorAll("label")].find(
          (label) => label.textContent?.trim() === focusLabel
        )
        if (matchingLabel instanceof HTMLLabelElement && matchingLabel.control instanceof HTMLElement) {
          matchingLabel.control.focus()
          return
        }
      }
    }
  }, [dockOpen, selectedEdgeId, selectedNodeId])

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)

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

  function addStep(
    definition: WorkflowStepDefinition,
    options?: { config?: Record<string, JsonValue>; label?: string }
  ) {
    const id = uniqueStepId(definition.kind)
    const step: WorkflowStep = {
      id,
      label: options?.label ?? definition.label,
      position: { x: 80 + nodes.length * 44, y: 80 + nodes.length * 36 },
      definition: { kind: definition.kind, version: definition.version },
      config: repositoryScopedConfig(
        definition.kind,
        options?.config ?? initialStepConfig(definition.kind),
        baseContent?.resourceBindings.repository
      ),
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    }
    setNodes((current) => [
      ...current,
      {
        id,
        type: "workflow",
        position: step.position,
        data: { step, definition: contextualStepDefinition(step, definition) }
      }
    ])
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
    pendingFocusLabelRef.current = issue.field
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
    if (validation.status === "running") {
      return null
    }
    const previous = resultValue(validation)
    setValidation({ status: "running", previous })
    try {
      const result = await validateWorkflow(workflowId)
      setValidation({ status: "complete", value: result })
      showAppToast(
        dispatchToast,
        result.valid
          ? { intent: "success", title: "Ready to publish", body: "Validation found no issues." }
          : { intent: "warning", title: "Fix workflow issues", body: "Open the details pane to review each issue." }
      )
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation could not run."
      setValidation({ status: "error", message, previous })
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Validation failed",
        body: message
      })
      return null
    }
  }

  async function publish() {
    const result = await check()
    if (result === null || !result.valid) {
      return
    }
    setActiveCommand("publishing")
    try {
      const published = await publishWorkflow(workflowId)
      setDraft(published)
      showAppToast(dispatchToast, {
        intent: "success",
        title: `Published version ${published.activePublishedVersion}`,
        body: "New runs now use this immutable version."
      })
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Publish failed",
        body: error instanceof Error ? error.message : "The workflow could not be published."
      })
    } finally {
      setActiveCommand(undefined)
    }
  }

  function parsedTestInput(): JsonValue {
    try {
      return JSON.parse(testInput) as JsonValue
    } catch {
      throw new Error("Test input must be valid JSON")
    }
  }

  function requestTest() {
    if (activeCommand === "testing-draft") {
      return
    }
    if (testTriggerId === undefined) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Select a test trigger",
        body: "Open workflow details and select the trigger to inject."
      })
      return
    }
    try {
      parsedTestInput()
      if (missingRequiredTestInputs(baseContent?.inputSchema ?? {}, testInput).length > 0) {
        setShowTestInputValidation(true)
        setSelectedNodeId(undefined)
        setSelectedEdgeId(undefined)
        setDockOpen(true)
        window.setTimeout(() => inspectorRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0)
        return
      }
      setTestConfirmationOpen(true)
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Invalid test input",
        body: error instanceof Error ? error.message : "Enter valid JSON before testing."
      })
    }
  }

  async function test() {
    if (testTriggerId === undefined) {
      return
    }
    setTestConfirmationOpen(false)
    setActiveCommand("testing-draft")
    try {
      const started = await testWorkflowDraft(workflowId, {
        expectedRevision: revisionRef.current,
        triggerStepId: testTriggerId,
        input: parsedTestInput()
      })
      await navigate({ to: "/runs/$runId", params: { runId: started.runId } })
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Test failed",
        body: error instanceof Error ? error.message : "The workflow test could not be started."
      })
      setActiveCommand(undefined)
    }
  }

  async function run(version: number) {
    if (activeCommand === "starting-run") {
      return
    }
    setActiveCommand("starting-run")
    try {
      const started = await startWorkflowRun(
        workflowId,
        version,
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
      setActiveCommand(undefined)
    }
  }

  if (draft === undefined || baseContent === undefined) {
    return (
      <div className={styles.page}>
        <Spinner label="Loading workflow editor" />
      </div>
    )
  }

  const validationValue = resultValue(validation)
  const outlineItems = projectWorkflowOutline(
    nodes.map(({ id, data }) => ({
      id,
      label: data.step.label,
      kind: data.definition.kind,
      category: data.definition.category
    })),
    edges.map((edge) => ({
      id: edge.id,
      sourceStepId: edge.source,
      targetStepId: edge.target,
      outcome: edge.label === "Failure" ? "failure" : "success",
      ...(edge.data?.branchKey === undefined ? {} : { branchKey: edge.data.branchKey }),
      ...(edge.data?.loopBack === undefined ? {} : { loopBack: edge.data.loopBack })
    }))
  )
  const problemStepIds = new Set(
    validationValue?.issues.flatMap(({ nodeId }) => (nodeId === null ? [] : [nodeId])) ?? []
  )
  const testTriggers = nodes.flatMap(({ id, data }) =>
    ["manual_trigger", "provider_event", "schedule"].includes(data.definition.kind)
      ? [{ id, label: data.step.label, kind: data.definition.kind }]
      : []
  )
  const nextPublishedVersion = (draft.versions[0]?.version ?? 0) + 1
  let asyncStatus = saveStateLabel(saveState)
  let asyncPending = saveState === "saving"
  if (validation.status === "running") {
    asyncStatus = "Checking workflow"
    asyncPending = true
  }
  if (activeCommand === "testing-draft") {
    asyncStatus = "Starting draft test"
    asyncPending = true
  }
  if (activeCommand === "publishing") {
    asyncStatus = `Publishing version ${nextPublishedVersion}`
    asyncPending = true
  }
  if (activeCommand === "starting-run") {
    asyncStatus = "Starting workflow run"
    asyncPending = true
  }
  let unavailableReason = ""
  if (saveState !== "saved") {
    unavailableReason = "Save the draft before testing or publishing."
  } else if (draft.activePublishedVersion === null) {
    unavailableReason = "Publish a version before starting a run."
  }
  let workspaceClassName = styles.workspace
  if (catalogOpen && dockOpen) {
    workspaceClassName = mergeClasses(styles.workspace, styles.workspaceCatalogDock)
  } else if (catalogOpen) {
    workspaceClassName = mergeClasses(styles.workspace, styles.workspaceCatalog)
  } else if (dockOpen) {
    workspaceClassName = mergeClasses(styles.workspace, styles.workspaceDock)
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.screenReaderHeading}>{name}</h1>
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            aria-label="Back to workflows"
            onClick={() => void navigate({ to: "/workflows" })}
          />
          <div className={styles.identityFields}>
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
              className={styles.descriptionInput}
              value={description}
              aria-label="Workflow description"
              placeholder="Add a workflow description"
              onChange={(_, data) => {
                setDescription(data.value)
                setSaveState("dirty")
              }}
            />
          </div>
        </div>
        <div className={styles.statusCluster} aria-label="Workflow status">
          <Badge appearance="tint" color="informative">
            Draft
          </Badge>
          {draft.activePublishedVersion === null ? (
            <Caption1 className={styles.commandHint}>Not published</Caption1>
          ) : (
            <Badge appearance="tint" color="success">
              Active version {draft.activePublishedVersion}
            </Badge>
          )}
          <AsyncStatus message={asyncStatus} pending={asyncPending} />
        </div>
        <div className={styles.commandArea}>
          {unavailableReason === "" ? (
            <span />
          ) : (
            <Caption1 className={styles.commandHint}>{unavailableReason}</Caption1>
          )}
          <Overflow minimumVisible={0}>
            <Toolbar className={styles.actions} aria-label="Workflow commands">
              <OverflowItem id="test-draft" priority={2}>
                <ToolbarButton
                  icon={<BeakerRegular />}
                  disabled={saveState !== "saved" || activeCommand === "testing-draft"}
                  onClick={requestTest}
                >
                  Test draft
                </ToolbarButton>
              </OverflowItem>
              <OverflowItem id="check-issues" priority={1}>
                <ToolbarButton disabled={validation.status === "running"} onClick={() => void check()}>
                  Check for issues
                </ToolbarButton>
              </OverflowItem>
              <OverflowItem id="publish" pinned>
                <ToolbarButton
                  appearance={draft.activePublishedVersion === null ? "primary" : "subtle"}
                  icon={<CloudArrowUpRegular />}
                  disabled={saveState !== "saved" || validation.status === "running" || activeCommand === "publishing"}
                  onClick={() => void publish()}
                >
                  Publish version {nextPublishedVersion}
                </ToolbarButton>
              </OverflowItem>
              <OverflowItem id="run" pinned>
                <ToolbarButton
                  appearance={draft.activePublishedVersion === null ? "subtle" : "primary"}
                  icon={<PlayRegular />}
                  disabled={draft.activePublishedVersion === null || activeCommand === "starting-run"}
                  onClick={() => {
                    if (draft.activePublishedVersion !== null) {
                      void run(draft.activePublishedVersion)
                    }
                  }}
                >
                  {draft.activePublishedVersion === null
                    ? "Run published version"
                    : `Run published version ${draft.activePublishedVersion}`}
                </ToolbarButton>
              </OverflowItem>
              <WorkflowCommandOverflow
                canTest={saveState === "saved" && activeCommand !== "testing-draft"}
                check={() => void check()}
                test={requestTest}
              />
            </Toolbar>
          </Overflow>
        </div>
      </header>
      <div className={styles.viewBar}>
        <div className={styles.viewControls}>
          {catalogOpen ? null : (
            <Button
              ref={stepLibraryButtonRef}
              appearance="subtle"
              icon={<SearchRegular />}
              onClick={() => {
                setCatalogOpen(true)
                window.setTimeout(() => catalogSearchRef.current?.focus(), 0)
              }}
            >
              Open step library
            </Button>
          )}
          <TabList selectedValue={view} onTabSelect={(_, data) => setView(data.value as EditorView)}>
            <Tab value="canvas">Canvas</Tab>
            <Tab value="outline">Outline</Tab>
          </TabList>
        </div>
        <Button
          ref={detailsButtonRef}
          appearance="subtle"
          icon={dockOpen ? <ChevronRightRegular /> : <SettingsRegular />}
          onClick={() => setDockOpen((value) => !value)}
        >
          {dockOpen ? "Close details" : "Open details"}
        </Button>
      </div>
      <section className={workspaceClassName}>
        {catalogOpen ? (
          <StepCatalog
            definitions={definitions}
            connectedProviders={connectedProviders}
            query={catalogQuery}
            setQuery={setCatalogQuery}
            searchInputRef={catalogSearchRef}
            addStep={addStep}
            close={() => {
              setCatalogOpen(false)
              window.setTimeout(() => stepLibraryButtonRef.current?.focus(), 0)
            }}
          />
        ) : null}
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
        </div>
        <div className={`${styles.outline} ${view !== "outline" ? styles.surfaceHidden : ""}`}>
          <div className={styles.outlineList}>
            <WorkflowEditorOutline
              items={outlineItems}
              descriptions={new Map(nodes.map(({ id, data }) => [id, data.definition.description]))}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              problemStepIds={problemStepIds}
              testStatusByStep={new Map()}
              onSelectNode={(stepId) => {
                setSelectedNodeId(stepId)
                setSelectedEdgeId(undefined)
                setDockOpen(true)
              }}
              onSelectEdge={(connectionId) => {
                setSelectedNodeId(undefined)
                setSelectedEdgeId(connectionId)
                setDockOpen(true)
              }}
            />
          </div>
        </div>
        <WorkflowEditorInspector
          open={dockOpen}
          inspectorRef={inspectorRef}
          draft={draft}
          testInput={testInput}
          setTestInput={(value) => {
            setTestInput(value)
            setShowTestInputValidation(false)
          }}
          showTestInputValidation={showTestInputValidation}
          testTriggers={testTriggers}
          testTriggerId={testTriggerId}
          setTestTriggerId={setTestTriggerId}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          nodes={nodes}
          edges={edges}
          repository={baseContent.resourceBindings.repository}
          changeStep={changeStep}
          changeEdge={(edge) => {
            setEdges((current) => current.map((candidate) => (candidate.id === edge.id ? edge : candidate)))
            setSaveState("dirty")
          }}
          removeSelectedStep={() => {
            if (selectedNode === undefined) {
              return
            }
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
          removeSelectedEdge={() => {
            if (selectedEdge === undefined) {
              return
            }
            setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id))
            setSelectedEdgeId(undefined)
            setSaveState("dirty")
          }}
          close={() => {
            setDockOpen(false)
            window.setTimeout(() => {
              const selectedId = selectedNodeId ?? selectedEdgeId
              const selected =
                selectedId === undefined
                  ? null
                  : document.querySelector<HTMLElement>(`[data-outline-selection="${selectedId}"]`)
              ;(selected ?? detailsButtonRef.current)?.focus()
            }, 0)
          }}
        />
      </section>
      <Dialog
        open={testConfirmationOpen}
        modalType="alert"
        onOpenChange={(_, data) => setTestConfirmationOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Start live draft test?</DialogTitle>
            <DialogContent>
              <Body1>
                This starts a durable server run from {testTriggers.find(({ id }) => id === testTriggerId)?.label}.
              </Body1>
              <Body1>
                Resources:{" "}
                {Object.values(baseContent.resourceBindings)
                  .map(({ name }) => name)
                  .join(", ")}
                .
              </Body1>
              <Body1>
                {nodes.filter(({ data }) => data.definition.executionClass === "model").length} live model call steps
                and {nodes.filter(({ data }) => data.definition.mutationPolicy === "external_effect").length} external
                mutation steps may run.
              </Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setTestConfirmationOpen(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={() => void test()}>
                Start draft test
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <WorkflowEditorResults
        currentRevision={draft.draftRevision}
        draftDirty={saveState !== "saved"}
        validation={validation}
        onSelectIssue={focusIssue}
      />
    </main>
  )
}

function StepCatalog({
  definitions,
  connectedProviders,
  query,
  setQuery,
  searchInputRef,
  addStep,
  close
}: {
  definitions: WorkflowStepDefinition[]
  connectedProviders: ReadonlySet<IntegrationProvider>
  query: string
  setQuery: (query: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  addStep: (
    definition: WorkflowStepDefinition,
    options?: { config?: Record<string, JsonValue>; label?: string }
  ) => void
  close: () => void
}) {
  const styles = useWorkflowEditorPageStyles()
  const entries = definitions.flatMap<StepCatalogEntry>((definition) => {
    if (definition.kind !== "provider_event") {
      return [
        {
          key: `${definition.kind}-${definition.version}`,
          definition,
          label: definition.label,
          description: definition.description
        }
      ]
    }
    return (["github", "linear"] as const).map((provider) => {
      const name = provider === "github" ? "GitHub" : "Linear"
      return {
        key: `${definition.kind}-${provider}-${definition.version}`,
        definition,
        label: `${name} event`,
        description: `Starts the workflow from a ${name} event.`,
        provider,
        config: {
          provider,
          eventKey: ""
        } satisfies Record<string, JsonValue>
      }
    })
  })
  const categories = [...new Set(entries.map(({ definition }) => definition.category))]
  const normalizedQuery = query.trim().toLowerCase()
  const visibleEntries = entries.filter((entry) =>
    `${entry.label} ${entry.description} ${entry.definition.category}`.toLowerCase().includes(normalizedQuery)
  )

  function entryButton(entry: (typeof entries)[number]) {
    const unavailableReason =
      entry.provider !== undefined && !connectedProviders.has(entry.provider)
        ? `Connect ${entry.provider === "github" ? "GitHub" : "Linear"} in Integrations before adding this event.`
        : undefined
    const button = (
      <Button
        className={styles.catalogItem}
        appearance="subtle"
        disabledFocusable={unavailableReason !== undefined}
        aria-label={unavailableReason === undefined ? undefined : `${entry.label}. ${unavailableReason}`}
        icon={entry.provider === undefined ? categoryIcon(entry.definition.category) : <PlugConnectedRegular />}
        onClick={() => addStep(entry.definition, { config: entry.config, label: entry.label })}
      >
        <span className={styles.catalogItemCopy}>
          <Body1>{entry.label}</Body1>
          <Caption1 className={styles.hint}>{entry.description}</Caption1>
        </span>
      </Button>
    )
    if (unavailableReason === undefined) {
      return button
    }
    return (
      <Tooltip content={unavailableReason} relationship="description">
        {button}
      </Tooltip>
    )
  }

  return (
    <aside className={styles.catalogPanel} aria-labelledby="step-catalog-heading">
      <div className={styles.catalogHeader}>
        <div className={styles.catalogHeaderCopy}>
          <Body1 id="step-catalog-heading">Step library</Body1>
          <Caption1 className={styles.hint}>Add a trigger, action, or control to the workflow.</Caption1>
        </div>
        <Button appearance="subtle" icon={<DismissRegular />} aria-label="Close step library" onClick={close} />
      </div>
      <SearchBox
        ref={searchInputRef}
        aria-label="Search steps"
        value={query}
        onChange={(_, data) => setQuery(data.value)}
        placeholder="Search steps"
        contentBefore={<SearchRegular />}
      />
      {normalizedQuery === "" ? (
        <Accordion className={styles.catalogSections} multiple collapsible defaultOpenItems={["trigger"]}>
          {categories.map((category) => (
            <AccordionItem key={category} value={category}>
              <AccordionHeader icon={categoryIcon(category)}>{categoryLabel(category)}</AccordionHeader>
              <AccordionPanel>
                <ul className={styles.catalogList} aria-label={`${categoryLabel(category)} steps`}>
                  {entries
                    .filter((entry) => entry.definition.category === category)
                    .map((entry) => (
                      <li className={styles.catalogListItem} key={entry.key}>
                        {entryButton(entry)}
                      </li>
                    ))}
                </ul>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <ul className={styles.catalogList} aria-label="Step search results">
          {visibleEntries.map((entry) => (
            <li className={styles.catalogListItem} key={entry.key}>
              {entryButton(entry)}
            </li>
          ))}
          {visibleEntries.length === 0 ? (
            <li>
              <Body1 className={styles.catalogEmpty}>No steps match your search.</Body1>
            </li>
          ) : null}
        </ul>
      )}
    </aside>
  )
}
