import { LegislationError } from "../legislation/errors.js"
import type { AmendmentReadRepository } from "./amendment-read-repository.js"
import type { BillDetailReadRepository } from "./bill-detail-read-repository.js"
import { projectCalendarDetailRead, type CalendarReadApi } from "./calendar-read-routes.js"
import type {
  AmendmentDetail,
  BillDetail,
  CalendarDetail,
  DocumentDetail,
  Jurisdiction,
  MeetingDetail,
  OrganizationDetail,
  PersonDetail,
  Session,
  SupportingMaterialDetail,
  VoteDetail
} from "./canonical-projection.js"
import { projectCoreSupportingMaterialDetailRead, type CoreReadQueryApi } from "./core-read.js"
import { projectDocumentDetailRead, type DocumentReadApi } from "./document-read-routes.js"
import type { JurisdictionReadRepository } from "./jurisdiction-read-repository.js"
import { projectJurisdictionRead } from "./jurisdiction-read-routes.js"
import { projectMeetingDetailRead, type MeetingReadApi } from "./meeting-read-routes.js"
import type { OrganizationDetailReadRepository } from "./organization-detail-read-repository.js"
import type { PersonDetailReadRepository } from "./person-detail-read-repository.js"
import { projectPersonDetailRead } from "./person-detail-read-routes.js"
import type { SessionReadRepository } from "./session-read-repository.js"
import { projectSessionRead } from "./session-read-routes.js"
import { projectVoteDetailRead, type VoteReadApi } from "./vote-read-routes.js"

