import { z } from "zod"
import {
  embeddingQueryRouteFor,
  embeddingRouteFor,
  type EmbeddingRouteProduct,
  type EmbeddingSearchTool
} from "./embedding-routing.js"
import { OpenRouterEmbeddingClient } from "./openrouter-embeddings.js"

const rerankResponseSchema = z.object({
  results: z.array(z.object({ index: z.number().int().nonnegative(), relevance_score: z.number() }))
})

export interface RerankCandidate {
  id: string
  text: string
}

export interface RerankedCandidate extends RerankCandidate {
  relevanceScore: number
}

export interface RetrievalModelClient {
  embed(product: EmbeddingRouteProduct, input: string[]): Promise<{ embeddings: number[][]; model: string }>
  rerank(tool: EmbeddingSearchTool, query: string, candidates: RerankCandidate[]): Promise<RerankedCandidate[]>
}

export interface OpenRouterRetrievalClientOptions {
  apiKey: string
  baseUrl?: URL
  fetch?: typeof fetch
  maximumAttempts?: number
  timeoutMs?: number
}

export class OpenRouterRetrievalClient implements RetrievalModelClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #embeddingClients = new Map<EmbeddingRouteProduct, OpenRouterEmbeddingClient>()
  readonly #fetch: typeof fetch
  readonly #maximumAttempts: number
  readonly #timeoutMs: number

  constructor(options: OpenRouterRetrievalClientOptions) {
    this.#apiKey = options.apiKey
    const configuredBaseUrl = options.baseUrl ?? new URL("https://openrouter.ai/api/v1/")
    this.#baseUrl = new URL(`${configuredBaseUrl.href.replace(/\/+$/, "")}/`)
    this.#fetch = options.fetch ?? fetch
    this.#maximumAttempts = options.maximumAttempts ?? 3
    this.#timeoutMs = options.timeoutMs ?? 30_000
  }

  async embed(product: EmbeddingRouteProduct, input: string[]) {
    let client = this.#embeddingClients.get(product)
    if (client === undefined) {
      client = new OpenRouterEmbeddingClient({
        apiKey: this.#apiKey,
        baseUrl: this.#baseUrl,
        fetch: this.#fetch,
        maximumAttempts: this.#maximumAttempts,
        route: embeddingRouteFor(product),
        timeoutMs: this.#timeoutMs
      })
      this.#embeddingClients.set(product, client)
    }
    return client.embed(input, "query")
  }

  async rerank(tool: EmbeddingSearchTool, query: string, candidates: RerankCandidate[]): Promise<RerankedCandidate[]> {
    const rerank = embeddingQueryRouteFor(tool).rerank
    if (rerank === undefined) {
      throw new Error(`${tool} does not have a reranking route`)
    }
    if (candidates.length < 1 || candidates.length > rerank.candidateLimit) {
      throw new Error(`Reranking requires 1 to ${rerank.candidateLimit} candidates`)
    }
    const bounded = candidates.map((candidate) => ({
      ...candidate,
      text: candidate.text.slice(0, rerank.inputMaximumCharacters)
    }))
    for (let attempt = 1; attempt <= this.#maximumAttempts; attempt += 1) {
      const response = await this.#fetch(new URL("rerank", this.#baseUrl), {
        body: JSON.stringify({
          documents: bounded.map((candidate) => candidate.text),
          model: rerank.model,
          provider: { allow_fallbacks: false, data_collection: "deny" },
          query,
          top_n: bounded.length
        }),
        headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(this.#timeoutMs)
      })
      if (response.ok) {
        const parsed = rerankResponseSchema.parse(await response.json())
        return parsed.results.flatMap((result) => {
          const candidate = bounded[result.index]
          return candidate === undefined ? [] : [{ ...candidate, relevanceScore: result.relevance_score }]
        })
      }
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === this.#maximumAttempts) {
        const detail = (await response.text()).replaceAll(/\s+/g, " ").trim().slice(0, 500)
        throw new Error(
          `OpenRouter rerank request failed with HTTP ${response.status}${detail.length === 0 ? "" : `: ${detail}`}`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** (attempt - 1), 2_000)))
    }
    throw new Error("OpenRouter rerank request exhausted retries")
  }
}
