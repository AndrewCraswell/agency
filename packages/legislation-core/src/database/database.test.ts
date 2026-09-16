import { afterEach, describe, expect, it } from "vitest"
import { createDatabase } from "./database"

const pools: Array<ReturnType<typeof createDatabase>["pool"]> = []
const config = {
  connectionTimeoutMs: 1_000,
  idleTimeoutMs: 1_000,
  maxConnections: 4,
  url: "postgresql://legislation:legislation@127.0.0.1:55432/legislation"
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()))
})

describe("createDatabase", () => {
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
