import {
  projectDocumentAmendment,
  projectStructuredAmendment
} from "../../legislation/persistence/queries/amendment-reads.js"
import type {
  AmendmentSearchCandidate,
  AmendmentSearchMatchedField,
  AmendmentSearchMode
} from "../../search/amendment-search.js"
import { CanonicalProjectionError, type AmendmentSummary, type SourceReference } from "./canonical-projection.js"

export interface AmendmentSearchHit {
  match: {
    explanation: string | null
    lexicalScore: number | null
    matchedFields: readonly AmendmentSearchMatchedField[]
    mode: AmendmentSearchMode
    rerankScore: null
    semanticScore: number | null
    snippet: string | null
  }
  rank: number
  record: AmendmentSummary
  recordId: string
  recordType: "amendment"
  score: number
  sources: readonly [SourceReference, ...SourceReference[]]
}

export function projectAmendmentSearchHits(
  candidates: readonly AmendmentSearchCandidate[],
  mode: AmendmentSearchMode,
  apiBaseUrl: string,
  explain = false,
  rankOffset = 0
): AmendmentSearchHit[] {
  return candidates.map((candidate, index) =>
    projectAmendmentSearchHit(candidate, mode, rankOffset + index + 1, apiBaseUrl, explain)
  )
}

export function projectAmendmentSearchHit(
  candidate: AmendmentSearchCandidate,
  mode: AmendmentSearchMode,
  rank: number,
  apiBaseUrl: string,
  explain = false
): AmendmentSearchHit {
  validateCandidate(candidate, mode, rank)
  const record =
    candidate.recordType === "structured"
      ? projectStructuredAmendment(candidate.amendment, apiBaseUrl)
      : projectDocumentAmendment(candidate.document, candidate.jurisdictionId, apiBaseUrl)
  return {
    match: {
      explanation: explain ? explanation(candidate, mode) : null,
      lexicalScore: candidate.lexicalScore,
      matchedFields: candidate.matchedFields,
      mode,
      rerankScore: null,
      semanticScore: candidate.semanticScore,
      snippet: candidate.snippet
    },
    rank,
    record,
    recordId: record.id,
    recordType: "amendment",
    score: candidate.score,
    sources: record.sources
  }
}

function validateCandidate(candidate: AmendmentSearchCandidate, mode: AmendmentSearchMode, rank: number): void {
  if (!Number.isSafeInteger(rank) || rank < 1 || !Number.isFinite(candidate.score)) {
    throw new CanonicalProjectionError("amendment search rank or score is invalid")
  }
  if (
    candidate.matchedFields.length === 0 ||
    new Set(candidate.matchedFields).size !== candidate.matchedFields.length
  ) {
    throw new CanonicalProjectionError("amendment search matched fields must be a non-empty unique list")
  }
  if (candidate.matchedFields.some((field) => !isMatchedField(field))) {
    throw new CanonicalProjectionError("amendment search matched field is unsupported")
  }
  if (candidate.snippet !== null && typeof candidate.snippet !== "string") {
    throw new CanonicalProjectionError("amendment search snippet must be a string or null")
  }
  if (candidate.rerankScore !== null) {
    throw new CanonicalProjectionError("amendment search does not rerank candidates")
  }
  switch (mode) {
    case "lexical":
      finite(candidate.lexicalScore, "lexical score")
      nil(candidate.semanticScore, "semantic score")
      return
    case "semantic":
      nil(candidate.lexicalScore, "lexical score")
      finite(candidate.semanticScore, "semantic score")
      return
    case "hybrid":
      if (candidate.lexicalScore === null && candidate.semanticScore === null) {
        throw new CanonicalProjectionError("hybrid amendment search candidate must have a lexical or semantic score")
      }
      optionalFinite(candidate.lexicalScore, "lexical score")
      optionalFinite(candidate.semanticScore, "semantic score")
  }
}

function explanation(candidate: AmendmentSearchCandidate, mode: AmendmentSearchMode): string {
  return `${mode} search matched ${candidate.matchedFields.join(", ")}; lexical score ${score(candidate.lexicalScore)}, semantic score ${score(candidate.semanticScore)}; response score ${candidate.score.toString()}.`
}

function score(value: number | null): string {
  return value === null ? "null" : value.toString()
}

function isMatchedField(value: string): value is AmendmentSearchMatchedField {
  return value === "identifier" || value === "metadata" || value === "semantic" || value === "text"
}

function finite(value: number | null, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CanonicalProjectionError(`amendment search ${label} must be finite`)
  }
}

function optionalFinite(value: number | null, label: string): void {
  if (value !== null) {
    finite(value, label)
  }
}

function nil(value: number | null, label: string): void {
  if (value !== null) {
    throw new CanonicalProjectionError(`amendment search ${label} must be null for this mode`)
  }
}
