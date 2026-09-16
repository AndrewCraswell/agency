import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalBrowser } from "./legal-browse-read.js"

const codeId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const nextEdition = "00000000-0000-4000-8000-000000000003"
const versionId = "00000000-0000-4000-8000-000000000004"
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
  await expect(f.browser.listProvisions(codeId, {})).rejects.toMatchObject({ category: "unauthorized" })
  expect(f.connect).not.toHaveBeenCalled()
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
