import { describe, expect, it } from "vitest"
import { validatePeopleArchivePair } from "./people-archive-pair.js"
import { peopleSourceProfiles } from "./people-repository.js"

describe("people archive pairing", () => {
  const current = {
    state: "ak",
    lane: "entities",
    revision: peopleSourceProfiles.ak.revision,
    retrievedAt: new Date("2026-09-14T00:00:00Z")
  } as const
  const history = { ...current, lane: "history", retrievedAt: new Date("2026-09-14T01:00:00Z") } as const
  it("uses the same shared contract for NC and Alaska and retains the later observation", () => {
    for (const state of ["nc", "ak"] as const) {
      expect(validatePeopleArchivePair({ ...current, state }, { ...history, state })).toEqual({
        state,
        retrievedAt: history.retrievedAt
      })
    }
  })
  it("rejects different states, revisions, swapped lanes and invalid observation times", () => {
    expect(() => validatePeopleArchivePair(current, { ...history, state: "nc" })).toThrow("matching jurisdiction")
    expect(() => validatePeopleArchivePair(current, { ...history, revision: "wrong" })).toThrow(
      "People archives must have"
    )
    expect(() => validatePeopleArchivePair(history, current)).toThrow("People archives must have")
    expect(() => validatePeopleArchivePair(current, { ...history, retrievedAt: new Date(NaN) })).toThrow(
      "People archives must have"
    )
    expect(() =>
      validatePeopleArchivePair({ ...current, revision: "wrong" }, { ...history, revision: "wrong" })
    ).toThrow("People archives must have")
  })
})
