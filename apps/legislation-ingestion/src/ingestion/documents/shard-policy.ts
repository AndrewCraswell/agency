import { jurisdictionId } from "@repo/legislation-core/domain/identifiers"
import { supportedOpenStatesJurisdictions } from "../openstates/coverage.js"

/**
 * The 64 document lanes reserve one distinct lane for every canonical state,
 * district, territory, and federal jurisdiction presently in the corpus.
 * This keeps a large publisher such as California from sharing a worker with
 * another known jurisdiction. Unknown future jurisdictions use only the
 * remaining lanes, so they cannot collide with the reserved canonical lanes.
 */
export const DOCUMENT_BACKFILL_SHARD_COUNT = 64

/** Canonical jurisdiction IDs with dedicated 64-lane document workers. */
export const documentBackfillCanonicalJurisdictionIds = [
  ...supportedOpenStatesJurisdictions.map((code) => jurisdictionId(code)),
  jurisdictionId("us")
]
export const unknownDocumentBackfillLaneStart = documentBackfillCanonicalJurisdictionIds.length
export const unknownDocumentBackfillLaneCount = DOCUMENT_BACKFILL_SHARD_COUNT - unknownDocumentBackfillLaneStart

if (unknownDocumentBackfillLaneCount < 1) {
  throw new Error("Document backfill lanes must reserve capacity for unknown jurisdictions")
}

const documentBackfillLaneByJurisdictionId = new Map(
  documentBackfillCanonicalJurisdictionIds.map((id, lane) => [id, lane])
)

/**
 * Resolves the deterministic 64-lane assignment used by document backfills.
 * The database selection uses PostgreSQL's hash for unknown values; both
 * paths deliberately constrain unknown jurisdictions to the unreserved range.
 */
export function documentBackfillJurisdictionLane(jurisdiction: string): number {
  const knownLane = documentBackfillLaneByJurisdictionId.get(jurisdiction)
  if (knownLane !== undefined) {
    return knownLane
  }
  return unknownDocumentBackfillLaneStart + (stableStringHash(jurisdiction) % unknownDocumentBackfillLaneCount)
}

function stableStringHash(value: string): number {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2_147_483_647
  }
  return hash
}
