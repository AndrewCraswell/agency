import { readFile } from "node:fs/promises"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { buildLegalTextProjection } from "@repo/legislation-core/legal-text/reader-text"
import { expect, it } from "vitest"
import { z } from "zod"
import { inspectLegalPassageShape } from "./passage-shapes.js"

function table(xml: string, text: string, tag = "TABLE") {
  return inspectLegalPassageShape({
    versionId: "version",
    body: text,
    inputContract: "regulatory-xml-2026-09-14",
    nodeKind: "section",
    blocks: [{ ordinal: 0, tag, kind: "table", text, xml }]
  })
}

it("classifies every retained ruling-table fixture without changing source text or declaring embedding readiness", async () => {
  const fixtures = z
    .array(z.object({ xml: z.string(), text: z.string() }))
    .parse(JSON.parse(await readFile(new URL("./fixtures/fr-2000-01-18-ruling-tables.json", import.meta.url), "utf8")))
  for (const fixture of fixtures) {
    expect(table(fixture.xml, fixture.text, "GPOTABLE")).toMatchObject({
      status: "classified",
      readerReconstructsExactly: true,
      bodyCharacters: fixture.text.length,
      blockedTableBlocks: 0,
      preparationEligibility: "not_evaluated",
      tableBlocks: [
        {
          status: "classified",
          tables: 1,
          nestedTables: 0,
          blockHash: digest(fixture.xml),
          layoutFailure: null
        }
      ]
    })
  }
})

it("records nested and spanning shapes separately from exact reader reconstruction", () => {
  expect(
    table("<TABLE><TR><TD>Parent<TABLE><TR><TD>Child</TD></TR></TABLE></TD></TR></TABLE>", "Parent\nChild")
  ).toMatchObject({
    status: "classified",
    readerReconstructsExactly: true,
    blockedTableBlocks: 1,
    tableBlocks: [{ tables: 2, nestedTables: 1, layoutFailure: "passage_table_complex_structure" }]
  })
  expect(table('<TABLE><TR><TD ROWSPAN="2">A</TD><TD>B</TD></TR><TR><TD>C</TD></TR></TABLE>', "A\tB\nC")).toMatchObject(
    {
      status: "classified",
      blockedTableBlocks: 1,
      tableBlocks: [{ rowSpanAttributes: 1, layoutFailure: "passage_table_spanning_rows" }]
    }
  )
})

it("does not label supported column groups as failed spanning rows", () => {
  expect(
    table('<TABLE><TR><TD COLSPAN="2">Heading</TD></TR><TR><TD>A</TD><TD>B</TD></TR></TABLE>', "Heading\nA\tB")
  ).toMatchObject({
    blockedTableBlocks: 0,
    tableBlocks: [
      { rowSpanAttributes: 0, columnSpanAttributes: 1, maximumRawFirstCellCharacters: 7, layoutFailure: null }
    ]
  })
})

it("accounts for header-only and blank-form tables as atomic layouts", () => {
  expect(
    table(
      "<TABLE><THEAD><TR><TH>Line item</TH><TH>Amount</TH></TR></THEAD><TBODY><TR><TD/><TD/></TR></TBODY></TABLE>",
      "Line item\tAmount"
    )
  ).toMatchObject({
    blockedTableBlocks: 0,
    tableBlocks: [{ layouts: 1, dataRows: 0, atomicLayouts: 1, layoutFailure: null }]
  })
})

it("inventories appendix wrappers and long cells without truncating identifying text", () => {
  const long = "Long identifier ".repeat(1500)
  const text = `Scope\n${long.trimEnd()}\tB\nEnd`
  expect(
    table(
      `<APPENDIX><P>Scope</P><GPOTABLE><ROW><ENT>${long}</ENT><ENT>B</ENT></ROW></GPOTABLE><P>End</P></APPENDIX>`,
      text,
      "APPENDIX"
    )
  ).toMatchObject({
    status: "classified",
    isAppendix: true,
    readerReconstructsExactly: true,
    tableBlocks: [{ maximumRawCellCharacters: long.length, maximumRawFirstCellCharacters: long.length }]
  })
})

it("records malformed XML and refuses declarations without returning source strings in failure reasons", () => {
  expect(table("<TABLE><ROW>", "text")).toMatchObject({
    blockedTableBlocks: 1,
    tableBlocks: [{ status: "invalid_source", reason: "passage_shape_xml_invalid" }]
  })
  expect(table('<!DOCTYPE TABLE [<!ENTITY secret "source">]><TABLE>&secret;</TABLE>', "source")).toMatchObject({
    blockedTableBlocks: 1,
    tableBlocks: [{ status: "invalid_source", reason: "passage_shape_xml_declaration" }]
  })
})

it("distinguishes invalid reader sources from empty structural nodes", () => {
  expect(
    inspectLegalPassageShape({
      versionId: "v",
      body: "different",
      blocks: [{ ordinal: 0, tag: "P", kind: "text", text: "original", xml: "<P>original</P>" }],
      inputContract: "xml",
      nodeKind: "section"
    })
  ).toMatchObject({ status: "invalid_source", reason: "legal_reader_source_text_mismatch" })
  expect(
    inspectLegalPassageShape({ versionId: "v", body: "", blocks: [], inputContract: "xml", nodeKind: "part" })
  ).toMatchObject({ status: "classified", isEmpty: true, readerBlocks: 0, tableBlocks: [] })
})

it("uses the shared HTML source adapter and stable version-bound reader hashes", () => {
  const body = "A publication\nExact text"
  const blocks = buildLegalTextProjection({ versionId: "source", body, blocks: [] }).blocks
  const input = {
    versionId: "canonical",
    body,
    blocks,
    inputContract: "fr-html-publication-2026-09-14",
    nodeKind: "notice"
  }
  const first = inspectLegalPassageShape(input)
  expect(first).toEqual(inspectLegalPassageShape(input))
  expect(first).toMatchObject({ status: "classified", readerReconstructsExactly: true, readerBlocks: 1 })
})
