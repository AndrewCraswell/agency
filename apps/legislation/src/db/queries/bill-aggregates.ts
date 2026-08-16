import { eq } from "drizzle-orm"
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
      .select({ upstreamIds: bills.upstreamIds })
      .from(bills)
      .where(eq(bills.id, aggregate.bill.id))
      .limit(1)
    const bill = {
      ...aggregate.bill,
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
          where: eq(billDocuments.id, document.document.id)
        })
        const persistedDocument = {
          ...document.document,
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
          await transaction.delete(documentSections).where(eq(documentSections.documentId, document.document.id))
          if (document.sections.length > 0) {
            await transaction.insert(documentSections).values(document.sections)
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

export async function getBillById(database: LegislationDatabase, canonicalBillId: string) {
  return database.query.bills.findFirst({ where: eq(bills.id, canonicalBillId) })
}
