import { describe, expect, it } from "vitest"
import { z } from "zod"
import { digest } from "./contracts"
import {
  legalAgencyReferenceSchema,
  legalBrowseSelectionSchema,
  legalCapabilitySchema,
  legalSelectionSchema,
  validateLegalEditionContext
} from "./reader-contract"
import { buildLegalTextProjection, buildStoredLegalTextProjection, readLegalTextWindow } from "./reader-text"

const scope = {
  callerKey: "caller-a",
  editionId: "edition-a",
  sourceObservationId: "observation-a",
  rightsPolicyHash: digest("rights")
}
const block = (text: string, ordinal = 0, kind: "text" | "table" | "heading" | "footnote" = "text") => ({
  text,
  ordinal,
  kind,
  tag: "P",
  xml: `<P>${text}</P>`
})

describe("legal reader contract and source projection", () => {
  it("uses the same exact stored HTML text for serving and retrieval anchors", () => {
    const body = "First line\n\nSecond line"
    const input = {
      versionId: "stored-version",
      body,
      inputContract: "fr-html-publication-2026-09-14",
      blocks: buildLegalTextProjection({ versionId: "source-version", body, blocks: [] }).blocks
    }
    expect(buildStoredLegalTextProjection(input)).toEqual(
      buildLegalTextProjection({ versionId: "stored-version", body, blocks: [] })
    )
    expect(() => buildStoredLegalTextProjection({ ...input, body: "changed" })).toThrow(
      "legal_passage_html_reader_mismatch"
    )
  })
  it("distinguishes unavailable state publications from retained stale code data", () => {
    expect(
      legalCapabilitySchema.parse({ status: "unsupported", isStale: false, reason: "publication_feed_unavailable" })
        .status
    ).toBe("unsupported")
    expect(legalCapabilitySchema.parse({ status: "available", isStale: true, reason: "source_delayed" }).isStale).toBe(
      true
    )
    expect(() => legalCapabilitySchema.parse({ status: "not_ingested", isStale: true, reason: null })).toThrow(
      z.ZodError
    )
  })
  it("allows edition plus version but rejects ambiguous publisher-date selection", () => {
    expect(legalSelectionSchema.parse({ editionId: "e", versionId: "v" })).toEqual({ editionId: "e", versionId: "v" })
    expect(legalSelectionSchema.parse({ versionId: "v" })).toEqual({ versionId: "v" })
    expect(() => legalSelectionSchema.parse({ editionId: "e", asOf: "2026-01-01" })).toThrow(z.ZodError)
    expect(() => legalSelectionSchema.parse({ versionId: "v", asOf: "2026-01-01" })).toThrow(z.ZodError)
    expect(() => legalSelectionSchema.parse({ asOf: "2026-02-30" })).toThrow(z.ZodError)
  })

  it("defines roots and direct children independently from all-node enumeration", () => {
    expect(legalBrowseSelectionSchema.parse({})).toEqual({ traversal: "children" })
    expect(legalBrowseSelectionSchema.parse({ parentId: "parent" }).parentId).toBe("parent")
    expect(() => legalBrowseSelectionSchema.parse({ traversal: "all", parentId: "parent" })).toThrow(z.ZodError)
    expect(() => legalBrowseSelectionSchema.parse({ unknown: true })).toThrow(z.ZodError)
  })

  it("keeps unmatched publisher agencies out of canonical organization identities", () => {
    const value = {
      status: "unresolved",
      organizationId: null,
      sourceId: "fr",
      sourceAgencyId: "alias-123",
      nativeId: "123",
      name: "Publisher agency"
    }
    expect(legalAgencyReferenceSchema.parse(value)).toEqual(value)
    expect(() => legalAgencyReferenceSchema.parse({ ...value, organizationId: "invented-id" })).toThrow(z.ZodError)
  })

  it("validates membership without attaching dates to a shared text version", () => {
    const context = {
      editionId: "e1",
      provisionId: "p",
      versionId: "v",
      sourceObservationId: "o1",
      sourceId: "ecfr",
      rightsPolicyHash: digest("rights"),
      parentId: "old-parent",
      sourceLocator: "/old",
      sourceCurrencyDate: "2024-01-01",
      selectedDate: "2024-01-01",
      basis: "published_edition",
      legalStatus: "unknown"
    }
    expect(validateLegalEditionContext(context, { editionId: "e1", provisionId: "p", versionId: "v" }).parentId).toBe(
      "old-parent"
    )
    expect(
      validateLegalEditionContext(
        { ...context, editionId: "e2", sourceObservationId: "o2", parentId: "new-parent" },
        { editionId: "e2", provisionId: "p", versionId: "v" }
      ).parentId
    ).toBe("new-parent")
    expect(() => validateLegalEditionContext(context, { editionId: "e2", provisionId: "p", versionId: "v" })).toThrow(
      "membership_mismatch"
    )
  })

  it("preserves tables, footnotes and whitespace exactly without repeating source context", () => {
    const parts = ["Heading", "Column A\tColumn B\nOne\tTwo", "Footnote 1"] as const
    const body = parts.join("\n")
    const projection = buildLegalTextProjection({
      versionId: "v",
      body,
      blocks: [block(parts[0], 0, "heading"), block(parts[1], 1, "table"), block(parts[2], 2, "footnote")]
    })
    expect(projection.blocks.map((item) => item.text).join("")).toBe(body)
    expect(projection.blocks.filter((item) => item.sourceOrdinal !== null).map((item) => item.kind)).toEqual([
      "heading",
      "table",
      "footnote"
    ])
    expect(JSON.stringify(projection)).not.toContain("<P>")
    expect(projection.blocks.at(-1)?.end).toBe(body.length)
  })

  it("splits oversized source blocks without truncation or broken surrogate pairs", () => {
    const body = "x".repeat(16_383) + "😀" + "y".repeat(200_000)
    const projection = buildLegalTextProjection({ versionId: "v", body, blocks: [block(body)] })
    let cursor: string | undefined
    const output = []
    do {
      const window = readLegalTextWindow(projection, { scope, limit: 100, cursor })
      expect(window.blocks.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(100_000)
      expect(window.blocks.every((item) => item.text.length <= 16_384 && item.text.isWellFormed())).toBe(true)
      output.push(...window.blocks)
      cursor = window.nextCursor ?? undefined
    } while (cursor !== undefined)
    expect(output.map((item) => item.text).join("")).toBe(body)
    expect(new Set(output.map((item) => item.id)).size).toBe(output.length)
  })

  it("preserves publisher zero-width spacing in source gaps without admitting unmapped substantive text", () => {
    const body = "Heading\n\u200B\nSource note\n\u200B"
    const blocks = [block("Heading", 0, "heading"), block("Source note", 1)]
    const projection = buildLegalTextProjection({ versionId: "spacing", body, blocks })
    expect(projection.bodyHash).toBe(digest(body))
    expect(projection.blocks.map((item) => item.text).join("")).toBe(body)
    expect(projection.blocks.filter((item) => item.sourceOrdinal === null).map((item) => item.text)).toEqual([
      "\n\u200B\n",
      "\n\u200B"
    ])
    expect(projection.blocks.at(-1)?.end).toBe(body.length)
    for (const altered of [body.replace("\n\u200B\n", "\n\u200Bunmapped\n"), `${body}unmapped`, `${body}\u202E`]) {
      expect(() => buildLegalTextProjection({ versionId: "spacing", body: altered, blocks })).toThrow(
        "legal_reader_unmapped_source_text"
      )
    }
  })

  it("opens a stable late anchor without reading earlier windows", () => {
    const body = "paragraph ".repeat(5000)
    const projection = buildLegalTextProjection({ versionId: "v", body, blocks: [block(body)] })
    const target = projection.blocks[2]
    expect(target).toBeDefined()
    const window = readLegalTextWindow(projection, { scope, anchor: target?.id, limit: 1 })
    expect(window.startBlock).toBe(2)
    expect(window.blocks[0]).toEqual(target)
    expect(() => readLegalTextWindow(projection, { scope, anchor: "missing" })).toThrow("anchor_not_found")
  })

  it.each(["caller", "edition", "observation", "rights", "version", "content", "limit"])(
    "rejects continuation after a %s scope change",
    (change) => {
      const body = "x".repeat(40_000)
      const projection = buildLegalTextProjection({ versionId: "v", body, blocks: [block(body)] })
      const cursor = readLegalTextWindow(projection, { scope, limit: 1 }).nextCursor
      expect(cursor).not.toBeNull()
      const changedScope = { ...scope }
      if (change === "caller") {
        changedScope.callerKey = "other"
      }
      if (change === "edition") {
        changedScope.editionId = "other"
      }
      if (change === "observation") {
        changedScope.sourceObservationId = "other"
      }
      if (change === "rights") {
        changedScope.rightsPolicyHash = digest("new-rights")
      }
      const selected =
        change === "version" || change === "content"
          ? buildLegalTextProjection({
              versionId: change === "version" ? "other" : "v",
              body: body + "y",
              blocks: [block(body + "y")]
            })
          : projection
      expect(() =>
        readLegalTextWindow(selected, {
          scope: changedScope,
          cursor: cursor ?? undefined,
          limit: change === "limit" ? 2 : 1
        })
      ).toThrow("scope_mismatch")
    }
  )

  it("fails closed on damaged source mapping and malformed continuation", () => {
    expect(() => buildLegalTextProjection({ versionId: "v", body: "actual", blocks: [block("invented")] })).toThrow(
      "text_mismatch"
    )
    expect(() =>
      buildLegalTextProjection({ versionId: "v", body: "other same same", blocks: [block("same")] })
    ).toThrow("unmapped_source_text")
    const projection = buildLegalTextProjection({ versionId: "v", body: "actual", blocks: [block("actual")] })
    expect(() => readLegalTextWindow(projection, { scope, cursor: "not-json" })).toThrow(SyntaxError)
    expect(() => readLegalTextWindow(projection, { scope, cursor: "x", anchor: "y" })).toThrow("cursor_anchor_conflict")
  })

  it("reports an empty structural node without inventing body text", () => {
    const projection = buildLegalTextProjection({ versionId: "v", body: "", blocks: [] })
    expect(readLegalTextWindow(projection, { scope })).toMatchObject({
      blocks: [],
      availability: "empty",
      isStart: true,
      isEnd: true,
      nextCursor: null
    })
  })
})
