import { z } from "zod"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { AzureDocumentIntelligenceClient } from "../src/ingestion/documents/ocr-client.js"
import { processStateContentBatch, stateContentScope } from "../src/ingestion/openstates/state-content.js"

const state = stateContentScope.parse(process.argv[2])
const session = process.argv[5]
const billConcurrency = z.coerce
  .number()
  .int()
  .min(1)
  .max(4)
  .parse(process.argv[3] ?? 2)
const billLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(10)
  .parse(process.argv[4] ?? 8)
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
})
const { database, pool } = createDatabase(config.database)
try {
  const startedAt = performance.now()
  const result = await processStateContentBatch(
    { config, database, correlationId: `state-content-${state}-${Date.now()}` },
    {
      state,
      session,
      billConcurrency,
      billLimit,
      ...(config.ocr.endpoint ? { ocr: new AzureDocumentIntelligenceClient(config.ocr.endpoint) } : {}),
      artifactStore: new LocalArtifactStore("artifacts/openstates-runtime/content-canary")
    }
  )
  process.stdout.write(
    `${JSON.stringify({ state, billConcurrency, elapsedSeconds: (performance.now() - startedAt) / 1000, ...result, productionWrites: false })}\n`
  )
  if (result.status !== "succeeded") {
    process.exitCode = 1
  }
} finally {
  await pool.end()
}
