import { afterEach, expect, it, vi } from "vitest"
import { getResearchRuntime } from "./research-runtime"

const { createDatabase, createReadOnlyDatabase, configuration, retrieval } = vi.hoisted(() => {
  const end = vi.fn<() => Promise<void>>(async () => undefined)
  const databaseFixture = () => ({ pool: { end }, database: {} })
  const readOnlyFixture = () => ({})
  return {
    end,
    createDatabase: vi.fn<typeof databaseFixture>(databaseFixture),
    createReadOnlyDatabase: vi.fn<typeof readOnlyFixture>(readOnlyFixture),
    retrieval: vi.fn<(options: unknown) => void>(),
    configuration: {
      database: { maxConnections: 10, apiStatementTimeoutMs: 15000 },
      passageSearch: {
        enabled: false,
        database: { maxConnections: 5, apiStatementTimeoutMs: 10000 },
        rankingGeneration: "fixture"
      },
      model: {
        apiKey: "fixture-key",
        baseUrl: "https://openrouter.ai/api/v1",
        embeddingTimeoutMs: 45000,
        generationTimeoutMs: 90000,
        rerankTimeoutMs: 20000
      }
    }
  }
})

vi.mock("@repo/legislation-core/database/database", () => ({ createDatabase }))
vi.mock("@repo/legislation-core/database/read-only-database", () => ({ createReadOnlyDatabase }))
vi.mock("../configuration/config", () => ({ loadConfig: () => configuration }))
vi.mock("../../services/openrouter/openrouter-retrieval", () => ({
  OpenRouterRetrievalClient: class {
    constructor(options: unknown) {
      retrieval(options)
    }
  }
}))
vi.mock("../legislation/query-service", () => ({ LegislationQueryService: class {} }))
vi.mock("./ranked-passage-search", () => ({ createRankedPassageSearch: vi.fn<() => void>() }))

afterEach(async () => {
  await globalThis.__legislationResearchRuntime?.close()
  globalThis.__legislationResearchRuntime = undefined
  configuration.passageSearch.enabled = false
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it("honors configured capacity and defers acquisition to SQL execution", async () => {
  const result = { items: [{ id: "bill:us:119:hr:1" }] }
  const runtime = getResearchRuntime()
  await expect(runtime.run(async () => result)).resolves.toBe(result)
  expect(createDatabase).toHaveBeenCalledExactlyOnceWith(configuration.database, { waitForConnection: true })
  expect(createReadOnlyDatabase).toHaveBeenCalledExactlyOnceWith(
    expect.any(Object),
    15000,
    undefined,
    expect.any(Function)
  )
  expect(getResearchRuntime()).toBe(runtime)
})

it("passes cancellation to both data stores and retrieval without clamping capacity", async () => {
  configuration.passageSearch.enabled = true
  const caller = new AbortController()
  await getResearchRuntime().run(async () => "result", caller.signal)
  expect(createDatabase).toHaveBeenNthCalledWith(2, configuration.passageSearch.database, {
    waitForConnection: true
  })
  expect(createReadOnlyDatabase).toHaveBeenNthCalledWith(
    1,
    expect.any(Object),
    15000,
    caller.signal,
    expect.any(Function)
  )
  expect(createReadOnlyDatabase).toHaveBeenNthCalledWith(
    2,
    expect.any(Object),
    10000,
    caller.signal,
    expect.any(Function)
  )
  expect(retrieval).toHaveBeenCalledWith(
    expect.objectContaining({
      signal: caller.signal,
      embeddingTimeoutMs: 45000,
      generationTimeoutMs: 90000,
      rerankTimeoutMs: 20000
    })
  )
})

it("does not impose a whole-service timer or retry an unknown failure", async () => {
  vi.useFakeTimers()
  const pending = Promise.withResolvers<string>()
  const operation = vi.fn<() => Promise<string>>(() => pending.promise)
  const result = getResearchRuntime().run(operation)
  const failure = new Error("Unknown service failure")
  await vi.advanceTimersByTimeAsync(60_000)
  pending.reject(failure)
  await expect(result).rejects.toBe(failure)
  expect(operation).toHaveBeenCalledOnce()
})

it("does not start cancelled research and discards late results", async () => {
  const caller = new AbortController()
  const cancellation = new Error("Caller stopped research")
  caller.abort(cancellation)
  const operation = vi.fn<() => Promise<string>>(async () => "result")
  await expect(getResearchRuntime().run(operation, caller.signal)).rejects.toBe(cancellation)
  expect(operation).not.toHaveBeenCalled()

  const active = new AbortController()
  await expect(
    getResearchRuntime().run(async () => {
      active.abort(cancellation)
      return "late result"
    }, active.signal)
  ).rejects.toBe(cancellation)
})
