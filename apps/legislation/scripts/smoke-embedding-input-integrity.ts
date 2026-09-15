import { open } from "node:fs/promises"
import { parseArgs } from "node:util"
import { z } from "zod"
import { EMBEDDING_ROUTES } from "../src/models/embedding-routing.js"
import { embeddingTokenizer } from "../src/models/embedding-tokenizer.js"
import { OpenRouterEmbeddingClient } from "../src/models/openrouter-embeddings.js"

const { values } = parseArgs({ options: { live: { type: "boolean", default: false }, output: { type: "string" } } })
const texts = [
  "§ 1.1 The agency must retain the record for seven years.",
  "Unicode source: Déjà vu e\u0301 中文 🧭.\nNumeric values: 1234567890.",
  "An applicant shall file a complete notice.\n".repeat(80)
]
if (!values.live) {
  process.stdout.write(
    JSON.stringify({ mode: "preview", models: 2, requests: 4, syntheticInputsOnly: true, regenerateExisting: false })
  )
} else {
  const output = await open(z.string().min(1).parse(values.output), "wx")
  try {
    const apiKey = z.string().min(1).parse(process.env.OPENROUTER_API_KEY)
    const results = []
    for (const route of [EMBEDDING_ROUTES["document-section"], EMBEDDING_ROUTES.bill]) {
      const tokenizer = await embeddingTokenizer(route.model)
      const counts = texts.map((text) => tokenizer.count(text))
      const localTokens = counts.reduce((sum, count) => sum + count, 0)
      const client = new OpenRouterEmbeddingClient({ apiKey, route, maximumAttempts: 1 })
      for (const inputType of ["document", "query"] as const) {
        const start = performance.now()
        const result = await client.embed(texts, inputType)
        results.push({
          model: route.model,
          inputType,
          tokenizerId: tokenizer.id,
          counts,
          localTokens,
          providerTokens: result.totalTokens ?? result.promptTokens ?? null,
          tokenCountsMatch: (result.totalTokens ?? result.promptTokens) === localTokens,
          vectors: result.embeddings.length,
          dimensions: route.dimensions,
          elapsedMs: performance.now() - start
        })
      }
    }
    const report = { syntheticInputsOnly: true, canonicalWrites: false, existingEmbeddingsRegenerated: 0, results }
    await output.writeFile(JSON.stringify(report, null, 2))
    process.stdout.write(JSON.stringify(report))
    if (results.some((row) => !row.tokenCountsMatch)) {
      process.exitCode = 1
    }
  } finally {
    await output.close()
  }
}
