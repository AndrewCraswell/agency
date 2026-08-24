import { describe, expect, it } from "vitest"
import {
  advanceEpeeResistanceScoring,
  createEpeeResistanceScoringState,
  type EpeeResistanceContact,
  type EpeeResistanceSample,
  type ResistanceMeasurement
} from "./epee-resistance.js"
import {
  EPEE_RULES,
  advanceEpeeScoring,
  createEpeeScoringState,
  type EpeeContact,
  type EpeeSample,
  type Side
} from "./epee.js"

const NO_MEASUREMENT: ResistanceMeasurement = {
  resistanceMilliOhms: null,
  resistanceUncertaintyMilliOhms: null
}
const NORMAL_10_OHM: ResistanceMeasurement = {
  resistanceMilliOhms: 10_000,
  resistanceUncertaintyMilliOhms: 0
}
const EXCEPTIONAL_100_OHM: ResistanceMeasurement = {
  resistanceMilliOhms: 100_000,
  resistanceUncertaintyMilliOhms: 0
}
const UNCERTAIN_NORMAL_10_OHM: ResistanceMeasurement = {
  resistanceMilliOhms: 10_000,
  resistanceUncertaintyMilliOhms: 1
}

const OPEN: EpeeResistanceContact = {
  circuitComplete: "open",
  contactResistance: NO_MEASUREMENT,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const SIMPLE_OPEN: EpeeContact = { isGrounded: false, isTipClosed: false }
const SIMPLE_HIT: EpeeContact = { isGrounded: false, isTipClosed: true }
const SIMPLE_GROUNDED: EpeeContact = { isGrounded: true, isTipClosed: true }

function closed(contactResistance: ResistanceMeasurement): EpeeResistanceContact {
  return {
    circuitComplete: "closed",
    contactResistance,
    groundPathResistance: NO_MEASUREMENT,
    groundedMaterial: "not-grounded",
    lineIntegrity: "intact"
  }
}

function grounded(groundPathResistance: ResistanceMeasurement): EpeeResistanceContact {
  return {
    circuitComplete: "closed",
    contactResistance: EXCEPTIONAL_100_OHM,
    groundPathResistance,
    groundedMaterial: "grounded",
    lineIntegrity: "intact"
  }
}

function unavailable(): EpeeResistanceContact {
  return {
    circuitComplete: "unavailable",
    contactResistance: NO_MEASUREMENT,
    groundPathResistance: NO_MEASUREMENT,
    groundedMaterial: "unavailable",
    lineIntegrity: "unavailable"
  }
}

function sample(atUs: number, left = OPEN, right = OPEN): EpeeResistanceSample {
  return { atUs, left, right }
}

function simpleSample(atUs: number, left = SIMPLE_OPEN, right = SIMPLE_OPEN): EpeeSample {
  return { atUs, left, right }
}

function replay(samples: readonly EpeeResistanceSample[]) {
  return samples.reduce(
    (state, sample) => advanceEpeeResistanceScoring(state, sample),
    createEpeeResistanceScoringState()
  )
}

function oppositeSide(side: Side): Side {
  return side === "left" ? "right" : "left"
}

function atSide(side: Side, atUs: number, contact: EpeeResistanceContact): EpeeResistanceSample {
  return side === "left" ? sample(atUs, contact) : sample(atUs, OPEN, contact)
}

function toResistanceContact(contact: EpeeContact, resistance: ResistanceMeasurement): EpeeResistanceContact {
  if (!contact.isTipClosed) {
    return OPEN
  }

  return contact.isGrounded ? grounded(EXCEPTIONAL_100_OHM) : closed(resistance)
}

function toResistanceSample(sample: EpeeSample, resistance: ResistanceMeasurement): EpeeResistanceSample {
  return {
    atUs: sample.atUs,
    left: toResistanceContact(sample.left, resistance),
    right: toResistanceContact(sample.right, resistance)
  }
}

describe("epée resistance scoring", () => {
  it.each([NORMAL_10_OHM, EXCEPTIONAL_100_OHM] as const)(
    "matches simple-contact hits and lock state for exact %d milli-ohm observations",
    (resistance) => {
      const simpleCases = [
        [
          simpleSample(0, SIMPLE_HIT),
          simpleSample(1, SIMPLE_HIT, SIMPLE_HIT),
          simpleSample(2_001, SIMPLE_HIT, SIMPLE_HIT),
          simpleSample(EPEE_RULES.lockoutTimeUs + 1, SIMPLE_HIT, SIMPLE_HIT)
        ],
        [
          simpleSample(0, SIMPLE_HIT),
          simpleSample(2_000, SIMPLE_HIT),
          simpleSample(EPEE_RULES.lockoutTimeUs - 1, SIMPLE_HIT, SIMPLE_HIT),
          simpleSample(EPEE_RULES.lockoutTimeUs + 1, SIMPLE_HIT, SIMPLE_HIT),
          simpleSample(EPEE_RULES.lockoutTimeUs - 1 + EPEE_RULES.contactTimeUs, SIMPLE_HIT, SIMPLE_HIT)
        ],
        [
          simpleSample(0, SIMPLE_HIT),
          simpleSample(1_000, SIMPLE_GROUNDED),
          simpleSample(2_000, SIMPLE_HIT),
          simpleSample(4_000, SIMPLE_HIT)
        ]
      ]
      for (const simpleSamples of simpleCases) {
        const simpleState = simpleSamples.reduce(
          (state, nextSample) => advanceEpeeScoring(state, nextSample),
          createEpeeScoringState()
        )
        const resistanceState = simpleSamples
          .map((nextSample) => toResistanceSample(nextSample, resistance))
          .reduce(
            (state, nextSample) => advanceEpeeResistanceScoring(state, nextSample),
            createEpeeResistanceScoringState()
          )

        expect({
          firstHitAtUs: resistanceState.firstHitAtUs,
          hits: resistanceState.hits,
          isLocked: resistanceState.isLocked,
          lastSampleAtUs: resistanceState.lastSampleAtUs,
          left: resistanceState.left,
          right: resistanceState.right
        }).toEqual(simpleState)
      }
    }
  )

  it("registers a normal 10 ohm contact observed for ten milliseconds", () => {
    const state = replay([sample(0, closed(NORMAL_10_OHM)), sample(10_000, closed(NORMAL_10_OHM))])

    expect(state.hits).toEqual([{ qualifiedAtUs: 10_000, side: "left", startedAtUs: 0 }])
    expect(state.decisions).toContainEqual({
      disposition: "qualified-hit",
      hit: { qualifiedAtUs: 10_000, side: "left", startedAtUs: 0 },
      resistanceClass: "normal-10-ohm"
    })
  })

  it("registers an exceptional 100 ohm contact at the two millisecond lower boundary without setting an upper duration", () => {
    const state = replay([sample(0, closed(EXCEPTIONAL_100_OHM)), sample(2_000, closed(EXCEPTIONAL_100_OHM))])

    expect(state.hits).toEqual([{ qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 }])
    expect(state.decisions).toContainEqual({
      disposition: "qualified-hit",
      hit: { qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 },
      resistanceClass: "exceptional-100-ohm"
    })
  })

  it("does not register an exceptional 100 ohm contact shorter than two milliseconds", () => {
    const state = replay([sample(0, closed(EXCEPTIONAL_100_OHM)), sample(EPEE_RULES.contactTimeUs - 1, OPEN)])

    expect(state.hits).toEqual([])
  })

  it("retains a trusted candidate before its lower duration boundary and inhibits the same side after qualification", () => {
    const state = replay([
      sample(0, closed(NORMAL_10_OHM)),
      sample(1_000, closed(NORMAL_10_OHM)),
      sample(2_000, closed(NORMAL_10_OHM)),
      sample(3_000, closed(NORMAL_10_OHM))
    ])

    expect(state.hits).toEqual([{ qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 }])
  })

  it("rejects grounded material through a 100 ohm earth path without suppressing the opposing normal contact", () => {
    const state = replay([
      sample(0, grounded(EXCEPTIONAL_100_OHM), closed(NORMAL_10_OHM)),
      sample(2_000, grounded(EXCEPTIONAL_100_OHM), closed(NORMAL_10_OHM))
    ])

    expect(state.hits).toEqual([{ qualifiedAtUs: 2_000, side: "right", startedAtUs: 0 }])
    expect(state.decisions).toContainEqual({
      atUs: 0,
      disposition: "grounded-material-rejection",
      groundPathResistance: EXCEPTIONAL_100_OHM,
      side: "left"
    })
  })

  it("registers simultaneous normal and exceptional contacts independently", () => {
    const state = replay([
      sample(0, closed(NORMAL_10_OHM), closed(EXCEPTIONAL_100_OHM)),
      sample(2_000, closed(NORMAL_10_OHM), closed(EXCEPTIONAL_100_OHM))
    ])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
  })

  it("orders separately started contacts by their candidate time when they qualify in one sample", () => {
    const state = replay([
      sample(0, closed(NORMAL_10_OHM)),
      sample(1, closed(NORMAL_10_OHM), closed(EXCEPTIONAL_100_OHM)),
      sample(2_001, closed(NORMAL_10_OHM), closed(EXCEPTIONAL_100_OHM))
    ])

    expect(state.hits.map(({ startedAtUs }) => startedAtUs)).toEqual([0, 1])
  })

  it.each([
    ["left", NORMAL_10_OHM, EXCEPTIONAL_100_OHM],
    ["right", NORMAL_10_OHM, EXCEPTIONAL_100_OHM],
    ["left", EXCEPTIONAL_100_OHM, NORMAL_10_OHM],
    ["right", EXCEPTIONAL_100_OHM, NORMAL_10_OHM]
  ] as const)(
    "retains the opposing trusted contact at the provisional lockout boundary when %s starts first",
    (firstSide, firstResistance, opposingResistance) => {
      const opposingSide = oppositeSide(firstSide)
      const state = replay([
        atSide(firstSide, 0, closed(firstResistance)),
        atSide(firstSide, 2_000, closed(firstResistance)),
        atSide(opposingSide, EPEE_RULES.lockoutTimeUs, closed(opposingResistance)),
        atSide(opposingSide, EPEE_RULES.lockoutTimeUs + EPEE_RULES.contactTimeUs, closed(opposingResistance))
      ])

      expect(state.hits.map(({ side }) => side)).toEqual([firstSide, opposingSide])
    }
  )

  it("reports a resistance interval overlapping a named test point as uncertainty instead of an ungrounded false", () => {
    const state = replay([
      sample(0, closed(NORMAL_10_OHM), closed(UNCERTAIN_NORMAL_10_OHM)),
      sample(2_000, closed(NORMAL_10_OHM), closed(UNCERTAIN_NORMAL_10_OHM))
    ])

    expect(state.hits).toEqual([{ qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 }])
    expect(state.right.candidateSinceUs).toBeNull()
    expect(state.decisions).toContainEqual({
      atUs: 0,
      disposition: "uncertainty",
      rangeMilliOhms: { max: 10_001, min: 9_999 },
      side: "right",
      subject: "contact-resistance"
    })
  })

  it("records an unavailable phase and requires a later complete observation to begin a new candidate", () => {
    const state = replay([
      sample(0, closed(NORMAL_10_OHM)),
      sample(1_000, unavailable()),
      sample(2_000, closed(NORMAL_10_OHM)),
      sample(4_000, closed(NORMAL_10_OHM))
    ])

    expect(state.hits).toEqual([{ qualifiedAtUs: 4_000, side: "left", startedAtUs: 2_000 }])
    expect(state.decisions).toContainEqual({
      atUs: 1_000,
      disposition: "unavailable",
      side: "left",
      subject: "line-integrity"
    })
  })

  it.each([
    ["left", unavailable(), "unavailable", "line-integrity"],
    ["right", unavailable(), "unavailable", "line-integrity"],
    ["left", { ...closed(NORMAL_10_OHM), circuitComplete: "indeterminate" }, "uncertainty", "tip-loop"],
    ["right", { ...closed(NORMAL_10_OHM), circuitComplete: "indeterminate" }, "uncertainty", "tip-loop"],
    ["left", closed(UNCERTAIN_NORMAL_10_OHM), "uncertainty", "contact-resistance"],
    ["right", closed(UNCERTAIN_NORMAL_10_OHM), "uncertainty", "contact-resistance"]
  ] as const)(
    "keeps %s-side unavailable, indeterminate, and interval evidence out of hit qualification",
    (side, contact, disposition, subject) => {
      const state = replay([atSide(side, 0, contact)])
      const decision = state.decisions[0]

      expect(state.hits).toEqual([])
      expect(decision).toMatchObject({ atUs: 0, disposition, side, subject })
    }
  )

  it.each([
    ["cross-line", { ...closed(NORMAL_10_OHM), lineIntegrity: "cross-line" }, "line-fault", "line-integrity"],
    ["out-of-range", { ...closed(NORMAL_10_OHM), lineIntegrity: "out-of-range" }, "line-fault", "line-integrity"],
    [
      "indeterminate line integrity",
      { ...closed(NORMAL_10_OHM), lineIntegrity: "indeterminate" },
      "uncertainty",
      "line-integrity"
    ],
    [
      "indeterminate tip loop",
      { ...closed(NORMAL_10_OHM), circuitComplete: "indeterminate" },
      "uncertainty",
      "tip-loop"
    ],
    ["unavailable tip loop", { ...closed(NORMAL_10_OHM), circuitComplete: "unavailable" }, "unavailable", "tip-loop"],
    [
      "indeterminate ground reference",
      { ...closed(NORMAL_10_OHM), groundedMaterial: "indeterminate" },
      "uncertainty",
      "ground-reference"
    ],
    [
      "unavailable ground reference",
      { ...closed(NORMAL_10_OHM), groundedMaterial: "unavailable" },
      "unavailable",
      "ground-reference"
    ],
    ["unmeasured contact resistance", closed(NO_MEASUREMENT), "unavailable", "contact-resistance"]
  ] as const)("surfaces %s as an explicit non-scoring outcome", (_description, contact, disposition, subject) => {
    const state = replay([sample(0, contact)])
    const decision = state.decisions[0]

    expect(decision?.disposition).toBe(disposition)
    expect(decision).toMatchObject({ atUs: 0, side: "left" })
    if (decision?.disposition !== "line-fault") {
      expect(decision).toMatchObject({ subject })
    }
    expect(state.left.candidateSinceUs).toBeNull()
  })

  it("rejects incomplete, invalid, and non-monotonic input without treating it as a contact", () => {
    const incompleteMeasurement = closed({ resistanceMilliOhms: 10_000, resistanceUncertaintyMilliOhms: null })
    const invalidMeasurement = closed({ resistanceMilliOhms: -1, resistanceUncertaintyMilliOhms: 0 })
    const state = advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), sample(1, closed(NORMAL_10_OHM)))

    expect(() => advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), sample(-1))).toThrow(
      new RangeError("Epee resistance samples must use non-negative safe integer timestamps")
    )
    expect(() =>
      advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), sample(0, incompleteMeasurement))
    ).toThrow(new RangeError("Epee resistance measurements must provide a value and uncertainty together"))
    expect(() =>
      advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), sample(0, invalidMeasurement))
    ).toThrow(new RangeError("Epee resistance measurements must use non-negative safe integer milli-ohms"))
    expect(() => advanceEpeeResistanceScoring(state, sample(0))).toThrow(
      new RangeError("Epee resistance samples must use monotonic timestamps")
    )
  })

  it("does not add decisions after the retained lockout state", () => {
    const locked = replay([
      sample(0, closed(NORMAL_10_OHM)),
      sample(2_000, closed(NORMAL_10_OHM)),
      sample(EPEE_RULES.lockoutTimeUs + 1)
    ])
    const afterLock = advanceEpeeResistanceScoring(locked, sample(100_000, grounded(EXCEPTIONAL_100_OHM)))

    expect(afterLock.isLocked).toBe(true)
    expect(afterLock.decisions).toEqual(locked.decisions)
    expect(afterLock.lastSampleAtUs).toBe(100_000)
  })

  it("retains a registered side while reporting a later grounded-material diagnostic", () => {
    const state = replay([
      sample(0, closed(NORMAL_10_OHM)),
      sample(2_000, closed(NORMAL_10_OHM)),
      sample(3_000, grounded(EXCEPTIONAL_100_OHM))
    ])

    expect(state.hits).toEqual([{ qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 }])
    expect(state.left.isRegistered).toBe(true)
    expect(state.decisions).toContainEqual({
      atUs: 3_000,
      disposition: "grounded-material-rejection",
      groundPathResistance: EXCEPTIONAL_100_OHM,
      side: "left"
    })
  })

  it("does not append a restored candidate that began outside the retained provisional lockout window", () => {
    const firstHit = { qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 } as const
    const restoredState = {
      ...createEpeeResistanceScoringState(),
      firstHitAtUs: firstHit.startedAtUs,
      hits: [firstHit],
      lastSampleAtUs: EPEE_RULES.lockoutTimeUs + 1,
      left: { candidateSinceUs: null, isRegistered: true },
      right: { candidateSinceUs: EPEE_RULES.lockoutTimeUs + 1, isRegistered: false }
    }
    const state = advanceEpeeResistanceScoring(
      restoredState,
      sample(EPEE_RULES.lockoutTimeUs + EPEE_RULES.contactTimeUs + 1, OPEN, closed(EXCEPTIONAL_100_OHM))
    )

    expect(state.hits).toEqual([firstHit])
    expect(state.isLocked).toBe(true)
  })
})
