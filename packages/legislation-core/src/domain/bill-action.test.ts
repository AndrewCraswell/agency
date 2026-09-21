import { describe, expect, it } from "vitest"
import { normalizeBillAction, normalizeFederalAction, hasTerminalBillStatus } from "./bill-action"

describe("shared bill action normalization", () => {
  it.each([
    ["Introduced in House", "introduction", "lower"],
    ["Referred to the House Committee on Rules.", "referral-committee", "lower"],
    ["Passed/agreed to in House: On passage Passed by recorded vote: 272 - 142.", "passage", "lower"],
    ["Passed Senate with an amendment by Yea-Nay Vote.", "passage", "upper"],
    ["Senate agreed to the House amendments to Senate amendments to H.R. 636.", "passage", "upper"],
    ["Signed by President.", "executive-signature", undefined],
    ["Became Public Law No: 114-190.", "became-law", undefined],
    ["Presented to President.", "executive-receipt", undefined]
  ])("classifies explicit bill action %s", (text, classification, chamber) => {
    expect(normalizeFederalAction({ text })).toEqual({ classification: [classification], chamber })
  })
  it.each([
    "Rule H. Res. 101 passed House.",
    "Motion to reconsider laid on the table.",
    "Senate agreed to motion to proceed.",
    "Amendment agreed to in House.",
    "Sponsor introductory remarks on measure"
  ])("does not invent a milestone for %s", (text) => {
    expect(normalizeFederalAction({ text }).classification).toEqual([])
  })
  it("uses the acting chamber rather than the chamber mentioned in amendments", () => {
    expect(
      normalizeFederalAction({ text: "Senate agreed to the House amendments.", sourceSystem: "Senate" }).chamber
    ).toBe("upper")
    expect(
      normalizeFederalAction({ text: "On passage Passed by the Yeas and Nays.", sourceSystem: "House floor actions" })
        .chamber
    ).toBe("lower")
  })
  it("preserves supplied classifications and confines text inference to federal records", () => {
    const action = { classification: ["referral-committee"], chamber: "upper", description: "Introduced in House" }
    expect(normalizeBillAction(action, "jurisdiction:us")).toEqual(action)
    expect(
      normalizeBillAction({ classification: [], description: "Signed by President." }, "jurisdiction:ca").classification
    ).toEqual([])
  })
  it("recognizes terminal status without inventing milestone dates", () => {
    expect(hasTerminalBillStatus("Became Public Law No: 114-190.")).toBe(true)
    expect(hasTerminalBillStatus("enacted")).toBe(true)
    expect(hasTerminalBillStatus("Referred to committee")).toBe(false)
  })
})
