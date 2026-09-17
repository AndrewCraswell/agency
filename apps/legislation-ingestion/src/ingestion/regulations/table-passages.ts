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

/** Recognize retained publisher layout rows, never images, unknown cells or row-spanning data. */
function isEmptySeparatorRow(row: ReturnType<ReturnType<typeof load>>) {
  if (row.text().trim().length !== 0) {
    return false
  }
  const attributes = row.attr() ?? {}
  const cells = row.children()
  if (row.is("ROW")) {
    // Annual GPO rulings can contain an indented, whitespace-only ENT; FR can have no cells.
    return (
      !!attributes.RUL &&
      Object.keys(attributes).every((name) => ["RUL", "EXPSTB"].includes(name)) &&
      cells
        .toArray()
        .every(
          (cell) =>
            cell.name === "ENT" &&
            cell.children.every((child) => child.type === "text") &&
            Object.keys(cell.attribs).every((name) => name === "I")
        )
    )
  }
  return (
    row.is("TR") &&
    cells.length > 0 &&
    Object.keys(attributes).every((name) => name.toLowerCase() === "class") &&
    cells
      .toArray()
      .every(
        (cell) =>
          ["TD", "TH"].includes(cell.name) &&
          cell.children.every((child) => child.type === "text") &&
          Object.entries(cell.attribs).every(
            ([name, value]) =>
              name.toLowerCase() === "class" ||
              (name.toLowerCase() === "colspan" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1000)
          )
      )
  )
}

function isTableHeader(row: ReturnType<ReturnType<typeof load>>) {
  return row.parents("BOXHD, THEAD").length > 0 || (row.find("TH").length > 0 && row.find("TD, ENT").length === 0)
}

function isDittoMarker(value: string) {
  // Retained eCFR cells use dotted leaders before "do". They still reference the same
  // column; the dots are publisher formatting, never a replacement column value.
  return /^(?:(?:\.{2,})?do\.?|ditto|〃)$/i.test(value)
}

function rowIndent(row: ReturnType<ReturnType<typeof load>>) {
  return Number(
    row
      .children("TD, TH")
      .first()
      .attr("class")
      ?.match(/(?:^|\s)primary-indent-hanging-(\d+)(?:\s|$)/)?.[1] ?? 0
  )
}

