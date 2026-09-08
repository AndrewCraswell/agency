import { describe, expect, it } from "vitest"
import {
  advanceEpeeLifecycle,
  createEpeeLifecycleState,
  type EpeeContactClassification,
  type EpeeLifecycleState
} from "./epee-contact-kernel.js"

const CONTACT_MINIMUM_US = 2_000
const DOUBLE_HIT_WINDOW_US = 40_000

function candidate(): EpeeContactClassification<undefined, never> {
  return { candidate: undefined, type: "candidate" }
}

function open(): EpeeContactClassification<undefined, never> {
  return { type: "open" }
}

function advance(
  state: EpeeLifecycleState,
  atUs: number,
  left: EpeeContactClassification<undefined, never> = open(),
  right: EpeeContactClassification<undefined, never> = open()
) {
  return advanceEpeeLifecycle(state, {
    atUs,
    classifyLeft: () => left,
    classifyRight: () => right,
    contactMinimumUs: CONTACT_MINIMUM_US,
    doubleHitWindowUs: DOUBLE_HIT_WINDOW_US,
    monotonicTimestampError: "timestamps must be monotonic"
  })
}

describe("epée contact kernel", () => {
  it("keeps registered contacts latched through open and decision samples", () => {
    const registered = advance(advance(createEpeeLifecycleState(), 0, candidate()), 2_000, candidate())
    const held = advance(registered, 2_001, candidate())
    expect(held.hits).toEqual(registered.hits)
    expect(held.qualifiedHits).toEqual([])
    expect(advance(held, 2_002).left).toEqual(registered.left)
    const decisions = advanceEpeeLifecycle(held, {
      atUs: 2_003,
      classifyLeft: () => ({ type: "decision", decision: "left-fault" }),
      classifyRight: () => ({ type: "decision", decision: "right-fault" }),
      contactMinimumUs: CONTACT_MINIMUM_US,
      doubleHitWindowUs: DOUBLE_HIT_WINDOW_US,
      monotonicTimestampError: "backward"
    })
    expect(decisions.decisions).toEqual(["left-fault", "right-fault"])
    expect(decisions.left).toEqual(registered.left)
    expect(decisions.right).toEqual(createEpeeLifecycleState().right)
  })

  it("clears an interrupted candidate and requires a fresh minimum contact", () => {
    const pending = advance(createEpeeLifecycleState(), 0, candidate())
    const interrupted = advance(pending, 1_000)
    expect(interrupted.left.candidateSinceUs).toBeNull()
    const restarted = advance(interrupted, 1_001, candidate())
    expect(advance(restarted, 3_000, candidate()).hits).toEqual([])
    expect(advance(restarted, 3_001, candidate()).hits[0].startedAtUs).toBe(1_001)
  })

  it("orders simultaneous contacts left first and skips classifiers after lockout", () => {
    const both = advance(
      advance(createEpeeLifecycleState(), 0, candidate(), candidate()),
      2_000,
      candidate(),
      candidate()
    )
    expect(both.hits.map(({ side }) => side)).toEqual(["left", "right"])
    const locked = advance(both, 40_001)
    const result = advanceEpeeLifecycle(locked, {
      atUs: 40_002,
      classifyLeft: () => {
        throw new Error("must not classify")
      },
      classifyRight: () => {
        throw new Error("must not classify")
      },
      contactMinimumUs: CONTACT_MINIMUM_US,
      doubleHitWindowUs: DOUBLE_HIT_WINDOW_US,
      monotonicTimestampError: "backward"
    })
    expect(result.hits).toEqual(both.hits)
    expect(result.qualifiedHits).toEqual([])
    expect(result.lastSampleAtUs).toBe(40_002)
  })

  it("waits for a left candidate at the inclusive deadline after a right hit", () => {
    const first = advance(advance(createEpeeLifecycleState(), 0, open(), candidate()), 2_000, open(), candidate())
    const pending = advance(first, 40_000, candidate())
    expect(advance(pending, 40_001, candidate()).isLocked).toBe(false)
    expect(advance(pending, 42_000, candidate()).hits.map(({ side }) => side)).toEqual(["right", "left"])
  })

  it("rejects a contact starting outside the window even if it qualifies in the same sparse sample", () => {
    const initial = createEpeeLifecycleState()
    const sparse = {
      ...initial,
      left: { candidateSinceUs: 0, isRegistered: false },
      right: { candidateSinceUs: 40_001, isRegistered: false }
    }
    const result = advance(sparse, 42_001, candidate(), candidate())
    expect(result.hits.map(({ side }) => side)).toEqual(["left"])
    expect(result.isLocked).toBe(true)
  })
  it("orders hits by first contact when both sides qualify in one sample", () => {
    const state = advance(
      advance(advance(createEpeeLifecycleState(), 0, candidate()), 1, candidate(), candidate()),
      2_001,
      candidate(),
      candidate()
    )

    expect(state.hits).toEqual([
      { qualifiedAtUs: 2_001, side: "left", startedAtUs: 0 },
      { qualifiedAtUs: 2_001, side: "right", startedAtUs: 1 }
    ])
  })

  it("uses the first contact start time for its cutoff and waits for an in-window candidate", () => {
    const firstHit = advance(advance(createEpeeLifecycleState(), 0, candidate()), 2_000, candidate())
    const pendingAtDeadline = advance(firstHit, DOUBLE_HIT_WINDOW_US - 1, open(), candidate())
    const afterDeadline = advance(pendingAtDeadline, DOUBLE_HIT_WINDOW_US + 1, open(), candidate())
    const qualified = advance(afterDeadline, DOUBLE_HIT_WINDOW_US - 1 + CONTACT_MINIMUM_US, open(), candidate())

    expect(afterDeadline.isLocked).toBe(false)
    expect(qualified.hits.map(({ side }) => side)).toEqual(["left", "right"])
    expect(qualified.isLocked).toBe(true)
  })

  it("rejects timestamps that move backward", () => {
    const state = advance(createEpeeLifecycleState(), 1)

    expect(() => advance(state, 0)).toThrow(new RangeError("timestamps must be monotonic"))
  })
})
