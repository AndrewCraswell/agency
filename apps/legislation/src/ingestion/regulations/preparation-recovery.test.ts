import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { digest } from "./contracts.js"
import { preparationDispatchSchema, submitLegalPreparation } from "./preparation-dispatch.js"
import { recoverLegalPreparationPage } from "./preparation-recovery.js"

vi.mock("./preparation-dispatch.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./preparation-dispatch.js")>()),
  submitLegalPreparation: vi.fn<typeof submitLegalPreparation>()
}))
const pool = new pg.Pool()
const waveId = "00000000-0000-4000-8000-000000000001"
const input = preparationDispatchSchema.parse({
  waveId,
  scope: { kind: "edition", id: waveId },
  model: "openai/text-embedding-3-small"
})
const { waveId: _wave, ...payload } = input
const row = {
  id: digest(JSON.stringify([waveId, payload.scope.kind, payload.scope.id, payload.model])),
  wave_id: waveId,
  scope_kind: payload.scope.kind,
  scope_id: payload.scope.id,
  model: payload.model,
  payload_hash: digest(JSON.stringify(payload)),
  payload,
  state: "pending",
  run_id: null,
  busy: false,
  expired: false
}
const remote = vi.fn<Parameters<typeof submitLegalPreparation>[2]>()
afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(submitLegalPreparation).mockReset()
  remote.mockReset()
})
function rows(values: unknown[]) {
  return vi
    .spyOn(pool, "query")
    .mockImplementation(async () => ({ rows: values, command: "SELECT", rowCount: values.length, oid: 0, fields: [] }))
}
it("defaults to read-only preview with bounded SQL", async () => {
  const query = rows([row])
  expect(await recoverLegalPreparationPage(pool, { waveId }, remote)).toMatchObject({
    executed: false,
    results: [{ disposition: "ready" }],
    nextAfterId: null
  })
  expect(query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY id LIMIT $3"), [waveId, null, 11])
  expect(submitLegalPreparation).not.toHaveBeenCalled()
  expect(remote).not.toHaveBeenCalled()
})
it.each([
  { payload: { ...payload, limit: 11 } },
  { scope_id: "00000000-0000-4000-8000-000000000003" },
  { model: "voyageai/voyage-4" },
  { wave_id: "00000000-0000-4000-8000-000000000003" },
  { id: "b".repeat(64) },
  { state: "submitted" }
])("rejects stored identity or payload corruption before submitting", async (change) => {
  rows([row, { ...row, ...change }])
  await expect(recoverLegalPreparationPage(pool, { waveId, execute: true }, remote)).rejects.toThrow(
    "legal_dispatch_stored_payload_mismatch"
  )
  expect(submitLegalPreparation).not.toHaveBeenCalled()
})
it("accounts for busy, old and submitted intents without sending them", async () => {
  rows([
    { ...row, busy: true },
    { ...row, expired: true },
    { ...row, state: "submitted", run_id: "existing" }
  ])
  const result = await recoverLegalPreparationPage(pool, { waveId, execute: true }, remote)
  expect(result.results.map((item) => item.disposition)).toEqual([
    "busy",
    "requires_reconciliation",
    "already_submitted"
  ])
  expect(submitLegalPreparation).not.toHaveBeenCalled()
})
it("submits the exact stored identity and handles an intervening lease acquisition", async () => {
  rows([row])
  vi.mocked(submitLegalPreparation).mockRejectedValueOnce(new Error("legal_dispatch_busy"))
  expect((await recoverLegalPreparationPage(pool, { waveId, execute: true }, remote)).results[0]?.disposition).toBe(
    "busy"
  )
  expect(submitLegalPreparation).toHaveBeenCalledWith(pool, input, remote)
})
it("propagates uncertain remote outcomes so they can retry the same stored key", async () => {
  rows([row])
  vi.mocked(submitLegalPreparation).mockRejectedValueOnce(new Error("network uncertain"))
  await expect(recoverLegalPreparationPage(pool, { waveId, execute: true }, remote)).rejects.toThrow(
    "network uncertain"
  )
})
