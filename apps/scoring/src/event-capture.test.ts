import { describe, expect, it } from "vitest"
import {
  type CapturableDecisionOutcome,
  createEventCapture,
  DEFAULT_EVENT_CAPTURE_MAX_PENDING,
  DEFAULT_EVENT_CAPTURE_MAX_RECORDS,
  DEFAULT_EVENT_CAPTURE_POST_SAMPLES,
  DEFAULT_EVENT_CAPTURE_PRE_SAMPLES,
  MAX_EVENT_CAPTURE_PENDING,
  MAX_EVENT_CAPTURE_RECORDS,
  MAX_EVENT_CAPTURE_SAMPLES
} from "./event-capture.js"
import {
  advanceVirtualFrontEnd,
  createVirtualFrontEndState,
  type VirtualFrontEndSnapshot
} from "./virtual-front-end.js"
import type { VirtualStm32AuthoritativeOutcome } from "./virtual-stm32.js"

const provenance = {
  calibrationProfileRevision: "calibration-1",
  firmware: { buildDigest: `sha256:${"7a".repeat(32)}`, identity: "stm32-scoring", scoringBootId: "boot-008" },
  hardwareRevision: "evt-a",
  lineContractRevision: "lines-1",
  ruleSetRevision: "rules-1",
  timingTableRevision: "timing-1"
} as const

function snapshot(
  atUs: number,
  trust: "available" | "indeterminate" | "unavailable" = "available"
): VirtualFrontEndSnapshot {
  return advanceVirtualFrontEnd(createVirtualFrontEndState(), {
    atUs,
    phase:
      trust === "available"
        ? {
            excitation: { owner: "left.A", state: "active" },
            id: "epee-tip-loop",
            perspective: "affected-side",
            safeInactive: false,
            side: "left",
            status: trust
          }
        : {
            excitation: { owner: null, state: "inactive" },
            id: "epee-tip-loop",
            perspective: "affected-side",
            safeInactive: true,
            side: "left",
            status: trust
          },
    relations: []
  }).current!
}

function outcome(
  atUs: number,
  decision: CapturableDecisionOutcome = {
    disposition: "qualified-hit",
    hitStartedAtUs: atUs,
    qualifiedAtUs: atUs,
    side: "left",
    signal: { audible: "requested", latched: true, visual: "valid-hit" },
    weapon: "epee"
  }
): VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome> {
  return { atUs, outcome: decision, source: "weapon-scorer", timingTableRevision: "timing-1", weapon: "epee" }
}

