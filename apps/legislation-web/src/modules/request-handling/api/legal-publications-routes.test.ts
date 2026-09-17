import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { legalPublicationDetailSchema } from "@repo/legislation-core/api-client/legal-publications-contract"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalPublicationsApiHandler } from "./legal-publications-routes"

const documentId = "00000000-0000-4000-8000-000000000001"
const versionId = "00000000-0000-4000-8000-000000000002"
const observationId = "00000000-0000-4000-8000-000000000003"
const detail = legalPublicationDetailSchema.parse({
  id: documentId,
  versionId,
  sourceObservationId: observationId,
  jurisdictionId: "jurisdiction:us",
  sourceId: "federal-register",
  nativeNumber: "00-100",
  title: "Retirement eligibility",
  citation: "65 FR 2521",
  publicationKind: "final_rule",
  publishedOn: "2000-01-18",
  effectiveOn: null,
  agencies: [
    {
      status: "unresolved",
      organizationId: null,
      sourceAgencyId: "fr-agency-406",
      name: "Personnel Management Office",
      sourceId: "federal-register",
      nativeId: "406"
    }
  ],
  canonicalUrl: `/api/legal/publications/${documentId}`,
  textUrl: `/api/legal/versions/${versionId}/text?sourceObservationId=${observationId}`,
  updatedAt: "2026-09-17T00:00:00Z",
  sourceLocator: "/RULE[1]",
  sourceUrl: "https://www.federalregister.gov/documents/2000/01/18/00-100/example",
  contentHash: "a".repeat(64),
  attribution: "Federal Register"
})
const {
  sourceLocator: _sourceLocator,
  sourceUrl: _sourceUrl,
  contentHash: _contentHash,
  attribution: _attribution,
  ...summary
} = detail
const reader = {
  listPublications: vi.fn<
    (input: unknown) => Promise<{ items: (typeof summary)[]; truncated: false; warnings: string[] }>
  >(async () => ({ items: [summary], truncated: false, warnings: [] })),
  getPublication: vi.fn<(documentId: string, versionId?: string) => Promise<typeof detail>>(async () => detail),
  listVersions: vi.fn<
    (documentId: string, input: unknown) => Promise<{ items: (typeof detail)[]; truncated: false; warnings: string[] }>
  >(async () => ({ items: [detail], truncated: false, warnings: [] }))
}
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
async function token() {
  return new SignJWT({ org_id: "org" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience("rostra-api")
    .setSubject("user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey)
}
const execute = (request: Request) =>
  executeAuthenticatedApiRequest(request, createLegalPublicationsApiHandler(reader), {
    getApplication: () => ({ config }),
    createAuthenticator: () => authenticate
  })

it("serves publication list, detail and versions through the typed client", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  expect(
    (
      await api.listRegulatoryDocuments({
        sourceId: "federal-register",
        sourceAgencyId: "fr-agency-406",
        kind: "final_rule"
      })
    ).data
  ).toEqual([summary])
  expect((await api.getRegulatoryDocument(documentId, versionId)).data).toEqual(detail)
  expect((await api.listRegulatoryDocumentVersions(documentId)).data).toEqual([detail])
  expect(reader.listPublications).toHaveBeenCalledWith(expect.objectContaining({ sourceAgencyId: "fr-agency-406" }))
  expect(reader.getPublication).toHaveBeenCalledWith(documentId, versionId)
  expect(reader.listVersions).toHaveBeenCalledWith(documentId, { limit: 20 })
})

it("rejects duplicate, inconsistent and unknown publication filters", async () => {
  reader.listPublications.mockClear()
  for (const query of [
    "limit=1&limit=2",
    "sourceAgencyId=fr-agency-406",
    "kind=rule",
    "publishedFrom=2001-01-01&publishedTo=2000-01-01",
    "organizationId=spoofed"
  ]) {
    expect(
      (
        await execute(
          new Request(`https://api.example/api/legal/publications?${query}`, {
            headers: { authorization: `Bearer ${await token()}` }
          })
        )
      ).status
    ).toBe(400)
  }
  expect(reader.listPublications).not.toHaveBeenCalled()
})
