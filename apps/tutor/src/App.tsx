import {
  Badge,
  Body1,
  Button,
  Caption1,
  Caption1Strong,
  Link,
  mergeClasses,
  Tab,
  TabList,
  Text,
  tokens
} from "@fluentui/react-components"
import {
  ArrowTrendingLinesRegular,
  BookOpenRegular,
  ChevronRightRegular,
  CompassNorthwestRegular,
  DataUsageRegular,
  TargetArrowRegular
} from "@fluentui/react-icons"
import { MarkerType, type NodeTypes, type ReactFlowInstance, type Viewport } from "@xyflow/react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useAppStyles } from "@/App.styles"
import { ExploreKnowledgeNode } from "@/components/ExploreKnowledgeNode/ExploreKnowledgeNode"
import { GraphCanvas } from "@/components/GraphCanvas/GraphCanvas"
import { KnowledgeNode } from "@/components/KnowledgeNode/KnowledgeNode"
import { completedGraphMetadata } from "@/graph/completedGraphMetadata"
import { initialEdges, initialNodes } from "@/graph/graphData"
import type {
  KnowledgeEdge,
  KnowledgeNode as KnowledgeNodeModel,
  LayerSettings,
  RelationshipKind
} from "@/graph/graphTypes"
import {
  defaultLayers,
  filterGraph,
  getFoundationalExploreNodeId,
  getFoundationFocusNodeIds,
  getPreferredLearningPathNodeIds,
  getViewportOptimizedEdges,
  MIN_CONNECTION_RENDER_ZOOM,
  relationshipLabel
} from "@/graph/graphUtils"

const guidedNodeTypes: NodeTypes = { knowledge: KnowledgeNode }
const exploreNodeTypes: NodeTypes = { knowledge: ExploreKnowledgeNode }
const relationshipShortLabels: Record<RelationshipKind, string> = {
  requires: "Requires",
  supports: "Supports",
  resource: "Explained by"
}

type CompletedGraphModule = typeof import("@/graph/completedGraphData")
type SelectedNodeDetails = {
  nodeId: string
  data: KnowledgeNodeModel["data"]
}
type StoryStep = {
  title: string
  body: string
  nodeId: string
  anchorSelector: string
  focusNodeIds?: readonly string[]
}

type StoryPosition = {
  card: CSSProperties
  spotlight: CSSProperties
}

let completedGraphPromise: Promise<CompletedGraphModule> | undefined

function loadCompletedGraph() {
  completedGraphPromise ??= import("@/graph/completedGraphData")
  return completedGraphPromise
}

