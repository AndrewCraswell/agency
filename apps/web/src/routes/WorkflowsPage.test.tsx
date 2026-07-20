import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiMock } from "@/tests/server"
import { WorkflowsPage } from "./WorkflowsPage"

type MockRouterLinkProps = {
  to: string
  search?: Record<string, string | undefined>
  children?: React.ReactNode
}

const navigate = vi.hoisted(() => vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve()))
const routeSearch = vi.hoisted(() => ({ current: {} as { create?: true; name?: string } }))

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createLink: () =>
    function MockRouterLink({ to, search, children }: MockRouterLinkProps) {
      const parameters = new URLSearchParams()
      for (const [key, value] of Object.entries(search ?? {})) {
        if (value !== undefined) {
          parameters.set(key, value)
        }
      }
      const query = parameters.size === 0 ? "" : `?${parameters.toString()}`
      return <a href={`${to}${query}`}>{children}</a>
    },
  useNavigate: () => navigate,
  useSearch: () => routeSearch.current
}))

const workflowId = "3195de29-2774-4272-be07-6ed600cefd51"
const updatedAt = "2026-07-19T12:00:00.000Z"

beforeEach(() => {
  ApiMock.get("/api/workflows/schedules", { data: [] })
})

function draft() {
  return {
    schemaVersion: "3",
    workflowId,
    name: "Untitled workflow",
    description: "",
    status: "draft",
    draftRevision: 1,
    activePublishedVersion: null,
    content: {
      schemaVersion: "2",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [],
      connections: [],
      constants: {},
      resourceBindings: {},
      fixtures: []
    },
    versions: [],
    updatedAt
  }
}

function repositoryResource(externalId: string, name: string, stale = false) {
  return {
    connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
    provider: "github",
    resource: {
      resourceType: "repository",
      externalId,
      name,
      capabilities: ["repository.read", "pull_request.write"],
      stale,
      lastDiscoveredAt: updatedAt
    }
  }
}

function inventory(resources: ReturnType<typeof repositoryResource>[]) {
  return { schemaVersion: "2", resources }
}

afterEach(() => {
  navigate.mockReset()
  routeSearch.current = {}
})

