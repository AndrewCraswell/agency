import { createDatabase } from "@repo/legislation-core/database/database"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../../config/config.js"
import { executeGovInfoCommitteeSynchronization } from "../../ingestion/govinfo/committee-directory-sync.js"
import { createJobCounts } from "../../ingestion/job-result.js"
import type { JobResult } from "../../ingestion/job.js"
import { committeeDirectoryBackfillPayload, runCommitteeDirectoryBackfill } from "./committee-directory-backfill.js"

vi.mock("@repo/legislation-core/database/database", async (original) => ({
  ...(await original<typeof import("@repo/legislation-core/database/database")>()),
  createDatabase: vi.fn<typeof createDatabase>()
}))
vi.mock("../../ingestion/govinfo/committee-directory-sync.js", () => ({
  executeGovInfoCommitteeSynchronization: vi.fn<typeof executeGovInfoCommitteeSynchronization>()
}))

const originalDatabase = await vi.importActual<typeof import("@repo/legislation-core/database/database")>(
  "@repo/legislation-core/database/database"
)
const connection = originalDatabase.createDatabase(loadConfig({ NODE_ENV: "test" }).database)
const end = vi.spyOn(connection.pool, "end").mockResolvedValue()
afterAll(async () => {
  end.mockRestore()
  await connection.pool.end()
})

beforeEach(() => {
  vi.mocked(createDatabase).mockReset().mockReturnValue(connection)
  vi.mocked(executeGovInfoCommitteeSynchronization).mockReset().mockResolvedValue(result("succeeded"))
  end.mockClear()
})

function result(status: JobResult["status"]): JobResult {
  return {
    correlationId: "test",
    counts: createJobCounts(),
    failures: [],
    operation: "committee-directory-sync",
    runId: "ingestion-run",
    source: "govinfo",
    status
  }
}

describe("manual committee directory backfill", () => {
  it.each([105, 118])("accepts historical boundary Congress %i", (congress) => {
    expect(committeeDirectoryBackfillPayload.parse({ congress })).toEqual({ congress })
  })

  it.each([
    { congress: 104 },
    { congress: 119 },
    { congress: 105.5 },
    { congress: "118" },
    { congress: 118, restart: true }
  ])("rejects an unsafe payload %j before creating a database", async (payload) => {
    await expect(runCommitteeDirectoryBackfill(payload, "trigger-run")).rejects.toThrow(/congress|restart/)
    expect(createDatabase).not.toHaveBeenCalled()
  })

  it("delegates one Congress with workflow identity and closes its pool", async () => {
    await expect(runCommitteeDirectoryBackfill({ congress: 118 }, "trigger-run")).resolves.toMatchObject({
      status: "succeeded"
    })
    expect(executeGovInfoCommitteeSynchronization).toHaveBeenCalledWith(
      {
        config: expect.anything(),
        database: connection.database,
        congress: 118,
        correlationId: "trigger:trigger-run",
        workflowExecutionId: "trigger-run"
      },
      { providerAdmission: expect.anything() }
    )
    expect(end).toHaveBeenCalledOnce()
  })

  it("rejects unsuccessful ingestion and still closes its pool", async () => {
    vi.mocked(executeGovInfoCommitteeSynchronization).mockResolvedValue(result("failed"))
    await expect(runCommitteeDirectoryBackfill({ congress: 118 }, "trigger-run")).rejects.toThrow("status failed")
    expect(end).toHaveBeenCalledOnce()
  })

  it("closes its pool when synchronization throws", async () => {
    vi.mocked(executeGovInfoCommitteeSynchronization).mockRejectedValue(new Error("source failed"))
    await expect(runCommitteeDirectoryBackfill({ congress: 118 }, "trigger-run")).rejects.toThrow("source failed")
    expect(end).toHaveBeenCalledOnce()
  })
})
