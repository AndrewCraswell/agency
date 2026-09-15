import { createHash } from "node:crypto"
import type { EmbeddingRoute } from "./embedding-routing.js"

export type EmbeddingTokenizer = { id: string; count: (text: string) => number }
type Model = EmbeddingRoute["model"]
const tokenizers = new Map<Model, Promise<EmbeddingTokenizer>>()
const checksum = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")

/** Offline, pinned vocabularies. Only token counts are used; original source strings are never decoded or normalized. */
export async function embeddingTokenizer(model: Model): Promise<EmbeddingTokenizer> {
  const existing = tokenizers.get(model)
  if (existing) {
    return existing
  }
  const loading = loadTokenizer(model)
  tokenizers.set(model, loading)
  return loading
}

async function loadTokenizer(model: Model): Promise<EmbeddingTokenizer> {
  if (model === "openai/text-embedding-3-small") {
    const [{ Tiktoken }, { default: ranks }] = await Promise.all([
      import("tiktoken/lite"),
      import("tiktoken/encoders/cl100k_base.json", { with: { type: "json" } })
    ])
    if (checksum(ranks) !== "49a4e05dea02c8fafbd50cc4725c4aab8f39386c0afedef118e0dfebc2fe523a") {
      throw new Error("embedding_tokenizer_checksum_mismatch")
    }
    const encoder = new Tiktoken(ranks.bpe_ranks, ranks.special_tokens, ranks.pat_str)
    return {
      id: "tiktoken:1.0.22:cl100k_base",
      count: (text) => encoder.encode(text, [], []).length
    }
  }
  if (model !== "voyageai/voyage-4") {
    throw new Error("unsupported_embedding_tokenizer")
  }
  const [{ Tokenizer }, { default: vocabulary }, { default: configuration }] = await Promise.all([
    import("@huggingface/tokenizers"),
    import("./tokenizers/voyage-4-tokenizer.json", { with: { type: "json" } }),
    import("./tokenizers/voyage-4-tokenizer_config.json", { with: { type: "json" } })
  ])
  if (
    checksum(vocabulary) !== "6440fe8762298f69d122e526da960c3cbf922283f1467c142d614bdaf9b38163" ||
    checksum(configuration) !== "56a8e94e9ff68361935f33982d907311a4a2ef15d29f75a596d2fefbb5d4a41d"
  ) {
    throw new Error("embedding_tokenizer_checksum_mismatch")
  }
  const encoder = new Tokenizer(vocabulary, configuration)
  return {
    id: "huggingface-tokenizers:0.2.0:voyage-4:44f3b2ae4ddf33403ed4dd66bec3fa48ff7dbbf9",
    count: (text) => encoder.encode(text, { add_special_tokens: false }).ids.length
  }
}

export async function validateEmbeddingTokenBudget(model: Model, inputs: readonly string[]) {
  const tokenizer = await embeddingTokenizer(model)
  const counts = inputs.map((text) => tokenizer.count(text))
  // Operational headroom below provider maxima also leaves room for provider-added retrieval instructions.
  const maximumInput = model === "openai/text-embedding-3-small" ? 8000 : 31000
  const maximumBatch = model === "openai/text-embedding-3-small" ? 290000 : 310000
  if (counts.some((count) => count > maximumInput)) {
    throw new Error("embedding_input_token_limit: split before submission")
  }
  if (counts.reduce((sum, count) => sum + count, 0) > maximumBatch) {
    throw new Error("embedding_batch_token_limit: reduce batch size")
  }
  return { tokenizerId: tokenizer.id, counts }
}
