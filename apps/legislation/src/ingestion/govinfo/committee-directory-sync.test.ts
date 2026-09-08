import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import type { replaceEntitySnapshot } from "../../db/queries/entities.js"
import type { runIngestionJob } from "../job.js"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory } from "./committee-directory-normalize.js"
import { committeeRosterFingerprint } from "./committee-directory-observation.js"
import { parseGovInfoCommitteeDirectory } from "./committee-directory-parser.js"
import { executeGovInfoCommitteeSynchronization } from "./committee-directory-sync.js"

const mocks = vi.hoisted(() => ({
  replace: vi.fn<typeof replaceEntitySnapshot>(),
  run: vi.fn<typeof runIngestionJob>()
}))
vi.mock("../../db/queries/entities.js", () => ({ replaceEntitySnapshot: mocks.replace }))
vi.mock("../job.js", async (original) => ({
  ...(await original<typeof import("../job.js")>()),
  runIngestionJob: mocks.run
}))

const config = loadConfig({ NODE_ENV: "test" })
const { database, pool } = createDatabase(config.database)
const now = new Date("2026-09-06T12:00:00Z")
let cursor: Record<string, unknown> | undefined
let existing: string[][] = []
const catalog = {
  aliases: [],
  people: [
    { id: "person:congress:s1", name: "Jane Senator", givenName: "Jane", familyName: "Senator" },
    { id: "person:congress:r1", name: "Alex Representative", givenName: "Alex", familyName: "Representative" }
  ],
  terms: [
    {
      personId: "person:congress:s1",
      chamber: "upper",
      district: null,
      isActive: true,
      sourceId: "119:upper:2025:2027"
    },
    { personId: "person:congress:r1", chamber: "lower", district: "3", isActive: true, sourceId: "119:lower:2025:2027" }
  ]
}

afterAll(async () => pool.end())

beforeEach(() => {
  vi.restoreAllMocks()
  mocks.replace.mockReset()
  cursor = undefined
  existing = []
  vi.spyOn(pool, "query").mockImplementation(vi.fn(async () => ({ rows: existing })))
  const checkpointQuery = database.query.syncCheckpoints.findFirst()
  vi.spyOn(checkpointQuery, "execute").mockImplementation(async () =>
    cursor === undefined
      ? undefined
      : { cursor, source: "govinfo", stream: "govinfo:committee-directory:119", watermark: now, updatedAt: now }
  )
  vi.spyOn(database.query.syncCheckpoints, "findFirst").mockReturnValue(checkpointQuery)
  mocks.run.mockImplementation(async (_database, input, operation) => {
    const result = await operation("test-run")
    cursor = result.checkpoint === undefined ? cursor : { ...result.checkpoint }
    return {
      ...result,
      correlationId: input.correlationId,
      operation: input.operation,
      runId: "test-run",
      source: input.source,
      status: "succeeded"
    }
  })
  mocks.replace.mockImplementation(async (_database, _jurisdiction, _snapshot, options) => {
    cursor = options?.checkpoint?.cursor
  })
})

function directory(issued = "2026-02-20", modified = "2026-07-14"): GovInfoDirectoryPackage {
  return {
    congress: 119,
    packageId: `CDIR-${issued}`,
    issuedAt: new Date(issued),
    lastModified: new Date(modified),
    textUrl: new URL(`https://www.govinfo.gov/${issued}.txt`),
    sourceUrl: new URL(`https://www.govinfo.gov/${issued}.txt`)
  }
}

function fixture(role = "chairman"): string {
  const senate = Array.from({ length: 10 }, (_, i) => `Senate Committee ${i + 1}\n\nJane Senator (wa) ${role}`).join(
    "\n\n"
  )
  const house = Array.from(
    { length: 10 },
    (_, i) => `House Committee ${i + 1}\n\nAlex Representative (ca-03) chairman`
  ).join("\n\n")
  return `STANDING COMMITTEES OF THE SENATE\n\n${senate}\n\nSTANDING COMMITTEES OF THE HOUSE\n\n${house}\n\nJOINT COMMITTEES`
}

