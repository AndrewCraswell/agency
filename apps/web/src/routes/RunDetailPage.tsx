import {
  Badge,
  Body1,
  Button,
  Caption1,
  CounterBadge,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle1,
  Textarea,
  Title1,
  Tooltip
} from "@fluentui/react-components"
import {
  ArrowClockwiseRegular,
  ArrowLeftRegular,
  ArrowSyncRegular,
  HistoryRegular,
  StopRegular
} from "@fluentui/react-icons"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect, useEffectEvent, useState } from "react"
import { AsyncStatus } from "@/components/AsyncStatus/AsyncStatus"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  cancelJournalWorkflowRun,
  getWorkflowRunDetail,
  resolveJournalWorkflowEffect,
  retryJournalWorkflowActivation,
  retryJournalWorkflowFromHere,
  runJournalWorkflowAgain,
  type JsonValue,
  type WorkflowRunDetail
} from "@/services/api"
import { formatIdentifierLabel } from "@/utils/formatIdentifierLabel"
import { useRunDetailPageStyles } from "./RunDetailPage.styles"

function journalStatusColor(status: string): "brand" | "danger" | "informative" | "success" | "warning" {
  if (status === "failed" || status === "abandoned" || status === "unknown" || status === "conflict") {
    return "danger"
  }
  if (status === "succeeded" || status === "confirmed" || status === "resolved" || status === "resumed") {
    return "success"
  }
  if (status === "waiting" || status === "pending" || status === "claimed") {
    return "warning"
  }
  if (status === "cancelled" || status === "timed_out") {
    return "informative"
  }
  return "brand"
}

function persistedJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function attemptTiming(attempt: WorkflowRunDetail["attempts"][number]): string | null {
  if (attempt.startedAt === null) {
    return null
  }
  if (attempt.finishedAt === null) {
    return `Started ${new Date(attempt.startedAt).toLocaleString()}`
  }
  const elapsedMilliseconds = Math.max(
    0,
    new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime()
  )
  if (elapsedMilliseconds < 1_000) {
    return `${elapsedMilliseconds} ms`
  }
  return `${(elapsedMilliseconds / 1_000).toFixed(elapsedMilliseconds < 10_000 ? 1 : 0)} s`
}

function executionPackageLabel(executionPackage: WorkflowRunDetail["executionPackage"]): string {
  if (executionPackage.sourceKind === "draft_test") {
    return `Draft test revision ${executionPackage.draftRevision}`
  }
  return `Workflow version ${executionPackage.workflowVersion}`
}

function runMutationStatus(detail: WorkflowRunDetail, busyAction: string | null): string {
  if (busyAction === null) {
    return "Run details up to date"
  }
  const action = detail.summary.actions.find(
    (candidate) => candidate.targetId === busyAction || candidate.key.replaceAll("_", "-") === busyAction
  )
  return action === undefined ? "Updating run" : `${action.label} in progress`
}

