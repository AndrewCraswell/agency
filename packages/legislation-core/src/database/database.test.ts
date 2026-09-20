import { afterEach, describe, expect, it, vi } from "vitest"
import { createDatabase, withReadOnlyDatabase } from "./database"

const pools: Array<ReturnType<typeof createDatabase>["pool"]> = []
const config = {
  connectionTimeoutMs: 1_000,
  idleTimeoutMs: 1_000,
  maxConnections: 4,
  url: "postgresql://legislation:legislation@127.0.0.1:55432/legislation"
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()))
  vi.restoreAllMocks()
})

describe("read-only connection failures", () => {
  it("still times out a stalled connection handshake after research admission", async () => {
    const sockets = new Set<Socket>()
    const server = createServer((socket) => {
      sockets.add(socket)
      socket.once("close", () => sockets.delete(socket))
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    try {
      const address = server.address()
      if (address === null || typeof address === "string") throw new Error("Missing test listener")
      const { pool } = createDatabase(
        { ...config, url: `postgresql://fixture@127.0.0.1:${address.port}/fixture`, connectionTimeoutMs: 100 },
        { waitForConnection: true }
      )
      pools.push(pool)
      const operation = vi.fn<() => Promise<string>>()
      await expect(withReadOnlyDatabase(pool, 1000, operation)).rejects.toMatchObject({
        category: "dependency_unavailable",
        details: { reason: "timeout", retryable: true }
      })
      expect(operation).not.toHaveBeenCalled()
      expect(pool.totalCount).toBe(0)
    } finally {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
  it.each([
    "timeout exceeded when trying to connect",
    "Connection terminated due to connection timeout",
    "timeout expired"
  ])("classifies the pg-pool timeout %s before query execution", async (message) => {
    const { pool } = createDatabase(config)
    pools.push(pool)
    const failure = new Error(message)
    const connect = vi.spyOn(pool, "connect").mockRejectedValueOnce(failure)
    const operation = vi.fn<() => Promise<string>>()

    await expect(withReadOnlyDatabase(pool, 15_000, operation)).rejects.toMatchObject({
      category: "dependency_unavailable",
      message: "The database connection timed out.",
      details: { reason: "timeout", retryable: true },
      cause: failure
    })
    expect(connect).toHaveBeenCalledOnce()
    expect(operation).not.toHaveBeenCalled()
  })

  it("preserves unknown acquisition errors instead of guessing a timeout", async () => {
    const { pool } = createDatabase(config)
    pools.push(pool)
    const failure = new Error("Unknown connection failure")
    vi.spyOn(pool, "connect").mockRejectedValueOnce(failure)
    const operation = vi.fn<() => Promise<string>>()

    await expect(withReadOnlyDatabase(pool, 15_000, operation)).rejects.toBe(failure)
    expect(operation).not.toHaveBeenCalled()
  })

  it("preserves caller cancellation when acquisition also times out", async () => {
    const { pool } = createDatabase(config)
    pools.push(pool)
    const caller = new AbortController()
    const cancellation = new Error("Research stopped")
    vi.spyOn(pool, "connect").mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"))
    const operation = vi.fn<() => Promise<string>>()
    const result = withReadOnlyDatabase(pool, 15_000, operation, caller.signal)
    caller.abort(cancellation)

    await expect(result).rejects.toBe(cancellation)
    expect(operation).not.toHaveBeenCalled()
  })
})

describe("createDatabase", () => {
  it("keeps a finite connection-establishment timeout without timing out a busy research queue", () => {
    const { pool } = createDatabase(config, { waitForConnection: true })
    pools.push(pool)
    expect(pool.options.max).toBe(config.maxConnections)
    expect(pool.options.connectionTimeoutMillis).toBe(config.connectionTimeoutMs)
    expect(pool.options.statement_timeout).toBeUndefined()
  })
  it("leaves durable commits enabled by default", () => {
    const created = createDatabase(config)
    pools.push(created.pool)

    expect(created.pool.options.options).toBeUndefined()
  })

  it("applies asynchronous commits only to an explicitly configured pool", () => {
    const created = createDatabase(config, { synchronousCommit: "off" })
    pools.push(created.pool)

    expect(created.pool.options.options).toBe("-c synchronous_commit=off")
  })

  it("configures a bounded PostgreSQL statement deadline only when requested", () => {
    const created = createDatabase(config, { statementTimeoutMs: 15_000 })
    pools.push(created.pool)

    expect(created.pool.options.statement_timeout).toBe(15_000)
  })

  it("rejects unsafe statement deadline values", () => {
    expect(() => createDatabase(config, { statementTimeoutMs: 999 })).toThrow(RangeError)
    expect(() => createDatabase(config, { statementTimeoutMs: 60_001 })).toThrow(RangeError)
  })
})
import { once } from "node:events"
import { createServer, type Socket } from "node:net"
