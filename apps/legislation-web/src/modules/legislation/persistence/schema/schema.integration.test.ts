import { createServer, type Server } from "node:http"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { embeddingRouteFor } from "@repo/legislation-core/embeddings/embedding-routing"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { createAmendmentReadRepository } from "../../../request-handling/api/amendment-read-repository"
import { createBillDetailReadRepository } from "../../../request-handling/api/bill-detail-read-repository"
import { createCivicSearchApiHandler } from "../../../request-handling/api/civic-search"
import { encodeSearchCursor, lexicalBillSearch, lexicalPassageSearch, semanticBillSearch } from "../../../search/search"
import { generateCoverageReport } from "../../coverage/report"
import { LegislationQueryService } from "../../query-service"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = dirname(
  fileURLToPath(import.meta.resolve("@repo/legislation-core/database/migrations/0000_melted_captain_america.sql"))
)
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

describePostgres.sequential("legislation PostgreSQL serving", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })

  async function seedDocumentSections(documentId: string, sections: string[]) {
    let offset = 0
    await database.insert(schema.documentSections).values(
      sections.map((text, ordinal) => {
        const sourceStartOffset = offset
        offset += text.length + 2
        return {
          contentHash,
          documentId,
          heading: text.split("\n")[0],
          id: `${documentId}:section:${ordinal + 1}`,
          ordinal,
          sectionIdentifier: String(ordinal + 1),
          sourceEndOffset: sourceStartOffset + text.length,
          sourceStartOffset,
          text
        }
      })
    )
    await database
      .update(schema.billDocuments)
      .set({
        contentHash,
        processingStatus: "processed",
        text: sections.join("\n\n")
      })
      .where(eq(schema.billDocuments.id, documentId))
  }

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await database.insert(schema.jurisdictions).values([
      { classification: "country", countryCode: "US", id: "jurisdiction:us", name: "United States" },
      { classification: "state", countryCode: "US", id: "jurisdiction:or", name: "Oregon", subdivisionCode: "OR" }
    ])
    await database.insert(schema.legislativeSessions).values([
      { id: "session:us:119", identifier: "119", jurisdictionId: "jurisdiction:us", name: "119th Congress" },
      { id: "session:or:2025", identifier: "2025", jurisdictionId: "jurisdiction:or", name: "2025 Regular Session" }
    ])
    await database.insert(schema.bills).values({
      id: "bill:us:119:hr:1234",
      identifier: "HR 1234",
      introducedAt: "2025-01-01",
      jurisdictionId: "jurisdiction:us",
      sessionId: "session:us:119",
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1234",
      title: "Federal data access, updated",
      embedding: Array.from({ length: 1536 }, () => 0.1)
    })
    const documentId = "bill:us:119:hr:1234:document:introduced"
    await database.insert(schema.billDocuments).values({
      billId: "bill:us:119:hr:1234",
      classification: "version",
      id: documentId,
      sourceUrl: "https://www.govinfo.gov/example.xml",
      title: "Introduced",
      versionCode: "ih"
    })
    await seedDocumentSections(documentId, [
      "SECTION 1. SHORT TITLE.\nThis Act may be cited.",
      "SEC. 2. DATA.\nData shall be open."
    ])
    const route = embeddingRouteFor("bill")
    await database.insert(schema.billEmbeddings).values({
      billId: "bill:us:119:hr:1234",
      dimensions: route.dimensions,
      embedding: Array.from({ length: route.dimensions }, () => 0.1),
      inputContract: route.embeddingInputContract,
      inputHash: contentHash,
      model: route.model,
      rolloutId: "test"
    })
    {
      const jurisdictionId = "jurisdiction:wa"
      const sessionId = "session:wa:2025-2026"
      const billId = "bill:wa:2025-2026:hb:1234"
      const relatedBillId = "bill:wa:2025-2026:sb:5678"
      const personId = "person:openstates:person-1"
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
    }
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("reads document sections only within their canonical document", async () => {
    const billId = "bill:wa:2025-2026:hb:1234"
    const relatedBillId = "bill:wa:2025-2026:sb:5678"
    const documentId = billId + ":document:introduced"
    const queryService = new LegislationQueryService(database)
    const documentSectionId = `${documentId}:section:1`
    await expect(queryService.getDocumentSection({ documentId, sectionId: documentSectionId })).resolves.toMatchObject({
      document: { billId, id: documentId },
      section: { documentId, id: documentSectionId }
    })
    await expect(
      queryService.getDocumentSection({ documentId: relatedBillId, sectionId: documentSectionId })
    ).rejects.toMatchObject({ category: "not_found" })
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
    await expect(service.searchMentionRecords("Eample")).resolves.toMatchObject({
      people: { items: [expect.objectContaining({ id: "person:openstates:person-1", name: "Representative Example" })] }
    })
    await expect(service.searchMentionRecords("Datta")).resolves.toMatchObject({
      committees: { items: [expect.objectContaining({ id: organizationId, classification: "committee" })] }
    })
  })

  it("retrieves canonical bill text, amendments, votes, versions, and related bills", async () => {
    const documentId = "bill:us:119:hr:1234:document:introduced"
    await expect(
      lexicalBillSearch(database, { jurisdictionIds: ["jurisdiction:us"], query: '"Federal data"' })
    ).resolves.toMatchObject({ items: [{ id: "bill:us:119:hr:1234" }] })
    await expect(lexicalPassageSearch(database, { query: '"data shall be open"' })).resolves.toMatchObject({
      items: [{ bill: { id: "bill:us:119:hr:1234" }, document: { id: documentId } }]
    })

    const billRoute = embeddingRouteFor("bill")
    const billEmbedding = Array.from({ length: billRoute.dimensions }, () => 0.1)
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
    await seedDocumentSections(secondDocumentId, [
      "SECTION 1. SHORT TITLE.\nThis Act may be cited as the Updated Act.",
      "SEC. 2. DATA.\nData shall be open."
    ])
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
    const billText = await service.searchBillText({
      billIds: ["bill:us:119:hr:1234"],
      query: '"data shall be open"'
    })
    expect(billText.items.some((item) => item.bill.id === "bill:us:119:hr:1234")).toBe(true)
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

  it("retrieves canonical supporting-material sections lexically, semantically, and with hybrid ranking", async () => {
    const materialId = "material:us:119:committee-report:1"
    const route = embeddingRouteFor("supporting-material-section")
    const embedding = Array.from({ length: route.dimensions }, () => 0.1)
    await database.insert(schema.supportingMaterials).values({
      classification: "committee-report",
      id: materialId,
      jurisdictionId: "jurisdiction:us",
      processingStatus: "processed",
      sourceId: "committee-report-1",
      sourceUrl: "https://example.test/committee-report.txt",
      title: "Committee report on federal data"
    })
    const text = "SECTION 1. FINDINGS.\nThe committee found improved public data access."
    const sectionId = `${materialId}:section:1`
    await database.insert(schema.supportingMaterialSections).values({
      contentHash,
      id: sectionId,
      materialId,
      ordinal: 0,
      sourceEndOffset: text.length,
      sourceStartOffset: 0,
      text
    })
    await database.insert(schema.supportingMaterialSectionEmbeddings).values({
      dimensions: route.dimensions,
      embedding,
      inputContract: route.embeddingInputContract,
      inputHash: contentHash,
      model: route.model,
      rolloutId: "test",
      sectionId
    })
    const retrievalClient = {
      embed: async (_product: string, input: string[]) => ({
        embeddings: input.map(() => embedding),
        model: route.model
      }),
      rerank: async (_tool: string, _query: string, candidates: Array<{ id: string; text: string }>) =>
        candidates.map((candidate, index) => ({ ...candidate, relevanceScore: 1 - index / 100 }))
    }
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

  it("reports coverage of canonical serving records", async () => {
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
  })

  it("round-trips a mixed bill-detail amendment cursor through the repository without skips or scope widening", async () => {
    const jurisdictionId = "jurisdiction:cursor-contract"
    const sessionId = "session:cursor-contract:2026"
    const billId = "bill:us:119:hr:cursor"
    const apiBaseUrl = "https://api.example.test"
    const childLimit = 2

    await database.insert(schema.jurisdictions).values({
      classification: "country",
      countryCode: "US",
      id: jurisdictionId,
      name: "Cursor Contract"
    })
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      identifier: "119",
      jurisdictionId,
      name: "119th Congress"
    })
    await database.insert(schema.bills).values({
      id: billId,
      identifier: "HR Cursor",
      jurisdictionId,
      sessionId,
      sourceUrl: "https://source.example.test/bills/cursor",
      title: "Cursor contract bill"
    })
    await database.insert(schema.amendments).values(
      Array.from({ length: childLimit + 1 }, (_value, index) => ({
        amendmentNumber: String(index + 1),
        amendmentType: "floor",
        billId,
        id: `amendment:cursor:${index + 1}`,
        jurisdictionId,
        printedIdentifier: `Structured ${index + 1}`,
        sourceId: `cursor:structured:${index + 1}`,
        sourceUrl: `https://source.example.test/amendments/structured/${index + 1}`,
        status: "introduced",
        submittedDate: "2026-02-01"
      }))
    )
    await database.insert(schema.billDocuments).values(
      Array.from({ length: childLimit + 1 }, (_value, index) => ({
        billId,
        classification: "amendment",
        documentDate: "2026-02-01",
        id: `${billId}:document:amendment:${index + 1}`,
        ocrStatus: "not-required",
        processingStatus: "processed",
        sourceUrl: `https://source.example.test/amendments/document/${index + 1}`,
        title: `Document ${index + 1}`
      }))
    )

    const billRepository = createBillDetailReadRepository(database, apiBaseUrl)
    const amendmentRepository = createAmendmentReadRepository(database, apiBaseUrl)
    const detail = await billRepository.getBillDetail({ childLimit, id: billId })
    const firstCursor = detail.childPageInfo.amendments.nextCursor
    expect(firstCursor).not.toBeNull()

    const continuationItems: (typeof detail.amendments)[number][] = []
    for (let cursor = firstCursor; cursor !== null; ) {
      const page = await amendmentRepository.listAmendments({ billId, cursor, limit: childLimit })
      continuationItems.push(...page.items)
      cursor = page.nextCursor ?? null
    }
    const fullCollection = await amendmentRepository.listAmendments({ billId, limit: 100 })
    const combinedIds = [...detail.amendments, ...continuationItems].map((item) => item.id)

    expect(combinedIds).toEqual(fullCollection.items.map((item) => item.id))
    expect(new Set(combinedIds).size).toBe(fullCollection.items.length)
    await expect(
      amendmentRepository.listAmendments({
        billId,
        cursor: firstCursor ?? undefined,
        limit: childLimit,
        recordTypes: ["document"]
      })
    ).rejects.toMatchObject({ category: "invalid_request" })
    await expect(
      amendmentRepository.listAmendments({
        billId,
        cursor: firstCursor ?? undefined,
        limit: childLimit,
        statuses: ["introduced"]
      })
    ).rejects.toMatchObject({ category: "invalid_request" })
    await expect(
      amendmentRepository.listAmendments({
        billId,
        cursor: firstCursor ?? undefined,
        limit: childLimit,
        submittedFrom: "2026-02-01"
      })
    ).rejects.toMatchObject({ category: "invalid_request" })
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

    const client = await pool.connect()
    try {
      await client.query("begin")
      await client.query("set local enable_seqscan = off")
      for (const queryCase of cases) {
        const result = await client.query<{ "QUERY PLAN": Array<Record<string, unknown>> }>(
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
      try {
        await client.query("rollback")
      } finally {
        client.release()
      }
    }
  })
})