function EffectResolutionAction({
  effect,
  busy,
  label,
  onSubmit
}: {
  effect: WorkflowRunDetail["effects"][number]
  busy: boolean
  label: string
  onSubmit: (input: {
    outcome: "occurred" | "absent" | "indeterminate"
    reason: string
    result?: Record<string, JsonValue>
  }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<"occurred" | "absent" | "indeterminate">("occurred")
  const [reason, setReason] = useState("")
  const [resultJson, setResultJson] = useState("{}")
  const [error, setError] = useState("")

  async function submit() {
    if (reason.trim() === "") {
      setError("A reason is required")
      return
    }
    let result: Record<string, JsonValue> | undefined
    if (outcome === "occurred") {
      try {
        const parsed: unknown = JSON.parse(resultJson)
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
          throw new Error("External result must be a JSON object")
        }
        result = parsed as Record<string, JsonValue>
      } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : "Enter a valid result object")
        return
      }
    }
    setError("")
    try {
      await onSubmit({ outcome, reason: reason.trim(), ...(result === undefined ? {} : { result }) })
      setOpen(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The effect decision could not be recorded.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!busy) {
          setOpen(data.open)
        }
      }}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button size="small" appearance="primary" disabled={busy}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Confirm external change</DialogTitle>
          <DialogContent>
            <Body1>Review the intended {effect.provider} request before recording what occurred.</Body1>
            <pre>{persistedJson(effect.request)}</pre>
            <RadioGroup
              value={outcome}
              onChange={(_, data) => setOutcome(data.value as typeof outcome)}
              aria-label="Effect outcome"
            >
              <Radio value="occurred" label="Change occurred" />
              <Radio value="absent" label="Change did not occur" />
              <Radio value="indeterminate" label="Cannot determine" />
            </RadioGroup>
            <Field
              label="Reason"
              required
              validationState={error === "A reason is required" ? "error" : "none"}
              validationMessage={error === "A reason is required" ? error : undefined}
            >
              <Textarea resize="vertical" value={reason} onChange={(_, data) => setReason(data.value)} />
            </Field>
            {outcome === "occurred" ? (
              <Field
                label="External result JSON"
                validationState={error !== "" && error !== "A reason is required" ? "error" : "none"}
                validationMessage={error !== "A reason is required" ? error : undefined}
              >
                <Textarea resize="vertical" value={resultJson} onChange={(_, data) => setResultJson(data.value)} />
              </Field>
            ) : null}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={busy}>
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={() => void submit()}
            >
              Record decision
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function RunSummary({
  detail,
  busyAction,
  onCancel,
  onResolveEffect,
  onRetry,
  onRetryFromHere,
  onRunAgain
}: {
  detail: WorkflowRunDetail
  busyAction: string | null
  onCancel: () => void
  onResolveEffect: (
    effect: WorkflowRunDetail["effects"][number],
    input: { outcome: "occurred" | "absent" | "indeterminate"; reason: string; result?: Record<string, JsonValue> }
  ) => Promise<void>
  onRetry: (activationId: string) => void
  onRetryFromHere: (activationId: string) => void
  onRunAgain: () => void
}) {
  const classes = useRunDetailPageStyles()
  const { failure } = detail.summary
  return (
    <section className={classes.summary} aria-labelledby="run-summary-heading">
      <div className={classes.sectionHeading}>
        <div>
          <Subtitle1 as="h2" id="run-summary-heading">
            Run summary
          </Subtitle1>
          <Caption1>
            {detail.summary.currentStep === null
              ? "No step is currently active"
              : `Current step: ${detail.summary.currentStep.label}`}
          </Caption1>
        </div>
        <Badge appearance="filled" color={journalStatusColor(detail.summary.outcome)}>
          {formatIdentifierLabel(detail.summary.outcome)}
        </Badge>
      </div>
      {failure === null ? null : (
        <MessageBar intent="error">
          <MessageBarBody>
            <strong>{failure.stepLabel} failed</strong>
            <div>{failure.cause}</div>
            <div>{failure.downstreamEffect}</div>
            <div>{failure.recommendedAction}</div>
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={classes.recoverySection}>
        <Subtitle1 as="h3">Next actions</Subtitle1>
        {detail.summary.actions.length === 0 ? (
          <Body1>No recovery action is available for this run.</Body1>
        ) : (
          <ul className={classes.recoveryActions}>
            {detail.summary.actions.map((action) => {
              const targetId = action.targetId
              const actionId = targetId ?? action.key.replaceAll("_", "-")
              const reasonId = `action-reason-${actionId}`
              const busy = busyAction === actionId
              const effect =
                action.key === "resolve_effect"
                  ? detail.effects.find(({ effectId }) => effectId === targetId)
                  : undefined
              let control: React.ReactNode = null
              if (action.key === "cancel") {
                control = (
                  <Button
                    icon={busy ? <Spinner size="tiny" /> : <StopRegular />}
                    disabled={busy}
                    disabledFocusable={!action.allowed}
                    aria-describedby={action.allowed ? undefined : reasonId}
                    onClick={onCancel}
                  >
                    {action.label}
                  </Button>
                )
              } else if (action.key === "run_again") {
                control = (
                  <Button
                    icon={busy ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
                    disabled={busy}
                    disabledFocusable={!action.allowed}
                    aria-describedby={action.allowed ? undefined : reasonId}
                    onClick={onRunAgain}
                  >
                    {action.label}
                  </Button>
                )
              } else if (action.key === "retry_step" && targetId !== null) {
                control = (
                  <Button
                    appearance="primary"
                    icon={busy ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
                    disabled={busy}
                    disabledFocusable={!action.allowed}
                    aria-describedby={action.allowed ? undefined : reasonId}
                    onClick={() => onRetry(targetId)}
                  >
                    {action.label}
                  </Button>
                )
              } else if (action.key === "retry_from_here" && targetId !== null) {
                control = (
                  <Button
                    disabled={busy}
                    disabledFocusable={!action.allowed}
                    aria-describedby={action.allowed ? undefined : reasonId}
                    onClick={() => onRetryFromHere(targetId)}
                  >
                    {action.label}
                  </Button>
                )
              } else if (effect !== undefined) {
                control = (
                  <EffectResolutionAction
                    effect={effect}
                    busy={busy}
                    label={action.label}
                    onSubmit={(input) => onResolveEffect(effect, input)}
                  />
                )
              }
              return control === null ? null : (
                <li key={`${action.key}:${targetId ?? "run"}`}>
                  {control}
                  {action.disabledReason === null ? null : (
                    <Caption1 id={reasonId} className={classes.unavailableReason}>
                      {action.disabledReason}
                    </Caption1>
                  )}
                  <Caption1>{action.consequence}</Caption1>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function StepProgress({ detail }: { detail: WorkflowRunDetail }) {
  const classes = useRunDetailPageStyles()
  const attemptsByActivation = Map.groupBy(detail.attempts, ({ activationId }) => activationId)

  return (
    <section className={classes.stepProgress} aria-labelledby="step-progress-heading">
      <div className={classes.sectionHeading}>
        <div>
          <Subtitle1 as="h2" id="step-progress-heading">
            Step progress
          </Subtitle1>
          <Caption1>Follow the input and output recorded at each point in the workflow.</Caption1>
        </div>
        <CounterBadge appearance="ghost" color="informative" count={detail.graph.steps.length} showZero />
      </div>
      <ol className={classes.stepList}>
        {detail.graph.topologicalOrder.map((stepId, stepIndex) => {
          const step = detail.graph.steps.find(({ id }) => id === stepId)
          if (step === undefined) {
            return null
          }
          const activations = detail.activations.filter((activation) => activation.stepId === stepId)
          return (
            <li key={stepId} className={classes.stepItem}>
              <div className={classes.stepMarker} aria-hidden="true">
                {stepIndex + 1}
              </div>
              <div className={classes.stepContent}>
                <div className={classes.stepHeading}>
                  <div>
                    <Subtitle1 as="h3">{step.label}</Subtitle1>
                    <Caption1>{step.definition.kind.replaceAll("_", " ")}</Caption1>
                  </div>
                  {activations.length === 0 ? (
                    <Badge appearance="tint">Not started</Badge>
                  ) : (
                    <Badge appearance="filled" color={journalStatusColor(activations.at(-1)!.status)}>
                      {formatIdentifierLabel(activations.at(-1)!.status)}
                    </Badge>
                  )}
                </div>
                {activations.length === 0 ? (
                  <Body1 className={classes.pendingStep}>This step has not received input.</Body1>
                ) : (
                  activations.map((activation, activationIndex) => {
                    const attempts = (attemptsByActivation.get(activation.activationId) ?? []).toSorted(
                      (left, right) => left.ordinal - right.ordinal
                    )
                    return (
                      <div className={classes.activationTrace} key={activation.activationId}>
                        {activations.length > 1 ? (
                          <Caption1>
                            Activation {activationIndex + 1} of {activations.length}
                          </Caption1>
                        ) : null}
                        {attempts.length === 0 ? (
                          <div className={classes.dataColumns}>
                            <section aria-label={`${step.label} input`}>
                              <strong>Input</strong>
                              <pre className={classes.jsonBlock}>{persistedJson(activation.inputBindings)}</pre>
                            </section>
                            <section aria-label={`${step.label} output`}>
                              <strong>Output</strong>
                              <Body1>No output yet.</Body1>
                            </section>
                          </div>
                        ) : (
                          attempts.map((attempt, attemptIndex) => {
                            const timing = attemptTiming(attempt)
                            return (
                              <details
                                className={classes.attemptTrace}
                                key={attempt.ordinal}
                                open={attemptIndex === attempts.length - 1}
                              >
                                <summary>
                                  <span>Attempt {attempt.ordinal}</span>
                                  <span className={classes.attemptMeta}>
                                    {timing === null ? null : <Caption1>{timing}</Caption1>}
                                    <Badge appearance="tint" color={journalStatusColor(attempt.status)}>
                                      {formatIdentifierLabel(attempt.status)}
                                    </Badge>
                                  </span>
                                </summary>
                                <div className={classes.dataColumns}>
                                  <section aria-label={`${step.label} input for attempt ${attempt.ordinal}`}>
                                    <strong>Input</strong>
                                    <pre className={classes.jsonBlock}>{persistedJson(attempt.input)}</pre>
                                  </section>
                                  <section aria-label={`${step.label} output for attempt ${attempt.ordinal}`}>
                                    <strong>Output</strong>
                                    {attempt.output === null ? (
                                      <Body1>No output was recorded.</Body1>
                                    ) : (
                                      <pre className={classes.jsonBlock}>{persistedJson(attempt.output)}</pre>
                                    )}
                                  </section>
                                </div>
                                {attempt.error === null ? null : (
                                  <section className={classes.stepError} aria-label={`${step.label} error`}>
                                    <strong>Error</strong>
                                    <pre className={classes.jsonBlock}>{persistedJson(attempt.error)}</pre>
                                  </section>
                                )}
                                {attempt.usage === null && Object.keys(attempt.evidence).length === 0 ? null : (
                                  <details className={classes.providerDetails}>
                                    <summary>Provider details</summary>
                                    <div className={classes.dataColumns}>
                                      {attempt.usage === null ? null : (
                                        <section aria-label={`${step.label} usage for attempt ${attempt.ordinal}`}>
                                          <strong>Usage</strong>
                                          <pre className={classes.jsonBlock}>{persistedJson(attempt.usage)}</pre>
                                        </section>
                                      )}
                                      {Object.keys(attempt.evidence).length === 0 ? null : (
                                        <section aria-label={`${step.label} evidence for attempt ${attempt.ordinal}`}>
                                          <strong>Provider evidence</strong>
                                          <pre className={classes.jsonBlock}>{persistedJson(attempt.evidence)}</pre>
                                        </section>
                                      )}
                                    </div>
                                  </details>
                                )}
                              </details>
                            )
                          })
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function WorkflowRunView({
  detail,
  busyAction,
  onCancel,
  onResolveEffect,
  onRetry,
  onRetryFromHere,
  onRunAgain
}: {
  detail: WorkflowRunDetail
  busyAction: string | null
  onCancel: () => void
  onResolveEffect: (
    effect: WorkflowRunDetail["effects"][number],
    input: { outcome: "occurred" | "absent" | "indeterminate"; reason: string; result?: Record<string, JsonValue> }
  ) => Promise<void>
  onRetry: (activationId: string) => void
  onRetryFromHere: (activationId: string) => void
  onRunAgain: () => void
}) {
  const classes = useRunDetailPageStyles()
  const pageTitle =
    detail.summary.failure === null
      ? `Workflow run: ${formatIdentifierLabel(detail.summary.outcome)}`
      : `Run failed at ${detail.summary.failure.stepLabel}`
  return (
    <>
      <header className={classes.header}>
        <div className={classes.headerIdentity}>
          <Caption1 className={classes.eyebrow}>{executionPackageLabel(detail.executionPackage)}</Caption1>
          <Title1 as="h1">{pageTitle}</Title1>
          <Body1 className={classes.runId}>{detail.run.runId}</Body1>
        </div>
        <div className={classes.runActions}>
          <Badge appearance="filled" color={journalStatusColor(detail.run.status)}>
            {formatIdentifierLabel(detail.run.status)}
          </Badge>
        </div>
      </header>
      <RunSummary
        detail={detail}
        busyAction={busyAction}
        onCancel={onCancel}
        onResolveEffect={onResolveEffect}
        onRetry={onRetry}
        onRetryFromHere={onRetryFromHere}
        onRunAgain={onRunAgain}
      />
      <StepProgress detail={detail} />
      <details className={classes.diagnostics}>
        <summary aria-label="Toggle technical details">
          <span>
            <Subtitle1>Technical details</Subtitle1>
            <Caption1>Inspect run identifiers, external activity, and the system event log.</Caption1>
          </span>
        </summary>
        <div className={classes.diagnosticsContent}>
          <Subtitle1 as="h2">Run context</Subtitle1>
          <dl className={classes.details} aria-label="Run metadata">
            <div>
              <dt>
                <Caption1>Started by</Caption1>
              </dt>
              <dd>
                <Body1>{detail.run.triggerIdentity}</Body1>
              </dd>
            </div>
            <div>
              <dt>
                <Caption1>Execution package</Caption1>
              </dt>
              <dd>
                <Body1 className={classes.runId}>{detail.run.packageDigest}</Body1>
              </dd>
            </div>
            <div>
              <dt>
                <Caption1>Latest event</Caption1>
              </dt>
              <dd>
                <Body1>Sequence {detail.run.latestSequence}</Body1>
              </dd>
            </div>
          </dl>
          <div className={classes.subsectionHeading}>
            <Subtitle1 as="h2">External activity</Subtitle1>
            <Caption1>Provider changes, waits, artifacts, and child workflows created by this run.</Caption1>
          </div>
          <div className={classes.diagnosticGrid}>
            <JournalEvidenceSection
              title="Waiting for events"
              empty="This run did not wait for an external event."
              items={detail.waits.map((wait) => ({
                id: wait.waitId,
                label: wait.correlationKey,
                status: wait.status,
                meta: `Expires ${new Date(wait.expiresAt).toLocaleString()}`,
                value: {
                  acceptedInputSchema: wait.acceptedInputSchema,
                  winningEventSequence: wait.winningEventSequence
                },
                action: undefined
              }))}
            />
            <JournalEvidenceSection
              title="Provider changes"
              empty="This run made no external changes."
              items={detail.effects.map((effect) => ({
                id: effect.effectId,
                label: `${effect.provider} ${effect.effectSlot}`,
                status: effect.status,
                meta: effect.requestDigest.slice(0, 12),
                value: { request: effect.request, result: effect.result, reconciliation: effect.reconciliation },
                action: undefined
              }))}
            />
            <JournalEvidenceSection
              title="Artifacts"
              empty="This run produced no saved artifacts."
              items={detail.data.map((datum) => ({
                id: datum.datumId,
                label: datum.name,
                status: datum.kind,
                meta: datum.digest.slice(0, 12),
                value: datum.payload
              }))}
            />
            <JournalEvidenceSection
              title="Child workflows"
              empty="This run started no child workflows."
              items={detail.childLinks.map((link) => ({
                id: link.childRunId,
                label: link.childRunId,
                status: link.terminalStatus ?? "running",
                meta: link.childPackageDigest.slice(0, 12),
                value: { result: link.result, error: link.error }
              }))}
            />
          </div>
          <section className={classes.timelineSection} aria-labelledby="journal-events-heading">
            <div className={classes.sectionHeading}>
              <div>
                <Subtitle1 as="h2" id="journal-events-heading">
                  System event log
                </Subtitle1>
                <Caption1>Low-level state changes recorded by the workflow runtime.</Caption1>
              </div>
              <CounterBadge appearance="ghost" color="informative" count={detail.events.length} showZero />
            </div>
            {detail.events.length === 0 ? (
              <div className={classes.emptyState}>
                <HistoryRegular aria-hidden="true" />
                <div>
                  <Subtitle1>No events yet</Subtitle1>
                  <Body1>The run has not recorded a transition.</Body1>
                </div>
              </div>
            ) : (
              <ol className={classes.timeline}>
                {detail.events.map((event) => (
                  <li key={event.sequence}>
                    <span className={classes.timelineMarker} />
                    <div className={classes.eventBody}>
                      <div className={classes.eventHeading}>
                        <strong>{event.eventType}</strong>
                        <Badge appearance="outline">#{event.sequence}</Badge>
                      </div>
                      <Caption1>{new Date(event.recordedAt).toLocaleString()}</Caption1>
                      <details>
                        <summary>Event data</summary>
                        <pre>{persistedJson(event.payload)}</pre>
                      </details>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </details>
    </>
  )
}

function JournalEvidenceSection({
  title,
  empty,
  items
}: {
  title: string
  empty: string
  items: Array<{ id: string; label: string; status: string; meta: string; value: unknown; action?: React.ReactNode }>
}) {
  const classes = useRunDetailPageStyles()
  return (
    <section className={classes.evidenceSection} aria-label={title}>
      <div className={classes.sectionHeading}>
        <Subtitle1 as="h2">{title}</Subtitle1>
        <CounterBadge appearance="ghost" color="informative" count={items.length} showZero />
      </div>
      {items.length === 0 ? (
        <Caption1>{empty}</Caption1>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div className={classes.eventHeading}>
                <strong>{item.label}</strong>
                <Badge appearance="tint" color={journalStatusColor(item.status)}>
                  {formatIdentifierLabel(item.status)}
                </Badge>
              </div>
              <Caption1>{item.meta}</Caption1>
              {item.action}
              <details>
                <summary>Inspect evidence</summary>
                <pre>{persistedJson(item.value)}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function RunDetailPage() {
  const classes = useRunDetailPageStyles()
  const { runId } = useParams({ from: "/runs/$runId" })
  const navigate = useNavigate()
  const dispatchToast = useAppToast()
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [runAgainOpen, setRunAgainOpen] = useState(false)
  const [runAgainInput, setRunAgainInput] = useState("{}")
  const [runAgainError, setRunAgainError] = useState("")

  async function loadDetail() {
    try {
      setDetail(await getWorkflowRunDetail(runId))
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "We couldn't load this run. Refresh and try again.")
    } finally {
      setIsLoading(false)
    }
  }
  const pollDetail = useEffectEvent(loadDetail)

  async function cancelRun() {
    setBusyAction("cancel")
    try {
      await cancelJournalWorkflowRun(runId)
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Run cancelled",
        body: "New work is fenced; dispatched external effects were not undone."
      })
      await loadDetail()
    } catch (cancelError) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Cancellation failed",
        body: cancelError instanceof Error ? cancelError.message : "The run could not be cancelled."
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function retryActivation(activationId: string) {
    setBusyAction(activationId)
    try {
      await retryJournalWorkflowActivation(runId, activationId)
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Step queued",
        body: "Prior attempts remain available in the run evidence."
      })
      await loadDetail()
    } catch (retryError) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Retry blocked",
        body: retryError instanceof Error ? retryError.message : "The step could not be retried."
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function retryFromHere(activationId: string) {
    setBusyAction(activationId)
    try {
      const result = await retryJournalWorkflowFromHere(runId, activationId)
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Steps queued",
        body: `${result.affectedDescendantIds.length} blocked descendant activation(s) remain attached to this retry.`
      })
      await loadDetail()
    } catch (retryError) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Retry from here blocked",
        body: retryError instanceof Error ? retryError.message : "The affected steps could not be retried."
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function submitRunAgain() {
    let input: Record<string, JsonValue>
    try {
      const parsed: unknown = JSON.parse(runAgainInput)
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("Run input must be a JSON object")
      }
      input = parsed as Record<string, JsonValue>
      setRunAgainError("")
    } catch (parseError) {
      setRunAgainError(parseError instanceof Error ? parseError.message : "Enter a valid JSON object")
      return
    }
    setBusyAction("run-again")
    try {
      const result = await runJournalWorkflowAgain(runId, input)
      showAppToast(dispatchToast, {
        intent: "success",
        title: "New run created",
        body: `Workflow version ${result.version} is running from the selected input.`
      })
      await navigate({ to: "/runs/$runId", params: { runId: result.runId } })
    } catch (runAgainFailure) {
      setRunAgainError(runAgainFailure instanceof Error ? runAgainFailure.message : "A new run could not be created.")
    } finally {
      setBusyAction(null)
    }
  }

  async function resolveEffect(
    effect: WorkflowRunDetail["effects"][number],
    input: { outcome: "occurred" | "absent" | "indeterminate"; reason: string; result?: Record<string, JsonValue> }
  ) {
    setBusyAction(effect.effectId)
    try {
      await resolveJournalWorkflowEffect(runId, effect.effectId, input)
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Effect decision recorded",
        body: "The reason and provider evidence are preserved in the run journal."
      })
      await loadDetail()
    } finally {
      setBusyAction(null)
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void pollDetail(), 0)
    const intervalId = window.setInterval(() => void pollDetail(), 5_000)
    return () => {
      window.clearTimeout(initialLoadId)
      window.clearInterval(intervalId)
    }
  }, [runId])

  return (
    <main className={classes.page}>
      <div className={classes.toolbar}>
        <Link className={classes.backLink} to="/">
          <ArrowLeftRegular />
          Back to operations
        </Link>
        <Tooltip content="Refresh run" relationship="label">
          <Button
            appearance="subtle"
            icon={isLoading ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
            aria-label="Refresh run"
            onClick={() => void loadDetail()}
          />
        </Tooltip>
      </div>
      {error === null ? null : (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {detail === null ? null : (
        <AsyncStatus message={runMutationStatus(detail, busyAction)} pending={busyAction !== null} />
      )}
      {detail === null && isLoading ? <Spinner label="Loading run" /> : null}
      {detail === null ? null : (
        <WorkflowRunView
          detail={detail}
          busyAction={busyAction}
          onCancel={() => void cancelRun()}
          onResolveEffect={resolveEffect}
          onRetry={(activationId) => void retryActivation(activationId)}
          onRetryFromHere={(activationId) => void retryFromHere(activationId)}
          onRunAgain={() => {
            setRunAgainInput(persistedJson(detail.run.sealedManifest.input ?? {}))
            setRunAgainError("")
            setRunAgainOpen(true)
          }}
        />
      )}
      {!runAgainOpen || detail?.executionPackage.sourceKind !== "published" ? null : (
        <Dialog
          open
          onOpenChange={(_, data) => {
            if (!data.open && busyAction === null) {
              setRunAgainOpen(false)
            }
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Run workflow again</DialogTitle>
              <DialogContent>
                <Body1>
                  Create a new run from workflow version {detail.executionPackage.workflowVersion}. The current run and
                  its evidence remain unchanged.
                </Body1>
                <Field
                  label="Run input JSON"
                  validationState={runAgainError === "" ? "none" : "error"}
                  validationMessage={runAgainError}
                >
                  <Textarea
                    resize="vertical"
                    value={runAgainInput}
                    onChange={(_, data) => setRunAgainInput(data.value)}
                  />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" disabled={busyAction !== null} onClick={() => setRunAgainOpen(false)}>
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  disabled={busyAction !== null}
                  icon={busyAction === "run-again" ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
                  onClick={() => void submitRunAgain()}
                >
                  Create run
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </main>
  )
}
