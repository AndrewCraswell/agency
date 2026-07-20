import { describe, expect, it, vi } from "vitest"
import type { ArtifactStorePort } from "../prototype/artifacts"
import type { WorkflowStepInstance } from "./definition"
import type { WorkflowModelSnapshot } from "./modelCatalog"
import { OpenRouterWorkflowModelExecutor, WorkflowModelExecutionError } from "./modelExecutor"

const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"
const activationId = "a".repeat(64)
const snapshot: WorkflowModelSnapshot = {
  modelId: "openai/gpt-test",
  name: "GPT Test",
  contextLength: 128_000,
  pricing: { prompt: "0.001", completion: "0.002" },
  architecture: { inputModalities: ["text"], outputModalities: ["text"] },
  supportedParameters: ["temperature", "response_format"],
  observedAt: "2026-07-19T12:00:00.000Z"
}

function step(outputMode: "text" | "markdown" | "structured"): WorkflowStepInstance {
  return {
    id: "model",
    label: "Classify",
    position: { x: 0, y: 0 },
    definition: { kind: "ai_model", version: 1 },
    config: {
      modelId: snapshot.modelId,
      messages: [{ role: "user", content: "Classify {{issue.id}}" }],
      outputMode,
      parameters: { temperature: 0 },
      ...(outputMode === "structured"
        ? {
            outputSchema: {
              type: "object",
              required: ["label"],
              properties: { label: { type: "string" } },
              additionalProperties: false
            }
          }
        : {})
    },
    failurePolicy: { mode: "stop", maximumAttempts: 1 }
  }
}

