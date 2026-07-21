import { Badge, Body1, Button, Caption1, mergeClasses } from "@fluentui/react-components"
import type { CSSProperties } from "react"
import { formatIdentifierLabel } from "@/utils/formatIdentifierLabel"
import { useWorkflowEditorOutlineStyles } from "./WorkflowEditorOutline.styles"
import type { WorkflowOutlineItem } from "./WorkflowEditorOutline.utils"

type StepResultStatus = "succeeded" | "failed" | undefined

export type WorkflowEditorOutlineProps = {
  items: WorkflowOutlineItem[]
  descriptions: ReadonlyMap<string, string>
  selectedNodeId: string | undefined
  selectedEdgeId: string | undefined
  problemStepIds: ReadonlySet<string>
  testStatusByStep: ReadonlyMap<string, StepResultStatus>
  onSelectNode: (stepId: string) => void
  onSelectEdge: (connectionId: string) => void
}

function relationshipLabel(connection: WorkflowOutlineItem["outgoing"][number]) {
  if (connection.loopBack === true) {
    return `Loop back to ${connection.targetStepId}`
  }
  if (connection.branchKey !== undefined) {
    return `${connection.branchKey} to ${connection.targetStepId}`
  }
  if (connection.outcome === "failure") {
    return `Failure to ${connection.targetStepId}`
  }
  return `Next to ${connection.targetStepId}`
}

export function WorkflowEditorOutline({
  items,
  descriptions,
  selectedNodeId,
  selectedEdgeId,
  problemStepIds,
  testStatusByStep,
  onSelectNode,
  onSelectEdge
}: WorkflowEditorOutlineProps) {
  const classes = useWorkflowEditorOutlineStyles()
  const labels = new Map(items.map(({ id, label }) => [id, label]))

  return (
    <nav className={classes.root} aria-label="Workflow topology">
      <ol className={classes.list}>
        {items.map((item, index) => {
          const testStatus = testStatusByStep.get(item.id)
          const style = { "--outline-depth": item.depth } as CSSProperties
          return (
            <li key={item.id} className={classes.item} style={style}>
              <button
                type="button"
                data-outline-selection={item.id}
                className={mergeClasses(classes.step, selectedNodeId === item.id && classes.selected)}
                aria-current={selectedNodeId === item.id ? "step" : undefined}
                onClick={() => onSelectNode(item.id)}
              >
                <span className={classes.index}>{String(index + 1).padStart(2, "0")}</span>
                <span className={classes.copy}>
                  <Body1>{item.label}</Body1>
                  <Caption1 className={classes.typeIdentity}>{item.typeLabel}</Caption1>
                  <Caption1 className={classes.description}>{descriptions.get(item.id)}</Caption1>
                  <Caption1 className={classes.relationSummary}>
                    {item.incoming.length} incoming, {item.outgoing.length} outgoing
                  </Caption1>
                </span>
                <span className={classes.badges}>
                  <Badge appearance="outline">{formatIdentifierLabel(item.role)}</Badge>
                  {item.unreachable ? <Badge color="warning">Unreachable</Badge> : null}
                  {problemStepIds.has(item.id) ? <Badge color="danger">Issue</Badge> : null}
                  {testStatus === undefined ? null : (
                    <Badge color={testStatus === "failed" ? "danger" : "success"}>
                      {formatIdentifierLabel(testStatus)}
                    </Badge>
                  )}
                </span>
              </button>
              {item.outgoing.length === 0 ? null : (
                <div className={classes.relationships} aria-label={`Connections from ${item.label}`}>
                  {item.outgoing.map((connection) => (
                    <Button
                      key={connection.id}
                      data-outline-selection={connection.id}
                      className={mergeClasses(
                        classes.relationship,
                        selectedEdgeId === connection.id && classes.selected
                      )}
                      size="small"
                      appearance="subtle"
                      aria-label={`Select connection ${connection.id}`}
                      aria-pressed={selectedEdgeId === connection.id}
                      onClick={() => onSelectEdge(connection.id)}
                    >
                      {relationshipLabel({
                        ...connection,
                        targetStepId: labels.get(connection.targetStepId) ?? connection.targetStepId
                      })}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
