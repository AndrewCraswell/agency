import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  CanonicalProjectionError,
  isIsoDate,
  isRfc3339Timestamp,
  projectBillDetail,
  projectBillSummary,
  projectDocumentSection,
  projectSupportingMaterialDetail,
  projectSupportingMaterialSection,
  projectSupportingMaterialSummary,
  type DateValue,
  type AmendmentSummary,
  type BillAction,
  type BillDetail,
  type BillRelation,
  type ChildCollectionPageInfo,
  type DocumentSummary,
  type MeetingOutcome,
  type OrganizationSummary,
  type PersonSummary,
  type ProjectionContext,
  type ProjectionSourceInput,
  type SourceReference,
  type Sponsor,
  type SupportingMaterialDetail,
  type SupportingMaterialSummary,
  type VoteSummary
} from "./canonical-projection"

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
  pageEnd?: number | null
  pageStart?: number | null
  sourceEndOffset: number
  sourceStartOffset: number
  text: string
}

export interface SupportingMaterialSectionRecord {
  contentHash: string
  heading: string | null
  id: string
  ordinal: number
  pageEnd?: number | null
  pageStart?: number | null
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

export interface SupportingMaterialRead extends SourceDocument {
  amendmentIds: readonly string[]
  billIds: readonly string[]
  classification: string
  contentType: string | null
  documentDate: Date | string | null
  jurisdictionId: string
  meetingIds: readonly string[]
  organizationIds: readonly string[]
  processingStatus: string
  title: string
}

export interface SupportingMaterialDetailRead extends SupportingMaterialRead {
  byteSize: null
  pageCount: null
  sectionCount: number
  storedUrl: null
  textCharacterCount: number
}

export interface BillSummaryRead extends SourceDocument {
  classification: readonly string[]
  identifier: string
  introducedAt: Date | string | null
  jurisdictionId: string
  latestActionAt: Date | string | null
  sessionId: string
  status: string | null
  subjects: readonly string[]
  title: string
}

/**
 * The detail route only accepts a complete canonical child projection. This is
 * deliberately stricter than the historical query-service detail shape: a
 * shared child cursor, incomplete relationship provenance, or an inferred OCR
 * state cannot be represented as a BillDetail without changing its meaning.
 */
export interface BillDetailRead {
  abstract: string | null
  amendments: readonly AmendmentSummary[]
  bill: BillSummaryRead
  childPageInfo: Readonly<Record<"documents" | "amendments" | "votes", ChildCollectionPageInfo>>
  documents: readonly DocumentSummary[]
  latestActions: readonly BillAction[]
  organizations: readonly OrganizationSummary[]
  relations: readonly BillRelation[]
  sponsors: readonly Sponsor[]
  voteSummaries: readonly VoteSummary[]
}

export type BillTimelineItem =
  | (TimelineFields & Readonly<{ action: BillAction; type: "action" }>)
  | (TimelineFields & Readonly<{ type: "vote"; vote: VoteSummary }>)
  | (TimelineFields & Readonly<{ meetingOutcome: MeetingOutcome; type: "meeting-outcome" }>)

interface TimelineFields {
  date: string
  description: string
  id: string
  occurredAt: string | null
  sequence: number
  sources: readonly [SourceReference, ...SourceReference[]]
  title: string
}

export function projectDocumentSectionRead(value: Readonly<DocumentSectionRead>, apiBaseUrl: string) {
  return projectDocumentSection(
    {
      ...value.section,
      billId: value.document.billId,
      documentId: requiredString(value.document, "id", "document ID"),
      endOffset: value.section.sourceEndOffset,
      pageEnd: value.section.pageEnd ?? null,
      pageStart: value.section.pageStart ?? null,
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
      pageEnd: value.section.pageEnd ?? null,
      pageStart: value.section.pageStart ?? null,
      sourceUrl: value.material.sourceUrl
    },
    projectionContext(value.material, apiBaseUrl)
  )
}

export function projectSupportingMaterialSummaryRead(
  value: Readonly<SupportingMaterialRead>,
  apiBaseUrl: string
): SupportingMaterialSummary {
  return projectSupportingMaterialSummary(
    {
      amendmentIds: value.amendmentIds,
      billIds: value.billIds,
      classification: requiredString(value, "classification", "supporting material classification"),
      documentDate: value.documentDate,
      id: requiredString(value, "id", "supporting material ID"),
      jurisdictionId: requiredString(value, "jurisdictionId", "supporting material jurisdiction ID"),
      meetingIds: value.meetingIds,
      mimeType: value.contentType,
      organizationIds: value.organizationIds,
      processingStatus: supportingMaterialProcessingStatus(value.processingStatus),
      sourceUrl: requiredString(value, "sourceUrl", "supporting material source URL"),
      title: requiredString(value, "title", "supporting material title")
    },
    projectionContext(value, apiBaseUrl)
  )
}

export function projectSupportingMaterialDetailRead(
  value: Readonly<SupportingMaterialDetailRead>,
  apiBaseUrl: string
): SupportingMaterialDetail {
  return projectSupportingMaterialDetail(
    {
      amendmentIds: value.amendmentIds,
      billIds: value.billIds,
      byteSize: value.byteSize,
      classification: requiredString(value, "classification", "supporting material classification"),
      documentDate: value.documentDate,
      id: requiredString(value, "id", "supporting material ID"),
      jurisdictionId: requiredString(value, "jurisdictionId", "supporting material jurisdiction ID"),
      meetingIds: value.meetingIds,
      mimeType: value.contentType,
      organizationIds: value.organizationIds,
      pageCount: value.pageCount,
      processingStatus: supportingMaterialProcessingStatus(value.processingStatus),
      sectionCount: value.sectionCount,
      sourceUrl: requiredString(value, "sourceUrl", "supporting material source URL"),
      storedUrl: value.storedUrl,
      textCharacterCount: value.textCharacterCount,
      title: requiredString(value, "title", "supporting material title")
    },
    projectionContext(value, apiBaseUrl)
  )
}

export function projectBillSummaryRead(value: Readonly<BillSummaryRead>, apiBaseUrl: string) {
  return projectBillSummary(
    {
      ...value,
      introducedDate: value.introducedAt,
      latestActionAt: value.latestActionAt,
      status: value.status
    },
    projectionContext(value, apiBaseUrl)
  )
}

export function projectBillDetailRead(value: unknown, apiBaseUrl: string): BillDetail {
  if (!isBillDetailRead(value)) {
    throw new CanonicalProjectionError("bill detail is incomplete or does not preserve canonical child provenance")
  }
  return projectBillDetail(
    {
      abstract: value.abstract,
      amendments: value.amendments,
      bill: billSummaryProjectionInput(value.bill),
      childPageInfo: value.childPageInfo,
      documents: value.documents,
      latestActions: value.latestActions,
      organizations: value.organizations,
      relations: value.relations,
      sponsors: value.sponsors,
      voteSummaries: value.voteSummaries
    },
    projectionContext(value.bill, apiBaseUrl)
  )
}

/**
 * Timeline rows are already canonical domain objects assembled by the read
 * layer. The HTTP slice validates their discriminated union before it wraps
 * them in a Page envelope, so an incomplete historical action/vote row cannot
 * masquerade as a public TimelineItem.
 */
export function projectBillTimelineRead(value: unknown): BillTimelineItem {
  if (!isBillTimelineItem(value)) {
    throw new CanonicalProjectionError("bill timeline item is incomplete or has an invalid branch")
  }
  return structuredClone(value)
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

/**
 * Builds canonical provenance only from the persisted source record. Route
 * slices reuse this rather than deriving a provider, official status, or
 * retrieval time from a request or storage location.
 */
export function sourceProjectionContext(source: SourceDocument, apiBaseUrl: string): ProjectionContext {
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

function projectionContext(source: SourceDocument, apiBaseUrl: string): ProjectionContext {
  return sourceProjectionContext(source, apiBaseUrl)
}

function billSummaryProjectionInput(value: BillSummaryRead) {
  return {
    classification: value.classification,
    id: value.id,
    identifier: value.identifier,
    introducedDate: value.introducedAt,
    jurisdictionId: value.jurisdictionId,
    latestActionAt: value.latestActionAt,
    sessionId: value.sessionId,
    sourceUrl: value.sourceUrl,
    status: value.status,
    subjects: value.subjects,
    title: value.title
  }
}

function supportingMaterialProcessingStatus(
  value: string
): "failed" | "pending" | "processed" | "processing" | "unsupported" {
  switch (value) {
    case "failed":
    case "pending":
    case "processed":
    case "processing":
    case "unsupported":
      return value
    default:
      throw new CanonicalProjectionError("supporting material processing status is invalid")
  }
}

function isBillDetailRead(value: unknown): value is BillDetailRead {
  if (!isRecord(value) || !isBillSummaryRead(value.bill) || !isNullableString(value.abstract)) {
    return false
  }
  if (
    !arrayOf(value.sponsors, isSponsor) ||
    !arrayOf(value.organizations, isOrganizationSummary) ||
    !arrayOf(value.documents, isDocumentSummary) ||
    !arrayOf(value.relations, isBillRelation) ||
    !arrayOf(value.amendments, isAmendmentSummary) ||
    !arrayOf(value.latestActions, isBillAction) ||
    !arrayOf(value.voteSummaries, isVoteSummary) ||
    !isBillChildPageInfo(value.childPageInfo)
  ) {
    return false
  }
  return (
    value.sponsors.length <= 500 &&
    value.organizations.length <= 250 &&
    value.relations.length <= 500 &&
    value.latestActions.length <= 100 &&
    value.documents.length <= value.childPageInfo.documents.limit &&
    value.amendments.length <= value.childPageInfo.amendments.limit &&
    value.voteSummaries.length <= value.childPageInfo.votes.limit
  )
}

function isBillTimelineItem(value: unknown): value is BillTimelineItem {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isIsoDate(value.date) ||
    !isNullableRfc3339Timestamp(value.occurredAt) ||
    !isSafeNonnegativeInteger(value.sequence) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.description) ||
    !isSourceReferences(value.sources)
  ) {
    return false
  }
  switch (value.type) {
    case "action":
      return isBillAction(value.action) && value.vote === undefined && value.meetingOutcome === undefined
    case "vote":
      return isVoteSummary(value.vote) && value.action === undefined && value.meetingOutcome === undefined
    case "meeting-outcome":
      return isMeetingOutcome(value.meetingOutcome) && value.action === undefined && value.vote === undefined
    default:
      return false
  }
}

function isBillSummaryRead(value: unknown): value is BillSummaryRead {
  if (!isRecord(value) || !isSourceDocument(value)) {
    return false
  }
  return (
    isStringArray(value.classification) &&
    isNonEmptyString(value.identifier) &&
    isNullableDateValue(value.introducedAt) &&
    isNonEmptyString(value.jurisdictionId) &&
    isNullableDateValue(value.latestActionAt) &&
    isNonEmptyString(value.sessionId) &&
    isNullableString(value.status) &&
    isStringArray(value.subjects) &&
    isNonEmptyString(value.title)
  )
}

function isSourceDocument(value: unknown): value is SourceDocument {
  return (
    isRecord(value) &&
    isDateValue(value.createdAt) &&
    isNonEmptyString(value.id) &&
    (value.sourceUpdatedAt === undefined || isNullableDateValue(value.sourceUpdatedAt)) &&
    isNonEmptyString(value.sourceUrl) &&
    isDateValue(value.updatedAt) &&
    (value.upstreamIds === undefined || isStringRecord(value.upstreamIds))
  )
}

function isSponsor(value: unknown): value is Sponsor {
  return (
    isRecord(value) &&
    (value.person === null || isPersonSummary(value.person)) &&
    isNonEmptyString(value.sourceName) &&
    (value.classification === "primary" ||
      value.classification === "cosponsor" ||
      value.classification === "author" ||
      value.classification === "other") &&
    typeof value.isPrimary === "boolean" &&
    isSourceReferences(value.sources)
  )
}

function isBillRelation(value: unknown): value is BillRelation {
  return (
    isRecord(value) &&
    isBillSummary(value.relatedBill) &&
    (value.classification === "companion" ||
      value.classification === "replacement" ||
      value.classification === "replaced-by" ||
      value.classification === "prior-session" ||
      value.classification === "related" ||
      value.classification === "other") &&
    isSourceReferences(value.sources)
  )
}

function isBillAction(value: unknown): value is BillAction {
  return (
    isCanonicalRecord(value, "bill-action") &&
    isNonEmptyString(value.billId) &&
    isNonEmptyString(value.description) &&
    isIsoDate(value.date) &&
    isNullableRfc3339Timestamp(value.occurredAt) &&
    isSafeNonnegativeInteger(value.sequence) &&
    isStringArray(value.classifications) &&
    (value.organization === null || isOrganizationSummary(value.organization))
  )
}

function isVoteSummary(value: unknown): value is VoteSummary {
  return (
    isCanonicalRecord(value, "vote") &&
    isNullableString(value.billId) &&
    isNullableString(value.organizationId) &&
    isNonEmptyString(value.motion) &&
    isNullableString(value.question) &&
    isNullableString(value.classification) &&
    isNullableRfc3339Timestamp(value.heldAt) &&
    isIsoDate(value.date) &&
    (value.result === "passed" || value.result === "failed" || value.result === "other") &&
    isVoteCounts(value.counts)
  )
}

function isDocumentSummary(value: unknown): value is DocumentSummary {
  return (
    isCanonicalRecord(value, "document") &&
    isNullableString(value.billId) &&
    (value.classification === "version" ||
      value.classification === "amendment" ||
      value.classification === "fiscal-note" ||
      value.classification === "analysis" ||
      value.classification === "supplemental") &&
    isNonEmptyString(value.title) &&
    isNullableIsoDate(value.documentDate) &&
    isNullableString(value.versionCode) &&
    isNullableString(value.mimeType) &&
    isNonEmptyString(value.sourceUrl) &&
    isNullableString(value.storedUrl) &&
    isProcessingStatus(value.processingStatus) &&
    (value.ocrStatus === "not-required" || isProcessingStatus(value.ocrStatus)) &&
    isNullableString(value.contentHash)
  )
}

function isAmendmentSummary(value: unknown): value is AmendmentSummary {
  return (
    isCanonicalRecord(value, "amendment") &&
    isNonEmptyString(value.billId) &&
    isNonEmptyString(value.jurisdictionId) &&
    (value.recordType === "structured" || value.recordType === "document") &&
    isNonEmptyString(value.identifier) &&
    isNonEmptyString(value.title) &&
    isNullableIsoDate(value.submittedDate) &&
    isNullableString(value.status) &&
    isNullableString(value.documentId)
  )
}

function isOrganizationSummary(value: unknown): value is OrganizationSummary {
  return (
    isCanonicalRecord(value, "organization") &&
    isNonEmptyString(value.jurisdictionId) &&
    isNonEmptyString(value.name) &&
    (value.classification === "legislature" ||
      value.classification === "chamber" ||
      value.classification === "committee" ||
      value.classification === "subcommittee" ||
      value.classification === "commission" ||
      value.classification === "agency" ||
      value.classification === "other") &&
    isNullableString(value.parentOrganizationId) &&
    (value.chamber === null ||
      value.chamber === "lower" ||
      value.chamber === "upper" ||
      value.chamber === "unicameral" ||
      value.chamber === "legislature") &&
    typeof value.isActive === "boolean"
  )
}

function isPersonSummary(value: unknown): value is PersonSummary {
  return (
    isCanonicalRecord(value, "person") &&
    isNonEmptyString(value.name) &&
    isNullableString(value.givenName) &&
    isNullableString(value.familyName) &&
    isNullableString(value.party) &&
    isNullableString(value.imageUrl) &&
    typeof value.isActive === "boolean" &&
    isStringArray(value.jurisdictionIds)
  )
}

function isMeetingOutcome(value: unknown): value is MeetingOutcome {
  return (
    isCanonicalRecord(value, "meeting-outcome") &&
    isNonEmptyString(value.meetingId) &&
    isNullableString(value.agendaItemId) &&
    (value.classification === "action" ||
      value.classification === "vote" ||
      value.classification === "disposition" ||
      value.classification === "note") &&
    isNonEmptyString(value.description) &&
    isNullableString(value.billActionId) &&
    isNullableString(value.voteId) &&
    (value.linkMethod === "explicit" || value.linkMethod === "deterministic-id")
  )
}

function isBillSummary(value: unknown): value is import("./canonical-projection").BillSummary {
  return (
    isCanonicalRecord(value, "bill") &&
    isNonEmptyString(value.jurisdictionId) &&
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.identifier) &&
    isNonEmptyString(value.title) &&
    isStringArray(value.classification) &&
    isNullableString(value.status) &&
    isStringArray(value.subjects) &&
    isNullableIsoDate(value.introducedDate) &&
    isNullableRfc3339Timestamp(value.latestActionAt)
  )
}

