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
  Tooltip,
  mergeClasses
} from "@fluentui/react-components"
import {
  ArrowClockwiseRegular,
  ArrowLeftRegular,
  ArrowRightRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  CheckmarkRegular,
  HistoryRegular,
  OpenRegular,
  PersonRegular,
  StopRegular
} from "@fluentui/react-icons"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect, useEffectEvent, useState } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  cancelJournalWorkflowRun,
  getJournalWorkflowRunDetail,
  getWorkflowRunDetail,
  langSmithTraceUrl,
  resolveJournalWorkflowEffect,
  resumeJournalWorkflowRun,
  retryJournalWorkflowActivation,
  retryJournalWorkflowFromHere,
  runJournalWorkflowAgain,
  traceReference,
  type JournalWorkflowRunDetail,
  type JsonValue,
  type WorkflowRunDetail
} from "@/services/api"
import { useRunDetailPageStyles } from "./RunDetailPage.styles"

const stages = ["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"] as const

function runStatusColor(status: WorkflowRunDetail["run"]["status"]): "brand" | "danger" | "success" {
  if (status === "failed" || status === "blocked") {
    return "danger"
  }
  if (status === "published") {
    return "success"
  }
  return "brand"
}

function eventOutcomeColor(
  outcome: WorkflowRunDetail["events"][number]["outcome"]
): "danger" | "informative" | "success" {
  if (outcome === "failed") {
    return "danger"
  }
  if (outcome === "completed") {
    return "success"
  }
  return "informative"
}

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

function retryFromHereDescendants(detail: JournalWorkflowRunDetail, stepId: string) {
  const reachable = new Set<string>()
  const pending = [stepId]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) {
      continue
    }
    for (const connection of detail.graph.connections) {
      if (connection.source.stepId !== current || reachable.has(connection.target.stepId)) {
        continue
      }
      reachable.add(connection.target.stepId)
      pending.push(connection.target.stepId)
    }
  }
  reachable.delete(stepId)
  return detail.activations.filter((activation) => reachable.has(activation.stepId))
}

