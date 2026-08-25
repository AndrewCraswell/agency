import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  projectAmendmentSummary,
  projectBillDetail,
  projectBillSummary,
  projectPersonSummary,
  projectVoteDetail,
  projectVoteSummary,
  type AmendmentSummary,
  type BillAction,
  type BillDetail,
  type BillRelation,
  type PersonSummary,
  type Sponsor,
  type VoteCounts,
  type VoteDetail,
  type VotePosition,
  type VoteSummaryProjectionInput,
  type VoteSummary
} from "../../api/canonical-projection.js"
import { sourceProjectionContext } from "../../api/canonical-read.js"
import { projectDocumentSummaryRead } from "../../api/document-read-routes.js"
import { projectOrganizationRow } from "../../api/organization-summary-read-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import {
  amendments,
  billActions,
  billOrganizations,
  billRelations,
  billSponsors,
  bills,
  organizations,
  people,
  votePositions,
  votes
} from "../schema/schema.js"
import { listBillDocuments } from "./document-reads.js"

const MAX_CHILD_LIMIT = 25

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
      .orderBy(asc(votes.heldAt), asc(votes.id))
      .limit(childLimit + 1),
    listBillDocuments(database, { billId: id, limit: childLimit }),
    database
      .select()
      .from(amendments)
      .where(eq(amendments.billId, id))
      .orderBy(asc(amendments.submittedDate), asc(amendments.id))
      .limit(childLimit + 1),
    listBillDocuments(database, { billId: id, classification: "amendment", limit: childLimit })
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

  const amendmentItems = [
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
    ...documentAmendments.items.map((document) =>
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
  ]
    .toSorted(amendmentOrder)
    .slice(0, childLimit)
  const amendmentsTruncated =
    structuredAmendments.length > childLimit ||
    documentAmendments.truncated ||
    structuredAmendments.length + documentAmendments.items.length > childLimit
  const lastAmendment = amendmentItems.at(-1)
  const documents = documentPage.items.map((document) => projectDocumentSummaryRead(document, apiBaseUrl))
  const canonicalOrganizations = organizationRows.map(({ row }) => projectOrganizationRow(row, apiBaseUrl))
  const latestActions = actionRows.map((action) => projectAction(action, canonicalOrganizations, apiBaseUrl))
  const sponsors = sponsorRows.map(({ person, sponsor }) => projectSponsor(sponsor, person, canonicalBill, apiBaseUrl))
  const canonicalRelations = relations.map(({ relatedBill, relation }) =>
    projectRelation(relation, relatedBill, canonicalBill, apiBaseUrl)
  )
  const detailVoteRows = voteRows.slice(0, childLimit)
  const votePageInfo = billDetailVotePageInfo(voteRows.length, detailVoteRows.at(-1), childLimit, { billId: id })
  const voteSummaries = projectVotes(detailVoteRows, votePositionRows, apiBaseUrl)

  return projectBillDetail(
    {
      abstract: bill.summary,
      amendments: amendmentItems,
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
          nextCursor:
            amendmentsTruncated && lastAmendment !== undefined
              ? encodeBillAmendmentCursor(amendmentKey(lastAmendment), { billId: id })
              : null,
          truncated: amendmentsTruncated
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
  const limit = parseChildLimit(input.limit)
  const scope = billVoteScope(input, billId)
  const after = decodeBillVoteCursor(input.cursor, scope)
  await assertBillDetailParent(database, billId)
  const voteRows = await database
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.billId, billId),
        after === undefined ? undefined : afterVoteKey(votes.heldAt, votes.id, after),
        input.classification === undefined ? undefined : eq(votes.classification, input.classification),
        input.from === undefined ? undefined : gte(votes.heldAt, input.from),
        input.to === undefined ? undefined : lte(votes.heldAt, input.to),
        input.organizationId === undefined ? undefined : eq(votes.organizationId, input.organizationId),
        input.result === undefined ? undefined : voteResultCondition(input.result)
      )
    )
    .orderBy(asc(votes.heldAt), asc(votes.id))
    .limit(limit + 1)
  const voteIds = voteRows.map((vote) => vote.id)
  const positions =
    voteIds.length === 0
      ? []
      : await database
          .select({ person: people, position: votePositions })
          .from(votePositions)
          .leftJoin(people, eq(votePositions.personId, people.id))
          .where(inArray(votePositions.voteId, voteIds))
          .orderBy(asc(votePositions.voteId), asc(votePositions.sourceIdentity))
  const items = voteRows.slice(0, limit).map((vote) => projectVoteDetailRead(vote, positions, apiBaseUrl))
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

