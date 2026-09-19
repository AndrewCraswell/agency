import { startInactiveSpan } from "@sentry/core"
import { afterEach, expect, it, vi } from "vitest"
import { diagnosticBreadcrumb } from "../../services/sentry/diagnosticBreadcrumb"
import { createConversationDiagnostics } from "./conversationDiagnostics"

vi.mock("../../services/sentry/diagnosticBreadcrumb", () => ({
  diagnosticBreadcrumb: vi.fn<typeof diagnosticBreadcrumb>()
}))
vi.mock("@sentry/core", async (original) => ({
  ...(await original<typeof import("@sentry/core")>()),
  startInactiveSpan: vi.fn<typeof startInactiveSpan>()
}))

afterEach(() => vi.clearAllMocks())

async function fixture() {
  const sdk = await vi.importActual<typeof import("@sentry/core")>("@sentry/core")
  const span = sdk.startInactiveSpan({ name: "/chat" })
  const attributes = vi.spyOn(span, "setAttributes")
  const end = vi.spyOn(span, "end")
  vi.mocked(startInactiveSpan).mockReturnValue(span)
  let time = 0
  const diagnostics = createConversationDiagnostics(() => time)
  return {
    diagnostics,
    attributes,
    end,
    advance: () => {
      time += 25
    }
  }
}

it("keeps only safe request/run references and one observed terminal without collecting content", async () => {
  const { diagnostics, end } = await fixture()
  const attempt = diagnostics.begin(false)
  const requestId = crypto.randomUUID()
  diagnostics.response(new Response("", { headers: { "x-rostra-request-id": requestId } }), attempt.id)
  diagnostics.link({
    correlation: {
      browser_request_id: attempt.id,
      request_id: requestId,
      run_id: crypto.randomUUID(),
      private: "PRIVATE"
    },
    text: "PRIVATE"
  })
  diagnostics.firstContent()
  diagnostics.finish("completed")
  diagnostics.stop()
  diagnostics.finish("failed")
  expect(end).toHaveBeenCalledOnce()
  expect(diagnostics.correlation()).toMatchObject({ browser_request_id: attempt.id, request_id: requestId })
  expect(JSON.stringify(vi.mocked(diagnosticBreadcrumb).mock.calls)).not.toContain("PRIVATE")
  expect(
    vi
      .mocked(diagnosticBreadcrumb)
      .mock.calls.filter(([name, data]) => name === "conversation.milestone" && data.milestone === "terminal_received")
  ).toEqual([["conversation.milestone", expect.objectContaining({ outcome: "completed", origin: "browser" })]])
})

it("links an explicit retry and ignores a late response from the previous attempt", async () => {
  const { diagnostics } = await fixture()
  const previous = diagnostics.begin(false)
  diagnostics.finish("failed")
  const next = diagnostics.begin(true)
  diagnostics.response(new Response("", { headers: { "x-rostra-request-id": crypto.randomUUID() } }), previous.id)
  diagnostics.finish("failed", previous.id)
  expect(diagnostics.correlation()).toEqual({ browser_request_id: next.id })
  expect(diagnosticBreadcrumb).toHaveBeenCalledWith(
    "conversation.retry_requested",
    expect.objectContaining({ retry_of_operation_id: previous.id })
  )
  diagnostics.finish("unknown")
})

it("keeps unobserved first content absent and ends explicit cancellation independently of server outcome", async () => {
  const { diagnostics, advance, attributes } = await fixture()
  diagnostics.begin(false)
  advance()
  diagnostics.stop()
  diagnostics.firstContent()
  expect(attributes).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 25, outcome: "cancelled" }))
  expect(vi.mocked(diagnosticBreadcrumb).mock.calls.some(([, data]) => data.firstContentMs !== undefined)).toBe(false)
})
