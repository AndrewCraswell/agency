import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { createScraperPersonResolver, loadScraperPersonCandidates } from "./scraper-person-resolution.js"
import { scraperVoteChamberFromEvidence } from "./scraper-vote-chamber.js"

const stateSchema = z.enum(["ak", "nc"])
const sessionSchema = z.string().regex(/^[A-Za-z0-9-]+$/)
type Chamber = "legislature" | "lower" | "upper" | "unicameral"

interface ResolutionCounts {
  ambiguous: number
  notFound: number
  planned: number
  total: number
}

export interface ScraperPersonBackfillPlan {
  jurisdictionId: string
  positions: readonly {
    personId: string
    sourceIdentity: string
    sourceName: string
    sourcePersonId: string
    voteId: string
  }[]
  sessionId: string
  sponsors: readonly {
    billId: string
    classification: string
    id: string
    personId: string
    sourceName: string
    sourcePersonId: string
  }[]
  state: "ak" | "nc"
  session: string
  summary: {
    candidates: number
    positions: ResolutionCounts
    sponsorConflicts: number
    sponsors: ResolutionCounts
  }
}

function chamber(value: string | null): Chamber | undefined {
  return value === "lower" || value === "upper" || value === "unicameral" ? value : undefined
}

function emptyCounts(): ResolutionCounts {
  return { ambiguous: 0, notFound: 0, planned: 0, total: 0 }
}

function sponsorKey(value: { billId: string; classification: string; personId: string }) {
  return JSON.stringify([value.billId, value.personId, value.classification])
}

/** The digest covers only stable source-derived decisions, never timestamps or database execution metadata. */
export function scraperPersonBackfillPlanSha256(plan: ScraperPersonBackfillPlan) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

