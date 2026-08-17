import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { CanonicalBillAggregate } from "../../legislation/model.js"
import type { LegislationDatabase } from "../database.js"
import {
  billActions,
  billDocuments,
  billRelations,
  billSponsors,
  bills,
  documentSections,
  jurisdictions,
  legislativeSessions,
  people,
  votePositions,
  votes
} from "../schema/schema.js"

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

  for (const child of [...(aggregate.actions ?? []), ...(aggregate.sponsors ?? []), ...(aggregate.relations ?? [])]) {
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

    await transaction
      .insert(jurisdictions)
      .values(aggregate.jurisdiction)
      .onConflictDoUpdate({ set: aggregate.jurisdiction, target: jurisdictions.id })
    await transaction
      .insert(legislativeSessions)
      .values(aggregate.session)
      .onConflictDoUpdate({ set: aggregate.session, target: legislativeSessions.id })
    await transaction.insert(bills).values(bill).onConflictDoUpdate({ set: bill, target: bills.id })

    if (aggregate.people !== undefined && aggregate.people.length > 0) {
      for (const person of aggregate.people) {
        await transaction.insert(people).values(person).onConflictDoUpdate({ set: person, target: people.id })
      }
    }

    if (aggregate.actions !== undefined) {
      await transaction.delete(billActions).where(eq(billActions.billId, aggregate.bill.id))
      if (aggregate.actions.length > 0) {
        await transaction.insert(billActions).values(aggregate.actions)
      }
    }

    if (aggregate.sponsors !== undefined) {
      await transaction.delete(billSponsors).where(eq(billSponsors.billId, aggregate.bill.id))
      if (aggregate.sponsors.length > 0) {
        await transaction.insert(billSponsors).values(aggregate.sponsors)
      }
    }

    if (aggregate.votes !== undefined) {
      await transaction.delete(votes).where(eq(votes.billId, aggregate.bill.id))
      for (const vote of aggregate.votes) {
        await transaction.insert(votes).values(vote.vote)
        if (vote.positions !== undefined && vote.positions.length > 0) {
          await transaction.insert(votePositions).values(vote.positions)
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
  })
}

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}

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
          sourceUrl: sql`excluded.source_url`,
          subdivisionCode: sql`excluded.subdivision_code`,
          updatedAt: new Date()
        },
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
          isActive: sql`excluded.is_active`,
          jurisdictionId: sql`excluded.jurisdiction_id`,
          name: sql`excluded.name`,
          sourceUrl: sql`excluded.source_url`,
          startDate: sql`excluded.start_date`,
          updatedAt: new Date()
        },
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

    await transaction.delete(billActions).where(inArray(billActions.billId, billIds))
    await transaction.delete(billSponsors).where(inArray(billSponsors.billId, billIds))
    await transaction.delete(votes).where(inArray(votes.billId, billIds))
    await transaction.delete(billRelations).where(inArray(billRelations.billId, billIds))

    const actionValues = aggregates.flatMap((aggregate) => aggregate.actions ?? [])
    const sponsorValues = aggregates.flatMap((aggregate) => aggregate.sponsors ?? [])
    const voteValues = aggregates.flatMap((aggregate) => aggregate.votes?.map((vote) => vote.vote) ?? [])
    const positionValues = aggregates.flatMap(
      (aggregate) => aggregate.votes?.flatMap((vote) => vote.positions ?? []) ?? []
    )
    const relationValues = aggregates.flatMap((aggregate) => aggregate.relations ?? [])
    if (actionValues.length > 0) {
      await transaction.insert(billActions).values(actionValues)
    }
    if (sponsorValues.length > 0) {
      await transaction.insert(billSponsors).values(sponsorValues)
    }
    if (voteValues.length > 0) {
      await transaction.insert(votes).values(voteValues)
    }
    if (positionValues.length > 0) {
      await transaction.insert(votePositions).values(positionValues)
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
