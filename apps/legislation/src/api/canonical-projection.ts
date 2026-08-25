export type DateValue = Date | string

export interface SourceReference {
  provider: string
  sourceUrl: string
  sourceUpdatedAt: string | null
  retrievedAt: string
  isOfficial: boolean
}

export type SourceReferences = [SourceReference, ...SourceReference[]]

export interface CanonicalFields {
  id: string
  canonicalUrl: string
  sources: SourceReferences
  updatedAt: string
}

export interface ProjectionSourceInput {
  provider: string
  sourceUrl: string
  sourceUpdatedAt: DateValue | null
  retrievedAt: DateValue
  isOfficial: boolean
}

export interface ProjectionContext {
  apiBaseUrl: string
  sources: readonly [ProjectionSourceInput, ...ProjectionSourceInput[]]
  updatedAt: DateValue
}

interface SourceRecord {
  id: string
  sourceUrl: string
}

type JurisdictionClassification = "country" | "state" | "district" | "territory"
type ProcessingStatus = "pending" | "processing" | "processed" | "failed" | "unsupported"
type OcrStatus = "not-required" | ProcessingStatus
type DocumentClassification = "version" | "amendment" | "fiscal-note" | "analysis" | "supplemental"
type AmendmentRecordType = "structured" | "document"
type VoteResult = "passed" | "failed" | "other"
type ChangeClassification = "create" | "update" | "delete" | "cancel" | "reschedule" | "relationship-change"

export interface Jurisdiction extends CanonicalFields {
  type: "jurisdiction"
  name: string
  classification: JurisdictionClassification
  timezone: string | null
  isActive: boolean
}

export interface Session extends CanonicalFields {
  type: "session"
  jurisdictionId: string
  name: string
  classification: string
  startDate: string | null
  endDate: string | null
  isActive: boolean
}

export interface BillSummary extends CanonicalFields {
  type: "bill"
  jurisdictionId: string
  sessionId: string
  identifier: string
  title: string
  classification: string[]
  status: string | null
  subjects: string[]
  introducedDate: string | null
  latestActionAt: string | null
}

export interface PersonSummary extends CanonicalFields {
  type: "person"
  name: string
  givenName: string | null
  familyName: string | null
  party: string | null
  imageUrl: string | null
  isActive: boolean
  jurisdictionIds: string[]
}

export interface OrganizationSummary extends CanonicalFields {
  type: "organization"
  jurisdictionId: string
  name: string
  classification: "legislature" | "chamber" | "committee" | "subcommittee" | "commission" | "agency" | "other"
  parentOrganizationId: string | null
  chamber: "lower" | "upper" | "unicameral" | "legislature" | null
  isActive: boolean
}

export interface ExternalIdentifier {
  scheme: string
  value: string
  sourceUrl: string | null
}

