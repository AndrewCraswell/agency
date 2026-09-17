import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import {
  legalEditionDetailSchema,
  legalEditionSchema,
  legalProvisionDetailSchema,
  legalProvisionEditionMembershipSchema,
  legalProvisionVersionSummarySchema
} from "@repo/legislation-core/api-client/legal-browse-contract"
import { createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { generateKeyPair, SignJWT } from "jose"
import { expect, it, vi } from "vitest"
import { loadConfig } from "../../configuration/config"
import { executeAuthenticatedApiRequest } from "../next/authenticated-api-request"
import { createLegalBrowseApiHandler } from "./legal-browse-routes"

const editionId = "00000000-0000-4000-8000-000000000001"
const codeId = "00000000-0000-4000-8000-000000000002"
const provisionId = "00000000-0000-4000-8000-000000000003"
const versionId = "00000000-0000-4000-8000-000000000004"
const editionSummary = legalEditionSchema.parse({
  id: editionId,
  codeId,
  sourceId: "ecfr",
  jurisdictionId: "jurisdiction:us",
  rightsProfileId: "official",
  sourceObservationId: "a".repeat(64),
  nativeKey: "2026-09-10",
  sourceRevision: "revision",
  sourceUrl: "https://www.ecfr.gov/api/versioner/v1/full/2026-09-10/title-1.xml",
  issueDate: "2026-09-10",
  sourceCurrencyDate: "2026-09-11",
  publishedAt: "2026-09-15T00:00:00Z",
  scope: "current_code_snapshot"
})
const edition = legalEditionDetailSchema.parse({
  ...editionSummary,
  publishedMembers: 42,
  isCurrent: true,
  annualVolume: null
})
const getEdition = vi.fn<(id: string) => Promise<typeof edition>>(async () => edition)
const provision = legalProvisionDetailSchema.parse({
  id: provisionId,
  codeId,
  identityKey: "section:1",
  identityBasis: "citation",
  selectedVersion: {
    id: versionId,
    provisionId,
    codeId,
    contentHash: "b".repeat(64),
    inputContract: "reader",
    heading: "Purpose",
    nodeKind: "section",
    language: "en"
  },
  selectedContext: null,
  textPreview: "Source evidence",
  previewTruncated: false
})
const getProvision = vi.fn<(id: string, input: unknown) => Promise<typeof provision>>(async () => provision)
const version = legalProvisionVersionSummarySchema.parse({
  ...provision.selectedVersion,
  firstObservedAt: "2026-09-15T00:00:00Z",
  lastObservedAt: "2026-09-16T00:00:00Z",
  editionCount: 2
})
const membership = legalProvisionEditionMembershipSchema.parse({
  provisionId,
  versionId,
  edition: editionSummary,
  parentId: null,
  ordinal: 1,
  nativeId: "1 CFR 1.1",
  sourceLocator: "/ECFR[1]",
  isLatestValidated: true,
  textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
})
const listProvisionVersions = vi.fn<
  (
    id: string,
    input: unknown
  ) => Promise<{
    items: (typeof version)[]
    truncated: boolean
    warnings: string[]
  }>
>(async () => ({
  items: [version],
  truncated: false,
  warnings: ["Published source observations only."]
}))
const listProvisionEditions = vi.fn<
  (
    id: string,
    input: unknown
  ) => Promise<{
    items: (typeof membership)[]
    truncated: boolean
    warnings: string[]
  }>
>(async () => ({
  items: [membership],
  truncated: false,
  warnings: ["Published source memberships only."]
}))
const unreachableBrowse = vi.fn<(id: string, input: unknown) => Promise<never>>(async () => {
  throw new Error("Unexpected browse call")
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
const execute = (request: Request) =>
  executeAuthenticatedApiRequest(
    request,
    createLegalBrowseApiHandler({
      getEdition,
      getProvision,
      listEditions: unreachableBrowse,
      listProvisionEditions,
      listProvisionVersions,
      listProvisions: unreachableBrowse
    }),
    { getApplication: () => ({ config }), createAuthenticator: () => authenticate }
  )

it("serves an exact authorized edition through the typed client", async () => {
  getEdition.mockClear()
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  expect(await api.getLegalEdition(editionId)).toMatchObject({ data: edition })
  expect(getEdition).toHaveBeenCalledWith(editionId)
})

it("serves a context-neutral exact provision version through the typed client", async () => {
  getProvision.mockClear()
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  expect(await api.getLegalProvision(provisionId, { versionId })).toMatchObject({ data: provision })
  expect(getProvision).toHaveBeenCalledWith(provisionId, { versionId })
})

it("serves provision version history and edition memberships through the typed client", async () => {
  listProvisionVersions.mockClear()
  listProvisionEditions.mockClear()
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    bearerToken: await token(),
    fetch: async (url, init) => execute(new Request(url, init))
  })
  expect(await api.listLegalProvisionVersions(provisionId, { sourceId: "ecfr" })).toMatchObject({ data: [version] })
  expect(await api.listLegalProvisionEditions(provisionId, { versionId, sourceId: "ecfr" })).toMatchObject({
    data: [membership]
  })
  expect(listProvisionVersions).toHaveBeenCalledWith(provisionId, { limit: 20, sourceId: "ecfr" })
  expect(listProvisionEditions).toHaveBeenCalledWith(provisionId, { limit: 20, sourceId: "ecfr", versionId })
})

it("rejects invalid selectors and credentials before reading", async () => {
  getEdition.mockClear()
  getProvision.mockClear()
  for (const url of [
    "https://api.example/api/legal/editions/not-a-uuid",
    `https://api.example/api/legal/editions/${editionId}?codeId=${codeId}`,
    `https://api.example/api/legal/provisions/${provisionId}?editionId=${editionId}&asOf=2025-01-01`,
    `https://api.example/api/legal/provisions/${provisionId}/versions?versionId=${versionId}`,
    `https://api.example/api/legal/provisions/${provisionId}/editions?sourceId=vendor`
  ]) {
    const response = await execute(new Request(url, { headers: { authorization: `Bearer ${await token()}` } }))
    expect(response.status).toBe(400)
  }
  const denied = await execute(
    new Request(`https://api.example/api/legal/editions/${editionId}`, {
      headers: { authorization: `Bearer ${await token("rostra-mcp")}` }
    })
  )
  expect(denied.status).toBe(401)
  expect(getEdition).not.toHaveBeenCalled()
  expect(getProvision).not.toHaveBeenCalled()
})
