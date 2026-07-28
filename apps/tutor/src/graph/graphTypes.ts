import type { Edge, Node } from "@xyflow/react"

export type KnowledgeNodeKind = "atomic" | "outcome" | "resource"

export type RelationshipKind = "requires" | "supports" | "resource"

export type SourceMapping = {
  framework: string
  code: string
  relation: string
  statement?: string
  url?: string
}

export type LearningResource = {
  provider: string
  title: string
  format: string
  url: string
}

export type LearningActivity = {
  provider: string
  title: string
  activityType: string
  url?: string
}

export type KnowledgeNodeData = {
  label: string
  shortLabel: string
  kind: KnowledgeNodeKind
  definition: string
  whyItMatters: string
  evidence: readonly string[]
  mappings: readonly SourceMapping[]
  resources: readonly LearningResource[]
  learningActivities?: readonly LearningActivity[]
  stage: number
  confidence: number
  hasResources?: boolean
}

export type KnowledgeNode = Node<KnowledgeNodeData, "knowledge">

export type KnowledgeEdgeData = {
  relationship: RelationshipKind
  rationale: string
}

export type KnowledgeEdge = Edge<KnowledgeEdgeData>

export type LayerSettings = Record<RelationshipKind, boolean>
