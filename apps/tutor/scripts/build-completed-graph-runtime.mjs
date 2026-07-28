import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDirectory, "..")
const sourcePath = path.join(appRoot, "src/graph/completedGraph.json")
const canvasPath = path.join(appRoot, "src/graph/completedGraphCanvas.json")
const detailDirectory = path.join(appRoot, "public/graph-details")

const graph = JSON.parse(fs.readFileSync(sourcePath, "utf8"))
const canvasGraph = {
  metadata: graph.metadata,
  nodes: graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    initialWidth: 300,
    initialHeight: 150,
    data: {
      label: node.data.label,
      shortLabel: node.data.shortLabel,
      kind: node.data.kind,
      stage: node.data.stage,
      confidence: node.data.confidence,
      hasResources: node.data.resources.length > 0
    }
  })),
  edges: graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: {
      relationship: edge.data.relationship
    }
  }))
}

fs.mkdirSync(detailDirectory, { recursive: true })
fs.writeFileSync(canvasPath, `${JSON.stringify(canvasGraph)}\n`, "utf8")

for (const node of graph.nodes) {
  fs.writeFileSync(path.join(detailDirectory, `${node.id}.json`), `${JSON.stringify(node.data)}\n`, "utf8")
}

process.stdout.write(
  `${JSON.stringify({
    canvasBytes: fs.statSync(canvasPath).size,
    detailCount: graph.nodes.length,
    edgeCount: graph.edges.length
  })}\n`
)
