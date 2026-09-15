import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { planCommitteeDependencies } from "../src/ingestion/openstates/committee-dependencies.js"
import { inventoryCommitteeHistory } from "../src/ingestion/openstates/committee-history.js"
import { validatePeopleArchivePair } from "../src/ingestion/openstates/people-archive-pair.js"
import { preparePeopleRepositoryImport } from "../src/ingestion/openstates/people-import.js"
import { readArchivedPeoplePilot } from "../src/ingestion/openstates/pilot-archive.js"

const [archiveDirectory, currentManifest, historyManifest] = process.argv.slice(2)
if (!archiveDirectory || !currentManifest || !historyManifest || process.argv.length !== 5) {
  throw new Error("Usage: plan-openstates-committees <local-archive-directory> <current-manifest> <history-manifest>")
}
const store = new LocalArtifactStore(archiveDirectory)
const current = await readArchivedPeoplePilot(store, currentManifest)
const history = await readArchivedPeoplePilot(store, historyManifest)
const pair = validatePeopleArchivePair(current, history)
const people = preparePeopleRepositoryImport(current.files, history.files, pair.retrievedAt, pair.state)
const inventory = inventoryCommitteeHistory(
  current.files.filter((file) => file.path.includes("/committees/")),
  current.revision,
  current.retrievedAt.toISOString(),
  pair.state
)
const plan = planCommitteeDependencies(
  inventory,
  people.snapshot?.people.flatMap((person) => (person.sourceId ? [person.sourceId] : [])) ?? []
)
process.stdout.write(`${JSON.stringify({ state: pair.state, ...plan })}\n`)
