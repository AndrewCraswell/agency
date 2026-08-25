import { describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import {
  createResourceBatchReadRepositoryFromCanonicalReads,
  createResourceBatchReadRepository,
  type CanonicalResource,
  type ResourceBatchRequestItem
} from "./resource-batch-read-repository.js"

const jurisdiction: CanonicalResource = {
  canonicalUrl: "https://api.example.test/api/jurisdictions/jurisdiction%3Aus",
  classification: "country",
  id: "jurisdiction:us",
  isActive: true,
  name: "United States",
  sources: [
    {
      isOfficial: true,
      provider: "test",
      retrievedAt: "2026-08-24T12:00:00.000Z",
      sourceUpdatedAt: null,
      sourceUrl: "https://source.example.test/jurisdiction/us"
    }
  ],
  timezone: "UTC",
  type: "jurisdiction",
  updatedAt: "2026-08-24T12:00:00.000Z"
}

const documentRead = {
  billId: "bill:us:119:hr:1",
  byteSize: null,
  classification: "version" as const,
  contentHash: null,
  createdAt: new Date("2026-08-24T12:00:00.000Z"),
  documentDate: "2026-08-24",
  failureCategory: null,
  id: "document:us:119:hr:1",
  mimeType: "application/pdf",
  ocrCompletedAt: null,
  ocrProvider: null,
  ocrStatus: "not-required" as const,
  pageCount: null,
  processingStatus: "processed" as const,
  sectionCount: 2,
  sourceUrl: "https://source.example.test/document/us-119-hr-1",
  storedUrl: null,
  textCharacterCount: 120,
  title: "Bill document",
  updatedAt: new Date("2026-08-24T12:00:00.000Z"),
  versionCode: null
}

const supportingMaterialRead = {
  amendmentIds: ["amendment:us:119:1"],
  billIds: ["bill:us:119:hr:1"],
  byteSize: null,
  classification: "committee-report",
  contentType: "application/pdf",
  createdAt: "2026-08-24T12:00:00.000Z",
  documentDate: "2026-08-24",
  id: "material:us:119:1",
  jurisdictionId: "jurisdiction:us",
  meetingIds: ["meeting:us:119:1"],
  organizationIds: ["organization:us:house"],
  pageCount: null,
  processingStatus: "processed",
  sectionCount: 1,
  sourceUrl: "https://source.example.test/material/us-119-1",
  storedUrl: null,
  textCharacterCount: 120,
  title: "Committee report",
  updatedAt: "2026-08-24T12:00:00.000Z"
}

describe("CanonicalResourceBatchRepository", () => {
  it("dispatches the requested type and preserves the exact resource ID", async () => {
    const received: string[] = []
    const repository = createResourceBatchReadRepository({
      jurisdiction: async (id) => {
        received.push(id)
        return jurisdiction
      }
    })

    const input: ResourceBatchRequestItem = { id: jurisdiction.id, type: "jurisdiction" }
    await expect(repository.getResource(input)).resolves.toBe(jurisdiction)
    expect(received).toEqual([jurisdiction.id])
  })

  it("fails closed when a canonical resolver is not available", async () => {
    const repository = createResourceBatchReadRepository({})

    await expect(repository.getResource({ id: "calendar:us", type: "calendar" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
  })

  it("preserves not-found and forbidden errors from canonical resolvers", async () => {
    const notFound = new LegislationError("not_found", "Jurisdiction was not found")
    const forbidden = new LegislationError("forbidden", "Jurisdiction is not visible")
    const repository = createResourceBatchReadRepository({
      jurisdiction: async () => {
        throw notFound
      },
      session: async () => {
        throw forbidden
      }
    })

    await expect(repository.getResource({ id: "jurisdiction:missing", type: "jurisdiction" })).rejects.toBe(notFound)
    await expect(repository.getResource({ id: "session:secret", type: "session" })).rejects.toBe(forbidden)
  })

  it("composes existing document and supporting-material detail reads", async () => {
    const received: string[] = []
    const repository = createResourceBatchReadRepositoryFromCanonicalReads({
      apiBaseUrl: "https://api.example.test",
      coreReadApi: {
        getSupportingMaterial: async ({ id }) => {
          received.push(`supporting-material:${id}`)
          return { material: supportingMaterialRead }
        }
      },
      documentReadApi: {
        getDocumentDetail: async (id) => {
          received.push(`document:${id}`)
          return documentRead
        }
      }
    })

    await expect(repository.getResource({ id: documentRead.id, type: "document" })).resolves.toMatchObject({
      id: documentRead.id,
      type: "document"
    })
    await expect(
      repository.getResource({ id: supportingMaterialRead.id, type: "supporting-material" })
    ).resolves.toMatchObject({ id: supportingMaterialRead.id, type: "supporting-material" })
    await expect(repository.getResource({ id: "bill:unavailable", type: "bill" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
    await expect(repository.getResource({ id: "person:unavailable", type: "person" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
    expect(received).toEqual([`document:${documentRead.id}`, `supporting-material:${supportingMaterialRead.id}`])
  })
})
