import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { legalVersionDetailSchema } from "@repo/legislation-core/api-client/legal-version-contract"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalVersionApiHandler } from "./legal-version-routes"

const versionId = "00000000-0000-4000-8000-000000000001"
const provisionId = "00000000-0000-4000-8000-000000000002"
const codeId = "00000000-0000-4000-8000-000000000003"
const version = legalVersionDetailSchema.parse({
  kind: "provision",
  version: {
    id: versionId,
    provisionId,
    codeId,
    contentHash: "a".repeat(64),
    inputContract: "reader",
    heading: "Purpose",
    nodeKind: "section",
    language: "en"
  },
  selectedContext: null
})
const readVersion = vi.fn<(id: string, input: unknown) => Promise<typeof version>>(async () => version)
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
const execute = (request: Request) =>
  executeAuthenticatedApiRequest(request, createLegalVersionApiHandler(readVersion), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("serves a context-neutral immutable version through the typed client", async () => {
  readVersion.mockClear()
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  expect(await api.getLegalVersion(versionId)).toMatchObject({ data: version })
  expect(readVersion).toHaveBeenCalledWith(versionId, {})
})

it("rejects crossed selectors, unknown fields and the MCP audience before reading", async () => {
  readVersion.mockClear()
  for (const url of [
    `https://api.example/api/legal/versions/${versionId}?editionId=${codeId}&sourceObservationId=${provisionId}`,
    `https://api.example/api/legal/versions/${versionId}?versionId=${versionId}`,
    "https://api.example/api/legal/versions/not-a-uuid"
  ]) {
    const response = await execute(new Request(url, { headers: { authorization: `Bearer ${await token()}` } }))
    expect(response.status).toBe(400)
  }
  const denied = await execute(
    new Request(`https://api.example/api/legal/versions/${versionId}`, {
      headers: { authorization: `Bearer ${await token("rostra-mcp")}` }
    })
  )
  expect(denied.status).toBe(401)
  expect(readVersion).not.toHaveBeenCalled()
})
