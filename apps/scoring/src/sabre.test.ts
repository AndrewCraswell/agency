import { describe, expect, it } from "vitest"
import {
  SABRE_RULES,
  advanceSabreScoring,
  createSabreScoringState,
  type SabreContact,
  type SabreSample,
  type SabreScoringState,
  type SabreSide
} from "./sabre.js"

const READY: SabreContact = {
  bladeContact: "absent",
  circuitBCFault: "normal",
  externalPathEligibility: "eligible",
  ownEquipmentFault: "absent",
  targetContact: "target"
}
const NON_CONDUCTIVE: SabreContact = { ...READY, targetContact: "nonConductiveSurface" }
const BLADE_TARGET: SabreContact = { ...READY, bladeContact: "present" }
const BLADE_NON_CONDUCTIVE: SabreContact = { ...NON_CONDUCTIVE, bladeContact: "present" }
const BLADE_INTERRUPTED: SabreContact = { ...NON_CONDUCTIVE, bladeContact: "absent" }

function sample(atUs: number, left = NON_CONDUCTIVE, right = NON_CONDUCTIVE): SabreSample {
  return { atUs, left, right }
}

function forSide(side: SabreSide, contact: SabreContact, atUs: number): SabreSample {
  return side === "left" ? sample(atUs, contact) : sample(atUs, NON_CONDUCTIVE, contact)
}

function replay(samples: readonly SabreSample[]): SabreScoringState {
  return samples.reduce((state, sample) => advanceSabreScoring(state, sample), createSabreScoringState())
}

function oppositeSide(side: SabreSide): SabreSide {
  return side === "left" ? "right" : "left"
}

function unsignalledBladeMediatedSequence(side: SabreSide, interruptionCount: number): SabreSample[] {
  const samples = [forSide(side, BLADE_TARGET, 0), forSide(side, BLADE_NON_CONDUCTIVE, 99)]

  for (let interruption = 0; interruption < interruptionCount; interruption += 1) {
    const atUs = 100 + interruption * 2
    samples.push(forSide(side, BLADE_INTERRUPTED, atUs), forSide(side, BLADE_NON_CONDUCTIVE, atUs + 1))
  }

  return samples
}

