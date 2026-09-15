import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { digest, manifestIdentity } from "./contracts.js"
import { auditFrInventory } from "./fr-inventory-audit.js"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { collectFrMetadata } from "./fr-metadata.js"

const fixture = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
)
const scope = { start: "2024-01-02", end: "2024-01-02", cutoff: "2026-09-14" }
async function inputs(xml: boolean, selection: "all" | "none" | "presidential" = "all") {
  const records = fixture.results.filter(
    (record) => selection === "all" || (selection === "presidential" && record.type === "Presidential Document")
  )
  const metadata = await collectFrMetadata(
    scope,
    async (url) => {
      const body = JSON.stringify({
        ...fixture,
        results: records,
        count: records.length,
        total_pages: Math.ceil(records.length / 1000),
        next_page_url: null
      })
      return {
        url,
        body,
        sha256: digest(body),
        bytes: Buffer.byteLength(body),
        retrievedAt: "2026-09-14T00:00:00Z",
        contentType: "application/json"
      }
    },
    { pageSize: 1000 }
  )
  const manifest = await planRegulatoryBackfill(
    { cutoff: scope.cutoff, ecfrTitles: [], annualCfr: null, federalRegister: { start: scope.start, end: scope.end } },
    async (sourceId, url) => {
      const body = JSON.stringify({
        files: xml
          ? [
              {
                name: "FR-2024-01-02.xml",
                link: "https://www.govinfo.gov/bulkdata/FR/2024/01/FR-2024-01-02.xml",
                folder: false,
                size: 100
              }
            ]
          : []
      })
      return {
        sourceId,
        url,
        body,
        sha256: digest(body),
        bytes: Buffer.byteLength(body),
        retrievedAt: "2026-09-14T00:00:00Z",
        contentType: "application/json"
      }
    }
  )
  return { manifest, metadata }
}

describe("Federal Register cross-source inventory audit", () => {
  it("detects missing bulk XML despite a complete metadata day", async () => {
    const { manifest, metadata } = await inputs(false)
    const report = await auditFrInventory(manifest, metadata)
    expect(report.inventoryGaps).toBe(1)
    expect(report.days[0]).toMatchObject({
      status: "missing_xml",
      metadataDocuments: 65,
      supportedDocuments: 63,
      excludedDocuments: 2
    })
  })
  it("requires document reconciliation even when both inventories agree", async () => {
    const { manifest, metadata } = await inputs(true)
    expect(await auditFrInventory(manifest, metadata)).toMatchObject({
      inventoryGaps: 0,
      publicationReady: false,
      calendarCompletenessVerified: false,
      days: [{ status: "requires_document_reconciliation" }]
    })
  })
  it.each([
    [true, "none", "missing_metadata"],
    [false, "none", "no_records_observed"],
    [false, "presidential", "outside_initial_scope"]
  ] as const)("distinguishes XML %s with %s metadata", async (xml, selection, status) => {
    const { manifest, metadata } = await inputs(xml, selection)
    expect((await auditFrInventory(manifest, metadata)).days[0]?.status).toBe(status)
  })
  it("rejects an omitted listed issue even with a recomputed manifest digest", async () => {
    const { manifest, metadata } = await inputs(true)
    manifest.units = []
    manifest.estimatedKnownBytes = 0
    manifest.unknownSizeUnits = 0
    manifest.id = manifestIdentity(manifest)
    await expect(auditFrInventory(manifest, metadata)).rejects.toThrow("fr_inventory_replay_mismatch")
  })
  it("rejects uncovered dates and modified metadata evidence", async () => {
    const { manifest, metadata } = await inputs(true)
    manifest.scope.federalRegister = { start: "2024-01-01", end: "2024-01-02" }
    manifest.id = manifestIdentity(manifest)
    await expect(auditFrInventory(manifest, metadata)).rejects.toThrow("fr_inventory_metadata_scope_mismatch")
    const valid = await inputs(true)
    valid.metadata.records.pop()
    await expect(auditFrInventory(valid.manifest, valid.metadata)).rejects.toThrow("metadata_manifest_replay_mismatch")
  })
})
