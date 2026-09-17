import type {
  EmbeddingResult,
  OpenRouterEmbeddingClient
} from "@repo/legislation-core/embeddings/openrouter-embeddings"
import invariant from "tiny-invariant"
import { selectLegalEmbeddingShard } from "./vector-shards.js"
import { storeLegalEmbeddingBatch } from "./vector-storage.js"

type EmbeddingClient = Pick<OpenRouterEmbeddingClient, "embed">

/** Runs one bounded provider batch. Shard selection and storage independently revalidate exact inputs. */
export async function runLegalEmbeddingShard(
  pool: Parameters<typeof selectLegalEmbeddingShard>[0],
  input: Parameters<typeof selectLegalEmbeddingShard>[1],
  client: EmbeddingClient
) {
  const selection = await selectLegalEmbeddingShard(pool, input)
  if (selection.items.length === 0) {
    return { ...selection, inserted: 0, reused: 0, promptTokens: 0, totalTokens: 0 }
  }
  const result: EmbeddingResult = await client.embed(
    selection.items.map((item) => item.inputText),
    "document"
  )
  invariant(result.model === selection.model, "legal_embedding_provider_model_mismatch")
  invariant(result.embeddings.length === selection.items.length, "legal_embedding_provider_count_mismatch")
  const stored = await storeLegalEmbeddingBatch(pool, {
    generationId: selection.generationId,
    model: selection.model,
    items: selection.items.map((item, index) => {
      const embedding = result.embeddings[index]
      invariant(embedding, "legal_embedding_provider_count_mismatch")
      return { passageId: item.passageId, inputHash: item.inputHash, embedding }
    })
  })
  return {
    ...selection,
    ...stored,
    promptTokens: result.promptTokens,
    totalTokens: result.totalTokens
  }
}
