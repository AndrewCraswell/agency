import { readFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import { resolve } from "node:path"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { createCivicSearchApiHandler } from "../../api/civic-search.js"
import { generateCoverageReport } from "../../coverage/report.js"
import {
  applyCanonicalFoundationRecord,
  auditCanonicalFoundation,
  canonicalFoundationCheckpointSource,
  importCanonicalFoundationRecords
} from "../../ingestion/canonical-foundation.js"
import {
  applyCanonicalCivicFoundationRecord,
  auditCanonicalCivicFoundation,
  canonicalCivicFoundationCheckpointSource,
  importCanonicalCivicFoundationRecords
} from "../../ingestion/civic-foundation.js"
import { CongressRequestBudgetExhaustedError } from "../../ingestion/congress/request-budget.js"
import { synchronizeCongress } from "../../ingestion/congress/sync.js"
import { ArtifactNotFoundError, type ArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  nextDocumentBackfillAttempt,
  prepareDocumentRemediation,
  processPendingDocuments,
  requeueInterruptedDocuments
} from "../../ingestion/documents/jobs.js"
import { processOcrRequiredDocuments, recoverOwnedOcrDocuments } from "../../ingestion/documents/ocr-jobs.js"
import {
  markDocumentProcessingFailure,
  persistOcrDocument,
  persistProcessedDocument
} from "../../ingestion/documents/process.js"
import { processPendingSupportingMaterials } from "../../ingestion/documents/supporting-material-jobs.js"
import { embedBills, embedDocumentSections, embedSupportingMaterialSections } from "../../ingestion/embeddings/jobs.js"
import { GovInfoClient } from "../../ingestion/govinfo/client.js"
import { importGovInfoPackages } from "../../ingestion/govinfo/import.js"
import { RetryingHttpClient } from "../../ingestion/http-client.js"
import { recoverRetriedIngestionJob, runIngestionJob } from "../../ingestion/job.js"
import { importOpenStatesRecords } from "../../ingestion/openstates/import.js"
import { openStatesBillSchema } from "../../ingestion/openstates/normalize.js"
import { withIngestionRun } from "../../ingestion/run-context.js"
import { LegislationQueryService } from "../../legislation/query-service.js"
import { embeddingRouteFor } from "../../models/embedding-routing.js"
import { encodeSearchCursor, lexicalBillSearch, lexicalPassageSearch, semanticBillSearch } from "../../search/search.js"
import { validateCorpus } from "../../validation/corpus.js"
import { getBillById, upsertBillAggregate, upsertBillAggregates } from "../queries/bill-aggregates.js"
import { linkEventOutcome } from "../queries/event-outcomes.js"
import { upsertEventSnapshots } from "../queries/events.js"
import { isDatabaseAvailable, isDatabaseReady } from "../readiness.js"
import * as schema from "./schema.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = resolve(process.cwd(), "src/db/migrations")
const contentHash = "a".repeat(64)
const billSearchPageSchema = z.object({
  data: z.array(
    z.object({
      match: z.object({
        lexicalScore: z.number(),
        mode: z.literal("lexical"),
        rerankScore: z.null(),
        semanticScore: z.null()
      }),
      rank: z.number().int().positive(),
      record: z.object({ canonicalUrl: z.string().url(), id: z.string(), type: z.literal("bill") }),
      recordId: z.string(),
      recordType: z.literal("bill"),
      score: z.number()
    })
  ),
  links: z.object({ next: z.string().nullable(), self: z.literal("/api/search/bills") }),
  meta: z.object({
    correlationId: z.string().min(1),
    isReranked: z.literal(false),
    limit: z.number().int().positive(),
    mode: z.literal("lexical"),
    models: z.array(z.never()),
    nextCursor: z.string().nullable(),
    truncated: z.boolean(),
    warnings: z.array(z.string())
  })
})
const supportingMaterialSearchPageSchema = z.object({
  data: z.array(
    z.object({
      match: z.object({
        lexicalScore: z.number(),
        matchedFields: z.array(z.enum(["sectionText", "title"])),
        mode: z.literal("lexical"),
        rerankScore: z.null(),
        semanticScore: z.null()
      }),
      rank: z.number().int().positive(),
      record: z.object({
        material: z.object({
          canonicalUrl: z.string().url(),
          id: z.string(),
          sourceUrl: z.string().url(),
          type: z.literal("supporting-material")
        }),
        relatedRecordIds: z.array(z.string()),
        section: z.object({
          canonicalUrl: z.string().url(),
          id: z.string(),
          materialId: z.string(),
          sourceUrl: z.string().url(),
          type: z.literal("supporting-material-section")
        })
      }),
      recordId: z.string(),
      recordType: z.literal("supporting-material"),
      score: z.number()
    })
  ),
  links: z.object({ next: z.string().nullable(), self: z.literal("/api/search/supporting-materials") }),
  meta: z.object({
    correlationId: z.string().min(1),
    isReranked: z.literal(false),
    limit: z.number().int().positive(),
    mode: z.literal("lexical"),
    models: z.array(z.never()),
    nextCursor: z.string().nullable(),
    truncated: z.boolean(),
    warnings: z.array(z.string())
  })
})

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)))
  })
}

if (databaseUrl !== undefined && new URL(databaseUrl).pathname !== "/legislation_test") {
  throw new Error("LEGISLATION_TEST_DATABASE_URL must target the legislation_test database")
}

