import {
  Badge,
  Body1,
  Button,
  Caption1,
  CounterBadge,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Title3
} from "@fluentui/react-components"
import { ChevronDownRegular, ChevronUpRegular } from "@fluentui/react-icons"
import { useEffect, useState, type ReactNode } from "react"
import type { WorkflowSimulation, WorkflowValidation } from "@/services/api"
import { useWorkflowEditorResultsStyles } from "./WorkflowEditorResults.styles"

export type EditorResultState<T> =
  | { status: "idle" }
  | { status: "running"; previous: T | null }
  | { status: "complete"; value: T }
  | { status: "error"; message: string; previous: T | null }

export type EditorResultPanel = "problems" | "test-results"

export function resultValue<T>(state: EditorResultState<T>): T | null {
  if (state.status === "complete") {
    return state.value
  }
  if (state.status === "running" || state.status === "error") {
    return state.previous
  }
  return null
}

function requestMessage<T>(state: EditorResultState<T>, noun: string) {
  if (state.status === "running") {
    return <Spinner size="tiny" label={`Checking ${noun}`} />
  }
  if (state.status === "error") {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{state.message}</MessageBarBody>
      </MessageBar>
    )
  }
  return null
}

export function WorkflowEditorResults({
  currentRevision,
  draftDirty,
  panel,
  simulation,
  stepLabels,
  validation,
  onPanelChange,
  onSelectIssue,
  onSelectStep
}: {
  currentRevision: number
  draftDirty: boolean
  panel: EditorResultPanel
  simulation: EditorResultState<WorkflowSimulation>
  stepLabels: ReadonlyMap<string, string>
  validation: EditorResultState<WorkflowValidation>
  onPanelChange: (panel: EditorResultPanel) => void
  onSelectIssue: (issue: WorkflowValidation["issues"][number]) => void
  onSelectStep: (stepId: string) => void
}) {
  const styles = useWorkflowEditorResultsStyles()
  const [open, setOpen] = useState(false)
  const validationValue = resultValue(validation)
  const simulationValue = resultValue(simulation)
  const issueCount = validationValue?.issues.length ?? 0
  const testFailureCount = simulationValue?.steps.filter(({ status }) => status === "failed").length ?? 0
  const validationStale = validationValue !== null && (draftDirty || validationValue.draftRevision !== currentRevision)
  const simulationStale = simulationValue !== null && (draftDirty || simulationValue.draftRevision !== currentRevision)
  useEffect(() => {
    if (validation.status !== "idle" || simulation.status !== "idle") {
      setOpen(true)
    }
  }, [simulation.status, validation.status])
  let validationContent = <Body1 className={styles.muted}>Check the draft to find issues before publishing.</Body1>
  if (validationValue?.valid === true) {
    validationContent = (
      <MessageBar intent="success">
        <MessageBarBody>No issues found for draft revision {validationValue.draftRevision}.</MessageBarBody>
      </MessageBar>
    )
  } else if (validationValue !== null) {
    validationContent = (
      <>
        <MessageBar intent="error">
          <MessageBarBody>
            {issueCount} issue{issueCount === 1 ? "" : "s"} to fix for draft revision {validationValue.draftRevision}.
          </MessageBarBody>
        </MessageBar>
        <ul className={styles.resultList}>
          {validationValue.issues.map((issue) => (
            <li key={`${issue.code}-${issue.nodeId ?? issue.connectionId ?? "workflow"}`}>
              <Button className={styles.resultButton} appearance="subtle" onClick={() => onSelectIssue(issue)}>
                {issue.message}
              </Button>
            </li>
          ))}
        </ul>
      </>
    )
  }
  let panelContent: ReactNode = null
  if (open && panel === "problems") {
    panelContent = (
      <div
        className={styles.panel}
        id="problems-panel"
        role="tabpanel"
        aria-labelledby="problems-tab"
        aria-live="polite"
      >
        <div className={styles.heading}>
          <Title3 as="h2">Problems</Title3>
          {validationValue === null ? null : <Caption1>Draft revision {validationValue.draftRevision}</Caption1>}
        </div>
        {requestMessage(validation, "the draft")}
        {validationStale ? (
          <MessageBar intent="warning">
            <MessageBarBody>Out of date. Check the current draft again.</MessageBarBody>
          </MessageBar>
        ) : null}
        {validationContent}
      </div>
    )
  } else if (open) {
    panelContent = (
      <div
        className={styles.panel}
        id="test-results-panel"
        role="tabpanel"
        aria-labelledby="test-results-tab"
        aria-live="polite"
      >
        <div className={styles.heading}>
          <Title3 as="h2">Test results</Title3>
          {simulationValue === null ? null : <Caption1>Draft revision {simulationValue.draftRevision}</Caption1>}
        </div>
        {requestMessage(simulation, "the workflow")}
        {simulationStale ? (
          <MessageBar intent="warning">
            <MessageBarBody>Out of date. Test the current draft again.</MessageBarBody>
          </MessageBar>
        ) : null}
        {simulationValue === null ? (
          <Body1 className={styles.muted}>Test the draft to see the result for each step.</Body1>
        ) : (
          <ul className={styles.resultList}>
            {simulationValue.steps.map((step) => (
              <li key={step.stepId}>
                <Button className={styles.resultButton} appearance="subtle" onClick={() => onSelectStep(step.stepId)}>
                  <span className={styles.stepResult}>
                    <span>{stepLabels.get(step.stepId) ?? step.stepId}</span>
                    <Badge appearance="tint" color={step.status === "failed" ? "danger" : "success"}>
                      {step.status}
                    </Badge>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <section className={styles.root} aria-label="Workflow results">
      <div className={styles.header}>
        <TabList
          className={styles.tabs}
          selectedValue={panel}
          onTabSelect={(_, data) => {
            onPanelChange(data.value as EditorResultPanel)
            setOpen(true)
          }}
        >
          <Tab id="problems-tab" value="problems" aria-controls="problems-panel" aria-label={`Problems, ${issueCount}`}>
            <span className={styles.tabLabel}>
              Problems <CounterBadge count={issueCount} showZero />
            </span>
          </Tab>
          <Tab
            id="test-results-tab"
            value="test-results"
            aria-controls="test-results-panel"
            aria-label={`Test results, ${testFailureCount} failed`}
          >
            <span className={styles.tabLabel}>
              Test results{" "}
              <CounterBadge count={testFailureCount} showZero color={testFailureCount > 0 ? "danger" : "informative"} />
            </span>
          </Tab>
        </TabList>
        <Button
          appearance="subtle"
          icon={open ? <ChevronDownRegular /> : <ChevronUpRegular />}
          aria-label={open ? "Collapse results" : "Expand results"}
          aria-expanded={open}
          aria-controls={panel === "problems" ? "problems-panel" : "test-results-panel"}
          onClick={() => setOpen((value) => !value)}
        />
      </div>
      {panelContent}
    </section>
  )
}
