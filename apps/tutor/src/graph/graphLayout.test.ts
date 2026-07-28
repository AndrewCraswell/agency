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

  it("keeps informational resources beside the skill they explain", () => {
    const nodes = layoutKnowledgeNodes(initialNodes, initialEdges)
    const outcome = nodes.find((node) => node.id === "add-within-ten")
    const resource = nodes.find((node) => node.id === "khan")

    expect(resource?.position.y).toBe(outcome?.position.y)
    expect(resource?.position.x).toBeGreaterThan(outcome?.position.x ?? Number.POSITIVE_INFINITY)
  })
})
