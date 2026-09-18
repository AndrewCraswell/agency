import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { sql } from "drizzle-orm"
import { z } from "zod"

const stateSchema = z.enum(["ak", "nc"])
const sessionSchema = z.string().regex(/^[A-Za-z0-9-]+$/)

const rowSchema = z.object({
  absent_count: z.coerce.number().int().nonnegative(),
  abstain_count: z.coerce.number().int().nonnegative(),
  has_occurrence: z.boolean(),
  has_source_evidence: z.boolean(),
  id: z.string().min(1),
  no_count: z.coerce.number().int().nonnegative(),
  not_voting_count: z.coerce.number().int().nonnegative(),
  other_count: z.coerce.number().int().nonnegative(),
  paired_count: z.coerce.number().int().nonnegative(),
  position_count: z.coerce.number().int().nonnegative(),
  present_count: z.coerce.number().int().nonnegative(),
  proxy_count: z.coerce.number().int().nonnegative(),
  result: z.string().nullable(),
  source_no_count: z.number().int().nonnegative().nullable(),
  source_yes_count: z.number().int().nonnegative().nullable(),
  supported_options: z.boolean(),
  yes_count: z.coerce.number().int().nonnegative()
})

export type ScraperVoteCompletenessInput = z.infer<typeof rowSchema>

export interface ScraperVoteCompletenessPlan {
  jurisdictionId: string
  rejected: Readonly<Record<string, number>>
  rows: readonly {
    absentCount: number
    abstainCount: number
    id: string
    noCount: number
    notVotingCount: number
    otherCount: number
    pairedCount: number
    presentCount: number
    proxyCount: number
    result: "failed" | "other" | "passed"
    yesCount: number
  }[]
  scanned: number
  session: string
  sessionId: string
  state: "ak" | "nc"
}

function increment(rejected: Record<string, number>, reason: string) {
  rejected[reason] = (rejected[reason] ?? 0) + 1
}

export function planScraperVoteCompletenessRows(
  rawRows: readonly ScraperVoteCompletenessInput[],
  state: "ak" | "nc",
  session: string
): ScraperVoteCompletenessPlan {
  const rejected: Record<string, number> = {}
  const rows: ScraperVoteCompletenessPlan["rows"][number][] = []
  for (const rawRow of rawRows) {
    const row = rowSchema.parse(rawRow)
    if (!row.has_occurrence || !row.has_source_evidence) {
      increment(rejected, "missing-source-evidence")
      continue
    }
    if (!row.supported_options || row.position_count === 0) {
      increment(rejected, "unsupported-or-empty-positions")
      continue
    }
    if (row.source_yes_count === null || row.source_no_count === null) {
      increment(rejected, "missing-source-tally")
      continue
    }
    if (row.source_yes_count !== row.yes_count || row.source_no_count !== row.no_count) {
      increment(rejected, "source-position-tally-mismatch")
      continue
    }
    const total =
      row.yes_count +
      row.no_count +
      row.absent_count +
      row.abstain_count +
      row.not_voting_count +
      row.present_count +
      row.proxy_count +
      row.paired_count +
      row.other_count
    if (total !== row.position_count) {
      increment(rejected, "position-count-mismatch")
      continue
    }
    const result =
      row.result === "passed" || row.result === "pass"
        ? "passed"
        : row.result === "failed" || row.result === "fail"
          ? "failed"
          : "other"
    rows.push({
      absentCount: row.absent_count,
      abstainCount: row.abstain_count,
      id: row.id,
      noCount: row.no_count,
      notVotingCount: row.not_voting_count,
      otherCount: row.other_count,
      pairedCount: row.paired_count,
      presentCount: row.present_count,
      proxyCount: row.proxy_count,
      result,
      yesCount: row.yes_count
    })
  }
  rows.sort((left, right) => left.id.localeCompare(right.id))
  return {
    jurisdictionId: `jurisdiction:${state}`,
    rejected,
    rows,
    scanned: rawRows.length,
    sessionId: `session:${state}:${session}`,
    state,
    session
  }
}

