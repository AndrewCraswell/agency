import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { upsertBillAggregates } from "../../persistence/bill-aggregates.js"
import { prepareArchivedScraperBillBatch } from "./scraper-normalize.js"
import { resolveScraperAggregatePeople } from "./scraper-person-resolution.js"

/** Short admission lock groups disjoint batches from one frozen inventory; it is not held during extraction. */
export const ncBillPromotionOwnership = { source: "openstates", stream: "ownership:nc-bills:2025" } as const

export function scraperBillPromotionOwnership(scope: { jurisdiction: "nc" | "ak"; session: string }) {
  if (scope.session !== (scope.jurisdiction === "nc" ? "2025" : "34")) {
    throw new Error("Unsupported scraper ownership scope")
  }
  return { source: "openstates", stream: `ownership:${scope.jurisdiction}-bills:${scope.session}` }
}

export function scraperBillBatchOwnership(
  inventoryId: string,
  batchId: string,
  token: string,
  scope: { source: string; stream: string } = ncBillPromotionOwnership
) {
  return {
    source: scope.source,
    stream: `${scope.stream}:${inventoryId}:${batchId}`,
    token
  }
}

/** No extraction, lease acquisition or deployment here: verify retained evidence and atomically promote it. */
export async function promoteArchivedScraperBillBatch(
  database: LegislationDatabase,
  input: Parameters<typeof prepareArchivedScraperBillBatch>[0],
  persist: typeof upsertBillAggregates = upsertBillAggregates,
  resolvePeople: typeof resolveScraperAggregatePeople = resolveScraperAggregatePeople
) {
  const prepared = await prepareArchivedScraperBillBatch(input)
  const aggregates = await resolvePeople(
    database,
    prepared.rows.map((row) => row.aggregate)
  )
  const receipt = {
    source: "openstates",
    stream: `${prepared.scope.jurisdiction}-bills:${prepared.scope.session}:${prepared.provenance.inventoryId}:${prepared.provenance.batchId}`,
    cursor: {
      status: "promoted",
      ...prepared.provenance,
      bills: aggregates.length,
      unresolvedSponsors: aggregates.reduce(
        (sum, aggregate) => sum + (aggregate.sponsors?.filter((sponsor) => !sponsor.personId).length ?? 0),
        0
      ),
      unresolvedPositions: aggregates.reduce(
        (sum, aggregate) =>
          sum +
          (aggregate.votes?.reduce(
            (voteSum, vote) => voteSum + (vote.positions?.filter((position) => !position.personId).length ?? 0),
            0
          ) ?? 0),
        0
      )
    }
  }
  await persist(database, aggregates, {
    ownership: scraperBillBatchOwnership(
      prepared.provenance.inventoryId,
      prepared.provenance.batchId,
      prepared.provenance.runId,
      scraperBillPromotionOwnership(prepared.scope)
    ),
    receipt,
    preserveResolvedLinks: true
  })
  return { status: "promoted" as const, receipt, sessionComplete: false as const }
}
