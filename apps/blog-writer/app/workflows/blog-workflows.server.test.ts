import { afterEach, describe, expect, it, vi } from "vitest"
import { generateBlogIdeas } from "./blog-workflows.server"

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
})
