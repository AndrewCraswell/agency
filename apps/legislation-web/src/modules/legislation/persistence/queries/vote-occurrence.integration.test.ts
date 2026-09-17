import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createDatabase } from "@repo/legislation-core/database/database"
import { votes } from "@repo/legislation-core/database/schema/schema"
import { asc, desc, eq, sql } from "drizzle-orm"
import { afterAll, describe, expect, it } from "vitest"
import { voteOccurrence, voteSortTimestamp } from "./vote-occurrence"
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
  it("uses ordered indexes at scale without sorting same-day ties", async () => {
    if (!connection) {
      throw new Error("Missing isolated test database")
    }
    const baseline = await readFile(
      new URL(import.meta.resolve("@repo/legislation-core/database/migrations/0034_timeline-canonical-facts.sql")),
      "utf8"
    )
    const definitions = baseline.match(/CREATE INDEX IF NOT EXISTS "votes_occurrence_(?:asc|desc)_idx"[^;]+;/g)
    expect(definitions).toHaveLength(2)
    const rollback = new Error("verified rollback")
    await expect(
      connection.database.transaction(async (database) => {
        await database.execute(sql`set local statement_timeout='20s'`)
        for (const definition of definitions ?? []) {
          await database.execute(sql.raw(definition))
        }
        const scope = randomUUID()
        await database.execute(sql`
        insert into legislation.votes
          (id, chamber, motion, result, held_at, held_date, yes_count, no_count,
           absent_count, abstain_count, not_voting_count, present_count, proxy_count,
           paired_count, other_count, source_url, source_provider, source_retrieved_at,
           source_is_official, source_sequence, timeline_complete)
        select ${scope} || ':' || lpad(n::text,6,'0'), 'lower', 'Passed', 'passed',
          case when n % 2 = 0 then timestamptz '2026-05-07 12:00:00+00' end,
          case when n % 2 = 1 then date '2026-05-07' end,
          1,0,0,0,0,0,0,0,0,'https://example.org/journal','test',now(),true,n,true
        from generate_series(1,100000) n
      `)
        await database.execute(sql`analyze legislation.votes`)
        for (const direction of ["asc", "desc"] as const) {
          const query = database
            .select({ id: votes.id })
            .from(votes)
            .where(eq(votes.timelineComplete, true))
            .orderBy(direction === "asc" ? asc(voteSortTimestamp()) : desc(voteSortTimestamp()), asc(votes.id))
            .limit(21)
          const plan = await database.execute(sql`explain (analyze, buffers, format json) ${query}`)
          const rendered = JSON.stringify(plan.rows)
          expect(rendered).toContain(`votes_occurrence_${direction}_idx`)
          expect(rendered).not.toContain('"Node Type":"Sort"')
          expect(rendered).not.toContain('"Node Type":"Seq Scan"')
          expect(await query).toHaveLength(21)
        }
        throw rollback
      })
    ).rejects.toBe(rollback)
  }, 60000)

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
