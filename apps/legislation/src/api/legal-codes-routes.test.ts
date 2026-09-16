import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { LegislationApiClient } from "../api-client/client.js"
import { createWorkosAuthenticator } from "../auth/workos.js"
import { loadConfig } from "../config/config.js"
import { executeAuthenticatedApiRequest } from "../server/next/authenticated-api-request.js"
import { createLegalCodesApiHandler } from "./legal-codes-routes.js"

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
async function token(aud = "rostra-api") {
  return new SignJWT({ org_id: "org" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience(aud)
    .setSubject("user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey)
}
const read = vi.fn<() => Promise<{ items: never[]; truncated: boolean; warnings: string[] }>>(async () => ({
  items: [],
  truncated: false,
  warnings: ["No coverage claim"]
}))
const execute = (request: Request) =>
  executeAuthenticatedApiRequest(request, createLegalCodesApiHandler(read), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("rejects missing or MCP tokens and invalid filters before reading", async () => {
  read.mockClear()
  for (const bearer of [undefined, await token("rostra-mcp")]) {
    const response = await execute(
      new Request("https://api.example/api/legal/codes", {
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
      })
    )
    expect(response.status).toBe(401)
  }
  for (const query of ["limit=101", "limit=1&limit=2", "kind=rule", "actor=org", "cursor=%3D", "jurisdictionId=US"]) {
    const response = await execute(
      new Request(`https://api.example/api/legal/codes?${query}`, {
        headers: { authorization: `Bearer ${await token()}` }
      })
    )
    expect(response.status).toBe(400)
  }
  expect(read).not.toHaveBeenCalled()
})

it("delivers strict pages through the typed client with no shared cache", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => {
      const response = await execute(new Request(url, init))
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      return response
    }
  })
  expect(await api.listLegalCodes({ kind: "regulation", limit: 10 })).toMatchObject({
    data: [],
    meta: { limit: 10, nextCursor: null }
  })
  const malformed = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async () =>
      Response.json(
        {
          data: [],
          links: { self: "/api/legal/codes", next: null },
          meta: { correlationId: "test", limit: 99, nextCursor: null, truncated: false, warnings: [] }
        },
        { headers: { "x-correlation-id": "test" } }
      )
  })
  await expect(malformed.listLegalCodes({ limit: 10 }, { correlationId: "test" })).rejects.toThrow(
    "Invalid legal codes response"
  )
})
