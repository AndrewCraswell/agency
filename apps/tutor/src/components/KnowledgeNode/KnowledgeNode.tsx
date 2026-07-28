import { Button, Caption1, Caption1Strong, mergeClasses, Subtitle2 } from "@fluentui/react-components"
import { OpenRegular } from "@fluentui/react-icons"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { memo } from "react"
import { useIsGraphNodeHighlighted } from "@/components/GraphCanvas/GraphHighlightContext"
import type { KnowledgeNode as KnowledgeNodeType, KnowledgeNodeKind } from "@/graph/graphTypes"
import { useKnowledgeNodeStyles } from "./KnowledgeNode.styles"

const kindLabels: Record<KnowledgeNodeKind, string> = {
  atomic: "Atomic skill",
  outcome: "Outcome",
  resource: "Resource"
}

function KnowledgeNodeComponent({ id, data, selected }: NodeProps<KnowledgeNodeType>) {
  const classes = useKnowledgeNodeStyles()
  const isHighlighted = useIsGraphNodeHighlighted(id, data.kind === "resource")
  const resource = data.kind === "resource" ? data.resources[0] : undefined
  let kindClass: string | undefined
  if (data.kind === "outcome") {
    kindClass = classes.outcome
  } else if (data.kind === "resource") {
    kindClass = classes.resource
  }

  return (
    <article
      className={mergeClasses(classes.node, kindClass, selected && classes.selected)}
      style={{ opacity: isHighlighted ? 1 : 0.25 }}
      aria-label={`${kindLabels[data.kind]}: ${data.label}`}
      data-story-node={id}
    >
      {data.kind === "resource" ? (
        <Handle
          id="resource-in"
          className={mergeClasses(classes.handle, classes.resourceHandle)}
          type="target"
          position={Position.Left}
        />
      ) : (
        <>
          <Handle id="prerequisite-in" className={classes.handle} type="target" position={Position.Bottom} />
          <Handle id="prerequisite-out" className={classes.handle} type="source" position={Position.Top} />
          {data.resources.length > 0 ? (
            <Handle
              id="resource-out"
              className={mergeClasses(classes.handle, classes.resourceHandle)}
              type="source"
              position={Position.Right}
            />
          ) : null}
        </>
      )}
      <div className={classes.header}>
        <Caption1Strong className={classes.kind}>{kindLabels[data.kind]}</Caption1Strong>
        <Caption1Strong className={classes.confidence}>{Math.round(data.confidence * 100)}%</Caption1Strong>
      </div>
      <Subtitle2 className={classes.label}>{data.shortLabel}</Subtitle2>
      {resource === undefined ? null : (
        <>
          <Caption1 className={classes.resourceMeta}>{resource.provider} lesson</Caption1>
          <Button
            className={`${classes.resourceAction} nodrag nopan`}
            as="a"
            size="small"
            appearance="secondary"
            icon={<OpenRegular />}
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${resource.title} in a new tab`}
          >
            Open resource
          </Button>
        </>
      )}
    </article>
  )
}

export const KnowledgeNode = memo(KnowledgeNodeComponent)
