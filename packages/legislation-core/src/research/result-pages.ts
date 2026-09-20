import { createHash } from "node:crypto"
import { z } from "zod"
import { LegislationError } from "../domain/errors"
import type { RecordCollectionInput } from "./record-contracts"

type JSONValue = z.infer<ReturnType<typeof z.json>>
export type ResultPageMeasurement = (data: JSONValue) => number

export const researchResultByteLimit = 180000
const prefix = "research-page:"
const scopedPrefix = "research-cursor:"
const cursorSchema = z.object({
  binding: z.string(),
  offset: z.number().int().min(1).max(1000000),
  upstream: z.string().optional(),
  snapshot: z.string().optional()
})

function binding(name: string, input: Readonly<Record<string, unknown>>) {
  const selection = Object.entries(input)
    .filter(([key, value]) => key !== "cursor" && key !== "childCursor" && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return createHash("sha256")
    .update(JSON.stringify([name, selection]))
    .digest("base64url")
}

export function readResultPage(name: string, input: Readonly<Record<string, unknown>>) {
  const unwrapped = { ...input }
  for (const key of ["cursor", "childCursor"] as const) {
    const supplied = input[key]
    if (typeof supplied !== "string") continue
    if (!supplied.startsWith(scopedPrefix)) {
      throw new LegislationError("invalid_request", "Use the continuation returned by this tool with unchanged inputs.")
    }
    try {
      const scope = z
        .strictObject({
          binding: z.string(),
          upstream: z.string().min(1).max(16384),
          field: z.enum(["cursor", "childCursor"])
        })
        .parse(JSON.parse(Buffer.from(supplied.slice(scopedPrefix.length), "base64url").toString()))
      if (scope.binding !== binding(name, input) || scope.field !== key) throw new Error("Selection mismatch")
      unwrapped[key] = scope.upstream
    } catch {
      throw new LegislationError("invalid_request", "The continuation does not match this tool, collection or filters.")
    }
  }
  return readContentPage(name, unwrapped)
}

function readContentPage(name: string, input: Readonly<Record<string, unknown>>) {
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

function resultPageFits(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  measureResult?: ResultPageMeasurement
) {
  const page = wrapResultCursors(name, input, value)
  return (
    Buffer.byteLength(JSON.stringify({ data: page }), "utf8") <= researchResultByteLimit &&
    (measureResult === undefined || measureResult(page) <= researchResultByteLimit)
  )
}

function selectResultPage(
  offset: number,
  length: number,
  candidate: (end: number) => JSONValue,
  fits: (page: JSONValue) => boolean,
  message: string,
  minimum = 1
) {
  // Halve only the in-memory page, not the query. Omitted units remain behind the continuation.
  for (let end = length; end >= offset + minimum; end = offset + Math.max(minimum, Math.floor((end - offset) / 2))) {
    const page = candidate(end)
    if (fits(page)) return page
    if (end === offset + minimum) break
  }
  throw new LegislationError("payload_too_large", message, { details: { retryable: false } })
}

function detailPreview(name: string, data: { [key: string]: JSONValue }) {
  const roots: Record<string, string> = {
    get_person: "person",
    get_organization: "organization",
    get_event: "event",
    get_supporting_material: "material"
  }
  const rootKey = roots[name]
  const identity = rootKey ? data[rootKey] : undefined
  if (!isRecord(identity) || typeof identity.id !== "string") return undefined
  const id = identity.id
  const collection = (collection: RecordCollectionInput["collection"]) => ({
    tool: "read_record_collection",
    input: { collection, recordId: id }
  })
  const continuations: Record<string, JSONValue> =
    name === "get_person"
      ? {
          terms: collection("person-terms"),
          memberships: { tool: "get_memberships", input: { personId: id } },
          sponsoredBills: { tool: "get_sponsored_bills", input: { id } }
        }
      : name === "get_organization"
        ? {
            children: collection("organization-children"),
            memberships: { tool: "get_memberships", input: { organizationId: id } },
            billActivity: { tool: "get_committee_bills", input: { id } }
          }
        : name === "get_event"
          ? {
              agendaItems: collection("meeting-agenda"),
              documents: collection("meeting-documents"),
              outcomes: collection("meeting-outcomes"),
              participants: collection("meeting-participants"),
              relatedBills: collection("meeting-bills")
            }
          : { links: collection("material-links") }
  const collections = Object.keys(continuations)
  const length = Math.max(
    0,
    ...collections.map((key) => {
      const page = data[key]
      return Array.isArray(page) ? page.length : isRecord(page) && Array.isArray(page.items) ? page.items.length : 0
    })
  )
  const candidate = (limit: number): { [key: string]: JSONValue } => {
    const preview = { ...data }
    let truncated = data.truncated === true
    for (const key of collections) {
      const page = data[key]
      if (Array.isArray(page)) {
        const flag = `${key}Truncated`
        preview[key] = page.slice(0, limit)
        preview[flag] =
          data[flag] === true || (data[flag] === undefined && data.truncated === true) || page.length > limit
        truncated ||= preview[flag] === true
      } else if (isRecord(page) && Array.isArray(page.items)) {
        const { nextCursor: _nextCursor, ...metadata } = page
        const partial = page.truncated === true || typeof page.nextCursor === "string" || page.items.length > limit
        preview[key] = { ...metadata, items: page.items.slice(0, limit), truncated: partial }
        truncated ||= partial
      }
    }
    preview.truncated = truncated
    // These are fresh collection reads, not offsets into the shortened previews.
    preview.continuations = {
      ...(isRecord(data.continuations) ? data.continuations : {}),
      ...continuations
    }
    return preview
  }
  return { length, candidate }
}

function prepareVotePage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  data: JSONValue,
  offset: number,
  expectedSnapshot?: string,
  measureResult?: ResultPageMeasurement
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
  function fits(value: JSONValue) {
    return resultPageFits(name, input, value, measureResult)
  }
  if (offset === 0 && fits(data)) return data
  const units = records.flatMap((record, recordIndex) => {
    const detail = name === "get_votes" && isRecord(record) ? record.data : record
    if (isRecord(detail) && Array.isArray(detail.positions) && detail.positions.length > 0) {
      return detail.positions.map((_, positionIndex) => ({ recordIndex, positionIndex }))
    }
    return [{ recordIndex, positionIndex: -1 }]
  })
  if (offset > 0 && offset >= units.length)
    throw new LegislationError("invalid_request", "The vote page changed. Start the request again.")
  const candidate = (end: number): JSONValue => {
    const pageRecords: JSONValue[] = []
    let lastRecordIndex = -1
    let pageDetail: { [key: string]: JSONValue } | undefined
    let pagePositions: JSONValue[] = []
    let positionStart = 0
    for (let index = offset; index < end; index++) {
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
        pageDetail.positionsTruncated =
          upstreamPartial || positionStart + pagePositions.length < detail.positions.length
      }
    }
    const hasRemaining = end < units.length
    const nextCursor = hasRemaining
      ? `${prefix}${Buffer.from(JSON.stringify({ binding: binding(name, input), offset: end, upstream: input.cursor, snapshot })).toString("base64url")}`
      : data.nextCursor
    const positionsIncomplete = pageRecords.some((record) => {
      const detail = name === "get_votes" && isRecord(record) ? record.data : record
      return isRecord(detail) && detail.positionsTruncated === true
    })
    return name === "get_vote" && isRecord(pageRecords[0])
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
  }
  return selectResultPage(
    offset,
    units.length,
    candidate,
    fits,
    "One vote position or its attribution exceeds the response budget."
  )
}