describePostgres.sequential("legislation PostgreSQL schema", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("installs pgvector and creates each pinned embedding dimension", async () => {
    await expect(isDatabaseAvailable(pool)).resolves.toBe(true)
    await expect(isDatabaseReady(pool)).resolves.toBe(true)

    const result = await pool.query<{ column_type: string; table_name: string }>(
      "select c.relname as table_name, format_type(a.atttypid, a.atttypmod) as column_type from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'legislation' and c.relname in ('bill_embeddings', 'document_section_embeddings', 'amendment_embeddings', 'supporting_material_section_embeddings') and a.attname = 'embedding' order by c.relname"
    )

    expect(result.rows).toEqual([
      { column_type: "vector(1536)", table_name: "amendment_embeddings" },
      { column_type: "vector(1024)", table_name: "bill_embeddings" },
      { column_type: "vector(1536)", table_name: "document_section_embeddings" },
      { column_type: "vector(1024)", table_name: "supporting_material_section_embeddings" }
    ])
  })

  it("enforces and checkpoints the fail-closed jurisdiction and session foundation", async () => {
    const jurisdictionId = "jurisdiction:foundation"
    const incompleteSessionId = "session:foundation:2026"
    const lateSessionId = "session:foundation:late"
    const source = {
      isOfficial: true,
      provider: "official-legislature",
      retrievedAt: "2026-08-24T12:00:00.000Z",
      sourceUpdatedAt: null,
      url: "https://legislature.example.test/foundation"
    }
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Foundation",
      subdivisionCode: "FD"
    })
    await database.insert(schema.legislativeSessions).values({
      id: incompleteSessionId,
      identifier: "2026",
      jurisdictionId,
      name: "Foundation 2026"
    })

    await expect(
      database.insert(schema.jurisdictions).values({
        classification: "state",
        countryCode: "US",
        id: "jurisdiction:invalid-provenance",
        isActive: true,
        name: "Invalid provenance",
        provenanceComplete: true,
        sourceIsOfficial: true,
        sourceProvider: " ",
        sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
        sourceUrl: "https://legislature.example.test/invalid"
      })
    ).rejects.toThrow("jurisdictions_provenance_complete_check")
    await expect(
      database.insert(schema.legislativeSessions).values({
        classification: "regular",
        id: "session:foundation:invalid-provenance",
        identifier: "invalid",
        isActive: true,
        jurisdictionId,
        name: "Invalid provenance",
        provenanceComplete: true,
        sourceIsOfficial: true,
        sourceProvider: "official-legislature",
        sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
        sourceUrl: "http://legislature.example.test/invalid"
      })
    ).rejects.toThrow("legislative_sessions_provenance_complete_check")

    await expect(
      applyCanonicalFoundationRecord(database, {
        id: "jurisdiction:missing",
        isActive: true,
        kind: "jurisdiction",
        source,
        timezone: "America/Los_Angeles"
      })
    ).rejects.toThrow("unknown jurisdiction")
    await expect(importCanonicalFoundationRecords(database, [], { contentHash: "not-a-hash" })).rejects.toThrow(
      "contentHash"
    )

    const resumableRecords = [
      {
        id: jurisdictionId,
        isActive: true,
        kind: "jurisdiction" as const,
        source,
        timezone: "America/Los_Angeles"
      },
      {
        classification: "regular",
        id: lateSessionId,
        isActive: true,
        kind: "session" as const,
        source
      }
    ]
    const first = await importCanonicalFoundationRecords(database, resumableRecords, { contentHash: "a".repeat(64) })
    expect(first).toMatchObject({
      audit: { complete: false, incompleteSessionIds: [incompleteSessionId] },
      checkpoint: { complete: false, index: 1 },
      counts: { failed: 1, updated: 1 },
      failures: [{ identifier: `session:${lateSessionId}` }]
    })
    await expect(
      database.query.syncCheckpoints.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.source, canonicalFoundationCheckpointSource),
            operators.eq(table.stream, "jurisdictions-sessions")
          )
      })
    ).resolves.toMatchObject({ cursor: { complete: false, index: 1 } })

    await database.insert(schema.legislativeSessions).values({
      id: lateSessionId,
      identifier: "late",
      jurisdictionId,
      name: "Foundation late session"
    })
    const resumed = await importCanonicalFoundationRecords(database, resumableRecords, { contentHash: "a".repeat(64) })
    expect(resumed).toMatchObject({
      audit: { complete: false, incompleteSessionIds: [incompleteSessionId] },
      checkpoint: { complete: false, index: 2 },
      counts: { failed: 0, skipped: 1, updated: 1 }
    })

    const completed = await importCanonicalFoundationRecords(
      database,
      [
        resumableRecords[0],
        {
          classification: "regular",
          id: incompleteSessionId,
          isActive: false,
          kind: "session" as const,
          source
        },
        resumableRecords[1]
      ],
      { contentHash: "b".repeat(64) }
    )
    expect(completed).toMatchObject({
      audit: { complete: true, incompleteJurisdictionIds: [], incompleteSessionIds: [] },
      checkpoint: { complete: true, index: 3 },
      counts: { failed: 0, updated: 3 }
    })
    await expect(auditCanonicalFoundation(database)).resolves.toMatchObject({
      complete: true,
      incompleteJurisdictionIds: [],
      incompleteSessionIds: []
    })
  })

  it("enforces and checkpoints civic provenance without resolving provider parent IDs", async () => {
    const jurisdictionId = "jurisdiction:civic-foundation"
    const personId = "person:official:civic-foundation"
    const parentOrganizationId = "organization:official:civic-parent"
    const organizationId = "organization:official:civic-child"
    const termId = `${personId}:term:civic-foundation`
    const membershipId = `${organizationId}:membership:civic-foundation`
    const source = {
      isOfficial: true,
      provider: "official-legislature",
      retrievedAt: "2026-08-24T12:00:00.000Z",
      sourceUpdatedAt: null,
      url: "https://legislature.example.test/civic-foundation"
    }
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Civic foundation",
      subdivisionCode: "CF"
    })
    await database.insert(schema.people).values({ id: personId, jurisdictionId, name: "Civic Person" })
    await database.insert(schema.organizations).values([
      {
        classification: "legislature",
        id: parentOrganizationId,
        jurisdictionId,
        name: "Civic Legislature",
        sourceId: "legislature"
      },
      {
        classification: "committee",
        id: organizationId,
        jurisdictionId,
        name: "Civic Committee",
        sourceId: "committee"
      }
    ])
    await database.insert(schema.legislativeTerms).values({
      chamber: "lower",
      id: termId,
      jurisdictionId,
      personId
    })
    await database.insert(schema.organizationMemberships).values({
      id: membershipId,
      organizationId,
      personId
    })

    await expect(
      applyCanonicalCivicFoundationRecord(database, {
        id: personId,
        isActive: true,
        jurisdictionId: "jurisdiction:other",
        kind: "person",
        name: "Moved Civic Person",
        source
      })
    ).rejects.toThrow("unknown person")
    await expect(
      database
        .select({ jurisdictionId: schema.people.jurisdictionId, name: schema.people.name })
        .from(schema.people)
        .where(eq(schema.people.id, personId))
    ).resolves.toEqual([{ jurisdictionId, name: "Civic Person" }])

    await expect(
      applyCanonicalCivicFoundationRecord(database, {
        chamber: "lower",
        classification: "committee",
        id: organizationId,
        isActive: true,
        jurisdictionId,
        kind: "organization",
        name: "Civic Committee",
        parentOrganizationId: "ocd-organization/not-a-canonical-id",
        source
      })
    ).rejects.toThrow("not authoritative")

    const result = await importCanonicalCivicFoundationRecords(
      database,
      [
        { id: personId, isActive: true, jurisdictionId, kind: "person" as const, name: "Civic Person", source },
        {
          chamber: "legislature" as const,
          classification: "legislature" as const,
          id: parentOrganizationId,
          isActive: true,
          jurisdictionId,
          kind: "organization" as const,
          name: "Civic Legislature",
          parentOrganizationId: null,
          source
        },
        {
          chamber: "lower" as const,
          classification: "committee" as const,
          id: organizationId,
          isActive: true,
          jurisdictionId,
          kind: "organization" as const,
          name: "Civic Committee",
          parentOrganizationId,
          source
        },
        {
          chamber: "lower" as const,
          id: termId,
          isActive: true,
          jurisdictionId,
          kind: "term" as const,
          officeTitle: "Representative",
          organizationId,
          personId,
          source
        },
        {
          id: membershipId,
          isActive: true,
          kind: "membership" as const,
          label: "Committee member",
          organizationId,
          personId,
          role: "member",
          source
        }
      ],
      { contentHash }
    )
    expect(result).toMatchObject({
      audit: {
        complete: true,
        incompleteMembershipIds: [],
        incompleteOrganizationIds: [],
        incompletePersonIds: [],
        incompleteTermIds: []
      },
      checkpoint: { complete: true, index: 5 },
      counts: { failed: 0, updated: 5 }
    })
    await expect(
      database.query.syncCheckpoints.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.source, canonicalCivicFoundationCheckpointSource),
            operators.eq(table.stream, "people-organizations-terms-memberships")
          )
      })
    ).resolves.toMatchObject({ cursor: { complete: true, index: 5 } })
    await expect(auditCanonicalCivicFoundation(database)).resolves.toMatchObject({ complete: true })

    const completeProvenance = {
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "official-legislature",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/civic-foundation"
    }
    await expect(
      database
        .update(schema.people)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.people.id, personId))
    ).rejects.toThrow("people_provenance_complete_check")
    await expect(
      database
        .update(schema.people)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.people.id, personId))
    ).rejects.toThrow("people_provenance_complete_check")
    await expect(
      database
        .update(schema.organizations)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.organizations.id, organizationId))
    ).rejects.toThrow("organizations_provenance_complete_check")
    await expect(
      database
        .update(schema.organizations)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.organizations.id, organizationId))
    ).rejects.toThrow("organizations_provenance_complete_check")
    await expect(
      database
        .update(schema.legislativeTerms)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.legislativeTerms.id, termId))
    ).rejects.toThrow("legislative_terms_provenance_complete_check")
    await expect(
      database
        .update(schema.legislativeTerms)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.legislativeTerms.id, termId))
    ).rejects.toThrow("legislative_terms_provenance_complete_check")
    await expect(
      database
        .update(schema.organizationMemberships)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.organizationMemberships.id, membershipId))
    ).rejects.toThrow("organization_memberships_provenance_complete_check")
    await expect(
      database
        .update(schema.organizationMemberships)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.organizationMemberships.id, membershipId))
    ).rejects.toThrow("organization_memberships_provenance_complete_check")
  })

  it("records a budget handoff as deferred without advancing a generic checkpoint or retaining the lease", async () => {
    const retryAt = new Date("2026-08-18T13:00:00.000Z")
    const result = await runIngestionJob(
      database,
      {
        checkpointStream: "congress:bills:current",
        correlationId: "deferred-budget-test",
        operation: "incremental-sync",
        scope: { identity: "congress:bills:current" },
        scopeKey: "bills:current",
        source: "congress"
      },
      async () => {
        throw new CongressRequestBudgetExhaustedError(retryAt, "allocation_exhausted")
      }
    )

    expect(result).toMatchObject({ deferKind: "allocation_exhausted", failures: [], retryAt, status: "deferred" })
    const persisted = await database
      .select({ scope: schema.ingestionRuns.scope, status: schema.ingestionRuns.status })
      .from(schema.ingestionRuns)
      .where(eq(schema.ingestionRuns.id, result.runId))
    expect(persisted).toEqual([
      {
        scope: {
          identity: "congress:bills:current",
          deferKind: "allocation_exhausted",
          retryAt: retryAt.toISOString(),
          scopeKey: "bills:current"
        },
        status: "deferred"
      }
    ])
    await expect(
      database.select().from(schema.syncCheckpoints).where(eq(schema.syncCheckpoints.stream, "congress:bills:current"))
    ).resolves.toEqual([])
    await expect(
      database.select().from(schema.ingestionLocks).where(eq(schema.ingestionLocks.scopeKey, "bills:current"))
    ).resolves.toEqual([])
  })

  it("persists a canonical bill aggregate and cascades bill-owned records", async () => {
    const jurisdictionId = "jurisdiction:wa"
    const sessionId = "session:wa:2025-2026"
    const billId = "bill:wa:2025-2026:hb:1234"
    const relatedBillId = "bill:wa:2025-2026:sb:5678"
    const personId = "person:openstates:person-1"
    const actionId = `${billId}:action:1`
    const voteId = `${billId}:vote:1`
    const documentId = `${billId}:document:introduced`

    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Washington",
      subdivisionCode: "WA"
    })
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      identifier: "2025-2026",
      jurisdictionId,
      name: "2025-2026 Regular Session"
    })
    await database.insert(schema.bills).values([
      {
        id: billId,
        identifier: "HB 1234",
        jurisdictionId,
        sessionId,
        sourceUrl: "https://example.test/hb-1234",
        title: "An act relating to legislative data"
      },
      {
        id: relatedBillId,
        identifier: "SB 5678",
        jurisdictionId,
        sessionId,
        sourceUrl: "https://example.test/sb-5678",
        title: "A companion act relating to legislative data"
      }
    ])
    await database.insert(schema.people).values({ id: personId, jurisdictionId, name: "Representative Example" })
    await database.insert(schema.billSponsors).values({
      billId,
      classification: "primary",
      id: `${billId}:sponsor:1`,
      isPrimary: true,
      name: "Representative Example",
      personId
    })
    await database.insert(schema.billActions).values({
      billId,
      description: "Introduced in the House",
      id: actionId,
      ordinal: 0
    })
    await database.insert(schema.votes).values({ billId, id: voteId, motion: "Passage", yesCount: 50 })
    await database.insert(schema.votePositions).values({ option: "yes", personId, sourceIdentity: personId, voteId })
    await database.insert(schema.billDocuments).values({
      billId,
      classification: "version",
      id: documentId,
      sourceUrl: "https://example.test/hb-1234/text",
      title: "Introduced bill",
      versionCode: "introduced"
    })
    await database.insert(schema.documentSections).values({
      contentHash,
      documentId,
      id: `${documentId}:section:1`,
      ordinal: 0,
      sectionIdentifier: "1",
      sourceEndOffset: 48,
      sourceStartOffset: 0,
      text: "Section 1. This act concerns legislative data."
    })
    const queryService = new LegislationQueryService(database)
    const documentSectionId = `${documentId}:section:1`
    await expect(queryService.getDocumentSection({ documentId, sectionId: documentSectionId })).resolves.toMatchObject({
      document: { billId, id: documentId },
      section: { documentId, id: documentSectionId }
    })
    await expect(
      queryService.getDocumentSection({ documentId: relatedBillId, sectionId: documentSectionId })
    ).rejects.toMatchObject({ category: "not_found" })
    await database.insert(schema.billRelations).values({
      billId,
      classification: "companion",
      relatedBillId
    })

    await expect(database.select().from(schema.bills).where(eq(schema.bills.id, billId))).resolves.toHaveLength(1)

    await database.delete(schema.bills).where(eq(schema.bills.id, billId))

    await expect(
      database.select().from(schema.billActions).where(eq(schema.billActions.billId, billId))
    ).resolves.toHaveLength(0)
    await expect(
      database.select().from(schema.billDocuments).where(eq(schema.billDocuments.billId, billId))
    ).resolves.toHaveLength(0)
    await expect(database.select().from(schema.bills).where(eq(schema.bills.id, relatedBillId))).resolves.toHaveLength(
      1
    )
  })

  it("rejects a noncanonical bill identifier", async () => {
    const operation = database.insert(schema.bills).values({
      id: "not-canonical",
      identifier: "HB 9999",
      jurisdictionId: "jurisdiction:wa",
      sessionId: "session:wa:2025-2026",
      sourceUrl: "https://example.test/hb-9999",
      title: "An invalid bill"
    })
    const rejection: unknown = await operation.then(
      () => new Error("Expected the bill identifier constraint to reject the insert"),
      (error: unknown) => error
    )

    expect(rejection).toMatchObject({ cause: { code: "23514", constraint: "bills_id_check" } })
  })

  it("discovers canonical people and organizations with bounded filters", async () => {
    const organizationId = "organization:openstates:wa-data-committee"
    await database.insert(schema.organizations).values({
      classification: "committee",
      id: organizationId,
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      name: "House Data Committee",
      sourceId: "wa-data-committee"
    })
    await database.insert(schema.organizationMemberships).values({
      id: `${organizationId}:person:person-1`,
      organizationId,
      personId: "person:openstates:person-1",
      title: "member"
    })
    const service = new LegislationQueryService(database)

    await expect(
      service.searchPeople({ jurisdictionId: "jurisdiction:wa", organizationId, query: "Example" })
    ).resolves.toMatchObject({
      items: [{ id: "person:openstates:person-1", name: "Representative Example" }],
      truncated: false
    })
    await expect(
      service.searchOrganizations({ classification: "committee", jurisdictionId: "jurisdiction:wa", query: "Data" })
    ).resolves.toMatchObject({ items: [{ id: organizationId }], truncated: false })
    await expect(service.searchPeople({ jurisdictionId: "jurisdiction:unavailable" })).resolves.toMatchObject({
      items: [],
      warnings: [expect.stringContaining("source-dependent")]
    })
  })

  it("upserts aggregates idempotently and rolls back a failed child replacement", async () => {
    const billId = "bill:wa:2025-2026:hb:2468"
    const actionId = `${billId}:action:1`
    const aggregate = {
      actions: [{ billId, description: "Introduced", id: actionId, ordinal: 0 }],
      bill: {
        id: billId,
        identifier: "HB 2468",
        jurisdictionId: "jurisdiction:wa",
        sessionId: "session:wa:2025-2026",
        sourceUrl: "https://example.test/hb-2468",
        title: "A stable aggregate"
      },
      jurisdiction: {
        classification: "state",
        countryCode: "US",
        id: "jurisdiction:wa",
        name: "Washington",
        subdivisionCode: "WA"
      },
      session: {
        id: "session:wa:2025-2026",
        identifier: "2025-2026",
        jurisdictionId: "jurisdiction:wa",
        name: "2025-2026 Regular Session"
      }
    }

    await upsertBillAggregate(database, aggregate)
    await upsertBillAggregate(database, aggregate)

    await expect(
      database.select().from(schema.billActions).where(eq(schema.billActions.billId, billId))
    ).resolves.toHaveLength(1)
    await expect(getBillById(database, billId)).resolves.toMatchObject({ title: "A stable aggregate" })

    await expect(
      upsertBillAggregate(database, {
        ...aggregate,
        actions: [{ billId, description: "Invalid action", id: actionId, ordinal: -1 }],
        bill: { ...aggregate.bill, title: "This update must roll back" }
      })
    ).rejects.toMatchObject({ cause: { code: "23514", constraint: "bill_actions_ordinal_check" } })
    await expect(getBillById(database, billId)).resolves.toMatchObject({ title: "A stable aggregate" })
  })

  it("preserves and advances sponsor observation bounds across aggregate refreshes", async () => {
    const billId = "bill:wa:2025-2026:hb:2469"
    const sponsorId = `${billId}:sponsor:example`
    const aggregate = {
      bill: {
        id: billId,
        identifier: "HB 2469",
        jurisdictionId: "jurisdiction:wa",
        sessionId: "session:wa:2025-2026",
        sourceUrl: "https://example.test/hb-2469",
        title: "An observed sponsor relationship"
      },
      jurisdiction: {
        classification: "state",
        countryCode: "US",
        id: "jurisdiction:wa",
        name: "Washington",
        subdivisionCode: "WA"
      },
      people: [{ id: "person:wa:example", jurisdictionId: "jurisdiction:wa", name: "Representative Example" }],
      session: {
        id: "session:wa:2025-2026",
        identifier: "2025-2026",
        jurisdictionId: "jurisdiction:wa",
        name: "2025-2026 Regular Session"
      },
      sponsors: [
        {
          billId,
          classification: "primary",
          id: sponsorId,
          isPrimary: true,
          name: "Representative Example",
          personId: "person:wa:example"
        }
      ]
    }

    await upsertBillAggregate(database, aggregate)
    const first = await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsorId) })
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5))
    await upsertBillAggregate(database, aggregate)
    const refreshed = await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsorId) })

    if (
      first === undefined ||
      refreshed === undefined ||
      first.latestObservedAt === null ||
      refreshed.latestObservedAt === null
    ) {
      throw new Error("Expected sponsor observation to persist")
    }
    expect(first.firstObservedAt).toEqual(refreshed.firstObservedAt)
    expect(refreshed.latestObservedAt.getTime()).toBeGreaterThan(first.latestObservedAt.getTime())

    await upsertBillAggregate(database, { ...aggregate, sponsors: [] })
    await expect(
      database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsorId) })
    ).resolves.toBeUndefined()
  })

  it("preserves sponsor observation bounds during batch aggregate refreshes", async () => {
    const billId = "bill:wa:2025-2026:hb:2470"
    const sponsorId = `${billId}:sponsor:example`
    const aggregate = {
      bill: {
        id: billId,
        identifier: "HB 2470",
        jurisdictionId: "jurisdiction:wa",
        sessionId: "session:wa:2025-2026",
        sourceUrl: "https://example.test/hb-2470",
        title: "An observed batch sponsor relationship"
      },
      jurisdiction: {
        classification: "state",
        countryCode: "US",
        id: "jurisdiction:wa",
        name: "Washington",
        subdivisionCode: "WA"
      },
      people: [{ id: "person:wa:batch-example", jurisdictionId: "jurisdiction:wa", name: "Representative Batch" }],
      session: {
        id: "session:wa:2025-2026",
        identifier: "2025-2026",
        jurisdictionId: "jurisdiction:wa",
        name: "2025-2026 Regular Session"
      },
      sponsors: [
        {
          billId,
          classification: "primary",
          id: sponsorId,
          isPrimary: true,
          name: "Representative Batch",
          personId: "person:wa:batch-example"
        }
      ]
    }

    await upsertBillAggregates(database, [aggregate])
    const first = await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsorId) })
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5))
    await upsertBillAggregates(database, [aggregate])
    const refreshed = await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsorId) })

    if (
      first === undefined ||
      refreshed === undefined ||
      first.latestObservedAt === null ||
      refreshed.latestObservedAt === null
    ) {
      throw new Error("Expected batch sponsor observation to persist")
    }
    expect(first.firstObservedAt).toEqual(refreshed.firstObservedAt)
    expect(refreshed.latestObservedAt.getTime()).toBeGreaterThan(first.latestObservedAt.getTime())

    await upsertBillAggregates(database, [{ ...aggregate, sponsors: [] }])
    await expect(
      database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsorId) })
    ).resolves.toBeUndefined()
  })

  it("merges federal provenance and preserves GovInfo documents during a Congress.gov update", async () => {
    const billId = "bill:us:119:hr:1234"
    const base = {
      bill: {
        id: billId,
        identifier: "HR 1234",
        jurisdictionId: "jurisdiction:us",
        sessionId: "session:us:119",
        sourceUrl: "https://www.govinfo.gov/example",
        title: "Federal data access",
        upstreamIds: { govinfo: "BILLSTATUS-119hr1234" }
      },
      jurisdiction: { classification: "country", countryCode: "US", id: "jurisdiction:us", name: "United States" },
      session: { id: "session:us:119", identifier: "119", jurisdictionId: "jurisdiction:us", name: "119th Congress" }
    }
    const documentId = `${billId}:document:introduced`

    await upsertBillAggregate(database, {
      ...base,
      documents: [
        {
          document: {
            billId,
            classification: "version",
            id: documentId,
            sourceUrl: "https://www.govinfo.gov/example.xml",
            title: "Introduced",
            versionCode: "ih"
          }
        }
      ]
    })
    await database
      .update(schema.billDocuments)
      .set({
        blobPath: "govinfo/introduced/source.xml",
        contentHash,
        processingAttempts: 1,
        processingStatus: "processed",
        text: "Existing official text"
      })
      .where(eq(schema.billDocuments.id, documentId))
    await database.insert(schema.documentSections).values({
      contentHash,
      documentId,
      id: `${documentId}:section:preserved`,
      ordinal: 0,
      sourceEndOffset: 22,
      sourceStartOffset: 0,
      text: "Existing official text"
    })
    await upsertBillAggregate(database, {
      ...base,
      bill: {
        ...base.bill,
        sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1234",
        title: "Federal data access, updated",
        upstreamIds: { congress: "119-hr-1234" }
      },
      documents: [
        {
          document: {
            billId,
            classification: "version",
            id: documentId,
            sourceUrl: "https://www.govinfo.gov/example.xml",
            title: "Introduced, refreshed metadata",
            versionCode: "ih"
          }
        }
      ]
    })

    await expect(getBillById(database, billId)).resolves.toMatchObject({
      title: "Federal data access, updated",
      upstreamIds: { congress: "119-hr-1234", govinfo: "BILLSTATUS-119hr1234" }
    })
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    ).resolves.toMatchObject({
      blobPath: "govinfo/introduced/source.xml",
      processingAttempts: 1,
      processingStatus: "processed",
      text: "Existing official text",
      title: "Introduced, refreshed metadata"
    })
    await expect(
      database.select().from(schema.documentSections).where(eq(schema.documentSections.documentId, documentId))
    ).resolves.toHaveLength(1)
  })

  it("does not rewrite unchanged jurisdiction and session parents during bulk upserts", async () => {
    const aggregate = {
      bill: {
        id: "bill:or:2025:hb:9001",
        identifier: "HB 9001",
        jurisdictionId: "jurisdiction:or",
        sessionId: "session:or:2025",
        sourceUrl: "https://example.test/or/hb-9001",
        title: "A stable bulk aggregate"
      },
      jurisdiction: {
        classification: "state",
        countryCode: "US",
        id: "jurisdiction:or",
        name: "Oregon",
        subdivisionCode: "OR"
      },
      session: {
        id: "session:or:2025",
        identifier: "2025",
        jurisdictionId: "jurisdiction:or",
        name: "2025 Regular Session"
      }
    }

    await upsertBillAggregates(database, [aggregate])
    const initialJurisdiction = await database.query.jurisdictions.findFirst({
      where: eq(schema.jurisdictions.id, aggregate.jurisdiction.id)
    })
    const initialSession = await database.query.legislativeSessions.findFirst({
      where: eq(schema.legislativeSessions.id, aggregate.session.id)
    })
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5))
    await upsertBillAggregates(database, [aggregate])
    const unchangedJurisdiction = await database.query.jurisdictions.findFirst({
      where: eq(schema.jurisdictions.id, aggregate.jurisdiction.id)
    })
    const unchangedSession = await database.query.legislativeSessions.findFirst({
      where: eq(schema.legislativeSessions.id, aggregate.session.id)
    })

    expect(unchangedJurisdiction?.updatedAt).toEqual(initialJurisdiction?.updatedAt)
    expect(unchangedSession?.updatedAt).toEqual(initialSession?.updatedAt)
  })

  it("atomically persists document sections and skips unchanged content", async () => {
    const documentId = "bill:us:119:hr:1234:document:introduced"
    const bytes = new TextEncoder().encode(
      "SECTION 1. SHORT TITLE.\nThis Act may be cited.\n\nSEC. 2. DATA.\nData shall be open."
    )

    await expect(persistProcessedDocument(database, { bytes, contentType: "text/plain", documentId })).resolves.toBe(
      "processed"
    )
    await expect(persistProcessedDocument(database, { bytes, contentType: "text/plain", documentId })).resolves.toBe(
      "unchanged"
    )
    await expect(
      database.select().from(schema.documentSections).where(eq(schema.documentSections.documentId, documentId))
    ).resolves.toHaveLength(2)

    await expect(
      lexicalBillSearch(database, { jurisdictionIds: ["jurisdiction:us"], query: '"Federal data"' })
    ).resolves.toMatchObject({ items: [{ id: "bill:us:119:hr:1234" }] })
    await expect(lexicalPassageSearch(database, { query: '"data shall be open"' })).resolves.toMatchObject({
      items: [{ billId: "bill:us:119:hr:1234", documentId }]
    })

    const billRoute = embeddingRouteFor("bill")
    const sectionRoute = embeddingRouteFor("document-section")
    const billEmbedding = Array.from({ length: billRoute.dimensions }, () => 0.1)
    const sectionEmbedding = Array.from({ length: sectionRoute.dimensions }, () => 0.1)
    const billEmbeddingClient = {
      embed: async (input: string[]) => ({ embeddings: input.map(() => billEmbedding), model: billRoute.model })
    }
    const sectionEmbeddingClient = {
      embed: async (input: string[]) => ({ embeddings: input.map(() => sectionEmbedding), model: sectionRoute.model })
    }
    await expect(
      embedBills(database, billEmbeddingClient, { billId: "bill:us:119:hr:1234", rolloutId: "test" })
    ).resolves.toEqual({
      embedded: 1,
      skipped: 0
    })
    await expect(
      embedDocumentSections(database, sectionEmbeddingClient, { documentId, rolloutId: "test" })
    ).resolves.toEqual({
      embedded: 2,
      skipped: 0
    })
    await expect(
      embedDocumentSections(database, sectionEmbeddingClient, { documentId, rolloutId: "test" })
    ).resolves.toEqual({
      embedded: 0,
      skipped: 2
    })
    await expect(semanticBillSearch(database, { embedding: billEmbedding })).resolves.toMatchObject({
      items: [{ id: "bill:us:119:hr:1234" }]
    })

    const secondDocumentId = "bill:us:119:hr:1234:document:reported"
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "version",
      id: secondDocumentId,
      sourceUrl: "https://www.govinfo.gov/example-reported.xml",
      title: "Reported",
      versionCode: "rh"
    })
    await persistProcessedDocument(database, {
      bytes: new TextEncoder().encode(
        "SECTION 1. SHORT TITLE.\nThis Act may be cited as the Updated Act.\n\nSEC. 2. DATA.\nData shall be open."
      ),
      contentType: "text/plain",
      documentId: secondDocumentId
    })
    await database.insert(schema.billRelations).values({
      billId: "bill:us:119:hr:1234",
      classification: "related",
      relatedBillId: "bill:wa:2025-2026:sb:5678"
    })
    await database.insert(schema.amendments).values({
      amendmentNumber: "1",
      amendmentType: "House amendment",
      billId: "bill:us:119:hr:1234",
      id: "amendment:us:119:hamdt:1",
      jurisdictionId: "jurisdiction:us",
      printedIdentifier: "H.Amdt. 1",
      sourceId: "congress:119:hamdt:1",
      sourceUrl: "https://www.congress.gov/amendment/119th-congress/house-amendment/1"
    })
    const stateAmendmentDocumentId = "bill:wa:2025-2026:sb:5678:document:floor-amendment"
    await database.insert(schema.billDocuments).values({
      billId: "bill:wa:2025-2026:sb:5678",
      classification: "amendment",
      documentDate: "2025-02-14",
      id: stateAmendmentDocumentId,
      sourceUrl: "https://leg.wa.gov/amendments/sb5678-floor.pdf",
      title: "Floor amendment 001"
    })
    await database.insert(schema.votes).values({
      billId: "bill:us:119:hr:1234",
      id: "vote:congress:119:house:1",
      motion: "On passage",
      noCount: 1,
      yesCount: 1
    })
    await database.insert(schema.votePositions).values({
      option: "yes",
      sourceIdentity: "congress:member:a000001",
      sourceName: "Representative Example",
      sourcePersonId: "A000001",
      voteId: "vote:congress:119:house:1"
    })

    const retrievalClient = {
      embed: async () => ({ embeddings: [billEmbedding], model: billRoute.model }),
      rerank: async (_tool: string, _query: string, candidates: Array<{ id: string; text: string }>) =>
        candidates.map((candidate, index) => ({ ...candidate, relevanceScore: 1 - index / 100 }))
    }
    const service = new LegislationQueryService(database, retrievalClient)
    await expect(service.searchBills({ mode: "lexical", query: "Federal data" })).resolves.toMatchObject({
      items: [{ id: "bill:us:119:hr:1234" }]
    })
    await expect(service.getBill({ id: "bill:us:119:hr:1234" })).resolves.toMatchObject({
      amendments: [{ id: "amendment:us:119:hamdt:1", recordType: "structured" }],
      bill: { id: "bill:us:119:hr:1234" },
      truncated: false
    })
    await expect(service.searchAmendments({ billId: "bill:wa:2025-2026:sb:5678" })).resolves.toMatchObject({
      items: [
        {
          billId: "bill:wa:2025-2026:sb:5678",
          documentId: stateAmendmentDocumentId,
          id: `amendment:document:${stateAmendmentDocumentId}`,
          recordType: "document"
        }
      ],
      truncated: false
    })
    await expect(service.getBill({ id: "bill:wa:2025-2026:sb:5678" })).resolves.toMatchObject({
      amendments: [{ documentId: stateAmendmentDocumentId, recordType: "document" }]
    })
    await expect(service.getAmendment({ id: `amendment:document:${stateAmendmentDocumentId}` })).resolves.toMatchObject(
      {
        actions: [],
        amendment: { documentId: stateAmendmentDocumentId, recordType: "document" },
        document: { id: stateAmendmentDocumentId },
        materials: [],
        votes: []
      }
    )
    await expect(service.getBillTimeline({ id: "bill:us:119:hr:1234" })).resolves.toMatchObject({
      billId: "bill:us:119:hr:1234"
    })
    await expect(service.getBillVotes({ billId: "bill:us:119:hr:1234" })).resolves.toMatchObject({
      items: [
        {
          positions: [
            {
              person: null,
              position: { option: "yes", sourceName: "Representative Example", sourcePersonId: "A000001" }
            }
          ],
          vote: { id: "vote:congress:119:house:1" }
        }
      ],
      truncated: false
    })
    await expect(
      service.searchBillText({ billIds: ["bill:us:119:hr:1234"], query: '"data shall be open"' })
    ).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ bill: { id: "bill:us:119:hr:1234" } })])
    })
    await expect(service.getBillText({ id: "bill:us:119:hr:1234", versionCode: "ih" })).resolves.toMatchObject({
      document: { id: documentId },
      sections: expect.any(Array)
    })
    await expect(
      service.compareBillVersions({ billId: "bill:us:119:hr:1234", documentIds: [documentId, secondDocumentId] })
    ).resolves.toMatchObject({
      changes: expect.arrayContaining([expect.objectContaining({ classification: "changed" })])
    })
    await expect(service.findRelatedBills({ id: "bill:us:119:hr:1234" })).resolves.toMatchObject({
      items: [{ bill: { id: "bill:wa:2025-2026:sb:5678" }, classification: "related" }]
    })
    await expect(service.findRelatedBills({ id: "bill:wa:2025-2026:sb:5678" })).resolves.toMatchObject({
      items: [{ bill: { id: "bill:us:119:hr:1234" }, classification: "related" }]
    })
  })

  it("serves bounded, filter-bound lexical bill pages from canonical database records", async () => {
    const jurisdictionId = "jurisdiction:search"
    const sessionId = "session:search:2026"
    const query = "bounded public budget allocation"
    const candidateId = (index: number) => `bill:search:2026:ab:${index.toString().padStart(4, "0")}`
    const request = {
      jurisdictionIds: [jurisdictionId],
      query,
      statuses: ["introduced"],
      subjects: ["budget"]
    }

    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Search integration",
      subdivisionCode: "SI"
    })
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      identifier: "2026",
      jurisdictionId,
      name: "Search integration 2026"
    })
    await pool.query(
      `insert into legislation.bills (
        id, jurisdiction_id, session_id, identifier, title, classification, status, subjects, source_url, search_vector
      )
      select
        'bill:search:2026:ab:' || lpad(candidate.index::text, 4, '0'),
        $1,
        $2,
        'AB ' || candidate.index::text,
        'Bounded public budget allocation',
        array['bill']::text[],
        'introduced',
        array['budget']::text[],
        'https://source.example.test/search/' || candidate.index::text,
        to_tsvector('english', 'Bounded public budget allocation')
      from generate_series(0, 1000) as candidate(index)`,
      [jurisdictionId, sessionId]
    )
    await pool.query(
      `insert into legislation.bills (
        id, jurisdiction_id, session_id, identifier, title, classification, status, subjects, source_url, search_vector
      ) values (
        'bill:search:2026:ab:excluded',
        $1,
        $2,
        'AB excluded',
        'Bounded public budget allocation',
        array['bill']::text[],
        'withdrawn',
        array['budget']::text[],
        'https://source.example.test/search/excluded',
        to_tsvector('english', 'Bounded public budget allocation')
      )`,
      [jurisdictionId, sessionId]
    )

    const handler = createCivicSearchApiHandler(new LegislationQueryService(database), {
      apiBaseUrl: "https://api.example.test"
    })
    const server = createServer(async (requestMessage, response) => {
      if (!(await handler(requestMessage, response))) {
        response.writeHead(404)
        response.end()
      }
    })
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen))
    const address = server.address()
    if (address === null || typeof address === "string") {
      await closeServer(server)
      throw new Error("Expected a TCP server address")
    }
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const firstResponse = await fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ ...request, limit: 2 }),
        headers: { "content-type": "application/json", "x-correlation-id": "search-db-integration" },
        method: "POST"
      })
      expect(firstResponse.status).toBe(200)
      const firstPage = billSearchPageSchema.parse(await firstResponse.json())
      const firstCursor = encodeSearchCursor(2, request)
      expect(firstPage).toMatchObject({
        data: [
          { rank: 1, record: { id: candidateId(0), type: "bill" }, recordId: candidateId(0) },
          { rank: 2, record: { id: candidateId(1), type: "bill" }, recordId: candidateId(1) }
        ],
        links: { next: `/api/search/bills?cursor=${firstCursor}`, self: "/api/search/bills" },
        meta: {
          correlationId: "search-db-integration",
          isReranked: false,
          limit: 2,
          mode: "lexical",
          models: [],
          nextCursor: firstCursor,
          truncated: true,
          warnings: []
        }
      })
      expect(firstPage.data.map((item) => item.score)).toEqual(firstPage.data.map((item) => item.match.lexicalScore))

      const secondResponse = await fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ ...request, cursor: firstCursor, limit: 2 }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(secondResponse.status).toBe(200)
      expect(billSearchPageSchema.parse(await secondResponse.json()).data).toMatchObject([
        { rank: 3, recordId: candidateId(2) },
        { rank: 4, recordId: candidateId(3) }
      ])

      const boundaryCursor = encodeSearchCursor(900, request)
      const boundaryResponse = await fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ ...request, cursor: boundaryCursor, limit: 100 }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(boundaryResponse.status).toBe(200)
      const boundaryPage = billSearchPageSchema.parse(await boundaryResponse.json())
      expect(boundaryPage.data.map((item) => item.recordId)).toEqual(
        Array.from({ length: 100 }, (_, index) => candidateId(index + 900))
      )
      expect(boundaryPage.data.map((item) => item.rank)).toEqual(Array.from({ length: 100 }, (_, index) => index + 901))
      expect(boundaryPage).toMatchObject({
        links: { next: null },
        meta: { nextCursor: null, truncated: true }
      })

      const changedFilterResponse = await fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ ...request, cursor: boundaryCursor, statuses: ["withdrawn"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(changedFilterResponse.status).toBe(400)

      const filteredResponse = await fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ ...request, limit: 5, statuses: ["withdrawn"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(filteredResponse.status).toBe(200)
      const filteredPage = billSearchPageSchema.parse(await filteredResponse.json())
      expect(filteredPage.data.map((item) => item.recordId)).toEqual(["bill:search:2026:ab:excluded"])
      expect(filteredPage).toMatchObject({ links: { next: null }, meta: { nextCursor: null, truncated: false } })
    } finally {
      await closeServer(server)
    }
  })

  it("serves bounded, filter-bound lexical supporting-material pages from canonical database records", async () => {
    const jurisdictionId = "jurisdiction:material-search"
    const sessionId = "session:material-search:2026"
    const organizationId = "organization:material-search:committee"
    const billId = "bill:material-search:2026:hb:1"
    const amendmentId = "amendment:material-search:2026:hb:1:a"
    const eventId = "event:material-search:2026:committee:1"
    const query = "public data"
    const candidateId = (index: number) =>
      `material:material-search:2026:committee-report:${(index + 1_000).toString().padStart(4, "0")}`
    const request = {
      amendmentIds: [amendmentId],
      billIds: [billId],
      classifications: ["committee-report"],
      documentFrom: "2026-03-15",
      documentTo: "2026-03-15",
      from: "2026-03-15",
      jurisdictionIds: [jurisdictionId],
      meetingIds: [eventId],
      organizationIds: [organizationId],
      query,
      sessionIds: [sessionId],
      to: "2026-03-15"
    }

    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Material search integration",
      subdivisionCode: "MS"
    })
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      identifier: "2026",
      jurisdictionId,
      name: "Material search integration 2026"
    })
    await database.insert(schema.organizations).values({
      classification: "committee",
      id: organizationId,
      jurisdictionId,
      name: "Material search committee",
      sourceId: "material-search-committee"
    })
    await database.insert(schema.bills).values({
      id: billId,
      identifier: "HB 1",
      jurisdictionId,
      sessionId,
      sourceUrl: "https://source.example.test/material-search/bills/1",
      title: "Material search bill"
    })
    await database.insert(schema.amendments).values({
      amendmentNumber: "A",
      amendmentType: "committee",
      billId,
      id: amendmentId,
      jurisdictionId,
      printedIdentifier: "H.Amdt. 1",
      sourceId: "material-search-amendment",
      sourceUrl: "https://source.example.test/material-search/amendments/1"
    })
    await database.insert(schema.legislativeEvents).values({
      id: eventId,
      jurisdictionId,
      name: "Material search hearing",
      sourceId: "material-search-event",
      startAt: new Date("2026-03-15T17:00:00.000Z"),
      status: "scheduled"
    })
    await pool.query(
      `insert into legislation.supporting_materials (
        id, jurisdiction_id, source_id, classification, title, document_date, source_url, processing_status, updated_at
      )
      select
        'material:material-search:2026:committee-report:' || lpad((candidate.index + 1000)::text, 4, '0'),
        $1,
        'material-search-' || candidate.index::text,
        'committee-report',
        'Evidence record ' || candidate.index::text,
        '2026-03-15',
        'https://source.example.test/material-search/materials/' || candidate.index::text,
        'processed',
        '2026-03-15T12:00:00.000Z'::timestamptz
      from generate_series(0, 250) as candidate(index)`,
      [jurisdictionId]
    )
    await pool.query(
      `insert into legislation.supporting_material_sections (
        id, material_id, ordinal, source_start_offset, source_end_offset, text, content_hash
      )
      select
        'material-section:material-search:' || candidate.index::text,
        'material:material-search:2026:committee-report:' || lpad((candidate.index + 1000)::text, 4, '0'),
        0,
        0,
        28,
        'Public data access evidence.',
        repeat('b', 64)
      from generate_series(0, 250) as candidate(index)`,
      []
    )
    await pool.query(
      `insert into legislation.supporting_material_links (
        material_id, bill_id, amendment_id, event_id, organization_id, classification
      )
      select
        'material:material-search:2026:committee-report:' || lpad((candidate.index + 1000)::text, 4, '0'),
        $1,
        $2,
        $3,
        $4,
        'related'
      from generate_series(0, 250) as candidate(index)`,
      [billId, amendmentId, eventId, organizationId]
    )
    await database.insert(schema.supportingMaterials).values({
      classification: "testimony",
      documentDate: "2026-03-15",
      id: "material:material-search:2026:committee-report:0000",
      jurisdictionId,
      processingStatus: "processed",
      sourceId: "material-search-excluded",
      sourceUrl: "https://source.example.test/material-search/materials/excluded",
      title: "Excluded evidence",
      updatedAt: new Date("2026-03-15T12:00:00.000Z")
    })
    await database.insert(schema.supportingMaterialSections).values({
      contentHash: "b".repeat(64),
      id: "material-section:material-search:excluded",
      materialId: "material:material-search:2026:committee-report:0000",
      ordinal: 0,
      sourceEndOffset: 28,
      sourceStartOffset: 0,
      text: "Public data access evidence."
    })
    await database.insert(schema.supportingMaterialLinks).values({
      amendmentId,
      billId,
      classification: "related",
      eventId,
      materialId: "material:material-search:2026:committee-report:0000",
      organizationId
    })

    const handler = createCivicSearchApiHandler(new LegislationQueryService(database), {
      apiBaseUrl: "https://api.example.test"
    })
    const server = createServer(async (requestMessage, response) => {
      if (!(await handler(requestMessage, response))) {
        response.writeHead(404)
        response.end()
      }
    })
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen))
    const address = server.address()
    if (address === null || typeof address === "string") {
      await closeServer(server)
      throw new Error("Expected a TCP server address")
    }
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const firstResponse = await fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ ...request, limit: 100 }),
        headers: { "content-type": "application/json", "x-correlation-id": "material-search-db-integration" },
        method: "POST"
      })
      expect(firstResponse.status).toBe(200)
      const firstPage = supportingMaterialSearchPageSchema.parse(await firstResponse.json())
      const firstCursor = firstPage.meta.nextCursor
      if (firstCursor === null) {
        throw new Error("Expected a cursor for the first bounded material search page")
      }
      expect(firstPage.data.map((item) => item.recordId)).toEqual(
        Array.from({ length: 100 }, (_, index) => candidateId(index))
      )
      expect(firstPage.data.map((item) => item.rank)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
      expect(firstPage).toMatchObject({
        links: { next: `/api/search/supporting-materials?cursor=${firstCursor}` },
        meta: {
          correlationId: "material-search-db-integration",
          isReranked: false,
          limit: 100,
          mode: "lexical",
          models: [],
          nextCursor: firstCursor,
          truncated: true,
          warnings: []
        }
      })
      const firstHit = firstPage.data[0]
      if (firstHit === undefined) {
        throw new Error("Expected a material search hit")
      }
      expect(firstHit).toMatchObject({
        match: { lexicalScore: firstHit.score, matchedFields: ["sectionText"], mode: "lexical" },
        record: {
          material: {
            canonicalUrl: `https://api.example.test/api/supporting-materials/${encodeURIComponent(candidateId(0))}`,
            id: candidateId(0),
            sourceUrl: "https://source.example.test/material-search/materials/0"
          },
          relatedRecordIds: [amendmentId, billId, eventId, organizationId].sort(),
          section: {
            canonicalUrl:
              "https://api.example.test/api/supporting-materials/material%3Amaterial-search%3A2026%3Acommittee-report%3A1000/sections/material-section%3Amaterial-search%3A0",
            id: "material-section:material-search:0",
            materialId: candidateId(0),
            sourceUrl: "https://source.example.test/material-search/materials/0"
          }
        },
        recordId: candidateId(0),
        recordType: "supporting-material"
      })

      const secondResponse = await fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ ...request, cursor: firstCursor, limit: 100 }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(secondResponse.status).toBe(200)
      const secondPage = supportingMaterialSearchPageSchema.parse(await secondResponse.json())
      expect(secondPage.data.map((item) => item.recordId)).toEqual(
        Array.from({ length: 100 }, (_, index) => candidateId(index + 100))
      )
      expect(secondPage.data.map((item) => item.rank)).toEqual(Array.from({ length: 100 }, (_, index) => index + 101))
      const secondCursor = secondPage.meta.nextCursor
      if (secondCursor === null) {
        throw new Error("Expected a cursor for the second bounded material search page")
      }

      const thirdResponse = await fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ ...request, cursor: secondCursor, limit: 100 }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(thirdResponse.status).toBe(200)
      const thirdPage = supportingMaterialSearchPageSchema.parse(await thirdResponse.json())
      expect(thirdPage.data.map((item) => item.recordId)).toEqual(
        Array.from({ length: 50 }, (_, index) => candidateId(index + 200))
      )
      expect(thirdPage.data.map((item) => item.rank)).toEqual(Array.from({ length: 50 }, (_, index) => index + 201))
      expect(thirdPage).toMatchObject({ links: { next: null }, meta: { nextCursor: null, truncated: true } })

      const changedFilterResponse = await fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ ...request, classifications: ["testimony"], cursor: firstCursor, limit: 100 }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(changedFilterResponse.status).toBe(400)
    } finally {
      await closeServer(server)
    }
  })

  it("persists only source-backed OCR status and page ranges", async () => {
    const documentId = "bill:us:119:hr:1234:document:ocr-page-mapping"
    const sourceText = "SECTION 1. TITLE.\nFirst page text.\nSECTION 2. DATA.\nSecond page text."
    const secondPageStart = sourceText.indexOf("SECTION 2")
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "version",
      id: documentId,
      sourceUrl: "https://example.test/ocr-page-mapping.pdf",
      title: "OCR page mapping"
    })

    await persistOcrDocument(database, {
      blobPath: "documents/ocr-page-mapping.pdf",
      contentType: "application/pdf",
      documentId,
      pageCount: 2,
      pages: [
        { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ],
      provider: "azure-document-intelligence",
      sourceBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      text: sourceText
    })

    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    ).resolves.toMatchObject({
      ocrPageCount: 2,
      ocrProvider: "azure-document-intelligence",
      ocrStatus: "processed",
      processingStatus: "processed"
    })
    await expect(
      database
        .select({ pageEnd: schema.documentSections.pageEnd, pageStart: schema.documentSections.pageStart })
        .from(schema.documentSections)
        .where(eq(schema.documentSections.documentId, documentId))
        .orderBy(schema.documentSections.ordinal)
    ).resolves.toEqual([
      { pageEnd: 1, pageStart: 1 },
      { pageEnd: 2, pageStart: 2 }
    ])
    await expect(
      database.insert(schema.documentSections).values({
        contentHash,
        documentId,
        id: `${documentId}:invalid-page-range`,
        ordinal: 9,
        pageStart: 1,
        sourceEndOffset: 1,
        sourceStartOffset: 0,
        text: "x"
      })
    ).rejects.toThrow(/document_sections_page_range_check/)
  })

  it("clears successful OCR metadata across every non-processed lifecycle state", async () => {
    const documentId = "bill:us:119:hr:1234:document:ocr-lifecycle"
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "version",
      id: documentId,
      sourceUrl: "https://example.test/ocr-lifecycle.pdf",
      title: "OCR lifecycle"
    })
    await expect(
      database
        .update(schema.billDocuments)
        .set({ ocrProvider: "azure-document-intelligence" })
        .where(eq(schema.billDocuments.id, documentId))
    ).rejects.toThrow(/bill_documents_ocr_metadata_status_check/)
    await persistOcrDocument(database, {
      blobPath: "documents/ocr-lifecycle.pdf",
      contentType: "application/pdf",
      documentId,
      pageCount: 1,
      pages: [{ endOffset: 34, pageNumber: 1, startOffset: 0 }],
      provider: "azure-document-intelligence",
      sourceBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      text: "SECTION 1. TITLE.\nRecognized text."
    })

    const expectCleared = async (ocrStatus: string | null) => {
      await expect(
        database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
      ).resolves.toMatchObject({
        ocrCompletedAt: null,
        ocrPageCount: null,
        ocrProvider: null,
        ocrStatus
      })
    }

    await markDocumentProcessingFailure(database, documentId, {
      category: "download-transient",
      processingError: "publisher unavailable",
      status: "failed"
    })
    // A generic publisher/download failure is not an OCR failure.
    await expectCleared(null)

    await markDocumentProcessingFailure(database, documentId, {
      category: "ocr-required",
      processingError: "requires OCR",
      status: "unsupported"
    })
    await expectCleared("pending")

    await markDocumentProcessingFailure(database, documentId, {
      category: "unsupported-format",
      processingError: "format cannot be read",
      status: "unsupported"
    })
    await expectCleared("unsupported")

    await database
      .update(schema.billDocuments)
      .set({
        ocrStatus: "processing",
        processingError: "ocr-owner:interrupted-worker",
        processingErrorCategory: "ocr-required",
        processingStatus: "processing"
      })
      .where(eq(schema.billDocuments.id, documentId))
    await expect(recoverOwnedOcrDocuments(database, "interrupted-worker")).resolves.toBe(1)
    await expectCleared("pending")

    await database
      .update(schema.billDocuments)
      .set({
        blobPath: "documents/missing-ocr-artifact.pdf",
        ocrCompletedAt: new Date(),
        ocrPageCount: 1,
        ocrProvider: "azure-document-intelligence",
        ocrStatus: "processed",
        processingErrorCategory: "ocr-required",
        processingStatus: "unsupported"
      })
      .where(eq(schema.billDocuments.id, documentId))
    await expect(
      processOcrRequiredDocuments(database, {
        artifactStore: {
          exists: async () => true,
          put: async () => true,
          read: async (path) => {
            throw new ArtifactNotFoundError(path)
          }
        },
        documentId,
        maximumAttempts: 5,
        ocr: { recognize: async () => ({ provider: "azure-document-intelligence", text: "unreachable" }) }
      })
    ).resolves.toMatchObject({ rerouted: 1 })
    await expectCleared("pending")

    await database
      .update(schema.billDocuments)
      .set({
        blobPath: "documents/ocr-execution-failure.pdf",
        processingAttempts: 0,
        processingErrorCategory: "ocr-required",
        processingStatus: "unsupported"
      })
      .where(eq(schema.billDocuments.id, documentId))
    const ocrClaimed = Promise.withResolvers<void>()
    const allowOcrFailure = Promise.withResolvers<void>()
    const ocrProcessing = processOcrRequiredDocuments(database, {
      artifactStore: {
        exists: async () => true,
        put: async () => true,
        read: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])
      },
      documentId,
      maximumAttempts: 5,
      ocr: {
        recognize: async () => {
          ocrClaimed.resolve()
          await allowOcrFailure.promise
          throw new Error("OCR service unavailable")
        }
      }
    })
    await ocrClaimed.promise
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    ).resolves.toMatchObject({ ocrStatus: "processing", processingStatus: "processing" })
    allowOcrFailure.resolve()
    await expect(ocrProcessing).resolves.toMatchObject({ claimed: 1, failed: 1 })
    await expectCleared("failed")
  })

  it("downloads, stores, and processes a pending document through the worker", async () => {
    const documentId = "bill:us:119:hr:1234:document:worker-test"
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "analysis",
      id: documentId,
      sourceUrl: "https://example.test/worker-test.txt",
      title: "Worker test document"
    })
    const artifacts = new Map<string, Uint8Array>()
    const artifactStore: ArtifactStore = {
      exists: async (path) => artifacts.has(path),
      put: async (path, bytes) => {
        const created = !artifacts.has(path)
        artifacts.set(path, bytes)
        return created
      },
      read: async (path) => artifacts.get(path) ?? new Uint8Array()
    }
    const text = "SECTION 1. WORKER PATH.\nThe complete document worker is exercised."
    const fetchDocument: typeof fetch = async () => {
      const response = new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })
      Object.defineProperty(response, "url", { value: "https://example.test/worker-test.txt" })
      return response
    }

    const result = await processPendingDocuments(database, {
      artifactStore,
      concurrency: 1,
      documentId,
      fetch: fetchDocument,
      maximumAttempts: 4
    })

    expect(result).toMatchObject({ counts: { failed: 0, processed: 1, read: 1 } })
    expect(artifacts.size).toBe(1)
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    ).resolves.toMatchObject({ blobPath: expect.any(String), processingStatus: "processed" })
    await expect(
      database.select().from(schema.documentSections).where(eq(schema.documentSections.documentId, documentId))
    ).resolves.toHaveLength(1)

    const failedReplacement = await processPendingDocuments(database, {
      artifactStore,
      concurrency: 1,
      documentId,
      fetch: async () => {
        const response = new Response(new Uint8Array([0, 1, 2, 3]), {
          headers: { "content-type": "application/octet-stream" }
        })
        Object.defineProperty(response, "url", { value: "https://example.test/worker-test.txt" })
        return response
      },
      force: true,
      maximumAttempts: 4
    })
    expect(failedReplacement).toMatchObject({ counts: { failed: 1, unsupported: 1 } })
    await expect(
      database.select().from(schema.documentSections).where(eq(schema.documentSections.documentId, documentId))
    ).resolves.toHaveLength(1)

    const targetedRetry = await processPendingDocuments(database, {
      artifactStore,
      concurrency: 1,
      documentId,
      fetch: async () => {
        const response = new Response("SECTION 1. RETRIED PATH.\nThe targeted retry replaced the text safely.", {
          headers: { "content-type": "text/plain" }
        })
        Object.defineProperty(response, "url", { value: "https://example.test/worker-test.txt" })
        return response
      },
      force: true,
      maximumAttempts: 4
    })
    expect(targetedRetry).toMatchObject({ counts: { failed: 0, processed: 1 } })
    await expect(
      database
        .select({ text: schema.documentSections.text })
        .from(schema.documentSections)
        .where(eq(schema.documentSections.documentId, documentId))
    ).resolves.toEqual([expect.objectContaining({ text: expect.stringContaining("targeted retry") })])
  })

  it("keeps OCR unknown while a generic source extraction claim is running", async () => {
    const documentId = "bill:us:119:hr:1234:document:generic-claim-ocr-unknown"
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "analysis",
      id: documentId,
      sourceUrl: "https://example.test/generic-claim-ocr-unknown.txt",
      title: "Generic claim OCR unknown"
    })
    const artifacts = new Map<string, Uint8Array>()
    const extractionClaimed = Promise.withResolvers<void>()
    const allowExtraction = Promise.withResolvers<void>()
    const processing = processPendingDocuments(database, {
      artifactStore: {
        exists: async (path) => artifacts.has(path),
        put: async (path, bytes) => {
          const created = !artifacts.has(path)
          artifacts.set(path, bytes)
          return created
        },
        read: async (path) => artifacts.get(path) ?? new Uint8Array()
      },
      concurrency: 1,
      documentId,
      fetch: async () => {
        extractionClaimed.resolve()
        await allowExtraction.promise
        return new Response("SECTION 1. GENERIC CLAIM.", { headers: { "content-type": "text/plain" } })
      },
      maximumAttempts: 2
    })

    await extractionClaimed.promise
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    ).resolves.toMatchObject({
      ocrCompletedAt: null,
      ocrPageCount: null,
      ocrProvider: null,
      ocrStatus: null,
      processingStatus: "processing"
    })
    allowExtraction.resolve()
    await expect(processing).resolves.toMatchObject({ counts: { processed: 1 } })
  })

  it("claims pending documents once and enforces the configured attempt ceiling", async () => {
    const documentId = "bill:us:119:hr:1234:document:atomic-claim"
    const exhaustedDocumentId = "bill:us:119:hr:1234:document:attempts-exhausted"
    await database.insert(schema.billDocuments).values([
      {
        billId: "bill:us:119:hr:1234",
        classification: "analysis",
        id: documentId,
        sourceUrl: "https://example.test/atomic-claim.txt",
        title: "Atomic claim document"
      },
      {
        billId: "bill:us:119:hr:1234",
        classification: "analysis",
        id: exhaustedDocumentId,
        processingAttempts: 2,
        sourceUrl: "https://example.test/attempts-exhausted.txt",
        title: "Attempts exhausted document"
      }
    ])
    const artifacts = new Map<string, Uint8Array>()
    const artifactStore: ArtifactStore = {
      exists: async (path) => artifacts.has(path),
      put: async (path, bytes) => {
        const created = !artifacts.has(path)
        artifacts.set(path, bytes)
        return created
      },
      read: async (path) => artifacts.get(path) ?? new Uint8Array()
    }
    let fetches = 0
    const fetchDocument: typeof fetch = async () => {
      fetches += 1
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
      const response = new Response("SECTION 1. ATOMIC CLAIM.\nOnly one worker fetched this document.", {
        headers: { "content-type": "text/plain" }
      })
      Object.defineProperty(response, "url", { value: "https://example.test/atomic-claim.txt" })
      return response
    }

    const [first, overlapping] = await Promise.all([
      processPendingDocuments(database, {
        artifactStore,
        concurrency: 1,
        documentId,
        fetch: fetchDocument,
        maximumAttempts: 2
      }),
      processPendingDocuments(database, {
        artifactStore,
        concurrency: 1,
        documentId,
        fetch: fetchDocument,
        maximumAttempts: 2
      })
    ])

    expect([first.counts.processed, overlapping.counts.processed].sort()).toEqual([0, 1])
    expect([first.counts.discovered, overlapping.counts.discovered].sort()).toEqual([0, 1])
    expect(fetches).toBe(1)

    let exhaustedFetches = 0
    const exhausted = await processPendingDocuments(database, {
      artifactStore,
      concurrency: 1,
      documentId: exhaustedDocumentId,
      fetch: async () => {
        exhaustedFetches += 1
        return new Response("SECTION 1. SHOULD NOT RUN.", { headers: { "content-type": "text/plain" } })
      },
      maximumAttempts: 2
    })
    expect(exhausted).toMatchObject({ counts: { discovered: 0 } })
    expect(exhaustedFetches).toBe(0)
  })

  it("shards bill documents by canonical jurisdiction without omission or overlap", async () => {
    const shardCount = 64
    const california = {
      jurisdictionId: "jurisdiction:ca",
      sessionId: "session:ca:2025-2026",
      billId: "bill:ca:2025-2026:ab:1"
    }
    const texas = {
      jurisdictionId: "jurisdiction:tx",
      sessionId: "session:tx:2025-2026",
      billId: "bill:tx:2025-2026:hb:1"
    }
    const unknown = {
      jurisdictionId: "jurisdiction:unknown",
      sessionId: "session:unknown:2025-2026",
      billId: "bill:unknown:2025-2026:hb:1"
    }
    await database.insert(schema.jurisdictions).values([
      {
        classification: "state",
        countryCode: "US",
        id: california.jurisdictionId,
        name: "California",
        subdivisionCode: "CA"
      },
      {
        classification: "state",
        countryCode: "US",
        id: texas.jurisdictionId,
        name: "Texas",
        subdivisionCode: "TX"
      },
      {
        classification: "territory",
        countryCode: "US",
        id: unknown.jurisdictionId,
        name: "Unknown jurisdiction"
      }
    ])
    await database.insert(schema.legislativeSessions).values([
      {
        id: california.sessionId,
        identifier: "2025-2026",
        jurisdictionId: california.jurisdictionId,
        name: "2025-2026 Regular Session"
      },
      {
        id: texas.sessionId,
        identifier: "2025-2026",
        jurisdictionId: texas.jurisdictionId,
        name: "2025-2026 Regular Session"
      },
      {
        id: unknown.sessionId,
        identifier: "2025-2026",
        jurisdictionId: unknown.jurisdictionId,
        name: "2025-2026 Regular Session"
      }
    ])
    await database.insert(schema.bills).values([
      {
        id: california.billId,
        identifier: "AB 1",
        jurisdictionId: california.jurisdictionId,
        sessionId: california.sessionId,
        sourceUrl: "https://example.test/ca/ab-1",
        title: "California test bill"
      },
      {
        id: texas.billId,
        identifier: "HB 1",
        jurisdictionId: texas.jurisdictionId,
        sessionId: texas.sessionId,
        sourceUrl: "https://example.test/tx/hb-1",
        title: "Texas test bill"
      },
      {
        id: unknown.billId,
        identifier: "HB 1",
        jurisdictionId: unknown.jurisdictionId,
        sessionId: unknown.sessionId,
        sourceUrl: "https://example.test/unknown/hb-1",
        title: "Unknown jurisdiction test bill"
      }
    ])
    const documents = [
      ...["one", "two"].map((suffix) => ({
        billId: california.billId,
        classification: "bill-text",
        id: `${california.billId}:document:${suffix}`,
        sourceUrl: `https://example.test/ca/${suffix}.txt`,
        title: `California document ${suffix}`
      })),
      ...["one", "two"].map((suffix) => ({
        billId: texas.billId,
        classification: "bill-text",
        id: `${texas.billId}:document:${suffix}`,
        sourceUrl: `https://example.test/tx/${suffix}.txt`,
        title: `Texas document ${suffix}`
      })),
      {
        billId: unknown.billId,
        classification: "bill-text",
        id: `${unknown.billId}:document:retry`,
        nextAttemptAt: new Date("2026-08-19T00:00:00.000Z"),
        processingAttempts: 1,
        processingStatus: "failed" as const,
        sourceUrl: "https://example.test/unknown/retry.txt",
        title: "Unknown jurisdiction retry document"
      }
    ]
    await database.insert(schema.billDocuments).values(documents)

    const routedShards = new Map<string, number>()
    for (const jurisdiction of [california, texas, unknown]) {
      const matchingShards: number[] = []
      for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
        const next = await nextDocumentBackfillAttempt(database, {
          jurisdictionId: jurisdiction.jurisdictionId,
          maximumAttempts: 4,
          shardCount,
          shardIndex
        })
        if (next.hasWork) {
          matchingShards.push(shardIndex)
        }
      }
      expect(matchingShards).toHaveLength(1)
      routedShards.set(jurisdiction.jurisdictionId, matchingShards[0]!)
    }
    expect(routedShards.get(california.jurisdictionId)).not.toBe(routedShards.get(texas.jurisdictionId))
    await expect(
      nextDocumentBackfillAttempt(database, {
        jurisdictionId: california.jurisdictionId,
        maximumAttempts: 4,
        shardCount,
        shardIndex: routedShards.get(california.jurisdictionId)!
      })
    ).resolves.toEqual({ hasWork: true })
    const unknownShard = routedShards.get(unknown.jurisdictionId)!
    await expect(
      nextDocumentBackfillAttempt(database, {
        maximumAttempts: 4,
        shardCount,
        shardIndex: unknownShard
      })
    ).resolves.toMatchObject({ hasWork: true })
    await expect(
      nextDocumentBackfillAttempt(database, {
        jurisdictionId: unknown.jurisdictionId,
        maximumAttempts: 4,
        shardCount,
        shardIndex: unknownShard
      })
    ).resolves.toMatchObject({ hasWork: true, nextAttemptAt: new Date("2026-08-19T00:00:00.000Z") })

    const fetchedUrls: string[] = []
    const artifactStore: ArtifactStore = {
      exists: async () => false,
      put: async () => true,
      read: async () => new Uint8Array()
    }
    const fetchDocument: typeof fetch = async (input) => {
      fetchedUrls.push(String(input))
      return new Response("SECTION 1. JURISDICTION SHARD.", { headers: { "content-type": "text/plain" } })
    }
    for (const jurisdiction of [california, texas]) {
      const shardIndex = routedShards.get(jurisdiction.jurisdictionId)
      await processPendingDocuments(database, {
        artifactStore,
        concurrency: 2,
        fetch: fetchDocument,
        jurisdictionId: jurisdiction.jurisdictionId,
        limit: 10,
        maximumAttempts: 4,
        shardCount,
        shardIndex: shardIndex!
      })
    }
    expect(fetchedUrls.sort()).toEqual(
      documents
        .filter((document) => document.billId !== unknown.billId)
        .map((document) => document.sourceUrl)
        .sort()
    )
    await expect(
      database
        .select({ id: schema.billDocuments.id })
        .from(schema.billDocuments)
        .where(eq(schema.billDocuments.processingStatus, "pending"))
        .then((records) =>
          records.filter(
            (record) =>
              record.id !== `${unknown.billId}:document:retry` &&
              documents.some((document) => document.id === record.id)
          )
        )
    ).resolves.toEqual([])
  })

  it("returns an interrupted claim to pending without consuming a provider attempt", async () => {
    const documentId = "bill:ca:2025-2026:ab:1:document:interrupted-claim"
    await database.insert(schema.billDocuments).values({
      billId: "bill:ca:2025-2026:ab:1",
      classification: "bill-text",
      id: documentId,
      lastAttemptAt: new Date("2026-08-18T00:00:00.000Z"),
      processingAttempts: 2,
      processingStatus: "processing",
      sourceUrl: "https://example.test/ca/interrupted.txt",
      title: "Interrupted California document"
    })

    const cutoff = new Date("2026-08-18T00:01:00.000Z")
    await expect(requeueInterruptedDocuments(database, cutoff)).resolves.toBe(1)
    await expect(requeueInterruptedDocuments(database, cutoff)).resolves.toBe(0)
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    ).resolves.toMatchObject({
      processingAttempts: 1,
      processingStatus: "pending"
    })
  })

  it("recovers only the current Trigger run's interrupted document attempt", async () => {
    const workflowExecutionId = "run_retry_owns_interrupted_lease"
    const operation = "process-documents-shard-4"
    const scopeKey = "shard:4-of-64"
    const startedAt = new Date("2026-08-18T01:00:00.000Z")
    const ownedDocumentId = "bill:ca:2025-2026:ab:1:document:owned-retry-claim"
    const olderDocumentId = "bill:ca:2025-2026:ab:1:document:older-unowned-claim"
    await database.insert(schema.billDocuments).values([
      {
        billId: "bill:ca:2025-2026:ab:1",
        classification: "bill-text",
        id: olderDocumentId,
        lastAttemptAt: new Date("2026-08-18T00:59:00.000Z"),
        processingAttempts: 1,
        processingStatus: "processing",
        sourceUrl: "https://example.test/ca/older.txt",
        title: "Older unrelated interrupted document"
      },
      {
        billId: "bill:ca:2025-2026:ab:1",
        classification: "bill-text",
        id: ownedDocumentId,
        lastAttemptAt: new Date("2026-08-18T01:00:01.000Z"),
        processingAttempts: 1,
        processingStatus: "processing",
        sourceUrl: "https://example.test/ca/owned.txt",
        title: "Current retry interrupted document"
      }
    ])
    await database.insert(schema.ingestionRuns).values({
      correlationId: "retry-recovery-test",
      operation,
      scope: { scopeKey },
      source: "documents",
      startedAt,
      workflowExecutionId
    })
    await database.insert(schema.ingestionLocks).values({
      acquiredAt: new Date("2026-08-18T00:59:59.000Z"),
      expiresAt: new Date("2026-08-18T01:30:00.000Z"),
      operation,
      ownerId: "00000000-0000-4000-8000-000000000001",
      scopeKey,
      source: "documents"
    })

    const recovered = await recoverRetriedIngestionJob(database, {
      operation,
      scopeKey,
      source: "documents",
      workflowExecutionId
    })
    expect(recovered).toMatchObject({ releasedLease: true, startedAt })
    await expect(
      requeueInterruptedDocuments(
        database,
        new Date("2026-08-18T01:01:00.000Z"),
        10,
        { count: 64, index: 4 },
        {},
        startedAt
      )
    ).resolves.toBe(1)
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, ownedDocumentId) })
    ).resolves.toMatchObject({ processingAttempts: 0, processingStatus: "pending" })
    await expect(
      database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, olderDocumentId) })
    ).resolves.toMatchObject({ processingAttempts: 1, processingStatus: "processing" })
    await expect(
      database.select().from(schema.ingestionLocks).where(eq(schema.ingestionLocks.scopeKey, scopeKey))
    ).resolves.toEqual([])
  })

  it("records transient failure categories and honors durable retry timing", async () => {
    const documentId = "bill:us:119:hr:1234:document:retry-backoff"
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "analysis",
      id: documentId,
      sourceUrl: "https://example.test/retry-backoff.txt",
      title: "Retry backoff document"
    })
    const artifactStore: ArtifactStore = {
      exists: async () => false,
      put: async () => true,
      read: async () => new Uint8Array()
    }

    const failed = await processPendingDocuments(database, {
      artifactStore,
      concurrency: 1,
      documentId,
      fetch: async () => {
        throw new TypeError("fetch failed")
      },
      maximumAttempts: 3
    })
    expect(failed.failures).toEqual([
      expect.objectContaining({ category: "download-transient", identifier: documentId, retryable: true })
    ])
    const persisted = await database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, documentId) })
    expect(persisted).toMatchObject({
      processingAttempts: 1,
      processingErrorCategory: "download-transient",
      processingStatus: "failed"
    })
    expect(persisted?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now())

    const deferred = await processPendingDocuments(database, {
      artifactStore,
      concurrency: 1,
      documentId,
      failureCategory: "download-transient",
      fetch: async () => new Response("SECTION 1. DEFERRED."),
      maximumAttempts: 3,
      status: "failed"
    })
    expect(deferred).toMatchObject({ counts: { discovered: 0 } })
  })

  it("prepares only the selected known document defect cohort for bounded reprocessing", async () => {
    const californiaId = "bill:us:119:hr:1234:document:california-false-success"
    const alaskaId = "bill:us:119:hr:1234:document:alaska-pdf-label"
    const arkansasId = "bill:us:119:hr:1234:document:arkansas-ftp"
    const hawaiiId = "bill:us:119:hr:1234:document:hawaii-data-archive"
    const hawaiiNonCandidateId = "bill:us:119:hr:1234:document:hawaii-non-candidate"
    const imageId = "bill:us:119:hr:1234:document:image-ocr"
    const inaccessibleId = "bill:us:119:hr:1234:document:inaccessible-host"
    const officeId = "bill:us:119:hr:1234:document:office-open-xml"
    await database.insert(schema.billDocuments).values([
      {
        billId: "bill:us:119:hr:1234",
        classification: "bill-text",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        id: officeId,
        processingAttempts: 1,
        processingError:
          "Unsupported document content type: application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        processingErrorCategory: "unsupported-format",
        processingStatus: "unsupported",
        sourceUrl: "https://example.test/bill.docx",
        title: "Office Open XML document"
      },
      {
        billId: "bill:us:119:hr:1234",
        classification: "bill-text",
        id: arkansasId,
        processingAttempts: 1,
        processingError: "Document URL must use HTTPS",
        processingErrorCategory: "unsafe-url",
        processingStatus: "unsupported",
        sourceUrl: "ftp://www.arkleg.state.ar.us/Bills/2017S1/Public/HB1001.pdf",
        title: "Arkansas FTP document"
      },
      {
        billId: "bill:us:119:hr:1234",
        blobPath: "documents/california.xml",
        classification: "bill-text",
        contentHash,
        contentType: "application/pdf",
        id: californiaId,
        processingAttempts: 2,
        processingStatus: "processed",
        sourceUrl:
          "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202320240SB681&version=20230SB68198AMD",
        text: "Download Bill PDF",
        title: "California false success"
      },
      {
        billId: "bill:us:119:hr:1234",
        blobPath: "documents/alaska.pdf",
        classification: "bill-text",
        contentType: "pdf",
        id: alaskaId,
        processingAttempts: 1,
        processingError: "Unsupported document content type: pdf",
        processingStatus: "unsupported",
        sourceUrl: "https://www.akleg.gov/basis/Bill/Text/34?Hsid=HB0001A",
        title: "Alaska PDF label"
      },
      {
        billId: "bill:us:119:hr:1234",
        classification: "bill-text",
        contentType: "image/gif",
        id: imageId,
        processingError: "Unsupported document content type: image/gif",
        processingErrorCategory: "unsupported-format",
        processingStatus: "unsupported",
        sourceUrl: "https://example.test/bill.gif",
        title: "Image document"
      },
      {
        billId: "bill:us:119:hr:1234",
        classification: "bill-text",
        id: hawaiiId,
        processingAttempts: 3,
        processingError: "Document download failed with HTTP 403",
        processingErrorCategory: "download-permanent",
        processingStatus: "unsupported",
        sourceUrl: "https://www.capitol.hawaii.gov/session2020/commreports/GM501_SSCR3593_.PDF",
        title: "Hawaii committee report"
      },
      {
        billId: "bill:us:119:hr:1234",
        classification: "bill-text",
        id: hawaiiNonCandidateId,
        processingAttempts: 3,
        processingError: "Document download failed with HTTP 403",
        processingErrorCategory: "download-permanent",
        processingStatus: "unsupported",
        sourceUrl: "https://www.capitol.hawaii.gov/session2020/House/GM501_SSCR3593_.PDF",
        title: "Hawaii navigation page"
      },
      {
        billId: "bill:us:119:hr:1234",
        classification: "bill-text",
        id: inaccessibleId,
        processingError: "fetch failed: getaddrinfo ENOTFOUND alisondb.legislature.state.al.us",
        processingErrorCategory: "download-transient",
        processingStatus: "failed",
        sourceUrl:
          "https://alisondb.legislature.state.al.us/ALISON/SearchableInstruments/2017RS/PrintFiles/HB1-int.pdf",
        title: "Unavailable Alabama document"
      }
    ])
    await database.insert(schema.documentSections).values({
      contentHash,
      documentId: californiaId,
      id: `${californiaId}:section:0`,
      ordinal: 0,
      sourceEndOffset: 17,
      sourceStartOffset: 0,
      text: "Download Bill PDF"
    })

    await expect(prepareDocumentRemediation(database, "california-bill-pdf", 1)).resolves.toEqual({
      identifiers: [californiaId],
      prepared: 1
    })
    await expect(prepareDocumentRemediation(database, "alaska-pdf-label", 1)).resolves.toEqual({
      identifiers: [alaskaId],
      prepared: 1
    })
    await expect(prepareDocumentRemediation(database, "arkansas-ftp", 1)).resolves.toEqual({
      identifiers: [arkansasId],
      prepared: 1
    })
    await expect(prepareDocumentRemediation(database, "hawaii-data-archive", 10)).resolves.toEqual({
      identifiers: [hawaiiId],
      prepared: 1
    })
    await expect(prepareDocumentRemediation(database, "image-ocr", 1)).resolves.toEqual({
      identifiers: [imageId],
      prepared: 1
    })
    await expect(prepareDocumentRemediation(database, "inaccessible-hosts", 1)).resolves.toEqual({
      identifiers: [inaccessibleId],
      prepared: 1
    })
    await expect(prepareDocumentRemediation(database, "office-open-xml", 1)).resolves.toEqual({
      identifiers: [officeId],
      prepared: 1
    })

    const california = await database.query.billDocuments.findFirst({
      where: eq(schema.billDocuments.id, californiaId)
    })
    const alaska = await database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, alaskaId) })
    const arkansas = await database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, arkansasId) })
    const hawaii = await database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, hawaiiId) })
    const hawaiiNonCandidate = await database.query.billDocuments.findFirst({
      where: eq(schema.billDocuments.id, hawaiiNonCandidateId)
    })
    const image = await database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, imageId) })
    const inaccessible = await database.query.billDocuments.findFirst({
      where: eq(schema.billDocuments.id, inaccessibleId)
    })
    const office = await database.query.billDocuments.findFirst({ where: eq(schema.billDocuments.id, officeId) })
    expect(california).toMatchObject({
      blobPath: null,
      contentHash: null,
      contentType: null,
      processingAttempts: 0,
      processingStatus: "pending",
      text: null
    })
    expect(alaska).toMatchObject({
      blobPath: "documents/alaska.pdf",
      contentType: "pdf",
      processingAttempts: 0,
      processingError: null,
      processingStatus: "pending"
    })
    expect(arkansas).toMatchObject({
      processingAttempts: 0,
      processingError: null,
      processingErrorCategory: null,
      processingStatus: "pending",
      sourceUrl: "ftp://www.arkleg.state.ar.us/Bills/2017S1/Public/HB1001.pdf"
    })
    expect(hawaii).toMatchObject({
      processingAttempts: 0,
      processingError: null,
      processingErrorCategory: null,
      processingStatus: "pending",
      sourceUrl: "https://www.capitol.hawaii.gov/session2020/commreports/GM501_SSCR3593_.PDF"
    })
    expect(hawaiiNonCandidate).toMatchObject({
      processingAttempts: 3,
      processingError: "Document download failed with HTTP 403",
      processingErrorCategory: "download-permanent",
      processingStatus: "unsupported",
      sourceUrl: "https://www.capitol.hawaii.gov/session2020/House/GM501_SSCR3593_.PDF"
    })
    expect(image).toMatchObject({ processingErrorCategory: "ocr-required", processingStatus: "unsupported" })
    expect(inaccessible).toMatchObject({
      processingErrorCategory: "source-inaccessible",
      processingStatus: "unsupported"
    })
    expect(office).toMatchObject({
      processingAttempts: 0,
      processingError: null,
      processingErrorCategory: null,
      processingStatus: "pending"
    })
    await expect(
      database.query.documentSections.findFirst({ where: eq(schema.documentSections.documentId, californiaId) })
    ).resolves.toBeUndefined()
  })

  it("processes, indexes, embeds, and retrieves supporting-material sections", async () => {
    const materialId = "material:us:119:committee-report:1"
    await database.insert(schema.supportingMaterials).values({
      classification: "committee-report",
      id: materialId,
      jurisdictionId: "jurisdiction:us",
      sourceId: "committee-report-1",
      sourceUrl: "https://example.test/committee-report.txt",
      title: "Committee report on federal data"
    })
    const artifacts = new Map<string, Uint8Array>()
    const artifactStore: ArtifactStore = {
      exists: async (path) => artifacts.has(path),
      put: async (path, bytes) => {
        const created = !artifacts.has(path)
        artifacts.set(path, bytes)
        return created
      },
      read: async (path) => artifacts.get(path) ?? new Uint8Array()
    }
    const fetchMaterial: typeof fetch = async () => {
      const response = new Response("SECTION 1. FINDINGS.\nThe committee found improved public data access.", {
        headers: { "content-type": "text/plain; charset=utf-8" }
      })
      Object.defineProperty(response, "url", { value: "https://example.test/committee-report.txt" })
      return response
    }

    await expect(
      processPendingSupportingMaterials(database, {
        artifactStore,
        concurrency: 1,
        fetch: fetchMaterial,
        materialId
      })
    ).resolves.toMatchObject({ counts: { failed: 0, processed: 1, read: 1 } })
    const route = embeddingRouteFor("supporting-material-section")
    const embedding = Array.from({ length: route.dimensions }, () => 0.1)
    const embeddingClient = {
      embed: async (input: string[]) => ({ embeddings: input.map(() => embedding), model: route.model })
    }
    const retrievalClient = {
      embed: async (_product: string, input: string[]) => ({
        embeddings: input.map(() => embedding),
        model: route.model
      }),
      rerank: async (_tool: string, _query: string, candidates: Array<{ id: string; text: string }>) =>
        candidates.map((candidate, index) => ({ ...candidate, relevanceScore: 1 - index / 100 }))
    }
    await expect(
      embedSupportingMaterialSections(database, embeddingClient, { materialId, rolloutId: "test" })
    ).resolves.toEqual({
      embedded: 1,
      skipped: 0
    })
    await expect(
      embedSupportingMaterialSections(database, embeddingClient, { materialId, rolloutId: "test" })
    ).resolves.toEqual({
      embedded: 0,
      skipped: 1
    })

    const service = new LegislationQueryService(database)
    const searchResult = await service.searchSupportingMaterials({ query: "improved public data access" })
    expect(searchResult).toMatchObject({ items: [{ id: materialId }] })
    expect(searchResult.items[0]).not.toHaveProperty("text")
    const detailResult = await service.getSupportingMaterial({ id: materialId })
    expect(detailResult).toMatchObject({
      material: { id: materialId, processingStatus: "processed" },
      sections: [expect.objectContaining({ text: expect.stringContaining("public data access") })],
      truncated: false
    })
    expect(detailResult.material).not.toHaveProperty("text")
    const section = detailResult.sections[0]
    if (section === undefined) {
      throw new Error("Supporting-material processing should persist a section")
    }
    await expect(service.getSupportingMaterialSection({ materialId, sectionId: section.id })).resolves.toMatchObject({
      material: { id: materialId },
      section: { id: section.id, materialId }
    })
    await expect(
      service.getSupportingMaterialSection({ materialId: `${materialId}:other`, sectionId: section.id })
    ).rejects.toMatchObject({ category: "not_found" })

    const retrievalService = new LegislationQueryService(database, retrievalClient)
    const semanticSearch = await retrievalService.searchSupportingMaterials({
      mode: "semantic",
      query: "improved public data access"
    })
    expect(semanticSearch.items).toEqual([expect.objectContaining({ distance: expect.any(Number), id: materialId })])
    const hybridSearch = await retrievalService.searchSupportingMaterials({
      mode: "hybrid",
      query: "improved public data access"
    })
    expect(hybridSearch.items).toEqual([expect.objectContaining({ id: materialId, score: expect.any(Number) })])
  })

  it("aggregates canonical supporting-material links and applies bounded collection filters", async () => {
    const jurisdictionId = "jurisdiction:or"
    const sessionId = "session:or:2025"
    const primaryMaterialId = "material:or:2025:committee-report:links"
    const alphaMaterialId = "material:or:2025:committee-report:alpha"
    const excludedMaterialId = "material:or:2025:committee-report:excluded"
    const first = {
      amendmentId: "amendment:or:2025:hamdt:links-a",
      billId: "bill:or:2025:hb:9901",
      eventId: "event:or:2025:committee:links-a",
      organizationId: "organization:or:committee:links-a"
    }
    const second = {
      amendmentId: "amendment:or:2025:hamdt:links-b",
      billId: "bill:or:2025:hb:9902",
      eventId: "event:or:2025:committee:links-b",
      organizationId: "organization:or:committee:links-b"
    }

    await database.insert(schema.organizations).values([
      {
        classification: "committee",
        id: first.organizationId,
        jurisdictionId,
        name: "Link Committee A",
        sourceId: "supporting-material-links-a"
      },
      {
        classification: "committee",
        id: second.organizationId,
        jurisdictionId,
        name: "Link Committee B",
        sourceId: "supporting-material-links-b"
      }
    ])
    await database.insert(schema.bills).values([
      {
        id: first.billId,
        identifier: "HB 9901",
        jurisdictionId,
        sessionId,
        sourceUrl: "https://example.test/or/hb-9901",
        title: "Supporting material link bill A"
      },
      {
        id: second.billId,
        identifier: "HB 9902",
        jurisdictionId,
        sessionId,
        sourceUrl: "https://example.test/or/hb-9902",
        title: "Supporting material link bill B"
      }
    ])
    await database.insert(schema.amendments).values([
      {
        amendmentNumber: "A",
        amendmentType: "committee",
        billId: first.billId,
        id: first.amendmentId,
        jurisdictionId,
        printedIdentifier: "H.Amdt. Links A",
        sourceId: "supporting-material-links-a",
        sourceUrl: "https://example.test/or/amendments/links-a"
      },
      {
        amendmentNumber: "B",
        amendmentType: "committee",
        billId: second.billId,
        id: second.amendmentId,
        jurisdictionId,
        printedIdentifier: "H.Amdt. Links B",
        sourceId: "supporting-material-links-b",
        sourceUrl: "https://example.test/or/amendments/links-b"
      }
    ])
    await database.insert(schema.legislativeEvents).values([
      {
        id: first.eventId,
        jurisdictionId,
        name: "Link hearing A",
        sourceId: "supporting-material-links-a",
        startAt: new Date("2026-01-15T17:00:00Z"),
        status: "scheduled"
      },
      {
        id: second.eventId,
        jurisdictionId,
        name: "Link hearing B",
        sourceId: "supporting-material-links-b",
        startAt: new Date("2026-01-16T17:00:00Z"),
        status: "scheduled"
      }
    ])
    await database.insert(schema.supportingMaterials).values([
      {
        classification: "committee-report",
        documentDate: "2026-01-16",
        id: primaryMaterialId,
        jurisdictionId,
        processingStatus: "processed",
        sourceId: "supporting-material-links-primary",
        sourceUrl: "https://example.test/or/materials/primary",
        title: "Zulu supporting material"
      },
      {
        classification: "committee-report",
        documentDate: "2026-01-15",
        id: alphaMaterialId,
        jurisdictionId,
        processingStatus: "processed",
        sourceId: "supporting-material-links-alpha",
        sourceUrl: "https://example.test/or/materials/alpha",
        title: "Alpha supporting material"
      },
      {
        classification: "committee-report",
        documentDate: "2026-01-17",
        id: excludedMaterialId,
        jurisdictionId,
        processingStatus: "pending",
        sourceId: "supporting-material-links-excluded",
        sourceUrl: "https://example.test/or/materials/excluded",
        title: "Excluded supporting material"
      }
    ])
    await database.insert(schema.supportingMaterialLinks).values([
      { ...first, classification: "related", materialId: primaryMaterialId },
      { ...first, classification: "duplicate", materialId: primaryMaterialId },
      { ...second, classification: "related", materialId: primaryMaterialId },
      { classification: "related", materialId: alphaMaterialId, organizationId: first.organizationId },
      { classification: "related", materialId: excludedMaterialId, organizationId: first.organizationId }
    ])
    await database.insert(schema.supportingMaterialSections).values([
      {
        contentHash: "c".repeat(64),
        id: `${primaryMaterialId}:section:1`,
        materialId: primaryMaterialId,
        ordinal: 0,
        sourceEndOffset: 3,
        sourceStartOffset: 0,
        text: "abc"
      },
      {
        contentHash: "d".repeat(64),
        id: `${primaryMaterialId}:section:2`,
        materialId: primaryMaterialId,
        ordinal: 1,
        sourceEndOffset: 5,
        sourceStartOffset: 0,
        text: "defgh"
      }
    ])

    const service = new LegislationQueryService(database)
    const collection = await service.searchSupportingMaterials({
      documentFrom: "2026-01-15",
      documentTo: "2026-01-16",
      organizationId: first.organizationId,
      processingStatus: "processed",
      sort: "title-asc"
    })
    expect(collection.items.map((item) => item.id)).toEqual([alphaMaterialId, primaryMaterialId])
    expect(collection.items[1]).toMatchObject({
      amendmentIds: [first.amendmentId, second.amendmentId],
      billIds: [first.billId, second.billId],
      meetingIds: [first.eventId, second.eventId],
      organizationIds: [first.organizationId, second.organizationId]
    })

    const detail = await service.getSupportingMaterial({ id: primaryMaterialId, limit: 1 })
    expect(detail).toMatchObject({
      material: {
        byteSize: null,
        pageCount: null,
        sectionCount: 2,
        storedUrl: null,
        textCharacterCount: 8
      },
      truncated: true
    })
  })

  it("records committed event changes and keeps replays and rollbacks silent", async () => {
    const insertedRun = await database
      .insert(schema.ingestionRuns)
      .values({ operation: "validate-change-events", source: "integration-test" })
      .returning({ id: schema.ingestionRuns.id })
    const runId = insertedRun[0]!.id
    const eventId = "event:integration:wa-data-hearing"
    const baseEvent = {
      id: eventId,
      jurisdictionId: "jurisdiction:wa",
      name: "Data Committee Hearing",
      sourceId: "wa-data-hearing",
      startAt: new Date("2026-01-10T18:00:00Z"),
      status: "scheduled"
    }
    const snapshot = (event: typeof baseEvent & { isDeleted?: boolean }) => ({
      agendaItems: [],
      documents: [],
      event,
      participants: []
    })
    await withIngestionRun(runId, () => upsertEventSnapshots(database, [snapshot(baseEvent)]))
    await withIngestionRun(runId, () => upsertEventSnapshots(database, [snapshot(baseEvent)]))
    await withIngestionRun(runId, () =>
      upsertEventSnapshots(database, [snapshot({ ...baseEvent, name: "Corrected Data Committee Hearing" })])
    )
    const rescheduled = {
      ...baseEvent,
      name: "Corrected Data Committee Hearing",
      startAt: new Date("2026-01-10T19:00:00Z")
    }
    await withIngestionRun(runId, () => upsertEventSnapshots(database, [snapshot(rescheduled)]))
    const cancelled = { ...rescheduled, status: "cancelled" }
    await withIngestionRun(runId, () => upsertEventSnapshots(database, [snapshot(cancelled)]))
    await withIngestionRun(runId, () => upsertEventSnapshots(database, [snapshot({ ...cancelled, isDeleted: true })]))

    await expect(
      database
        .select({ changeType: schema.changeEvents.changeType })
        .from(schema.changeEvents)
        .where(eq(schema.changeEvents.recordId, eventId))
        .orderBy(schema.changeEvents.observedAt)
    ).resolves.toEqual([
      { changeType: "create" },
      { changeType: "update" },
      { changeType: "reschedule" },
      { changeType: "cancel" },
      { changeType: "delete" }
    ])

    const failedEvent = { ...baseEvent, id: "event:integration:failed", sourceId: "failed" }
    await expect(
      withIngestionRun(runId, () =>
        upsertEventSnapshots(database, [
          {
            agendaItems: [
              {
                agendaItem: {
                  description: "Invalid agenda item",
                  eventId: failedEvent.id,
                  id: `${failedEvent.id}:agenda:1`,
                  ordinal: -1
                },
                amendmentIds: [],
                billIds: [],
                materialIds: []
              }
            ],
            documents: [],
            event: failedEvent,
            participants: []
          }
        ])
      )
    ).rejects.toMatchObject({ cause: { code: "23514", constraint: "event_agenda_items_ordinal_check" } })
    await expect(
      database.select().from(schema.changeEvents).where(eq(schema.changeEvents.recordId, failedEvent.id))
    ).resolves.toHaveLength(0)

    const actionId = "bill:wa:2025-2026:sb:5678:action:event-outcome"
    await database.insert(schema.billActions).values({
      billId: "bill:wa:2025-2026:sb:5678",
      description: "Committee recommendation adopted",
      id: actionId,
      ordinal: 0
    })
    const outcome = {
      actionId,
      eventId,
      linkMethod: "explicit" as const,
      sourceReference: "openstates:agenda-result:wa-data-hearing"
    }
    await expect(linkEventOutcome(database, outcome)).resolves.toBe("inserted")
    await expect(linkEventOutcome(database, outcome)).resolves.toBe("unchanged")
    await expect(
      database.insert(schema.eventOutcomeLinks).values({
        actionId,
        eventId,
        id: "event-outcome:semantic-not-allowed",
        linkMethod: "semantic",
        sourceReference: "similar text"
      })
    ).rejects.toMatchObject({ cause: { code: "23514", constraint: "event_outcome_links_method_check" } })
  })

  it("replays from the first failed Open States record without duplicating committed records", async () => {
    const source = openStatesBillSchema.parse(
      JSON.parse(await readFile(resolve(process.cwd(), "tests/fixtures/openstates/wa-hb-1234.json"), "utf8"))
    )
    const replacement = {
      ...source,
      id: "ocd-bill/wa-hb-9999",
      identifier: "HB 9999",
      related_bills: [],
      sources: [{ url: "https://leg.wa.gov/billsummary?BillNumber=9999&Year=2025" }],
      title: "A replayable legislative record",
      votes: source.votes.map((vote, index) => ({ ...vote, id: `${vote.id ?? "vote"}-replay-${index}` }))
    }
    const options = { concurrency: 2, contentHash: "b".repeat(64), stream: "wa-restart-test" }

    const first = await importOpenStatesRecords(
      database,
      { jurisdictionCode: "wa", jurisdictionName: "Washington" },
      [source, { identifier: "invalid" }],
      options
    )
    expect(first).toMatchObject({ checkpoint: { complete: false, index: 1 }, counts: { failed: 1, inserted: 1 } })

    const replay = await importOpenStatesRecords(
      database,
      { jurisdictionCode: "wa", jurisdictionName: "Washington" },
      [source, replacement],
      options
    )
    expect(replay).toMatchObject({ checkpoint: { complete: true, index: 2 }, counts: { inserted: 1, skipped: 1 } })
    await expect(
      database.select().from(schema.bills).where(eq(schema.bills.id, "bill:wa:2025-2026:hb:9999"))
    ).resolves.toHaveLength(1)

    const repeated = await importOpenStatesRecords(
      database,
      { jurisdictionCode: "wa", jurisdictionName: "Washington" },
      [source, replacement],
      options
    )
    expect(repeated).toMatchObject({ counts: { failed: 0, skipped: 2 } })

    const changed = await importOpenStatesRecords(
      database,
      { jurisdictionCode: "wa", jurisdictionName: "Washington" },
      [source, { ...replacement, title: "A changed legislative record" }],
      { ...options, contentHash: "c".repeat(64) }
    )
    expect(changed).toMatchObject({ counts: { failed: 0, updated: 2 } })
    await expect(
      database
        .select({ title: schema.bills.title })
        .from(schema.bills)
        .where(eq(schema.bills.id, "bill:wa:2025-2026:hb:9999"))
    ).resolves.toEqual([{ title: "A changed legislative record" }])
  })

  it("keeps a GovInfo checkpoint before a transient failure and safely replays later packages", async () => {
    const xml = await readFile(resolve(process.cwd(), "tests/fixtures/govinfo/BILLSTATUS-119hr1234.xml"), "utf8")
    let currentXml = xml
    let failFirstPackage = true
    const client = new GovInfoClient(
      new RetryingHttpClient({
        fetch: async (input) => {
          const url = String(input)
          if (url.endsWith("first.xml") && failFirstPackage) {
            failFirstPackage = false
            return new Response("temporary", { status: 503 })
          }
          return new Response(currentXml, { headers: { "content-type": "application/xml" } })
        },
        maxAttempts: 1,
        requestTimeoutMs: 1000
      })
    )
    const packages = [
      { billType: "hr", congress: 119, packageId: "first", url: new URL("https://example.test/first.xml") },
      { billType: "hr", congress: 119, packageId: "second", url: new URL("https://example.test/second.xml") }
    ]

    const first = await importGovInfoPackages(database, client, packages, { stream: "govinfo-restart-test" })
    expect(first).toMatchObject({ checkpoint: { complete: false, index: 0 }, counts: { failed: 1, read: 1 } })

    const replay = await importGovInfoPackages(database, client, packages, { stream: "govinfo-restart-test" })
    expect(replay).toMatchObject({ checkpoint: { complete: true, index: 2 }, counts: { failed: 0, read: 2 } })
    await expect(
      database
        .select({ versionCode: schema.billDocuments.versionCode })
        .from(schema.billDocuments)
        .where(eq(schema.billDocuments.billId, "bill:us:119:hr:1234"))
    ).resolves.toEqual(expect.arrayContaining([{ versionCode: "enr" }, { versionCode: "ih" }]))

    const identical = await importGovInfoPackages(database, client, packages, { stream: "govinfo-restart-test" })
    expect(identical).toMatchObject({ counts: { read: 0, skipped: 2 } })

    currentXml = xml.replace("Legislative Data Access Act", "Legislative Data Access Act, updated")
    const changed = await importGovInfoPackages(database, client, packages, {
      force: true,
      stream: "govinfo-restart-test"
    })
    expect(changed).toMatchObject({ counts: { failed: 0, updated: 2 } })
    await expect(getBillById(database, "bill:us:119:hr:1234")).resolves.toMatchObject({
      title: "Legislative Data Access Act, updated"
    })
    const versions = await database
      .select({
        documentDate: schema.billDocuments.documentDate,
        id: schema.billDocuments.id,
        versionCode: schema.billDocuments.versionCode
      })
      .from(schema.billDocuments)
      .where(eq(schema.billDocuments.billId, "bill:us:119:hr:1234"))
    expect(new Set(versions.map((version) => version.id)).size).toBe(versions.length)
    expect(versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ versionCode: "enr" }),
        expect.objectContaining({ versionCode: "ih" })
      ])
    )
    expect(
      versions
        .filter(
          (version) => version.documentDate !== null && (version.versionCode === "ih" || version.versionCode === "enr")
        )
        .toSorted((left, right) => (left.documentDate ?? "").localeCompare(right.documentDate ?? ""))
        .map((version) => version.versionCode)
    ).toEqual(["ih", "enr"])
  })

  it("replays a partially failed Congress window without skipping or duplicating bills", async () => {
    const fixture = JSON.parse(
      await readFile(resolve(process.cwd(), "tests/fixtures/congress/119-hr-1234.json"), "utf8")
    ) as {
      actions: Array<Record<string, unknown>>
      bill: Record<string, unknown>
      cosponsors: Array<Record<string, unknown>>
    } & Record<string, unknown>
    const references = [
      {
        congress: 119,
        number: "4321",
        type: "HR",
        updateDate: "2025-04-01T00:00:00Z",
        url: "https://api.congress.gov/v3/bill/119/hr/4321"
      },
      {
        congress: 119,
        number: "1234",
        type: "HR",
        updateDate: "2025-04-02T00:00:00Z",
        url: "https://api.congress.gov/v3/bill/119/hr/1234"
      }
    ]
    let failFirst = true
    let includeLaterUpdate = false
    const client = {
      getBillBundle: async (reference: (typeof references)[number]) => {
        if (reference.number === "4321" && failFirst) {
          failFirst = false
          throw new Error("controlled record failure")
        }
        return {
          ...fixture,
          actions:
            includeLaterUpdate && reference.number === "1234"
              ? [...fixture.actions, { actionDate: "2025-04-03", text: "Passed House" }]
              : fixture.actions,
          bill: {
            ...fixture.bill,
            number: reference.number,
            title: `Legislative Data Access Act ${reference.number}`,
            updateDate: reference.updateDate,
            url: reference.url
          },
          cosponsors:
            includeLaterUpdate && reference.number === "1234"
              ? [...fixture.cosponsors, { bioguideId: "E000003", fullName: "Representative Third" }]
              : fixture.cosponsors,
          textVersions:
            includeLaterUpdate && reference.number === "1234"
              ? [
                  {
                    date: "2025-04-03",
                    formats: [
                      {
                        type: "application/xml",
                        url: "https://www.govinfo.gov/content/pkg/BILLS-119hr1234eh/xml/BILLS-119hr1234eh.xml"
                      }
                    ],
                    type: "eh"
                  }
                ]
              : undefined
        }
      },
      listUpdated: async function* () {
        yield* references.map((reference) =>
          includeLaterUpdate && reference.number === "1234"
            ? { ...reference, updateDate: "2025-04-03T00:00:00Z" }
            : reference
        )
      }
    }
    const progress: Array<Readonly<Record<string, unknown>>> = []
    const options = {
      from: new Date("2025-03-01T00:00:00Z"),
      onProgress: (event: Readonly<Record<string, unknown>>) => progress.push(event),
      stream: "congress-restart-test",
      to: new Date("2025-05-01T00:00:00Z")
    }

    const first = await synchronizeCongress(database, client, options)
    expect(first).toMatchObject({ counts: { failed: 1 }, failures: [{ identifier: "119-HR-4321" }] })
    expect(first.checkpoint).toBeUndefined()
    expect(progress.map((event) => event.event)).toEqual(
      expect.arrayContaining(["checkpoint_start", "record_failed", "record_committed"])
    )

    const replay = await synchronizeCongress(database, client, options)
    expect(replay).toMatchObject({
      checkpoint: { canonicalId: "bill:us:119:hr:1234", updateDate: "2025-04-02T00:00:00Z" },
      counts: { failed: 0 }
    })
    expect(progress.map((event) => event.event)).toContain("checkpoint_committed")
    await expect(
      database.select().from(schema.bills).where(eq(schema.bills.id, "bill:us:119:hr:4321"))
    ).resolves.toHaveLength(1)

    const beforeIdentical = await Promise.all([
      database.select().from(schema.billActions).where(eq(schema.billActions.billId, "bill:us:119:hr:1234")),
      database.select().from(schema.billSponsors).where(eq(schema.billSponsors.billId, "bill:us:119:hr:1234"))
    ])
    const identical = await synchronizeCongress(database, client, options)
    expect(identical).toMatchObject({ counts: { failed: 0, unchanged: 2 } })
    const afterIdentical = await Promise.all([
      database.select().from(schema.billActions).where(eq(schema.billActions.billId, "bill:us:119:hr:1234")),
      database.select().from(schema.billSponsors).where(eq(schema.billSponsors.billId, "bill:us:119:hr:1234"))
    ])
    expect(afterIdentical.map((rows) => rows.length)).toEqual(beforeIdentical.map((rows) => rows.length))

    includeLaterUpdate = true
    const later = await synchronizeCongress(database, client, options)
    expect(later).toMatchObject({ counts: { failed: 0 } })
    await expect(
      database.select().from(schema.billActions).where(eq(schema.billActions.billId, "bill:us:119:hr:1234"))
    ).resolves.toHaveLength(beforeIdentical[0].length + 1)
    await expect(
      database.select().from(schema.billSponsors).where(eq(schema.billSponsors.billId, "bill:us:119:hr:1234"))
    ).resolves.toHaveLength(beforeIdentical[1].length + 1)
    await expect(
      database.select().from(schema.billDocuments).where(eq(schema.billDocuments.billId, "bill:us:119:hr:1234"))
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ versionCode: "eh" })]))

    let interruptAfterFirstRecord = true
    const pageClient = {
      getBillBundle: async (reference: (typeof references)[number]) => {
        if (reference.number === "1234" && interruptAfterFirstRecord) {
          interruptAfterFirstRecord = false
          throw new Error("controlled page interruption")
        }
        return {
          ...fixture,
          bill: {
            ...fixture.bill,
            number: reference.number,
            title: `Legislative Data Access Act ${reference.number}`,
            updateDate: reference.updateDate,
            url: reference.url
          }
        }
      },
      listUpdated: async function* () {
        yield* references
      }
    }
    const pageOptions = { ...options, onProgress: undefined, stream: "congress-page-commit-test" }
    const interruptedPage = await synchronizeCongress(database, pageClient, pageOptions)
    expect(interruptedPage).toMatchObject({ counts: { failed: 1 } })
    await expect(
      database.query.syncCheckpoints.findFirst({
        where: (table, operators) =>
          operators.and(operators.eq(table.source, "congress"), operators.eq(table.stream, pageOptions.stream))
      })
    ).resolves.toMatchObject({ cursor: { canonicalId: "bill:us:119:hr:4321" } })

    const pageReplay = await synchronizeCongress(database, pageClient, pageOptions)
    expect(pageReplay).toMatchObject({
      checkpoint: { canonicalId: "bill:us:119:hr:1234" },
      counts: { failed: 0 }
    })
    await expect(
      database.select().from(schema.bills).where(eq(schema.bills.id, "bill:us:119:hr:1234"))
    ).resolves.toHaveLength(1)
  })

  it("reports coverage and validates the assembled corpus", async () => {
    await database.insert(schema.votes).values({
      id: "vote:openstates:organization-target",
      motion: "Election of committee chair",
      organizationId: "organization:openstates:wa-data-committee",
      sourceId: "organization-target"
    })
    const coverage = await generateCoverageReport(database)
    expect(coverage).toMatchObject({
      checkpoints: expect.any(Array),
      documentProcessing: expect.arrayContaining([expect.objectContaining({ status: "processed" })]),
      documentQuality: {
        emptyText: expect.any(Number),
        extractionFailures: expect.any(Number),
        fallbackSegmentation: expect.any(Number),
        lowText: expect.any(Number),
        total: expect.any(Number)
      },
      embeddingCoverage: {
        bills: { embedded: expect.any(Number), total: expect.any(Number) },
        sections: { embedded: expect.any(Number), total: expect.any(Number) }
      },
      ingestionFailures: expect.any(Number),
      totals: { bills: expect.any(Number), documents: expect.any(Number) },
      version: 1
    })
    expect(coverage.totals.bills).toBeGreaterThan(0)
    expect(coverage.federalBillTypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ billType: "hr", congress: "119" })])
    )

    await expect(validateCorpus(database)).resolves.toMatchObject({ criticalIssues: 0, valid: true })
  })

  it("inspects representative structured, lexical, semantic, and passage query plans within the latency gate", async () => {
    const vector = `[${Array.from({ length: 1536 }, () => "0.1").join(",")}]`
    const cases = [
      {
        indexes: ["bills_introduced_idx"],
        query:
          "select id from legislation.bills where jurisdiction_id = 'jurisdiction:us' and introduced_at >= '2025-01-01' order by introduced_at limit 20"
      },
      {
        indexes: ["bills_search_vector_gin_idx"],
        query:
          "select id from legislation.bills where search_vector @@ websearch_to_tsquery('english', 'Federal data') order by ts_rank_cd(search_vector, websearch_to_tsquery('english', 'Federal data')) desc limit 20"
      },
      {
        indexes: ["bills_embedding_hnsw_idx"],
        query: `select id from legislation.bills where embedding is not null order by embedding <=> '${vector}'::vector limit 20`
      },
      {
        indexes: ["document_sections_search_vector_gin_idx"],
        query:
          "select id from legislation.document_sections where search_vector @@ websearch_to_tsquery('english', 'data shall be open') order by ts_rank_cd(search_vector, websearch_to_tsquery('english', 'data shall be open')) desc limit 20"
      },
      {
        indexes: ["bills_search_vector_gin_idx", "bills_embedding_hnsw_idx"],
        query: `with lexical as (
          select id from legislation.bills
          where search_vector @@ websearch_to_tsquery('english', 'Federal data')
          order by ts_rank_cd(search_vector, websearch_to_tsquery('english', 'Federal data')) desc limit 20
        ), semantic as (
          select id from legislation.bills where embedding is not null
          order by embedding <=> '${vector}'::vector limit 20
        ) select coalesce(lexical.id, semantic.id) from lexical full join semantic using (id)`
      }
    ]

    await pool.query("begin")
    try {
      await pool.query("set local enable_seqscan = off")
      for (const queryCase of cases) {
        const result = await pool.query<{ "QUERY PLAN": Array<Record<string, unknown>> }>(
          `explain (analyze, buffers, format json) ${queryCase.query}`
        )
        const plan = result.rows[0]?.["QUERY PLAN"]
        expect(plan).toBeDefined()
        const serialized = JSON.stringify(plan)
        for (const index of queryCase.indexes) {
          expect(serialized).toContain(index)
        }
        const executionTime = Number(plan?.[0]?.["Execution Time"])
        expect(executionTime).toBeLessThan(2000)
      }
    } finally {
      await pool.query("rollback")
    }
  })
})
