import { createHash } from "node:crypto"
import { and, asc, eq, gt, inArray, isNotNull, sql, type SQLWrapper } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import {
  amendmentEmbeddings,
  amendments,
  billDocuments,
  billEmbeddings,
  bills,
  documentSectionEmbeddings,
  documentSections,
  supportingMaterialSectionEmbeddings,
  supportingMaterialSections
} from "../../db/schema/schema.js"
import { embeddingRouteFor, type EmbeddingRoute } from "../../models/embedding-routing.js"
import { limitEmbeddingInput } from "../../models/openrouter-embeddings.js"

export interface EmbeddingClient {
  embed(input: string[], inputType?: "document" | "query"): Promise<{ embeddings: number[][]; model: string }>
}

const MAXIMUM_PROVIDER_BATCH_SIZE = 64
const MAXIMUM_PERSISTENCE_BATCH_SIZE = 256

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
  embeddingInputContract: null | string
  embeddingModel: null | string
}

function embeddingPresence(column: SQLWrapper) {
  return sql<null | true>`case when ${column} is null then null else true end`
}

interface ScannedEmbeddingRecord extends EmbeddingFreshnessState {
  id: string
}

type EmbeddingCandidate<Record extends ScannedEmbeddingRecord> = Record & { input: string; inputHash: string }

export interface EmbeddingCandidateSelection<Record extends ScannedEmbeddingRecord> {
  candidates: EmbeddingCandidate<Record>[]
  complete: boolean
  cursor: string
  scanned: number
}

export function selectEmbeddingCandidates<Record extends ScannedEmbeddingRecord>(
  records: readonly Record[],
  options: Readonly<{ afterId: string; limit: number; route: EmbeddingRoute; scanLimit: number }>,
  createInput: (record: Record) => string
): EmbeddingCandidateSelection<Record> {
  const candidates: EmbeddingCandidate<Record>[] = []
  let cursor = options.afterId
  let scanned = 0
  for (const record of records) {
    const input = createInput(record)
    const recordInputHash = embeddingInputHash(options.route, input)
    cursor = record.id
    scanned += 1
    if (!needsEmbeddingRefresh(recordInputHash, record, options.route)) {
      continue
    }
    candidates.push({ ...record, input, inputHash: recordInputHash })
    if (candidates.length === options.limit) {
      break
    }
  }
  const complete = records.length < options.scanLimit && scanned === records.length
  return { candidates, complete, cursor: complete ? "" : cursor, scanned }
}

function shard(column: SQLWrapper, options: EmbeddingSelection) {
  const count = options.shardCount ?? 1
  const index = options.shardIndex ?? 0
  return count === 1 ? undefined : sql`((hashtextextended(${column}, 0) % ${count}) + ${count}) % ${count} = ${index}`
}

export function searchableBillText(bill: { subjects: string[]; summary: null | string; title: string }): string {
  return limitEmbeddingInput(
    [bill.title, bill.summary, ...bill.subjects].filter((value): value is string => value !== null).join("\n")
  )
}

export function searchableSectionText(section: { heading: null | string; text: string }): string {
  return limitEmbeddingInput(
    [section.heading, section.text].filter((value): value is string => value !== null).join("\n")
  )
}

export function searchableAmendmentText(amendment: {
  description: null | string
  printedIdentifier: string
  purpose: null | string
}): string {
  const prose = [amendment.purpose, amendment.description].filter(
    (value): value is string => value !== null && value.trim().length > 0
  )
  return limitEmbeddingInput((prose.length === 0 ? [amendment.printedIdentifier] : prose).join("\n"))
}

export function embeddingInputHash(route: EmbeddingRoute, input: string): string {
  return createHash("sha256").update(`${route.model}\u001f${route.embeddingInputContract}\u001f${input}`).digest("hex")
}

export function legacyEmbeddingInputHash(model: string, input: string): string {
  return createHash("sha256").update(`${model}\u001f${input}`).digest("hex")
}

export function billEmbeddingInputHash(bill: { subjects: string[]; summary: null | string; title: string }): string {
  const route = embeddingRouteFor("bill")
  return embeddingInputHash(route, searchableBillText(bill))
}

