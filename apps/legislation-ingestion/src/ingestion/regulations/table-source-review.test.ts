import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import { provisionContent, regulatoryStorageContract } from "@repo/legislation-core/legal-text/storage-contract"
import { describe, expect, it } from "vitest"
import { buildTableSourceReview } from "./table-source-review.js"

const blocks = [
  {
    ordinal: 0,
    kind: "table",
    tag: "TABLE",
    text: "PlaceValueAlpha1Do.2",
    xml: '<TABLE><TR><TH>Place</TH><TH>Value</TH></TR><TR><TD class="name">Alpha</TD><TD>1</TD></TR><TR><TD>Do.</TD><TD>2</TD></TR></TABLE>'
  }
] as const
const body = blocks.map((block) => block.text).join("")
const versionId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const heading = "Example"
const nodeKind = "section"
const contentHash = provisionContent({
  contract: regulatoryParserContract,
  nodeKind,
  heading,
  text: body,
  blocks: storedLegalSourceBlocks({ body, blocks, inputContract: regulatoryStorageContract })
})
const diagnostic = {
  editionId,
  nativeKey: "2026-09-17",
  versionId,
  contentHash,
  nativeId: "cfr:1:section:1.1",
  sourceLocator: "/ECFR/DIV8[1]",
  ordinal: 1,
  lineNumber: 2,
  tableIndex: 0,
  status: "classified",
  reason: "passage_table_unresolved_ditto"
} as const
const canonical = {
  editionId,
  versionId,
  contentHash,
  inputContract: regulatoryStorageContract,
  heading,
  body,
  nodeKind,
  blocks,
  language: "en",
  nativeKey: diagnostic.nativeKey,
  nativeId: diagnostic.nativeId,
  sourceLocator: diagnostic.sourceLocator,
  ordinal: diagnostic.ordinal,
  sourceId: "ecfr",
  generationId: digest("generation"),
  artifactHash: digest("artifact"),
  sourceUrl: "https://www.ecfr.gov/api/versioner/v1/full/2026-09-17/title-1.xml",
  rightsProfileId: "official-federal-text",
  rightsHash: digest("rights")
} as const

describe("table source review", () => {
  it("binds exact canonical source evidence and exposes every retained cell", () => {
    const review = buildTableSourceReview(diagnostic, canonical)
    expect(review.table.blockHash).toBe(digest(blocks[0].xml))
    expect(review.table.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ["Place", "Value"],
      ["Alpha", "1"],
      ["Do.", "2"]
    ])
    expect(review.table.rows[1]?.cells[0]?.attributes).toEqual({ class: "name" })
    expect(review.reviewHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it("rejects diagnostics that do not belong to the canonical edition or table", () => {
    expect(() => buildTableSourceReview({ ...diagnostic, editionId: versionId }, canonical)).toThrow(
      "table_review_edition_mismatch"
    )
    expect(() => buildTableSourceReview({ ...diagnostic, tableIndex: 1 }, canonical)).toThrow(
      "table_review_table_index_missing"
    )
  })
})
