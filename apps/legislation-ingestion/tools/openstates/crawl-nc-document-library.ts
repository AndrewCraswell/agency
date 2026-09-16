import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { crawlNcDocumentLibrary } from "../../src/ingestion/openstates/nc-document-library-crawl.js"

const [siteId, rootFolder, runId, requestLimit = "5", ...extra] = process.argv.slice(2)
if (!siteId || !rootFolder || !runId || !/^[a-z0-9-]{1,80}$/.test(runId) || extra.length) {
  throw new Error("Expected site, root folder, crawl ID, and optional request limit")
}
const result = await crawlNcDocumentLibrary({
  siteId,
  rootFolder,
  maxRequests: Number(requestLimit),
  maxFolders: 500,
  store: new LocalArtifactStore(`artifacts/openstates-runtime/nc-document-library-crawls/${runId}`)
})
process.stdout.write(JSON.stringify({ ...result, productionWrites: false }) + "\n")
