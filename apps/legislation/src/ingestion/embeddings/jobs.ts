import { createHash } from "node:crypto"
import { and, asc, eq, gt, sql, type SQLWrapper } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import {
  billDocuments,
  bills,
  documentSections,
  supportingMaterials,
  supportingMaterialSections
} from "../../db/schema/schema.js"
import { EMBEDDING_MODEL, limitEmbeddingInput } from "../../models/openrouter-embeddings.js"

interface EmbeddingClient {
  embed(input: string[]): Promise<{ embeddings: number[][]; model: string }>
}

export interface EmbeddingJobResult {
  complete: boolean
  cursor: string
  embedded: number
  scanned: number
  skipped: number
}

interface EmbeddingSelection {
  afterId?: string
  scanLimit?: number
  shardCount?: number
  shardIndex?: number
}

export interface EmbeddingFreshnessState {
  embedding: null | unknown
  embeddingInputHash: null | string
  embeddingModel: null | string
}

interface ScannedEmbeddingRecord extends EmbeddingFreshnessState {
  id: string
}

type EmbeddingCandidate<Record extends ScannedEmbeddingRecord> = Record & {
  input: string
  inputHash: string
}

export interface EmbeddingCandidateSelection<Record extends ScannedEmbeddingRecord> {
  candidates: EmbeddingCandidate<Record>[]
  complete: boolean
  cursor: string
  scanned: number
}

/**
 * Selects work from a bounded keyset-scanned page. The content hash remains in
 * TypeScript so it is exactly the same hash sent to the embedding provider.
 * The cursor advances past fresh rows, preventing a fresh first page from
 * hiding a stale record later in the shard.
 */
export function selectEmbeddingCandidates<Record extends ScannedEmbeddingRecord>(
  records: readonly Record[],
  options: Readonly<{ afterId: string; limit: number; scanLimit: number }>,
  createInput: (record: Record) => string
): EmbeddingCandidateSelection<Record> {
  const candidates: EmbeddingCandidate<Record>[] = []
  let cursor = options.afterId
  let scanned = 0
  for (const record of records) {
    const input = createInput(record)
    const recordInputHash = inputHash(input)
    cursor = record.id
    scanned += 1
    if (!needsEmbeddingRefresh(recordInputHash, record)) {
      continue
    }
    candidates.push({ ...record, input, inputHash: recordInputHash })
    if (candidates.length === options.limit) {
      break
    }
  }
  // A short database page proves there are no rows after it only when we
  // scanned the entire page. Reaching the embedding batch limit early leaves
  // later candidates for the next cursor position.
  const complete = records.length < options.scanLimit && scanned === records.length
  return { candidates, complete, cursor: complete ? "" : cursor, scanned }
}

function shard(column: SQLWrapper, options: EmbeddingSelection) {
  const count = options.shardCount ?? 1
  const index = options.shardIndex ?? 0
  return count === 1 ? undefined : sql`((hashtextextended(${column}, 0) % ${count}) + ${count}) % ${count} = ${index}`
}

function searchableBillText(bill: { subjects: string[]; summary: null | string; title: string }): string {
  return limitEmbeddingInput(
    [bill.title, bill.summary, ...bill.subjects].filter((value): value is string => value !== null).join("\n")
  )
}

function searchableSectionText(section: { heading: null | string; text: string }): string {
  return limitEmbeddingInput(
    [section.heading, section.text].filter((value): value is string => value !== null).join("\n")
  )
}

function inputHash(input: string): string {
  return createHash("sha256").update(`${EMBEDDING_MODEL}\u001f${input}`).digest("hex")
}

export function billEmbeddingInputHash(bill: { subjects: string[]; summary: null | string; title: string }): string {
  return inputHash(searchableBillText(bill))
}

export function sectionEmbeddingInputHash(section: { heading: null | string; text: string }): string {
  return inputHash(searchableSectionText(section))
}

/**
 * A stored hash alone is not proof that a record is searchable. Every current
 * embedding also needs its vector and the model that produced it.
 */
export function needsEmbeddingRefresh(inputHash: string, state: EmbeddingFreshnessState): boolean {
  return (
    state.embedding === null ||
    state.embeddingInputHash?.trim() !== inputHash ||
    state.embeddingModel !== EMBEDDING_MODEL
  )
}

