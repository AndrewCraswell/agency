import { z } from "zod"

const MAXIMUM_MODELS = 10_000
const SupportedParameterSchema = z.enum([
  "temperature",
  "top_p",
  "top_k",
  "min_p",
  "top_a",
  "frequency_penalty",
  "presence_penalty",
  "repetition_penalty",
  "seed",
  "max_tokens",
  "stop",
  "logprobs",
  "top_logprobs",
  "reasoning",
  "verbosity",
  "response_format"
])

export const WorkflowModelSnapshotSchema = z
  .object({
    modelId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    contextLength: z.number().int().positive(),
    pricing: z.object({ prompt: z.string(), completion: z.string() }).strict(),
    architecture: z.object({ inputModalities: z.array(z.string()), outputModalities: z.array(z.string()) }).strict(),
    supportedParameters: z.array(SupportedParameterSchema),
    observedAt: z.iso.datetime({ offset: true })
  })
  .strict()

const OpenRouterModelSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    context_length: z.number().int().positive(),
    pricing: z.object({ prompt: z.string(), completion: z.string() }).passthrough(),
    architecture: z
      .object({ input_modalities: z.array(z.string()).default([]), output_modalities: z.array(z.string()).default([]) })
      .passthrough(),
    supported_parameters: z.array(z.string()).default([])
  })
  .passthrough()
const OpenRouterCatalogSchema = z.object({ data: z.array(OpenRouterModelSchema).max(MAXIMUM_MODELS) }).passthrough()

export type WorkflowModelSnapshot = z.infer<typeof WorkflowModelSnapshotSchema>
export type WorkflowModelCatalogPort = Pick<OpenRouterModelCatalog, "list" | "resolve">
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function snapshot(model: z.infer<typeof OpenRouterModelSchema>, observedAt: string): WorkflowModelSnapshot {
  return WorkflowModelSnapshotSchema.parse({
    modelId: model.id,
    name: model.name,
    contextLength: model.context_length,
    pricing: { prompt: model.pricing.prompt, completion: model.pricing.completion },
    architecture: {
      inputModalities: model.architecture.input_modalities,
      outputModalities: model.architecture.output_modalities
    },
    supportedParameters: model.supported_parameters.filter(
      (parameter) => SupportedParameterSchema.safeParse(parameter).success
    ),
    observedAt
  })
}

export class OpenRouterModelCatalog {
  readonly #apiKey: string
  readonly #fetcher: Fetcher
  readonly #baseUrl: string
  readonly #now: () => Date

  constructor(options: { apiKey: string; fetcher?: Fetcher; baseUrl?: string; now?: () => Date }) {
    this.#apiKey = z.string().min(1).parse(options.apiKey)
    this.#fetcher = options.fetcher ?? fetch
    this.#baseUrl = (options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/u, "")
    this.#now = options.now ?? (() => new Date())
  }

  async list(): Promise<WorkflowModelSnapshot[]> {
    const response = await this.#fetcher(`${this.#baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.#apiKey}` }
    })
    if (!response.ok) throw new Error(`OpenRouter model catalog failed with status ${response.status}`)
    const observedAt = this.#now().toISOString()
    return OpenRouterCatalogSchema.parse(await response.json())
      .data.map((model) => snapshot(model, observedAt))
      .sort((left, right) => left.modelId.localeCompare(right.modelId))
  }

  async resolve(modelIdInput: string): Promise<WorkflowModelSnapshot> {
    const modelId = z.string().trim().min(1).parse(modelIdInput)
    const model = (await this.list()).find((candidate) => candidate.modelId === modelId)
    if (model === undefined) throw new Error(`OpenRouter model ${modelId} is unavailable`)
    return model
  }
}
