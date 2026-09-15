import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import * as schema from "../../db/schema/schema.js"
import { archiveNcBillPlan } from "./scraper-batches.js"
import { assessScraperBillCycle } from "./scraper-cycle.js"
import { executeScraperBillBatch } from "./scraper-execution.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

async function fixture() {
  const objects = new Map<string, Uint8Array>()
  const store = {
    exists: async (path: string) => objects.has(path),
    put: async (path: string, bytes: Uint8Array) => {
      if (objects.has(path)) {
        return false
      }
      objects.set(path, bytes)
      return true
    },
    read: async (path: string) => {
      const bytes = objects.get(path)
      if (!bytes) {
        throw new Error("Missing artifact")
      }
      return bytes
    }
  }
  const feed = (id: string) => `<rss><channel><item><bill>${id}</bill></item></channel></rss>`
  const plan = await archiveNcBillPlan(store, { H: feed("H1"), S: feed("S1") }, "execution-test")
  const database = drizzle({ connection: "postgresql://unused", schema })
  const calls: string[] = []
  const input = {
    store,
    planPath: plan.path,
    batchId: plan.plan.batches[0]!.id,
    runId: "execution-attempt",
    approvedBuildInputsSha256: "a".repeat(64),
    extractAndArchive: vi.fn<Parameters<typeof executeScraperBillBatch>[1]["extractAndArchive"]>(async (request) => {
      expect(await store.exists(request.dispatchPath)).toBe(true)
      calls.push("extract")
      return { manifestPath: "retained-attempt" }
    })
  }
  const dependencies = {
    inspect: vi
      .fn<NonNullable<Parameters<typeof executeScraperBillBatch>[2]>["inspect"]>()
      .mockResolvedValue(assessScraperBillCycle(plan.plan, [])),
    claim: vi.fn<NonNullable<Parameters<typeof executeScraperBillBatch>[2]>["claim"]>(async () => {
      calls.push("claim")
      return true
    }),
    release: vi.fn<NonNullable<Parameters<typeof executeScraperBillBatch>[2]>["release"]>(async () => {
      calls.push("release")
      return true
    }),
    promote: vi.fn<NonNullable<Parameters<typeof executeScraperBillBatch>[2]>["promote"]>(async () => {
      calls.push("promote")
      return {
        status: "promoted",
        sessionComplete: false,
        receipt: {
          source: "openstates",
          stream: "test",
          cursor: {
            status: "promoted",
            inventoryId: plan.plan.inventoryId,
            batchId: input.batchId,
            cycleId: "execution-test",
            dispatchPath: "test",
            runId: input.runId,
            manifestPath: "retained-attempt",
            manifestSha256: "a".repeat(64),
            buildInputsSha256: input.approvedBuildInputsSha256,
            bills: 1,
            unresolvedSponsors: 0,
            unresolvedPositions: 0
          }
        }
      }
    }),
    now: () => new Date("2026-09-15T04:00:00Z")
  }
  return { database, input, dependencies, calls }
}

describe("leased NC batch execution", () => {
  it("claims before dispatch/extraction, promotes retained evidence, and then releases", async () => {
    const { database, input, dependencies, calls } = await fixture()
    expect(await executeScraperBillBatch(database, input, dependencies)).toMatchObject({ sessionComplete: false })
    expect(calls).toEqual(["claim", "extract", "promote", "release"])
    expect(input.extractAndArchive).toHaveBeenCalledWith(
      expect.objectContaining({ billIds: ["H1"], maxDurationSeconds: 1500 })
    )
    expect(dependencies.claim).toHaveBeenCalledWith(database, expect.objectContaining({ token: input.runId }), 1800, {
      requireConfirmedRelease: true,
      group: expect.objectContaining({ stream: "ownership:nc-bills:2025" }),
      executor: expect.objectContaining({ pid: process.pid })
    })
  })
  it("never extracts or releases another worker's lease when claiming fails", async () => {
    const { database, input, dependencies } = await fixture()
    dependencies.claim.mockRejectedValueOnce(new Error("already owned"))
    await expect(executeScraperBillBatch(database, input, dependencies)).rejects.toThrow("already owned")
    expect(input.extractAndArchive).not.toHaveBeenCalled()
    expect(dependencies.release).not.toHaveBeenCalled()
  })
  it("does not launch or release a duplicate delivery of the same attempt", async () => {
    const { database, input, dependencies } = await fixture()
    dependencies.claim.mockResolvedValueOnce(false)
    await expect(executeScraperBillBatch(database, input, dependencies)).rejects.toThrow("duplicate execution")
    expect(input.extractAndArchive).not.toHaveBeenCalled()
    expect(dependencies.release).not.toHaveBeenCalled()
  })
  it("releases after a settled extraction failure without promoting partial output", async () => {
    const { database, input, dependencies } = await fixture()
    input.extractAndArchive.mockRejectedValueOnce(new Error("worker stopped"))
    await expect(executeScraperBillBatch(database, input, dependencies)).rejects.toThrow("worker stopped")
    expect(dependencies.promote).not.toHaveBeenCalled()
    expect(dependencies.release).toHaveBeenCalledOnce()
  })
  it("keeps ownership when worker shutdown cannot be confirmed", async () => {
    const { database, input, dependencies } = await fixture()
    input.extractAndArchive.mockRejectedValueOnce(new ScraperWorkerStopUnconfirmedError())
    await expect(executeScraperBillBatch(database, input, dependencies)).rejects.toThrow(
      "shutdown could not be confirmed"
    )
    expect(dependencies.promote).not.toHaveBeenCalled()
    expect(dependencies.release).not.toHaveBeenCalled()
  })
  it("rechecks committed receipts after claiming ownership and does not extract stale selections", async () => {
    const { database, input, dependencies } = await fixture()
    const state = await dependencies.inspect(database, input.store, input.planPath)
    dependencies.inspect.mockResolvedValueOnce({ ...state, pending: [] })
    await expect(executeScraperBillBatch(database, input, dependencies)).rejects.toThrow("already has a committed")
    expect(input.extractAndArchive).not.toHaveBeenCalled()
    expect(dependencies.release).toHaveBeenCalledOnce()
  })
  it("releases after promotion rejection without reporting success", async () => {
    const { database, input, dependencies } = await fixture()
    dependencies.promote.mockRejectedValueOnce(new Error("invalid archive"))
    await expect(executeScraperBillBatch(database, input, dependencies)).rejects.toThrow("invalid archive")
    expect(dependencies.release).toHaveBeenCalledOnce()
  })
  it("rejects a foreign batch before acquiring a lease", async () => {
    const { database, input, dependencies } = await fixture()
    await expect(executeScraperBillBatch(database, { ...input, batchId: "foreign" }, dependencies)).rejects.toThrow(
      "not part"
    )
    expect(dependencies.claim).not.toHaveBeenCalled()
  })
})
