import { describe, expect, it } from "vitest"
import completedGraph from "./completedGraph.json"
import { completedEdges, completedGraphMetadata, completedNodes } from "./completedGraphData"

describe("completed graph data", () => {
  it("loads every completed outcome and its atomic graph", () => {
    const outcomes = completedNodes.filter((node) => node.data.kind === "outcome")
    const atomicNodes = completedNodes.filter((node) => node.data.kind === "atomic")

    expect(outcomes).toHaveLength(completedGraphMetadata.completedOutcomeCount)
    expect(atomicNodes).toHaveLength(completedGraphMetadata.atomicNodeCount)
    expect(completedEdges).toHaveLength(completedGraphMetadata.edgeCount)
    expect(
      completedEdges.every((edge) => edge.data?.relationship === "requires" || edge.data?.relationship === "supports")
    ).toBe(true)
  })

  it("places every hierarchy edge below the skill it enables", () => {
    const positions = new Map(completedGraph.nodes.map((node) => [node.id, node.position]))
    const hierarchyEdges = completedGraph.edges.filter((edge) => edge.data.hierarchyApplied)

    expect(hierarchyEdges.length).toBeGreaterThan(0)
    for (const edge of hierarchyEdges) {
      expect(positions.get(edge.source)?.y).toBeGreaterThan(positions.get(edge.target)?.y ?? Number.POSITIVE_INFINITY)
    }
  })

  it("places every hard prerequisite below the skill it enables across the full graph", () => {
    const positions = new Map(completedGraph.nodes.map((node) => [node.id, node.position]))
    const hardRequirements = completedGraph.edges.filter(
      (edge) => edge.data.hierarchyApplied && edge.data.relationship === "requires"
    )

    expect(hardRequirements.length).toBeGreaterThan(0)
    for (const edge of hardRequirements) {
      expect(positions.get(edge.source)?.y).toBeGreaterThan(positions.get(edge.target)?.y ?? Number.POSITIVE_INFINITY)
    }
  })

  it("uses the layered bottom-to-top DAG layout", () => {
    expect(completedGraph.metadata.layout).toMatchObject({
      algorithm: "dagre-network-simplex-compact-ranks",
      direction: "bottom-to-top"
    })
    expect(completedGraph.metadata.layout.hardRequirementWeight).toBeGreaterThan(
      completedGraph.metadata.layout.supportingKnowledgeWeight
    )
  })
})
