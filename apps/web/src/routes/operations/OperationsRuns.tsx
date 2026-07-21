import { Badge, Body1, Body1Strong, Caption1, Spinner, Subtitle1 } from "@fluentui/react-components"
import { ChevronRightRegular } from "@fluentui/react-icons"
import { formatDistanceToNow } from "date-fns"
import type { JournalWorkflowRun } from "@/services/api"
import { formatIdentifierLabel } from "@/utils/formatIdentifierLabel"
import { useOperationsRunsStyles } from "./OperationsRuns.styles"

type OperationsRunsProps = { runs: JournalWorkflowRun[] | undefined }
type OperationsRunsListProps = { runs: JournalWorkflowRun[] }

function sourceLabel(source: JournalWorkflowRun["source"]): string {
  if (source.kind === "draft_test") {
    return `Draft test, revision ${source.draftRevision}`
  }
  return `Published version ${source.version}`
}

function triggerLabel(triggerIdentity: string): string {
  if (triggerIdentity.startsWith("draft_test:")) {
    return "Manual test"
  }
  const triggerKind = triggerIdentity.split(":", 1)[0]
  const labels: Record<string, string> = {
    child: "Child workflow",
    manual: "Manual run",
    schedule: "Schedule",
    webhook: "Webhook"
  }
  return labels[triggerKind ?? ""] ?? "Workflow trigger"
}

export function OperationsRunsList({ runs }: OperationsRunsListProps) {
  const classes = useOperationsRunsStyles()
  return (
    <ul className={classes.list} aria-label="Workflow runs">
      {runs.map((run) => (
        <li key={run.runId}>
          <a className={classes.row} href={`/runs/${run.runId}`}>
            <span className={classes.identity}>
              <Body1Strong>{run.workflowName}</Body1Strong>
              <Caption1 className={classes.secondary}>{sourceLabel(run.source)}</Caption1>
            </span>
            <Body1>{triggerLabel(run.triggerIdentity)}</Body1>
            <Badge appearance="tint">{formatIdentifierLabel(run.status === "runnable" ? "queued" : run.status)}</Badge>
            <Caption1>{formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true })}</Caption1>
            <ChevronRightRegular aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function OperationsRuns({ runs }: OperationsRunsProps) {
  const classes = useOperationsRunsStyles()
  let content = <Spinner label="Loading runs" />
  if (runs !== undefined) {
    content =
      runs.length === 0 ? (
        <Body1 className={classes.empty}>No workflow runs yet.</Body1>
      ) : (
        <OperationsRunsList runs={runs} />
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
