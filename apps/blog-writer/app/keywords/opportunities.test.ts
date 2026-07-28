import { describe, expect, it } from "vitest"
import { cluster, detectorContext } from "./fixtures/clusters"
import { rankOpportunities, score } from "./opportunities"
import type { Candidate } from "./types"

function candidate(clusterId: string, detector: string, verdict: Candidate["verdict"] = "new_article"): Candidate {
  return { detector, clusterId, verdict, scope: null, evidence: ["because"] }
}

describe("score", () => {
  it("reports the parts of the total rather than one opaque number", () => {
    const scored = score(candidate("wax", "competitor_gap"), cluster({ clusterId: "wax" }), 2000, new Set())

    expect(scored.components.map((component) => component.name)).toEqual([
      "demand",
      "reachability",
      "proof",
      "relevance",
      "distance"
    ])
    expect(scored.score).toBeCloseTo(scored.components.reduce((total, component) => total + component.value, 0))
  })

  it("ranks a cluster the catalogue matches above an identical one it doesn't", () => {
    const shape = { clusterId: "wax", keywords: ["ski wax", "wax iron"] }
    const relevant = score(candidate("wax", "competitor_gap"), cluster(shape), 2000, new Set(["wax"]))
    const unrelated = score(candidate("wax", "competitor_gap"), cluster(shape), 2000, new Set(["kayak"]))

    expect(relevant.score).toBeGreaterThan(unrelated.score)
  })

  it("discounts a result page whose clicks an AI overview is taking", () => {
    const plain = score(candidate("wax", "competitor_gap"), cluster({ clusterId: "wax" }), 2000, new Set())
    const overview = score(
      candidate("wax", "competitor_gap"),
      cluster({ clusterId: "wax", hasAiOverview: true }),
      2000,
      new Set()
    )

    expect(overview.score).toBeLessThan(plain.score)
    expect(overview.components.at(-1)?.name).toBe("ai_overview")
  })

  it("puts a competitor's article above the provider's reading of the search", () => {
    const proven = score(
      candidate("wax", "competitor_gap"),
      cluster({ clusterId: "wax", hasEditorialProof: true }),
      2000,
      new Set()
    )
    const assumed = score(candidate("wax", "competitor_gap"), cluster({ clusterId: "wax" }), 2000, new Set())

    expect(proven.score).toBeGreaterThan(assumed.score)
  })
})

describe("rankOpportunities", () => {
  const clusters = [
    cluster({ clusterId: "a", demand: 5000 }),
    cluster({ clusterId: "b", demand: 4000 }),
    cluster({ clusterId: "c", demand: 3000 }),
    cluster({ clusterId: "d", demand: 2000 }),
    cluster({ clusterId: "e", demand: 1000 }),
    cluster({ clusterId: "f", demand: 900 })
  ]

  it("takes turns between rules so one of them can't become the whole list", () => {
    const candidates = [
      ...["a", "b", "c", "d", "e"].map((id) => candidate(id, "competitor_gap")),
      candidate("f", "striking_distance", "refresh")
    ]

    const { opportunities } = rankOpportunities(candidates, clusters, detectorContext())

    expect(opportunities[0]?.clusterId).toBe("a")
    expect(opportunities[1]?.detector).toBe("striking_distance")
  })

  it("stops a rule at its cap rather than letting it run on", () => {
    const candidates = ["a", "b", "c", "d", "e", "f"].map((id) => candidate(id, "competitor_gap"))

    const { opportunities } = rankOpportunities(candidates, clusters, detectorContext())

    expect(opportunities).toHaveLength(5)
  })

  it("keeps the suppressed clusters so 'why isn't this here' has an answer", () => {
    const { opportunities, suppressed } = rankOpportunities(
      [candidate("a", "competitor_gap"), candidate("b", "product_page_territory", "no_action")],
      clusters,
      detectorContext()
    )

    expect(opportunities.map((entry) => entry.clusterId)).toEqual(["a"])
    expect(suppressed[0]?.detector).toBe("product_page_territory")
  })

  it("drops a finding whose cluster isn't in the import it was ranked against", () => {
    const { opportunities } = rankOpportunities([candidate("missing", "competitor_gap")], clusters, detectorContext())

    expect(opportunities).toEqual([])
  })

  it("gives a cluster one row however many rules reached it", () => {
    const { opportunities } = rankOpportunities(
      [candidate("a", "competitor_gap"), candidate("a", "answerable_question"), candidate("a", "seasonal_lead_time")],
      clusters,
      detectorContext()
    )

    expect(opportunities).toHaveLength(1)
    expect(opportunities[0]?.supporting.map((finding) => finding.detector)).toHaveLength(2)
  })

  it("lets a rule that says leave it alone talk over one that says write", () => {
    const { opportunities, suppressed } = rankOpportunities(
      [candidate("a", "competitor_gap"), candidate("a", "product_page_territory", "no_action")],
      clusters,
      detectorContext()
    )

    expect(opportunities).toEqual([])
    expect(suppressed[0]?.detector).toBe("product_page_territory")
    expect(suppressed[0]?.supporting[0]?.detector).toBe("competitor_gap")
  })
})
