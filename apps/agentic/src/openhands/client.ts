import { randomUUID } from "node:crypto"
import OpenAI from "openai"
import { z } from "zod"
import type { OpenHandsModelProfile } from "./profiles"

const ConversationIdSchema = z.uuid()
const ProfileMutationSchema = z
  .object({
    name: z.string().min(1),
    message: z.string().min(1)
  })
  .strict()
const ConversationInfoSchema = z
  .object({
    id: z.uuid(),
    execution_status: z.enum(["idle", "running", "finished", "error", "stuck", "paused", "waiting_for_confirmation"])
  })
  .passthrough()
const AgentResponseSchema = z.object({ response: z.string() }).strict()

export type OpenHandsFailureClassification =
  | "authentication"
  | "startup"
  | "model"
  | "timeout"
  | "malformed_response"
  | "cancelled"

export class OpenHandsError extends Error {
  readonly classification: OpenHandsFailureClassification
  readonly retryable: boolean

  constructor(
    classification: OpenHandsFailureClassification,
    message: string,
    options?: { cause?: unknown; retryable?: boolean }
  ) {
    super(message, { cause: options?.cause })
    this.name = "OpenHandsError"
    this.classification = classification
    this.retryable = options?.retryable ?? false
  }
}

export interface OpenHandsChatRequest {
  systemPrompt: string
  userPrompt: string
  conversationId?: string
  signal?: AbortSignal
}

export interface OpenHandsChatResult {
  conversationId: string
  finalResponse: string
  usage: {
    promptTokens: number | null
    completionTokens: number | null
  }
}

export interface OpenHandsFollowUpRequest {
  conversationId: string
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}

interface GatewayCompletionRequest {
  model: string
  messages: Array<{ role: "system" | "user"; content: string }>
  conversationId?: string
}

interface GatewayCompletionResult {
  conversationId: string | null
  content: string | null
  promptTokens: number | null
  completionTokens: number | null
}

export interface OpenHandsGatewayPort {
  listModelIds(): Promise<string[]>
  complete(request: GatewayCompletionRequest): Promise<GatewayCompletionResult>
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}

class OpenAIGateway implements OpenHandsGatewayPort {
  readonly #client: OpenAI

  constructor(baseUrl: string, sessionApiKey: string, timeoutMs: number) {
    this.#client = new OpenAI({
      apiKey: sessionApiKey,
      baseURL: `${baseUrl.replace(/\/$/u, "")}/v1`,
      timeout: timeoutMs,
      maxRetries: 0
    })
  }

  async listModelIds(): Promise<string[]> {
    const models = await this.#client.models.list()
    return models.data.map((model) => model.id)
  }

  async complete(request: GatewayCompletionRequest): Promise<GatewayCompletionResult> {
    const extraHeaders =
      request.conversationId === undefined ? undefined : { "X-OpenHands-ServerConversation-ID": request.conversationId }
    const result = await this.#client.chat.completions
      .create(
        {
          model: request.model,
          messages: request.messages,
          stream: false
        },
        { headers: extraHeaders }
      )
      .withResponse()

    return {
      conversationId: result.response.headers.get("x-openhands-serverconversation-id"),
      content: result.data.choices[0]?.message.content ?? null,
      promptTokens: result.data.usage?.prompt_tokens ?? null,
      completionTokens: result.data.usage?.completion_tokens ?? null
    }
  }
}

export interface OpenHandsClientOptions {
  baseUrl: string
  sessionApiKey: string
  timeoutMs: number
  maxIterations: number
  profile: OpenHandsModelProfile
}

export class OpenHandsClient {
  readonly #baseUrl: string
  readonly #sessionApiKey: string
  readonly #timeoutMs: number
  readonly #maxIterations: number
  readonly #profile: OpenHandsModelProfile
  readonly #fetcher: Fetcher
  readonly #gateway: OpenHandsGatewayPort
  #providerApiKey: string | null = null

