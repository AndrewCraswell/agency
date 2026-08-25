import { afterEach, describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
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
    const baseUrl = await startServer(service())
    const [extraPath, unsupportedQuery] = await Promise.all([
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1/extra`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1?limit=1`)
    ])

    expect(extraPath.status).toBe(404)
    expect(unsupportedQuery.status).toBe(400)
    await expect(unsupportedQuery.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })
})
