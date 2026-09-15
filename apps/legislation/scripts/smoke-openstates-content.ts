import { and, eq, like } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"
import { billDocuments } from "../src/db/schema/schema.js"
import { drainBillDocuments, drainEmbeddings } from "../src/ingestion/backfill/derived.js"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"

// Explicit local configuration: never inherit a production database or artifact destination.
const state = z.enum(["nc", "ak"]).parse(process.argv[2])
const status = z.enum(["pending", "failed"]).parse(process.argv[3] ?? "pending")
const stage = z.enum(["documents", "embeddings"]).parse(process.argv[4] ?? "documents")
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test",
  ...(stage === "embeddings" ? { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY } : {})
})
const { database, pool } = createDatabase(config.database)
try {
  const input = { config, database, correlationId: `state-content-canary-${state}-${Date.now()}` }
  const selected =
    stage === "embeddings"
      ? await database.query.billDocuments.findFirst({
          columns: { billId: true, id: true },
          where: and(
            eq(billDocuments.processingStatus, "processed"),
            like(billDocuments.billId, `bill:${state}:${state === "nc" ? "2025" : "34"}:%`)
          ),
          orderBy: billDocuments.id
        })
      : undefined
  if (stage === "embeddings" && !selected) {
    throw new Error("Process a source-backed document before the embedding canary")
  }
  const result = selected
    ? await drainEmbeddings(input, {
        billId: selected.billId,
        documentId: selected.id,
        products: ["bills", "sections"],
        batchSize: 4,
        maxBatches: 1
      })
    : await drainBillDocuments(
        input,
        { jurisdictionId: `jurisdiction:${state}`, batchSize: 1, maxBatches: 1, status },
        { artifactStore: new LocalArtifactStore("artifacts/openstates-runtime/content-canary") }
      )
  process.stdout.write(`${JSON.stringify({ state, stage, ...result, productionWrites: false })}\n`)
  if (result.counts.failed > 0) {
    process.exitCode = 1
  }
} finally {
  await pool.end()
}