describe("sabre scoring state machine", () => {
  it.each([
    ["left", 99, false],
    ["left", 100, true],
    ["left", 101, true],
    ["right", 99, false],
    ["right", 100, true],
    ["right", 101, true]
  ] as const)("qualifies a %s target contact only at the 100 microsecond floor: %s", (side, atUs, qualifies) => {
    const state = replay([forSide(side, READY, 0), forSide(side, READY, atUs)])

    expect(state.hits).toHaveLength(qualifies ? 1 : 0)
    expect(state.hits[0]).toMatchObject(qualifies ? { side, startedAtUs: 0 } : {})
  })

  it.each([999, 1_000, 1_001] as const)(
    "uses %i microseconds as a sensitivity test point without inventing an upper expiry",
    (atUs) => {
      const state = replay([forSide("left", READY, 0), forSide("left", READY, atUs)])

      expect(state.hits).toEqual([{ qualifiedAtUs: atUs, side: "left", startedAtUs: 0 }])
    }
  )

  it.each(["left", "right"] as const)("rejects a %s non-conductive surface", (side) => {
    const state = replay([forSide(side, NON_CONDUCTIVE, 0), forSide(side, NON_CONDUCTIVE, 1_000)])

    expect(state.hits).toEqual([])
    expect(state[side].observationStatus).toBe("non-conductive-surface")
  })

  it.each(["left", "right"] as const)(
    "keeps a %s own-equipment yellow diagnostic independent from a valid target hit",
    (side) => {
      const ownEquipment: SabreContact = { ...READY, ownEquipmentFault: "present" }
      const state = replay([forSide(side, ownEquipment, 0), forSide(side, ownEquipment, 100)])

      expect(state.hits).toEqual([{ qualifiedAtUs: 100, side, startedAtUs: 0 }])
      expect(state[side].yellowDiagnostic).toBe("yellow-on")
    }
  )

  it("does not let an own-equipment diagnostic suppress an independent opponent hit", () => {
    const ownEquipment: SabreContact = { ...READY, ownEquipmentFault: "present" }
    const state = replay([sample(0, ownEquipment, READY), sample(100, ownEquipment, READY)])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
    expect(state.left.yellowDiagnostic).toBe("yellow-on")
  })

  it.each(["indeterminate", "unavailable"] as const)(
    "does not turn an %s own-equipment diagnostic into a lamp or a hit decision",
    (ownEquipmentFault) => {
      const contact: SabreContact = { ...READY, ownEquipmentFault }
      const state = replay([forSide("left", contact, 0), forSide("left", contact, 100)])

      expect(state.hits).toHaveLength(1)
      expect(state.left.yellowDiagnostic).toBe(ownEquipmentFault)
    }
  )

  it.each(["ineligible", "indeterminate", "unavailable"] as const)(
    "fails closed for an external path that is %s",
    (externalPathEligibility) => {
      const contact: SabreContact = { ...READY, externalPathEligibility }
      const state = replay([forSide("left", contact, 0), forSide("left", contact, 100)])

      expect(state.hits).toEqual([])
      expect(state.left.observationStatus).not.toBe("ready")
    }
  )

  it.each(["indeterminate", "unavailable"] as const)(
    "fails closed for a %s target projection without disturbing the other side",
    (targetContact) => {
      const interrupted: SabreContact = { ...READY, targetContact }
      const state = replay([sample(0, interrupted, READY), sample(100, interrupted, READY)])

      expect(state.hits).toEqual([{ qualifiedAtUs: 100, side: "right", startedAtUs: 0 }])
      expect(state.left.observationStatus).toBe(targetContact)
    }
  )

  it.each(["indeterminate", "unavailable"] as const)(
    "fails closed for a blade/guard contact that is %s",
    (bladeContact) => {
      const contact: SabreContact = { ...READY, bladeContact }
      const state = replay([forSide("left", contact, 0), forSide("left", contact, 100)])

      expect(state.hits).toEqual([])
      expect(state.left.observationStatus).not.toBe("ready")
    }
  )

  it.each(["left", "right"] as const)(
    "registers a %s blade-mediated target contact in the provisional early region",
    (side) => {
      const state = replay([forSide(side, BLADE_TARGET, 0), forSide(side, BLADE_TARGET, 100)])

      expect(state.hits).toEqual([{ qualifiedAtUs: 100, side, startedAtUs: 0 }])
    }
  )

  it.each(["left", "right"] as const)(
    "registers a %s unsignalled blade-mediated sequence that reaches four milliseconds before the provisional gate",
    (side) => {
      const state = replay([
        ...unsignalledBladeMediatedSequence(side, 0),
        forSide(side, BLADE_TARGET, 3_900),
        forSide(side, BLADE_TARGET, 4_000)
      ])

      expect(state.hits).toEqual([{ qualifiedAtUs: 4_000, side, startedAtUs: 3_900 }])
    }
  )

  it.each(["left", "right"] as const)(
    "includes exactly five milliseconds in the provisional %s blade-mediated registration region",
    (side) => {
      const state = replay([
        ...unsignalledBladeMediatedSequence(side, 0),
        forSide(side, BLADE_TARGET, 4_900),
        forSide(side, BLADE_TARGET, 5_000)
      ])

      expect(state.hits).toEqual([{ qualifiedAtUs: 5_000, side, startedAtUs: 4_900 }])
    }
  )

  it.each(["left", "right"] as const)(
    "prevents a %s unsignalled blade-mediated candidate at five and fifteen milliseconds",
    (side) => {
      const fiveMilliseconds = replay([
        ...unsignalledBladeMediatedSequence(side, 0),
        forSide(side, BLADE_TARGET, 5_000),
        forSide(side, BLADE_TARGET, 5_100)
      ])
      const fifteenMilliseconds = replay([
        ...unsignalledBladeMediatedSequence(side, 0),
        forSide(side, BLADE_TARGET, 15_000),
        forSide(side, BLADE_TARGET, 15_100)
      ])

      expect(fiveMilliseconds.hits).toEqual([])
      expect(fiveMilliseconds[side].observationStatus).toBe("whipover-rejection")
      expect(fifteenMilliseconds.hits).toEqual([])
      expect(fifteenMilliseconds[side].observationStatus).toBe("whipover-rejection")
    }
  )

  it.each([0, 10, 11] as const)(
    "retains %i blade-contact interruptions as a deterministic no-false-hit history",
    (interruptionCount) => {
      const state = replay([
        ...unsignalledBladeMediatedSequence("left", interruptionCount),
        forSide("left", BLADE_TARGET, 6_000),
        forSide("left", BLADE_TARGET, 6_100)
      ])

      expect(state.hits).toEqual([])
      expect(state.left.bladeMediated?.interruptionCount).toBe(interruptionCount)
      expect(state.left.observationStatus).toBe(interruptionCount <= 10 ? "whipover-rejection" : "indeterminate")
    }
  )

  it.each(["left", "right"] as const)(
    "allows a %s normal later contact to recover at the provisional 20 millisecond blade-history endpoint",
    (side) => {
      const state = replay([
        ...unsignalledBladeMediatedSequence(side, 0),
        forSide(side, BLADE_TARGET, 20_000),
        forSide(side, READY, 20_100)
      ])

      expect(state.hits).toEqual([{ qualifiedAtUs: 20_100, side, startedAtUs: 20_000 }])
      expect(state[side].bladeMediated).toBeNull()
    }
  )

  it("asserts a white B/C abnormal-change diagnostic without promoting it to a hit", () => {
    const abnormal: SabreContact = { ...NON_CONDUCTIVE, circuitBCFault: "abnormalChange" }
    const state = replay([forSide("left", abnormal, 0)])

    expect(state.hits).toEqual([])
    expect(state.left.whiteDiagnostic).toBe("white-on")
  })

  it.each([
    [2_999, false],
    [3_000, true],
    [3_001, true]
  ] as const)("qualifies the 3 millisecond B/C control-break diagnostic at %i microseconds: %s", (atUs, whiteOn) => {
    const controlBreak: SabreContact = { ...NON_CONDUCTIVE, circuitBCFault: "controlBreak" }
    const state = replay([forSide("left", controlBreak, 0), forSide("left", controlBreak, atUs)])

    expect(state.hits).toEqual([])
    expect(state.left.whiteDiagnostic).toBe(whiteOn ? "white-on" : "white-off")
  })

  it.each(["normal", "indeterminate", "unavailable"] as const)(
    "clears an unqualified control-break candidate when B/C becomes %s",
    (circuitBCFault) => {
      const controlBreak: SabreContact = { ...NON_CONDUCTIVE, circuitBCFault: "controlBreak" }
      const changed: SabreContact = { ...NON_CONDUCTIVE, circuitBCFault }
      const state = replay([forSide("left", controlBreak, 0), forSide("left", changed, 2_999)])

      expect(state.left.controlBreakSinceUs).toBeNull()
      expect(state.left.whiteDiagnostic).toBe(circuitBCFault === "normal" ? "white-off" : circuitBCFault)
    }
  )

  it("latches a qualified white diagnostic despite later normal B/C input", () => {
    const controlBreak: SabreContact = { ...NON_CONDUCTIVE, circuitBCFault: "controlBreak" }
    const state = replay([
      forSide("left", controlBreak, 0),
      forSide("left", controlBreak, 3_000),
      forSide("left", NON_CONDUCTIVE, 3_001)
    ])

    expect(state.left.whiteDiagnostic).toBe("white-on")
  })

  it.each(["left", "right"] as const)(
    "uses the first signalled %s hit and the provisional 170 millisecond inclusive lockout",
    (firstSide) => {
      const secondSide = oppositeSide(firstSide)
      const firstQualifiedAtUs = 100
      const lockoutAtUs = firstQualifiedAtUs + SABRE_RULES.provisionalLockoutUs
      const state = replay([
        forSide(firstSide, READY, 0),
        forSide(firstSide, READY, firstQualifiedAtUs),
        forSide(secondSide, READY, lockoutAtUs - SABRE_RULES.minimumContactUs - 1),
        forSide(secondSide, READY, lockoutAtUs - 1)
      ])
      const locked = advanceSabreScoring(state, forSide(secondSide, READY, lockoutAtUs))

      expect(state.hits.map(({ side }) => side)).toEqual([firstSide, secondSide])
      expect(locked).toMatchObject({ isLocked: true, lockoutEndsAtUs: lockoutAtUs })
      expect(locked.hits).toHaveLength(2)
    }
  )

  it.each([SABRE_RULES.eventWindowEarliestUs, SABRE_RULES.eventWindowLatestUs] as const)(
    "records the FIE sabre event-window reference point %i without treating it as the product endpoint",
    (referenceUs) => {
      expect(referenceUs).not.toBe(SABRE_RULES.provisionalLockoutUs)
    }
  )

  it("orders simultaneous qualifying hits by side for deterministic records", () => {
    const state = replay([sample(0, READY, READY), sample(100, READY, READY)])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
  })

  it("orders contacts by observed candidate start before side", () => {
    const state = replay([sample(0, READY), sample(1, READY, READY), sample(101, READY, READY)])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
    expect(state.hits.map(({ startedAtUs }) => startedAtUs)).toEqual([0, 1])
  })

  it("inhibits a second same-side hit before bout reset", () => {
    const state = replay([forSide("left", READY, 0), forSide("left", READY, 100), forSide("left", READY, 1_000)])

    expect(state.hits).toHaveLength(1)
  })

  it("accepts equal timestamps and rejects invalid or backward timestamps", () => {
    const initial = advanceSabreScoring(createSabreScoringState(), sample(10))
    const equal = advanceSabreScoring(initial, sample(10))

    expect(equal.lastSampleAtUs).toBe(10)
    expect(() => advanceSabreScoring(equal, sample(9))).toThrow(
      new RangeError("Sabre samples must use monotonic timestamps")
    )

    for (const atUs of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => advanceSabreScoring(createSabreScoringState(), sample(atUs))).toThrow(
        new RangeError("Sabre samples must use non-negative safe integer timestamps")
      )
    }
  })
})
