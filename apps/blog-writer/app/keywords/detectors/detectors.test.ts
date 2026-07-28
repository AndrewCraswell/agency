import { describe, expect, it } from "vitest"
import { calibration, cluster, detectorContext, flatMonths } from "../fixtures/clusters"
import { adequatelyCovered } from "./adequately-covered"
import { answerableQuestion } from "./answerable-question"
import { cannibalization } from "./cannibalization"
import { competitorGap } from "./competitor-gap"
import { decay } from "./decay"
import { canRun, runDetectors } from "./index"
import { partialCluster } from "./partial-cluster"
import { productPageTerritory } from "./product-page-territory"
import { risingDemand } from "./rising-demand"
import { seasonalLeadTime } from "./seasonal-lead-time"
import { strikingDistance } from "./striking-distance"

describe("strikingDistance", () => {
  it("proposes a refresh for a page that already ranks just off the first page", () => {
    const candidates = strikingDistance.detect(
      [cluster({ clusterId: "wax", ourBestPosition: 14, ourRankingUrls: ["https://shop.example/guides/wax"] })],
      detectorContext()
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.verdict).toBe("refresh")
    expect(candidates[0]?.scope).toContain("https://shop.example/guides/wax")
  })

  it("leaves alone a cluster whose demand is below what this store considers worth writing", () => {
    const candidates = strikingDistance.detect(
      [cluster({ clusterId: "wax", ourBestPosition: 14, demand: 10 })],
      detectorContext({ calibration: calibration({ demandFloor: 500 }) })
    )

    expect(candidates).toEqual([])
  })

  it("says nothing about a cluster an article cannot win", () => {
    expect(
      strikingDistance.detect(
        [cluster({ clusterId: "wax", ourBestPosition: 14, isReachable: false })],
        detectorContext()
      )
    ).toEqual([])
  })
})

describe("competitorGap", () => {
  it("names the competitor holding the position we don't", () => {
    const candidates = competitorGap.detect(
      [
        cluster({
          clusterId: "wax",
          competitorTopTen: [{ domain: "evo.com", keyword: "ski wax", position: 3, url: "https://evo.com/guides/wax" }]
        })
      ],
      detectorContext()
    )

    expect(candidates[0]?.verdict).toBe("new_article")
    expect(candidates[0]?.evidence.join(" ")).toContain("evo.com")
  })

  it("calls two competitors a pattern rather than one store's luck", () => {
    const candidates = competitorGap.detect(
      [
        cluster({
          clusterId: "wax",
          competitorTopTen: [
            { domain: "evo.com", keyword: "ski wax", position: 3, url: "https://evo.com/a" },
            { domain: "zumiez.com", keyword: "ski wax", position: 7, url: "https://zumiez.com/b" }
          ]
        })
      ],
      detectorContext()
    )

    expect(candidates[0]?.evidence.join(" ")).toContain("2 of your competitors")
  })

  it("won't call it a gap while we rank anywhere in it", () => {
    expect(
      competitorGap.detect(
        [
          cluster({
            clusterId: "wax",
            ourBestPosition: 90,
            competitorTopTen: [{ domain: "evo.com", keyword: "ski wax", position: 3, url: "https://evo.com/a" }]
          })
        ],
        detectorContext()
      )
    ).toEqual([])
  })
})

describe("partialCluster", () => {
  it("asks the page that already ranks to cover the term carrying the cluster", () => {
    const candidates = partialCluster.detect(
      [
        cluster({
          clusterId: "wax",
          keywords: ["how to wax skis", "ski wax"],
          headKeyword: "how to wax skis",
          headDemand: 4000,
          keywordDemand: { "how to wax skis": 4000, "ski wax": 200 },
          ourBestKeyword: "ski wax",
          ourBestPosition: 6,
          ourHeadPosition: null,
          ourRankingUrls: ["https://shop.example/guides/wax"]
        })
      ],
      detectorContext()
    )

    expect(candidates[0]?.verdict).toBe("refresh")
    expect(candidates[0]?.scope).toContain("how to wax skis")
  })

  it("doesn't call it partial when the head we're missing is no larger than the term we hold", () => {
    expect(
      partialCluster.detect(
        [
          cluster({
            clusterId: "wax",
            keywords: ["how to wax skis", "ski wax"],
            headKeyword: "how to wax skis",
            headDemand: 1000,
            keywordDemand: { "how to wax skis": 1000, "ski wax": 900 },
            ourBestKeyword: "ski wax",
            ourBestPosition: 6
          })
        ],
        detectorContext()
      )
    ).toEqual([])
  })
})

