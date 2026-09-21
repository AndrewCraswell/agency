import { createDatabase } from "@repo/legislation-core/database/database"
import { task } from "@trigger.dev/sdk"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"

const payloadSchema = z.strictObject({
  endCongress: z.number().int().positive(),
  expectedVotes: z.number().int().positive(),
  startCongress: z.number().int().positive()
})

export type SenateCoverageRow = Readonly<{
  congress: number
  distinctSequenceCount: number
  firstSequence: number
  lastSequence: number
  positions: number
  session: number
  votes: number
  votesWithPositions: number
  votesWithSourceUrl: number
}>

export function validateSenateCoverage(
  rows: readonly SenateCoverageRow[],
  expectedVotes: number,
  startCongress: number,
  endCongress: number
) {
  const expectedSessions = (endCongress - startCongress + 1) * 2
  const totalVotes = rows.reduce((total, row) => total + row.votes, 0)
  const incompleteSessions = rows.filter(
    (row) =>
      row.firstSequence !== 1 ||
      row.votes !== row.lastSequence ||
      row.distinctSequenceCount !== row.votes ||
      row.votesWithPositions !== row.votes ||
      row.votesWithSourceUrl !== row.votes
  )
  if (rows.length !== expectedSessions || totalVotes !== expectedVotes || incompleteSessions.length > 0) {
    throw new Error(
      `Senate coverage validation failed: ${totalVotes}/${expectedVotes} votes, ${rows.length}/${expectedSessions} sessions, ${incompleteSessions.length} incomplete sessions`
    )
  }
  return { sessions: rows.length, totalPositions: rows.reduce((total, row) => total + row.positions, 0), totalVotes }
}

export const senateCorpusValidation = task({
  id: "senate-corpus-validation",
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  queue: { name: "senate-validation", concurrencyLimit: 1 },
  run: async (raw: unknown) => {
    const payload = payloadSchema.parse(raw)
    if (payload.endCongress < payload.startCongress) {
      throw new Error("endCongress must be greater than or equal to startCongress")
    }

    const config = loadConfig()
    const { database, pool } = createDatabase(config.database)
    try {
      const result = await database.execute<SenateCoverageRow>(sql`
        select
          split_part(vote.id, '-', 2)::int as congress,
          split_part(vote.id, '-', 3)::int as session,
          count(distinct vote.source_sequence)::int as "distinctSequenceCount",
          min(vote.source_sequence)::int as "firstSequence",
          max(vote.source_sequence)::int as "lastSequence",
          count(position.vote_id)::int as positions,
          count(distinct vote.id)::int as votes,
          count(distinct vote.id) filter (where position.vote_id is not null)::int as "votesWithPositions",
          count(distinct vote.id) filter (where vote.source_url is not null and btrim(vote.source_url) <> '')::int
            as "votesWithSourceUrl"
        from legislation.votes vote
        left join legislation.vote_positions position on position.vote_id = vote.id
        where vote.id like 'vote:congress:senate-%'
          and split_part(vote.id, '-', 2)::int between ${payload.startCongress} and ${payload.endCongress}
        group by congress, session
        order by congress, session
      `)
      return {
        ...validateSenateCoverage(result.rows, payload.expectedVotes, payload.startCongress, payload.endCongress),
        rows: result.rows,
        status: "validated" as const
      }
    } finally {
      await pool.end()
    }
  }
})
