import { isDeepStrictEqual } from "node:util"
import { validateManifest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { isSupportedFrMetadataType } from "./fr-metadata-contract.js"
import { replayFrMetadata } from "./fr-metadata.js"

/** Compare independently replayed inventories. Agreement is not document or calendar completeness. */
export async function auditFrInventory(manifestValue: unknown, metadataValue: unknown) {
  const manifest = validateManifest(manifestValue)
  const metadata = await replayFrMetadata(metadataValue)
  const parentScope = manifest.scope.federalRegister
  invariant(parentScope !== null, "fr_inventory_scope_required")
  invariant(
    metadata.scope.start >= parentScope.start &&
      metadata.scope.end <= parentScope.end &&
      metadata.scope.cutoff === manifest.scope.cutoff,
    "fr_inventory_metadata_scope_mismatch"
  )
  const readRetained = async (sourceId: "ecfr" | "govinfo-fr" | "govinfo-cfr", url: string) => {
    const evidence = manifest.inventory.find((item) => item.sourceId === sourceId && item.url === url)
    invariant(evidence, "fr_inventory_replay_missing_evidence")
    return evidence
  }
  const fullReplay = await planRegulatoryBackfill(manifest.scope, readRetained)
  invariant(isDeepStrictEqual(fullReplay, manifest), "fr_inventory_replay_mismatch")
  const replay = await planRegulatoryBackfill(
    {
      cutoff: manifest.scope.cutoff,
      ecfrTitles: [],
      annualCfr: null,
      federalRegister: { start: metadata.scope.start, end: metadata.scope.end }
    },
    readRetained
  )
  const retainedUnits = manifest.units.filter(
    (unit) =>
      unit.sourceId === "govinfo-fr" &&
      unit.issueDate !== null &&
      unit.issueDate >= metadata.scope.start &&
      unit.issueDate <= metadata.scope.end
  )
  invariant(isDeepStrictEqual(replay.units, retainedUnits), "fr_inventory_replay_mismatch")
  const scope = replay.scope.federalRegister
  invariant(scope !== null, "fr_inventory_slice_scope_missing")
  const days = []
  for (let timestamp = Date.parse(scope.start); timestamp <= Date.parse(scope.end); timestamp += 86_400_000) {
    const date = new Date(timestamp).toISOString().slice(0, 10)
    const units = manifest.units.filter((unit) => unit.sourceId === "govinfo-fr" && unit.issueDate === date)
    const records = metadata.records.filter((record) => record.publication_date === date)
    const supported = records.filter((record) => isSupportedFrMetadataType(record.type))
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
    issueSliceManifestId: replay.id,
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
