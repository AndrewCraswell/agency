import { LegislationError } from "@repo/legislation-core/domain/errors"
import { describe, expect, it } from "vitest"
import type { MeetingRead } from "../../legislation/persistence/queries/meeting-read"
import type { PersonDetailRead } from "../../legislation/persistence/queries/person-detail-read"
import type { SessionRead } from "../../legislation/persistence/queries/session-read"
import type { VotePositionRead, VoteRead } from "../../legislation/persistence/queries/vote-reads"
import { projectAmendmentDetail, projectOrganizationDetail, type ProjectionContext } from "./canonical-projection"
import { projectBillDetailRead } from "./canonical-read"
import type { JurisdictionRead } from "./jurisdiction-read-repository"
import {
  createResourceBatchReadRepositoryFromCanonicalReads,
  createResourceBatchReadRepository,
  RESOURCE_TYPES,
  type CanonicalResource,
  type ResourceBatchRequestItem
} from "./resource-batch-read-repository"

const jurisdiction: CanonicalResource = {
  canonicalUrl: "https://api.example.test/api/jurisdictions/jurisdiction%3Aus",
  classification: "country",
  id: "jurisdiction:us",
  isActive: true,
  name: "United States",
  sources: [
    {
      isOfficial: true,
      provider: "test",
      retrievedAt: "2026-08-24T12:00:00.000Z",
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/jurisdiction/us"
    }
  ],
  timezone: "UTC",
  type: "jurisdiction",
  updatedAt: "2026-08-24T12:00:00.000Z"
}

const documentRead = {
  billId: "bill:us:119:hr:1",
  byteSize: null,
  classification: "version" as const,
  contentHash: null,
  createdAt: new Date("2026-08-24T12:00:00.000Z"),
  documentDate: "2026-08-24",
  failureCategory: null,
  id: "document:us:119:hr:1",
  mimeType: "application/pdf",
  ocrCompletedAt: null,
  ocrProvider: null,
  ocrStatus: "not-required" as const,
  pageCount: null,
  processingStatus: "processed" as const,
  sectionCount: 2,
  sourceUrl: "https://source.example.test/document/us-119-hr-1",
  storedUrl: null,
  textCharacterCount: 120,
  title: "Bill document",
  updatedAt: new Date("2026-08-24T12:00:00.000Z"),
  versionCode: null
}

const supportingMaterialRead = {
  amendmentIds: ["amendment:us:119:1"],
  billIds: ["bill:us:119:hr:1"],
  byteSize: null,
  classification: "committee-report",
  contentType: "application/pdf",
  createdAt: "2026-08-24T12:00:00.000Z",
  documentDate: "2026-08-24",
  id: "material:us:119:1",
  jurisdictionId: "jurisdiction:us",
  meetingIds: ["meeting:us:119:1"],
  organizationIds: ["organization:us:house"],
  pageCount: null,
  processingStatus: "processed",
  sectionCount: 1,
  sourceUrl: "https://source.example.test/material/us-119-1",
  storedUrl: null,
  textCharacterCount: 120,
  title: "Committee report",
  updatedAt: "2026-08-24T12:00:00.000Z"
}

const fixtureContext: ProjectionContext = {
  apiBaseUrl: "https://api.example.test",
  sources: [
    {
      isOfficial: true,
      provider: "test",
      retrievedAt: "2026-08-24T12:00:00.000Z",
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/fixture"
    }
  ],
  updatedAt: "2026-08-24T12:00:00.000Z"
}

const resourceIds = {
  amendment: "amendment:us:119:1",
  bill: "bill:us:119:hr:1",
  document: documentRead.id,
  jurisdiction: jurisdiction.id,
  meeting: "meeting:us:119:1",
  organization: "organization:us:house",
  person: "person:us:ada",
  session: "session:us:119",
  "supporting-material": supportingMaterialRead.id,
  vote: "vote:us:119:1"
} satisfies Record<(typeof RESOURCE_TYPES)[number], string>

