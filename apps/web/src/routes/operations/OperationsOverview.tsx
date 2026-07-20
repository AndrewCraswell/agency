import { Body1, Caption1, Spinner, Subtitle1 } from "@fluentui/react-components"
import { useEffect, useState } from "react"
import { queryWorkItems, type ControlPlaneRunSnapshot, type WorkItemQueryResponse } from "@/services/api"
import { useOperationsOverviewStyles } from "./OperationsOverview.styles"
import { OperationsRunsList } from "./OperationsRuns"

type OperationsOverviewProps = { snapshot: ControlPlaneRunSnapshot | undefined }

export function OperationsOverview({ snapshot }: OperationsOverviewProps) {
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

  const activeRuns = snapshot?.runs.filter(({ status }) => status === "queued" || status === "running") ?? []
  const publishedRuns = snapshot?.runs.filter(({ status }) => status === "published").length ?? 0
  let activeRunsContent = <Spinner label="Loading active runs" />
  if (snapshot !== undefined) {
    activeRunsContent =
      activeRuns.length === 0 ? (
        <Body1>No runs are active.</Body1>
      ) : (
        <OperationsRunsList agents={snapshot.agents} runs={activeRuns} />
      )
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
          <strong>{publishedRuns}</strong>
          <span>Published</span>
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