export interface LegislativeTerm extends CanonicalFields {
  type: "legislative-term"
  personId: string
  jurisdictionId: string
  organizationId: string | null
  district: string | null
  officeTitle: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface Membership extends CanonicalFields {
  type: "membership"
  person: PersonSummary
  organization: OrganizationSummary
  role: string
  label: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface PersonDetail extends PersonSummary {
  otherNames: string[]
  email: string | null
  officialUrl: string | null
  externalIdentifiers: ExternalIdentifier[]
  terms: LegislativeTerm[]
  memberships: Membership[]
  membershipsPageInfo: ChildCollectionPageInfo
}

export interface PublicContact {
  address: string | null
  phone: string | null
  email: string | null
}

export interface OrganizationDetail extends OrganizationSummary {
  description: string | null
  websiteUrl: string | null
  contact: PublicContact | null
  children: OrganizationSummary[]
  memberships: Membership[]
  termsOfReference: string | null
  childPageInfo: { memberships: ChildCollectionPageInfo }
}

export interface EventLocation {
  name: string | null
  address: string | null
  room: string | null
  virtualUrl: string | null
}

export interface MeetingParticipant extends CanonicalFields {
  type: "meeting-participant"
  meetingId: string
  person: PersonSummary | null
  organization: OrganizationSummary | null
  name: string
  role: string | null
}

export interface AgendaItem extends CanonicalFields {
  type: "agenda-item"
  meetingId: string
  ordinal: number
  title: string
  description: string | null
  billIds: string[]
  amendmentIds: string[]
  materialIds: string[]
  status: string | null
}

export interface EventDocument extends CanonicalFields {
  type: "event-document"
  meetingId: string
  title: string
  classification: string
  documentId: string | null
  materialId: string | null
  sourceUrl: string
}

export interface MeetingOutcome extends CanonicalFields {
  type: "meeting-outcome"
  meetingId: string
  agendaItemId: string | null
  classification: "action" | "vote" | "disposition" | "note"
  description: string
  billActionId: string | null
  voteId: string | null
  linkMethod: "explicit" | "deterministic-id"
}

export interface MeetingSummary extends CanonicalFields {
  type: "meeting"
  jurisdictionId: string
  sessionIds: string[]
  organizationIds: string[]
  calendarId: string | null
  title: string
  description: string | null
  classification: "meeting" | "hearing" | "session" | "other"
  status: "scheduled" | "completed" | "cancelled" | "postponed" | "other"
  startsAt: string | null
  endsAt: string | null
  date: string
  location: EventLocation | null
  isRemote: boolean
}

export interface MeetingDetail extends MeetingSummary {
  organizations: OrganizationSummary[]
  participants: MeetingParticipant[]
  agenda: AgendaItem[]
  documents: EventDocument[]
  outcomes: MeetingOutcome[]
  childPageInfo: Record<"participants" | "agenda" | "documents" | "outcomes", ChildCollectionPageInfo>
}

export interface Sponsor {
  person: PersonSummary | null
  sourceName: string
  classification: "primary" | "cosponsor" | "author" | "other"
  isPrimary: boolean
  sources: SourceReferences
}

export interface BillRelation {
  relatedBill: BillSummary
  classification: "companion" | "replacement" | "replaced-by" | "prior-session" | "related" | "other"
  sources: SourceReferences
}

export interface BillAction extends CanonicalFields {
  type: "bill-action"
  billId: string
  description: string
  date: string
  occurredAt: string | null
  sequence: number
  classifications: string[]
  organization: OrganizationSummary | null
}

export interface ChildCollectionPageInfo {
  limit: number
  nextCursor: string | null
  truncated: boolean
}

export interface BillDetail extends BillSummary {
  abstract: string | null
  sponsors: Sponsor[]
  organizations: OrganizationSummary[]
  documents: DocumentSummary[]
  relations: BillRelation[]
  amendments: AmendmentSummary[]
  latestActions: BillAction[]
  voteSummaries: VoteSummary[]
  childPageInfo: Record<"documents" | "amendments" | "votes", ChildCollectionPageInfo>
}

export interface AmendmentSummary extends CanonicalFields {
  type: "amendment"
  billId: string
  jurisdictionId: string
  recordType: AmendmentRecordType
  identifier: string
  title: string
  submittedDate: string | null
  status: string | null
  documentId: string | null
}

export interface AmendmentAction extends CanonicalFields {
  type: "amendment-action"
  amendmentId: string
  description: string
  date: string
  occurredAt: string | null
  sequence: number
  classifications: string[]
}

export interface AmendmentDetail extends AmendmentSummary {
  description: string | null
  sponsors: Sponsor[]
  actions: AmendmentAction[]
  documents: DocumentSummary[]
}

export interface VoteCounts {
  yes: number
  no: number
  absent: number
  abstain: number
  notVoting: number
  present: number
  proxy: number
  paired: number
  other: number
}

export interface VoteSummary extends CanonicalFields {
  type: "vote"
  billId: string | null
  organizationId: string | null
  motion: string
  question: string | null
  classification: string | null
  heldAt: string | null
  date: string
  result: VoteResult
  counts: VoteCounts
}

export interface VotePosition extends CanonicalFields {
  type: "vote-position"
  voteId: string
  person: PersonSummary | null
  option: "yes" | "no" | "absent" | "abstain" | "not-voting" | "present" | "proxy" | "paired" | "other"
  sourceName: string
  sourcePersonId: string | null
}

export interface VoteDetail extends VoteSummary {
  positions: VotePosition[]
  positionsPageInfo: ChildCollectionPageInfo
}

export interface DocumentSummary extends CanonicalFields {
  type: "document"
  billId: string | null
  classification: DocumentClassification
  title: string
  documentDate: string | null
  versionCode: string | null
  mimeType: string | null
  sourceUrl: string
  storedUrl: string | null
  processingStatus: ProcessingStatus
  ocrStatus: OcrStatus
  contentHash: string | null
}

export interface DocumentDetail extends DocumentSummary {
  byteSize: number | null
  pageCount: number | null
  sectionCount: number
  textCharacterCount: number
  failureCategory: string | null
}

export interface DocumentSection extends CanonicalFields {
  type: "document-section"
  documentId: string
  billId: string | null
  ordinal: number
  heading: string | null
  text: string
  startOffset: number
  endOffset: number
  pageStart: number | null
  pageEnd: number | null
  contentHash: string
  sourceUrl: string
}

export interface SupportingMaterialSummary extends CanonicalFields {
  type: "supporting-material"
  jurisdictionId: string
  classification: string
  title: string
  billIds: string[]
  amendmentIds: string[]
  meetingIds: string[]
  organizationIds: string[]
  documentDate: string | null
  sourceUrl: string
  mimeType: string | null
  processingStatus: ProcessingStatus
}

export interface SupportingMaterialDetail extends SupportingMaterialSummary {
  storedUrl: string | null
  byteSize: number | null
  pageCount: number | null
  sectionCount: number
  textCharacterCount: number
}

export interface SupportingMaterialSection extends CanonicalFields {
  type: "supporting-material-section"
  materialId: string
  ordinal: number
  heading: string | null
  text: string
  pageStart: number | null
  pageEnd: number | null
  contentHash: string
  sourceUrl: string
}

export interface ChangeEvent extends CanonicalFields {
  type: "change"
  recordType: string
  recordId: string
  classification: ChangeClassification
  changedFields: string[]
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  jurisdictionId: string | null
  organizationId: string | null
  personId: string | null
  observedAt: string
  sourceUpdatedAt: string | null
}

export type JurisdictionProjectionInput = SourceRecord & {
  name: string
  classification: JurisdictionClassification
  timezone: string | null
  isActive: boolean
}

export type SessionProjectionInput = SourceRecord & {
  jurisdictionId: string
  name: string
  classification: string
  startDate: DateValue | null
  endDate: DateValue | null
  isActive: boolean
}

export type PersonSummaryProjectionInput = SourceRecord & {
  name: string
  givenName: string | null
  familyName: string | null
  party: string | null
  imageUrl: string | null
  isActive: boolean
  jurisdictionIds: readonly string[]
}

export interface PersonDetailProjectionInput {
  person: PersonSummaryProjectionInput
  otherNames: readonly string[]
  email: string | null
  officialUrl: string | null
  externalIdentifiers: readonly ExternalIdentifier[]
  terms: readonly LegislativeTerm[]
  memberships: readonly Membership[]
  membershipsPageInfo: ChildCollectionPageInfo
}

export type OrganizationSummaryProjectionInput = SourceRecord & {
  jurisdictionId: string
  name: string
  classification: OrganizationSummary["classification"]
  parentOrganizationId: string | null
  chamber: OrganizationSummary["chamber"]
  isActive: boolean
}

export interface OrganizationDetailProjectionInput {
  organization: OrganizationSummaryProjectionInput
  description: string | null
  websiteUrl: string | null
  contact: PublicContact | null
  children: readonly OrganizationSummary[]
  memberships: readonly Membership[]
  termsOfReference: string | null
  childPageInfo: OrganizationDetail["childPageInfo"]
}

export type LegislativeTermProjectionInput = SourceRecord & {
  personId: string
  jurisdictionId: string
  organizationId: string | null
  district: string | null
  officeTitle: string
  startDate: DateValue | null
  endDate: DateValue | null
  isCurrent: boolean
}

export type MembershipProjectionInput = SourceRecord & {
  person: PersonSummary
  organization: OrganizationSummary
  role: string
  label: string | null
  startDate: DateValue | null
  endDate: DateValue | null
  isCurrent: boolean
}

export type MeetingSummaryProjectionInput = SourceRecord & {
  jurisdictionId: string
  sessionIds: readonly string[]
  organizationIds: readonly string[]
  calendarId: string | null
  title: string
  description: string | null
  classification: MeetingSummary["classification"]
  status: MeetingSummary["status"]
  startsAt: DateValue | null
  endsAt: DateValue | null
  date: DateValue
  location: EventLocation | null
  isRemote: boolean
}

export interface MeetingDetailProjectionInput {
  meeting: MeetingSummaryProjectionInput
  organizations: readonly OrganizationSummary[]
  participants: readonly MeetingParticipant[]
  agenda: readonly AgendaItem[]
  documents: readonly EventDocument[]
  outcomes: readonly MeetingOutcome[]
  childPageInfo: MeetingDetail["childPageInfo"]
}

export type MeetingParticipantProjectionInput = SourceRecord & {
  meetingId: string
  person: PersonSummary | null
  organization: OrganizationSummary | null
  name: string
  role: string | null
}

export type AgendaItemProjectionInput = SourceRecord & {
  meetingId: string
  ordinal: number
  title: string
  description: string | null
  billIds: readonly string[]
  amendmentIds: readonly string[]
  materialIds: readonly string[]
  status: string | null
}

export type EventDocumentProjectionInput = SourceRecord & {
  meetingId: string
  title: string
  classification: string
  documentId: string | null
  materialId: string | null
}

export type MeetingOutcomeProjectionInput = SourceRecord & {
  meetingId: string
  agendaItemId: string | null
  classification: MeetingOutcome["classification"]
  description: string
  billActionId: string | null
  voteId: string | null
  linkMethod: MeetingOutcome["linkMethod"]
}

export type BillSummaryProjectionInput = SourceRecord & {
  jurisdictionId: string
  sessionId: string
  identifier: string
  title: string
  classification: readonly string[]
  status: string | null
  subjects: readonly string[]
  introducedDate: DateValue | null
  latestActionAt: DateValue | null
}

export interface BillDetailProjectionInput {
  bill: BillSummaryProjectionInput
  abstract: string | null
  sponsors: readonly Sponsor[]
  organizations: readonly OrganizationSummary[]
  documents: readonly DocumentSummary[]
  relations: readonly BillRelation[]
  amendments: readonly AmendmentSummary[]
  latestActions: readonly BillAction[]
  voteSummaries: readonly VoteSummary[]
  childPageInfo: BillDetail["childPageInfo"]
}

export type AmendmentSummaryProjectionInput = SourceRecord & {
  billId: string
  jurisdictionId: string
  recordType: AmendmentRecordType
  identifier: string
  title: string
  submittedDate: DateValue | null
  status: string | null
  documentId: string | null
}

export interface AmendmentDetailProjectionInput {
  amendment: AmendmentSummaryProjectionInput
  description: string | null
  sponsors: readonly Sponsor[]
  actions: readonly AmendmentAction[]
  documents: readonly DocumentSummary[]
}

export type VoteSummaryProjectionInput = SourceRecord & {
  billId: string | null
  organizationId: string | null
  motion: string
  question: string | null
  classification: string | null
  heldAt: DateValue | null
  date: DateValue
  result: VoteResult
  counts: VoteCounts
}

export interface VoteDetailProjectionInput {
  vote: VoteSummaryProjectionInput
  positions: readonly VotePosition[]
  positionsPageInfo: ChildCollectionPageInfo
}

export type DocumentSummaryProjectionInput = SourceRecord & {
  billId: string | null
  classification: DocumentClassification
  title: string
  documentDate: DateValue | null
  versionCode: string | null
  mimeType: string | null
  storedUrl: string | null
  processingStatus: ProcessingStatus
  ocrStatus: OcrStatus
  contentHash: string | null
}

export type DocumentDetailProjectionInput = DocumentSummaryProjectionInput & {
  byteSize: number | null
  pageCount: number | null
  sectionCount: number
  textCharacterCount: number
  failureCategory: string | null
}

export type DocumentSectionProjectionInput = SourceRecord & {
  documentId: string
  billId: string | null
  ordinal: number
  heading: string | null
  text: string
  startOffset: number
  endOffset: number
  pageStart: number | null
  pageEnd: number | null
  contentHash: string
}

export type SupportingMaterialSummaryProjectionInput = SourceRecord & {
  jurisdictionId: string
  classification: string
  title: string
  billIds: readonly string[]
  amendmentIds: readonly string[]
  meetingIds: readonly string[]
  organizationIds: readonly string[]
  documentDate: DateValue | null
  mimeType: string | null
  processingStatus: ProcessingStatus
}

export type SupportingMaterialDetailProjectionInput = SupportingMaterialSummaryProjectionInput & {
  storedUrl: string | null
  byteSize: number | null
  pageCount: number | null
  sectionCount: number
  textCharacterCount: number
}

export type SupportingMaterialSectionProjectionInput = SourceRecord & {
  materialId: string
  ordinal: number
  heading: string | null
  text: string
  pageStart: number | null
  pageEnd: number | null
  contentHash: string
}

export interface ChangeEventProjectionInput {
  id: string
  recordType: string
  recordId: string
  classification: ChangeClassification
  changedFields: readonly string[]
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  jurisdictionId: string | null
  organizationId: string | null
  personId: string | null
  observedAt: DateValue
  sourceUpdatedAt: DateValue | null
}

export class CanonicalProjectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CanonicalProjectionError"
  }
}

