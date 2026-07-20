import { RouterProvider } from "@tanstack/react-router"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { ApiMock } from "@/tests/server"
import { App } from "./App"
import { router } from "./router"

const taskId = "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57"
const runId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"

function snapshot(withRun = false) {
  return {
    schemaVersion: "1",
    fetchedAt: "2026-07-19T05:20:00.000Z",
    agents: [
      {
        id: "scrum-master",
        name: "Scrum master",
        role: "scrum_master",
        description: "Reviews eligible work and assigns it to an engineer."
      },
      {
        id: "engineer",
        name: "Engineer",
        role: "engineer",
        description: "Implements one assigned task at a time."
      }
    ],
    tasks: [
      {
        schemaVersion: "1",
        source: "linear",
        id: taskId,
        identifier: "FEN-42",
        title: "Add profile helper tests",
        description: "Add focused unit coverage.",
        url: "https://linear.app/example/FEN-42",
        priority: 4,
        state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" },
        team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" },
        project: null,
        blockedBy: [],
        blocks: []
      }
    ],
    runs: withRun
      ? [
          {
            runId,
            status: "queued",
            stage: "intake",
            activeRole: null,
            repository: "AndrewCraswell/agency",
            sourceWorkItemId: taskId,
            sourceWorkItemIdentifier: "FEN-42",
            assignedAgentId: "engineer",
            pullRequestNumber: null,
            createdAt: "2026-07-19T05:20:00.000Z",
            updatedAt: "2026-07-19T05:20:00.000Z"
          }
        ]
      : []
  }
}

function renderApp() {
  window.history.pushState({}, "", "/")
  return render(
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  )
}

const renderAppWithoutRouter = () =>
  render(
    <AppShell>
      <App />
    </AppShell>
  )

describe("App", () => {
  it("groups an unassigned Linear task in Todo", async () => {
    ApiMock.get("/api/control-plane", { data: snapshot() })
    renderAppWithoutRouter()

    expect(screen.getByRole("heading", { name: "Agent operations" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Not started" })).toBeInTheDocument()
    expect(await screen.findByText("Add profile helper tests")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Agent status summary" })).toHaveTextContent("Blocked0")
    expect(screen.getByRole("button", { name: "Assign agent" })).toBeInTheDocument()
  })

  it("links an in-progress control-plane run to its details", async () => {
    ApiMock.get("/api/control-plane", { data: snapshot(true) })
    renderApp()

    const link = await screen.findByRole("link", { name: "View run" })
    expect(link).toHaveAttribute("href", `/runs/${runId}`)
    expect(screen.queryByText("Started outside control plane")).not.toBeInTheDocument()
  })

  it("identifies Linear-started work that has no control-plane run", async () => {
    const startedSnapshot = snapshot()
    startedSnapshot.tasks[0].state = {
      ...startedSnapshot.tasks[0].state,
      name: "In Progress",
      type: "started"
    }
    ApiMock.get("/api/control-plane", { data: startedSnapshot })
    renderAppWithoutRouter()

    expect(await screen.findByText("Started outside control plane")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "View run" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open FEN-42 in Linear" })).toHaveAttribute(
      "href",
      "https://linear.app/example/FEN-42"
    )
  })

  it("assigns a task and moves it into active agents", async () => {
    ApiMock.get("/api/control-plane", [{ data: snapshot() }, { data: snapshot(true) }])
    const assignment = ApiMock.post("/api/control-plane/assign", {
      status: 201,
      data: { schemaVersion: "1", created: true, run: snapshot(true).runs[0] }
    })
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole("button", { name: "Assign agent" }))
    const dialog = await screen.findByRole("dialog", { hidden: true })
    expect(dialog).toHaveTextContent("The selected engineer will receive this task after scrum-master planning.")
    await user.click(within(dialog).getByRole("button", { name: "Assign agent", hidden: true }))

    expect(await screen.findByText("Engineer")).toBeInTheDocument()
    expect(screen.getByText("FEN-42 in AndrewCraswell/agency")).toBeInTheDocument()
    expect(assignment.spy).toHaveBeenCalledWith({ workItemId: taskId, agentId: "engineer" })
  })
})
