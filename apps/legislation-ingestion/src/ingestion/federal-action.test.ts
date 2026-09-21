import { describe, expect, it } from "vitest"
import { normalizeFederalAction } from "./federal-action.js"

describe("federal action normalization", () => {
  it.each([
    ["Introduced in House", ["introduction"], "lower"],
    ["Referred to the House Committee on Rules.", ["referral-committee"], "lower"],
    ["Committee on Finance. Ordered to be reported favorably.", ["committee-passage-favorable"], undefined],
    ["Passed Senate with an amendment by Yea-Nay Vote.", ["passage"], "upper"],
    ["On passage Passed by the Yeas and Nays.", ["passage"], "lower"],
    ["Presented to President.", ["executive-receipt"], undefined],
    ["Signed by President.", ["executive-signature"], undefined],
    ["Became Public Law No: 119-21.", ["became-law"], undefined],
    ["Vetoed by President.", ["executive-veto"], undefined]
  ])("classifies %s", (text, classification, chamber) => {
    expect(
      normalizeFederalAction({ sourceSystem: text.startsWith("On passage") ? "House floor actions" : undefined, text })
    ).toEqual({ classification, chamber })
  })

  it("does not promote unrelated floor activity to passage", () => {
    expect(normalizeFederalAction({ text: "Motion to reconsider laid on the table.", type: "Floor" })).toEqual({
      chamber: undefined,
      classification: []
    })
  })
})
