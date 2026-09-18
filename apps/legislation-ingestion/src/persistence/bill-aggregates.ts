import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  billActions,
  billDocuments,
  billOrganizations,
  billRelations,
  billSponsors,
  bills,
  documentSections,
  jurisdictions,
  legislativeSessions,
  organizations,
  people,
  syncCheckpoints,
  votePositions,
  votes
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm"
import { assertBillBatchOwnership, type BillBatchOwnership } from "./bill-batch-ownership.js"
import { preserveBillResolvedLinks } from "./bill-resolved-links.js"
import { observeCanonicalRecord } from "./changes.js"
import { promotionAlreadyCommitted } from "./promotion-receipt.js"

/** Bill feeds can fill missing sponsor facts, but entity ingestion owns existing person details. */
function billPersonUpdate() {
  return {
    familyName: sql`coalesce(${people.familyName}, excluded.family_name)`,
    givenName: sql`coalesce(${people.givenName}, excluded.given_name)`,
    jurisdictionId: sql`coalesce(${people.jurisdictionId}, excluded.jurisdiction_id)`,
    party: sql`coalesce(${people.party}, excluded.party)`,
    sourceId: sql`coalesce(${people.sourceId}, excluded.source_id)`,
    sourceUpdatedAt: sql`coalesce(${people.sourceUpdatedAt}, excluded.source_updated_at)`,
    sourceUrl: sql`coalesce(${people.sourceUrl}, excluded.source_url)`,
    isActive: sql`coalesce(${people.isActive}, excluded.is_active)`,
    updatedAt: new Date(),
    upstreamIds: sql`excluded.upstream_ids || ${people.upstreamIds}`
  }
}

/** Missing OpenStates entities must be imported before their bill observations can commit. */
export function assertOpenStatesOrganizationDependencies(
  candidateIds: readonly string[],
  existingIds: ReadonlySet<string>
): void {
  const missingIds = [...new Set(candidateIds)].filter(
    (id) => id.startsWith("organization:openstates:") && !existingIds.has(id)
  )
  if (missingIds.length > 0) {
    throw new LegislationError(
      "dependency_unavailable",
      "Import the referenced OpenStates organizations before retrying these bill records",
      { details: { missingOrganizationIds: missingIds } }
    )
  }
}

function jurisdictionChanged() {
  return sql`row(
    ${jurisdictions.name},
    ${jurisdictions.classification},
    ${jurisdictions.countryCode},
    ${jurisdictions.subdivisionCode},
    ${jurisdictions.sourceUrl}
  ) is distinct from row(
    excluded.name,
    excluded.classification,
    excluded.country_code,
    excluded.subdivision_code,
    excluded.source_url
  )`
}

function legislativeSessionChanged() {
  return sql`row(
    ${legislativeSessions.jurisdictionId},
    ${legislativeSessions.identifier},
    ${legislativeSessions.name},
    ${legislativeSessions.startDate},
    ${legislativeSessions.endDate},
    ${legislativeSessions.isActive},
    ${legislativeSessions.sourceUrl}
  ) is distinct from row(
    excluded.jurisdiction_id,
    excluded.identifier,
    excluded.name,
    excluded.start_date,
    excluded.end_date,
    excluded.is_active,
    excluded.source_url
  )`
}

function billNonSearchUpdate() {
  return {
    chamber: sql`excluded.chamber`,
    classification: sql`excluded.classification`,
    committees: sql`excluded.committees`,
    identifier: sql`excluded.identifier`,
    introducedAt: sql`excluded.introduced_at`,
    jurisdictionId: sql`excluded.jurisdiction_id`,
    sessionId: sql`excluded.session_id`,
    sourceUpdatedAt: sql`excluded.source_updated_at`,
    sourceUrl: sql`excluded.source_url`,
    status: sql`excluded.status`,
    updatedAt: new Date(),
    upstreamIds: sql`${bills.upstreamIds} || excluded.upstream_ids`
  }
}

