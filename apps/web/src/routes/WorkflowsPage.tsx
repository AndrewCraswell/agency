import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Link as FluentLink,
  makeStyles,
  Select,
  Spinner,
  Subtitle2,
  Title1,
  tokens
} from "@fluentui/react-components"
import {
  AddRegular,
  ArrowRightRegular,
  BranchForkRegular,
  ClockRegular,
  PlugConnectedRegular
} from "@fluentui/react-icons"
import { createLink, useNavigate, useSearch } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  createWorkflow,
  getIntegrationResourceInventory,
  listWorkflowSchedules,
  listWorkflows,
  ApiRequestError,
  type IntegrationResourceInventory,
  type WorkflowSchedule,
  type WorkflowSummary
} from "@/services/api"

const useStyles = makeStyles({
  page: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXL,
    "@media (max-width: 720px)": { padding: tokens.spacingHorizontalL }
  },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: tokens.spacingHorizontalL },
  headingCopy: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  list: { display: "flex", flexDirection: "column", borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.5fr) minmax(180px, 1fr) 150px 120px 32px",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
    minHeight: "84px",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    "@media (max-width: 800px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      "& > :nth-child(2), & > :nth-child(3), & > :nth-child(4)": { display: "none" }
    }
  },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  description: {
    color: tokens.colorNeutralForeground2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  triggers: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  empty: { minHeight: "260px", display: "grid", placeItems: "center", color: tokens.colorNeutralForeground3 },
  emptyCopy: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM },
  dialogContent: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  prerequisite: { display: "flex", flexDirection: "column", alignItems: "start", gap: tokens.spacingVerticalS }
})

function triggerIcon(kind: "manual" | "webhook" | "schedule") {
  if (kind === "schedule") {
    return <ClockRegular />
  }
  if (kind === "webhook") {
    return <PlugConnectedRegular />
  }
  return <BranchForkRegular />
}

function scheduleHealthColor(health: WorkflowSchedule["health"]): "danger" | "informative" | "warning" {
  if (health === "retrying") {
    return "danger"
  }
  if (health === "running") {
    return "warning"
  }
  return "informative"
}

const RouterLink = createLink(FluentLink)

