import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { compileBoxTesterSequence } from "./box-tester-sequence.js"
import {
  BOX_TESTER_VIRTUAL_TIMELINE_FORMAT,
  createInfrastructureErrorVirtualTesterTimeline,
  createSkippedVirtualTesterTimeline,
  createVirtualTesterTimeline,
  type VirtualTesterActualResult
} from "./box-tester-virtual-timeline.js"

function sequence() {
  return compileBoxTesterSequence(
    JSON.parse(readFileSync(new URL("../docs/golden-scenarios/epee-contact-boundaries.json", import.meta.url), "utf8"))
  )
}

function result(overrides: Partial<VirtualTesterActualResult> = {}): VirtualTesterActualResult {
  return {
    actualStatus: "accepted",
    decisions: [{ decisionAtUs: 2_000, disposition: "qualified-hit", side: "right" }],
    error: null,
    mismatches: [],
    scenarioId: "epee.contact-boundaries",
    status: "passed",
    uncertainty: [],
    ...overrides
  }
}

describe("BT-05 virtual tester timeline", () => {
  it("aligns commands, virtual measurements, authored evidence, actual outputs, and a pass evaluation", () => {
    const timeline = createVirtualTesterTimeline(sequence(), result())

    expect(timeline).toMatchObject({
      format: BOX_TESTER_VIRTUAL_TIMELINE_FORMAT,
      outcome: "passed",
      scenarioId: "epee.contact-boundaries"
    })
    expect(timeline.timeline.map(({ lane }) => lane)).toEqual([
      "command",
      "measurement",
      "command",
      "measurement",
      "command",
      "measurement",
      "expected",
      "command",
      "measurement",
      "expected",
      "actual-output",
      "evaluation"
    ])
    expect(timeline.timeline.map(({ atUs }) => atUs)).toEqual(
      timeline.timeline.map(({ atUs }) => atUs).sort((a, b) => a - b)
    )
    expect(timeline.timeline.find(({ lane }) => lane === "measurement")).toMatchObject({
      value: { observation: "virtual-command-mirror" }
    })
    expect(timeline.timeline.at(-1)).toMatchObject({
      atUs: 2_000,
      label: "Virtual evaluation passed",
      lane: "evaluation"
    })
  })

  it("preserves a host comparison mismatch as a DUT failure without treating it as infrastructure", () => {
    const timeline = createVirtualTesterTimeline(
      sequence(),
      result({ mismatches: [{ kind: "decision" }], status: "failed" })
    )

    expect(timeline.outcome).toBe("failed")
    expect(timeline.timeline.at(-1)).toMatchObject({
      label: "Virtual evaluation failed",
      value: { mismatches: [{ kind: "decision" }], status: "failed" }
    })
  })

  it("retains emitted classifications and diagnostics as actual outputs without assigning them scoring authority", () => {
    const timeline = createVirtualTesterTimeline(
      sequence(),
      result({
        classifications: [{ atUs: 1, kind: "target" }],
        diagnostics: [{ atUs: 1, indication: "yellow-on", side: "left" }]
      })
    )

    expect(timeline.timeline.filter(({ lane }) => lane === "actual-output").map(({ label }) => label)).toEqual([
      "Actual host classification: target",
      "Actual host diagnostic: yellow-on",
      "Actual host output: qualified-hit"
    ])
  })

  it("is indeterminate when authoritative output cannot safely pair with the authored sequence", () => {
    const unavailable = createVirtualTesterTimeline(
      sequence(),
      result({ actualStatus: "rejected", error: { code: "invalid-line-state" } })
    )
    const mismatchedIdentity = createVirtualTesterTimeline(sequence(), result({ scenarioId: "foil.other" }))

    expect(unavailable.outcome).toBe("indeterminate")
    expect(unavailable.timeline.at(-1)).toMatchObject({ value: { reason: "authoritative-output-unavailable" } })
    expect(mismatchedIdentity.outcome).toBe("indeterminate")
    expect(mismatchedIdentity.timeline.at(-1)).toMatchObject({ value: { reason: "scenario-identity-mismatch" } })
  })

  it("keeps skipped and infrastructure-error outcomes separate from DUT results", () => {
    const skipped = createSkippedVirtualTesterTimeline("planned.requirement", "scenario-not-executable")
    const infrastructure = createInfrastructureErrorVirtualTesterTimeline(
      "epee.contact-boundaries",
      "runner-unavailable"
    )

    expect(skipped).toMatchObject({ outcome: "skipped", timeline: [{ atUs: 0, lane: "evaluation" }] })
    expect(infrastructure).toMatchObject({
      outcome: "infrastructure-error",
      timeline: [{ atUs: 0, lane: "evaluation" }]
    })
  })

  it("returns detached immutable evidence and rejects unsafe timestamps", () => {
    const actual = result() as unknown as {
      decisions: Array<{ decisionAtUs: number; disposition: string; side?: "left" | "right" }>
    } & VirtualTesterActualResult
    const timeline = createVirtualTesterTimeline(sequence(), actual)
    actual.decisions[0]!.disposition = "mutated"

    expect(timeline.timeline.find(({ lane }) => lane === "actual-output")?.value).toMatchObject({
      disposition: "qualified-hit"
    })
    expect(Object.isFrozen(timeline)).toBe(true)
    expect(Object.isFrozen(timeline.timeline)).toBe(true)
    expect(Object.isFrozen(timeline.timeline[0])).toBe(true)
    expect(() =>
      createVirtualTesterTimeline(sequence(), result({ decisions: [{ decisionAtUs: -1, disposition: "bad" }] }))
    ).toThrow("safe integer")
  })
})