function providerResponse(content: string, options: { finishReason?: string; refusal?: string | null } = {}) {
  return {
    id: "generation-1",
    model: "openai/gpt-test:provider-a",
    choices: [
      { finish_reason: options.finishReason ?? "stop", message: { content, refusal: options.refusal ?? null } }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, prompt_tokens_details: { cached_tokens: 2 } }
  }
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

describe("OpenRouterWorkflowModelExecutor", () => {
  it("returns locally validated structured output with durable usage evidence", async () => {
    const fetcher = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
      response(providerResponse('{"label":"bug"}'))
    )
    const executor = new OpenRouterWorkflowModelExecutor({ apiKey: "secret", fetcher, now: () => 1_000 })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("structured"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).resolves.toEqual({
      output: { response: { mode: "structured", value: { label: "bug" } } },
      data: [],
      usage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.02 },
      evidence: {
        provider: "openrouter",
        requestId: "generation-1",
        requestedModel: "openai/gpt-test",
        resolvedModel: "openai/gpt-test:provider-a",
        catalogObservedAt: snapshot.observedAt,
        effectiveParameters: { temperature: 0 },
        outputMode: "structured",
        finishReason: "stop",
        elapsedMs: 0
      }
    })
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(request).toMatchObject({
      model: snapshot.modelId,
      messages: [{ role: "user", content: "Classify FEN-42" }],
      response_format: { type: "json_schema", json_schema: { name: "workflow_node_output", strict: true } },
      provider: { require_parameters: true }
    })
  })

  it("writes Markdown output as an immutable artifact", async () => {
    const write = vi.fn(async () => "stored")
    const artifactStore = { write, read: vi.fn(), manifest: vi.fn(() => []) } as unknown as ArtifactStorePort
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse("# Review\n\nApproved.")),
      artifactStoreForRun: () => artifactStore
    })

    const result = await executor.execute({
      runId,
      activationId,
      attemptOrdinal: 2,
      step: step("markdown"),
      context: { issue: { id: "FEN-42" } },
      snapshots: [snapshot]
    })
    expect(result.output.response).toMatchObject({
      mode: "markdown",
      artifact: { mediaType: "text/markdown", producerAttemptId: `${activationId}:2` }
    })
    expect(result.data).toEqual([expect.objectContaining({ name: "response", kind: "artifact" })])
    expect(write).toHaveBeenCalledWith(
      expect.stringMatching(/\.md$/u),
      Buffer.from("# Review\n\nApproved."),
      "text/markdown"
    )
  })

  it("executes structured judgments through their declared output port", async () => {
    const judgmentStep: WorkflowStepInstance = {
      ...step("structured"),
      definition: { kind: "structured_judgment", version: 1 },
      config: {
        modelId: snapshot.modelId,
        criteria: "Approve only when the evidence is complete.",
        outputSchema: { type: "object", required: ["approved"], properties: { approved: { type: "boolean" } } }
      }
    }
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse('{"approved":true}'))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: judgmentStep,
        context: { evidence: { tests: "passed" } },
        snapshots: [snapshot]
      })
    ).resolves.toMatchObject({
      output: { judgment: { approved: true } }
    })
  })

  it("returns text output with default usage when provider usage is absent", async () => {
    const fetcher = vi.fn(async () =>
      response({ id: "generation-2", choices: [{ finish_reason: "stop", message: { content: "ok", refusal: null } }] })
    )
    const executor = new OpenRouterWorkflowModelExecutor({ apiKey: "secret", fetcher, now: () => 5_000 })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).resolves.toEqual({
      output: { response: { mode: "text", text: "ok" } },
      data: [],
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      evidence: {
        provider: "openrouter",
        requestId: "generation-2",
        requestedModel: "openai/gpt-test",
        resolvedModel: "openai/gpt-test",
        catalogObservedAt: snapshot.observedAt,
        effectiveParameters: { temperature: 0 },
        outputMode: "text",
        finishReason: "stop",
        elapsedMs: 0
      }
    })
  })

  it("fails when the selected model snapshot is unavailable", async () => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse("unused"))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [{ ...snapshot, modelId: "openai/other" }]
      })
    ).rejects.toMatchObject({ code: "model_snapshot_missing" })
  })

  it("fails when structured output schema is missing", async () => {
    const structuredWithoutSchema: WorkflowStepInstance = {
      ...step("structured"),
      config: {
        modelId: snapshot.modelId,
        messages: [{ role: "user", content: "Classify {{issue.id}}" }],
        outputMode: "structured",
        parameters: { temperature: 0 }
      }
    }
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse('{"label":"bug"}'))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: structuredWithoutSchema,
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_output_schema_missing" })
  })

  it("reports structured schema validation failures", async () => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse('{"wrong":"shape"}'))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("structured"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_schema_validation" })
  })

  it("fails when rendered prompts exceed the provider byte limit", async () => {
    const hugeContextStep: WorkflowStepInstance = {
      ...step("text"),
      config: {
        modelId: snapshot.modelId,
        messages: [{ role: "user", content: "Context: {{issue.body}}" }],
        outputMode: "text",
        parameters: { temperature: 0 }
      }
    }
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse("unused"))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: hugeContextStep,
        context: { issue: { body: "x".repeat(300_000) } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_prompt_too_large" })
  })

  it("fails when provider output exceeds the response byte limit", async () => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse("x".repeat(300_000)))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_output_too_large" })
  })

  it.each([
    ["null", null],
    ["blank", "   "]
  ])("fails when completion content is %s", async (_variant, content) => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () =>
        response({ id: "generation-empty", choices: [{ finish_reason: "stop", message: { content, refusal: null } }] })
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_empty_output" })
  })

  it("bubbles markdown artifact write failures", async () => {
    const write = vi.fn(async () => {
      throw new Error("disk full")
    })
    const artifactStore = { write, read: vi.fn(), manifest: vi.fn(() => []) } as unknown as ArtifactStorePort
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse("# Draft")),
      artifactStoreForRun: () => artifactStore
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 3,
        step: step("markdown"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toThrow("disk full")
  })

  it("maps timeout errors to model_timeout", async () => {
    const fetcher = vi.fn(async () => {
      throw new DOMException("Timed out", "TimeoutError")
    })
    const executor = new OpenRouterWorkflowModelExecutor({ apiKey: "secret", fetcher })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_timeout" })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("surfaces abort failures from provider calls", async () => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => {
        throw new DOMException("The operation was aborted", "AbortError")
      }
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_provider_failure", message: "The operation was aborted" })
  })

  it("normalizes non-Error provider failures", async () => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => {
        throw "boom"
      }
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({ code: "model_provider_failure", message: "OpenRouter request failed" })
  })

  it("returns provider status and unknown body failures without retrying non-transient errors", async () => {
    const fetcher = vi.fn(async () => response({ detail: "bad request" }, 400))
    const executor = new OpenRouterWorkflowModelExecutor({ apiKey: "secret", fetcher })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({
      code: "model_provider_failure",
      message: "OpenRouter failed with status 400: Unknown error"
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("retries rate-limited responses once before surfacing provider failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ error: { message: "slow down" } }, 429))
      .mockResolvedValueOnce(response({ error: { message: "still limited" } }, 429))
    const executor = new OpenRouterWorkflowModelExecutor({ apiKey: "secret", fetcher })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toMatchObject({
      code: "model_provider_failure",
      message: "OpenRouter failed with status 429: still limited"
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("rejects unsupported parameter keys via strict parameter validation", async () => {
    const invalidParameterStep: WorkflowStepInstance = {
      ...step("text"),
      config: {
        modelId: snapshot.modelId,
        messages: [{ role: "user", content: "Classify {{issue.id}}" }],
        outputMode: "text",
        parameters: { temperature: 0, unsupported_parameter: true }
      }
    }
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerResponse("unused"))
    })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: invalidParameterStep,
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).rejects.toBeInstanceOf(Error)
    expect(executor.execute).toBeDefined()
  })

  it.each([
    ["model_invalid_json", providerResponse("not-json")],
    ["model_truncated", providerResponse('{"label":"bug"}', { finishReason: "length" })],
    ["model_refusal", providerResponse("", { refusal: "Policy refusal" })]
  ])("classifies %s without exposing invalid output", async (code, providerBody) => {
    const executor = new OpenRouterWorkflowModelExecutor({
      apiKey: "secret",
      fetcher: async () => response(providerBody)
    })
    try {
      await executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("structured"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
      throw new Error("Expected model execution to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowModelExecutionError)
      expect((error as WorkflowModelExecutionError).code).toBe(code)
    }
  })

  it("retries one transient provider failure", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ error: { message: "busy" } }, 503))
      .mockResolvedValueOnce(response(providerResponse("done")))
    const executor = new OpenRouterWorkflowModelExecutor({ apiKey: "secret", fetcher })

    await expect(
      executor.execute({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("text"),
        context: { issue: { id: "FEN-42" } },
        snapshots: [snapshot]
      })
    ).resolves.toMatchObject({ output: { response: { mode: "text", text: "done" } } })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
