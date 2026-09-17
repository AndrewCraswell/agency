import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { importCommitteeRepository } from "./committee-import.js"
import { validatePeopleArchivePair } from "./people-archive-pair.js"
import { importPeopleRepository } from "./people-import.js"
import type { PeopleRepositoryFile } from "./people-repository.js"
import { readArchivedPeoplePilot } from "./pilot-archive.js"

type ArchivedPeoplePilot = Awaited<ReturnType<typeof readArchivedPeoplePilot>>
type FoundationDependencies = {
  read(store: Pick<ArtifactStore, "read">, manifestPath: string): Promise<ArchivedPeoplePilot>
  importPeople(
    database: LegislationDatabase,
    state: "ak" | "nc",
    currentFiles: readonly PeopleRepositoryFile[],
    historyFiles: readonly PeopleRepositoryFile[],
    retrievedAt: Date
  ): Promise<unknown>
  importCommittees(
    database: LegislationDatabase,
    state: "ak" | "nc",
    currentFiles: readonly PeopleRepositoryFile[],
    historyFiles: readonly PeopleRepositoryFile[],
    retrievedAt: Date
  ): Promise<unknown>
}

/** Replay immutable current/history archives through the shared people and committee boundaries. */
export async function importArchivedStateFoundation(
  database: LegislationDatabase,
  input: {
    store: Pick<ArtifactStore, "read">
    state: "ak" | "nc"
    currentManifestPath: string
    historyManifestPath: string
  },
  dependencies: FoundationDependencies = {
    read: readArchivedPeoplePilot,
    importPeople: importPeopleRepository,
    importCommittees: importCommitteeRepository
  }
) {
  const [current, history] = await Promise.all([
    dependencies.read(input.store, input.currentManifestPath),
    dependencies.read(input.store, input.historyManifestPath)
  ])
  const pair = validatePeopleArchivePair(current, history)
  if (pair.state !== input.state) {
    throw new Error("People archive pair does not match requested state")
  }
  const people = await dependencies.importPeople(database, input.state, current.files, history.files, pair.retrievedAt)
  const committees = await dependencies.importCommittees(
    database,
    input.state,
    current.files,
    history.files,
    pair.retrievedAt
  )
  return {
    status: "foundation_imported" as const,
    state: input.state,
    revision: current.revision,
    retrievedAt: pair.retrievedAt.toISOString(),
    people,
    committees
  }
}
