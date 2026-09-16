import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runSynchronizationCycle } from "./passage-search-synchronization.js"

const mocks = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>(),
  end: vi.fn<() => Promise<void>>(),
  ready: vi.fn<() => Promise<number>>(),
  enqueue: vi.fn<() => Promise<number>>(),
  drain: vi.fn<() => Promise<{ events: number; documents: number; sections: number; deferred: number }>>(),
  warn: vi.fn<(message: string, context: unknown) => void>()
}))
vi.mock("pg", () => ({
  default: {
    Client: class {
      connect = mocks.connect
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  schedules: { task: (value: unknown) => value },
  logger: { info: () => undefined, warn: mocks.warn }
}))
vi.mock("../../search/passage-search-queue.js", () => ({
  countReadyPassageChanges: mocks.ready,
  enqueuePassageBackfill: mocks.enqueue,
  drainPassageChanges: mocks.drain
}))

describe("passage synchronization cycle", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
    vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://target/legislation_passage_search")
    vi.stubEnv("PASSAGE_SEARCH_READ_CONCURRENCY", "1")
    mocks.ready.mockResolvedValue(0)
    mocks.enqueue.mockResolvedValue(0)
    mocks.drain.mockResolvedValue({ events: 1, documents: 1, sections: 2, deferred: 0 })
  })
  afterEach(() => vi.unstubAllEnvs())
  it("allocates and closes the configured parallel readers without adding publishers", async () => {
    vi.stubEnv("PASSAGE_SEARCH_READ_CONCURRENCY", "2")
    mocks.ready.mockResolvedValueOnce(1)
    await runSynchronizationCycle(false)
    expect(mocks.connect).toHaveBeenCalledTimes(3)
    expect(mocks.end).toHaveBeenCalledTimes(3)
    expect(mocks.drain).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        readers: [expect.anything()]
      })
    )
  })
  it("does not enqueue a backfill when it was not requested", async () => {
    await expect(runSynchronizationCycle(false)).resolves.toEqual({
      enqueued: 0,
      events: 0,
      documents: 0,
      sections: 0,
      deferred: 0
    })
    expect(mocks.enqueue).not.toHaveBeenCalled()
    expect(mocks.end).toHaveBeenCalledTimes(2)
  })
  it("drains pending work, reports deferred records and stops when caught up", async () => {
    mocks.ready.mockResolvedValueOnce(1)
    mocks.drain.mockResolvedValueOnce({ events: 2, documents: 1, sections: 3, deferred: 1 })
    await expect(runSynchronizationCycle(true)).resolves.toEqual({
      enqueued: 0,
      events: 2,
      documents: 1,
      sections: 3,
      deferred: 1
    })
    expect(mocks.warn).toHaveBeenCalledWith("Passage search records remain deferred for retry", { deferred: 1 })
    expect(mocks.end).toHaveBeenCalledTimes(2)
  })
  it("closes both connections on queue failure", async () => {
    mocks.ready.mockRejectedValue(new Error("queue unavailable"))
    await expect(runSynchronizationCycle(false)).rejects.toThrow("queue unavailable")
    expect(mocks.end).toHaveBeenCalledTimes(2)
  })
  it("rejects canonical database targets before connecting", async () => {
    vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://target/canonical")
    await expect(runSynchronizationCycle(false)).rejects.toThrow("isolated")
    expect(mocks.connect).not.toHaveBeenCalled()
  })
})
