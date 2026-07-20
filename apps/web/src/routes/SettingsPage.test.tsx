import { ModalManager } from "@1js/fluentui-modal-manager"
import type { ConnectUIEvent } from "@nangohq/frontend"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { IntegrationConnection } from "@/services/api"
import { ApiMock } from "@/tests/server"
import { SettingsPage } from "./SettingsPage"

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
  displayName: "Agency Linear",
  status: "connected",
  errorCode: null,
  lastCheckedAt: "2026-07-19T12:00:00.000Z",
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
      <SettingsPage />
    </AppShell>
  )
}

afterEach(() => {
  ModalManager.flush()
  nangoUi.close.mockReset()
  nangoUi.onEvent = undefined
  nangoUi.open.mockReset()
  vi.restoreAllMocks()
})

describe("SettingsPage", () => {
  it("renders a healthy Linear connection and its discovered teams", async () => {
    ApiMock.get("/api/integrations", { data: settings() })
    renderSettings()

    expect(await screen.findByRole("heading", { name: "Integrations" })).toBeInTheDocument()
    expect(screen.getByText("Agency Linear")).toBeInTheDocument()
    expect(screen.getByText("Connected")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Discovered teams" })).toHaveTextContent("ENG Engineering")
  })

  it("refreshes connection health and resource discovery", async () => {
    const getSettings = ApiMock.get("/api/integrations", { data: settings() })
    const refresh = ApiMock.post(`/api/integrations/connections/${connectionId}`, { data: connection })
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Refresh" }))

    expect(refresh.hits).toBe(1)
    expect(getSettings.hits).toBe(2)
  })

  it("requires confirmation before disconnecting", async () => {
    const disconnected: IntegrationConnection = {
      ...connection,
      status: "disconnected",
      resources: connection.resources
    }
    ApiMock.get("/api/integrations", [{ data: settings() }, { data: settings(disconnected) }])
    const revoke = ApiMock.delete(`/api/integrations/connections/${connectionId}`, { data: disconnected })
    const confirmation = vi
      .spyOn(ModalManager, "openConfirm")
      .mockReturnValue(Promise.resolve(true) as ReturnType<typeof ModalManager.openConfirm>)
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }))

    expect(confirmation).toHaveBeenCalledOnce()
    expect(confirmation).toHaveBeenCalledWith(expect.objectContaining({ title: "Disconnect linear?" }))
    expect(revoke.hits).toBe(1)
    expect(await screen.findByText("Disconnected")).toBeInTheDocument()
  })

  it("connects an available provider through the hosted authorization UI", async () => {
    const emptySettings = { ...settings(), connections: [] }
    const getSettings = ApiMock.get("/api/integrations", [{ data: emptySettings }, { data: settings() }])
    const authorize = ApiMock.post("/api/integrations/authorize", { data: authorizationSession })
    const complete = ApiMock.post("/api/integrations/complete", { data: connection })
    renderSettings()

    expect(await screen.findByText("No provider connections have been registered with Agency.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Connect Linear" }))
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

  it("handles authorization errors and closed authorization windows", async () => {
    ApiMock.get("/api/integrations", { data: settings() })
    ApiMock.post("/api/integrations/authorize", { data: authorizationSession })
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Add another connection" }))
    await nangoUi.onEvent?.({
      type: "error",
      payload: { errorType: "window_closed", errorMessage: "Authorization window closed unexpectedly" }
    })
    expect(await screen.findByText("Authorization window closed unexpectedly")).toBeInTheDocument()
    expect(nangoUi.close).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole("button", { name: "Add another connection" }))
    await nangoUi.onEvent?.({ type: "close" })
    expect(nangoUi.close).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByRole("button", { name: "Add another connection" })).toBeEnabled())
  })

  it("shows degraded GitHub resources, reconnects, and reconciles connections", async () => {
    const degraded: IntegrationConnection = {
      ...connection,
      provider: "github",
      displayName: null,
      status: "degraded",
      errorCode: "token_expired",
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
    expect(screen.getByText("Provider connection")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Discovered repositories" })).toHaveTextContent("octo/agency (stale)")
    expect(screen.getByText("token expired")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }))
    expect(reconnect.hits).toBe(1)
    expect(nangoUi.open).toHaveBeenCalledOnce()
    await nangoUi.onEvent?.({ type: "close" })

    await userEvent.click(screen.getByRole("button", { name: "Reconcile" }))
    expect(reconcile.hits).toBe(1)
    expect(await screen.findByText("1 connection records checked.")).toBeInTheDocument()
  })

  it("keeps a connection when disconnection is cancelled", async () => {
    ApiMock.get("/api/integrations", { data: settings() })
    const confirmation = vi
      .spyOn(ModalManager, "openConfirm")
      .mockReturnValue(Promise.resolve(false) as ReturnType<typeof ModalManager.openConfirm>)
    renderSettings()

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }))

    expect(confirmation).toHaveBeenCalledOnce()
    expect(screen.getByText("Connected")).toBeInTheDocument()
  })
})