describe("authoritative event capture", () => {
  it("preserves an STM32 decision with bounded immutable canonical pre and post evidence", () => {
    const capture = createEventCapture({
      maxPending: 2,
      maxRecords: 2,
      postSampleCount: 2,
      preSampleCount: 2,
      provenance,
      recordIdPrefix: "evt"
    })
    capture.observe({ sequence: 10, snapshot: snapshot(10) })
    capture.observe({ sequence: 11, snapshot: snapshot(11) })
    capture.capture(outcome(11))
    capture.observe({ sequence: 12, snapshot: snapshot(12, "indeterminate") })
    expect(capture.pendingCount).toBe(1)
    capture.observe({ sequence: 13, snapshot: snapshot(13, "unavailable") })

    expect(capture.pendingCount).toBe(0)
    expect(capture.records).toEqual([
      {
        decision: expect.objectContaining({
          captureWindow: { firstSequence: 10, fromUs: 10, lastSequence: 13, throughUs: 13 },
          decisionAtUs: 11,
          outcome: outcome(11).outcome,
          provenance,
          rawCaptureRefs: [],
          recordId: "evt-0"
        }),
        postSamples: [
          { sequence: 12, snapshot: snapshot(12, "indeterminate") },
          { sequence: 13, snapshot: snapshot(13, "unavailable") }
        ],
        preSamples: [
          { sequence: 10, snapshot: snapshot(10) },
          { sequence: 11, snapshot: snapshot(11) }
        ]
      }
    ])
    const record = capture.records[0]!
    expect(Object.isFrozen(record)).toBe(true)
    expect(Object.isFrozen(record.preSamples)).toBe(true)
    expect(Object.isFrozen(record.preSamples[0]!.snapshot)).toBe(true)
    expect(record.postSamples.map((sample) => sample.snapshot.trust)).toEqual(["indeterminate", "unavailable"])
    expect(record.decision.provenance.firmware.scoringBootId).toBe("boot-008")
  })

  it("does not classify outcomes, and preserves rejection, parry-like cancellation, whipover, late-hit, short, and line-fault reasons supplied by the scorer", () => {
    const decisions: readonly CapturableDecisionOutcome[] = [
      {
        attemptedAtUs: 1,
        attemptedSide: "left",
        disposition: "rejected-contact",
        reason: "candidate-cancelled-before-qualification",
        signal: { audible: "none", latched: false, visual: "none" },
        weapon: "epee"
      },
      {
        attemptedAtUs: 4,
        attemptedSide: "left",
        disposition: "rejected-contact",
        reason: "whipover-while-blade-contact",
        signal: { audible: "none", latched: false, visual: "none" },
        weapon: "epee"
      },
      {
        attemptedAtUs: 7,
        attemptedSide: "left",
        disposition: "rejected-contact",
        reason: "contact-inside-lockout",
        signal: { audible: "none", latched: false, visual: "none" },
        weapon: "epee"
      },
      {
        detectedAtUs: 10,
        diagnostic: "short-to-ground",
        disposition: "line-fault",
        lineId: "left.A",
        persistence: "latched-until-reset",
        side: "left",
        signal: { audible: "none", latched: true, visual: "diagnostic" }
      }
    ]
    const capture = createEventCapture({
      maxPending: 4,
      maxRecords: 4,
      postSampleCount: 1,
      preSampleCount: 1,
      provenance,
      recordIdPrefix: "classification"
    })
    for (const [index, decision] of decisions.entries()) {
      const atUs = index * 3 + 1
      capture.observe({ sequence: atUs, snapshot: snapshot(atUs) })
      capture.capture(outcome(atUs, decision))
      capture.observe({ sequence: atUs + 1, snapshot: snapshot(atUs + 1) })
    }
    expect(capture.records.map((record) => record.decision.outcome)).toEqual(decisions)
  })

  it("preserves explicitly unavailable uncertainty evidence without supplying a replacement decision", () => {
    const decision: CapturableDecisionOutcome = {
      disposition: "uncertainty",
      effect: "unavailable",
      lowerBound: 0,
      observedAtUs: 1,
      signal: { audible: "none", latched: false, visual: "diagnostic" },
      subject: "capture-completeness",
      unit: "none",
      upperBound: 0
    }
    const capture = createEventCapture({
      maxPending: 1,
      maxRecords: 1,
      postSampleCount: 1,
      preSampleCount: 1,
      provenance,
      recordIdPrefix: "uncertainty"
    })
    capture.observe({ sequence: 1, snapshot: snapshot(1, "unavailable") })
    capture.capture(outcome(1, decision))
    capture.observe({ sequence: 2, snapshot: snapshot(2, "unavailable") })
    expect(capture.records[0]!.decision.outcome).toEqual(decision)
  })

  it("completes overlapping captures in their FIFO decision order", () => {
    const capture = createEventCapture({
      maxPending: 2,
      maxRecords: 2,
      postSampleCount: 1,
      preSampleCount: 1,
      provenance,
      recordIdPrefix: "fifo"
    })
    capture.observe({ sequence: 1, snapshot: snapshot(1) })
    const firstDecision: CapturableDecisionOutcome = {
      attemptedAtUs: 1,
      attemptedSide: "left",
      disposition: "rejected-contact",
      reason: "candidate-cancelled-before-qualification",
      signal: { audible: "none", latched: false, visual: "none" },
      weapon: "epee"
    }
    const secondDecision: CapturableDecisionOutcome = {
      attemptedAtUs: 1,
      attemptedSide: "right",
      disposition: "rejected-contact",
      reason: "contact-inside-lockout",
      signal: { audible: "none", latched: false, visual: "none" },
      weapon: "epee"
    }
    capture.capture(outcome(1, firstDecision))
    capture.capture(outcome(1, secondDecision))
    capture.observe({ sequence: 2, snapshot: snapshot(2) })

    expect(capture.records.map((record) => record.decision.recordId)).toEqual(["fifo-0", "fifo-1"])
    expect(capture.records.map((record) => record.decision.outcome)).toEqual([firstDecision, secondDecision])
  })

  it("fails closed for absent or mismatched evidence, non-authoritative inputs, revision drift, and invalid limits", () => {
    expect(() => createEventCapture(null as never)).toThrow(new TypeError("Event capture options must be an object"))
    expect(createEventCapture({ provenance, recordIdPrefix: "x" }).records).toEqual([])
    expect(() => createEventCapture({ provenance, recordIdPrefix: "x", unknown: true } as never)).toThrow(
      new TypeError("Event capture options has unrecognized fields")
    )
    expect(() => createEventCapture({ provenance: null, recordIdPrefix: "x" } as never)).toThrow(
      new TypeError("Event capture provenance must be an M0-05 provenance object")
    )
    expect(() =>
      createEventCapture({
        provenance: { ...provenance, firmware: { ...provenance.firmware, buildDigest: "sha256:uppercase" } },
        recordIdPrefix: "x"
      })
    ).toThrow(
      new TypeError(
        "Event capture firmware build digests must be a sha256 digest with 64 lowercase hexadecimal characters"
      )
    )
    expect(() => createEventCapture({ provenance, recordIdPrefix: "x".repeat(121) })).toThrow(
      new RangeError("Event capture record ID prefixes must be a non-empty string no longer than 120 characters")
    )
    for (const [field, value] of [
      ["preSampleCount", 0],
      ["postSampleCount", MAX_EVENT_CAPTURE_SAMPLES + 1],
      ["maxPending", MAX_EVENT_CAPTURE_PENDING + 1],
      ["maxRecords", MAX_EVENT_CAPTURE_RECORDS + 1]
    ] as const) {
      expect(() =>
        createEventCapture({
          maxPending: 1,
          maxRecords: 1,
          postSampleCount: 1,
          preSampleCount: 1,
          provenance,
          recordIdPrefix: "x",
          [field]: value
        })
      ).toThrow()
    }
    const capture = createEventCapture({
      maxPending: 1,
      maxRecords: 1,
      postSampleCount: 1,
      preSampleCount: 1,
      provenance,
      recordIdPrefix: "x"
    })
    expect(() => capture.capture(outcome(0))).toThrow(
      new RangeError("Event capture requires current canonical evidence before an outcome")
    )
    expect(() => capture.observe(null as never)).toThrow(new TypeError("Event capture samples must be objects"))
    expect(() => capture.observe({ sequence: 0, snapshot: snapshot(0), extra: true } as never)).toThrow(
      new TypeError("Event capture samples has missing or unrecognized fields")
    )
    expect(() => capture.observe({ sequence: -1, snapshot: snapshot(0) } as never)).toThrow(
      new RangeError("Event capture sample sequences must be a non-negative safe integer")
    )
    capture.observe({ sequence: 1, snapshot: snapshot(1) })
    expect(() => capture.observe({ sequence: 1, snapshot: snapshot(2) })).toThrow(
      new RangeError("Event capture samples must use strictly increasing sequences")
    )
    expect(() => capture.observe({ sequence: 2, snapshot: snapshot(0) })).toThrow(
      new RangeError("Event capture samples must use monotonic timestamps")
    )
    expect(() => capture.capture({ ...outcome(1), source: "application" } as never)).toThrow(
      new TypeError("Event capture only accepts weapon-scorer outcomes")
    )
    expect(() =>
      capture.capture({
        ...outcome(1),
        outcome: {
          cause: "operator",
          disposition: "reset",
          resetAtUs: 1,
          scope: "stm32",
          signal: { audible: "none", latched: false, visual: "none" }
        }
      } as never)
    ).toThrow(new TypeError("Event capture defers reset and calibration lifecycle records to their owning layers"))
    expect(() =>
      capture.capture({
        ...outcome(1),
        outcome: {
          calibrationId: "fixture-1",
          disposition: "calibration",
          performedAtUs: 1,
          signal: { audible: "none", latched: false, visual: "diagnostic" },
          status: "passed"
        }
      } as never)
    ).toThrow(new TypeError("Event capture defers reset and calibration lifecycle records to their owning layers"))
    expect(() => capture.capture(null as never)).toThrow(
      new TypeError("Event capture outcomes must be STM32 authoritative outcomes")
    )
    expect(() => capture.capture({ ...outcome(1), weapon: "other" } as never)).toThrow(
      new TypeError("Event capture outcomes must identify an approved weapon")
    )
    expect(() => capture.capture({ ...outcome(1), timingTableRevision: "timing-2" } as never)).toThrow(
      new RangeError("Event capture outcomes must preserve the configured timing-table revision")
    )
    expect(() => capture.capture(outcome(2))).toThrow(
      new RangeError("Event capture outcomes must match the current canonical evidence timestamp")
    )
    expect(() =>
      capture.capture({ ...outcome(1), outcome: { ...outcome(1).outcome, weapon: "foil" } } as never)
    ).toThrow(new RangeError("Event capture outcomes must preserve the STM32-selected weapon"))
  })

  it("bounds pending and completed records deterministically", () => {
    expect(DEFAULT_EVENT_CAPTURE_PRE_SAMPLES).toBe(4)
    expect(DEFAULT_EVENT_CAPTURE_POST_SAMPLES).toBe(4)
    expect(DEFAULT_EVENT_CAPTURE_MAX_PENDING).toBe(32)
    expect(DEFAULT_EVENT_CAPTURE_MAX_RECORDS).toBe(64)
    const capture = createEventCapture({
      maxPending: 1,
      maxRecords: 1,
      postSampleCount: 1,
      preSampleCount: 1,
      provenance,
      recordIdPrefix: "bound"
    })
    capture.observe({ sequence: 1, snapshot: snapshot(1) })
    capture.capture(outcome(1))
    expect(() => capture.capture(outcome(1))).toThrow(new RangeError("Event capture pending limit of 1 reached"))
    capture.observe({ sequence: 2, snapshot: snapshot(2) })
    capture.capture(outcome(2))
    capture.observe({ sequence: 3, snapshot: snapshot(3) })
    expect(capture.records).toHaveLength(1)
    expect(capture.records[0]!.decision.recordId).toBe("bound-1")
  })
})
