import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dagre from "@dagrejs/dagre"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const graphPath = path.resolve(scriptDirectory, "../src/graph/completedGraph.json")

const NODE_WIDTH = 300
const NODE_HEIGHT = 150
const MARGIN = 80
const COMPACT_NODE_GAP = 28
const compactExistingLayout = process.argv.includes("--compact-existing")

const graphDocument = JSON.parse(fs.readFileSync(graphPath, "utf8"))
const nodesById = new Map(graphDocument.nodes.map((node) => [node.id, node]))
const hierarchyEdges = graphDocument.edges.filter((edge) => edge.data?.hierarchyApplied)
const layoutGraph = new dagre.graphlib.Graph({ multigraph: true })

layoutGraph.setGraph({
  rankdir: "BT",
  ranker: "network-simplex",
  align: "UL",
  nodesep: 64,
  edgesep: 28,
  ranksep: 110,
  marginx: MARGIN,
  marginy: MARGIN,
  acyclicer: "greedy"
})
layoutGraph.setDefaultEdgeLabel(() => ({}))

for (const node of graphDocument.nodes) {
  layoutGraph.setNode(node.id, {
    width: NODE_WIDTH,
    height: NODE_HEIGHT
  })
  delete node.data.layoutCluster
}

for (const edge of hierarchyEdges) {
  layoutGraph.setEdge(
    edge.source,
    edge.target,
    {
      minlen: 1,
      weight: edge.data.relationship === "requires" ? 12 : 2
    },
    edge.id
  )
}

if (!compactExistingLayout) {
  dagre.layout(layoutGraph)
}

function getLayoutPosition(node) {
  if (compactExistingLayout) {
    return {
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y + NODE_HEIGHT / 2
    }
  }
  return layoutGraph.node(node.id)
}

const nodesByRank = new Map()
for (const node of graphDocument.nodes) {
  const position = getLayoutPosition(node)
  const rankKey = Math.round(position.y)
  const rankNodes = nodesByRank.get(rankKey) ?? []
  rankNodes.push({ node, position })
  nodesByRank.set(rankKey, rankNodes)
}

const hierarchyNeighbors = new Map(graphDocument.nodes.map((node) => [node.id, { hard: [], support: [] }]))
for (const edge of hierarchyEdges) {
  const bucket = edge.data.relationship === "requires" ? "hard" : "support"
  hierarchyNeighbors.get(edge.source)?.[bucket].push(edge.target)
  hierarchyNeighbors.get(edge.target)?.[bucket].push(edge.source)
}

const orderedRanks = [...nodesByRank.entries()].sort((left, right) => left[0] - right[0])
for (const [, rankNodes] of orderedRanks) {
  rankNodes.sort((left, right) => left.position.x - right.position.x)
}

function reorderRank(rankNodes) {
  const currentOrder = new Map(rankNodes.map(({ node }, index) => [node.id, index]))
  const globalOrder = new Map()
  for (const [, candidateRank] of orderedRanks) {
    const denominator = Math.max(1, candidateRank.length - 1)
    candidateRank.forEach(({ node }, index) => globalOrder.set(node.id, index / denominator))
  }
  rankNodes.sort((left, right) => {
    function score(entry) {
      const neighbors = hierarchyNeighbors.get(entry.node.id)
      const selectedNeighbors = neighbors.hard.length > 0 ? neighbors.hard : neighbors.support
      const positions = selectedNeighbors.map((id) => globalOrder.get(id)).filter((value) => value !== undefined)
      if (positions.length === 0) {
        return undefined
      }
      return positions.reduce((sum, value) => sum + value, 0) / positions.length
    }
    const leftScore = score(left)
    const rightScore = score(right)
    if (leftScore === undefined && rightScore === undefined) {
      return currentOrder.get(left.node.id) - currentOrder.get(right.node.id)
    }
    if (leftScore === undefined) {
      return 1
    }
    if (rightScore === undefined) {
      return -1
    }
    return leftScore - rightScore || currentOrder.get(left.node.id) - currentOrder.get(right.node.id)
  })
}

