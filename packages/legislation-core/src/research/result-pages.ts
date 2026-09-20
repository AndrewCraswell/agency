import { createHash } from "node:crypto"
import { z } from "zod"
import { LegislationError } from "../domain/errors"
import type { RecordCollectionInput } from "./record-contracts"

type JSONValue = z.infer<ReturnType<typeof z.json>>
export type ResultPageMeasurement = (data: JSONValue) => number

export const researchResultByteLimit = 180000
export const researchResultFragmentSchema = z.object({
  partialResult: z.strictObject({
    sourceTool: z.string(),
    snapshot: z.string(),
    format: z.literal("json"),
    offsetUnit: z.literal("utf16"),
    text: z.string().min(1),
    textOffset: z.number().int().nonnegative(),
    nextTextOffset: z.number().int().positive().nullable(),
    totalCharacters: z.number().int().positive()
  }),
  nextCursor: z.string().nullable()
})
const prefix = "research-page:"
const scopedPrefix = "research-cursor:"
const fragmentSchema = z.strictObject({
  format: z.enum(["section-text", "json"]),
  textOffset: z.number().int().nonnegative(),
  correlationId: z.string().min(1).max(256).optional()
})
type ResultFragment = z.infer<typeof fragmentSchema>
const cursorSchema = z.object({
  binding: z.string(),
  offset: z.number().int().min(0).max(1000000),
  upstream: z.string().optional(),
  snapshot: z.string().optional(),
  fragment: fragmentSchema.optional()
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
    if (parsed.binding !== binding(name, input) || (parsed.offset === 0 && !parsed.fragment)) {
      throw new Error("Selection mismatch")
    }
    return {
      input: { ...input, cursor: parsed.upstream },
      offset: parsed.offset,
      snapshot: parsed.snapshot,
      fragment: parsed.fragment
    }
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
  partial: (page: JSONValue) => JSONValue,
  minimum = 1
) {
  // Halve only the in-memory page, not the query. Omitted units remain behind the continuation.
  for (let end = length; end >= offset + minimum; end = offset + Math.max(minimum, Math.floor((end - offset) / 2))) {
    const page = candidate(end)
    if (fits(page)) return page
    if (end === offset + minimum) break
  }
  return partial(candidate(Math.min(length, offset + minimum)))
}

function resultSnapshot(value: JSONValue) {
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url")
}

function apiCorrelationId(value: JSONValue): string | undefined {
  return isRecord(value) &&
    "data" in value &&
    "links" in value &&
    isRecord(value.meta) &&
    typeof value.meta.correlationId === "string"
    ? value.meta.correlationId
    : undefined
}

function preparePartialResult(
  name: string,
  input: Readonly<Record<string, unknown>>,
  data: JSONValue,
  offset: number,
  snapshot: string,
  measureResult?: ResultPageMeasurement,
  fragment?: ResultFragment
): JSONValue {
  const nextCursor = isRecord(data) ? (data.nextCursor ?? null) : null
  const correlationId = apiCorrelationId(data)
  const cursor = (format: ResultFragment["format"], textOffset: number) =>
    `${prefix}${Buffer.from(
      JSON.stringify({
        binding: binding(name, input),
        offset,
        upstream: input.cursor,
        snapshot,
        fragment: { format, textOffset, ...(correlationId === undefined ? {} : { correlationId }) }
      })
    ).toString("base64url")}`
  const fits = (page: JSONValue) => resultPageFits(name, input, page, measureResult)
  const collection = isRecord(data) && Array.isArray(data.sections) ? "sections" : "items"
  const records = isRecord(data) ? data[collection] : undefined
  const record = Array.isArray(records) && records.length === 1 ? records[0] : undefined
  const isSection =
    collection === "sections" ||
    name === "get_document_sections" ||
    (name === "read_record_collection" &&
      (input.collection === "document-sections" || input.collection === "material-sections"))
  if (
    fragment?.format !== "json" &&
    isSection &&
    isRecord(data) &&
    isRecord(record) &&
    typeof record.text === "string"
  ) {
    // Collection-reader offsets count Unicode characters, like PostgreSQL substring, not UTF-16 units.
    const characters = Array.from(record.text)
    const start = fragment?.textOffset ?? 0
    const base = typeof record.textOffset === "number" ? record.textOffset : 0
    if (start >= characters.length && fragment) {
      throw new LegislationError("invalid_request", "The section continuation is outside this text window.")
    }
    for (let length = Math.min(10000, characters.length - start); length > 0; length = Math.floor(length / 2)) {
      const end = start + length
      const hasRemaining = end < characters.length
      const page = {
        ...data,
        [collection]: [
          {
            ...record,
            text: characters.slice(start, end).join(""),
            textOffset: base + start,
            totalCharacters: record.totalCharacters ?? base + characters.length,
            nextTextOffset: hasRemaining ? base + end : (record.nextTextOffset ?? null),
            textTruncated: hasRemaining || record.textTruncated === true || typeof record.nextTextOffset === "number"
          }
        ],
        partial: true,
        truncated: true,
        nextCursor: hasRemaining ? cursor("section-text", end) : nextCursor
      }
      if (fits(page)) return page
    }
  }
  // Indivisible metadata/provenance is still evidence. Encode the whole minimum page, including its
  // original identities and scoped continuations, rather than silently deleting or clipping any field.
  const text = JSON.stringify(wrapResultCursors(name, input, data))
  const contentSnapshot = createHash("sha256").update(text).digest("base64url")
  const continuations: { end: number; value: { [key: string]: JSONValue } }[] = []
  const seen = new Set<string>()
  function retainContinuations(value: JSONValue) {
    if (Array.isArray(value)) {
      value.forEach(retainContinuations)
    } else if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        if ((key === "nextCursor" || key === "nextChildCursor") && typeof item === "string") {
          const encoded = JSON.stringify(scopedCursor(name, input, key, item))
          if (!seen.has(encoded)) {
            seen.add(encoded)
            continuations.push({ end: text.indexOf(encoded) + encoded.length, value: { [key]: item } })
          }
        } else {
          retainContinuations(item)
        }
      }
    }
  }
  retainContinuations(data)
  const start = fragment?.format === "json" ? fragment.textOffset : 0
  if (start >= text.length) {
    throw new LegislationError("invalid_request", "The result continuation is outside this content.")
  }
  for (let length = Math.min(10000, text.length - start); length > 0; length = Math.floor(length / 2)) {
    let end = start + length
    if (/[\uD800-\uDBFF]/.test(text[end - 1] ?? "") && /[\uDC00-\uDFFF]/.test(text[end] ?? "")) end++
    const hasRemaining = end < text.length
    const page = {
      partial: true,
      truncated: true,
      partialResult: {
        sourceTool: name,
        snapshot: contentSnapshot,
        format: "json",
        offsetUnit: "utf16",
        text: text.slice(start, end),
        textOffset: start,
        nextTextOffset: hasRemaining ? end : null,
        totalCharacters: text.length
      },
      // Expose tokens as data too, so selection guards can register even nested continuations without
      // interpreting incomplete JSON. The complete reconstructed page retains their original paths.
      continuations: continuations.filter((item) => item.end > start && item.end <= end).map((item) => item.value),
      nextCursor: hasRemaining ? cursor("json", end) : nextCursor
    }
    if (fits(page)) return page
  }
  throw new LegislationError("payload_too_large", "The response envelope exceeds the budget even without evidence.", {
    details: { retryable: false }
  })
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
  measureResult?: ResultPageMeasurement,
  fragment?: ResultFragment
): JSONValue {
  const snapshot = resultSnapshot(data)
  if (
    (offset > 0 && expectedSnapshot === undefined) ||
    (expectedSnapshot !== undefined && expectedSnapshot !== snapshot)
  ) {
    throw new LegislationError("invalid_request", "The vote results changed. Start the request again.")
  }
  function fits(value: JSONValue) {
    return resultPageFits(name, input, value, measureResult)
  }
  const partial = (page: JSONValue) =>
    preparePartialResult(name, input, page, offset, snapshot, measureResult, fragment)
  if (!isRecord(data)) return !fragment && fits(data) ? data : partial(data)
  const records = name === "get_vote" ? [data] : data.items
  if (!Array.isArray(records)) return !fragment && fits(data) ? data : partial(data)
  if (!fragment && offset === 0 && fits(data)) return data
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
  if (fragment) return partial(candidate(Math.min(units.length, offset + 1)))
  return selectResultPage(offset, units.length, candidate, fits, partial)
}

