import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { normalizeRankedKeywords } from "./normalize"

function item(overrides: {
  keyword: string
  rankAbsolute: number
  previousRankAbsolute?: number
  difficulty?: number
  searchVolume?: number
}) {
  return {
    keyword_data: {
      keyword: overrides.keyword,
      keyword_info: {
        search_volume: overrides.searchVolume ?? 3600,
        monthly_searches: [{ year: 2026, month: 6, search_volume: 3600 }],
        last_updated_time: "2026-05-13 07:29:38 +00:00"
      },
      keyword_properties: overrides.difficulty === undefined ? {} : { keyword_difficulty: overrides.difficulty },
      serp_info: {
        serp_item_types: ["organic", "people_also_ask"],
        se_results_count: 128_000,
        last_updated_time: "2026-03-02 11:04:12 +00:00"
      },
      avg_backlinks_info: { main_domain_rank: 412, last_updated_time: "2026-03-02 11:04:12 +00:00" },
      search_intent_info: {
        main_intent: "transactional",
        foreign_intent: ["commercial"],
        last_updated_time: "2026-04-01 00:00:00 +00:00"
      }
    },
    ranked_serp_element: {
      serp_item: {
        domain: "example.com",
        url: `https://example.com/${overrides.keyword.replaceAll(" ", "-")}`,
        rank_absolute: overrides.rankAbsolute,
        rank_group: overrides.rankAbsolute,
        etv: 12.5,
        rank_info: { main_domain_rank: 91 },
        rank_changes:
          overrides.previousRankAbsolute === undefined
            ? { previous_rank_absolute: null }
            : { previous_rank_absolute: overrides.previousRankAbsolute }
      }
    }
  }
}

describe("normalizeRankedKeywords", () => {
  it("keeps the position the provider last saw, so decay is measurable on a first import", () => {
    const { observations } = normalizeRankedKeywords(
      {
        target: "example.com",
        total_count: 3595,
        items: [item({ keyword: "equipment for fencing", rankAbsolute: 31, previousRankAbsolute: 15 })]
      },
      "example.com"
    )

    expect(observations[0]).toMatchObject({
      keyword: "equipment for fencing",
      rankAbsolute: 31,
      previousRankAbsolute: 15
    })
  })

  it("records a missing difficulty as unknown rather than as zero", () => {
    const { observations } = normalizeRankedKeywords(
      { target: "example.com", items: [item({ keyword: "fencing jacket", rankAbsolute: 47 })] },
      "example.com"
    )

    expect(observations[0]?.difficulty).toBeNull()
    expect(observations[0]?.serpAverageDomainRank).toBe(412)
  })

  it("reads the domain's own authority once, because it is a property of the domain", () => {
    const normalized = normalizeRankedKeywords(
      {
        target: "example.com",
        total_count: 3595,
        items: [item({ keyword: "epee", rankAbsolute: 85 }), item({ keyword: "epees", rankAbsolute: 36 })]
      },
      "example.com"
    )

    expect(normalized.domainRank).toBe(91)
    expect(normalized.availableRowCount).toBe(3595)
    expect(normalized.observations).toHaveLength(2)
  })

  it("keeps the better position when the provider repeats a keyword", () => {
    const { observations } = normalizeRankedKeywords(
      {
        target: "example.com",
        items: [
          item({ keyword: "fencing gear", rankAbsolute: 34 }),
          item({ keyword: "fencing gear", rankAbsolute: 13 })
        ]
      },
      "example.com"
    )

    expect(observations).toHaveLength(1)
    expect(observations[0]?.rankAbsolute).toBe(13)
  })

  it("drops rows with no position, because an observation is a claim about a placement", () => {
    const { observations } = normalizeRankedKeywords(
      {
        target: "example.com",
        items: [{ keyword_data: { keyword: "unranked term" }, ranked_serp_element: null }]
      },
      "example.com"
    )

    expect(observations).toEqual([])
  })

  it("stamps each field group with its own freshness, because they differ by months", () => {
    const { observations } = normalizeRankedKeywords(
      { target: "example.com", items: [item({ keyword: "fencing club", rankAbsolute: 4 })] },
      "example.com"
    )

    expect(observations[0]?.fieldFreshness).toEqual({
      demand: "2026-05-13 07:29:38 +00:00",
      results: "2026-03-02 11:04:12 +00:00",
      authority: "2026-03-02 11:04:12 +00:00",
      intent: "2026-04-01 00:00:00 +00:00"
    })
  })

  it("accepts a response the provider actually returned", () => {
    const fixture: unknown = JSON.parse(readFileSync("app/keywords/fixtures/ranked-keywords.json", "utf8"))
    const normalized = normalizeRankedKeywords(fixture, "absolutefencinggear.com")

    expect(normalized.observations).toHaveLength(14)
    expect(normalized.domainRank).toBe(363)
    expect(normalized.availableRowCount).toBe(793)

    // The whole point of buying the volume-ordered slice is that it spans positions rather than collecting the
    // terms the domain already wins, so a fixture that had drifted to a single band would no longer be evidence.
    const positions = normalized.observations.map(({ rankAbsolute }) => rankAbsolute)
    expect(Math.min(...positions)).toBeLessThanOrEqual(2)
    expect(Math.max(...positions)).toBeGreaterThan(30)

    for (const observation of normalized.observations) {
      expect(observation.domain).toBe("absolutefencinggear.com")
      expect(observation.rankingUrl).toMatch(/^https?:\/\//u)
      expect(observation.searchVolume).toBeGreaterThan(0)
    }
  })
})
