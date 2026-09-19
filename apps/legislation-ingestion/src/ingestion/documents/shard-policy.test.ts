import { describe, expect, it } from "vitest"
import {
  DOCUMENT_BACKFILL_SHARD_COUNT,
  documentBackfillCanonicalJurisdictionIds,
  documentBackfillJurisdictionLane
} from "./shard-policy.js"

describe("document backfill jurisdiction lanes", () => {
  it("reserves a unique lane for every supported canonical jurisdiction", () => {
    const lanes = documentBackfillCanonicalJurisdictionIds.map(documentBackfillJurisdictionLane)

    expect(documentBackfillCanonicalJurisdictionIds).toHaveLength(53)
    expect(new Set(lanes)).toHaveLength(documentBackfillCanonicalJurisdictionIds.length)
    expect(lanes.sort((left, right) => left - right)).toEqual(
      Array.from({ length: documentBackfillCanonicalJurisdictionIds.length }, (_, lane) => lane)
    )
  })

  it("keeps unknown jurisdictions in the unreserved lanes without dropping them", () => {
    const firstUnknownLane = documentBackfillCanonicalJurisdictionIds.length
    const unknownJurisdictions = ["jurisdiction:vi", "jurisdiction:gu", "jurisdiction:future-state"]

    for (const jurisdiction of unknownJurisdictions) {
      const lane = documentBackfillJurisdictionLane(jurisdiction)
      expect(lane).toBeGreaterThanOrEqual(firstUnknownLane)
      expect(lane).toBeLessThan(DOCUMENT_BACKFILL_SHARD_COUNT)
      expect(documentBackfillJurisdictionLane(jurisdiction)).toBe(lane)
    }
  })
})
