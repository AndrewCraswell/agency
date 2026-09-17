import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalAgenciesReader } from "./legal-agencies-read"

const first = {
  sourceAgencyId: "fr-agency-406",
  nativeId: "406",
  name: "Personnel Management Office",
  names: ["Office of Personnel Management", "Personnel Management Office"],
  publicationCount: 2,
  firstPublishedOn: "2000-01-18",
  lastPublishedOn: "2001-01-18"
}
const second = {
  sourceAgencyId: "fr-agency-unidentified-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  nativeId: null,
  name: "Independent Office",
  names: ["Independent Office"],
  publicationCount: 1,
  firstPublishedOn: "2000-01-18",
  lastPublishedOn: "2000-01-18"
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
  const reader = createLegalAgenciesReader(pool, ["org", "other"])
  const read = (input: unknown = {}, userId = "user", organizationId = "org") =>
    runWithRequestContext({ correlationId: "test", identity: { userId, organizationId } }, () => reader(input))
  function rows(values: unknown[]) {
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  }
  function catalog(items = [first, second], policy = officialFederalRights) {
    rows([])
    rows([])
    rows([])
    rows([{ id: "official", policy, policy_hash: digest(JSON.stringify(policy)) }])
    rows(items)
    rows([])
  }
  return { catalog, connect, query, read, reader }
}

it("requires an approved identity before reading source agencies", async () => {
  const f = fixture()
  await expect(f.reader({})).rejects.toMatchObject({ category: "unauthorized" })
  await expect(f.read({}, "user", "denied")).rejects.toMatchObject({ category: "forbidden" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("preserves unresolved publisher identity, aliases and document-scoped references", async () => {
  const f = fixture()
  f.catalog()
  const result = await f.read({ limit: 100 })
  expect(result.items).toEqual([
    {
      status: "unresolved",
      organizationId: null,
      sourceAgencyId: first.sourceAgencyId,
      name: first.name,
      aliases: ["Office of Personnel Management"],
      sourceId: "federal-register",
      nativeId: "406",
      jurisdictionId: "jurisdiction:us",
      publicationCount: 2,
      firstPublishedOn: "2000-01-18",
      lastPublishedOn: "2001-01-18"
    },
    expect.objectContaining({ sourceAgencyId: second.sourceAgencyId, nativeId: null, aliases: [] })
  ])
  const sql = f.query.mock.calls.find((call) => typeof call[0] === "string" && call[0].includes("agency_rows"))
  expect(sql?.[0]).toContain("o.rights_profile_id=ANY($1::text[])")
  expect(sql?.[1]).toEqual([["official"]])
})

it("filters aliases and binds continuation to caller, filters, rights and catalog", async () => {
  const f = fixture()
  f.catalog()
  const alias = await f.read({ q: "office of personnel", limit: 1 })
  expect(alias.items.map((entry) => entry.sourceAgencyId)).toEqual([first.sourceAgencyId])

  f.catalog()
  const firstPage = await f.read({ limit: 1 })
  expect(firstPage.nextCursor).toBeTruthy()
  f.catalog()
  expect(await f.read({ limit: 1, cursor: firstPage.nextCursor })).toMatchObject({
    items: [expect.objectContaining({ sourceAgencyId: second.sourceAgencyId })],
    truncated: false
  })
  f.catalog()
  await expect(f.read({ limit: 1, q: "office", cursor: firstPage.nextCursor })).rejects.toMatchObject({
    category: "conflict"
  })
})

it("returns no federal entries for another jurisdiction and rejects malformed cursors without connecting", async () => {
  const f = fixture()
  expect(await f.read({ jurisdictionId: "jurisdiction:ca" })).toEqual({ items: [], truncated: false, warnings: [] })
  await expect(f.read({ cursor: "bad" })).rejects.toMatchObject({ category: "invalid_request" })
  expect(f.connect).not.toHaveBeenCalled()
})