function billSearchUpdate() {
  return {
    ...billNonSearchUpdate(),
    embeddedAt: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embeddedAt} end`,
    embedding: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embedding} end`,
    embeddingInputHash: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embeddingInputHash} end`,
    embeddingModel: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embeddingModel} end`,
    subjects: sql`excluded.subjects`,
    summary: sql`excluded.summary`,
    title: sql`excluded.title`
  }
}

function billSearchTextMatches(
  existing: Pick<typeof bills.$inferSelect, "subjects" | "summary" | "title">,
  candidate: Pick<typeof bills.$inferInsert, "subjects" | "summary" | "title">
) {
  return (
    existing.title === candidate.title &&
    existing.summary === (candidate.summary ?? null) &&
    JSON.stringify(existing.subjects) === JSON.stringify(candidate.subjects ?? [])
  )
}

function assertAggregateOwnership(aggregate: CanonicalBillAggregate): void {
  const billId = aggregate.bill.id

  if (aggregate.bill.jurisdictionId !== aggregate.jurisdiction.id) {
    throw new Error("bill jurisdiction does not match the aggregate jurisdiction")
  }
  if (
    aggregate.bill.sessionId !== aggregate.session.id ||
    aggregate.session.jurisdictionId !== aggregate.jurisdiction.id
  ) {
    throw new Error("bill session does not match the aggregate session")
  }

  for (const child of [
    ...(aggregate.actions ?? []),
    ...(aggregate.sponsors ?? []),
    ...(aggregate.relations ?? []),
    ...(aggregate.organizations ?? [])
  ]) {
    if (child.billId !== billId) {
      throw new Error("bill child does not belong to the aggregate bill")
    }
  }

  for (const vote of aggregate.votes ?? []) {
    if (vote.vote.billId !== billId || vote.positions?.some((position) => position.voteId !== vote.vote.id) === true) {
      throw new Error("vote data does not belong to the aggregate bill")
    }
  }

  for (const organization of aggregate.organizationObservations ?? []) {
    if (organization.jurisdictionId !== aggregate.jurisdiction.id) {
      throw new Error("organization observation does not belong to the aggregate jurisdiction")
    }
  }

  for (const document of aggregate.documents ?? []) {
    if (
      document.document.billId !== billId ||
      document.sections?.some((section) => section.documentId !== document.document.id) === true
    ) {
      throw new Error("document data does not belong to the aggregate bill")
    }
  }
}

/**
 * Keeps relation completeness derived from facts supplied by the source aggregate.
 * Missing legacy provenance is intentionally retained as incomplete; this helper
 * never fills a source fact or infers a relation direction.
 */