function prepareContentPage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  offset: number,
  snapshot?: string,
  measureResult?: ResultPageMeasurement
): JSONValue {
  if (["get_bill_votes", "get_vote", "get_votes"].includes(name)) {
    return prepareVotePage(name, input, value, offset, snapshot, measureResult)
  }
  const data = projectDiscoveryRecord(value, name !== "get_bill_text")
  const collection =
    name === "get_bill_text" || name === "get_supporting_material"
      ? "sections"
      : name === "get_bill_timeline"
        ? "events"
        : "items"
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data
  }
  const preview = detailPreview(name, data)
  function fits(value: JSONValue) {
    return resultPageFits(name, input, value, measureResult)
  }
  const records = data[collection]
  if (!Array.isArray(records)) {
    return preview
      ? selectResultPage(
          0,
          preview.length,
          preview.candidate,
          fits,
          "The record identity or its context exceeds the response budget. Read its relationships with the collection tools instead.",
          0
        )
      : data
  }
  if (offset > 0 && offset >= records.length) {
    throw new LegislationError("invalid_request", "The result page changed. Start the search again.")
  }
  const complete = preview ? preview.candidate(preview.length) : data
  if (offset === 0 && fits(complete)) {
    return complete
  }
  const candidate = (count: number) => {
    // Detail previews may be omitted, but a section page must make forward progress.
    const end = offset + Math.max(1, count)
    const hasRemaining = end < records.length
    const cursor = `${prefix}${Buffer.from(
      JSON.stringify({
        binding: binding(name, input),
        offset: end,
        upstream: input.cursor
      })
    ).toString("base64url")}`
    return {
      ...(preview ? preview.candidate(count) : data),
      [collection]: records.slice(offset, end),
      ...(hasRemaining ? { nextCursor: cursor, truncated: true } : {})
    }
  }
  return selectResultPage(
    0,
    Math.max(records.length - offset, preview?.length ?? 0),
    candidate,
    fits,
    "One result or its attribution exceeds the response budget. Read selected source passages instead.",
    preview ? 0 : 1
  )
}

export function prepareResultPage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  offset: number,
  snapshot?: string,
  measureResult?: ResultPageMeasurement
): JSONValue {
  const page = prepareContentPage(name, input, value, offset, snapshot, measureResult)
  return wrapResultCursors(name, input, page)
}

function wrapResultCursors(name: string, input: Readonly<Record<string, unknown>>, value: JSONValue): JSONValue {
  function wrap(value: JSONValue): JSONValue {
    if (Array.isArray(value)) return value.map(wrap)
    if (value === null || typeof value !== "object") return value
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if ((key === "nextCursor" || key === "nextChildCursor") && typeof item === "string") {
          return [
            key,
            `${scopedPrefix}${Buffer.from(JSON.stringify({ binding: binding(name, input), upstream: item, field: key === "nextCursor" ? "cursor" : "childCursor" })).toString("base64url")}`
          ]
        }
        return [key, wrap(item)]
      })
    )
  }
  return wrap(value)
}
