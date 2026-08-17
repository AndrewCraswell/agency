import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import { findChangeEvents } from "../db/queries/changes.js"
import {
  amendmentActions,
  amendments,
  billActions,
  billDocuments,
  billOrganizations,
  billRelations,
  billSponsors,
  bills,
  calendarEntries,
  documentSections,
  eventAgendaItems,
  eventBills,
  eventDocuments,
  eventParticipants,
  legislativeEvents,
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  supportingMaterialLinks,
  supportingMaterialSections,
  supportingMaterials,
  votePositions,
  votes
} from "../db/schema/schema.js"
import type { PassageSearchInput, SearchInput } from "../search/search.js"
import {
  lexicalBillSearch,
  lexicalPassageSearch,
  paginateSearchRows,
  reciprocalRankFusionWithScores,
  semanticBillSearch,
  semanticPassageSearch,
  validateSearchInput
} from "../search/search.js"
import { LegislationError } from "./errors.js"

const CHILD_LIMIT = 100
const SECTION_LIMIT = 50

interface QueryEmbeddingClient {
  embed(input: string[]): Promise<{ embeddings: number[][] }>
}

export interface BillLookup {
  childCursor?: string
  childLimit?: number
  id: string
}

export interface VersionComparisonInput {
  billId: string
  documentIds: [string, string]
}

export interface EntityLookup {
  cursor?: string
  id: string
  limit?: number
}

export interface MembershipLookup {
  cursor?: string
  limit?: number
  organizationId?: string
  personId?: string
}

export interface EventSearchInput {
  cursor?: string
  from?: Date
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  to?: Date
}

export interface VoteSearchInput {
  billId?: string
  cursor?: string
  from?: Date
  limit?: number
  organizationId?: string
  personId?: string
}

export interface AmendmentSearchInput {
  billId?: string
  cursor?: string
  jurisdictionId?: string
  limit?: number
  query?: string
  sponsorPersonId?: string
}

export interface SupportingMaterialSearchInput {
  amendmentId?: string
  billId?: string
  classification?: string
  cursor?: string
  eventId?: string
  jurisdictionId?: string
  limit?: number
  query?: string
}

export interface ChangeSearchInput {
  cursor?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  personId?: string
  recordId?: string
  recordType?: string
}

interface FusedBillResult {
  id: string
  identifier: string
  introducedAt: null | string
  jurisdictionId: string
  score: number
  sessionId: string
  snippet?: string
  sourceUrl: string
  status: null | string
  summary: null | string
  title: string
}

function comparisonClassification(before: string | undefined, after: string | undefined) {
  if (before === undefined) {
    return "added"
  }
  if (after === undefined) {
    return "removed"
  }
  return before === after ? "unchanged" : "changed"
}

function encodeOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url")
}

function decodeOffset(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("offset" in parsed) ||
      typeof parsed.offset !== "number" ||
      !Number.isSafeInteger(parsed.offset) ||
      parsed.offset < 0
    ) {
      throw new Error("invalid")
    }
    return parsed.offset
  } catch {
    throw new LegislationError("invalid_request", "Invalid pagination cursor")
  }
}

function encodeChangeCursor(value: { id: string; observedAt: Date }): string {
  return Buffer.from(JSON.stringify({ id: value.id, observedAt: value.observedAt.toISOString() })).toString("base64url")
}

function decodeChangeCursor(cursor: string | undefined): { id?: string; observedAt?: Date } {
  if (cursor === undefined) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      typeof parsed.id !== "string" ||
      !("observedAt" in parsed) ||
      typeof parsed.observedAt !== "string"
    ) {
      throw new Error("invalid")
    }
    const observedAt = new Date(parsed.observedAt)
    if (Number.isNaN(observedAt.getTime())) {
      throw new Error("invalid")
    }
    return { id: parsed.id, observedAt }
  } catch {
    throw new LegislationError("invalid_request", "Invalid change pagination cursor")
  }
}

export class LegislationQueryService {
  readonly #database: LegislationDatabase
  readonly #embeddingClient?: QueryEmbeddingClient

  constructor(database: LegislationDatabase, embeddingClient?: QueryEmbeddingClient) {
    this.#database = database
    this.#embeddingClient = embeddingClient
  }

