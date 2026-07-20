import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiMock } from "@/tests/server"
import { WorkflowsPage } from "./WorkflowsPage"

const navigate = vi.hoisted(() => vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve()))

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate
}))

const workflowId = "3195de29-2774-4272-be07-6ed600cefd51"
const updatedAt = "2026-07-19T12:00:00.000Z"

function draft() {
  return {
    schemaVersion: "2",
    workflowId,
    name: "Untitled workflow",
    description: "",
    status: "draft",
    draftRevision: 1,
    publishedVersion: null,
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

afterEach(() => {
  navigate.mockReset()
})

describe("WorkflowsPage", () => {
  it("lists workflow status and triggers and navigates to the editor", async () => {
    ApiMock.get("/api/workflows", {
      data: [
        {
          workflowId,
          name: "Autonomous delivery",
          description: "Plan, implement, and publish one Linear task.",
          status: "published",
          draftRevision: 3,
          publishedVersion: 2,
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
          publishedVersion: null,
          triggers: [],
          updatedAt
        }
      ]
    })
    render(<WorkflowsPage />)

    expect(await screen.findByText("Autonomous delivery")).toBeInTheDocument()
    expect(screen.getByText("Published v2")).toBeInTheDocument()
    expect(screen.getByText("Manual start")).toBeInTheDocument()
    expect(screen.getByText("Linear task created")).toBeInTheDocument()
    expect(screen.getByText("Every 300 seconds")).toBeInTheDocument()
    expect(screen.getByText("No description")).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("link", { name: /Autonomous delivery/u }))
    expect(navigate).toHaveBeenCalledWith({ to: "/workflows/$workflowId", params: { workflowId } })
  })

  it("creates the first workflow from the empty state", async () => {
    ApiMock.get("/api/workflows", { data: [] })
    ApiMock.get("/api/integrations/resources", {
      data: {
        schemaVersion: "2",
        resources: [
          {
            connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
            provider: "github",
            resource: {
              resourceType: "repository",
              externalId: "42",
              name: "octo/agency",
              capabilities: ["repository.read", "pull_request.write"],
              stale: false,
              lastDiscoveredAt: updatedAt
            }
          }
        ]
      }
    })
    const create = ApiMock.post("/api/workflows", { data: draft() })
    render(<WorkflowsPage />)

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Create workflow" }))
    expect(await screen.findByRole("combobox", { name: "Repository" })).toHaveTextContent("octo/agency")
    await userEvent.click(screen.getByText("Create", { selector: "button" }))

    expect(create.hits).toBe(1)
    expect(create.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: expect.objectContaining({ externalId: "42", name: "octo/agency" })
      })
    )
    expect(navigate).toHaveBeenCalledWith({ to: "/workflows/$workflowId", params: { workflowId } })
  })
})
