import { describe, expect, it } from "vitest"
import { initialEdges, initialNodes } from "./graphData"
import { layoutKnowledgeNodes } from "./graphLayout"

describe("graph layout", () => {
  it("places every prerequisite below the skill it feeds", () => {
    const nodes = layoutKnowledgeNodes(initialNodes, initialEdges)
    const positionById = new Map(nodes.map((node) => [node.id, node.position]))

    for (const edge of initialEdges) {
      if (edge.data?.relationship !== "requires" && edge.data?.relationship !== "supports") {
        continue
      }
      const source = positionById.get(edge.source)
      const target = positionById.get(edge.target)
      expect(source?.y).toBeGreaterThan(target?.y ?? Number.POSITIVE_INFINITY)
    }
  })
  it("keeps learning resources in node metadata rather than the canvas", () => {
    expect(initialNodes.some((node) => node.data.kind === "resource")).toBe(false)
    expect(initialEdges.some((edge) => edge.data?.relationship === "resource")).toBe(false)
    expect(initialNodes.find((node) => node.id === "add-within-ten")?.data.resources).toHaveLength(1)
  })
})