describe("WorkflowsPage", () => {
  it("lists workflow status and triggers and navigates to the editor", async () => {
    ApiMock.get("/api/workflows", {
      data: [
        {
          workflowId,
          name: "Autonomous delivery",
          description: "Plan, implement, and publish one Linear task.",
          status: "draft",
          draftRevision: 3,
          activePublishedVersion: 2,
          triggers: [
            { kind: "manual", label: "Manual start", enabled: true },
            { kind: "webhook", label: "Linear task created", enabled: true },
            { kind: "schedule", label: "Every 300 seconds", enabled: false }
          ],
          updatedAt
        },
        {
          workflowId: "75847b35-11e4-4f14-a1ba-7c1e7d7ae956",
          name: "Draft workflow",
          description: "",
          status: "draft",
          draftRevision: 1,
          activePublishedVersion: null,
          triggers: [],
          updatedAt
        }
      ]
    })
    ApiMock.get("/api/workflows/schedules", {
      data: [
        {
          scheduleId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e36",
          workflowId,
          workflowVersion: 2,
          triggerNodeId: "delivery-schedule",
          label: "Delivery schedule",
          enabled: true,
          intervalSeconds: 300,
          scheduleExpression: null,
          timezone: "UTC",
          nextRunAt: "2026-07-19T12:05:00.000Z",
          lastAttemptedAt: "2026-07-19T12:00:00.000Z",
          lastSuccessfulAt: null,
          health: "retrying",
          latestError: "Database unavailable",
          revision: 4
        }
      ]
    })
    render(<WorkflowsPage />)

    expect(screen.getByRole("heading", { level: 1, name: "Workflows" })).toBeInTheDocument()
    expect(await screen.findByText("Autonomous delivery")).toBeInTheDocument()
    expect(screen.getByText("Active version 2")).toBeInTheDocument()
    expect(screen.getByText("Manual start")).toBeInTheDocument()
    expect(screen.getByText("Linear task created")).toBeInTheDocument()
    expect(screen.getByText("Every 300 seconds")).toBeInTheDocument()
    expect(screen.getByText("Delivery schedule: retrying")).toBeInTheDocument()
    expect(screen.getByText("No description")).toBeInTheDocument()
    expect(screen.getByText("Not published")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("link", { name: /Autonomous delivery/u }))
    expect(navigate).toHaveBeenCalledWith({ to: "/workflows/$workflowId", params: { workflowId } })
  })

  it("creates the first workflow from the empty state", async () => {
    ApiMock.get("/api/workflows", { data: [] })
    ApiMock.get("/api/integrations/resources", { data: inventory([repositoryResource("42", "octo/agency")]) })
    const create = ApiMock.post("/api/workflows", { data: draft() })
    render(<WorkflowsPage />)

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }))
    const nameLabel = screen.getByText("Name", { selector: "label" })
    const repositoryLabel = screen.getByText("Repository", { selector: "label" })
    const createButton = screen.getByText("Create", { selector: "button" })
    if (!(nameLabel instanceof HTMLLabelElement) || !(repositoryLabel instanceof HTMLLabelElement)) {
      throw new TypeError("Workflow fields must render native labels")
    }
    const name = nameLabel.control
    const repository = repositoryLabel.control
    if (!(name instanceof HTMLInputElement) || !(repository instanceof HTMLSelectElement)) {
      throw new TypeError("Workflow fields must use native label associations")
    }
    expect(name).toHaveValue("")
    expect(repository).toHaveTextContent("Select a repository")
    expect(createButton).toBeDisabled()

    await userEvent.type(name, "Repository workflow")
    await userEvent.selectOptions(repository, "42")
    await userEvent.click(createButton)

    expect(create.hits).toBe(1)
    expect(create.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "blank",
        name: "Repository workflow",
        repository: expect.objectContaining({ externalId: "42", name: "octo/agency" })
      })
    )
    expect(navigate).toHaveBeenCalledWith({ to: "/workflows/$workflowId", params: { workflowId } })
  })

  it("filters stale repositories and resets intentional selections after cancellation", async () => {
    ApiMock.get("/api/workflows", { data: [] })
    ApiMock.get("/api/integrations/resources", {
      data: inventory([
        repositoryResource("42", "octo/agency"),
        repositoryResource("43", "octo/platform"),
        repositoryResource("44", "octo/archived", true)
      ])
    })
    render(<WorkflowsPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Create workflow" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Temporary name")
    await userEvent.click(screen.getByRole("combobox", { name: "Repository" }))
    expect(screen.getByRole("option", { name: "octo/agency" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "octo/platform" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "octo/archived" })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Repository" }), "43")
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    await userEvent.click(await screen.findByRole("button", { name: "Create workflow" }))
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("")
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveTextContent("Select a repository")
  })

  it("links missing repository setup to Integrations with the intentional name", async () => {
    ApiMock.get("/api/workflows", { data: [] })
    ApiMock.get("/api/integrations/resources", { data: inventory([]) })
    render(<WorkflowsPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Create workflow" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Release workflow")

    expect(await screen.findByText(/Connect GitHub and grant access/u)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to Integrations" })).toHaveAttribute(
      "href",
      "/integrations?returnTo=workflow-create&workflowName=Release+workflow"
    )
  })

  it("reopens creation from Integrations and restores only the intentional name", async () => {
    routeSearch.current = { create: true, name: "Release workflow" }
    ApiMock.get("/api/workflows", { data: [] })
    const resources = ApiMock.get("/api/integrations/resources", {
      data: inventory([repositoryResource("42", "octo/agency")])
    })
    render(<WorkflowsPage />)

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Release workflow"))
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveTextContent("Select a repository")
    expect(resources.hits).toBe(1)
    expect(navigate).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(navigate).toHaveBeenCalledWith({ to: "/workflows", search: {}, replace: true })
  })

  it("renders structured server errors on their fields", async () => {
    ApiMock.get("/api/workflows", { data: [] })
    ApiMock.get("/api/integrations/resources", { data: inventory([repositoryResource("42", "octo/agency")]) })
    const create = ApiMock.post("/api/workflows", {
      status: 400,
      data: { error: "Workflow validation failed", fieldErrors: [{ field: "name", message: "Name is unavailable." }] }
    })
    render(<WorkflowsPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Create workflow" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Name", hidden: true }), "Existing workflow")
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Repository", hidden: true }), "42")
    await userEvent.click(screen.getByRole("button", { name: "Create", hidden: true }))

    expect(create.hits).toBe(1)
    expect(await screen.findByText("Name is unavailable.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create", hidden: true })).toBeEnabled()
  })
})
