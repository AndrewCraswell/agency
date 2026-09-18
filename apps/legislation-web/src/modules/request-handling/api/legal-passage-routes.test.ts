import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import type { createLegalPassageReader } from "./legal-passage-read"
import { createLegalPassageApiHandler } from "./legal-passage-routes"

const versionId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const passageId = "a".repeat(64)
const passage = {
  id: passageId,
  generationId: "b".repeat(64),
  versionId,
  ordinal: 0,
  start: 0,
  end: 11,
  text: "Source text",
  tokenCount: 3,
  readerSpans: [{ blockId: "c".repeat(64), start: 0, end: 11 }],
  contextSpans: [],
  inputHash: "d".repeat(64),
  rowContinuation: null,
  selectedContext: {
    kind: "provision" as const,
    editionId,
    provisionId: "00000000-0000-4000-8000-000000000003",
    versionId,
    sourceObservationId: "e".repeat(64),
    sourceId: "ecfr",
    rightsPolicyHash: "f".repeat(64),
    parentId: null,
    sourceLocator: "/ECFR[1]",
    sourceCurrencyDate: "2026-09-17",
    selectedDate: null,
    basis: "observed_snapshot" as const,
    legalStatus: "unknown" as const
  },
  textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
}
const listPassages = vi.fn<ReturnType<typeof createLegalPassageReader>["listPassages"]>(async () => ({
  items: [passage],
  truncated: false,
  warnings: []
}))
const getPassage = vi.fn<ReturnType<typeof createLegalPassageReader>["getPassage"]>(async () => passage)
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
  executeAuthenticatedApiRequest(request, createLegalPassageApiHandler({ listPassages, getPassage }), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("requires API authentication and exact source selection before reading", async () => {
  listPassages.mockClear()
  for (const request of [
    new Request(`https://api.example/api/legal/versions/${versionId}/passages?editionId=${editionId}`),
    new Request(`https://api.example/api/legal/versions/${versionId}/passages`, {
      headers: { authorization: `Bearer ${await token()}` }
    }),
    new Request(
      `https://api.example/api/legal/versions/${versionId}/passages?editionId=${editionId}&sourceObservationId=${editionId}`,
      { headers: { authorization: `Bearer ${await token()}` } }
    )
  ]) {
    expect((await execute(request)).status).toBe(request.headers.has("authorization") ? 400 : 401)
  }
  expect(listPassages).not.toHaveBeenCalled()
})

it("serves list and detail operations through the typed client", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  expect((await api.listLegalPassages(versionId, { editionId })).data[0]?.id).toBe(passageId)
  expect((await api.getLegalPassage(passageId, { editionId })).data.text).toBe("Source text")
  expect(listPassages).toHaveBeenCalledWith(versionId, expect.objectContaining({ editionId, limit: 20 }))
  expect(getPassage).toHaveBeenCalledWith(passageId, { editionId })
})

it("rejects malformed identities, duplicate parameters and crossed response context", async () => {
  const bearer = `Bearer ${await token()}`
  for (const url of [
    `https://api.example/api/legal/versions/not-a-version/passages?editionId=${editionId}`,
    `https://api.example/api/legal/versions/${versionId}/passages?editionId=${editionId}&editionId=${editionId}`,
    `https://api.example/api/legal/passages/not-a-passage?editionId=${editionId}`,
    `https://api.example/api/legal/passages/${passageId}?editionId=${editionId}&limit=1`
  ]) {
    expect((await execute(new Request(url, { headers: { authorization: bearer } }))).status).toBe(400)
  }

  getPassage.mockResolvedValueOnce({
    ...passage,
    selectedContext: { ...passage.selectedContext, editionId: versionId }
  })
  expect(
    (
      await execute(
        new Request(`https://api.example/api/legal/passages/${passageId}?editionId=${editionId}`, {
          headers: { authorization: bearer }
        })
      )
    ).status
  ).toBe(500)
})
