import pg from "pg"
import { beforeEach, expect, it, vi } from "vitest"
import { planLegalPreparationPage } from "./preparation-plan.js"

const mocks = vi.hoisted(() => ({
  rights: vi.fn<typeof import("./passage-preparation.js").requireLegalPreparationRights>(),
  register: vi.fn<typeof import("./preparation-dispatch.js").registerLegalPreparationDispatch>()
}))
vi.mock("./passage-preparation.js", async (original) => ({
  ...(await original<typeof import("./passage-preparation.js")>()),
  requireLegalPreparationRights: mocks.rights
}))
vi.mock("./preparation-dispatch.js", async (original) => ({
  ...(await original<typeof import("./preparation-dispatch.js")>()),
  registerLegalPreparationDispatch: mocks.register
}))
const waveId = "00000000-0000-4000-8000-000000000001"
const ids = Array.from({ length: 11 }, (_, n) => `00000000-0000-4000-8000-${String(n + 10).padStart(12, "0")}`)
function admission(ownerIds = ids, scopeKind: "edition" | "publication" = "edition") {
  return {
    contract: "legal-passage-manifest-admission" as const,
    catalogHash: "d".repeat(64),
    model: "openai/text-embedding-3-small" as const,
    tokenizerId: "tokenizer",
    scopeKind,
    partitions: ownerIds.map((ownerId) => ({ ownerId, versions: 1, passages: 1 }))
  }
}
const input = {
  waveId,
  source: "ecfr",
  model: "openai/text-embedding-3-small",
  publishedBefore: "2026-09-15T00:00:00Z",
  manifestAdmission: admission()
}
function database(options: { rows?: string[]; exhausted?: boolean; conflict?: boolean; search?: boolean } = {}) {
  const query = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(async (sql) => {
    if (sql.includes("current_database")) {
      return { rows: [{ name: options.search ? "legislation_passage_search" : "canonical" }] }
    }
    if (sql.includes("INSERT INTO legislation.legal_preparation_plans")) {
      return { rows: options.conflict ? [] : [{ wave_id: waveId }] }
    }
    if (sql.includes("SELECT after_id")) {
      return {
        rows: [{ after_id: null, exhausted: options.exhausted ?? false, selected_count: options.exhausted ? 11 : 0 }]
      }
    }
    if (
      sql.includes("SELECT id FROM legislation.legal_editions") ||
      sql.includes("SELECT e.id FROM legislation.legal_editions") ||
      sql.includes("SELECT o.id FROM legislation.regulatory_document_observations")
    ) {
      return { rows: (options.rows ?? ids).map((id) => ({ id })) }
    }
    return { rows: [] }
  })
  const release = vi.fn<() => void>()
  const client = Object.assign(new pg.Client(), { release })
  vi.spyOn(client, "query").mockImplementation(async (...args) => {
    const result = await query(typeof args[0] === "string" ? args[0] : "", args[1])
    return { ...result, command: "SELECT", rowCount: result.rows.length, oid: 0, fields: [] }
  })
  const pool = new pg.Pool()
  vi.spyOn(pool, "connect").mockImplementation(async () => client)
  return { pool, query, release }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.register.mockResolvedValue({
    id: "a".repeat(64),
    preparationId: "c".repeat(64),
    payloadHash: "b".repeat(64),
    payload: {
      scope: { kind: "edition", id: waveId },
      model: "openai/text-embedding-3-small",
      limit: 10,
      retryBlocked: false
    }
  })
})
it("selects at most eleven references and atomically records ten intents before checkpoint commit", async () => {
  const db = database()
  expect(await planLegalPreparationPage(db.pool, input)).toMatchObject({
    planned: 10,
    selectedCount: 10,
    afterId: ids[9],
    exhausted: false,
    submitted: false
  })
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY id LIMIT 11 FOR SHARE"), [
    "ecfr",
    "2026-09-15T00:00:00.000Z",
    null
  ])
  expect(mocks.rights).toHaveBeenCalledTimes(10)
  expect(mocks.register).toHaveBeenCalledTimes(10)
  expect(Math.max(...mocks.rights.mock.invocationCallOrder)).toBeLessThan(
    Math.min(...mocks.register.mock.invocationCallOrder)
  )
  expect(db.query.mock.calls.at(-1)?.[0]).toBe("COMMIT")
  expect(db.release).toHaveBeenCalledOnce()
})
it("selects Federal Register observations by batch publication time and records publication scopes", async () => {
  const db = database({ rows: ids.slice(0, 3) })
  expect(
    await planLegalPreparationPage(db.pool, {
      ...input,
      source: "govinfo-fr",
      manifestAdmission: admission(ids.slice(0, 3), "publication")
    })
  ).toMatchObject({
    planned: 3,
    exhausted: true
  })
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("b.published_at<=$2::timestamptz"), [
    "govinfo-fr",
    "2026-09-15T00:00:00.000Z",
    null
  ])
  expect(mocks.rights).toHaveBeenCalledWith(expect.anything(), { kind: "publication", id: ids[0] })
  expect(mocks.register).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ scope: { kind: "publication", id: ids[0] } })
  )
  expect(db.query.mock.calls.some(([sql]) => sql.includes("SELECT id FROM legislation.legal_editions"))).toBe(false)
})
it("admits only due pending lexical outbox scopes when requested", async () => {
  const db = database({ rows: ids.slice(0, 2) })
  expect(
    await planLegalPreparationPage(db.pool, {
      ...input,
      pendingOnly: true,
      manifestAdmission: admission(ids.slice(0, 2))
    })
  ).toMatchObject({
    planned: 2,
    exhausted: true
  })
  expect(db.query).toHaveBeenCalledWith(
    expect.stringMatching(/JOIN legislation\.legal_derived_outbox[\s\S]*x\.state='pending'[\s\S]*x\.retry_at/),
    ["ecfr", "2026-09-15T00:00:00.000Z", null]
  )
})
it("rolls back rights rejection without recording intent or checkpoint", async () => {
  const db = database()
  mocks.rights.mockRejectedValueOnce(new Error("revoked"))
  await expect(planLegalPreparationPage(db.pool, input)).rejects.toThrow("revoked")
  expect(mocks.register).not.toHaveBeenCalled()
  expect(db.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
  expect(db.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false)
})
it("rolls back the entire page when intent persistence fails", async () => {
  const db = database()
  mocks.register.mockRejectedValueOnce(new Error("conflicting intent"))
  await expect(planLegalPreparationPage(db.pool, input)).rejects.toThrow("conflicting intent")
  expect(db.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
})
it.each([
  { label: "missing", rows: ids.slice(1) },
  { label: "reordered", rows: [ids[1], ids[0], ...ids.slice(2)] },
  { label: "extra", rows: [...ids.slice(0, 10), "00000000-0000-4000-8000-999999999999"], owners: ids.slice(0, 10) }
])("rejects $label live inventory drift before rights or intent writes", async ({ rows, owners = ids }) => {
  const db = database({ rows })
  await expect(planLegalPreparationPage(db.pool, { ...input, manifestAdmission: admission(owners) })).rejects.toThrow(
    "legal_preparation_manifest_inventory_changed"
  )
  expect(mocks.rights).not.toHaveBeenCalled()
  expect(mocks.register).not.toHaveBeenCalled()
  expect(db.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
})
it("rejects a manifest admitted for another model before database access", async () => {
  const db = database()
  await expect(
    planLegalPreparationPage(db.pool, {
      ...input,
      model: "voyageai/voyage-4",
      manifestAdmission: admission()
    })
  ).rejects.toThrow("Model mismatch")
  expect(db.pool.connect).not.toHaveBeenCalled()
})
it.each([{ conflict: true }, { search: true }])(
  "rejects invalid plan identity or database before edition reads",
  async (options) => {
    const db = database(options)
    await expect(planLegalPreparationPage(db.pool, input)).rejects.toThrow(Error)
    expect(mocks.rights).not.toHaveBeenCalled()
    expect(db.release).toHaveBeenCalledOnce()
  }
)
it("does not reopen an exhausted scan", async () => {
  const db = database({ exhausted: true })
  expect(await planLegalPreparationPage(db.pool, input)).toMatchObject({ planned: 0, exhausted: true })
  expect(db.query.mock.calls.some(([sql]) => sql.includes("SELECT id FROM legislation.legal_editions"))).toBe(false)
})
it("marks a final partial page exhausted and rejects unknown selection fields", async () => {
  const db = database({ rows: ids.slice(0, 3) })
  expect(
    await planLegalPreparationPage(db.pool, { ...input, manifestAdmission: admission(ids.slice(0, 3)) })
  ).toMatchObject({ planned: 3, exhausted: true })
  await expect(planLegalPreparationPage(db.pool, { ...input, jurisdiction: "CA" })).rejects.toThrow(Error)
  expect(db.pool.connect).toHaveBeenCalledOnce()
})
