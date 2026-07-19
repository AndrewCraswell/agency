import { describe, expect, it, vi } from "vitest"
import { OpenHandsClient, type OpenHandsGatewayPort } from "./client"
import { OPENHANDS_AGENT_SERVER_IMAGE, createAgentServerEnvironment, createCoderProfile } from "./profiles"

const conversationId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"

class FakeGateway implements OpenHandsGatewayPort {
  modelIds = ["openhands_phase-1-coder"]
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
  it("creates the native profile with reasoning and caching enabled", async () => {
    const requests: Array<{ input: string; init: RequestInit }> = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input, init) => {
      requests.push({ input, init })
      return Response.json({ name: "phase-1-coder", message: "Profile saved" }, { status: 201 })
    })
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    await client.configureProfile("provider-secret")

    expect(requests).toHaveLength(1)
    expect(requests[0]?.input).toBe("https://agent.example/api/profiles/phase-1-coder")
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

  it("returns the final response and conversation header", async () => {
    const requests: Array<{ input: string; init: RequestInit }> = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input, init) => {
      requests.push({ input, init })
      if (input.endsWith("/api/profiles/phase-1-coder")) {
        return Response.json({ name: "phase-1-coder", message: "Profile saved" }, { status: 201 })
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
      "https://agent.example/api/profiles/phase-1-coder",
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
      if (input.endsWith("/api/profiles/phase-1-coder")) {
        return Response.json({ name: "phase-1-coder", message: "Profile saved" }, { status: 201 })
      }
      return Response.json({ id: "not-a-uuid", execution_status: "finished" }, { status: 201 })
    })
    const client = new OpenHandsClient(clientOptions, { fetcher, gateway: new FakeGateway() })

    await client.configureProfile("provider-secret")

    await expect(
      client.chat({ systemPrompt: "Follow policy.", userPrompt: "Implement assignment." })
    ).rejects.toMatchObject({ classification: "malformed_response" })
  })

  it("interrupts an active native conversation when cancelled", async () => {
    const controller = new AbortController()
    const requests: string[] = []
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async (input) => {
      requests.push(input)
      if (input.endsWith("/api/profiles/phase-1-coder")) {
        return Response.json({ name: "phase-1-coder", message: "Profile saved" }, { status: 201 })
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
