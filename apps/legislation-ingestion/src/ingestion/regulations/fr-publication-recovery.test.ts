import { describe, expect, it, vi } from "vitest"
import { planFrPublicationRecoveryPage, recordFrFinalizationFailure } from "./fr-publication-recovery.js"

const scopeKey = "a".repeat(64)
const manifestId = "b".repeat(64)
const unitKey = "c".repeat(64)

describe("Federal Register publication recovery", () => {
  it("returns a stable bounded keyset containing rendition and finalization work", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          kind: "finalization",
          manifest_id: manifestId,
          scope_key: scopeKey,
          unit_key: unitKey,
          document_number: "",
          updated_at: new Date("2026-09-18T01:00:00Z")
        },
        {
          kind: "rendition",
          manifest_id: manifestId,
          scope_key: scopeKey,
          unit_key: unitKey,
          document_number: "2026-12345",
          updated_at: new Date("2026-09-18T02:00:00Z")
        }
      ]
    }))
    const page = await planFrPublicationRecoveryPage({ query } as never, { scopeKey, limit: 2 })
    expect(page).toMatchObject({
      selected: 2,
      exhausted: false,
      afterUnitKey: unitKey,
      afterDocumentNumber: "2026-12345"
    })
    expect(page.items.map((item) => item.kind)).toEqual(["finalization", "rendition"])
    expect(query).toHaveBeenCalledWith(expect.stringContaining("lease_expires_at<clock_timestamp()"), [
      scopeKey,
      null,
      null,
      2
    ])
  })

  it("records a bounded diagnostic only while an issue remains ready", async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }))
    await recordFrFinalizationFailure(
      { query } as never,
      { manifestId, unitKey },
      new Error(`failure-${"x".repeat(300)}`)
    )
    expect(query).toHaveBeenCalledWith(expect.stringContaining("AND state='ready'"), [
      manifestId,
      unitKey,
      expect.stringMatching(/^failure-x{248}$/)
    ])
  })
})
