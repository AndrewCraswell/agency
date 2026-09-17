import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalVersionReader } from "./legal-version-read"

const versionId = "00000000-0000-4000-8000-000000000001"
const ownerId = "00000000-0000-4000-8000-000000000002"
const codeId = "00000000-0000-4000-8000-000000000003"
const editionId = "00000000-0000-4000-8000-000000000004"
const observationId = "00000000-0000-4000-8000-000000000005"
const provisionVersion = {
  id: versionId,
  provisionId: ownerId,
  codeId,
  contentHash: "a".repeat(64),
  inputContract: "reader",
  heading: "Purpose",
  nodeKind: "section",
  language: "en"
}
const publicationVersion = {
  id: versionId,
  documentId: ownerId,
  contentHash: "a".repeat(64),
  inputContract: "reader",
  heading: "Published rule",
  publicationKind: "final_rule"
}
const editionContext = {
  edition: {
    id: editionId,
    codeId,
    sourceId: "ecfr",
    jurisdictionId: "jurisdiction:us",
    rightsProfileId: "official",
    sourceObservationId: "b".repeat(64),
    nativeKey: "2026-09-17",
    sourceRevision: "revision",
    sourceUrl: "https://www.ecfr.gov/",
    issueDate: "2026-09-17",
    sourceCurrencyDate: "2026-09-17",
    publishedAt: "2026-09-17T00:00:00.000000Z",
    scope: "current_code_snapshot"
  },
  parentId: null,
  ordinal: 1,
  nativeId: "1 CFR 1.1",
  sourceLocator: "/ECFR[1]",
  isLatestValidated: true,
  textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
}
const publicationContext = {
  sourceObservationId: observationId,
  documentId: ownerId,
  versionId,
  sourceId: "federal-register",
  jurisdictionId: "jurisdiction:us",
  rightsProfileId: "official",
  publishedOn: "2026-09-17",
  sourceLocator: "/RULE[1]",
  sourceUrl: "https://www.federalregister.gov/example",
  updatedAt: "2026-09-17T00:00:00.000000Z",
  textUrl: `/api/legal/versions/${versionId}/text?sourceObservationId=${observationId}`
}
const pools: pg.Pool[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(pools.splice(0).map((pool) => pool.end()))
})

function fixture() {
  const pool = new pg.Pool()
  pools.push(pool)
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const connect = vi.spyOn(pool, "connect").mockImplementation(async () => client)
  const query = vi.spyOn(client, "query")
  const read = createLegalVersionReader(pool, ["org"])
  const invoke = <T>(operation: () => Promise<T>) =>
    runWithRequestContext({ correlationId: "test", identity: { userId: "user", organizationId: "org" } }, operation)
  const rows = (values: unknown[] = []) =>
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  const begin = () => {
    rows()
    rows()
    rows()
  }
  const rights = () => {
    const stored = { policy: officialFederalRights, policy_hash: digest(JSON.stringify(officialFederalRights)) }
    rows([stored])
    rows([stored])
  }
  return { read, invoke, rows, begin, rights, connect, query }
}

it("requires identity before resolving a version namespace", async () => {
  const f = fixture()
  await expect(f.read(versionId, {})).rejects.toMatchObject({ category: "unauthorized" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("returns an exact provision version with independently authorized edition context", async () => {
  const f = fixture()
  f.begin()
  f.rows([{ data: { kind: "provision", version: provisionVersion } }])
  f.rows([{ rights_profile_id: "official" }])
  f.rights()
  f.rows([{ rights_profile_id: "official" }])
  f.rights()
  f.rows([{ data: editionContext }])
  f.rows()
  await expect(f.invoke(() => f.read(versionId, { editionId }))).resolves.toEqual({
    kind: "provision",
    version: provisionVersion,
    selectedContext: editionContext
  })
})

it("returns a context-neutral publication version or its exact authorized observation", async () => {
  const neutral = fixture()
  neutral.begin()
  neutral.rows([{ data: { kind: "publication", version: publicationVersion } }])
  neutral.rows([{ rights_profile_id: "official" }])
  neutral.rights()
  neutral.rows()
  await expect(neutral.invoke(() => neutral.read(versionId, {}))).resolves.toEqual({
    kind: "publication",
    version: publicationVersion,
    selectedContext: null
  })

  const selected = fixture()
  selected.begin()
  selected.rows([{ data: { kind: "publication", version: publicationVersion } }])
  selected.rows([{ rights_profile_id: "official" }])
  selected.rights()
  selected.rows([{ rights_profile_id: "official" }])
  selected.rights()
  selected.rows([{ data: publicationContext }])
  selected.rows()
  await expect(
    selected.invoke(() => selected.read(versionId, { sourceObservationId: observationId }))
  ).resolves.toEqual({
    kind: "publication",
    version: publicationVersion,
    selectedContext: publicationContext
  })
})
