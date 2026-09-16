import { createHash } from "node:crypto"
import type { JSONValue } from "@modelcontextprotocol/server"
import { z } from "zod"
import { LegislationError } from "../legislation/errors.js"

export const researchResultByteLimit = 180000
const prefix = "research-page:"
const cursorSchema = z.object({
  binding: z.string(),
  offset: z.number().int().min(1).max(100),
  upstream: z.string().optional()
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
    return { input: { ...input, cursor: parsed.upstream }, offset: parsed.offset }
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

export function prepareResultPage(
  name: string,
  input: Readonly<Record<string, unknown>>,
  value: JSONValue,
  offset: number
): JSONValue {
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
