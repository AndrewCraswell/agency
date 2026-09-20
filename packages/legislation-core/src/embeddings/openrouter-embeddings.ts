import {
  isTransientHttpStatus,
  isTransientRequestFailure,
  waitForRequestRetry
} from "@repo/legislation-core/api-client/request-retry"
import { EMBEDDING_ROUTES, type EmbeddingRoute } from "@repo/legislation-core/embeddings/embedding-routing"
import { validateEmbeddingTokenBudget } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { z } from "zod"

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
  signal?: AbortSignal
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
  readonly #signal: AbortSignal | undefined

  constructor(options: OpenRouterEmbeddingClientOptions) {
    this.#apiKey = options.apiKey
    const configuredBaseUrl = options.baseUrl ?? new URL("https://openrouter.ai/api/v1/")
    this.#baseUrl = new URL(`${configuredBaseUrl.href.replace(/\/+$/, "")}/`)
    this.#fetch = options.fetch ?? fetch
    this.#maximumAttempts = z
      .number()
      .int()
      .min(1)
      .max(10)
      .parse(options.maximumAttempts ?? 3)
    this.#route = options.route ?? DEFAULT_EMBEDDING_ROUTE
    this.#timeoutMs = z
      .number()
      .int()
      .min(1)
      .max(300_000)
      .parse(options.timeoutMs ?? 30_000)
    this.#signal = options.signal
  }

  get metrics(): Readonly<EmbeddingClientMetrics> {
    return { ...this.#metrics }
  }

  async #waitForRetry(attempt: number, inputCount: number) {
    this.#metrics.retries += 1
    try {
      await waitForRequestRetry(attempt, this.#signal)
    } catch (error) {
      this.#metrics.failed += inputCount
      throw error
    }
  }

  async embed(values: string[], inputType: "document" | "query" = "document"): Promise<EmbeddingResult> {
    this.#signal?.throwIfAborted()
    const input = [...values]
    if (input.length < 1 || input.length > MAXIMUM_BATCH_SIZE || input.some((value) => value.trim().length === 0)) {
      throw new Error(`Embedding batch must contain 1 to ${MAXIMUM_BATCH_SIZE} nonempty inputs`)
    }
    if (input.some((value) => value.length > MAX_EMBEDDING_INPUT_CHARACTERS)) {
      throw new Error(
        `Embedding inputs exceed ${MAX_EMBEDDING_INPUT_CHARACTERS} characters; split them before submission`
      )
    }
    if (input.some((value) => !value.isWellFormed())) {
      throw new Error("Embedding inputs must contain well-formed Unicode")
    }
    await validateEmbeddingTokenBudget(this.#route.model, input)
    this.#signal?.throwIfAborted()
    this.#metrics.batches += 1
    this.#metrics.requested += input.length
    // Freeze once: every retry must embed exactly the text the caller hashed, even if its array changes.
    const requestBody = JSON.stringify({
      ...(this.#route.dimensionsParameter ? { dimensions: this.#route.dimensions } : {}),
      encoding_format: "float",
      input,
      ...(this.#route.documentInputType
        ? { input_type: inputType === "query" ? this.#route.queryInputType : this.#route.documentInputType }
        : {}),
      model: this.#route.model,
      provider: { allow_fallbacks: false, data_collection: "deny" }
    })

    for (let attempt = 1; attempt <= this.#maximumAttempts; attempt += 1) {
      let response: Response
      let body: string
      this.#signal?.throwIfAborted()
      const timeout = AbortSignal.timeout(this.#timeoutMs)
      const signal = this.#signal ? AbortSignal.any([this.#signal, timeout]) : timeout
      try {
        response = await this.#fetch(new URL("embeddings", this.#baseUrl), {
          body: requestBody,
          headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
          method: "POST",
          signal
        })
        // The request deadline also covers receiving the body, not just headers.
        if (response.ok) {
          body = await response.text()
        } else {
          await response.body?.cancel().catch(() => undefined)
          body = ""
        }
        signal.throwIfAborted()
      } catch (error) {
        if (
          this.#signal?.aborted ||
          (!timeout.aborted && !isTransientRequestFailure(error)) ||
          attempt === this.#maximumAttempts
        ) {
          this.#metrics.failed += input.length
          this.#signal?.throwIfAborted()
          throw error
        }
        await this.#waitForRetry(attempt, input.length)
        continue
      }

      if (response.ok) {
        const result = responseSchema.parse(JSON.parse(body))
        const providerModel = this.#route.model.split("/").at(-1)
        if (result.model !== this.#route.model && result.model !== providerModel) {
          throw new Error("Embedding response used unexpected model")
        }
        const ordered = result.data.toSorted((left, right) => left.index - right.index)
        if (ordered.some((item, index) => item.index !== index)) {
          this.#metrics.failed += input.length
          throw new Error("Embedding response indices must cover each input exactly once")
        }
        const embeddings = ordered.map((item) => item.embedding)
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

      const retryable = isTransientHttpStatus(response.status)
      if (response.status === 429) {
        this.#metrics.rateLimited += 1
      }
      if (!retryable || attempt === this.#maximumAttempts) {
        this.#metrics.failed += input.length
        throw new Error(`OpenRouter embedding request failed with HTTP ${response.status}`)
      }
      await this.#waitForRetry(attempt, input.length)
    }

    throw new Error("OpenRouter embedding request exhausted retries")
  }
}
