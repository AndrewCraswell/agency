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
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
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
import { useNavigate } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { useEffect, useState, type ReactNode } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  createWorkflow,
  getIntegrationResourceInventory,
  listWorkflows,
  type IntegrationResourceInventory,
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
  emptyCopy: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM }
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

export function WorkflowsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const dispatchToast = useAppToast()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>()
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("Untitled workflow")
  const [repositories, setRepositories] = useState<IntegrationResourceInventory["resources"]>([])
  const [repositoryId, setRepositoryId] = useState("")
  const [repositoriesLoading, setRepositoriesLoading] = useState(false)

  useEffect(() => {
    let active = true
    void listWorkflows()
      .then((value) => {
        if (active) {
          setWorkflows(value)
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

  async function openCreate(): Promise<void> {
    setCreateOpen(true)
    setRepositoriesLoading(true)
    try {
      const inventory = await getIntegrationResourceInventory("repository.read")
      const available = inventory.resources.filter(
        ({ provider, resource }) => provider === "github" && resource.resourceType === "repository" && !resource.stale
      )
      setRepositories(available)
      setRepositoryId(available[0]?.resource.externalId ?? "")
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

  async function create(): Promise<void> {
    const selected = repositories.find(({ resource }) => resource.externalId === repositoryId)
    if (selected === undefined) {
      return
    }
    setCreating(true)
    try {
      const workflow = await createWorkflow(name, {
        connectionId: selected.connectionId,
        provider: "github",
        resourceType: "repository",
        externalId: selected.resource.externalId,
        name: selected.resource.name,
        capabilities: selected.resource.capabilities
      })
      await navigate({ to: "/workflows/$workflowId", params: { workflowId: workflow.workflowId } })
    } catch (error) {
      const body = error instanceof Error ? error.message : "The workflow could not be created."
      showAppToast(dispatchToast, { intent: "error", title: "Create failed", body })
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
        {workflows.map((workflow) => (
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
            </div>
            <Badge appearance="tint" color={workflow.status === "published" ? "success" : "informative"}>
              {workflow.publishedVersion === null ? "Draft" : `Published v${workflow.publishedVersion}`}
            </Badge>
            <Body1>{formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}</Body1>
            <ArrowRightRegular />
          </a>
        ))}
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <Title1>Workflows</Title1>
          <Body1>Author and publish the delivery paths that start agents and create pull requests.</Body1>
        </div>
        <Button appearance="primary" icon={<AddRegular />} disabled={creating} onClick={() => void openCreate()}>
          New workflow
        </Button>
      </header>
      {content}
      <Dialog
        open={createOpen}
        onOpenChange={(_, data) => {
          if (!creating) {
            setCreateOpen(data.open)
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Create workflow</DialogTitle>
            <DialogContent>
              <Field label="Name">
                <Input value={name} onChange={(_, data) => setName(data.value)} />
              </Field>
              <Field label="Repository" hint="All repository steps use this repository.">
                <Dropdown
                  disabled={repositoriesLoading}
                  placeholder={repositoriesLoading ? "Loading repositories" : "Select a repository"}
                  value={repositories.find(({ resource }) => resource.externalId === repositoryId)?.resource.name ?? ""}
                  selectedOptions={repositoryId === "" ? [] : [repositoryId]}
                  onOptionSelect={(_, data) => setRepositoryId(data.optionValue ?? "")}
                >
                  {repositories.map(({ connectionId, resource }) => (
                    <Option key={`${connectionId}-${resource.externalId}`} value={resource.externalId}>
                      {resource.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              {!repositoriesLoading && repositories.length === 0 && (
                <Body1>Connect GitHub before creating a workflow.</Body1>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={creating} onClick={() => setCreateOpen(false)}>
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
