import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import { runRegulatoryPreparationDispatch } from "./regulatory-preparation-dispatch.js"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<(options: unknown) => void>(),
  end: vi.fn<() => Promise<void>>(),
  query: vi.fn<() => Promise<{ rows: { name: string }[] }>>(),
  submit: vi.fn<typeof import("../../ingestion/regulations/preparation-dispatch.js").submitLegalPreparation>(),
  register:
    vi.fn<typeof import("../../ingestion/regulations/preparation-dispatch.js").registerLegalPreparationDispatch>(),
  plan: vi.fn<typeof import("../../ingestion/regulations/preparation-plan.js").planLegalPreparationPage>(),
  key: vi.fn<(key: string, options: { scope: string }) => Promise<string>>(),
  trigger: vi.fn<(task: string, payload: unknown, options: unknown) => Promise<{ id: string }>>()
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(options: unknown) {
        mocks.pool(options)
      }
      query = mocks.query
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  tasks: { trigger: mocks.trigger },
  idempotencyKeys: { create: mocks.key }
}))
vi.mock("../../ingestion/regulations/preparation-dispatch.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../ingestion/regulations/preparation-dispatch.js")>()),
  submitLegalPreparation: mocks.submit,
  registerLegalPreparationDispatch: mocks.register
}))
vi.mock("../../ingestion/regulations/preparation-plan.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../ingestion/regulations/preparation-plan.js")>()),
  planLegalPreparationPage: mocks.plan
}))
const dispatch = {
  waveId: "00000000-0000-4000-8000-000000000001",
  scope: { kind: "edition", id: "00000000-0000-4000-8000-000000000002" },
  model: "openai/text-embedding-3-small"
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  mocks.query.mockResolvedValue({ rows: [{ name: "canonical" }] })
  mocks.key.mockResolvedValue("global-key")
  mocks.trigger.mockResolvedValue({ id: "run" })
  mocks.submit.mockImplementation(async (_pool, _value, submit) => {
    const result = await submit(
      {
        scope: { kind: "edition", id: dispatch.scope.id },
        model: "openai/text-embedding-3-small",
        limit: 10,
        retryBlocked: false
      },
      { idempotencyKey: "durable-key", idempotencyKeyTTL: "7d" }
    )
    return { dispatchId: "a".repeat(64), runId: result.id, reused: false }
  })
})
afterEach(() => vi.unstubAllEnvs())
it("plans source references without submitting preparation children", async () => {
  const plan = {
    waveId: dispatch.waveId,
    source: "ecfr",
    model: dispatch.model,
    publishedBefore: "2026-09-15T00:00:00Z"
  }
  mocks.plan.mockResolvedValue({
    waveId: dispatch.waveId,
    planned: 0,
    selectedCount: 0,
    afterId: null,
    exhausted: true,
    dispatchIds: [],
    submitted: false
  })
  expect(await runRegulatoryPreparationDispatch({ plan })).toMatchObject({ planned: 0, submitted: false })
  expect(mocks.plan).toHaveBeenCalledOnce()
  expect(mocks.trigger).not.toHaveBeenCalled()
  expect(mocks.submit).not.toHaveBeenCalled()
  expect(mocks.end).toHaveBeenCalledOnce()
})
it.each([
  { dispatches: [] },
  { dispatches: [dispatch, dispatch] },
  { dispatches: Array(11).fill(dispatch) },
  { dispatches: [{ ...dispatch, limit: 26 }] }
])("rejects unbounded or duplicate waves before side effects", async (value) => {
  await expect(runRegulatoryPreparationDispatch(value)).rejects.toThrow(ZodError)
  expect(mocks.pool).not.toHaveBeenCalled()
})
it("submits using global idempotency across parent runs and a bounded pool", async () => {
  expect(await runRegulatoryPreparationDispatch({ dispatches: [dispatch] })).toMatchObject({ submitted: 1 })
  expect(mocks.key).toHaveBeenCalledWith("durable-key", { scope: "global" })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-passage-preparation",
    expect.objectContaining({ retryBlocked: false }),
    { idempotencyKey: "global-key", idempotencyKeyTTL: "7d" }
  )
  expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({ max: 2, statement_timeout: 15_000 }))
  expect(mocks.end).toHaveBeenCalledOnce()
})
it("stops the wave on uncertainty and preserves the original failure", async () => {
  mocks.submit.mockRejectedValueOnce(new Error("uncertain"))
  await expect(
    runRegulatoryPreparationDispatch({
      dispatches: [dispatch, { ...dispatch, waveId: "00000000-0000-4000-8000-000000000003" }]
    })
  ).rejects.toThrow("uncertain")
  expect(mocks.submit).toHaveBeenCalledOnce()
  expect(mocks.register).toHaveBeenCalledTimes(2)
  expect(mocks.register.mock.invocationCallOrder[1]).toBeLessThan(mocks.submit.mock.invocationCallOrder[0]!)
  expect(mocks.end).toHaveBeenCalledOnce()
})
it("rejects the actual search database before recording intents", async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
  await expect(runRegulatoryPreparationDispatch({ dispatches: [dispatch] })).rejects.toThrow("canonical PostgreSQL")
  expect(mocks.submit).not.toHaveBeenCalled()
  expect(mocks.end).toHaveBeenCalledOnce()
})
