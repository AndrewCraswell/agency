import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createLegalCitationResolver, normalizeLegalCitation } from "./legal-citation-read"

const codeId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const provisionId = "00000000-0000-4000-8000-000000000003"
const versionId = "00000000-0000-4000-8000-000000000004"
const candidate = {
  provisionId,
  versionId,
  codeId,
  editionId,
  jurisdictionId: "jurisdiction:us",
  codeKey: "cfr-title-21",
  codeName: "Code of Federal Regulations, title 21",
  citation: "cfr:21:section:177.2800",
  identityKey: "cfr:21:section:177.2800",
  nodeKind: "section",
  heading: "Indirect food additives",
  sourceLocator: "/ECFR[1]/DIV8[1]",
  textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
}
const edition = {
  id: editionId,
  code_id: codeId,
  code_key: "cfr-title-21",
  rights_profile_id: "official"
}
const policy = { policy: officialFederalRights, policy_hash: digest(JSON.stringify(officialFederalRights)) }
const pools: pg.Pool[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(pools.splice(0).map((pool) => pool.end()))
})

function fixture(candidates: unknown[] = [candidate]) {
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
  rows()
  rows()
  rows()
  rows([edition])
  rows([policy])
  rows([policy])
  rows(candidates)
  rows()
  const resolve = createLegalCitationResolver(pool, ["org"])
  const run = <T>(operation: () => T) =>
    runWithRequestContext({ correlationId: "test", identity: { userId: "user", organizationId: "org" } }, operation)
  return { connect, query, resolve, run }
}

it("normalizes only explicit canonical, printed and section citation forms", () => {
  expect(normalizeLegalCitation("21 C.F.R. § 177.2800")).toMatchObject({
    normalizedInput: "cfr:21:section:177.2800",
    requiresCodeContext: false
  })
  expect(normalizeLegalCitation("Section 177.2800")).toMatchObject({
    normalizedInput: "section:177.2800",
    requiresCodeContext: true
  })
  expect(normalizeLegalCitation("food-contact substances")).toEqual({
    aliases: ["food-contact substances"],
    normalizedInput: "food-contact substances",
    requiresCodeContext: false
  })
})

it("resolves one exact complete citation", async () => {
  const f = fixture()
  await expect(
    f.run(() => f.resolve({ citation: "21 CFR 177.2800", jurisdictionId: "jurisdiction:us" }))
  ).resolves.toMatchObject({ status: "resolved", match: candidate, candidates: [] })
  expect(f.query.mock.calls.at(-2)?.[1]).toEqual([[editionId], ["cfr:21:section:177.2800"], "177.2800"])
})

it("requires code context for a bare section even when only one candidate is visible", async () => {
  const f = fixture()
  await expect(
    f.run(() => f.resolve({ citation: "§ 177.2800", jurisdictionId: "jurisdiction:us" }))
  ).resolves.toMatchObject({
    status: "ambiguous",
    match: null,
    candidates: [candidate],
    refinement: "code_or_edition_required"
  })
})

it("returns not_found without converting descriptive text into a fuzzy query", async () => {
  const f = fixture([])
  await expect(
    f.run(() => f.resolve({ citation: "food-contact substances", jurisdictionId: "jurisdiction:us" }))
  ).resolves.toMatchObject({ status: "not_found", candidates: [] })
})

it("requires identity before opening a database connection", async () => {
  const pool = new pg.Pool()
  pools.push(pool)
  const connect = vi.spyOn(pool, "connect")
  const resolve = createLegalCitationResolver(pool, ["org"])
  await expect(resolve({ citation: "21 CFR 177.2800", jurisdictionId: "jurisdiction:us" })).rejects.toMatchObject({
    category: "unauthorized"
  })
  expect(connect).not.toHaveBeenCalled()
})
