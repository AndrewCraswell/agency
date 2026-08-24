import { describe, expect, it } from "vitest"
import { evaluateProductionHarnessRelease, productionHarnessRelease } from "./production-harness-release.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M4-13 production harness release", () => {
  it("maps the six weapon lines and piste return without releasing fabrication", () => {
    expect(productionHarnessRelease.physicalSocketMap).toEqual([
      expect.objectContaining({ boardReference: "J_WEAPON_HARNESS_L", connectorPin: 1, logicalLine: "left.A" }),
      expect.objectContaining({ boardReference: "J_WEAPON_HARNESS_L", connectorPin: 2, logicalLine: "left.B" }),
      expect.objectContaining({ boardReference: "J_WEAPON_HARNESS_L", connectorPin: 3, logicalLine: "left.C" }),
      expect.objectContaining({ boardReference: "J_WEAPON_HARNESS_R", connectorPin: 1, logicalLine: "right.A" }),
      expect.objectContaining({ boardReference: "J_WEAPON_HARNESS_R", connectorPin: 2, logicalLine: "right.B" }),
      expect.objectContaining({ boardReference: "J_WEAPON_HARNESS_R", connectorPin: 3, logicalLine: "right.C" }),
      expect.objectContaining({ boardReference: "J_PISTE_HARNESS", connectorPin: 1, logicalLine: "piste" }),
      expect.objectContaining({ boardReference: "J_PISTE_HARNESS", connectorPin: 2, logicalLine: "piste-return" })
    ])
    expect(productionHarnessRelease.boardHarnesses).toHaveLength(4)
    expect(productionHarnessRelease.boardHarnesses[1]?.pins[3]).toMatchObject({
      connectorPin: 4,
      logicalLine: null,
      terminalInstalled: false
    })
    expect(evaluateProductionHarnessRelease()).toMatchObject({ status: "deny", fabricationAuthorized: false })
  })

  it("keeps connector non-interchange, ESD bonding, current, and USB-C PD boundaries explicit", () => {
    expect(productionHarnessRelease.keying).toMatchObject({ status: "planned-not-physically-verified" })
    expect(productionHarnessRelease.keying.nonInterchangeRules.join(" ")).toContain(
      "empty cavity is not itself the key"
    )
    expect(productionHarnessRelease.bonding.pisteReturn).toContain("ESD_RETURN")
    expect(productionHarnessRelease.bonding.pisteReturn).toContain("not chassis")
    expect(productionHarnessRelease.currentRating).toMatchObject({
      connectorMaximumPerContactA: [7, 7, 7, 9],
      systemBranchCurrentA: null,
      status: "component-ratings-only-not-system-release"
    })
    expect(productionHarnessRelease.powerBoundary).toMatchObject({
      alternateExternalPowerInputs: [],
      harnessesAreExternalPowerInlets: false,
      normalApparatusPowerInput: "USB-C PD"
    })
  })

  it("reports every unresolved release gate", () => {
    const result = evaluateProductionHarnessRelease()
    expect(result.failedChecks).toEqual(
      expect.arrayContaining([
        "M4_10-blocked-plug-fit-and-retention",
        "M4_11-blocked-connector-CAD-and-strain-relief",
        "M4_12-blocked-enclosure-and-clearance",
        "keying-physical-verification",
        "bonding-approval",
        "current-rating-release",
        "system-branch-current-measurement"
      ])
    )
  })

  it("rejects approval drift and accessor substitution", () => {
    const approved = structuredClone(productionHarnessRelease)
    replaceDataProperty(approved.authority, "fabricationAuthorized", true)
    expect(() => evaluateProductionHarnessRelease(approved)).toThrow(RangeError)

    const alternateInput = structuredClone(productionHarnessRelease)
    replaceDataProperty(alternateInput.powerBoundary, "normalApparatusPowerInput", "locking harness")
    expect(() => evaluateProductionHarnessRelease(alternateInput)).toThrow(RangeError)

    const accessor = structuredClone(productionHarnessRelease)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "approved" })
    expect(() => evaluateProductionHarnessRelease(accessor)).toThrow(RangeError)
  })
})
