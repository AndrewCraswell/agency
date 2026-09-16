import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalEditionSearch } from "./legal-edition-search.js"

vi.mock("@repo/legislation-core/legal-text/rights", () => ({ requireRights: vi.fn<() => Promise<void>>() }))
const editionId = "00000000-0000-4000-8000-000000000001"
const versionId = "00000000-0000-4000-8000-000000000002"
const generationId = "b".repeat(64)
const preparationId = "c".repeat(64)
const inventoryHash = "d".repeat(64)
const signature = "e".repeat(64)
const body = "Ethical conduct standards."
const id = digest(JSON.stringify([generationId, 0]))
const data = {
  id,
  versionId,
  ordinal: 0,
  start: 0,
  end: body.length,
  text: body,
  inputText: body,
  tokenCount: 5,
  readerSpans: [],
  contextSpans: [],
  inputHash: digest(body),
  rowContinuation: null
}
const metadata = {
  id: generationId,
  provision_version_id: versionId,
  document_version_id: null,
  contract: "test",
  body_hash: digest(body),
  tokenizer_id: "test",
  context: "",
  manifest_hash: digest(JSON.stringify([data])),
  passage_count: 1,
  eligibility: "eligible"
}
const passage = { id, ordinal: 0, body, input_text: body, data }
const edition = {
  id: editionId,
  code_id: editionId,
  source_id: "ecfr",
  rights_profile_id: "official",
  currency_date: "2026-09-11",
  issue_date: "2026-09-10",
  code_name: "Code of Federal Regulations, title 3",
  observation_id: "f".repeat(64),
  source_url: "https://www.ecfr.gov/title-3",
  publisher: "Office of the Federal Register / GPO",
  retrieved_at: "2026-09-15T00:00:00Z",
  published_at: "2026-09-15T01:00:00Z",
  attribution: null
}
const registration = {
  edition_id: editionId,
  preparation_id: preparationId,
  inventory_hash: inventoryHash,
  expected_count: 1
}
const receipt = {
  scope_id: editionId,
  preparation_id: preparationId,
  inventory_hash: inventoryHash,
  generation_count: 1,
  passage_count: 1
}
const summary = { scope_id: editionId, generations: 1, passages: 1, inventory: signature }
const candidate = { ...passage, edition_id: editionId, generation_id: generationId, metadata, score: 0.1 }
const original = {
  ...passage,
  generation_id: generationId,
  metadata,
  edition_id: editionId,
  provision_id: versionId,
  native_id: "cfr:3:section:100.1",
  heading: "Ethical conduct",
  source_locator: "/SECTION[1]",
  parent_id: null,
  content_hash: "a".repeat(64)
}
const pools: pg.Pool[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(requireRights).mockReset()
  await Promise.all(pools.splice(0).map((pool) => pool.end()))
})
function connection() {
  const pool = new pg.Pool()
  pools.push(pool)
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const connect = vi.spyOn(pool, "connect").mockImplementation(async () => client)
  const query = vi.spyOn(client, "query")
  const rows = (values: unknown[] = []) =>
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  return { pool, connect, rows, query }
}
function fixture() {
  const source = connection(),
    target = connection()
  const search = createLegalEditionSearch(source.pool, target.pool, ["org"])
  const request = { editionIds: [editionId], query: "ethical" }
  const run = () =>
    runWithRequestContext({ correlationId: "test", identity: { userId: "user", organizationId: "org" } }, () =>
      search(request)
    )
  function sourcePlan(registrations = [registration]) {
    source.rows([{ name: "canonical" }])
    source.rows()
    source.rows()
    source.rows()
    source.rows([edition])
    source.rows([{ policy_hash: "a".repeat(64) }])
    source.rows(registrations)
  }
  function targetPlan(receipts = [receipt]) {
    target.rows([{ name: "legislation_passage_search" }])
    target.rows()
    target.rows()
    target.rows()
    target.rows(receipts)
  }
  return { source, target, search, request, run, sourcePlan, targetPlan }
}

it("rejects anonymous requests before connecting", async () => {
  const f = fixture()
  await expect(f.search(f.request)).rejects.toMatchObject({ category: "unauthorized" })
  expect(f.source.connect).not.toHaveBeenCalled()
  expect(f.target.connect).not.toHaveBeenCalled()
})

