import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalCitationApiHandler } from "./legal-citation-routes"

const request = { citation: "21 CFR 177.2800", jurisdictionId: "jurisdiction:us" }
const candidate = {
  provisionId: "00000000-0000-4000-8000-000000000001",
  versionId: "00000000-0000-4000-8000-000000000002",
  codeId: "00000000-0000-4000-8000-000000000003",
  editionId: "00000000-0000-4000-8000-000000000004",
  jurisdictionId: "jurisdiction:us",
  codeKey: "cfr-title-21",
  codeName: "Code of Federal Regulations, title 21",
  citation: "cfr:21:section:177.2800",
  identityKey: "cfr:21:section:177.2800",
  nodeKind: "section",
  heading: "Indirect food additives",
  sourceLocator: "/ECFR[1]/DIV8[1]",
  textUrl:
    "/api/legal/versions/00000000-0000-4000-8000-000000000002/text?editionId=00000000-0000-4000-8000-000000000004"
}
const resolution = {
  input: request.citation,
  normalizedInput: candidate.citation,
  status: "resolved" as const,
  match: candidate,
  candidates: [] as const,
  truncated: false as const,
  refinement: null
}
const resolve = vi.fn<(input: unknown) => Promise<typeof resolution>>(async () => resolution)
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
const execute = (incoming: Request) =>
  executeAuthenticatedApiRequest(incoming, createLegalCitationApiHandler(resolve), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("serves authenticated exact citation resolution through the typed client", async () => {
  resolve.mockClear()
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  await expect(api.resolveLegalCitation(request)).resolves.toMatchObject({ data: resolution })
  expect(resolve).toHaveBeenCalledWith(request)
})

it("rejects invalid payloads, query parameters and credentials before resolution", async () => {
  resolve.mockClear()
  for (const incoming of [
    new Request("https://api.example/api/legal/provisions/resolve", {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify({ ...request, fuzzy: true })
    }),
    new Request("https://api.example/api/legal/provisions/resolve?limit=1", {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify(request)
    }),
    new Request("https://api.example/api/legal/provisions/resolve", {
      method: "POST",
      headers: { authorization: `Bearer ${await token("rostra-mcp")}`, "content-type": "application/json" },
      body: JSON.stringify(request)
    })
  ]) {
    const response = await execute(incoming)
    expect([400, 401]).toContain(response.status)
  }
  expect(resolve).not.toHaveBeenCalled()
})
