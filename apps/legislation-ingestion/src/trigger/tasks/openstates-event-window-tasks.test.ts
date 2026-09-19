import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  advance: vi.fn(),
  reconcile: vi.fn(),
  trigger: vi.fn(async () => ({ id: "continuation" })),
  key: vi.fn(async () => "stable-key"),
  end: vi.fn(async () => {}),
  config: vi.fn(),
  register: vi.fn<
    (definition: {
      run: (
        raw: unknown,
        context: { ctx: { run: { id: string }; deployment?: { version: string } } }
      ) => Promise<unknown>
      queue: { concurrencyLimit: number }
      retry: { maxAttempts: number }
    }) => unknown
  >((definition) => definition)
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.register,
  tasks: { trigger: mocks.trigger },
  idempotencyKeys: { create: mocks.key }
}))
vi.mock("../../config/config.js", () => ({ loadConfig: mocks.config }))
vi.mock("@repo/legislation-core/database/database", () => ({
  createDatabase: () => ({ database: {}, pool: { end: mocks.end } })
}))
vi.mock("../../ingestion/documents/artifact-store.js", () => ({ AzureBlobArtifactStore: class {} }))
vi.mock("../../ingestion/openstates/scraper-event-window-cycle.js", () => ({
  advanceWashingtonEventCycle: mocks.advance,
  reconcileWashingtonEventWindow: mocks.reconcile
}))

import { washingtonScraperCandidateBuild } from "../../ingestion/openstates/scraper-activation.js"
import "./openstates-event-window-tasks.js"

const payload = {
  planPath: `openstates/event-window-plans/wa/2025-2026/${"a".repeat(64)}/plan.json`,
  approvedBuild: washingtonScraperCandidateBuild
}
const definition = mocks.register.mock.calls[0]![0]
const replayDefinition = mocks.register.mock.calls[1]![0]
const context = { ctx: { run: { id: "test-run" }, deployment: { version: "20260919.wa" } } }

describe("bounded meeting continuation task", () => {
  it("runs retained reconciliation on the serial calendar queue without source dispatch", async () => {
    vi.stubEnv("OPENSTATES_SCRAPER_ENABLED_STATES", "wa")
    mocks.reconcile.mockResolvedValue({ status: "reconciled" })
    expect(replayDefinition.queue.concurrencyLimit).toBe(1)
    await replayDefinition.run({ ...payload, windowId: "b".repeat(64) }, context)
    expect(mocks.reconcile).toHaveBeenCalledOnce()
    expect(mocks.advance).not.toHaveBeenCalled()
    expect(mocks.trigger).not.toHaveBeenCalled()
    expect(mocks.end).toHaveBeenCalledOnce()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OPENSTATES_SCRAPER_ENABLED_STATES", "")
    vi.stubEnv("OPENSTATES_SCRAPER_QUEUE", "test-queue")
    vi.stubEnv("OPENSTATES_SCRAPER_QUEUE_ROUTES", undefined)
    mocks.config.mockReturnValue({
      azure: { storageAccount: "testaccount", stateSourceContainer: "sources" },
      database: {}
    })
  })
  afterEach(() => vi.unstubAllEnvs())
  it("refuses activation before infrastructure access", async () => {
    await expect(definition.run(payload, context)).rejects.toThrow(/not activated/)
    expect(mocks.config).not.toHaveBeenCalled()
  })
  it("closes the pool and dispatches only the exact receipt-derived continuation", async () => {
    vi.stubEnv("OPENSTATES_SCRAPER_ENABLED_STATES", "wa")
    vi.stubEnv("OPENSTATES_SCRAPER_QUEUE_ROUTES", '{"wa":"candidate-queue","nc":"test-queue","ak":"test-queue"}')
    mocks.advance.mockResolvedValue({
      status: "pending",
      planId: "plan",
      nextWindowId: "window",
      completed: 1,
      pending: 1
    })
    expect(definition.queue.concurrencyLimit).toBe(1)
    expect(definition.retry.maxAttempts).toBe(1)
    await definition.run(payload, context)
    expect(mocks.advance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ queueName: "candidate-queue" })
    )
    expect(mocks.end).toHaveBeenCalledOnce()
    expect(mocks.key).toHaveBeenCalledWith("event-windows:plan:window", { scope: "global" })
    expect(mocks.trigger).toHaveBeenCalledWith("openstates-event-windows", payload, {
      concurrencyKey: "production:openstates-scraper:events:wa",
      version: "20260919.wa",
      idempotencyKey: "stable-key"
    })
  })
  it("rejects an omitted route before opening a database or dispatching work", async () => {
    vi.stubEnv("OPENSTATES_SCRAPER_ENABLED_STATES", "wa")
    vi.stubEnv("OPENSTATES_SCRAPER_QUEUE_ROUTES", '{"nc":"test-queue"}')
    await expect(definition.run(payload, context)).rejects.toThrow(/Missing.*wa/)
    expect(mocks.advance).not.toHaveBeenCalled()
    expect(mocks.end).not.toHaveBeenCalled()
  })
  it("does not continue after completion or failure and always closes an opened pool", async () => {
    vi.stubEnv("OPENSTATES_SCRAPER_ENABLED_STATES", "wa")
    mocks.advance.mockResolvedValue({ status: "cycle_promoted", nextWindowId: undefined })
    await definition.run(payload, context)
    expect(mocks.trigger).not.toHaveBeenCalled()
    mocks.advance.mockRejectedValue(new Error("uncertain worker"))
    await expect(definition.run(payload, context)).rejects.toThrow(/uncertain/)
    expect(mocks.trigger).not.toHaveBeenCalled()
    expect(mocks.end).toHaveBeenCalledTimes(2)
  })
})