  async searchChanges(input: ChangeSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const cursor = decodeChangeCursor(input.cursor)
    const rows = await findChangeEvents(this.#database, {
      before: cursor.observedAt,
      beforeId: cursor.id,
      jurisdictionId: input.jurisdictionId,
      limit: limit + 1,
      organizationId: input.organizationId,
      personId: input.personId,
      recordId: input.recordId,
      recordType: input.recordType
    })
    const truncated = rows.length > limit
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
      items,
      nextCursor: truncated && last !== undefined ? encodeChangeCursor(last) : undefined,
      truncated
    }
  }

  async getPerson(lookup: EntityLookup) {
    const person = await this.#database.select().from(people).where(eq(people.id, lookup.id)).limit(1)
    if (person[0] === undefined) {
      throw new LegislationError("not_found", `Person ${lookup.id} was not found`)
    }
    const [terms, memberships, sponsoredBills] = await Promise.all([
      this.#database
        .select()
        .from(legislativeTerms)
        .where(eq(legislativeTerms.personId, lookup.id))
        .orderBy(asc(legislativeTerms.startDate), asc(legislativeTerms.id)),
      this.getMemberships({ limit: lookup.limit, personId: lookup.id }),
      this.getSponsoredBills({ ...lookup, id: lookup.id })
    ])
    return { memberships, person: person[0], sponsoredBills, terms }
  }

  async getOrganization(lookup: EntityLookup) {
    const organization = await this.#database
      .select()
      .from(organizations)
      .where(eq(organizations.id, lookup.id))
      .limit(1)
    if (organization[0] === undefined) {
      throw new LegislationError("not_found", `Organization ${lookup.id} was not found`)
    }
    const [children, memberships, billActivity] = await Promise.all([
      this.#database
        .select()
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, lookup.id))
        .orderBy(asc(organizations.name)),
      this.getMemberships({ limit: lookup.limit, organizationId: lookup.id }),
      this.getCommitteeBillActivity(lookup)
    ])
    return { billActivity, children, memberships, organization: organization[0] }
  }

  async getMemberships(input: MembershipLookup) {
    if (input.organizationId === undefined && input.personId === undefined) {
      throw new LegislationError("invalid_request", "Select a person or organization for membership lookup")
    }
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select({ membership: organizationMemberships, organization: organizations, person: people })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .innerJoin(people, eq(organizationMemberships.personId, people.id))
      .where(
        and(
          input.organizationId === undefined
            ? undefined
            : eq(organizationMemberships.organizationId, input.organizationId),
          input.personId === undefined ? undefined : eq(organizationMemberships.personId, input.personId)
        )
      )
      .orderBy(asc(organizations.name), asc(people.name), asc(organizationMemberships.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getSponsoredBills(lookup: EntityLookup) {
    const limit = Math.min(Math.max(lookup.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(lookup.cursor)
    const rows = await this.#database
      .select({ bill: bills, sponsorship: billSponsors })
      .from(billSponsors)
      .innerJoin(bills, eq(billSponsors.billId, bills.id))
      .where(eq(billSponsors.personId, lookup.id))
      .orderBy(asc(bills.introducedAt), asc(bills.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getCommitteeBillActivity(lookup: EntityLookup) {
    const limit = Math.min(Math.max(lookup.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(lookup.cursor)
    const linkedRows = await this.#database
      .select({ bill: bills })
      .from(billOrganizations)
      .innerJoin(bills, eq(billOrganizations.billId, bills.id))
      .where(eq(billOrganizations.organizationId, lookup.id))
      .orderBy(asc(bills.introducedAt), asc(bills.id))
      .limit(limit + 1)
      .offset(offset)
    const organization =
      linkedRows.length > 0
        ? undefined
        : await this.#database
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, lookup.id))
            .limit(1)
    const fallbackRows =
      organization?.[0] === undefined
        ? []
        : await this.#database
            .select({ bill: bills })
            .from(bills)
            .where(sql`${organization[0].name} = any(${bills.committees})`)
            .orderBy(asc(bills.introducedAt), asc(bills.id))
            .limit(limit + 1)
            .offset(offset)
    const rows = linkedRows.length > 0 ? linkedRows : fallbackRows
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.bill),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: linkedRows.length > 0 ? [] : ["Unlinked records use bounded committee-name matching"]
    }
  }

  async searchEvents(input: EventSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .selectDistinct({ event: legislativeEvents })
      .from(legislativeEvents)
      .leftJoin(eventParticipants, eq(eventParticipants.eventId, legislativeEvents.id))
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(legislativeEvents.jurisdictionId, input.jurisdictionId),
          input.organizationId === undefined ? undefined : eq(eventParticipants.organizationId, input.organizationId),
          input.from === undefined ? undefined : gte(legislativeEvents.startAt, input.from),
          input.to === undefined ? undefined : lte(legislativeEvents.startAt, input.to)
        )
      )
      .orderBy(asc(legislativeEvents.startAt), asc(legislativeEvents.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.event),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getEvent(lookup: EntityLookup) {
    const event = await this.#database
      .select()
      .from(legislativeEvents)
      .where(eq(legislativeEvents.id, lookup.id))
      .limit(1)
    if (event[0] === undefined) {
      throw new LegislationError("not_found", `Event ${lookup.id} was not found`)
    }
    const [agendaItems, documents, participants, relatedBills] = await Promise.all([
      this.#database
        .select()
        .from(eventAgendaItems)
        .where(eq(eventAgendaItems.eventId, lookup.id))
        .orderBy(asc(eventAgendaItems.ordinal)),
      this.#database
        .select()
        .from(eventDocuments)
        .where(eq(eventDocuments.eventId, lookup.id))
        .orderBy(asc(eventDocuments.id)),
      this.#database
        .select({ participant: eventParticipants, organization: organizations, person: people })
        .from(eventParticipants)
        .leftJoin(organizations, eq(eventParticipants.organizationId, organizations.id))
        .leftJoin(people, eq(eventParticipants.personId, people.id))
        .where(eq(eventParticipants.eventId, lookup.id))
        .orderBy(asc(eventParticipants.id)),
      this.#database
        .select({ bill: bills, classification: eventBills.classification })
        .from(eventBills)
        .innerJoin(bills, eq(eventBills.billId, bills.id))
        .where(eq(eventBills.eventId, lookup.id))
        .orderBy(asc(bills.id))
    ])
    return { agendaItems, documents, event: event[0], participants, relatedBills }
  }

  async getBillSchedule(input: EventSearchInput & { billId: string }) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select({ event: legislativeEvents })
      .from(eventBills)
      .innerJoin(legislativeEvents, eq(eventBills.eventId, legislativeEvents.id))
      .where(
        and(
          eq(eventBills.billId, input.billId),
          input.from === undefined ? undefined : gte(legislativeEvents.startAt, input.from),
          input.to === undefined ? undefined : lte(legislativeEvents.startAt, input.to)
        )
      )
      .orderBy(asc(legislativeEvents.startAt), asc(legislativeEvents.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.event),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getCalendar(input: EventSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(calendarEntries)
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(calendarEntries.jurisdictionId, input.jurisdictionId),
          input.organizationId === undefined ? undefined : eq(calendarEntries.organizationId, input.organizationId),
          input.from === undefined ? undefined : gte(calendarEntries.startAt, input.from),
          input.to === undefined ? undefined : lte(calendarEntries.startAt, input.to)
        )
      )
      .orderBy(asc(calendarEntries.startAt), asc(calendarEntries.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async searchVotes(input: VoteSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .selectDistinct({ vote: votes })
      .from(votes)
      .leftJoin(votePositions, eq(votePositions.voteId, votes.id))
      .where(
        and(
          input.billId === undefined ? undefined : eq(votes.billId, input.billId),
          input.organizationId === undefined ? undefined : eq(votes.organizationId, input.organizationId),
          input.personId === undefined ? undefined : eq(votePositions.personId, input.personId),
          input.from === undefined ? undefined : gte(votes.heldAt, input.from)
        )
      )
      .orderBy(asc(votes.heldAt), asc(votes.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.vote),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getVote(lookup: EntityLookup) {
    const vote = await this.#database.select().from(votes).where(eq(votes.id, lookup.id)).limit(1)
    if (vote[0] === undefined) {
      throw new LegislationError("not_found", `Vote ${lookup.id} was not found`)
    }
    const positions = await this.#database
      .select({ person: people, position: votePositions })
      .from(votePositions)
      .leftJoin(people, eq(votePositions.personId, people.id))
      .where(eq(votePositions.voteId, lookup.id))
      .orderBy(asc(votePositions.option), asc(votePositions.sourceIdentity))
    return { positions, vote: vote[0] }
  }

  async searchAmendments(input: AmendmentSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(amendments)
      .where(
        and(
          input.billId === undefined ? undefined : eq(amendments.billId, input.billId),
          input.jurisdictionId === undefined ? undefined : eq(amendments.jurisdictionId, input.jurisdictionId),
          input.sponsorPersonId === undefined ? undefined : eq(amendments.sponsorPersonId, input.sponsorPersonId),
          input.query === undefined
            ? undefined
            : sql`(${amendments.printedIdentifier} ilike ${`%${input.query}%`} or ${amendments.purpose} ilike ${`%${input.query}%`} or ${amendments.description} ilike ${`%${input.query}%`})`
        )
      )
      .orderBy(asc(amendments.submittedDate), asc(amendments.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getAmendment(lookup: EntityLookup) {
    const amendment = await this.#database.select().from(amendments).where(eq(amendments.id, lookup.id)).limit(1)
    if (amendment[0] === undefined) {
      throw new LegislationError("not_found", `Amendment ${lookup.id} was not found`)
    }
    const [actions, materials, amendmentVotes] = await Promise.all([
      this.#database
        .select()
        .from(amendmentActions)
        .where(eq(amendmentActions.amendmentId, lookup.id))
        .orderBy(asc(amendmentActions.ordinal)),
      this.#database
        .select({ link: supportingMaterialLinks, material: supportingMaterials })
        .from(supportingMaterialLinks)
        .innerJoin(supportingMaterials, eq(supportingMaterialLinks.materialId, supportingMaterials.id))
        .where(eq(supportingMaterialLinks.amendmentId, lookup.id))
        .orderBy(asc(supportingMaterials.documentDate), asc(supportingMaterials.id)),
      this.#database.select().from(votes).where(eq(votes.amendmentId, lookup.id)).orderBy(asc(votes.heldAt))
    ])
    return { actions, amendment: amendment[0], materials, votes: amendmentVotes }
  }

  async searchSupportingMaterials(input: SupportingMaterialSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .selectDistinct({ material: supportingMaterials })
      .from(supportingMaterials)
      .leftJoin(supportingMaterialLinks, eq(supportingMaterialLinks.materialId, supportingMaterials.id))
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(supportingMaterials.jurisdictionId, input.jurisdictionId),
          input.classification === undefined ? undefined : eq(supportingMaterials.classification, input.classification),
          input.billId === undefined ? undefined : eq(supportingMaterialLinks.billId, input.billId),
          input.amendmentId === undefined ? undefined : eq(supportingMaterialLinks.amendmentId, input.amendmentId),
          input.eventId === undefined ? undefined : eq(supportingMaterialLinks.eventId, input.eventId),
          input.query === undefined
            ? undefined
            : sql`(${supportingMaterials.title} ilike ${`%${input.query}%`} or exists (
                select 1 from ${supportingMaterialSections}
                where ${supportingMaterialSections.materialId} = ${supportingMaterials.id}
                  and ${supportingMaterialSections.searchVector} @@ websearch_to_tsquery('english', ${input.query})
              ))`
        )
      )
      .orderBy(asc(supportingMaterials.documentDate), asc(supportingMaterials.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.material),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getSupportingMaterial(lookup: EntityLookup) {
    const material = await this.#database
      .select()
      .from(supportingMaterials)
      .where(eq(supportingMaterials.id, lookup.id))
      .limit(1)
    if (material[0] === undefined) {
      throw new LegislationError("not_found", `Supporting material ${lookup.id} was not found`)
    }
    const limit = Math.min(Math.max(lookup.limit ?? SECTION_LIMIT, 1), SECTION_LIMIT)
    const offset = decodeOffset(lookup.cursor)
    const [links, sections] = await Promise.all([
      this.#database.select().from(supportingMaterialLinks).where(eq(supportingMaterialLinks.materialId, lookup.id)),
      this.#database
        .select()
        .from(supportingMaterialSections)
        .where(eq(supportingMaterialSections.materialId, lookup.id))
        .orderBy(asc(supportingMaterialSections.ordinal))
        .limit(limit + 1)
        .offset(offset)
    ])
    const truncated = sections.length > limit
    return {
      links,
      material: material[0],
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      sections: sections.slice(0, limit),
      truncated
    }
  }

  async searchBills(input: SearchInput & { mode?: "hybrid" | "lexical" | "semantic" }) {
    const mode = input.mode ?? "hybrid"
    if (mode === "lexical") {
      return lexicalBillSearch(this.#database, input)
    }
    const embedding = await this.#embedQuery(input.query)
    if (mode === "semantic") {
      return semanticBillSearch(this.#database, { ...input, embedding })
    }
    const { limit, offset } = validateSearchInput(input)
    const candidateLimit = Math.min((offset + limit) * 5, 100)
    const [lexical, semantic] = await Promise.all([
      lexicalBillSearch(this.#database, { ...input, cursor: undefined, limit: candidateLimit }),
      semanticBillSearch(this.#database, { ...input, cursor: undefined, embedding, limit: candidateLimit })
    ])
    const lexicalItems: FusedBillResult[] = lexical.items.map((item) => ({ ...item, score: item.rank }))
    const semanticItems: FusedBillResult[] = semantic.items.map((item) => ({
      ...item,
      score: 1 - item.distance
    }))
    const candidates = reciprocalRankFusionWithScores(lexicalItems, semanticItems, Math.min(offset + limit + 1, 100))
    return paginateSearchRows(candidates, limit, offset, lexical.truncated || semantic.truncated)
  }

  async getBill(lookup: BillLookup) {
    const childLimit = Math.min(Math.max(lookup.childLimit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const childOffset = decodeOffset(lookup.childCursor)
    const bill = await this.#database.select().from(bills).where(eq(bills.id, lookup.id)).limit(1)
    if (bill[0] === undefined) {
      throw new LegislationError("not_found", `Bill ${lookup.id} was not found`)
    }
    const [actions, sponsors, billVotes, documents, relations, linkedOrganizations] = await Promise.all([
      this.#database
        .select()
        .from(billActions)
        .where(eq(billActions.billId, lookup.id))
        .orderBy(asc(billActions.ordinal))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select({
          classification: billSponsors.classification,
          isPrimary: billSponsors.isPrimary,
          name: billSponsors.name,
          personId: people.id
        })
        .from(billSponsors)
        .leftJoin(people, eq(billSponsors.personId, people.id))
        .where(eq(billSponsors.billId, lookup.id))
        .orderBy(asc(billSponsors.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(votes)
        .where(eq(votes.billId, lookup.id))
        .orderBy(asc(votes.heldAt), asc(votes.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(billDocuments)
        .where(eq(billDocuments.billId, lookup.id))
        .orderBy(asc(billDocuments.documentDate), asc(billDocuments.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(billRelations)
        .where(eq(billRelations.billId, lookup.id))
        .orderBy(asc(billRelations.relatedBillId))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select({ link: billOrganizations, organization: organizations })
        .from(billOrganizations)
        .innerJoin(organizations, eq(billOrganizations.organizationId, organizations.id))
        .where(eq(billOrganizations.billId, lookup.id))
        .orderBy(asc(organizations.name), asc(organizations.id))
        .limit(childLimit + 1)
        .offset(childOffset)
    ])
    const truncated = [actions, sponsors, billVotes, documents, relations, linkedOrganizations].some(
      (collection) => collection.length > childLimit
    )
    return {
      actions: actions.slice(0, childLimit),
      bill: bill[0],
      documents: documents.slice(0, childLimit),
      nextChildCursor: truncated ? encodeOffset(childOffset + childLimit) : undefined,
      organizations: linkedOrganizations.slice(0, childLimit),
      relations: relations.slice(0, childLimit),
      sponsors: sponsors.slice(0, childLimit),
      truncated,
      votes: billVotes.slice(0, childLimit),
      warnings: truncated ? ["One or more child collections have another page"] : []
    }
  }

  async getBillTimeline(lookup: BillLookup) {
    const detail = await this.getBill(lookup)
    const events = [
      ...detail.actions.map((action) => ({
        date: action.actionAt?.toISOString() ?? action.actionDate,
        description: action.description,
        id: action.id,
        sourceUrl: action.sourceUrl,
        type: "action" as const
      })),
      ...detail.votes.map((vote) => ({
        date: vote.heldAt?.toISOString(),
        description: vote.motion,
        id: vote.id,
        result: vote.result,
        sourceUrl: vote.sourceUrl,
        type: "vote" as const
      }))
    ].sort(
      (left, right) => (left.date ?? "9999").localeCompare(right.date ?? "9999") || left.id.localeCompare(right.id)
    )
    return {
      billId: lookup.id,
      events,
      nextChildCursor: detail.nextChildCursor,
      truncated: detail.truncated,
      warnings: detail.warnings
    }
  }

  async searchBillText(input: PassageSearchInput & { mode?: "hybrid" | "lexical" | "semantic" }) {
    const mode = input.mode ?? "lexical"
    if (mode === "lexical") {
      return lexicalPassageSearch(this.#database, input)
    }
    const embedding = await this.#embedQuery(input.query)
    if (mode === "semantic") {
      return semanticPassageSearch(this.#database, { ...input, embedding })
    }
    const { limit, offset } = validateSearchInput(input)
    const candidateLimit = Math.min((offset + limit) * 5, 100)
    const [lexical, semantic] = await Promise.all([
      lexicalPassageSearch(this.#database, { ...input, cursor: undefined, limit: candidateLimit }),
      semanticPassageSearch(this.#database, { ...input, cursor: undefined, embedding, limit: candidateLimit })
    ])
    const lexicalCandidates = lexical.items.map(({ rank: _rank, ...item }) => ({ ...item, id: item.sectionId }))
    const semanticCandidates = semantic.items.map(({ distance: _distance, ...item }) => ({
      ...item,
      id: item.sectionId
    }))
    const candidates = reciprocalRankFusionWithScores(
      lexicalCandidates,
      semanticCandidates,
      Math.min(offset + limit + 1, 100)
    ).map(({ id: _id, ...item }) => item)
    return paginateSearchRows(candidates, limit, offset, lexical.truncated || semantic.truncated)
  }

  async getBillText(input: BillLookup & { cursor?: string; documentId?: string; versionCode?: string }) {
    const offset = decodeOffset(input.cursor)
    const documents = await this.#database
      .select()
      .from(billDocuments)
      .where(
        and(
          eq(billDocuments.billId, input.id),
          input.documentId === undefined ? undefined : eq(billDocuments.id, input.documentId),
          input.versionCode === undefined ? undefined : eq(billDocuments.versionCode, input.versionCode)
        )
      )
      .orderBy(asc(billDocuments.documentDate), asc(billDocuments.id))
      .limit(2)
    if (documents[0] === undefined) {
      throw new LegislationError("not_found", "No matching bill text document was found")
    }
    if (documents.length > 1 && input.documentId === undefined && input.versionCode === undefined) {
      throw new LegislationError("invalid_request", "Select a document or version when multiple texts are available")
    }
    if (documents[0].processingStatus !== "processed") {
      throw new LegislationError(
        documents[0].processingStatus === "failed" ? "dependency_unavailable" : "conflict",
        `Document text is ${documents[0].processingStatus}`
      )
    }
    const sections = await this.#database
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, documents[0].id))
      .orderBy(asc(documentSections.ordinal))
      .limit(SECTION_LIMIT + 1)
      .offset(offset)
    const truncated = sections.length > SECTION_LIMIT
    return {
      billId: input.id,
      document: documents[0],
      nextCursor: truncated ? encodeOffset(offset + SECTION_LIMIT) : undefined,
      sections: sections.slice(0, SECTION_LIMIT),
      truncated
    }
  }

  async compareBillVersions(input: VersionComparisonInput) {
    const documents = await this.#database
      .select()
      .from(billDocuments)
      .where(and(eq(billDocuments.billId, input.billId), inArray(billDocuments.id, input.documentIds)))
    if (documents.length !== 2) {
      throw new LegislationError("invalid_request", "Both selected documents must belong to the requested bill")
    }
    const sections = await this.#database
      .select()
      .from(documentSections)
      .where(inArray(documentSections.documentId, input.documentIds))
      .orderBy(asc(documentSections.ordinal))
    const byDocument = new Map(
      input.documentIds.map((documentId) => [
        documentId,
        sections.filter((section) => section.documentId === documentId)
      ])
    )
    const left = byDocument.get(input.documentIds[0]) ?? []
    const right = byDocument.get(input.documentIds[1]) ?? []
    const sectionKey = (section: (typeof sections)[number]) => section.sectionIdentifier ?? `ordinal:${section.ordinal}`
    const leftByKey = new Map(left.map((section) => [sectionKey(section), section]))
    const rightByKey = new Map(right.map((section) => [sectionKey(section), section]))
    const keys = [...left.map(sectionKey), ...right.map(sectionKey).filter((key) => !leftByKey.has(key))]
    const maximum = Math.min(keys.length, CHILD_LIMIT)
    const changes = Array.from({ length: maximum }, (_value, index) => {
      const key = keys[index]
      const before = key === undefined ? undefined : leftByKey.get(key)
      const after = key === undefined ? undefined : rightByKey.get(key)
      return {
        after: after?.text,
        before: before?.text,
        classification: comparisonClassification(before?.text, after?.text),
        identifier: after?.sectionIdentifier ?? before?.sectionIdentifier,
        ordinal: index
      }
    })
    return { billId: input.billId, changes, documents, truncated: keys.length > CHILD_LIMIT }
  }

  async findRelatedBills(input: BillLookup & { includeSemantic?: boolean; limit?: number }) {
    const limit = Math.min(input.limit ?? 20, CHILD_LIMIT)
    const [outgoing, incoming] = await Promise.all([
      this.#database
        .select({ classification: billRelations.classification, bill: bills })
        .from(billRelations)
        .innerJoin(bills, eq(billRelations.relatedBillId, bills.id))
        .where(eq(billRelations.billId, input.id))
        .orderBy(asc(bills.id))
        .limit(limit + 1),
      this.#database
        .select({ classification: billRelations.classification, bill: bills })
        .from(billRelations)
        .innerJoin(bills, eq(billRelations.billId, bills.id))
        .where(eq(billRelations.relatedBillId, input.id))
        .orderBy(asc(bills.id))
        .limit(limit + 1)
    ])
    const relations = [
      ...new Map([...outgoing, ...incoming].map((relation) => [relation.bill.id, relation])).values()
    ].toSorted((left, right) => left.bill.id.localeCompare(right.bill.id))
    const explicit = relations.slice(0, limit).map((relation) => ({ ...relation, method: "explicit" as const }))
    if (input.includeSemantic !== true || explicit.length >= limit) {
      return { items: explicit, truncated: relations.length > limit }
    }
    const source = await this.#database
      .select({ embedding: bills.embedding })
      .from(bills)
      .where(eq(bills.id, input.id))
      .limit(1)
    if (source[0]?.embedding === null || source[0]?.embedding === undefined) {
      return { items: explicit, truncated: relations.length > limit, warnings: ["Source bill has no embedding"] }
    }
    const semantic = await semanticBillSearch(this.#database, {
      embedding: source[0].embedding,
      limit: Math.min(limit + explicit.length + 1, 100)
    })
    const seen = new Set([input.id, ...explicit.map((item) => item.bill.id)])
    const semanticItems = semantic.items
      .filter((bill) => !seen.has(bill.id))
      .slice(0, limit - explicit.length)
      .map((bill) => ({
        bill,
        classification: "semantic",
        method: "semantic" as const,
        similarity: 1 - bill.distance
      }))
    return { items: [...explicit, ...semanticItems], truncated: relations.length > limit || semantic.truncated }
  }

  async #embedQuery(query: string): Promise<number[]> {
    if (this.#embeddingClient === undefined) {
      throw new LegislationError("dependency_unavailable", "Semantic search is not configured")
    }
    const response = await this.#embeddingClient.embed([query])
    const embedding = response.embeddings[0]
    if (embedding === undefined) {
      throw new LegislationError("dependency_unavailable", "Embedding provider returned no query vector")
    }
    return embedding
  }
}
