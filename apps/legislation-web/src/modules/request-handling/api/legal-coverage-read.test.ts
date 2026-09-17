import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalCoverageReader } from "./legal-coverage-read"

const codeId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const preparationId = "a".repeat(64)
const pools: pg.Pool[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(pools.splice(0).map((pool) => pool.end()))
})

function result(rows: unknown[]) {
  return { rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }
}

function fixture(searchEnabled = true) {
  const sourcePool = new pg.Pool()
  const targetPool = new pg.Pool()
  pools.push(sourcePool, targetPool)
  const source = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const target = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  vi.spyOn(sourcePool, "connect").mockImplementation(async () => source)
  vi.spyOn(targetPool, "connect").mockImplementation(async () => target)
  const sourceQuery = vi.spyOn(source, "query").mockImplementation(async (query) => {
    const sql = String(query)
    if (!sql.startsWith("SELECT")) {
      return result([])
    }
    if (sql.includes("FROM legislation.legal_rights_profiles r")) {
      return result([
        {
          id: "official",
          policy: officialFederalRights,
          policy_hash: digest(JSON.stringify(officialFederalRights))
        }
      ])
    }
    if (sql.includes("SELECT e.id FROM legislation.legal_editions")) {
      return result([{ id: editionId }])
    }
    if (sql.includes("count(m.provision_id)")) {
      return result([
        {
          id: editionId,
          code_id: codeId,
          code_name: "Title 1",
          corpus: "regulation",
          jurisdiction_id: "jurisdiction:us",
          source_id: "ecfr",
          publisher: "Office of the Federal Register",
          authority: "official",
          issue_date: "2026-09-10",
          currency_date: "2026-09-11",
          published_at: "2026-09-15T00:00:00.000000Z",
          collected_at: "2026-09-14T00:00:00.000000Z",
          is_current: true,
          record_count: 12
        }
      ])
    }
    if (sql.includes("FROM legislation.legal_passage_preparations")) {
      return result([{ edition_id: editionId, preparation_id: preparationId }])
    }
    throw new Error(`Unexpected source query: ${sql}`)
  })
  const targetQuery = vi.spyOn(target, "query").mockImplementation(async (query) => {
    const sql = String(query)
    if (!sql.startsWith("SELECT")) {
      return result([])
    }
    if (sql.includes("FROM legislation.legal_search_scopes")) {
      return result([
        {
          scope_id: editionId,
          preparation_id: preparationId,
          generation_count: 2,
          passage_count: 14,
          verified_at: "2026-09-15T01:00:00.000000Z",
          revoked: false
        }
      ])
    }
    if (sql.includes("JOIN legislation.legal_embedding_generations")) {
      return result([
        {
          scope_id: editionId,
          model: "openai/text-embedding-3-small",
          dimensions: 1536,
          registered_generations: 2,
          ready_generations: 1,
          ready_passages: 5,
          ready_at: "2026-09-15T02:00:00.000000Z"
        }
      ])
    }
    throw new Error(`Unexpected target query: ${sql}`)
  })
  const reader = createLegalCoverageReader(sourcePool, searchEnabled ? targetPool : undefined, ["org"])
  const read = (input: unknown = {}, organizationId = "org", userId = "user") =>
    runWithRequestContext({ correlationId: "test", identity: { organizationId, userId } }, () => reader(input))
  return { read, sourceQuery, targetQuery }
}

it("reports canonical, lexical and partial semantic readiness independently", async () => {
  const { read, sourceQuery } = fixture()
  const page = await read({ codeId, corpus: "regulation", sourceId: "ecfr", limit: 1 })
  expect(page.items).toHaveLength(1)
  expect(page.items[0]).toMatchObject({
    id: editionId,
    stages: {
      sourceCollection: { status: "available", availableEditions: 1, excludedEditions: 0 },
      canonical: { status: "available", recordCount: 12 },
      lexical: { status: "available", passageCount: 14 },
      semantic: {
        status: "incomplete",
        reason: "semantic_vectors_incomplete",
        model: "openai/text-embedding-3-small",
        passageCount: 5
      }
    }
  })
  const editionCall = sourceQuery.mock.calls.find((call) => String(call[0]).includes("count(m.provision_id)"))
  expect((editionCall?.[1] as unknown[] | undefined)?.at(-1)).toEqual([editionId])
})

it("reports search stages as unsupported when the isolated search service is disabled", async () => {
  const { read, targetQuery } = fixture(false)
  const page = await read()
  expect(page.items[0]).toMatchObject({
    stages: {
      canonical: { status: "available" },
      lexical: { status: "unsupported", reason: "search_service_disabled" },
      semantic: { status: "unsupported", reason: "search_service_disabled" }
    }
  })
  expect(targetQuery).not.toHaveBeenCalled()
})

it("authorizes before connecting and rejects malformed continuations", async () => {
  const { read, sourceQuery } = fixture(false)
  await expect(read({}, "denied")).rejects.toMatchObject({ category: "forbidden" })
  expect(sourceQuery).not.toHaveBeenCalled()
  const first = await read({ limit: 1 })
  expect(first.nextCursor).toBeUndefined()
  await expect(read({ limit: 1, cursor: "bad" })).rejects.toMatchObject({ category: "invalid_request" })
})

it("does not disclose editions whose rights profile denies API access", async () => {
  const f = fixture(false)
  f.sourceQuery.mockReset().mockImplementation(async (query) => {
    const sql = String(query)
    if (!sql.startsWith("SELECT")) {
      return result([])
    }
    if (sql.includes("FROM legislation.legal_rights_profiles r")) {
      const policy = { ...officialFederalRights, apiMcp: false }
      return result([{ id: "official", policy, policy_hash: digest(JSON.stringify(policy)) }])
    }
    if (sql.includes("SELECT e.id FROM legislation.legal_editions")) {
      return result([])
    }
    if (sql.includes("FROM legislation.legal_passage_preparations")) {
      return result([])
    }
    throw new Error(`Unexpected source query: ${sql}`)
  })
  const page = await f.read()
  expect(page.items).toEqual([])
  const catalogCall = f.sourceQuery.mock.calls.find((call) =>
    String(call[0]).includes("SELECT e.id FROM legislation.legal_editions")
  )
  expect(catalogCall?.[1]?.[0]).toEqual([])
})
