import { ModalManager } from "@1js/fluentui-modal-manager"
import type { ConnectUIEvent } from "@nangohq/frontend"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { IntegrationConnection } from "@/services/api"
import { ApiMock } from "@/tests/server"
import { IntegrationsPage } from "./IntegrationsPage"

const navigate = vi.hoisted(() => vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve()))
const routeSearch = vi.hoisted(() => ({
  current: {} as { returnTo?: "workflow-create"; workflowName?: string }
}))

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useSearch: () => routeSearch.current
}))

const connectionId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"
const nangoUi = vi.hoisted(() => ({
  close: vi.fn<() => void>(),
  onEvent: undefined as ((event: ConnectUIEvent) => Promise<void>) | undefined,
  open: vi.fn<() => void>()
}))

vi.mock("@nangohq/frontend", () => ({
  default: class NangoMock {
    openConnectUI(options: { onEvent: (event: ConnectUIEvent) => Promise<void> }) {
      nangoUi.onEvent = options.onEvent
      return { close: nangoUi.close, open: nangoUi.open }
    }
  }
}))

const connection: IntegrationConnection = {
  connectionId,
  provider: "linear",
  providerAccount: "Agency Linear",
  status: "connected",
  lastSuccessfulSyncAt: "2026-07-19T12:00:00.000Z",
  latestError: null,
  lastCheckedAt: "2026-07-19T12:00:00.000Z",
  resourceCounts: { total: 1, active: 1, stale: 0 },
  capabilities: ["issue.read", "issue.write", "team.read"],
  createdAt: "2026-07-19T12:00:00.000Z",
  updatedAt: "2026-07-19T12:00:00.000Z",
  resources: [
    {
      resourceType: "team",
      externalId: "team-1",
      name: "ENG Engineering",
      capabilities: ["team.read", "issue.read", "issue.write"],
      stale: false,
      lastDiscoveredAt: "2026-07-19T12:00:00.000Z"
    }
  ]
}

function settings(connectionOverride = connection) {
  return {
    schemaVersion: "2",
    catalog: [
      {
        provider: "linear",
        name: "Linear",
        description: "Teams, issues, comments, workflow states, and provider events.",
        capabilities: ["teams", "issues", "comments", "webhooks"]
      }
    ],
    connections: [connectionOverride]
  }
}

const authorizationSession = {
  provider: "linear",
  token: "connect-session-token",
  connectLink: "https://example.test/connect",
  expiresAt: "2026-07-19T12:15:00.000Z"
}

function renderSettings() {
  return render(
    <AppShell>
      <IntegrationsPage />
    </AppShell>
  )
}

async function addIntegration(provider: "GitHub" | "Linear") {
  await userEvent.click(await screen.findByRole("button", { name: "Add integration" }))
  const title = await screen.findByRole("heading", { name: "Add integration", hidden: true })
  const dialog = title.closest<HTMLElement>('[role="dialog"]')
  expect(dialog).not.toBeNull()
  if (dialog === null) {
    throw new Error("Add-integration dialog did not render")
  }
  await userEvent.click(within(dialog).getByRole("radio", { name: provider, hidden: true }))
  await userEvent.click(within(dialog).getByRole("button", { name: "Continue", hidden: true }))
  await waitFor(() =>
    expect(screen.queryByRole("heading", { name: "Add integration", hidden: true })).not.toBeInTheDocument()
  )
}

afterEach(() => {
  ModalManager.flush()
  nangoUi.close.mockReset()
  nangoUi.onEvent = undefined
  nangoUi.open.mockReset()
  navigate.mockReset()
  routeSearch.current = {}
  vi.restoreAllMocks()
})

