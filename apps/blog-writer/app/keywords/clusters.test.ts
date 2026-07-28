import { describe, expect, it } from "vitest"
import { buildClusters, fingerprintKeywords, isEditorialUrl, isQuestion, positionOf } from "./clusters"
import { observation } from "./fixtures/observations"

describe("buildClusters", () => {
  it("groups the terms one competitor page was measured holding", () => {
    const clusters = buildClusters([
      observation({
        keyword: "ski wax guide",
        domain: "evo.com",
        rankingUrl: "https://evo.com/guides/ski-wax",
        searchVolume: 900
      }),
      observation({
        keyword: "how to wax skis",
        domain: "evo.com",
        rankingUrl: "https://evo.com/guides/ski-wax",
        searchVolume: 2400
      })
    ])

    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.keywords).toEqual(["how to wax skis", "ski wax guide"])
    expect(clusters[0]?.headKeyword).toBe("how to wax skis")
    expect(clusters[0]?.headDemand).toBe(2400)
    expect(clusters[0]?.demand).toBe(3300)
    expect(clusters[0]?.proofUrls).toEqual(["https://evo.com/guides/ski-wax"])
  })

  it("drops a term no page holds alongside another unless we rank for it", () => {
    const clusters = buildClusters([
      observation({ keyword: "orphan term", domain: "evo.com", rankingUrl: "https://evo.com/a" }),
      observation({ keyword: "our orphan term", domain: "shop.example", isOwnDomain: true, rankingUrl: null })
    ])

    expect(clusters.map((cluster) => cluster.headKeyword)).toEqual(["our orphan term"])
  })

  it("merges the groups of two competitors that share a term", () => {
    const clusters = buildClusters([
      observation({ keyword: "ski wax", domain: "evo.com", rankingUrl: "https://evo.com/guides/wax" }),
      observation({ keyword: "hot wax skis", domain: "evo.com", rankingUrl: "https://evo.com/guides/wax" }),
      observation({ keyword: "ski wax", domain: "zumiez.com", rankingUrl: "https://zumiez.com/blog/wax" }),
      observation({ keyword: "wax iron", domain: "zumiez.com", rankingUrl: "https://zumiez.com/blog/wax" })
    ])

    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.keywords).toEqual(["hot wax skis", "ski wax", "wax iron"])
    expect(clusters[0]?.proofUrls).toHaveLength(2)
  })

  it("identifies the cluster the same way whatever order the rows arrive in", () => {
    const rows = [
      observation({ keyword: "b term", domain: "evo.com", rankingUrl: "https://evo.com/guides/x" }),
      observation({ keyword: "a term", domain: "evo.com", rankingUrl: "https://evo.com/guides/x" })
    ]

    expect(buildClusters(rows)[0]?.clusterId).toBe(buildClusters([...rows].reverse())[0]?.clusterId)
    expect(buildClusters(rows)[0]?.clusterId).toBe(fingerprintKeywords(["a term", "b term"]))
  })

  it("reads reachability from the reported intent", () => {
    const [cluster] = buildClusters([
      observation({
        keyword: "best ski wax",
        domain: "evo.com",
        rankingUrl: "https://evo.com/shop/wax",
        searchVolume: 400,
        mainIntent: "commercial"
      }),
      observation({ keyword: "ski wax kit", domain: "evo.com", rankingUrl: "https://evo.com/shop/wax" })
    ])

    expect(cluster?.isReachable).toBe(true)
    expect(cluster?.hasEditorialProof).toBe(false)
  })

  it("reads reachability from an article holding the top ten when the intent says otherwise", () => {
    const [cluster] = buildClusters([
      observation({
        keyword: "ski wax",
        domain: "evo.com",
        rankGroup: 3,
        rankAbsolute: 6,
        rankingUrl: "https://evo.com/blog/ski-wax",
        mainIntent: "transactional"
      }),
      observation({ keyword: "wax skis", domain: "evo.com", rankGroup: 4, rankingUrl: "https://evo.com/blog/ski-wax" })
    ])

    expect(cluster?.hasEditorialProof).toBe(true)
    expect(cluster?.isReachable).toBe(true)
  })

  it("leaves a shop page holding the top ten as no proof an article can rank", () => {
    const [cluster] = buildClusters([
      observation({
        keyword: "ski wax",
        domain: "evo.com",
        rankGroup: 2,
        rankingUrl: "https://evo.com/collections/wax",
        mainIntent: "transactional",
        serpItemTypes: ["organic", "shopping"]
      }),
      observation({
        keyword: "wax for skis",
        domain: "evo.com",
        rankGroup: 5,
        rankingUrl: "https://evo.com/collections/wax",
        serpItemTypes: ["organic", "shopping"]
      })
    ])

    expect(cluster?.isReachable).toBe(false)
    expect(cluster?.hasProductBlocks).toBe(true)
  })

  it("keeps only the result-page blocks a majority of the terms carry", () => {
    const [cluster] = buildClusters([
      observation({
        keyword: "ski wax",
        domain: "evo.com",
        rankingUrl: "https://evo.com/guides/wax",
        serpItemTypes: ["organic", "ai_overview"]
      }),
      observation({
        keyword: "wax skis",
        domain: "evo.com",
        rankingUrl: "https://evo.com/guides/wax",
        serpItemTypes: ["organic"]
      }),
      observation({
        keyword: "waxing skis",
        domain: "evo.com",
        rankingUrl: "https://evo.com/guides/wax",
        serpItemTypes: ["organic", "video"]
      })
    ])

    expect(cluster?.serpItemTypes).toEqual(["organic"])
    expect(cluster?.hasAiOverview).toBe(false)
  })

  it("records our best position, the pages we hold it with, and our steepest fall", () => {
    const [cluster] = buildClusters([
      observation({
        keyword: "ski wax",
        domain: "evo.com",
        rankingUrl: "https://evo.com/guides/wax",
        searchVolume: 800
      }),
      observation({ keyword: "wax skis", domain: "evo.com", rankingUrl: "https://evo.com/guides/wax" }),
      observation({
        keyword: "ski wax",
        domain: "shop.example",
        isOwnDomain: true,
        rankGroup: 14,
        rankingUrl: "https://shop.example/blogs/news/wax",
        previousRankAbsolute: 6
      }),
      observation({
        keyword: "wax skis",
        domain: "shop.example",
        isOwnDomain: true,
        rankGroup: 9,
        rankingUrl: "https://shop.example/blogs/news/waxing"
      })
    ])

    expect(cluster?.ourBestPosition).toBe(9)
    expect(cluster?.ourBestKeyword).toBe("wax skis")
    expect(cluster?.ourRankingUrls).toHaveLength(2)
    expect(cluster?.largestOurDecline).toEqual({ keyword: "ski wax", from: 6, to: 14, demand: 800 })
  })
})

