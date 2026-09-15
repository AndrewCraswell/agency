import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { normalizeArchivedScraperBills } from "../src/ingestion/openstates/scraper-normalize.js"

const [directory, manifestPath, approvedBuildInputsSha256] = process.argv.slice(2)
if (!directory || !manifestPath || !approvedBuildInputsSha256) {
  throw new Error("Usage: validate-openstates-scraper <archive-directory> <manifest-path> <approved-build-sha256>")
}
const rows = await normalizeArchivedScraperBills({
  store: new LocalArtifactStore(directory),
  manifestPath,
  approvedBuildInputsSha256,
  retrievedAt: new Date()
})
process.stdout.write(
  `${JSON.stringify({ status: "normalized", bills: rows.map((row) => ({ id: row.aggregate.bill.id, identifier: row.aggregate.bill.identifier })), votes: rows.reduce((count, row) => count + (row.aggregate.votes?.length ?? 0), 0), unresolvedPositions: rows.reduce((count, row) => count + row.unresolvedPositions, 0), canonicalWrites: false, productionReady: false })}\n`
)
