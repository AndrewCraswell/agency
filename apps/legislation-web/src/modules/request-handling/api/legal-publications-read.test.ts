import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalPublicationsReader } from "./legal-publications-read"

const first = {
  id: "00000000-0000-4000-8000-000000000001",
  versionId: "00000000-0000-4000-8000-000000000002",
  sourceObservationId: "00000000-0000-4000-8000-000000000003",
  nativeNumber: "00-100",
  documentNumber: "00-100",
  title: "Retirement eligibility",
  citation: "65 FR 2521",
  publicationKind: "final_rule",
  publishedOn: "2000-01-18",
  effectiveOn: null,
  agencyEvidence: [{ id: 406, raw_name: "Personnel Management Office" }],
  sourceLocator: "/RULE[1]",
  sourceUrl: "https://www.federalregister.gov/documents/2000/01/18/00-100/example",
  contentHash: "a".repeat(64),
  attribution: "Federal Register",
  updatedAt: "2026-09-17T00:00:00Z"
}
const second = {
  ...first,
  id: "00000000-0000-4000-8000-000000000004",
  versionId: "00000000-0000-4000-8000-000000000005",
  sourceObservationId: "00000000-0000-4000-8000-000000000006",
  nativeNumber: "00-101",
  documentNumber: "00-101",
  title: "Second rule"
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
  const reader = createLegalPublicationsReader(pool, ["org"])
  const invoke = <T>(operation: () => Promise<T>) =>
    runWithRequestContext({ correlationId: "test", identity: { userId: "user", organizationId: "org" } }, operation)
  const rows = (values: unknown[]) =>
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  const catalog = (items: unknown[], policy = officialFederalRights) => {
    rows([])
    rows([])
    rows([])
    rows([{ id: "official", policy, policy_hash: digest(JSON.stringify(policy)) }])
    rows(items)
    rows([])
  }
  return { reader, invoke, catalog, connect, query }
}

it("requires approved identity before publication access", async () => {
  const f = fixture()
  await expect(f.reader.listPublications({})).rejects.toMatchObject({ category: "unauthorized" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("returns exact source agencies and stable keyset continuation", async () => {
  const f = fixture()
  f.catalog([first, second])
  const page = await f.invoke(() =>
    f.reader.listPublications({ sourceId: "federal-register", sourceAgencyId: "fr-agency-406", limit: 1 })
  )
  expect(page.items[0]).toMatchObject({
    id: first.id,
    agencies: [{ sourceAgencyId: "fr-agency-406", organizationId: null }]
  })
  expect(page.nextCursor).toBeTruthy()
  const sql = f.query.mock.calls.find((call) => typeof call[0] === "string" && call[0].includes("CROSS JOIN LATERAL"))
  expect(sql?.[1]?.[5]).toBe("fr-agency-406")
  f.catalog([second])
  const resumed = await f.invoke(() =>
    f.reader.listPublications({
      sourceId: "federal-register",
      sourceAgencyId: "fr-agency-406",
      limit: 1,
      cursor: page.nextCursor
    })
  )
  expect(resumed.items[0]?.id).toBe(second.id)
})

it("reads document detail and rejects a cursor reused with changed filters", async () => {
  const f = fixture()
  f.catalog([first])
  expect(await f.invoke(() => f.reader.getPublication(first.id, first.versionId))).toMatchObject({
    id: first.id,
    versionId: first.versionId
  })
  f.catalog([first, second])
  const page = await f.invoke(() => f.reader.listPublications({ limit: 1 }))
  f.catalog([second])
  await expect(
    f.invoke(() => f.reader.listPublications({ limit: 1, kind: "notice", cursor: page.nextCursor }))
  ).rejects.toMatchObject({ category: "conflict" })
})