const billDetail = projectBillDetailRead(
  {
    abstract: null,
    amendments: [],
    bill: {
      classification: ["bill"],
      createdAt: "2026-08-24T12:00:00.000Z",
      id: resourceIds.bill,
      identifier: "HR 1",
      introducedAt: "2026-01-01",
      jurisdictionId: resourceIds.jurisdiction,
      latestActionAt: null,
      sessionId: resourceIds.session,
      sourceUrl: "https://source.example.test/bill",
      status: "introduced",
      subjects: [],
      title: "Fixture bill",
      updatedAt: "2026-08-24T12:00:00.000Z",
      upstreamIds: { test: resourceIds.bill }
    },
    childPageInfo: {
      amendments: { limit: 25, nextCursor: null, truncated: false },
      documents: { limit: 25, nextCursor: null, truncated: false },
      votes: { limit: 25, nextCursor: null, truncated: false }
    },
    documents: [],
    latestActions: [],
    organizations: [],
    relations: [],
    sponsors: [],
    voteSummaries: []
  },
  fixtureContext.apiBaseUrl
)

const amendmentDetail = projectAmendmentDetail(
  {
    actions: [],
    amendment: {
      billId: resourceIds.bill,
      documentId: null,
      id: resourceIds.amendment,
      identifier: "Amdt. 1",
      jurisdictionId: resourceIds.jurisdiction,
      recordType: "structured",
      sourceUrl: "https://source.example.test/amendment",
      status: "introduced",
      submittedDate: "2026-02-01",
      title: "Fixture amendment"
    },
    description: "Fixture amendment",
    documents: [],
    sponsors: []
  },
  fixtureContext
)

const organizationDetail = projectOrganizationDetail(
  {
    childPageInfo: { memberships: { limit: 25, nextCursor: null, truncated: false } },
    children: [],
    contact: null,
    description: "Fixture organization",
    memberships: [],
    organization: {
      chamber: "lower",
      classification: "committee",
      id: resourceIds.organization,
      isActive: true,
      jurisdictionId: resourceIds.jurisdiction,
      name: "Fixture organization",
      parentOrganizationId: null,
      sourceUrl: "https://source.example.test/organization"
    },
    termsOfReference: null,
    websiteUrl: null
  },
  fixtureContext
)

const jurisdictionRead = {
  classification: "country",
  id: resourceIds.jurisdiction,
  isActive: true,
  name: "United States",
  provenanceComplete: true,
  sourceIsOfficial: true,
  sourceProvider: "test",
  sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
  sourceUpdatedAt: null,
  sourceUrl: "https://source.example.test/jurisdiction/us",
  timezone: "UTC",
  updatedAt: new Date("2026-08-24T12:00:00.000Z")
} as JurisdictionRead

const sessionRead = {
  classification: "regular",
  endDate: null,
  id: resourceIds.session,
  isActive: true,
  jurisdictionId: resourceIds.jurisdiction,
  name: "119th Congress",
  provenanceComplete: true,
  sourceIsOfficial: true,
  sourceProvider: "test",
  sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
  sourceUpdatedAt: null,
  sourceUrl: "https://source.example.test/session/119",
  startDate: "2025-01-03",
  updatedAt: new Date("2026-08-24T12:00:00.000Z")
} as SessionRead

const voteRead: VoteRead = {
  absentCount: 0,
  abstainCount: 0,
  amendmentId: null,
  billId: resourceIds.bill,
  chamber: "house",
  classification: "passage",
  createdAt: new Date("2026-08-24T12:00:00.000Z"),
  eventId: null,
  heldAt: new Date("2026-08-24T12:00:00.000Z"),
  id: resourceIds.vote,
  motion: "On passage",
  noCount: 0,
  notVotingCount: 0,
  organizationId: resourceIds.organization,
  otherCount: 0,
  pairedCount: 0,
  presentCount: 0,
  proxyCount: 0,
  question: "Shall the bill pass?",
  requirement: null,
  result: "passed",
  rollCallNumber: "1",
  sessionId: resourceIds.session,
  sourceId: resourceIds.vote,
  sourceIsOfficial: true,
  sourceProvider: "test",
  sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
  sourceSequence: 1,
  sourceUpdatedAt: null,
  sourceUrl: "https://source.example.test/vote",
  timelineComplete: true,
  voteType: "roll-call",
  yesCount: 1
}

