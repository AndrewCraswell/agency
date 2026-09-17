import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<(options: unknown) => void>(),
  end: vi.fn<() => Promise<void>>(),
  recover:
    vi.fn<typeof import("../../ingestion/regulations/discovery-recovery.js").recoverLegalDiscoveryDispatchPage>(),
  retrieve: vi.fn<(runId: string) => Promise<{ status: string }>>(),
  key: vi.fn<(key: string, options: { scope: string }) => Promise<string>>(),
  trigger: vi.fn<(task: string, payload: unknown, options: unknown) => Promise<{ id: string }>>()
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(options: unknown) {
        mocks.pool(options)
      }
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  tasks: { trigger: mocks.trigger },
  runs: { retrieve: mocks.retrieve },
  idempotencyKeys: { create: mocks.key }
}))
vi.mock("../../ingestion/regulations/discovery-recovery.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/discovery-recovery.js")>()),
  recoverLegalDiscoveryDispatchPage: mocks.recover
}))

import { runRegulatoryDiscoveryRecovery } from "./regulatory-discovery-recovery.js"

const input = { sourceId: "ecfr" as const, scopeKey: "a".repeat(64), afterDispatchId: null, limit: 10 }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/canonical")
  mocks.retrieve.mockResolvedValue({ status: "FAILED" })
  mocks.key.mockResolvedValue("global-key")
  mocks.trigger.mockResolvedValue({ id: "replacement-run" })
  mocks.recover.mockImplementation(async (_pool, value, inspect, submit) => {
    const observed = await inspect("old-run")
    const replacement = await submit(
      "parsing",
      { manifestId: "b".repeat(64), unitKey: "c".repeat(64) },
      { idempotencyKey: "legal-discovery:key:1", idempotencyKeyTTL: "7d" }
    )
    return {
      inspected: 1,
      afterDispatchId: value,
      exhausted: true,
      results: [
        {
          disposition: "replacement_ready",
          dispatchId: "d".repeat(64),
          status: observed.status,
          replacement: { dispatchId: "d".repeat(64), runId: replacement.id, attempt: 1, reused: false }
        }
      ]
    }
  })
})
afterEach(() => vi.unstubAllEnvs())

it("reads remote disposition and submits a replacement with the persisted global key", async () => {
  await expect(runRegulatoryDiscoveryRecovery(input)).resolves.toMatchObject({
    results: [{ status: "FAILED", replacement: { runId: "replacement-run" } }]
  })
  expect(mocks.retrieve).toHaveBeenCalledWith("old-run")
  expect(mocks.key).toHaveBeenCalledWith("legal-discovery:key:1", { scope: "global" })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-discovery-parsing",
    { manifestId: "b".repeat(64), unitKey: "c".repeat(64) },
    { idempotencyKey: "global-key", idempotencyKeyTTL: "7d" }
  )
})

it("treats a retained-history 404 as missing and propagates other inspection failures", async () => {
  mocks.retrieve.mockRejectedValueOnce(Object.assign(new Error("gone"), { status: 404 }))
  await expect(runRegulatoryDiscoveryRecovery(input)).resolves.toMatchObject({ results: [{ status: "MISSING" }] })
  mocks.retrieve.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 }))
  await expect(runRegulatoryDiscoveryRecovery(input)).rejects.toThrow("unavailable")
})

it("rejects an invalid page before opening the database", async () => {
  await expect(runRegulatoryDiscoveryRecovery({ ...input, limit: 26 })).rejects.toThrow()
  expect(mocks.pool).not.toHaveBeenCalled()
})
