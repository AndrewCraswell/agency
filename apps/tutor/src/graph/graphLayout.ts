import type { KnowledgeEdge, KnowledgeNode } from "./graphTypes"

const nodeWidth = 300
const rowGap = 56
const rowWidth = 980
const topOffset = 40
const rankHeight = 230
const referenceColumnX = 1020

export function layoutKnowledgeNodes(nodes: readonly KnowledgeNode[], edges: readonly KnowledgeEdge[]) {
  const skillNodes = nodes.filter((node) => node.data.kind !== "resource")
  const rankById = new Map(skillNodes.map((node) => [node.id, 0]))

  for (let pass = 0; pass < skillNodes.length; pass += 1) {
    let hasChanged = false
    for (const edge of edges) {
      if (edge.data?.relationship !== "requires" && edge.data?.relationship !== "supports") {
        continue
      }
      const sourceRank = rankById.get(edge.source)
      const targetRank = rankById.get(edge.target)
      if (sourceRank === undefined || targetRank === undefined || sourceRank > targetRank) {
        continue
      }
      rankById.set(edge.source, targetRank + 1)
      hasChanged = true
    }
    if (!hasChanged) {
      break
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  const maximumRank = Math.max(...rankById.values())
  for (let rank = 0; rank <= maximumRank; rank += 1) {
    const row = skillNodes
      .filter((node) => rankById.get(node.id) === rank)
      .sort((left, right) => left.position.x - right.position.x)
    const occupiedWidth = row.length * nodeWidth + Math.max(0, row.length - 1) * rowGap
    const startingX = Math.max(topOffset, (rowWidth - occupiedWidth) / 2)
    row.forEach((node, index) => {
      positions.set(node.id, {
        x: startingX + index * (nodeWidth + rowGap),
        y: topOffset + rank * rankHeight
      })
    })
  }

  for (const node of nodes) {
    if (node.data.kind !== "resource") {
      continue
    }
    const incomingEdge = edges.find((edge) => edge.target === node.id && edge.data?.relationship === "resource")
    const sourcePosition = incomingEdge === undefined ? undefined : positions.get(incomingEdge.source)
    positions.set(node.id, { x: referenceColumnX, y: sourcePosition?.y ?? topOffset })
  }

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }))
}