function focusExploreFoundation(
  instance: ReactFlowInstance<KnowledgeNodeModel, KnowledgeEdge>,
  nodes: readonly KnowledgeNodeModel[],
  edges: readonly KnowledgeEdge[]
) {
  const foundationId = getFoundationalExploreNodeId(nodes, edges)
  if (foundationId === undefined) {
    return
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const focusNodes = getFoundationFocusNodeIds(foundationId, edges)
    .map((id) => nodeById.get(id))
    .filter((node): node is KnowledgeNodeModel => node !== undefined)
  if (focusNodes.length === 0) {
    return foundationId
  }
  const left = Math.min(...focusNodes.map((node) => node.position.x))
  const top = Math.min(...focusNodes.map((node) => node.position.y))
  const right = Math.max(...focusNodes.map((node) => node.position.x + 300))
  const bottom = Math.max(...focusNodes.map((node) => node.position.y + 150))
  void instance
    .fitBounds(
      {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
      },
      {
        padding: 0.65,
        duration: 480
      }
    )
    .then(() => {
      if (instance.getZoom() > 0.9) {
        void instance.zoomTo(0.9, { duration: 180 })
      }
    })
  return foundationId
}

const storySteps: readonly StoryStep[] = [
  {
    title: "Start with a measurable outcome",
    body: "This is the result we want the learner to demonstrate. The graph works backward from that outcome into the smaller capabilities needed to achieve it.",
    nodeId: "add-within-ten",
    anchorSelector: '[data-story-node="add-within-ten"]'
  },
  {
    title: "Every outcome has observable evidence",
    body: "Mastery is defined by observable behavior—not a vague topic label. These criteria tell assessments and tutors what successful understanding should look like.",
    nodeId: "add-within-ten",
    anchorSelector: '[data-story-anchor="inspector-evidence"]'
  },
  {
    title: "Hard prerequisites reveal the learning hierarchy",
    body: "Solid blue connections identify capabilities the learner generally must have first. Their direction creates a defensible progression from foundational knowledge to the outcome.",
    nodeId: "represent-addition",
    anchorSelector: '[data-story-anchor="legend-requires"]',
    focusNodeIds: ["compose-quantities", "represent-addition", "add-within-ten"]
  },
  {
    title: "Atomic skills isolate the actual learning work",
    body: "The broad outcome decomposes into independently teachable skills. Joining two quantities is distinct from writing an addition expression, so each can be taught and evaluated separately.",
    nodeId: "compose-quantities",
    anchorSelector: '[data-story-node="compose-quantities"]',
    focusNodeIds: ["count-objects", "compose-quantities", "represent-addition"]
  },
  {
    title: "Supporting knowledge improves the preferred route",
    body: "Supporting knowledge is helpful without being a strict gate. The tutor can favor routes containing these connections while still recognizing that another learner may succeed without them.",
    nodeId: "count-objects",
    anchorSelector: '[data-story-anchor="legend-supports"]',
    focusNodeIds: ["count-sequence", "recognize-numerals", "count-objects"]
  },
  {
    title: "The graph pinpoints the earliest actionable gap",
    body: "If the learner cannot reliably count a collection, remediation can begin here instead of repeating the entire addition lesson. The highlighted path shows how this gap affects the target outcome.",
    nodeId: "count-objects",
    anchorSelector: '[data-story-anchor="inspector-evidence"]',
    focusNodeIds: ["count-sequence", "recognize-numerals", "count-objects"]
  },
  {
    title: "One internal skill can map to many standards",
    body: "The learner is evaluated against one stable internal capability. That evidence can then be translated into Common Core, England, Australian, and other standards without duplicating the learner model.",
    nodeId: "add-within-ten",
    anchorSelector: '[data-story-anchor="inspector-standards"]'
  },
  {
    title: "Resources attach at the moment of need",
    body: "Lessons and explanations remain separate from the knowledge graph. When more instruction is appropriate, the tutor can open a resource matched to the exact skill or outcome.",
    nodeId: "add-within-ten",
    anchorSelector: '[data-story-anchor="inspector-resources"]'
  }
]

function edgeAppearance(edge: KnowledgeEdge, prerequisiteIds: ReadonlySet<string> | undefined): KnowledgeEdge {
  const relationship = edge.data?.relationship
  let color = tokens.colorPaletteBerryBorderActive
  if (relationship === "requires") {
    color = tokens.colorBrandStroke1
  } else if (relationship === "supports") {
    color = tokens.colorPaletteMarigoldBorderActive
  }
  const isInPlan =
    prerequisiteIds === undefined || (prerequisiteIds.has(edge.source) && prerequisiteIds.has(edge.target))
  let strokeWidth = 2
  let strokeLinecap: "round" | undefined
  if (relationship === "supports") {
    strokeWidth = 3.25
    strokeLinecap = "round"
  } else if (relationship === "requires") {
    strokeWidth = 2.5
  }

  return {
    ...edge,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: {
      stroke: color,
      strokeWidth,
      strokeDasharray: relationship === "supports" ? "2 7" : undefined,
      strokeLinecap,
      opacity: isInPlan ? 1 : 0.16
    }
  }
}

export function App() {
  const classes = useAppStyles()
  const relationshipVisualClasses = useMemo<Record<RelationshipKind, string>>(
    () => ({
      requires: classes.requiresSample,
      supports: classes.supportsSample,
      resource: classes.resourceSample
    }),
    [classes.requiresSample, classes.resourceSample, classes.supportsSample]
  )
  const [selectedNodeId, setSelectedNodeId] = useState("add-within-ten")
  const [layers, setLayers] = useState<LayerSettings>(defaultLayers)
  const [mode, setMode] = useState<"explore" | "guided">("guided")
  const [storyIndex, setStoryIndex] = useState(0)
  const [isExplorePathFocused, setIsExplorePathFocused] = useState(false)
  const [exploreViewport, setExploreViewport] = useState<Viewport>({ x: 28, y: 28, zoom: 0.72 })
  const [nodePositionOverrides, setNodePositionOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const [completedGraph, setCompletedGraph] = useState<CompletedGraphModule>()
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<SelectedNodeDetails>()
  const [storyPosition, setStoryPosition] = useState<StoryPosition>()
  const activeStoryStep = storySteps[storyIndex] ?? storySteps[0]
  const flowInstanceRef = useRef<ReactFlowInstance<KnowledgeNodeModel, KnowledgeEdge> | null>(null)
  const storyCardRef = useRef<HTMLElement | null>(null)
  const hasCenteredExploreGraphRef = useRef(false)
  const connectionsHiddenRef = useRef(false)

  const ensureCompletedGraph = useCallback(async () => {
    const graph = await loadCompletedGraph()
    setCompletedGraph(graph)
    return graph
  }, [])

  useEffect(() => {
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (browserWindow.requestIdleCallback === undefined) {
      return
    }
    const handle = browserWindow.requestIdleCallback(() => void ensureCompletedGraph(), { timeout: 2500 })
    return () => browserWindow.cancelIdleCallback?.(handle)
  }, [ensureCompletedGraph])

  const graphNodes = useMemo(
    () => (mode === "guided" ? initialNodes : (completedGraph?.completedNodes ?? [])),
    [completedGraph, mode]
  )
  const graphEdges = useMemo(
    () => (mode === "guided" ? initialEdges : (completedGraph?.completedEdges ?? [])),
    [completedGraph, mode]
  )
  const positionedGraphNodes = useMemo(() => {
    if (Object.keys(nodePositionOverrides).length === 0) {
      return graphNodes
    }
    return graphNodes.map((node) => {
      const override = nodePositionOverrides[node.id]
      return override === undefined ? node : { ...node, position: override }
    })
  }, [graphNodes, nodePositionOverrides])
  const nodeById = useMemo(() => new Map(positionedGraphNodes.map((node) => [node.id, node])), [positionedGraphNodes])
  const selectedGraphNode =
    nodeById.get(mode === "guided" ? (activeStoryStep?.nodeId ?? selectedNodeId) : selectedNodeId) ??
    positionedGraphNodes.find((node) => node.data.kind === "outcome") ??
    positionedGraphNodes[0] ??
    initialNodes.find((node) => node.id === "add-within-ten")
  const selectedNode =
    mode === "explore" && selectedGraphNode !== undefined && selectedNodeDetails?.nodeId === selectedGraphNode.id
      ? { ...selectedGraphNode, data: selectedNodeDetails.data }
      : selectedGraphNode
  const filteredGraph = useMemo(
    () => filterGraph(positionedGraphNodes, graphEdges, layers),
    [graphEdges, layers, positionedGraphNodes]
  )
  const prerequisiteIds = useMemo(
    () =>
      selectedGraphNode !== undefined &&
      selectedGraphNode.data.kind !== "resource" &&
      (mode === "guided" || isExplorePathFocused)
        ? getPreferredLearningPathNodeIds(selectedGraphNode.id, graphEdges)
        : undefined,
    [graphEdges, isExplorePathFocused, mode, selectedGraphNode]
  )
  const renderableEdges = useMemo(() => {
    if (mode !== "explore") {
      return filteredGraph.edges
    }
    return getViewportOptimizedEdges(
      filteredGraph.edges,
      nodeById,
      exploreViewport,
      {
        width: window.innerWidth,
        height: window.innerHeight
      },
      prerequisiteIds
    )
  }, [exploreViewport, filteredGraph.edges, mode, nodeById, prerequisiteIds])
  const connectionsHiddenForZoom = mode === "explore" && exploreViewport.zoom < MIN_CONNECTION_RENDER_ZOOM
  const displayedNodes = filteredGraph.nodes
  const displayedEdges = useMemo(
    () => renderableEdges.map((edge) => edgeAppearance(edge, prerequisiteIds)),
    [prerequisiteIds, renderableEdges]
  )

  const updateStoryAnchor = useCallback(() => {
    if (mode !== "guided" || activeStoryStep === undefined) {
      setStoryPosition(undefined)
      return
    }
    const anchor = document.querySelector<HTMLElement>(activeStoryStep.anchorSelector)
    const card = storyCardRef.current
    if (anchor === null || card === null) {
      return
    }
    const anchorRect = anchor.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const gap = 20
    const viewportPadding = 16
    let left = anchorRect.right + gap
    let top = anchorRect.top + anchorRect.height / 2 - cardRect.height / 2

    if (anchorRect.left > window.innerWidth * 0.68 || left + cardRect.width > window.innerWidth - viewportPadding) {
      left = anchorRect.left - cardRect.width - gap
    }
    if (anchorRect.top > window.innerHeight * 0.72) {
      top = anchorRect.top - cardRect.height - gap
    }
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - cardRect.width - viewportPadding))
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - cardRect.height - viewportPadding))

    setStoryPosition({
      card: { left, top },
      spotlight: {
        left: anchorRect.left - 7,
        top: anchorRect.top - 7,
        width: anchorRect.width + 14,
        height: anchorRect.height + 14
      }
    })
  }, [activeStoryStep, mode])

  useLayoutEffect(() => {
    if (mode !== "guided" || activeStoryStep === undefined) {
      return
    }
    const anchor = document.querySelector<HTMLElement>(activeStoryStep.anchorSelector)
    if (activeStoryStep.anchorSelector.includes("inspector-")) {
      anchor?.scrollIntoView({ block: "center" })
    }
    const frame = window.requestAnimationFrame(updateStoryAnchor)
    const afterFocus = window.setTimeout(updateStoryAnchor, 420)
    window.addEventListener("resize", updateStoryAnchor)
    document
      .querySelector<HTMLElement>('[aria-label="Selected node details"]')
      ?.addEventListener("scroll", updateStoryAnchor)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(afterFocus)
      window.removeEventListener("resize", updateStoryAnchor)
      document
        .querySelector<HTMLElement>('[aria-label="Selected node details"]')
        ?.removeEventListener("scroll", updateStoryAnchor)
    }
  }, [activeStoryStep, mode, updateStoryAnchor])

  useEffect(() => {
    if (mode !== "guided" || activeStoryStep === undefined) {
      return
    }
    const focusIds = activeStoryStep.focusNodeIds ?? [activeStoryStep.nodeId]
    const frame = window.requestAnimationFrame(() => {
      void flowInstanceRef.current?.fitView({
        nodes: focusIds.map((id) => ({ id })),
        padding: focusIds.length === 1 ? 1.35 : 0.65,
        duration: 360,
        maxZoom: 1.15
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeStoryStep, mode])

  useEffect(() => {
    if (
      mode !== "explore" ||
      completedGraph === undefined ||
      hasCenteredExploreGraphRef.current ||
      flowInstanceRef.current === null
    ) {
      return
    }
    hasCenteredExploreGraphRef.current = true
    const frame = window.requestAnimationFrame(() => {
      const instance = flowInstanceRef.current
      if (instance === null) {
        return
      }
      const foundationId = focusExploreFoundation(
        instance,
        completedGraph.completedNodes,
        completedGraph.completedEdges
      )
      if (foundationId !== undefined) {
        setSelectedNodeId(foundationId)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [completedGraph, mode])

  useEffect(() => {
    if (mode !== "explore" || completedGraph === undefined || selectedGraphNode === undefined) {
      return
    }
    let isCurrent = true
    void completedGraph
      .loadCompletedNodeDetails(selectedGraphNode.id)
      .then((data) => {
        if (isCurrent) {
          setSelectedNodeDetails({ nodeId: selectedGraphNode.id, data })
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSelectedNodeDetails(undefined)
        }
      })
    return () => {
      isCurrent = false
    }
  }, [completedGraph, mode, selectedGraphNode])

  function updateLayer(relationship: RelationshipKind, isVisible: boolean) {
    setLayers((current) => ({ ...current, [relationship]: isVisible }))
  }

  function selectMode(nextMode: "explore" | "guided") {
    setMode(nextMode)
    setIsExplorePathFocused(false)
    if (nextMode === "guided") {
      setSelectedNodeId(activeStoryStep?.nodeId ?? "add-within-ten")
    } else {
      hasCenteredExploreGraphRef.current = false
      void ensureCompletedGraph()
    }
  }

  function advanceStory() {
    setStoryIndex((current) => (current + 1) % storySteps.length)
  }

  if (selectedNode === undefined) {
    throw new Error("The graph does not contain a selectable node.")
  }

  return (
    <main className={classes.app}>
      <header className={classes.header}>
        <div>
          <div className={classes.eyebrow}>
            <CompassNorthwestRegular />
            <Caption1Strong>TUTOR SKILLS ATLAS</Caption1Strong>
            <Badge appearance="tint" color="brand">
              Concept demo
            </Badge>
          </div>
          <h1 className={classes.headline}>See the learning path behind every result.</h1>
          <Body1 className={classes.intro}>
            Explore how atomic mathematics skills combine into outcomes, connect to external standards, and lead a
            learner to the right explanation.
          </Body1>
        </div>
        <div className={classes.metrics} aria-label="Graph summary">
          <div className={classes.metric}>
            <Text className={classes.metricValue}>{completedGraphMetadata.completedOutcomeCount}</Text>
            <Caption1 className={classes.metricLabel}>Learning Outcomes</Caption1>
          </div>
          <div className={classes.metric}>
            <Text className={classes.metricValue}>{completedGraphMetadata.atomicNodeCount}</Text>
            <Caption1 className={classes.metricLabel}>atomic skills</Caption1>
          </div>
          <div className={classes.metric}>
            <Text className={classes.metricValue}>{completedGraphMetadata.edgeCount}</Text>
            <Caption1 className={classes.metricLabel}>connections</Caption1>
          </div>
        </div>
      </header>

      <section className={classes.commandBar} aria-label="Graph controls">
        <TabList
          selectedValue={mode}
          onTabSelect={(_, data) => selectMode(data.value === "explore" ? "explore" : "guided")}
          aria-label="Experience mode"
        >
          <Tab value="guided" icon={<TargetArrowRegular />}>
            Guided story
          </Tab>
          <Tab value="explore" icon={<DataUsageRegular />}>
            Explore graph
          </Tab>
        </TabList>
      </section>

      <section className={classes.workspace}>
        <div className={classes.canvasShell}>
          {mode === "guided" && storyPosition !== undefined ? (
            <div className={classes.storySpotlight} style={storyPosition.spotlight} aria-hidden="true" />
          ) : null}
          {mode === "guided" && activeStoryStep !== undefined ? (
            <aside ref={storyCardRef} className={classes.storyCard} style={storyPosition?.card} aria-live="polite">
              <div className={classes.storyTopline}>
                <ArrowTrendingLinesRegular />
                <Caption1Strong>
                  INSIGHT {storyIndex + 1} OF {storySteps.length}
                </Caption1Strong>
              </div>
              <h3 className={classes.storyTitle}>{activeStoryStep.title}</h3>
              <Body1 className={classes.storyBody}>{activeStoryStep.body}</Body1>
              <div className={classes.storyProgress} aria-label="Guided story progress">
                {storySteps.map((step, index) => (
                  <button
                    type="button"
                    key={step.title}
                    className={mergeClasses(
                      classes.storyProgressStep,
                      index === storyIndex && classes.storyProgressStepActive
                    )}
                    aria-label={`Show insight ${index + 1}: ${step.title}`}
                    aria-current={index === storyIndex ? "step" : undefined}
                    onClick={() => setStoryIndex(index)}
                  />
                ))}
              </div>
              <div className={classes.storyActions}>
                <Button
                  appearance="primary"
                  icon={<ChevronRightRegular />}
                  iconPosition="after"
                  aria-label="Show the next insight"
                  onClick={advanceStory}
                >
                  Next insight
                </Button>
                <Button appearance="secondary" onClick={() => selectMode("explore")}>
                  Explore freely
                </Button>
              </div>
            </aside>
          ) : null}
          {mode === "explore" && completedGraph === undefined ? (
            <output className={classes.graphLoading}>
              <span className={classes.graphLoadingMark} aria-hidden="true" />
              Loading the completed skills graph…
            </output>
          ) : null}
          <GraphCanvas
            key={mode}
            className={classes.canvas}
            mode={mode}
            nodes={displayedNodes}
            edges={displayedEdges}
            nodeTypes={mode === "guided" ? guidedNodeTypes : exploreNodeTypes}
            highlightedNodeIds={prerequisiteIds}
            onInit={(instance) => {
              flowInstanceRef.current = instance
              if (mode === "explore" && completedGraph !== undefined) {
                const foundationId = focusExploreFoundation(
                  instance,
                  completedGraph.completedNodes,
                  completedGraph.completedEdges
                )
                if (foundationId !== undefined) {
                  hasCenteredExploreGraphRef.current = true
                  setSelectedNodeId(foundationId)
                }
              }
            }}
            onNodeClick={(_, node) => {
              if (mode === "explore" && selectedNodeId === node.id && isExplorePathFocused) {
                setIsExplorePathFocused(false)
                return
              }
              setSelectedNodeId(node.id)
              setIsExplorePathFocused(mode === "explore")
            }}
            onMove={(_, viewport) => {
              if (mode !== "explore") {
                return
              }
              const connectionsHidden = viewport.zoom < MIN_CONNECTION_RENDER_ZOOM
              if (connectionsHidden !== connectionsHiddenRef.current) {
                connectionsHiddenRef.current = connectionsHidden
                setExploreViewport(viewport)
              }
            }}
            onNodeDragStop={(_, node) => {
              setNodePositionOverrides((current) => ({
                ...current,
                [node.id]: node.position
              }))
            }}
            onPaneClick={() => {
              if (mode === "explore") {
                setIsExplorePathFocused(false)
              }
            }}
            onMoveEnd={(_, viewport) => {
              if (mode === "explore") {
                connectionsHiddenRef.current = viewport.zoom < MIN_CONNECTION_RENDER_ZOOM
                setExploreViewport(viewport)
              } else {
                updateStoryAnchor()
              }
            }}
          />
          <div className={classes.legend} aria-label="Toggle relationship types">
            {connectionsHiddenForZoom ? (
              <Caption1 className={classes.legendZoomHint}>Zoom in to show connections</Caption1>
            ) : null}
            {(["requires", "supports"] as const).map((relationship) => {
              const label = relationshipLabel(relationship)
              return (
                <Button
                  appearance="subtle"
                  size="small"
                  aria-label={`${layers[relationship] ? "Hide" : "Show"} ${label.toLowerCase()}`}
                  aria-pressed={layers[relationship]}
                  className={mergeClasses(
                    classes.legendButton,
                    layers[relationship] ? classes.legendButtonActive : classes.legendButtonInactive
                  )}
                  key={relationship}
                  data-story-anchor={`legend-${relationship}`}
                  onClick={() => updateLayer(relationship, !layers[relationship])}
                >
                  <span
                    className={mergeClasses(classes.connectionSample, relationshipVisualClasses[relationship])}
                    aria-hidden="true"
                  />
                  <Caption1>{relationshipShortLabels[relationship]}</Caption1>
                </Button>
              )
            })}
          </div>
        </div>

        <aside className={classes.inspector} aria-label="Selected node details">
          <div className={classes.inspectorHeader}>
            <Caption1Strong className={classes.inspectorKind}>
              {selectedNode.data.kind === "atomic" ? "Atomic skill" : selectedNode.data.kind}
            </Caption1Strong>
            <Badge className={classes.confidenceBadge} appearance="filled" color="brand">
              {Math.round(selectedNode.data.confidence * 100)}% confidence
            </Badge>
          </div>
          <h2 className={classes.inspectorTitle}>{selectedNode.data.label}</h2>
          <Body1 className={classes.definition}>{selectedNode.data.definition}</Body1>

          <section className={classes.section}>
            <h3 className={classes.sectionHeading}>Why this matters</h3>
            <Body1>{selectedNode.data.whyItMatters}</Body1>
          </section>

          {selectedNode.data.evidence.length > 0 ? (
            <section className={classes.section} data-story-anchor="inspector-evidence">
              <h3 className={classes.sectionHeading}>Observable evidence</h3>
              <ul className={classes.evidenceList}>
                {selectedNode.data.evidence.map((item) => (
                  <li className={classes.evidenceItem} key={item}>
                    <Body1>{item}</Body1>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {selectedNode.data.kind === "resource" ? null : (
            <section className={classes.section} data-story-anchor="inspector-standards">
              <h3 className={classes.sectionHeading}>Standards mappings</h3>
              {selectedNode.data.mappings.length === 0 ? (
                <Caption1 className={classes.noContent}>No direct standards mapping on this node.</Caption1>
              ) : (
                <div className={classes.mappingList}>
                  {selectedNode.data.mappings.map((mapping) => (
                    <div className={classes.mappingCard} key={`${mapping.framework}-${mapping.code}`}>
                      {mapping.url === undefined || mapping.url.length === 0 ? (
                        <Text weight="semibold">{mapping.framework}</Text>
                      ) : (
                        <Link href={mapping.url} target="_blank" rel="noreferrer">
                          {mapping.framework}
                        </Link>
                      )}
                      <Text>{mapping.code}</Text>
                      {mapping.statement === undefined ? null : (
                        <Caption1 className={classes.mappingStatement}>{mapping.statement}</Caption1>
                      )}
                      <Caption1 className={classes.mappingMeta}>{mapping.relation}</Caption1>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className={classes.section} data-story-anchor="inspector-resources">
            <h3 className={classes.sectionHeading}>Learning resources</h3>
            {selectedNode.data.resources.length === 0 ? (
              <Caption1 className={classes.noContent}>Resources will be attached after instructional review.</Caption1>
            ) : (
              <div className={classes.mappingList}>
                {selectedNode.data.resources.map((resource) => (
                  <div className={classes.mappingCard} key={resource.url}>
                    <Link href={resource.url} target="_blank" rel="noreferrer">
                      <BookOpenRegular /> {resource.title}
                    </Link>
                    <Caption1 className={classes.mappingMeta}>
                      {resource.provider}, {resource.format}
                    </Caption1>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(selectedNode.data.learningActivities?.length ?? 0) > 0 ? (
            <section className={classes.section}>
              <h3 className={classes.sectionHeading}>Learning activities</h3>
              <div className={classes.mappingList}>
                {selectedNode.data.learningActivities?.map((activity) => (
                  <div
                    className={classes.mappingCard}
                    key={`${activity.provider}-${activity.activityType}-${activity.title}`}
                  >
                    {activity.url === undefined || activity.url.length === 0 ? (
                      <Text weight="semibold">{activity.title}</Text>
                    ) : (
                      <Link href={activity.url} target="_blank" rel="noreferrer">
                        <BookOpenRegular /> {activity.title}
                      </Link>
                    )}
                    <Caption1 className={classes.mappingMeta}>
                      {activity.provider}, {activity.activityType.replaceAll("_", " ")}
                    </Caption1>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  )
}
