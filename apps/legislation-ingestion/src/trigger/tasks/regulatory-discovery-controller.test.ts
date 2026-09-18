import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<(options: unknown) => void>(),
  end: vi.fn<() => Promise<void>>(),
  register:
    vi.fn<typeof import("../../ingestion/regulations/discovery-registration.js").registerLegalDiscoveryManifest>(),
  plan: vi.fn<typeof import("../../ingestion/regulations/discovery-dispatch.js").planLegalDiscoveryDispatchPage>(),
  submit: vi.fn<typeof import("../../ingestion/regulations/discovery-dispatch.js").submitLegalDiscoveryDispatch>(),
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
  idempotencyKeys: { create: mocks.key }
}))
vi.mock("../../ingestion/regulations/discovery-registration.js", () => ({
  registerLegalDiscoveryManifest: mocks.register
}))
vi.mock("../../ingestion/regulations/discovery-dispatch.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/discovery-dispatch.js")>()),
  planLegalDiscoveryDispatchPage: mocks.plan,
  submitLegalDiscoveryDispatch: mocks.submit
}))

import { runRegulatoryDiscoveryController } from "./regulatory-discovery-controller.js"

const scope = {
  sourceId: "ecfr" as const,
  scopeKey: "a".repeat(64),
  afterUnitKey: null,
  limit: 25,
  submissionConcurrency: 4
}
const payload = { manifestId: "b".repeat(64), unitKey: "c".repeat(64) }
const firstDispatch = { id: "d".repeat(64), stage: "acquisition" as const, payload, payloadHash: "e".repeat(64) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/canonical")
  mocks.key.mockResolvedValue("global-key")
  mocks.trigger.mockResolvedValue({ id: "run-1" })
  mocks.register.mockResolvedValue(null)
  mocks.plan.mockResolvedValue({
    dispatches: [firstDispatch],
    selected: 1,
    afterUnitKey: payload.unitKey,
    exhausted: true
  })
  mocks.submit.mockImplementation(async (_pool, id, submit) => {
    const run = await submit("acquisition", payload, {
      idempotencyKey: `legal-discovery:${id}:0`,
      idempotencyKeyTTL: "7d"
    })
    return { dispatchId: id, runId: run.id, attempt: 0, reused: false }
  })
})
afterEach(() => vi.unstubAllEnvs())

it("persists a bounded page before submitting its stage workers with global keys", async () => {
  await expect(runRegulatoryDiscoveryController(scope)).resolves.toMatchObject({ selected: 1, submitted: 1 })
  expect(mocks.register).toHaveBeenCalledWith(expect.anything(), {
    sourceId: scope.sourceId,
    scopeKey: scope.scopeKey,
    limit: scope.limit
  })
  expect(mocks.plan).toHaveBeenCalledWith(expect.anything(), scope)
  expect(mocks.key).toHaveBeenCalledWith(`legal-discovery:${"d".repeat(64)}:0`, { scope: "global" })
  expect(mocks.trigger).toHaveBeenCalledWith("regulatory-discovery-acquisition", payload, {
    idempotencyKey: "global-key",
    idempotencyKeyTTL: "7d"
  })
  expect(mocks.end).toHaveBeenCalledOnce()
})

it.each([
  { ...scope, limit: 0 },
  { ...scope, limit: 101 },
  { ...scope, scopeKey: "bad" },
  { ...scope, submissionConcurrency: 0 },
  { ...scope, submissionConcurrency: 17 }
])("rejects an invalid or unbounded page before opening the database", async (input) => {
  await expect(runRegulatoryDiscoveryController(input)).rejects.toThrow()
  expect(mocks.pool).not.toHaveBeenCalled()
})

it("waits for bounded peer submissions before surfacing an uncertain result", async () => {
  const second = { id: "f".repeat(64), stage: "parsing" as const, payload, payloadHash: "1".repeat(64) }
  mocks.plan.mockResolvedValueOnce({
    dispatches: [firstDispatch, second],
    selected: 2,
    afterUnitKey: payload.unitKey,
    exhausted: true
  })
  mocks.submit.mockRejectedValueOnce(new Error("uncertain"))
  await expect(runRegulatoryDiscoveryController(scope)).rejects.toThrow("uncertain")
  expect(mocks.submit).toHaveBeenCalledTimes(2)
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("never exceeds the requested submission concurrency", async () => {
  const dispatches = Array.from({ length: 6 }, (_, index) => ({
    ...firstDispatch,
    id: index.toString(16).repeat(64),
    payload: { ...payload, unitKey: (index + 1).toString(16).repeat(64) }
  }))
  mocks.plan.mockResolvedValueOnce({
    dispatches,
    selected: dispatches.length,
    afterUnitKey: dispatches.at(-1)!.payload.unitKey,
    exhausted: true
  })
  let active = 0
  let peak = 0
  mocks.submit.mockImplementation(async (_pool, id) => {
    active++
    peak = Math.max(peak, active)
    await new Promise<void>((resolve) => setTimeout(resolve, 5))
    active--
    return { dispatchId: id, runId: `run-${id}`, attempt: 0, reused: false }
  })
  await expect(runRegulatoryDiscoveryController({ ...scope, submissionConcurrency: 2 })).resolves.toMatchObject({
    selected: 6,
    submitted: 6,
    submissionConcurrency: 2
  })
  expect(peak).toBe(2)
})
