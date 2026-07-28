import type { Viewport } from "@xyflow/react"
import type { KnowledgeEdge, KnowledgeNode, LayerSettings, RelationshipKind } from "./graphTypes"

const EXPLORE_NODE_WIDTH = 300
const EXPLORE_NODE_HEIGHT = 150
export const MIN_CONNECTION_RENDER_ZOOM = 0.1

export const defaultLayers: LayerSettings = {
  requires: true,
  supports: true,
  resource: true
}

export function filterGraph(nodes: readonly KnowledgeNode[], edges: readonly KnowledgeEdge[], layers: LayerSettings) {
  const visibleEdges = edges.filter((edge) => edge.data !== undefined && layers[edge.data.relationship])
  const visibleNodes = layers.resource ? nodes : nodes.filter((node) => node.data.kind !== "resource")
  return { nodes: visibleNodes, edges: visibleEdges }
}

export function getFoundationalExploreNodeId(nodes: readonly KnowledgeNode[], edges: readonly KnowledgeEdge[]) {
  const countingFoundation = nodes.find(
    (node) =>
      node.data.kind === "atomic" &&
      node.data.label.toLocaleLowerCase() === "produce the whole-number counting sequence through 10"
  )
  if (countingFoundation !== undefined) {
    return countingFoundation.id
  }

  const hardIncoming = new Set(
    edges.filter((edge) => edge.data?.relationship === "requires").map((edge) => edge.target)
  )
  const hardOutgoing = new Set(
    edges.filter((edge) => edge.data?.relationship === "requires").map((edge) => edge.source)
  )
  return nodes
    .filter((node) => node.data.kind === "atomic" && !hardIncoming.has(node.id) && hardOutgoing.has(node.id))
    .toSorted(
      (left, right) =>
        left.data.stage - right.data.stage || right.position.y - left.position.y || left.position.x - right.position.x
    )[0]?.id
}

export function getFoundationFocusNodeIds(foundationId: string, edges: readonly KnowledgeEdge[]) {
  const hardParents = edges
    .filter((edge) => edge.source === foundationId && edge.data?.relationship === "requires")
    .slice(0, 4)
    .map((edge) => edge.target)
  const directParents =
    hardParents.length > 0
      ? hardParents
      : edges
          .filter((edge) => edge.source === foundationId && edge.data?.relationship === "supports")
          .slice(0, 2)
          .map((edge) => edge.target)

  return [foundationId, ...new Set(directParents)]
}