export const RESOURCE_TYPES = [
  "jurisdiction",
  "session",
  "bill",
  "amendment",
  "vote",
  "document",
  "supporting-material",
  "person",
  "organization",
  "meeting",
  "calendar"
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

/**
 * Batch reads always use the same canonical detail projection as the
 * corresponding resource endpoint.
 */
export type CanonicalResource =
  | Jurisdiction
  | Session
  | BillDetail
  | AmendmentDetail
  | VoteDetail
  | DocumentDetail
  | SupportingMaterialDetail
  | PersonDetail
  | OrganizationDetail
  | MeetingDetail
  | CalendarDetail

export type ResourceBatchRequestItem = Readonly<{
  type: ResourceType
  id: string
}>

export type ResourceResolver = (id: string) => Promise<CanonicalResource>

export type ResourceBatchResolvers = Partial<Record<ResourceType, ResourceResolver>>

export type CanonicalResourceBatchReadDependencies = Readonly<{
  apiBaseUrl: string
  amendmentReadRepository?: Pick<AmendmentReadRepository, "getAmendment">
  billDetailReadRepository?: Pick<BillDetailReadRepository, "getBillDetail">
  calendarReadApi?: Pick<CalendarReadApi, "getCalendarRead">
  coreReadApi?: Pick<CoreReadQueryApi, "getSupportingMaterial">
  documentReadApi?: Pick<DocumentReadApi, "getDocumentDetail">
  jurisdictionReadRepository?: Pick<JurisdictionReadRepository, "getJurisdiction">
  meetingReadApi?: Pick<
    MeetingReadApi,
    | "getMeetingRead"
    | "listMeetingAgenda"
    | "listMeetingDocuments"
    | "listMeetingOrganizations"
    | "listMeetingOutcomes"
    | "listMeetingParticipants"
  >
  organizationDetailReadRepository?: Pick<OrganizationDetailReadRepository, "getOrganizationDetail">
  personDetailReadRepository?: Pick<PersonDetailReadRepository, "getPersonDetail">
  sessionReadRepository?: Pick<SessionReadRepository, "getSession">
  voteReadApi?: Pick<VoteReadApi, "getVote" | "listVotePositions">
}>

export interface ResourceBatchReadRepository {
  getResource: (input: ResourceBatchRequestItem) => Promise<CanonicalResource>
}

export class CanonicalResourceBatchRepository implements ResourceBatchReadRepository {
  readonly #resolvers: ResourceBatchResolvers

  constructor(resolvers: ResourceBatchResolvers) {
    this.#resolvers = resolvers
  }

  async getResource(input: ResourceBatchRequestItem): Promise<CanonicalResource> {
    const resolver = this.#resolvers[input.type]
    if (resolver === undefined) {
      throw new LegislationError(
        "dependency_unavailable",
        `Canonical ${input.type} reads are not available through the batch endpoint`
      )
    }
    return await resolver(input.id)
  }
}

export function createResourceBatchReadRepository(resolvers: ResourceBatchResolvers): ResourceBatchReadRepository {
  return new CanonicalResourceBatchRepository(resolvers)
}

/**
 * Composes the existing canonical detail reads. An individually omitted
 * dependency remains a per-item dependency error rather than leaking a raw
 * persistence record into the batch response.
 */
export function createCanonicalResourceBatchResolvers(
  dependencies: CanonicalResourceBatchReadDependencies
): ResourceBatchResolvers {
  const resolvers: ResourceBatchResolvers = {}
  const {
    amendmentReadRepository,
    apiBaseUrl,
    billDetailReadRepository,
    calendarReadApi,
    coreReadApi,
    documentReadApi,
    jurisdictionReadRepository,
    meetingReadApi,
    organizationDetailReadRepository,
    personDetailReadRepository,
    sessionReadRepository,
    voteReadApi
  } = dependencies

  if (jurisdictionReadRepository !== undefined) {
    resolvers.jurisdiction = async (id) =>
      projectJurisdictionRead(await jurisdictionReadRepository.getJurisdiction(id), apiBaseUrl)
  }
  if (sessionReadRepository !== undefined) {
    resolvers.session = async (id) => projectSessionRead(await sessionReadRepository.getSession(id), apiBaseUrl)
  }
  if (billDetailReadRepository !== undefined) {
    resolvers.bill = async (id) => await billDetailReadRepository.getBillDetail({ childLimit: 25, id })
  }
  if (amendmentReadRepository !== undefined) {
    resolvers.amendment = async (id) => await amendmentReadRepository.getAmendment(id)
  }
  if (voteReadApi !== undefined) {
    resolvers.vote = async (id) => {
      const [vote, positions] = await Promise.all([
        voteReadApi.getVote(id),
        voteReadApi.listVotePositions({ limit: 25, voteId: id })
      ])
      return projectVoteDetailRead(vote, positions, apiBaseUrl)
    }
  }

  if (coreReadApi !== undefined) {
    resolvers["supporting-material"] = async (id) => {
      const result = await coreReadApi.getSupportingMaterial({ id })
      return projectCoreSupportingMaterialDetailRead(result.material, apiBaseUrl)
    }
  }
  if (documentReadApi !== undefined) {
    resolvers.document = async (id) =>
      projectDocumentDetailRead(await documentReadApi.getDocumentDetail(id), apiBaseUrl)
  }
  if (personDetailReadRepository !== undefined) {
    resolvers.person = async (id) =>
      projectPersonDetailRead(await personDetailReadRepository.getPersonDetail(id), apiBaseUrl)
  }
  if (organizationDetailReadRepository !== undefined) {
    resolvers.organization = async (id) =>
      await organizationDetailReadRepository.getOrganizationDetail({ childLimit: 25, organizationId: id })
  }
  if (meetingReadApi !== undefined) {
    resolvers.meeting = async (id) => {
      const [meeting, organizations, agenda, documents, outcomes, participants] = await Promise.all([
        meetingReadApi.getMeetingRead(id),
        meetingReadApi.listMeetingOrganizations(id),
        meetingReadApi.listMeetingAgenda({ limit: 25, meetingId: id }),
        meetingReadApi.listMeetingDocuments({ limit: 25, meetingId: id }),
        meetingReadApi.listMeetingOutcomes({ limit: 25, meetingId: id }),
        meetingReadApi.listMeetingParticipants({ limit: 25, meetingId: id })
      ])
      return projectMeetingDetailRead(meeting, organizations, agenda, documents, outcomes, participants, apiBaseUrl, 25)
    }
  }
  if (calendarReadApi !== undefined) {
    resolvers.calendar = async (id) => projectCalendarDetailRead(await calendarReadApi.getCalendarRead(id), apiBaseUrl)
  }
  return resolvers
}

export function createResourceBatchReadRepositoryFromCanonicalReads(
  dependencies: CanonicalResourceBatchReadDependencies
): ResourceBatchReadRepository {
  return createResourceBatchReadRepository(createCanonicalResourceBatchResolvers(dependencies))
}
