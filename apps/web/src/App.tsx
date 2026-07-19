import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardFooter,
  CardHeader,
  CounterBadge,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  MessageBar,
  Option,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Title1,
  Tooltip
} from "@fluentui/react-components"
import {
  ArrowClockwiseRegular,
  BotRegular,
  ChevronRightRegular,
  OpenRegular,
  PersonArrowRightRegular
} from "@fluentui/react-icons"
import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useAppStyles } from "./App.styles"
import { boardGroupLabels, groupTasks, isAssignableTask, type BoardGroup, type TaskWithRun } from "./operations"
import { assignWorkItem, getControlPlaneSnapshot, type ControlPlaneSnapshot, type WorkflowRun } from "./services/api"

const boardGroups: BoardGroup[] = ["todo", "inProgress", "blocked"]

function activeAgentId(run: WorkflowRun): string {
  if (run.activeRole === "scrum_master") {
    return "scrum-master"
  }
  if (run.activeRole === "reviewer") {
    return "reviewer"
  }
  return run.assignedAgentId ?? "scrum-master"
}

function taskCountColor(group: BoardGroup): "brand" | "danger" | "important" | "informative" {
  if (group === "inProgress") {
    return "brand"
  }
  if (group === "blocked") {
    return "danger"
  }
  return "informative"
}

type TaskCardProps = {
  item: TaskWithRun
  assigning: boolean
  onAssign: (item: TaskWithRun) => void
}

function TaskCard({ item, assigning, onAssign }: TaskCardProps) {
  const classes = useAppStyles()
  return (
    <Card className={classes.taskCard} size="small">
      <CardHeader
        header={<Caption1 className={classes.identifier}>{item.task.identifier}</Caption1>}
        description={<Subtitle1 className={classes.taskTitle}>{item.task.title}</Subtitle1>}
      />
      <Body1 className={classes.description}>{item.task.description}</Body1>
      <CardFooter className={classes.cardFooter}>
        <Tooltip content="Open in Linear" relationship="label">
          <Button
            appearance="subtle"
            as="a"
            href={item.task.url}
            target="_blank"
            rel="noreferrer"
            icon={<OpenRegular />}
            aria-label={`Open ${item.task.identifier} in Linear`}
          />
        </Tooltip>
        {item.run === null && isAssignableTask(item.task) ? (
          <Button
            appearance="primary"
            icon={assigning ? <Spinner size="tiny" /> : <PersonArrowRightRegular />}
            disabled={assigning}
            onClick={() => onAssign(item)}
          >
            Assign agent
          </Button>
        ) : null}
        {item.run !== null ? (
          <Link className={classes.runLink} to="/runs/$runId" params={{ runId: item.run.runId }}>
            View run <ChevronRightRegular />
          </Link>
        ) : null}
        {item.run === null && item.task.state.type === "started" ? (
          <Caption1 className={classes.externalRunStatus}>Started outside control plane</Caption1>
        ) : null}
      </CardFooter>
    </Card>
  )
}

