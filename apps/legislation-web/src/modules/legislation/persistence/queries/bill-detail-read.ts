import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  billActions,
  billOrganizations,
  billRelations,
  billSponsors,
  bills,
  organizations,
  people,
  votePositions,
  votes
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, inArray, isNull, or, type SQL } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  projectAmendmentSummary,
  projectBillDetail,
  projectBillSummary,
  projectPersonSummary,
  type AmendmentSummary,
  type BillAction,
  type BillDetail,
  type BillRelation,
  type PersonSummary,
  type Sponsor,
  type VoteDetail
} from "../../../request-handling/api/canonical-projection"
import { sourceProjectionContext } from "../../../request-handling/api/canonical-read"
import { projectDocumentSummaryRead } from "../../../request-handling/api/document-read-routes"
import { projectOrganizationRow } from "../../../request-handling/api/organization-summary-read-projection"
import { projectVote, projectVoteDetailRead } from "../../../request-handling/api/vote-read-routes"
import {
  amendmentContinuationCursor,
  buildDocumentAmendmentListQuery,
  buildStructuredAmendmentListQuery,
  compareAmendmentReadOrder
} from "./amendment-reads"
import { listBillDocuments } from "./document-reads"
import { voteDateBound, voteSortInstant, voteSortTimestamp } from "./vote-occurrence"
import { assertCanonicalVotePersistence, assertVotePositionSequence, listVotePositionReads } from "./vote-reads"

const MAX_CHILD_LIMIT = 25
/** Vote details embed positions, so this relationship keeps the 25-item cap. */
export const MAX_BILL_VOTE_LIMIT = 25

/**
 * Each non-paged child read has a hard materialization ceiling. The extra row
 * lets the detail read reject over-limit canonical data without reading an
 * unbounded collection.
 */
export const BILL_DETAIL_READ_LIMITS = {
  actions: 101,
  organizations: 251,
  relations: 501,
  sponsors: 501
} as const

export type BillDetailReadInput = Readonly<{ childLimit?: number; id: string }>
export type BillVoteReadInput = Readonly<{
  billId: string
  classification?: string
  cursor?: string
  from?: Date
  limit?: number
  organizationId?: string
  result?: "failed" | "other" | "passed"
  to?: Date
}>
export type BillDetailPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string; truncated: boolean }>

/**
 * Presence of an incomplete child is a typed read failure, not permission to
 * silently omit it or synthesize a canonical value.
 */
