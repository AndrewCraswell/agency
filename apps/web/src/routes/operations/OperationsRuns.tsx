import { Badge, Body1, Body1Strong, Caption1, Spinner, Subtitle1 } from "@fluentui/react-components"
import { formatDistanceToNow } from "date-fns"
import type { ControlPlaneRunSnapshot, WorkflowRun } from "@/services/api"
import { useOperationsRunsStyles } from "./OperationsRuns.styles"

type OperationsRunsProps = { snapshot: ControlPlaneRunSnapshot | undefined }
type OperationsRunsListProps = Pick<ControlPlaneRunSnapshot, "agents" | "runs">

function activeAgentId(run: WorkflowRun): string {
  if (run.activeRole === "scrum_master") {
    return "scrum-master"
  }
  if (run.activeRole === "reviewer") {
    return "reviewer"
  }
  return run.assignedAgentId ?? "scrum-master"
}

export function OperationsRunsList({ agents, runs }: OperationsRunsListProps) {
  const classes = useOperationsRunsStyles()
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]))
  return (
    <ul className={classes.list} aria-label="Workflow runs">
      {runs.map((run) => (
        <li className={classes.row} key={run.runId}>
          <span className={classes.identity}>
            <Body1Strong>{run.sourceWorkItemIdentifier ?? "Unassigned intake"}</Body1Strong>
            <Caption1 className={classes.secondary}>{run.repository}</Caption1>
          </span>
          <Body1>{agentNames.get(activeAgentId(run)) ?? "Unknown agent"}</Body1>
          <Badge appearance="tint">{run.status}</Badge>
          <Caption1>{formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true })}</Caption1>
        </li>
      ))}
    </ul>
  )
}

export function OperationsRuns({ snapshot }: OperationsRunsProps) {
  const classes = useOperationsRunsStyles()
  let content = <Spinner label="Loading runs" />
  if (snapshot !== undefined) {
    content =
      snapshot.runs.length === 0 ? (
        <Body1 className={classes.empty}>No workflow runs yet.</Body1>
      ) : (
        <OperationsRunsList agents={snapshot.agents} runs={snapshot.runs} />
      )
  }

  return (
    <section className={classes.view} aria-labelledby="runs-heading">
      <div className={classes.heading}>
        <Subtitle1 as="h2" id="runs-heading">
          Runs
        </Subtitle1>
        <Caption1>Current and recent workflow execution status</Caption1>
      </div>
      {content}
    </section>
  )
}
