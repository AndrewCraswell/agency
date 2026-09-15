import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import * as schema from "../../db/schema/schema.js"
import { planNcBillBatches } from "./scraper-batches.js"
import { assessScraperBillCycle, inspectScraperBillCycle } from "./scraper-cycle.js"
import { executeScraperBillBatch } from "./scraper-execution.js"
import { resumeScraperBillCycle } from "./scraper-resume.js"
import { ScraperBatchAlreadyPromotedError } from "./scraper-worker-error.js"

function fixture() {
  const xml = (id: string) => `<rss><channel><item><bill>${id}</bill></item></channel></rss>`
  const plan = planNcBillBatches({ H: xml("H1"), S: xml("S1") }, "resume-step")
  const before = assessScraperBillCycle(plan, [])
  const after = { ...before, promotedBatches: 1, promotedBills: 1, pending: before.pending.slice(1) }
  const dependencies = {
    inspect: vi.fn<typeof inspectScraperBillCycle>().mockResolvedValueOnce(before).mockResolvedValue(after),
    execute: vi.fn<typeof executeScraperBillBatch>()
  }
  const database = drizzle({ connection: "postgresql://unused", schema })
  const input = {
    store: { exists: async () => false, put: async () => false, read: async () => new Uint8Array() },
    planPath: "unused",
    runId: "unused",
    approvedBuildInputsSha256: "a".repeat(64),
    extractAndArchive: vi.fn<Parameters<typeof executeScraperBillBatch>[1]["extractAndArchive"]>()
  }
  return { before, after, database, input, dependencies }
}

describe("one-batch NC cycle resume", () => {
  it("dispatches only the first pending batch and reloads its durable outcome", async () => {
    const { before, after, database, input, dependencies } = fixture()
    expect(await resumeScraperBillCycle(database, input, dependencies)).toEqual({
      status: "promoted",
      batchId: before.pending[0]!.id,
      state: after
    })
    expect(dependencies.execute).toHaveBeenCalledExactlyOnceWith(database, { ...input, batchId: before.pending[0]!.id })
  })
  it("does not dispatch when every batch is already promoted", async () => {
    const { before, database, input, dependencies } = fixture()
    dependencies.inspect.mockReset().mockResolvedValue({ ...before, pending: [], promotionComplete: true })
    expect(await resumeScraperBillCycle(database, input, dependencies)).toMatchObject({
      status: "cycle_promoted",
      batchId: null
    })
    expect(dependencies.execute).not.toHaveBeenCalled()
  })
  it("handles a stale selection only after observing the committed receipt", async () => {
    const { database, input, dependencies } = fixture()
    dependencies.execute.mockRejectedValueOnce(new ScraperBatchAlreadyPromotedError())
    expect(await resumeScraperBillCycle(database, input, dependencies)).toMatchObject({ status: "already_promoted" })
  })
  it("does not treat an execution return as a committed receipt", async () => {
    const { before, database, input, dependencies } = fixture()
    dependencies.inspect.mockReset().mockResolvedValue(before)
    await expect(resumeScraperBillCycle(database, input, dependencies)).rejects.toThrow("missing its committed")
  })
  it("propagates failures without advancing or dispatching another batch", async () => {
    const { database, input, dependencies } = fixture()
    dependencies.execute.mockRejectedValueOnce(new Error("source failed"))
    await expect(resumeScraperBillCycle(database, input, dependencies)).rejects.toThrow("source failed")
    expect(dependencies.execute).toHaveBeenCalledOnce()
    expect(dependencies.inspect).toHaveBeenCalledOnce()
  })
})
