import { createHash } from "node:crypto"
import { z } from "zod"
import { LegislationError } from "../domain/errors"

type JSONValue = z.infer<ReturnType<typeof z.json>>

export const researchResultByteLimit = 180000
const prefix = "research-page:"
const cursorSchema = z.object({
  binding: z.string(),
  offset: z.number().int().min(1).max(1000000),
  upstream: z.string().optional(),
  snapshot: z.string().optional()
})

function binding(name: string, input: Readonly<Record<string, unknown>>) {
  const selection = Object.entries(input)
    .filter(([key, value]) => key !== "cursor" && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return createHash("sha256")
    .update(JSON.stringify([name, selection]))
    .digest("base64url")
}

export function readResultPage(name: string, input: Readonly<Record<string, unknown>>) {
  const cursor = input.cursor
  if (typeof cursor !== "string" || !cursor.startsWith(prefix)) {
    return { input, offset: 0 }
  }
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor.slice(prefix.length), "base64url").toString()))
    if (parsed.binding !== binding(name, input)) {
      throw new Error("Selection mismatch")
    }
    return { input: { ...input, cursor: parsed.upstream }, offset: parsed.offset, snapshot: parsed.snapshot }
  } catch {
    throw new LegislationError("invalid_request", "Invalid result cursor. Keep the original tool inputs and limits.")
  }
}

export function projectDiscoveryRecord(value: JSONValue, omitSummary = true): JSONValue {
  if (Array.isArray(value)) {
    return value.map((item) => projectDiscoveryRecord(item, omitSummary))
  }
  if (value === null || typeof value !== "object") {
    return value
  }
  const isBill = typeof value.id === "string" && value.id.startsWith("bill:")
  const isDocument = typeof value.billId === "string" && "processingStatus" in value && "sourceUrl" in value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !(omitSummary && isBill && key === "summary") && !(isDocument && key === "text"))
      .map(([key, item]) => [key, projectDiscoveryRecord(item, omitSummary)])
  )
}

function isRecord(value: JSONValue | undefined): value is { [key: string]: JSONValue } {
  return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value)
}

