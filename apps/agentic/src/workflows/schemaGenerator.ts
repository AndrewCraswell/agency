import { z } from "zod"
import { SupportedJsonSchemaSchema, type SupportedJsonSchema } from "./jsonSchema"

const SchemaGenerationInputSchema = z
  .object({ modelId: z.string().trim().min(1).max(200), prompt: z.string().trim().min(1).max(8_000) })
  .strict()
const OpenRouterResponseSchema = z
  .object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1) })
  .passthrough()

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type WorkflowSchemaGenerator = (input: unknown) => Promise<SupportedJsonSchema>

export class OpenRouterWorkflowSchemaGenerator {
  readonly #apiKey: string
  readonly #fetcher: Fetcher
  readonly #baseUrl: string

  constructor(options: { apiKey: string; fetcher?: Fetcher; baseUrl?: string }) {
    this.#apiKey = z.string().min(1).parse(options.apiKey)
    this.#fetcher = options.fetcher ?? fetch
    this.#baseUrl = (options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/u, "")
  }

  async generate(inputValue: unknown): Promise<SupportedJsonSchema> {
    const input = SchemaGenerationInputSchema.parse(inputValue)
    const response = await this.#fetcher(`${this.#baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.#apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.modelId,
        messages: [
          {
            role: "system",
            content:
              "Create one JSON Schema for the requested output. Return only the schema object. Use only: type, enum, const, properties, required, items, additionalProperties, minimum, maximum, minLength, maxLength, minItems, maxItems, format, default, description."
          },
          { role: "user", content: input.prompt }
        ],
        response_format: { type: "json_object" },
        provider: { require_parameters: true },
        temperature: 0
      })
    })
    if (!response.ok) {
      throw new Error(`OpenRouter schema generation failed with status ${response.status}`)
    }
    const content = OpenRouterResponseSchema.parse(await response.json()).choices[0]?.message.content
    if (content === undefined || content === null || content.trim() === "") {
      throw new Error("OpenRouter returned an empty schema proposal")
    }
    return SupportedJsonSchemaSchema.parse(JSON.parse(content))
  }
}
