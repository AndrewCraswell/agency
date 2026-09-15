import { describe, expect, it } from "vitest"
import { embeddingTokenizer } from "../../models/embedding-tokenizer.js"
import { digest } from "./contracts.js"
import { buildLegalPassages } from "./passages.js"
import { buildLegalTextProjection } from "./reader-text.js"
import { legalTableLayout, legalTableRowCells, legalTableRows } from "./table-passages.js"

const tokenizer = { id: "fixture-codepoints", count: (text: string) => [...text].length }
function fixture(rows: number) {
  const text =
    "Items & values\nItemValue\n" +
    Array.from({ length: rows }, (_, index) => `Item ${index}\tValue ${index}`).join("\n")
  const xml = `<GPOTABLE><HD>Items &amp; values</HD><BOXHD><CHED>Item</CHED><CHED>Value</CHED></BOXHD>${Array.from({ length: rows }, (_, index) => `<ROW><ENT>Item ${index}</ENT><ENT>Value ${index}</ENT></ROW>`).join("")}</GPOTABLE>`
  const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "GPOTABLE", text, xml }]
  return {
    text,
    xml,
    sourceBlocks,
    projection: buildLegalTextProjection({ versionId: "table-version", body: text, blocks: sourceBlocks })
  }
}

describe("regulatory table passages", () => {
  it("repeats source headers, keeps every row intact, and maps exact source and context spans", () => {
    const input = fixture(12)
    const result = buildLegalPassages({ ...input, context: "US", tokenizer, targetTokens: 60, maximumTokens: 80 })
    expect(result.passages.length).toBeGreaterThan(1)
    expect(result.passages.map((passage) => passage.text).join("")).toBe(input.text)
    for (const passage of result.passages) {
      const header = passage.contextSpans.map((span) => input.text.slice(span.start, span.end)).join("")
      expect(passage.inputText).toBe("US\n\n" + header + passage.text)
      expect(passage.inputHash).toBe(digest(passage.inputText))
      expect(passage.inputText).toContain("Items & values\nItemValue\n")
      expect(passage.tokenCount).toBeLessThanOrEqual(80)
      expect(passage.readerSpans.map((span) => input.text.slice(span.start, span.end)).join("")).toBe(passage.text)
      expect(
        passage.text
          .split("\n")
          .filter((line) => line.startsWith("Item "))
          .every((line) => /^Item \d+\tValue \d+$/.test(line))
      ).toBe(true)
    }
    expect(result.passages[0]?.contextSpans).toEqual([])
    expect(result.passages[1]?.contextSpans.length).toBeGreaterThan(0)
  })

  it.each(["openai/text-embedding-3-small", "voyageai/voyage-4"] as const)(
    "fits real %s budgets across reader windows",
    async (model) => {
      const input = fixture(1500)
      expect(input.projection.blocks.length).toBeGreaterThan(1)
      const counter = await embeddingTokenizer(model)
      const result = buildLegalPassages({ ...input, context: "United States / CFR", tokenizer: counter })
      expect(result.passages.map((passage) => passage.text).join("")).toBe(input.text)
      for (const passage of result.passages) {
        expect(passage.tokenCount).toBe(counter.count(passage.inputText))
        expect(passage.tokenCount).toBeLessThanOrEqual(1200)
        expect(passage.inputText.length).toBeLessThanOrEqual(16000)
      }
    }
  )

  it("retains multiline cells, explicit HTML headers and trailing footnotes", () => {
    const xml =
      "<TABLE><THEAD><TR><TH>Name</TH><TH>Value</TH></TR></THEAD><TBODY><TR><TD><P>First</P><P>Second</P></TD><TD>1</TD></TR><TR><TD>Next</TD><TD>2</TD></TR></TBODY><P>Note.</P></TABLE>"
    const text = "Name\tValue\nFirst\nSecond\n1\nNext\t2\nNote."
    const result = legalTableRows({ xml, text })
    expect(text.slice(result.header.start, result.header.end)).toBe("Name\tValue\n")
    expect(result.rows.map((row) => text.slice(row.start, row.end))).toEqual(["First\nSecond\n1\n", "Next\t2\nNote."])
  })

  it("does not mistake a repeated header string for the first data row", () => {
    const result = legalTableRows({
      xml: "<TABLE><TR><TH>A</TH><TH>B</TH></TR><TR><TD>A</TD><TD>B</TD></TR></TABLE>",
      text: "A\tB\nA\tB"
    })
    expect(result.header.end).toBe(4)
    expect(result.rows).toEqual([{ start: 4, end: 7, context: [] }])
  })

  it("rejects unsplittable rows and mismatched source evidence", () => {
    const input = fixture(12)
    expect(() => buildLegalPassages({ ...input, context: "", tokenizer, targetTokens: 10, maximumTokens: 20 })).toThrow(
      "passage_table_continuation_context_exhausts_budget"
    )
    expect(() => legalTableRows({ ...input, text: input.text + "modified" })).toThrow(
      "passage_table_source_text_mismatch"
    )
    expect(() => legalTableRows({ ...input, xml: input.xml.replace("<ENT>", '<ENT ROWSPAN="2">') })).toThrow(
      "passage_table_spanning_rows"
    )
    expect(() => legalTableRows({ ...input, xml: input.xml.replace("</GPOTABLE>", "<TABLE/></GPOTABLE>") })).toThrow(
      "passage_table_complex_structure"
    )
    expect(legalTableRows({ text: "A", xml: "<TABLE><TR><TD>A</TD></TR></TABLE>" })).toEqual({
      header: { start: 0, end: 0 },
      rows: [{ start: 0, end: 1, context: [] }]
    })
    expect(() => legalTableRows({ text: "A", xml: "<!DOCTYPE TABLE><TABLE><TR><TD>A</TD></TR></TABLE>" })).toThrow(
      "passage_table_xml_declaration"
    )
  })

  it("separates surrounding prose and multiple tables without repeating unrelated context", () => {
    const first = fixture(10)
    const second = fixture(8)
    const text = "Introductory prose.\n" + first.text + "\nBetween tables.\n" + second.text + "\nFinal note."
    const xml = `<EXTRACT><P>Introductory prose.</P>${first.xml}<P>Between tables.</P>${second.xml}<P>Final note.</P></EXTRACT>`
    const sourceBlocks = [{ ordinal: 0, tag: "EXTRACT", kind: "table", text, xml }]
    const projection = buildLegalTextProjection({ versionId: "appendix", body: text, blocks: sourceBlocks })
    expect(legalTableLayout({ text, xml })).toHaveLength(2)
    const result = buildLegalPassages({
      projection,
      sourceBlocks,
      context: "",
      tokenizer,
      targetTokens: 60,
      maximumTokens: 80
    })
    expect(result.passages.map((p) => p.text).join("")).toBe(text)
    for (const passage of result.passages) {
      const header = passage.contextSpans.map((s) => text.slice(s.start, s.end)).join("")
      expect(header).not.toContain("prose")
      expect(header).not.toContain("Between")
    }
  })

  it("repeats complete multilevel headers while allowing neutral row-span attributes", () => {
    const xml =
      '<TABLE><THEAD><TR><TH rowspan="2">Item</TH><TH>Group</TH></TR><TR><TH>Value</TH></TR></THEAD><TBODY><TR><TD rowspan="1">A</TD><TD>1</TD></TR><TR><TD>B</TD><TD>2</TD></TR></TBODY></TABLE>'
    const text = "Item\tGroup\nValue\nA\t1\nB\t2"
    const result = legalTableRows({ xml, text })
    expect(text.slice(result.header.start, result.header.end)).toBe("Item\tGroup\nValue\n")
    expect(result.rows).toHaveLength(2)
  })

  it("enforces the transport character cap independently of token counts", () => {
    const input = fixture(1500)
    const result = buildLegalPassages({
      ...input,
      context: "US",
      tokenizer: { id: "fixture-low-token-count", count: () => 1 }
    })
    expect(result.passages.length).toBeGreaterThan(1)
    expect(result.passages.map((p) => p.text).join("")).toBe(input.text)
    expect(result.passages.every((p) => p.inputText.length <= 16000)).toBe(true)
    expect(() =>
      legalTableLayout({ text: "A", xml: "<TABLE><TR><TD><TABLE><TR><TD>A</TD></TR></TABLE></TD></TR></TABLE>" })
    ).toThrow("passage_table_complex_structure")
  })

  it.each([0, 1, 2])("preserves an oversized row with the long text in column %s", (longColumn) => {
    const values = ["Reference A", "Date B", "Condition C"]
    values[longColumn] = "A detailed condition with 🧭 and § symbols. ".repeat(25).trim()
    const row = values.join("\t")
    const text = "First\tSecond\tThird\n" + row + "\nNext\tDate\tValue"
    const xml = `<TABLE><THEAD><TR><TH>First</TH><TH>Second</TH><TH>Third</TH></TR></THEAD><TBODY><TR>${values.map((v) => `<TD>${v}</TD>`).join("")}</TR><TR><TD>Next</TD><TD>Date</TD><TD>Value</TD></TR></TBODY></TABLE>`
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", text, xml }]
    const projection = buildLegalTextProjection({ versionId: "large-row", body: text, blocks: sourceBlocks })
    const result = buildLegalPassages({
      projection,
      sourceBlocks,
      context: "US",
      tokenizer,
      targetTokens: 180,
      maximumTokens: 220
    })
    expect(result.passages.map((p) => p.text).join("")).toBe(text)
    const continuations = result.passages.filter((p) => p.rowContinuation !== null)
    expect(continuations.length).toBeGreaterThan(1)
    for (const passage of continuations) {
      expect(passage.rowContinuation).toEqual({
        start: "First\tSecond\tThird\n".length,
        end: text.indexOf("Next"),
        longColumn: longColumn + 1
      })
      expect(passage.inputText).toContain("First\tSecond\tThird\n")
      for (const { value, index } of values
        .map((value, index) => ({ value, index }))
        .filter((cell) => cell.index !== longColumn)) {
        expect(passage.inputText).toContain(`Column ${index + 1}: ${value}`)
      }
      expect(passage.inputHash).toBe(digest(passage.inputText))
      expect(passage.tokenCount).toBeLessThanOrEqual(180)
      expect(passage.text.isWellFormed()).toBe(true)
      expect(passage.readerSpans.map((span) => text.slice(span.start, span.end)).join("")).toBe(passage.text)
      expect(passage.contextSpans.every((span) => span.start >= 0 && span.end <= text.length)).toBe(true)
    }
  })

  it("retains a source group label and rejects unresolved ditto values in row continuations", () => {
    const xml =
      '<TABLE><TR><TH>Name</TH><TH>List</TH></TR><TR><TD colspan="2">Group A</TD></TR><TR><TD>Reference</TD><TD>Items</TD></TR></TABLE>'
    const text = "Name\tList\nGroup A\nReference\tItems"
    const evidence = legalTableRowCells({ xml, text }, text.indexOf("Reference"))
    expect(evidence.group).toEqual({ start: 10, end: 17 })
    expect(evidence.cells.map((cell) => text.slice(cell.start, cell.end))).toEqual(["Reference", "Items"])
    expect(() =>
      legalTableRowCells(
        { xml: xml.replace("Reference", "Do."), text: text.replace("Reference", "Do.") },
        text.indexOf("Reference")
      )
    ).toThrow("passage_table_continuation_ditto_reference")
  })

  it("carries source group and ditto references across passage boundaries without altering source text", () => {
    const rows = [
      "Group A",
      "Ingredient A\tSolvent",
      "Ingredient B\tDo.",
      "Ingredient C\tDo.",
      "Group B",
      "Ingredient D\tCarrier",
      "Ingredient E\tDo."
    ]
    const text = "Ingredient\tUse\n" + rows.join("\n")
    const xml =
      "<TABLE><THEAD><TR><TH>Ingredient</TH><TH>Use</TH></TR></THEAD><TBODY>" +
      rows
        .map((row) =>
          row.startsWith("Group")
            ? `<TR><TD colspan="2">${row}</TD></TR>`
            : `<TR>${row
                .split("\t")
                .map((cell) => `<TD>${cell}</TD>`)
                .join("")}</TR>`
        )
        .join("") +
      "</TBODY></TABLE>"
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", text, xml }]
    const projection = buildLegalTextProjection({ versionId: "dependencies", body: text, blocks: sourceBlocks })
    const result = buildLegalPassages({
      projection,
      sourceBlocks,
      context: "",
      tokenizer,
      targetTokens: 95,
      maximumTokens: 110
    })
    expect(result.passages.map((p) => p.text).join("")).toBe(text)
    const dependent = result.passages.filter((p) => p.text.includes("Do."))
    expect(dependent.length).toBeGreaterThan(1)
    for (const passage of dependent) {
      const references = passage.contextSpans.map((span) => text.slice(span.start, span.end))
      expect(references).toContain(passage.text.includes("Ingredient E") ? "Carrier" : "Solvent")
      expect(references).toContain(passage.text.includes("Ingredient E") ? "Group B" : "Group A")
      expect(passage.tokenCount).toBeLessThanOrEqual(110)
    }
    const unresolved = text.replace("Ingredient D\tCarrier", "Ingredient D\tDo.")
    const unresolvedXml = xml.replace("<TD>Carrier</TD>", "<TD>Do.</TD>")
    expect(() => legalTableRows({ text: unresolved, xml: unresolvedXml })).toThrow("passage_table_unresolved_ditto")
  })
})
