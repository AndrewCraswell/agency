import { peopleSourceProfiles } from "./people-repository.js"
import type { readArchivedPeoplePilot } from "./pilot-archive.js"

type ArchiveIdentity = Pick<Awaited<ReturnType<typeof readArchivedPeoplePilot>>, "state" | "lane" | "retrievedAt"> & {
  revision: string
}

/** Archive integrity is checked by the reader; incompatible archive pairs are never partial source imports. */
export function validatePeopleArchivePair(current: ArchiveIdentity, history: ArchiveIdentity) {
  if (
    current.lane !== "entities" ||
    history.lane !== "history" ||
    current.state !== history.state ||
    current.revision !== history.revision ||
    current.revision !== peopleSourceProfiles[current.state].revision ||
    !Number.isFinite(current.retrievedAt.getTime()) ||
    !Number.isFinite(history.retrievedAt.getTime())
  ) {
    throw new Error(
      "People archives must have matching jurisdiction and pinned revision, valid retrieval times and distinct current/history lanes"
    )
  }
  return {
    state: current.state,
    retrievedAt: new Date(Math.max(current.retrievedAt.getTime(), history.retrievedAt.getTime()))
  }
}
