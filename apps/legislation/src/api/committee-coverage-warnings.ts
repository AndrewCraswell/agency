import { readDirectoryObservation } from "../ingestion/govinfo/committee-directory-observation.js"

/** Source coverage describes the Congress roster, not the filtered result page. */
export function committeeCoverageWarnings(
  checkpoints: readonly { stream: string; cursor: Record<string, unknown> }[],
  organization: { chamber: string | null; name: string }
): string[] {
  return checkpoints
    .flatMap((checkpoint) => {
      const congress = /^govinfo:committee-directory:([1-9]\d*)$/.exec(checkpoint.stream)?.[1]
      if (congress === undefined) {
        return []
      }
      const observation = readDirectoryObservation(checkpoint.cursor.observation)
      const disputed =
        observation?.coverage?.quarantined.filter(
          (entry) => entry.chamber === organization.chamber && entry.organization === organization.name
        ) ?? []
      if (disputed.length === 0) {
        return []
      }
      return [
        `GovInfo committee roster for session:us:${congress} is incomplete: ${disputed.length} source assignment(s) quarantined in ${observation?.packageId}.`
      ]
    })
    .sort()
}