export function projectJurisdiction(input: JurisdictionProjectionInput, context: ProjectionContext): Jurisdiction {
  return {
    ...canonical(input.id, `/api/jurisdictions/${segment(input.id)}`, context),
    type: "jurisdiction",
    name: required(input.name, "jurisdiction name"),
    classification: input.classification,
    timezone: input.timezone,
    isActive: input.isActive
  }
}

export function projectSession(input: SessionProjectionInput, context: ProjectionContext): Session {
  return {
    ...canonical(input.id, `/api/sessions/${segment(input.id)}`, context),
    type: "session",
    jurisdictionId: required(input.jurisdictionId, "session jurisdictionId"),
    name: required(input.name, "session name"),
    classification: required(input.classification, "session classification"),
    startDate: isoDate(input.startDate, "session startDate"),
    endDate: isoDate(input.endDate, "session endDate"),
    isActive: input.isActive
  }
}

export function projectPersonSummary(input: PersonSummaryProjectionInput, context: ProjectionContext): PersonSummary {
  return {
    ...canonical(input.id, `/api/people/${segment(input.id)}`, context),
    type: "person",
    name: required(input.name, "person name"),
    givenName: input.givenName,
    familyName: input.familyName,
    party: input.party,
    imageUrl: optionalAbsoluteUrl(input.imageUrl, "person imageUrl"),
    isActive: input.isActive,
    jurisdictionIds: [...input.jurisdictionIds]
  }
}

