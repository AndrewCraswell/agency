import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { WorkItemQueryResponse } from "@/services/api"
import { ApiMock } from "@/tests/server"
import { OperationsPage } from "./OperationsPage"

const taskId = "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57"
const runId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"
const updatedAt = "2026-07-19T05:20:00.000Z"

function agents() {
  return [
    { id: "scrum-master", name: "Scrum master", role: "scrum_master" as const, description: "Plans eligible work." },
    { id: "engineer", name: "Engineer", role: "engineer" as const, description: "Implements assigned work." }
  ]
}

function workflowRun() {
  return {
    runId,
    status: "queued" as const,
    stage: "intake" as const,
    activeRole: null,
    repository: "octo/agency",
    sourceWorkItemId: taskId,
    sourceWorkItemIdentifier: "FEN-42",
    assignedAgentId: "engineer",
    pullRequestNumber: null,
    createdAt: updatedAt,
    updatedAt
  }
}

function runSnapshot(withRun = false) {
  return {
    schemaVersion: "1" as const,
    fetchedAt: updatedAt,
    agents: agents(),
    runs: withRun ? [workflowRun()] : []
  }
}

function queueItem(index = 42): WorkItemQueryResponse["items"][number] {
  const identifier = `FEN-${index}`
  return {
    task: {
      schemaVersion: "1",
      source: "linear",
      id: index === 42 ? taskId : `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      identifier,
      title: `Queue task ${index}`,
      description: `Description for ${identifier}`,
      url: `https://linear.app/example/${identifier}`,
      priority: index % 5,
      createdAt: "2026-07-01T05:20:00.000Z",
      updatedAt,
      state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" },
      team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" },
      project: null,
      blockedBy: [],
      blocks: []
    },
    run: null,
    status: "todo"
  }
}

function queueResponse(
  options: { count?: number; total?: number; previousCursor?: string | null; nextCursor?: string | null } = {}
): WorkItemQueryResponse {
  const count = options.count ?? 1
  return {
    schemaVersion: "1",
    fetchedAt: updatedAt,
    items: Array.from({ length: count }, (_, index) => queueItem(index + 1)),
    total: options.total ?? count,
    previousCursor: options.previousCursor ?? null,
    nextCursor: options.nextCursor ?? null,
    aggregates: {
      all: options.total ?? count,
      todo: options.total ?? count,
      inProgress: 0,
      blocked: 0,
      repositories: [{ value: "octo/agency", count: options.total ?? count }],
      assignees: [],
      priorities: [{ value: 1, count: options.total ?? count }]
    }
  }
}

