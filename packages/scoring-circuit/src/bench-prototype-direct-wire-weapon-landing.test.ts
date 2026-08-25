import { describe, expect, it } from "vitest"
import {
  benchPrototypeDirectWireWeaponLanding,
  evaluateBenchPrototypeDirectWireWeaponLandingEvidence,
  validateBenchPrototypeDirectWireWeaponLanding
} from "./bench-prototype-direct-wire-weapon-landing.js"

const conductors = ["A", "B", "C"] as const
const negativeTestIds = ["open", "a-b-swap", "a-c-swap", "b-c-swap", "polarity-orientation-reversal"] as const

function completeEvidence(side: "left" | "right" = "left") {
  const sideCode = side === "left" ? "L" : "R"
  const sideName = side === "left" ? "LEFT" : "RIGHT"
  return {
    artifactKind: "bench-prototype-direct-wire-weapon-landing-evidence" as const,
    status: "measured" as const,
    side,
    boardId: "prototype-board-1",
    pigtailId: `PIGTAIL_${sideName}`,
    assembly: {
      powerState: "off-and-discharged" as const,
      allSourcesRemoved: true as const,
      boardDischarged: true as const,
      replacementMode: "deenergized-board-rework" as const,
      strainReliefLoadBypassesSolderJoints: true as const
    },
    continuity: conductors.map((conductor) => ({
      conductor,
      from: `PIGTAIL_${sideName}.SOCKET.${conductor}`,
      landingPadReference: `P_WEAPON_${sideCode}_${conductor}`,
      testPadReference: `TP_WEAPON_${sideCode}_${conductor}`,
      boardNet: `${sideName}_WEAPON_${conductor}`,
      resistanceOhms: 2
    })),
    isolation: [
      { conductorA: "A" as const, conductorB: "B" as const, testVoltageV: 5 as const, resistanceOhms: 10_000_000 },
      { conductorA: "A" as const, conductorB: "C" as const, testVoltageV: 5 as const, resistanceOhms: 10_000_000 },
      { conductorA: "B" as const, conductorB: "C" as const, testVoltageV: 5 as const, resistanceOhms: 10_000_000 }
    ],
    leadCompensation: {
      method: "zeroed-with-same-leads-at-landing" as const,
      compensatedLeadResidualOhms: 0.2
    },
    ncInspection: { noAdditionalConductors: true as const, prohibitedNetsAbsent: true as const },
    negativeTests: negativeTestIds.map((id) => ({
      id,
      result: "rejected" as const
    }))
  }
}

