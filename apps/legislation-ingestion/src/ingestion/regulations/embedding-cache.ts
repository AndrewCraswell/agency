import { randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir, link, rm, stat } from "node:fs/promises"
import { join } from "node:path"
import type { EmbeddingRoute } from "@repo/legislation-core/embeddings/embedding-routing"
import {
  MAX_EMBEDDING_INPUT_CHARACTERS,
  type OpenRouterEmbeddingClient
} from "@repo/legislation-core/embeddings/openrouter-embeddings"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"

const cachedSchema = z.strictObject({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  vectorHash: z.string().regex(/^[a-f0-9]{64}$/),
  vector: z.array(z.number())
})
const contract = "regulatory-embedding-diagnostic-cache"

/** Local diagnostic cache only. Each immutable entry binds the full input and vector-space contract. */
export async function embedCachedRegulatoryInputs(input: {
  directory?: string
  route: EmbeddingRoute
  client: OpenRouterEmbeddingClient
  texts: string[]
  inputType: "document" | "query"
}) {
  const texts = z
    .array(
      z
        .string()
        .min(1)
        .max(MAX_EMBEDDING_INPUT_CHARACTERS)
        .refine((text) => text.trim().length > 0)
    )
    .min(1)
    .max(64)
    .parse(input.texts)
  const { route, directory, inputType } = input
  const keys = texts.map((text) =>
    digest(
      JSON.stringify([
        contract,
        route.model,
        route.dimensions,
        route.dimensionsParameter ?? false,
        route.embeddingInputContract,
        inputType,
        route.documentInputType ?? null,
        route.queryInputType ?? null,
        text
      ])
    )
  )
  const vectors = new Map<string, number[]>()
  const validate = (vector: number[]) => {
    const norm = Math.hypot(...vector)
    invariant(
      vector.length === route.dimensions && vector.every(Number.isFinite) && Number.isFinite(norm) && norm > 0,
      "regulatory_embedding_cache_invalid_vector"
    )
    return vector
  }
  if (directory !== undefined) {
    await mkdir(directory, { recursive: true })
    for (const key of new Set(keys)) {
      let bytes: string
      try {
        invariant(
          (await stat(join(directory, `${key}.json`))).size <= 128 * 1024,
          "regulatory_embedding_cache_entry_limit"
        )
        bytes = await readFile(join(directory, `${key}.json`), "utf8")
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          continue
        }
        throw error
      }
      invariant(Buffer.byteLength(bytes) <= 128 * 1024, "regulatory_embedding_cache_entry_limit")
      const entry = cachedSchema.parse(JSON.parse(bytes))
      invariant(entry.key === key, "regulatory_embedding_cache_key_mismatch")
      invariant(
        entry.vectorHash === digest(JSON.stringify(entry.vector)),
        "regulatory_embedding_cache_checksum_mismatch"
      )
      vectors.set(key, validate(entry.vector))
    }
  }
  const cacheHits = keys.filter((key) => vectors.has(key)).length
  const missing = [...new Set(keys)].filter((key) => !vectors.has(key))
  let tokens: number | undefined = 0
  if (missing.length > 0) {
    const result = await input.client.embed(
      missing.map((key) => {
        const text = texts[keys.indexOf(key)]
        invariant(text !== undefined, "regulatory_embedding_cache_input_missing")
        return text
      }),
      inputType
    )
    invariant(result.model === route.model, "regulatory_embedding_cache_model_mismatch")
    tokens = result.totalTokens
    invariant(result.embeddings.length === missing.length, "regulatory_embedding_cache_response_count")
    for (const vector of result.embeddings) {
      validate(vector)
    }
    for (const [index, key] of missing.entries()) {
      const vector = result.embeddings[index]
      invariant(vector, "regulatory_embedding_cache_vector_missing")
      if (directory !== undefined) {
        const target = join(directory, `${key}.json`)
        const temporary = join(directory, `${randomUUID()}.tmp`)
        const body = JSON.stringify({ key, vectorHash: digest(JSON.stringify(vector)), vector })
        try {
          await writeFile(temporary, body, { flag: "wx", flush: true })
          try {
            await link(temporary, target)
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
              throw error
            }
            invariant((await readFile(target, "utf8")) === body, "regulatory_embedding_cache_conflict")
          }
        } finally {
          await rm(temporary, { force: true })
        }
      }
      vectors.set(key, vector)
    }
  }
  return {
    embeddings: keys.map((key) => {
      const vector = vectors.get(key)
      invariant(vector, "regulatory_embedding_cache_missing_result")
      return vector
    }),
    totalTokens: tokens,
    cacheHits,
    deduplicatedInputs: keys.length - new Set(keys).size
  }
}
