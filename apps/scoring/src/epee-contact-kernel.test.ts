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