  constructor(
    options: OpenHandsClientOptions,
    dependencies?: {
      fetcher?: Fetcher
      gateway?: OpenHandsGatewayPort
    }
  ) {
    this.#baseUrl = options.baseUrl.replace(/\/$/u, "")
    this.#sessionApiKey = options.sessionApiKey
    this.#timeoutMs = options.timeoutMs
    this.#maxIterations = options.maxIterations
    this.#profile = options.profile
    this.#fetcher = dependencies?.fetcher ?? fetch
    this.#gateway = dependencies?.gateway ?? new OpenAIGateway(this.#baseUrl, this.#sessionApiKey, this.#timeoutMs)
  }

  get gatewayModel(): string {
    return `openhands_${this.#profile.name}`
  }

  async configureProfile(providerApiKey: string): Promise<void> {
    let response: Response
    try {
      response = await this.#fetcher(`${this.#baseUrl}/api/profiles/${encodeURIComponent(this.#profile.name)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-API-Key": this.#sessionApiKey
        },
        body: JSON.stringify({
          llm: {
            model: this.#profile.model,
            base_url: this.#profile.baseUrl,
            api_key: providerApiKey,
            reasoning_effort: this.#profile.reasoningEffort,
            caching_prompt: true,
            usage_id: this.#profile.usageId
          },
          include_secrets: true
        }),
        signal: AbortSignal.timeout(this.#timeoutMs)
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new OpenHandsError("timeout", "OpenHands profile creation timed out", {
          cause: error,
          retryable: true
        })
      }
      throw new OpenHandsError("startup", "OpenHands profile creation request failed", {
        cause: error,
        retryable: true
      })
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenHandsError("authentication", "OpenHands rejected the session API key")
    }
    if (!response.ok) {
      throw new OpenHandsError("model", `OpenHands rejected the model profile with status ${response.status}`)
    }

