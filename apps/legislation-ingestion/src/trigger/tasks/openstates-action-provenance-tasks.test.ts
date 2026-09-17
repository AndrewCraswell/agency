import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  actionProvenanceArchiveDispatches,
  actionProvenanceCaptureWindow,
  openStatesActionProvenanceCapturePayload
} from "./openstates-action-provenance-tasks.js"

describe("Open States action provenance Trigger contract", () => {
  it("is serialized, resumable and unscheduled", async () => {
    const source = await readFile(new URL("./openstates-action-provenance-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-action-provenance-reconcile"')
    expect(source).toContain('name: "openstates-action-provenance", concurrencyLimit: 1')
    expect(source).toContain("reconcileActionProvenanceBatch")
    expect(source).toContain("afterBillId: result.nextAfterBillId")
    expect(source).not.toContain("schedules.task")
  })

  it("bounds the reviewed acquisition window", () => {
    const now = new Date("2026-09-17T12:00:00.000Z")
    expect(actionProvenanceCaptureWindow("2026-08-17T00:00:00.000Z", now).toISOString()).toBe(
      "2026-08-17T00:00:00.000Z"
    )
    expect(() => actionProvenanceCaptureWindow("2026-05-01T00:00:00.000Z", now)).toThrow("120 days")
    expect(() => actionProvenanceCaptureWindow("2026-09-18T00:00:00.000Z", now)).toThrow("future")
  })

  it("dispatches only exact requested-session archives with stable inspect and apply identities", () => {
    const retained = [
      { contentHash: "a".repeat(64), records: [{}], session: "34", stream: "api-ak-34-one" },
      { contentHash: "b".repeat(64), records: [{}], session: "33", stream: "api-ak-33-one" }
    ]
    expect(actionProvenanceArchiveDispatches(retained, { apply: false, session: "34", state: "ak" })).toEqual([
      {
        idempotencyKey: `action-provenance:ak:34:${"a".repeat(64)}:inspect`,
        payload: {
          apply: false,
          archiveSha256: "a".repeat(64),
          archiveStream: "api-ak-34-one",
          session: "34",
          state: "ak"
        }
      }
    ])
    expect(
      actionProvenanceArchiveDispatches(retained, { apply: true, session: "34", state: "ak" })[0]?.idempotencyKey
    ).toContain(":apply")
    expect(() => actionProvenanceArchiveDispatches(retained, { apply: false, session: "2025", state: "nc" })).toThrow(
      "no bills"
    )
  })

  it("requires an exact state, session and ISO timestamp while defaulting to inspection", () => {
    expect(
      openStatesActionProvenanceCapturePayload.parse({
        from: "2026-08-17T00:00:00.000Z",
        session: "34",
        state: "ak"
      })
    ).toMatchObject({ apply: false, session: "34", state: "ak" })
    expect(() =>
      openStatesActionProvenanceCapturePayload.parse({ from: "August 17", session: "34", state: "ak" })
    ).toThrow()
  })
})
