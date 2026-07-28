import { describe, expect, it } from "vitest"
import { BACKLOG_DROPPABLE_ID, planBacklogInsertion, planDrop } from "./planDragState"

const backlogIds = ["first", "second", "third"]

describe("planBacklogInsertion", () => {
  it("appends a scheduled idea dropped on the backlog container", () => {
    expect(planBacklogInsertion("scheduled", BACKLOG_DROPPABLE_ID, backlogIds)).toEqual([
      "first",
      "second",
      "third",
      "scheduled"
    ])
  })

  it("inserts a scheduled idea at the hovered card position", () => {
    expect(planBacklogInsertion("scheduled", "second", backlogIds)).toEqual(["first", "scheduled", "second", "third"])
  })

  it("ignores ideas that are already in the backlog", () => {
    expect(planBacklogInsertion("first", "third", backlogIds)).toBeNull()
  })

  it("ignores drops outside the backlog", () => {
    expect(planBacklogInsertion("scheduled", "day:2026-07-09", backlogIds)).toBeNull()
  })
})

describe("planDrop", () => {
  it("schedules an idea dropped on a calendar day and drops it from the backlog", () => {
    expect(planDrop("second", "day:2026-07-09", backlogIds)).toEqual({
      kind: "schedule",
      date: "2026-07-09",
      backlogOrder: ["first", "third"]
    })
  })

  it("reorders a backlog idea onto the hovered card", () => {
    expect(planDrop("first", "third", backlogIds)).toEqual({
      kind: "reorder",
      backlogOrder: ["second", "third", "first"]
    })
  })

  it("moves a backlog idea to the end when dropped on the container", () => {
    expect(planDrop("first", BACKLOG_DROPPABLE_ID, backlogIds)).toEqual({
      kind: "reorder",
      backlogOrder: ["second", "third", "first"]
    })
  })

  it("keeps the order when an idea is dropped on itself", () => {
    expect(planDrop("second", "second", backlogIds)).toEqual({ kind: "none" })
  })

  it("keeps the order when a scheduled idea is dropped on an unknown target", () => {
    expect(planDrop("scheduled", "elsewhere", backlogIds)).toEqual({ kind: "none" })
  })
})
