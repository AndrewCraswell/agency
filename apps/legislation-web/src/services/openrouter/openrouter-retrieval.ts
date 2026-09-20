import {
  embeddingQueryRouteFor,
  embeddingRouteFor,
  type EmbeddingRouteProduct,
  type EmbeddingSearchTool
} from "@repo/legislation-core/embeddings/embedding-routing"
import { OpenRouterEmbeddingClient } from "@repo/legislation-core/embeddings/openrouter-embeddings"
import { z } from "zod"

const rerankResponseSchema = z.object({
  results: z.array(z.object({ index: z.number().int().nonnegative(), relevance_score: z.number() }))
})
const chatCompletionResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
  model: z.string().trim().min(1).optional()
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

export type ChatCompletionRequest = Readonly<{
  messages: readonly Readonly<{ content: string; role: "system" | "user" }>[]
  model: string
  responseFormat: Readonly<{ type: "json_object" }>
  temperature: number
}>

export interface ChatCompletionClient {
  completeChat(input: ChatCompletionRequest): Promise<{
    content: string
    model: string
  }>
}

export interface OpenRouterRetrievalClientOptions {
  apiKey: string
  baseUrl?: URL
  fetch?: typeof fetch
  maximumAttempts?: number
  timeoutMs?: number
}

export class OpenRouterRetrievalClient implements RetrievalModelClient, ChatCompletionClient {
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

  async completeChat(input: ChatCompletionRequest): Promise<{
    content: string
    model: string
  }> {
    const response = await this.#fetch(new URL("chat/completions", this.#baseUrl), {
      body: JSON.stringify({
        messages: input.messages,
        model: input.model,
        provider: { allow_fallbacks: false, data_collection: "deny" },
        response_format: input.responseFormat,
        temperature: input.temperature
      }),
      headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(this.#timeoutMs)
    })
    if (!response.ok) {
      const detail = (await response.text()).replaceAll(/\s+/g, " ").trim().slice(0, 500)
      throw new Error(
        `OpenRouter research generation failed with HTTP ${response.status}${detail.length === 0 ? "" : `: ${detail}`}`
      )
    }
    const parsed = chatCompletionResponseSchema.parse(await response.json())
    const content = parsed.choices[0]?.message.content
    if (content === undefined) {
      throw new Error("OpenRouter research generation returned no content")
    }
    return { content, model: parsed.model ?? input.model }
  }
}
