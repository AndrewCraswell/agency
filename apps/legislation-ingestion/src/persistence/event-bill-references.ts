import type { EventSnapshot } from "./events.js"

/** Whitespace is presentation; jurisdiction and session remain strict identity boundaries. */
export function resolveAgendaBillReferences(
  snapshots: readonly EventSnapshot[],
  candidates: readonly { id: string; identifier: string; sessionId: string; jurisdictionId: string }[]
): EventSnapshot[] {
  const key = (item: { identifier: string; sessionId: string; jurisdictionId: string }) =>
    JSON.stringify([item.jurisdictionId, item.sessionId, item.identifier.replaceAll(/\s+/g, "")])
  const matches = new Map<string, Set<string>>()
  for (const candidate of candidates) {
    const identity = key(candidate)
    const ids = matches.get(identity) ?? new Set<string>()
    ids.add(candidate.id)
    matches.set(identity, ids)
  }
  return snapshots.map((snapshot) => ({
    ...snapshot,
    agendaItems: snapshot.agendaItems.map((item) => ({
      ...item,
      agendaItem: {
        ...item.agendaItem,
        billRelationsComplete:
          item.billReferencesComplete === undefined
            ? item.agendaItem.billRelationsComplete
            : item.billReferencesComplete &&
              item.billReferences !== undefined &&
              item.billReferences.every(
                (reference) =>
                  reference.jurisdictionId === snapshot.event.jurisdictionId && matches.get(key(reference))?.size === 1
              )
      },
      billIds: [
        ...new Set([
          ...item.billIds,
          ...(item.billReferences ?? []).flatMap((reference) => {
            if (reference.jurisdictionId !== snapshot.event.jurisdictionId) {
              return []
            }
            const ids = matches.get(key(reference))
            return ids?.size === 1 ? [...ids] : []
          })
        ])
      ]
    }))
  }))
}