function isCanonicalRecord(value: unknown, type: string): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.type === type &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.canonicalUrl) &&
    isRfc3339Timestamp(value.updatedAt) &&
    isSourceReferences(value.sources)
  )
}

function isBillChildPageInfo(value: unknown): value is BillDetailRead["childPageInfo"] {
  if (!isRecord(value)) {
    return false
  }
  return (
    isChildPageInfo(value.documents) &&
    isChildPageInfo(value.amendments) &&
    isChildPageInfo(value.votes) &&
    value.documents.limit <= 25 &&
    value.amendments.limit <= 25 &&
    value.votes.limit <= 25
  )
}

function isChildPageInfo(value: unknown): value is ChildCollectionPageInfo {
  return (
    isRecord(value) &&
    isSafeNonnegativeInteger(value.limit) &&
    value.limit > 0 &&
    isNullableString(value.nextCursor) &&
    typeof value.truncated === "boolean"
  )
}

function isVoteCounts(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  return ["yes", "no", "absent", "abstain", "notVoting", "present", "proxy", "paired", "other"].every((key) =>
    isSafeNonnegativeInteger(value[key])
  )
}

function isSourceReferences(value: unknown): value is readonly [SourceReference, ...SourceReference[]] {
  return Array.isArray(value) && value.length > 0 && value.every(isSourceReference)
}

function isSourceReference(value: unknown): value is SourceReference {
  return (
    isRecord(value) &&
    isNonEmptyString(value.provider) &&
    isNonEmptyString(value.sourceUrl) &&
    isNullableRfc3339Timestamp(value.sourceUpdatedAt) &&
    isRfc3339Timestamp(value.retrievedAt) &&
    typeof value.isOfficial === "boolean"
  )
}

function isProcessingStatus(value: unknown): boolean {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "processed" ||
    value === "failed" ||
    value === "unsupported"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDateValue(value: unknown): value is DateValue {
  return value instanceof Date || typeof value === "string"
}

function isNullableDateValue(value: unknown): value is DateValue | null {
  return value === null || isDateValue(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string")
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value)
}

function isNullableRfc3339Timestamp(value: unknown): value is string | null {
  return value === null || isRfc3339Timestamp(value)
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function arrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is readonly T[] {
  return Array.isArray(value) && value.every(guard)
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