export async function getBillDetailRead(
  database: LegislationDatabase,
  input: BillDetailReadInput,
  apiBaseUrl: string
): Promise<BillDetail> {
  const childLimit = parseChildLimit(input.childLimit)
  const id = requiredId(input.id)
  const bill = await database.query.bills.findFirst({ where: eq(bills.id, id) })
  if (bill === undefined) {
    throw new LegislationError("not_found", `Bill ${id} was not found`)
  }

  const [
    actionRows,
    sponsorRows,
    organizationRows,
    relations,
    voteRows,
    documentPage,
    structuredAmendments,
    documentAmendments
  ] = await Promise.all([
    database
      .select()
      .from(billActions)
      .where(eq(billActions.billId, id))
      .orderBy(asc(billActions.ordinal))
      .limit(BILL_DETAIL_READ_LIMITS.actions),
    database
      .select({ sponsor: billSponsors, person: people })
      .from(billSponsors)
      .leftJoin(people, eq(billSponsors.personId, people.id))
      .where(eq(billSponsors.billId, id))
      .orderBy(asc(billSponsors.id))
      .limit(BILL_DETAIL_READ_LIMITS.sponsors),
    database
      .select({ row: organizations })
      .from(billOrganizations)
      .innerJoin(organizations, eq(billOrganizations.organizationId, organizations.id))
      .where(eq(billOrganizations.billId, id))
      .orderBy(asc(organizations.name), asc(organizations.id))
      .limit(BILL_DETAIL_READ_LIMITS.organizations),
    database
      .select({ relation: billRelations, relatedBill: bills })
      .from(billRelations)
      .leftJoin(bills, eq(billRelations.relatedBillId, bills.id))
      .where(eq(billRelations.billId, id))
      .orderBy(asc(billRelations.relatedBillId))
      .limit(BILL_DETAIL_READ_LIMITS.relations),
    database
      .select()
      .from(votes)
      .where(eq(votes.billId, id))
      .orderBy(asc(voteSortTimestamp()), asc(votes.id))
      .limit(childLimit + 1),
    listBillDocuments(database, { billId: id, limit: childLimit }),
    buildStructuredAmendmentListQuery(database, { billId: id }, undefined, "submitted-desc", childLimit),
    buildDocumentAmendmentListQuery(database, { billId: id }, undefined, "submitted-desc", childLimit)
  ])

  if (organizationRows.length > 250) {
    throw incomplete("Bill organizations exceed the canonical persistence maximum")
  }
  if (actionRows.length > 100 || sponsorRows.length > 500 || relations.length > 500) {
    throw incomplete("Bill child collection exceeds its canonical persistence maximum")
  }

  const voteIds = voteRows.map((vote) => vote.id)
  const votePositionRows =
    voteIds.length === 0
      ? []
      : await database
          .select()
          .from(votePositions)
          .where(inArray(votePositions.voteId, voteIds))
          .orderBy(asc(votePositions.voteId), asc(votePositions.sourceIdentity))

  const canonicalBill = projectBillSummary(
    {
      classification: bill.classification,
      id: bill.id,
      identifier: bill.identifier,
      introducedDate: bill.introducedAt,
      jurisdictionId: bill.jurisdictionId,
      latestActionAt: null,
      sessionId: bill.sessionId,
      sourceUrl: bill.sourceUrl,
      status: bill.status,
      subjects: bill.subjects,
      title: bill.title
    },
    sourceProjectionContext(bill, apiBaseUrl)
  )

  const amendmentPage = billDetailAmendmentPage(
    [
      ...structuredAmendments.map((amendment) =>
        projectAmendmentSummary(
          {
            billId: id,
            documentId: null,
            id: amendment.id,
            identifier: amendment.printedIdentifier,
            jurisdictionId: amendment.jurisdictionId,
            recordType: "structured",
            sourceUrl: amendment.sourceUrl,
            status: amendment.status,
            submittedDate: amendment.submittedDate,
            title: amendment.purpose ?? amendment.printedIdentifier
          },
          sourceProjectionContext(amendment, apiBaseUrl)
        )
      ),
      ...documentAmendments.map(({ document }) =>
        projectAmendmentSummary(
          {
            billId: id,
            documentId: document.id,
            id: `amendment:document:${document.id}`,
            identifier: document.title,
            jurisdictionId: bill.jurisdictionId,
            recordType: "document",
            sourceUrl: document.sourceUrl,
            status: null,
            submittedDate: document.documentDate,
            title: document.title
          },
          sourceProjectionContext(document, apiBaseUrl)
        )
      )
    ],
    childLimit,
    id,
    structuredAmendments.length > childLimit || documentAmendments.length > childLimit
  )
  const documents = documentPage.items.map((document) => projectDocumentSummaryRead(document, apiBaseUrl))
  const canonicalOrganizations = organizationRows.map(({ row }) => projectOrganizationRow(row, apiBaseUrl))
  const latestActions = actionRows.map((action) => projectAction(action, canonicalOrganizations, apiBaseUrl))
  const sponsors = sponsorRows.map(({ person, sponsor }) => projectSponsor(sponsor, person, canonicalBill, apiBaseUrl))
  const canonicalRelations = relations.map(({ relatedBill, relation }) =>
    projectRelation(relation, relatedBill, canonicalBill, apiBaseUrl)
  )
  const detailVoteRows = voteRows.slice(0, childLimit)
  assertCanonicalBillVotes(detailVoteRows, votePositionRows)
  const votePageInfo = billDetailVotePageInfo(voteRows.length, detailVoteRows.at(-1), childLimit, { billId: id })
  const voteSummaries = detailVoteRows.map((vote) => projectVote(vote, apiBaseUrl))

  return projectBillDetail(
    {
      abstract: bill.summary,
      amendments: amendmentPage.items,
      bill: {
        classification: bill.classification,
        id: bill.id,
        identifier: bill.identifier,
        introducedDate: bill.introducedAt,
        jurisdictionId: bill.jurisdictionId,
        latestActionAt: latestActions.at(-1)?.occurredAt ?? null,
        sessionId: bill.sessionId,
        sourceUrl: bill.sourceUrl,
        status: bill.status,
        subjects: bill.subjects,
        title: bill.title
      },
      childPageInfo: {
        amendments: {
          limit: childLimit,
          nextCursor: amendmentPage.nextCursor,
          truncated: amendmentPage.truncated
        },
        documents: {
          limit: childLimit,
          nextCursor: documentPage.nextCursor ?? null,
          truncated: documentPage.truncated
        },
        votes: {
          limit: childLimit,
          nextCursor: votePageInfo.nextCursor,
          truncated: votePageInfo.truncated
        }
      },
      documents,
      latestActions,
      organizations: canonicalOrganizations,
      relations: canonicalRelations,
      sponsors,
      voteSummaries
    },
    sourceProjectionContext(bill, apiBaseUrl)
  )
}