function EffectResolutionAction({
  effect,
  busy,
  onSubmit
}: {
  effect: JournalWorkflowRunDetail["effects"][number]
  busy: boolean
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
        <Button size="small" disabled={busy}>
          Needs confirmation
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

function JournalRunView({
  detail,
  busyAction,
  onCancel,
  onResolveEffect,
  onResume,
  onRetry,
  onRetryFromHere,
  onRunAgain
}: {
  detail: JournalWorkflowRunDetail
  busyAction: string | null
  onCancel: () => void
  onResolveEffect: (
    effect: JournalWorkflowRunDetail["effects"][number],
    input: { outcome: "occurred" | "absent" | "indeterminate"; reason: string; result?: Record<string, JsonValue> }
  ) => Promise<void>
  onResume: (wait: JournalWorkflowRunDetail["waits"][number]) => void
  onRetry: (activationId: string) => void
  onRetryFromHere: (activationId: string) => void
  onRunAgain: () => void
}) {
  const classes = useRunDetailPageStyles()
  const attemptsByActivation = Map.groupBy(detail.attempts, ({ activationId }) => activationId)
  return (
    <>
      <header className={classes.header}>
        <div className={classes.headerIdentity}>
          <Caption1 className={classes.eyebrow}>Workflow version {detail.executionPackage.workflowVersion}</Caption1>
          <Title1 as="h1">Workflow run</Title1>
          <Body1 className={classes.runId}>{detail.run.runId}</Body1>
        </div>
        <div className={classes.runActions}>
          {!detail.run.triggerIdentity.startsWith("child:") && (
            <Button disabled={busyAction !== null} icon={<ArrowSyncRegular />} onClick={onRunAgain}>
              Run again
            </Button>
          )}
          {!(["succeeded", "failed", "cancelled", "abandoned"] as string[]).includes(detail.run.status) && (
            <Button
              disabled={busyAction !== null}
              icon={busyAction === "cancel" ? <Spinner size="tiny" /> : <StopRegular />}
              onClick={onCancel}
            >
              Cancel run
            </Button>
          )}
          <Badge appearance="filled" color={journalStatusColor(detail.run.status)}>
            {detail.run.status}
          </Badge>
        </div>
      </header>
      <dl className={classes.details} aria-label="Run metadata">
        <div>
          <dt>
            <Caption1>Trigger</Caption1>
          </dt>
          <dd>
            <Body1>{detail.run.triggerIdentity}</Body1>
          </dd>
        </div>
        <div>
          <dt>
            <Caption1>Package</Caption1>
          </dt>
          <dd>
            <Body1 className={classes.runId}>{detail.run.packageDigest}</Body1>
          </dd>
        </div>
        <div>
          <dt>
            <Caption1>Last event</Caption1>
          </dt>
          <dd>
            <Body1>Sequence {detail.run.latestSequence}</Body1>
          </dd>
        </div>
      </dl>
      <section className={classes.workflowSection} aria-labelledby="journal-graph-heading">
        <div className={classes.sectionHeading}>
          <div>
            <Subtitle1 as="h2" id="journal-graph-heading">
              Immutable graph
            </Subtitle1>
            <Caption1>{detail.graph.steps.length} steps from the sealed execution package</Caption1>
          </div>
          <CounterBadge appearance="ghost" color="informative" count={detail.activations.length} showZero />
        </div>
        <ol className={classes.activationList}>
          {detail.graph.topologicalOrder.map((stepId) => {
            const step = detail.graph.steps.find(({ id }) => id === stepId)
            if (step === undefined) {
              return null
            }
            const activations = detail.activations.filter((activation) => activation.stepId === stepId)
            return (
              <li key={stepId}>
                <div className={classes.eventHeading}>
                  <strong>{step.label}</strong>
                  <Caption1>{step.definition.kind.replaceAll("_", " ")}</Caption1>
                </div>
                {activations.length === 0 ? (
                  <Caption1>Not activated</Caption1>
                ) : (
                  activations.map((activation) => (
                    <div className={classes.activationRow} key={activation.activationId}>
                      <Badge appearance="tint" color={journalStatusColor(activation.status)}>
                        {activation.status}
                      </Badge>
                      <code>{activation.activationId.slice(0, 12)}</code>
                      <Caption1>
                        {activation.scope.length === 0
                          ? "root scope"
                          : activation.scope
                              .map((scope) => (scope.kind === "loop" ? `${scope.key}:${scope.iteration}` : scope.key))
                              .join(" / ")}
                      </Caption1>
                      <Caption1>{attemptsByActivation.get(activation.activationId)?.length ?? 0} attempt(s)</Caption1>
                      {activation.status === "failed" && activation.selectedAttemptOrdinal === null ? (
                        <>
                          <Button
                            size="small"
                            disabled={busyAction !== null}
                            icon={
                              busyAction === activation.activationId ? (
                                <Spinner size="tiny" />
                              ) : (
                                <ArrowClockwiseRegular />
                              )
                            }
                            onClick={() => onRetry(activation.activationId)}
                          >
                            Retry step
                          </Button>
                          {retryFromHereDescendants(detail, activation.stepId).every(
                            (descendant) =>
                              descendant.status === "blocked" && descendant.selectedAttemptOrdinal === null
                          ) ? (
                            <Button
                              size="small"
                              appearance="subtle"
                              disabled={busyAction !== null}
                              onClick={() => onRetryFromHere(activation.activationId)}
                            >
                              Retry from here
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))
                )}
              </li>
            )
          })}
        </ol>
      </section>
      <div className={classes.diagnosticGrid}>
        <JournalEvidenceSection
          title="Attempts"
          empty="No attempts yet"
          items={detail.attempts.map((attempt) => ({
            id: `${attempt.activationId}:${attempt.ordinal}`,
            label: `Attempt ${attempt.ordinal}`,
            status: attempt.status,
            meta: attempt.activationId.slice(0, 12),
            value: {
              input: attempt.input,
              output: attempt.output,
              error: attempt.error,
              usage: attempt.usage,
              evidence: attempt.evidence
            }
          }))}
        />
        <JournalEvidenceSection
          title="Waits"
          empty="No durable waits"
          items={detail.waits.map((wait) => ({
            id: wait.waitId,
            label: wait.correlationKey,
            status: wait.status,
            meta: `Expires ${new Date(wait.expiresAt).toLocaleString()}`,
            value: { acceptedInputSchema: wait.acceptedInputSchema, winningEventSequence: wait.winningEventSequence },
            action:
              wait.status === "pending" && new Date(wait.expiresAt) > new Date() ? (
                <Button size="small" disabled={busyAction !== null} onClick={() => onResume(wait)}>
                  Resume
                </Button>
              ) : undefined
          }))}
        />
        <JournalEvidenceSection
          title="Effects"
          empty="No external effects"
          items={detail.effects.map((effect) => ({
            id: effect.effectId,
            label: `${effect.provider} ${effect.effectSlot}`,
            status: effect.status,
            meta: effect.requestDigest.slice(0, 12),
            value: { request: effect.request, result: effect.result, reconciliation: effect.reconciliation },
            action:
              effect.status === "unknown" || effect.status === "conflict" ? (
                <EffectResolutionAction
                  effect={effect}
                  busy={busyAction !== null}
                  onSubmit={(input) => onResolveEffect(effect, input)}
                />
              ) : undefined
          }))}
        />
        <JournalEvidenceSection
          title="Data and artifacts"
          empty="No produced data"
          items={detail.data.map((datum) => ({
            id: datum.datumId,
            label: datum.name,
            status: datum.kind,
            meta: datum.digest.slice(0, 12),
            value: datum.payload
          }))}
        />
        <JournalEvidenceSection
          title="Child runs"
          empty="No child workflows"
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
              Event history
            </Subtitle1>
            <Caption1>Ordered persisted transitions</Caption1>
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
                    <summary>Persisted payload</summary>
                    <pre>{persistedJson(event.payload)}</pre>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
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
                  {item.status}
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
  const [journalDetail, setJournalDetail] = useState<JournalWorkflowRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [resumeWait, setResumeWait] = useState<JournalWorkflowRunDetail["waits"][number] | null>(null)
  const [resumeEvent, setResumeEvent] = useState("{}")
  const [resumeError, setResumeError] = useState("")
  const [runAgainOpen, setRunAgainOpen] = useState(false)
  const [runAgainInput, setRunAgainInput] = useState("{}")
  const [runAgainError, setRunAgainError] = useState("")

  async function loadDetail() {
    try {
      const next = await getJournalWorkflowRunDetail(runId)
      setJournalDetail(next)
      setDetail(null)
      setError(null)
    } catch {
      try {
        setDetail(await getWorkflowRunDetail(runId))
        setJournalDetail(null)
        setError(null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "We couldn't load this run. Refresh and try again.")
      }
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

  async function submitResume() {
    if (resumeWait === null) {
      return
    }
    let event: Record<string, JsonValue>
    try {
      const parsed: unknown = JSON.parse(resumeEvent)
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("Resume event must be a JSON object")
      }
      event = parsed as Record<string, JsonValue>
      setResumeError("")
    } catch (parseError) {
      setResumeError(parseError instanceof Error ? parseError.message : "Enter a valid JSON object")
      return
    }
    setBusyAction(resumeWait.waitId)
    try {
      const result = await resumeJournalWorkflowRun(runId, resumeWait.correlationKey, event)
      if (result.resumed === null) {
        throw new Error("This wait is no longer pending")
      }
      setResumeWait(null)
      setResumeEvent("{}")
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Run resumed",
        body: "The event was validated and committed to the journal."
      })
      await loadDetail()
    } catch (resumeFailure) {
      setResumeError(resumeFailure instanceof Error ? resumeFailure.message : "The run could not be resumed.")
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
    effect: JournalWorkflowRunDetail["effects"][number],
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

  const currentStageIndex = detail === null ? -1 : stages.indexOf(detail.run.stage)

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
      {detail === null && journalDetail === null && isLoading ? <Spinner label="Loading run" /> : null}
      {journalDetail === null ? null : (
        <JournalRunView
          detail={journalDetail}
          busyAction={busyAction}
          onCancel={() => void cancelRun()}
          onResolveEffect={resolveEffect}
          onResume={(wait) => {
            setResumeWait(wait)
            setResumeEvent("{}")
            setResumeError("")
          }}
          onRetry={(activationId) => void retryActivation(activationId)}
          onRetryFromHere={(activationId) => void retryFromHere(activationId)}
          onRunAgain={() => {
            setRunAgainInput(persistedJson(journalDetail.run.sealedManifest.input ?? {}))
            setRunAgainError("")
            setRunAgainOpen(true)
          }}
        />
      )}
      {resumeWait === null ? null : (
        <Dialog
          open
          onOpenChange={(_, data) => {
            if (!data.open && busyAction === null) {
              setResumeWait(null)
            }
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Resume workflow</DialogTitle>
              <DialogContent>
                <Body1>
                  Send an event for <code>{resumeWait?.correlationKey}</code>.
                </Body1>
                <Field
                  label="Event JSON"
                  validationState={resumeError === "" ? "none" : "error"}
                  validationMessage={resumeError}
                >
                  <Textarea resize="vertical" value={resumeEvent} onChange={(_, data) => setResumeEvent(data.value)} />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" disabled={busyAction !== null} onClick={() => setResumeWait(null)}>
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  disabled={busyAction !== null}
                  icon={busyAction === resumeWait?.waitId ? <Spinner size="tiny" /> : undefined}
                  onClick={() => void submitResume()}
                >
                  Resume
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
      {!runAgainOpen ? null : (
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
                  Create a new run from workflow version {journalDetail?.executionPackage.workflowVersion}. The current
                  run and its evidence remain unchanged.
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
      {detail === null ? null : (
        <>
          <header className={classes.header}>
            <div className={classes.headerIdentity}>
              <Caption1 className={classes.eyebrow}>{detail.run.sourceWorkItemIdentifier ?? "Workflow run"}</Caption1>
              <Title1 as="h1">{detail.run.activeRole?.replace("_", " ") ?? "Workflow details"}</Title1>
              <Body1 className={classes.runId}>{detail.run.runId}</Body1>
            </div>
            <Badge appearance="filled" color={runStatusColor(detail.run.status)}>
              {detail.run.status}
            </Badge>
          </header>
          <section className={classes.stageSection} aria-labelledby="stage-heading">
            <Subtitle1 as="h2" id="stage-heading">
              Delivery stage
            </Subtitle1>
            <ol className={classes.stageList}>
              {stages.map((stage, index) => {
                let stateClass = classes.stagePending
                let stateLabel = "not started"
                if (index < currentStageIndex) {
                  stateClass = classes.stageComplete
                  stateLabel = "completed"
                } else if (index === currentStageIndex) {
                  stateClass = classes.stageCurrent
                  stateLabel = "current stage"
                }

                return (
                  <li
                    className={mergeClasses(classes.stageItem, stateClass)}
                    key={stage}
                    aria-current={index === currentStageIndex ? "step" : undefined}
                    aria-label={`${stage}, ${stateLabel}`}
                  >
                    <span>{index < currentStageIndex ? <CheckmarkRegular aria-hidden="true" /> : index + 1}</span>
                    <small>{stage}</small>
                  </li>
                )
              })}
            </ol>
          </section>
          <dl className={classes.details} aria-label="Run metadata">
            <div>
              <dt>
                <Caption1>Repository</Caption1>
              </dt>
              <dd>
                <Body1>{detail.run.repository}</Body1>
              </dd>
            </div>
            <div>
              <dt>
                <Caption1>Last updated</Caption1>
              </dt>
              <dd>
                <Body1>{new Date(detail.run.updatedAt).toLocaleString()}</Body1>
              </dd>
            </div>
            <div>
              <dt>
                <Caption1>Pull request</Caption1>
              </dt>
              <dd>
                <Body1>{detail.run.pullRequestNumber ?? "Not created"}</Body1>
              </dd>
            </div>
          </dl>
          <section className={classes.workflowSection} aria-labelledby="workflow-heading">
            <div className={classes.sectionHeading}>
              <div>
                <Subtitle1 as="h2" id="workflow-heading">
                  Agent workflow
                </Subtitle1>
                <Caption1>
                  {detail.workflow.name} | {detail.workflow.graphVersion}
                </Caption1>
              </div>
              <CounterBadge appearance="ghost" color="informative" count={detail.workflow.nodes.length} />
            </div>
            <ol className={classes.workflowNodes}>
              {detail.workflow.nodes.map((node) => {
                const isActive = node.stages.includes(detail.run.stage)
                const NodeIcon = node.agentId === null ? CheckmarkCircleRegular : PersonRegular
                return (
                  <li
                    className={mergeClasses(classes.workflowNode, isActive && classes.workflowNodeActive)}
                    key={node.id}
                  >
                    <div className={classes.workflowNodeHeading}>
                      <span className={classes.workflowNodeIcon}>
                        <NodeIcon aria-hidden="true" />
                      </span>
                      {isActive ? (
                        <Badge appearance="tint" color="brand">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                    <strong>{node.label}</strong>
                    <Caption1 className={classes.workflowAgent}>{node.agentName ?? "Control plane"}</Caption1>
                    <Body1>{node.description}</Body1>
                  </li>
                )
              })}
            </ol>
            <Subtitle1 as="h3" className={classes.routeHeading}>
              Routes
            </Subtitle1>
            <ul className={classes.workflowRoutes}>
              {detail.workflow.edges.map((edge) => {
                const source = detail.workflow.nodes.find((node) => node.id === edge.source)
                const target = detail.workflow.nodes.find((node) => node.id === edge.target)
                const EdgeIcon = edge.kind === "loop" ? ArrowSyncRegular : ArrowRightRegular
                return (
                  <li key={`${edge.source}-${edge.target}-${edge.label}`}>
                    <strong>{source?.label ?? edge.source}</strong>
                    <span className={classes.workflowTransition}>
                      <EdgeIcon aria-hidden="true" />
                      <Caption1>{edge.label}</Caption1>
                    </span>
                    <strong>{target?.label ?? edge.target}</strong>
                  </li>
                )
              })}
            </ul>
          </section>
          <section className={classes.timelineSection} aria-labelledby="timeline-heading">
            <div className={classes.sectionHeading}>
              <div>
                <Subtitle1 as="h2" id="timeline-heading">
                  Run activity
                </Subtitle1>
                <Caption1>Workflow events and LangSmith traces</Caption1>
              </div>
              <CounterBadge appearance="ghost" color="informative" count={detail.events.length} showZero />
            </div>
            {detail.events.length === 0 ? (
              <div className={classes.emptyState}>
                <HistoryRegular aria-hidden="true" />
                <div>
                  <Subtitle1>No activity yet</Subtitle1>
                  <Body1>Workflow events and trace links will appear here after the agent starts.</Body1>
                </div>
              </div>
            ) : (
              <ol className={classes.timeline}>
                {detail.events.map((event) => {
                  const trace = traceReference(event)
                  const traceUrl = langSmithTraceUrl(event)
                  return (
                    <li key={event.eventId}>
                      <span className={classes.timelineMarker} />
                      <div className={classes.eventBody}>
                        <div className={classes.eventHeading}>
                          <strong>{event.node}</strong>
                          <Badge appearance="tint" color={eventOutcomeColor(event.outcome)}>
                            {event.outcome}
                          </Badge>
                        </div>
                        <Body1>{event.summary}</Body1>
                        <Caption1>{new Date(event.createdAt).toLocaleString()}</Caption1>
                        {trace.success ? (
                          <div className={classes.traceReference}>
                            <code>{trace.data.traceId}</code>
                            {traceUrl === null ? null : (
                              <Button
                                as="a"
                                href={traceUrl}
                                target="_blank"
                                rel="noreferrer"
                                size="small"
                                appearance="subtle"
                                icon={<OpenRegular />}
                              >
                                Open trace
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  )
}
