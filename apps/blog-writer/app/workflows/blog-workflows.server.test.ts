import { afterEach, describe, expect, it, vi } from "vitest"
import { generateArticleImage, generateBlogIdeas } from "./blog-workflows.server"

const tenantId = "11111111-1111-4111-8111-111111111111"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("blog workflow webhooks", () => {
  it("sends a server-owned tenant and accepts a valid idea response", async () => {
    vi.stubEnv("N8N_WEBHOOK_BASE_URL", "https://n8n.example/webhook/")
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ideas: [{ idea_id: "22222222-2222-4222-8222-222222222222" }] }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      generateBlogIdeas(tenantId, "family camping", "buying-guide", "Helps a reader choose what to buy.")
    ).resolves.toEqual(["22222222-2222-4222-8222-222222222222"])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("https://n8n.example/webhook/generate-topic-ideas")
    const body = fetchMock.mock.calls[0]?.[1]?.body
    expect(body).toBeTypeOf("string")
    if (typeof body !== "string") {
      throw new TypeError("Expected the webhook request body to be a string")
    }
    expect(JSON.parse(body)).toEqual({
      tenant_id: tenantId,
      focus: "family camping",
      idea_type: "buying-guide",
      idea_type_brief: "Helps a reader choose what to buy.",
      count: 3
    })
  })

  it("rejects an empty successful response", async () => {
    vi.stubEnv("N8N_WEBHOOK_BASE_URL", "https://n8n.example/webhook/")
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 })))

    await expect(generateBlogIdeas(tenantId, "family camping", "any", "Any editorial format.")).rejects.toThrow(/JSON/u)
  })

  it("returns generated image bytes with decoded alt text", async () => {
    vi.stubEnv("N8N_WEBHOOK_BASE_URL", "https://n8n.example/webhook/")
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "Content-Type": "image/png",
          "X-Image-Alt-Text": "A%20fencer%20training"
        }
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateArticleImage(tenantId, "Training plan", "Show a fencer training")

    expect(result.altText).toBe("A fencer training")
    expect(result.file).toBeInstanceOf(File)
    expect(result.file.name).toBe("generated-image.png")
    expect(result.file.type).toBe("image/png")
    expect(result.file.size).toBe(3)
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("https://n8n.example/webhook/generate-article-image")
  })
})
