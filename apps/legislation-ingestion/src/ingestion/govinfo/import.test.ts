import { describe, expect, it } from "vitest"
import type { GovInfoBillStatusPackage } from "./client.js"
import { partitionGovInfoPackages } from "./import.js"

const packages = Array.from(
  { length: 10 },
  (_, index): GovInfoBillStatusPackage => ({
    billType: "hr",
    congress: 119,
    packageId: `BILLSTATUS-119hr${index + 1}`,
    url: new URL(`https://example.test/BILLSTATUS-119hr${index + 1}.xml`)
  })
)

describe("GovInfo import sharding", () => {
  it("partitions every sorted package into exactly one deterministic shard", () => {
    const shards = Array.from({ length: 4 }, (_, shardIndex) => partitionGovInfoPackages(packages, 4, shardIndex))

    expect(shards.map((shard) => shard.map((item) => item.packageId))).toEqual([
      ["BILLSTATUS-119hr1", "BILLSTATUS-119hr5", "BILLSTATUS-119hr9"],
      ["BILLSTATUS-119hr2", "BILLSTATUS-119hr6", "BILLSTATUS-119hr10"],
      ["BILLSTATUS-119hr3", "BILLSTATUS-119hr7"],
      ["BILLSTATUS-119hr4", "BILLSTATUS-119hr8"]
    ])
    expect(new Set(shards.flatMap((shard) => shard.map((item) => item.packageId))).size).toBe(packages.length)
  })

  it("rejects an invalid shard", () => {
    expect(() => partitionGovInfoPackages(packages, 4, 4)).toThrow(
      "GovInfo shard index must be a zero-based integer smaller than shard count"
    )
  })
})
