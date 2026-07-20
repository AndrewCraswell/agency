import {
  Body1,
  Button,
  Caption1,
  CounterBadge,
  MessageBar,
  MessageBarBody,
  Spinner,
  Title3
} from "@fluentui/react-components"
import { ChevronDownRegular, ChevronUpRegular } from "@fluentui/react-icons"
import { useState } from "react"
import type { WorkflowValidation } from "@/services/api"
import { useWorkflowEditorResultsStyles } from "./WorkflowEditorResults.styles"

export type EditorResultState<T> =
  | { status: "idle" }
  | { status: "running"; previous: T | null }
  | { status: "complete"; value: T }
  | { status: "error"; message: string; previous: T | null }

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
  validation,
  onSelectIssue
}: {
  currentRevision: number
  draftDirty: boolean
  validation: EditorResultState<WorkflowValidation>
  onSelectIssue: (issue: WorkflowValidation["issues"][number]) => void
}) {
  const styles = useWorkflowEditorResultsStyles()
  const [open, setOpen] = useState(false)
  const validationValue = resultValue(validation)
  const issueCount = validationValue?.issues.length ?? 0
  const validationStale = validationValue !== null && (draftDirty || validationValue.draftRevision !== currentRevision)
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
  return (
    <section className={styles.root} aria-label="Workflow results">
      <div className={styles.header}>
        <Title3 as="h2" className={styles.tabLabel}>
          Problems <CounterBadge count={issueCount} showZero />
        </Title3>
        <Button
          appearance="subtle"
          icon={open ? <ChevronDownRegular /> : <ChevronUpRegular />}
          aria-label={open ? "Collapse results" : "Expand results"}
          aria-expanded={open}
          aria-controls="problems-panel"
          onClick={() => setOpen((value) => !value)}
        />
      </div>
      <div className={styles.panel} id="problems-panel" aria-live="polite" hidden={!open}>
        <div className={styles.heading}>
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
    </section>
  )
}