export function WorkflowsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const search = useSearch({ from: "/workflows" })
  const dispatchToast = useAppToast()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>()
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [repositories, setRepositories] = useState<IntegrationResourceInventory["resources"]>([])
  const [repositoryId, setRepositoryId] = useState("")
  const [repositoriesLoading, setRepositoriesLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; repository?: string }>({})

  useEffect(() => {
    let active = true
    void Promise.all([listWorkflows(), listWorkflowSchedules()])
      .then(([value, loadedSchedules]) => {
        if (active) {
          setWorkflows(value)
          setSchedules(loadedSchedules)
        }
      })
      .catch((error: unknown) => {
        const body = error instanceof Error ? error.message : "Workflows could not be loaded."
        showAppToast(dispatchToast, { intent: "error", title: "Workflows unavailable", body })
      })
    return () => {
      active = false
    }
  }, [dispatchToast])

  async function openCreate(initialName = ""): Promise<void> {
    setName(initialName)
    setRepositoryId("")
    setRepositories([])
    setFieldErrors({})
    creatingRef.current = false
    setCreating(false)
    setCreateOpen(true)
    setRepositoriesLoading(true)
    try {
      const inventory = await getIntegrationResourceInventory("repository.read")
      const available = inventory.resources.filter(
        ({ provider, resource }) => provider === "github" && resource.resourceType === "repository" && !resource.stale
      )
      setRepositories(available)
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Repositories unavailable",
        body: error instanceof Error ? error.message : "We couldn't load your connected repositories."
      })
    } finally {
      setRepositoriesLoading(false)
    }
  }

  const openCreateFromSearch = useEffectEvent((initialName: string) => {
    void openCreate(initialName)
  })

  useEffect(() => {
    if (search.create !== true) {
      return
    }
    const timer = setTimeout(() => {
      openCreateFromSearch(search.name ?? "")
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [search.create, search.name])

  function closeCreate(): void {
    setCreateOpen(false)
    if (search.create === true) {
      void navigate({ to: "/workflows", search: {}, replace: true })
    }
  }

  async function create(): Promise<void> {
    if (creatingRef.current) {
      return
    }
    const selected = repositories.find(({ resource }) => resource.externalId === repositoryId)
    if (selected === undefined) {
      setFieldErrors((current) => ({ ...current, repository: "Select a GitHub repository." }))
      return
    }
    creatingRef.current = true
    setCreating(true)
    setFieldErrors({})
    try {
      const workflow = await createWorkflow({
        template: "blank",
        name: name.trim(),
        description: "",
        repository: {
          connectionId: selected.connectionId,
          provider: "github",
          resourceType: "repository",
          externalId: selected.resource.externalId,
          name: selected.resource.name,
          capabilities: selected.resource.capabilities
        }
      })
      await navigate({ to: "/workflows/$workflowId", params: { workflowId: workflow.workflowId } })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(
          Object.fromEntries(
            error.fieldErrors
              .filter(({ field }) => field === "name" || field === "repository")
              .map(({ field, message }) => [field, message])
          )
        )
      }
      const body = error instanceof Error ? error.message : "The workflow could not be created."
      showAppToast(dispatchToast, { intent: "error", title: "Create failed", body })
      creatingRef.current = false
      setCreating(false)
    }
  }

  let content: ReactNode
  if (workflows === undefined) {
    content = (
      <div className={styles.empty}>
        <Spinner label="Loading workflows" />
      </div>
    )
  } else if (workflows.length === 0) {
    content = (
      <div className={styles.empty}>
        <div className={styles.emptyCopy}>
          <BranchForkRegular fontSize={32} />
          <Subtitle2>No workflows yet</Subtitle2>
          <Button appearance="primary" icon={<AddRegular />} onClick={() => void openCreate()}>
            Create workflow
          </Button>
        </div>
      </div>
    )
  } else {
    content = (
      <div className={styles.list}>
        {workflows.map((workflow) => {
          const workflowSchedules = schedules.filter((schedule) => schedule.workflowId === workflow.workflowId)
          return (
            <a
              key={workflow.workflowId}
              className={styles.row}
              href={`/workflows/${workflow.workflowId}`}
              onClick={(event) => {
                event.preventDefault()
                void navigate({ to: "/workflows/$workflowId", params: { workflowId: workflow.workflowId } })
              }}
            >
              <div className={styles.identity}>
                <Body1Strong>{workflow.name}</Body1Strong>
                <Body1 className={styles.description}>{workflow.description || "No description"}</Body1>
              </div>
              <div className={styles.triggers}>
                {workflow.triggers.map((trigger) => (
                  <Badge key={`${trigger.kind}-${trigger.label}`} appearance="tint" icon={triggerIcon(trigger.kind)}>
                    {trigger.label}
                  </Badge>
                ))}
                {workflowSchedules.map((schedule) => (
                  <Badge key={schedule.scheduleId} appearance="tint" color={scheduleHealthColor(schedule.health)}>
                    {schedule.enabled ? `${schedule.label}: ${schedule.health}` : `${schedule.label}: disabled`}
                  </Badge>
                ))}
              </div>
              <Badge appearance="tint" color={workflow.activePublishedVersion === null ? "informative" : "success"}>
                {workflow.activePublishedVersion === null
                  ? "Not published"
                  : `Active version ${workflow.activePublishedVersion}`}
              </Badge>
              <Body1>{formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}</Body1>
              <ArrowRightRegular />
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <Title1 as="h1">Workflows</Title1>
          <Body1>Author and publish the delivery paths that start agents and create pull requests.</Body1>
        </div>
        <Button appearance="primary" icon={<AddRegular />} disabled={creating} onClick={() => void openCreate()}>
          New workflow
        </Button>
      </header>
      {content}
      <Dialog
        open={createOpen || search.create === true}
        onOpenChange={(_, data) => {
          if (!creating) {
            if (data.open) {
              setCreateOpen(true)
            } else {
              closeCreate()
            }
          }
        }}
      >
        <DialogSurface aria-describedby={undefined}>
          <DialogBody>
            <DialogTitle>Create workflow</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field
                label="Name"
                required
                validationState={fieldErrors.name === undefined ? "none" : "error"}
                validationMessage={fieldErrors.name}
              >
                <Input
                  value={name}
                  onChange={(_, data) => {
                    setName(data.value)
                    setFieldErrors((current) => ({ ...current, name: undefined }))
                  }}
                />
              </Field>
              <Field
                label="Repository"
                required
                hint="Every GitHub step in this workflow reads from or writes to this repository."
                validationState={fieldErrors.repository === undefined ? "none" : "error"}
                validationMessage={fieldErrors.repository}
              >
                <Select
                  disabled={repositoriesLoading}
                  value={repositoryId}
                  onChange={(_, data) => {
                    setRepositoryId(data.value)
                    setFieldErrors((current) => ({ ...current, repository: undefined }))
                  }}
                >
                  <option value="" disabled>
                    {repositoriesLoading ? "Loading repositories" : "Select a repository"}
                  </option>
                  {repositories.map(({ connectionId, resource }) => (
                    <option key={`${connectionId}-${resource.externalId}`} value={resource.externalId}>
                      {resource.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {!repositoriesLoading && repositories.length === 0 && (
                <div className={styles.prerequisite}>
                  <Body1>Connect GitHub and grant access to a repository before you create a workflow.</Body1>
                  <RouterLink
                    to="/integrations"
                    search={{
                      returnTo: "workflow-create",
                      workflowName: name.trim() === "" ? undefined : name.trim()
                    }}
                  >
                    Go to Integrations
                  </RouterLink>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={creating} onClick={closeCreate}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={creating || name.trim() === "" || repositoryId === ""}
                onClick={() => void create()}
              >
                Create
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </main>
  )
}
