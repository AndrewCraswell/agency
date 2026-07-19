import {
  Badge,
  Body1,
  Button,
  Caption1,
  CounterBadge,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
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
  PersonRegular
} from "@fluentui/react-icons"
import { Link, useParams } from "@tanstack/react-router"
import { useEffect, useEffectEvent, useState } from "react"
import { getWorkflowRunDetail, langSmithTraceUrl, traceReference, type WorkflowRunDetail } from "@/services/api"
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

export function RunDetailPage() {
  const classes = useRunDetailPageStyles()
  const { runId } = useParams({ from: "/runs/$runId" })
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
      {detail === null && isLoading ? <Spinner label="Loading run" /> : null}
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
