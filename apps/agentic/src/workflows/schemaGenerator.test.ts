import { describe, expect, it, vi } from "vitest"
import { OpenRouterWorkflowSchemaGenerator } from "./schemaGenerator"

describe("OpenRouterWorkflowSchemaGenerator", () => {
  it("requests and validates a supported schema proposal", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: "object",
                properties: { decision: { type: "string" } },
                required: ["decision"],
                additionalProperties: false
              })
            }
          }
        ]
      })
    )
    const generator = new OpenRouterWorkflowSchemaGenerator({ apiKey: "secret", fetcher })

    await expect(
      generator.generate({ modelId: "openai/gpt-5-mini", prompt: "Return an approval decision." })
    ).resolves.toEqual({
      type: "object",
      properties: { decision: { type: "string" } },
      required: ["decision"],
      additionalProperties: false
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("rejects unsupported schema proposals", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ type: "object", oneOf: [] }) } }] })
    )
    const generator = new OpenRouterWorkflowSchemaGenerator({ apiKey: "secret", fetcher })

    await expect(generator.generate({ modelId: "openai/gpt-5-mini", prompt: "Return a decision." })).rejects.toThrow()
  })
})
