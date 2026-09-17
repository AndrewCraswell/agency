import { randomUUID } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { votes } from "@repo/legislation-core/database/schema/schema"
import { afterAll, describe, expect, it } from "vitest"
import { voteOccurrence } from "./vote-occurrence"
import { listVoteReads } from "./vote-reads"

const url = process.env.VOTE_DATE_TEST_DATABASE_URL
// This suite inserts only inside rolled-back transactions in an explicitly isolated local database.
if (url) {
  const target = new URL(url)
  if (target.hostname !== "127.0.0.1" || !target.pathname.startsWith("/legislation_vote_date_")) {
    throw new Error("Vote date integration requires an isolated local vote-date database")
  }
}
const connection = url
  ? createDatabase({ url, maxConnections: 1, connectionTimeoutMs: 5000, idleTimeoutMs: 1000 })
  : undefined
afterAll(async () => {
  await connection?.pool.end()
})

describe.skipIf(!connection)("mixed-precision vote reads in PostgreSQL", () => {
  it("paginates both directions and includes unknown-time boundary days", async () => {
    if (!connection) {
      throw new Error("Missing isolated test database")
    }
    const rollback = new Error("verified rollback")
    await expect(
      connection.database.transaction(async (database) => {
        const scope = randomUUID()
        const rows = [
          { id: `${scope}:day`, heldDate: "2026-05-07" },
          { id: `${scope}:early`, heldAt: new Date("2026-05-07T06:00:00Z") },
          { id: `${scope}:late`, heldAt: new Date("2026-05-07T18:00:00Z") },
          { id: `${scope}:next`, heldDate: "2026-05-08" }
        ]
        await database.insert(votes).values(
          rows.map((row, sourceSequence) => ({
            ...row,
            chamber: "lower",
            classification: scope,
            motion: "Passed",
            result: "passed",
            yesCount: 1,
            noCount: 0,
            absentCount: 0,
            abstainCount: 0,
            notVotingCount: 0,
            presentCount: 0,
            proxyCount: 0,
            pairedCount: 0,
            otherCount: 0,
            sourceUrl: "https://example.org/journal",
            sourceProvider: "test",
            sourceRetrievedAt: new Date(),
            sourceIsOfficial: true,
            sourceSequence,
            timelineComplete: true
          }))
        )
        for (const sort of ["held-asc", "held-desc"] as const) {
          const ids: string[] = []
          let cursor: string | undefined
          for (let page = 0; page < 5; page += 1) {
            const result = await listVoteReads(database, { classification: scope, sort, limit: 1, cursor })
            ids.push(...result.items.map((vote) => vote.id))
            cursor = result.nextCursor
            if (!cursor) {
              break
            }
          }
          expect(ids).toEqual((sort === "held-asc" ? rows : [...rows].reverse()).map((row) => row.id))
        }
        const midday = await listVoteReads(database, {
          classification: scope,
          from: "2026-05-07T12:00:00Z",
          to: "2026-05-07T13:00:00Z"
        })
        expect(midday.items.map((row) => row.id)).toEqual([`${scope}:day`])
        expect(midday.items.map(voteOccurrence)).toEqual([{ date: "2026-05-07", heldAt: null }])
        const wholeDay = await listVoteReads(database, { classification: scope, from: "2026-05-07", to: "2026-05-07" })
        expect(wholeDay.items).toHaveLength(3)
        throw rollback
      })
    ).rejects.toBe(rollback)
  })
})
