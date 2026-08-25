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
      references: ["U_ISO_POWER"],
      decision: "footprint-approved",
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(benchPrototypeFootprintApprovalDecisions.reviewer).toBe("root-final-reviewer")
  })

  it("approves only the three root-reviewed BP-031 mapping families", () => {
    for (const [reference, artifactKind] of [
      ["C_SAR_1", "bp031-kemet-c0603c102j5gactu-project-footprint"],
      ["C_SAR_7", "bp031-kemet-c0603c102j5gactu-project-footprint"],
      ["C_REF_IN_1", "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint"],
      ["C_REF_IN_7", "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint"],
      ["R_ESD_1", "bp031-vishay-crcw-selected-resistor-footprint-evidence"],
      ["R_FAULT_GUARD_7", "bp031-vishay-crcw-selected-resistor-footprint-evidence"]
    ] as const) {
      expect(isBenchPrototypeFootprintApproved("BP-031", reference, artifactKind)).toBe(true)
    }
    expect(
      benchPrototypeFootprintApprovalDecisions.decisions
        .filter((decision) => decision.workUnit === "BP-031")
        .flatMap((decision) => decision.references)
    ).toHaveLength(42)
    expect(
      isBenchPrototypeFootprintApproved("BP-031", "C_REF_REG_HF_1", "bp031-032-c0603c104k3ractu-footprint-evidence")
    ).toBe(false)
    expect(
      isBenchPrototypeFootprintApproved("BP-031", "C_SAR_1", "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint")
    ).toBe(false)
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
