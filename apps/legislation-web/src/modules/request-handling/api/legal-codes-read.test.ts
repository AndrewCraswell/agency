import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalCodesReader } from "./legal-codes-read"

const id = "00000000-0000-4000-8000-000000000001"
const code = {
  id,
  jurisdictionId: "jurisdiction:us",
  codeKey: "cfr:1",
  name: "Title 1",
  kind: "regulation",
  canonicalUrl: `/api/legal/codes/${id}`,
  updatedAt: "2026-09-15T00:00:00.000000Z",
  sources: [{ sourceId: "ecfr", rightsProfileId: "official" }]
}
const secondId = "00000000-0000-4000-8000-000000000002"
const second = { ...code, id: secondId, canonicalUrl: `/api/legal/codes/${secondId}`, name: "Title 2" }
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
  const reader = createLegalCodesReader(pool, ["org", "other"])
  const read = reader.listCodes
  const page = (input: unknown = {}, userId = "user", organizationId = "org") =>
    runWithRequestContext({ correlationId: "test", identity: { userId, organizationId } }, () => read(input))
  function rows(values: unknown[]) {
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  }
  function catalog(items = [code, second], policy = officialFederalRights) {
    rows([])
    rows([])
    rows([])
    rows([{ id: "official", policy, policy_hash: digest(JSON.stringify(policy)) }])
    rows(items)
    rows([])
  }
  const detail = (codeId = id) =>
    runWithRequestContext({ correlationId: "test", identity: { userId: "user", organizationId: "org" } }, () =>
      reader.getCode(codeId)
    )
  return { read, page, detail, catalog, query, connect, rows, reader }
}

it("requires approved identity before connecting", async () => {
  const f = fixture()
  await expect(f.read({})).rejects.toMatchObject({ category: "unauthorized" })
  await expect(f.page({}, "user", "denied")).rejects.toMatchObject({ category: "forbidden" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("pages without duplicates and rejects caller, filter, limit and catalog changes", async () => {
  const f = fixture()
  f.catalog()
  const first = await f.page({ limit: 1 })
  expect(first.items).toEqual([code])
  expect(first.nextCursor).toBeTruthy()
  f.catalog()
  expect(await f.page({ limit: 1, cursor: first.nextCursor })).toMatchObject({ items: [second], truncated: false })
  for (const [input, user, org] of [
    [{ limit: 2 }, "user", "org"],
    [{ limit: 1, kind: "regulation" }, "user", "org"],
    [{ limit: 1 }, "different", "org"],
    [{ limit: 1 }, "user", "other"]
  ] as const) {
    f.catalog()
    await expect(f.page({ ...input, cursor: first.nextCursor }, user, org)).rejects.toMatchObject({
      category: "conflict"
    })
  }
  f.catalog([second])
  await expect(f.page({ limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ category: "conflict" })
})

it("excludes revoked or territory-restricted profiles before aggregation and invalidates continuation", async () => {
  const f = fixture()
  f.catalog()
  const first = await f.page({ limit: 1 })
  for (const policy of [
    { ...officialFederalRights, apiMcp: false },
    { ...officialFederalRights, territories: ["US"] }
  ]) {
    f.catalog([], policy)
    await expect(f.page({ limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ category: "conflict" })
    const catalogCall = f.query.mock.calls.findLast(
      (call) => typeof call[0] === "string" && call[0].includes("GROUP BY")
    )
    expect(catalogCall?.[1]).toEqual([[], null, null, null])
  }
})

it("rejects malformed continuations before database access", async () => {
  const f = fixture()
  await expect(f.page({ cursor: "bad" })).rejects.toMatchObject({ category: "invalid_request" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("filters detail by exact code identity and hides missing or revoked codes", async () => {
  const f = fixture()
  await expect(f.reader.getCode(id)).rejects.toMatchObject({ category: "unauthorized" })
  expect(f.connect).not.toHaveBeenCalled()
  f.catalog([code])
  expect(await f.detail()).toEqual(code)
  expect(
    f.query.mock.calls.findLast((call) => typeof call[0] === "string" && call[0].includes("GROUP BY"))?.[1]
  ).toEqual([["official"], null, null, id])
  for (const policy of [officialFederalRights, { ...officialFederalRights, apiMcp: false }]) {
    f.catalog([], policy)
    await expect(f.detail()).rejects.toMatchObject({ category: "not_found" })
  }
  f.catalog([second])
  await expect(f.detail()).rejects.toThrow("legal_code_identity_mismatch")
})
