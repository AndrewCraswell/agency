import { LegislationError } from "../legislation/errors.js"
import {
  CanonicalProjectionError,
  projectDocumentSection,
  projectSupportingMaterialSection,
  type ProjectionContext,
  type ProjectionSourceInput
} from "./canonical-projection.js"

export interface SourceDocument {
  createdAt: Date | string
  id: string
  sourceUpdatedAt?: Date | string | null
  sourceUrl: string
  updatedAt: Date | string
  upstreamIds?: Record<string, string>
}

export interface DocumentSectionRecord {
  contentHash: string
  heading: string | null
  id: string
  ordinal: number
  sourceEndOffset: number
  sourceStartOffset: number
  text: string
}

export interface SupportingMaterialSectionRecord {
  contentHash: string
  heading: string | null
  id: string
  ordinal: number
  text: string
}

/**
 * Converts only facts persisted by the query service into the public canonical
 * shape. An unclassified source retains its persisted hostname as its provider
 * identity and is never elevated to an official publisher.
 */
export interface DocumentSectionRead {
  document: SourceDocument & { billId: string }
  section: DocumentSectionRecord
}

export interface SupportingMaterialSectionRead {
  material: SourceDocument
  section: SupportingMaterialSectionRecord
}

export function projectDocumentSectionRead(value: Readonly<DocumentSectionRead>, apiBaseUrl: string) {
  return projectDocumentSection(
    {
      ...value.section,
      billId: value.document.billId,
      documentId: requiredString(value.document, "id", "document ID"),
      endOffset: value.section.sourceEndOffset,
      pageEnd: null,
      pageStart: null,
      sourceUrl: value.document.sourceUrl,
      startOffset: value.section.sourceStartOffset
    },
    projectionContext(value.document, apiBaseUrl)
  )
}

export function projectSupportingMaterialSectionRead(
  value: Readonly<SupportingMaterialSectionRead>,
  apiBaseUrl: string
) {
  return projectSupportingMaterialSection(
    {
      ...value.section,
      materialId: requiredString(value.material, "id", "supporting material ID"),
      pageEnd: null,
      pageStart: null,
      sourceUrl: value.material.sourceUrl
    },
    projectionContext(value.material, apiBaseUrl)
  )
}

export function toProjectionLegislationError(error: unknown): Error {
  if (error instanceof CanonicalProjectionError) {
    return new LegislationError(
      "unprocessable",
      "The record cannot be returned because its canonical provenance is incomplete",
      { cause: error }
    )
  }
  return error instanceof Error ? error : new Error("The record cannot be returned")
}

function projectionContext(source: SourceDocument, apiBaseUrl: string): ProjectionContext {
  const sourceUrl = requiredString(source, "sourceUrl", "source URL")
  const provenance: ProjectionSourceInput = {
    isOfficial: isOfficialSource(sourceUrl),
    provider: providerFor(sourceUrl, source.upstreamIds),
    retrievedAt: source.createdAt,
    sourceUpdatedAt: source.sourceUpdatedAt ?? null,
    sourceUrl
  }
  return { apiBaseUrl, sources: [provenance], updatedAt: source.updatedAt }
}

function providerFor(sourceUrl: string, upstreamIds: Record<string, string> | undefined): string {
  const host = sourceHost(sourceUrl)
  for (const provider of ["congress", "govinfo", "openstates"] as const) {
    if (upstreamIds?.[provider] !== undefined) {
      return provider
    }
  }
  if (host === "api.congress.gov" || host.endsWith(".congress.gov")) {
    return "congress"
  }
  if (host === "api.govinfo.gov" || host.endsWith(".govinfo.gov")) {
    return "govinfo"
  }
  if (host === "v3.openstates.org" || host.endsWith(".openstates.org")) {
    return "openstates"
  }
  return host
}

function isOfficialSource(sourceUrl: string): boolean {
  const host = sourceHost(sourceUrl)
  return (
    host === "api.congress.gov" ||
    host.endsWith(".congress.gov") ||
    host === "api.govinfo.gov" ||
    host.endsWith(".govinfo.gov")
  )
}

function sourceHost(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase()
    if (host.length === 0) {
      throw new Error("missing host")
    }
    return host
  } catch {
    throw new CanonicalProjectionError("source URL must be an absolute URL with a hostname")
  }
}

function requiredString(value: object, key: string, label: string): string {
  const candidate = Reflect.get(value, key)
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new CanonicalProjectionError(`${label} is required`)
  }
  return candidate
}
