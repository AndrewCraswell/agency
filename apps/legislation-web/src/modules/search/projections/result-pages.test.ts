import {
  prepareResultPage,
  readResultPage,
  researchResultByteLimit
} from "@repo/legislation-core/research/result-pages"
import { describe, expect, it } from "vitest"
import { z } from "zod"

const pageSchema = z.object({
  items: z.array(z.object({ id: z.string(), text: z.string() })),
  nextCursor: z.string().optional(),
  truncated: z.boolean().optional(),
  warnings: z.array(z.string()).optional()
})
const input = { query: "education", limit: 100, mode: "lexical" }
const items = Array.from({ length: 25 }, (_, index) => ({ id: `bill:${index}`, text: "\u00e9".repeat(20000) }))

describe("shared research results", () => {
  it("returns 100 discovery records without full summaries and preserves sources and snippets", () => {
    const records = Array.from({ length: 100 }, (_, index) => ({
      id: `bill:us:119:hr:${index}`,
      title: `Education ${index}`,
      summary: "Long source abstract ".repeat(15000),
      snippet: "Matching passage",
      sourceUrl: `https://example.com/bills/${index}`
    }))
    const result = prepareResultPage("search_bills", input, { items: records, nextCursor: "upstream" }, 0)
    expect(result).toEqual({
      items: records.map(({ summary: _summary, ...record }) => record),
      nextCursor: "upstream"
    })
    expect(Buffer.byteLength(JSON.stringify({ data: result }))).toBeLessThan(researchResultByteLimit)
    expect(records[0]?.summary.length).toBeGreaterThan(researchResultByteLimit)
  })

  it("pages complete records by UTF-8 bytes and restores the upstream cursor", () => {
    const source = { items, nextCursor: "database-next", truncated: true, warnings: ["Original warning"] }
    let request = { ...input, cursor: "database-current" }
    const collected: typeof items = []
    for (let count = 0; count < 25; count++) {
      const selection = readResultPage("search_bills", request)
      expect(selection.input.cursor).toBe("database-current")
      const result = prepareResultPage("search_bills", selection.input, source, selection.offset)
      const page = pageSchema.parse(result)
      expect(Buffer.byteLength(JSON.stringify({ data: result }))).toBeLessThanOrEqual(researchResultByteLimit)
      expect(page.warnings).toEqual(source.warnings)
      collected.push(...page.items)
      if (page.nextCursor === "database-next") {
        break
      }
      expect(page.nextCursor).toBeDefined()
      request = { ...input, cursor: page.nextCursor ?? "" }
    }
    expect(collected).toEqual(items)
  })

  it("binds stateless batch cursors to the tool, original IDs, and child limit", () => {
    const batch = { ids: items.map((item) => item.id), childLimit: 25 }
    const source = { items }
    const first = pageSchema.parse(prepareResultPage("get_bills", batch, source, 0))
    const continuation = { ...batch, cursor: first.nextCursor }
    const selection = readResultPage("get_bills", continuation)
    expect(selection.offset).toBe(first.items.length)
    expect(readResultPage("get_bills", continuation)).toEqual(selection)
    expect(() => readResultPage("search_bills", continuation)).toThrow(/Invalid result cursor/)
    expect(() => readResultPage("get_bills", { ...continuation, ids: ["other"] })).toThrow(/Invalid result cursor/)
    expect(() => readResultPage("get_bills", { ...continuation, childLimit: 1 })).toThrow(/Invalid result cursor/)
    expect(() => readResultPage("get_bills", { ...batch, cursor: "research-page:invalid" })).toThrow(
      /Invalid result cursor/
    )
    expect(() => prepareResultPage("get_bills", batch, { items: [] }, selection.offset)).toThrow(/changed/)
  })

  it("removes duplicate document bodies but preserves complete source sections and bill children", () => {
    const document = {
      id: "document:1",
      billId: "bill:us:119:hr:1",
      processingStatus: "processed",
      sourceUrl: "https://example.com/bill.pdf",
      text: "Full document".repeat(100000)
    }
    const metadata = {
      id: document.id,
      billId: document.billId,
      processingStatus: document.processingStatus,
      sourceUrl: document.sourceUrl
    }
    const detail = {
      bill: { id: document.billId, summary: "Huge summary".repeat(30000) },
      documents: [document],
      sponsors: [{ name: "Sponsor" }]
    }
    expect(prepareResultPage("get_bill", { id: document.billId }, detail, 0)).toEqual({
      bill: { id: document.billId },
      documents: [metadata],
      sponsors: detail.sponsors
    })
    const source = { document, sections: items, nextCursor: "sections-next" }
    const sectionsSchema = z.object({
      document: z.json(),
      sections: z.array(z.json()),
      nextCursor: z.string().optional()
    })
    const collected: unknown[] = []
    let request: Record<string, unknown> = { id: document.billId, documentId: document.id }
    for (let count = 0; count < 25; count++) {
      const selection = readResultPage("get_bill_text", request)
      const result = sectionsSchema.parse(prepareResultPage("get_bill_text", selection.input, source, selection.offset))
      expect(result.document).toEqual(metadata)
      collected.push(...result.sections)
      if (result.nextCursor === "sections-next") {
        break
      }
      request = { ...request, cursor: result.nextCursor }
    }
    expect(collected).toEqual(items)
  })

  it("preserves ordinary pages and rejects an individually oversized record instead of clipping it", () => {
    const source = { items: [{ id: "bill:1", text: "source" }] }
    expect(prepareResultPage("search_bill_text", input, source, 0)).toBe(source)
    expect(() =>
      prepareResultPage("search_bill_text", input, { items: [{ text: "x".repeat(researchResultByteLimit) }] }, 0)
    ).toThrow(/One result exceeds/)
  })
})
