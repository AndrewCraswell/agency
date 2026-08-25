import { describe, expect, it } from "vitest"
import {
  benchPrototypeFootprintApprovalDecisions,
  isBenchPrototypeFootprintApproved,
  validateBenchPrototypeFootprintApprovalDecisions
} from "./bench-prototype-footprint-approval-decisions.js"

describe("bench prototype footprint approval decisions", () => {
  it("records the root-only bounded NXE1 pre-order approval", () => {
    expect(validateBenchPrototypeFootprintApprovalDecisions()).toBe(true)
    expect(
      isBenchPrototypeFootprintApproved(
        "BP-032",
        "U_ISO_POWER",
        "bp032-murata-nxe1s0505mc-preorder-promotion-candidate"
      )
    ).toBe(true)
    expect(benchPrototypeFootprintApprovalDecisions.decisions[0]).toMatchObject({
      workUnit: "BP-032",
      reference: "U_ISO_POWER",
      decision: "footprint-approved",
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(benchPrototypeFootprintApprovalDecisions.reviewer).toBe("root-final-reviewer")
  })

  it("does not approve another row or candidate artifact", () => {
    expect(
      isBenchPrototypeFootprintApproved("BP-032", "U_ISO_MAIN", "bp032-murata-nxe1s0505mc-preorder-promotion-candidate")
    ).toBe(false)
    expect(isBenchPrototypeFootprintApproved("BP-032", "U_ISO_POWER", "different-candidate")).toBe(false)
  })

  it("fails closed on decision or release drift", () => {
    const decisionDrift = structuredClone(benchPrototypeFootprintApprovalDecisions)
    Reflect.set(decisionDrift.decisions[0]!, "decision", "reviewed-unapproved")
    expect(() => validateBenchPrototypeFootprintApprovalDecisions(decisionDrift)).toThrow(RangeError)

    const releaseDrift = structuredClone(benchPrototypeFootprintApprovalDecisions)
    Reflect.set(releaseDrift.decisions[0]!, "fabricationAuthorized", true)
    expect(() => validateBenchPrototypeFootprintApprovalDecisions(releaseDrift)).toThrow(RangeError)
  })
})
