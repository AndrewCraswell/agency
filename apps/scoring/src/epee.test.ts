import { describe, expect, it } from "vitest"
import {
  EPEE_RULES,
  advanceEpeeScoring,
  createEpeeScoringState,
  type EpeeContact,
  type EpeeSample,
  type EpeeScoringState,
  type Side
} from "./epee.js"

const OPEN: EpeeContact = { isGrounded: false, isTipClosed: false }
const HIT: EpeeContact = { isGrounded: false, isTipClosed: true }
const GROUNDED: EpeeContact = { isGrounded: true, isTipClosed: true }
const LOCKOUT_SIDES: readonly Side[] = ["left", "right"]
const LOCKOUT_BOUNDARY_CASES: readonly LockoutBoundaryCase[] = [
  { opposingStartedAtUs: 39_999, registersDoubleHit: true },
  { opposingStartedAtUs: 40_000, registersDoubleHit: true },
  { opposingStartedAtUs: 45_000, registersDoubleHit: true },
  { opposingStartedAtUs: 50_000, registersDoubleHit: false },
  { opposingStartedAtUs: 50_001, registersDoubleHit: false }
]
const LOCKOUT_SIDE_CASES: readonly LockoutSideCase[] = LOCKOUT_SIDES.flatMap((firstSide) =>
  LOCKOUT_BOUNDARY_CASES.map((boundary) => ({
    ...boundary,
    firstSide,
    opposingSide: oppositeSide(firstSide)
  }))
)

type LockoutBoundaryCase = {
  opposingStartedAtUs: number
  registersDoubleHit: boolean
}

type LockoutSideCase = LockoutBoundaryCase & {
  firstSide: Side
  opposingSide: Side
}

function sample(atUs: number, left = OPEN, right = OPEN): EpeeSample {
  return { atUs, left, right }
}

function hitSample(atUs: number, side: Side): EpeeSample {
  return side === "left" ? sample(atUs, HIT) : sample(atUs, OPEN, HIT)
}

function oppositeSide(side: Side): Side {
  return side === "left" ? "right" : "left"
}

function replay(samples: readonly EpeeSample[], initialState = createEpeeScoringState()) {
  return samples.reduce<EpeeScoringState>((state, sample) => advanceEpeeScoring(state, sample), initialState)
}

