import { describe, expect, it } from "vitest"
import { groupTasks } from "./operations"
import type { ControlPlaneSnapshot } from "./services/api"

function snapshot(status?: "queued" | "running" | "blocked" | "failed" | "cancelled" | "published") {
  const taskId = "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57"
  return {
    schemaVersion: "1",
    fetchedAt: "2026-07-19T05:20:00.000Z",
    agents: [
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
        title: "Add tests",
        description: "Add focused tests.",
        url: "https://linear.app/example/FEN-42",
        priority: 4,
        state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" },
        team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" },
        project: null,
        blockedBy: [],
        blocks: []
      }
    ],
    runs:
      status === undefined
        ? []
        : [
            {
              runId: "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1",
              status,
              stage: status === "published" ? "completed" : "coding",
              activeRole: status === "running" ? "coder" : null,
              repository: "AndrewCraswell/agency",
              sourceWorkItemId: taskId,
              sourceWorkItemIdentifier: "FEN-42",
              assignedAgentId: "engineer",
              pullRequestNumber: status === "published" ? 42 : null,
              createdAt: "2026-07-19T05:20:00.000Z",
              updatedAt: "2026-07-19T05:21:00.000Z"
            }
          ]
  } satisfies ControlPlaneSnapshot
}

describe("groupTasks", () => {
  it("places unassigned todo tasks in Not started", () => {
    expect(groupTasks(snapshot()).todo).toHaveLength(1)
  })

  it("places unassigned backlog tasks in Not started", () => {
    const backlogSnapshot: ControlPlaneSnapshot = snapshot()
    backlogSnapshot.tasks[0].state = {
      ...backlogSnapshot.tasks[0].state,
      name: "Backlog",
      type: "backlog"
    }

    expect(groupTasks(backlogSnapshot).todo).toHaveLength(1)
  })

  it("places dependency-blocked tasks in Blocked", () => {
    const blockedSnapshot: ControlPlaneSnapshot = snapshot()
    blockedSnapshot.tasks[0].blockedBy = [
      { id: "6fcde5f0-04c8-4735-9362-333f45e79d32", identifier: "FEN-41", stateType: "started" }
    ]

    expect(groupTasks(blockedSnapshot).blocked).toHaveLength(1)
  })

  it("places Linear work already started outside the control plane in In progress", () => {
    const startedSnapshot: ControlPlaneSnapshot = snapshot()
    startedSnapshot.tasks[0].state = { ...startedSnapshot.tasks[0].state, name: "In Progress", type: "started" }

    expect(groupTasks(startedSnapshot).inProgress).toHaveLength(1)
  })

  it.each([
    ["queued", "inProgress"],
    ["running", "inProgress"],
    ["blocked", "blocked"],
    ["failed", "blocked"],
    ["cancelled", "blocked"]
  ] as const)("places %s runs in %s", (status, group) => {
    expect(groupTasks(snapshot(status))[group]).toHaveLength(1)
  })

  it("omits published work after terminal tasks leave the Linear query", () => {
    const grouped = groupTasks(snapshot("published"))

    expect(Object.values(grouped).flat()).toHaveLength(0)
  })
})