export async function embedBills(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: {
    afterId?: string
    billId?: string
    limit?: number
    scanLimit?: number
    shardCount?: number
    shardIndex?: number
  } = {}
): Promise<EmbeddingJobResult> {
  const limit = options.limit ?? 64
  const scanLimit = Math.max(limit, options.scanLimit ?? 512)
  const afterId = options.afterId ?? ""
  const records = await database
    .select({
      embedding: bills.embedding,
      embeddingInputHash: bills.embeddingInputHash,
      embeddingModel: bills.embeddingModel,
      id: bills.id,
      subjects: bills.subjects,
      summary: bills.summary,
      title: bills.title,
      updatedAt: bills.updatedAt
    })
    .from(bills)
    .where(
      and(options.billId === undefined ? gt(bills.id, afterId) : eq(bills.id, options.billId), shard(bills.id, options))
    )
    .orderBy(asc(bills.id))
    .limit(scanLimit)
  const selection = selectEmbeddingCandidates(records, { afterId, limit, scanLimit }, searchableBillText)
  if (selection.candidates.length === 0) {
    return {
      complete: selection.complete,
      cursor: selection.cursor,
      embedded: 0,
      scanned: selection.scanned,
      skipped: selection.scanned
    }
  }
  const response = await client.embed(selection.candidates.map((candidate) => candidate.input))
  if (response.model !== EMBEDDING_MODEL || response.embeddings.length !== selection.candidates.length) {
    throw new Error("Embedding client returned an incompatible result")
  }
  await database.transaction(async (transaction) => {
    for (const [index, candidate] of selection.candidates.entries()) {
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
  return {
    complete: selection.complete,
    cursor: selection.cursor,
    embedded: selection.candidates.length,
    scanned: selection.scanned,
    skipped: selection.scanned - selection.candidates.length
  }
}

export async function embedDocumentSections(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: {
    afterId?: string
    billId?: string
    documentId?: string
    limit?: number
    scanLimit?: number
    sectionId?: string
    shardCount?: number
    shardIndex?: number
  } = {}
): Promise<EmbeddingJobResult> {
  const limit = options.limit ?? 64
  const scanLimit = Math.max(limit, options.scanLimit ?? 512)
  const afterId = options.afterId ?? ""
  const records = await database
    .select({
      documentId: documentSections.documentId,
      embedding: documentSections.embedding,
      embeddingInputHash: documentSections.embeddingInputHash,
      embeddingModel: documentSections.embeddingModel,
      heading: documentSections.heading,
      id: documentSections.id,
      text: documentSections.text,
      updatedAt: documentSections.updatedAt
    })
    .from(documentSections)
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .where(
      and(
        options.documentId === undefined ? undefined : eq(documentSections.documentId, options.documentId),
        options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
        options.sectionId === undefined ? undefined : eq(documentSections.id, options.sectionId),
        options.documentId === undefined && options.billId === undefined && options.sectionId === undefined
          ? gt(documentSections.id, afterId)
          : undefined,
        shard(documentSections.id, options)
      )
    )
    .orderBy(asc(documentSections.id))
    .limit(scanLimit)
  const selection = selectEmbeddingCandidates(records, { afterId, limit, scanLimit }, searchableSectionText)
  if (selection.candidates.length === 0) {
    return {
      complete: selection.complete,
      cursor: selection.cursor,
      embedded: 0,
      scanned: selection.scanned,
      skipped: selection.scanned
    }
  }
  const response = await client.embed(selection.candidates.map((candidate) => candidate.input))
  if (response.model !== EMBEDDING_MODEL || response.embeddings.length !== selection.candidates.length) {
    throw new Error("Embedding client returned an incompatible result")
  }
  await database.transaction(async (transaction) => {
    for (const [index, candidate] of selection.candidates.entries()) {
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
  return {
    complete: selection.complete,
    cursor: selection.cursor,
    embedded: selection.candidates.length,
    scanned: selection.scanned,
    skipped: selection.scanned - selection.candidates.length
  }
}

export async function embedSupportingMaterialSections(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: {
    afterId?: string
    limit?: number
    materialId?: string
    scanLimit?: number
    shardCount?: number
    shardIndex?: number
  } = {}
): Promise<EmbeddingJobResult> {
  const limit = options.limit ?? 64
  const scanLimit = Math.max(limit, options.scanLimit ?? 512)
  const afterId = options.afterId ?? ""
  const records = await database
    .select({
      embedding: supportingMaterialSections.embedding,
      embeddingInputHash: supportingMaterialSections.embeddingInputHash,
      embeddingModel: supportingMaterialSections.embeddingModel,
      heading: supportingMaterialSections.heading,
      id: supportingMaterialSections.id,
      materialId: supportingMaterialSections.materialId,
      text: supportingMaterialSections.text,
      updatedAt: supportingMaterialSections.updatedAt
    })
    .from(supportingMaterialSections)
    .innerJoin(supportingMaterials, eq(supportingMaterialSections.materialId, supportingMaterials.id))
    .where(
      and(
        options.materialId === undefined ? undefined : eq(supportingMaterialSections.materialId, options.materialId),
        options.materialId === undefined ? gt(supportingMaterialSections.id, afterId) : undefined,
        shard(supportingMaterialSections.id, options)
      )
    )
    .orderBy(asc(supportingMaterialSections.id))
    .limit(scanLimit)
  const selection = selectEmbeddingCandidates(records, { afterId, limit, scanLimit }, searchableSectionText)
  if (selection.candidates.length === 0) {
    return {
      complete: selection.complete,
      cursor: selection.cursor,
      embedded: 0,
      scanned: selection.scanned,
      skipped: selection.scanned
    }
  }
  const response = await client.embed(selection.candidates.map((candidate) => candidate.input))
  if (response.model !== EMBEDDING_MODEL || response.embeddings.length !== selection.candidates.length) {
    throw new Error("Embedding client returned an incompatible result")
  }
  await database.transaction(async (transaction) => {
    for (const [index, candidate] of selection.candidates.entries()) {
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
  return {
    complete: selection.complete,
    cursor: selection.cursor,
    embedded: selection.candidates.length,
    scanned: selection.scanned,
    skipped: selection.scanned - selection.candidates.length
  }
}
