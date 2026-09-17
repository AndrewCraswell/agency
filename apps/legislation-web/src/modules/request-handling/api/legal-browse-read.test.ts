import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalBrowser } from "./legal-browse-read"

const codeId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const nextEdition = "00000000-0000-4000-8000-000000000003"
const versionId = "00000000-0000-4000-8000-000000000004"
const provisionId = "00000000-0000-4000-8000-000000000005"
const edition = {
  id: editionId,
  codeId,
  sourceId: "ecfr",
  jurisdictionId: "jurisdiction:us",
  rightsProfileId: "official",
  sourceObservationId: "a".repeat(64),
  nativeKey: "2026-09-10",
  sourceRevision: "revision",
  sourceUrl: "https://www.ecfr.gov/api/versioner/v1/full/2026-09-10/title-3.xml",
  issueDate: "2026-09-10",
  sourceCurrencyDate: "2026-09-11",
  publishedAt: "2026-09-15T00:00:00Z",
  scope: "current_code_snapshot"
}
const member = {
  id: codeId,
  codeId,
  editionId,
  versionId,
  parentId: null,
  ordinal: 0,
  nativeId: "3 CFR 1",
  nodeKind: "section",
  heading: "Heading",
  sourceLocator: "/DIV8[1]",
  hasChildren: false,
  textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
}
const provision = {
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
    heading: "Heading",
    nodeKind: "section",
    language: "en"
  },
  selectedContext: {
    edition,
    parentId: null,
    ordinal: 0,
    nativeId: "3 CFR 1",
    sourceLocator: "/DIV8[1]",
    isLatestValidated: true,
    textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
  },
  textPreview: "Exact source preview",
  previewTruncated: false
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
  const browser = createLegalBrowser(pool, ["org"])
  const run = <T>(operation: () => T, userId = "user") =>
    runWithRequestContext({ correlationId: "test", identity: { userId, organizationId: "org" } }, operation)
  const rows = (values: unknown[] = []) =>
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  function begin() {
    rows()
    rows()
    rows()
  }
  function rights(text = true, policy = officialFederalRights) {
    const stored = { policy, policy_hash: digest(JSON.stringify(policy)) }
    rows([stored])
    if (text) {
      rows([stored])
    }
    rows([stored])
  }
  function provisions(items = [member, { ...member, id: nextEdition, ordinal: 1 }]) {
    begin()
    rows([edition])
    rights()
    rows(items)
    rows()
  }
  return { browser, run, rows, begin, rights, provisions, query, connect }
}