export function App() {
  const classes = useAppStyles()
  const [snapshot, setSnapshot] = useState<ControlPlaneSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null)
  const [pendingAssignment, setPendingAssignment] = useState<TaskWithRun | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  async function loadSnapshot(showSpinner = false, preserveOnError = false) {
    if (showSpinner) {
      setIsLoading(true)
    }
    try {
      setSnapshot(await getControlPlaneSnapshot())
      setError(null)
    } catch (loadError) {
      if (preserveOnError) {
        setError(null)
      } else {
        setError(
          loadError instanceof Error ? loadError.message : "We couldn't load agent operations. Refresh and try again."
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void loadSnapshot(), 0)
    const intervalId = window.setInterval(() => void loadSnapshot(false, true), 5_000)
    return () => {
      window.clearTimeout(initialLoadId)
      window.clearInterval(intervalId)
    }
  }, [])

  async function handleAssign() {
    if (pendingAssignment === null || selectedAgentId === null) {
      return
    }
    const workItemId = pendingAssignment.task.id
    setPendingAssignment(null)
    setAssigningTaskId(workItemId)
    try {
      await assignWorkItem(workItemId, selectedAgentId)
      await loadSnapshot()
    } catch (assignmentError) {
      setError(assignmentError instanceof Error ? assignmentError.message : "We couldn't assign an agent. Try again.")
    } finally {
      setAssigningTaskId(null)
    }
  }

  const grouped = snapshot === null ? null : groupTasks(snapshot)
  const activeRuns = snapshot?.runs.filter((run) => run.status === "queued" || run.status === "running") ?? []
  const engineeringAgents = snapshot?.agents.filter((agent) => agent.role === "engineer") ?? []
  const agentNames = new Map(snapshot?.agents.map((agent) => [agent.id, agent.name]) ?? [])

  function openAssignment(item: TaskWithRun) {
    setPendingAssignment(item)
    setSelectedAgentId(engineeringAgents[0]?.id ?? null)
  }

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerCopy}>
          <Caption1 className={classes.eyebrow}>Agency control</Caption1>
          <Title1 as="h1">Agent operations</Title1>
          <Body1 className={classes.subtitle}>Track Linear tasks, active agents, and workflow progress.</Body1>
        </div>
        <Button
          appearance="secondary"
          icon={isLoading ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
          disabled={isLoading}
          onClick={() => void loadSnapshot(true)}
        >
          Refresh
        </Button>
      </header>

      {error === null ? null : (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <section className={classes.metrics} aria-label="Agent status summary">
        <div>
          <strong>{snapshot?.tasks.length ?? 0}</strong>
          <span>Linear tasks</span>
        </div>
        <div>
          <strong>{activeRuns.length}</strong>
          <span>Active agents</span>
        </div>
        <div>
          <strong>{grouped?.blocked.length ?? 0}</strong>
          <span>Blocked</span>
        </div>
        <div>
          <strong>{snapshot?.runs.filter((run) => run.status === "published").length ?? 0}</strong>
          <span>Published</span>
        </div>
      </section>

      <section className={classes.agentsSection} aria-labelledby="active-agents-heading">
        <div className={classes.sectionHeading}>
          <div>
            <Subtitle1 as="h2" id="active-agents-heading">
              Active agents
            </Subtitle1>
            <Caption1>Agents with queued or running work</Caption1>
          </div>
          <BotRegular className={classes.sectionIcon} />
        </div>
        <div className={classes.agentList}>
          {activeRuns.map((run) => (
            <Link className={classes.agentRow} to="/runs/$runId" params={{ runId: run.runId }} key={run.runId}>
              <span className={classes.agentIdentity}>
                <strong>{agentNames.get(activeAgentId(run)) ?? "Unknown agent"}</strong>
                <small>
                  {run.sourceWorkItemIdentifier ?? "Reviewing ready work"} · {run.repository}
                </small>
              </span>
              <Badge appearance="tint" color="brand">
                {run.activeRole?.replace("_", " ") ?? "queued"}
              </Badge>
              <span className={classes.stage}>{run.stage}</span>
              <ChevronRightRegular />
            </Link>
          ))}
          {snapshot !== null && activeRuns.length === 0 ? (
            <Body1 className={classes.empty}>No agents are active.</Body1>
          ) : null}
        </div>
      </section>

      <section className={classes.boardSection} aria-labelledby="work-board-heading">
        <div className={classes.sectionHeading}>
          <div>
            <Subtitle1 as="h2" id="work-board-heading">
              Work board
            </Subtitle1>
            <Caption1>Updates every 5 seconds</Caption1>
          </div>
          {snapshot === null && isLoading ? <Spinner size="small" label="Loading tasks" /> : null}
        </div>
        <div className={classes.board}>
          {boardGroups.map((group) => (
            <section className={classes.column} key={group} aria-labelledby={`${group}-heading`}>
              <div className={classes.columnHeading}>
                <Subtitle1 as="h3" id={`${group}-heading`}>
                  {boardGroupLabels[group]}
                </Subtitle1>
                <CounterBadge
                  appearance="ghost"
                  color={taskCountColor(group)}
                  count={grouped?.[group]?.length ?? 0}
                  showZero
                />
              </div>
              <div className={classes.taskList}>
                {grouped?.[group]?.map((item) => (
                  <TaskCard
                    key={item.task.id}
                    item={item}
                    assigning={assigningTaskId === item.task.id}
                    onAssign={openAssignment}
                  />
                ))}
                {grouped?.[group]?.length === 0 ? <Caption1 className={classes.empty}>No tasks</Caption1> : null}
              </div>
            </section>
          ))}
        </div>
      </section>

      <Dialog
        open={pendingAssignment !== null}
        onOpenChange={(_, data) => {
          if (!data.open) {
            setPendingAssignment(null)
            setSelectedAgentId(null)
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Assign an agent to {pendingAssignment?.task.identifier}?</DialogTitle>
            <DialogContent>
              <p>
                The selected engineer will receive this task after scrum-master planning. The workflow runs checks,
                reviews and repairs its work, then creates a draft pull request.
              </p>
              <Field label="Engineering agent" required>
                <Dropdown
                  value={engineeringAgents.find((agent) => agent.id === selectedAgentId)?.name ?? ""}
                  selectedOptions={selectedAgentId === null ? [] : [selectedAgentId]}
                  onOptionSelect={(_, data) => setSelectedAgentId(data.optionValue ?? null)}
                >
                  {engineeringAgents.map((agent) => (
                    <Option key={agent.id} value={agent.id} text={agent.name}>
                      {agent.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setPendingAssignment(null)}>
                Cancel
              </Button>
              <Button appearance="primary" disabled={selectedAgentId === null} onClick={() => void handleAssign()}>
                Assign agent
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </main>
  )
}
