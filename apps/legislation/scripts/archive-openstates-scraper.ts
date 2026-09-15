import { AzureBlobArtifactStore, LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { archiveScraperAttempt, readArchivedScraperAttempt } from "../src/ingestion/openstates/scraper-archive.js"
import { scraperAttemptDirectory } from "../src/ingestion/openstates/scraper-attempt-directory.js"

const [directory, destination, runId] = process.argv.slice(2)
if (!directory || !destination || !runId) {
  throw new Error("Usage: archive-openstates-scraper <attempt-directory> <local-directory|azure> <run-id>")
}
const account = process.env.AZURE_STORAGE_ACCOUNT
if (destination === "azure" && !account) {
  throw new Error("AZURE_STORAGE_ACCOUNT is required")
}
const target =
  destination === "azure" ? new AzureBlobArtifactStore(account!, "state-sources") : new LocalArtifactStore(destination)
const source = scraperAttemptDirectory(directory)
const result = await archiveScraperAttempt(source, target, runId)
await readArchivedScraperAttempt(target, result.manifestPath)
process.stdout.write(`${JSON.stringify(result)}\n`)