/** Require publisher indentation or centered-heading/left-data styling, not blank cells alone. */
function sourceCategoryLevel(row: ReturnType<ReturnType<typeof load>>) {
  const cells = row.children("TD")
  if (
    !(
      row.is("TR") &&
      cells.length > 1 &&
      sourceText(cells.first()).endsWith(":") &&
      cells.toArray().every((cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1) &&
      cells
        .slice(1)
        .toArray()
        .every((cell) => cell.children.every((child) => child.type === "text" && child.data.trim() === "")) &&
      row.next("TR").children("TD").length === cells.length
    )
  ) {
    return null
  }
  if (rowIndent(row.next("TR")) > rowIndent(row)) {
    return rowIndent(row)
  }
  const childCells = row.next("TR").children("TD")
  if (
    cells.first().hasClass("center") &&
    childCells.first().hasClass("left") &&
    childCells.slice(1).text().trim().length > 0
  ) {
    return -1
  }
  return null
}

/** Explicit alphabetic conditions complete a filled "when:" row; ordinary blanks remain boundaries. */
function sourceConditionRows(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  for (let index = 0; index < nodes.length; index++) {
    const parent = nodes[index]
    invariant(parent, "passage_table_row_missing")
    const cells = $(parent).children("TD")
    if (
      !$(parent).is("TR") ||
      cells.length < 2 ||
      !/when:\s*$/.test(sourceText(cells.first())) ||
      !cells
        .toArray()
        .every(
          (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 && sourceText($(cell)).length > 0
        )
    ) {
      continue
    }
    const children: typeof nodes = []
    for (let offset = 1; offset <= 26; offset++) {
      const child = nodes[index + offset]
      if (!child) {
        break
      }
      const childCells = $(child).children("TD")
      const text = sourceText(childCells.first())
      if (
        !$(child).is("TR") ||
        childCells.length !== cells.length ||
        !text.startsWith(`(${String.fromCharCode(96 + offset)}) `) ||
        !childCells.toArray().every((cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1) ||
        !childCells
          .slice(1)
          .toArray()
          .every((cell) => cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
      ) {
        break
      }
      children.push(child)
      if (text.endsWith(".")) {
        if (children.length >= 2) {
          for (const condition of children) {
            parents.set(condition, parent)
          }
        }
        break
      }
      if (!/; or,?$/.test(text)) {
        break
      }
    }
  }
  return parents
}

/** Preserve explicitly listed STCC exceptions without treating arbitrary blank tariff cells as ditto. */
function sourceCommodityExceptionRows(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  const headers = rows.first().parents("TABLE").find("TH")
  if (
    headers.length !== 3 ||
    sourceText(headers.eq(0)) !== "STCC No." ||
    sourceText(headers.eq(1)) !== "STCC tariff" ||
    sourceText(headers.eq(2)) !== "Commodity"
  ) {
    return parents
  }
  for (let index = 0; index < nodes.length; index++) {
    const parent = nodes[index]
    invariant(parent, "passage_table_row_missing")
    const row = $(parent)
    const cells = row.children("TD")
    const parentCode = sourceText(cells.first())
    if (
      cells.length !== 3 ||
      !cells.toArray().every((cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1) ||
      !/^\d+(?: \d+)*$/.test(parentCode) ||
      sourceText(cells.eq(1)).length === 0 ||
      !/except:?$/.test(sourceText(cells.eq(2)))
    ) {
      continue
    }
    const children: typeof nodes = []
    let complete = false
    for (let next = index + 1; next < nodes.length; next++) {
      const child = nodes[next]
      invariant(child, "passage_table_row_missing")
      const childCells = $(child).children("TD")
      if (childCells.length === 3 && sourceText(childCells.first()).length > 0) {
        complete = true
        break
      }
      const childCode = sourceText(childCells.eq(2))
        .match(/^\d[\d ]*/)?.[0]
        .replaceAll(" ", "")
      if (
        childCells.length !== 3 ||
        !childCode?.startsWith(parentCode.replaceAll(" ", "")) ||
        !childCells.toArray().every((cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1) ||
        !childCells
          .slice(0, 2)
          .toArray()
          .every((cell) => cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
      ) {
        break
      }
      children.push(child)
      complete = next === nodes.length - 1
    }
    if (complete) {
      for (const child of children) {
        parents.set(child, parent)
      }
    }
  }
  return parents
}

/** EPA designated-area tables express a partial-county scope as a separate empty-value row. */
function sourceCountyBoundaryRows(rows: ReturnType<ReturnType<typeof load>>, hasDesignatedAreaHeader: boolean) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  if (!hasDesignatedAreaHeader) {
    return parents
  }
  for (let index = 1; index < nodes.length; index++) {
    const parent = nodes[index - 1]
    const child = nodes[index]
    invariant(parent && child, "passage_table_row_missing")
    const parentRow = $(parent)
    const childRow = $(child)
    const parentCells = parentRow.children("TD")
    const childCells = childRow.children("TD")
    if (
      parentCells.length >= 3 &&
      childCells.length === parentCells.length &&
      sourceText(parentCells.first()).endsWith("County (part)") &&
      sourceText(parentCells.slice(1)).length > 0 &&
      rowIndent(childRow) > rowIndent(parentRow) &&
      /^That portion\b/i.test(sourceText(childCells.first())) &&
      [...parentCells.toArray(), ...childCells.toArray()].every(
        (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1
      ) &&
      childCells
        .slice(1)
        .toArray()
        .every((cell) => cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
    ) {
      parents.set(child, parent)
    }
  }
  return parents
}

/** Reviewed frequency tables can omit station class while later explicit dittos retain the printed class. */
function isSparseStationClass(row: ReturnType<ReturnType<typeof load>>, hasFrequencyHeaders: boolean) {
  const cells = row.children("TD")
  return (
    hasFrequencyHeaders &&
    cells.length === 4 &&
    /^\d+(?:\.\d+)?$/.test(sourceText(cells.first())) &&
    cells
      .toArray()
      .every(
        (cell, column) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          (column === 1
            ? cell.children.every((node) => node.type === "text" && node.data.trim() === "")
            : sourceText(cells.eq(column)).length > 0)
      )
  )
}

/** The reviewed income table leaves parent-benefit cells blank for these child-only entries. */
function isChildIncomeRow(row: ReturnType<ReturnType<typeof load>>, hasIncomeHeaders: boolean) {
  const cells = row.children("TD")
  return (
    hasIncomeHeaders &&
    cells.length === 6 &&
    ["(4) Earned income of child-claimant", "Educational assistance (38 U.S.C. ch. 35)"].includes(
      sourceText(cells.first())
    ) &&
    cells
      .toArray()
      .every(
        (cell, index) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          ([1, 2, 5].includes(index)
            ? cell.children.every((node) => node.type === "text" && node.data.trim() === "")
            : sourceText(cells.eq(index)).length > 0)
      )
  )
}

/** Unclassified pesticide entries have no restriction criterion; later explicit dittos retain the printed criterion. */
function isSparsePesticideCriteria(row: ReturnType<ReturnType<typeof load>>, hasPesticideHeaders: boolean) {
  const cells = row.children("TD")
  return (
    hasPesticideHeaders &&
    cells.length === 5 &&
    cells
      .toArray()
      .every(
        (cell, index) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          (index === 4
            ? cell.children.every((node) => node.type === "text" && node.data.trim() === "")
            : index === 0 || sourceText(cells.eq(index)).length > 0)
      )
  )
}

/** Preserve references only across the two reviewed sparse ingredient rows, without filling their empty cells. */
function sparseIngredientColumns(row: ReturnType<ReturnType<typeof load>>, hasIngredientHeaders: boolean) {
  const cells = row.children("TD")
  const name = sourceText(cells.eq(1))
  const columns = name === "Disodium guanylate" ? [5] : name === "Potassium hydroxide" ? [3, 4] : []
  return hasIngredientHeaders &&
    cells.length === 5 &&
    columns.length > 0 &&
    cells
      .toArray()
      .every(
        (cell, index) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          (index === 0 || columns.includes(index + 1)
            ? cell.children.every((node) => node.type === "text" && node.data.trim() === "")
            : sourceText(cells.eq(index)).length > 0)
      )
    ? columns
    : []
}

/** The reviewed 3.1c entry leaves solubility blank; the next explicit ditto cites the last printed value. */
function isSparsePolymerSolubility(row: ReturnType<ReturnType<typeof load>>, hasPolymerHeaders: boolean) {
  const cells = row.children("TD")
  return (
    hasPolymerHeaders &&
    cells.length === 5 &&
    sourceText(cells.first()).startsWith(
      "3.1c. Olefin copolymers described in paragraph (a)(3)(i)(a)(3) of this section "
    ) &&
    sourceText(cells.eq(1)) === "Not less than 0.92" &&
    cells
      .toArray()
      .every(
        (cell, index) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          (index < 2 || cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
      )
  )
}

/** Reviewed flavoring tables print sparse limitations; a blank row itself inherits no limitation. */
function isSparseFlavoringLimitation(row: ReturnType<ReturnType<typeof load>>, hasFlavoringHeaders: boolean) {
  const cells = row.children("TD")
  return (
    hasFlavoringHeaders &&
    cells.length === 3 &&
    cells
      .toArray()
      .every(
        (cell, column) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          (column < 2
            ? sourceText(cells.eq(column)).length > 0
            : cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
      )
  )
}

/** A reserved rule has no approval date; the next explicit ditto still cites the earlier approval entry. */
function isReservedApprovalRow(row: ReturnType<ReturnType<typeof load>>, hasApprovalHeaders: boolean) {
  const cells = row.children("TD")
  return (
    hasApprovalHeaders &&
    cells.length === 4 &&
    /^Rule \d+—\(Reserved\)(?: |$)/.test(sourceText(cells.first())) &&
    cells
      .toArray()
      .every(
        (cell, column) =>
          Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
          (column === 0 || cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
      )
  )
}

/** Source-reviewed wrapped substance name; see the published CFR evidence in ditto-source-review.md. */
function sourceReviewedNameContinuations(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  const headers = rows.first().parents("TABLE").find("THEAD TH")
  if (
    headers.length !== 2 ||
    sourceText(headers.eq(0)) !== "List of substances" ||
    sourceText(headers.eq(1)) !== "Limitations"
  ) {
    return parents
  }
  for (let index = 1; index < nodes.length; index++) {
    const parent = nodes[index - 1]
    const child = nodes[index]
    invariant(parent && child, "passage_table_row_missing")
    const before = $(parent).children("TD")
    const after = $(child).children("TD")
    if (
      before.length === 2 &&
      after.length === 2 &&
      rowIndent($(parent)) === 1 &&
      rowIndent($(child)) === 1 &&
      sourceText(before.first()) === "Titanium dioxide-magnesium" &&
      isDittoMarker(sourceText(before.eq(1))) &&
      sourceText(after.first()) === "silicate" &&
      [...before.toArray(), ...after.toArray()].every(
        (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1
      ) &&
      after
        .eq(1)
        .toArray()
        .every((cell) => cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
    ) {
      parents.set(child, parent)
    }
  }
  return parents
}

/** In expense-group tables, empty-account headings scope a populated same-account-family run. */
function sourceExpenseGroups(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  const headers = rows.first().parents("TABLE").find("THEAD TH")
  if (
    headers.length !== 3 ||
    sourceText(headers.eq(0)) !== "Operating expense group and accounts" ||
    sourceText(headers.eq(1)) !== "Account No." ||
    sourceText(headers.eq(2)) !== "Basis of assignment to on-branch costs"
  ) {
    return parents
  }
  for (let index = 0; index < nodes.length; index++) {
    const parent = nodes[index]
    invariant(parent, "passage_table_row_missing")
    const parentRow = $(parent)
    const cells = parentRow.children("TD")
    const label = sourceText(cells.first())
    if (
      rowIndent(parentRow) > 3 ||
      cells.length !== 3 ||
      !label ||
      !cells
        .toArray()
        .every(
          (cell, column) =>
            Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
            (column === 0 || cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
        )
    ) {
      continue
    }
    const members = [parent]
    let accountFamily: string | undefined
    for (let next = index + 1; next < nodes.length; next++) {
      const child = nodes[next]
      invariant(child, "passage_table_row_missing")
      const childRow = $(child)
      const childCells = childRow.children("TD")
      const account = sourceText(childCells.eq(1))
      if (
        rowIndent(childRow) !== 2 ||
        childCells.length !== 3 ||
        !/^\d{1,2}-\d{2}-\d{2}$/.test(account) ||
        !childCells
          .toArray()
          .every(
            (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 && sourceText($(cell)).length > 0
          )
      ) {
        break
      }
      const family = account.slice(-5)
      if (accountFamily !== undefined && family !== accountFamily) {
        break
      }
      accountFamily = family
      members.push(child)
    }
    if (members.length >= 3) {
      for (const member of members) {
        parents.set(member, parent)
      }
    }
  }
  return parents
}

/** Chemical headings use Arabic group numbers and consecutive Roman-numbered members at equal indentation. */
function sourceChemicalGroups(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  const headers = rows.first().parents("TABLE").find("THEAD TH")
  if (
    headers.length !== 3 ||
    sourceText(headers.eq(0)) !== "Mixture/substance" ||
    sourceText(headers.eq(1)) !== "Required test" ||
    sourceText(headers.eq(2)) !== "FR citation"
  ) {
    return parents
  }
  const numerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
  const isHeading = (cells: ReturnType<ReturnType<typeof $>["children"]>) =>
    cells.length === 3 &&
    sourceText(cells.first()).endsWith(":") &&
    cells
      .toArray()
      .every(
        (cell, column) =>
          Number($(cell).attr("colspan") ?? 1) === 1 && (column === 0 || sourceText($(cell)).length === 0)
      )
  for (let index = 0; index < nodes.length; index++) {
    const parent = nodes[index]
    invariant(parent, "passage_table_row_missing")
    const parentRow = $(parent)
    const cells = parentRow.children("TD")
    if (!isHeading(cells) || !/^\([1-9]\d*\) .*following chemical substances.*:$/.test(sourceText(cells.first()))) {
      continue
    }
    const members = [parent]
    let complete = false
    for (let next = index + 1; next < nodes.length; next++) {
      const child = nodes[next]
      invariant(child, "passage_table_row_missing")
      const childRow = $(child)
      const childCells = childRow.children("TD")
      if (isHeading(childCells)) {
        complete = true
        break
      }
      const numeral = numerals[members.length - 1]
      if (
        !numeral ||
        childCells.length !== 3 ||
        rowIndent(childRow) !== rowIndent(parentRow) ||
        !sourceText(childCells.first()).startsWith(`(${numeral}) `) ||
        !childCells
          .toArray()
          .every(
            (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 && sourceText($(cell)).length > 0
          )
      ) {
        break
      }
      members.push(child)
      complete = next === nodes.length - 1
    }
    if (complete && members.length >= 3) {
      for (const member of members) {
        parents.set(member, parent)
      }
    }
  }
  return parents
}

/** Reservation groups have an explicit heading and matching "All of above" closing row. */
function sourceReservationGroups(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  const headers = rows.first().parents("TABLE").find("THEAD TH")
  if (headers.length !== 5 || sourceText(headers.eq(0)) !== "State" || sourceText(headers.eq(1)) !== "Reservation") {
    return parents
  }
  for (let index = 0; index < nodes.length; index++) {
    const parent = nodes[index]
    invariant(parent, "passage_table_row_missing")
    const cells = $(parent).children("TD")
    const label = sourceText(cells.eq(1))
    if (
      cells.length !== 5 ||
      !/^[A-Za-z][A-Za-z ]+:$/.test(label) ||
      !cells
        .toArray()
        .every(
          (cell, column) =>
            Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 &&
            (column === 1 || cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
        )
    ) {
      continue
    }
    const members = [parent]
    for (let next = index + 1; next < nodes.length; next++) {
      const child = nodes[next]
      invariant(child, "passage_table_row_missing")
      const childCells = $(child).children("TD")
      if (
        childCells.length !== 5 ||
        !isDittoMarker(sourceText(childCells.first())) ||
        !childCells
          .toArray()
          .every(
            (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1 && sourceText($(cell)).length > 0
          )
      ) {
        break
      }
      members.push(child)
      if (sourceText(childCells.eq(1)) === `All of above ${label.slice(0, -1)}`) {
        for (const member of members) {
          parents.set(member, parent)
        }
        break
      }
    }
  }
  return parents
}

function sourceClassificationRows(rows: ReturnType<ReturnType<typeof load>>) {
  const nodes = rows.toArray()
  const $ = load("", { xml: true })
  const parents = new Map<(typeof nodes)[number], (typeof nodes)[number]>()
  const headers = rows.first().parents("TABLE").find("THEAD TR").first().children("TH")
  if (
    headers.length !== 3 ||
    sourceText(headers.eq(0)) !== "Designated area" ||
    sourceText(headers.eq(1)) !== "Designation" ||
    sourceText(headers.eq(2)) !== "Classification"
  ) {
    return parents
  }
  for (let index = 1; index < nodes.length; index++) {
    const parent = nodes[index - 1]
    const child = nodes[index]
    invariant(parent && child, "passage_table_row_missing")
    const before = $(parent).children("TD")
    const after = $(child).children("TD")
    if (
      before.length === 5 &&
      after.length === 5 &&
      before.toArray().every((cell) => sourceText($(cell)).length > 0) &&
      after
        .slice(0, 3)
        .toArray()
        .every((cell) => cell.children.every((node) => node.type === "text" && node.data.trim() === "")) &&
      after
        .slice(3)
        .toArray()
        .every((cell) => sourceText($(cell)).length > 0) &&
      [...before.toArray(), ...after.toArray()].every(
        (cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1
      )
    ) {
      parents.set(child, parent)
    }
  }
  return parents
}

function isPartialCountyScope(row: ReturnType<ReturnType<typeof load>>, hasDesignatedAreaHeader: boolean) {
  if (!hasDesignatedAreaHeader) {
    return false
  }
  const cells = row.children("TD")
  const next = row.next("TR").children("TD")
  return (
    cells.length >= 3 &&
    next.length === cells.length &&
    /^[A-Za-z][A-Za-z .'-]* County \(part\)$/.test(sourceText(cells.first())) &&
    sourceText(next.first()).length > 0 &&
    !sourceText(next.first()).endsWith("County (part)") &&
    cells.toArray().every((cell) => Number(cell.attribs.colspan ?? cell.attribs.COLSPAN ?? 1) === 1) &&
    cells
      .slice(1)
      .toArray()
      .every((cell) => cell.children.every((node) => node.type === "text" && node.data.trim() === ""))
  )
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
  const conditionParents = sourceConditionRows(rows)
  const exceptionParents = sourceCommodityExceptionRows(rows)
  const hasDesignatedAreaHeader = sourceText(tables.find("THEAD TH").first()) === "Designated area"
  const countyBoundaryParents = sourceCountyBoundaryRows(rows, hasDesignatedAreaHeader)
  const classificationParents = sourceClassificationRows(rows)
  const reservationGroups = sourceReservationGroups(rows)
  const chemicalGroups = sourceChemicalGroups(rows)
  const expenseGroups = sourceExpenseGroups(rows)
  const nameContinuations = sourceReviewedNameContinuations(rows)
  const approvalHeaders = tables.find("THEAD TH")
  const polymerHeaders = [
    "Olefin polymers",
    "Density",
    "Melting Point (MP) or softening point (SP) (Degrees Centigrade)—",
    "Maximum extractable fraction (expressed as percent by weight of the polymer) in N-hexane at specified temperatures",
    "Maximum soluble fraction (expressed as percent by weight of polymer) in xylene at specified temperatures"
  ]
  const hasPolymerHeaders =
    approvalHeaders.length === polymerHeaders.length &&
    polymerHeaders.every((value, index) => sourceText(approvalHeaders.eq(index)) === value)
  const ingredientHeaders = ["Class of substance", "Substance", "Purpose", "Products", "Amount"]
  const hasIngredientHeaders =
    approvalHeaders.length === ingredientHeaders.length &&
    ingredientHeaders.every((value, index) => sourceText(approvalHeaders.eq(index)) === value)
  const pesticideHeaders = [
    "Active ingredient",
    "Formulation",
    "Use pattern",
    "Classification 1",
    "Criteria influencing restriction"
  ]
  const hasPesticideHeaders =
    approvalHeaders.length === pesticideHeaders.length &&
    pesticideHeaders.every((value, index) => sourceText(approvalHeaders.eq(index)) === value)
  const incomeHeaders = [
    "Income",
    "Dependency (parents)",
    "Dependency and indemnity compensation (parents)",
    "Pension; old-law (veterans, surviving spouses and children)",
    "Pension; section 306 (veterans, surviving spouses and children)",
    "See—"
  ]
  const hasIncomeHeaders =
    approvalHeaders.length === incomeHeaders.length &&
    incomeHeaders.every((value, index) => sourceText(approvalHeaders.eq(index)) === value)
  const hasFrequencyHeaders =
    approvalHeaders.length === 4 &&
    sourceText(approvalHeaders.eq(0)) === "Frequency or band" &&
    sourceText(approvalHeaders.eq(1)) === "Class of station(s)" &&
    sourceText(approvalHeaders.eq(2)) === "Limitations" &&
    sourceText(approvalHeaders.eq(3)) === "Coordinator"
  const hasFlavoringHeaders =
    approvalHeaders.length === 3 &&
    sourceText(approvalHeaders.eq(0)) === "Common name" &&
    sourceText(approvalHeaders.eq(1)) === "Scientific name" &&
    sourceText(approvalHeaders.eq(2)) === "Limitations"
  const hasApprovalHeaders =
    approvalHeaders.length === 4 &&
    sourceText(approvalHeaders.eq(0)) === "Puerto Rico regulation" &&
    sourceText(approvalHeaders.eq(1)) === "Commonwealth effective date" &&
    sourceText(approvalHeaders.eq(2)) === "EPA approval date" &&
    sourceText(approvalHeaders.eq(3)) === "Comments"
  const headers = tables.find("BOXHD, THEAD")
  const order = $.root().find("*").toArray()
  type Context = { start: number; end: number; label: string }
  const ranges: { start: number; end: number; context: Context[] }[] = []
  const rangesByNode = new Map<Parameters<typeof conditionParents.get>[0], (typeof ranges)[number]>()
  let groups: { span: Context; level: number }[] = []
  let countyScope: Context | undefined
  const previousCells = new Map<number, Context>()
  let previousDataWidth = 0
  let position = 0
  for (const row of rows.toArray()) {
    const selection = $(row)
    const text = sourceText(selection)
    const isHeader = isTableHeader(selection)
    invariant(!isHeader || ranges.length === 0, "passage_table_interleaved_headers")
    if (text.length === 0) {
      invariant(isEmptySeparatorRow(selection), "passage_table_empty_row")
      // A visual divider cannot supply a group or ditto reference for a later row.
      groups = []
      countyScope = undefined
      previousCells.clear()
      previousDataWidth = 0
      continue
    }
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
      const isReservedApproval = isReservedApprovalRow(selection, hasApprovalHeaders)
      const isSparseLimitation = isSparseFlavoringLimitation(selection, hasFlavoringHeaders)
      const isSparseStation = isSparseStationClass(selection, hasFrequencyHeaders)
      const isChildIncome = isChildIncomeRow(selection, hasIncomeHeaders)
      const isSparsePesticide = isSparsePesticideCriteria(selection, hasPesticideHeaders)
      const sparseIngredient = sparseIngredientColumns(selection, hasIngredientHeaders)
      const isSparsePolymer = isSparsePolymerSolubility(selection, hasPolymerHeaders)
      const isGroup =
        cells.length === 1 && Number(cells.first().attr("colspan") ?? cells.first().attr("COLSPAN") ?? 1) > 1
      const categoryLevel = sourceCategoryLevel(selection)
      const context: Context[] = []
      const inheritedCountyScope = countyScope
      countyScope = undefined
      if (reservationGroups.get(row) === row || chemicalGroups.get(row) === row || expenseGroups.get(row) === row) {
        context.push(...groups.map((entry) => entry.span))
        if (cells.length !== previousDataWidth) {
          previousCells.clear()
          previousDataWidth = 0
        }
      } else if (isPartialCountyScope(selection, hasDesignatedAreaHeader)) {
        context.push(...groups.map((entry) => entry.span))
        countyScope = { start, end: start + text.length, label: "Source partial county scope" }
        if (cells.length !== previousDataWidth) {
          previousCells.clear()
          previousDataWidth = 0
        }
      } else if (isGroup || categoryLevel !== null) {
        groups = isGroup ? [] : groups.filter((entry) => entry.level < (categoryLevel ?? -1))
        context.push(...groups.map((entry) => entry.span))
        groups.push({
          span: { start, end: start + text.length, label: "Source row group" },
          level: isGroup ? -1 : (categoryLevel ?? -1)
        })
        // An explicit full-width label supplies no column values. A following ditto can cite the
        // earlier value in the same table, while retaining the new group label as separate context.
        // Partial groups and blank separators remain boundaries; never guess a missing column.
        if (
          (categoryLevel !== null
            ? cells.length
            : Number(cells.first().attr("colspan") ?? cells.first().attr("COLSPAN"))) !== previousDataWidth
        ) {
          previousCells.clear()
          previousDataWidth = 0
        }
      } else {
        groups = groups.filter((entry) => entry.level < rowIndent(selection))
        context.push(...groups.map((entry) => entry.span))
        if (inheritedCountyScope) {
          context.push(inheritedCountyScope)
        }
        const parentNode =
          conditionParents.get(row) ??
          exceptionParents.get(row) ??
          countyBoundaryParents.get(row) ??
          classificationParents.get(row) ??
          reservationGroups.get(row) ??
          chemicalGroups.get(row) ??
          expenseGroups.get(row) ??
          nameContinuations.get(row)
        const parentRange = parentNode === undefined ? undefined : rangesByNode.get(parentNode)
        if (parentRange) {
          context.push(...parentRange.context, {
            start: parentRange.start,
            end: parentRange.end,
            label: "Source continuation parent"
          })
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
          if (isDittoMarker(value)) {
            const reference = previousCells.get(column)
            invariant(width === 1 && reference, "passage_table_unresolved_ditto")
            context.push(reference)
          } else {
            const classification = previousCells.get(4)
            const preservesPesticideCriteria =
              isSparsePesticide &&
              column === 5 &&
              classification &&
              input.text.slice(classification.start, classification.end) === "Unclassified"
            if (
              (((isReservedApproval || isSparseLimitation) && column === 3) ||
                (isSparseStation && column === 2) ||
                (isChildIncome && (column === 2 || column === 3)) ||
                preservesPesticideCriteria ||
                sparseIngredient.includes(column) ||
                (isSparsePolymer && column === 5)) &&
              value.length === 0 &&
              width === 1
            ) {
              column += width
              continue
            }
            const hasParentBlank =
              ((conditionParents.has(row) || countyBoundaryParents.has(row) || nameContinuations.has(row)) &&
                column > 1) ||
              (exceptionParents.has(row) && column < 3) ||
              (classificationParents.has(row) && column <= 3)
            if (parentRange && hasParentBlank && value.length === 0 && width === 1) {
              column += width
              continue
            }
            for (let index = column; index < column + width; index++) {
              previousCells.delete(index)
            }
            if (value && width === 1) {
              previousCells.set(column, {
                start:
                  parentRange &&
                  ((classificationParents.has(row) && column === 5) || (nameContinuations.has(row) && column === 1))
                    ? parentRange.start
                    : start + offset,
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
        previousDataWidth = column - 1
      }
      ranges.push({ start, end: start + text.length, context })
      const range = ranges.at(-1)
      invariant(range, "passage_table_row_missing")
      rangesByNode.set(row, range)
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
    const text = sourceText(row)
    if (text.length === 0) {
      invariant(isEmptySeparatorRow(row), "passage_table_empty_row")
      group = undefined
      continue
    }
    if (isTableHeader(row)) {
      continue
    }
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
    let resolvedRow: ReturnType<typeof legalTableRows>["rows"][number] | undefined
    const spans = cells.toArray().map((cell, index) => {
      const selection = $(cell)
      invariant(
        Number(selection.attr("colspan") ?? selection.attr("COLSPAN") ?? 1) === 1,
        "passage_table_continuation_spanning_cells"
      )
      const value = sourceText(selection)
      if (isDittoMarker(value)) {
        // Cell offsets alone cannot authorize a reference. Reuse the full table's source
        // validation; passage continuations carry this same row context on every piece.
        resolvedRow ??= legalTableRows(input).rows.find((candidate) => candidate.start === rowStart)
        invariant(
          resolvedRow?.context.some(
            (span) => span.label === `Column ${index + 1} ditto source` && span.end <= rowStart
          ),
          "passage_table_continuation_ditto_reference"
        )
      }
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
