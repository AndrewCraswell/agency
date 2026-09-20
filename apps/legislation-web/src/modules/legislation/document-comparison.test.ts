import { createHash } from "node:crypto"
import * as schema from "@repo/legislation-core/database/schema/schema"
import type { DiffHunk } from "@repo/legislation-diffing/comparison"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import invariant from "tiny-invariant"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { createDocumentComparisonPage, parseDocumentComparisonRequest } from "./document-comparison"
import fixture from "./fixtures/hr2513-comparison.json"
import * as documentReads from "./persistence/queries/document-diff-read"
import type { CanonicalDocumentRead } from "./persistence/queries/document-reads"
import { LegislationQueryService } from "./query-service"

const pool = new pg.Pool({ connectionString: "postgresql://comparison-test.invalid/legislation" })
const database = drizzle(pool, { schema })
afterAll(() => pool.end())
afterEach(() => vi.restoreAllMocks())

function document(id: string, contentHash = "a".repeat(64)): CanonicalDocumentRead {
  return {
    billId: fixture.billId,
    byteSize: null,
    classification: "version",
    contentHash,
    createdAt: new Date("2026-09-19T00:00:00Z"),
    documentDate: "2019-05-03",
    failureCategory: null,
    id,
    mimeType: "application/xml",
    ocrCompletedAt: null,
    ocrProvider: null,
    ocrStatus: "not-required",
    pageCount: null,
    processingStatus: "processed",
    sourceUrl: "https://www.govinfo.gov/",
    storedUrl: null,
    title: "H.R. 2513",
    updatedAt: new Date("2026-09-19T00:00:00Z"),
    versionCode: "ih"
  }
}

function read(left = "Old text.\n\nRetained.\n\nOld ending.", right = "New text.\n\nRetained.\n\nNew ending.") {
  return {
    left: { document: document("left"), text: left },
    right: { document: document("right"), text: right }
  }
}

const selection = { billId: fixture.billId, leftDocumentId: "left", rightDocumentId: "right", limit: 1 }

