import { describe, expect, it, vi } from "vitest"
import { replicatePassageDocument, type ReplicationConnection } from "./passage-search-replication.js"

const section = (id: string) => ({
  id,
  document_id: "document",
  heading: null,
  text: "health insurance",
  content_hash: "hash",
  page_start: 1,
  page_end: 2,
  search_document_title: "Title",
  search_metadata: { processingStatus: "processed" }
})

function fixture(pages: unknown[][]) {
  const calls: { side: string; text: string; values: unknown[] | undefined }[] = []
  const source: ReplicationConnection = {
    query: vi.fn<ReplicationConnection["query"]>(async (text, values) => {
      calls.push({ side: "source", text, values })
      return { rows: text.startsWith("select s.id") ? (pages.shift() ?? []) : [] }
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

describe("passage document replication", () => {
  it("uses bounded 1000-section transfer pages by default", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => section(String(index).padStart(4, "0")))
    const { source, target, calls } = fixture([firstPage, [section("1000")]])
    await expect(replicatePassageDocument(source, target, "document")).resolves.toEqual({
      documentId: "document",
      sections: 1001
    })
    expect(calls.filter((call) => call.text.startsWith("select s.id")).map((call) => call.values)).toEqual([
      [["document"], null, 1000],
      [["document"], "0999", 1000]
    ])
    expect(calls.filter((call) => call.text === "commit").map((call) => call.side)).toEqual(["source", "target"])
  })
  it("serializes before taking the source snapshot and commits a complete keyset copy", async () => {
    const { source, target, calls } = fixture([[section("a"), section("b")], [section("c")]])
    await expect(replicatePassageDocument(source, target, "document", { batchSize: 2 })).resolves.toEqual({
      documentId: "document",
      sections: 3
    })
    expect(calls.findIndex((call) => call.text.includes("pg_advisory_xact_lock"))).toBeLessThan(
      calls.findIndex((call) => call.side === "source" && call.text.startsWith("begin"))
    )
    expect(calls.filter((call) => call.text.startsWith("select s.id")).map((call) => call.values)).toEqual([
      [["document"], null, 2],
      [["document"], "b", 2]
    ])
    expect(calls.filter((call) => call.text === "commit").map((call) => call.side)).toEqual(["source", "target"])
    expect(calls.some((call) => call.side === "source" && /^(delete|insert|update)/.test(call.text))).toBe(false)
  })

  it("removes stale search data for missing or unprocessed documents", async () => {
    const { source, target, calls } = fixture([[]])
    await expect(replicatePassageDocument(source, target, "document")).resolves.toEqual({
      documentId: "document",
      sections: 0
    })
    expect(calls.some((call) => call.text.startsWith("delete from"))).toBe(true)
    expect(calls.some((call) => call.text.startsWith("insert into"))).toBe(false)
    expect(calls.at(-1)).toMatchObject({ side: "target", text: "commit" })
  })

  it.each(["source", "target"])("rolls back both sides on a %s page failure", async (side) => {
    const { source, target, calls } = fixture([[section("a")]])
    const connection = side === "source" ? source : target
    const original = connection.query
    connection.query = async (text, values) => {
      if (text.startsWith(side === "source" ? "select s.id" : "insert into")) {
        throw new Error("connection lost")
      }
      return original(text, values)
    }
    await expect(replicatePassageDocument(source, target, "document")).rejects.toThrow("connection lost")
    expect(calls.filter((call) => call.text === "rollback").map((call) => call.side)).toEqual(["source", "target"])
    expect(calls.some((call) => call.text === "commit")).toBe(false)
  })

  it("does not replace old data with a partial document when the budget expires", async () => {
    const { source, target, calls } = fixture([[section("a")], [section("b")]])
    let clock = 0
    const original = target.query
    target.query = async (text, values) => {
      const response = await original(text, values)
      if (text.startsWith("insert into")) {
        clock = 1001
      }
      return response
    }
    await expect(
      replicatePassageDocument(source, target, "document", { batchSize: 1, budgetMs: 1000, now: () => clock })
    ).rejects.toThrow("time budget")
    expect(calls.filter((call) => call.text === "rollback")).toHaveLength(2)
    expect(calls.some((call) => call.text === "commit")).toBe(false)
  })

  it("rejects malformed and cross-document rows without committing", async () => {
    for (const row of [{ ...section("a"), document_id: "other" }, { id: "bad" }]) {
      const { source, target, calls } = fixture([[row]])
      await expect(replicatePassageDocument(source, target, "document")).rejects.toThrow(/another document|Invalid/)
      expect(calls.some((call) => call.text === "commit")).toBe(false)
    }
  })

  it("rolls back the target even if source rollback fails", async () => {
    const { source, target, calls } = fixture([[{ id: "bad" }]])
    const original = source.query
    source.query = async (text, values) => {
      if (text === "rollback") {
        throw new Error("source disconnected")
      }
      return original(text, values)
    }
    await expect(replicatePassageDocument(source, target, "document")).rejects.toThrow("source disconnected")
    expect(calls.at(-1)).toMatchObject({ side: "target", text: "rollback" })
  })

  it("does not report success for an ambiguous target commit", async () => {
    const { source, target, calls } = fixture([[]])
    const original = target.query
    target.query = async (text, values) => {
      if (text === "commit") {
        throw new Error("commit response lost")
      }
      return original(text, values)
    }
    await expect(replicatePassageDocument(source, target, "document")).rejects.toThrow("commit response lost")
    expect(calls.at(-1)).toMatchObject({ side: "target", text: "rollback" })
  })

  it.each([{ batchSize: 0 }, { batchSize: 1001 }, { budgetMs: 0 }, { budgetMs: 120001 }])(
    "rejects unsafe work bounds %j",
    async (options) => {
      const { source, target, calls } = fixture([])
      await expect(replicatePassageDocument(source, target, "document", options)).rejects.toThrow("Invalid")
      expect(calls).toHaveLength(0)
    }
  )
})