export function projectPersonDetail(input: PersonDetailProjectionInput, context: ProjectionContext): PersonDetail {
  input.terms.forEach(validateLegislativeTerm)
  input.memberships.forEach((membership) => validateMembership(membership))
  input.externalIdentifiers.forEach(validateExternalIdentifier)
  return {
    ...projectPersonSummary(input.person, context),
    otherNames: [...input.otherNames],
    email: input.email,
    officialUrl: optionalAbsoluteUrl(input.officialUrl, "person officialUrl"),
    externalIdentifiers: input.externalIdentifiers.map((identifier) => ({ ...identifier })),
    terms: input.terms.map((term) => structuredClone(term)),
    memberships: input.memberships.map((membership) => structuredClone(membership)),
    membershipsPageInfo: pageInfo(input.membershipsPageInfo, "person memberships")
  }
}

export function projectOrganizationSummary(
  input: OrganizationSummaryProjectionInput,
  context: ProjectionContext
): OrganizationSummary {
  return {
    ...canonical(input.id, `/api/organizations/${segment(input.id)}`, context),
    type: "organization",
    jurisdictionId: required(input.jurisdictionId, "organization jurisdictionId"),
    name: required(input.name, "organization name"),
    classification: input.classification,
    parentOrganizationId: input.parentOrganizationId,
    chamber: input.chamber,
    isActive: input.isActive
  }
}

export function projectOrganizationDetail(
  input: OrganizationDetailProjectionInput,
  context: ProjectionContext
): OrganizationDetail {
  input.children.forEach(validateOrganizationSummary)
  input.memberships.forEach((membership) => validateMembership(membership))
  return {
    ...projectOrganizationSummary(input.organization, context),
    description: input.description,
    websiteUrl: optionalAbsoluteUrl(input.websiteUrl, "organization websiteUrl"),
    contact: input.contact === null ? null : { ...input.contact },
    children: input.children.map((child) => structuredClone(child)),
    memberships: input.memberships.map((membership) => structuredClone(membership)),
    termsOfReference: input.termsOfReference,
    childPageInfo: { memberships: pageInfo(input.childPageInfo.memberships, "organization memberships") }
  }
}

export function projectLegislativeTerm(
  input: LegislativeTermProjectionInput,
  context: ProjectionContext
): LegislativeTerm {
  return {
    ...canonical(input.id, `/api/people/${segment(input.personId)}/terms/${segment(input.id)}`, context),
    type: "legislative-term",
    personId: required(input.personId, "legislative term personId"),
    jurisdictionId: required(input.jurisdictionId, "legislative term jurisdictionId"),
    organizationId: input.organizationId,
    district: input.district,
    officeTitle: required(input.officeTitle, "legislative term officeTitle"),
    startDate: isoDate(input.startDate, "legislative term startDate"),
    endDate: isoDate(input.endDate, "legislative term endDate"),
    isCurrent: input.isCurrent
  }
}

export function projectMembership(input: MembershipProjectionInput, context: ProjectionContext): Membership {
  validatePersonSummary(input.person)
  validateOrganizationSummary(input.organization)
  return {
    ...canonical(
      input.id,
      `/api/organizations/${segment(input.organization.id)}/memberships/${segment(input.id)}`,
      context
    ),
    type: "membership",
    person: structuredClone(input.person),
    organization: structuredClone(input.organization),
    role: required(input.role, "membership role"),
    label: input.label,
    startDate: isoDate(input.startDate, "membership startDate"),
    endDate: isoDate(input.endDate, "membership endDate"),
    isCurrent: input.isCurrent
  }
}

export function projectMeetingSummary(
  input: MeetingSummaryProjectionInput,
  context: ProjectionContext
): MeetingSummary {
  const startsAt = isoTimestamp(input.startsAt, "meeting startsAt")
  const endsAt = isoTimestamp(input.endsAt, "meeting endsAt")
  if (startsAt !== null && endsAt !== null && endsAt < startsAt) {
    throw new CanonicalProjectionError("meeting endsAt must not precede startsAt")
  }
  return {
    ...canonical(input.id, `/api/meetings/${segment(input.id)}`, context),
    type: "meeting",
    jurisdictionId: required(input.jurisdictionId, "meeting jurisdictionId"),
    sessionIds: [...input.sessionIds],
    organizationIds: [...input.organizationIds],
    calendarId: input.calendarId,
    title: required(input.title, "meeting title"),
    description: input.description,
    classification: input.classification,
    status: input.status,
    startsAt,
    endsAt,
    date: requiredIsoDate(input.date, "meeting date"),
    location: input.location === null ? null : eventLocation(input.location),
    isRemote: input.isRemote
  }
}

export function projectMeetingDetail(input: MeetingDetailProjectionInput, context: ProjectionContext): MeetingDetail {
  input.organizations.forEach(validateOrganizationSummary)
  input.participants.forEach((participant) => validateMeetingParticipant(participant))
  input.agenda.forEach((item) => validateAgendaItem(item))
  input.documents.forEach((document) => validateEventDocument(document))
  input.outcomes.forEach((outcome) => validateMeetingOutcome(outcome))
  return {
    ...projectMeetingSummary(input.meeting, context),
    organizations: input.organizations.map((organization) => structuredClone(organization)),
    participants: input.participants.map((participant) => structuredClone(participant)),
    agenda: input.agenda.map((item) => structuredClone(item)),
    documents: input.documents.map((document) => structuredClone(document)),
    outcomes: input.outcomes.map((outcome) => structuredClone(outcome)),
    childPageInfo: {
      participants: pageInfo(input.childPageInfo.participants, "meeting participants"),
      agenda: pageInfo(input.childPageInfo.agenda, "meeting agenda"),
      documents: pageInfo(input.childPageInfo.documents, "meeting documents"),
      outcomes: pageInfo(input.childPageInfo.outcomes, "meeting outcomes")
    }
  }
}

