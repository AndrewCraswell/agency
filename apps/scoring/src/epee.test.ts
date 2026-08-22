import { describe, expect, it } from "vitest"
import {
  EPEE_RULES,
  advanceEpeeScoring,
  createEpeeScoringState,
  type EpeeContact,
  type EpeeSample,
  type EpeeScoringState
} from "./epee.js"

const OPEN: EpeeContact = { isGrounded: false, isTipClosed: false }
const HIT: EpeeContact = { isGrounded: false, isTipClosed: true }
const GROUNDED: EpeeContact = { isGrounded: true, isTipClosed: true }

function sample(atUs: number, left = OPEN, right = OPEN): EpeeSample {
  return { atUs, left, right }
}

function replay(samples: readonly EpeeSample[], initialState = createEpeeScoringState()) {
  return samples.reduce<EpeeScoringState>(advanceEpeeScoring, initialState)
}

describe("epée scoring", () => {
  it("rejects a contact shorter than two milliseconds", () => {
    const state = replay([sample(0, HIT), sample(EPEE_RULES.contactTimeUs - 1, HIT), sample(2_000)])

    expect(state.hits).toEqual([])
  })

  it("registers a contact at exactly two milliseconds", () => {
    const state = replay([sample(10_000, HIT), sample(12_000, HIT)])

    expect(state.hits).toEqual([{ qualifiedAtUs: 12_000, side: "left", startedAtUs: 10_000 }])
  })

  it("does not register a grounded tip contact", () => {
    const state = replay([sample(0, GROUNDED), sample(10_000, GROUNDED)])

    expect(state.hits).toEqual([])
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
})
