import { z } from "zod"
import { EMBEDDING_ROUTES, type EmbeddingRoute } from "./embedding-routing.js"

const DEFAULT_EMBEDDING_ROUTE = EMBEDDING_ROUTES["document-section"]
export const EMBEDDING_MODEL = DEFAULT_EMBEDDING_ROUTE.model
export const EMBEDDING_DIMENSIONS = DEFAULT_EMBEDDING_ROUTE.dimensions
export const MAX_EMBEDDING_INPUT_CHARACTERS = 16_000
const MAXIMUM_BATCH_SIZE = 64

export function limitEmbeddingInput(value: string): string {
  return value.slice(0, MAX_EMBEDDING_INPUT_CHARACTERS)
}

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
  route?: EmbeddingRoute
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
  readonly #route: EmbeddingRoute
  readonly #timeoutMs: number

  constructor(options: OpenRouterEmbeddingClientOptions) {
    this.#apiKey = options.apiKey
    const configuredBaseUrl = options.baseUrl ?? new URL("https://openrouter.ai/api/v1/")
    this.#baseUrl = new URL(`${configuredBaseUrl.href.replace(/\/+$/, "")}/`)
    this.#fetch = options.fetch ?? fetch
    this.#maximumAttempts = options.maximumAttempts ?? 3
    this.#route = options.route ?? DEFAULT_EMBEDDING_ROUTE
    this.#timeoutMs = options.timeoutMs ?? 30_000
  }

  get metrics(): Readonly<EmbeddingClientMetrics> {
    return { ...this.#metrics }
  }

  async embed(input: string[], inputType: "document" | "query" = "document"): Promise<EmbeddingResult> {
    if (input.length < 1 || input.length > MAXIMUM_BATCH_SIZE || input.some((value) => value.trim().length === 0)) {
      throw new Error(`Embedding batch must contain 1 to ${MAXIMUM_BATCH_SIZE} nonempty inputs`)
    }
    this.#metrics.batches += 1
    this.#metrics.requested += input.length
    const boundedInput = input.map(limitEmbeddingInput)

    for (let attempt = 1; attempt <= this.#maximumAttempts; attempt += 1) {
      const response = await this.#fetch(new URL("embeddings", this.#baseUrl), {
        body: JSON.stringify({
          ...(this.#route.dimensionsParameter ? { dimensions: this.#route.dimensions } : {}),
          encoding_format: "float",
          input: boundedInput,
          ...(this.#route.documentInputType
            ? { input_type: inputType === "query" ? this.#route.queryInputType : this.#route.documentInputType }
            : {}),
          model: this.#route.model,
          provider: { allow_fallbacks: false, data_collection: "deny" }
        }),
        headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(this.#timeoutMs)
      })

      if (response.ok) {
        const result = responseSchema.parse(await response.json())
        const providerModel = this.#route.model.split("/").at(-1)
        if (result.model !== this.#route.model && result.model !== providerModel) {
          throw new Error(`Embedding response used unexpected model ${result.model}`)
        }
        const embeddings = result.data.toSorted((left, right) => left.index - right.index).map((item) => item.embedding)
        if (
          embeddings.length !== input.length ||
          embeddings.some((embedding) => embedding.length !== this.#route.dimensions)
        ) {
          this.#metrics.failed += input.length
          throw new Error(`Embedding response must contain one ${this.#route.dimensions}-dimensional vector per input`)
        }
        this.#metrics.created += embeddings.length
        return {
          embeddings,
          model: this.#route.model,
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
        const detail = (await response.text()).replaceAll(/\s+/g, " ").trim().slice(0, 500)
        throw new Error(
          `OpenRouter embedding request failed with HTTP ${response.status}${detail.length === 0 ? "" : `: ${detail}`}`
        )
      }
      this.#metrics.retries += 1
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** (attempt - 1), 2_000)))
    }

    throw new Error("OpenRouter embedding request exhausted retries")
  }
}
