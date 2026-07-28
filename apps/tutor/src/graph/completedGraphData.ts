import completedGraph from "./completedGraphCanvas.json"
import type { KnowledgeEdge, KnowledgeNode, KnowledgeNodeData, KnowledgeNodeKind, RelationshipKind } from "./graphTypes"

function normalizeNodeKind(value: string): KnowledgeNodeKind {
  if (value === "atomic" || value === "outcome" || value === "resource") {
    return value
  }
  throw new Error(`Unsupported completed-graph node kind: ${value}`)
}

function normalizeRelationship(value: string): RelationshipKind {
  if (value === "requires" || value === "supports" || value === "resource") {
    return value
  }
  throw new Error(`Unsupported completed-graph relationship: ${value}`)
}

export const completedGraphMetadata = completedGraph.metadata

export const completedNodes: KnowledgeNode[] = completedGraph.nodes.map(
  (node): KnowledgeNode => ({
    id: node.id,
    type: "knowledge",
    position: node.position,
    data: {
      label: node.data.label,
      shortLabel: node.data.shortLabel,
      kind: normalizeNodeKind(node.data.kind),
      definition: "",
      whyItMatters: "",
      evidence: [],
      mappings: [],
      resources: [],
      learningActivities: [],
      stage: node.data.stage,
      confidence: node.data.confidence,
      hasResources: node.data.hasResources
    }
  })
)

export const completedEdges: KnowledgeEdge[] = completedGraph.edges.map(
  (edge): KnowledgeEdge => ({
    ...edge,
    data: {
      ...edge.data,
      relationship: normalizeRelationship(edge.data.relationship),
      rationale: ""
    }
  })
)

const detailCache = new Map<string, Promise<KnowledgeNodeData>>()

export function loadCompletedNodeDetails(nodeId: string) {
  if (import.meta.env.MODE === "test") {
    return Promise.reject(new Error("Node details are loaded over HTTP only outside tests."))
  }
  let request = detailCache.get(nodeId)
  if (request === undefined) {
    request = fetch(`/graph-details/${encodeURIComponent(nodeId)}.json`).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load graph details for ${nodeId}.`)
      }
      return (await response.json()) as KnowledgeNodeData
    })
    detailCache.set(nodeId, request)
  }
  return request
}
