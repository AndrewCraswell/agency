import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import {
  executeWashingtonEventWindow,
  inspectEventWindowCycle,
  advanceWashingtonEventCycle
} from "./scraper-event-window-cycle.js"
import { createEventWindowPlan } from "./scraper-event-window-plan.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

function fixture() {
  const plan = createEventWindowPlan({
    jurisdiction: "wa",
    session: "2025-2026",
    cycle: "test",
    start: "2025-01-13",
    end: "2025-01-13",
    daysPerWindow: 1
  })
  const window = plan.windows[0]!
  const database = drizzle("postgresql://unused:unused@localhost/unused", { schema })
  const input = {
    store: { exists: async () => false, read: async () => new Uint8Array(), put: async () => true },
    planPath: "plan.json",
    windowId: window.id,
    approvedBuild: "a".repeat(64),
    storageAccount: "testaccount",
    queueName: "scrapers",
    runId: "test-run"
  }
  const dependencies = {
    readPlan: vi.fn(async () => plan),
    readReceipt: vi.fn<() => Promise<Record<string, unknown> | undefined>>(async () => undefined),
    claim: vi.fn(async () => true),
    release: vi.fn(async () => true),
    dispatch: vi.fn(async () => ({ manifestPath: "manifest.json", settlementPath: "settlement.json" })),
    prepare: vi.fn(async () => ({
      snapshots: [],
      window: window.window,
      completeWindow: true as const,
      completeSnapshot: false as const,
      planId: plan.id,
      windowId: window.id
    })),
    promote: vi.fn(async () => {}),
    promoteEmpty: vi.fn(async () => {}),
    now: () => new Date()
  }
  return { database, input, dependencies, plan }
}

describe("meeting window coordination", () => {
  it("inspects real receipt identities and fails closed on a receipt from another build", async () => {
    const { database, input, dependencies, plan } = fixture()
    expect((await inspectEventWindowCycle(database, input, dependencies)).pending).toEqual(plan.windows)
    dependencies.readReceipt.mockResolvedValue({
      status: "promoted",
      planId: plan.id,
      windowId: input.windowId,
      build: input.approvedBuild,
      events: 0,
      manifestPath: "manifest.json",
      settlementPath: "settlement.json"
    })
    expect((await inspectEventWindowCycle(database, input, dependencies)).pending).toEqual([])
    dependencies.readReceipt.mockResolvedValue({
      status: "promoted",
      planId: plan.id,
      windowId: input.windowId,
      build: "b".repeat(64),
      events: 0,
      manifestPath: "manifest.json",
      settlementPath: "settlement.json"
    })
    await expect(inspectEventWindowCycle(database, input, dependencies)).rejects.toThrow()
  })
  it("advances from committed receipts and resumes a finished cycle without executing again", async () => {
    const { database, input, plan } = fixture()
    const before = { plan, pending: plan.windows, completed: [] }
    const after = { plan, pending: [], completed: plan.windows }
    const inspect = vi.fn().mockResolvedValueOnce(before).mockResolvedValue(after)
    const execute = vi.fn(async () => ({ status: "promoted" as const, events: 0 }))
    expect((await advanceWashingtonEventCycle(database, input, { inspect, execute })).status).toBe("cycle_promoted")
    expect(execute).toHaveBeenCalledOnce()
    await advanceWashingtonEventCycle(database, input, { inspect, execute })
    expect(execute).toHaveBeenCalledOnce()
  })
  it("does not advance merely because an executor returned success without a receipt", async () => {
    const { database, input, plan } = fixture()
    const inspect = vi.fn(async () => ({ plan, pending: plan.windows, completed: [] }))
    const execute = vi.fn(async () => ({ status: "promoted" as const, events: 0 }))
    await expect(advanceWashingtonEventCycle(database, input, { inspect, execute })).rejects.toThrow(/committed/)
  })
  it("receipts a verified empty window without calling the canonical row writer", async () => {
    const { database, input, dependencies } = fixture()
    expect(await executeWashingtonEventWindow(database, input, dependencies)).toEqual({ status: "promoted", events: 0 })
    expect(dependencies.promote).not.toHaveBeenCalled()
    expect(dependencies.promoteEmpty).toHaveBeenCalledOnce()
    expect(dependencies.release).toHaveBeenCalledOnce()
  })
  it("does not dispatch an already committed window", async () => {
    const { database, input, dependencies, plan } = fixture()
    dependencies.readReceipt.mockResolvedValue({
      status: "promoted",
      planId: plan.id,
      windowId: input.windowId,
      build: input.approvedBuild,
      events: 0,
      manifestPath: "manifest.json",
      settlementPath: "settlement.json"
    })
    expect((await executeWashingtonEventWindow(database, input, dependencies)).status).toBe("already_promoted")
    expect(dependencies.claim).not.toHaveBeenCalled()
    expect(dependencies.dispatch).not.toHaveBeenCalled()
  })
  it("retains the lease after uncertain shutdown and releases on settled preparation failure", async () => {
    const first = fixture()
    first.dependencies.dispatch.mockRejectedValue(new ScraperWorkerStopUnconfirmedError())
    await expect(executeWashingtonEventWindow(first.database, first.input, first.dependencies)).rejects.toThrow(
      /shutdown/
    )
    expect(first.dependencies.release).not.toHaveBeenCalled()
    const second = fixture()
    second.dependencies.prepare.mockRejectedValue(new Error("incomplete inventory"))
    await expect(executeWashingtonEventWindow(second.database, second.input, second.dependencies)).rejects.toThrow(
      /inventory/
    )
    expect(second.dependencies.release).toHaveBeenCalledOnce()
    expect(second.dependencies.promoteEmpty).not.toHaveBeenCalled()
  })
})
