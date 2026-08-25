import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm"
import type { CanonicalBillAggregate } from "../../legislation/model.js"
import type { LegislationDatabase } from "../database.js"
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
  votePositions,
  votes
} from "../schema/schema.js"
import { observeCanonicalRecord } from "./changes.js"

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

    if (aggregate.people !== undefined && aggregate.people.length > 0) {
      for (const person of aggregate.people) {
        await transaction.insert(people).values(person).onConflictDoUpdate({ set: person, target: people.id })
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
      await deleteAbsentSponsorObservations(transaction, aggregate.bill.id, aggregate.sponsors)
      await upsertSponsorObservations(transaction, aggregate.sponsors, new Date())
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
        await transaction.insert(billRelations).values(aggregate.relations)
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

const votePositionInsertBatchSize = 100

export async function upsertBillAggregates(
  database: LegislationDatabase,
  aggregates: readonly CanonicalBillAggregate[]
): Promise<Set<string>> {
  if (aggregates.length === 0) {
    return new Set()
  }
  for (const aggregate of aggregates) {
    assertAggregateOwnership(aggregate)
  }
  const billIds = aggregates.map((aggregate) => aggregate.bill.id)
  const existing = await database.select({ id: bills.id }).from(bills).where(inArray(bills.id, billIds))

  await database.transaction(async (transaction) => {
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
      await transaction
        .insert(people)
        .values(personValues)
        .onConflictDoUpdate({
          set: {
            familyName: sql`excluded.family_name`,
            givenName: sql`excluded.given_name`,
            jurisdictionId: sql`excluded.jurisdiction_id`,
            name: sql`excluded.name`,
            party: sql`excluded.party`,
            sourceId: sql`excluded.source_id`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            isActive: sql`coalesce(excluded.is_active, ${people.isActive})`,
            updatedAt: new Date(),
            upstreamIds: sql`${people.upstreamIds} || excluded.upstream_ids`
          },
          target: people.id
        })
    }

    await transaction
      .insert(bills)
      .values(aggregates.map((aggregate) => aggregate.bill))
      .onConflictDoUpdate({
        set: {
          chamber: sql`excluded.chamber`,
          classification: sql`excluded.classification`,
          committees: sql`excluded.committees`,
          embeddedAt: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embeddedAt} end`,
          embedding: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embedding} end`,
          embeddingInputHash: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embeddingInputHash} end`,
          embeddingModel: sql`case when ${bills.title} is distinct from excluded.title or ${bills.summary} is distinct from excluded.summary or ${bills.subjects} is distinct from excluded.subjects then null else ${bills.embeddingModel} end`,
          identifier: sql`excluded.identifier`,
          introducedAt: sql`excluded.introduced_at`,
          jurisdictionId: sql`excluded.jurisdiction_id`,
          sessionId: sql`excluded.session_id`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          sourceUrl: sql`excluded.source_url`,
          status: sql`excluded.status`,
          subjects: sql`excluded.subjects`,
          summary: sql`excluded.summary`,
          title: sql`excluded.title`,
          updatedAt: new Date(),
          upstreamIds: sql`${bills.upstreamIds} || excluded.upstream_ids`
        },
        target: bills.id
      })

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

    await transaction.delete(billActions).where(inArray(billActions.billId, billIds))
    await transaction.delete(billOrganizations).where(inArray(billOrganizations.billId, billIds))
    await transaction.delete(votes).where(inArray(votes.billId, billIds))
    await transaction.delete(billRelations).where(inArray(billRelations.billId, billIds))

    for (const aggregate of aggregates) {
      if (aggregate.sponsors !== undefined) {
        await deleteAbsentSponsorObservations(transaction, aggregate.bill.id, aggregate.sponsors)
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
    const sponsorValues = aggregates.flatMap((aggregate) => aggregate.sponsors ?? [])
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
    const relationValues = aggregates.flatMap((aggregate) => aggregate.relations ?? [])
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
  })
  return new Set(existing.map((record) => record.id))
}

export async function getBillById(database: LegislationDatabase, canonicalBillId: string) {
  return database.query.bills.findFirst({ where: eq(bills.id, canonicalBillId) })
}
