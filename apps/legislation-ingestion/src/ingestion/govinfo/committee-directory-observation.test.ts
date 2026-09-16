import { describe, expect, it } from "vitest"
import { committeeRosterFingerprint, directoryDetectionDate } from "./committee-directory-observation.js"

const fingerprint = "a".repeat(64)
const previous = {
  packageId: "CDIR-2026-02-20",
  issuedAt: "2026-02-20T00:00:00.000Z",
  detectedAt: "2026-02-20T00:00:00.000Z",
  lastModified: "2026-07-14T00:00:00.000Z",
  fingerprint
}
const input = {
  packageId: previous.packageId,
  issuedAt: new Date(previous.issuedAt),
  lastModified: new Date("2026-09-01T12:00:00Z"),
  now: new Date("2026-09-06T00:00:00Z"),
  sessionEnd: "2027-01-03",
  fingerprint,
  previous
}

describe("committee directory observations", () => {
  it("uses publication dates for first observations", () => {
    const { previous: _previous, ...first } = input
    expect(directoryDetectionDate(first)).toEqual(input.issuedAt)
  })
  it("ignores metadata-only updates", () => {
    expect(directoryDetectionDate(input)).toBeUndefined()
  })
  it("dates a changed roster at the later GovInfo modification, not retrieval", () => {
    expect(directoryDetectionDate({ ...input, fingerprint: "b".repeat(64) })).toEqual(input.lastModified)
  })
  it.each(["2026-07-14T00:00:00Z", "2026-09-07T00:00:00Z"])("rejects invalid correction timestamps %s", (date) => {
    expect(() =>
      directoryDetectionDate({ ...input, fingerprint: "b".repeat(64), lastModified: new Date(date) })
    ).toThrow("modification date")
  })
  it("does not create post-Congress membership events", () => {
    expect(() => directoryDetectionDate({ ...input, fingerprint: "b".repeat(64), sessionEnd: "2025-01-03" })).toThrow(
      "historical replay"
    )
  })
  it("rejects a newly discovered edition older than an observed correction", () => {
    expect(() =>
      directoryDetectionDate({
        ...input,
        packageId: "CDIR-2026-03-01",
        issuedAt: new Date("2026-03-01"),
        previous: { ...previous, detectedAt: "2026-04-01T00:00:00.000Z" }
      })
    ).toThrow("chronological replay")
  })
  it("hashes canonical memberships independently of ordering and duplicate rows", () => {
    const a = { organizationId: "a", personId: "p", role: "member" }
    const b = { organizationId: "b", personId: "p", role: "chair" }
    expect(committeeRosterFingerprint([a, b, a])).toBe(committeeRosterFingerprint([b, a]))
    expect(committeeRosterFingerprint([a])).not.toBe(committeeRosterFingerprint([{ ...a, role: "chair" }]))
  })
  it("detects historical versus positive assignments without treating local closure as a source change", () => {
    const member = { organizationId: "committee", personId: "person", role: "member" }
    const positive = committeeRosterFingerprint([member])
    const historical = committeeRosterFingerprint([{ ...member, endedReason: "historical_at_first_observation" }])
    expect(historical).not.toBe(positive)
    expect(committeeRosterFingerprint([{ ...member, endedReason: "congress_ended" }])).toBe(positive)
    expect(committeeRosterFingerprint([{ ...member, endedReason: null }])).toBe(positive)
    expect(
      directoryDetectionDate({ ...input, previous: { ...previous, fingerprint: historical }, fingerprint: positive })
    ).toEqual(input.lastModified)
    expect(
      directoryDetectionDate({ ...input, previous: { ...previous, fingerprint: positive }, fingerprint: historical })
    ).toEqual(input.lastModified)
    expect(
      directoryDetectionDate({ ...input, previous: { ...previous, fingerprint: historical }, fingerprint: historical })
    ).toBeUndefined()
  })
})
