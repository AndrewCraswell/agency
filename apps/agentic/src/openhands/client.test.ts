import { describe, expect, it, vi } from "vitest"
import { OpenHandsClient, type OpenHandsGatewayPort } from "./client"
import { OPENHANDS_AGENT_SERVER_IMAGE, createAgentServerEnvironment, createCoderProfile } from "./profiles"

const conversationId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"

class FakeGateway implements OpenHandsGatewayPort {
  modelIds = ["openhands_coder"]
  completion = {
    conversationId,
    content: "Completed the assignment.",
    promptTokens: 100,
    completionTokens: 20
  }
  lastRequest: Parameters<OpenHandsGatewayPort["complete"]>[0] | null = null
  error: Error | null = null

  async listModelIds(): Promise<string[]> {
    if (this.error !== null) {
      throw this.error
    }
    return this.modelIds
  }

  async complete(
    request: Parameters<OpenHandsGatewayPort["complete"]>[0]
  ): Promise<Awaited<ReturnType<OpenHandsGatewayPort["complete"]>>> {
    if (this.error !== null) {
      throw this.error
    }
    this.lastRequest = request
    return this.completion
  }
}

const clientOptions = {
  baseUrl: "https://agent.example/",
  sessionApiKey: "session-key",
  timeoutMs: 120_000,
  maxIterations: 10,
  profile: createCoderProfile("role-execution-1")
}

describe("OpenHands profiles", () => {
  it("pins the released Agent Server image", () => {
    expect(OPENHANDS_AGENT_SERVER_IMAGE).toBe(
      "ghcr.io/openhands/agent-server@sha256:6301c75380733e83c7291a9a258de5fc04a99d940894db7b157e845a8cc03dcc"
    )
  })

  it("builds a headless authenticated server environment", () => {
    expect(createAgentServerEnvironment({ sessionApiKey: "session", encryptionKey: "encryption" })).toEqual({
      OH_SESSION_API_KEYS_0: "session",
      OH_SECRET_KEY: "encryption",
      OH_ENABLE_VNC: "false",
      OH_ENABLE_VSCODE: "false",
      OH_PRELOAD_TOOLS: "false",
      OH_WEBHOOKS: "[]"
    })
  })
})