    const parsed = ProfileMutationSchema.safeParse(await response.json())
    if (!parsed.success || parsed.data.name !== this.#profile.name) {
      throw new OpenHandsError("malformed_response", "OpenHands returned a malformed profile response")
    }
    this.#providerApiKey = providerApiKey
  }

  async verifyProfile(): Promise<void> {
    let modelIds: string[]
    try {
      modelIds = await this.#gateway.listModelIds()
    } catch (error) {
      throw this.#classifyGatewayError(error, "listing OpenHands models")
    }

    if (!modelIds.includes(this.gatewayModel)) {
      throw new OpenHandsError("model", `OpenHands gateway model ${this.gatewayModel} is unavailable`)
    }
  }

  async chat(request: OpenHandsChatRequest): Promise<OpenHandsChatResult> {
    if (this.#providerApiKey === null) {
      throw new OpenHandsError("model", "OpenHands model profile must be configured before chat")
    }
    const conversationId = ConversationIdSchema.parse(request.conversationId ?? randomUUID())
    if (isAborted(request.signal)) {
      throw new OpenHandsError("cancelled", "OpenHands conversation was cancelled")
    }
    const started = await this.#nativeRequest("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        agent_settings: {
          agent_kind: "llm",
          llm: {
            model: this.#profile.model,
            base_url: this.#profile.baseUrl,
            api_key: this.#providerApiKey,
            reasoning_effort: this.#profile.reasoningEffort,
            caching_prompt: true,
            usage_id: this.#profile.usageId
          },
          tools: null,
          system_message_suffix: request.systemPrompt
        },
        workspace: { kind: "LocalWorkspace", working_dir: "/workspace/repository" },
        initial_message: {
          role: "user",
          content: [{ type: "text", text: request.userPrompt }],
          run: true
        },
        max_iterations: this.#maxIterations,
        autotitle: false
      }),
      signal: request.signal
    })
    const initial = ConversationInfoSchema.safeParse(await started.json())
    if (!initial.success || initial.data.id !== conversationId) {
      throw new OpenHandsError("malformed_response", "OpenHands returned malformed conversation state")
    }

    const deadline = Date.now() + this.#timeoutMs
    let conversation = initial.data
    while (conversation.execution_status === "idle" || conversation.execution_status === "running") {
      if (isAborted(request.signal)) {
        await this.#nativeRequest(`/api/conversations/${conversationId}/interrupt`, { method: "POST" }).catch(
          () => undefined
        )
        throw new OpenHandsError("cancelled", "OpenHands conversation was cancelled")
      }
      if (Date.now() >= deadline) {
        await this.#nativeRequest(`/api/conversations/${conversationId}/interrupt`, { method: "POST" }).catch(
          () => undefined
        )
        throw new OpenHandsError("timeout", "Timed out while running the OpenHands conversation", {
          retryable: true
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      const status = await this.#nativeRequest(`/api/conversations/${conversationId}`, { signal: request.signal })
      const parsed = ConversationInfoSchema.safeParse(await status.json())
      if (!parsed.success) {
        throw new OpenHandsError("malformed_response", "OpenHands returned malformed conversation state")
      }
      conversation = parsed.data
    }
    if (conversation.execution_status !== "finished") {
      throw new OpenHandsError("model", `OpenHands conversation ended with status ${conversation.execution_status}`)
    }

    const final = await this.#nativeRequest(`/api/conversations/${conversationId}/agent_final_response`)
    const response = AgentResponseSchema.safeParse(await final.json())
    if (!response.success || response.data.response.length === 0) {
      throw new OpenHandsError("malformed_response", "OpenHands returned an incomplete final response")
    }

    return {
      conversationId,
      finalResponse: response.data.response,
      usage: {
        promptTokens: null,
        completionTokens: null
      }
    }
  }

  async followUp(request: OpenHandsFollowUpRequest): Promise<OpenHandsChatResult> {
    if (this.#providerApiKey === null) {
      throw new OpenHandsError("model", "OpenHands model profile must be configured before follow-up")
    }
    const conversationId = ConversationIdSchema.parse(request.conversationId)
    if (isAborted(request.signal)) {
      throw new OpenHandsError("cancelled", "OpenHands conversation was cancelled")
    }

    let result: GatewayCompletionResult
    try {
      result = await this.#gateway.complete({
        model: this.gatewayModel,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt }
        ],
        conversationId
      })
    } catch (error) {
      if (isAborted(request.signal)) {
        throw new OpenHandsError("cancelled", "OpenHands conversation was cancelled", { cause: error })
      }
      throw this.#classifyGatewayError(error, "continuing the OpenHands conversation")
    }
    if (result.conversationId !== conversationId || result.content === null || result.content.length === 0) {
      throw new OpenHandsError("malformed_response", "OpenHands returned an incomplete follow-up response")
    }
    return {
      conversationId,
      finalResponse: result.content,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens
      }
    }
  }

  async #nativeRequest(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response
    try {
      response = await this.#fetcher(`${this.#baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
          "X-Session-API-Key": this.#sessionApiKey,
          ...init.headers
        },
        signal: AbortSignal.timeout(Math.min(this.#timeoutMs, 30_000))
      })
    } catch (error) {
      if (init.signal?.aborted === true) {
        throw new OpenHandsError("cancelled", "OpenHands request was cancelled", { cause: error })
      }
      throw new OpenHandsError("startup", "OpenHands native request failed", { cause: error, retryable: true })
    }
    if (response.status === 401 || response.status === 403) {
      throw new OpenHandsError("authentication", "OpenHands rejected the session API key")
    }
    if (!response.ok) {
      throw new OpenHandsError("startup", `OpenHands native request failed with status ${response.status}`, {
        retryable: response.status >= 500
      })
    }
    return response
  }

  #classifyGatewayError(error: unknown, action: string): OpenHandsError {
    if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
      return new OpenHandsError("authentication", `Authentication failed while ${action}`, { cause: error })
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new OpenHandsError("timeout", `Timed out while ${action}`, { cause: error, retryable: true })
    }
    if (error instanceof OpenAI.APIConnectionError || error instanceof OpenAI.InternalServerError) {
      return new OpenHandsError("startup", `OpenHands was unavailable while ${action}`, {
        cause: error,
        retryable: true
      })
    }

    return new OpenHandsError("model", `OpenHands failed while ${action}`, { cause: error })
  }
}
