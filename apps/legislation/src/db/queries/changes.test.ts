import { describe, expect, it } from "vitest"
import { planCanonicalChange } from "./changes.js"

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
})
