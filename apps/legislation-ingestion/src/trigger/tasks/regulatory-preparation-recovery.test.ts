import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<(options: unknown) => void>(),
  end: vi.fn<() => Promise<void>>(),
  recover:
    vi.fn<typeof import("../../ingestion/regulations/preparation-run-recovery.js").recoverLegalPreparationRunPage>(),
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
vi.mock("../../ingestion/regulations/preparation-run-recovery.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/preparation-run-recovery.js")>()),
  recoverLegalPreparationRunPage: mocks.recover
}))

import { runRegulatoryPreparationRecovery } from "./regulatory-preparation-recovery.js"

const input = {
  waveId: "00000000-0000-4000-8000-000000000001",
  afterDispatchId: null,
  limit: 10
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/canonical")
  mocks.retrieve.mockResolvedValue({ status: "FAILED" })
  mocks.key.mockResolvedValue("global-key")
  mocks.trigger.mockResolvedValue({ id: "replacement-run" })
  mocks.recover.mockImplementation(async (_pool, _value, inspect, submit) => {
    const observed = await inspect("old-run")
    const replacement = await submit(
      {
        scope: { kind: "edition", id: "00000000-0000-4000-8000-000000000002" },
        model: "openai/text-embedding-3-small",
        limit: 10,
        retryBlocked: false
      },
      { idempotencyKey: `legal-preparation:${"a".repeat(64)}:1`, idempotencyKeyTTL: "7d" }
    )
    return {
      waveId: input.waveId,
      inspected: 1,
      afterDispatchId: "a".repeat(64),
      exhausted: true,
      results: [
        {
          dispatchId: "a".repeat(64),
          preparationId: "b".repeat(64),
          status: observed.status,
          disposition: "replacement_ready",
          replacement: { dispatchId: "a".repeat(64), runId: replacement.id, attempt: 1, reused: false }
        }
      ]
    }
  })
})
afterEach(() => vi.unstubAllEnvs())

it("reads remote disposition and submits a replacement with the persisted attempt key", async () => {
  await expect(runRegulatoryPreparationRecovery(input)).resolves.toMatchObject({
    results: [{ status: "FAILED", replacement: { runId: "replacement-run", attempt: 1 } }]
  })
  expect(mocks.retrieve).toHaveBeenCalledWith("old-run")
  expect(mocks.key).toHaveBeenCalledWith(`legal-preparation:${"a".repeat(64)}:1`, { scope: "global" })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-passage-preparation",
    expect.objectContaining({ retryBlocked: false }),
    { idempotencyKey: "global-key", idempotencyKeyTTL: "7d" }
  )
  expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({ max: 2, statement_timeout: 30_000 }))
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("treats a retained-history 404 as missing and propagates other inspection failures", async () => {
  mocks.retrieve.mockRejectedValueOnce(Object.assign(new Error("gone"), { status: 404 }))
  await expect(runRegulatoryPreparationRecovery(input)).resolves.toMatchObject({
    results: [{ status: "MISSING" }]
  })
  mocks.retrieve.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 }))
  await expect(runRegulatoryPreparationRecovery(input)).rejects.toThrow("unavailable")
})

it("rejects an invalid page before opening the database", async () => {
  await expect(runRegulatoryPreparationRecovery({ ...input, limit: 11 })).rejects.toThrow()
  expect(mocks.pool).not.toHaveBeenCalled()
})