function prepareContentPage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  offset: number,
  snapshot?: string,
  measureResult?: ResultPageMeasurement,
  fragment?: ResultFragment
): JSONValue {
  if (["get_bill_votes", "get_vote", "get_votes"].includes(name)) {
    return prepareVotePage(name, input, value, offset, snapshot, measureResult, fragment)
  }
  const data = projectDiscoveryRecord(value, name !== "get_bill_text")
  const collection =
    name === "get_bill_text" || name === "get_supporting_material"
      ? "sections"
      : name === "get_bill_timeline"
        ? "events"
        : "items"
  function fits(value: JSONValue) {
    return resultPageFits(name, input, value, measureResult)
  }
  const partial = (page: JSONValue) =>
    preparePartialResult(name, input, page, offset, resultSnapshot(value), measureResult, fragment)
  if (!isRecord(data)) return !fragment && fits(data) ? data : partial(data)
  const preview = detailPreview(name, data)
  const records = data[collection]
  if (!Array.isArray(records)) {
    if (fragment) return partial(preview ? preview.candidate(0) : data)
    return preview
      ? selectResultPage(0, preview.length, preview.candidate, fits, partial, 0)
      : fits(data)
        ? data
        : partial(data)
  }
  if (offset > 0 && offset >= records.length) {
    throw new LegislationError("invalid_request", "The result page changed. Start the search again.")
  }
  const complete = preview ? preview.candidate(preview.length) : data
  if (!fragment && offset === 0 && fits(complete)) {
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
  if (fragment) return partial(candidate(preview ? 0 : 1))
  return selectResultPage(
    0,
    Math.max(records.length - offset, preview?.length ?? 0),
    candidate,
    fits,
    partial,
    preview ? 0 : 1
  )
}

export function prepareResultPage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  offset: number,
  snapshot?: string,
  measureResult?: ResultPageMeasurement,
  fragment?: ResultFragment
): JSONValue {
  let content = value
  if (
    fragment?.correlationId !== undefined &&
    apiCorrelationId(value) !== undefined &&
    isRecord(value) &&
    isRecord(value.meta)
  ) {
    // Keep the first response's diagnostics while still detecting changes to every source field.
    content = { ...value, meta: { ...value.meta, correlationId: fragment.correlationId } }
  }
  if (fragment && snapshot !== resultSnapshot(content)) {
    throw new LegislationError("invalid_request", "The result content changed. Start the request again.")
  }
  const page = prepareContentPage(name, input, content, offset, snapshot, measureResult, fragment)
  return wrapResultCursors(name, input, page)
}

function wrapResultCursors(name: string, input: Readonly<Record<string, unknown>>, value: JSONValue): JSONValue {
  function wrap(value: JSONValue): JSONValue {
    if (Array.isArray(value)) return value.map(wrap)
    if (value === null || typeof value !== "object") return value
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if ((key === "nextCursor" || key === "nextChildCursor") && typeof item === "string") {
          return [key, scopedCursor(name, input, key, item)]
        }
        return [key, wrap(item)]
      })
    )
  }
  return wrap(value)
}

function scopedCursor(
  name: string,
  input: Readonly<Record<string, unknown>>,
  key: "nextCursor" | "nextChildCursor",
  upstream: string
) {
  return `${scopedPrefix}${Buffer.from(JSON.stringify({ binding: binding(name, input), upstream, field: key === "nextCursor" ? "cursor" : "childCursor" })).toString("base64url")}`
}