export async function listBillVoteReads(
  database: LegislationDatabase,
  input: BillVoteReadInput,
  apiBaseUrl: string
): Promise<BillDetailPage<VoteDetail>> {
  const billId = requiredId(input.billId)
  const limit = parseBillVoteLimit(input.limit)
  const scope = billVoteScope(input, billId)
  const after = decodeBillVoteCursor(input.cursor, scope)
  await assertBillDetailParent(database, billId)
  const voteRows = await database
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.billId, billId),
        after === undefined ? undefined : afterVoteKey(voteSortTimestamp(), votes.id, after),
        input.classification === undefined ? undefined : eq(votes.classification, input.classification),
        input.from === undefined ? undefined : voteDateBound(input.from.toISOString(), "from"),
        input.to === undefined ? undefined : voteDateBound(input.to.toISOString(), "to"),
        input.organizationId === undefined ? undefined : eq(votes.organizationId, input.organizationId),
        input.result === undefined ? undefined : voteResultCondition(input.result)
      )
    )
    .orderBy(asc(voteSortTimestamp()), asc(votes.id))
    .limit(limit + 1)
  const items: VoteDetail[] = []
  for (const vote of voteRows.slice(0, limit)) {
    assertCanonicalVotePersistence(vote)
    const positions = await listVotePositionReads(database, { voteId: vote.id, limit: 25 })
    items.push(projectVoteDetailRead(vote, positions, apiBaseUrl))
  }
  const truncated = voteRows.length > limit
  const lastVote = voteRows[limit - 1]
  return {
    items,
    nextCursor: truncated && lastVote !== undefined ? encodeBillVoteCursor(voteKey(lastVote), scope) : undefined,
    truncated
  }
}

async function assertBillDetailParent(database: LegislationDatabase, billId: string): Promise<void> {
  const bill = await database.query.bills.findFirst({ where: eq(bills.id, billId) })
  if (bill === undefined) {
    throw new LegislationError("not_found", `Bill ${billId} was not found`)
  }
}

function parseChildLimit(value: number | undefined): number {
  const limit = value ?? MAX_CHILD_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_CHILD_LIMIT) {
    throw new LegislationError("invalid_request", `childLimit must be an integer between 1 and ${MAX_CHILD_LIMIT}`)
  }
  return limit
}

export function parseBillVoteLimit(value: number | undefined): number {
  const limit = value ?? MAX_CHILD_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BILL_VOTE_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be an integer between 1 and ${MAX_BILL_VOTE_LIMIT}`)
  }
  return limit
}

/**
 * The embedded amendment page has exactly the default ordering and cursor
 * scope of the dedicated amendment relationship collection. Its continuation
 * can therefore be passed directly to GET /api/bills/{billId}/amendments.
 */
export function billDetailAmendmentPage(
  amendments: readonly AmendmentSummary[],
  childLimit: number,
  billId: string,
  hasAdditionalSourceRows = false
): Readonly<{ items: readonly AmendmentSummary[]; nextCursor: string | null; truncated: boolean }> {
  const ordered = amendments.toSorted((left, right) => compareAmendmentReadOrder(left, right, "submitted-desc"))
  const items = ordered.slice(0, childLimit)
  const last = items.at(-1)
  const truncated = ordered.length > childLimit || hasAdditionalSourceRows
  return {
    items,
    nextCursor: truncated && last !== undefined ? amendmentContinuationCursor(last, { billId }) : null,
    truncated
  }
}

function assertCanonicalBillVotes(
  voteRows: readonly (typeof votes.$inferSelect)[],
  positions: readonly (typeof votePositions.$inferSelect)[]
): void {
  voteRows.forEach(assertCanonicalVotePersistence)
  positions.forEach((position) => {
    if (voteRows.some((vote) => vote.id === position.voteId)) {
      assertVotePositionSequence(position)
    }
  })
}

function projectAction(
  action: typeof billActions.$inferSelect,
  organizations: ReadonlyArray<BillDetail["organizations"][number]>,
  apiBaseUrl: string
): BillAction {
  const date = action.actionDate ?? action.actionAt?.toISOString().slice(0, 10)
  if (date === undefined) {
    throw incomplete("Bill action date is not persisted")
  }
  if (action.sourceUrl === null) {
    throw incomplete("Bill action canonical provenance is not persisted")
  }
  const organization =
    action.organizationId === null
      ? null
      : (organizations.find((candidate) => candidate.id === action.organizationId) ??
        (() => {
          throw incomplete("Bill action organization is not canonically available")
        })())
  return {
    billId: action.billId,
    // Contract gap: no singular action route exists. This stable timeline
    // fragment is retained until the HTTP contract adds one; do not add an
    // undocumented action endpoint merely to make it dereferenceable.
    canonicalUrl: new URL(
      `/api/bills/${encodeURIComponent(action.billId)}/timeline#${encodeURIComponent(action.id)}`,
      apiBaseUrl
    ).toString(),
    classifications: action.classification,
    date,
    description: action.description,
    id: action.id,
    occurredAt: action.actionAt?.toISOString() ?? null,
    organization,
    sequence: action.ordinal,
    sources: projectActionSources(action, apiBaseUrl),
    type: "bill-action",
    updatedAt: action.createdAt.toISOString()
  }
}