export function sectionEmbeddingInputHash(section: { heading: null | string; text: string }): string {
  const route = embeddingRouteFor("document-section")
  return embeddingInputHash(route, searchableSectionText(section))
}

export function materialSectionEmbeddingInputHash(section: { heading: null | string; text: string }): string {
  const route = embeddingRouteFor("supporting-material-section")
  return embeddingInputHash(route, searchableSectionText(section))
}

export function amendmentEmbeddingInputHash(amendment: {
  description: null | string
  printedIdentifier: string
  purpose: null | string
}): string {
  const route = embeddingRouteFor("structured-amendment")
  return embeddingInputHash(route, searchableAmendmentText(amendment))
}

export function needsEmbeddingRefresh(
  inputHash: string,
  state: EmbeddingFreshnessState,
  route: EmbeddingRoute
): boolean {
  return (
    state.embedding === null ||
    state.embeddingInputHash?.trim() !== inputHash ||
    state.embeddingInputContract !== route.embeddingInputContract ||
    state.embeddingModel !== route.model
  )
}

interface CommonEmbeddingOptions extends EmbeddingSelection {
  limit?: number
  persistenceBatchSize?: number
  providerBatchSize?: number
  rolloutId: string
}

function selectionOptions(route: EmbeddingRoute, options: CommonEmbeddingOptions) {
  const limit = positiveBatchSize(options.limit ?? MAXIMUM_PROVIDER_BATCH_SIZE, "embedding selection batch size")
  const providerBatchSize = positiveBatchSize(
    options.providerBatchSize ?? Math.min(limit, MAXIMUM_PROVIDER_BATCH_SIZE),
    "embedding provider batch size",
    MAXIMUM_PROVIDER_BATCH_SIZE
  )
  const persistenceBatchSize = positiveBatchSize(
    options.persistenceBatchSize ?? providerBatchSize,
    "embedding persistence batch size",
    MAXIMUM_PERSISTENCE_BATCH_SIZE
  )
  return {
    afterId: options.afterId ?? "",
    limit,
    persistenceBatchSize,
    providerBatchSize,
    route,
    scanLimit: Math.max(limit, options.scanLimit ?? 512)
  }
}

function positiveBatchSize(value: number, name: string, maximum?: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    throw new Error(`${name} must be a positive integer${maximum === undefined ? "" : ` no greater than ${maximum}`}`)
  }
  return value
}

function assertCompatibleResponse(
  response: Awaited<ReturnType<EmbeddingClient["embed"]>>,
  route: EmbeddingRoute,
  expected: number
): void {
  if (response.model !== route.model || response.embeddings.length !== expected) {
    throw new Error(`Embedding client returned an incompatible result for ${route.product}`)
  }
}

function resultFromSelection<Record extends ScannedEmbeddingRecord>(
  selection: EmbeddingCandidateSelection<Record>,
  embedded: number
): EmbeddingJobResult {
  return {
    complete: selection.complete,
    cursor: selection.cursor,
    embedded,
    scanned: selection.scanned,
    skipped: selection.scanned - embedded
  }
}

export async function embedSelected<Record extends ScannedEmbeddingRecord>(
  client: EmbeddingClient,
  route: EmbeddingRoute,
  selection: EmbeddingCandidateSelection<Record>,
  persist: (records: Array<{ candidate: EmbeddingCandidate<Record>; embedding: number[] }>) => Promise<void>,
  options: Readonly<{ persistenceBatchSize?: number; providerBatchSize?: number }> = {}
): Promise<EmbeddingJobResult> {
  if (selection.candidates.length === 0) {
    return resultFromSelection(selection, 0)
  }
  const providerBatchSize = positiveBatchSize(
    options.providerBatchSize ?? MAXIMUM_PROVIDER_BATCH_SIZE,
    "embedding provider batch size",
    MAXIMUM_PROVIDER_BATCH_SIZE
  )
  const persistenceBatchSize = positiveBatchSize(
    options.persistenceBatchSize ?? providerBatchSize,
    "embedding persistence batch size",
    MAXIMUM_PERSISTENCE_BATCH_SIZE
  )
  let pending: Array<{ candidate: EmbeddingCandidate<Record>; embedding: number[] }> = []
  for (let offset = 0; offset < selection.candidates.length; offset += providerBatchSize) {
    const candidates = selection.candidates.slice(offset, offset + providerBatchSize)
    const response = await client.embed(
      candidates.map((candidate) => candidate.input),
      "document"
    )
    assertCompatibleResponse(response, route, candidates.length)
    pending.push(
      ...candidates.map((candidate, index) => {
        const embedding = response.embeddings[index]
        if (embedding === undefined) {
          throw new Error(`Embedding response omitted ${route.product} candidate ${candidate.id}`)
        }
        return { candidate, embedding }
      })
    )
    if (pending.length >= persistenceBatchSize) {
      await persist(pending)
      pending = []
    }
  }
  if (pending.length > 0) {
    await persist(pending)
  }
  return resultFromSelection(selection, selection.candidates.length)
}

