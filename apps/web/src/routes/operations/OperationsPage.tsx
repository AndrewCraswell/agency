import { Body1, Button, MessageBar, MessageBarBody, Spinner, Tab, TabList, Title1 } from "@fluentui/react-components"
import { ArrowClockwiseRegular } from "@fluentui/react-icons"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useEffect, useState } from "react"
import { arrayIncludes } from "ts-extras"
import {
  listControlPlaneAgents,
  listJournalWorkflowRuns,
  type AgentDefinition,
  type JournalWorkflowRun
} from "@/services/api"
import { OperationsOverview } from "./OperationsOverview"
import { useOperationsPageStyles } from "./OperationsPage.styles"
import { OperationsRuns } from "./OperationsRuns"
import { OperationsWorkQueue } from "./OperationsWorkQueue"

const operationViews = ["overview", "runs", "work-queue"] as const

export function OperationsPage() {
  const classes = useOperationsPageStyles()
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(operationViews).withDefault("overview").withOptions({ history: "push" })
  )
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [workflowRuns, setWorkflowRuns] = useState<JournalWorkflowRun[]>()
  const [runError, setRunError] = useState<string>()
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function loadRuns(showSpinner = false): Promise<void> {
    if (showSpinner) {
      setIsRefreshing(true)
    }
    try {
      const [nextAgents, nextRuns] = await Promise.all([listControlPlaneAgents(), listJournalWorkflowRuns()])
      setAgents(nextAgents)
      setWorkflowRuns(nextRuns)
      setRunError(undefined)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "We couldn't load workflow runs.")
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadRuns(), 0)
    const polling = window.setInterval(() => void loadRuns(), 5_000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(polling)
    }
  }, [])

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerCopy}>
          <Title1 as="h1">Operations</Title1>
          <Body1 className={classes.subtitle}>Track work intake, active runs, and delivery outcomes.</Body1>
        </div>
        <Button
          appearance="secondary"
          icon={isRefreshing ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
          disabled={isRefreshing}
          onClick={() => void loadRuns(true)}
        >
          Refresh runs
        </Button>
      </header>
      <TabList
        className={classes.tabs}
        selectedValue={view}
        onTabSelect={(_, data) => {
          if (typeof data.value === "string" && arrayIncludes(operationViews, data.value)) {
            void setView(data.value === "overview" ? null : data.value)
          }
        }}
        aria-label="Operations views"
      >
        <Tab value="overview">Overview</Tab>
        <Tab value="runs">Runs</Tab>
        <Tab value="work-queue">Work queue</Tab>
      </TabList>
      {runError === undefined ? null : (
        <MessageBar className={classes.message} intent="error">
          <MessageBarBody>{runError}</MessageBarBody>
        </MessageBar>
      )}
      {view === "overview" ? <OperationsOverview runs={workflowRuns} /> : null}
      {view === "runs" ? <OperationsRuns runs={workflowRuns} /> : null}
      {view === "work-queue" ? <OperationsWorkQueue agents={agents} onAssigned={() => loadRuns()} /> : null}
    </main>
  )
}