function projectVotes(
  votesForBill: readonly (typeof votes.$inferSelect)[],
  positionRows: readonly (typeof votePositions.$inferSelect)[],
  apiBaseUrl: string
): VoteSummary[] {
  const positionsByVote = new Map<string, (typeof votePositions.$inferSelect)[]>()
  for (const position of positionRows) {
    const positions = positionsByVote.get(position.voteId)
    if (positions === undefined) {
      positionsByVote.set(position.voteId, [position])
    } else {
      positions.push(position)
    }
  }
  return votesForBill.map((vote) => {
    const sourceUrl = requiredVoteSourceUrl(vote.sourceUrl)
    return projectVoteSummary(
      voteSummaryProjectionInput(vote, positionsByVote.get(vote.id) ?? []),
      sourceProjectionContext(
        {
          createdAt: vote.createdAt,
          id: vote.id,
          sourceUrl,
          updatedAt: vote.createdAt
        },
        apiBaseUrl
      )
    )
  })
}

function voteSummaryProjectionInput(
  vote: typeof votes.$inferSelect,
  positions: readonly (typeof votePositions.$inferSelect)[]
): VoteSummaryProjectionInput {
  const date = vote.heldAt?.toISOString().slice(0, 10)
  if (date === undefined) {
    throw incomplete("Vote date is not persisted")
  }
  return {
    billId: vote.billId,
    classification: vote.classification,
    counts: voteCounts(vote, positions),
    date,
    heldAt: vote.heldAt,
    id: vote.id,
    motion: vote.motion,
    organizationId: vote.organizationId,
    question: vote.question,
    result: voteResult(vote.result),
    sourceUrl: requiredVoteSourceUrl(vote.sourceUrl)
  }
}

function projectVoteDetailRead(
  vote: typeof votes.$inferSelect,
  rows: readonly { person: typeof people.$inferSelect | null; position: typeof votePositions.$inferSelect }[],
  apiBaseUrl: string
): VoteDetail {
  const positionRows = rows.filter((row) => row.position.voteId === vote.id)
  const input = voteSummaryProjectionInput(
    vote,
    positionRows.map((row) => row.position)
  )
  const sourceUrl = requiredVoteSourceUrl(vote.sourceUrl)
  const context = sourceProjectionContext(
    { createdAt: vote.createdAt, id: vote.id, sourceUrl, updatedAt: vote.createdAt },
    apiBaseUrl
  )
  const summary = projectVoteSummary(input, context)
  const positions = positionRows.map((row) =>
    projectVotePosition(row.position, row.person, vote, summary.sources, apiBaseUrl)
  )
  return projectVoteDetail(
    {
      positions,
      positionsPageInfo: { limit: Math.max(positions.length, 1), nextCursor: null, truncated: false },
      vote: input
    },
    context
  )
}

function projectVotePosition(
  position: typeof votePositions.$inferSelect,
  person: typeof people.$inferSelect | null,
  vote: typeof votes.$inferSelect,
  sources: VotePosition["sources"],
  apiBaseUrl: string
): VotePosition {
  if (position.sourceName === null) {
    throw incomplete("Vote position source name is not persisted")
  }
  return {
    canonicalUrl: new URL(
      `/api/votes/${encodeURIComponent(vote.id)}#${encodeURIComponent(position.sourceIdentity)}`,
      apiBaseUrl
    ).toString(),
    id: position.sourceIdentity,
    option: votePositionOption(position.option),
    person: person === null ? null : projectSponsorPerson(person, apiBaseUrl),
    sourceName: position.sourceName,
    sourcePersonId: position.sourcePersonId,
    sources,
    type: "vote-position",
    updatedAt: position.createdAt.toISOString(),
    voteId: vote.id
  }
}

