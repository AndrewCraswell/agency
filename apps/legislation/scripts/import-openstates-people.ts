import { createDatabase } from "../src/db/database.js"
import { AzureBlobArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { validatePeopleArchivePair } from "../src/ingestion/openstates/people-archive-pair.js"
import { importPeopleRepository, preparePeopleRepositoryImport } from "../src/ingestion/openstates/people-import.js"
import { readArchivedPeoplePilot } from "../src/ingestion/openstates/pilot-archive.js"

const [currentManifest, historyManifest, mode] = process.argv.slice(2)
const account = process.env.AZURE_STORAGE_ACCOUNT
if (!account || !currentManifest || !historyManifest || (mode !== undefined && mode !== "--apply")) {
  throw new Error(
    "Usage: import-openstates-people <current-manifest> <history-manifest> [--apply]; Azure account required"
  )
}
const store = new AzureBlobArtifactStore(account, "state-sources")
const current = await readArchivedPeoplePilot(store, currentManifest)
const history = await readArchivedPeoplePilot(store, historyManifest)
const pair = validatePeopleArchivePair(current, history)
const prepared = preparePeopleRepositoryImport(current.files, history.files, pair.retrievedAt, pair.state)
if (mode !== "--apply" || prepared.snapshot === null) {
  process.stdout.write(
    `${JSON.stringify({ status: prepared.status, counts: prepared.counts, coverageIssues: prepared.coverageIssues, quarantine: prepared.quarantine, canonicalWrites: false })}\n`
  )
  if (prepared.snapshot === null) {
    process.exitCode = 1
  }
} else {
  const url = process.env.DATABASE_DIRECT_URL
  if (!url) {
    throw new Error("DATABASE_DIRECT_URL is required for application")
  }
  const { database, pool } = createDatabase({ url, maxConnections: 1, connectionTimeoutMs: 5000, idleTimeoutMs: 10000 })
  try {
    const result = await importPeopleRepository(database, pair.state, current.files, history.files, pair.retrievedAt)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } finally {
    await pool.end()
  }
}
