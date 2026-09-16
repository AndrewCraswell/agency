import { digest, validateManifest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import { z } from "zod"
import { assessAnnualCfrDates } from "./annual-cfr-dates.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const memberSchema = z.strictObject({ generationId: hash, unitKey: hash, summary: regulatoryParseSummarySchema })

/** A frozen publisher inventory, not the successful downloads, defines the volume denominator. */
export function assessAnnualCfrEdition(input: { manifest: unknown; year: number; title: number; members: unknown[] }) {
  const manifest = validateManifest(input.manifest)
  const year = z.int().min(1996).max(9999).parse(input.year)
  const title = z.int().min(1).max(50).parse(input.title)
  if (!manifest.scope.annualCfr?.years.includes(year) || !manifest.scope.annualCfr.titles.includes(title)) {
    throw new Error("annual_edition_outside_manifest")
  }
  const url = `https://www.govinfo.gov/bulkdata/json/CFR/${year}/title-${title}/`
  const evidence = manifest.inventory.filter((row) => row.sourceId === "govinfo-cfr" && row.url === url)
  if (evidence.length !== 1 || !evidence[0]) {
    throw new Error("annual_volume_inventory_missing_or_ambiguous")
  }
  const inventory = evidence[0]
  const files = z
    .object({ files: z.array(z.object({ name: z.string(), folder: z.boolean(), link: z.url() })) })
    .parse(JSON.parse(inventory.body))
    .files.filter((row) => !row.folder && row.name.endsWith(".xml"))
  const expected = files
    .map((file) => {
      const match = new RegExp(`^CFR-${year}-title${title}-vol([1-9][0-9]*)\\.xml$`).exec(file.name)
      if (!match || file.link !== `https://www.govinfo.gov/bulkdata/CFR/${year}/title-${title}/${file.name}`) {
        throw new Error("annual_volume_inventory_identity_mismatch")
      }
      return { nativeId: file.name.slice(0, -4), volume: Number(match[1]), url: file.link }
    })
    .sort((a, b) => a.volume - b.volume)
  if (expected.length === 0 || expected.length > 200 || expected.some((row, index) => row.volume !== index + 1)) {
    throw new Error("annual_volume_inventory_gap_or_duplicate")
  }
  const units = manifest.units.filter(
    (row) => row.sourceId === "govinfo-cfr" && row.nativeId.startsWith(`CFR-${year}-title${title}-vol`)
  )
  if (
    units.length !== expected.length ||
    expected.some(
      (row) =>
        units.filter(
          (unit) =>
            unit.nativeId === row.nativeId &&
            unit.sourceUrl === row.url &&
            unit.inventoryHash === inventory.sha256 &&
            unit.edition === String(year)
        ).length !== 1
    )
  ) {
    throw new Error("annual_manifest_volume_denominator_mismatch")
  }
  const members = z.array(memberSchema).max(200).parse(input.members)
  if (
    new Set(members.map((row) => row.unitKey)).size !== members.length ||
    new Set(members.map((row) => row.generationId)).size !== members.length ||
    members.some((row) => !units.some((unit) => unit.key === row.unitKey))
  ) {
    throw new Error("annual_duplicate_or_unexpected_member")
  }
  const volumes = expected.map((row) => {
    const unit = units.find((item) => item.nativeId === row.nativeId)
    if (!unit) {
      throw new Error("annual_manifest_volume_missing")
    }
    const member = members.find((item) => item.unitKey === unit.key)
    if (!member) {
      return { ...row, unitKey: unit.key, generationId: null, revisionDate: null, records: 0, status: "missing" }
    }
    const date = assessAnnualCfrDates([
      {
        unitKey: unit.key,
        nativeId: unit.nativeId,
        packageYear: year,
        artifactHash: member.summary.inputHash,
        printedRevisionDates: member.summary.sourceDates
          .filter((item) => item.kind === "printed_revision" && item.value !== null)
          .map((item) => item.value)
      }
    ]).units[0]
    const status =
      date?.status === "dates_consistent" &&
      member.summary.warnings.length === 0 &&
      member.summary.records === member.summary.sourceRecords
        ? "verified"
        : "quarantined"
    return {
      ...row,
      unitKey: unit.key,
      generationId: member.generationId,
      revisionDate: date?.sourceRevisionDate ?? null,
      records: member.summary.records,
      status
    }
  })
  const dates = new Set(volumes.map((row) => row.revisionDate))
  const isComplete = volumes.every((row) => row.status === "verified") && dates.size === 1
  const revisionDate = isComplete ? (volumes[0]?.revisionDate ?? null) : null
  return {
    id: digest(JSON.stringify(["annual-cfr-edition", manifest.id, year, title, volumes])),
    manifestId: manifest.id,
    year,
    title,
    inventoryHash: inventory.sha256,
    volumes,
    revisionDate,
    expectedVolumes: expected.length,
    verifiedVolumes: volumes.filter((row) => row.status === "verified").length,
    isComplete,
    publicationReady: isComplete,
    canonicalWrites: false
  }
}