async function persistInBatches<Record>(
  records: readonly Record[],
  batchSize: number,
  persist: (records: Record[]) => Promise<void>
): Promise<void> {
  for (let offset = 0; offset < records.length; offset += batchSize) {
    await persist(records.slice(offset, offset + batchSize))
  }
}

export async function embedBills(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: CommonEmbeddingOptions & { billId?: string }
): Promise<EmbeddingJobResult> {
  const route = embeddingRouteFor("bill")
  const selected = selectionOptions(route, options)
  const records = await database
    .select({
      embedding: embeddingPresence(billEmbeddings.embedding),
      embeddingInputContract: billEmbeddings.inputContract,
      embeddingInputHash: billEmbeddings.inputHash,
      embeddingModel: billEmbeddings.model,
      id: bills.id,
      subjects: bills.subjects,
      summary: bills.summary,
      title: bills.title
    })
    .from(bills)
    .leftJoin(
      billEmbeddings,
      and(
        eq(billEmbeddings.billId, bills.id),
        eq(billEmbeddings.model, route.model),
        eq(billEmbeddings.inputContract, route.embeddingInputContract)
      )
    )
    .where(
      and(
        options.billId === undefined ? gt(bills.id, selected.afterId) : eq(bills.id, options.billId),
        shard(bills.id, options)
      )
    )
    .orderBy(asc(bills.id))
    .limit(selected.scanLimit)
  const selection = selectEmbeddingCandidates(records, selected, searchableBillText)
  return embedSelected(
    client,
    route,
    selection,
    async (embeddedRecords) => {
      const updatedAt = new Date()
      await database
        .insert(billEmbeddings)
        .values(
          embeddedRecords.map(({ candidate, embedding }) => ({
            billId: candidate.id,
            dimensions: route.dimensions,
            embedding,
            inputContract: route.embeddingInputContract,
            inputHash: candidate.inputHash,
            model: route.model,
            rolloutId: options.rolloutId
          }))
        )
        .onConflictDoUpdate({
          set: {
            dimensions: route.dimensions,
            embedding: sql`excluded.embedding`,
            inputHash: sql`excluded.input_hash`,
            rolloutId: sql`excluded.rollout_id`,
            updatedAt
          },
          target: [billEmbeddings.billId, billEmbeddings.model, billEmbeddings.inputContract]
        })
    },
    selected
  )
}

