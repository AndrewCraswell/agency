import { afterEach, describe, expect, it, vi } from "vitest"
import { createLangfuseClient, langfuseSettings } from "./client"

const environment = {
  LANGFUSE_PUBLIC_KEY: "test-public",
  LANGFUSE_SECRET_KEY: "test-secret",
  LANGFUSE_BASE_URL: "https://example.test"
}

afterEach(() => vi.unstubAllGlobals())

describe("Langfuse settings", () => {
  it.each([
    { baseUrl: undefined, expectedUrl: "https://us.cloud.langfuse.com" },
    { baseUrl: "https://langfuse.example.test", expectedUrl: "https://langfuse.example.test" }
  ])("preserves the endpoint $expectedUrl and trims credentials", ({ baseUrl, expectedUrl }) => {
    expect(
      langfuseSettings({
        LANGFUSE_PUBLIC_KEY: " test-public ",
        LANGFUSE_SECRET_KEY: "\ttest-secret ",
        LANGFUSE_BASE_URL: baseUrl
      })
    ).toEqual({
      publicKey: "test-public",
      secretKey: "test-secret",
      baseUrl: expectedUrl
    })
  })

  it.each([
    { LANGFUSE_PUBLIC_KEY: undefined },
    { LANGFUSE_SECRET_KEY: undefined },
    { LANGFUSE_PUBLIC_KEY: " " },
    { LANGFUSE_SECRET_KEY: "\t" }
  ])("rejects incomplete credentials at the integration boundary", (overrides) => {
    expect(() => langfuseSettings({ ...environment, ...overrides })).toThrow("HTTPS credentials")
  })
})

describe("Langfuse HTTP transport", () => {
  it("posts JSON with dedicated credentials and refuses redirects", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ accepted: true }))
    vi.stubGlobal("fetch", fetcher)
    const body = { name: "test-dataset" }
    const response = await createLangfuseClient(environment).request("v2/datasets", { body, timeoutMs: 20000 })
    await expect(response.json()).resolves.toEqual({ accepted: true })
    expect(fetcher).toHaveBeenCalledWith(new URL("https://example.test/api/public/v2/datasets"), {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        authorization: `Basic ${Buffer.from("test-public:test-secret").toString("base64")}`,
        "content-type": "application/json"
      },
      redirect: "error",
      signal: expect.any(AbortSignal)
    })
  })

  it.each(["http://example.test", "https://user:password@example.test"])(
    "rejects unsafe endpoint %s before sending credentials",
    (baseUrl) => {
      const fetcher = vi.fn<typeof fetch>()
      vi.stubGlobal("fetch", fetcher)
      expect(() => createLangfuseClient({ ...environment, LANGFUSE_BASE_URL: baseUrl })).toThrow("HTTPS credentials")
      expect(fetcher).not.toHaveBeenCalled()
    }
  )

  it("keeps non-success responses available for the caller's error policy", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetcher)
    const response = await createLangfuseClient(environment).request("projects", { timeoutMs: 10000 })
    expect(response.status).toBe(503)
  })
})