function votePositionOption(value: string): VotePosition["option"] {
  switch (value) {
    case "yes":
    case "no":
    case "absent":
    case "abstain":
    case "not-voting":
    case "present":
    case "proxy":
    case "paired":
    case "other":
      return value
    default:
      throw incomplete("Vote position option is not canonical")
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

function voteCounts(
  vote: typeof votes.$inferSelect,
  positions: readonly (typeof votePositions.$inferSelect)[]
): VoteCounts {
  if (vote.yesCount === null || vote.noCount === null || vote.otherCount === null) {
    throw incomplete("Vote counts are incomplete")
  }
  const expected = vote.yesCount + vote.noCount + vote.otherCount
  if (vote.otherCount === 0) {
    return {
      absent: 0,
      abstain: 0,
      no: vote.noCount,
      notVoting: 0,
      other: 0,
      paired: 0,
      present: 0,
      proxy: 0,
      yes: vote.yesCount
    }
  }
  if (positions.length !== expected) {
    throw incomplete("Vote option counts cannot be derived from incomplete positions")
  }
  const count = (option: (typeof votePositions.$inferSelect)["option"]) =>
    positions.filter((position) => position.option === option).length
  if (count("yes") !== vote.yesCount || count("no") !== vote.noCount) {
    throw incomplete("Vote positions do not match persisted counts")
  }
  return {
    absent: count("absent"),
    abstain: count("abstain"),
    no: count("no"),
    notVoting: count("not-voting"),
    other: count("other"),
    paired: count("paired"),
    present: count("present"),
    proxy: count("proxy"),
    yes: count("yes")
  }
}

function voteResult(value: string | null): VoteSummary["result"] {
  switch (value?.toLowerCase()) {
    case "pass":
    case "passed":
      return "passed"
    case "fail":
    case "failed":
      return "failed"
    case "other":
      return "other"
    case null:
      throw incomplete("Vote result is not persisted")
    default:
      throw incomplete("Vote result is not canonical")
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

export type BillAmendmentCursorScope = Readonly<{
  billId: string
  recordType?: "document" | "structured"
  status?: string
  submittedFrom?: string
  submittedTo?: string
}>

export type BillVoteCursorScope = Readonly<{
  billId: string
  classification?: string
  from?: string
  organizationId?: string
  result?: "failed" | "other" | "passed"
  to?: string
}>

type AmendmentKey = Readonly<{ id: string; recordType: "document" | "structured"; submittedDate: string | null }>
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

function encodeBillAmendmentCursor(key: AmendmentKey, scope: BillAmendmentCursorScope): string {
  return Buffer.from(JSON.stringify({ key, scope, version: 1 }), "utf8").toString("base64url")
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
  scope: BillAmendmentCursorScope | BillVoteCursorScope,
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

function amendmentOrder(left: AmendmentSummary, right: AmendmentSummary): number {
  return (
    nullableDateOrder(left.submittedDate, right.submittedDate) ||
    left.recordType.localeCompare(right.recordType) ||
    left.id.localeCompare(right.id)
  )
}

function amendmentKey(value: AmendmentSummary): AmendmentKey {
  return { id: value.id, recordType: value.recordType, submittedDate: value.submittedDate }
}

function voteKey(value: typeof votes.$inferSelect): VoteKey {
  return { heldAt: value.heldAt?.toISOString() ?? null, id: value.id }
}

function nullableDateOrder(left: string | null, right: string | null): number {
  if (left === null) {
    return right === null ? 0 : 1
  }
  return right === null ? -1 : left.localeCompare(right)
}

function afterVoteKey(date: AnyPgColumn, id: AnyPgColumn, key: VoteKey) {
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