describe("positionOf", () => {
  it("prefers the organic rank over the one that counts the blocks around it", () => {
    expect(positionOf(observation({ keyword: "a", domain: "b", rankAbsolute: 9, rankGroup: 4 }))).toBe(4)
    expect(positionOf(observation({ keyword: "a", domain: "b", rankAbsolute: 9 }))).toBe(9)
  })
})

describe("isEditorialUrl", () => {
  it("counts a page that names itself as writing", () => {
    expect(isEditorialUrl("https://evo.com/guides/how-to-wax-skis")).toBe(true)
    expect(isEditorialUrl("https://shop.example/blogs/news/waxing")).toBe(true)
  })

  it("refuses a shop page however it is filed", () => {
    expect(isEditorialUrl("https://evo.com/collections/guides")).toBe(false)
    expect(isEditorialUrl("https://evo.com/products/ski-wax")).toBe(false)
    expect(isEditorialUrl("https://evo.com/mens-ski-jackets")).toBe(false)
    expect(isEditorialUrl(null)).toBe(false)
  })
})

describe("isQuestion", () => {
  it("reads the phrasing rather than the punctuation alone", () => {
    expect(isQuestion("how to wax skis")).toBe(true)
    expect(isQuestion("ski wax?")).toBe(true)
    expect(isQuestion("best ski wax")).toBe(false)
  })
})
