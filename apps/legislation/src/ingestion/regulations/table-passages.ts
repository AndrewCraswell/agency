import { load } from "cheerio"
import { XMLValidator } from "fast-xml-parser"
import invariant from "tiny-invariant"

const breaks = new Set(["P", "FP", "PSPACE", "HD", "HEAD", "HED", "ROW", "TR", "SECTNO", "SUBJECT", "FRDOC", "LI"])

/** Match the parser's plain-text rendering; refuse segmentation if the stored text differs. */
function sourceText(selection: ReturnType<ReturnType<typeof load>>, stop?: ReturnType<ReturnType<typeof load>>) {
  const pieces: string[] = []
  const wrap = load("", { xml: true })
  const stops = new Set(stop?.toArray())
  let stopped = false
  const visit = (nodes: typeof selection) => {
    for (const node of nodes.toArray()) {
      if (stops.has(node)) {
        stopped = true
      }
      if (stopped) {
        return
      }
      if (node.type === "text") {
        pieces.push(node.data)
      } else if ("name" in node && "children" in node) {
        if (breaks.has(node.name)) {
          pieces.push("\n")
        }
        visit(wrap(node.children))
        if (stopped) {
          return
        }
        if (["TD", "TH", "ENT"].includes(node.name)) {
          pieces.push("\t")
        }
        if (breaks.has(node.name)) {
          pieces.push("\n")
        }
      }
    }
  }
  visit(selection)
  return pieces
    .join("")
    .split("\n")
    .map((line) => line.replaceAll(/[ \r\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim()
}

function parseTableSource(input: { text: string; xml: string }) {
  invariant(Buffer.byteLength(input.xml) <= 32 * 1024 * 1024, "passage_table_xml_limit")
  invariant(!/<!DOCTYPE|<!ENTITY/i.test(input.xml), "passage_table_xml_declaration")
  invariant(XMLValidator.validate(input.xml) === true, "passage_table_xml_invalid")
  const $ = load(input.xml, { xml: true })
  invariant(sourceText($.root().children()) === input.text, "passage_table_source_text_mismatch")
  return $
}

/** Separate actual tables from surrounding prose in a parser block that may contain an entire appendix. */
export function legalTableLayout(input: { text: string; xml: string }) {
  const $ = parseTableSource(input)
  const tables = $("GPOTABLE, TABLE")
  invariant(tables.length > 0 && tables.find("GPOTABLE, TABLE").length === 0, "passage_table_complex_structure")
  let position = 0
  return tables.toArray().flatMap((node) => {
    const selection = $(node)
    const text = sourceText(selection)
    if (!text) {
      return []
    }
    const prefix = sourceText($.root().children(), selection)
    invariant(input.text.startsWith(prefix), "passage_table_source_text_mismatch")
    const start = input.text.indexOf(text, prefix.length)
    invariant(
      start >= position && start >= prefix.length && input.text.slice(prefix.length, start).trim().length === 0,
      "passage_table_source_text_mismatch"
    )
    position = start + text.length
    return [{ start, end: position, text, xml: $.xml(selection) }]
  })
}

/** Offsets refer to one exact table. No guessed headers or splits inside a row. */
export function legalTableRows(input: { text: string; xml: string }) {
  const $ = parseTableSource(input)
  const tables = $("GPOTABLE, TABLE")
  invariant(tables.length === 1, "passage_table_complex_structure")
  const rows = tables.find("ROW, TR")
  invariant(rows.length > 0 && rows.find("ROW, TR").length === 0, "passage_table_complex_structure")
  const headers = tables.find("BOXHD, THEAD")
  const order = $.root().find("*").toArray()
  type Context = { start: number; end: number; label: string }
  const ranges: { start: number; end: number; context: Context[] }[] = []
  let group: Context | undefined
  const previousCells = new Map<number, Context>()
  let position = 0
  for (const row of rows.toArray()) {
    const selection = $(row)
    const text = sourceText(selection)
    invariant(text.length > 0, "passage_table_empty_row")
    const isHeader =
      selection.parents("BOXHD, THEAD").length > 0 ||
      (selection.find("TH").length > 0 && selection.find("TD, ENT").length === 0)
    if (!isHeader) {
      for (const cell of selection.find("[rowspan], [ROWSPAN], [MOREROWS], [morerows]").toArray()) {
        const attributes = $(cell).attr() ?? {}
        invariant(
          Object.entries(attributes).every(
            ([name, value]) =>
              !["rowspan", "morerows"].includes(name.toLowerCase()) ||
              value === (name.toLowerCase() === "rowspan" ? "1" : "0")
          ),
          "passage_table_spanning_rows"
        )
      }
    }
    if (!isHeader && ranges.length === 0) {
      invariant(
        headers.toArray().every((header) => order.indexOf(header) < order.indexOf(row)),
        "passage_table_interleaved_headers"
      )
      const prefix = sourceText($.root().children(), selection)
      invariant(input.text.startsWith(prefix), "passage_table_header_text_mismatch")
      position = prefix.length
    }
    const start = input.text.indexOf(text, position)
    invariant(
      start >= position && (isHeader || input.text.slice(position, start).trim().length === 0),
      "passage_table_row_text_mismatch"
    )
    if (isHeader) {
      invariant(ranges.length === 0, "passage_table_interleaved_headers")
    } else {
      invariant(
        ranges.length === 0 || input.text.slice(position, start).trim().length === 0,
        "passage_table_interleaved_text"
      )
      const cells = selection.children("TD, TH, ENT")
      const isGroup =
        cells.length === 1 && Number(cells.first().attr("colspan") ?? cells.first().attr("COLSPAN") ?? 1) > 1
      const context: Context[] = []
      if (isGroup) {
        group = { start, end: start + text.length, label: "Source row group" }
        previousCells.clear()
      } else {
        if (group) {
          context.push(group)
        }
        let column = 1
        for (const node of cells.toArray()) {
          const cell = $(node)
          const value = sourceText(cell)
          const width = Number(cell.attr("colspan") ?? cell.attr("COLSPAN") ?? 1)
          invariant(Number.isInteger(width) && width > 0 && width <= 1000, "passage_table_invalid_column_span")
          const before = sourceText(selection, cell)
          const offset = value ? text.indexOf(value, before.length) : before.length
          invariant(
            offset >= before.length && text.slice(before.length, offset).trim().length === 0,
            "passage_table_cell_text_mismatch"
          )
          if (/^(do\.?|ditto|〃)$/i.test(value)) {
            const reference = previousCells.get(column)
            invariant(width === 1 && reference, "passage_table_unresolved_ditto")
            context.push(reference)
          } else {
            for (let index = column; index < column + width; index++) {
              previousCells.delete(index)
            }
            if (value && width === 1) {
              previousCells.set(column, {
                start: start + offset,
                end: start + offset + value.length,
                label: `Column ${column} ditto source`
              })
            }
          }
          column += width
        }
        for (const index of previousCells.keys()) {
          if (index >= column) {
            previousCells.delete(index)
          }
        }
      }
      ranges.push({ start, end: start + text.length, context })
    }
    position = start + text.length
  }
  invariant(ranges.length > 0, "passage_table_data_rows_required")
  const first = ranges[0]
  invariant(first, "passage_table_row_missing")
  // Include captions/column headings in context, separators in the preceding row, and trailing footnotes in the last row.
  for (let index = 0; index < ranges.length; index++) {
    const row = ranges[index]
    invariant(row, "passage_table_row_missing")
    row.end = ranges[index + 1]?.start ?? input.text.length
  }
  return { header: { start: 0, end: first.start }, rows: ranges }
}

/** Source evidence for a row continuation. Column spans are not inferred from tabs or rendered line breaks. */
export function legalTableRowCells(input: { text: string; xml: string }, rowStart: number) {
  const $ = parseTableSource(input)
  const rows = $("ROW, TR").toArray()
  let group: { start: number; end: number } | undefined
  for (const node of rows) {
    const row = $(node)
    if (row.parents("BOXHD, THEAD").length > 0) {
      continue
    }
    const text = sourceText(row)
    const cells = row.children("TD, TH, ENT")
    // Only compute a full source prefix for candidate rows or explicit spanning group labels.
    const groupSpan =
      cells.length === 1 && Number(cells.first().attr("colspan") ?? cells.first().attr("COLSPAN") ?? 1) > 1
    if (!groupSpan && !input.text.startsWith(text, rowStart)) {
      continue
    }
    const prefix = sourceText($.root().children(), row)
    const start = input.text.indexOf(text, prefix.length)
    invariant(
      start >= prefix.length && input.text.slice(prefix.length, start).trim().length === 0,
      "passage_table_row_text_mismatch"
    )
    if (start > rowStart) {
      break
    }
    if (groupSpan && start < rowStart) {
      group = { start, end: start + text.length }
    }
    if (start !== rowStart) {
      continue
    }
    invariant(cells.length > 0, "passage_table_cells_required")
    const spans = cells.toArray().map((cell, index) => {
      const selection = $(cell)
      invariant(
        Number(selection.attr("colspan") ?? selection.attr("COLSPAN") ?? 1) === 1,
        "passage_table_continuation_spanning_cells"
      )
      const value = sourceText(selection)
      invariant(!/^(do\.?|ditto|〃)$/i.test(value), "passage_table_continuation_ditto_reference")
      const before = sourceText(row, selection)
      const offset = value ? text.indexOf(value, before.length) : before.length
      invariant(
        offset >= before.length && text.slice(before.length, offset).trim().length === 0,
        "passage_table_cell_text_mismatch"
      )
      return { column: index + 1, start: start + offset, end: start + offset + value.length }
    })
    return { cells: spans, group }
  }
  throw new Error("passage_table_row_not_found")
}