export async function buildScraperVoteCompletenessPlan(
  database: LegislationDatabase,
  rawState: string,
  rawSession: string
) {
  const state = stateSchema.parse(rawState)
  const session = sessionSchema.parse(rawSession)
  const sessionId = `session:${state}:${session}`
  const result = await database.execute<ScraperVoteCompletenessInput>(sql`
    with scoped_votes as materialized (
      select vote.*
      from legislation.votes vote
      join legislation.bills bill on bill.id = vote.bill_id
      where bill.session_id = ${sessionId}
        and not vote.timeline_complete
        and vote.source_provider = 'openstates'
    ), position_counts as materialized (
      select position.vote_id,
        count(*)::int as position_count,
        count(*) filter (where position.option = 'yes')::int as yes_count,
        count(*) filter (where position.option = 'no')::int as no_count,
        count(*) filter (where position.option = 'absent')::int as absent_count,
        count(*) filter (where position.option = 'abstain')::int as abstain_count,
        count(*) filter (where position.option = 'not-voting')::int as not_voting_count,
        count(*) filter (where position.option = 'present')::int as present_count,
        count(*) filter (where position.option = 'proxy')::int as proxy_count,
        count(*) filter (where position.option = 'paired')::int as paired_count,
        count(*) filter (where position.option = 'other')::int as other_count,
        bool_and(position.option in ('yes','no','absent','abstain','not-voting','present','proxy','paired','other')) as supported_options
      from legislation.vote_positions position
      join scoped_votes vote on vote.id = position.vote_id
      group by position.vote_id
    )
    select vote.id, vote.result,
      vote.yes_count as source_yes_count, vote.no_count as source_no_count,
      coalesce(position.position_count, 0)::int as position_count,
      coalesce(position.yes_count, 0)::int as yes_count,
      coalesce(position.no_count, 0)::int as no_count,
      coalesce(position.absent_count, 0)::int as absent_count,
      coalesce(position.abstain_count, 0)::int as abstain_count,
      coalesce(position.not_voting_count, 0)::int as not_voting_count,
      coalesce(position.present_count, 0)::int as present_count,
      coalesce(position.proxy_count, 0)::int as proxy_count,
      coalesce(position.paired_count, 0)::int as paired_count,
      coalesce(position.other_count, 0)::int as other_count,
      coalesce(position.supported_options, false) as supported_options,
      (vote.held_at is not null or vote.held_date is not null) as has_occurrence,
      (vote.source_url ~ '^https://' and vote.source_provider = 'openstates'
        and vote.source_retrieved_at is not null and vote.source_is_official is not null
        and vote.source_sequence is not null) as has_source_evidence
    from scoped_votes vote
    left join position_counts position on position.vote_id = vote.id
    order by vote.id
  `)
  return planScraperVoteCompletenessRows(result.rows, state, session)
}

export function scraperVoteCompletenessPlanSha256(plan: ScraperVoteCompletenessPlan) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

export async function applyScraperVoteCompletenessPlan(
  database: LegislationDatabase,
  plan: ScraperVoteCompletenessPlan
) {
  const updates = plan.rows.map((row) => ({
    absent_count: row.absentCount,
    abstain_count: row.abstainCount,
    id: row.id,
    no_count: row.noCount,
    not_voting_count: row.notVotingCount,
    other_count: row.otherCount,
    paired_count: row.pairedCount,
    present_count: row.presentCount,
    proxy_count: row.proxyCount,
    result: row.result,
    yes_count: row.yesCount
  }))
  const result = await database.execute(sql`
    update legislation.votes target
    set absent_count = planned.absent_count,
      abstain_count = planned.abstain_count,
      no_count = planned.no_count,
      not_voting_count = planned.not_voting_count,
      other_count = planned.other_count,
      paired_count = planned.paired_count,
      present_count = planned.present_count,
      proxy_count = planned.proxy_count,
      result = planned.result,
      timeline_complete = true,
      yes_count = planned.yes_count
    from jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) as planned(
      id text, absent_count int, abstain_count int, no_count int, not_voting_count int,
      other_count int, paired_count int, present_count int, proxy_count int, result text, yes_count int
    )
    where target.id = planned.id and not target.timeline_complete and target.source_provider = 'openstates'
    returning target.id
  `)
  if (result.rows.length !== plan.rows.length) {
    throw new Error("Scraper vote completeness changed while applying the reviewed plan")
  }
  return result.rows.length
}
