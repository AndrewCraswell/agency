import { createDatabase } from "@repo/legislation-core/database/database"
import { supportingMaterials } from "@repo/legislation-core/database/schema/schema"
import { jurisdictionId } from "@repo/legislation-core/domain/identifiers"
import { eq } from "drizzle-orm"
import { loadConfig } from "../../src/config/config.js"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { processPendingSupportingMaterials } from "../../src/ingestion/documents/supporting-material-jobs.js"
import { crawlNcDocumentLibrary } from "../../src/ingestion/openstates/nc-document-library-crawl.js"

const [siteId, rootFolder, runId, limitText = "5", ...extra] = process.argv.slice(2)
const limit = Number(limitText)
if (
  !siteId ||
  !rootFolder ||
  !runId ||
  !/^[a-z0-9-]{1,80}$/.test(runId) ||
  extra.length ||
  !Number.isSafeInteger(limit) ||
  limit < 1 ||
  limit > 20
) {
  throw new Error("Expected site, root, retained crawl ID, and processing limit (1-20)")
}
const retained = new LocalArtifactStore(`artifacts/openstates-runtime/nc-document-library-crawls/${runId}`)
const inventory = await crawlNcDocumentLibrary({
  siteId,
  rootFolder,
  store: retained,
  maxRequests: 1,
  maxFolders: 500,
  fetcher: async () => {
    throw new Error("Import requires a complete retained crawl; live discovery is disabled")
  }
})
if (!inventory.complete) {
  throw new Error("Incomplete library inventory")
}
const files = new Map<string, { id: string; name: string; url: string }>()
for (const page of inventory.pages) {
  for (const file of page.files) {
    const previous = files.get(file.id)
    if (previous && (previous.name !== file.name || previous.url !== file.url)) {
      throw new Error(`Conflicting publisher file ${file.id}`)
    }
    files.set(file.id, file)
  }
}
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
})
const { database, pool } = createDatabase(config.database)
try {
  // Keep missing meeting/date/type facts null or unclassified. File titles alone do not establish them.
  await database.transaction(async (transaction) => {
    for (const file of files.values()) {
      await transaction
        .insert(supportingMaterials)
        .values({
          id: `material:ncleg:file:${file.id}`,
          jurisdictionId: jurisdictionId("nc"),
          sourceId: `ncleg:file:${file.id}`,
          classification: "other",
          title: file.name,
          sourceUrl: file.url
        })
        .onConflictDoNothing({ target: supportingMaterials.id })
      const [stored] = await transaction
        .select({ title: supportingMaterials.title, url: supportingMaterials.sourceUrl })
        .from(supportingMaterials)
        .where(eq(supportingMaterials.id, `material:ncleg:file:${file.id}`))
      if (stored?.title !== file.name || stored.url !== file.url) {
        throw new Error(`Publisher metadata changed for ${file.id}; reconcile source evidence before processing`)
      }
    }
  })
  let attempted = 0
  for (const file of files.values()) {
    const materialId = `material:ncleg:file:${file.id}`
    const [record] = await database
      .select({ status: supportingMaterials.processingStatus })
      .from(supportingMaterials)
      .where(eq(supportingMaterials.id, materialId))
    if (record?.status !== "pending") {
      continue
    }
    const result = await processPendingSupportingMaterials(database, {
      materialId,
      concurrency: 1,
      limit: 1,
      timeoutMs: 25000,
      artifactStore: new LocalArtifactStore("artifacts/openstates-runtime/content-canary")
    })
    process.stdout.write(JSON.stringify({ materialId, ...result, productionWrites: false }) + "\n")
    if (++attempted >= limit) {
      break
    }
  }
  process.stdout.write(JSON.stringify({ inventoried: files.size, attempted, productionWrites: false }) + "\n")
} finally {
  await pool.end()
}