describe("answerableQuestion", () => {
  it("proposes an article where a question is being asked and answered by someone else", () => {
    const candidates = answerableQuestion.detect(
      [cluster({ clusterId: "epee", questionKeywords: ["what is an epee"], mainIntent: "informational" })],
      detectorContext()
    )

    expect(candidates[0]?.evidence[0]).toContain("what is an epee")
  })

  it("stays quiet once we hold the first page for it", () => {
    expect(
      answerableQuestion.detect(
        [cluster({ clusterId: "epee", questionKeywords: ["what is an epee"], ourBestPosition: 4 })],
        detectorContext()
      )
    ).toEqual([])
  })
})

describe("seasonalLeadTime", () => {
  it("schedules work for a peak that is far enough away to still make", () => {
    const monthly = flatMonths(1000)
    monthly[5] = { year: 2025, month: 6, searchVolume: 4000 }
    const candidates = seasonalLeadTime.detect(
      [cluster({ clusterId: "camping", headMonthlySearches: monthly })],
      detectorContext({ now: new Date("2026-03-01T00:00:00Z") })
    )

    expect(candidates[0]?.verdict).toBe("schedule")
    expect(candidates[0]?.evidence[0]).toContain("June")
  })

  it("won't schedule a peak that is already upon us", () => {
    const monthly = flatMonths(1000)
    monthly[5] = { year: 2025, month: 6, searchVolume: 4000 }

    expect(
      seasonalLeadTime.detect(
        [cluster({ clusterId: "camping", headMonthlySearches: monthly })],
        detectorContext({ now: new Date("2026-05-20T00:00:00Z") })
      )
    ).toEqual([])
  })

  it("won't read a season out of an ordinary year", () => {
    expect(
      seasonalLeadTime.detect(
        [cluster({ clusterId: "camping", headMonthlySearches: flatMonths(1000) })],
        detectorContext({ now: new Date("2026-03-01T00:00:00Z") })
      )
    ).toEqual([])
  })
})

describe("risingDemand", () => {
  const rising = [100, 100, 100, 100, 100, 100, 150, 150, 150, 300, 300, 300].map((searchVolume, index) => ({
    year: 2025,
    month: index + 1,
    searchVolume
  }))

  it("proposes an article on a subject nobody has taken while demand is still climbing", () => {
    const candidates = risingDemand.detect(
      [cluster({ clusterId: "gravel", headMonthlySearches: rising })],
      detectorContext()
    )

    expect(candidates[0]?.verdict).toBe("new_article")
    expect(candidates[0]?.evidence[0]).toContain("%")
  })

  it("leaves a rising subject the competition has already established", () => {
    expect(
      risingDemand.detect(
        [
          cluster({
            clusterId: "gravel",
            headMonthlySearches: rising,
            competitorTopTen: [
              { domain: "evo.com", keyword: "gravel bike", position: 2, url: "https://evo.com/a" },
              { domain: "zumiez.com", keyword: "gravel bike", position: 5, url: "https://zumiez.com/b" }
            ]
          })
        ],
        detectorContext()
      )
    ).toEqual([])
  })

  it("won't call a year that has already turned over a rise", () => {
    const turned = [100, 100, 100, 100, 100, 100, 400, 400, 400, 200, 200, 200].map((searchVolume, index) => ({
      year: 2025,
      month: index + 1,
      searchVolume
    }))

    expect(
      risingDemand.detect([cluster({ clusterId: "gravel", headMonthlySearches: turned })], detectorContext())
    ).toEqual([])
  })
})

describe("decay", () => {
  it("reports a fall in our own position while the term is still being searched for", () => {
    const candidates = decay.detect(
      [
        cluster({
          clusterId: "epees",
          largestOurDecline: { keyword: "equipment for fencing", from: 15, to: 31, demand: 3600 }
        })
      ],
      detectorContext()
    )

    expect(candidates[0]?.verdict).toBe("refresh")
    expect(candidates[0]?.evidence.join(" ")).toContain("provider's last check")
  })

  it("doesn't dress a two-place wobble up as decay", () => {
    expect(
      decay.detect(
        [cluster({ clusterId: "epees", largestOurDecline: { keyword: "epees", from: 15, to: 17, demand: 3600 } })],
        detectorContext()
      )
    ).toEqual([])
  })

  it("stays quiet when the subject shrank rather than our page slipping", () => {
    expect(
      decay.detect(
        [cluster({ clusterId: "epees", largestOurDecline: { keyword: "epees", from: 5, to: 40, demand: 10 } })],
        detectorContext({ calibration: calibration({ demandFloor: 500 }) })
      )
    ).toEqual([])
  })
})

