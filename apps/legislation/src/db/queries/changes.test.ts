import { describe, expect, it } from "vitest"
import { withIngestionRun } from "../../ingestion/run-context.js"
import type { LegislationDatabase } from "../database.js"
import { canonicalRecordFingerprints, changeEvents } from "../schema/schema.js"
import { observeCanonicalRecord, planCanonicalChange } from "./changes.js"

describe("canonical change planning", () => {
  it("emits deterministic minimal create and update events", () => {
    const input = { fields: { status: "introduced", title: "A bill" }, recordId: "bill:1", recordType: "bill" }
    const created = planCanonicalChange(input)
    expect(created).toMatchObject({ changeType: "create", changedFields: ["status", "title"] })
    expect(planCanonicalChange(input, { fields: created!.after, fingerprint: created!.fingerprint })).toBeUndefined()
    const updated = planCanonicalChange(
      { ...input, fields: { status: "passed", title: "A bill" } },
      { fields: created!.after, fingerprint: created!.fingerprint }
    )
    expect(updated).toMatchObject({ changeType: "update", changedFields: ["status"] })
    expect(updated?.id).toBe(
      planCanonicalChange(
        { ...input, fields: { status: "passed", title: "A bill" } },
        { fields: created!.after, fingerprint: created!.fingerprint }
      )?.id
    )
  })

  it("classifies cancellation, deletion, and rescheduling", () => {
    const previous = planCanonicalChange({
      fields: { isDeleted: false, startAt: "2026-01-01T10:00:00Z", status: "scheduled" },
      recordId: "event:1",
      recordType: "event"
    })!
    expect(
      planCanonicalChange(
        {
          fields: { isDeleted: false, startAt: "2026-01-01T11:00:00Z", status: "scheduled" },
          recordId: "event:1",
          recordType: "event"
        },
        { fields: previous.after, fingerprint: previous.fingerprint }
      )?.changeType
    ).toBe("reschedule")
    expect(
      planCanonicalChange(
        {
          fields: { isDeleted: false, startAt: "2026-01-01T10:00:00Z", status: "cancelled" },
          recordId: "event:1",
          recordType: "event"
        },
        { fields: previous.after, fingerprint: previous.fingerprint }
      )?.changeType
    ).toBe("cancel")
    expect(
      planCanonicalChange(
        {
          fields: { isDeleted: true, startAt: "2026-01-01T10:00:00Z", status: "scheduled" },
          recordId: "event:1",
          recordType: "event"
        },
        { fields: previous.after, fingerprint: previous.fingerprint }
      )?.changeType
    ).toBe("delete")
  })

  it("distinguishes relationship-only updates", () => {
    const created = planCanonicalChange({
      fields: { relationships: ["bill:2"], title: "A bill" },
      recordId: "bill:1",
      recordType: "bill"
    })!
    expect(
      planCanonicalChange(
        { fields: { relationships: ["bill:3"], title: "A bill" }, recordId: "bill:1", recordType: "bill" },
        { fields: created.after, fingerprint: created.fingerprint }
      )?.changeType
    ).toBe("relationship-change")
  })

  it("copies the observed before and after payloads instead of retaining mutable record references", () => {
    const fields = { nested: { status: "pending" }, status: "pending" }
    const planned = planCanonicalChange({ fields, recordId: "bill:1", recordType: "bill" })!

    fields.nested.status = "passed"
    fields.status = "passed"

    expect(planned.after).toEqual({ nested: { status: "pending" }, status: "pending" })
  })

  it("bounds persisted canonical snapshots", () => {
    expect(() =>
      planCanonicalChange({
        fields: Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`field${index}`, "x".repeat(100)])),
        recordId: "bill:1",
        recordType: "bill"
      })
    ).toThrow("Canonical change snapshot exceeds")
  })

  it("tracks oversized summaries without persisting or truncating their content", () => {
    const summary = "é".repeat(64 * 1024)
    const input = { fields: { summary, status: "introduced" }, recordId: "bill:1", recordType: "bill" }
    const created = planCanonicalChange(input)!
    expect(created.after.summary).toEqual({
      representation: "sha256",
      byteLength: Buffer.byteLength(JSON.stringify(summary), "utf8"),
      digest: expect.stringMatching(/^[a-f0-9]{64}$/)
    })
    expect(Buffer.byteLength(JSON.stringify(created.after))).toBeLessThan(64 * 1024)
    expect(input.fields.summary).toBe(summary)
    const previous = { fields: created.after, fingerprint: created.fingerprint }
    expect(planCanonicalChange(input, previous)).toBeUndefined()
    const changed = planCanonicalChange({ ...input, fields: { ...input.fields, summary: `${summary}!` } }, previous)!
    expect(changed.changedFields).toEqual(["summary"])
    expect(changed.after.summary).not.toEqual(created.after.summary)
    expect(
      planCanonicalChange({ ...input, fields: { ...input.fields, summary: "short" } }, previous)?.after.summary
    ).toBe("short")
  })

  it("canonicalizes oversized nested fields before hashing and preserves small fields", () => {
    const text = "x".repeat(9000)
    const input = { recordId: "bill:1", recordType: "bill", fields: { nested: { a: text, b: 1 }, title: "Small" } }
    const created = planCanonicalChange(input)!
    expect(created.after.title).toBe("Small")
    expect(
      planCanonicalChange(
        { ...input, fields: { title: "Small", nested: { b: 1, a: text } } },
        {
          fields: created.after,
          fingerprint: created.fingerprint
        }
      )
    ).toBeUndefined()
  })

  it("persists the source reference captured before a later source update", async () => {
    let source = { sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1" }
    let persisted: Record<string, unknown> | undefined
    const database = {
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoNothing: async () => {
            if (table === changeEvents) {
              persisted = values
            }
          },
          onConflictDoUpdate: async () => undefined
        })
      }),
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => (table === canonicalRecordFingerprints ? [] : [source])
          })
        })
      })
    } as unknown as Omit<LegislationDatabase, "$client">

    await withIngestionRun("00000000-0000-4000-8000-000000000001", async () => {
      await observeCanonicalRecord(database, {
        fields: { status: "pending" },
        recordId: "bill:us:119:house:hr-1",
        recordType: "bill"
      })
    })
    source = { sourceUrl: "https://api.openstates.org/v3/bills/changed" }

    expect(persisted).toMatchObject({
      sourceProvider: "congress",
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1"
    })
  })
})
