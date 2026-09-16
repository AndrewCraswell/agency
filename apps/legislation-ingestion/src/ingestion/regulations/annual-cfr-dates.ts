import { z } from "zod"

const observationSchema = z.strictObject({
  unitKey: z.string().regex(/^[a-f0-9]{64}$/),
  nativeId: z.string().min(1),
  packageYear: z.int().min(1996).max(9999),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  printedRevisionDates: z.array(z.iso.date())
})

/** Dates describe publisher evidence. Neither a folder year nor shared bytes prove legal currency. */
export function assessAnnualCfrDates(input: unknown) {
  const observations = z.array(observationSchema).min(1).max(10000).parse(input)
  if (new Set(observations.map((row) => row.unitKey)).size !== observations.length) {
    throw new Error("duplicate_annual_cfr_observation")
  }
  const yearsByHash = new Map<string, Set<number>>()
  for (const row of observations) {
    const years = yearsByHash.get(row.artifactHash) ?? new Set<number>()
    years.add(row.packageYear)
    yearsByHash.set(row.artifactHash, years)
  }
  const units = observations.map((row) => {
    const dates = [...new Set(row.printedRevisionDates)].sort()
    const sourceRevisionDate = dates.length === 1 ? (dates[0] ?? null) : null
    let status = "dates_consistent"
    if (dates.length === 0) {
      status = "missing_printed_revision"
    } else if (dates.length > 1) {
      status = "conflicting_printed_revisions"
    } else if (Number(sourceRevisionDate?.slice(0, 4)) !== row.packageYear) {
      status = "package_revision_year_mismatch"
    }
    const sharedPackageYears = [...(yearsByHash.get(row.artifactHash) ?? [])].sort((a, b) => a - b)
    return {
      ...row,
      sourceRevisionDate,
      status,
      sharedPackageYears,
      reusedAcrossPackageYears: sharedPackageYears.length > 1,
      legalCurrencyDate: null,
      publicationReady: false
    }
  })
  const dispositions = units.map((row) => {
    const scope = /^CFR-(\d{4})-title(\d+)-vol(\d+)$/.exec(row.nativeId)
    const anchors = units.filter((candidate) => {
      const other = /^CFR-(\d{4})-title(\d+)-vol(\d+)$/.exec(candidate.nativeId)
      return (
        scope !== null &&
        other !== null &&
        Number(scope[1]) === row.packageYear &&
        Number(other[1]) === candidate.packageYear &&
        scope[2] === other[2] &&
        scope[3] === other[3] &&
        candidate.status === "dates_consistent" &&
        candidate.artifactHash === row.artifactHash &&
        candidate.sourceRevisionDate === row.sourceRevisionDate
      )
    })
    let disposition = "quarantine_date_evidence"
    let revisionAnchorUnitKey: string | null = null
    if (row.status === "dates_consistent") {
      disposition = "revision_evidence_consistent"
    } else if (row.status === "package_revision_year_mismatch" && anchors.length === 1) {
      disposition = "retain_duplicate_revision_observation"
      revisionAnchorUnitKey = anchors[0]?.unitKey ?? null
    }
    return {
      ...row,
      disposition,
      revisionAnchorUnitKey,
      packageYearMatchesPrintedRevision: row.status === "dates_consistent",
      // Even an anchored copy is not a new edition for the later package year.
      canCreatePackageYearEdition: false
    }
  })
  return {
    units: dispositions,
    duplicateRevisionObservations: dispositions.filter(
      (row) => row.disposition === "retain_duplicate_revision_observation"
    ).length,
    consistentUnits: units.filter((row) => row.status === "dates_consistent").length,
    dateReviewRequired: units.some((row) => row.status !== "dates_consistent"),
    publicationReady: false,
    canonicalWrites: false
  }
}