export function prepareBillRelationInsert(relation: typeof billRelations.$inferInsert) {
  const provenanceComplete =
    relation.direction !== undefined &&
    relation.sourceUrl !== undefined &&
    relation.sourceUrl !== null &&
    isHttpsUrl(relation.sourceUrl) &&
    relation.sourceProvider !== undefined &&
    relation.sourceProvider !== null &&
    relation.sourceProvider.trim().length > 0 &&
    relation.sourceRetrievedAt instanceof Date &&
    !Number.isNaN(relation.sourceRetrievedAt.valueOf()) &&
    relation.sourceIsOfficial !== undefined &&
    relation.sourceIsOfficial !== null
  return {
    ...relation,
    canonicalFactsComplete:
      provenanceComplete &&
      relation.sourceUpdatedAt instanceof Date &&
      !Number.isNaN(relation.sourceUpdatedAt.valueOf()),
    provenanceComplete
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch {
    return false
  }
}

/**
 * Sponsor rows are observations, not a replaceable presentation collection.
 * Retaining their bounds lets person activity distinguish the first observed
 * relationship from the last successful observation of that relationship.
 */
async function upsertSponsorObservations(
  database: Omit<LegislationDatabase, "$client">,
  sponsors: readonly (typeof billSponsors.$inferInsert)[],
  observedAt: Date
): Promise<void> {
  if (sponsors.length === 0) {
    return
  }
  await database
    .insert(billSponsors)
    .values(
      sponsors.map((sponsor) => ({
        ...sponsor,
        firstObservedAt: observedAt,
        latestObservedAt: observedAt
      }))
    )
    .onConflictDoUpdate({
      set: {
        billId: sql`excluded.bill_id`,
        classification: sql`excluded.classification`,
        firstObservedAt: sql`least(coalesce(${billSponsors.firstObservedAt}, excluded.first_observed_at), excluded.first_observed_at)`,
        isPrimary: sql`excluded.is_primary`,
        latestObservedAt: sql`greatest(coalesce(${billSponsors.latestObservedAt}, excluded.latest_observed_at), excluded.latest_observed_at)`,
        name: sql`excluded.name`,
        personId: sql`excluded.person_id`,
        sourceUrl: sql`excluded.source_url`
      },
      target: billSponsors.id
    })
}

/**
 * A scraper observation id can change even when the resolved sponsorship does
 * not. Keep the already-persisted row as the canonical observation so the
 * relationship's first-seen bound and the database's resolved-person
 * uniqueness invariant both survive repeat imports.
 */
async function normalizeSponsorObservations(
  database: Omit<LegislationDatabase, "$client">,
  sponsors: readonly (typeof billSponsors.$inferInsert)[]
): Promise<(typeof billSponsors.$inferInsert)[]> {
  if (sponsors.length === 0) {
    return []
  }
  const billIds = [...new Set(sponsors.map((sponsor) => sponsor.billId))]
  const existingSponsors = await database
    .select({
      billId: billSponsors.billId,
      classification: billSponsors.classification,
      id: billSponsors.id,
      personId: billSponsors.personId
    })
    .from(billSponsors)
    .where(inArray(billSponsors.billId, billIds))
  const relationshipKey = (sponsor: { billId: string; classification: string; id: string; personId?: null | string }) =>
    sponsor.personId === undefined || sponsor.personId === null
      ? `observation\u001f${sponsor.id}`
      : `person\u001f${sponsor.billId}\u001f${sponsor.personId}\u001f${sponsor.classification}`
  const existingIdByRelationship = new Map(existingSponsors.map((sponsor) => [relationshipKey(sponsor), sponsor.id]))
  const normalizedByRelationship = new Map<string, typeof billSponsors.$inferInsert>()
  for (const sponsor of [...sponsors].sort((left, right) => left.id.localeCompare(right.id))) {
    const key = relationshipKey(sponsor)
    if (normalizedByRelationship.has(key)) {
      continue
    }
    normalizedByRelationship.set(key, {
      ...sponsor,
      id: existingIdByRelationship.get(key) ?? sponsor.id
    })
  }
  return [...normalizedByRelationship.values()]
}

/**
 * An explicitly supplied sponsor collection is authoritative for its bill.
 * Retain current rows so their observation bounds can advance, but remove
 * relationships the source no longer reports rather than leaving them active.
 */
async function deleteAbsentSponsorObservations(
  database: Omit<LegislationDatabase, "$client">,
  billId: string,
  sponsors: readonly (typeof billSponsors.$inferInsert)[]
): Promise<void> {
  if (sponsors.length === 0) {
    await database.delete(billSponsors).where(eq(billSponsors.billId, billId))
    return
  }
  await database.delete(billSponsors).where(
    and(
      eq(billSponsors.billId, billId),
      notInArray(
        billSponsors.id,
        sponsors.map((sponsor) => sponsor.id)
      )
    )
  )
}

export async function upsertBillAggregate(
  database: LegislationDatabase,
  aggregate: CanonicalBillAggregate
): Promise<void> {
  assertAggregateOwnership(aggregate)

  await database.transaction(async (transaction) => {
    const existingBill = await transaction
      .select({
        subjects: bills.subjects,
        summary: bills.summary,
        title: bills.title,
        upstreamIds: bills.upstreamIds
      })
      .from(bills)
      .where(eq(bills.id, aggregate.bill.id))
      .limit(1)
    const searchableTextChanged =
      existingBill[0] !== undefined &&
      (existingBill[0].title !== aggregate.bill.title ||
        existingBill[0].summary !== aggregate.bill.summary ||
        JSON.stringify(existingBill[0].subjects) !== JSON.stringify(aggregate.bill.subjects))
    const bill = {
      ...aggregate.bill,
      ...(searchableTextChanged
        ? { embeddedAt: null, embedding: null, embeddingInputHash: null, embeddingModel: null }
        : {}),
      upstreamIds: { ...existingBill[0]?.upstreamIds, ...aggregate.bill.upstreamIds }
    }

    await transaction.insert(jurisdictions).values(aggregate.jurisdiction).onConflictDoUpdate({
      set: aggregate.jurisdiction,
      setWhere: jurisdictionChanged(),
      target: jurisdictions.id
    })
    await transaction.insert(legislativeSessions).values(aggregate.session).onConflictDoUpdate({
      set: aggregate.session,
      setWhere: legislativeSessionChanged(),
      target: legislativeSessions.id
    })
    await transaction.insert(bills).values(bill).onConflictDoUpdate({ set: bill, target: bills.id })

    if (aggregate.organizationObservations !== undefined && aggregate.organizationObservations.length > 0) {
      await insertMissingOrganizationObservations(transaction, aggregate.organizationObservations)
    }

    const candidateOrganizationIds = [
      ...(aggregate.actions ?? []).flatMap((action) =>
        action.organizationId === undefined || action.organizationId === null ? [] : [action.organizationId]
      ),
      ...(aggregate.votes ?? []).flatMap((vote) =>
        vote.vote.organizationId === undefined || vote.vote.organizationId === null ? [] : [vote.vote.organizationId]
      ),
      ...(aggregate.organizations ?? []).map((organization) => organization.organizationId)
    ]
    const existingOrganizations =
      candidateOrganizationIds.length === 0
        ? []
        : await transaction
            .select({ id: organizations.id })
            .from(organizations)
            .where(inArray(organizations.id, candidateOrganizationIds))
    const validOrganizationIds = new Set(existingOrganizations.map((organization) => organization.id))
    assertOpenStatesOrganizationDependencies(candidateOrganizationIds, validOrganizationIds)

    if (aggregate.people !== undefined && aggregate.people.length > 0) {
      for (const person of aggregate.people) {
        await transaction
          .insert(people)
          .values(person)
          .onConflictDoUpdate({ set: billPersonUpdate(), target: people.id })
      }
    }

    if (aggregate.actions !== undefined) {
      await transaction.delete(billActions).where(eq(billActions.billId, aggregate.bill.id))
      if (aggregate.actions.length > 0) {
        await transaction.insert(billActions).values(
          aggregate.actions.map((action) => ({
            ...action,
            organizationId:
              action.organizationId !== undefined &&
              action.organizationId !== null &&
              validOrganizationIds.has(action.organizationId)
                ? action.organizationId
                : undefined
          }))
        )
      }
    }

    if (aggregate.organizations !== undefined) {
      await transaction.delete(billOrganizations).where(eq(billOrganizations.billId, aggregate.bill.id))
      const linkedOrganizations = aggregate.organizations.filter((organization) =>
        validOrganizationIds.has(organization.organizationId)
      )
      if (linkedOrganizations.length > 0) {
        await transaction.insert(billOrganizations).values(linkedOrganizations)
      }
    }

    if (aggregate.sponsors !== undefined) {
      const normalizedSponsors = await normalizeSponsorObservations(transaction, aggregate.sponsors)
      await deleteAbsentSponsorObservations(transaction, aggregate.bill.id, normalizedSponsors)
      await upsertSponsorObservations(transaction, normalizedSponsors, new Date())
    }

    if (aggregate.votes !== undefined) {
      await transaction.delete(votes).where(eq(votes.billId, aggregate.bill.id))
      for (const vote of aggregate.votes) {
        await transaction.insert(votes).values({
          ...vote.vote,
          organizationId:
            vote.vote.organizationId !== undefined &&
            vote.vote.organizationId !== null &&
            validOrganizationIds.has(vote.vote.organizationId)
              ? vote.vote.organizationId
              : undefined
        })
        if (vote.positions !== undefined && vote.positions.length > 0) {
          for (let offset = 0; offset < vote.positions.length; offset += votePositionInsertBatchSize) {
            await transaction
              .insert(votePositions)
              .values(vote.positions.slice(offset, offset + votePositionInsertBatchSize))
          }
        }
      }
    }

    if (aggregate.documents !== undefined) {
      for (const document of aggregate.documents) {
        const existingDocument = await transaction.query.billDocuments.findFirst({
          where: or(
            eq(billDocuments.id, document.document.id),
            and(
              eq(billDocuments.billId, document.document.billId),
              eq(billDocuments.sourceUrl, document.document.sourceUrl)
            )
          )
        })
        const persistedDocument = {
          ...document.document,
          id: existingDocument?.id ?? document.document.id,
          blobPath: existingDocument?.blobPath ?? document.document.blobPath,
          contentHash: existingDocument?.contentHash ?? document.document.contentHash,
          lastAttemptAt: existingDocument?.lastAttemptAt ?? document.document.lastAttemptAt,
          processingAttempts: existingDocument?.processingAttempts ?? document.document.processingAttempts,
          processingError: existingDocument?.processingError ?? document.document.processingError,
          processingStatus: existingDocument?.processingStatus ?? document.document.processingStatus,
          text: existingDocument?.text ?? document.document.text
        }
        await transaction
          .insert(billDocuments)
          .values(persistedDocument)
          .onConflictDoUpdate({ set: persistedDocument, target: billDocuments.id })
        if (document.sections !== undefined) {
          await transaction.delete(documentSections).where(eq(documentSections.documentId, persistedDocument.id))
          if (document.sections.length > 0) {
            await transaction
              .insert(documentSections)
              .values(document.sections.map((section) => ({ ...section, documentId: persistedDocument.id })))
          }
        }
      }
    }

    if (aggregate.relations !== undefined) {
      await transaction.delete(billRelations).where(eq(billRelations.billId, aggregate.bill.id))
      if (aggregate.relations.length > 0) {
        await transaction.insert(billRelations).values(aggregate.relations.map(prepareBillRelationInsert))
      }
    }

    await observeCanonicalRecord(transaction, {
      fields: {
        chamber: bill.chamber,
        classification: bill.classification,
        committees: bill.committees,
        introducedAt: bill.introducedAt,
        relationships: aggregate.relations?.map((relation) => ({
          classification: relation.classification,
          relatedBillId: relation.relatedBillId
        })),
        organizations: aggregate.organizations?.map((organization) => ({
          classification: organization.classification,
          organizationId: organization.organizationId
        })),
        status: bill.status,
        subjects: bill.subjects,
        summary: bill.summary,
        title: bill.title
      },
      jurisdictionId: bill.jurisdictionId,
      recordId: bill.id,
      recordType: "bill",
      sourceUpdatedAt: bill.sourceUpdatedAt ?? undefined
    })
    for (const person of aggregate.people ?? []) {
      await observeCanonicalRecord(transaction, {
        fields: {
          familyName: person.familyName,
          givenName: person.givenName,
          isActive: person.isActive,
          name: person.name,
          party: person.party
        },
        jurisdictionId: person.jurisdictionId ?? undefined,
        personId: person.id,
        recordId: person.id,
        recordType: "person",
        sourceUpdatedAt: person.sourceUpdatedAt ?? undefined
      })
    }
    for (const vote of aggregate.votes ?? []) {
      await observeCanonicalRecord(transaction, {
        fields: {
          heldAt: vote.vote.heldAt,
          heldDate: vote.vote.heldDate,
          motion: vote.vote.motion,
          noCount: vote.vote.noCount,
          otherCount: vote.vote.otherCount,
          result: vote.vote.result,
          yesCount: vote.vote.yesCount
        },
        jurisdictionId: bill.jurisdictionId,
        recordId: vote.vote.id,
        recordType: "vote"
      })
    }
  })
}

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}

