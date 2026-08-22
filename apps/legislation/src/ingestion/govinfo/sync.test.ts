import { afterAll, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { createJobCounts, type JobResult, runIngestionJob } from "../job.js"
import type { SourceStore } from "../source-store.js"
import { importGovInfoPackages } from "./import.js"
import { executeGovInfoCurrentSynchronization } from "./sync.js"

const config = loadConfig({ NODE_ENV: "test" })
const { database, pool } = createDatabase(config.database)
const now = new Date("2026-08-18T12:00:00.000Z")

afterAll(async () => pool.end())

describe("executeGovInfoCurrentSynchronization", () => {
  it("replays one day from its durable observation cursor and force-imports only modified packages", async () => {
    const packages = [
      {
        billType: "hr",
        congress: 119,
        lastModified: new Date("2026-08-18T08:34:01.121Z"),
        packageId: "BILLSTATUS-119hr1",
        url: new URL("https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1.xml")
      }
    ]
    const discoverModified = vi
      .fn<
        (
          congress: number,
          billTypes: readonly string[],
          modifiedSince: Date,
          modifiedThrough: Date
        ) => Promise<typeof packages>
      >()
      .mockResolvedValue(packages)
    const importPackages = vi.fn<typeof importGovInfoPackages>().mockResolvedValue({
      checkpoint: { complete: true, index: 1 },
      counts: createJobCounts({ discovered: 1, read: 1, updated: 1 }),
      failures: []
    })
    const jobInputs: Parameters<typeof runIngestionJob>[1][] = []

    const result = await executeGovInfoCurrentSynchronization(
      {
        billTypes: ["hr"],
        config,
        congress: 119,
        correlationId: "trigger-run",
        database,
        workflowExecutionId: "trigger-execution"
      },
      {
        client: { discoverModified, getBillStatus: vi.fn<() => Promise<string>>() },
        importPackages,
        now: () => now,
        readObservedThrough: async () => new Date("2026-08-18T10:00:00.000Z"),
        runIngestionJob: createJobRunner(jobInputs),
        sourceStore: { put: vi.fn<SourceStore["put"]>() }
      }
    )

    expect(discoverModified).toHaveBeenCalledWith(119, ["hr"], new Date("2026-08-17T10:00:00.000Z"), now)
    expect(importPackages).toHaveBeenCalledWith(
      database,
      expect.anything(),
      packages,
      expect.objectContaining({ force: true, persistCheckpoint: false, stream: "govinfo:bill-status:119" })
    )
    expect(jobInputs[0]).toMatchObject({
      checkpointStream: "govinfo:bill-status:119",
      operation: "bill-status-sync",
      scopeKey: "bill-status:all",
      source: "govinfo"
    })
    expect(result.checkpoint).toMatchObject({ congress: 119, observedThrough: now.toISOString() })
  })

  it("uses a seven-day lookback before the first successful observation", async () => {
    const discoverModified = vi
      .fn<(congress: number, billTypes: readonly string[], modifiedSince: Date, modifiedThrough: Date) => Promise<[]>>()
      .mockResolvedValue([])
    await executeGovInfoCurrentSynchronization(
      { config, congress: 119, correlationId: "first-run", database },
      {
        client: { discoverModified, getBillStatus: vi.fn<() => Promise<string>>() },
        importPackages: async () => ({ checkpoint: {}, counts: createJobCounts(), failures: [] }),
        now: () => now,
        readObservedThrough: async () => undefined,
        runIngestionJob: createJobRunner([]),
        sourceStore: { put: vi.fn<SourceStore["put"]>() }
      }
    )

    expect(discoverModified).toHaveBeenCalledWith(119, expect.any(Array), new Date("2026-08-11T12:00:00.000Z"), now)
  })

  it("makes no cursor or provider request when the shared lease is unavailable", async () => {
    const discoverModified = vi.fn<() => Promise<[]>>()
    const readObservedThrough = vi.fn<() => Promise<Date | undefined>>()

    await expect(
      executeGovInfoCurrentSynchronization(
        { config, congress: 119, correlationId: "overlap", database },
        {
          client: { discoverModified, getBillStatus: vi.fn<() => Promise<string>>() },
          readObservedThrough,
          runIngestionJob: async () => {
            throw new Error("lease unavailable")
          },
          sourceStore: { put: vi.fn<SourceStore["put"]>() }
        }
      )
    ).rejects.toThrow("lease unavailable")

    expect(readObservedThrough).not.toHaveBeenCalled()
    expect(discoverModified).not.toHaveBeenCalled()
  })
})

function createJobRunner(inputs: Parameters<typeof runIngestionJob>[1][]) {
  return async (
    _database: Parameters<typeof runIngestionJob>[0],
    input: Parameters<typeof runIngestionJob>[1],
    operation: Parameters<typeof runIngestionJob>[2]
  ): Promise<JobResult> => {
    inputs.push(input)
    const result = await operation("run-1")
    return {
      ...result,
      correlationId: input.correlationId,
      operation: input.operation,
      runId: "run-1",
      source: input.source,
      status: result.counts.failed === 0 ? "succeeded" : "partial",
      workflowExecutionId: input.workflowExecutionId
    }
  }
}
