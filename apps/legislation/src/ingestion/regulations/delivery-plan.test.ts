import { describe, expect, it } from "vitest"
import { planRegulatoryBackfill, replayRegulatoryBackfill } from "./backfill-plan.js"
import { digest, manifestIdentity, validateManifest, type InventoryEvidence } from "./contracts.js"
import { planRegulatoryDelivery } from "./delivery-plan.js"

function evidence(sourceId: InventoryEvidence["sourceId"], url: string, value: unknown): InventoryEvidence {
  const body = JSON.stringify(value)
  return {
    sourceId,
    url,
    body,
    sha256: digest(body),
    bytes: Buffer.byteLength(body),
    retrievedAt: "2026-09-15T00:00:00Z",
    contentType: "application/json"
  }
}
function currentManifest() {
  return planRegulatoryBackfill(
    { cutoff: "2026-09-14", ecfrTitles: [1, 35], federalRegister: null, annualCfr: null },
    async (source, url) =>
      evidence(source, url, {
        titles: Array.from({ length: 50 }, (_, index) => ({
          number: index + 1,
          name: `Synthetic ${index + 1}`,
          reserved: index === 34,
          latest_issue_date: "2026-09-10",
          latest_amended_on: "2026-09-10",
          up_to_date_as_of: "2026-09-14"
        })),
        meta: { date: "2026-09-14", import_in_progress: false }
      })
  )
}
describe("frozen regulatory delivery planning", () => {
  it("replays current titles and explicit reserved exclusions with stable identities", async () => {
    const manifest = await currentManifest()
    const plan = await planRegulatoryDelivery(manifest)
    expect(await planRegulatoryDelivery(structuredClone(manifest))).toEqual(plan)
    expect(plan).toMatchObject({
      expectedAcquisitionUnits: 1,
      excludedPartitions: 1,
      dispatchEnabled: false,
      embeddingsEnabled: false,
      sourceCoverageVerified: false
    })
    expect(plan.partitions.map((item) => [item.key, item.disposition, item.reason])).toEqual([
      ["ecfr:title-1", "listed", "requested_current_title"],
      ["ecfr:title-35", "excluded", "reserved_title"]
    ])
  })
  it("retains empty FR listing windows as unresolved and splits the 90-day boundary", async () => {
    const manifest = await planRegulatoryBackfill(
      {
        cutoff: "2026-09-14",
        ecfrTitles: [],
        annualCfr: null,
        federalRegister: { start: "2026-06-01", end: "2026-06-30" }
      },
      async (source, url) => evidence(source, url, { files: [] })
    )
    const plan = await planRegulatoryDelivery(manifest)
    expect(plan.expectedAcquisitionUnits).toBe(0)
    expect(plan.requiresIndependentInventory).toBe(2)
    expect(plan.partitions.map((item) => [item.start, item.end, item.wave, item.documentCount])).toEqual([
      ["2026-06-01", "2026-06-16", "recent_history", null],
      ["2026-06-17", "2026-06-30", "current", null]
    ])
    expect(plan.partitions.every((item) => item.requiredEvidence.includes("independent_document_inventory"))).toBe(true)
  })
  it("groups annual volumes with a frozen denominator but no invented revision dates", async () => {
    const manifest = await planRegulatoryBackfill(
      { cutoff: "2026-09-14", ecfrTitles: [], federalRegister: null, annualCfr: { years: [2019, 2025], titles: [5] } },
      async (source, url) => {
        const year = url.includes("2019") ? 2019 : 2025
        return evidence(source, url, {
          files: url.includes("title-5")
            ? [1, 2, 3].map((volume) => ({
                name: `CFR-${year}-title5-vol${volume}.xml`,
                link: `https://www.govinfo.gov/bulkdata/CFR/${year}/title-5/CFR-${year}-title5-vol${volume}.xml`,
                folder: false,
                size: 100
              }))
            : [{ name: "title-5", link: `https://www.govinfo.gov/bulkdata/json/CFR/${year}/title-5/`, folder: true }]
        })
      }
    )
    const plan = await planRegulatoryDelivery(manifest)
    expect(
      plan.partitions.map((item) => [item.year, item.wave, item.volumeNumbers, item.expectedAcquisitionUnits])
    ).toEqual([
      [2019, "extended_history", [1, 2, 3], 3],
      [2025, "recent_history", [1, 2, 3], 3]
    ])
    expect(
      plan.partitions.every(
        (item) =>
          item.start === null && item.end === null && item.requiredEvidence.includes("printed_revision_agreement")
      )
    ).toBe(true)
  })
  it("rejects rehashed manifests with omitted inventory units or falsified exclusions", async () => {
    const manifest = await currentManifest()
    const omitted = { ...manifest, units: [], estimatedKnownBytes: 0, unknownSizeUnits: 0 }
    const altered = { ...manifest, exclusions: [] }
    for (const candidate of [omitted, altered]) {
      await expect(replayRegulatoryBackfill({ ...candidate, id: manifestIdentity(candidate) })).rejects.toThrow(
        "replay mismatch"
      )
    }
  })
  it("rejects duplicate inventory requests and false size accounting", async () => {
    const manifest = await currentManifest()
    expect(() => validateManifest({ ...manifest, unknownSizeUnits: 0 })).toThrow("size accounting")
    const duplicated = { ...manifest, inventory: [...manifest.inventory, ...manifest.inventory] }
    expect(() => validateManifest({ ...duplicated, id: manifestIdentity(duplicated) })).toThrow("request is duplicated")
  })
  it("rejects evidence bound to another source even when its content hash matches", async () => {
    const manifest = await currentManifest()
    const changed = {
      ...manifest,
      inventory: manifest.inventory.map((item) => ({
        ...item,
        sourceId: "govinfo-fr" as const,
        url: "https://www.govinfo.gov/bulkdata/json/FR/2026/09/"
      }))
    }
    expect(() => validateManifest({ ...changed, id: manifestIdentity(changed) })).toThrow("inventory evidence mismatch")
  })
})