describe("epée scoring", () => {
  it.each([
    [sample(0, HIT), sample(EPEE_RULES.contactTimeUs - 1, HIT), sample(2_000)],
    [sample(0, OPEN, HIT), sample(EPEE_RULES.contactTimeUs - 1, OPEN, HIT), sample(2_000)]
  ] as const)("rejects a contact shorter than two milliseconds", (started, beforeMinimum, ended) => {
    const state = replay([started, beforeMinimum, ended])

    expect(state.hits).toEqual([])
  })

  it.each([
    ["left", sample(10_000, HIT), sample(12_000, HIT)],
    ["right", sample(10_000, OPEN, HIT), sample(12_000, OPEN, HIT)]
  ] as const)("registers a %s contact at exactly two milliseconds", (side, started, qualified) => {
    const state = replay([started, qualified])

    expect(state.hits).toEqual([{ qualifiedAtUs: 12_000, side, startedAtUs: 10_000 }])
  })

  it.each([
    ["left", sample(0, GROUNDED, HIT), sample(2_000, GROUNDED, HIT), "right"],
    ["right", sample(0, HIT, GROUNDED), sample(2_000, HIT, GROUNDED), "left"]
  ] as const)(
    "rejects a grounded %s tip without suppressing the opposing hit",
    (_groundedSide, started, qualified, hitSide) => {
      const state = replay([started, qualified])

      expect(state.hits).toEqual([{ qualifiedAtUs: 2_000, side: hitSide, startedAtUs: 0 }])
    }
  )

  it("resets a candidate when its tip becomes grounded", () => {
    const state = replay([sample(0, HIT), sample(1_999, GROUNDED), sample(2_000, HIT), sample(4_000, HIT)])

    expect(state.hits).toEqual([{ qualifiedAtUs: 4_000, side: "left", startedAtUs: 2_000 }])
  })

  it("registers simultaneous contacts independently of side processing", () => {
    const state = replay([sample(0, HIT, HIT), sample(2_000, HIT, HIT)])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
  })

  it("orders contacts by their physical start time when both qualify in one scan", () => {
    const state = replay([
      sample(0, HIT),
      sample(1, HIT, HIT),
      sample(EPEE_RULES.contactTimeUs + 1, HIT, HIT),
      sample(EPEE_RULES.contactTimeUs + 2, HIT, HIT)
    ])

    expect(state.hits.map(({ startedAtUs }) => startedAtUs)).toEqual([0, 1])
  })

  it("registers a double touch at the selected lockout boundary", () => {
    const state = replay([
      sample(0, HIT),
      sample(2_000, HIT),
      sample(EPEE_RULES.lockoutTimeUs, OPEN, HIT),
      sample(EPEE_RULES.lockoutTimeUs + EPEE_RULES.contactTimeUs, OPEN, HIT)
    ])

    expect(state.hits.map(({ side }) => side)).toEqual(["left", "right"])
    expect(state.isLocked).toBe(true)
  })

  it.each(LOCKOUT_SIDE_CASES)(
    "applies the provisional 45 millisecond start-anchored cutoff when $firstSide hits first and $opposingSide starts at $opposingStartedAtUs microseconds",
    ({ firstSide, opposingSide, opposingStartedAtUs, registersDoubleHit }) => {
      const state = replay([
        hitSample(0, firstSide),
        hitSample(2_000, firstSide),
        hitSample(opposingStartedAtUs, opposingSide),
        hitSample(opposingStartedAtUs + EPEE_RULES.contactTimeUs, opposingSide)
      ])

      expect(state.hits.map(({ side }) => side)).toEqual(registersDoubleHit ? [firstSide, opposingSide] : [firstSide])
    }
  )

  it("ignores an opposing touch that begins after lockout", () => {
    const state = replay([
      sample(0, HIT),
      sample(2_000, HIT),
      sample(EPEE_RULES.lockoutTimeUs + 1, OPEN, HIT),
      sample(EPEE_RULES.lockoutTimeUs + EPEE_RULES.contactTimeUs + 1, OPEN, HIT)
    ])

    expect(state.hits.map(({ side }) => side)).toEqual(["left"])
    expect(state.isLocked).toBe(true)
  })

  it("rejects an out-of-window candidate from a restored state snapshot", () => {
    const firstHit = { qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 } as const
    const restoredState: EpeeScoringState = {
      ...createEpeeScoringState(),
      firstHitAtUs: firstHit.startedAtUs,
      hits: [firstHit],
      lastSampleAtUs: EPEE_RULES.lockoutTimeUs + 1,
      left: { candidateSinceUs: null, isRegistered: true },
      right: { candidateSinceUs: EPEE_RULES.lockoutTimeUs + 1, isRegistered: false }
    }
    const state = advanceEpeeScoring(
      restoredState,
      sample(EPEE_RULES.lockoutTimeUs + EPEE_RULES.contactTimeUs + 1, OPEN, HIT)
    )

    expect(state.hits).toEqual([firstHit])
    expect(state.isLocked).toBe(true)
  })

  it("waits for an in-window candidate to qualify after the lockout deadline", () => {
    const candidateAtUs = EPEE_RULES.lockoutTimeUs - 1
    const beforeQualification = replay([
      sample(0, HIT),
      sample(2_000, HIT),
      sample(candidateAtUs, OPEN, HIT),
      sample(EPEE_RULES.lockoutTimeUs + 1, OPEN, HIT)
    ])

    expect(beforeQualification.isLocked).toBe(false)

    const qualified = advanceEpeeScoring(
      beforeQualification,
      sample(candidateAtUs + EPEE_RULES.contactTimeUs, OPEN, HIT)
    )

    expect(qualified.hits.map(({ side }) => side)).toEqual(["left", "right"])
    expect(qualified.isLocked).toBe(true)
  })

  it("ignores additional samples after locking", () => {
    const locked = replay([sample(0, HIT), sample(2_000, HIT), sample(EPEE_RULES.lockoutTimeUs + 1)])
    const afterLock = advanceEpeeScoring(locked, sample(100_000, OPEN, HIT))

    expect(afterLock.hits).toEqual(locked.hits)
    expect(afterLock.lastSampleAtUs).toBe(100_000)
  })

  it("rejects timestamps that move backward", () => {
    const state = advanceEpeeScoring(createEpeeScoringState(), sample(10))

    expect(() => advanceEpeeScoring(state, sample(9))).toThrow(
      new RangeError("Epee samples must use monotonic timestamps")
    )
  })

  it("allows equal timestamps from one timer capture", () => {
    const state = replay([sample(0, HIT), sample(0, HIT)])

    expect(state.hits).toEqual([])
  })

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects an invalid scoring-clock timestamp of %s", (atUs) => {
    expect(() => advanceEpeeScoring(createEpeeScoringState(), sample(atUs))).toThrow(
      new RangeError("Epee samples must use non-negative safe integer timestamps")
    )
  })
})