export function getViewportOptimizedEdges(
  edges: readonly KnowledgeEdge[],
  nodeById: ReadonlyMap<string, KnowledgeNode>,
  viewport: Viewport,
  viewportSize: { width: number; height: number },
  alwaysVisibleNodeIds?: ReadonlySet<string>
) {
  if (viewport.zoom < MIN_CONNECTION_RENDER_ZOOM) {
    return []
  }
  if (edges.length <= 700) {
    return edges
  }

  const margin = 360
  const centerX = viewportSize.width / 2
  const centerY = viewportSize.height / 2
  const supportCandidates: Array<{ edge: KnowledgeEdge; distance: number }> = []
  const requirementCandidates: Array<{ edge: KnowledgeEdge; distance: number }> = []
  const resourceCandidates: Array<{ edge: KnowledgeEdge; distance: number }> = []
  const retainedIds = new Set<string>()

  for (const edge of edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (source === undefined || target === undefined) {
      continue
    }
    const sourceX = source.position.x * viewport.zoom + viewport.x
    const sourceY = source.position.y * viewport.zoom + viewport.y
    const targetX = target.position.x * viewport.zoom + viewport.x
    const targetY = target.position.y * viewport.zoom + viewport.y
    const sourceVisible =
      sourceX + EXPLORE_NODE_WIDTH * viewport.zoom >= -margin &&
      sourceX <= viewportSize.width + margin &&
      sourceY + EXPLORE_NODE_HEIGHT * viewport.zoom >= -margin &&
      sourceY <= viewportSize.height + margin
    const targetVisible =
      targetX + EXPLORE_NODE_WIDTH * viewport.zoom >= -margin &&
      targetX <= viewportSize.width + margin &&
      targetY + EXPLORE_NODE_HEIGHT * viewport.zoom >= -margin &&
      targetY <= viewportSize.height + margin
    const isHighlighted = alwaysVisibleNodeIds?.has(edge.source) === true && alwaysVisibleNodeIds.has(edge.target)
    if ((!sourceVisible || !targetVisible) && !(isHighlighted && (sourceVisible || targetVisible))) {
      continue
    }
    const midpointX = (sourceX + targetX) / 2
    const midpointY = (sourceY + targetY) / 2
    const candidate = {
      edge,
      distance: Math.hypot(midpointX - centerX, midpointY - centerY)
    }
    if (edge.data?.relationship === "supports") {
      supportCandidates.push(candidate)
    } else if (edge.data?.relationship === "requires") {
      requirementCandidates.push(candidate)
    } else {
      resourceCandidates.push(candidate)
    }
  }

  const supportLimit = viewport.zoom < 0.3 ? 120 : 700
  const requirementLimit = viewport.zoom < 0.3 ? 180 : 900
  for (const candidate of supportCandidates
    .toSorted((left, right) => left.distance - right.distance)
    .slice(0, supportLimit)) {
    retainedIds.add(candidate.edge.id)
  }
  for (const candidate of requirementCandidates
    .toSorted((left, right) => left.distance - right.distance)
    .slice(0, requirementLimit)) {
    retainedIds.add(candidate.edge.id)
  }
  for (const candidate of resourceCandidates) {
    retainedIds.add(candidate.edge.id)
  }

  return edges.filter((edge) => retainedIds.has(edge.id))
}

export function getPrerequisiteNodeIds(targetId: string, edges: readonly KnowledgeEdge[]) {
  const incomingRequirements = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.data?.relationship !== "requires") {
      continue
    }
    const sources = incomingRequirements.get(edge.target) ?? []
    sources.push(edge.source)
    incomingRequirements.set(edge.target, sources)
  }

  const prerequisites = new Set<string>()
  const pending = [targetId]
  while (pending.length > 0) {
    const nodeId = pending.pop()
    if (nodeId === undefined || prerequisites.has(nodeId)) {
      continue
    }
    prerequisites.add(nodeId)
    pending.push(...(incomingRequirements.get(nodeId) ?? []))
  }

  return prerequisites
}

export function getPreferredLearningPathNodeIds(targetId: string, edges: readonly KnowledgeEdge[]) {
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.data?.relationship !== "requires" && edge.data?.relationship !== "supports") {
      continue
    }
    const sources = incoming.get(edge.target) ?? []
    sources.push(edge.source)
    incoming.set(edge.target, sources)
  }

  const preferredPath = new Set<string>()
  const pending = [targetId]
  while (pending.length > 0) {
    const nodeId = pending.pop()
    if (nodeId === undefined || preferredPath.has(nodeId)) {
      continue
    }
    preferredPath.add(nodeId)
    for (const sourceId of incoming.get(nodeId) ?? []) {
      if (!preferredPath.has(sourceId)) {
        pending.push(sourceId)
      }
    }
  }

  return preferredPath
}

export function buildLearningStages(
  targetId: string,
  nodes: readonly KnowledgeNode[],
  edges: readonly KnowledgeEdge[]
) {
  const prerequisiteIds = getPrerequisiteNodeIds(targetId, edges)
  const prerequisiteNodes = nodes.filter((node) => prerequisiteIds.has(node.id))
  const stageNumbers = [...new Set(prerequisiteNodes.map((node) => node.data.stage))].sort((a, b) => a - b)

  return stageNumbers.map((stage) => ({
    stage,
    nodes: prerequisiteNodes.filter((node) => node.data.stage === stage)
  }))
}

export function relationshipLabel(relationship: RelationshipKind) {
  const labels: Record<RelationshipKind, string> = {
    requires: "Hard prerequisites",
    supports: "Supporting knowledge",
    resource: "Learning resources"
  }
  return labels[relationship]
}
