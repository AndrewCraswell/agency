import { digest } from "@repo/legislation-core/legal-text/contracts"
import { buildLegalTextProjection, storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import { load } from "cheerio"
import { XMLValidator } from "fast-xml-parser"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalTableLayout, legalTableRows } from "./table-passages.js"

export const legalPassageShapeContract = "legal-passage-shapes-2026-09-15"

function sourceFailure(error: unknown) {
  if (error instanceof z.ZodError) {
    return "invalid_source_blocks"
  }
  const code =
    error instanceof Error
      ? /(?:Invariant failed: )?((?:legal_reader_|legal_passage_|passage_table_|passage_shape_)[a-z_]+)$/.exec(
          error.message
        )?.[1]
      : undefined
  // Programming and infrastructure errors stop the scan rather than becoming false source dispositions.
  invariant(code !== undefined, "unexpected_passage_shape_failure")
  return code
}

function tableShape(block: { ordinal: number; tag: string; text: string; xml: string }) {
  const basic = {
    ordinal: block.ordinal,
    tag: block.tag,
    blockHash: digest(block.xml),
    characters: block.text.length,
    xmlBytes: Buffer.byteLength(block.xml)
  }
  try {
    invariant(basic.xmlBytes <= 32 * 1024 * 1024, "passage_shape_xml_limit")
    invariant(!/<!DOCTYPE|<!ENTITY/i.test(block.xml), "passage_shape_xml_declaration")
    invariant(XMLValidator.validate(block.xml) === true, "passage_shape_xml_invalid")
    const $ = load(block.xml, { xml: true })
    const tables = $("GPOTABLE,TABLE")
    const cells = tables.find("ENT,TD,TH")
    let maximumRawCellCharacters = 0
    let maximumRawFirstCellCharacters = 0
    for (const cell of cells.toArray()) {
      maximumRawCellCharacters = Math.max(maximumRawCellCharacters, $(cell).text().length)
    }
    for (const row of tables.find("ROW,TR").toArray()) {
      maximumRawFirstCellCharacters = Math.max(
        maximumRawFirstCellCharacters,
        $(row).children("ENT,TD,TH").first().text().length
      )
    }
    let layoutFailure: string | null = null
    let layouts = 0
    let dataRows = 0
    try {
      for (const layout of legalTableLayout(block)) {
        dataRows += legalTableRows(layout).rows.length
        layouts++
      }
    } catch (error) {
      layoutFailure = sourceFailure(error)
    }
    return {
      ...basic,
      status: "classified" as const,
      tables: tables.length,
      nestedTables: tables.filter((_index, element) => $(element).parents("GPOTABLE,TABLE").length > 0).length,
      rows: tables.find("ROW,TR").length,
      cells: cells.length,
      headerGroups: tables.find("BOXHD,THEAD").length,
      rowSpanAttributes: tables.find("[rowspan],[ROWSPAN],[MOREROWS],[morerows]").length,
      columnSpanAttributes: tables.find(
        "[colspan],[COLSPAN],[SPANNAME],[spanname],[NAMEST],[NAMEEND],[namest],[nameend]"
      ).length,
      graphics: tables.find("GPH,GRAPHIC,IMG,IMAGE,graphic,img,image").length,
      maximumRawCellCharacters,
      maximumRawFirstCellCharacters,
      layouts,
      dataRows,
      layoutFailure
    }
  } catch (error) {
    return { ...basic, status: "invalid_source" as const, reason: sourceFailure(error) }
  }
}

/** Structural inventory only. Passing this check does not establish tokenizer or embedding eligibility. */
export function inspectLegalPassageShape(input: {
  versionId: string
  body: string
  blocks: unknown
  inputContract: string
  nodeKind: string
}) {
  const basic = {
    contract: legalPassageShapeContract,
    versionId: input.versionId,
    nodeKind: input.nodeKind,
    bodyCharacters: input.body.length,
    bodyBytes: Buffer.byteLength(input.body)
  }
  try {
    const blocks = storedLegalSourceBlocks(input)
    const projection = buildLegalTextProjection({ ...input, blocks })
    invariant(
      projection.blocks.map((block) => block.text).join("") === input.body,
      "passage_shape_reconstruction_mismatch"
    )
    const tables = blocks.filter((block) => block.kind === "table").map(tableShape)
    return {
      ...basic,
      status: "classified" as const,
      bodyHash: projection.bodyHash,
      blockGeneration: projection.blockGeneration,
      isEmpty: input.body.length === 0,
      sourceBlocks: blocks.length,
      readerBlocks: projection.blocks.length,
      isAppendix: /appendix/i.test(input.nodeKind) || blocks.some((block) => /appendix/i.test(block.tag)),
      footnoteBlocks: blocks.filter((block) => block.kind === "footnote").length,
      tableBlocks: tables,
      blockedTableBlocks: tables.filter((table) => table.status !== "classified" || table.layoutFailure !== null)
        .length,
      readerReconstructsExactly: true as const,
      preparationEligibility: "not_evaluated" as const
    }
  } catch (error) {
    return {
      ...basic,
      status: "invalid_source" as const,
      reason: sourceFailure(error),
      preparationEligibility: "not_evaluated" as const
    }
  }
}
