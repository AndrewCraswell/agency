import { createHash } from "node:crypto"
import type { amendments } from "@repo/legislation-core/database/schema/schema"
import type { DocumentAmendmentSummaryRow } from "../legislation/persistence/queries/amendment-reads.js"

export type AmendmentSearchMode = "hybrid" | "lexical" | "semantic"
export type AmendmentSearchRecordType = "document" | "structured"
export type AmendmentSearchMatchedField = "identifier" | "metadata" | "semantic" | "text"

export interface AmendmentSearchInput {
  billIds?: readonly string[]
  cursor?: string
  jurisdictionIds?: readonly string[]
  limit: number
  mode: AmendmentSearchMode
  query: string
  recordTypes?: readonly AmendmentSearchRecordType[]
  sessionIds?: readonly string[]
  sponsorPersonIds?: readonly string[]
  statuses?: readonly string[]
  submittedFrom?: string
  submittedTo?: string
  updatedFrom?: Date
  updatedTo?: Date
  updatedToExclusive?: Date
}

export interface AmendmentSearchExecution {
  isReranked: false
  models: readonly AmendmentSearchModelUsage[]
}

export interface AmendmentSearchModelUsage {
  model: string
  purpose: "embedding"
}

export interface AmendmentSearchPage<T> {
  items: readonly T[]
  nextCursor?: string
  search: AmendmentSearchExecution
  truncated: boolean
  warnings: readonly string[]
}

export type StructuredAmendmentSearchCandidate = Readonly<{
  amendment: typeof amendments.$inferSelect
  lexicalScore: number | null
  matchedFields: readonly AmendmentSearchMatchedField[]
  recordType: "structured"
  rerankScore: null
  score: number
  semanticScore: number | null
  snippet: string | null
}>

export type DocumentAmendmentSearchCandidate = Readonly<{
  document: DocumentAmendmentSummaryRow
  jurisdictionId: string
  lexicalScore: number | null
  matchedFields: readonly AmendmentSearchMatchedField[]
  recordType: "document"
  rerankScore: null
  score: number
  semanticScore: number | null
  snippet: string | null
}>

export type AmendmentSearchCandidate = StructuredAmendmentSearchCandidate | DocumentAmendmentSearchCandidate

type CursorPayload = Readonly<{ offset: number; scope: string; version: 1 }>

/** A cursor is intentionally bound to every filter and search mode. */
export function decodeAmendmentSearchCursor(cursor: string | undefined, input: AmendmentSearchInput): number {
  if (cursor === undefined) {
    return 0
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (!isCursorPayload(value) || value.scope !== amendmentSearchScope(input)) {
      throw new Error("cursor scope mismatch")
    }
    return value.offset
  } catch {
    throw new Error("invalid amendment search cursor")
  }
}

export function encodeAmendmentSearchCursor(offset: number, input: AmendmentSearchInput): string {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("amendment search cursor offset must be a non-negative safe integer")
  }
  const payload: CursorPayload = { offset, scope: amendmentSearchScope(input), version: 1 }
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

/**
 * Reciprocal-rank fusion keeps structured and document-backed candidates
 * independent until ranking. It never treats an absent modality as a score of
 * zero, which would silently make a lexical result semantic (or vice versa).
 */
export function fuseAmendmentSearchCandidates(
  candidateLists: readonly (readonly AmendmentSearchCandidate[])[],
  limit: number
): AmendmentSearchCandidate[] {
  const fused = new Map<string, { candidate: AmendmentSearchCandidate; score: number }>()
  for (const candidates of candidateLists) {
    candidates.forEach((candidate, index) => {
      const key = amendmentCandidateId(candidate)
      const previous = fused.get(key)
      const score = (previous?.score ?? 0) + 1 / (60 + index + 1)
      fused.set(key, { candidate: mergeCandidate(previous?.candidate, candidate), score })
    })
  }
  return [...fused.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        amendmentCandidateId(left.candidate).localeCompare(amendmentCandidateId(right.candidate))
    )
    .slice(0, limit)
    .map(({ candidate, score }) => ({ ...candidate, score }))
}

function mergeCandidate(
  previous: AmendmentSearchCandidate | undefined,
  candidate: AmendmentSearchCandidate
): AmendmentSearchCandidate {
  if (previous === undefined) {
    return candidate
  }
  if (
    previous.recordType !== candidate.recordType ||
    amendmentCandidateId(previous) !== amendmentCandidateId(candidate)
  ) {
    throw new Error("Amendment search fusion cannot merge distinct candidate identities")
  }
  if (candidate.recordType === "structured" && previous.recordType === "structured") {
    return {
      ...candidate,
      lexicalScore: candidate.lexicalScore ?? previous.lexicalScore,
      matchedFields: [...new Set([...previous.matchedFields, ...candidate.matchedFields])],
      semanticScore: candidate.semanticScore ?? previous.semanticScore,
      snippet: candidate.snippet ?? previous.snippet
    }
  }
  if (candidate.recordType === "document" && previous.recordType === "document") {
    return {
      ...candidate,
      lexicalScore: candidate.lexicalScore ?? previous.lexicalScore,
      matchedFields: [...new Set([...previous.matchedFields, ...candidate.matchedFields])],
      semanticScore: candidate.semanticScore ?? previous.semanticScore,
      snippet: candidate.snippet ?? previous.snippet
    }
  }
  throw new Error("Amendment search fusion candidate type is unsupported")
}

export function amendmentCandidateId(candidate: AmendmentSearchCandidate): string {
  return candidate.recordType === "structured" ? candidate.amendment.id : `amendment:document:${candidate.document.id}`
}

function amendmentSearchScope(input: AmendmentSearchInput): string {
  const canonical = {
    billIds: sorted(input.billIds),
    jurisdictionIds: sorted(input.jurisdictionIds),
    limit: input.limit,
    mode: input.mode,
    query: input.query.trim(),
    recordTypes: sorted(input.recordTypes),
    sessionIds: sorted(input.sessionIds),
    sponsorPersonIds: sorted(input.sponsorPersonIds),
    statuses: sorted(input.statuses),
    submittedFrom: input.submittedFrom ?? null,
    submittedTo: input.submittedTo ?? null,
    updatedFrom: input.updatedFrom?.toISOString() ?? null,
    updatedTo: input.updatedTo?.toISOString() ?? null,
    updatedToExclusive: input.updatedToExclusive?.toISOString() ?? null
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("base64url")
}

function sorted(values: readonly string[] | undefined): readonly string[] {
  return values === undefined ? [] : [...new Set(values)].toSorted()
}

function isCursorPayload(value: unknown): value is CursorPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const version = ownValue(value, "version")
  const scope = ownValue(value, "scope")
  const offset = ownValue(value, "offset")
  return (
    version === 1 &&
    typeof scope === "string" &&
    typeof offset === "number" &&
    Number.isSafeInteger(offset) &&
    offset >= 0
  )
}

function ownValue(value: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(value, key)?.value
}