describe("BP-034 prototype direct-wire weapon landing", () => {
  it("names exactly three protected A/B/C nets, pads, tests, and labels per side without geometry", () => {
    expect(validateBenchPrototypeDirectWireWeaponLanding()).toBe(true)
    expect(benchPrototypeDirectWireWeaponLanding).toMatchObject({
      prototypeOnly: true,
      normalPower: { interface: "USB-C PD", unchanged: true },
      ncPolicy: { conductorsPerSide: 3, prohibitedNets: expect.arrayContaining(["PISTE", "SCORING_SGND"]) },
      productionSocket: { state: "open" },
      physicalEvidence: { state: "open" },
      fabricationDisposition: "DENY",
      releaseState: "deny"
    })
    for (const side of benchPrototypeDirectWireWeaponLanding.sides) {
      expect(side.conductors.map((conductor) => conductor.boardNet)).toEqual(
        side.side === "left"
          ? ["LEFT_WEAPON_A", "LEFT_WEAPON_B", "LEFT_WEAPON_C"]
          : ["RIGHT_WEAPON_A", "RIGHT_WEAPON_B", "RIGHT_WEAPON_C"]
      )
      expect(side.conductors.every((conductor) => conductor.padRule.includes("plated-through-hole"))).toBe(true)
    }
    for (const side of benchPrototypeDirectWireWeaponLanding.sides) {
      for (const conductor of side.conductors) {
        expect(Object.keys(conductor)).not.toEqual(
          expect.arrayContaining(["pitch", "diameter", "drill", "courtyard", "footprint"])
        )
      }
    }
  })

  it("accepts only a de-energized, clamped, exactly mapped measured record", () => {
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(completeEvidence())).toEqual({
      accepted: true,
      reasons: []
    })
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(completeEvidence("right"))).toEqual({
      accepted: true,
      reasons: []
    })
  })

  it("rejects a swapped net, an un-clamped pigtail, continuity drift, NC drift, and a non-rejected reversal", () => {
    const swapped = completeEvidence()
    swapped.continuity[0]!.boardNet = "LEFT_WEAPON_B"
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(swapped).accepted).toBe(false)

    const unclamped = completeEvidence()
    Reflect.set(unclamped.assembly, "strainReliefLoadBypassesSolderJoints", false)
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(unclamped).accepted).toBe(false)

    const resistance = completeEvidence()
    resistance.continuity[0]!.resistanceOhms = 2.01
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(resistance).accepted).toBe(false)

    const ncFailure = completeEvidence()
    Reflect.set(ncFailure.ncInspection, "prohibitedNetsAbsent", false)
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(ncFailure).accepted).toBe(false)

    const reversal = completeEvidence()
    Reflect.set(reversal.negativeTests[4]!, "result", "accepted")
    expect(evaluateBenchPrototypeDirectWireWeaponLandingEvidence(reversal).accepted).toBe(false)
  })

  it("fails closed if the named landing contract or its open release state drifts", () => {
    const changedPad = structuredClone(benchPrototypeDirectWireWeaponLanding)
    changedPad.sides[0]!.conductors[0]!.landingPadReference = "P_FORGED"
    expect(() => validateBenchPrototypeDirectWireWeaponLanding(changedPad)).toThrow(RangeError)

    const changedGate = structuredClone(benchPrototypeDirectWireWeaponLanding)
    Reflect.set(changedGate.productionSocket, "state", "accepted")
    expect(() => validateBenchPrototypeDirectWireWeaponLanding(changedGate)).toThrow(RangeError)
  })

  it("fails closed on every authority-bearing direct-wire rule and ordered evidence list", () => {
    const drifts = [
      {
        name: "cable compatibility",
        mutate: (candidate: typeof benchPrototypeDirectWireWeaponLanding) =>
          Reflect.set(candidate.cableCompatibility, "status", "not-owner-validated")
      },
      {
        name: "NC policy",
        mutate: (candidate: typeof benchPrototypeDirectWireWeaponLanding) =>
          Reflect.set(candidate.ncPolicy, "prohibitedNets", [...candidate.ncPolicy.prohibitedNets].reverse())
      },
      {
        name: "de-energized assembly rule",
        mutate: (candidate: typeof benchPrototypeDirectWireWeaponLanding) =>
          Reflect.set(candidate.assembly, "allSourcesRemoved", false)
      },
      {
        name: "continuity threshold",
        mutate: (candidate: typeof benchPrototypeDirectWireWeaponLanding) =>
          Reflect.set(candidate.evidenceThresholds, "maximumEndToEndResistanceOhms", 3)
      },
      {
        name: "ordered negative-test list",
        mutate: (candidate: typeof benchPrototypeDirectWireWeaponLanding) =>
          Reflect.set(candidate, "negativeTestIds", [...candidate.negativeTestIds].reverse())
      },
      {
        name: "physical-evidence requirement list",
        mutate: (candidate: typeof benchPrototypeDirectWireWeaponLanding) =>
          Reflect.set(candidate.physicalEvidence, "required", candidate.physicalEvidence.required.slice(0, -1))
      }
    ] as const

    for (const { mutate } of drifts) {
      const candidate = structuredClone(benchPrototypeDirectWireWeaponLanding)
      mutate(candidate)
      expect(() => validateBenchPrototypeDirectWireWeaponLanding(candidate)).toThrow(RangeError)
    }
  })
})