const meetingRead: MeetingRead = {
  calendarId: "calendar:us:119",
  classification: "meeting",
  description: "Fixture meeting",
  endAt: null,
  id: resourceIds.meeting,
  allDay: false,
  isRemote: false,
  jurisdictionId: resourceIds.jurisdiction,
  location: null,
  name: "Fixture meeting",
  organizationIds: [resourceIds.organization],
  publisherLocalDate: "2026-08-24",
  sessionIds: [resourceIds.session],
  sourceIsOfficial: true,
  sourceProvider: "test",
  sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
  sourceSequence: 1,
  sourceUpdatedAt: null,
  sourceUrl: "https://source.example.test/meeting",
  startAt: new Date("2026-08-24T12:00:00.000Z"),
  status: "scheduled",
  updatedAt: new Date("2026-08-24T12:00:00.000Z"),
  virtualAccess: null
}

const personDetailRead: PersonDetailRead = {
  aliases: [],
  externalIdentifiers: [],
  jurisdictions: [
    {
      createdAt: new Date("2026-08-24T12:00:00.000Z"),
      jurisdictionId: resourceIds.jurisdiction,
      personId: resourceIds.person,
      provenanceComplete: true,
      sourceIdentity: "test:person-jurisdiction",
      sourceIsOfficial: true,
      sourceProvider: "test",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/person",
      updatedAt: new Date("2026-08-24T12:00:00.000Z")
    }
  ],
  memberships: { items: [], truncated: false },
  person: {
    createdAt: new Date("2026-08-24T12:00:00.000Z"),
    familyName: "Lovelace",
    givenName: "Ada",
    id: resourceIds.person,
    isActive: true,
    jurisdictionId: resourceIds.jurisdiction,
    name: "Ada Lovelace",
    party: null,
    provenanceComplete: true,
    sourceId: resourceIds.person,
    sourceIsOfficial: true,
    sourceProvider: "test",
    sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/person",
    updatedAt: new Date("2026-08-24T12:00:00.000Z"),
    upstreamIds: { test: resourceIds.person }
  },
  profile: {
    createdAt: new Date("2026-08-24T12:00:00.000Z"),
    imageUrl: null,
    officialUrl: null,
    personId: resourceIds.person,
    provenanceComplete: true,
    publicEmail: null,
    sourceIsOfficial: true,
    sourceProvider: "test",
    sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/person-profile",
    updatedAt: new Date("2026-08-24T12:00:00.000Z")
  },
  terms: []
}

