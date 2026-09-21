import { expect, it, vi } from "vitest"
import { researchSnapshotPersistence } from "./snapshotPersistence.server"

const { createDatabase, withReadOnlyDatabase, configuration, pool } = vi.hoisted(() => {
  const pool = {}
  return {
    pool,
    configuration: { database: { maxConnections: 10, connectionTimeoutMs: 10000 } },
    createDatabase: vi.fn<() => { pool: object }>(() => ({ pool })),
    withReadOnlyDatabase: vi.fn<() => Promise<{ retained: boolean }>>(async () => ({ retained: true }))
  }
})

vi.mock("@repo/legislation-core/database/database", () => ({ createDatabase, withReadOnlyDatabase }))
vi.mock("../configuration/config", () => ({ loadConfig: () => configuration }))

it("restores concurrent snapshots through configured queue-aware capacity rather than a single-connection clamp", async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () => researchSnapshotPersistence.read(crypto.randomUUID(), crypto.randomUUID()))
  )
  expect(createDatabase).toHaveBeenCalledExactlyOnceWith(configuration.database, { waitForConnection: true })
  expect(withReadOnlyDatabase).toHaveBeenCalledTimes(8)
  expect(withReadOnlyDatabase).toHaveBeenCalledWith(pool, 5000, expect.any(Function))
  expect(results).toEqual(Array.from({ length: 8 }, () => ({ retained: true })))
})
