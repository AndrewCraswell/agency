import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Caption1,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Subtitle1,
  Tooltip,
  createTableColumn,
  type TableColumnDefinition,
  type TableColumnId
} from "@fluentui/react-components"
import {
  ArrowClockwiseRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  DismissRegular,
  OpenRegular,
  PersonArrowRightRegular,
  SearchRegular
} from "@fluentui/react-icons"
import { formatDistanceToNow } from "date-fns"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react"
import { arrayIncludes } from "ts-extras"
import {
  assignWorkItem,
  queryWorkItems,
  type AgentDefinition,
  type WorkItemQuery,
  type WorkItemQueryResponse
} from "@/services/api"
import { useOperationsWorkQueueStyles } from "./OperationsWorkQueue.styles"

const queueStatuses = ["todo", "in_progress", "blocked"] as const
const queueAges = ["day", "week", "month"] as const
const queueSorts = ["priority", "created", "updated", "identifier"] as const
const queueDirections = ["asc", "desc"] as const
const priorityLabels = ["No priority", "Urgent", "High", "Medium", "Low"] as const
const statusLabels = { todo: "Not started", in_progress: "In progress", blocked: "Blocked" } as const
const queueParsers = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(queueStatuses),
  repository: parseAsString,
  assignee: parseAsString,
  priority: parseAsInteger,
  age: parseAsStringLiteral(queueAges),
  sort: parseAsStringLiteral(queueSorts).withDefault("updated"),
  direction: parseAsStringLiteral(queueDirections).withDefault("desc"),
  cursor: parseAsString
}

type WorkItem = WorkItemQueryResponse["items"][number]

type OperationsWorkQueueProps = {
  agents: AgentDefinition[]
  onAssigned: () => Promise<void>
}

function priorityRank(priority: number): number {
  return priority === 0 ? 5 : priority
}

