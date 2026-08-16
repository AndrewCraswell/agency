import { z } from "zod"

export const EMBEDDING_MODEL = "openai/text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1_536
const MAXIMUM_BATCH_SIZE = 64

const responseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number().int().nonnegative() })),
  model: z.string(),
  usage: z
    .object({ prompt_tokens: z.number().nonnegative().optional(), total_tokens: z.number().nonnegative().optional() })
    .optional()
})

export interface EmbeddingResult {
  embeddings: number[][]
  model: string
  promptTokens?: number
  totalTokens?: number
}

export interface OpenRouterEmbeddingClientOptions {
  apiKey: string
  baseUrl?: URL
  fetch?: typeof fetch
  maximumAttempts?: number
  timeoutMs?: number
}

export interface EmbeddingClientMetrics {
  batches: number
  created: number
  failed: number
  rateLimited: number
  requested: number
  retries: number
}

export class OpenRouterEmbeddingClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #fetch: typeof fetch
  readonly #maximumAttempts: number
  readonly #metrics: EmbeddingClientMetrics = {
    batches: 0,
    created: 0,
    failed: 0,
    rateLimited: 0,
    requested: 0,
    retries: 0
  }
  readonly #timeoutMs: number

  constructor(options: OpenRouterEmbeddingClientOptions) {
    this.#apiKey = options.apiKey
    this.#baseUrl = options.baseUrl ?? new URL("https://openrouter.ai/api/v1/")
    this.#fetch = options.fetch ?? fetch
    this.#maximumAttempts = options.maximumAttempts ?? 3
    this.#timeoutMs = options.timeoutMs ?? 30_000
  }

  get metrics(): Readonly<EmbeddingClientMetrics> {
    return { ...this.#metrics }
  }

  async embed(input: string[]): Promise<EmbeddingResult> {
    if (input.length < 1 || input.length > MAXIMUM_BATCH_SIZE || input.some((value) => value.trim().length === 0)) {
      throw new Error(`Embedding batch must contain 1 to ${MAXIMUM_BATCH_SIZE} nonempty inputs`)
    }
    this.#metrics.batches += 1
    this.#metrics.requested += input.length

    for (let attempt = 1; attempt <= this.#maximumAttempts; attempt += 1) {
      const response = await this.#fetch(new URL("embeddings", this.#baseUrl), {
        body: JSON.stringify({
          dimensions: EMBEDDING_DIMENSIONS,
          encoding_format: "float",
          input,
          model: EMBEDDING_MODEL,
          provider: { allow_fallbacks: false, data_collection: "deny" }
        }),
        headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(this.#timeoutMs)
      })

      if (response.ok) {
        const result = responseSchema.parse(await response.json())
        if (result.model !== EMBEDDING_MODEL) {
          throw new Error(`Embedding response used unexpected model ${result.model}`)
        }
        const embeddings = result.data.toSorted((left, right) => left.index - right.index).map((item) => item.embedding)
        if (
          embeddings.length !== input.length ||
          embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)
        ) {
          this.#metrics.failed += input.length
          throw new Error(`Embedding response must contain one ${EMBEDDING_DIMENSIONS}-dimensional vector per input`)
        }
        this.#metrics.created += embeddings.length
        return {
          embeddings,
          model: result.model,
          promptTokens: result.usage?.prompt_tokens,
          totalTokens: result.usage?.total_tokens
        }
      }

      const retryable = response.status === 429 || response.status >= 500
      if (response.status === 429) {
        this.#metrics.rateLimited += 1
      }
      if (!retryable || attempt === this.#maximumAttempts) {
        this.#metrics.failed += input.length
        throw new Error(`OpenRouter embedding request failed with HTTP ${response.status}`)
      }
      this.#metrics.retries += 1
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** (attempt - 1), 2_000)))
    }

    throw new Error("OpenRouter embedding request exhausted retries")
  }
}
