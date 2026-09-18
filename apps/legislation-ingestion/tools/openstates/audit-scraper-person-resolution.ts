import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { Command } from "commander"
import { sql } from "drizzle-orm"
import { z } from "zod"
import {
  createScraperPersonResolver,
  loadScraperPersonCandidates
} from "../../src/ingestion/openstates/scraper-person-resolution.js"
import { scraperVoteChamberFromEvidence } from "../../src/ingestion/openstates/scraper-vote-chamber.js"

const command = new Command()
  .argument("<state>")
  .argument("<session>")
  .option("--database-env <name>", "database URL environment variable", "DATABASE_URL")
  .option("--sample <count>", "include deterministic unresolved relationship groups", "0")
  .parse()
const state = z.enum(["ak", "nc"]).parse(command.args[0])
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(command.args[1])
const options = command.opts<{ databaseEnv: string; sample: string }>()
const sampleLimit = z.coerce.number().int().min(0).max(20).parse(options.sample)
const databaseUrl = z.string().url().parse(process.env[options.databaseEnv])
const jurisdictionId = `jurisdiction:${state}`
const sessionId = `session:${state}:${session}`

const { pool } = createDatabase(
  { connectionTimeoutMs: 10_000, idleTimeoutMs: 10_000, maxConnections: 1, url: databaseUrl },
  { statementTimeoutMs: 30_000 }
)

try {
  const report = await withReadOnlyDatabase(pool, 30_000, async (transaction) => {
    const candidates = await loadScraperPersonCandidates(transaction, jurisdictionId)
    const resolvePerson = createScraperPersonResolver(candidates)
    const sessionRows = await transaction.execute<{ end_date: string | null; start_date: string | null }>(sql`
      select end_date, start_date
      from legislation.legislative_sessions
      where id = ${sessionId} and jurisdiction_id = ${jurisdictionId}
    `)
    if (sessionRows.rows.length !== 1) throw new Error("Canonical state session was not found")
    const sessionRow = sessionRows.rows[0]!
    const sponsorRows = await transaction.execute<{
      chamber: string | null
      observed_date: string | null
      name: string
      uses: number
    }>(sql`
      select bill.chamber, first_action.observed_date::text, sponsor.name, count(*)::int as uses
      from legislation.bills bill
      join legislation.bill_sponsors sponsor on sponsor.bill_id = bill.id
      left join lateral (
        select min(coalesce(action.action_date, action.action_at::date)) as observed_date
        from legislation.bill_actions action
        where action.bill_id = bill.id
      ) first_action on true
      where bill.session_id = ${sessionId} and sponsor.person_id is null
      group by bill.chamber, first_action.observed_date, sponsor.name
      order by bill.chamber, sponsor.name, observed_date
    `)
    const positionRows = await transaction.execute<{
      name: string | null
      motion: string
      observed_date: string | null
      position_count: number
      source_url: string | null
      uses: number
    }>(sql`
      select vote.source_url, vote.motion, totals.position_count, position.source_name as name,
        coalesce(vote.held_date, vote.held_at::date)::text as observed_date,
        count(*)::int as uses
      from legislation.bills bill
      join legislation.votes vote on vote.bill_id = bill.id
      join legislation.vote_positions position on position.vote_id = vote.id
      join lateral (
        select count(*)::int as position_count
        from legislation.vote_positions sibling
        where sibling.vote_id = vote.id
      ) totals on true
      where bill.session_id = ${sessionId} and position.person_id is null
      group by vote.id, vote.source_url, vote.motion, totals.position_count, position.source_name,
        coalesce(vote.held_date, vote.held_at::date)
      order by vote.source_url, position.source_name, observed_date
    `)
    const blank = () => ({
      ambiguous: 0,
      groups: 0,
      missingChamberEvidence: 0,
      missingName: 0,
      notFound: 0,
      resolved: 0,
      total: 0
    })
    const sponsors = blank()
    for (const row of sponsorRows.rows) {
      sponsors.groups += 1
      sponsors.total += row.uses
      if (row.chamber !== "lower" && row.chamber !== "upper" && row.chamber !== "unicameral") {
        sponsors.notFound += row.uses
        continue
      }
      const result = resolvePerson({
        allowChamberHistoryFallback: true,
        chamber: row.chamber,
        name: row.name,
        observedDate: row.observed_date ?? undefined,
        sessionEndDate: sessionRow.end_date ?? undefined,
        sessionStartDate: sessionRow.start_date ?? undefined
      })
      if (result.status === "resolved") sponsors.resolved += row.uses
      else if (result.status === "ambiguous") sponsors.ambiguous += row.uses
      else sponsors.notFound += row.uses
    }
    const positions = blank()
    const unresolvedPositionSamples: Array<{
      name: string | null
      reason: "ambiguous" | "missing_chamber_evidence" | "missing_name" | "not_found"
      sourceUrl: string | null
      uses: number
    }> = []
    for (const row of positionRows.rows) {
      positions.groups += 1
      positions.total += row.uses
      const voteChamber = scraperVoteChamberFromEvidence({
        motion: row.motion,
        positionCount: row.position_count,
        session,
        sourceUrl: row.source_url,
        state
      })
      if (row.name === null) {
        positions.missingName += row.uses
        positions.notFound += row.uses
        if (unresolvedPositionSamples.length < sampleLimit) {
          unresolvedPositionSamples.push({
            name: row.name,
            reason: "missing_name",
            sourceUrl: row.source_url,
            uses: row.uses
          })
        }
        continue
      }
      if (voteChamber === undefined) {
        positions.missingChamberEvidence += row.uses
        positions.notFound += row.uses
        if (unresolvedPositionSamples.length < sampleLimit) {
          unresolvedPositionSamples.push({
            name: row.name,
            reason: "missing_chamber_evidence",
            sourceUrl: row.source_url,
            uses: row.uses
          })
        }
        continue
      }
      const result = resolvePerson({
        allowChamberHistoryFallback: true,
        chamber: voteChamber,
        name: row.name,
        observedDate: row.observed_date ?? undefined,
        sessionEndDate: sessionRow.end_date ?? undefined,
        sessionStartDate: sessionRow.start_date ?? undefined
      })
      if (result.status === "resolved") positions.resolved += row.uses
      else if (result.status === "ambiguous") {
        positions.ambiguous += row.uses
        if (unresolvedPositionSamples.length < sampleLimit) {
          unresolvedPositionSamples.push({
            name: row.name,
            reason: "ambiguous",
            sourceUrl: row.source_url,
            uses: row.uses
          })
        }
      } else {
        positions.notFound += row.uses
        if (unresolvedPositionSamples.length < sampleLimit) {
          unresolvedPositionSamples.push({
            name: row.name,
            reason: "not_found",
            sourceUrl: row.source_url,
            uses: row.uses
          })
        }
      }
    }
    return {
      candidates: candidates.length,
      jurisdictionId,
      positions,
      productionWrites: false,
      sessionId,
      sponsors,
      ...(sampleLimit === 0 ? {} : { unresolvedPositionSamples })
    }
  })
  process.stdout.write(`${JSON.stringify(report)}\n`)
} finally {
  await pool.end()
}
