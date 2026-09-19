import { afterEach, expect, it, vi } from "vitest"
import { getResearchRuntime } from "./research-runtime"

const { createDatabase, withReadOnlyDatabase, end } = vi.hoisted(() => {
  const end = vi.fn<() => Promise<void>>(async () => undefined)
  const databaseFixture = () => ({ pool: { end }, database: {} })
  return {
    end,
    createDatabase: vi.fn<typeof databaseFixture>(databaseFixture),
    withReadOnlyDatabase: vi.fn<
      (
        pool: unknown,
        timeout: number,
        operation: (database: unknown) => Promise<unknown>,
        signal?: AbortSignal
      ) => Promise<unknown>
    >(async (_pool, _timeout, operation) => operation({}))
  }
})

vi.mock("@repo/legislation-core/database/database", () => ({ createDatabase, withReadOnlyDatabase }))
vi.mock("../configuration/config", () => ({
  loadConfig: () => ({
    database: { maxConnections: 10, apiStatementTimeoutMs: 15000 },
    passageSearch: { enabled: false },
    model: {}
  })
}))
vi.mock("../legislation/query-service", () => ({ LegislationQueryService: class {} }))
vi.mock("./ranked-passage-search", () => ({ createRankedPassageSearch: vi.fn<() => void>() }))

afterEach(async () => {
  await globalThis.__legislationResearchRuntime?.close()
  globalThis.__legislationResearchRuntime = undefined
  vi.clearAllMocks()
  vi.restoreAllMocks()
  withReadOnlyDatabase.mockImplementation(async (_pool, _timeout, operation) => operation({}))
})

it("keeps bounded read-only execution and does not retry a failed dependency", async () => {
  const failure = new Error("Unknown database connection failure")
  withReadOnlyDatabase.mockRejectedValueOnce(failure)
  const operation = vi.fn<() => Promise<string>>(async () => "result")
  await expect(getResearchRuntime().run(operation)).rejects.toBe(failure)
  expect(createDatabase).toHaveBeenCalledExactlyOnceWith({ maxConnections: 2, apiStatementTimeoutMs: 15000 })
  expect(withReadOnlyDatabase).toHaveBeenCalledExactlyOnceWith(
    expect.any(Object),
    15000,
    expect.any(Function),
    expect.any(AbortSignal)
  )
  expect(operation).not.toHaveBeenCalled()
})

it("classifies its actual deadline as timeout without guessing from an unrelated exception", async () => {
  const deadline = new AbortController()
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal)
  withReadOnlyDatabase.mockImplementationOnce(async () => {
    deadline.abort(new DOMException("Fixture deadline elapsed", "TimeoutError"))
    throw new Error("Connection cancelled by signal")
  })
  await expect(getResearchRuntime().run(async () => "result")).rejects.toMatchObject({
    category: "dependency_unavailable",
    details: { reason: "timeout", retryable: true }
  })
  expect(timeout).toHaveBeenCalledExactlyOnceWith(30000)
  expect(withReadOnlyDatabase).toHaveBeenCalledOnce()
})

it("preserves explicit caller cancellation instead of misreporting a deadline", async () => {
  const caller = new AbortController()
  const deadline = new AbortController()
  const cancellation = new Error("Caller stopped research")
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal)
  withReadOnlyDatabase.mockImplementationOnce(async (_pool, _timeout, _operation, signal) => {
    caller.abort(cancellation)
    deadline.abort(new DOMException("Fixture deadline elapsed", "TimeoutError"))
    expect(signal?.aborted).toBe(true)
    throw cancellation
  })
  await expect(getResearchRuntime().run(async () => "result", caller.signal)).rejects.toBe(cancellation)
})

it("returns successful results and reuses its pool until explicitly closed", async () => {
  const runtime = getResearchRuntime()
  const result = { items: [{ id: "bill:us:119:hr:1" }] }
  await expect(runtime.run(async () => result)).resolves.toBe(result)
  expect(getResearchRuntime()).toBe(runtime)
  expect(createDatabase).toHaveBeenCalledOnce()
  await runtime.close()
  expect(end).toHaveBeenCalledOnce()
})