function renderOperations(searchParams: string, onUrlUpdate?: (event: UrlUpdateEvent) => void) {
  return render(
    <AppShell>
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        <OperationsPage />
      </NuqsTestingAdapter>
    </AppShell>
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe("OperationsPage", () => {
  it("restores queue state from the URL and pages a 225-item result", async () => {
    ApiMock.get("/api/control-plane/runs", { data: runSnapshot() })
    const workItems = ApiMock.get("/api/control-plane/work-items", {
      data: queueResponse({ count: 25, total: 225, nextCursor: "next-page" })
    })
    const urlUpdates = vi.fn<(event: UrlUpdateEvent) => void>()
    const user = userEvent.setup()

    renderOperations("?view=work-queue&status=todo&sort=priority&direction=asc", urlUpdates)

    expect(await screen.findByRole("heading", { name: "Work queue" })).toBeInTheDocument()
    expect(screen.getByLabelText("Status")).toHaveValue("todo")
    expect(await screen.findByText("225 work items", undefined, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText("Showing 25 of 225")).toBeInTheDocument()
    await waitFor(() => expect(workItems.requests[0]?.pathname).toContain("status=todo"))
    expect(workItems.requests[0]?.pathname).toContain("sort=priority")
    expect(workItems.requests[0]?.pathname).toContain("direction=asc")

    await user.click(screen.getByRole("button", { name: "Next" }))

    await waitFor(() => expect(workItems.hits).toBe(2))
    expect(workItems.requests[1]?.pathname).toContain("cursor=next-page")
    expect(urlUpdates).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining("cursor=next-page") })
    )
  }, 15_000)

  it("updates shareable search and sort state and supports keyboard row expansion", async () => {
    ApiMock.get("/api/control-plane/runs", { data: runSnapshot() })
    const workItems = ApiMock.get("/api/control-plane/work-items", { data: queueResponse() })
    const urlUpdates = vi.fn<(event: UrlUpdateEvent) => void>()
    const user = userEvent.setup()

    renderOperations("?view=work-queue", urlUpdates)
    await screen.findByText("Queue task 1")

    const expansion = screen.getByRole("button", { name: "Show FEN-1 description" })
    expansion.focus()
    await user.keyboard("{Enter}")
    expect(screen.getByText("Description for FEN-1")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "release blocker" } })
    await waitFor(() =>
      expect(
        workItems.requests.some(
          ({ pathname }) => new URLSearchParams(pathname.split("?")[1]).get("q") === "release blocker"
        )
      ).toBe(true)
    )
    expect(urlUpdates).toHaveBeenCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining("q=release+blocker") })
    )

    await user.click(screen.getByRole("columnheader", { name: /Priority/u }))
    await waitFor(() =>
      expect(workItems.requests.some(({ pathname }) => pathname.includes("sort=priority"))).toBe(true)
    )
    expect(urlUpdates).toHaveBeenCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining("sort=priority") })
    )
  })

  it("assigns an engineer from a filtered queue result", async () => {
    ApiMock.get("/api/control-plane/runs", [{ data: runSnapshot() }, { data: runSnapshot(true) }])
    ApiMock.get("/api/control-plane/work-items", { data: queueResponse() })
    const assignment = ApiMock.post("/api/control-plane/assign", {
      status: 201,
      data: { schemaVersion: "1", created: true, run: workflowRun() }
    })
    const user = userEvent.setup()

    renderOperations("?view=work-queue&status=todo")

    await user.click(await screen.findByRole("button", { name: "Assign FEN-1" }))
    const dialog = await screen.findByRole("dialog", { hidden: true })
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Engineering agent", hidden: true }),
      "engineer"
    )
    await user.click(within(dialog).getByRole("button", { name: "Assign", hidden: true }))

    await waitFor(() => expect(assignment.hits).toBe(1))
    expect(assignment.spy).toHaveBeenCalledWith({ workItemId: queueItem(1).task.id, agentId: "engineer" })
  })

  it("identifies active agents and unassigned intake in the runs view", async () => {
    const engineerRun = workflowRun()
    ApiMock.get("/api/control-plane/runs", {
      data: {
        ...runSnapshot(),
        runs: [
          engineerRun,
          {
            ...engineerRun,
            runId: "09978e29-4b5b-4869-b592-d7bbfd25ca76",
            activeRole: "scrum_master",
            assignedAgentId: null,
            sourceWorkItemId: null,
            sourceWorkItemIdentifier: null
          },
          {
            ...engineerRun,
            runId: "8a6d607a-4573-4492-ad9c-e9fc636d4d73",
            activeRole: "reviewer",
            assignedAgentId: null,
            sourceWorkItemIdentifier: "FEN-43"
          }
        ]
      }
    })

    renderOperations("?view=runs")

    const runs = await screen.findByRole("list", { name: "Workflow runs" })
    expect(within(runs).getByText("Engineer")).toBeInTheDocument()
    expect(within(runs).getByText("Scrum master")).toBeInTheDocument()
    expect(within(runs).getByText("Unknown agent")).toBeInTheDocument()
    expect(within(runs).getByText("Unassigned intake")).toBeInTheDocument()
  })

  it("polls run status without polling queue inventory", async () => {
    vi.useFakeTimers()
    const runs = ApiMock.get("/api/control-plane/runs", { data: runSnapshot() })
    const workItems = ApiMock.get("/api/control-plane/work-items", { data: queueResponse() })

    renderOperations("?view=work-queue")
    await act(async () => vi.advanceTimersByTimeAsync(0))
    await act(async () => Promise.resolve())
    expect(runs.hits).toBe(1)
    expect(workItems.hits).toBe(1)

    await act(async () => vi.advanceTimersByTimeAsync(5_000))
    await act(async () => Promise.resolve())

    expect(runs.hits).toBe(2)
    expect(workItems.hits).toBe(1)
  })
})