it("requires all requested source acknowledgements before target access", async () => {
  const f = fixture()
  f.sourcePlan([])
  f.source.rows()
  await expect(f.run()).rejects.toMatchObject({ category: "dependency_unavailable" })
  expect(f.target.connect).not.toHaveBeenCalled()
  expect(vi.mocked(requireRights).mock.calls.map((call) => call[2])).toEqual(["apiMcp", "displayText", "localSearch"])
})

it("denies revoked rights before target access", async () => {
  const f = fixture()
  f.source.rows([{ name: "canonical" }])
  f.source.rows()
  f.source.rows()
  f.source.rows()
  f.source.rows([edition])
  f.source.rows()
  vi.mocked(requireRights).mockRejectedValueOnce(new Error("rights_denied:apiMcp"))
  await expect(f.run()).rejects.toMatchObject({ category: "forbidden" })
  expect(f.target.connect).not.toHaveBeenCalled()
})

it("rejects changed target receipts and missing memberships before ranking", async () => {
  for (const changedReceipt of [true, false]) {
    const f = fixture()
    f.sourcePlan()
    f.targetPlan(changedReceipt ? [{ ...receipt, inventory_hash: "f".repeat(64) }] : [receipt])
    if (!changedReceipt) {
      f.target.rows()
      f.source.rows([summary])
      f.target.rows([{ ...summary, inventory: "f".repeat(64) }])
    }
    f.target.rows()
    f.source.rows()
    await expect(f.run()).rejects.toMatchObject({ category: "dependency_unavailable" })
    expect(
      f.target.query.mock.calls.some((call) => typeof call[0] === "string" && call[0].includes("websearch_to_tsquery"))
    ).toBe(false)
  }
})

function readyFixture(corrupt = false) {
  const f = fixture()
  f.sourcePlan()
  f.targetPlan()
  f.target.rows()
  f.source.rows([summary])
  f.target.rows([summary])
  f.target.rows([{ scope_id: editionId, passages: 1 }])
  f.source.rows([{ kind: "edition", id: editionId, count: 1, source_hash: signature }])
  f.target.rows([{ kind: "edition", id: editionId, count: 1, source_hash: signature, target_hash: signature }])
  f.target.rows([{ id, editionId, generationId, versionId, score: 0.1 }])
  f.target.rows([corrupt ? { ...candidate, body: "tampered" } : candidate])
  f.source.rows([original])
  f.target.rows()
  f.source.rows()
  return f
}

it("hydrates exact source/version hits", async () => {
  const f = readyFixture()
  const result = await f.run()
  expect(result.hits).toHaveLength(1)
  expect(result.hits[0]).toMatchObject({
    editionId,
    versionId,
    passageId: id,
    sourceCurrencyDate: "2026-09-11",
    textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
  })
  expect(result.mode).toBe("lexical")
})

it("rejects changed copied text", async () => {
  await expect(readyFixture(true).run()).rejects.toThrow("legal_search_candidate_mismatch")
})

it("rejects stale revision receipts before ranking, including queries with no candidates", async () => {
  const f = fixture()
  f.sourcePlan()
  f.targetPlan()
  f.target.rows()
  f.source.rows([summary])
  f.target.rows([summary])
  f.target.rows([{ scope_id: editionId, passages: 1 }])
  f.source.rows([{ kind: "edition", id: editionId, count: 1, source_hash: signature }])
  f.target.rows([])
  f.target.rows()
  f.source.rows()
  await expect(f.run()).rejects.toMatchObject({ category: "dependency_unavailable" })
  expect(
    f.target.query.mock.calls.some((call) => typeof call[0] === "string" && call[0].includes("websearch_to_tsquery"))
  ).toBe(false)
})

it.each(["revocation", "missing_passage"])("rejects %s before ranking", async (kind) => {
  const f = fixture()
  f.sourcePlan()
  f.targetPlan()
  f.target.rows(kind === "revocation" ? [{}] : [])
  if (kind === "missing_passage") {
    f.source.rows([summary])
    f.target.rows([summary])
    f.target.rows([{ scope_id: editionId, passages: 0 }])
  }
  f.target.rows()
  f.source.rows()
  await expect(f.run()).rejects.toMatchObject({ category: "dependency_unavailable" })
  expect(
    f.target.query.mock.calls.some((call) => typeof call[0] === "string" && call[0].includes("websearch_to_tsquery"))
  ).toBe(false)
})