export function projectMeetingParticipant(
  input: MeetingParticipantProjectionInput,
  context: ProjectionContext
): MeetingParticipant {
  if (input.person !== null) {
    validatePersonSummary(input.person)
  }
  if (input.organization !== null) {
    validateOrganizationSummary(input.organization)
  }
  return {
    ...canonical(input.id, `/api/meetings/${segment(input.meetingId)}/participants/${segment(input.id)}`, context),
    type: "meeting-participant",
    meetingId: required(input.meetingId, "meeting participant meetingId"),
    person: input.person === null ? null : structuredClone(input.person),
    organization: input.organization === null ? null : structuredClone(input.organization),
    name: required(input.name, "meeting participant name"),
    role: input.role
  }
}

export function projectAgendaItem(input: AgendaItemProjectionInput, context: ProjectionContext): AgendaItem {
  return {
    ...canonical(input.id, `/api/meetings/${segment(input.meetingId)}/agenda/${segment(input.id)}`, context),
    type: "agenda-item",
    meetingId: required(input.meetingId, "agenda item meetingId"),
    ordinal: nonnegativeInteger(input.ordinal, "agenda item ordinal"),
    title: required(input.title, "agenda item title"),
    description: input.description,
    billIds: [...input.billIds],
    amendmentIds: [...input.amendmentIds],
    materialIds: [...input.materialIds],
    status: input.status
  }
}

export function projectEventDocument(input: EventDocumentProjectionInput, context: ProjectionContext): EventDocument {
  return {
    ...canonical(input.id, `/api/meetings/${segment(input.meetingId)}/documents/${segment(input.id)}`, context),
    type: "event-document",
    meetingId: required(input.meetingId, "event document meetingId"),
    title: required(input.title, "event document title"),
    classification: required(input.classification, "event document classification"),
    documentId: input.documentId,
    materialId: input.materialId,
    sourceUrl: absoluteUrl(input.sourceUrl, "event document sourceUrl")
  }
}

export function projectMeetingOutcome(
  input: MeetingOutcomeProjectionInput,
  context: ProjectionContext
): MeetingOutcome {
  return {
    ...canonical(input.id, `/api/meetings/${segment(input.meetingId)}/outcomes/${segment(input.id)}`, context),
    type: "meeting-outcome",
    meetingId: required(input.meetingId, "meeting outcome meetingId"),
    agendaItemId: input.agendaItemId,
    classification: input.classification,
    description: required(input.description, "meeting outcome description"),
    billActionId: input.billActionId,
    voteId: input.voteId,
    linkMethod: input.linkMethod
  }
}

export function projectBillSummary(input: BillSummaryProjectionInput, context: ProjectionContext): BillSummary {
  return {
    ...canonical(input.id, `/api/bills/${segment(input.id)}`, context),
    type: "bill",
    jurisdictionId: required(input.jurisdictionId, "bill jurisdictionId"),
    sessionId: required(input.sessionId, "bill sessionId"),
    identifier: required(input.identifier, "bill identifier"),
    title: required(input.title, "bill title"),
    classification: [...input.classification],
    status: input.status === null ? null : required(input.status, "bill status"),
    subjects: [...input.subjects],
    introducedDate: isoDate(input.introducedDate, "bill introducedDate"),
    latestActionAt: isoTimestamp(input.latestActionAt, "bill latestActionAt")
  }
}

export function projectBillDetail(input: BillDetailProjectionInput, context: ProjectionContext): BillDetail {
  input.sponsors.forEach(validateSponsor)
  input.organizations.forEach(validateOrganizationSummary)
  input.documents.forEach(validateDocumentSummary)
  input.relations.forEach(validateBillRelation)
  input.amendments.forEach(validateAmendmentSummary)
  input.latestActions.forEach(validateBillAction)
  input.voteSummaries.forEach(validateVoteSummary)
  return {
    ...projectBillSummary(input.bill, context),
    abstract: input.abstract,
    sponsors: input.sponsors.map((sponsor) => structuredClone(sponsor)),
    organizations: input.organizations.map((organization) => structuredClone(organization)),
    documents: input.documents.map((document) => structuredClone(document)),
    relations: input.relations.map((relation) => structuredClone(relation)),
    amendments: input.amendments.map((amendment) => structuredClone(amendment)),
    latestActions: input.latestActions.map((action) => structuredClone(action)),
    voteSummaries: input.voteSummaries.map((vote) => structuredClone(vote)),
    childPageInfo: {
      documents: pageInfo(input.childPageInfo.documents, "bill documents"),
      amendments: pageInfo(input.childPageInfo.amendments, "bill amendments"),
      votes: pageInfo(input.childPageInfo.votes, "bill votes")
    }
  }
}

export function projectAmendmentSummary(
  input: AmendmentSummaryProjectionInput,
  context: ProjectionContext
): AmendmentSummary {
  return {
    ...canonical(input.id, `/api/amendments/${segment(input.id)}`, context),
    type: "amendment",
    billId: required(input.billId, "amendment billId"),
    jurisdictionId: required(input.jurisdictionId, "amendment jurisdictionId"),
    recordType: input.recordType,
    identifier: required(input.identifier, "amendment identifier"),
    title: required(input.title, "amendment title"),
    submittedDate: isoDate(input.submittedDate, "amendment submittedDate"),
    status: input.status,
    documentId: input.documentId
  }
}

export function projectAmendmentDetail(
  input: AmendmentDetailProjectionInput,
  context: ProjectionContext
): AmendmentDetail {
  input.sponsors.forEach(validateSponsor)
  input.actions.forEach(validateAmendmentAction)
  input.documents.forEach(validateDocumentSummary)
  return {
    ...projectAmendmentSummary(input.amendment, context),
    description: input.description,
    sponsors: input.sponsors.map((sponsor) => structuredClone(sponsor)),
    actions: input.actions.map((action) => structuredClone(action)),
    documents: input.documents.map((document) => structuredClone(document))
  }
}

export function projectVoteSummary(input: VoteSummaryProjectionInput, context: ProjectionContext): VoteSummary {
  return {
    ...canonical(input.id, `/api/votes/${segment(input.id)}`, context),
    type: "vote",
    billId: input.billId,
    organizationId: input.organizationId,
    motion: required(input.motion, "vote motion"),
    question: input.question,
    classification: input.classification,
    heldAt: isoTimestamp(input.heldAt, "vote heldAt"),
    date: requiredIsoDate(input.date, "vote date"),
    result: input.result,
    counts: voteCounts(input.counts)
  }
}