export function OperationsWorkQueue({ agents, onAssigned }: OperationsWorkQueueProps) {
  const classes = useOperationsWorkQueueStyles()
  const [queryState, setQueryState] = useQueryStates(queueParsers, { history: "push", shallow: true })
  const deferredQuery = useDeferredValue(queryState.q)
  const [result, setResult] = useState<WorkItemQueryResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [pendingItem, setPendingItem] = useState<WorkItem>()
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  const requestId = useRef(0)
  const engineeringAgents = agents.filter(({ role }) => role === "engineer")
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]))

  function currentQuery(): WorkItemQuery {
    return {
      q: deferredQuery === "" ? undefined : deferredQuery,
      status: queryState.status ?? undefined,
      repository: queryState.repository ?? undefined,
      assignee: queryState.assignee ?? undefined,
      priority: queryState.priority ?? undefined,
      age: queryState.age ?? undefined,
      sort: queryState.sort,
      direction: queryState.direction,
      cursor: queryState.cursor ?? undefined,
      pageSize: 25
    }
  }

  async function loadQueue(): Promise<void> {
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    setIsLoading(true)
    try {
      const response = await queryWorkItems(currentQuery())
      if (requestId.current === currentRequest) {
        setResult(response)
        setError(undefined)
      }
    } catch (loadError) {
      if (requestId.current === currentRequest) {
        setError(loadError instanceof Error ? loadError.message : "We couldn't load the work queue.")
      }
    } finally {
      if (requestId.current === currentRequest) {
        setIsLoading(false)
      }
    }
  }

  const loadCurrentQueue = useEffectEvent(() => {
    void loadQueue()
  })

  useEffect(() => {
    const timer = window.setTimeout(loadCurrentQueue, 0)
    return () => window.clearTimeout(timer)
  }, [
    deferredQuery,
    queryState.age,
    queryState.assignee,
    queryState.cursor,
    queryState.direction,
    queryState.priority,
    queryState.repository,
    queryState.sort,
    queryState.status
  ])

  function updateQuery(patch: Partial<typeof queryState>): void {
    void setQueryState({ ...patch, cursor: null })
  }

  function toggleExpanded(taskId: string): void {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  async function assign(): Promise<void> {
    if (pendingItem === undefined || selectedAgentId === "" || isAssigning) {
      return
    }
    setIsAssigning(true)
    try {
      await assignWorkItem(pendingItem.task.id, selectedAgentId)
      setPendingItem(undefined)
      setSelectedAgentId("")
      await Promise.all([loadQueue(), onAssigned()])
    } catch (assignmentError) {
      setError(assignmentError instanceof Error ? assignmentError.message : "We couldn't assign this work item.")
    } finally {
      setIsAssigning(false)
    }
  }

  const columns: TableColumnDefinition<WorkItem>[] = [
    createTableColumn({
      columnId: "identifier",
      compare: (left, right) => left.task.identifier.localeCompare(right.task.identifier, undefined, { numeric: true }),
      renderHeaderCell: () => "Work item",
      renderCell: (item) => {
        const isExpanded = expandedIds.has(item.task.id)
        return (
          <div className={classes.workItemCell}>
            <Tooltip content={isExpanded ? "Hide description" : "Show description"} relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={isExpanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
                aria-label={`${isExpanded ? "Hide" : "Show"} ${item.task.identifier} description`}
                onClick={() => toggleExpanded(item.task.id)}
              />
            </Tooltip>
            <span className={classes.workItemIdentity}>
              <Body1Strong>{item.task.identifier}</Body1Strong>
              <Body1>{item.task.title}</Body1>
              {isExpanded ? (
                <Caption1 className={classes.description}>{item.task.description || "No description"}</Caption1>
              ) : null}
            </span>
          </div>
        )
      }
    }),
    createTableColumn({
      columnId: "status",
      compare: (left, right) => left.status.localeCompare(right.status),
      renderHeaderCell: () => "Status",
      renderCell: (item) => <Badge appearance="tint">{statusLabels[item.status]}</Badge>
    }),
    createTableColumn({
      columnId: "priority",
      compare: (left, right) => priorityRank(left.task.priority) - priorityRank(right.task.priority),
      renderHeaderCell: () => "Priority",
      renderCell: (item) => priorityLabels[item.task.priority]
    }),
    createTableColumn({
      columnId: "repository",
      compare: (left, right) => (left.run?.repository ?? "").localeCompare(right.run?.repository ?? ""),
      renderHeaderCell: () => "Repository",
      renderCell: (item) => item.run?.repository ?? "Not assigned"
    }),
    createTableColumn({
      columnId: "assignee",
      compare: (left, right) => (left.run?.assignedAgentId ?? "").localeCompare(right.run?.assignedAgentId ?? ""),
      renderHeaderCell: () => "Assignee",
      renderCell: (item) => agentNames.get(item.run?.assignedAgentId ?? "") ?? "Not assigned"
    }),
    createTableColumn({
      columnId: "updated",
      compare: (left, right) => left.task.updatedAt.localeCompare(right.task.updatedAt),
      renderHeaderCell: () => "Updated",
      renderCell: (item) => formatDistanceToNow(new Date(item.task.updatedAt), { addSuffix: true })
    }),
    createTableColumn({
      columnId: "actions",
      compare: () => 0,
      renderHeaderCell: () => "Actions",
      renderCell: (item) => (
        <div className={classes.actions}>
          <Tooltip content={`Open ${item.task.identifier} in Linear`} relationship="label">
            <Button
              as="a"
              appearance="subtle"
              href={item.task.url}
              target="_blank"
              rel="noreferrer"
              icon={<OpenRegular />}
              aria-label={`Open ${item.task.identifier} in Linear`}
            />
          </Tooltip>
          {item.status === "todo" ? (
            <Button
              appearance="primary"
              size="small"
              icon={<PersonArrowRightRegular />}
              aria-label={`Assign ${item.task.identifier}`}
              onClick={() => {
                setPendingItem(item)
                setSelectedAgentId("")
              }}
            >
              Assign
            </Button>
          ) : null}
        </div>
      )
    })
  ]

  function onSortChange(sortColumn: TableColumnId | undefined, sortDirection: "ascending" | "descending"): void {
    if (typeof sortColumn !== "string" || !arrayIncludes(queueSorts, sortColumn)) {
      return
    }
    void setQueryState({ sort: sortColumn, direction: sortDirection === "ascending" ? "asc" : "desc", cursor: null })
  }

  function updateStatus(value: string): void {
    updateQuery({ status: arrayIncludes(queueStatuses, value) ? value : null })
  }

  function updateAge(value: string): void {
    updateQuery({ age: arrayIncludes(queueAges, value) ? value : null })
  }

  const hasFilters =
    queryState.q !== "" ||
    queryState.status !== null ||
    queryState.repository !== null ||
    queryState.assignee !== null ||
    queryState.priority !== null ||
    queryState.age !== null
  let tableContent = <Spinner className={classes.loading} label="Loading work queue" />
  if (result !== undefined) {
    tableContent =
      result.items.length === 0 ? (
        <div className={classes.empty}>
          <Body1Strong>No work items match these filters.</Body1Strong>
          <Body1>Change or clear a filter to widen the queue.</Body1>
        </div>
      ) : (
        <DataGrid
          className={classes.table}
          items={result.items}
          columns={columns}
          sortable
          focusMode="composite"
          getRowId={(item) => item.task.id}
          sortState={{
            sortColumn: queryState.sort,
            sortDirection: queryState.direction === "asc" ? "ascending" : "descending"
          }}
          onSortChange={(_, data) => onSortChange(data.sortColumn, data.sortDirection)}
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody<WorkItem>>
            {({ item, rowId }) => (
              <DataGridRow<WorkItem> key={rowId}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )
  }

  return (
    <section className={classes.view} aria-labelledby="work-queue-heading">
      <div className={classes.heading}>
        <div>
          <Subtitle1 as="h2" id="work-queue-heading">
            Work queue
          </Subtitle1>
          <Caption1>{result === undefined ? "Loading work items" : `${result.total} work items`}</Caption1>
        </div>
        <Button icon={<ArrowClockwiseRegular />} disabled={isLoading} onClick={() => void loadQueue()}>
          Refresh
        </Button>
      </div>
      <div className={classes.filters} aria-label="Work queue filters">
        <Field label="Search" className={classes.searchField}>
          <Input
            contentBefore={<SearchRegular />}
            value={queryState.q}
            placeholder="Identifier, title, or description"
            onChange={(_, data) => updateQuery({ q: data.value })}
          />
        </Field>
        <Field label="Status">
          <Select value={queryState.status ?? ""} onChange={(_, data) => updateStatus(data.value)}>
            <option value="">All statuses</option>
            {queueStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Repository">
          <Select
            value={queryState.repository ?? ""}
            onChange={(_, data) => updateQuery({ repository: data.value || null })}
          >
            <option value="">All repositories</option>
            {result?.aggregates.repositories.map(({ value, count }) => (
              <option key={value} value={value}>
                {value} ({count})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee">
          <Select
            value={queryState.assignee ?? ""}
            onChange={(_, data) => updateQuery({ assignee: data.value || null })}
          >
            <option value="">All assignees</option>
            {result?.aggregates.assignees.map(({ value, count }) => (
              <option key={value} value={value}>
                {agentNames.get(value) ?? value} ({count})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={queryState.priority === null ? "" : String(queryState.priority)}
            onChange={(_, data) => updateQuery({ priority: data.value === "" ? null : Number(data.value) })}
          >
            <option value="">All priorities</option>
            {result?.aggregates.priorities.map(({ value, count }) => (
              <option key={value} value={value}>
                {priorityLabels[value]} ({count})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Age">
          <Select value={queryState.age ?? ""} onChange={(_, data) => updateAge(data.value)}>
            <option value="">Any age</option>
            <option value="day">Older than 1 day</option>
            <option value="week">Older than 1 week</option>
            <option value="month">Older than 1 month</option>
          </Select>
        </Field>
        {hasFilters ? (
          <Button
            className={classes.clearButton}
            appearance="subtle"
            icon={<DismissRegular />}
            onClick={() =>
              void setQueryState({
                q: null,
                status: null,
                repository: null,
                assignee: null,
                priority: null,
                age: null,
                cursor: null
              })
            }
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      {error === undefined ? null : (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <div className={classes.tableSurface}>{tableContent}</div>
      {result === undefined ? null : (
        <div className={classes.pagination}>
          <Caption1>
            Showing {result.items.length} of {result.total}
          </Caption1>
          <div className={classes.paginationActions}>
            <Button
              disabled={result.previousCursor === null || isLoading}
              onClick={() => void setQueryState({ cursor: result.previousCursor })}
            >
              Previous
            </Button>
            <Button
              disabled={result.nextCursor === null || isLoading}
              onClick={() => void setQueryState({ cursor: result.nextCursor })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={pendingItem !== undefined}
        onOpenChange={(_, data) => {
          if (!data.open && !isAssigning) {
            setPendingItem(undefined)
          }
        }}
      >
        <DialogSurface aria-describedby={undefined}>
          <DialogBody>
            <DialogTitle>Assign {pendingItem?.task.identifier}</DialogTitle>
            <DialogContent className={classes.dialogContent}>
              <Body1>Select the engineer who will implement this work item after planning.</Body1>
              <Field label="Engineering agent" required>
                <Select value={selectedAgentId} onChange={(_, data) => setSelectedAgentId(data.value)}>
                  <option value="" disabled>
                    Select an engineer
                  </option>
                  {engineeringAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button disabled={isAssigning} onClick={() => setPendingItem(undefined)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={selectedAgentId === "" || isAssigning}
                onClick={() => void assign()}
              >
                {isAssigning ? "Assigning" : "Assign"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  )
}
