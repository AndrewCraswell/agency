import { CanonicalProjectionError, type BillSummary, type SourceReference } from "./canonical-projection.js"
import { projectBillSummaryRead, type BillSummaryRead } from "./canonical-read.js"

export type BillSearchMode = "hybrid" | "lexical" | "semantic"

export type BillSearchMatchedField =
  | "abstract"
  | "identifier"
  | "semantic"
  | "sponsorNames"
  | "subjects"
  | "title"
  | "versionText"

export interface BillSearchCandidateRead extends BillSummaryRead {
  lexicalScore: number | null
  matchedFields: readonly BillSearchMatchedField[]
  rerankScore: number | null
  score: number
  semanticScore: number | null
  snippet: string | null
}

export interface BillSearchModel {
  model: string
  purpose: "embedding" | "reranking"
}

export interface BillSearchExecution {
  isReranked: boolean
  models: readonly BillSearchModel[]
}

export interface BillSearchHit {
  match: {
    explanation: null
    lexicalScore: number | null
    matchedFields: readonly BillSearchMatchedField[]
    mode: BillSearchMode
    rerankScore: number | null
    semanticScore: number | null
    snippet: string | null
  }
  rank: number
  record: BillSummary
  recordId: string
  recordType: "bill"
  score: number
  sources: readonly [SourceReference, ...SourceReference[]]
}

/**
 * Converts search candidates to canonical HTTP records without inventing a
 * score, model, or provenance field. The query service supplies the values;
 * this boundary only checks that they agree with the selected search mode.
 */
export function projectBillSearchHits(
  candidates: readonly BillSearchCandidateRead[],
  mode: BillSearchMode,
  apiBaseUrl: string
): BillSearchHit[] {
  return candidates.map((candidate, index) => projectBillSearchHit(candidate, mode, index + 1, apiBaseUrl))
}

export function projectBillSearchHit(
  candidate: Readonly<BillSearchCandidateRead>,
  mode: BillSearchMode,
  rank: number,
  apiBaseUrl: string
): BillSearchHit {
  validateSearchCandidate(candidate, mode, rank)
  const record = projectBillSummaryRead(candidate, apiBaseUrl)
  return {
    match: {
      explanation: null,
      lexicalScore: candidate.lexicalScore,
      matchedFields: [...candidate.matchedFields],
      mode,
      rerankScore: candidate.rerankScore,
      semanticScore: candidate.semanticScore,
      snippet: candidate.snippet
    },
    rank,
    record,
    recordId: record.id,
    recordType: "bill",
    score: candidate.score,
    sources: record.sources
  }
}

function validateSearchCandidate(
  candidate: Readonly<BillSearchCandidateRead>,
  mode: BillSearchMode,
  rank: number
): void {
  if (!Number.isSafeInteger(rank) || rank < 1) {
    throw new CanonicalProjectionError("search rank must be a positive safe integer")
  }
  finiteScore(candidate.score, "search score")
  if (candidate.snippet !== null && typeof candidate.snippet !== "string") {
    throw new CanonicalProjectionError("search snippet must be a string or null")
  }
  if (
    candidate.matchedFields.length === 0 ||
    new Set(candidate.matchedFields).size !== candidate.matchedFields.length
  ) {
    throw new CanonicalProjectionError("search matched fields must be a non-empty unique list")
  }
  if (candidate.matchedFields.some((field) => !isBillSearchMatchedField(field))) {
    throw new CanonicalProjectionError("search matched field is unsupported")
  }
  switch (mode) {
    case "lexical":
      finiteScore(candidate.lexicalScore, "lexical score")
      nullScore(candidate.semanticScore, "semantic score")
      nullScore(candidate.rerankScore, "rerank score")
      equalScore(candidate.score, candidate.lexicalScore, "lexical search score")
      return
    case "semantic":
      nullScore(candidate.lexicalScore, "lexical score")
      finiteScore(candidate.semanticScore, "semantic score")
      finiteScore(candidate.rerankScore, "rerank score")
      equalScore(candidate.score, candidate.rerankScore, "semantic search score")
      return
    case "hybrid":
      if (candidate.lexicalScore === null && candidate.semanticScore === null) {
        throw new CanonicalProjectionError("hybrid search candidate must have a lexical or semantic score")
      }
      optionalFiniteScore(candidate.lexicalScore, "lexical score")
      optionalFiniteScore(candidate.semanticScore, "semantic score")
      finiteScore(candidate.rerankScore, "rerank score")
      equalScore(candidate.score, candidate.rerankScore, "hybrid search score")
  }
}

function equalScore(score: number, expected: number, label: string): void {
  if (score !== expected) {
    throw new CanonicalProjectionError(`${label} must equal its selected ranking score`)
  }
}

function finiteScore(value: number | null, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CanonicalProjectionError(`${label} must be finite`)
  }
}

function isBillSearchMatchedField(value: string): value is BillSearchMatchedField {
  return (
    value === "abstract" ||
    value === "identifier" ||
    value === "semantic" ||
    value === "sponsorNames" ||
    value === "subjects" ||
    value === "title" ||
    value === "versionText"
  )
}

function nullScore(value: number | null, label: string): void {
  if (value !== null) {
    throw new CanonicalProjectionError(`${label} must be null for this search mode`)
  }
}

function optionalFiniteScore(value: number | null, label: string): void {
  if (value !== null) {
    finiteScore(value, label)
  }
}