/** Bill-embedded facts never overwrite directory profiles or reconcile memberships. */
export function insertMissingOrganizationObservations(
  database: Pick<LegislationDatabase, "insert">,
  observations: readonly (typeof organizations.$inferInsert)[]
) {
  return database.insert(organizations).values(uniqueById(observations)).onConflictDoNothing()
}

const votePositionInsertBatchSize = 100

export async function upsertBillAggregates(
  database: LegislationDatabase,
  inputAggregates: readonly CanonicalBillAggregate[],
  options: {
    /** Immutable per-batch promotion receipt, not a mutable session cursor. */
    receipt?: { source: string; stream: string; cursor: Record<string, unknown> }
    ownership?: BillBatchOwnership
    preserveResolvedLinks?: boolean
  } = {}
): Promise<Set<string>> {
  let aggregates = inputAggregates
  if (
    options.ownership &&
    (!options.receipt ||
      (options.receipt.source === options.ownership.source && options.receipt.stream === options.ownership.stream))
  ) {
    throw new Error("Owned bill promotion requires a separate immutable receipt")
  }
  if (aggregates.length === 0) {
    if (options.receipt) {
      throw new Error("Cannot receipt an empty bill batch")
    }
    return new Set()
  }
  for (const aggregate of aggregates) {
    assertAggregateOwnership(aggregate)
  }
  const billIds = aggregates.map((aggregate) => aggregate.bill.id)
  const existing = await database
    .select({ id: bills.id, subjects: bills.subjects, summary: bills.summary, title: bills.title })
    .from(bills)
    .where(inArray(bills.id, billIds))
  const existingById = new Map(existing.map((record) => [record.id, record]))
  const newAggregates = aggregates.filter((aggregate) => !existingById.has(aggregate.bill.id))
  const existingAggregates = aggregates.filter((aggregate) => existingById.has(aggregate.bill.id))
  const searchStableAggregates: CanonicalBillAggregate[] = []
  const searchChangedAggregates: CanonicalBillAggregate[] = []
  for (const aggregate of existingAggregates) {
    const previous = existingById.get(aggregate.bill.id)
    if (previous === undefined) {
      throw new Error("Existing bill snapshot is missing")
    }
    if (billSearchTextMatches(previous, aggregate.bill)) {
      searchStableAggregates.push(aggregate)
    } else {
      searchChangedAggregates.push(aggregate)
    }
  }

  await database.transaction(async (transaction) => {
    if (options.receipt && (await promotionAlreadyCommitted(transaction, options.receipt))) {
      return
    }
    if (options.ownership) {
      await assertBillBatchOwnership(transaction, options.ownership)
    }
    const jurisdictionValues = uniqueById(aggregates.map((aggregate) => aggregate.jurisdiction))
    await transaction
      .insert(jurisdictions)
      .values(jurisdictionValues)
      .onConflictDoUpdate({
        set: {
          classification: sql`excluded.classification`,
          countryCode: sql`excluded.country_code`,
          name: sql`excluded.name`,
          // Bill feeds cannot replace jurisdiction-level provenance.
          sourceUrl: sql`coalesce(excluded.source_url, ${jurisdictions.sourceUrl})`,
          subdivisionCode: sql`excluded.subdivision_code`,
          updatedAt: new Date()
        },
        setWhere: jurisdictionChanged(),
        target: jurisdictions.id
      })

    const sessionValues = uniqueById(aggregates.map((aggregate) => aggregate.session))
    await transaction
      .insert(legislativeSessions)
      .values(sessionValues)
      .onConflictDoUpdate({
        set: {
          endDate: sql`excluded.end_date`,
          identifier: sql`excluded.identifier`,
          // Bill feeds do not state the session active flag. Preserve a value
          // written by the canonical-foundation source rather than converting
          // an omitted source fact to false or null.
          isActive: sql`coalesce(excluded.is_active, ${legislativeSessions.isActive})`,
          jurisdictionId: sql`excluded.jurisdiction_id`,
          name: sql`excluded.name`,
          // Bill feeds cannot replace session-level provenance.
          sourceUrl: sql`coalesce(excluded.source_url, ${legislativeSessions.sourceUrl})`,
          startDate: sql`excluded.start_date`,
          updatedAt: new Date()
        },
        setWhere: legislativeSessionChanged(),
        target: legislativeSessions.id
      })

    const personValues = uniqueById(aggregates.flatMap((aggregate) => aggregate.people ?? []))
    if (personValues.length > 0) {
      await transaction.insert(people).values(personValues).onConflictDoUpdate({
        set: billPersonUpdate(),
        target: people.id
      })
    }

    if (newAggregates.length > 0) {
      await transaction
        .insert(bills)
        .values(newAggregates.map((aggregate) => aggregate.bill))
        .onConflictDoUpdate({ set: billSearchUpdate(), target: bills.id })
    }
    if (searchStableAggregates.length > 0) {
      await transaction
        .insert(bills)
        .values(searchStableAggregates.map((aggregate) => aggregate.bill))
        .onConflictDoUpdate({ set: billNonSearchUpdate(), target: bills.id })
    }
    // Search-text changes invalidate the legacy inline vector and touch its HNSW
    // index. Keep each one below the per-statement deadline instead of making one
    // slow row cancel an otherwise valid durable batch.
    for (const aggregate of searchChangedAggregates) {
      await transaction
        .insert(bills)
        .values(aggregate.bill)
        .onConflictDoUpdate({ set: billSearchUpdate(), target: bills.id })
    }

    if (options.preserveResolvedLinks) {
      aggregates = await preserveBillResolvedLinks(transaction, aggregates)
    }
    const organizationObservations = aggregates.flatMap((aggregate) => aggregate.organizationObservations ?? [])
    if (organizationObservations.length > 0) {
      await insertMissingOrganizationObservations(transaction, organizationObservations)
    }
    const candidateOrganizationIds = aggregates.flatMap((aggregate) => [
      ...(aggregate.actions ?? []).flatMap((action) =>
        action.organizationId === undefined || action.organizationId === null ? [] : [action.organizationId]
      ),
      ...(aggregate.votes ?? []).flatMap((vote) =>
        vote.vote.organizationId === undefined || vote.vote.organizationId === null ? [] : [vote.vote.organizationId]
      ),
      ...(aggregate.organizations ?? []).map((organization) => organization.organizationId)
    ])
    const existingOrganizations =
      candidateOrganizationIds.length === 0
        ? []
        : await transaction
            .select({ id: organizations.id })
            .from(organizations)
            .where(inArray(organizations.id, candidateOrganizationIds))
    const validOrganizationIds = new Set(existingOrganizations.map((organization) => organization.id))
    assertOpenStatesOrganizationDependencies(candidateOrganizationIds, validOrganizationIds)

    const actionBillIds = aggregates
      .filter((aggregate) => aggregate.actions !== undefined)
      .map((aggregate) => aggregate.bill.id)
    const organizationBillIds = aggregates
      .filter((aggregate) => aggregate.organizations !== undefined)
      .map((aggregate) => aggregate.bill.id)
    const voteBillIds = aggregates
      .filter((aggregate) => aggregate.votes !== undefined)
      .map((aggregate) => aggregate.bill.id)
    const relationBillIds = aggregates
      .filter((aggregate) => aggregate.relations !== undefined)
      .map((aggregate) => aggregate.bill.id)
    if (actionBillIds.length > 0) {
      await transaction.delete(billActions).where(inArray(billActions.billId, actionBillIds))
    }
    if (organizationBillIds.length > 0) {
      await transaction.delete(billOrganizations).where(inArray(billOrganizations.billId, organizationBillIds))
    }
    if (voteBillIds.length > 0) {
      await transaction.delete(votes).where(inArray(votes.billId, voteBillIds))
    }
    if (relationBillIds.length > 0) {
      await transaction.delete(billRelations).where(inArray(billRelations.billId, relationBillIds))
    }

    const normalizedSponsors = await normalizeSponsorObservations(
      transaction,
      aggregates.flatMap((aggregate) => aggregate.sponsors ?? [])
    )
    const normalizedSponsorsByBill = Map.groupBy(normalizedSponsors, (sponsor) => sponsor.billId)
    for (const aggregate of aggregates) {
      if (aggregate.sponsors !== undefined) {
        await deleteAbsentSponsorObservations(
          transaction,
          aggregate.bill.id,
          normalizedSponsorsByBill.get(aggregate.bill.id) ?? []
        )
      }
    }

    const actionValues = aggregates.flatMap((aggregate) =>
      (aggregate.actions ?? []).map((action) => ({
        ...action,
        organizationId:
          action.organizationId !== undefined &&
          action.organizationId !== null &&
          validOrganizationIds.has(action.organizationId)
            ? action.organizationId
            : undefined
      }))
    )
    const sponsorValues = normalizedSponsors
    const billOrganizationValues = aggregates
      .flatMap((aggregate) => aggregate.organizations ?? [])
      .filter((organization) => validOrganizationIds.has(organization.organizationId))
    const voteValues = aggregates.flatMap(
      (aggregate) =>
        aggregate.votes?.map((vote) => ({
          ...vote.vote,
          organizationId:
            vote.vote.organizationId !== undefined &&
            vote.vote.organizationId !== null &&
            validOrganizationIds.has(vote.vote.organizationId)
              ? vote.vote.organizationId
              : undefined
        })) ?? []
    )
    const positionValues = aggregates.flatMap(
      (aggregate) => aggregate.votes?.flatMap((vote) => vote.positions ?? []) ?? []
    )
    const relationValues = aggregates.flatMap((aggregate) => (aggregate.relations ?? []).map(prepareBillRelationInsert))
    if (actionValues.length > 0) {
      await transaction.insert(billActions).values(actionValues)
    }
    if (sponsorValues.length > 0) {
      await upsertSponsorObservations(transaction, sponsorValues, new Date())
    }
    if (billOrganizationValues.length > 0) {
      await transaction.insert(billOrganizations).values(billOrganizationValues)
    }
    if (voteValues.length > 0) {
      await transaction.insert(votes).values(voteValues)
    }
    if (positionValues.length > 0) {
      for (let offset = 0; offset < positionValues.length; offset += votePositionInsertBatchSize) {
        await transaction
          .insert(votePositions)
          .values(positionValues.slice(offset, offset + votePositionInsertBatchSize))
      }
    }
    if (relationValues.length > 0) {
      await transaction.insert(billRelations).values(relationValues)
    }

    const candidateDocumentValues = aggregates.flatMap((aggregate) =>
      (aggregate.documents ?? []).map((document) => document.document)
    )
    const existingDocuments =
      candidateDocumentValues.length === 0
        ? []
        : await transaction
            .select({ billId: billDocuments.billId, id: billDocuments.id, sourceUrl: billDocuments.sourceUrl })
            .from(billDocuments)
            .where(inArray(billDocuments.billId, billIds))
    const existingDocumentIds = new Map(
      existingDocuments.map((document) => [`${document.billId}\u001f${document.sourceUrl}`, document.id])
    )
    const documentValues = candidateDocumentValues.map((document) => ({
      ...document,
      id: existingDocumentIds.get(`${document.billId}\u001f${document.sourceUrl}`) ?? document.id
    }))
    if (documentValues.length > 0) {
      await transaction
        .insert(billDocuments)
        .values(documentValues)
        .onConflictDoUpdate({
          set: {
            billId: sql`excluded.bill_id`,
            classification: sql`excluded.classification`,
            contentType: sql`excluded.content_type`,
            documentDate: sql`excluded.document_date`,
            sourceUrl: sql`excluded.source_url`,
            title: sql`excluded.title`,
            updatedAt: new Date(),
            versionCode: sql`excluded.version_code`
          },
          target: billDocuments.id
        })
    }
    if (options.receipt) {
      await transaction.insert(syncCheckpoints).values({
        ...options.receipt,
        watermark: new Date(),
        updatedAt: new Date()
      })
    }
    if (options.ownership) {
      await assertBillBatchOwnership(transaction, options.ownership)
    }
  })
  return new Set(existing.map((record) => record.id))
}
