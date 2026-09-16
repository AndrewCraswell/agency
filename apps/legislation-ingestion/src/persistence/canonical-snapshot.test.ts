import { createDatabase } from "@repo/legislation-core/database/database"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../config/config.js"
import { withIngestionRun } from "../ingestion/run-context.js"
import { observeCanonicalSnapshot, planCanonicalChange } from "./changes.js"

const { database, pool } = createDatabase(loadConfig({ NODE_ENV: "test" }).database)
const query = vi.spyOn(pool, "query")
beforeEach(() => query.mockReset().mockImplementation(vi.fn(async () => ({ rows: [] }))))
afterAll(async () => {
  query.mockRestore()
  await pool.end()
})
const input = (id: string) => ({
  recordType: "organization-membership",
  recordId: id,
  fields: { isActive: false },
  source: { sourceUrl: "https://www.govinfo.gov/test", sourceProvider: "govinfo", sourceIsOfficial: true }
})
const tracked = (operation: () => Promise<void>) => withIngestionRun("00000000-0000-4000-8000-000000000001", operation)

describe("canonical snapshot batches", () => {
  it("uses three statements per 250 changed records, not per person", async () => {
    await tracked(() =>
      observeCanonicalSnapshot(
        database,
        Array.from({ length: 501 }, (_, i) => input(String(i)))
      )
    )
    expect(query).toHaveBeenCalledTimes(9)
    const text = query.mock.calls.map((call) => JSON.stringify(call[0]))
    expect(text.filter((sql) => sql.includes("select"))).toHaveLength(3)
    expect(text.filter((sql) => sql.includes("change_events"))).toHaveLength(3)
  })
  it("does not write unchanged snapshots", async () => {
    const record = input("unchanged")
    const planned = planCanonicalChange(record)!
    query.mockImplementation(
      vi.fn(async () => ({
        rows: [[record.recordType, record.recordId, planned.fingerprint, planned.after, new Date().toISOString()]]
      }))
    )
    await tracked(() => observeCanonicalSnapshot(database, [record]))
    expect(query).toHaveBeenCalledOnce()
  })
  it("rejects duplicate identities before database work", async () => {
    await expect(tracked(() => observeCanonicalSnapshot(database, [input("same"), input("same")]))).rejects.toThrow(
      "Duplicate canonical"
    )
    expect(query).not.toHaveBeenCalled()
  })
  it("preserves planned event identity, before/after, and supplied source without source queries", async () => {
    const record = input("changed")
    const previous = planCanonicalChange({ ...record, fields: { isActive: true } })!
    query.mockImplementationOnce(
      vi.fn(async () => ({
        rows: [[record.recordType, record.recordId, previous.fingerprint, previous.after, new Date().toISOString()]]
      }))
    )
    await tracked(() => observeCanonicalSnapshot(database, [record]))
    const expected = planCanonicalChange(record, { fields: previous.after, fingerprint: previous.fingerprint })!
    const calls = JSON.stringify(query.mock.calls)
    expect(calls).toContain(expected.id)
    expect(calls).toContain("https://www.govinfo.gov/test")
    expect(calls).toContain(expected.fingerprint)
    expect(query).toHaveBeenCalledTimes(3)
  })
  it("keeps different record types separate", async () => {
    await tracked(() =>
      observeCanonicalSnapshot(database, [input("same"), { ...input("same"), recordType: "organization" }])
    )
    expect(query).toHaveBeenCalledTimes(6)
  })
  it("does no work outside ingestion or for an empty snapshot", async () => {
    await observeCanonicalSnapshot(database, [input("one")])
    await tracked(() => observeCanonicalSnapshot(database, []))
    expect(query).not.toHaveBeenCalled()
  })
  it("propagates database failures to the enclosing snapshot transaction", async () => {
    query.mockRejectedValueOnce(new Error("connection lost"))
    await expect(tracked(() => observeCanonicalSnapshot(database, [input("one")]))).rejects.toThrow("Failed query")
    expect(query).toHaveBeenCalledOnce()
  })
})
