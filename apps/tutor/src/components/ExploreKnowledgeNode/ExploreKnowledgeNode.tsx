import { Handle, Position, type NodeProps } from "@xyflow/react"
import { memo } from "react"
import { useIsGraphNodeHighlighted } from "@/components/GraphCanvas/GraphHighlightContext"
import type { KnowledgeNode as KnowledgeNodeType, KnowledgeNodeKind } from "@/graph/graphTypes"
import "./ExploreKnowledgeNode.css"

const kindLabels: Record<KnowledgeNodeKind, string> = {
  atomic: "Atomic skill",
  outcome: "Outcome",
  resource: "Resource"
}

function ExploreKnowledgeNodeComponent({ id, data, selected }: NodeProps<KnowledgeNodeType>) {
  const isHighlighted = useIsGraphNodeHighlighted(id, data.kind === "resource")
  return (
    <article
      className={`explore-knowledge-node explore-knowledge-node--${data.kind}${
        selected ? " explore-knowledge-node--selected" : ""
      }${isHighlighted ? "" : " explore-knowledge-node--dimmed"}`}
      aria-label={`${kindLabels[data.kind]}: ${data.label}`}
      data-story-node={id}
    >
      {data.kind === "resource" ? (
        <Handle
          id="resource-in"
          className="explore-knowledge-node__handle explore-knowledge-node__handle--resource"
          type="target"
          position={Position.Left}
        />
      ) : (
        <>
          <Handle
            id="prerequisite-in"
            className="explore-knowledge-node__handle"
            type="target"
            position={Position.Bottom}
          />
          <Handle
            id="prerequisite-out"
            className="explore-knowledge-node__handle"
            type="source"
            position={Position.Top}
          />
          {data.hasResources === true ? (
            <Handle
              id="resource-out"
              className="explore-knowledge-node__handle explore-knowledge-node__handle--resource"
              type="source"
              position={Position.Right}
            />
          ) : null}
        </>
      )}
      <div className="explore-knowledge-node__header">
        <span className="explore-knowledge-node__kind">{kindLabels[data.kind]}</span>
        <span className="explore-knowledge-node__confidence">{Math.round(data.confidence * 100)}%</span>
      </div>
      <strong className="explore-knowledge-node__label">{data.shortLabel}</strong>
    </article>
  )
}

export const ExploreKnowledgeNode = memo(ExploreKnowledgeNodeComponent)