export async function embedDocumentSections(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: CommonEmbeddingOptions & { billId?: string; documentId?: string; sectionId?: string }
): Promise<EmbeddingJobResult> {
  const route = embeddingRouteFor("document-section")
  const selected = selectionOptions(route, options)
  const records = await database
    .select({
      documentId: documentSections.documentId,
      documentClassification: billDocuments.classification,
      embedding: embeddingPresence(documentSectionEmbeddings.embedding),
      embeddingInputContract: documentSectionEmbeddings.inputContract,
      embeddingInputHash: documentSectionEmbeddings.inputHash,
      embeddingModel: documentSectionEmbeddings.model,
      heading: documentSections.heading,
      id: documentSections.id,
      legacyEmbeddingAvailable: sql<boolean>`${documentSections.embedding} is not null`,
      legacyEmbeddingInputHash: documentSections.embeddingInputHash,
      legacyEmbeddingModel: documentSections.embeddingModel,
      text: documentSections.text
    })
    .from(documentSections)
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .leftJoin(
      documentSectionEmbeddings,
      and(
        eq(documentSectionEmbeddings.sectionId, documentSections.id),
        eq(documentSectionEmbeddings.model, route.model),
        eq(documentSectionEmbeddings.inputContract, route.embeddingInputContract)
      )
    )
    .where(
      and(
        options.documentId === undefined ? undefined : eq(documentSections.documentId, options.documentId),
        options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
        options.sectionId === undefined ? undefined : eq(documentSections.id, options.sectionId),
        // A document or bill target can still contain more than one scan page.
        // Only an exact section target is non-pageable.
        options.sectionId === undefined ? gt(documentSections.id, selected.afterId) : undefined,
        shard(documentSections.id, options)
      )
    )
    .orderBy(asc(documentSections.id))
    .limit(selected.scanLimit)
  const selection = selectEmbeddingCandidates(records, selected, searchableSectionText)
  const persist = async (
    embeddedRecords: Array<{
      candidate: EmbeddingCandidate<(typeof records)[number]>
      embedding: number[]
    }>
  ) => {
    const updatedAt = new Date()
    await database
      .insert(documentSectionEmbeddings)
      .values(
        embeddedRecords.map(({ candidate, embedding }) => ({
          dimensions: route.dimensions,
          documentClassification: candidate.documentClassification,
          embedding,
          inputContract: route.embeddingInputContract,
          inputHash: candidate.inputHash,
          model: route.model,
          rolloutId: options.rolloutId,
          sectionId: candidate.id
        }))
      )
      .onConflictDoUpdate({
        set: {
          dimensions: route.dimensions,
          documentClassification: sql`excluded.document_classification`,
          embedding: sql`excluded.embedding`,
          inputHash: sql`excluded.input_hash`,
          rolloutId: sql`excluded.rollout_id`,
          updatedAt
        },
        target: [
          documentSectionEmbeddings.sectionId,
          documentSectionEmbeddings.model,
          documentSectionEmbeddings.inputContract
        ]
      })
  }
  const reusableCandidates = selection.candidates.filter(
    (candidate) =>
      candidate.legacyEmbeddingAvailable &&
      candidate.legacyEmbeddingModel === route.model &&
      candidate.legacyEmbeddingInputHash?.trim() === legacyEmbeddingInputHash(route.model, candidate.input)
  )
  const reusableRows =
    reusableCandidates.length === 0
      ? []
      : await database
          .select({ embedding: documentSections.embedding, id: documentSections.id })
          .from(documentSections)
          .where(
            and(
              inArray(
                documentSections.id,
                reusableCandidates.map((candidate) => candidate.id)
              ),
              isNotNull(documentSections.embedding)
            )
          )
  const reusableCandidatesById = new Map(reusableCandidates.map((candidate) => [candidate.id, candidate]))
  const reusable = reusableRows.flatMap(({ embedding, id }) => {
    const candidate = reusableCandidatesById.get(id)
    return candidate === undefined || embedding === null || embedding.length !== route.dimensions
      ? []
      : [{ candidate, embedding }]
  })
  if (reusable.length > 0) {
    await persistInBatches(reusable, selected.persistenceBatchSize, persist)
  }
  const reusableIds = new Set(reusable.map(({ candidate }) => candidate.id))
  const generated = await embedSelected(
    client,
    route,
    { ...selection, candidates: selection.candidates.filter((candidate) => !reusableIds.has(candidate.id)) },
    persist,
    selected
  )
  const embedded = generated.embedded + reusable.length
  return { ...generated, embedded, skipped: selection.scanned - embedded }
}