function prepareVotePage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  data: JSONValue,
  offset: number,
  expectedSnapshot?: string
): JSONValue {
  if (!isRecord(data)) return data
  const records = name === "get_vote" ? [data] : data.items
  if (!Array.isArray(records)) return data
  const snapshot = createHash("sha256").update(JSON.stringify(data)).digest("base64url")
  if (
    (offset > 0 && expectedSnapshot === undefined) ||
    (expectedSnapshot !== undefined && expectedSnapshot !== snapshot)
  ) {
    throw new LegislationError("invalid_request", "The vote results changed. Start the request again.")
  }
  if (offset === 0 && Buffer.byteLength(JSON.stringify({ data }), "utf8") <= researchResultByteLimit) return data
  const units = records.flatMap((record, recordIndex) => {
    const detail = name === "get_votes" && isRecord(record) ? record.data : record
    if (isRecord(detail) && Array.isArray(detail.positions) && detail.positions.length > 0) {
      return detail.positions.map((_, positionIndex) => ({ recordIndex, positionIndex }))
    }
    return [{ recordIndex, positionIndex: -1 }]
  })
  if (offset >= units.length)
    throw new LegislationError("invalid_request", "The vote page changed. Start the request again.")
  const pageRecords: JSONValue[] = []
  let selected: JSONValue | undefined
  let lastRecordIndex = -1
  let pageDetail: { [key: string]: JSONValue } | undefined
  let pagePositions: JSONValue[] = []
  let positionStart = 0
  for (let index = offset; index < units.length; index++) {
    const unit = units[index]
    if (!unit) break
    const record = records[unit.recordIndex]
    if (record === undefined) break
    const detail = name === "get_votes" && isRecord(record) ? record.data : record
    if (unit.recordIndex !== lastRecordIndex) {
      lastRecordIndex = unit.recordIndex
      pageDetail = undefined
      if (unit.positionIndex >= 0 && isRecord(detail)) {
        pagePositions = []
        positionStart = unit.positionIndex
        pageDetail = { ...detail, positions: pagePositions, positionOffset: positionStart, positionsTruncated: true }
        pageRecords.push(name === "get_votes" && isRecord(record) ? { ...record, data: pageDetail } : pageDetail)
      } else {
        pageRecords.push(record)
      }
    }
    if (pageDetail && isRecord(detail) && Array.isArray(detail.positions)) {
      const position = detail.positions[unit.positionIndex]
      if (position !== undefined) pagePositions.push(position)
      const upstreamPartial = isRecord(detail.positionsPageInfo) && detail.positionsPageInfo.truncated === true
      pageDetail.positionsTruncated = upstreamPartial || positionStart + pagePositions.length < detail.positions.length
    }
    const hasRemaining = index + 1 < units.length
    const nextCursor = hasRemaining
      ? `${prefix}${Buffer.from(JSON.stringify({ binding: binding(name, input), offset: index + 1, upstream: input.cursor, snapshot })).toString("base64url")}`
      : data.nextCursor
    const positionsIncomplete = pageRecords.some((record) => {
      const detail = name === "get_votes" && isRecord(record) ? record.data : record
      return isRecord(detail) && detail.positionsTruncated === true
    })
    const candidate =
      name === "get_vote" && isRecord(pageRecords[0])
        ? {
            ...pageRecords[0],
            ...(nextCursor !== undefined ? { nextCursor } : {}),
            truncated: hasRemaining || positionsIncomplete || data.truncated === true
          }
        : {
            ...data,
            items: pageRecords,
            ...(nextCursor !== undefined ? { nextCursor } : {}),
            truncated: hasRemaining || positionsIncomplete || data.truncated === true
          }
    if (Buffer.byteLength(JSON.stringify({ data: candidate }), "utf8") > researchResultByteLimit) break
    selected = structuredClone(candidate)
  }
  if (selected === undefined) {
    throw new LegislationError("payload_too_large", "One vote position exceeds the response budget.")
  }
  return selected
}

export function prepareResultPage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  offset: number,
  snapshot?: string
): JSONValue {
  if (["get_bill_votes", "get_vote", "get_votes"].includes(name)) {
    return prepareVotePage(name, input, value, offset, snapshot)
  }
  let data = value
  if (["search_bills", "get_bill", "get_bills"].includes(name)) {
    data = projectDiscoveryRecord(value)
  } else if (name === "get_bill_text") {
    data = projectDiscoveryRecord(value, false)
  }
  if (!["search_bills", "get_bills", "search_bill_text", "get_bill_text"].includes(name)) {
    return data
  }
  const collection = name === "get_bill_text" ? "sections" : "items"
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data
  }
  const records = data[collection]
  if (!Array.isArray(records)) {
    return data
  }
  if (offset > 0 && offset >= records.length) {
    throw new LegislationError("invalid_request", "The result page changed. Start the search again.")
  }
  if (offset === 0 && Buffer.byteLength(JSON.stringify({ data }), "utf8") <= researchResultByteLimit) {
    return data
  }
  let selected: JSONValue | undefined
  for (let end = offset + 1; end <= records.length; end++) {
    const hasRemaining = end < records.length
    const cursor = `${prefix}${Buffer.from(
      JSON.stringify({
        binding: binding(name, input),
        offset: end,
        upstream: input.cursor
      })
    ).toString("base64url")}`
    const candidate = {
      ...data,
      [collection]: records.slice(offset, end),
      ...(hasRemaining ? { nextCursor: cursor, truncated: true } : {})
    }
    if (Buffer.byteLength(JSON.stringify({ data: candidate }), "utf8") > researchResultByteLimit) {
      break
    }
    selected = candidate
  }
  if (selected === undefined) {
    throw new LegislationError(
      "payload_too_large",
      "One result exceeds the response budget. Read selected source passages instead."
    )
  }
  return selected
}