export function projectVoteDetail(input: VoteDetailProjectionInput, context: ProjectionContext): VoteDetail {
  input.positions.forEach(validateVotePosition)
  return {
    ...projectVoteSummary(input.vote, context),
    positions: input.positions.map((position) => structuredClone(position)),
    positionsPageInfo: pageInfo(input.positionsPageInfo, "vote positions")
  }
}

export function projectDocumentSummary(
  input: DocumentSummaryProjectionInput,
  context: ProjectionContext
): DocumentSummary {
  return {
    ...canonical(input.id, `/api/documents/${segment(input.id)}`, context),
    type: "document",
    billId: input.billId,
    classification: input.classification,
    title: required(input.title, "document title"),
    documentDate: isoDate(input.documentDate, "document documentDate"),
    versionCode: input.versionCode,
    mimeType: input.mimeType,
    sourceUrl: absoluteUrl(input.sourceUrl, "document sourceUrl"),
    storedUrl: optionalAbsoluteUrl(input.storedUrl, "document storedUrl"),
    processingStatus: input.processingStatus,
    ocrStatus: input.ocrStatus,
    contentHash: input.contentHash
  }
}

export function projectDocumentDetail(
  input: DocumentDetailProjectionInput,
  context: ProjectionContext
): DocumentDetail {
  return {
    ...projectDocumentSummary(input, context),
    byteSize: nullableNonnegativeInteger(input.byteSize, "document byteSize"),
    pageCount: nullableNonnegativeInteger(input.pageCount, "document pageCount"),
    sectionCount: nonnegativeInteger(input.sectionCount, "document sectionCount"),
    textCharacterCount: nonnegativeInteger(input.textCharacterCount, "document textCharacterCount"),
    failureCategory: input.failureCategory
  }
}

export function projectDocumentSection(
  input: DocumentSectionProjectionInput,
  context: ProjectionContext
): DocumentSection {
  const startOffset = nonnegativeInteger(input.startOffset, "document section startOffset")
  const endOffset = nonnegativeInteger(input.endOffset, "document section endOffset")
  const pageStart = nullableNonnegativeInteger(input.pageStart, "document section pageStart")
  const pageEnd = nullableNonnegativeInteger(input.pageEnd, "document section pageEnd")
  if (endOffset < startOffset) {
    throw new CanonicalProjectionError("document section endOffset must not precede startOffset")
  }
  if (pageStart !== null && pageEnd !== null && pageEnd < pageStart) {
    throw new CanonicalProjectionError("document section pageEnd must not precede pageStart")
  }
  return {
    ...canonical(input.id, `/api/documents/${segment(input.documentId)}/sections/${segment(input.id)}`, context),
    type: "document-section",
    documentId: required(input.documentId, "document section documentId"),
    billId: input.billId,
    ordinal: nonnegativeInteger(input.ordinal, "document section ordinal"),
    heading: input.heading,
    text: required(input.text, "document section text"),
    startOffset,
    endOffset,
    pageStart,
    pageEnd,
    contentHash: required(input.contentHash, "document section contentHash"),
    sourceUrl: absoluteUrl(input.sourceUrl, "document section sourceUrl")
  }
}

export function projectSupportingMaterialSummary(
  input: SupportingMaterialSummaryProjectionInput,
  context: ProjectionContext
): SupportingMaterialSummary {
  return {
    ...canonical(input.id, `/api/supporting-materials/${segment(input.id)}`, context),
    type: "supporting-material",
    jurisdictionId: required(input.jurisdictionId, "supporting material jurisdictionId"),
    classification: required(input.classification, "supporting material classification"),
    title: required(input.title, "supporting material title"),
    billIds: [...input.billIds],
    amendmentIds: [...input.amendmentIds],
    meetingIds: [...input.meetingIds],
    organizationIds: [...input.organizationIds],
    documentDate: isoDate(input.documentDate, "supporting material documentDate"),
    sourceUrl: absoluteUrl(input.sourceUrl, "supporting material sourceUrl"),
    mimeType: input.mimeType,
    processingStatus: input.processingStatus
  }
}

export function projectSupportingMaterialDetail(
  input: SupportingMaterialDetailProjectionInput,
  context: ProjectionContext
): SupportingMaterialDetail {
  return {
    ...projectSupportingMaterialSummary(input, context),
    storedUrl: optionalAbsoluteUrl(input.storedUrl, "supporting material storedUrl"),
    byteSize: nullableNonnegativeInteger(input.byteSize, "supporting material byteSize"),
    pageCount: nullableNonnegativeInteger(input.pageCount, "supporting material pageCount"),
    sectionCount: nonnegativeInteger(input.sectionCount, "supporting material sectionCount"),
    textCharacterCount: nonnegativeInteger(input.textCharacterCount, "supporting material textCharacterCount")
  }
}

export function projectSupportingMaterialSection(
  input: SupportingMaterialSectionProjectionInput,
  context: ProjectionContext
): SupportingMaterialSection {
  const pageStart = nullablePositiveInteger(input.pageStart, "supporting material section pageStart")
  const pageEnd = nullablePositiveInteger(input.pageEnd, "supporting material section pageEnd")
  if ((pageStart === null) !== (pageEnd === null)) {
    throw new CanonicalProjectionError("supporting material section pages must both be null or both be present")
  }
  if (pageStart !== null && pageEnd !== null && pageEnd < pageStart) {
    throw new CanonicalProjectionError("supporting material section pageEnd must not precede pageStart")
  }
  return {
    ...canonical(
      input.id,
      `/api/supporting-materials/${segment(input.materialId)}/sections/${segment(input.id)}`,
      context
    ),
    type: "supporting-material-section",
    materialId: required(input.materialId, "supporting material section materialId"),
    ordinal: nonnegativeInteger(input.ordinal, "supporting material section ordinal"),
    heading: input.heading,
    text: required(input.text, "supporting material section text"),
    pageStart,
    pageEnd,
    contentHash: required(input.contentHash, "supporting material section contentHash"),
    sourceUrl: absoluteUrl(input.sourceUrl, "supporting material section sourceUrl")
  }
}

