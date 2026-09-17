import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { legalAgencyDirectoryEntrySchema } from "@repo/legislation-core/api-client/legal-agencies-contract"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalAgenciesApiHandler } from "./legal-agencies-routes"

const agency = legalAgencyDirectoryEntrySchema.parse({
  status: "unresolved",
  organizationId: null,
  sourceAgencyId: "fr-agency-406",
  name: "Personnel Management Office",
  aliases: ["Office of Personnel Management"],
  sourceId: "federal-register",
  nativeId: "406",
  jurisdictionId: "jurisdiction:us",
  publicationCount: 2,
  firstPublishedOn: "2000-01-18",
  lastPublishedOn: "2001-01-18"
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
const read = vi.fn<(input: unknown) => Promise<{ items: (typeof agency)[]; truncated: false; warnings: string[] }>>(
  async () => ({ items: [agency], truncated: false, warnings: [] })
)
const execute = (request: Request) =>
  executeAuthenticatedApiRequest(request, createLegalAgenciesApiHandler(read), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("rejects wrong audiences, duplicates and invalid agency filters before reading", async () => {
  read.mockClear()
  for (const bearer of [undefined, await token("rostra-mcp")]) {
    const response = await execute(
      new Request("https://api.example/api/legal/agencies", {
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
      })
    )
    expect(response.status).toBe(401)
  }
  for (const query of [
    "limit=101",
    "limit=1&limit=2",
    "sourceId=govinfo-fr",
    "q=",
    "organizationId=organization:us:opm"
  ]) {
    const response = await execute(
      new Request(`https://api.example/api/legal/agencies?${query}`, {
        headers: { authorization: `Bearer ${await token()}` }
      })
    )
    expect(response.status).toBe(400)
  }
  expect(read).not.toHaveBeenCalled()
})

it("delivers the source-agency directory through the typed client", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => {
      const response = await execute(new Request(url, init))
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      return response
    }
  })
  const response = await api.listLegalAgencies({
    jurisdictionId: "jurisdiction:us",
    sourceId: "federal-register",
    q: "personnel",
    limit: 10
  })
  expect(response.data).toEqual([agency])
  expect(read).toHaveBeenCalledWith({
    jurisdictionId: "jurisdiction:us",
    sourceId: "federal-register",
    q: "personnel",
    limit: 10
  })
})