describe("full-document comparison", () => {
  it("preserves both pinned HR2513 texts, including preambles and both referenced Chapter 53 provisions", () => {
    const [left, right] = fixture.documents
    invariant(left && right)
    const source = {
      left: {
        document: {
          ...document(left.id, left.contentHash),
          documentDate: left.documentDate,
          sourceUrl: left.sourceUrl,
          versionCode: left.versionCode
        },
        text: left.text
      },
      right: {
        document: {
          ...document(right.id, right.contentHash),
          documentDate: right.documentDate,
          sourceUrl: right.sourceUrl,
          versionCode: right.versionCode
        },
        text: right.text
      }
    }
    const input = {
      billId: fixture.billId,
      leftDocumentId: left.id,
      rightDocumentId: right.id,
      includeUnchanged: true,
      limit: 5
    }
    const hunks: DiffHunk[] = []
    let cursor: string | null = null
    let comparisonId: string | undefined
    do {
      const page = createDocumentComparisonPage(source, parseDocumentComparisonRequest({ ...input, cursor }))
      comparisonId ??= page.id
      expect(page.id).toBe(comparisonId)
      expect(page.leftTextHash).toBe(left.textHash)
      expect(page.rightTextHash).toBe(right.textHash)
      expect(Buffer.byteLength(JSON.stringify(page), "utf8")).toBeLessThanOrEqual(100_000)
      hunks.push(...page.hunks)
      cursor = page.nextCursor
    } while (cursor)
    expect(hunks.map((hunk) => hunk.leftText ?? "").join("")).toBe(left.text)
    expect(hunks.map((hunk) => hunk.rightText ?? "").join("")).toBe(right.text)
    expect(hunks.map((hunk) => hunk.ordinal)).toEqual(hunks.map((_, index) => index))
    expect(right.sections.filter((section) => section.identifier === "53")).toHaveLength(2)
    expect(right.sections.find((section) => section.id.endsWith("3aff3297c02eaacdc55424ce"))).toMatchObject({
      startOffset: 4829,
      endOffset: 35834,
      contentHash: "2a400b143adc86f5c7975a5565d1817e80c28546db06acba4c75b70b13745ae1"
    })
    const ownership = "Chapter 53 of title 31, United States Code, is amended by inserting after section 5332"
    expect(hunks.some((hunk) => hunk.classification === "unchanged" && hunk.leftText?.includes(ownership))).toBe(true)
    expect(
      hunks.some(
        (hunk) =>
          hunk.classification === "changed" &&
          hunk.leftText?.includes(ownership) &&
          hunk.rightText?.includes("Whistleblower incentives")
      )
    ).toBe(false)
    for (const hunk of hunks) {
      for (const operation of hunk.operations) {
        expect(
          operation.leftStart !== null && operation.leftEnd !== null
            ? left.text.slice(operation.leftStart, operation.leftEnd)
            : null
        ).toBe(operation.classification === "insert" ? null : operation.text)
        expect(
          operation.rightStart !== null && operation.rightEnd !== null
            ? right.text.slice(operation.rightStart, operation.rightEnd)
            : null
        ).toBe(operation.classification === "delete" ? null : operation.text)
      }
    }
  })

  it("binds pagination to the actual text as well as document IDs, options and limits", () => {
    const first = createDocumentComparisonPage(read(), parseDocumentComparisonRequest(selection))
    expect(first.nextCursor).toEqual(expect.any(String))
    const firstHunk = first.hunks[0]
    invariant(firstHunk)
    const next = { ...selection, cursor: first.nextCursor }
    const second = createDocumentComparisonPage(read(), parseDocumentComparisonRequest(next))
    expect(second.hunks).toHaveLength(1)
    expect(second.hunks[0]?.ordinal).toBeGreaterThan(firstHunk.ordinal)
    expect(second.nextCursor).toBeNull()
    expect(() => parseDocumentComparisonRequest({ ...next, limit: 2 })).toThrow("cursor")
    expect(() => parseDocumentComparisonRequest({ ...next, includeUnchanged: true })).toThrow("cursor")
    expect(() =>
      createDocumentComparisonPage(read(undefined, "Different text"), parseDocumentComparisonRequest(next))
    ).toThrow("compared text changed")
  })

  it("rejects absent full text instead of reconstructing it from incomplete section records", () => {
    expect(() => createDocumentComparisonPage(read(""), parseDocumentComparisonRequest(selection))).toThrow(
      "processed full text"
    )
    const pending = read()
    pending.right.document.processingStatus = "pending"
    expect(() => createDocumentComparisonPage(pending, parseDocumentComparisonRequest(selection))).toThrow(
      "processed full text"
    )
    expect(() => parseDocumentComparisonRequest({ ...selection, rightDocumentId: "left" })).toThrow("distinct")
    expect(() => parseDocumentComparisonRequest({ ...selection, granularity: "section" })).toThrow(
      expect.objectContaining({ category: "invalid_request" })
    )
  })

  it("rejects an oversized response hunk explicitly rather than truncating its text", () => {
    expect(() =>
      createDocumentComparisonPage(
        read("a".repeat(60_000), "b".repeat(60_000)),
        parseDocumentComparisonRequest(selection)
      )
    ).toThrow(expect.objectContaining({ category: "payload_too_large" }))
  })

  it("uses the same full-text comparison in the research query service", async () => {
    const source = read()
    const reader = vi.spyOn(documentReads, "readDocumentDiff").mockResolvedValue(source)
    const expected = createDocumentComparisonPage(source, parseDocumentComparisonRequest(selection))
    const actual = await new LegislationQueryService(database).compareBillVersions({
      billId: fixture.billId,
      documentIds: ["left", "right"],
      limit: 1
    })
    expect(actual).toEqual(expected)
    expect(reader).toHaveBeenCalledExactlyOnceWith(database, expect.objectContaining(selection))
    expect(actual.leftTextHash).toBe(createHash("sha256").update(source.left.text).digest("hex"))
  })
})
