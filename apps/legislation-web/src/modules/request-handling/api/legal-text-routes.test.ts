import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import {
  legalTextResponseSchema,
  validateLegalTextResponse
} from "@repo/legislation-core/api-client/legal-text-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { buildLegalTextProjection, readLegalTextWindow } from "@repo/legislation-core/legal-text/reader-text"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import pg from "pg"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalTextReader } from "./legal-text-read"
import { createLegalTextApiHandler } from "./legal-text-routes"

const versionId = "00000000-0000-4000-8000-000000000001"
const observationId = "00000000-0000-4000-8000-000000000002"
const issuer = "https://auth.example"
const audience = "rostra-api"
const path = `https://api.example/api/legal/versions/${versionId}/text`
const config = loadConfig({
  AUTH_MODE: "workos",
  WORKOS_API_AUDIENCE: audience,
  WORKOS_CLIENT_ID: "test",
  WORKOS_ISSUER: issuer,
  WORKOS_JWKS_URL: `${issuer}/jwks`,
  WORKOS_SESSION_ISSUER: issuer,
  WORKOS_SESSION_JWKS_URL: `${issuer}/jwks`,
  WORKOS_MCP_AUDIENCE: "rostra-mcp"
})
const app = { config }
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"]
let authenticate: ReturnType<typeof createWorkosAuthenticator>
beforeAll(async () => {
  const pair = await generateKeyPair("RS256")
  privateKey = pair.privateKey
  const getKey = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "reader", alg: "RS256" }] })
  authenticate = createWorkosAuthenticator({ m2m: { issuer, audience, jwksUrl: `${issuer}/jwks` } }, { m2m: getKey })
})
async function token(org = "org-reader", aud = audience) {
  return new SignJWT({ org_id: org })
    .setProtectedHeader({ alg: "RS256", kid: "reader" })
    .setIssuer(issuer)
    .setAudience(aud)
    .setSubject("user-reader")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey)
}
const pool = new pg.Pool()
const connect = vi.spyOn(pool, "connect")
afterAll(async () => {
  connect.mockRestore()
  await pool.end()
})
const identities: unknown[] = []
const readText = vi.fn<ReturnType<typeof createLegalTextReader>>(async () => {
  identities.push(getRequestContext()?.identity)
  return {
    ...readLegalTextWindow(buildLegalTextProjection({ versionId, body: "Exact source text", blocks: [] }), {
      scope: {
        callerKey: "caller",
        editionId: null,
        sourceObservationId: observationId,
        rightsPolicyHash: "a".repeat(64)
      }
    }),
    selectedContext: {
      kind: "publication",
      documentId: versionId,
      versionId,
      sourceObservationId: observationId,
      sourceId: "govinfo-fr",
      sourceLocator: "/NOTICE[1]",
      rightsPolicyHash: "a".repeat(64),
      publishedOn: "2000-01-18",
      legalStatus: "unknown"
    }
  }
})
async function execute(request: Request, reader = readText) {
  return executeAuthenticatedApiRequest(request, createLegalTextApiHandler(reader), {
    getApplication: () => app,
    createAuthenticator: () => authenticate
  })
}

it("rejects missing and MCP-audience tokens before accessing text", async () => {
  const before = readText.mock.calls.length
  for (const bearer of [undefined, await token("org-reader", "rostra-mcp")]) {
    const response = await execute(
      new Request(`${path}?sourceObservationId=${observationId}`, {
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
      })
    )
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  }
  expect(readText.mock.calls.length).toBe(before)
})

it("denies a valid wrong-account token and disabled-auth identity before connecting to PostgreSQL", async () => {
  const reader = createLegalTextReader(pool, ["org-reader"])
  const request = new Request(`${path}?sourceObservationId=${observationId}`, {
    headers: { authorization: `Bearer ${await token("org-other")}` }
  })
  // Production reader, real signed token verification; no database connection should be attempted.
  const response = await executeAuthenticatedApiRequest(request, createLegalTextApiHandler(reader), {
    getApplication: () => app,
    createAuthenticator: () => authenticate
  })
  expect(response.status).toBe(403)
  expect(connect).not.toHaveBeenCalled()
  await expect(reader(versionId, { sourceObservationId: observationId })).rejects.toMatchObject({
    category: "unauthorized"
  })
})

it("preserves exact selection and source text through authenticated HTTP and the typed client", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  const result = await api.getLegalText(versionId, { sourceObservationId: observationId })
  expect(identities.at(-1)).toEqual({ organizationId: "org-reader", userId: "user-reader" })
  expect(result.data.blocks[0]?.text).toBe("Exact source text")
  expect(result.data.selectedContext.sourceObservationId).toBe(observationId)
  const response = await execute(
    new Request(`${path}?sourceObservationId=${observationId}`, {
      headers: { authorization: `Bearer ${await token()}` }
    })
  )
  expect(response.headers.get("cache-control")).toBe("private, no-store")
})

it("rejects missing, conflicting, repeated and unknown selectors before reading", async () => {
  const bearer = await token()
  const before = readText.mock.calls.length
  for (const query of [
    "",
    `sourceObservationId=${observationId}&editionId=${versionId}`,
    `sourceObservationId=${observationId}&sourceObservationId=${observationId}`,
    `sourceObservationId=${observationId}&asOf=2000-01-18`,
    `sourceObservationId=${observationId}&limit=0`,
    `sourceObservationId=${observationId}&anchor=${"a".repeat(64)}&cursor=x`
  ]) {
    const response = await execute(new Request(`${path}?${query}`, { headers: { authorization: `Bearer ${bearer}` } }))
    expect(response.status).toBe(400)
  }
  expect(readText.mock.calls.length).toBe(before)
})

it("rejects inconsistent windows and a response from a different source observation", async () => {
  const response = await execute(
    new Request(`${path}?sourceObservationId=${observationId}`, {
      headers: { authorization: `Bearer ${await token()}` }
    })
  )
  const value = legalTextResponseSchema.parse(await response.json())
  expect(() => validateLegalTextResponse(value, versionId, { sourceObservationId: versionId })).toThrow(
    "selection_mismatch"
  )
  expect(() => legalTextResponseSchema.parse({ ...value, data: { ...value.data, nextCursor: "unexpected" } })).toThrow(
    "Inconsistent legal text window"
  )
  expect(() => legalTextResponseSchema.parse({ ...value, data: { ...value.data, injected: true } })).toThrow(
    /unrecognized/i
  )
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    fetch: async () =>
      Response.json({
        ...value,
        data: { ...value.data, selectedContext: { ...value.data.selectedContext, sourceObservationId: versionId } }
      })
  })
  await expect(api.getLegalText(versionId, { sourceObservationId: observationId })).rejects.toMatchObject({
    name: "LegislationApiProtocolError"
  })
})
