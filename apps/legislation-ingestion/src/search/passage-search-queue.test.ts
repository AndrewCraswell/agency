import { describe, expect, it, vi } from "vitest"
import { drainPassageChanges, enqueuePassageBackfill } from "./passage-search-queue.js"
import { type ReplicationConnection } from "./passage-search-replication.js"

function setup(events: unknown[]) {
  const calls: { side: string; text: string; values?: unknown[] }[] = []
  const source: ReplicationConnection = {
    query: vi.fn<ReplicationConnection["query"]>(async (text, values) => {
      calls.push({ side: "source", text, values })
      if (text.startsWith("select id::text")) {
        return { rows: events }
      }
      return { rows: text.startsWith("with checkpoint") ? [{ enqueued: 250 }] : [] }
    })
  }
  const target: ReplicationConnection = {
    query: vi.fn<ReplicationConnection["query"]>(async (text, values) => {
      calls.push({ side: "target", text, values })
      return { rows: [] }
    })
  }
  return { source, target, calls }
}

describe("passage search change queue", () => {
  it("coalesces observed document events but acknowledges only their exact IDs after target commit", async () => {
    const { source, target, calls } = setup(
      ["3", "7"].map((id) => ({ id, entity_kind: "document", entity_id: "doc", after_document_id: null }))
    )
    await expect(drainPassageChanges(source, target)).resolves.toEqual({
      events: 2,
      documents: 1,
      sections: 0,
      deferred: 0
    })
    const ack = calls.findIndex((call) => call.text.startsWith("delete from legislation.passage_search_changes"))
    const commit = calls.findIndex((call) => call.side === "target" && call.text === "commit")
    expect(ack).toBeGreaterThan(commit)
    expect(calls[ack]?.values).toEqual([["3", "7"]])
    expect(calls.filter((call) => call.text.includes("pg_advisory_xact_lock"))).toHaveLength(1)
  })

  it("leaves events pending when replication fails", async () => {
    const { source, target, calls } = setup([
      { id: "1", entity_kind: "document", entity_id: "doc", after_document_id: null }
    ])
    const original = target.query
    target.query = async (text, values) => {
      if (text.startsWith("delete from")) {
        throw new Error("offline")
      }
      return original(text, values)
    }
    await expect(drainPassageChanges(source, target)).resolves.toEqual({
      events: 1,
      documents: 0,
      sections: 0,
      deferred: 1
    })
    expect(calls.some((call) => call.text.startsWith("delete from legislation.passage_search_changes"))).toBe(false)
  })

  it("expands bills with a locked checkpoint instead of treating them as document IDs", async () => {
    const { source, target, calls } = setup([
      { id: "2", entity_kind: "bill", entity_id: "bill", after_document_id: "old" }
    ])
    await expect(drainPassageChanges(source, target)).resolves.toEqual({
      events: 1,
      documents: 0,
      sections: 0,
      deferred: 0
    })
    const expansion = calls.find((call) => call.text.startsWith("with event"))
    expect(expansion?.values).toEqual(["2"])
    expect(expansion?.text).toContain("for update")
    expect(expansion?.text).toContain("limit 250")
    expect(calls.some((call) => call.side === "target")).toBe(false)
  })

  it("enqueues one bounded backfill page and commits its checkpoint with the events", async () => {
    const { source, calls } = setup([])
    await expect(enqueuePassageBackfill(source)).resolves.toBe(250)
    const query = calls.find((call) => call.text.startsWith("with checkpoint"))
    expect(query?.text).toContain("for update")
    expect(query?.text).toContain("insert into legislation.passage_search_changes")
    expect(query?.text).toContain("limit 250")
    expect(calls.at(-1)?.text).toBe("commit")
  })

  it("does not acknowledge anything when the queue is empty", async () => {
    const { source, target } = setup([])
    await expect(drainPassageChanges(source, target)).resolves.toEqual({
      events: 0,
      documents: 0,
      sections: 0,
      deferred: 0
    })
    expect(target.query).not.toHaveBeenCalled()
  })

  it("splits a failed batch and acknowledges healthy documents without losing the failing event", async () => {
    const { source, target, calls } = setup(
      ["bad", "good"].map((id, i) => ({
        id: String(i + 1),
        entity_kind: "document",
        entity_id: id,
        after_document_id: null
      }))
    )
    const original = target.query
    target.query = async (text, values) => {
      if (text.startsWith("delete from") && Array.isArray(values?.[0]) && values[0].includes("bad")) {
        throw new Error("oversized")
      }
      return original(text, values)
    }
    await expect(drainPassageChanges(source, target)).resolves.toEqual({
      events: 2,
      documents: 1,
      sections: 0,
      deferred: 1
    })
    expect(
      calls.find((call) => call.text.startsWith("delete from legislation.passage_search_changes"))?.values
    ).toEqual([["2"]])
    expect(calls.find((call) => call.text.startsWith("update legislation.passage_search_changes"))?.values).toEqual([
      ["1"]
    ])
  })

  it("stops between bill expansions at the aggregate deadline", async () => {
    const { source, target, calls } = setup(
      ["1", "2"].map((id) => ({ id, entity_kind: "bill", entity_id: id, after_document_id: null }))
    )
    let clock = 0
    const original = source.query
    source.query = async (text, values) => {
      const result = await original(text, values)
      if (text.startsWith("with event")) {
        clock = 1001
      }
      return result
    }
    await drainPassageChanges(source, target, { budgetMs: 1000, now: () => clock })
    expect(calls.filter((call) => call.text.startsWith("with event"))).toHaveLength(1)
  })

  it("isolates an oversized first document within the aggregate budget instead of repeating failed ancestors", async () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      id: String(i + 1),
      entity_kind: "document",
      entity_id: i === 0 ? "bad" : `good-${i}`,
      after_document_id: null
    }))
    const { source, target } = setup(events)
    const original = target.query
    let clock = 0
    target.query = async (text, values) => {
      if (text.startsWith("delete from") && Array.isArray(values?.[0]) && values[0].includes("bad")) {
        clock += 60_000
        throw new Error("statement timeout")
      }
      return original(text, values)
    }
    await expect(drainPassageChanges(source, target, { now: () => clock })).resolves.toEqual({
      events: 100,
      documents: 99,
      sections: 0,
      deferred: 1
    })
    expect(clock).toBe(120_000)
  })
})
