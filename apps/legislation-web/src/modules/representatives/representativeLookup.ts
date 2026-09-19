import type { GeocodioLookup, RepresentativeIdentifier } from "../../services/geocodio/geocodio"
import type { RepresentativeLookupRequest, RepresentativeLookupResult, RepresentativeProfile } from "./contracts"

export type ProfileMatch = Readonly<{
  identifier: RepresentativeIdentifier
  jurisdictionId: string
  profile: RepresentativeProfile
}>
export type RepresentativeDirectory = Readonly<{
  profiles: readonly ProfileMatch[]
  jurisdictions: readonly Readonly<{ id: string; name: string }>[]
}>
export type RepresentativeDirectoryReader = (
  identifiers: readonly RepresentativeIdentifier[],
  jurisdictionIds: readonly string[],
  signal: AbortSignal
) => Promise<RepresentativeDirectory>

export function createRepresentativeLookup(
  geocode: (input: RepresentativeLookupRequest, signal: AbortSignal) => Promise<GeocodioLookup>,
  readDirectory: RepresentativeDirectoryReader
) {
  return async (input: RepresentativeLookupRequest, signal: AbortSignal): Promise<RepresentativeLookupResult> => {
    const result = await geocode(input, signal)
    const warnings = [...result.warnings]
    const identifiers = result.representatives.flatMap((person) => (person.identifier ? [person.identifier] : []))
    const jurisdictionIds = result.jurisdictions.map(
      (jurisdiction) => `jurisdiction:${jurisdiction.code.toLowerCase()}`
    )
    const directory =
      jurisdictionIds.length === 0
        ? { profiles: [], jurisdictions: [] }
        : await readDirectory(identifiers, jurisdictionIds, signal)
    signal.throwIfAborted()
    const jurisdictions = result.jurisdictions.map((jurisdiction) => {
      const stored = directory.jurisdictions.find(
        (candidate) => candidate.id === `jurisdiction:${jurisdiction.code.toLowerCase()}`
      )
      return { ...jurisdiction, id: stored?.id ?? null, name: stored?.name ?? null }
    })
    const representatives = result.representatives.map(({ identifier, ...person }) => {
      const matches = directory.profiles.filter(
        (candidate) =>
          identifier &&
          candidate.identifier.scheme === identifier.scheme &&
          candidate.identifier.value === identifier.value &&
          candidate.jurisdictionId === `jurisdiction:${person.jurisdictionCode.toLowerCase()}`
      )
      const unique = [...new Map(matches.map((match) => [match.profile.id, match.profile])).values()]
      const matchStatus = profileMatchStatus(identifier, unique.length)
      return { ...person, matchStatus, profile: unique.length === 1 ? unique[0]! : null } as const
    })
    if (jurisdictions.some((entry) => entry.name === null)) {
      warnings.push("Some jurisdiction names are not available in the database.")
    }

    function profileMatchStatus(identifier: RepresentativeIdentifier | null, count: number) {
      if (identifier === null) {
        return "missing_identifier"
      }
      if (count === 0) {
        return "not_found"
      }
      return count > 1 ? "ambiguous" : "matched"
    }
    if (representatives.some((person) => person.matchStatus !== "matched")) {
      warnings.push("Some representatives could not be matched uniquely to a current database profile.")
    }
    return {
      status: result.status === "matched" && warnings.length > 0 ? "partial" : result.status,
      jurisdictions,
      representatives,
      warnings
    }
  }
}
