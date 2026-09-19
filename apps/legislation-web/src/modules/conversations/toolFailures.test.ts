import { captureException } from "@sentry/core"
import { afterEach, expect, it, vi } from "vitest"
import { ResearchFailure } from "./researchFailure"
import { researchToolMeasurementSchema, type ResearchToolMeasurement } from "./researchMeasurement"
import { createToolFailureReporter } from "./toolFailures"

vi.mock("@sentry/core", () => ({ captureException: vi.fn<typeof captureException>() }))

afterEach(() => {
  vi.clearAllMocks()
})

const measurement: ResearchToolMeasurement = {
  runId: "run-fixture",
  toolCallId: "call-fixture",
  toolName: "search_bill_text",
  startedAt: "2026-09-18T12:00:00.000Z",
  finishedAt: "2026-09-18T12:00:00.031Z",
  durationMs: 31,
  dependencyDurationMs: 23,
  rawResultBytes: 150000,
  enrichedResultBytes: 200000,
  modelResultBytes: 200100,
  resultCount: 5,
  hasNextPage: true,
  outcome: "error",
  failureCode: "result_limit",
  attemptCount: 1,
  internalRetryCount: null,
  retryOfToolCallId: null
}

it("reports one failure per call with only allowlisted scalar measurements", () => {
  const report = createToolFailureReporter("run-fixture")
  const failure = {
    toolCallId: "call-fixture",
    toolName: "search_bill_text",
    error: new ResearchFailure("result_limit", "reference-fixture"),
    measurement: { ...measurement, apiKey: "fixture-secret", reasoning: "Never export model reasoning" }
  }
  report(failure)
  report(failure)
  expect(captureException).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ code: "result_limit", reference: "reference-fixture" }),
    expect.objectContaining({
      tags: expect.objectContaining({ runId: "run-fixture", toolCallId: "call-fixture", category: "result_limit" }),
      extra: { durationMs: undefined, resultBytes: undefined, measurement }
    })
  )
  expect(JSON.stringify(vi.mocked(captureException).mock.calls)).not.toMatch(/fixture-secret|reasoning/)
})

it("keeps unknown causes internal and never forwards raw exceptions", () => {
  createToolFailureReporter("run-fixture")({
    toolCallId: "call-fixture",
    toolName: "get_bill_timeline",
    error: new Error("Unknown historical failure: password=private, raw reasoning")
  })
  expect(captureException).toHaveBeenCalledWith(
    expect.objectContaining({ code: "internal", message: expect.stringContaining("This research operation failed.") }),
    expect.objectContaining({ tags: expect.objectContaining({ category: "internal" }) })
  )
  expect(JSON.stringify(vi.mocked(captureException).mock.calls)).not.toMatch(/password|reasoning|historical/)
})

it("does not report a user interruption as a production failure", () => {
  createToolFailureReporter("run-fixture")({
    toolCallId: "call-fixture",
    toolName: "get_bill",
    error: new ResearchFailure("interrupted", "reference-fixture")
  })
  expect(captureException).not.toHaveBeenCalled()
})

it.each([
  { durationMs: Number.NaN },
  { modelResultBytes: -1 },
  { rawResultBytes: 0.5 },
  { failureCode: "private exception text" },
  { internalRetryCount: 0 },
  { retryOfToolCallId: "guessed-related-call" },
  { startedAt: "unknown" }
])("rejects invented or invalid persisted measurement fields: %j", (invalid) => {
  expect(researchToolMeasurementSchema.safeParse({ ...measurement, ...invalid }).success).toBe(false)
})
