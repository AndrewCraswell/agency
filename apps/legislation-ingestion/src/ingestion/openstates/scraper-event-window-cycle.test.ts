import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import { executeWashingtonEventWindow } from "./scraper-event-window-cycle.js"
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
