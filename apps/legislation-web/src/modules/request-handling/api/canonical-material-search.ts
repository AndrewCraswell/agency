import {
  CanonicalProjectionError,
  type SourceReference,
  type SupportingMaterialSection,
  type SupportingMaterialSummary
} from "./canonical-projection.js"
import {
  projectSupportingMaterialSectionRead,
  projectSupportingMaterialSummaryRead,
  type SupportingMaterialRead,
  type SupportingMaterialSectionRecord
} from "./canonical-read.js"

export type SupportingMaterialSearchMode = "hybrid" | "lexical" | "semantic"

export type SupportingMaterialSearchMatchedField = "sectionText" | "semantic" | "title"

export interface SupportingMaterialSearchCandidateRead extends SupportingMaterialRead {
  lexicalScore: number | null
  matchedFields: readonly SupportingMaterialSearchMatchedField[]
  rerankScore: null
  score: number
  section: SupportingMaterialSectionRecord & { materialId: string }
  semanticScore: number | null
  snippet: string | null
}

export interface SupportingMaterialSearchHit {
  match: {
    explanation: string | null
    lexicalScore: number | null
    matchedFields: readonly SupportingMaterialSearchMatchedField[]
    mode: SupportingMaterialSearchMode
    rerankScore: null
    semanticScore: number | null
    snippet: string | null
  }
  rank: number
  record: {
    material: SupportingMaterialSummary
    relatedRecordIds: string[]
    section: SupportingMaterialSection
  }
  recordId: string
  recordType: "supporting-material"
  score: number
  sources: readonly [SourceReference, ...SourceReference[]]
}

/**
 * Material search has a materially different record shape from the material
 * collection: every hit is anchored to one persisted, bounded section. This
 * projection deliberately refuses a summary-only candidate rather than
 * inventing a matching passage or ranking explanation.
 */
export function projectSupportingMaterialSearchHits(
  candidates: readonly SupportingMaterialSearchCandidateRead[],
  mode: SupportingMaterialSearchMode,
  apiBaseUrl: string,
  explain = false,
  rankOffset = 0
): SupportingMaterialSearchHit[] {
  return candidates.map((candidate, index) =>
    projectSupportingMaterialSearchHit(candidate, mode, rankOffset + index + 1, apiBaseUrl, explain)
  )
}

export function projectSupportingMaterialSearchHit(
  candidate: Readonly<SupportingMaterialSearchCandidateRead>,
  mode: SupportingMaterialSearchMode,
  rank: number,
  apiBaseUrl: string,
  explain = false
): SupportingMaterialSearchHit {
  validateCandidate(candidate, mode, rank)
  const material = projectSupportingMaterialSummaryRead(candidate, apiBaseUrl)
  const section = projectSupportingMaterialSectionRead({ material: candidate, section: candidate.section }, apiBaseUrl)
  const relatedRecordIds = relatedIds(candidate)
  return {
    match: {
      explanation: explain ? deterministicExplanation(candidate, mode) : null,
      lexicalScore: candidate.lexicalScore,
      matchedFields: [...candidate.matchedFields],
      mode,
      rerankScore: null,
      semanticScore: candidate.semanticScore,
      snippet: candidate.snippet
    },
    rank,
    record: { material, relatedRecordIds, section },
    recordId: material.id,
    recordType: "supporting-material",
    score: candidate.score,
    sources: material.sources
  }
}

function deterministicExplanation(
  candidate: Readonly<SupportingMaterialSearchCandidateRead>,
  mode: SupportingMaterialSearchMode
): string {
  return `${mode} search matched ${candidate.matchedFields.join(", ")}; response score ${candidate.score.toString()}.`
}

function validateCandidate(
  candidate: Readonly<SupportingMaterialSearchCandidateRead>,
  mode: SupportingMaterialSearchMode,
  rank: number
): void {
  if (!Number.isSafeInteger(rank) || rank < 1) {
    throw new CanonicalProjectionError("supporting material search rank must be a positive safe integer")
  }
  finiteScore(candidate.score, "supporting material search score")
  if (candidate.section.materialId !== candidate.id) {
    throw new CanonicalProjectionError("supporting material search section must belong to its material")
  }
  if (candidate.snippet !== null && typeof candidate.snippet !== "string") {
    throw new CanonicalProjectionError("supporting material search snippet must be a string or null")
  }
  if (
    candidate.matchedFields.length === 0 ||
    new Set(candidate.matchedFields).size !== candidate.matchedFields.length ||
    candidate.matchedFields.some((field) => field !== "sectionText" && field !== "semantic" && field !== "title")
  ) {
    throw new CanonicalProjectionError("supporting material search matched fields must be a non-empty unique list")
  }
  switch (mode) {
    case "lexical":
      finiteScore(candidate.lexicalScore, "supporting material lexical score")
      nullScore(candidate.semanticScore, "supporting material semantic score")
      if (candidate.score !== candidate.lexicalScore) {
        throw new CanonicalProjectionError("supporting material lexical search score must equal lexical score")
      }
      return
    case "semantic":
      nullScore(candidate.lexicalScore, "supporting material lexical score")
      finiteScore(candidate.semanticScore, "supporting material semantic score")
      if (candidate.score !== candidate.semanticScore) {
        throw new CanonicalProjectionError("supporting material semantic search score must equal semantic score")
      }
      return
    case "hybrid":
      if (candidate.lexicalScore === null && candidate.semanticScore === null) {
        throw new CanonicalProjectionError("supporting material hybrid search needs a lexical or semantic score")
      }
      optionalFiniteScore(candidate.lexicalScore, "supporting material lexical score")
      optionalFiniteScore(candidate.semanticScore, "supporting material semantic score")
  }
}

function relatedIds(candidate: Readonly<SupportingMaterialSearchCandidateRead>): string[] {
  const values = [
    ...candidate.amendmentIds,
    ...candidate.billIds,
    ...candidate.meetingIds,
    ...candidate.organizationIds
  ]
  if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw new CanonicalProjectionError("supporting material related record IDs must be non-empty strings")
  }
  return [...new Set(values)].sort()
}

function finiteScore(value: number | null, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CanonicalProjectionError(`${label} must be finite`)
  }
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
