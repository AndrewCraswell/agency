import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import * as schema from "../../db/schema/schema.js"
import { planNcBillBatches } from "./scraper-batches.js"
import { processScraperBillCycle } from "./scraper-cycle-runner.js"
import { assessScraperBillCycle, inspectScraperBillCycle } from "./scraper-cycle.js"
import { resumeScraperBillCycle } from "./scraper-resume.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

function fixture() {
  const xml = (id: string) => `<rss><channel><item><bill>${id}</bill></item></channel></rss>`
  const before = assessScraperBillCycle(planNcBillBatches({ H: xml("H1"), S: xml("S1") }, "cycle-run"), [])
  const after = { ...before, pending: before.pending.slice(1), promotedBatches: 1, promotedBills: 1 }
  const complete = { ...after, pending: [], promotedBatches: 2, promotedBills: 2, promotionComplete: true }
  const dependencies = {
    inspect: vi
      .fn<typeof inspectScraperBillCycle>()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after)
      .mockResolvedValue(complete),
    resume: vi
      .fn<typeof resumeScraperBillCycle>()
      .mockResolvedValueOnce({ status: "promoted", batchId: before.pending[0]!.id, state: after })
      .mockResolvedValueOnce({ status: "promoted", batchId: before.pending[1]!.id, state: complete }),
    now: vi.fn<() => number>(() => 0),
    createRunId: vi.fn<() => string>().mockReturnValueOnce("step-one").mockReturnValueOnce("step-two")
  }
  const database = drizzle({ connection: "postgresql://unused", schema })
  const input = {
    store: { exists: async () => false, put: async () => false, read: async () => new Uint8Array() },
    planPath: "unused",
    approvedBuildInputsSha256: "a".repeat(64),
    extractAndArchive: vi.fn<Parameters<typeof resumeScraperBillCycle>[1]["extractAndArchive"]>(),
    maxBatches: 2,
    admissionBudgetSeconds: 3600,
    onProgress: vi.fn<(step: Awaited<ReturnType<typeof resumeScraperBillCycle>>) => Promise<void>>()
  }
  return { before, after, complete, dependencies, database, input }
}

describe("bounded sequential cycle processing", () => {
  it("fans out distinct batches and waits for every admitted worker after one fails", async () => {
    const { database, input, dependencies } = fixture()
    const slow = Promise.withResolvers<Awaited<ReturnType<typeof resumeScraperBillCycle>>>()
    dependencies.resume.mockReset().mockRejectedValueOnce(new Error("first failed")).mockReturnValueOnce(slow.promise)
    let isSettled = false
    const result = processScraperBillCycle(database, { ...input, concurrency: 2 }, dependencies)
    const observed = result.catch((error: unknown) => {
      isSettled = true
      return error
    })
    await vi.waitFor(() => expect(dependencies.resume).toHaveBeenCalledTimes(2))
    expect(isSettled).toBe(false)
    expect(new Set(dependencies.resume.mock.calls.map((call) => call[1].batchId)).size).toBe(2)
    slow.reject(new Error("second stopped"))
    expect(await observed).toEqual(new Error("first failed"))
    expect(dependencies.resume).toHaveBeenCalledTimes(2)
  })
  it.each([0, 9, 1.5])("rejects unsafe concurrency %s", async (concurrency) => {
    const { database, input, dependencies } = fixture()
    await expect(processScraperBillCycle(database, { ...input, concurrency }, dependencies)).rejects.toThrow(
      /Invalid|Too/
    )
    expect(dependencies.inspect).not.toHaveBeenCalled()
  })
  it("uses fresh attempt identities and finishes from committed state", async () => {
    const { database, input, dependencies, complete } = fixture()
    expect(await processScraperBillCycle(database, input, dependencies)).toEqual({
      reason: "cycle_promoted",
      completedSteps: 2,
      state: complete
    })
    expect(dependencies.resume.mock.calls.map((call) => call[1].runId)).toEqual(["step-one", "step-two"])
    expect(input.onProgress).toHaveBeenCalledTimes(2)
  })
  it("stops at the batch bound with unfinished work visible", async () => {
    const { database, input, dependencies, after } = fixture()
    expect(await processScraperBillCycle(database, { ...input, maxBatches: 1 }, dependencies)).toEqual({
      reason: "batch_limit",
      completedSteps: 1,
      state: after
    })
    expect(dependencies.resume).toHaveBeenCalledOnce()
  })
  it("does not start another step until the previous progress callback settles", async () => {
    const { database, input, dependencies } = fixture()
    input.onProgress.mockImplementationOnce(async () => {
      expect(dependencies.resume).toHaveBeenCalledOnce()
      await Promise.resolve()
      expect(dependencies.resume).toHaveBeenCalledOnce()
    })
    await processScraperBillCycle(database, input, dependencies)
  })
  it("reserves a full window before admission and returns the last durable state", async () => {
    const { database, input, dependencies, after } = fixture()
    dependencies.now.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(1_800_001)
    expect(await processScraperBillCycle(database, input, dependencies)).toEqual({
      reason: "time_budget",
      completedSteps: 1,
      state: after
    })
    expect(dependencies.resume).toHaveBeenCalledOnce()
  })
  it("can decline all work after a slow initial inspection", async () => {
    const { database, input, dependencies } = fixture()
    dependencies.now.mockReturnValueOnce(0).mockReturnValue(1_800_001)
    expect(await processScraperBillCycle(database, input, dependencies)).toMatchObject({
      reason: "time_budget",
      completedSteps: 0
    })
    expect(dependencies.resume).not.toHaveBeenCalled()
  })
  it("does not dispatch a completed inventory", async () => {
    const { database, input, dependencies, complete } = fixture()
    dependencies.inspect.mockReset().mockResolvedValue(complete)
    expect(await processScraperBillCycle(database, input, dependencies)).toMatchObject({
      reason: "cycle_promoted",
      completedSteps: 0
    })
    expect(dependencies.resume).not.toHaveBeenCalled()
  })
  it.each([new Error("source failed"), new ScraperWorkerStopUnconfirmedError()])(
    "stops immediately on failure without retry or later admission: %s",
    async (error) => {
      const { database, input, dependencies } = fixture()
      dependencies.resume.mockReset().mockRejectedValue(error)
      await expect(processScraperBillCycle(database, input, dependencies)).rejects.toBe(error)
      expect(dependencies.resume).toHaveBeenCalledOnce()
      expect(input.onProgress).not.toHaveBeenCalled()
    }
  )
  it.each([0, 236, 1.5, Number.NaN])("rejects invalid batch limits before inspection: %s", async (maxBatches) => {
    const { database, input, dependencies } = fixture()
    await expect(processScraperBillCycle(database, { ...input, maxBatches }, dependencies)).rejects.toThrow(
      /Invalid|Too/
    )
    expect(dependencies.inspect).not.toHaveBeenCalled()
  })
  it.each([1799, 86_401, Number.NaN])("rejects invalid admission budgets: %s", async (admissionBudgetSeconds) => {
    const { database, input, dependencies } = fixture()
    await expect(processScraperBillCycle(database, { ...input, admissionBudgetSeconds }, dependencies)).rejects.toThrow(
      /Invalid|Too/
    )
    expect(dependencies.inspect).not.toHaveBeenCalled()
  })
})
