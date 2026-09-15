import { readFile, open, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "../src/ingestion/regulations/contracts.js"
import {
  compareRegulatoryEmbeddingSmoke,
  regulatoryEmbeddingSmokeSchema
} from "../src/ingestion/regulations/embedding-smoke.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    output: { type: "string" },
    split: { type: "string" },
    cache: { type: "string" },
    live: { type: "boolean", default: false }
  }
})
const manifestPath = resolve(z.string().min(1).parse(values.manifest))
invariant((await stat(manifestPath)).size <= 4 * 1024 * 1024, "embedding_manifest_byte_limit")
const body = await readFile(manifestPath, "utf8")
const source = z
  .object({
    records: z.array(z.object({ id: z.string(), versionId: z.string(), input: z.string() })),
    queries: z.array(
      z.object({
        id: z.string(),
        input: z.string(),
        relevantIds: z.array(z.string()),
        split: z.enum(["development", "held-out"]).optional()
      })
    )
  })
  .parse(JSON.parse(body))
const split = z.enum(["development", "held-out"]).optional().parse(values.split)
const queries = source.queries.filter((query) => split === undefined || query.split === split)
const manifest = regulatoryEmbeddingSmokeSchema.parse({
  records: source.records,
  queries: queries.map(({ id, input, relevantIds }) => ({ id, input, relevantIds }))
})
const scope = {
  sourceManifestHash: digest(body),
  split: split ?? "all",
  documents: manifest.records.length,
  queries: queries.length
}
if (values.live) {
  const output = resolve(z.string().min(1).parse(values.output))
  const handle = await open(output, "wx")
  try {
    const result = await compareRegulatoryEmbeddingSmoke(manifest, {
      apiKey: z.string().min(1).parse(process.env.OPENROUTER_API_KEY),
      cacheDirectory: values.cache === undefined ? undefined : resolve(values.cache)
    })
    await handle.writeFile(JSON.stringify({ ...scope, ...result }, null, 2))
  } finally {
    await handle.close()
  }
  process.stdout.write(JSON.stringify({ ...scope, output, modelSelected: false, canonicalWrites: false }))
} else {
  process.stdout.write(JSON.stringify({ ...scope, mode: "preview", externalRequests: false, modelSelected: false }))
}
