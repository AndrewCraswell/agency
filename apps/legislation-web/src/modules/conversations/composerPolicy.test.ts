import { describe, expect, it } from "vitest"
import type { StagedReference } from "./chatRequest"
import { textDraft, type ComposerDraft } from "./composerDraft"
import { canAddComposerReference, composerSubmissionBlockedReason } from "./composerPolicy"

const person: StagedReference = {
  resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
  recordId: "person:1",
  record: { id: "person:1", kind: "person", title: "Same name", sourceUrl: null, fields: [], tallies: [] }
}
const references = Array.from(
  { length: 13 },
  (_, index): StagedReference => ({
    ...person,
    recordId: `person:${index}`,
    record: { ...person.record, id: `person:${index}` }
  })
)
const mentioned: ComposerDraft = [{ type: "mention", reference: person }]

describe("composer submission policy", () => {
  const ready = { draft: textDraft("Research this"), isAvailable: true }

  it.each([
    { state: { isAvailable: false }, reason: "unavailable" },
    { state: { isRestoring: true }, reason: "restoring" },
    { state: { isRunning: true }, reason: "busy" },
    { state: { isConfirmingClarification: true }, reason: "busy" },
    { state: { draft: [] }, reason: "empty" },
    { state: { draft: textDraft(" \n\t ") }, reason: "empty" },
    { state: { references }, reason: "reference_limit" },
    { state: {}, reason: undefined }
  ])("returns $reason for $state", ({ state, reason }) => {
    expect(composerSubmissionBlockedReason({ ...ready, ...state })).toBe(reason)
  })

  it("retains diagnostic precedence for overlapping restrictions", () => {
    const blocked = { ...ready, draft: [], references, isRunning: true, isRestoring: true, isAvailable: false }
    expect(composerSubmissionBlockedReason(blocked)).toBe("unavailable")
    expect(composerSubmissionBlockedReason({ ...blocked, isAvailable: true })).toBe("restoring")
    expect(composerSubmissionBlockedReason({ ...blocked, isAvailable: true, isRestoring: false })).toBe("busy")
    expect(
      composerSubmissionBlockedReason({ ...blocked, isAvailable: true, isRestoring: false, isRunning: false })
    ).toBe("reference_limit")
  })

  it("counts distinct identities across inline tags and staged references, not titles or occurrences", () => {
    const twelve = references.slice(0, 12)
    expect(
      composerSubmissionBlockedReason({
        ...ready,
        draft: [...mentioned, ...mentioned],
        references: [...twelve, ...twelve]
      })
    ).toBeUndefined()
    expect(composerSubmissionBlockedReason({ ...ready, draft: mentioned, references })).toBe("reference_limit")
  })

  it("does not interpret commands or infer tags from plain text", () => {
    expect(composerSubmissionBlockedReason({ draft: textDraft("/export"), isAvailable: false })).toBe("unavailable")
    expect(
      composerSubmissionBlockedReason({ ...ready, draft: textDraft("@Same name"), references: references.slice(0, 12) })
    ).toBeUndefined()
  })
})

describe("composer reference selection", () => {
  it("permits a new distinct reference below the cap", () => {
    expect(canAddComposerReference(person, [], [])).toBe(true)
  })

  it("permits an existing staged or inline identity at the cap, but rejects a new one", () => {
    const otherReferences = references.filter((item) => item.recordId !== person.recordId)
    expect(canAddComposerReference(person, [], [person, ...otherReferences.slice(0, 11)])).toBe(true)
    expect(canAddComposerReference(person, mentioned, otherReferences.slice(0, 11))).toBe(true)
    expect(canAddComposerReference(person, [], otherReferences)).toBe(false)
    expect(
      canAddComposerReference(person, [], [...otherReferences.slice(0, 11), ...otherReferences.slice(0, 11)])
    ).toBe(true)
  })

  it("counts equal record IDs with different kinds separately", () => {
    const organization: StagedReference = {
      ...person,
      record: {
        ...person.record,
        kind: "organization",
        organizationSummary: { classification: "committee", membershipCompleteness: "unknown" }
      }
    }
    expect(canAddComposerReference(organization, [], references.slice(0, 12))).toBe(false)
  })
})
