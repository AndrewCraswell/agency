import {
  isTransientHttpStatus,
  isTransientRequestFailure,
  waitForRequestRetry
} from "@repo/legislation-core/api-client/request-retry"
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
const requestTimeoutSchema = z.number().int().min(1).max(300_000).default(30_000)

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
  embeddingTimeoutMs?: number
  rerankTimeoutMs?: number
  generationTimeoutMs?: number
  signal?: AbortSignal
}

export class OpenRouterRetrievalClient implements RetrievalModelClient, ChatCompletionClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #embeddingClients = new Map<EmbeddingRouteProduct, OpenRouterEmbeddingClient>()
  readonly #fetch: typeof fetch
  readonly #maximumAttempts: number
  readonly #embeddingTimeoutMs: number
  readonly #rerankTimeoutMs: number
  readonly #generationTimeoutMs: number
  readonly #signal: AbortSignal | undefined

  constructor(options: OpenRouterRetrievalClientOptions) {
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
    this.#embeddingTimeoutMs = requestTimeoutSchema.parse(options.embeddingTimeoutMs)
    this.#rerankTimeoutMs = requestTimeoutSchema.parse(options.rerankTimeoutMs)
    this.#generationTimeoutMs = requestTimeoutSchema.parse(options.generationTimeoutMs)
    this.#signal = options.signal
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
        timeoutMs: this.#embeddingTimeoutMs,
        signal: this.#signal
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
    const body = await this.#request("rerank", {
      documents: bounded.map((candidate) => candidate.text),
      model: rerank.model,
      provider: { allow_fallbacks: false, data_collection: "deny" },
      query,
      top_n: bounded.length
    })
    const parsed = rerankResponseSchema.parse(JSON.parse(body))
    return parsed.results.flatMap((result) => {
      const candidate = bounded[result.index]
      return candidate === undefined ? [] : [{ ...candidate, relevanceScore: result.relevance_score }]
    })
  }

  async completeChat(input: ChatCompletionRequest): Promise<{
    content: string
    model: string
  }> {
    const body = await this.#request("chat/completions", {
      messages: input.messages,
      model: input.model,
      provider: { allow_fallbacks: false, data_collection: "deny" },
      response_format: input.responseFormat,
      temperature: input.temperature
    })
    const parsed = chatCompletionResponseSchema.parse(JSON.parse(body))
    const content = parsed.choices[0]?.message.content
    if (content === undefined) {
      throw new Error("OpenRouter research generation returned no content")
    }
    return { content, model: parsed.model ?? input.model }
  }

  async #request(endpoint: "rerank" | "chat/completions", input: unknown) {
    const body = JSON.stringify(input)
    const operation = endpoint === "rerank" ? "rerank request" : "research generation"
    for (let attempt = 1; attempt <= this.#maximumAttempts; attempt += 1) {
      this.#signal?.throwIfAborted()
      const timeout = AbortSignal.timeout(endpoint === "rerank" ? this.#rerankTimeoutMs : this.#generationTimeoutMs)
      const signal = this.#signal ? AbortSignal.any([this.#signal, timeout]) : timeout
      let response: Response
      let text: string
      try {
        response = await this.#fetch(new URL(endpoint, this.#baseUrl), {
          body,
          headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
          method: "POST",
          signal
        })
        if (response.ok) {
          text = await response.text()
        } else {
          await response.body?.cancel().catch(() => undefined)
          text = ""
        }
        signal.throwIfAborted()
      } catch (error) {
        this.#signal?.throwIfAborted()
        if ((!timeout.aborted && !isTransientRequestFailure(error)) || attempt === this.#maximumAttempts) {
          throw error
        }
        await waitForRequestRetry(attempt, this.#signal)
        continue
      }
      if (response.ok) {
        return text
      }
      if (!isTransientHttpStatus(response.status) || attempt === this.#maximumAttempts) {
        throw new Error(`OpenRouter ${operation} failed with HTTP ${response.status}`)
      }
      await waitForRequestRetry(attempt, this.#signal)
    }
    throw new Error(`OpenRouter ${operation} exhausted retries`)
  }
}