export function projectChangeEvent(input: ChangeEventProjectionInput, context: ProjectionContext): ChangeEvent {
  return {
    ...canonical(input.id, `/api/changes/${segment(input.id)}`, context),
    type: "change",
    recordType: required(input.recordType, "change recordType"),
    recordId: required(input.recordId, "change recordId"),
    classification: input.classification,
    changedFields: [...input.changedFields],
    before: boundedSnapshot(input.before, "change before"),
    after: boundedSnapshot(input.after, "change after"),
    jurisdictionId: input.jurisdictionId,
    organizationId: input.organizationId,
    personId: input.personId,
    observedAt: requiredIsoTimestamp(input.observedAt, "change observedAt"),
    sourceUpdatedAt: isoTimestamp(input.sourceUpdatedAt, "change sourceUpdatedAt")
  }
}

function canonical(id: string, path: string, context: ProjectionContext): CanonicalFields {
  return {
    id: required(id, "canonical id"),
    canonicalUrl: new URL(path, normalizeBaseUrl(context.apiBaseUrl)).toString(),
    sources: projectSources(context.sources),
    updatedAt: requiredIsoTimestamp(context.updatedAt, "canonical updatedAt")
  }
}

function projectSource(input: ProjectionSourceInput): SourceReference {
  return {
    provider: required(input.provider, "source provider"),
    sourceUrl: absoluteUrl(input.sourceUrl, "source URL"),
    sourceUpdatedAt: isoTimestamp(input.sourceUpdatedAt, "source updatedAt"),
    retrievedAt: requiredIsoTimestamp(input.retrievedAt, "source retrievedAt"),
    isOfficial: input.isOfficial
  }
}

function projectSources(inputs: readonly [ProjectionSourceInput, ...ProjectionSourceInput[]]): SourceReferences {
  const [first, ...rest] = inputs
  return [projectSource(first), ...rest.map(projectSource)]
}

function voteCounts(input: VoteCounts): VoteCounts {
  return {
    yes: nonnegativeInteger(input.yes, "vote count yes"),
    no: nonnegativeInteger(input.no, "vote count no"),
    absent: nonnegativeInteger(input.absent, "vote count absent"),
    abstain: nonnegativeInteger(input.abstain, "vote count abstain"),
    notVoting: nonnegativeInteger(input.notVoting, "vote count notVoting"),
    present: nonnegativeInteger(input.present, "vote count present"),
    proxy: nonnegativeInteger(input.proxy, "vote count proxy"),
    paired: nonnegativeInteger(input.paired, "vote count paired"),
    other: nonnegativeInteger(input.other, "vote count other")
  }
}

function validateCanonicalRecord(input: CanonicalFields, label: string): void {
  required(input.id, `${label} id`)
  absoluteUrl(input.canonicalUrl, `${label} canonicalUrl`)
  requiredIsoTimestamp(input.updatedAt, `${label} updatedAt`)
  if (!Array.isArray(input.sources) || input.sources.length === 0) {
    throw new CanonicalProjectionError(`${label} sources must be non-empty`)
  }
  input.sources.forEach((source) => projectSource(source))
}

function validatePersonSummary(input: PersonSummary): void {
  validateCanonicalRecord(input, "person")
  required(input.name, "person name")
  optionalAbsoluteUrl(input.imageUrl, "person imageUrl")
}

function validateOrganizationSummary(input: OrganizationSummary): void {
  validateCanonicalRecord(input, "organization")
  required(input.jurisdictionId, "organization jurisdictionId")
  required(input.name, "organization name")
}

function validateLegislativeTerm(input: LegislativeTerm): void {
  validateCanonicalRecord(input, "legislative term")
  required(input.personId, "legislative term personId")
  required(input.jurisdictionId, "legislative term jurisdictionId")
  required(input.officeTitle, "legislative term officeTitle")
  isoDate(input.startDate, "legislative term startDate")
  isoDate(input.endDate, "legislative term endDate")
}

function validateBillSummary(input: BillSummary): void {
  validateCanonicalRecord(input, "bill")
  required(input.jurisdictionId, "bill jurisdictionId")
  required(input.sessionId, "bill sessionId")
  required(input.identifier, "bill identifier")
  required(input.title, "bill title")
  if (input.status !== null) {
    required(input.status, "bill status")
  }
  isoDate(input.introducedDate, "bill introducedDate")
  isoTimestamp(input.latestActionAt, "bill latestActionAt")
}

function validateDocumentSummary(input: DocumentSummary): void {
  validateCanonicalRecord(input, "bill document")
  required(input.title, "document title")
  isoDate(input.documentDate, "document documentDate")
  absoluteUrl(input.sourceUrl, "document sourceUrl")
  optionalAbsoluteUrl(input.storedUrl, "document storedUrl")
}

function validateAmendmentSummary(input: AmendmentSummary): void {
  validateCanonicalRecord(input, "bill amendment")
  required(input.billId, "amendment billId")
  required(input.jurisdictionId, "amendment jurisdictionId")
  required(input.identifier, "amendment identifier")
  required(input.title, "amendment title")
  isoDate(input.submittedDate, "amendment submittedDate")
}

function validateBillAction(input: BillAction): void {
  validateCanonicalRecord(input, "bill action")
  required(input.billId, "bill action billId")
  required(input.description, "bill action description")
  requiredIsoDate(input.date, "bill action date")
  isoTimestamp(input.occurredAt, "bill action occurredAt")
  nonnegativeInteger(input.sequence, "bill action sequence")
  if (input.organization !== null) {
    validateOrganizationSummary(input.organization)
  }
}

function validateAmendmentAction(input: AmendmentAction): void {
  validateCanonicalRecord(input, "amendment action")
  required(input.amendmentId, "amendment action amendmentId")
  required(input.description, "amendment action description")
  requiredIsoDate(input.date, "amendment action date")
  isoTimestamp(input.occurredAt, "amendment action occurredAt")
  nonnegativeInteger(input.sequence, "amendment action sequence")
}

function validateVoteSummary(input: VoteSummary): void {
  validateCanonicalRecord(input, "bill vote")
  required(input.motion, "vote motion")
  isoTimestamp(input.heldAt, "vote heldAt")
  requiredIsoDate(input.date, "vote date")
  voteCounts(input.counts)
}

function validateVotePosition(input: VotePosition): void {
  validateCanonicalRecord(input, "vote position")
  required(input.voteId, "vote position voteId")
  required(input.sourceName, "vote position sourceName")
  if (input.person !== null) {
    validatePersonSummary(input.person)
  }
}