describe("OpenHandsClient", () => {
  it("continues an existing conversation through the gateway", async () => {
    const conversationId = "f94da77f-0dbd-469a-82be-6bc613e4cc47"
    const gateway = {
      listModelIds: vi.fn(async () => ["openhands_coder"]),
      complete: vi.fn(async () => ({
        conversationId,
        content: "STATUS: COMPLETED",
        promptTokens: 11,
        completionTokens: 7
      }))
    }
    const fetcher = vi.fn(async () => Response.json({ name: "coder", message: "Profile saved" }, { status: 201 }))
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway })
    await client.configureProfile("provider-key")

    await expect(
      client.followUp({
        conversationId,
        systemPrompt: "Apply accepted review findings.",
        userPrompt: "Fix finding_123."
      })
    ).resolves.toEqual({
      conversationId,
      finalResponse: "STATUS: COMPLETED",
      usage: { promptTokens: 11, completionTokens: 7 }
    })
    expect(gateway.complete).toHaveBeenCalledWith({
      model: "openhands_coder",
      messages: [
        { role: "system", content: "Apply accepted review findings." },
        { role: "user", content: "Fix finding_123." }
      ],
      conversationId
    })
  })

  it("creates the native profile with reasoning and caching enabled", async () => {
    const requests: Array<{ input: string; init: RequestInit }> = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input, init) => {
      requests.push({ input, init })
      return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
    })
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    await client.configureProfile("provider-secret")

    expect(requests).toHaveLength(1)
    expect(requests[0]?.input).toBe("https://agent.example/api/profiles/coder")
    expect(requests[0]?.init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Session-API-Key": "session-key"
    })
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      llm: {
        model: "openrouter/openai/gpt-5.6-terra",
        base_url: "https://openrouter.ai/api/v1",
        api_key: "provider-secret",
        reasoning_effort: "medium",
        caching_prompt: true,
        usage_id: "role-execution-1"
      },
      include_secrets: true
    })
  })

  it("classifies a rejected session key as authentication failure", async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({ detail: "Unauthorized" }, { status: 401 })
    )
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    const result = client.configureProfile("provider-secret")

    await expect(result).rejects.toMatchObject({ classification: "authentication" })
  })

  it.each([
    {
      name: "timeout",
      error: new DOMException("timed out", "TimeoutError"),
      classification: "timeout",
      retryable: true
    },
    { name: "network failure", error: new Error("connection refused"), classification: "startup", retryable: true }
  ])("classifies profile creation $name", async ({ error, classification, retryable }) => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>().mockRejectedValue(error)
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    await expect(client.configureProfile("provider-secret")).rejects.toMatchObject({ classification, retryable })
  })

  it("rejects unsuccessful and malformed profile responses", async () => {
    const rejected = new OpenHandsClient(clientOptions, {
      fetcher: vi.fn(async () => Response.json({ message: "invalid model" }, { status: 422 })),
      gateway: new FakeGateway()
    })
    await expect(rejected.configureProfile("provider-secret")).rejects.toMatchObject({ classification: "model" })

    const malformed = new OpenHandsClient(clientOptions, {
      fetcher: vi.fn(async () => Response.json({ name: "other-profile", message: "saved" }, { status: 201 })),
      gateway: new FakeGateway()
    })
    await expect(malformed.configureProfile("provider-secret")).rejects.toMatchObject({
      classification: "malformed_response"
    })
  })

  it("verifies the profile through the gateway model list", async () => {
    const client = new OpenHandsClient(clientOptions, { gateway: new FakeGateway() })

    await expect(client.verifyProfile()).resolves.toBeUndefined()
  })

  it("rejects a missing gateway model", async () => {
    const gateway = new FakeGateway()
    gateway.modelIds = []
    const client = new OpenHandsClient(clientOptions, { gateway })

    await expect(client.verifyProfile()).rejects.toMatchObject({ classification: "model" })
  })

  it("classifies an unknown gateway failure as a model failure", async () => {
    const gateway = new FakeGateway()
    gateway.error = new Error("unexpected gateway response")
    const client = new OpenHandsClient(clientOptions, { gateway })

    await expect(client.verifyProfile()).rejects.toMatchObject({ classification: "model", retryable: false })
  })

  it("returns the final response and conversation header", async () => {
    const requests: Array<{ input: string; init: RequestInit }> = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input, init) => {
      requests.push({ input, init })
      if (input.endsWith("/api/profiles/coder")) {
        return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
      }
      if (input.endsWith("/api/conversations")) {
        return Response.json({ id: conversationId, execution_status: "finished" }, { status: 201 })
      }
      return Response.json({ response: "Completed the assignment." })
    })
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    await client.configureProfile("provider-secret")

    const result = await client.chat({
      systemPrompt: "Follow the repository policy.",
      userPrompt: "Implement the assignment.",
      conversationId
    })

    expect(result).toEqual({
      conversationId,
      finalResponse: "Completed the assignment.",
      usage: { promptTokens: null, completionTokens: null }
    })
    expect(requests.map((request) => request.input)).toEqual([
      "https://agent.example/api/profiles/coder",
      "https://agent.example/api/conversations",
      `https://agent.example/api/conversations/${conversationId}/agent_final_response`
    ])
    expect(JSON.parse(String(requests[1]?.init.body))).toMatchObject({
      conversation_id: conversationId,
      max_iterations: 10,
      workspace: { kind: "LocalWorkspace", working_dir: "/workspace/repository" },
      agent_settings: {
        agent_kind: "llm",
        tools: null,
        system_message_suffix: "Follow the repository policy.",
        llm: { api_key: "provider-secret", caching_prompt: true }
      },
      initial_message: {
        role: "user",
        content: [{ type: "text", text: "Implement the assignment." }],
        run: true
      }
    })
  })

  it("rejects malformed native conversation state", async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
      if (input.endsWith("/api/profiles/coder")) {
        return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
      }
      return Response.json({ id: "not-a-uuid", execution_status: "finished" }, { status: 201 })
    })
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    await client.configureProfile("provider-secret")

    await expect(
      client.chat({ systemPrompt: "Follow policy.", userPrompt: "Implement assignment." })
    ).rejects.toMatchObject({ classification: "malformed_response" })
  })

  it("requires configuration and honors cancellation before conversation creation", async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
    )
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })
    await expect(client.chat({ systemPrompt: "Policy", userPrompt: "Work" })).rejects.toMatchObject({
      classification: "model"
    })

    await client.configureProfile("provider-secret")
    const controller = new AbortController()
    controller.abort()
    await expect(
      client.chat({ systemPrompt: "Policy", userPrompt: "Work", conversationId, signal: controller.signal })
    ).rejects.toMatchObject({ classification: "cancelled" })
  })

  it.each(["error", "stuck", "paused", "waiting_for_confirmation"])(
    "classifies a conversation ending with %s as a model failure",
    async (executionStatus) => {
      const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
        if (input.endsWith("/api/profiles/coder")) {
          return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
        }
        return Response.json({ id: conversationId, execution_status: executionStatus }, { status: 201 })
      })
      const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })
      await client.configureProfile("provider-secret")

      await expect(client.chat({ systemPrompt: "Policy", userPrompt: "Work", conversationId })).rejects.toMatchObject({
        classification: "model"
      })
    }
  )

  it("interrupts a conversation that exceeds its deadline", async () => {
    const requests: string[] = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
      requests.push(input)
      if (input.endsWith("/api/profiles/coder")) {
        return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
      }
      return Response.json({ id: conversationId, execution_status: "running" }, { status: 201 })
    })
    const client = new OpenHandsClient({ ...clientOptions, timeoutMs: 0 }, { fetcher, gateway: new FakeGateway() })
    await client.configureProfile("provider-secret")

    await expect(client.chat({ systemPrompt: "Policy", userPrompt: "Work", conversationId })).rejects.toMatchObject({
      classification: "timeout",
      retryable: true
    })
    expect(requests).toContain(`https://agent.example/api/conversations/${conversationId}/interrupt`)
  })

  it("rejects incomplete final responses and native HTTP failures", async () => {
    const incompleteFetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
      if (input.endsWith("/api/profiles/coder")) {
        return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
      }
      if (input.endsWith("/api/conversations")) {
        return Response.json({ id: conversationId, execution_status: "finished" }, { status: 201 })
      }
      return Response.json({ response: "" })
    })
    const incomplete = new OpenHandsClient(clientOptions, { fetcher: incompleteFetcher, gateway: new FakeGateway() })
    await incomplete.configureProfile("provider-secret")
    await expect(incomplete.chat({ systemPrompt: "Policy", userPrompt: "Work", conversationId })).rejects.toMatchObject(
      { classification: "malformed_response" }
    )

    const failedFetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
      if (input.endsWith("/api/profiles/coder")) {
        return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
      }
      return Response.json({ message: "unavailable" }, { status: 503 })
    })
    const failed = new OpenHandsClient(clientOptions, { fetcher: failedFetcher, gateway: new FakeGateway() })
    await failed.configureProfile("provider-secret")
    await expect(failed.chat({ systemPrompt: "Policy", userPrompt: "Work", conversationId })).rejects.toMatchObject({
      classification: "startup",
      retryable: true
    })
  })

  it("interrupts an active native conversation when cancelled", async () => {
    const controller = new AbortController()
    const requests: string[] = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
      requests.push(input)
      if (input.endsWith("/api/profiles/coder")) {
        return Response.json({ name: "coder", message: "Profile saved" }, { status: 201 })
      }
      if (input.endsWith("/api/conversations")) {
        controller.abort()
        return Response.json({ id: conversationId, execution_status: "running" }, { status: 201 })
      }
      if (input.endsWith(`/api/conversations/${conversationId}/interrupt`)) {
        return Response.json({ id: conversationId, execution_status: "paused" })
      }
      return Response.json({ message: "Unexpected request" }, { status: 500 })
    })
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })
    await client.configureProfile("provider-secret")

    await expect(
      client.chat({
        systemPrompt: "Follow policy.",
        userPrompt: "Implement assignment.",
        conversationId,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ classification: "cancelled" })
    expect(requests).toContain(`https://agent.example/api/conversations/${conversationId}/interrupt`)
  })
})
