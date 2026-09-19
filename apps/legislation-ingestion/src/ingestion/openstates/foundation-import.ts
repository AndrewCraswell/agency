import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { importCommitteeRepository } from "./committee-import.js"
import { validatePeopleArchivePair } from "./people-archive-pair.js"
import { importPeopleRepository } from "./people-import.js"
import type { PeopleRepositoryFile } from "./people-repository.js"
import { readArchivedPeoplePilot } from "./pilot-archive.js"
import { readWashingtonCommitteeInventory } from "./washington-committee-inventory.js"

type ArchivedPeoplePilot = Awaited<ReturnType<typeof readArchivedPeoplePilot>>
type FoundationState = ArchivedPeoplePilot["state"]
type FoundationDependencies = {
  read(store: Pick<ArtifactStore, "read">, manifestPath: string): Promise<ArchivedPeoplePilot>
  importPeople(
    database: LegislationDatabase,
    state: FoundationState,
    currentFiles: readonly PeopleRepositoryFile[],
    historyFiles: readonly PeopleRepositoryFile[],
    retrievedAt: Date,
    revision: string
  ): Promise<unknown>
  importCommittees(
    database: LegislationDatabase,
    state: FoundationState,
    currentFiles: readonly PeopleRepositoryFile[],
    historyFiles: readonly PeopleRepositoryFile[],
    retrievedAt: Date,
    revision: string,
    officialInventory?: Awaited<ReturnType<typeof readWashingtonCommitteeInventory>>
  ): Promise<unknown>
}

/** Replay immutable current/history archives through the shared people and committee boundaries. */
export async function importArchivedStateFoundation(
  database: LegislationDatabase,
  input: {
    store: Pick<ArtifactStore, "read">
    state: FoundationState
    currentManifestPath: string
    historyManifestPath: string
    committeeInventoryPath?: string
  },
  dependencies: FoundationDependencies = {
    read: readArchivedPeoplePilot,
    importPeople: (database, state, currentFiles, historyFiles, retrievedAt, revision) =>
      importPeopleRepository(database, state, currentFiles, historyFiles, retrievedAt, undefined, revision),
    importCommittees: (database, state, currentFiles, historyFiles, retrievedAt, revision, officialInventory) =>
      importCommitteeRepository(
        database,
        state,
        currentFiles,
        historyFiles,
        retrievedAt,
        undefined,
        revision,
        officialInventory
      )
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
  if (input.committeeInventoryPath && input.state !== "wa")
    throw new Error("Committee inventory does not match jurisdiction")
  if (input.state === "wa" && !input.committeeInventoryPath)
    throw new Error("Washington foundation replay requires retained committee inventory")
  const officialInventory = input.committeeInventoryPath
    ? await readWashingtonCommitteeInventory(input.store, input.committeeInventoryPath)
    : undefined
  const people = await dependencies.importPeople(
    database,
    input.state,
    current.files,
    history.files,
    pair.retrievedAt,
    current.revision
  )
  const committees = await dependencies.importCommittees(
    database,
    input.state,
    current.files,
    history.files,
    pair.retrievedAt,
    current.revision,
    officialInventory
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
