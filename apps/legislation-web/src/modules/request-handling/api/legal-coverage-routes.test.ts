import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { regulatoryCoverageSchema } from "@repo/legislation-core/api-client/legal-coverage-contract"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalCoverageApiHandler } from "./legal-coverage-routes"

const codeId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const available = {
  status: "available" as const,
  isStale: false,
  reason: null,
  requestedEditions: 1 as const,
  availableEditions: 1,
  excludedEditions: 0
}
const coverage = regulatoryCoverageSchema.parse({
  id: editionId,
  jurisdictionId: "jurisdiction:us",
  code: { id: codeId, name: "Title 1" },
  corpus: "regulation",
  source: { id: "ecfr", publisher: "Office of the Federal Register", authority: "official" },
  edition: {
    id: editionId,
    issueDate: "2026-09-10",
    sourceCurrencyDate: "2026-09-11",
    publishedAt: "2026-09-15T00:00:00Z",
    isCurrent: true
  },
  stages: {
    sourceCollection: {
      ...available,
      lastAttemptAt: "2026-09-14T00:00:00Z",
      lastSuccessAt: "2026-09-15T00:00:00Z"
    },
    canonical: { ...available, recordCount: 12 },
    lexical: { ...available, passageCount: 14, verifiedAt: "2026-09-15T01:00:00Z" },
    semantic: {
      status: "incomplete",
      isStale: false,
      reason: "semantic_vectors_incomplete",
      requestedEditions: 1,
      availableEditions: 0,
      excludedEditions: 1,
      dimensions: 1536,
      model: "openai/text-embedding-3-small",
      passageCount: 5,
      readyAt: null
    }
  }
})
const pair = await generateKeyPair("RS256")
const issuer = "https://auth.example"
const config = loadConfig({
  AUTH_MODE: "workos",
  WORKOS_API_AUDIENCE: "rostra-api",
  WORKOS_CLIENT_ID: "test",
  WORKOS_ISSUER: issuer,
  WORKOS_MCP_AUDIENCE: "rostra-mcp",
  WORKOS_SESSION_ISSUER: issuer,
  WORKOS_SESSION_JWKS_URL: `${issuer}/jwks`,
  WORKOS_JWKS_URL: `${issuer}/jwks`
})
const authenticate = createWorkosAuthenticator(
  { m2m: { issuer, audience: "rostra-api", jwksUrl: `${issuer}/jwks` } },
  { m2m: async () => pair.publicKey }
)
async function token(audience = "rostra-api") {
  return new SignJWT({ org_id: "org" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey)
}
const read = vi.fn<(input: unknown) => Promise<{ items: (typeof coverage)[]; truncated: false; warnings: string[] }>>(
  async () => ({ items: [coverage], truncated: false, warnings: [] })
)
const execute = (request: Request) =>
  executeAuthenticatedApiRequest(request, createLegalCoverageApiHandler(read), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("rejects wrong audiences, duplicate selectors and invalid coverage filters before reading", async () => {
  read.mockClear()
  for (const bearer of [undefined, await token("rostra-mcp")]) {
    const response = await execute(
      new Request("https://api.example/api/legal/coverage", {
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
      })
    )
    expect(response.status).toBe(401)
  }
  for (const query of [
    "limit=101",
    "limit=1&limit=2",
    "corpus=rule",
    "sourceId=regulations-gov",
    "codeId=nope",
    "organizationId=org"
  ]) {
    const response = await execute(
      new Request(`https://api.example/api/legal/coverage?${query}`, {
        headers: { authorization: `Bearer ${await token()}` }
      })
    )
    expect(response.status).toBe(400)
  }
  expect(read).not.toHaveBeenCalled()
})

it("delivers independently staged coverage through the typed client", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => {
      const response = await execute(new Request(url, init))
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      return response
    }
  })
  const response = await api.getRegulatoryCoverage({
    jurisdictionId: "jurisdiction:us",
    codeId,
    corpus: "regulation",
    sourceId: "ecfr",
    limit: 10
  })
  expect(response.data[0]).toMatchObject({
    id: editionId,
    stages: {
      canonical: { status: "available", recordCount: 12 },
      lexical: { status: "available", passageCount: 14 },
      semantic: { status: "incomplete", passageCount: 5 }
    }
  })
  expect(read).toHaveBeenCalledWith({
    jurisdictionId: "jurisdiction:us",
    codeId,
    corpus: "regulation",
    sourceId: "ecfr",
    limit: 10
  })
})

it("rejects internally inconsistent stage scope returned by an upstream server", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: "token",
    fetch: async () =>
      Response.json(
        {
          data: [
            {
              ...coverage,
              stages: {
                ...coverage.stages,
                semantic: { ...coverage.stages.semantic, availableEditions: 1, excludedEditions: 1 }
              }
            }
          ],
          links: { self: "/api/legal/coverage", next: null },
          meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
        },
        { headers: { "x-correlation-id": "test" } }
      )
  })
  await expect(api.getRegulatoryCoverage({}, { correlationId: "test" })).rejects.toThrow(
    "Invalid regulatory coverage response"
  )
})
