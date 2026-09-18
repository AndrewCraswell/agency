import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { Command } from "commander"
import { sql } from "drizzle-orm"
import { z } from "zod"
import {
  createScraperPersonResolver,
  loadScraperPersonCandidates
} from "../../src/ingestion/openstates/scraper-person-resolution.js"

const command = new Command()
  .argument("<state>")
  .argument("<session>")
  .option("--database-env <name>", "database URL environment variable", "DATABASE_URL")
  .parse()
const state = z.enum(["ak", "nc"]).parse(command.args[0])
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(command.args[1])
const options = command.opts<{ databaseEnv: string }>()
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
      chamber: string | null
      name: string | null
      observed_date: string | null
      uses: number
    }>(sql`
      select bill.chamber, position.source_name as name,
        coalesce(vote.held_date, vote.held_at::date)::text as observed_date,
        count(*)::int as uses
      from legislation.bills bill
      join legislation.votes vote on vote.bill_id = bill.id
      join legislation.vote_positions position on position.vote_id = vote.id
      where bill.session_id = ${sessionId} and position.person_id is null
      group by bill.chamber, position.source_name, coalesce(vote.held_date, vote.held_at::date)
      order by bill.chamber, position.source_name, observed_date
    `)
    const blank = () => ({ ambiguous: 0, groups: 0, notFound: 0, resolved: 0, total: 0 })
    const sponsors = blank()
    for (const row of sponsorRows.rows) {
      sponsors.groups += 1
      sponsors.total += row.uses
      if (row.chamber !== "lower" && row.chamber !== "upper" && row.chamber !== "unicameral") {
        sponsors.notFound += row.uses
        continue
      }
      const result = resolvePerson({
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
    for (const row of positionRows.rows) {
      positions.groups += 1
      positions.total += row.uses
      if (row.name === null || (row.chamber !== "lower" && row.chamber !== "upper" && row.chamber !== "unicameral")) {
        positions.notFound += row.uses
        continue
      }
      const result = resolvePerson({
        chamber: row.chamber,
        name: row.name,
        observedDate: row.observed_date ?? undefined,
        sessionEndDate: sessionRow.end_date ?? undefined,
        sessionStartDate: sessionRow.start_date ?? undefined
      })
      if (result.status === "resolved") positions.resolved += row.uses
      else if (result.status === "ambiguous") positions.ambiguous += row.uses
      else positions.notFound += row.uses
    }
    return { candidates: candidates.length, jurisdictionId, positions, productionWrites: false, sessionId, sponsors }
  })
  process.stdout.write(`${JSON.stringify(report)}\n`)
} finally {
  await pool.end()
}