describe("cannibalization", () => {
  it("calls two of our own pages in one cluster a split", () => {
    const candidates = cannibalization.detect(
      [cluster({ clusterId: "wax", ourRankingUrls: ["https://shop.example/a", "https://shop.example/b"] })],
      detectorContext()
    )

    expect(candidates[0]?.verdict).toBe("no_action")
    expect(candidates[0]?.evidence.join(" ")).toContain("splitting")
  })

  it("calls the wrong page ranking a misdirect and asks for retargeting", () => {
    const candidates = cannibalization.detect(
      [cluster({ clusterId: "wax", keywords: ["ski wax"], ourRankingUrls: ["https://shop.example/other"] })],
      detectorContext({
        articleTargets: [{ keyword: "ski wax", articleId: "article-1", url: "https://shop.example/intended" }]
      })
    )

    expect(candidates[0]?.evidence.join(" ")).toContain("Retarget")
  })

  it("says nothing when the page that ranks is the page we aimed", () => {
    expect(
      cannibalization.detect(
        [cluster({ clusterId: "wax", keywords: ["ski wax"], ourRankingUrls: ["https://shop.example/intended"] })],
        detectorContext({
          articleTargets: [{ keyword: "ski wax", articleId: "article-1", url: "https://shop.example/intended" }]
        })
      )
    ).toEqual([])
  })
})

describe("productPageTerritory", () => {
  it("declines to propose an article against a shelf", () => {
    const candidates = productPageTerritory.detect(
      [cluster({ clusterId: "boots", mainIntent: "transactional", hasProductBlocks: true, isReachable: false })],
      detectorContext()
    )

    expect(candidates[0]?.verdict).toBe("no_action")
  })

  it("keeps a transactional term that also reads as informational open to an article", () => {
    expect(
      productPageTerritory.detect(
        [
          cluster({
            clusterId: "boots",
            mainIntent: "transactional",
            intents: ["informational"],
            hasProductBlocks: true
          })
        ],
        detectorContext()
      )
    ).toEqual([])
  })

  it("defers to a competitor who won the same page with an article", () => {
    expect(
      productPageTerritory.detect(
        [
          cluster({
            clusterId: "boots",
            mainIntent: "transactional",
            hasProductBlocks: true,
            hasEditorialProof: true
          })
        ],
        detectorContext()
      )
    ).toEqual([])
  })
})

describe("adequatelyCovered", () => {
  it("suppresses a cluster we already hold with the article written for it", () => {
    const candidates = adequatelyCovered.detect(
      [cluster({ clusterId: "wax", keywords: ["ski wax"], ourBestPosition: 3, ourBestKeyword: "ski wax" })],
      detectorContext({ articleTargets: [{ keyword: "ski wax", articleId: "article-1", url: null }] })
    )

    expect(candidates[0]?.verdict).toBe("no_action")
  })

  it("leaves an accidental win alone, because holding it by chance isn't the same as covering it", () => {
    expect(
      adequatelyCovered.detect(
        [cluster({ clusterId: "wax", keywords: ["ski wax"], ourBestPosition: 3 })],
        detectorContext()
      )
    ).toEqual([])
  })
})

describe("runDetectors", () => {
  it("runs every rule whose evidence this store can supply", () => {
    const candidates = runDetectors(
      [cluster({ clusterId: "wax", ourBestPosition: 14, ourRankingUrls: ["https://shop.example/wax"] })],
      detectorContext()
    )

    expect(candidates.map((candidate) => candidate.detector)).toContain("striking_distance")
  })

  it("skips a rule rather than guessing the authority it argues from", () => {
    expect(
      canRun(
        { name: "weak_hold", verdict: "refresh", requiresAuthority: true, detect: () => [] },
        calibration({ wonAuthorityCeiling: null, authorityConfidence: "none" })
      )
    ).toBe(false)
  })
})
