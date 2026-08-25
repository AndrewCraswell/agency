import { afterEach, describe, expect, it } from "vitest"
import { runWithRequestContext } from "../auth/request-context.js"
import type { BillRelatedHitRead } from "../db/queries/bill-related-read.js"
import type { ChangeEventRead } from "../db/queries/change-feed-reads.js"
import type { CanonicalDocumentRead, CanonicalDocumentSectionRead } from "../db/queries/document-reads.js"
import type { JurisdictionCollectionRead } from "../db/queries/jurisdictions-read.js"
import type { MeetingRead } from "../db/queries/meeting-read.js"
import type { PersonAmendmentRead } from "../db/queries/person-amendments.js"
import type { PersonDetailRead } from "../db/queries/person-detail-read.js"
import type { PersonVotePositionRead, VotePositionRead, VoteRead } from "../db/queries/vote-reads.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import type { AmendmentSearchCandidate } from "../search/amendment-search.js"
import type { PassageSearchResultPage } from "../search/search.js"
import type { AmendmentReadRepository } from "./amendment-read-repository.js"
import { createAmendmentReadApiHandler } from "./amendment-read-routes.js"
import { createAmendmentSearchApiHandler, type AmendmentSearchApi } from "./amendment-search.js"
import { createBillRelatedReadApiHandler, type BillRelatedReadApi } from "./bill-related-read-routes.js"
import { createBillTextReadApiHandler, type BillTextReadApi } from "./bill-text-read-routes.js"
import type { CalendarRead } from "./calendar-read-repository.js"
import { createCalendarReadApiHandler, type CalendarReadApi } from "./calendar-read-routes.js"
import type { AmendmentDetail, AmendmentSummary, LegislativeTerm, PersonSummary } from "./canonical-projection.js"
import { createChangeFeedApiHandler, type ChangeFeedApi } from "./change-feed-routes.js"
import type { CivicSearchApi } from "./civic-search.js"
import type { CoreReadQueryApi } from "./core-read.js"
import { createDocumentDiffApiHandler, type DocumentDiffApi } from "./document-diff-routes.js"
import { createCompositeHttpApiHandler } from "./http.js"
import {
  createJurisdictionCollectionReadApiHandler,
  type JurisdictionCollectionReadApi
} from "./jurisdiction-collection-read-routes.js"
import { createMeetingReadApiHandler, type MeetingReadApi } from "./meeting-read-routes.js"
import {
  createOrganizationDetailReadApiHandler,
  type OrganizationDetailReadApi
} from "./organization-detail-read-routes.js"
import { createPassageSearchApiHandler } from "./passage-search.js"
import { createPersonAmendmentApiHandler, type PersonAmendmentsApi } from "./person-amendment-routes.js"
import { createPersonDetailReadApiHandler, type PersonDetailReadApi } from "./person-detail-read-routes.js"
import {
  createRepresentativeLookupApiHandler,
  type RepresentativeLookupApi,
  type RepresentativeLookupResult
} from "./representative-lookup.js"
import { createResearchAnswerApiHandler, type ResearchAnswer, type ResearchAnswerApi } from "./research-answers.js"
import {
  SubscriptionRepositoryError,
  type IdempotentResponse,
  type IdempotencyRequest,
  type PreflightSubscriptionMutationExecutor,
  type SubscriptionTransaction
} from "./subscription-repository.js"
import {
  createWebhookSecretProtector,
  EncryptedWebhookSecret,
  SubscriptionService,
  type Webhook,
  type WebhookRepository
} from "./subscriptions.js"
import { createUniversalSearchApiHandler, type UniversalSearchApi } from "./universal-search.js"
import { createVoteReadApiHandler, type VoteReadApi } from "./vote-read-routes.js"
import type { WebhookVerificationTransport } from "./webhook-challenge-transport.js"
import { createWebhookMutationApiHandler } from "./webhook-mutation-routes.js"
import { resolvePublicWebhookUrl } from "./webhook-security.js"

const API_BASE_URL = "https://api.example.test"
const BILL_ID = "bill:fixture"
const AMENDMENT_ID = "amendment:fixture"
const DOCUMENT_ID = "document:fixture:left"
const DOCUMENT_ID_B = "document:fixture:right"
const CALENDAR_ID = "calendar:fixture"
const JURISDICTION_ID = "jurisdiction:fixture"
const MEETING_ID = "event:fixture"
const ORGANIZATION_ID = "organization:fixture"
const PERSON_ID = "person:fixture"
const VOTE_ID = "vote:fixture"
const logger = createLogger({ level: "error", service: "composed-endpoint-smoke-test", write: () => undefined })
const servers = new Set<ReturnType<typeof createLegislationServer>>()

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

function source(url = "https://source.example.test/fixture") {
  return {
    isOfficial: true,
    provider: "fixture",
    retrievedAt: "2026-08-25T00:00:00.000Z",
    sourceUpdatedAt: null,
    sourceUrl: url
  }
}

function billSummaryRead(id = BILL_ID) {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-24T00:00:00Z"),
    id,
    identifier: "HB 1",
    introducedAt: "2026-01-01",
    jurisdictionId: JURISDICTION_ID,
    latestActionAt: new Date("2026-02-01T00:00:00Z"),
    sessionId: "session:fixture",
    sourceUrl: source().sourceUrl,
    status: "introduced",
    subjects: ["Government"],
    title: "Fixture bill",
    updatedAt: new Date("2026-08-24T00:00:00Z"),
    upstreamIds: { fixture: id }
  }
}

