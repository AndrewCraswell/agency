import invariant from "tiny-invariant"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { validateManifest } from "./contracts.js"
import { replayFrMetadata } from "./fr-metadata.js"

/** Compare independently replayed inventories. Agreement is not document or calendar completeness. */
export async function auditFrInventory(manifestValue: unknown, metadataValue: unknown) {
  const manifest = validateManifest(manifestValue)
  const metadata = await replayFrMetadata(metadataValue)
  const scope = manifest.scope.federalRegister
  invariant(scope !== null, "fr_inventory_scope_required")
  invariant(
    metadata.scope.start <= scope.start &&
      metadata.scope.end >= scope.end &&
      metadata.scope.cutoff === manifest.scope.cutoff,
    "fr_inventory_metadata_scope_mismatch"
  )
  const replay = await planRegulatoryBackfill(manifest.scope, async (sourceId, url) => {
    const evidence = manifest.inventory.find((item) => item.sourceId === sourceId && item.url === url)
    invariant(evidence, "fr_inventory_replay_missing_evidence")
    return evidence
  })
  invariant(JSON.stringify(replay) === JSON.stringify(manifest), "fr_inventory_replay_mismatch")
  const days = []
  for (let timestamp = Date.parse(scope.start); timestamp <= Date.parse(scope.end); timestamp += 86_400_000) {
    const date = new Date(timestamp).toISOString().slice(0, 10)
    const units = manifest.units.filter((unit) => unit.sourceId === "govinfo-fr" && unit.issueDate === date)
    const records = metadata.records.filter((record) => record.publication_date === date)
    const supported = records.filter((record) => record.type !== "Presidential Document")
    let status:
      | "ambiguous_xml"
      | "missing_xml"
      | "missing_metadata"
      | "requires_document_reconciliation"
      | "outside_initial_scope"
      | "no_records_observed"
    if (units.length > 1) {
      status = "ambiguous_xml"
    } else if (units.length === 1 && records.length === 0) {
      status = "missing_metadata"
    } else if (supported.length > 0) {
      status = units.length === 0 ? "missing_xml" : "requires_document_reconciliation"
    } else {
      status = records.length > 0 ? "outside_initial_scope" : "no_records_observed"
    }
    days.push({
      date,
      status,
      xmlUnits: units.map((unit) => unit.key),
      metadataDocuments: records.length,
      supportedDocuments: supported.length,
      excludedDocuments: records.length - supported.length
    })
  }
  return {
    contract: "fr-inventory-audit-2026-09-14",
    manifestId: manifest.id,
    metadataManifestId: metadata.id,
    scope,
    days,
    inventoryGaps: days.filter((day) => ["ambiguous_xml", "missing_xml", "missing_metadata"].includes(day.status))
      .length,
    calendarCompletenessVerified: false,
    publicationReady: false,
    canonicalWrites: false,
    externalRequests: false
  }
}
