import assert from "node:assert/strict"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { prepareResultPage, readResultPage, researchResultByteLimit } from "./result-pages"

type JSONValue = z.infer<ReturnType<typeof z.json>>

function object(value: JSONValue) {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value))
  return value
}

function collect(
  name: string,
  input: Readonly<Record<string, unknown>>,
  read: (input: Readonly<Record<string, unknown>>) => JSONValue,
  measure = (data: JSONValue) => Buffer.byteLength(JSON.stringify({ data }))
) {
  const pages: ReturnType<typeof object>[] = []
  let cursor: JSONValue | undefined
  do {
    const selection = readResultPage(name, { ...input, ...(cursor ? { cursor } : {}) })
    const page = object(
      prepareResultPage(
        name,
        selection.input,
        read(selection.input),
        selection.offset,
        selection.snapshot,
        measure,
        selection.fragment
      )
    )
    expect(Buffer.byteLength(JSON.stringify({ data: page }))).toBeLessThanOrEqual(researchResultByteLimit)
    expect(measure(page)).toBeLessThanOrEqual(researchResultByteLimit)
    pages.push(page)
    cursor = page.nextCursor
    assert.ok(pages.length < 200)
  } while (cursor)
  return pages
}

function reconstruct(pages: ReturnType<typeof object>[]) {
  const results: JSONValue[] = []
  let text = ""
  let snapshot: JSONValue | undefined
  for (const page of pages) {
    if (page.partialResult === undefined) {
      assert.equal(text, "")
      results.push(page)
      continue
    }
    const fragment = object(page.partialResult)
    expect(page).toMatchObject({ partial: true, truncated: true })
    expect(fragment).toMatchObject({ format: "json", offsetUnit: "utf16", textOffset: text.length })
    if (text.length > 0) expect(fragment.snapshot).toBe(snapshot)
    snapshot = fragment.snapshot
    assert.equal(typeof fragment.text, "string")
    assert.ok(typeof fragment.text === "string")
    expect(/[\uD800-\uDBFF]$/.test(fragment.text)).toBe(false)
    text += fragment.text
    if (fragment.nextTextOffset === null) {
      expect(text.length).toBe(fragment.totalCharacters)
      results.push(z.json().parse(JSON.parse(text)))
      text = ""
    } else {
      expect(fragment.nextTextOffset).toBe(text.length)
      expect(typeof page.nextCursor).toBe("string")
    }
  }
  expect(text).toBe("")
  return results
}