function projectActionSources(action: typeof billActions.$inferSelect, apiBaseUrl: string): BillAction["sources"] {
  if (action.sourceUrl === null) {
    throw incomplete("Bill action canonical provenance is not persisted")
  }
  const context = sourceProjectionContext(
    { createdAt: action.createdAt, id: action.id, sourceUrl: action.sourceUrl, updatedAt: action.createdAt },
    apiBaseUrl
  )
  const source = context.sources[0]
  return [
    {
      isOfficial: source.isOfficial,
      provider: source.provider,
      retrievedAt: isoTimestamp(source.retrievedAt),
      sourceUpdatedAt: source.sourceUpdatedAt === null ? null : isoTimestamp(source.sourceUpdatedAt),
      sourceUrl: source.sourceUrl
    }
  ]
}

function isoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function projectSponsor(
  sponsor: typeof billSponsors.$inferSelect,
  person: typeof people.$inferSelect | null,
  bill: Pick<BillDetail, "sources">,
  apiBaseUrl: string
): Sponsor {
  return {
    classification: sponsorClassification(sponsor.classification),
    isPrimary: sponsor.isPrimary,
    person: person === null ? null : projectSponsorPerson(person, apiBaseUrl),
    sourceName: sponsor.name,
    sources: bill.sources
  }
}

function projectSponsorPerson(person: typeof people.$inferSelect, apiBaseUrl: string): PersonSummary {
  if (
    !person.provenanceComplete ||
    person.jurisdictionId === null ||
    person.isActive === null ||
    person.sourceUrl === null ||
    person.sourceProvider === null ||
    person.sourceRetrievedAt === null ||
    person.sourceIsOfficial === null
  ) {
    throw incomplete("Bill sponsor person canonical provenance is incomplete")
  }
  return projectPersonSummary(
    {
      familyName: person.familyName,
      givenName: person.givenName,
      id: person.id,
      imageUrl: null,
      isActive: person.isActive,
      jurisdictionIds: [person.jurisdictionId],
      name: person.name,
      party: person.party,
      sourceUrl: person.sourceUrl
    },
    sourceProjectionContext(
      {
        createdAt: person.createdAt,
        id: person.id,
        sourceUpdatedAt: person.sourceUpdatedAt,
        sourceUrl: person.sourceUrl,
        updatedAt: person.updatedAt,
        upstreamIds: person.upstreamIds
      },
      apiBaseUrl
    )
  )
}

function projectRelation(
  relation: typeof billRelations.$inferSelect,
  relatedBill: typeof bills.$inferSelect | null,
  bill: Pick<BillDetail, "sources">,
  apiBaseUrl: string
): BillRelation {
  if (relatedBill === null) {
    throw incomplete("Related bill is not canonically available")
  }
  return {
    classification: relationClassification(relation.classification),
    relatedBill: projectBillSummary(
      {
        classification: relatedBill.classification,
        id: relatedBill.id,
        identifier: relatedBill.identifier,
        introducedDate: relatedBill.introducedAt,
        jurisdictionId: relatedBill.jurisdictionId,
        latestActionAt: null,
        sessionId: relatedBill.sessionId,
        sourceUrl: relatedBill.sourceUrl,
        status: relatedBill.status,
        subjects: relatedBill.subjects,
        title: relatedBill.title
      },
      sourceProjectionContext(relatedBill, apiBaseUrl)
    ),
    sources: bill.sources
  }
}

export function requiredVoteSourceUrl(sourceUrl: string | null): string {
  if (sourceUrl === null) {
    throw incomplete("Vote canonical provenance is not persisted")
  }
  return sourceUrl
}