function validateSponsor(input: Sponsor): void {
  required(input.sourceName, "sponsor sourceName")
  if (input.person !== null) {
    validatePersonSummary(input.person)
  }
  if (!Array.isArray(input.sources) || input.sources.length === 0) {
    throw new CanonicalProjectionError("sponsor sources must be non-empty")
  }
  input.sources.forEach((source) => projectSource(source))
}

function validateBillRelation(input: BillRelation): void {
  validateBillSummary(input.relatedBill)
  if (!Array.isArray(input.sources) || input.sources.length === 0) {
    throw new CanonicalProjectionError("bill relation sources must be non-empty")
  }
  input.sources.forEach((source) => projectSource(source))
}

function validateExternalIdentifier(input: ExternalIdentifier): void {
  required(input.scheme, "external identifier scheme")
  required(input.value, "external identifier value")
  optionalAbsoluteUrl(input.sourceUrl, "external identifier sourceUrl")
}

function validateMembership(input: Membership): void {
  validateCanonicalRecord(input, "membership")
  validatePersonSummary(input.person)
  validateOrganizationSummary(input.organization)
  required(input.role, "membership role")
  isoDate(input.startDate, "membership startDate")
  isoDate(input.endDate, "membership endDate")
}

function validateMeetingParticipant(input: MeetingParticipant): void {
  validateCanonicalRecord(input, "meeting participant")
  required(input.meetingId, "meeting participant meetingId")
  required(input.name, "meeting participant name")
  if (input.person !== null) {
    validatePersonSummary(input.person)
  }
  if (input.organization !== null) {
    validateOrganizationSummary(input.organization)
  }
}

function validateAgendaItem(input: AgendaItem): void {
  validateCanonicalRecord(input, "agenda item")
  required(input.meetingId, "agenda item meetingId")
  required(input.title, "agenda item title")
  nonnegativeInteger(input.ordinal, "agenda item ordinal")
}

function validateEventDocument(input: EventDocument): void {
  validateCanonicalRecord(input, "event document")
  required(input.meetingId, "event document meetingId")
  required(input.title, "event document title")
  required(input.classification, "event document classification")
  absoluteUrl(input.sourceUrl, "event document sourceUrl")
}

function validateMeetingOutcome(input: MeetingOutcome): void {
  validateCanonicalRecord(input, "meeting outcome")
  required(input.meetingId, "meeting outcome meetingId")
  required(input.description, "meeting outcome description")
}

function pageInfo(input: ChildCollectionPageInfo, label: string): ChildCollectionPageInfo {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new CanonicalProjectionError(`${label} limit must be an integer between 1 and 100`)
  }
  if (input.nextCursor !== null && input.nextCursor.length === 0) {
    throw new CanonicalProjectionError(`${label} nextCursor must be null or non-empty`)
  }
  return {
    limit: input.limit,
    nextCursor: input.nextCursor,
    truncated: input.truncated
  }
}

function eventLocation(input: EventLocation): EventLocation {
  return {
    name: input.name,
    address: input.address,
    room: input.room,
    virtualUrl: optionalAbsoluteUrl(input.virtualUrl, "meeting location virtualUrl")
  }
}

function required(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new CanonicalProjectionError(`${label} is required`)
  }
  return value
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CanonicalProjectionError(`${label} must be a nonnegative safe integer`)
  }
  return value
}

function nullableNonnegativeInteger(value: number | null, label: string): number | null {
  return value === null ? null : nonnegativeInteger(value, label)
}

function nullablePositiveInteger(value: number | null, label: string): number | null {
  if (value === null) {
    return null
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CanonicalProjectionError(`${label} must be a positive safe integer`)
  }
  return value
}

function isoDate(value: DateValue | null, label: string): string | null {
  return value === null ? null : requiredIsoDate(value, label)
}

function requiredIsoDate(value: DateValue, label: string): string {
  if (value instanceof Date) {
    assertValidDate(value, label)
    return value.toISOString().slice(0, 10)
  }
  if (!isIsoDate(value)) {
    throw new CanonicalProjectionError(`${label} must be an ISO date`)
  }
  return value
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return false
  }
  return true
}

function isoTimestamp(value: DateValue | null, label: string): string | null {
  return value === null ? null : requiredIsoTimestamp(value, label)
}

export function isRfc3339Timestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const calendar = new Date(Date.UTC(year, month - 1, day))
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return false
  }
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[8] === undefined ? 0 : Number(match[8])
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9])
  if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) {
    return false
  }
  return !Number.isNaN(new Date(value).valueOf())
}

function requiredIsoTimestamp(value: DateValue, label: string): string {
  if (value instanceof Date) {
    assertValidDate(value, label)
    return value.toISOString()
  }
  if (!isRfc3339Timestamp(value)) {
    throw new CanonicalProjectionError(`${label} must be an RFC 3339 timestamp with an explicit timezone`)
  }
  const date = new Date(value)
  assertValidDate(date, label)
  return date.toISOString()
}

function boundedSnapshot(input: Record<string, unknown> | null, label: string): Record<string, unknown> | null {
  if (input === null) {
    return null
  }
  let serialized: string
  try {
    serialized = JSON.stringify(input)
  } catch {
    throw new CanonicalProjectionError(`${label} must be serializable JSON`)
  }
  if (new TextEncoder().encode(serialized).byteLength > 64 * 1024) {
    throw new CanonicalProjectionError(`${label} must not exceed 64 KiB of UTF-8 JSON`)
  }
  return structuredClone(input)
}

function assertValidDate(value: Date, label: string): void {
  if (Number.isNaN(value.valueOf())) {
    throw new CanonicalProjectionError(`${label} must be a valid timestamp`)
  }
}

function absoluteUrl(value: string, label: string): string {
  try {
    return new URL(required(value, label)).toString()
  } catch (error) {
    if (error instanceof CanonicalProjectionError) {
      throw error
    }
    throw new CanonicalProjectionError(`${label} must be an absolute URL`)
  }
}

function optionalAbsoluteUrl(value: string | null, label: string): string | null {
  return value === null ? null : absoluteUrl(value, label)
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(absoluteUrl(value, "API base URL"))
  url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`
  return url.toString()
}

function segment(value: string): string {
  return encodeURIComponent(required(value, "path ID"))
}