describe("oversized research evidence", () => {
  it("keeps section identity and source attribution on lossless Unicode text windows", () => {
    const text = 'Legal text 🙂漢字 "quoted"\n'.repeat(16000)
    const section = { id: "section:one", documentId: "doc:one", text, sourceUrl: "https://example.gov/source" }
    const data = { sections: [section], nextCursor: null, truncated: false }
    const measure = (page: JSONValue) =>
      Buffer.byteLength(JSON.stringify({ data: page, attributedCopy: page, envelope: "x".repeat(130000) }))
    const pages = collect("get_bill_text", { id: "bill:us:119:hr:1" }, () => data, measure)
    let offset = 0
    const totalCharacters = Array.from(text).length
    const texts = pages.map((page) => {
      expect(page).toMatchObject({ partial: true, truncated: true })
      assert.ok(Array.isArray(page.sections))
      assert.ok(page.sections[0])
      const part = object(page.sections[0])
      expect(part).toMatchObject({
        id: section.id,
        documentId: section.documentId,
        sourceUrl: section.sourceUrl,
        textOffset: offset,
        totalCharacters
      })
      assert.ok(typeof part.text === "string")
      offset += Array.from(part.text).length
      expect(part.nextTextOffset).toBe(offset === totalCharacters ? null : offset)
      return part.text
    })
    expect(texts.join("")).toBe(text)
    expect(pages.length).toBeGreaterThan(1)
  })

  it("preserves collection-reader offsets and upstream text availability when splitting a section window", () => {
    const text = "🙂漢字".repeat(3333)
    const record = {
      id: "section:one",
      sectionId: "section:one",
      recordId: "doc:one",
      text,
      textOffset: 10000,
      nextTextOffset: 19999,
      totalCharacters: 50000,
      sourceUrl: "https://example.gov/source"
    }
    const pages = collect(
      "read_record_collection",
      { collection: "document-sections", recordId: "doc:one", sectionId: "section:one", textOffset: 10000 },
      () => ({ items: [record], nextCursor: null }),
      (page) => Buffer.byteLength(JSON.stringify({ data: page })) + 170000
    )
    let offset = 10000
    const texts = pages.map((page) => {
      assert.ok(Array.isArray(page.items) && page.items[0])
      const part = object(page.items[0])
      expect(part.textOffset).toBe(offset)
      assert.ok(typeof part.text === "string")
      offset += Array.from(part.text).length
      expect(part.nextTextOffset).toBe(offset)
      expect(part.totalCharacters).toBe(50000)
      expect(part.textTruncated).toBe(true)
      return part.text
    })
    expect(texts.join("")).toBe(text)
    expect(offset).toBe(19999)
  })

  it.each(["get_person", "search_bills", "read_record_collection"])(
    "delivers oversized identity and provenance losslessly for %s",
    (name) => {
      const record = {
        id: "person:us:one",
        name: "Person",
        biography: '🙂漢字 "quoted" \\\n'.repeat(18000),
        provenance: { sourceUrl: `https://example.gov/${"a".repeat(190000)}`, identifiers: ["original"] }
      }
      const data: JSONValue = name === "get_person" ? { person: record } : { items: [record] }
      const pages = collect(name, { id: record.id }, () => data)
      const [restored] = reconstruct(pages)
      expect(restored).toMatchObject(data)
      expect(pages.length).toBeGreaterThan(1)
      expect(pages.every((page) => page.partialResult !== undefined)).toBe(true)
    }
  )

  it("fragments oversized section attribution rather than dropping it or the text", () => {
    const data = {
      sections: [
        {
          id: "section:one",
          text: "The exact source text.",
          attribution: { title: "Evidence ".repeat(30000), sourceUrl: "https://example.gov/source" }
        }
      ]
    }
    const pages = collect("get_bill_text", { id: "bill:us:119:hr:1" }, () => data)
    expect(reconstruct(pages)).toEqual([data])
  })

  it("fragments a raw-small single record when its enriched attribution cannot fit", () => {
    const data = { items: [{ id: "person:us:one", sourceUrl: "https://example.gov/person", name: "Person" }] }
    const measure = (page: JSONValue) =>
      Buffer.byteLength(JSON.stringify({ data: page })) + (object(page).partialResult === undefined ? 180000 : 1000)
    const pages = collect("search_people", { query: "Person" }, () => data, measure)
    expect(reconstruct(pages)).toEqual([data])
    expect(pages).toHaveLength(1)
  })

  it("advances from ordinary rows through a fragmented row to remaining rows and upstream pages", () => {
    const records: JSONValue[] = [
      { id: "one", text: "a".repeat(110000) },
      { id: "two", text: "b".repeat(210000), sourceUrl: "https://example.gov/two" },
      { id: "three", text: "last local" },
      { id: "four", text: "upstream" }
    ]
    const pages = collect("search_bills", { query: "housing" }, (input) =>
      input.cursor === "upstream"
        ? { items: records.slice(3), nextCursor: null }
        : { items: records.slice(0, 3), nextCursor: "upstream" }
    )
    const restored = reconstruct(pages).flatMap((page) => {
      const data = object(page)
      assert.ok(Array.isArray(data.items))
      return data.items
    })
    expect(restored).toEqual(records)
  })

  it("preserves oversized vote positions and their shared attribution before continuing to the next position", () => {
    const positions: JSONValue[] = [
      { sourceIdentity: "first", attribution: "a".repeat(210000) },
      { sourceIdentity: "second", position: "yes" }
    ]
    const vote = { id: "vote:us:one", sourceUrl: "https://example.gov/vote" }
    const pages = collect("get_vote", { id: vote.id }, () => ({ vote, positions }))
    const restored = reconstruct(pages).flatMap((page) => {
      const data = object(page)
      expect(data.vote).toEqual(vote)
      assert.ok(Array.isArray(data.positions))
      return data.positions
    })
    expect(restored).toEqual(positions)
  })

  it("bounds empty collections with oversized metadata and primitive results", () => {
    for (const value of [{ items: [], metadata: "a".repeat(210000) }, "🙂".repeat(100000)]) {
      const pages = collect("resolve_record", { id: "person:us:one" }, () => value)
      expect(reconstruct(pages)).toEqual([value])
    }
  })

  it("exposes scoped child and nested cursors for selection guards while preserving their original locations", () => {
    const data = {
      bill: { id: "bill:us:119:hr:1", title: "a".repeat(210000) },
      nextChildCursor: "children",
      nested: { nextCursor: "nested" }
    }
    const input = { id: "bill:us:119:hr:1" }
    const pages = collect("get_bill", input, () => data)
    const [value] = reconstruct(pages)
    assert.ok(value)
    const restored = object(value)
    const nested = object(restored.nested!)
    const continuations = pages.flatMap((page) => {
      assert.ok(Array.isArray(page.continuations))
      return page.continuations
    })
    expect(continuations).toContainEqual({ nextChildCursor: restored.nextChildCursor })
    expect(continuations).toContainEqual({ nextCursor: nested.nextCursor })
    expect(
      z
        .object({ childCursor: z.string() })
        .parse(readResultPage("get_bill", { ...input, childCursor: restored.nextChildCursor }).input).childCursor
    ).toBe("children")
    expect(readResultPage("get_bill", { ...input, cursor: nested.nextCursor }).input.cursor).toBe("nested")
  })

  it("rejects changed sources, filters, tools and missing snapshots on fragment continuation", () => {
    const input = { query: "housing" }
    const value = { items: [{ id: "one", text: "a".repeat(210000) }] }
    const first = object(prepareResultPage("search_bills", input, value, 0))
    assert.ok(typeof first.nextCursor === "string")
    const selection = readResultPage("search_bills", { ...input, cursor: first.nextCursor })
    const resume = (data: JSONValue, snapshot: string | undefined) =>
      prepareResultPage(
        "search_bills",
        selection.input,
        data,
        selection.offset,
        snapshot,
        undefined,
        selection.fragment
      )
    expect(() => resume({ items: [{ id: "changed", text: "a".repeat(210000) }] }, selection.snapshot)).toThrow(
      "content changed"
    )
    expect(() => resume(value, undefined)).toThrow("content changed")
    expect(() => readResultPage("search_bills", { query: "other", cursor: first.nextCursor })).toThrow("does not match")
    expect(() => readResultPage("search_bill_text", { ...input, cursor: first.nextCursor })).toThrow("does not match")
  })
})
