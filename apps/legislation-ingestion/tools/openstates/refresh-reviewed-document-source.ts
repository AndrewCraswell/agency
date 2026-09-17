import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createDatabase } from "@repo/legislation-core/database/database"
import { Command } from "commander"
import { z } from "zod"
import { loadConfig } from "../../src/config/config.js"
import { downloadDocument } from "../../src/ingestion/documents/download.js"
import { DocumentExtractionError, extractDocument } from "../../src/ingestion/documents/extract.js"
import { extractionRepairEvidence } from "../../src/ingestion/documents/extraction-repair-evidence.js"
import { requeueVerifiedExtraction } from "../../src/ingestion/documents/requeue-verified-extraction.js"
import { requireStateRepairScope } from "../../src/trigger/tasks/state-content-policy.js"

const options = new Command()
  .requiredOption("--evidence <path>", "retained reviewed source-revision evidence")
  .requiredOption("--sha256 <hash>", "checksum of the reviewed evidence file")
  .requiredOption("--database-env <name>", "target database environment variable")
  .option("--apply", "requeue the unchanged stored version after validating current publisher bytes")
  .parse()
  .opts<{ evidence: string; sha256: string; databaseEnv: string; apply?: boolean }>()
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const bytes = await readFile(options.evidence)
if (
  hash(bytes) !==
  z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(options.sha256)
) {
  throw new Error("Reviewed source evidence checksum mismatch")
}
const evidence = z
  .strictObject({
    state: z.enum(["ak", "nc"]),
    session: z.string().regex(/^[A-Za-z0-9-]+$/),
    stored: extractionRepairEvidence,
    currentSourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    reviewReason: z.string().trim().min(1)
  })
  .parse(JSON.parse(bytes.toString("utf8")))
requireStateRepairScope(evidence.state, evidence.session, [evidence.stored])
if (evidence.currentSourceSha256 === evidence.stored.sourceSha256) {
  throw new Error("Same-source extraction must use the extraction repair workflow")
}
const downloaded = await downloadDocument(evidence.stored.sourceUrl, { allowHttp: true })
if (hash(downloaded.bytes) !== evidence.currentSourceSha256) {
  throw new Error("Publisher bytes differ from the reviewed source revision")
}
let requiresOcr = false
try {
  await extractDocument(evidence.stored.documentId, downloaded.bytes, downloaded.contentType)
} catch (error) {
  if (!(error instanceof DocumentExtractionError) || error.category !== "ocr-required") throw error
  requiresOcr = true
}
let requeued = false
if (options.apply) {
  const config = loadConfig({ DATABASE_URL: z.string().min(1).parse(process.env[options.databaseEnv]) })
  const { database, pool } = createDatabase(config.database)
  try {
    // Uses the same atomic optimistic source/text/status guards as audited extraction repair.
    const result = await requeueVerifiedExtraction(database, evidence.stored)
    if (!result.requeued) throw new Error("Stored document changed or is active; no source refresh queued")
    requeued = true
  } finally {
    await pool.end()
  }
}
process.stdout.write(
  JSON.stringify({
    documentId: evidence.stored.documentId,
    previousSourceSha256: evidence.stored.sourceSha256,
    reviewedSourceSha256: evidence.currentSourceSha256,
    requiresOcr,
    requeued,
    retainedContentUntilSuccessfulProcessing: true,
    processingComplete: false
  }) + "\n"
)
