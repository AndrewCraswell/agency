import { readFile } from "node:fs/promises"
import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import { z } from "zod"
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
  // Loading both pinned tokenizer implementations needs headroom under coverage.
  it(
    "resolves retained dotted leaders to the exact earlier column value with both tokenizers",
    { timeout: 30_000 },
    async () => {
      const { block } = z
        .object({ block: z.object({ text: z.string(), xml: z.string() }) })
        .parse(JSON.parse(await readFile(new URL("./fixtures/ecfr-dotted-ditto.json", import.meta.url), "utf8")))
      const layout = legalTableRows(block)
      const repeated = layout.rows[1]
      invariant(repeated, "repeated_row_required")
      expect(repeated.context.map((span) => block.text.slice(span.start, span.end))).toEqual([
        "Arizona",
        "*Papago",
        "10 years."
      ])
      const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", ...block }]
      const projection = buildLegalTextProjection({
        versionId: digest(block.xml),
        body: block.text,
        blocks: sourceBlocks
      })
      for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
        const counter = await embeddingTokenizer(model)
        const maximumTokens = counter.count("US\n\n" + block.text) - 1
        const prepared = buildLegalPassages({
          projection,
          sourceBlocks,
          context: "US",
          tokenizer: counter,
          targetTokens: maximumTokens,
          maximumTokens
        })
        expect(prepared.passages.length).toBeGreaterThan(1)
        expect(prepared.passages.map((p) => p.text).join("")).toBe(block.text)
        const passage = prepared.passages.find((p) => p.text.includes("5580"))
        invariant(passage, "ditto_passage_required")
        expect(passage.inputText).toContain("Agua Caliente")
        expect(passage.inputText).toContain("......do")
        expect(passage.contextSpans.some((span) => block.text.slice(span.start, span.end) === "Agua Caliente")).toBe(
          true
        )
        expect(
          prepared.passages.every((p) => p.tokenCount === counter.count(p.inputText) && p.tokenCount <= maximumTokens)
        ).toBe(true)
        expect(
          buildLegalPassages({
            projection,
            sourceBlocks,
            context: "US",
            tokenizer: counter,
            targetTokens: maximumTokens,
            maximumTokens
          })
        ).toEqual(prepared)
      }
    }
  )

  it.each(["......do", "............do", "......DO."])(
    "keeps %s chains source-backed in row continuations and rejects missing references",
    (marker) => {
      for (const [table, row, cell] of [
        ["TABLE", "TR", "TD"],
        ["GPOTABLE", "ROW", "ENT"]
      ]) {
        const input = {
          text: `A\tValue\nB\t${marker}\nC\tDo.`,
          xml: `<${table}><${row}><${cell}>A</${cell}><${cell}>Value</${cell}></${row}><${row}><${cell}>B</${cell}><${cell}>${marker}</${cell}></${row}><${row}><${cell}>C</${cell}><${cell}>Do.</${cell}></${row}></${table}>`
        }
        const layout = legalTableRows(input)
        for (const repeated of layout.rows.slice(1)) {
          expect(repeated.context.map((span) => input.text.slice(span.start, span.end))).toEqual(["Value"])
        }
        expect(legalTableRowCells(input, 8).cells.map((span) => input.text.slice(span.start, span.end))).toEqual([
          "B",
          marker
        ])
        expect(() =>
          legalTableRows({
            text: `A\t${marker}`,
            xml: `<${table}><${row}><${cell}>A</${cell}><${cell}>${marker}</${cell}></${row}></${table}>`
          })
        ).toThrow("passage_table_unresolved_ditto")
        expect(() =>
          legalTableRows({
            text: `A\tValue\nBlank\nB\t${marker}`,
            xml: `<${table}><${row}><${cell}>A</${cell}><${cell}>Value</${cell}></${row}><${row}><${cell}>Blank</${cell}><${cell}/></${row}><${row}><${cell}>B</${cell}><${cell}>${marker}</${cell}></${row}></${table}>`
          })
        ).toThrow("passage_table_unresolved_ditto")
      }
    }
  )

  it.each(["Do something", "......domain", ".do", "......", "undo"])("leaves literal text %s unchanged", (value) => {
    const input = { text: `A\t${value}`, xml: `<TABLE><TR><TD>A</TD><TD>${value}</TD></TR></TABLE>` }
    expect(legalTableRows(input).rows[0]?.context).toEqual([])
    expect(legalTableRowCells(input, 0).cells).toHaveLength(2)
  })

  it("retains the real unit reference across an explicit full-width group heading", async () => {
    const fixture = z
      .object({ block: z.object({ text: z.string(), xml: z.string() }) })
      .parse(
        JSON.parse(await readFile(new URL("./fixtures/ecfr-full-width-ditto-group.json", import.meta.url), "utf8"))
      )
    const table = legalTableLayout(fixture.block)[0]
    invariant(table, "table_fixture_required")
    const layout = legalTableRows(table)
    const calcium = layout.rows.find((row) => table.text.slice(row.start, row.end).startsWith("Calcium\n"))
    invariant(calcium, "calcium_fixture_required")
    expect(calcium.context.map((span) => table.text.slice(span.start, span.end))).toEqual(["Minerals", "Milligrams"])
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", ...fixture.block }]
    const projection = buildLegalTextProjection({
      versionId: digest(table.xml),
      body: fixture.block.text,
      blocks: sourceBlocks
    })
    for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
      const counter = await embeddingTokenizer(model)
      const prepared = buildLegalPassages({
        sourceBlocks,
        projection,
        context: "Federal code",
        tokenizer: counter,
        targetTokens: 120,
        maximumTokens: 180
      })
      expect(prepared.passages.map((passage) => passage.text).join("")).toBe(fixture.block.text)
      const passage = prepared.passages.find((passage) => passage.text.includes("Calcium\n"))
      invariant(passage, "calcium_passage_required")
      expect(passage.inputText).toContain("Milligrams")
      expect(passage.inputText).toContain("Minerals")
      expect(
        prepared.passages.every(
          (passage) => passage.tokenCount === counter.count(passage.inputText) && passage.tokenCount <= 180
        )
      ).toBe(true)
    }
  })
  it("does not resolve ditto through partial groups, blank data cells or a different table", () => {
    const cases = [
      {
        text: "A\tB\tC\nGroup\nX\tY\tDo.",
        xml: '<TABLE><TR><TD>A</TD><TD>B</TD><TD>C</TD></TR><TR><TD colspan="2">Group</TD></TR><TR><TD>X</TD><TD>Y</TD><TD>Do.</TD></TR></TABLE>'
      },
      {
        text: "A\tB\nX\nY\tDo.",
        xml: "<TABLE><TR><TD>A</TD><TD>B</TD></TR><TR><TD>X</TD><TD/></TR><TR><TD>Y</TD><TD>Do.</TD></TR></TABLE>"
      },
      { text: "X\tDo.", xml: "<TABLE><TR><TD>X</TD><TD>Do.</TD></TR></TABLE>" }
    ]
    for (const input of cases) {
      expect(() => legalTableRows(input)).toThrow("passage_table_unresolved_ditto")
    }
  })
  it("preserves publisher-indented category labels and their ditto evidence in the complete Seaway table", async () => {
    const retained = z
      .object({
        fixtures: z.array(
          z.object({
            nativeId: z.string(),
            blockXmlHash: z.string(),
            block: z.object({ text: z.string(), xml: z.string() })
          })
        )
      })
      .parse(JSON.parse(await readFile(new URL("./fixtures/ditto-final-tables.json", import.meta.url), "utf8")))
    const entry = retained.fixtures.find((item) => item.nativeId.includes("Schedule III"))
    invariant(entry, "seaway_fixture_required")
    expect(digest(entry.block.xml)).toBe(entry.blockXmlHash)
    const table = legalTableLayout(entry.block)[0]
    invariant(table, "seaway_table_required")
    const rows = legalTableRows(table)
    const departure = rows.rows.find((row) =>
      table.text.slice(row.start, row.end).startsWith("(i) Before getting under way")
    )
    invariant(departure, "seaway_departure_required")
    const context = departure.context.map((span) => table.text.slice(span.start, span.end))
    expect(context).toContain("upbound vessels")
    expect(context).toContain("(b) Vessels in Montreal Harbor, dock, berth or anchorage:")
    expect(context).toContain("Seaway Beauharnois, channel 14")
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", ...entry.block }]
    const projection = buildLegalTextProjection({
      versionId: digest(table.xml),
      body: entry.block.text,
      blocks: sourceBlocks
    })
    for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
      const counter = await embeddingTokenizer(model)
      const prepared = buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer: counter })
      expect(prepared.passages.map((passage) => passage.text).join("")).toBe(entry.block.text)
      expect(
        prepared.passages.every(
          (passage) => passage.tokenCount === counter.count(passage.inputText) && passage.tokenCount <= 1200
        )
      ).toBe(true)
      expect(buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer: counter })).toEqual(
        prepared
      )
    }
    const radio = retained.fixtures.find((item) => item.nativeId === "cfr:47:section:90.35")
    invariant(radio, "radio_fixture_required")
    const radioTable = legalTableLayout(radio.block)[0]
    invariant(radioTable, "radio_table_required")
    expect(() => legalTableRows(radioTable)).toThrow("passage_table_unresolved_ditto")
  }, 30_000)

  it.each(["", "primary-indent-hanging-1"])("does not infer a category without a more-indented child: %s", (indent) => {
    const input = {
      text: "A\tB\nCategory:\nChild\tDo.",
      xml: `<TABLE><TR><TD>A</TD><TD>B</TD></TR><TR><TD class="primary-indent-hanging-1">Category:</TD><TD/></TR><TR><TD class="${indent}">Child</TD><TD>Do.</TD></TR></TABLE>`
    }
    expect(() => legalTableRows(input)).toThrow("passage_table_unresolved_ditto")
  })

  it("retains hazard categories and explicit alphabetic conditions across later ditto references", async () => {
    const fixture = z
      .object({ blockXmlHash: z.string(), block: z.object({ text: z.string(), xml: z.string() }) })
      .parse(JSON.parse(await readFile(new URL("./fixtures/centered-category-table.json", import.meta.url), "utf8")))
    expect(digest(fixture.block.xml)).toBe(fixture.blockXmlHash)
    const complete = legalTableLayout(fixture.block)[0]
    invariant(complete, "centered_category_table_required")
    const table = { text: complete.text, xml: complete.xml }
    const condition = legalTableRows(table).rows.find((item) =>
      table.text.slice(item.start, item.end).startsWith("(c) in rapidly")
    )
    invariant(condition, "condition_row_required")
    expect(condition.context.map((span) => table.text.slice(span.start, span.end)).join("\n")).toContain("(2) Diving.")
    const seaDuty = legalTableRows(table).rows.find((item) =>
      table.text.slice(item.start, item.end).startsWith("Participating in sea duty")
    )
    invariant(seaDuty, "sea_duty_row_required")
    expect(seaDuty.context.some((span) => span.label === "Column 3 ditto source")).toBe(true)
    const row = legalTableRows(table).rows.find((item) =>
      table.text.slice(item.start, item.end).startsWith("(1) Pressurechamber subject.")
    )
    invariant(row, "centered_category_row_required")
    expect(row.context.map((span) => table.text.slice(span.start, span.end))).toContain(
      "Exposure to Physiological Hazards:"
    )
    expect(row.context.map((span) => table.text.slice(span.start, span.end))).toContain(
      "First pay period beginning after March 16, 1973."
    )
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", ...table }]
    const projection = buildLegalTextProjection({
      versionId: digest(table.xml),
      body: table.text,
      blocks: sourceBlocks
    })
    for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
      const counter = await embeddingTokenizer(model)
      const prepared = buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer: counter })
      expect(prepared.passages.map((passage) => passage.text).join("")).toBe(table.text)
      expect(
        prepared.passages.every(
          (passage) => passage.tokenCount === counter.count(passage.inputText) && passage.tokenCount <= 1200
        )
      ).toBe(true)
      expect(buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer: counter })).toEqual(
        prepared
      )
    }
  }, 30_000)

  it.each([
    ["Conditions", "(b) final condition."],
    ["Conditions when:", "(c) final condition."],
    ["Conditions when:", "(b) unfinished condition; or,"]
  ])("does not carry through incomplete or unanchored conditions: %s %s", (anchor, last) => {
    const input = {
      text: `Duty\tDate\n${anchor}\tJanuary 1\n(a) first condition; or,\n${last}\nNext\tDo.`,
      xml: `<TABLE><TR><TH>Duty</TH><TH>Date</TH></TR><TR><TD>${anchor}</TD><TD>January 1</TD></TR><TR><TD>(a) first condition; or,</TD><TD/></TR><TR><TD>${last}</TD><TD/></TR><TR><TD>Next</TD><TD>Do.</TD></TR></TABLE>`
    }
    expect(() => legalTableRows(input)).toThrow("passage_table_unresolved_ditto")
  })

  it("retains explicit partial-county scope and source date with both tokenizers", async () => {
    const retained = z
      .object({
        fixtures: z.array(
          z.object({
            nativeId: z.string(),
            blockXmlHash: z.string(),
            block: z.object({ text: z.string(), xml: z.string() })
          })
        )
      })
      .parse(JSON.parse(await readFile(new URL("./fixtures/ditto-continuation-tables.json", import.meta.url), "utf8")))
    const fixture = retained.fixtures.find((item) => item.nativeId === "cfr:40:section:81.324")
    invariant(fixture, "county_fixture_required")
    expect(digest(fixture.block.xml)).toBe(fixture.blockXmlHash)
    const table = legalTableLayout(fixture.block)[0]
    invariant(table, "county_table_required")
    const rows = legalTableRows(table).rows
    const carver = rows.find((row) => table.text.slice(row.start, row.end).startsWith("Carver, Chanhassen"))
    invariant(carver, "county_area_row_required")
    expect(carver.context.map((span) => table.text.slice(span.start, span.end))).toEqual(
      expect.arrayContaining(["Carver County (part)", "Nov. 29, 1999"])
    )
    const dakota = rows.find((row) => table.text.slice(row.start, row.end).startsWith("Apple Valley,"))
    invariant(dakota, "next_county_area_required")
    expect(dakota.context.map((span) => table.text.slice(span.start, span.end))).not.toContain("Carver County (part)")
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", text: table.text, xml: table.xml }]
    const projection = buildLegalTextProjection({
      versionId: digest(table.xml),
      body: table.text,
      blocks: sourceBlocks
    })
    for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
      const tokenizer = await embeddingTokenizer(model)
      const prepared = buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer })
      expect(prepared.passages.map((passage) => passage.text).join("")).toBe(table.text)
      expect(
        prepared.passages.every(
          (passage) => passage.tokenCount === tokenizer.count(passage.inputText) && passage.tokenCount <= 1200
        )
      ).toBe(true)
    }
  }, 30_000)

  it.each([
    ["Ordinary table", "Carver County (part)"],
    ["Designated area", "Carver County"]
  ])("does not treat an ordinary county blank as a scope label: %s", (heading, county) => {
    const input = {
      text: `${heading}\tDate\tType\nAnoka County\tNov. 29\tAttainment\n${county}\nMunicipality\tDo.\tAttainment`,
      xml: `<TABLE><THEAD><TR><TH>${heading}</TH><TH>Date</TH><TH>Type</TH></TR></THEAD><TR><TD>Anoka County</TD><TD>Nov. 29</TD><TD>Attainment</TD></TR><TR><TD>${county}</TD><TD/><TD/></TR><TR><TD>Municipality</TD><TD>Do.</TD><TD>Attainment</TD></TR></TABLE>`
    }
    expect(() => legalTableRows(input)).toThrow("passage_table_unresolved_ditto")
  })

  it("retains STCC exception parent and tariff source across the full commodity table", async () => {
    const retained = z
      .object({
        fixtures: z.array(
          z.object({
            nativeId: z.string(),
            blockXmlHash: z.string(),
            block: z.object({ text: z.string(), xml: z.string() })
          })
        )
      })
      .parse(JSON.parse(await readFile(new URL("./fixtures/ditto-continuation-tables.json", import.meta.url), "utf8")))
    const fixture = retained.fixtures.find((item) => item.nativeId === "cfr:49:section:1039.11")
    invariant(fixture, "stcc_fixture_required")
    expect(digest(fixture.block.xml)).toBe(fixture.blockXmlHash)
    const table = legalTableLayout(fixture.block)[0]
    invariant(table, "stcc_table_required")
    const rows = legalTableRows(table).rows
    const exception = rows.find((row) => table.text.slice(row.start, row.end).startsWith("20 143 Grease"))
    invariant(exception, "stcc_exception_required")
    expect(exception.context.map((span) => table.text.slice(span.start, span.end)).join("\n")).toContain(
      "Food or kindred products except"
    )
    expect(exception.context.map((span) => table.text.slice(span.start, span.end))).toContain("6001-T, eff. 1-1-92")
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", text: table.text, xml: table.xml }]
    const projection = buildLegalTextProjection({
      versionId: digest(table.xml),
      body: table.text,
      blocks: sourceBlocks
    })
    for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
      const tokenizer = await embeddingTokenizer(model)
      const prepared = buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer })
      expect(prepared.passages.map((passage) => passage.text).join("")).toBe(table.text)
      expect(
        prepared.passages.every(
          (passage) => passage.tokenCount === tokenizer.count(passage.inputText) && passage.tokenCount <= 1200
        )
      ).toBe(true)
    }
  }, 30_000)

  it.each([
    ["STCC No.", "21 143", "Food except"],
    ["Other", "20 143", "Food except"],
    ["STCC No.", "20 143", "Food"]
  ])("rejects unproven commodity continuation %s %s %s", (heading, code, commodity) => {
    const input = {
      text: `${heading}\tSTCC tariff\tCommodity\n20\t6001-T\t${commodity}\n${code} Exception\n22\tDo.\tTextiles`,
      xml: `<TABLE><TR><TH>${heading}</TH><TH>STCC tariff</TH><TH>Commodity</TH></TR><TR><TD>20</TD><TD>6001-T</TD><TD>${commodity}</TD></TR><TR><TD/><TD/><TD>${code} Exception</TD></TR><TR><TD>22</TD><TD>Do.</TD><TD>Textiles</TD></TR></TABLE>`
    }
    expect(() => legalTableRows(input)).toThrow("passage_table_unresolved_ditto")
  })

  it.each(["center", ""])("does not infer a centered category without left-aligned data: %s", (child) => {
    const input = {
      text: `A\tB\nCategory:\nChild\tDo.`,
      xml: `<TABLE><TR><TD>A</TD><TD>B</TD></TR><TR><TD class="center">Category:</TD><TD/></TR><TR><TD class="${child}">Child</TD><TD>Do.</TD></TR></TABLE>`
    }
    expect(() => legalTableRows(input)).toThrow("passage_table_unresolved_ditto")
  })

  it("preserves real blank publisher layout rows with both tokenizers and retains caption-only failures", async () => {
    const fixtures = z
      .array(z.object({ shape: z.string(), block: z.object({ text: z.string(), xml: z.string(), tag: z.string() }) }))
      .parse(JSON.parse(await readFile(new URL("./fixtures/publisher-empty-table-rows.json", import.meta.url), "utf8")))
    expect(fixtures).toHaveLength(4)
    const caption = fixtures.find(({ shape }) => shape === "html_caption_only")
    invariant(caption, "caption_fixture_required")
    expect(() => legalTableLayout(caption.block).map(legalTableRows)).toThrow("passage_table_data_rows_required")
    for (const { block: input } of fixtures.filter(({ shape }) => shape !== "html_caption_only")) {
      const tables = legalTableLayout(input)
      for (const table of tables) {
        const layout = legalTableRows(table)
        expect(
          table.text.slice(layout.header.start, layout.header.end) +
            layout.rows.map((row) => table.text.slice(row.start, row.end)).join("")
        ).toBe(table.text)
      }
      const sourceBlocks = [{ ordinal: 0, kind: "table", ...input }]
      const projection = buildLegalTextProjection({
        versionId: digest(input.xml),
        body: input.text,
        blocks: sourceBlocks
      })
      for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
        const counter = await embeddingTokenizer(model)
        const prepared = buildLegalPassages({ sourceBlocks, projection, context: "Federal code", tokenizer: counter })
        expect(prepared.passages.map((row) => row.text).join("")).toBe(input.text)
        expect(
          prepared.passages.every((row) => row.tokenCount === counter.count(row.inputText) && row.tokenCount <= 1200)
        ).toBe(true)
      }
    }
  })
  it("preserves the real FR tables containing empty GPO ruling rows", async () => {
    const fixtures = z
      .array(z.object({ text: z.string(), xml: z.string(), rulingRows: z.number() }))
      .parse(
        JSON.parse(await readFile(new URL("./fixtures/fr-2000-01-18-ruling-tables.json", import.meta.url), "utf8"))
      )
    expect(fixtures.map((row) => row.rulingRows)).toEqual([1, 1, 3])
    for (const input of fixtures) {
      const layout = legalTableRows(input)
      expect(
        input.text.slice(layout.header.start, layout.header.end) +
          layout.rows.map((row) => input.text.slice(row.start, row.end)).join("")
      ).toBe(input.text)
      const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "GPOTABLE", text: input.text, xml: input.xml }]
      const projection = buildLegalTextProjection({
        versionId: digest(input.xml),
        body: input.text,
        blocks: sourceBlocks
      })
      for (const model of ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const) {
        const counter = await embeddingTokenizer(model)
        const prepared = buildLegalPassages({
          sourceBlocks,
          projection,
          context: "Federal Register",
          tokenizer: counter
        })
        expect(prepared.passages.map((row) => row.text).join("")).toBe(input.text)
        expect(
          prepared.passages.every((row) => row.tokenCount === counter.count(row.inputText) && row.tokenCount <= 1200)
        ).toBe(true)
      }
    }
  })
  it("skips source-only rulings during row-cell lookup without inventing data rows", () => {
    const input = {
      text: "A\tValue",
      xml: '<GPOTABLE><ROW RUL="s"/><ROW><ENT>A</ENT><ENT>Value</ENT></ROW><ROW RUL="s"/></GPOTABLE>'
    }
    expect(legalTableRows(input).rows).toEqual([{ start: 0, end: 7, context: [] }])
    expect(legalTableRowCells(input, 0)).toEqual({
      cells: [
        { column: 1, start: 0, end: 1 },
        { column: 2, start: 2, end: 7 }
      ],
      group: undefined
    })
  })
  it.each([
    "<ROW/>",
    '<ROW RUL="s" ROWSPAN="2"/>',
    '<ROW RUL="s"><ENT ROWSPAN="2"/></ROW>',
    "<ROW><GRAPHIC/></ROW>",
    '<TR RUL="s"/>',
    '<TR><TD rowspan="2"/></TR>',
    '<TR><TD colspan="0"/></TR>',
    '<TR><TD colspan="1001"/></TR>',
    '<TR><TD data-value="hidden"/></TR>',
    "<TR><TD><IMG/></TD></TR>"
  ])("still rejects unsupported empty structure %s", (empty) => {
    const input = { text: "A", xml: `<GPOTABLE>${empty}<ROW><ENT>A</ENT></ROW></GPOTABLE>` }
    expect(() => legalTableRows(input)).toThrow("passage_table_empty_row")
    expect(() => legalTableRowCells(input, 0)).toThrow("passage_table_empty_row")
  })
  it.each(['<ROW RUL="s"><ENT I="01">&#x2003;</ENT></ROW>', '<TR><TD colspan="2"> </TD></TR>'])(
    "does not carry context across a supported blank cell row %s",
    (empty) => {
      const input = {
        text: "Group\nA\tValue",
        xml: `<TABLE><TR><TD colspan="2">Group</TD></TR>${empty}<TR><TD>A</TD><TD>Value</TD></TR></TABLE>`
      }
      expect(legalTableRows(input).rows[1]?.context).toEqual([])
      expect(legalTableRowCells(input, 6).group).toBeUndefined()
      expect(() =>
        legalTableRows({
          text: "Alpha\t1\nDo\t2",
          xml: `<TABLE><TR><TD>Alpha</TD><TD>1</TD></TR>${empty}<TR><TD>Do</TD><TD>2</TD></TR></TABLE>`
        })
      ).toThrow("passage_table_unresolved_ditto")
    }
  )
  it("skips blank explicit headers during cell lookup but rejects headers interleaved with data", () => {
    const input = {
      text: "Label\nA\tValue",
      xml: "<TABLE><TR><TH>Label</TH></TR><TR><TH/></TR><TR><TD>A</TD><TD>Value</TD></TR></TABLE>"
    }
    expect(legalTableRowCells(input, 6).cells).toEqual([
      { column: 1, start: 6, end: 7 },
      { column: 2, start: 8, end: 13 }
    ])
    expect(() =>
      legalTableRows({
        text: "A\nB",
        xml: "<TABLE><TR><TD>A</TD></TR><THEAD><TR><TH/></TR></THEAD><TR><TD>B</TD></TR></TABLE>"
      })
    ).toThrow("passage_table_interleaved_headers")
  })
  it("does not carry a ditto reference or group across a ruling divider", () => {
    expect(() =>
      legalTableRows({
        text: "Alpha\t1\nDo\t2",
        xml: '<GPOTABLE><ROW><ENT>Alpha</ENT><ENT>1</ENT></ROW><ROW RUL="s"/><ROW><ENT>Do</ENT><ENT>2</ENT></ROW></GPOTABLE>'
      })
    ).toThrow("passage_table_unresolved_ditto")
    const input = {
      text: "Group\nA\tValue",
      xml: '<GPOTABLE><ROW><ENT COLSPAN="2">Group</ENT></ROW><ROW RUL="s"/><ROW><ENT>A</ENT><ENT>Value</ENT></ROW></GPOTABLE>'
    }
    expect(legalTableRows(input).rows[1]?.context).toEqual([])
    expect(legalTableRowCells(input, 6).group).toBeUndefined()
  })
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

  it.each(["openai/text-embedding-3-small", "voyageai/voyage-4"] as const)(
    "keeps resolved ditto context on every oversized row continuation with %s",
    async (model) => {
      const counter = await embeddingTokenizer(model)
      for (const marker of ["Do.", "......do"]) {
        const long = "A detailed source condition with 🧭 and § symbols. ".repeat(150).trim()
        const text = `Name\tCondition\tUnit\nOriginal\tShort\tMilligrams\nMiddle\tBrief\t${marker}\nGroup B\nTarget\t${long}\t${marker}`
        const xml = `<TABLE><TR><TH>Name</TH><TH>Condition</TH><TH>Unit</TH></TR><TR><TD>Original</TD><TD>Short</TD><TD>Milligrams</TD></TR><TR><TD>Middle</TD><TD>Brief</TD><TD>${marker}</TD></TR><TR><TD colspan="3">Group B</TD></TR><TR><TD>Target</TD><TD>${long}</TD><TD>${marker}</TD></TR></TABLE>`
        const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", text, xml }]
        const projection = buildLegalTextProjection({ versionId: digest(xml), body: text, blocks: sourceBlocks })
        const options = {
          projection,
          sourceBlocks,
          context: "Federal code",
          tokenizer: counter,
          targetTokens: 120,
          maximumTokens: 180
        }
        const prepared = buildLegalPassages(options)
        expect(prepared.passages.map((p) => p.text).join("")).toBe(text)
        const continuations = prepared.passages.filter((p) => p.rowContinuation !== null)
        expect(continuations.length).toBeGreaterThan(1)
        for (const passage of continuations) {
          expect(passage.rowContinuation).toEqual({ start: text.indexOf("Target"), end: text.length, longColumn: 2 })
          expect(passage.inputText).toContain("Column 3 ditto source: Milligrams")
          expect(passage.inputText).toContain("Source row group: Group B")
          expect(passage.inputText).toContain(`Column 3: ${marker}`)
          expect(passage.contextSpans.map((span) => text.slice(span.start, span.end))).toContain("Milligrams")
          expect(passage.contextSpans.map((span) => text.slice(span.start, span.end))).toContain("Group B")
          expect(passage.readerSpans.map((span) => text.slice(span.start, span.end)).join("")).toBe(passage.text)
          expect(passage.tokenCount).toBe(counter.count(passage.inputText))
          expect(passage.tokenCount).toBeLessThanOrEqual(120)
          expect(passage.inputText.length).toBeLessThanOrEqual(16000)
          expect(passage.inputHash).toBe(digest(passage.inputText))
        }
        expect(buildLegalPassages(options)).toEqual(prepared)
        const missing = {
          text: text.replace("Short\tMilligrams", "Short"),
          xml: xml.replace("<TD>Milligrams</TD>", "<TD/>")
        }
        expect(() => legalTableRowCells(missing, missing.text.indexOf("Target"))).toThrow(
          "passage_table_unresolved_ditto"
        )
      }
    }
  )

  it("rejects row continuations when a verified ditto source exhausts the context budget", () => {
    const value = "Long source value ".repeat(20).trim()
    const text = `A\t${value}\nB\tDo.`
    const xml = `<TABLE><TR><TD>A</TD><TD>${value}</TD></TR><TR><TD>B</TD><TD>Do.</TD></TR></TABLE>`
    const sourceBlocks = [{ ordinal: 0, kind: "table", tag: "TABLE", text, xml }]
    const projection = buildLegalTextProjection({ versionId: digest(xml), body: text, blocks: sourceBlocks })
    expect(() =>
      buildLegalPassages({ projection, sourceBlocks, context: "US", tokenizer, targetTokens: 120, maximumTokens: 180 })
    ).toThrow("passage_table_continuation_context_exhausts_budget")
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
    ).toThrow("passage_table_unresolved_ditto")
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
    const continued = text.replace("Ingredient D\tCarrier", "Ingredient D\tDo.")
    const continuedXml = xml.replace("<TD>Carrier</TD>", "<TD>Do.</TD>")
    const dependentRow = legalTableRows({ text: continued, xml: continuedXml }).rows.find((row) =>
      continued.slice(row.start, row.end).startsWith("Ingredient D\t")
    )
    invariant(dependentRow, "dependent_row_required")
    expect(dependentRow.context.map((span) => continued.slice(span.start, span.end))).toEqual(["Group B", "Solvent"])
  })
})
