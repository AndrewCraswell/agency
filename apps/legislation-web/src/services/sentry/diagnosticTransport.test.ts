import { createTransport, type BaseTransportOptions, type Envelope, type TransportRequestExecutor } from "@sentry/core"
import { afterEach, expect, it, vi } from "vitest"
import { diagnosticEnvironment } from "./diagnosticSettings"
import { diagnosticTransport } from "./diagnosticTransport"
import { sentryOptions } from "./sentryOptions"

afterEach(() => vi.restoreAllMocks())

const eventId = "a".repeat(32)
const envelope: Envelope = [
  { event_id: eventId, sent_at: "2026-09-19T00:00:00.000Z" },
  [[{ type: "event" }, { event_id: eventId }]]
]

it("uses the native bounded queue without blocking the caller or leaking failed payloads", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  const dropped = vi.fn<BaseTransportOptions["recordDroppedEvent"]>()
  const pending = Promise.withResolvers<{ statusCode: number }>()
  const sender = vi.fn<TransportRequestExecutor>(() => pending.promise)
  const transport = diagnosticTransport((options: BaseTransportOptions) => createTransport(options, sender))({
    url: "https://synthetic.invalid/",
    ...sentryOptions.transportOptions,
    recordDroppedEvent: dropped
  })
  const sends = Array.from({ length: 60 }, () => transport.send(envelope))
  expect(sender).toHaveBeenCalledTimes(32)
  expect(dropped).toHaveBeenCalledWith("queue_overflow", "error")
  expect(warning).toHaveBeenCalledTimes(10)
  expect(await transport.flush(1)).toBe(false)
  pending.resolve({ statusCode: 200 })
  await Promise.all(sends)
  expect(await transport.flush(100)).toBe(true)
  expect(JSON.stringify(warning.mock.calls)).not.toContain("event_id")
})

it("respects SDK rate-limit backoff and reports network failures without retry machinery", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  const sender = vi
    .fn<TransportRequestExecutor>()
    .mockResolvedValueOnce({ statusCode: 429, headers: { "retry-after": "60", "x-sentry-rate-limits": null } })
  const dropped = vi.fn<BaseTransportOptions["recordDroppedEvent"]>()
  const transport = diagnosticTransport((options: BaseTransportOptions) => createTransport(options, sender))({
    url: "https://synthetic.invalid/",
    recordDroppedEvent: dropped
  })
  await transport.send(envelope)
  await transport.send(envelope)
  expect(sender).toHaveBeenCalledOnce()
  expect(dropped).toHaveBeenCalledWith("ratelimit_backoff", "error")
  const offline = diagnosticTransport((options: BaseTransportOptions) =>
    createTransport(options, () => Promise.reject(new Error("PRIVATE_NETWORK_DETAIL")))
  )({ url: "https://synthetic.invalid/", recordDroppedEvent: dropped })
  await expect(Promise.resolve(offline.send(envelope))).rejects.toThrow("PRIVATE_NETWORK_DETAIL")
  expect(dropped).toHaveBeenCalledWith("network_error", "error")
  expect(JSON.stringify(warning.mock.calls)).not.toContain("PRIVATE_NETWORK_DETAIL")
})

it("enables diagnostic traces by default without enabling logs, metrics or replay", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  expect(sentryOptions.tracesSampler()).toBe(1)
  expect(diagnosticEnvironment("test", "production")).toBe("test")
  expect(diagnosticEnvironment("PRIVATE", "development")).toBe("development")
  expect(sentryOptions).toMatchObject({
    enableLogs: false,
    enableMetrics: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0
  })
})
