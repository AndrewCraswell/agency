import { Body1, Caption1, Spinner, Subtitle1 } from "@fluentui/react-components"
import { useEffect, useState } from "react"
import { queryWorkItems, type JournalWorkflowRun, type WorkItemQueryResponse } from "@/services/api"
import { useOperationsOverviewStyles } from "./OperationsOverview.styles"
import { OperationsRunsList } from "./OperationsRuns"

type OperationsOverviewProps = { runs: JournalWorkflowRun[] | undefined }

export function OperationsOverview({ runs }: OperationsOverviewProps) {
  const classes = useOperationsOverviewStyles()
  const [inventory, setInventory] = useState<WorkItemQueryResponse>()

  useEffect(() => {
    let active = true
    void queryWorkItems({ pageSize: 1 }).then((response) => {
      if (active) {
        setInventory(response)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const activeRuns =
    runs?.filter(({ status }) => ["preparing", "runnable", "running", "waiting"].includes(status)) ?? []
  const completedRuns = runs?.filter(({ status }) => status === "succeeded").length ?? 0
  let activeRunsContent = <Spinner label="Loading active runs" />
  if (runs !== undefined) {
    activeRunsContent =
      activeRuns.length === 0 ? <Body1>No runs are active.</Body1> : <OperationsRunsList runs={activeRuns} />
  }

  return (
    <div className={classes.view}>
      <section className={classes.metrics} aria-label="Operations summary">
        <div>
          <strong>{inventory?.aggregates.all ?? 0}</strong>
          <span>Work items</span>
        </div>
        <div>
          <strong>{activeRuns.length}</strong>
          <span>Active runs</span>
        </div>
        <div>
          <strong>{inventory?.aggregates.blocked ?? 0}</strong>
          <span>Blocked</span>
        </div>
        <div>
          <strong>{completedRuns}</strong>
          <span>Completed runs</span>
        </div>
      </section>
      <section className={classes.section} aria-labelledby="active-runs-heading">
        <div className={classes.heading}>
          <Subtitle1 as="h2" id="active-runs-heading">
            Active runs
          </Subtitle1>
          <Caption1>Queued and running workflow executions</Caption1>
        </div>
        {activeRunsContent}
      </section>
    </div>
  )
}
