import { createDatabase } from "@repo/legislation-core/database/database"
import { afterAll, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../../config/config.js"
import { createJobCounts } from "../job-result.js"
import { runIngestionJob as runIngestionJobType } from "../job.js"
import { executeCongressEntityRangeBackfill } from "./congress-entities.js"

const config = loadConfig({ NODE_ENV: "test" })
const { database, pool } = createDatabase(config.database)
afterAll(async () => pool.end())

describe("Congress entity range backfill", () => {
  it.each([118, 119])("refuses replacement when Congress %i has an empty collection", async (emptyCongress) => {
    const replaceEntitySnapshot = vi.fn<() => Promise<void>>()
    const runIngestionJob = vi.fn<typeof runIngestionJobType>(async (_database, input, execute) => ({
      ...(await execute("empty-range-test")),
      correlationId: input.correlationId,
      operation: input.operation,
      runId: "empty-range-test",
      source: input.source,
      status: "succeeded"
    }))
    const client = {
      async *members(congress: number) {
        yield congress === emptyCongress
          ? []
          : [{ bioguideId: "M000001", name: "Member One", url: "https://api.congress.gov/member/M000001" }]
      },
      getMember: async () => ({ bioguideId: "M000001", currentMember: true, terms: [] })
    }
    await expect(
      executeCongressEntityRangeBackfill(
        { config, database, correlationId: "test", startCongress: 118, endCongress: 119 },
        { client, replaceEntitySnapshot, runIngestionJob }
      )
    ).rejects.toThrow(`Congress ${emptyCongress} returned no members`)
    expect(replaceEntitySnapshot).not.toHaveBeenCalled()
  })

  it("uses the all-range lease and visits every Congress", async () => {
    const members = vi.fn<(congress: number) => AsyncGenerator<readonly unknown[]>>(async function* (congress: number) {
      yield [
        {
          bioguideId: "M000001",
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
          url: "https://api.congress.gov/member/M000001"
        }
      ]
    })
    const getMember = vi.fn<(bioguideId: string) => Promise<unknown>>(async (bioguideId) => ({
      bioguideId,
      currentMember: true,
      terms: [
        {
          chamber: "House of Representatives",
          congress: 118,
          endYear: 2025,
          memberType: "Representative",
          startYear: 2023
        },
        {
          chamber: "House of Representatives",
          congress: 119,
          memberType: "Representative",
          startYear: 2025
        }
      ]
    }))
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
        client: { getMember, members },
        replaceEntitySnapshot,
        runIngestionJob: runIngestionJob as never
      }
    )
    expect(members).toHaveBeenCalledTimes(2)
    expect(replaceEntitySnapshot).toHaveBeenCalledOnce()
    expect(replaceEntitySnapshot).toHaveBeenCalledWith(
      expect.anything(),
      "jurisdiction:us",
      expect.objectContaining({
        organizations: [],
        people: expect.arrayContaining([
          expect.objectContaining({
            provenanceComplete: true,
            sourceIsOfficial: true,
            sourceProvider: "congress",
            sourceRetrievedAt: expect.any(Date)
          })
        ]),
        personAliasPersonIds: ["person:congress:m000001"],
        personAliasSourceProvider: "congress",
        personAliases: [
          expect.objectContaining({
            personId: "person:congress:m000001",
            sourceProvider: "congress",
            name: "Member 118"
          }),
          expect.objectContaining({
            personId: "person:congress:m000001",
            sourceProvider: "congress",
            name: "Member 119"
          })
        ],
        personExternalIdentifiers: [expect.objectContaining({ scheme: "bioguide", value: "M000001" })],
        personDetailSourceProvider: "congress",
        personDetails: expect.arrayContaining([
          expect.objectContaining({ personId: "person:congress:m000001", sourceProvider: "congress" })
        ]),
        terms: expect.arrayContaining([
          expect.objectContaining({
            provenanceComplete: true,
            sourceIsOfficial: true,
            sourceProvider: "congress",
            sourceRetrievedAt: expect.any(Date)
          })
        ]),
        termPersonIds: ["person:congress:m000001"],
        termSourceProvider: "congress"
      }),
      { replaceOrganizations: false }
    )
    expect(getMember).toHaveBeenCalledOnce()
  })
})
