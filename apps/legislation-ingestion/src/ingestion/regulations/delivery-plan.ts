import { digest } from "@repo/legislation-core/legal-text/contracts"
import { replayRegulatoryBackfill } from "./backfill-plan.js"

/** Read-only acquisition partition plan. Required evidence is a checklist, never a claim that the evidence exists. */
export async function planRegulatoryDelivery(value: unknown) {
  const manifest = await replayRegulatoryBackfill(value)
  const recentStart = new Date(Date.parse(manifest.scope.cutoff) - 89 * 86_400_000).toISOString().slice(0, 10)
  const partitions = []
  for (const title of manifest.scope.ecfrTitles) {
    const nativeId = `title-${title}`
    const units = manifest.units.filter((unit) => unit.sourceId === "ecfr" && unit.nativeId === nativeId)
    const excluded = manifest.exclusions.find((item) => item.sourceId === "ecfr" && item.nativeId === nativeId)
    partitions.push({
      key: `ecfr:${nativeId}`,
      sourceId: "ecfr",
      jurisdictionId: "jurisdiction:us",
      corpus: "regulation",
      wave: "current",
      title,
      year: null,
      start: null,
      end: manifest.scope.cutoff,
      disposition: excluded ? "excluded" : "listed",
      reason: excluded?.reason ?? "requested_current_title",
      requiredEvidence: excluded
        ? ["publisher_reserved_title"]
        : ["xml", "publisher_issue_and_currency", "complete_title_inventory"],
      unitKeys: units.map((unit) => unit.key),
      expectedAcquisitionUnits: units.length,
      volumeNumbers: [],
      documentCount: null
    })
  }
  if (manifest.scope.federalRegister) {
    let start = manifest.scope.federalRegister.start
    const end = manifest.scope.federalRegister.end
    while (start <= end) {
      const nextMonth = new Date(`${start.slice(0, 7)}-01T00:00:00Z`)
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      // Split at cohort boundaries too, so a month never silently crosses from history into the current 90-day baseline.
      const boundaries = [Date.parse(end), nextMonth.getTime() - 86_400_000]
      for (const boundary of ["2020-01-01", recentStart]) {
        if (boundary > start && boundary <= end) {
          boundaries.push(Date.parse(boundary) - 86_400_000)
        }
      }
      const through = new Date(Math.min(...boundaries)).toISOString().slice(0, 10)
      let wave = "extended_history"
      if (start >= recentStart) {
        wave = "current"
      } else if (start >= "2020-01-01") {
        wave = "recent_history"
      }
      const units = manifest.units.filter(
        (unit) =>
          unit.sourceId === "govinfo-fr" &&
          unit.issueDate !== null &&
          unit.issueDate >= start &&
          unit.issueDate <= through
      )
      partitions.push({
        key: `govinfo-fr:${start}:${through}`,
        sourceId: "govinfo-fr",
        jurisdictionId: "jurisdiction:us",
        corpus: "regulatory_publication",
        wave,
        title: null,
        year: null,
        start,
        end: through,
        disposition: "needs_independent_inventory",
        reason: "bulk_xml_listing_does_not_establish_document_completeness",
        requiredEvidence: [
          "independent_document_inventory",
          "document_metadata",
          "verified_publication_text",
          "required_pdf_rendition",
          "issue_reconciliation"
        ],
        unitKeys: units.map((unit) => unit.key),
        expectedAcquisitionUnits: units.length,
        volumeNumbers: [],
        documentCount: null
      })
      if (through === end) {
        break
      }
      start = new Date(Date.parse(through) + 86_400_000).toISOString().slice(0, 10)
    }
  }
  if (manifest.scope.annualCfr) {
    for (const year of manifest.scope.annualCfr.years) {
      for (const title of manifest.scope.annualCfr.titles) {
        const prefix = `CFR-${year}-title${title}-vol`
        const units = manifest.units.filter(
          (unit) => unit.sourceId === "govinfo-cfr" && unit.nativeId.startsWith(prefix)
        )
        partitions.push({
          key: `govinfo-cfr:${year}:title-${title}`,
          sourceId: "govinfo-cfr",
          jurisdictionId: "jurisdiction:us",
          corpus: "regulation",
          wave: year >= 2020 ? "recent_history" : "extended_history",
          title,
          year,
          start: null,
          end: null,
          disposition: "listed",
          reason: "requested_annual_title",
          requiredEvidence: ["all_listed_xml_volumes", "printed_revision_agreement", "complete_title_inventory"],
          unitKeys: units.map((unit) => unit.key),
          expectedAcquisitionUnits: units.length,
          volumeNumbers: units.map((unit) => Number(unit.nativeId.slice(prefix.length))).sort((a, b) => a - b),
          documentCount: null
        })
      }
    }
  }
  const contents = {
    contract: "regulatory-delivery-plan",
    acquisitionManifestId: manifest.id,
    cutoff: manifest.scope.cutoff,
    scope: manifest.scope,
    partitions,
    expectedAcquisitionUnits: manifest.units.length,
    excludedPartitions: partitions.filter((partition) => partition.disposition === "excluded").length,
    requiresIndependentInventory: partitions.filter(
      (partition) => partition.disposition === "needs_independent_inventory"
    ).length,
    sourceCoverageVerified: false,
    canonicalWrites: false,
    dispatchEnabled: false,
    recurringIngestionEnabled: false,
    embeddingsEnabled: false
  }
  return { id: digest(JSON.stringify(contents)), ...contents }
}
