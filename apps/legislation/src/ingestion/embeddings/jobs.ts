import { createHash } from "node:crypto"
import { and, asc, eq, sql, type SQLWrapper } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import {
  billDocuments,
  bills,
  documentSections,
  supportingMaterials,
  supportingMaterialSections
} from "../../db/schema/schema.js"
import { EMBEDDING_MODEL } from "../../models/openrouter-embeddings.js"

interface EmbeddingClient {
  embed(input: string[]): Promise<{ embeddings: number[][]; model: string }>
}

export interface EmbeddingJobResult {
  embedded: number
  skipped: number
}

interface EmbeddingSelection {
  shardCount?: number
  shardIndex?: number
}

function shard(column: SQLWrapper, options: EmbeddingSelection) {
  const count = options.shardCount ?? 1
  const index = options.shardIndex ?? 0
  return count === 1 ? undefined : sql`((hashtextextended(${column}, 0) % ${count}) + ${count}) % ${count} = ${index}`
}

function searchableBillText(bill: { subjects: string[]; summary: null | string; title: string }): string {
  return [bill.title, bill.summary, ...bill.subjects].filter((value): value is string => value !== null).join("\n")
}

function searchableSectionText(section: { heading: null | string; text: string }): string {
  return [section.heading, section.text].filter((value): value is string => value !== null).join("\n")
}

function inputHash(input: string): string {
  return createHash("sha256").update(`${EMBEDDING_MODEL}\u001f${input}`).digest("hex")
}

export async function embedBills(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: { billId?: string; limit?: number; shardCount?: number; shardIndex?: number } = {}
): Promise<EmbeddingJobResult> {
  const limit = options.limit ?? 64
  const records = await database
    .select({
      embeddingInputHash: bills.embeddingInputHash,
      id: bills.id,
      subjects: bills.subjects,
      summary: bills.summary,
      title: bills.title
    })
    .from(bills)
    .where(and(options.billId === undefined ? undefined : eq(bills.id, options.billId), shard(bills.id, options)))
    .orderBy(sql`${bills.embeddingInputHash} is null desc`, asc(bills.id))
    .limit(limit)
  const candidates = records
    .map((record) => ({ ...record, input: searchableBillText(record) }))
    .map((record) => ({ ...record, inputHash: inputHash(record.input) }))
    .filter((record) => record.embeddingInputHash !== record.inputHash)
  if (candidates.length === 0) {
    return { embedded: 0, skipped: records.length }
  }
  const response = await client.embed(candidates.map((candidate) => candidate.input))
  if (response.model !== EMBEDDING_MODEL || response.embeddings.length !== candidates.length) {
    throw new Error("Embedding client returned an incompatible result")
  }
  await database.transaction(async (transaction) => {
    for (const [index, candidate] of candidates.entries()) {
      await transaction
        .update(bills)
        .set({
          embeddedAt: new Date(),
          embedding: response.embeddings[index],
          embeddingInputHash: candidate.inputHash,
          embeddingModel: response.model
        })
        .where(eq(bills.id, candidate.id))
    }
  })
  return { embedded: candidates.length, skipped: records.length - candidates.length }
}

export async function embedDocumentSections(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: {
    billId?: string
    documentId?: string
    limit?: number
    shardCount?: number
    shardIndex?: number
  } = {}
): Promise<EmbeddingJobResult> {
  const limit = options.limit ?? 64
  const records = await database
    .select({
      documentId: documentSections.documentId,
      embeddingInputHash: documentSections.embeddingInputHash,
      heading: documentSections.heading,
      id: documentSections.id,
      text: documentSections.text
    })
    .from(documentSections)
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .where(
      and(
        options.documentId === undefined ? undefined : eq(documentSections.documentId, options.documentId),
        options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
        shard(documentSections.id, options)
      )
    )
    .orderBy(sql`${documentSections.embeddingInputHash} is null desc`, asc(documentSections.id))
    .limit(limit)
  const candidates = records
    .map((record) => ({ ...record, input: searchableSectionText(record) }))
    .map((record) => ({ ...record, inputHash: inputHash(record.input) }))
    .filter((record) => record.embeddingInputHash !== record.inputHash)
  if (candidates.length === 0) {
    return { embedded: 0, skipped: records.length }
  }
  const response = await client.embed(candidates.map((candidate) => candidate.input))
  if (response.model !== EMBEDDING_MODEL || response.embeddings.length !== candidates.length) {
    throw new Error("Embedding client returned an incompatible result")
  }
  await database.transaction(async (transaction) => {
    for (const [index, candidate] of candidates.entries()) {
      await transaction
        .update(documentSections)
        .set({
          embeddedAt: new Date(),
          embedding: response.embeddings[index],
          embeddingInputHash: candidate.inputHash,
          embeddingModel: response.model
        })
        .where(eq(documentSections.id, candidate.id))
    }
  })
  return { embedded: candidates.length, skipped: records.length - candidates.length }
}

export async function embedSupportingMaterialSections(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: { limit?: number; materialId?: string; shardCount?: number; shardIndex?: number } = {}
): Promise<EmbeddingJobResult> {
  const limit = options.limit ?? 64
  const records = await database
    .select({
      embeddingInputHash: supportingMaterialSections.embeddingInputHash,
      heading: supportingMaterialSections.heading,
      id: supportingMaterialSections.id,
      materialId: supportingMaterialSections.materialId,
      text: supportingMaterialSections.text
    })
    .from(supportingMaterialSections)
    .innerJoin(supportingMaterials, eq(supportingMaterialSections.materialId, supportingMaterials.id))
    .where(
      and(
        options.materialId === undefined ? undefined : eq(supportingMaterialSections.materialId, options.materialId),
        shard(supportingMaterialSections.id, options)
      )
    )
    .orderBy(sql`${supportingMaterialSections.embeddingInputHash} is null desc`, asc(supportingMaterialSections.id))
    .limit(limit)
  const candidates = records
    .map((record) => ({ ...record, input: searchableSectionText(record) }))
    .map((record) => ({ ...record, inputHash: inputHash(record.input) }))
    .filter((record) => record.embeddingInputHash !== record.inputHash)
  if (candidates.length === 0) {
    return { embedded: 0, skipped: records.length }
  }
  const response = await client.embed(candidates.map((candidate) => candidate.input))
  if (response.model !== EMBEDDING_MODEL || response.embeddings.length !== candidates.length) {
    throw new Error("Embedding client returned an incompatible result")
  }
  await database.transaction(async (transaction) => {
    for (const [index, candidate] of candidates.entries()) {
      await transaction
        .update(supportingMaterialSections)
        .set({
          embeddedAt: new Date(),
          embedding: response.embeddings[index],
          embeddingInputHash: candidate.inputHash,
          embeddingModel: response.model
        })
        .where(eq(supportingMaterialSections.id, candidate.id))
    }
  })
  return { embedded: candidates.length, skipped: records.length - candidates.length }
}
