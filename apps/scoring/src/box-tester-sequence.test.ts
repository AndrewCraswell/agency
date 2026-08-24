import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  BOX_TESTER_SEQUENCE_FORMAT,
  MAX_BOX_TESTER_SEQUENCE_EXPECTATIONS,
  compileBoxTesterSequence
} from "./box-tester-sequence.js"
import type { BoxTesterStimulusStep } from "./box-tester-sequence.js"

function canonicalScenario(): unknown {
  return JSON.parse(
    readFileSync(new URL("../docs/golden-scenarios/epee-contact-boundaries.json", import.meta.url), "utf8")
  )
}

describe("BT-04 box tester sequence compiler", () => {
  it("compiles canonical inputs and authored expectations without reordering either", () => {
    const sequence = compileBoxTesterSequence(canonicalScenario())

    expect(sequence).toMatchObject({
      format: BOX_TESTER_SEQUENCE_FORMAT,
      scenarioId: "epee.contact-boundaries",
      weapon: "epee"
    })
    expect(sequence.stimulus.map((step) => step.inputId)).toEqual([
      "right-start",
      "left-short-start",
      "left-short-break",
      "right-at-two-ms"
    ])
    expect(sequence.expectations.map((step) => step.expectationId)).toEqual(["right-hit", "left-short-contact-no-hit"])
    expect(sequence.stimulus[1]?.lines[0]).toMatchObject({ line: "left.weapon-circuit", state: "closed" })
  })

  it("returns a deeply immutable plan detached from the source scenario", () => {
    const source = canonicalScenario() as { inputs: Array<{ lines: Array<{ state: string }> }> }
    const sequence = compileBoxTesterSequence(source)
    source.inputs[0]!.lines[0]!.state = "shorted"

    expect(sequence.stimulus[0]?.lines[0]?.state).toBe("open")
    expect(Object.isFrozen(sequence)).toBe(true)
    expect(Object.isFrozen(sequence.stimulus)).toBe(true)
    expect(Object.isFrozen(sequence.stimulus[0]?.lines)).toBe(true)
    expect(() => (sequence.stimulus as BoxTesterStimulusStep[]).push(sequence.stimulus[0]!)).toThrow(TypeError)
  })

  it("rejects rejected, malformed, unknown, unsafe-integer, and non-monotonic inputs", () => {
    const rejected = canonicalScenario() as { expect: { error?: unknown; status: string } }
    rejected.expect.status = "rejected"
    rejected.expect.error = { code: "non-monotonic-time" }
    expect(() => compileBoxTesterSequence(rejected)).toThrow("rejected scenarios")

    const unknownState = canonicalScenario() as { inputs: Array<{ lines: Array<{ state: string }> }> }
    unknownState.inputs[0]!.lines[0]!.state = "energized"
    expect(() => compileBoxTesterSequence(unknownState)).toThrow("state is unsupported")

    const unsafeInteger = canonicalScenario() as { inputs: Array<{ atUs: number }> }
    unsafeInteger.inputs[0]!.atUs = Number.MAX_SAFE_INTEGER + 1
    expect(() => compileBoxTesterSequence(unsafeInteger)).toThrow("safe integer")

    const nonMonotonic = canonicalScenario() as { inputs: Array<{ atUs: number }> }
    nonMonotonic.inputs[2]!.atUs = 0
    expect(() => compileBoxTesterSequence(nonMonotonic)).toThrow("non-monotonic")

    const malformed = canonicalScenario() as { expect: { unexpected?: string } }
    malformed.expect.unexpected = "nope"
    expect(() => compileBoxTesterSequence(malformed)).toThrow("unsupported")
  })

  it("fails closed for an unsafe expectation and capacity overflow", () => {
    const unknownInput = canonicalScenario() as { expect: { decisions: Array<{ sourceInputIds: string[] }> } }
    unknownInput.expect.decisions[0]!.sourceInputIds = ["missing"]
    expect(() => compileBoxTesterSequence(unknownInput)).toThrow("unknown or duplicated")

    const oversized = canonicalScenario() as { expect: { uncertainty: unknown[] } }
    oversized.expect.uncertainty = Array.from({ length: MAX_BOX_TESTER_SEQUENCE_EXPECTATIONS + 1 }, (_, index) => ({
      id: `u-${index}`,
      atUs: 0,
      scope: "tester",
      outcome: "diagnostic",
      assertionReasonCode: "capacity"
    }))
    expect(() => compileBoxTesterSequence(oversized)).toThrow("capacity")
  })

  it("preserves post-stimulus expected evidence while the tester holds the final state", () => {
    const source = canonicalScenario() as {
      expect: {
        decisions: Array<Record<string, unknown>>
        nonEvents: Array<Record<string, unknown>>
      }
      inputs: Array<{ atUs: number }>
    }
    source.inputs.forEach((input, index) => {
      input.atUs = index * 250 + 250
    })
    source.expect.decisions[0] = {
      decisionAtUs: 2_000,
      disposition: "score",
      id: "post-stimulus-decision",
      sourceInputIds: ["right-at-two-ms"]
    }
    source.expect.nonEvents[0] = {
      assertion: "no-decision",
      assertionReasonCode: "hold-final-state",
      id: "post-stimulus-no-decision",
      window: { fromUs: 1_500, throughUs: 3_000 }
    }

    const sequence = compileBoxTesterSequence(source)

    expect(sequence.expectations.map((step) => step.expectationId)).toEqual([
      "post-stimulus-decision",
      "post-stimulus-no-decision"
    ])
    expect(sequence.expectations[0]).toMatchObject({ atUs: 2_000, kind: "expect-decision" })
    expect(sequence.expectations[1]).toMatchObject({
      kind: "expect-no-decision",
      window: { fromUs: 1_500, throughUs: 3_000 }
    })
  })

  it("does not need the scorer or any copied timing value to compile every active accepted scenario", () => {
    const manifestDirectory = fileURLToPath(new URL("../docs/golden-scenarios/", import.meta.url))
    const manifest = JSON.parse(
      readFileSync(new URL("../docs/golden-scenario-manifest.json", import.meta.url), "utf8")
    ) as {
      scenarios: Array<{ path: string; status: "active" | "planned" }>
    }
    for (const entry of manifest.scenarios.filter(({ status }) => status === "active")) {
      const fileName = entry.path.split("/").at(-1)
      expect(fileName).toBeDefined()
      const scenario = JSON.parse(readFileSync(join(manifestDirectory, fileName!), "utf8")) as {
        expect: { status: "accepted" | "rejected" }
      }
      if (scenario.expect.status === "accepted") expect(compileBoxTesterSequence(scenario).stimulus).not.toHaveLength(0)
      else expect(() => compileBoxTesterSequence(scenario)).toThrow(RangeError)
    }
  })
})