it("requires identity before database access", async () => {
  const f = fixture()
  await expect(f.browser.listEditions(codeId, {})).rejects.toMatchObject({ category: "unauthorized" })
  await expect(f.browser.getEdition(editionId)).rejects.toMatchObject({ category: "unauthorized" })
  await expect(f.browser.listProvisions(codeId, {})).rejects.toMatchObject({ category: "unauthorized" })
  await expect(f.browser.getProvision(provisionId, {})).rejects.toMatchObject({ category: "unauthorized" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("reads a provision in an authorized exact edition and refuses mismatched selectors", async () => {
  const f = fixture()
  f.begin()
  f.rows([{ edition_id: editionId, rights_profile_id: "official" }])
  f.rights()
  f.rows([{ data: provision }])
  f.rows()
  await expect(f.run(() => f.browser.getProvision(provisionId, { editionId, versionId }))).resolves.toEqual(provision)
  const selection = f.query.mock.calls.find(
    (call) => typeof call[0] === "string" && call[0].includes("m.edition_id=COALESCE")
  )
  expect(selection?.[1]).toEqual([provisionId, editionId, versionId])

  const missing = fixture()
  missing.begin()
  missing.rows()
  missing.rows()
  await expect(
    missing.run(() => missing.browser.getProvision(provisionId, { editionId, versionId }))
  ).rejects.toMatchObject({ category: "not_found" })
})

it("returns a context-neutral exact version only after one published membership authorizes text", async () => {
  const f = fixture()
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights()
  f.rows([{ data: { ...provision, selectedContext: null } }])
  f.rows()
  await expect(f.run(() => f.browser.getProvision(provisionId, { versionId }))).resolves.toMatchObject({
    selectedVersion: { id: versionId },
    selectedContext: null
  })
})

it("lists immutable provision versions with caller-bound continuation", async () => {
  const firstVersion = {
    ...provision.selectedVersion,
    firstObservedAt: "2026-09-15T00:00:00.000000Z",
    lastObservedAt: "2026-09-16T00:00:00.000000Z",
    editionCount: 2
  }
  const priorVersion = {
    ...firstVersion,
    id: "00000000-0000-4000-8000-000000000003",
    firstObservedAt: "2025-09-15T00:00:00.000000Z",
    lastObservedAt: "2025-09-15T00:00:00.000000Z",
    editionCount: 1
  }
  const f = fixture()
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights()
  f.rows([firstVersion, priorVersion])
  f.rows()
  const first = await f.run(() => f.browser.listProvisionVersions(provisionId, { limit: 1, sourceId: "ecfr" }))
  expect(first.items).toEqual([firstVersion])
  expect(first.nextCursor).toBeTruthy()

  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights()
  f.rows([firstVersion, priorVersion])
  f.rows()
  await expect(
    f.run(
      () =>
        f.browser.listProvisionVersions(provisionId, {
          limit: 1,
          sourceId: "ecfr",
          cursor: first.nextCursor
        }),
      "other"
    )
  ).rejects.toMatchObject({ category: "conflict" })
})

it("lists exact edition memberships for one provision version", async () => {
  const membership = {
    provisionId,
    versionId,
    ...provision.selectedContext!
  }
  const f = fixture()
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights()
  f.rows([{ data: membership }])
  f.rows()
  const result = await f.run(() =>
    f.browser.listProvisionEditions(provisionId, { versionId, sourceId: "ecfr", limit: 20 })
  )
  expect(result.items).toEqual([membership])
  const catalogQuery = f.query.mock.calls.find(
    (call) => typeof call[0] === "string" && call[0].includes("'provisionId',m.provision_id")
  )
  expect(catalogQuery?.[1]).toEqual([provisionId, ["official"], versionId, "ecfr"])
})

it("reads an authorized exact edition with current-head and member context", async () => {
  const f = fixture()
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights(false)
  f.rows([{ ...edition, publishedMembers: 14, isCurrent: true, annualVolume: null }])
  f.rows()
  const result = await f.run(() => f.browser.getEdition(editionId))
  expect(result).toMatchObject({ id: editionId, publishedMembers: 14, isCurrent: true, annualVolume: null })
})

it("returns annual manifest context and authorizes before reading it", async () => {
  const f = fixture()
  const annualVolume = {
    annualEditionId: "b".repeat(64),
    codeId,
    packageYear: 2025,
    revisionDate: "2025-01-01",
    volume: 2,
    expectedVolumes: 2,
    coverage: { isComplete: true }
  }
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights(false)
  f.rows([
    {
      ...edition,
      sourceId: "govinfo-cfr",
      scope: "annual_volume",
      publishedMembers: 20,
      isCurrent: false,
      annualVolume
    }
  ])
  f.rows()
  expect(await f.run(() => f.browser.getEdition(editionId))).toMatchObject({ annualVolume })
  const detailQuery = f.query.mock.calls.find(
    (call) => typeof call[0] === "string" && call[0].includes("publishedMembers")
  )
  expect(detailQuery?.[1]).toEqual([editionId, "official"])
})

it("does not read exact-edition metadata when API rights are denied", async () => {
  const f = fixture()
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  const policy = { ...officialFederalRights, apiMcp: false }
  f.rows([{ policy, policy_hash: digest(JSON.stringify(policy)) }])
  f.rows()
  await expect(f.run(() => f.browser.getEdition(editionId))).rejects.toMatchObject({ category: "forbidden" })
  expect(f.query.mock.calls.some((call) => typeof call[0] === "string" && call[0].includes("publishedMembers"))).toBe(
    false
  )
})

it("pins default-head continuation to the original edition and preserves source order", async () => {
  const f = fixture()
  f.provisions()
  const first = await f.run(() => f.browser.listProvisions(codeId, { limit: 1, traversal: "all" }))
  expect(first.items).toEqual([member])
  expect(first.nextCursor).toBeTruthy()
  f.provisions([{ ...member, id: nextEdition, ordinal: 1 }])
  const next = await f.run(() =>
    f.browser.listProvisions(codeId, { limit: 1, traversal: "all", cursor: first.nextCursor })
  )
  expect(next.truncated).toBe(false)
  const selection = f.query.mock.calls.filter(
    (call) => typeof call[0] === "string" && call[0].includes("legal_code_heads")
  )
  expect(selection[0]?.[1]).toEqual([codeId, null])
  expect(selection[1]?.[1]).toEqual([codeId, editionId])
})

it("refuses changed caller, explicit selection and page size before querying members", async () => {
  const f = fixture()
  f.provisions()
  const first = await f.run(() => f.browser.listProvisions(codeId, { limit: 1 }))
  for (const [input, caller] of [
    [{ limit: 2 }, "user"],
    [{ limit: 1, editionId }, "user"],
    [{ limit: 1 }, "other"]
  ] as const) {
    f.begin()
    f.rows([edition])
    f.rights()
    f.rows()
    await expect(
      f.run(() => f.browser.listProvisions(codeId, { ...input, cursor: first.nextCursor }), caller)
    ).rejects.toMatchObject({ category: "conflict" })
  }
  expect(
    f.query.mock.calls.filter((call) => typeof call[0] === "string" && call[0].includes("v.heading"))
  ).toHaveLength(1)
})

it("checks text rights before returning headings or checking parent membership", async () => {
  const f = fixture()
  f.begin()
  f.rows([edition])
  const policy = { ...officialFederalRights, displayText: false }
  f.rows([{ policy, policy_hash: digest(JSON.stringify(policy)) }])
  f.rows([{ policy, policy_hash: digest(JSON.stringify(policy)) }])
  f.rows()
  await expect(f.run(() => f.browser.listProvisions(codeId, { parentId: codeId }))).rejects.toMatchObject({
    category: "forbidden"
  })
  expect(
    f.query.mock.calls.some((call) => typeof call[0] === "string" && call[0].includes("legal_edition_provisions"))
  ).toBe(false)
})

it("rejects unsupported asOf and parents absent from the pinned edition", async () => {
  const f = fixture()
  f.begin()
  f.rows()
  await expect(f.run(() => f.browser.listProvisions(codeId, { asOf: "2020-01-01" }))).rejects.toMatchObject({
    category: "conflict",
    details: { reason: "historical_coverage_unavailable" }
  })
  f.begin()
  f.rows([edition])
  f.rights()
  f.rows()
  f.rows()
  await expect(f.run(() => f.browser.listProvisions(codeId, { parentId: codeId }))).rejects.toMatchObject({
    category: "not_found"
  })
})

it("filters edition dates and sources without claiming annual volumes are current snapshots", async () => {
  const f = fixture()
  f.begin()
  f.rows([{ rights_profile_id: "official" }])
  f.rights(false)
  const annual = {
    ...edition,
    id: nextEdition,
    sourceId: "govinfo-cfr",
    scope: "annual_volume",
    issueDate: "2025-01-01"
  }
  f.rows([edition, annual])
  f.rows()
  const result = await f.run(() => f.browser.listEditions(codeId, { sourceId: "govinfo-cfr", issuedTo: "2025-12-31" }))
  expect(result.items).toEqual([annual])
  expect(result.truncated).toBe(false)
})
