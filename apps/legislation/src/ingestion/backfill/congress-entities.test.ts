import { describe, expect, it, vi } from "vitest"
import { createJobCounts, runIngestionJob as runIngestionJobType } from "../job.js"
import { executeCongressEntityRangeBackfill } from "./congress-entities.js"

describe("Congress entity range backfill", () => {
  it("uses the legacy all-range lease and visits every Congress", async () => {
    const members = vi.fn<(congress: number) => AsyncGenerator<readonly unknown[]>>(async function* (congress: number) {
      yield [
        {
          bioguideId: `M${congress}`,
          depiction: {},
          district: 1,
          name: `Member ${congress}`,
          partyName: "X",
          state: "CA",
          terms: {
            item: [
              {
                chamber: "House of Representatives",
                congress,
                endYear: 2025,
                memberType: "Representative",
                startYear: 2023,
                stateCode: "CA"
              }
            ]
          },
          updateDate: "2026-01-01",
          url: `https://api.congress.gov/member/M${congress}`
        }
      ]
    })
    const committees = vi.fn<() => AsyncGenerator<readonly unknown[]>>(async function* () {
      yield []
    })
    const runIngestionJob = vi.fn<typeof runIngestionJobType>(async (_database, input, execute) => {
      expect(input).toMatchObject({ operation: "current-entities", scopeKey: "entities:all", source: "congress" })
      await execute("run-1")
      return {
        correlationId: input.correlationId,
        counts: createJobCounts(),
        failures: [],
        operation: input.operation,
        runId: "run-1",
        source: input.source,
        status: "succeeded" as const
      }
    })
    const replaceEntitySnapshot = vi.fn<() => Promise<void>>(async () => undefined)

    await executeCongressEntityRangeBackfill(
      {
        config: { ingestion: {} } as never,
        correlationId: "test",
        database: {} as never,
        endCongress: 119,
        startCongress: 118
      },
      {
        client: { committees, members },
        replaceEntitySnapshot,
        runIngestionJob: runIngestionJob as never
      }
    )
    expect(members).toHaveBeenCalledTimes(2)
    expect(replaceEntitySnapshot).toHaveBeenCalledOnce()
    expect(replaceEntitySnapshot).toHaveBeenCalledWith(
      expect.anything(),
      "jurisdiction:us",
      expect.objectContaining({ personAliasPersonIds: [], personAliases: [] })
    )
  })
})
