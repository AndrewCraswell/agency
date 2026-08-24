import { describe, expect, it } from "vitest"
import { M404_SINGLE_CHANNEL_COUPON, validateM404SingleChannelCoupon } from "./m4-04-single-channel-coupon.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

describe("M4-04 single-channel sensing coupon", () => {
  it("passes the source-bound ERC and reconciles all schematic references to exact BOM identities", () => {
    expect(validateM404SingleChannelCoupon(M404_SINGLE_CHANNEL_COUPON)).toBe(true)
    expect(M404_SINGLE_CHANNEL_COUPON.erc.status).toBe("pass")
    expect(M404_SINGLE_CHANNEL_COUPON.erc.checks.map((check) => check.net)).toEqual(
      expect.arrayContaining(["LINE", "QUIET", "AINP", "AINN", "REF_2V5", "S5V_ISO", "S3V3_ISO", "SGND"])
    )
    expect(M404_SINGLE_CHANNEL_COUPON.footprints.map((footprint) => footprint.reference)).toEqual(
      oneChannelAnalogExperimentBom.map((part) => part.reference)
    )
    expect(M404_SINGLE_CHANNEL_COUPON.footprints).toHaveLength(45)
  })

  it("requires a separate root reviewer and refuses to convert implementation reconciliation into footprint approval", () => {
    for (const footprint of M404_SINGLE_CHANNEL_COUPON.footprints) {
      expect(footprint.implementationEvidence.reviewerId).not.toBe(footprint.independentDrawingReview.reviewerId)
      expect(footprint.independentDrawingReview).toMatchObject({ reviewerId: "root-final-reviewer", status: "pending" })
      expect(footprint.footprintRelease).toBe("deny")
    }
    expect(M404_SINGLE_CHANNEL_COUPON.authority).toMatchObject({
      footprintsIndependentlyReviewed: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it.each([
    ["forged ERC pass", (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.erc, "status", "fail")],
    [
      "forged footprint approval",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.footprints[0], "footprintRelease", "released")
    ],
    [
      "self approved drawing",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) =>
        Reflect.set(copy.footprints[0].independentDrawingReview, "reviewerId", "m4-04-implementation-agent")
    ],
    [
      "fabrication authority",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.authority, "fabricationAuthorized", true)
    ]
  ])("rejects %s", (_name, mutate) => {
    const copy = structuredClone(M404_SINGLE_CHANNEL_COUPON)
    mutate(copy)
    expect(() => validateM404SingleChannelCoupon(copy)).toThrow(RangeError)
  })
})
