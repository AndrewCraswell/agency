import type { EventSnapshot } from "./events.js"

export function resolveEventOrganizationReferences(
  snapshots: readonly EventSnapshot[],
  candidates: readonly { id: string; jurisdictionId: string; upstreamIds: Record<string, unknown> }[]
) {
  return snapshots.map((snapshot) => {
    let resolved = true
    const referencedIds = (snapshot.organizationReferences ?? []).flatMap((references) => {
      const matches = [
        ...new Set(
          candidates
            .filter(
              (candidate) =>
                candidate.jurisdictionId === snapshot.event.jurisdictionId &&
                references.some((reference) => Object.hasOwn(candidate.upstreamIds, reference))
            )
            .map((candidate) => candidate.id)
        )
      ]
      if (matches.length !== 1) {
        resolved = false
        return []
      }
      return matches
    })
    return {
      ...snapshot,
      organizationIds: [...new Set([...(snapshot.organizationIds ?? []), ...referencedIds])],
      event: {
        ...snapshot.event,
        organizationRelationsComplete: snapshot.event.organizationRelationsComplete === true && resolved
      }
    }
  })
}
