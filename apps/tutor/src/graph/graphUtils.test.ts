import { describe, expect, it } from "vitest"
import { initialEdges, initialNodes } from "./graphData"
import {
  buildLearningStages,
  defaultLayers,
  filterGraph,
  getFoundationalExploreNodeId,
  getFoundationFocusNodeIds,
  getPreferredLearningPathNodeIds,
  getPrerequisiteNodeIds,
  getViewportOptimizedEdges,
  MIN_CONNECTION_RENDER_ZOOM,
  relationshipLabel
} from "./graphUtils"

describe("graph utilities", () => {
  it("filters relationship layers and removes disconnected reference nodes", () => {
    const result = filterGraph(initialNodes, initialEdges, {
      ...defaultLayers,
      resource: false
    })

    expect(result.edges.every((edge) => edge.data?.relationship !== "resource")).toBe(true)
    expect(result.nodes.some((node) => node.data.kind === "resource")).toBe(false)
  })

  it("finds the complete hard-prerequisite closure", () => {
    expect(getPrerequisiteNodeIds("add-within-ten", initialEdges)).toEqual(
      new Set([
        "add-within-ten",
        "represent-addition",
        "derive-sums",
        "recognize-numerals",
        "compose-quantities",
        "count-objects",
        "count-sequence"
      ])
    )
  })

  it("anchors exploration on the earliest connected foundation and its direct parents", () => {
    expect(getFoundationalExploreNodeId(initialNodes, initialEdges)).toBe("count-sequence")
    expect(getFoundationFocusNodeIds("count-sequence", initialEdges)).toEqual([
      "count-sequence",
      "count-objects",
      "derive-sums"
    ])
  })

  it("hides connections at overview zoom levels", () => {
    expect(
      getViewportOptimizedEdges(
        initialEdges,
        new Map(initialNodes.map((node) => [node.id, node])),
        { x: 0, y: 0, zoom: MIN_CONNECTION_RENDER_ZOOM - 0.01 },
        { width: 1200, height: 800 }
      )
    ).toEqual([])
  })

  it("culls and prioritizes dense viewport connections", () => {
    const denseEdges = Array.from({ length: 702 }, (_, index) => ({
      ...initialEdges[index % initialEdges.length],
      id: `dense-${index}`
    }))
    const visibleEdges = getViewportOptimizedEdges(
      denseEdges,
      new Map(initialNodes.map((node) => [node.id, node])),
      { x: 0, y: 0, zoom: 0.2 },
      { width: 1200, height: 800 },
      new Set(initialNodes.map((node) => node.id))
    )

    expect(visibleEdges.length).toBeGreaterThan(0)
    expect(visibleEdges.length).toBeLessThan(denseEdges.length)
    expect(visibleEdges.some((edge) => edge.data?.relationship === "requires")).toBe(true)
    expect(visibleEdges.some((edge) => edge.data?.relationship === "supports")).toBe(true)
  })

  it("groups the minimum learning plan into topological stages", () => {
    const stages = buildLearningStages("add-within-ten", initialNodes, initialEdges)
    expect(stages.map(({ stage }) => stage)).toEqual([1, 2, 3, 4, 5])
    expect(stages.at(-1)?.nodes.map(({ id }) => id)).toEqual(["add-within-ten"])
  })

  it("adds supporting routes and the hard prerequisites behind them", () => {
    const edges = [
      ...initialEdges,
      {
        id: "supporting-route",
        source: "supporting-skill",
        target: "add-within-ten",
        data: { relationship: "supports" as const, rationale: "A preferred supporting route." }
      },
      {
        id: "supporting-foundation",
        source: "supporting-foundation",
        target: "supporting-skill",
        data: { relationship: "requires" as const, rationale: "Required by the supporting skill." }
      }
    ]

    expect(getPreferredLearningPathNodeIds("add-within-ten", edges)).toEqual(
      new Set([...getPrerequisiteNodeIds("add-within-ten", initialEdges), "supporting-skill", "supporting-foundation"])
    )
  })

  it("provides readable labels for every relationship", () => {
    expect(relationshipLabel("requires")).toBe("Hard prerequisites")
    expect(relationshipLabel("supports")).toBe("Supporting knowledge")
    expect(relationshipLabel("resource")).toBe("Learning resources")
  })
})
