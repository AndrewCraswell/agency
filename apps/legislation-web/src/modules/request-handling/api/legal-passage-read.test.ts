import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalPassageReader } from "./legal-passage-read"

const versionId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const provisionId = "00000000-0000-4000-8000-000000000003"
const generationId = "a".repeat(64)
const passageId = "b".repeat(64)
const preparationId = "9".repeat(64)
const policyHash = digest(JSON.stringify(officialFederalRights))
const pools: pg.Pool[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(pools.splice(0).map((pool) => pool.end()))
})

function fixture() {
  const pool = new pg.Pool()
  const searchPool = new pg.Pool()
  pools.push(pool, searchPool)
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const target = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const connect = vi.spyOn(pool, "connect").mockImplementation(async () => client)
  vi.spyOn(searchPool, "connect").mockImplementation(async () => target)
  const query = vi.spyOn(client, "query")
  const targetQuery = vi.spyOn(target, "query")
  const reader = createLegalPassageReader(pool, searchPool, ["org"])
  const invoke = (input: unknown, userId = "user", organizationId = "org") =>
    runWithRequestContext({ correlationId: "test", identity: { userId, organizationId } }, () =>
      reader.listPassages(versionId, input)
    )
  function rows(values: unknown[]) {
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  }
  function targetRows(values: unknown[]) {
    targetQuery.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  }
  function page(
    passages: unknown[] = [storedPassage],
    hash = policyHash,
    generations = [{ generation_id: generationId }]
  ) {
    rows([])
    rows([])
    rows([])
    rows([
      {
        owner_id: provisionId,
        source_id: "ecfr",
        jurisdiction_id: "jurisdiction:us",
        rights_profile_id: "official",
        source_locator: "/ECFR[1]",
        observation_id: "c".repeat(64),
        parent_id: null,
        currency_date: "2026-09-17",
        publication_date: null
      }
    ])
    rows([{ policy: officialFederalRights, policy_hash: hash }])
    rows([{ policy: officialFederalRights, policy_hash: hash }])
    rows([{ policy_hash: hash }])
    targetRows([])
    targetRows([])
    targetRows([])
    targetRows([{ preparation_id: preparationId, generation_count: 1 }])
    targetRows([])
    rows(generations)
    if (generations.length === 1) {
      targetRows([{}])
      rows([{ kind: "edition", id: editionId, count: 1, source_hash: "8".repeat(64) }])
      targetRows([
        { kind: "edition", id: editionId, count: 1, source_hash: "8".repeat(64), target_hash: "8".repeat(64) }
      ])
      rows([{ provision_version_id: versionId, document_version_id: null, passage_count: passages.length }])
      rows([{ count: passages.length }])
      targetRows([])
      rows(passages)
    } else {
      targetRows([])
    }
    rows([])
  }
  return { reader, invoke, page, connect }
}

const data = {
  id: passageId,
  versionId,
  ordinal: 0,
  start: 0,
  end: 11,
  text: "Source text",
  inputText: "Heading\nSource text",
  tokenCount: 4,
  readerSpans: [{ blockId: "d".repeat(64), start: 0, end: 11 }],
  contextSpans: [],
  inputHash: digest("Heading\nSource text"),
  rowContinuation: null
}
const storedPassage = { id: passageId, ordinal: 0, body: "Source text", input_text: data.inputText, data }

it("rejects unapproved identities before connecting", async () => {
  const f = fixture()
  await expect(f.reader.listPassages(versionId, { editionId })).rejects.toMatchObject({ category: "unauthorized" })
  await expect(f.invoke({ editionId }, "user", "denied")).rejects.toMatchObject({ category: "forbidden" })
  expect(f.connect).not.toHaveBeenCalled()
})

it("returns source text and locators without exposing embedding input text", async () => {
  const f = fixture()
  f.page()
  const result = await f.invoke({ editionId })
  expect(result.items).toHaveLength(1)
  expect(result.items[0]).toMatchObject({ id: passageId, text: "Source text", generationId, versionId })
  expect(result.items[0]).not.toHaveProperty("inputText")
  expect(result.items[0]?.textUrl).toContain(`editionId=${editionId}&anchor=${"d".repeat(64)}`)
})

it("fails closed when no single acknowledged generation exists", async () => {
  const f = fixture()
  f.page([], policyHash, [])
  await expect(f.invoke({ editionId })).rejects.toMatchObject({ category: "dependency_unavailable" })
  const otherGeneration = "e".repeat(64)
  f.page([], policyHash, [{ generation_id: generationId }, { generation_id: otherGeneration }])
  await expect(f.invoke({ editionId })).rejects.toMatchObject({ category: "dependency_unavailable" })
})