describe("IntegrationsPage", () => {
  it("renders a connection summary before progressively disclosing resources", async () => {
    ApiMock.get("/api/integrations", { data: settings() })
    renderSettings()

    expect(await screen.findByRole("heading", { name: "Integrations" })).toBeInTheDocument()
    expect(screen.getByText("Agency Linear")).toBeInTheDocument()
    expect(screen.getByText("Connected")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Add integration" })).toHaveLength(1)
    expect(screen.getByText("1 current, 0 stale")).toBeInTheDocument()
    expect(screen.getByText("team read")).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Discovered teams" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show resources (1)" }))
    expect(screen.getByRole("list", { name: "Discovered teams" })).toHaveTextContent("ENG Engineering")
  })

  it("preserves resource disclosure and search while refreshing", async () => {
    const getSettings = ApiMock.get("/api/integrations", { data: settings() })
    const refresh = ApiMock.post(`/api/integrations/connections/${connectionId}`, { data: connection })
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Show resources (1)" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Search resources" }), "engineering")
    await userEvent.click(await screen.findByRole("button", { name: "Refresh" }))

    expect(refresh.hits).toBe(1)
    expect(getSettings.hits).toBe(2)
    expect(screen.getByRole("button", { name: "Hide resources (1)" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Search resources" })).toHaveValue("engineering")
    expect(screen.getByRole("list", { name: "Discovered teams" })).toHaveTextContent("ENG Engineering")
  })

  it("requires confirmation before disconnecting", async () => {
    const disconnected: IntegrationConnection = {
      ...connection,
      status: "disconnected",
      resources: connection.resources
    }
    ApiMock.get("/api/integrations", [{ data: settings() }, { data: settings(disconnected) }])
    const impact = ApiMock.get(`/api/integrations/connections/${connectionId}/impact`, {
      data: {
        connectionId,
        affectedWorkflowCount: 1,
        workflows: [
          {
            workflowId: "3195de29-2774-4272-be07-6ed600cefd51",
            name: "Issue delivery",
            usesDraft: true,
            usesPublishedVersion: true
          }
        ]
      }
    })
    const revoke = ApiMock.delete(`/api/integrations/connections/${connectionId}`, { data: disconnected })
    const confirmation = vi
      .spyOn(ModalManager, "openConfirm")
      .mockReturnValue(Promise.resolve(true) as ReturnType<typeof ModalManager.openConfirm>)
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }))

    expect(confirmation).toHaveBeenCalledOnce()
    expect(confirmation).toHaveBeenCalledWith(expect.objectContaining({ title: "Disconnect Linear?" }))
    expect(impact.hits).toBe(1)
    const impactContent = confirmation.mock.calls[0]?.[0].children
    expect(impactContent).toBeDefined()
    render(impactContent as ReactElement)
    expect(screen.getByText("1 workflow uses this connection and will lose provider access.")).toBeInTheDocument()
    expect(screen.getByText("Issue delivery")).toBeInTheDocument()
    expect(revoke.hits).toBe(1)
    expect(await screen.findByText("Disconnected")).toBeInTheDocument()
  })

  it("connects an available provider through the hosted authorization UI", async () => {
    const emptySettings = { ...settings(), connections: [] }
    const getSettings = ApiMock.get("/api/integrations", [{ data: emptySettings }, { data: settings() }])
    const authorize = ApiMock.post("/api/integrations/authorize", { data: authorizationSession })
    const complete = ApiMock.post("/api/integrations/complete", { data: connection })
    renderSettings()

    expect(await screen.findByText("No provider connections have been added.")).toBeInTheDocument()
    await addIntegration("Linear")
    expect(authorize.hits).toBe(1)
    expect(nangoUi.open).toHaveBeenCalledOnce()

    await nangoUi.onEvent?.({
      type: "connect",
      payload: { providerConfigKey: "linear", connectionId: "nango-linear" }
    })

    expect(complete.hits).toBe(1)
    expect(getSettings.hits).toBe(2)
    expect(nangoUi.close).toHaveBeenCalledOnce()
    expect(await screen.findByText("Integration connected")).toBeInTheDocument()
  })

  it("returns to workflow creation after connecting GitHub from the prerequisite flow", async () => {
    routeSearch.current = { returnTo: "workflow-create", workflowName: "Release workflow" }
    const githubSettings = {
      schemaVersion: "2",
      catalog: [
        {
          provider: "github",
          name: "GitHub",
          description: "Repositories and pull requests.",
          capabilities: ["repositories", "pull requests"]
        }
      ],
      connections: []
    }
    const githubConnection = { ...connection, provider: "github", resources: [] }
    ApiMock.get("/api/integrations", { data: githubSettings })
    ApiMock.post("/api/integrations/authorize", { data: { ...authorizationSession, provider: "github" } })
    ApiMock.post("/api/integrations/complete", { data: githubConnection })
    renderSettings()

    await addIntegration("GitHub")
    await nangoUi.onEvent?.({
      type: "connect",
      payload: { providerConfigKey: "github", connectionId: "nango-github" }
    })

    expect(navigate).toHaveBeenCalledWith({
      to: "/workflows",
      search: { create: true, name: "Release workflow" },
      replace: true
    })
  })

  it("handles authorization errors and closed authorization windows", async () => {
    ApiMock.get("/api/integrations", { data: settings() })
    ApiMock.post("/api/integrations/authorize", { data: authorizationSession })
    renderSettings()

    await addIntegration("Linear")
    await nangoUi.onEvent?.({
      type: "error",
      payload: { errorType: "window_closed", errorMessage: "Authorization window closed unexpectedly" }
    })
    expect(await screen.findByText("Authorization window closed unexpectedly")).toBeInTheDocument()
    expect(nangoUi.close).toHaveBeenCalledOnce()

    await addIntegration("Linear")
    await nangoUi.onEvent?.({ type: "close" })
    expect(nangoUi.close).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByRole("button", { name: "Add integration" })).toBeEnabled())
  })

  it("shows degraded GitHub resources, reconnects, and reconciles connections", async () => {
    const degraded: IntegrationConnection = {
      ...connection,
      provider: "github",
      providerAccount: null,
      status: "degraded",
      latestError: "token_expired",
      resourceCounts: { total: 1, active: 0, stale: 1 },
      capabilities: ["pull_request.write", "repository.read", "repository.write"],
      resources: [
        {
          ...connection.resources[0],
          resourceType: "repository",
          name: "octo/agency",
          stale: true
        }
      ]
    }
    const degradedSettings = settings(degraded)
    ApiMock.get("/api/integrations", { data: degradedSettings })
    const reconnect = ApiMock.post("/api/integrations/reconnect", {
      data: { ...authorizationSession, provider: "github" }
    })
    const reconcile = ApiMock.post("/api/integrations/reconcile", {
      data: { checked: 1, connected: 0, degraded: 1, disconnected: 0 }
    })
    renderSettings()

    expect(await screen.findByText("Needs attention")).toBeInTheDocument()
    expect(screen.getByText("Provider account unavailable")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show resources (1)" }))
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Resource state" }), "stale")
    expect(screen.getByRole("list", { name: "Discovered repositories" })).toHaveTextContent("octo/agency")
    expect(screen.getByText("token expired")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }))
    expect(reconnect.hits).toBe(1)
    expect(nangoUi.open).toHaveBeenCalledOnce()
    await nangoUi.onEvent?.({ type: "close" })

    await userEvent.click(screen.getByRole("button", { name: "Check connections" }))
    expect(reconcile.hits).toBe(1)
    expect(await screen.findByText("1 connection checked.")).toBeInTheDocument()
  })

  it("keeps a connection when disconnection is cancelled", async () => {
    ApiMock.get("/api/integrations", { data: settings() })
    ApiMock.get(`/api/integrations/connections/${connectionId}/impact`, {
      data: { connectionId, affectedWorkflowCount: 0, workflows: [] }
    })
    const confirmation = vi
      .spyOn(ModalManager, "openConfirm")
      .mockReturnValue(Promise.resolve(false) as ReturnType<typeof ModalManager.openConfirm>)
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }))

    expect(confirmation).toHaveBeenCalledOnce()
    expect(screen.getByText("Connected")).toBeInTheDocument()
  })

  it("shows clear empty states for undiscovered and filtered resources", async () => {
    const emptyConnection: IntegrationConnection = {
      ...connection,
      lastSuccessfulSyncAt: null,
      resourceCounts: { total: 0, active: 0, stale: 0 },
      capabilities: [],
      resources: []
    }
    ApiMock.get("/api/integrations", { data: settings(emptyConnection) })
    renderSettings()

    expect(await screen.findByText("Not yet")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show resources (0)" }))
    expect(screen.getByText("No teams match this view.")).toBeInTheDocument()
  })
})
