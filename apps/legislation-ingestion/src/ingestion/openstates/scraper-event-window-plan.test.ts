import { describe, expect, it } from "vitest"
import {
  createEventWindowPlan,
  parseEventWindowPlan,
  readEventWindowPlan,
  retainEventWindowPlan
} from "./scraper-event-window-plan.js"

const scope = {
  jurisdiction: "wa",
  session: "2025-2026",
  cycle: "cycle-one",
  start: "2025-03-07",
  end: "2025-03-22",
  daysPerWindow: 7
}

describe("shared event calendar plans", () => {
  it("partitions inclusive calendar days across DST with a short final window", () => {
    const plan = createEventWindowPlan(scope)
    expect(plan.windows.map(({ window }) => window)).toEqual([
      { start: "2025-03-07", end: "2025-03-13" },
      { start: "2025-03-14", end: "2025-03-20" },
      { start: "2025-03-21", end: "2025-03-22" }
    ])
    expect(parseEventWindowPlan(plan)).toEqual(plan)
    expect(createEventWindowPlan({ ...scope })).toEqual(plan)
    expect(createEventWindowPlan({ ...scope, cycle: "cycle-two" }).id).not.toBe(plan.id)
  })

  it("rejects missing, duplicate, reordered and altered windows", () => {
    const plan = createEventWindowPlan(scope)
    for (const windows of [plan.windows.slice(1), [...plan.windows, plan.windows[0]], [...plan.windows].reverse()]) {
      expect(() => parseEventWindowPlan({ ...plan, windows })).toThrow()
    }
    expect(() => parseEventWindowPlan({ ...plan, scope: { ...scope, cycle: "other" } })).toThrow()
  })

  it("handles leap days and refuses invalid or reversed dates and unsafe scope paths", () => {
    expect(
      createEventWindowPlan({ ...scope, start: "2024-02-28", end: "2024-03-01", daysPerWindow: 1 }).windows
    ).toHaveLength(3)
    for (const override of [
      { end: "2025-01-01" },
      { start: "2025-02-29" },
      { daysPerWindow: 8 },
      { session: "../escape" }
    ]) {
      expect(() => createEventWindowPlan({ ...scope, ...override })).toThrow()
    }
  })

  it("retains immutable plans and checks collisions rather than trusting existing paths", async () => {
    let bytes = new Uint8Array()
    const store = {
      async put(_path: string, value: Uint8Array) {
        if (bytes.length) return false
        bytes = new Uint8Array(value)
        return true
      },
      async read() {
        return bytes
      }
    }
    const first = await retainEventWindowPlan(store, scope)
    expect(await retainEventWindowPlan(store, scope)).toEqual(first)
    expect(await readEventWindowPlan(store, first.path)).toEqual(first.plan)
    bytes = Buffer.from(JSON.stringify({ ...first.plan, windows: [] }))
    await expect(retainEventWindowPlan(store, scope)).rejects.toThrow()
  })
})