function run(packages = [directory()], getText = async () => fixture()) {
  return executeGovInfoCommitteeSynchronization(
    { config, database, congress: 119, correlationId: "test-correlation" },
    {
      client: {
        discover: async () => packages,
        getRecords: async () => parseGovInfoCommitteeDirectory(await getText())
      },
      loadCatalog: async () => catalog,
      now: () => now
    }
  )
}

function runWithAlias(personId: string) {
  const getMemberAliases = vi
    .fn<() => Promise<{ name: string; personId: string; state: string; chamber: "upper" }[]>>()
    .mockResolvedValue([{ name: "Janey Senator", personId, state: "WA", chamber: "upper" }])
  const operation = executeGovInfoCommitteeSynchronization(
    { config, database, congress: 119, correlationId: "alias-test" },
    {
      client: {
        discover: async () => [directory()],
        getRecords: async () => parseGovInfoCommitteeDirectory(fixture().replaceAll("Jane Senator", "Janey Senator")),
        getMemberAliases
      },
      loadCatalog: async () => catalog,
      now: () => now
    }
  )
  return { operation, getMemberAliases }
}

describe("committee directory observation synchronization", () => {
  it("prepares two editions concurrently but publishes in source order", async () => {
    const first = directory()
    const second = directory("2026-08-01", "2026-08-02")
    const gate = Promise.withResolvers<void>()
    const prepared: string[] = []
    await executeGovInfoCommitteeSynchronization(
      { config, database, congress: 119, correlationId: "parallel-test" },
      {
        client: {
          discover: async () => [first, second],
          getRecords: async (edition) => {
            if (edition.packageId === first.packageId) {
              await gate.promise
            }
            prepared.push(edition.packageId)
            gate.resolve()
            return parseGovInfoCommitteeDirectory(fixture(edition === first ? "member" : "chairman"))
          }
        },
        loadCatalog: async () => catalog,
        now: () => now
      }
    )
    expect(prepared).toEqual([second.packageId, first.packageId])
    expect(mocks.replace.mock.calls.map((call) => call[3]?.checkpoint?.cursor.packageId)).toEqual([
      first.packageId,
      second.packageId
    ])
  })
  it("prevalidates all pending editions and then commits their checkpoints in order", async () => {
    await run([directory(), directory("2026-08-01", "2026-08-02")], async () => {
      expect(mocks.replace).not.toHaveBeenCalled()
      return fixture()
    })
    expect(mocks.replace).toHaveBeenCalledTimes(2)
    expect(mocks.replace.mock.calls.map((call) => call[3]?.checkpoint?.cursor.packageId)).toEqual([
      "CDIR-2026-02-20",
      "CDIR-2026-08-01"
    ])
    expect(cursor?.packageId).toBe("CDIR-2026-08-01")
  })

  it.each(["parse", "identity"])("validates later editions before any snapshot write: %s", async (failure) => {
    let reads = 0
    const operation = run([directory(), directory("2026-08-01", "2026-08-02")], async () => {
      reads += 1
      if (reads === 1) {
        return fixture()
      }
      return failure === "parse" ? "Invalid directory" : fixture().replaceAll("Jane Senator", "Unknown Senator")
    })
    await expect(operation).rejects.toThrow(failure === "parse" ? /lacks/ : /unmatched/)
    expect(reads).toBe(2)
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(cursor).toBeUndefined()
  })

  it("uses same-edition aliases for existing Congress-scoped people", async () => {
    const { operation, getMemberAliases } = runWithAlias("person:congress:s1")
    await operation
    expect(mocks.replace).toHaveBeenCalledOnce()
    expect(getMemberAliases).toHaveBeenCalledOnce()
  })

  it("does not invent a person or term from a directory alias", async () => {
    const { operation, getMemberAliases } = runWithAlias("person:congress:unknown")
    await expect(operation).rejects.toThrow("unmatched committee members")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(getMemberAliases).toHaveBeenCalledOnce()
  })

  it("preserves existing organizations when importing an ended Congress", async () => {
    await executeGovInfoCommitteeSynchronization(
      { config, database, congress: 119, correlationId: "historical-test" },
      {
        client: {
          discover: async () => [directory()],
          getRecords: async () => parseGovInfoCommitteeDirectory(fixture())
        },
        loadCatalog: async () => catalog,
        now: () => new Date("2028-01-01T00:00:00Z")
      }
    )
    expect(mocks.replace).toHaveBeenCalledOnce()
    const call = mocks.replace.mock.calls[0]!
    expect(call[2].organizations.every((organization) => organization.isActive === false)).toBe(true)
    expect(call[2].memberships.length).toBeGreaterThan(0)
    for (const membership of call[2].memberships) {
      expect(membership).toMatchObject({
        isActive: false,
        endedReason: "congress_ended",
        detectedEndDate: null,
        detectedStartDate: "2026-02-20"
      })
    }
    expect(call[3]).toMatchObject({
      membershipSessionId: "session:us:119",
      preserveExistingOrganizations: true,
      replacePeople: false,
      statementTimeoutMs: 60_000
    })
  })

  it("keeps current-Congress memberships active without a fabricated closure", async () => {
    await run()
    const call = mocks.replace.mock.calls[0]!
    expect(call[2].memberships.length).toBeGreaterThan(0)
    for (const membership of call[2].memberships) {
      expect(membership.isActive).toBe(true)
      expect(membership.endedReason).toBeUndefined()
      expect(membership.detectedEndDate).toBeUndefined()
    }
  })

  it("bootstraps only an identical published roster without replacing memberships", async () => {
    cursor = { issuedAt: directory().issuedAt.toISOString(), packageId: directory().packageId }
    const members = normalizeGovInfoCommitteeDirectory(
      parseGovInfoCommitteeDirectory(fixture()),
      directory(),
      catalog,
      now
    ).snapshot.memberships
    existing = members.map((m) => [m.organizationId, m.personId, m.role ?? "member"])
    const result = await run()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(result.counts.skipped).toBe(1)
    expect(result.checkpoint?.observation).toMatchObject({
      fingerprint: committeeRosterFingerprint(members),
      detectedAt: directory().issuedAt.toISOString()
    })
  })

  it("fails closed when an unobserved checkpoint disagrees with published memberships", async () => {
    cursor = { issuedAt: directory().issuedAt.toISOString(), packageId: directory().packageId }
    await expect(run()).rejects.toThrow("without a saved observation")
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("skips unchanged fingerprints, including metadata-only updates", async () => {
    await run()
    mocks.replace.mockClear()
    const result = await run([directory("2026-02-20", "2026-08-01")])
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(result.counts.skipped).toBe(1)
    expect(result.checkpoint?.observation).toMatchObject({
      lastModified: "2026-08-01T00:00:00.000Z",
      detectedAt: "2026-02-20T00:00:00.000Z"
    })
  })

  it("forwards the changed roster and modification-date checkpoint together", async () => {
    await run()
    mocks.replace.mockClear()
    await run([directory("2026-02-20", "2026-08-02")], async () => fixture("ranking member"))
    expect(mocks.replace).toHaveBeenCalledOnce()
    const call = mocks.replace.mock.calls[0]!
    expect(call[2].memberships.every((m) => m.detectedStartDate === "2026-08-02")).toBe(true)
    expect(call[3]).toMatchObject({
      membershipDetectionDate: "2026-08-02",
      checkpoint: {
        stream: "govinfo:committee-directory:119",
        cursor: { observation: { detectedAt: "2026-08-02T00:00:00.000Z" } }
      }
    })
  })

  it("retains a completed edition checkpoint when a later database write fails and safely replays", async () => {
    const packages = [directory(), directory("2026-08-20", "2026-08-21")]
    mocks.replace
      .mockImplementationOnce(async (_database, _jurisdiction, _snapshot, options) => {
        cursor = options?.checkpoint?.cursor
      })
      .mockRejectedValueOnce(new Error("database unavailable"))
    await expect(run(packages)).rejects.toThrow("database unavailable")
    expect(cursor?.packageId).toBe("CDIR-2026-02-20")
    mocks.replace.mockClear()
    const result = await run(packages)
    expect(result.counts.skipped).toBe(1)
    expect(mocks.replace).toHaveBeenCalledOnce()
    expect(cursor?.packageId).toBe("CDIR-2026-08-20")
  })
})
