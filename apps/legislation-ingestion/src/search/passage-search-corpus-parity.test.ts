import { describe, expect, it } from "vitest"
import { comparePassageCorpusBuckets } from "./passage-search-corpus-parity.js"

describe("passage search corpus parity", () => {
  it("accepts equal bucketed corpora", () => {
    const buckets = [
      { bucket: 1, checksum: "42", documents: "2", rows: "5" },
      { bucket: 7, checksum: "-9", documents: "1", rows: "3" }
    ]
    expect(comparePassageCorpusBuckets("jurisdiction", "Alaska", buckets, buckets)).toMatchObject({
      matches: true,
      mismatchedBuckets: [],
      source: { documents: 3, rows: 8 },
      target: { documents: 3, rows: 8 }
    })
  })

  it("identifies missing and stale buckets", () => {
    const result = comparePassageCorpusBuckets(
      "jurisdiction",
      "North Carolina",
      [
        { bucket: 1, checksum: "42", documents: "2", rows: "5" },
        { bucket: 7, checksum: "9", documents: "1", rows: "3" }
      ],
      [
        { bucket: 1, checksum: "41", documents: "2", rows: "5" },
        { bucket: 8, checksum: "9", documents: "1", rows: "3" }
      ]
    )
    expect(result.matches).toBe(false)
    expect(result.mismatchedBuckets).toEqual([1, 7, 8])
  })
})
