/** Prefer formal introduction evidence over prefiling when dating an undated sponsor list. */
export function sponsorObservationDate(evidence: {
  introducedDate?: string | null
  firstReadingDate?: string | null
  firstIntroductionDate?: string | null
  firstActionDate?: string | null
}) {
  return (
    evidence.introducedDate ??
    evidence.firstReadingDate ??
    evidence.firstIntroductionDate ??
    evidence.firstActionDate ??
    undefined
  )
}
