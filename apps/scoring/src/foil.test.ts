import { describe, expect, it } from "vitest"
import {
  advanceFoilScoring,
  createFoilScoringState,
  FOIL_RULES,
  type FoilContact,
  type FoilSample,
  type FoilScoringState,
  type FoilSide
} from "./foil.js"

const CLOSED: FoilContact = {
  circuitBreak: "closed",
  insulationDiagnostic: "unavailable",
  integrity: "intact",
  targetContext: "target"
}
const ON_TARGET: FoilContact = { ...CLOSED, circuitBreak: "open" }
const OFF_TARGET: FoilContact = { ...ON_TARGET, targetContext: "nonTarget" }

function sample(atUs: number, left = CLOSED, right = CLOSED): FoilSample {
  return { atUs, left, right }
}

function forSide(side: FoilSide, contact: FoilContact, atUs: number): FoilSample {
  return side === "left" ? sample(atUs, contact) : sample(atUs, CLOSED, contact)
}

function replay(samples: readonly FoilSample[]): FoilScoringState {
  return samples.reduce((state, sample) => advanceFoilScoring(state, sample), createFoilScoringState())
}

describe("foil scoring state machine", () => {
  it.each([
    ["left", 12_999, false],
    ["left", 13_000, true],
    ["left", 14_000, true],
    ["left", 15_000, true],
    ["right", 12_999, false],
    ["right", 13_000, true],
    ["right", 14_000, true],
    ["right", 15_000, true]
  ] as const)(
    "qualifies a %s circuit break at the %s microsecond boundary only when required: %s",
    (side, atUs, qualifies) => {
      const state = replay([forSide(side, ON_TARGET, 0), forSide(side, ON_TARGET, atUs)])

      expect(state.hits).toHaveLength(qualifies ? 1 : 0)
      expect(state.hits[0]).toMatchObject(qualifies ? { classification: "on-target", side, startedAtUs: 0 } : {})
    }
  )

  it("does not invent a maximum break duration after the guaranteed 15 millisecond region", () => {
    const state = replay([sample(0, ON_TARGET), sample(16_000, ON_TARGET)])

    expect(state.hits).toEqual([{ classification: "on-target", qualifiedAtUs: 16_000, side: "left", startedAtUs: 0 }])
  })

  it("classifies target and non-target contacts independently", () => {
    const state = replay([sample(0, ON_TARGET, OFF_TARGET), sample(13_000, ON_TARGET, OFF_TARGET)])

    expect(state.hits).toEqual([
      { classification: "on-target", qualifiedAtUs: 13_000, side: "left", startedAtUs: 0 },
      { classification: "off-target", qualifiedAtUs: 13_000, side: "right", startedAtUs: 0 }
    ])
  })

  it("requires one stable target context throughout a candidate", () => {
    const state = replay([sample(0, ON_TARGET), sample(12_999, OFF_TARGET), sample(25_999, OFF_TARGET)])

    expect(state.hits).toEqual([
      { classification: "off-target", qualifiedAtUs: 25_999, side: "left", startedAtUs: 12_999 }
    ])
  })

  it("rejects grounded contact without disturbing an independent opposing hit", () => {
    const grounded: FoilContact = { ...ON_TARGET, targetContext: "grounded" }
    const state = replay([sample(0, grounded, ON_TARGET), sample(13_000, grounded, ON_TARGET)])

    expect(state.hits).toEqual([{ classification: "on-target", qualifiedAtUs: 13_000, side: "right", startedAtUs: 0 }])
    expect(state.left.observationStatus).toBe("grounded-contact")
  })

  it.each([
    ["left", "lameFault", "lame-fault"],
    ["right", "lameFault", "lame-fault"],
    ["left", "weaponFault", "weapon-fault"],
    ["right", "weaponFault", "weapon-fault"]
  ] as const)("suppresses a %s %s without disturbing the other side", (side, integrity, observationStatus) => {
    const fault: FoilContact = { ...ON_TARGET, integrity }
    const otherSide = side === "left" ? "right" : "left"
    const state = replay(
      side === "left"
        ? [sample(0, fault, ON_TARGET), sample(13_000, fault, ON_TARGET)]
        : [sample(0, ON_TARGET, fault), sample(13_000, ON_TARGET, fault)]
    )

    expect(state.hits).toEqual([
      { classification: "on-target", qualifiedAtUs: 13_000, side: otherSide, startedAtUs: 0 }
    ])
    expect(state[side].observationStatus).toBe(observationStatus)
  })

  it.each([
    ["circuitBreak", "indeterminate", "indeterminate"],
    ["circuitBreak", "unavailable", "unavailable"],
    ["targetContext", "indeterminate", "indeterminate"],
    ["targetContext", "unavailable", "unavailable"],
    ["integrity", "indeterminate", "indeterminate"],
    ["integrity", "unavailable", "unavailable"]
  ] as const)("cancels candidates for %s %s on both sides", (field, value, observationStatus) => {
    for (const side of ["left", "right"] as const) {
      const interrupted: FoilContact = { ...ON_TARGET, [field]: value }
      const beforeQualification = replay([forSide(side, ON_TARGET, 0), forSide(side, interrupted, 12_999)])
      const state = advanceFoilScoring(beforeQualification, forSide(side, ON_TARGET, 13_000))

      expect(state.hits).toEqual([])
      expect(state[side]).toMatchObject({ candidate: { startedAtUs: 13_000 }, observationStatus: "ready" })
      expect(beforeQualification[side].observationStatus).toBe(observationStatus)
    }
  })

  it.each(["withinRange", "outsideRange", "indeterminate", "unavailable"] as const)(
    "carries the M1-04 insulation diagnostic handoff without changing contact scoring: %s",
    (insulationDiagnostic) => {
      const contact: FoilContact = { ...ON_TARGET, insulationDiagnostic }
      const state = replay([sample(0, contact), sample(13_000, contact)])

      expect(state.hits).toHaveLength(1)
      expect(state.left.insulationDiagnostic).toBe(insulationDiagnostic)
    }
  )

  it("inhibits a second same-side hit while permitting the opposing side before lockout", () => {
    const state = replay([
      sample(0, ON_TARGET),
      sample(13_000, ON_TARGET),
      sample(20_000, ON_TARGET, OFF_TARGET),
      sample(33_000, ON_TARGET, OFF_TARGET)
    ])

    expect(state.hits).toEqual([
      { classification: "on-target", qualifiedAtUs: 13_000, side: "left", startedAtUs: 0 },
      { classification: "off-target", qualifiedAtUs: 33_000, side: "right", startedAtUs: 20_000 }
    ])
  })

  it("uses the first signalled hit and the documented provisional 300 millisecond lockout", () => {
    const firstHitAtUs = 13_000
    const beforeLockout = firstHitAtUs + FOIL_RULES.provisionalLockoutUs - 1
    const state = replay([sample(0, ON_TARGET), sample(firstHitAtUs, ON_TARGET), sample(beforeLockout)])
    const locked = advanceFoilScoring(state, sample(firstHitAtUs + FOIL_RULES.provisionalLockoutUs, OFF_TARGET))

    expect(FOIL_RULES).toMatchObject({
      eventWindowEarliestUs: 275_000,
      eventWindowLatestUs: 325_000,
      provisionalLockoutUs: 300_000
    })
    expect(state).toMatchObject({
      firstHitSignalledAtUs: firstHitAtUs,
      isLocked: false,
      lockoutEndsAtUs: firstHitAtUs + FOIL_RULES.provisionalLockoutUs
    })
    expect(locked).toMatchObject({ isLocked: true, left: { candidate: null }, right: { candidate: null } })
    expect(locked.hits).toHaveLength(1)
  })

  it("does not let a candidate that would qualify after lockout register", () => {
    const state = replay([
      sample(0, ON_TARGET),
      sample(13_000, ON_TARGET),
      sample(300_000, CLOSED, ON_TARGET),
      sample(313_000, CLOSED, ON_TARGET)
    ])

    expect(state).toMatchObject({ isLocked: true, lockoutEndsAtUs: 313_000 })
    expect(state.hits).toHaveLength(1)
  })

  it("orders simultaneous hits by side for deterministic records", () => {
    const state = replay([sample(0, ON_TARGET, ON_TARGET), sample(13_000, ON_TARGET, ON_TARGET)])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
  })

  it("orders simultaneous hits by observed candidate start before side", () => {
    const state = replay([sample(0, ON_TARGET), sample(1, ON_TARGET, ON_TARGET), sample(13_001, ON_TARGET, ON_TARGET)])

    expect(state.hits).toEqual([
      { classification: "on-target", qualifiedAtUs: 13_001, side: "left", startedAtUs: 0 },
      { classification: "on-target", qualifiedAtUs: 13_001, side: "right", startedAtUs: 1 }
    ])
  })

  it("accepts equal timestamps and rejects invalid or backward timestamps", () => {
    const initial = advanceFoilScoring(createFoilScoringState(), sample(10))
    const equal = advanceFoilScoring(initial, sample(10))

    expect(equal.lastSampleAtUs).toBe(10)
    expect(() => advanceFoilScoring(equal, sample(9))).toThrow(
      new RangeError("Foil samples must use monotonic timestamps")
    )

    for (const atUs of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => advanceFoilScoring(createFoilScoringState(), sample(atUs))).toThrow(
        new RangeError("Foil samples must use non-negative safe integer timestamps")
      )
    }
  })
})
