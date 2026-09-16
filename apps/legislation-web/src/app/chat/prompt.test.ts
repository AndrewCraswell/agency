import { afterEach, describe, expect, it, vi } from "vitest"
import { getResearchPrompt } from "./prompt"

const environment = {
  LANGFUSE_BASE_URL: "https://us.cloud.langfuse.com",
  LANGFUSE_PUBLIC_KEY: "test-public",
  LANGFUSE_SECRET_KEY: "test-secret"
}
const prompt = {
  name: "legislative-research",
  type: "text",
  version: 3,
  labels: ["production"],
  prompt: "Approved research instructions."
}

afterEach(() => vi.unstubAllGlobals())

describe("getResearchPrompt", () => {
  it("loads an immutable version without requiring the production label", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...prompt, labels: [] }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(getResearchPrompt(environment, new AbortController().signal, 3)).resolves.toHaveProperty("version", 3)
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://us.cloud.langfuse.com/api/public/v2/prompts/legislative-research?version=3"),
      expect.any(Object)
    )
  })

  it("rejects a different version rather than silently changing the experiment", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(prompt)))
    await expect(getResearchPrompt(environment, new AbortController().signal, 2)).rejects.toThrow("unavailable")
  })

  it("loads the production text prompt with server-side authentication and no cache", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(prompt))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getResearchPrompt(environment, new AbortController().signal)).resolves.toEqual(prompt)
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://us.cloud.langfuse.com/api/public/v2/prompts/legislative-research?label=production"),
      expect.objectContaining({
        headers: { authorization: `Basic ${Buffer.from("test-public:test-secret").toString("base64")}` },
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal)
      })
    )
  })

  it("requires both credentials without making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    await expect(getResearchPrompt({}, new AbortController().signal)).rejects.toThrow("not configured")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    { ...prompt, prompt: " " },
    { ...prompt, type: "chat", prompt: [] },
    { ...prompt, name: "another-prompt" },
    { ...prompt, labels: ["latest"] },
    { ...prompt, version: 0 }
  ])("rejects invalid prompt responses without a local fallback", async (body) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)))
    await expect(getResearchPrompt(environment, new AbortController().signal)).rejects.toThrow(
      "Langfuse research prompt is unavailable."
    )
  })

  it("does not expose response bodies or transport error details", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("private upstream detail", { status: 401 }))
      .mockRejectedValueOnce(new Error("private transport detail"))
    vi.stubGlobal("fetch", fetchMock)
    for (const attempt of [1, 2]) {
      await expect(getResearchPrompt(environment, new AbortController().signal), `attempt ${attempt}`).rejects.toThrow(
        "Langfuse research prompt is unavailable."
      )
    }
  })

  it("rejects insecure URLs before transmitting credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      getResearchPrompt({ ...environment, LANGFUSE_BASE_URL: "http://example.com" }, new AbortController().signal)
    ).rejects.toThrow("unavailable")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("propagates request cancellation to the fetch signal", async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      expect(init?.signal?.aborted).toBe(true)
      init?.signal?.throwIfAborted()
      return Response.json(prompt)
    })
    vi.stubGlobal("fetch", fetchMock)
    controller.abort()
    await expect(getResearchPrompt(environment, controller.signal)).rejects.toThrow("unavailable")
  })
})