/** Build a deterministic null-only update plan; ambiguous identities and sponsor uniqueness conflicts remain unresolved. */
export async function buildScraperPersonBackfillPlan(
  database: LegislationDatabase,
  rawState: string,
  rawSession: string
): Promise<ScraperPersonBackfillPlan> {
  const state = stateSchema.parse(rawState)
  const session = sessionSchema.parse(rawSession)
  const jurisdictionId = `jurisdiction:${state}`
  const sessionId = `session:${state}:${session}`
  const candidates = await loadScraperPersonCandidates(database, jurisdictionId)
  const resolvePerson = createScraperPersonResolver(candidates)
  const sessionRows = await database.execute<{ end_date: string | null; start_date: string | null }>(sql`
    select end_date, start_date
    from legislation.legislative_sessions
    where id = ${sessionId} and jurisdiction_id = ${jurisdictionId}
  `)
  if (sessionRows.rows.length !== 1) throw new Error("Canonical state session was not found")
  const sessionRow = sessionRows.rows[0]!
  const sponsorRows = await database.execute<{
    bill_id: string
    chamber: string | null
    classification: string
    id: string
    name: string
    observed_date: string | null
  }>(sql`
    with session_bills as materialized (
      select id, chamber from legislation.bills where session_id = ${sessionId}
    ), first_actions as (
      select action.bill_id, min(coalesce(action.action_date, action.action_at::date)) as observed_date
      from legislation.bill_actions action
      join session_bills bill on bill.id = action.bill_id
      group by action.bill_id
    )
    select sponsor.id, sponsor.bill_id, bill.chamber, sponsor.classification, sponsor.name,
      first_action.observed_date::text
    from session_bills bill
    join legislation.bill_sponsors sponsor on sponsor.bill_id = bill.id
    left join first_actions first_action on first_action.bill_id = bill.id
    where sponsor.person_id is null
    order by sponsor.id
  `)
  const positionRows = await database.execute<{
    name: string | null
    motion: string
    observed_date: string | null
    position_count: number
    source_identity: string
    source_url: string | null
    vote_id: string
  }>(sql`
    select position.vote_id, position.source_identity, vote.source_url, vote.motion,
      totals.position_count, position.source_name as name,
      coalesce(vote.held_date, vote.held_at::date)::text as observed_date
    from legislation.bills bill
    join legislation.votes vote on vote.bill_id = bill.id
    join legislation.vote_positions position on position.vote_id = vote.id
    join lateral (
      select count(*)::int as position_count
      from legislation.vote_positions sibling
      where sibling.vote_id = vote.id
    ) totals on true
    where bill.session_id = ${sessionId} and position.person_id is null
    order by position.vote_id, position.source_identity
  `)
  const linkedSponsorRows = await database.execute<{ bill_id: string; classification: string; person_id: string }>(sql`
    select sponsor.bill_id, sponsor.classification, sponsor.person_id
    from legislation.bills bill
    join legislation.bill_sponsors sponsor on sponsor.bill_id = bill.id
    where bill.session_id = ${sessionId} and sponsor.person_id is not null
  `)
  const context = {
    allowChamberHistoryFallback: true,
    sessionEndDate: sessionRow.end_date ?? undefined,
    sessionStartDate: sessionRow.start_date ?? undefined
  }
  const positionCounts = emptyCounts()
  const positions: ScraperPersonBackfillPlan["positions"][number][] = []
  for (const row of positionRows.rows) {
    positionCounts.total += 1
    const rowChamber = scraperVoteChamberFromEvidence({
      motion: row.motion,
      positionCount: row.position_count,
      session,
      sourceUrl: row.source_url,
      state
    })
    if (rowChamber === undefined || row.name === null) {
      positionCounts.notFound += 1
      continue
    }
    const result = resolvePerson({
      ...context,
      chamber: rowChamber,
      name: row.name,
      observedDate: row.observed_date ?? undefined
    })
    if (result.status === "resolved") {
      positions.push({
        personId: result.personId,
        sourceIdentity: row.source_identity,
        sourceName: row.name,
        sourcePersonId: result.sourcePersonId,
        voteId: row.vote_id
      })
      positionCounts.planned += 1
    } else if (result.status === "ambiguous") positionCounts.ambiguous += 1
    else positionCounts.notFound += 1
  }
  const sponsorCounts = emptyCounts()
  const candidateSponsors: ScraperPersonBackfillPlan["sponsors"][number][] = []
  for (const row of sponsorRows.rows) {
    sponsorCounts.total += 1
    const rowChamber = chamber(row.chamber)
    if (rowChamber === undefined) {
      sponsorCounts.notFound += 1
      continue
    }
    const result = resolvePerson({
      ...context,
      allowUniqueCrossChamberFallback: true,
      chamber: rowChamber,
      name: row.name,
      observedDate: row.observed_date ?? undefined
    })
    if (result.status === "resolved") {
      candidateSponsors.push({
        billId: row.bill_id,
        classification: row.classification,
        id: row.id,
        personId: result.personId,
        sourceName: row.name,
        sourcePersonId: result.sourcePersonId
      })
    } else if (result.status === "ambiguous") sponsorCounts.ambiguous += 1
    else sponsorCounts.notFound += 1
  }
  const existingSponsorKeys = new Set(
    linkedSponsorRows.rows.map((row) =>
      sponsorKey({ billId: row.bill_id, classification: row.classification, personId: row.person_id })
    )
  )
  const candidateCounts = new Map<string, number>()
  for (const candidate of candidateSponsors) {
    const key = sponsorKey(candidate)
    candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1)
  }
  const sponsors = candidateSponsors.filter((candidate) => {
    const key = sponsorKey(candidate)
    return !existingSponsorKeys.has(key) && candidateCounts.get(key) === 1
  })
  const sponsorConflicts = candidateSponsors.length - sponsors.length
  sponsorCounts.planned = sponsors.length
  return {
    jurisdictionId,
    positions,
    sessionId,
    sponsors,
    state,
    session,
    summary: { candidates: candidates.length, positions: positionCounts, sponsorConflicts, sponsors: sponsorCounts }
  }
}

/** Apply only the exact reviewed plan and fail if any target gained a person concurrently. */
export async function applyScraperPersonBackfillPlan(database: LegislationDatabase, plan: ScraperPersonBackfillPlan) {
  const positionRows = plan.positions.map((row) => ({
    person_id: row.personId,
    source_identity: row.sourceIdentity,
    vote_id: row.voteId
  }))
  const sponsorRows = plan.sponsors.map((row) => ({ id: row.id, person_id: row.personId }))
  const positions = await database.execute(sql`
    update legislation.vote_positions target
    set person_id = planned.person_id
    from jsonb_to_recordset(${JSON.stringify(positionRows)}::jsonb)
      as planned(vote_id text, source_identity text, person_id text)
    where target.vote_id = planned.vote_id
      and target.source_identity = planned.source_identity
      and target.person_id is null
    returning target.vote_id
  `)
  const sponsors = await database.execute(sql`
    update legislation.bill_sponsors target
    set person_id = planned.person_id
    from jsonb_to_recordset(${JSON.stringify(sponsorRows)}::jsonb) as planned(id text, person_id text)
    where target.id = planned.id and target.person_id is null
    returning target.id
  `)
  if (positions.rows.length !== plan.positions.length || sponsors.rows.length !== plan.sponsors.length) {
    throw new Error("Scraper person relationship changed while applying the reviewed plan")
  }
  return { positions: positions.rows.length, sponsors: sponsors.rows.length }
}
