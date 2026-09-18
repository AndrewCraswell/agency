import { describe, expect, it, vi } from "vitest"
import { DeferredHttpRequestError, type HttpRequestTelemetry } from "../http-client.js"
import { ProviderRequestAdmission, type ProviderRequestAdmissionStore } from "./provider-request-admission.js"

class MemoryStore implements ProviderRequestAdmissionStore {
  decisions: { admitted: boolean; waitMs: number }[] = []
  cooldowns: { provider: string; cooldownMs: number }[] = []
  admissions: { provider: string; minimumIntervalMs: number }[] = []

  async admit(provider: string, minimumIntervalMs: number) {
    this.admissions.push({ provider, minimumIntervalMs })
    return this.decisions.shift() ?? { admitted: true, waitMs: 0 }
  }

  async extendCooldown(provider: string, cooldownMs: number) {
    this.cooldowns.push({ provider, cooldownMs })
  }
}

const telemetry = (values: Partial<HttpRequestTelemetry>): HttpRequestTelemetry => ({
  attempt: 1,
  durationMs: 10,
  method: "GET",
  url: "https://www.govinfo.gov/content/pkg/example/pdf/example.pdf",
  ...values
})

describe("cross-worker provider request admission", () => {
  it("waits outside the store and rechecks durable state before admission", async () => {
    const store = new MemoryStore()
    store.decisions.push({ admitted: false, waitMs: 375 }, { admitted: true, waitMs: 0 })
    const wait = vi.fn(async () => undefined)
    const admission = new ProviderRequestAdmission(
      store,
      { provider: "govinfo", minimumIntervalMs: 500 },
      { delay: wait }
    )

    await admission.beforeAttempt()

    expect(wait).toHaveBeenCalledExactlyOnceWith(375)
    expect(store.admissions).toEqual([
      { provider: "govinfo", minimumIntervalMs: 500 },
      { provider: "govinfo", minimumIntervalMs: 500 }
    ])
  })

  it("persists Retry-After cooldown and yields the request to orchestration", async () => {
    const store = new MemoryStore()
    const admission = new ProviderRequestAdmission(store, { provider: "govinfo", minimumIntervalMs: 500 })

    await expect(admission.afterAttempt(telemetry({ status: 429, retryAfterMs: 120_000 }))).rejects.toMatchObject({
      name: "DeferredHttpRequestError",
      deferKind: "provider_cooldown"
    } satisfies Partial<DeferredHttpRequestError>)
    expect(store.cooldowns).toEqual([{ provider: "govinfo", cooldownMs: 120_000 }])
  })

  it("does not mutate cooldown state for successful responses", async () => {
    const store = new MemoryStore()
    const admission = new ProviderRequestAdmission(store, { provider: "govinfo", minimumIntervalMs: 500 })
    await admission.afterAttempt(telemetry({ status: 200 }))
    expect(store.cooldowns).toEqual([])
  })
})