function amendmentSummary(): AmendmentSummary {
  return {
    billId: BILL_ID,
    canonicalUrl: `${API_BASE_URL}/api/amendments/${encodeURIComponent(AMENDMENT_ID)}`,
    documentId: null,
    id: AMENDMENT_ID,
    identifier: "Amdt 1",
    jurisdictionId: JURISDICTION_ID,
    recordType: "structured" as const,
    sources: [
      {
        isOfficial: true,
        provider: "fixture",
        retrievedAt: "2026-08-25T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://source.example.test/amendment"
      }
    ],
    status: "introduced",
    submittedDate: "2026-02-01",
    title: "Fixture amendment",
    type: "amendment" as const,
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
}

function amendmentDetail(): AmendmentDetail {
  return { ...amendmentSummary(), actions: [], description: "Fixture amendment", documents: [], sponsors: [] }
}

function amendmentRow(): Extract<AmendmentSearchCandidate, { recordType: "structured" }>["amendment"] {
  return {
    amendmentNumber: "1",
    amendmentType: "floor",
    billId: BILL_ID,
    chamber: "house",
    createdAt: new Date("2026-08-25T00:00:00Z"),
    description: "Fixture amendment",
    id: AMENDMENT_ID,
    jurisdictionId: JURISDICTION_ID,
    purpose: "Fixture purpose",
    sessionId: "session:fixture",
    sourceId: AMENDMENT_ID,
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/amendment",
    sponsorName: "Fixture Person",
    sponsorPersonId: PERSON_ID,
    sponsorSourceId: PERSON_ID,
    status: "introduced",
    submittedDate: "2026-02-01",
    printedIdentifier: "Amdt 1",
    updatedAt: new Date("2026-08-25T00:00:00Z"),
    upstreamIds: { fixture: AMENDMENT_ID }
  }
}

function amendmentSearchCandidate(): AmendmentSearchCandidate {
  return {
    amendment: amendmentRow(),
    lexicalScore: 0.8,
    matchedFields: ["identifier", "metadata"],
    recordType: "structured",
    rerankScore: null,
    score: 0.8,
    semanticScore: null,
    snippet: "Fixture amendment"
  }
}

function jurisdiction(): JurisdictionCollectionRead {
  return {
    classification: "state",
    countryCode: "US",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: JURISDICTION_ID,
    isActive: true,
    name: "Fixture state",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "fixture",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/jurisdiction",
    subdivisionCode: "FX",
    timezone: "America/Los_Angeles",
    updatedAt: new Date("2026-08-20T15:00:00.000Z")
  }
}

function calendar(): CalendarRead {
  return {
    classification: "legislative-schedule",
    coverageFrom: "2026-01-01",
    coverageTo: "2026-12-31",
    description: "Fixture calendar",
    id: CALENDAR_ID,
    isActive: true,
    jurisdictionId: JURISDICTION_ID,
    name: "Fixture calendar",
    organizationId: ORGANIZATION_ID,
    sourceUrl: "https://source.example.test/calendar",
    sources: [
      {
        isOfficial: true,
        provider: "fixture",
        retrievedAt: "2026-08-25T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://source.example.test/calendar"
      }
    ],
    timezone: "America/Los_Angeles",
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
}

function vote(): VoteRead {
  return {
    absentCount: 0,
    abstainCount: 0,
    amendmentId: null,
    billId: BILL_ID,
    chamber: "house",
    classification: "passage",
    createdAt: new Date("2026-08-25T00:00:00.000Z"),
    eventId: null,
    heldAt: new Date("2026-08-24T12:00:00.000Z"),
    id: VOTE_ID,
    motion: "On passage",
    noCount: 1,
    notVotingCount: 0,
    organizationId: ORGANIZATION_ID,
    otherCount: 0,
    pairedCount: 0,
    presentCount: 0,
    proxyCount: 0,
    question: "Shall the bill pass?",
    requirement: null,
    result: "passed",
    rollCallNumber: "1",
    sessionId: "session:fixture",
    sourceId: VOTE_ID,
    sourceIsOfficial: true,
    sourceProvider: "fixture",
    sourceRetrievedAt: new Date("2026-08-25T00:00:00.000Z"),
    sourceSequence: 1,
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/vote",
    timelineComplete: true,
    voteType: "roll-call",
    yesCount: 2
  }
}

function billRow(id = BILL_ID): NonNullable<PersonVotePositionRead["bill"]> {
  return {
    chamber: "house",
    classification: ["bill"],
    committees: [],
    createdAt: new Date("2026-08-24T00:00:00Z"),
    embeddedAt: null,
    embedding: null,
    embeddingInputHash: null,
    embeddingModel: null,
    id,
    identifier: "HB 1",
    introducedAt: "2026-01-01",
    jurisdictionId: JURISDICTION_ID,
    searchVector: null,
    sessionId: "session:fixture",
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/bill",
    status: "introduced",
    subjects: ["Government"],
    summary: "Fixture bill summary",
    title: "Fixture bill",
    updatedAt: new Date("2026-08-25T00:00:00Z"),
    upstreamIds: { fixture: id }
  }
}

function personRow(): NonNullable<VotePositionRead["person"]> {
  return {
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    familyName: "Person",
    givenName: "Fixture",
    id: PERSON_ID,
    isActive: true,
    jurisdictionId: JURISDICTION_ID,
    name: "Fixture Person",
    party: null,
    provenanceComplete: true,
    sourceId: PERSON_ID,
    sourceIsOfficial: true,
    sourceProvider: "fixture",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/person",
    updatedAt: new Date("2026-08-21T15:00:00.000Z"),
    upstreamIds: { fixture: PERSON_ID }
  }
}

function votePosition(): VotePositionRead {
  return {
    person: personRow(),
    position: {
      createdAt: new Date("2026-08-25T00:00:00Z"),
      option: "yes",
      personId: PERSON_ID,
      sourceIdentity: "position:fixture",
      sourceName: "Fixture roll call",
      sourcePersonId: PERSON_ID,
      sourceSequence: 0,
      voteId: VOTE_ID
    },
    vote: vote()
  }
}

function personVotePosition(): PersonVotePositionRead {
  return { ...votePosition(), bill: billRow() }
}

function meeting(): MeetingRead {
  return {
    classification: "meeting",
    description: "Fixture meeting",
    endAt: null,
    id: MEETING_ID,
    isRemote: false,
    jurisdictionId: JURISDICTION_ID,
    location: { name: "Capitol" },
    name: "Fixture meeting",
    organizationIds: [ORGANIZATION_ID],
    publisherLocalDate: "2026-08-25",
    sessionIds: ["session:fixture"],
    sourceIsOfficial: true,
    sourceProvider: "fixture",
    sourceRetrievedAt: new Date("2026-08-25T00:00:00Z"),
    sourceSequence: 1,
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/meeting",
    startAt: new Date("2026-08-25T17:00:00Z"),
    status: "scheduled",
    updatedAt: new Date("2026-08-25T00:00:00Z"),
    virtualAccess: null
  }
}

function personDetail(): PersonDetailRead {
  const createdAt = new Date("2026-08-20T15:00:00.000Z")
  const updatedAt = new Date("2026-08-21T15:00:00.000Z")
  const sourceRetrievedAt = new Date("2026-08-20T15:00:00.000Z")
  return {
    aliases: [],
    externalIdentifiers: [],
    jurisdictions: [
      {
        createdAt,
        jurisdictionId: JURISDICTION_ID,
        personId: PERSON_ID,
        provenanceComplete: true,
        sourceIdentity: "fixture:person-jurisdiction",
        sourceIsOfficial: true,
        sourceProvider: "fixture",
        sourceRetrievedAt,
        sourceUpdatedAt: null,
        sourceUrl: "https://source.example.test/person",
        updatedAt
      }
    ],
    memberships: { items: [], truncated: false },
    person: {
      createdAt,
      familyName: "Fixture",
      givenName: "Person",
      id: PERSON_ID,
      isActive: true,
      jurisdictionId: JURISDICTION_ID,
      name: "Fixture Person",
      party: null,
      provenanceComplete: true,
      sourceId: PERSON_ID,
      sourceIsOfficial: true,
      sourceProvider: "fixture",
      sourceRetrievedAt,
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/person",
      updatedAt,
      upstreamIds: { fixture: PERSON_ID }
    },
    profile: {
      createdAt,
      imageUrl: null,
      officialUrl: null,
      personId: PERSON_ID,
      provenanceComplete: true,
      publicEmail: null,
      sourceIsOfficial: true,
      sourceProvider: "fixture",
      sourceRetrievedAt,
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/person-profile",
      updatedAt
    },
    terms: []
  }
}

function representativeLookupResult(): RepresentativeLookupResult {
  const representativeSource = source("https://source.example.test/representative")
  const person: PersonSummary = {
    canonicalUrl: `${API_BASE_URL}/api/people/${encodeURIComponent(PERSON_ID)}`,
    familyName: "Person",
    givenName: "Fixture",
    id: PERSON_ID,
    imageUrl: null,
    isActive: true,
    jurisdictionIds: [JURISDICTION_ID],
    name: "Fixture Person",
    party: "Independent",
    sources: [representativeSource],
    type: "person" as const,
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
  const term: LegislativeTerm = {
    canonicalUrl: `${API_BASE_URL}/api/people/${encodeURIComponent(PERSON_ID)}/terms/term%3Afixture`,
    district: "1",
    endDate: null,
    id: "term:fixture",
    isCurrent: true,
    jurisdictionId: JURISDICTION_ID,
    officeTitle: "Representative",
    organizationId: ORGANIZATION_ID,
    personId: PERSON_ID,
    sources: [representativeSource],
    startDate: "2026-01-01",
    type: "legislative-term" as const,
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
  const district = {
    boundarySourceUrl: "https://source.example.test/district",
    classification: "lower",
    jurisdictionId: JURISDICTION_ID,
    label: "1",
    organizationId: ORGANIZATION_ID,
    sources: [representativeSource]
  }
  return {
    districts: [district],
    expiresAt: "2026-08-25T12:05:00.000Z",
    lookupId: "lookup:fixture",
    quality: "exact",
    representatives: [{ district, matchConfidence: 1, person, term }],
    resolvedAt: "2026-08-25T12:00:00.000Z",
    warnings: []
  }
}

function personAmendment(): PersonAmendmentRead {
  return {
    amendment: {
      amendmentNumber: "1",
      amendmentType: "amendment",
      billId: BILL_ID,
      chamber: "house",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      description: "Fixture amendment",
      id: AMENDMENT_ID,
      jurisdictionId: JURISDICTION_ID,
      printedIdentifier: "H.Amdt. 1",
      purpose: "Fixture",
      sessionId: "session:fixture",
      sourceId: AMENDMENT_ID,
      sourceUrl: "https://source.example.test/amendment",
      sourceUpdatedAt: null,
      sponsorName: "Fixture Person",
      sponsorPersonId: PERSON_ID,
      sponsorSourceId: PERSON_ID,
      status: "introduced",
      submittedDate: "2026-01-03",
      upstreamIds: { fixture: AMENDMENT_ID },
      updatedAt: new Date("2026-01-03T00:00:00Z")
    }
  }
}

function changeEvent(): ChangeEventRead {
  return {
    event: {
      after: { status: "introduced" },
      before: { status: "pending" },
      changedFields: ["status"],
      changeType: "update",
      createdAt: new Date("2026-08-25T00:00:00Z"),
      id: "change:fixture",
      ingestionRunId: "00000000-0000-4000-8000-000000000001",
      jurisdictionId: JURISDICTION_ID,
      organizationId: null,
      personId: null,
      observedAt: new Date("2026-08-25T00:00:00Z"),
      recordId: BILL_ID,
      recordType: "bill",
      sourceIsOfficial: true,
      sourceProvider: "fixture",
      sourceRetrievedAt: new Date("2026-08-25T00:00:00Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/change"
    }
  }
}

function document(id: string): CanonicalDocumentRead {
  return {
    billId: BILL_ID,
    byteSize: null,
    classification: "version",
    contentHash: "a".repeat(64),
    createdAt: new Date("2026-08-25T00:00:00Z"),
    documentDate: "2026-01-01",
    failureCategory: null,
    id,
    mimeType: "text/plain",
    ocrCompletedAt: new Date("2026-08-25T00:00:00Z"),
    ocrProvider: "fixture-ocr",
    ocrStatus: "processed",
    pageCount: 1,
    processingStatus: "processed",
    sourceUrl: `https://source.example.test/${encodeURIComponent(id)}`,
    storedUrl: null,
    title: "Fixture bill text",
    updatedAt: new Date("2026-08-25T00:00:00Z"),
    versionCode: id.endsWith("right") ? "rs" : "ih"
  }
}

function documentSection(documentId: string): CanonicalDocumentSectionRead {
  return {
    document: {
      billId: BILL_ID,
      createdAt: new Date("2026-08-25T00:00:00Z"),
      id: documentId,
      sourceUrl: `https://source.example.test/${encodeURIComponent(documentId)}`,
      updatedAt: new Date("2026-08-25T00:00:00Z")
    },
    section: {
      contentHash: "b".repeat(64),
      heading: "Fixture section",
      id: "section:fixture",
      ordinal: 0,
      pageEnd: 1,
      pageStart: 1,
      sourceEndOffset: 14,
      sourceStartOffset: 0,
      text: "Fixture passage"
    }
  }
}

function passageCandidate(): PassageSearchResultPage["items"][number] {
  return {
    bill: {
      ...billSummaryRead(),
      sourceUpdatedAt: null
    },
    document: {
      billId: BILL_ID,
      classification: "version",
      contentHash: "a".repeat(64),
      contentType: "text/plain",
      createdAt: new Date("2026-08-25T00:00:00Z"),
      documentDate: "2026-01-01",
      id: DOCUMENT_ID,
      ocrCompletedAt: new Date("2026-08-25T00:00:00Z"),
      ocrPageCount: 1,
      ocrProvider: "fixture-ocr",
      ocrStatus: "processed",
      processingErrorCategory: null,
      processingStatus: "processed",
      sourceUrl: `https://source.example.test/${encodeURIComponent(DOCUMENT_ID)}`,
      title: "Fixture bill text",
      updatedAt: new Date("2026-08-25T00:00:00Z"),
      versionCode: "ih"
    },
    latestActionAt: null,
    lexicalScore: 0.75,
    matchedFields: ["heading", "text"],
    rerankScore: null,
    rerankText: "Fixture passage",
    score: 0.75,
    section: {
      contentHash: "b".repeat(64),
      documentId: DOCUMENT_ID,
      heading: "Fixture section",
      id: "section:fixture",
      ordinal: 0,
      pageEnd: 1,
      pageStart: 1,
      sourceEndOffset: 14,
      sourceStartOffset: 0,
      text: "Fixture passage"
    },
    semanticScore: null,
    snippet: "Fixture passage"
  }
}

function universalSearchApi(): UniversalSearchApi {
  return {
    search: async ({ recordType }) => ({
      items: [
        {
          lexicalScore: 0.9,
          matchedFields: ["identifier"],
          record: amendmentSummary(),
          recordId: AMENDMENT_ID,
          recordType,
          rerankScore: null,
          semanticScore: null,
          snippet: "Fixture amendment",
          sources: amendmentSummary().sources
        }
      ],
      models: [],
      truncated: false
    })
  }
}

function amendmentSearchApi(): AmendmentSearchApi {
  return {
    searchAmendmentHits: async () => ({
      items: [amendmentSearchCandidate()],
      search: { isReranked: false, models: [] },
      truncated: false,
      warnings: []
    })
  }
}

function representativeLookupApi(): RepresentativeLookupApi {
  return { lookup: async () => representativeLookupResult() }
}

function researchAnswerApi(): ResearchAnswerApi {
  const answer: ResearchAnswer = {
    answer: "The fixture bill requires annual publication.",
    citations: [
      {
        billId: BILL_ID,
        documentId: DOCUMENT_ID,
        id: "evidence:fixture",
        recordId: "section:fixture",
        recordType: "passage",
        sectionId: "section:fixture",
        snippet: "The fixture bill requires annual publication.",
        sourceUpdatedAt: null,
        sourceUrl: "https://source.example.test/bill",
        sources: [source("https://source.example.test/bill")],
        title: "Fixture bill section"
      }
    ],
    claims: [{ citationIds: ["evidence:fixture"], confidence: "supported", text: "Annual publication is required." }],
    generatedAt: "2026-08-25T00:00:00.000Z",
    id: "research-answer:fixture",
    question: "What does the fixture bill require?",
    retrieval: {
      candidateCount: 1,
      evidenceCount: 1,
      maxEvidence: 20,
      mode: "lexical",
      models: [],
      recordTypes: ["passage"],
      rerankedProducts: [],
      rrfK: 60
    },
    warnings: []
  }
  return { answer: async () => answer }
}

function coreService(): CoreReadQueryApi & CivicSearchApi {
  return {
    browseBills: async () => ({ items: [billSummaryRead()], truncated: false }),
    compareBillVersions: async () => ({ changes: [] }),
    findRelatedBills: async () => ({ items: [], truncated: false }),
    getAmendment: async () => amendmentDetail(),
    getBill: async () => ({ ...billSummaryRead(), type: "bill" }),
    getBillText: async () => ({ sections: [], truncated: false }),
    getBillTimeline: async () => ({ events: [], truncated: false }),
    getBillVotes: async () => ({ items: [], truncated: false }),
    getDocument: async () => document(DOCUMENT_ID),
    getDocumentSection: async () => documentSection(DOCUMENT_ID),
    getDocumentSections: async () => ({ items: [], truncated: false }),
    getJurisdiction: async () => jurisdiction(),
    getSession: async () => ({ id: "session:fixture" }),
    getSupportingMaterial: async () => ({ material: {} }),
    getVote: async () => vote(),
    listJurisdictions: async () => ({ items: [], truncated: false }),
    listSessions: async () => ({ items: [], truncated: false }),
    searchAmendments: async () => ({ items: [], truncated: false }),
    searchBillText: async () => ({
      items: [passageCandidate()],
      search: { isReranked: false, models: [] },
      truncated: false
    }),
    searchBills: async () => ({ items: [], truncated: false }),
    searchChanges: async () => ({ items: [], truncated: false }),
    searchSupportingMaterialHits: async () => ({
      items: [],
      search: { isReranked: false, models: [] },
      truncated: false,
      warnings: []
    }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false }),
    searchVotes: async () => ({ items: [], truncated: false })
  }
}

function pageBody(body: unknown, self: string): Record<string, unknown> {
  expect(body).toMatchObject({
    links: { next: null, self },
    meta: { correlationId: expect.any(String), limit: 1, nextCursor: null, truncated: false, warnings: [] }
  })
  expect(body).toHaveProperty("data", expect.any(Array))
  return body as Record<string, unknown>
}

function resourceBody(body: unknown, self: string): Record<string, unknown> {
  expect(body).toMatchObject({ links: { self }, meta: { correlationId: expect.any(String), warnings: [] } })
  expect(body).toHaveProperty("data")
  return body as Record<string, unknown>
}

type WebhookMutationRepository = SubscriptionTransaction &
  WebhookRepository & {
    activeSigningSecret(
      input: Readonly<{ id: string; owner: { organizationId: string | null; userId: string } }>
    ): Promise<EncryptedWebhookSecret | undefined>
  }

function webhookMutationHarness(): Readonly<{
  executor: PreflightSubscriptionMutationExecutor
  service: SubscriptionService
  transport: WebhookVerificationTransport
}> {
  const webhooks = new Map<string, Webhook>()
  const secrets = new Map<string, EncryptedWebhookSecret>()
  const revision = (id: string) => `00000000-0000-4000-8000-${id.padStart(12, "0")}`
  const repository: WebhookMutationRepository = {
    activateWebhook: async ({ id, when }) => {
      const current = webhooks.get(id)
      if (current === undefined) {
        throw new Error("Fixture webhook is missing")
      }
      const next = { ...current, revision: revision("4"), status: "active" as const, updatedAt: when }
      webhooks.set(id, next)
      return next
    },
    activeSigningSecret: async ({ id }) => secrets.get(id),
    appendDelivery: async () => {
      throw new Error("Not used")
    },
    appendSubscriptionEvent: async () => {
      throw new Error("Not used")
    },
    cancelSubscription: async () => undefined,
    cancelWebhook: async ({ id, when }) => {
      const current = webhooks.get(id)
      if (current === undefined) {
        throw new Error("Fixture webhook is missing")
      }
      const next = {
        ...current,
        cancelledAt: when,
        revision: revision("5"),
        status: "cancelled" as const,
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    },
    createSubscription: async () => {
      throw new Error("Not used")
    },
    createWebhook: async ({ keyId, secretCiphertext, webhook }) => {
      webhooks.set(webhook.id, webhook)
      secrets.set(webhook.id, secretCiphertext)
      return { ...webhook, activeKeyIds: [keyId] }
    },
    findExactSubscription: async () => undefined,
    getSubscription: async () => undefined,
    getWebhook: async ({ id }) => webhooks.get(id),
    listDeliveries: async () => ({ items: [], truncated: false }),
    listSubscriptionEvents: async () => ({ items: [], truncated: false }),
    listSubscriptions: async () => ({ items: [], truncated: false }),
    listWebhooks: async () => ({ items: [], truncated: false }),
    rotateWebhookSecret: async ({ id, keyId, overlapEndsAt, secretCiphertext, secretLastFour, when }) => {
      const current = webhooks.get(id)
      if (current === undefined) {
        throw new Error("Fixture webhook is missing")
      }
      secrets.set(id, secretCiphertext)
      const next = {
        ...current,
        activeKeyIds: overlapEndsAt === null ? [keyId] : [...current.activeKeyIds, keyId],
        overlapEndsAt,
        revision: revision("3"),
        secretLastFour,
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    },
    updateSubscription: async () => undefined,
    updateWebhook: async ({ id, patch, when }) => {
      const current = webhooks.get(id)
      if (current === undefined) {
        throw new Error("Fixture webhook is missing")
      }
      const next: Webhook = {
        ...current,
        ...patch,
        revision: revision("2"),
        status: patch.url === undefined ? (patch.status ?? current.status) : "pending-verification",
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    }
  }
  const service = new SubscriptionService(
    repository,
    createWebhookSecretProtector(
      async (secret) => `cipher:${secret}`,
      async (ciphertext) => ciphertext.slice("cipher:".length)
    ),
    () => new Date("2026-08-25T12:00:00.000Z"),
    (() => {
      const values = [
        "key",
        "webhook-id",
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
        "00000000-0000-4000-8000-000000000004",
        "00000000-0000-4000-8000-000000000005"
      ]
      return () => values.shift() ?? "revision-fallback"
    })()
  )
  const responses = new Map<string, Readonly<{ requestHash: string; response: IdempotentResponse<unknown> }>>()
  const keyFor = (request: IdempotencyRequest) => `${request.method}:${request.canonicalPath}:${request.key}`
  const replay = (request: IdempotencyRequest) => {
    const value = responses.get(keyFor(request))
    if (value === undefined) {
      return undefined
    }
    if (value.requestHash !== request.requestHash) {
      throw new SubscriptionRepositoryError("idempotency_conflict", "Fixture idempotency conflict")
    }
    return { replayed: true, response: value.response as IdempotentResponse<never> }
  }
  const executor: PreflightSubscriptionMutationExecutor = {
    execute: async (request, operation) => {
      const existing = replay(request)
      if (existing !== undefined) {
        return existing
      }
      const response = await operation(repository)
      responses.set(keyFor(request), { requestHash: request.requestHash, response })
      return { replayed: false, response }
    },
    executeWithPreflight: async (request, preflight, operation) => {
      const existing = replay(request)
      if (existing !== undefined) {
        return existing
      }
      const prepared = await preflight()
      const response = await operation(repository, prepared)
      responses.set(keyFor(request), { requestHash: request.requestHash, response })
      return { replayed: false, response }
    }
  }
  return { executor, service, transport: { verify: async () => true } }
}

async function startComposedServer(): Promise<string> {
  const amendmentReadRepository: AmendmentReadRepository = {
    assertBill: async () => undefined,
    getAmendment: async () => amendmentDetail(),
    listAmendments: async () => ({ items: [amendmentSummary()], truncated: false })
  }
  const billRelatedReadApi: BillRelatedReadApi = {
    assertBillExists: async () => undefined,
    listBillRelatedBills: async (): Promise<{ items: BillRelatedHitRead[]; truncated: boolean }> => ({
      items: [
        {
          bill: billSummaryRead("bill:related"),
          relationship: {
            canonicalFactsComplete: true,
            classification: "companion",
            direction: "outgoing",
            provenanceComplete: true,
            sourceIsOfficial: true,
            sourceProvider: "fixture",
            sourceRetrievedAt: new Date("2026-08-25T00:00:00Z"),
            sourceUpdatedAt: new Date("2026-08-24T00:00:00Z"),
            sourceUrl: "https://source.example.test/relation"
          },
          similarityScore: null
        }
      ],
      truncated: false
    })
  }
  const billTextReadApi: BillTextReadApi = {
    assertBillExists: async () => undefined,
    listBillTextSections: async (): Promise<{ items: CanonicalDocumentSectionRead[]; truncated: boolean }> => ({
      items: [documentSection(DOCUMENT_ID)],
      truncated: false
    })
  }
  const changeFeedApi: ChangeFeedApi = {
    assertBillExists: async () => undefined,
    listChanges: async (): Promise<{ items: ChangeEventRead[]; truncated: boolean }> => ({
      items: [changeEvent()],
      truncated: false
    })
  }
  const documentDiffApi: DocumentDiffApi = {
    readDocumentDiff: async () => ({
      left: {
        document: document(DOCUMENT_ID),
        sections: [
          {
            id: "section:left",
            ordinal: 0,
            sectionIdentifier: "1",
            sourceEndOffset: 14,
            sourceStartOffset: 0,
            text: "old text"
          }
        ]
      },
      right: {
        document: document(DOCUMENT_ID_B),
        sections: [
          {
            id: "section:right",
            ordinal: 0,
            sectionIdentifier: "1",
            sourceEndOffset: 14,
            sourceStartOffset: 0,
            text: "new text"
          }
        ]
      }
    })
  }
  const jurisdictionCollectionReadApi: JurisdictionCollectionReadApi = {
    listJurisdictions: async () => ({ items: [jurisdiction()], truncated: false })
  }
  const calendarReadApi: CalendarReadApi = {
    assertCalendarExists: async () => undefined,
    assertOrganizationExists: async () => undefined,
    getCalendarRead: async () => calendar(),
    listCalendarMeetings: async () => ({ items: [meeting()], truncated: false }),
    listCalendars: async () => ({ items: [calendar()], truncated: false })
  }
  const meetingReadApi: MeetingReadApi = {
    assertJurisdictionExists: async () => undefined,
    assertOrganizationExists: async () => undefined,
    assertSessionExists: async () => undefined,
    getMeetingRead: async () => meeting(),
    listMeetingAgenda: async () => ({ items: [], truncated: false }),
    listMeetingDocuments: async () => ({ items: [], truncated: false }),
    listMeetingOrganizations: async () => [],
    listMeetingOutcomes: async () => ({ items: [], truncated: false }),
    listMeetingParticipants: async () => ({ items: [], truncated: false }),
    listMeetings: async () => ({ items: [meeting()], truncated: false })
  }
  const organizationDetailReadApi: OrganizationDetailReadApi = {
    getOrganizationDetail: async () => ({
      canonicalUrl: `${API_BASE_URL}/api/organizations/${encodeURIComponent(ORGANIZATION_ID)}`,
      chamber: "lower",
      childPageInfo: { memberships: { limit: 1, nextCursor: null, truncated: false } },
      children: [],
      classification: "committee",
      contact: null,
      description: "Fixture organization",
      id: ORGANIZATION_ID,
      isActive: true,
      jurisdictionId: JURISDICTION_ID,
      memberships: [],
      name: "Fixture organization",
      parentOrganizationId: null,
      sources: [source("https://source.example.test/organization")],
      termsOfReference: null,
      type: "organization",
      updatedAt: "2026-08-25T00:00:00.000Z",
      websiteUrl: null
    })
  }
  const personAmendmentsApi: PersonAmendmentsApi = {
    assertPersonExists: async () => undefined,
    listPersonAmendments: async () => ({ items: [personAmendment()], truncated: false })
  }
  const personDetailReadApi: PersonDetailReadApi = { getPersonDetail: async () => personDetail() }
  const voteReadApi: VoteReadApi = {
    getVote: async () => vote(),
    listPersonVotePositions: async () => ({ items: [personVotePosition()], truncated: false }),
    listVotePositions: async () => ({ items: [], truncated: false }),
    listVotes: async () => ({ items: [vote()], truncated: false })
  }
  const webhookMutation = webhookMutationHarness()
  const apiHandler = createCompositeHttpApiHandler([
    createAmendmentReadApiHandler(amendmentReadRepository),
    createAmendmentSearchApiHandler(amendmentSearchApi(), { apiBaseUrl: API_BASE_URL }),
    createBillRelatedReadApiHandler(billRelatedReadApi, { apiBaseUrl: API_BASE_URL }),
    createBillTextReadApiHandler(billTextReadApi, { apiBaseUrl: API_BASE_URL }),
    createCalendarReadApiHandler(calendarReadApi, { apiBaseUrl: API_BASE_URL }),
    createChangeFeedApiHandler(changeFeedApi, { apiBaseUrl: API_BASE_URL }),
    createDocumentDiffApiHandler(documentDiffApi, { apiBaseUrl: API_BASE_URL }),
    createJurisdictionCollectionReadApiHandler(jurisdictionCollectionReadApi, { apiBaseUrl: API_BASE_URL }),
    createMeetingReadApiHandler(meetingReadApi, { apiBaseUrl: API_BASE_URL }),
    createOrganizationDetailReadApiHandler(organizationDetailReadApi),
    createPassageSearchApiHandler(coreService(), { apiBaseUrl: API_BASE_URL }),
    createPersonAmendmentApiHandler(personAmendmentsApi, { apiBaseUrl: API_BASE_URL }),
    createPersonDetailReadApiHandler(personDetailReadApi, { apiBaseUrl: API_BASE_URL }),
    createRepresentativeLookupApiHandler(representativeLookupApi()),
    createResearchAnswerApiHandler(researchAnswerApi()),
    createUniversalSearchApiHandler(universalSearchApi()),
    createVoteReadApiHandler(voteReadApi, { apiBaseUrl: API_BASE_URL }),
    createWebhookMutationApiHandler(webhookMutation.service, webhookMutation.executor, {
      apiBaseUrl: API_BASE_URL,
      resolvePublicUrl: async (rawUrl) =>
        await resolvePublicWebhookUrl(rawUrl, async () => [{ address: "8.8.8.8", family: 4 }]),
      transport: webhookMutation.transport
    })
  ])
  const authenticatedApiHandler = async (
    request: Parameters<typeof apiHandler>[0],
    response: Parameters<typeof apiHandler>[1]
  ) =>
    await runWithRequestContext(
      { correlationId: "composed-endpoint-smoke", identity: { userId: "fixture-user" } },
      async () => await apiHandler(request, response)
    )
  const server = createLegislationServer({ apiHandler: authenticatedApiHandler, isReady: () => true, logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

describe("composed server endpoint smoke coverage", () => {
  it("exercises the newly landed endpoint families with canonical envelopes", async () => {
    const baseUrl = await startComposedServer()
    const pageCases = [
      { path: "/api/votes?limit=1", type: "vote" },
      { path: "/api/jurisdictions?limit=1", type: "jurisdiction" },
      { path: "/api/changes?limit=1", type: "change" },
      { path: `/api/bills/${encodeURIComponent(BILL_ID)}/changes?limit=1`, type: "change" },
      { path: "/api/calendars?limit=1", type: "calendar" },
      { path: `/api/calendars/${encodeURIComponent(CALENDAR_ID)}/meetings?limit=1`, type: "meeting" },
      { path: "/api/meetings?limit=1", type: "meeting" },
      { path: `/api/people/${encodeURIComponent(PERSON_ID)}/amendments?limit=1`, type: "amendment" },
      { path: "/api/amendments?limit=1", type: "amendment" },
      { path: `/api/bills/${encodeURIComponent(BILL_ID)}/sections?limit=1`, type: "document-section" }
    ]
    for (const testCase of pageCases) {
      const response = await fetch(`${baseUrl}${testCase.path}`)
      expect(response.status).toBe(200)
      const body = pageBody(await response.json(), testCase.path)
      const item = (body.data as Array<Record<string, unknown>>)[0]
      expect(item?.type).toBe(testCase.type)
    }

    const personVotesPath = `/api/people/${encodeURIComponent(PERSON_ID)}/votes?limit=1`
    const personVotesResponse = await fetch(`${baseUrl}${personVotesPath}`)
    expect(personVotesResponse.status).toBe(200)
    const personVotesBody = pageBody(await personVotesResponse.json(), personVotesPath)
    expect((personVotesBody.data as Array<Record<string, unknown>>)[0]).toMatchObject({
      bill: { id: BILL_ID, type: "bill" },
      position: { option: "yes", type: "vote-position" },
      vote: { id: VOTE_ID, type: "vote" }
    })

    const relatedPath = `/api/bills/${encodeURIComponent(BILL_ID)}/related?mode=explicit&limit=1`
    const relatedResponse = await fetch(`${baseUrl}${relatedPath}`)
    expect(relatedResponse.status).toBe(200)
    const relatedBody = pageBody(await relatedResponse.json(), relatedPath)
    expect((relatedBody.data as Array<Record<string, unknown>>)[0]).toMatchObject({
      bill: { id: "bill:related", type: "bill" }
    })

    // Standalone meeting child routes retain exact URL coverage in meeting-agenda-read-routes.test.ts,
    // meeting-document-read-routes.test.ts, meeting-outcome-read-routes.test.ts, and
    // meeting-participant-list-routes.test.ts; this composed slice exercises the bounded detail child collections.
    const resources = [
      { path: `/api/votes/${encodeURIComponent(VOTE_ID)}`, type: "vote" },
      { path: `/api/meetings/${encodeURIComponent(MEETING_ID)}?childLimit=1`, type: "meeting" },
      { path: `/api/calendars/${encodeURIComponent(CALENDAR_ID)}`, type: "calendar" },
      { path: `/api/people/${encodeURIComponent(PERSON_ID)}`, type: "person" },
      { path: `/api/organizations/${encodeURIComponent(ORGANIZATION_ID)}`, type: "organization" },
      { path: `/api/amendments/${encodeURIComponent(AMENDMENT_ID)}`, type: "amendment" }
    ]
    for (const testCase of resources) {
      const response = await fetch(`${baseUrl}${testCase.path}`)
      expect(response.status).toBe(200)
      const body = resourceBody(await response.json(), testCase.path.split("?")[0]!)
      expect((body.data as Record<string, unknown>).type).toBe(testCase.type)
    }

    const passageResponse = await fetch(`${baseUrl}/api/search/passages`, {
      body: JSON.stringify({ limit: 1, mode: "lexical", query: "Fixture" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(passageResponse.status).toBe(200)
    const passageBody = pageBody(await passageResponse.json(), "/api/search/passages")
    expect((passageBody.data as Array<Record<string, unknown>>)[0]).toMatchObject({
      rank: 1,
      recordType: "passage",
      record: { type: "document-section" }
    })
    expect(passageBody.meta).toMatchObject({ isReranked: false, mode: "lexical", models: [] })

    const diffResponse = await fetch(`${baseUrl}/api/document-diffs`, {
      body: JSON.stringify({ billId: BILL_ID, leftDocumentId: DOCUMENT_ID, rightDocumentId: DOCUMENT_ID_B }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(diffResponse.status).toBe(200)
    const diffBody = resourceBody(await diffResponse.json(), "/api/document-diffs")
    expect(diffBody.data).toMatchObject({
      billId: BILL_ID,
      granularity: "section",
      leftDocument: { id: DOCUMENT_ID, type: "document" },
      rightDocument: { id: DOCUMENT_ID_B, type: "document" },
      truncated: false
    })

    const amendmentSearchResponse = await fetch(`${baseUrl}/api/search/amendments`, {
      body: JSON.stringify({ limit: 1, mode: "lexical", query: "Fixture", recordTypes: ["structured"] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(amendmentSearchResponse.status).toBe(200)
    const amendmentSearchBody = pageBody(await amendmentSearchResponse.json(), "/api/search/amendments")
    expect((amendmentSearchBody.data as Array<Record<string, unknown>>)[0]).toMatchObject({
      rank: 1,
      record: { id: AMENDMENT_ID, type: "amendment" },
      recordType: "amendment"
    })
    expect(amendmentSearchBody.meta).toMatchObject({ isReranked: false, mode: "lexical", models: [] })

    const universalSearchResponse = await fetch(`${baseUrl}/api/search/all`, {
      body: JSON.stringify({
        limit: 1,
        mode: "lexical",
        perTypeLimit: 1,
        query: "Fixture",
        recordTypes: ["amendment"]
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(universalSearchResponse.status).toBe(200)
    const universalSearchBody = pageBody(await universalSearchResponse.json(), "/api/search/all")
    expect((universalSearchBody.data as Array<Record<string, unknown>>)[0]).toMatchObject({
      rank: 1,
      record: { id: AMENDMENT_ID },
      recordType: "amendment"
    })
    expect(universalSearchBody.meta).toMatchObject({ groups: [{ recordType: "amendment", returned: 1 }] })

    const representativeResponse = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({
        address: {
          city: "Fixture City",
          country: "US",
          line1: "1 Fixture Way",
          line2: null,
          postalCode: "00000",
          region: "FX"
        }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(representativeResponse.status).toBe(200)
    const representativeBody = resourceBody(await representativeResponse.json(), "/api/representative-lookups")
    expect(representativeBody.data).toMatchObject({
      lookupId: "lookup:fixture",
      quality: "exact",
      representatives: [{ person: { id: PERSON_ID, type: "person" } }]
    })

    const researchAnswersResponse = await fetch(`${baseUrl}/api/research/answers`, {
      body: JSON.stringify({
        question: "What does the fixture bill require?",
        retrieval: { mode: "lexical", recordTypes: ["passage"] },
        scope: { billIds: [BILL_ID] }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(researchAnswersResponse.status).toBe(200)
    const researchAnswersBody = resourceBody(await researchAnswersResponse.json(), "/api/research/answers")
    expect(researchAnswersBody.data).toMatchObject({
      answer: "The fixture bill requires annual publication.",
      claims: [{ confidence: "supported" }],
      id: "research-answer:fixture",
      retrieval: { candidateCount: 1, evidenceCount: 1, mode: "lexical", rrfK: 60 }
    })

    const webhookCreateResponse = await fetch(`${baseUrl}/api/webhooks`, {
      body: JSON.stringify({
        eventTypes: ["vote-added"],
        name: "Fixture webhook",
        url: "https://hooks.example.test/events"
      }),
      headers: { "content-type": "application/json", "idempotency-key": "fixture-webhook-create" },
      method: "POST"
    })
    expect(webhookCreateResponse.status).toBe(201)
    expect(webhookCreateResponse.headers.get("location")).toMatch(/^\/api\/webhooks\//)
    const webhookCreateBody = resourceBody(await webhookCreateResponse.json(), "/api/webhooks")
    expect(webhookCreateBody.data).toMatchObject({
      keyId: "webhook-key:key",
      secret: expect.any(String),
      webhook: { status: "pending-verification" }
    })
    const createdWebhook = (webhookCreateBody.data as { webhook: Record<string, unknown> }).webhook
    const webhookId = String(createdWebhook.id)
    const webhookPath = `/api/webhooks/${encodeURIComponent(webhookId)}`

    const webhookUpdateResponse = await fetch(`${baseUrl}${webhookPath}`, {
      body: JSON.stringify({ name: "Fixture webhook updated" }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "fixture-webhook-update",
        "if-match": String(createdWebhook.revision)
      },
      method: "PATCH"
    })
    expect(webhookUpdateResponse.status).toBe(200)
    const webhookUpdateBody = resourceBody(await webhookUpdateResponse.json(), webhookPath)
    expect(webhookUpdateBody.data).toMatchObject({ name: "Fixture webhook updated", status: "pending-verification" })
    const updatedWebhook = webhookUpdateBody.data as Record<string, unknown>

    const webhookRotateResponse = await fetch(`${baseUrl}${webhookPath}/rotate-secret`, {
      body: JSON.stringify({ overlapSeconds: 0 }),
      headers: {
        "content-type": "application/json",
        "idempotency-key": "fixture-webhook-rotate",
        "if-match": String(updatedWebhook.revision)
      },
      method: "POST"
    })
    expect(webhookRotateResponse.status).toBe(200)
    const webhookRotateBody = resourceBody(await webhookRotateResponse.json(), `${webhookPath}/rotate-secret`)
    expect(webhookRotateBody.data).toMatchObject({ keyId: expect.any(String), secret: expect.any(String), webhook: {} })
    const rotatedWebhook = (webhookRotateBody.data as { webhook: Record<string, unknown> }).webhook

    const webhookVerifyResponse = await fetch(`${baseUrl}${webhookPath}/verify`, {
      body: "{}",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "fixture-webhook-verify",
        "if-match": String(rotatedWebhook.revision)
      },
      method: "POST"
    })
    expect(webhookVerifyResponse.status).toBe(200)
    const webhookVerifyBody = resourceBody(await webhookVerifyResponse.json(), `${webhookPath}/verify`)
    expect(webhookVerifyBody.data).toMatchObject({ status: "active" })
    const verifiedWebhook = webhookVerifyBody.data as Record<string, unknown>

    const webhookDeleteResponse = await fetch(`${baseUrl}${webhookPath}`, {
      headers: { "idempotency-key": "fixture-webhook-delete", "if-match": String(verifiedWebhook.revision) },
      method: "DELETE"
    })
    expect(webhookDeleteResponse.status).toBe(200)
    const webhookDeleteBody = resourceBody(await webhookDeleteResponse.json(), webhookPath)
    expect(webhookDeleteBody.data).toMatchObject({ id: webhookId, cancelledAt: "2026-08-25T12:00:00.000Z" })
  })

  it("rejects lookalike aliases for every newly covered route family", async () => {
    const baseUrl = await startComposedServer()
    const outsideApiAliases = [{ method: "GET", path: "/%61pi/votes" }] as const
    for (const alias of outsideApiAliases) {
      const response = await fetch(`${baseUrl}${alias.path}`, { method: alias.method })
      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: "not_found" })
    }

    const invalidApiAlias = { method: "GET", path: "/api/meetings/" } as const
    const invalidResponse = await fetch(`${baseUrl}${invalidApiAlias.path}`, { method: invalidApiAlias.method })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })

    const apiAliases = [
      { method: "GET", path: "/api//jurisdictions" },
      { method: "GET", path: "/api/changes/" },
      { method: "GET", path: `/api/bills/${encodeURIComponent(BILL_ID)}/related/` },
      { method: "GET", path: `/api/calendars/${encodeURIComponent(CALENDAR_ID)}/meetings/` },
      { method: "POST", path: "/api/document-diffs/" },
      { method: "GET", path: `/api/people/${encodeURIComponent(PERSON_ID)}/profile` },
      { method: "GET", path: `/api/people/${encodeURIComponent(PERSON_ID)}/amendments/extra` },
      { method: "GET", path: `/api/people/${encodeURIComponent(PERSON_ID)}/votes/` },
      { method: "GET", path: `/api/organizations/${encodeURIComponent(ORGANIZATION_ID)}/` },
      { method: "GET", path: `/api/amendments/${encodeURIComponent(AMENDMENT_ID)}/` },
      { method: "POST", path: "/api/search/amendments/" },
      { method: "POST", path: "/api/search/all/" },
      { method: "POST", path: "/api/search/passages/" },
      { method: "POST", path: "/api/representative-lookups/" },
      { method: "POST", path: "/api/research/answers/" },
      { method: "POST", path: "/api/webhooks/" },
      { method: "GET", path: `/api/bills/${encodeURIComponent(BILL_ID)}/sections/` }
    ] as const
    for (const alias of apiAliases) {
      const response = await fetch(`${baseUrl}${alias.path}`, {
        body: alias.method === "POST" ? JSON.stringify({ query: "Fixture" }) : undefined,
        headers: alias.method === "POST" ? { "content-type": "application/json" } : undefined,
        method: alias.method
      })
      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({ error: { category: "not_found" } })
    }
  })
})