for (let sweep = 0; sweep < 8; sweep += 1) {
  for (const [, rankNodes] of orderedRanks) {
    reorderRank(rankNodes)
  }
  for (const [, rankNodes] of orderedRanks.toReversed()) {
    reorderRank(rankNodes)
  }
}

const widestRankCount = Math.max(...[...nodesByRank.values()].map((rankNodes) => rankNodes.length))
const compactWidth = widestRankCount * NODE_WIDTH + Math.max(0, widestRankCount - 1) * COMPACT_NODE_GAP

for (const rankNodes of nodesByRank.values()) {
  const rankWidth = rankNodes.length * NODE_WIDTH + Math.max(0, rankNodes.length - 1) * COMPACT_NODE_GAP
  const rankStartX = MARGIN + (compactWidth - rankWidth) / 2
  rankNodes.forEach(({ node }, index) => {
    node.position = {
      x: Math.round(rankStartX + index * (NODE_WIDTH + COMPACT_NODE_GAP)),
      y: Math.round(getLayoutPosition(node).y - NODE_HEIGHT / 2)
    }
  })
}

const primaryFoundation = graphDocument.nodes.find(
  (node) => node.data.kind === "atomic" && node.data.label === "Produce the whole-number counting sequence through 10"
)
if (primaryFoundation !== undefined) {
  const primaryParentIds = hierarchyEdges
    .filter((edge) => edge.source === primaryFoundation.id && edge.data.relationship === "requires")
    .map((edge) => edge.target)
  for (const parentId of primaryParentIds) {
    const parent = nodesById.get(parentId)
    if (parent === undefined) {
      continue
    }
    const parentRank = [...nodesByRank.values()].find((rankNodes) =>
      rankNodes.some(({ node }) => node.id === parent.id)
    )
    const nearestSlot = parentRank
      ?.map(({ node }) => node)
      .toSorted(
        (left, right) =>
          Math.abs(left.position.x - primaryFoundation.position.x) -
          Math.abs(right.position.x - primaryFoundation.position.x)
      )[0]
    if (nearestSlot !== undefined && nearestSlot.id !== parent.id) {
      const parentX = parent.position.x
      parent.position.x = nearestSlot.position.x
      nearestSlot.position.x = parentX
    }
  }
}

for (const node of graphDocument.nodes) {
  if (node.position === undefined) {
    throw new Error(`Layout did not position node ${node.id}`)
  }
}

let respectedHierarchyEdges = 0
let hardRequirementEdges = 0
let respectedHardRequirementEdges = 0
for (const edge of hierarchyEdges) {
  const source = nodesById.get(edge.source)
  const target = nodesById.get(edge.target)
  const isRespected = source.position.y > target.position.y
  edge.data.layoutRespected = isRespected
  if (isRespected) {
    respectedHierarchyEdges += 1
  }
  if (edge.data.relationship === "requires") {
    hardRequirementEdges += 1
    if (isRespected) {
      respectedHardRequirementEdges += 1
    }
  }
}

const layoutMetadata = layoutGraph.graph()
const compactHeight = Math.max(...graphDocument.nodes.map((node) => node.position.y + NODE_HEIGHT)) + MARGIN
graphDocument.metadata.layout = {
  algorithm: "dagre-network-simplex-compact-ranks",
  direction: "bottom-to-top",
  hardRequirementWeight: 12,
  supportingKnowledgeWeight: 2,
  width: Math.round(compactWidth + MARGIN * 2),
  height: Math.round(compactExistingLayout ? compactHeight : (layoutMetadata.height ?? 0)),
  hierarchyEdgesRespected: respectedHierarchyEdges,
  hierarchyEdgeCount: hierarchyEdges.length,
  hardRequirementEdgesRespected: respectedHardRequirementEdges,
  hardRequirementEdgeCount: hardRequirementEdges
}
delete graphDocument.layoutClusters

fs.writeFileSync(graphPath, `${JSON.stringify(graphDocument, null, 2)}\n`, "utf8")
process.stdout.write(`${JSON.stringify(graphDocument.metadata.layout)}\n`)