export function billDetailVotePageInfo(
  candidateCount: number,
  lastVote: typeof votes.$inferSelect | undefined,
  childLimit: number,
  scope: BillVoteCursorScope
): Readonly<{ nextCursor: string | null; truncated: boolean }> {
  const truncated = candidateCount > childLimit
  return {
    nextCursor: truncated && lastVote !== undefined ? encodeBillVoteCursor(voteKey(lastVote), scope) : null,
    truncated
  }
}

function sponsorClassification(value: string): Sponsor["classification"] {
  switch (value) {
    case "primary":
    case "cosponsor":
    case "author":
    case "other":
      return value
    case "sponsor":
      return "other"
    default:
      throw incomplete("Bill sponsor classification is not canonical")
  }
}

function relationClassification(value: string): BillRelation["classification"] {
  switch (value) {
    case "companion":
    case "replacement":
    case "replaced-by":
    case "prior-session":
    case "related":
    case "other":
      return value
    default:
      throw incomplete("Bill relation classification is not canonical")
  }
}

function requiredId(value: string): string {
  const id = value.trim()
  if (id.length < 1 || id.length > 256) {
    throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
  }
  return id
}

function incomplete(message: string): LegislationError {
  return new LegislationError("unprocessable", message)
}

export type BillVoteCursorScope = Readonly<{
  billId: string
  classification?: string
  from?: string
  organizationId?: string
  result?: "failed" | "other" | "passed"
  to?: string
}>

type VoteKey = Readonly<{ heldAt: string | null; id: string }>

function billVoteScope(input: BillVoteReadInput, billId: string): BillVoteCursorScope {
  return {
    billId,
    ...(input.classification === undefined ? {} : { classification: input.classification }),
    ...(input.from === undefined ? {} : { from: input.from.toISOString() }),
    ...(input.organizationId === undefined ? {} : { organizationId: input.organizationId }),
    ...(input.result === undefined ? {} : { result: input.result }),
    ...(input.to === undefined ? {} : { to: input.to.toISOString() })
  }
}

function encodeBillVoteCursor(key: VoteKey, scope: BillVoteCursorScope): string {
  return Buffer.from(JSON.stringify({ key, scope, version: 1 }), "utf8").toString("base64url")
}

function decodeBillVoteCursor(cursor: string | undefined, scope: BillVoteCursorScope): VoteKey | undefined {
  const parsed = decodeCursor(cursor, scope, "bill vote")
  if (parsed === undefined) {
    return undefined
  }
  if (!isVoteKey(parsed.key)) {
    throw new LegislationError("invalid_request", "Invalid bill vote pagination cursor")
  }
  return parsed.key
}

function decodeCursor(
  cursor: string | undefined,
  scope: BillVoteCursorScope,
  label: string
): Readonly<{ key: unknown; scope: unknown; version: 1 }> | undefined {
  if (cursor === undefined) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (!isCursor(parsed) || JSON.stringify(parsed.scope) !== JSON.stringify(scope)) {
      throw new Error("invalid")
    }
    return parsed
  } catch {
    throw new LegislationError("invalid_request", `Invalid ${label} pagination cursor`)
  }
}

function isCursor(value: unknown): value is Readonly<{ key: unknown; scope: unknown; version: 1 }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    "scope" in value &&
    "version" in value &&
    typeof value.scope === "object" &&
    value.scope !== null &&
    value.version === 1
  )
}

function voteKey(value: typeof votes.$inferSelect): VoteKey {
  return { heldAt: voteSortInstant(value)?.toISOString() ?? null, id: value.id }
}

function afterVoteKey(date: SQL, id: AnyPgColumn, key: VoteKey) {
  return key.heldAt === null
    ? and(isNull(date), gt(id, key.id))
    : or(isNull(date), gt(date, new Date(key.heldAt)), and(eq(date, new Date(key.heldAt)), gt(id, key.id)))
}

function isVoteKey(value: unknown): value is VoteKey {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "heldAt" in value &&
    typeof value.id === "string" &&
    (value.heldAt === null || (typeof value.heldAt === "string" && !Number.isNaN(new Date(value.heldAt).getTime())))
  )
}

function voteResultCondition(result: BillVoteReadInput["result"]) {
  switch (result) {
    case "passed":
      return inArray(votes.result, ["pass", "passed"])
    case "failed":
      return inArray(votes.result, ["fail", "failed"])
    case "other":
      return eq(votes.result, "other")
    default:
      throw new LegislationError("invalid_request", "Vote result must be passed, failed, or other")
  }
}
