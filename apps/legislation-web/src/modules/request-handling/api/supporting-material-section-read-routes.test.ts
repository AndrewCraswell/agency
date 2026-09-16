import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import { close, createLegislationServer } from "../test-http-server.js"
import {
  createSupportingMaterialSectionReadApiHandler,
  type SupportingMaterialSectionReadApi
} from "./supporting-material-section-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({
  level: "error",
  service: "supporting-material-section-read-test",
  write: () => undefined
})

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: SupportingMaterialSectionReadApi) {
  const server = createLegislationServer({
    apiHandler: createSupportingMaterialSectionReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
    logger
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function service(): SupportingMaterialSectionReadApi {
  return {
    getSupportingMaterialSection: async ({ materialId, sectionId }) => ({
      material: {
        createdAt: new Date("2026-08-20T15:00:00.000Z"),
        id: materialId,
        sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
        sourceUrl: "https://api.congress.gov/v3/committee-report/1",
        updatedAt: new Date("2026-08-22T15:00:00.000Z")
      },
      section: {
        contentHash: "a".repeat(64),
        heading: "Findings",
        id: sectionId,
        ordinal: 2,
        text: "The persisted public section text."
      }
    })
  }
}

describe("supporting material section read API handler", () => {
  it("returns a parent-bound page with exact page controls and canonical provenance", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      assertSupportingMaterialExists: async (materialId) => {
        expect(materialId).toBe("material:us:119:report:1")
      },
      listSupportingMaterialSections: async (input) => {
        received = input
        return {
          items: [
            {
              material: {
                createdAt: new Date("2026-08-20T15:00:00.000Z"),
                id: input.materialId,
                sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
                sourceUrl: "https://api.congress.gov/v3/committee-report/1",
                updatedAt: new Date("2026-08-22T15:00:00.000Z")
              },
              section: {
                contentHash: "a".repeat(64),
                heading: "Findings",
                id: "material-section:us:119:report:1:2",
                ordinal: 2,
                pageEnd: 4,
                pageStart: 2,
                text: "The persisted public section text."
              }
            }
          ],
          nextCursor: "section-cursor",
          truncated: true
        }
      }
    })
    const path =
      "/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections?cursor=first&heading=Findings&limit=7&pageFrom=2&pageTo=4"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "material-sections-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: "first",
      heading: "Findings",
      limit: 7,
      materialId: "material:us:119:report:1",
      pageFrom: 2,
      pageTo: 4
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl:
            "https://api.example.test/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections/material-section%3Aus%3A119%3Areport%3A1%3A2",
          materialId: "material:us:119:report:1",
          pageEnd: 4,
          pageStart: 2,
          sourceUrl: "https://api.congress.gov/v3/committee-report/1",
          sources: [
            {
              isOfficial: true,
              provider: "congress",
              sourceUpdatedAt: "2026-08-21T15:00:00.000Z"
            }
          ],
          type: "supporting-material-section"
        }
      ],
      links: { next: expect.stringContaining("cursor=section-cursor"), self: path },
      meta: { correlationId: "material-sections-page", limit: 7, nextCursor: "section-cursor", truncated: true }
    })
  })

  it("projects a canonical, parent-scoped public section resource", async () => {
    let received: Readonly<{ materialId: string; sectionId: string }> | undefined
    const baseUrl = await startServer({
      getSupportingMaterialSection: async (input) => {
        received = input
        return await service().getSupportingMaterialSection(input)
      }
    })
    const path =
      "/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections/material-section%3Aus%3A119%3Areport%3A1%3A2"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "material-section-read" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      materialId: "material:us:119:report:1",
      sectionId: "material-section:us:119:report:1:2"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "https://api.example.test/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections/material-section%3Aus%3A119%3Areport%3A1%3A2",
        materialId: "material:us:119:report:1",
        sourceUrl: "https://api.congress.gov/v3/committee-report/1",
        type: "supporting-material-section"
      },
      links: { self: path },
      meta: { correlationId: "material-section-read", warnings: [] }
    })
  })

  it("uses the shared default page limit for material section traversal", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      assertSupportingMaterialExists: async () => undefined,
      listSupportingMaterialSections: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections`)

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ limit: 20 })
  })

  it("normalizes a section heading filter before exact persisted matching", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      assertSupportingMaterialExists: async () => undefined,
      listSupportingMaterialSections: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(
      `${baseUrl}/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections?heading=%20Findings%20`
    )

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ heading: "Findings" })
  })

  it("returns a correlated 404 when the section is absent from the requested material", async () => {
    const baseUrl = await startServer({
      getSupportingMaterialSection: async () => {
        throw new LegislationError("not_found", "Supporting material section was not found")
      }
    })
    const response = await fetch(
      `${baseUrl}/api/supporting-materials/material%3Aother/sections/material-section%3Aus%3A119%3Areport%3A1%3A2`,
      { headers: { "x-correlation-id": "wrong-material" } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "wrong-material", retryable: false }
    })
  })

  it("keeps the route private to its exact canonical path and query contract", async () => {
    const baseUrl = await startServer({
      ...service(),
      assertSupportingMaterialExists: async () => undefined,
      listSupportingMaterialSections: async () => ({ items: [], truncated: false })
    })
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1/extra`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1?limit=1`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?pageFrom=4&pageTo=2`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?pageFrom=2&pageFrom=3`)
    ])

    const [extraPath, unsupportedQuery, invalidRange, repeatedPage] = responses
    expect([extraPath.status, unsupportedQuery.status, invalidRange.status, repeatedPage.status]).toEqual([
      404, 400, 400, 400
    ])
    await expect(unsupportedQuery.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })

  it("rejects repeated, blank, and malformed collection controls before any material read", async () => {
    let parentReads = 0
    let sectionReads = 0
    const baseUrl = await startServer({
      ...service(),
      assertSupportingMaterialExists: async () => {
        parentReads += 1
      },
      listSupportingMaterialSections: async () => {
        sectionReads += 1
        return { items: [], truncated: false }
      }
    })
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?limit=1&limit=2`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?cursor=`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?heading=%20`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?pageFrom=0`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?pageTo=1.5`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400])
    expect(parentReads).toBe(0)
    expect(sectionReads).toBe(0)
  })
})
