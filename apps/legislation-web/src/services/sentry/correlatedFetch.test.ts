import { expect, it, vi } from "vitest"
import { createCorrelatedFetch } from "./correlatedFetch"

it("adds an opaque request ID without changing method, body or abort behavior", async () => {
  const sender = vi.fn<typeof fetch>(async () => new Response("ok"))
  const fetcher = createCorrelatedFetch(sender, () => "https://app.example.test")
  const controller = new AbortController()
  await fetcher("/chat", { method: "POST", body: '{"sessionKey":"PRIVATE"}', signal: controller.signal })
  expect(sender).toHaveBeenCalledWith(
    "/chat",
    expect.objectContaining({
      method: "POST",
      body: '{"sessionKey":"PRIVATE"}',
      signal: controller.signal,
      redirect: "error"
    })
  )
  const headers = new Headers(sender.mock.calls[0]?.[1]?.headers)
  expect(headers.get("x-rostra-request-id")).toMatch(/^[a-f0-9-]{36}$/u)
  expect([...headers.values()].join()).not.toContain("PRIVATE")
})

it("does not allow redirect options to forward correlation beyond the approved API origin", async () => {
  const sender = vi.fn<typeof fetch>(async () => new Response("ok"))
  const fetcher = createCorrelatedFetch(sender, () => "https://app.example.test")
  const request = new Request("https://app.example.test/chat", { redirect: "follow" })
  await fetcher(request, { redirect: "follow" })
  expect(sender.mock.calls[0]?.[1]?.redirect).toBe("error")
  await fetcher("https://source.example.test/", { redirect: "manual" })
  expect(sender.mock.calls[1]?.[1]?.redirect).toBe("manual")
})

it("keeps a valid request ID stable and strips all telemetry headers for other origins", async () => {
  const sender = vi.fn<typeof fetch>(async () => new Response("ok"))
  const fetcher = createCorrelatedFetch(sender, () => "https://app.example.test")
  const id = crypto.randomUUID()
  await fetcher("/chat", { headers: { "x-rostra-request-id": id } })
  expect(new Headers(sender.mock.calls[0]?.[1]?.headers).get("x-rostra-request-id")).toBe(id)
  for (const url of ["https://model.example.test/", "//webhook.example.test/", "/\\source.example.test/"]) {
    await fetcher(url, {
      headers: {
        authorization: "application-owned",
        "x-rostra-request-id": id,
        "sentry-trace": `${"a".repeat(32)}-${"b".repeat(16)}-1`,
        traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
        baggage: "PRIVATE",
        tracestate: "PRIVATE"
      }
    })
    const headers = new Headers(sender.mock.calls.at(-1)?.[1]?.headers)
    expect([...headers.keys()]).toEqual(["authorization"])
  }
})

it("preserves native Request headers unless init explicitly overrides them", async () => {
  const sender = vi.fn<typeof fetch>(async () => new Response("ok"))
  const fetcher = createCorrelatedFetch(sender, () => "https://app.example.test")
  const request = new Request("https://app.example.test/chat", { headers: { "x-original": "present" } })
  await fetcher(request)
  expect(new Headers(sender.mock.calls[0]?.[1]?.headers).get("x-original")).toBe("present")
  await fetcher(request, { headers: { "x-replacement": "present" } })
  expect(new Headers(sender.mock.calls[1]?.[1]?.headers).get("x-original")).toBeNull()
  expect(new Headers(sender.mock.calls[1]?.[1]?.headers).get("x-replacement")).toBe("present")
})
