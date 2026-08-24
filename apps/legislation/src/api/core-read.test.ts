import { afterEach, describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "./core-read.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-api-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: CoreReadQueryApi) {
  const server = createLegislationServer({ apiHandler: createCoreReadApiHandler(service), logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function bill(id = "bill:us:119:hr:1") {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-20T15:00:00Z"),
    id,
    identifier: "HR 1",
    introducedAt: new Date("2026-01-01T00:00:00Z"),
    jurisdictionId: "jurisdiction:us",
    latestActionAt: new Date("2026-02-01T00:00:00Z"),
    sessionId: "session:us:119",
    sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1",
    status: "introduced",
    subjects: ["Government"],
    title: "Test bill",
    updatedAt: new Date("2026-08-20T15:00:00Z"),
    upstreamIds: { congress: "119-hr-1" }
  }
}

function supportingMaterial(id = "material:us:119:committee-report:1") {
  return {
    amendmentIds: ["amendment:us:119:hamdt:1"],
    billIds: ["bill:us:119:hr:1"],
    byteSize: null,
    classification: "committee-report",
    contentType: "application/pdf",
    createdAt: new Date("2026-08-20T15:00:00Z"),
    documentDate: "2026-02-01",
    id,
    jurisdictionId: "jurisdiction:us",
    meetingIds: ["event:us:119:committee:1"],
    organizationIds: ["organization:us:house:committee"],
    pageCount: null,
    processingStatus: "processed",
    sectionCount: 3,
    sourceUrl: "https://api.congress.gov/v3/committee-report/1",
    storedUrl: null,
    textCharacterCount: 1234,
    title: "Committee report",
    updatedAt: new Date("2026-08-20T15:00:00Z"),
    upstreamIds: { congress: "committee-report-1" }
  }
}

function service(): CoreReadQueryApi {
  return {
    browseBills: async () => ({ items: [bill()], truncated: false }),
    findRelatedBills: async () => ({ items: [], truncated: false }),
    getAmendment: async ({ id }) => ({ amendment: { id } }),
    getBill: async ({ id }) => ({ bill: { id } }),
    getBillText: async () => ({ sections: [{ id: "section:1" }], truncated: false }),
    getBillTimeline: async () => ({ events: [{ id: "action:1" }], truncated: false }),
    getBillVotes: async ({ billId }) => ({ items: [], billId, truncated: false }),
    getDocument: async ({ id }) => ({ document: { id } }),
    getDocumentSection: async ({ documentId, sectionId }) => ({
      document: {
        billId: "bill:us:119:hr:1",
        createdAt: new Date("2026-08-20T15:00:00Z"),
        id: documentId,
        sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/text",
        updatedAt: new Date("2026-08-20T15:00:00Z"),
        upstreamIds: { congress: "119-hr-1" }
      },
      section: {
        contentHash: "a".repeat(64),
        heading: null,
        id: sectionId,
        ordinal: 0,
        pageEnd: 2,
        pageStart: 1,
        sourceEndOffset: 10,
        sourceStartOffset: 0,
        text: "Text"
      }
    }),
    getDocumentSections: async () => ({ items: [], truncated: false }),
    getJurisdiction: async (id) => ({ id }),
    getSession: async (id) => ({ id }),
    getSupportingMaterial: async ({ id }) => ({ material: supportingMaterial(id) }),
    getSupportingMaterialSection: async ({ materialId, sectionId }) => ({
      material: {
        createdAt: new Date("2026-08-20T15:00:00Z"),
        id: materialId,
        sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/text",
        updatedAt: new Date("2026-08-20T15:00:00Z"),
        upstreamIds: { congress: "119-hr-1" }
      },
      section: { contentHash: "b".repeat(64), heading: null, id: sectionId, ordinal: 0, text: "Text" }
    }),
    getVote: async ({ id }) => ({ vote: { id } }),
    listJurisdictions: async () => ({ items: [{ id: "jurisdiction:us" }], truncated: false }),
    listSessions: async () => ({ items: [{ id: "session:us:119" }], truncated: false }),
    searchAmendments: async () => ({ items: [], truncated: false, warnings: [] }),
    searchChanges: async () => ({ items: [], truncated: false }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false }),
    searchVotes: async () => ({ items: [], truncated: false })
  }
}

describe("core read API handler", () => {
  it("leaves BillDetail, batch, and timeline routes unregistered until the query service preserves their contract facts", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/timeline`),
      fetch(`${baseUrl}/api/bills/batch`, { body: JSON.stringify({ ids: ["bill:us:119:hr:1"] }), method: "POST" })
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
  })

  it("leaves jurisdiction and session canonical routes unregistered until persisted contract provenance exists", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions?limit=10`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/sessions`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
  })

  it("leaves vote routes unregistered until persisted canonical vote facts exist", async () => {
    let billVoteReads = 0
    let voteReads = 0
    let voteSearches = 0
    const voteService = Object.assign(service(), {
      getBillVotes: async () => {
        billVoteReads += 1
        return { items: [], truncated: false }
      },
      getVote: async () => {
        voteReads += 1
        return {}
      },
      searchVotes: async () => {
        voteSearches += 1
        return { items: [], truncated: false }
      }
    })
    const baseUrl = await startServer(voteService)
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/votes`),
      fetch(`${baseUrl}/api/votes/vote%3Aus%3A119%3Ahouse%3A1`),
      fetch(`${baseUrl}/api/votes/batch`, {
        body: JSON.stringify({ ids: ["vote:us:119:house:1"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/votes`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
    expect({ billVoteReads, voteReads, voteSearches }).toEqual({ billVoteReads: 0, voteReads: 0, voteSearches: 0 })
  })

  it("keeps absent route slices absent instead of manufacturing a placeholder response", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/subscriptions`)

    expect(response.status).toBe(404)
  })

  it("keeps incomplete canonical amendment routes unregistered", async () => {
    let amendmentReads = 0
    let amendmentSearches = 0
    const baseUrl = await startServer({
      ...service(),
      getAmendment: async ({ id }) => {
        amendmentReads += 1
        return { amendment: { id } }
      },
      searchAmendments: async () => {
        amendmentSearches += 1
        return { items: [], truncated: false }
      }
    })

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/amendments`),
      fetch(`${baseUrl}/api/amendments/amendment%3Aus%3A119%3Ahr%3A1`),
      fetch(`${baseUrl}/api/amendments/batch`, {
        body: JSON.stringify({ ids: ["amendment:us:119:hr:1"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
    expect(amendmentReads).toBe(0)
    expect(amendmentSearches).toBe(0)
  })

  it("projects jurisdiction and session bill pages with trusted canonical URLs and source provenance", async () => {
    const baseUrl = await startServer(service())
    const [jurisdiction, session] = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills`, { headers: { host: "untrusted.example" } }),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/bills`, { headers: { host: "untrusted.example" } })
    ])

    for (const response of [jurisdiction, session]) {
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            canonicalUrl: "http://127.0.0.1:3100/api/bills/bill%3Aus%3A119%3Ahr%3A1",
            latestActionAt: "2026-02-01T00:00:00.000Z",
            sources: [{ isOfficial: true, provider: "congress" }],
            type: "bill"
          }
        ]
      })
    }
  })

  it("maps every documented global bill filter and returns canonical bill summaries", async () => {
    let received: Parameters<CoreReadQueryApi["browseBills"]>[0] | undefined
    const baseUrl = await startServer({
      ...service(),
      browseBills: async (input) => {
        received = input
        return { items: [bill()], truncated: false }
      }
    })
    const response = await fetch(
      `${baseUrl}/api/bills?classification=bill&classification=resolution&cursor=eyJvZmZzZXQiOjB9&identifier=HR&introducedFrom=2026-01-01&introducedTo=2026-01-31&jurisdictionId=jurisdiction%3Aus&limit=7&organizationId=organization%3Aus%3Ahouse%3Arules&sessionId=session%3Aus%3A119&sort=updated-desc&sponsorPersonId=person%3Aus%3A1&status=introduced&status=referred&subject=budget&subject=taxes&updatedFrom=2026-08-20T12%3A00%3A00Z`
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "http://127.0.0.1:3100/api/bills/bill%3Aus%3A119%3Ahr%3A1",
          sources: [{ isOfficial: true, provider: "congress" }],
          type: "bill"
        }
      ],
      meta: { limit: 7 }
    })
    expect(received).toEqual({
      classification: ["bill", "resolution"],
      cursor: "eyJvZmZzZXQiOjB9",
      identifier: "HR",
      introducedFrom: "2026-01-01",
      introducedTo: "2026-01-31",
      jurisdictionId: "jurisdiction:us",
      limit: 7,
      organizationId: "organization:us:house:rules",
      sessionId: "session:us:119",
      sort: "updated-desc",
      sponsorPersonId: "person:us:1",
      status: ["introduced", "referred"],
      subject: ["budget", "taxes"],
      updatedFrom: new Date("2026-08-20T12:00:00.000Z")
    })
  })

  it("rejects malformed global bill filters and undocumented query controls", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills?updatedFrom=2026-08-20`),
      fetch(`${baseUrl}/api/bills?updatedFrom=2026-08-20T12%3A00%3A00Z&updatedFrom=2026-08-21T12%3A00%3A00Z`),
      fetch(`${baseUrl}/api/bills?introducedFrom=2026-02-01&introducedTo=2026-01-01`),
      fetch(`${baseUrl}/api/bills?sort=unrecognized`),
      fetch(`${baseUrl}/api/bills?q=budget`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400])
    for (const response of responses) {
      await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    }
  })

  it("preserves a persisted null bill status without manufacturing one", async () => {
    const baseUrl = await startServer({
      ...service(),
      browseBills: async () => ({ items: [{ ...bill(), status: null }], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: [{ status: null }] })
  })

  it("returns 422 instead of an incomplete bill projection when persisted provenance is malformed", async () => {
    const baseUrl = await startServer({
      ...service(),
      browseBills: async () => ({ items: [{ ...bill(), sourceUrl: "not a URL" }], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("returns canonical parent-scoped section resources without trusting the Host header", async () => {
    const baseUrl = await startServer(service())
    const [document, material] = await Promise.all([
      fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1`, { headers: { host: "untrusted.example" } }),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1`, {
        headers: { host: "untrusted.example" }
      })
    ])

    expect(document.status).toBe(200)
    expect(material.status).toBe(200)
    await expect(document.json()).resolves.toMatchObject({
      data: { canonicalUrl: "http://127.0.0.1:3100/api/documents/document%3A1/sections/section%3A1" }
    })
    await expect(material.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "http://127.0.0.1:3100/api/supporting-materials/material%3A1/sections/section%3A1"
      }
    })
  })

  it("forwards both parent IDs to the singular repository reads and uses resource envelopes", async () => {
    const calls: {
      document?: Readonly<{ documentId: string; sectionId: string }>
      material?: Readonly<{ materialId: string; sectionId: string }>
    } = {}
    const base = service()
    const baseDocumentSection = base.getDocumentSection
    const baseSupportingMaterialSection = base.getSupportingMaterialSection
    if (baseDocumentSection === undefined || baseSupportingMaterialSection === undefined) {
      throw new Error("Section fixtures must include both singular repository reads")
    }
    const baseUrl = await startServer({
      ...base,
      getDocumentSection: async (input) => {
        calls.document = input
        return await baseDocumentSection(input)
      },
      getSupportingMaterialSection: async (input) => {
        calls.material = input
        return await baseSupportingMaterialSection(input)
      }
    })
    const documentPath = "/api/documents/document%3A1%2Ftext/sections/document-section%3A1%2Fpart"
    const materialPath = "/api/supporting-materials/material%3A1%2Freport/sections/material-section%3A1%2Fpart"
    const [document, material] = await Promise.all([
      fetch(`${baseUrl}${documentPath}`, { headers: { "x-correlation-id": "document-section-read" } }),
      fetch(`${baseUrl}${materialPath}`, { headers: { "x-correlation-id": "material-section-read" } })
    ])

    expect(document.status).toBe(200)
    expect(material.status).toBe(200)
    expect(calls).toEqual({
      document: { documentId: "document:1/text", sectionId: "document-section:1/part" },
      material: { materialId: "material:1/report", sectionId: "material-section:1/part" }
    })
    await expect(document.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "http://127.0.0.1:3100/api/documents/document%3A1%2Ftext/sections/document-section%3A1%2Fpart",
        documentId: "document:1/text",
        pageEnd: 2,
        pageStart: 1,
        type: "document-section"
      },
      links: { self: documentPath },
      meta: { correlationId: "document-section-read", warnings: [] }
    })
    await expect(material.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "http://127.0.0.1:3100/api/supporting-materials/material%3A1%2Freport/sections/material-section%3A1%2Fpart",
        materialId: "material:1/report",
        type: "supporting-material-section"
      },
      links: { self: materialPath },
      meta: { correlationId: "material-section-read", warnings: [] }
    })
  })

  it("fails closed for malformed supporting-material section provenance", async () => {
    const baseUrl = await startServer({
      ...service(),
      getSupportingMaterialSection: async ({ materialId, sectionId }) => ({
        material: {
          createdAt: new Date("2026-08-20T15:00:00Z"),
          id: materialId,
          sourceUrl: "not a URL",
          updatedAt: new Date("2026-08-20T15:00:00Z")
        },
        section: { contentHash: "b".repeat(64), heading: null, id: sectionId, ordinal: 0, text: "Text" }
      })
    })

    const response = await fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "unprocessable", retryable: false }
    })
  })

  it("returns parent-scoped absence and invalid path IDs as correlated contract errors", async () => {
    let sectionReads = 0
    const baseUrl = await startServer({
      ...service(),
      getDocumentSection: async () => {
        sectionReads += 1
        throw new LegislationError("not_found", "Document section was not found")
      },
      getSupportingMaterialSection: async () => {
        sectionReads += 1
        throw new LegislationError("not_found", "Supporting material section was not found")
      }
    })
    const tooLongId = "x".repeat(257)
    const [missingDocument, missingMaterial, malformedDocument, tooLongMaterial] = await Promise.all([
      fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3Aabsent`, {
        headers: { "x-correlation-id": "document-absence" }
      }),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3Aabsent`, {
        headers: { "x-correlation-id": "material-absence" }
      }),
      fetch(`${baseUrl}/api/documents/%ZZ/sections/section%3A1`, {
        headers: { "x-correlation-id": "invalid-document-id" }
      }),
      fetch(`${baseUrl}/api/supporting-materials/${tooLongId}/sections/section%3A1`, {
        headers: { "x-correlation-id": "invalid-material-id" }
      })
    ])

    expect([missingDocument.status, missingMaterial.status, malformedDocument.status, tooLongMaterial.status]).toEqual([
      404, 404, 400, 400
    ])
    expect(sectionReads).toBe(2)
    await expect(missingDocument.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "document-absence", retryable: false }
    })
    await expect(missingMaterial.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "material-absence", retryable: false }
    })
    await expect(malformedDocument.json()).resolves.toMatchObject({
      error: { category: "invalid_request", correlationId: "invalid-document-id", retryable: false }
    })
    await expect(tooLongMaterial.json()).resolves.toMatchObject({
      error: { category: "invalid_request", correlationId: "invalid-material-id", retryable: false }
    })
  })

  it("projects supporting-material collections with strict contract filters and ordering", async () => {
    let received: Parameters<CoreReadQueryApi["searchSupportingMaterials"]>[0] | undefined
    const baseUrl = await startServer({
      ...service(),
      searchSupportingMaterials: async (input) => {
        received = input
        return { items: [supportingMaterial()], truncated: false }
      }
    })
    const response = await fetch(
      `${baseUrl}/api/supporting-materials?amendmentId=amendment%3Aus%3A119%3Ahamdt%3A1&billId=bill%3Aus%3A119%3Ahr%3A1&classification=committee-report&documentFrom=2026-02-01&documentTo=2026-02-28&jurisdictionId=jurisdiction%3Aus&meetingId=event%3Aus%3A119%3Acommittee%3A1&organizationId=organization%3Aus%3Ahouse%3Acommittee&processingStatus=processed&sort=title-asc&limit=7`
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "http://127.0.0.1:3100/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1",
          processingStatus: "processed",
          sources: [{ isOfficial: true, provider: "congress" }],
          type: "supporting-material"
        }
      ],
      links: { next: null },
      meta: { limit: 7, truncated: false }
    })
    expect(received).toEqual({
      amendmentId: "amendment:us:119:hamdt:1",
      billId: "bill:us:119:hr:1",
      classification: "committee-report",
      cursor: undefined,
      documentFrom: "2026-02-01",
      documentTo: "2026-02-28",
      eventId: "event:us:119:committee:1",
      jurisdictionId: "jurisdiction:us",
      limit: 7,
      mode: "lexical",
      organizationId: "organization:us:house:committee",
      processingStatus: "processed",
      sort: "title-asc"
    })
  })

  it("returns only the canonical supporting-material detail and rejects incomplete facts", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        byteSize: null,
        canonicalUrl: "http://127.0.0.1:3100/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1",
        pageCount: null,
        sectionCount: 3,
        storedUrl: null,
        textCharacterCount: 1234,
        type: "supporting-material"
      },
      links: { self: "/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1" }
    })

    const incompleteBaseUrl = await startServer({
      ...service(),
      getSupportingMaterial: async ({ id }) => ({ material: { ...supportingMaterial(id), sectionCount: -1 } })
    })
    const incomplete = await fetch(
      `${incompleteBaseUrl}/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1`
    )
    expect(incomplete.status).toBe(422)
    await expect(incomplete.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })

    const duplicateLinkBaseUrl = await startServer({
      ...service(),
      searchSupportingMaterials: async () => ({
        items: [{ ...supportingMaterial(), billIds: ["bill:us:119:hr:1", "bill:us:119:hr:1"] }],
        truncated: false
      })
    })
    const duplicateLinks = await fetch(`${duplicateLinkBaseUrl}/api/supporting-materials`)
    expect(duplicateLinks.status).toBe(422)
    await expect(duplicateLinks.json()).resolves.toMatchObject({
      error: { category: "unprocessable", retryable: false }
    })
  })

  it("rejects malformed, out-of-range, and undocumented supporting-material query controls", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/supporting-materials?documentFrom=2026-02-02&documentTo=2026-02-01`),
      fetch(`${baseUrl}/api/supporting-materials?documentFrom=2026-02-30`),
      fetch(`${baseUrl}/api/supporting-materials?processingStatus=unknown`),
      fetch(`${baseUrl}/api/supporting-materials?sort=unknown`),
      fetch(`${baseUrl}/api/supporting-materials?q=committee`),
      fetch(`${baseUrl}/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1?limit=1`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400])
    for (const response of responses) {
      await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    }
  })

  it("uses an observed unknown hostname as a conservative non-official provider", async () => {
    const baseUrl = await startServer({
      ...service(),
      getDocumentSection: async ({ documentId, sectionId }) => ({
        document: {
          billId: "bill:1",
          createdAt: new Date("2026-08-20T15:00:00Z"),
          id: documentId,
          sourceUrl: "https://publisher.example/document",
          updatedAt: new Date("2026-08-20T15:00:00Z")
        },
        section: {
          contentHash: "a".repeat(64),
          heading: null,
          id: sectionId,
          ordinal: 0,
          sourceEndOffset: 1,
          sourceStartOffset: 0,
          text: "Text"
        }
      })
    })

    const response = await fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { sources: [{ isOfficial: false, provider: "publisher.example" }] }
    })
  })

  it("fails closed with 422 when persisted section provenance has a malformed source URL", async () => {
    const baseUrl = await startServer({
      ...service(),
      getDocumentSection: async ({ documentId, sectionId }) => ({
        document: {
          billId: "bill:1",
          createdAt: new Date("2026-08-20T15:00:00Z"),
          id: documentId,
          sourceUrl: "not a URL",
          updatedAt: new Date("2026-08-20T15:00:00Z")
        },
        section: {
          contentHash: "a".repeat(64),
          heading: null,
          id: sectionId,
          ordinal: 0,
          sourceEndOffset: 1,
          sourceStartOffset: 0,
          text: "Text"
        }
      })
    })

    const response = await fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("leaves incomplete relationship, document, and change routes unregistered without querying the service", async () => {
    let amendmentSearches = 0
    let billTextReads = 0
    let changeSearches = 0
    let documentReads = 0
    let documentSectionPages = 0
    let relatedBillSearches = 0
    const baseUrl = await startServer({
      ...service(),
      findRelatedBills: async () => {
        relatedBillSearches += 1
        return { items: [], truncated: false }
      },
      getBillText: async () => {
        billTextReads += 1
        return { sections: [], truncated: false }
      },
      getDocument: async () => {
        documentReads += 1
        return { document: {} }
      },
      getDocumentSections: async () => {
        documentSectionPages += 1
        return { items: [], truncated: false }
      },
      searchAmendments: async () => {
        amendmentSearches += 1
        return { items: [], truncated: false }
      },
      searchChanges: async () => {
        changeSearches += 1
        return { items: [], truncated: false }
      }
    })
    const billId = "bill%3Aus%3A119%3Ahr%3A1"
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/amendments/batch`, {
        body: JSON.stringify({ billIds: ["bill:us:119:hr:1"], limitPerBill: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/bills/${billId}/related?mode=explicit`),
      fetch(`${baseUrl}/api/bills/${billId}/sections`),
      fetch(`${baseUrl}/api/bills/${billId}/amendments?limit=1`),
      fetch(`${baseUrl}/api/changes?limit=1`),
      fetch(`${baseUrl}/api/bills/${billId}/changes?limit=1`),
      fetch(`${baseUrl}/api/documents/document%3A1`),
      fetch(`${baseUrl}/api/documents/document%3A1/sections?limit=1`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404, 404, 404, 404, 404])
    expect({
      amendmentSearches,
      billTextReads,
      changeSearches,
      documentReads,
      documentSectionPages,
      relatedBillSearches
    }).toEqual({
      amendmentSearches: 0,
      billTextReads: 0,
      changeSearches: 0,
      documentReads: 0,
      documentSectionPages: 0,
      relatedBillSearches: 0
    })
  })

  it("rejects route suffixes and unsupported query parameters", async () => {
    const baseUrl = await startServer(service())
    const [extraSegment, typo] = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/votes/extra`),
      fetch(`${baseUrl}/api/bills?limti=20`)
    ])

    expect(extraSegment.status).toBe(404)
    expect(typo.status).toBe(400)
    await expect(typo.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })

  it("maps jurisdiction and session bill collection filters into scoped service calls", async () => {
    const billInputs: Parameters<CoreReadQueryApi["browseBills"]>[0][] = []
    const baseUrl = await startServer({
      ...service(),
      browseBills: async (input) => {
        billInputs.push(input)
        return { items: [bill("bill:1")], truncated: false }
      }
    })

    const responses = await Promise.all([
      fetch(
        `${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?classification=bill&status=introduced&subject=budget&introducedFrom=2026-01-01&introducedTo=2026-01-31&sessionId=session%3Aus%3A119&sort=introduced-desc&limit=7`
      ),
      fetch(
        `${baseUrl}/api/sessions/session%3Aus%3A119/bills?classification=resolution&status=passed&subject=education&sort=identifier-asc&limit=8`
      )
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    for (const response of responses) {
      await expect(response.json()).resolves.toMatchObject({
        data: expect.any(Array),
        links: { next: null },
        meta: { truncated: false }
      })
    }
    expect(billInputs).toEqual([
      {
        classification: ["bill"],
        cursor: undefined,
        introducedFrom: "2026-01-01",
        introducedTo: "2026-01-31",
        jurisdictionId: "jurisdiction:us",
        limit: 7,
        sessionId: "session:us:119",
        sort: "introduced-desc",
        status: ["introduced"],
        subject: ["budget"]
      },
      {
        classification: ["resolution"],
        cursor: undefined,
        introducedFrom: undefined,
        introducedTo: undefined,
        jurisdictionId: undefined,
        limit: 8,
        sessionId: "session:us:119",
        sort: "identifier-asc",
        status: ["passed"],
        subject: ["education"]
      }
    ])
  })

  it("rejects invalid scoped collection filters and non-exact routes", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?status=introduced&status=introduced`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/bills?introducedFrom=2026-02-01&introducedTo=2026-01-01`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?sort=unknown`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings?from=2026-02-01&from=2026-02-02`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/meetings`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/meetings/extra`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 404, 404, 404, 404])
    for (const response of responses.slice(0, 3)) {
      await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    }
  })
})