export async function embedAmendments(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: CommonEmbeddingOptions & { amendmentId?: string }
): Promise<EmbeddingJobResult> {
  const route = embeddingRouteFor("structured-amendment")
  const selected = selectionOptions(route, options)
  const records = await database
    .select({
      description: amendments.description,
      embedding: embeddingPresence(amendmentEmbeddings.embedding),
      embeddingInputContract: amendmentEmbeddings.inputContract,
      embeddingInputHash: amendmentEmbeddings.inputHash,
      embeddingModel: amendmentEmbeddings.model,
      id: amendments.id,
      printedIdentifier: amendments.printedIdentifier,
      purpose: amendments.purpose
    })
    .from(amendments)
    .leftJoin(
      amendmentEmbeddings,
      and(
        eq(amendmentEmbeddings.amendmentId, amendments.id),
        eq(amendmentEmbeddings.model, route.model),
        eq(amendmentEmbeddings.inputContract, route.embeddingInputContract)
      )
    )
    .where(
      and(
        options.amendmentId === undefined
          ? gt(amendments.id, selected.afterId)
          : eq(amendments.id, options.amendmentId),
        shard(amendments.id, options)
      )
    )
    .orderBy(asc(amendments.id))
    .limit(selected.scanLimit)
  const selection = selectEmbeddingCandidates(records, selected, searchableAmendmentText)
  return embedSelected(
    client,
    route,
    selection,
    async (embeddedRecords) => {
      const updatedAt = new Date()
      await database
        .insert(amendmentEmbeddings)
        .values(
          embeddedRecords.map(({ candidate, embedding }) => ({
            amendmentId: candidate.id,
            dimensions: route.dimensions,
            embedding,
            inputContract: route.embeddingInputContract,
            inputHash: candidate.inputHash,
            model: route.model,
            rolloutId: options.rolloutId
          }))
        )
        .onConflictDoUpdate({
          set: {
            dimensions: route.dimensions,
            embedding: sql`excluded.embedding`,
            inputHash: sql`excluded.input_hash`,
            rolloutId: sql`excluded.rollout_id`,
            updatedAt
          },
          target: [amendmentEmbeddings.amendmentId, amendmentEmbeddings.model, amendmentEmbeddings.inputContract]
        })
    },
    selected
  )
}

export async function embedSupportingMaterialSections(
  database: LegislationDatabase,
  client: EmbeddingClient,
  options: CommonEmbeddingOptions & { materialId?: string }
): Promise<EmbeddingJobResult> {
  const route = embeddingRouteFor("supporting-material-section")
  const selected = selectionOptions(route, options)
  const records = await database
    .select({
      embedding: embeddingPresence(supportingMaterialSectionEmbeddings.embedding),
      embeddingInputContract: supportingMaterialSectionEmbeddings.inputContract,
      embeddingInputHash: supportingMaterialSectionEmbeddings.inputHash,
      embeddingModel: supportingMaterialSectionEmbeddings.model,
      heading: supportingMaterialSections.heading,
      id: supportingMaterialSections.id,
      materialId: supportingMaterialSections.materialId,
      text: supportingMaterialSections.text
    })
    .from(supportingMaterialSections)
    .leftJoin(
      supportingMaterialSectionEmbeddings,
      and(
        eq(supportingMaterialSectionEmbeddings.sectionId, supportingMaterialSections.id),
        eq(supportingMaterialSectionEmbeddings.model, route.model),
        eq(supportingMaterialSectionEmbeddings.inputContract, route.embeddingInputContract)
      )
    )
    .where(
      and(
        gt(supportingMaterialSections.id, selected.afterId),
        options.materialId === undefined ? undefined : eq(supportingMaterialSections.materialId, options.materialId),
        shard(supportingMaterialSections.id, options)
      )
    )
    .orderBy(asc(supportingMaterialSections.id))
    .limit(selected.scanLimit)
  const selection = selectEmbeddingCandidates(records, selected, searchableSectionText)
  return embedSelected(
    client,
    route,
    selection,
    async (embeddedRecords) => {
      const updatedAt = new Date()
      await database
        .insert(supportingMaterialSectionEmbeddings)
        .values(
          embeddedRecords.map(({ candidate, embedding }) => ({
            dimensions: route.dimensions,
            embedding,
            inputContract: route.embeddingInputContract,
            inputHash: candidate.inputHash,
            model: route.model,
            rolloutId: options.rolloutId,
            sectionId: candidate.id
          }))
        )
        .onConflictDoUpdate({
          set: {
            dimensions: route.dimensions,
            embedding: sql`excluded.embedding`,
            inputHash: sql`excluded.input_hash`,
            rolloutId: sql`excluded.rollout_id`,
            updatedAt
          },
          target: [
            supportingMaterialSectionEmbeddings.sectionId,
            supportingMaterialSectionEmbeddings.model,
            supportingMaterialSectionEmbeddings.inputContract
          ]
        })
    },
    selected
  )
}