describe("CanonicalResourceBatchRepository", () => {
  it("dispatches the requested type and preserves the exact resource ID", async () => {
    const received: string[] = []
    const repository = createResourceBatchReadRepository({
      jurisdiction: async (id) => {
        received.push(id)
        return jurisdiction
      }
    })

    const input: ResourceBatchRequestItem = { id: jurisdiction.id, type: "jurisdiction" }
    await expect(repository.getResource(input)).resolves.toBe(jurisdiction)
    expect(received).toEqual([jurisdiction.id])
  })

  it("fails closed when a canonical resolver is not available", async () => {
    const repository = createResourceBatchReadRepository({})

    await expect(repository.getResource({ id: "jurisdiction:us", type: "jurisdiction" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
  })

  it("preserves not-found and forbidden errors from canonical resolvers", async () => {
    const notFound = new LegislationError("not_found", "Jurisdiction was not found")
    const forbidden = new LegislationError("forbidden", "Jurisdiction is not visible")
    const repository = createResourceBatchReadRepository({
      jurisdiction: async () => {
        throw notFound
      },
      session: async () => {
        throw forbidden
      }
    })

    await expect(repository.getResource({ id: "jurisdiction:missing", type: "jurisdiction" })).rejects.toBe(notFound)
    await expect(repository.getResource({ id: "session:secret", type: "session" })).rejects.toBe(forbidden)
  })

  it("composes existing document and supporting-material detail reads", async () => {
    const received: string[] = []
    const repository = createResourceBatchReadRepositoryFromCanonicalReads({
      apiBaseUrl: "https://api.example.test",
      coreReadApi: {
        getSupportingMaterial: async ({ id }) => {
          received.push(`supporting-material:${id}`)
          return { material: supportingMaterialRead }
        }
      },
      documentReadApi: {
        getDocumentDetail: async (id) => {
          received.push(`document:${id}`)
          return documentRead
        }
      }
    })

    await expect(repository.getResource({ id: documentRead.id, type: "document" })).resolves.toMatchObject({
      id: documentRead.id,
      type: "document"
    })
    await expect(
      repository.getResource({ id: supportingMaterialRead.id, type: "supporting-material" })
    ).resolves.toMatchObject({ id: supportingMaterialRead.id, type: "supporting-material" })
    await expect(repository.getResource({ id: "bill:unavailable", type: "bill" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
    await expect(repository.getResource({ id: "person:unavailable", type: "person" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
    expect(received).toEqual([`document:${documentRead.id}`, `supporting-material:${supportingMaterialRead.id}`])
  })

  it("resolves every canonical resource through its detail boundary with bounded children", async () => {
    const calls = {
      amendment: [] as string[],
      bill: [] as unknown[],
      document: [] as string[],
      jurisdiction: [] as string[],
      meeting: [] as Array<readonly [string, unknown]>,
      organization: [] as unknown[],
      person: [] as string[],
      session: [] as string[],
      supportingMaterial: [] as unknown[],
      vote: [] as Array<readonly [string, unknown]>
    }
    const repository = createResourceBatchReadRepositoryFromCanonicalReads({
      amendmentReadRepository: {
        getAmendment: async (id) => {
          calls.amendment.push(id)
          return amendmentDetail
        }
      },
      apiBaseUrl: "https://api.example.test",
      billDetailReadRepository: {
        getBillDetail: async (input) => {
          calls.bill.push(input)
          return billDetail
        }
      },
      coreReadApi: {
        getSupportingMaterial: async (input) => {
          calls.supportingMaterial.push(input)
          return { material: supportingMaterialRead }
        }
      },
      documentReadApi: {
        getDocumentDetail: async (id) => {
          calls.document.push(id)
          return documentRead
        }
      },
      jurisdictionReadRepository: {
        getJurisdiction: async (id) => {
          calls.jurisdiction.push(id)
          return jurisdictionRead
        }
      },
      meetingReadApi: {
        getMeetingRead: async (id) => {
          calls.meeting.push(["getMeetingRead", id])
          return meetingRead
        },
        listMeetingAgenda: async (input) => {
          calls.meeting.push(["listMeetingAgenda", input])
          return { items: [], truncated: false }
        },
        listMeetingDocuments: async (input) => {
          calls.meeting.push(["listMeetingDocuments", input])
          return { items: [], truncated: false }
        },
        listMeetingOrganizations: async (id) => {
          calls.meeting.push(["listMeetingOrganizations", id])
          return []
        },
        listMeetingParticipants: async (input) => {
          calls.meeting.push(["listMeetingParticipants", input])
          return { items: [], truncated: false }
        }
      },
      organizationDetailReadRepository: {
        getOrganizationDetail: async (input) => {
          calls.organization.push(input)
          return organizationDetail
        }
      },
      personDetailReadRepository: {
        getPersonDetail: async (id) => {
          calls.person.push(id)
          return personDetailRead
        }
      },
      sessionReadRepository: {
        getSession: async (id) => {
          calls.session.push(id)
          return sessionRead
        }
      },
      voteReadApi: {
        getVote: async (id) => {
          calls.vote.push(["getVote", id])
          return voteRead
        },
        listVotePositions: async (input) => {
          calls.vote.push(["listVotePositions", input])
          return { items: [] as VotePositionRead[], truncated: false }
        }
      }
    })

    const resources = await Promise.all(
      RESOURCE_TYPES.map(async (type) => await repository.getResource({ id: resourceIds[type], type }))
    )

    expect(resources.map(({ id, type }) => ({ id, type }))).toEqual(
      RESOURCE_TYPES.map((type) => ({ id: resourceIds[type], type }))
    )
    expect(calls).toEqual({
      amendment: [resourceIds.amendment],
      bill: [{ childLimit: 25, id: resourceIds.bill }],
      document: [resourceIds.document],
      jurisdiction: [resourceIds.jurisdiction],
      meeting: [
        ["getMeetingRead", resourceIds.meeting],
        ["listMeetingOrganizations", resourceIds.meeting],
        ["listMeetingAgenda", { limit: 25, meetingId: resourceIds.meeting }],
        ["listMeetingDocuments", { limit: 25, meetingId: resourceIds.meeting }],
        ["listMeetingParticipants", { limit: 25, meetingId: resourceIds.meeting }]
      ],
      organization: [{ childLimit: 25, organizationId: resourceIds.organization }],
      person: [resourceIds.person],
      session: [resourceIds.session],
      supportingMaterial: [{ id: resourceIds["supporting-material"] }],
      vote: [
        ["getVote", resourceIds.vote],
        ["listVotePositions", { limit: 25, voteId: resourceIds.vote }]
      ]
    })
  })
})
