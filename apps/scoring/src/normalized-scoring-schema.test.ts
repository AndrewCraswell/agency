import { describe, expect, it } from "vitest"
import {
  MAX_NORMALIZED_DIAGNOSTICS,
  MAX_NORMALIZED_DECISIONS,
  MAX_NORMALIZED_FAULTS,
  NORMALIZED_SCORING_SCHEMA_VERSION,
  NORMALIZED_UINT_WIDTHS,
  NormalizedScoringSchemaError,
  parseNormalizedScoringInput,
  parseNormalizedScoringResult,
  parseNormalizedScoringState
} from "./normalized-scoring-schema.js"
import type { NormalizedResult } from "./normalized-scoring-schema.js"

function signals() {
  return { control: "inactive", point: "active", target: "active", weapon: "active" }
}

function sample(weapon: "epee" | "foil" | "sabre" = "epee") {
  return {
    atUs: "18446744073709551615",
    diagnostics: [{ code: "white", side: "left" }],
    faults: [{ code: "line-fault", side: "right" }],
    inputId: 0xffff_ffff,
    kind: "sample",
    left: { signals: signals() },
    right: {
      signals: { control: "indeterminate", point: "unavailable", target: "not-applicable", weapon: "inactive" }
    },
    schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION,
    weapon
  }
}

function decision(side: "left" | "right") {
  return {
    atUs: "4",
    audible: "yes",
    disposition: "qualified-hit",
    latched: "yes",
    side,
    startedAtUs: "3",
    visual: "valid-hit"
  }
}

function emptyDecision(side: "left" | "right") {
  return {
    atUs: "0",
    audible: "no",
    disposition: "none",
    latched: "no",
    side,
    startedAtUs: "0",
    visual: "none"
  }
}

function state() {
  return {
    availability: "available",
    diagnostics: [{ code: "grounded", side: "none" }],
    faults: [{ code: "acquisition-unavailable", side: "left" }],
    lastInputAtUs: "1",
    lastInputId: 0,
    left: { candidate: "pending", candidateSinceUs: "1", registered: "no" },
    lockoutEndsAtUs: "2",
    outputCapacity: 2,
    right: { candidate: "qualified", candidateSinceUs: "1", registered: "yes" },
    schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION,
    weapon: "foil"
  }
}

function result() {
  return {
    diagnostics: [{ code: "yellow", side: "right" }],
    errorCode: "none",
    inputId: 7,
    left: decision("left"),
    right: decision("right"),
    schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION,
    state: "accepted"
  }
}

function resultForState(state: NormalizedResult["state"]) {
  const blank = { left: emptyDecision("left"), right: emptyDecision("right") }
  switch (state) {
    case "accepted":
      return result()
    case "capacity":
      return { ...result(), ...blank, errorCode: "capacity", state }
    case "exhausted":
      return { ...result(), ...blank, errorCode: "exhausted", state }
    case "fault":
      return { ...result(), ...blank, errorCode: "fault", state }
    case "indeterminate":
      return {
        ...result(),
        ...blank,
        errorCode: "none",
        left: { ...emptyDecision("left"), atUs: "4", disposition: "indeterminate", startedAtUs: "3" },
        state
      }
    case "overflow":
      return { ...result(), ...blank, errorCode: "overflow", state }
    case "reset":
      return { ...result(), ...blank, errorCode: "none", state }
    case "unavailable":
      return {
        ...result(),
        ...blank,
        errorCode: "unavailable",
        right: { ...emptyDecision("right"), atUs: "4", disposition: "unavailable", startedAtUs: "3" },
        state
      }
  }
}

describe("CW-03 normalized scoring schema", () => {
  it("normalizes all weapons and a simultaneous two-side sample without applying scoring", () => {
    for (const weapon of ["epee", "foil", "sabre"] as const) {
      const raw = sample(weapon)
      const parsed = parseNormalizedScoringInput(raw)
      expect(parsed).toEqual(raw)
      expect(parsed).not.toBe(raw)
    }

    const parsed = parseNormalizedScoringInput(sample("sabre"))
    expect(parsed.kind).toBe("sample")
    if (parsed.kind === "sample") {
      expect(parsed.left.signals.point).toBe("active")
      expect(parsed.right.signals.point).toBe("unavailable")
      expect(parsed.atUs).toBe("18446744073709551615")
    }
  })

  it("keeps reset explicit and accepts every reset reason", () => {
    for (const resetReason of ["bout", "recovery", "weapon-change"] as const) {
      expect(
        parseNormalizedScoringInput({
          atUs: "0",
          inputId: 1,
          kind: "reset",
          resetReason,
          schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION,
          weapon: "sabre"
        })
      ).toMatchObject({ kind: "reset", resetReason })
    }
  })

  it("parses bounded state, explicit unavailable or indeterminate status, and every coherent result state", () => {
    expect(parseNormalizedScoringState(state())).toEqual(state())
    for (const availability of ["indeterminate", "unavailable"] as const) {
      expect(parseNormalizedScoringState({ ...state(), availability }).availability).toBe(availability)
    }

    for (const stateName of [
      "accepted",
      "capacity",
      "exhausted",
      "fault",
      "indeterminate",
      "overflow",
      "reset",
      "unavailable"
    ] as const) {
      const parsed = parseNormalizedScoringResult(resultForState(stateName))
      expect([parsed.state, parsed.errorCode]).toEqual([stateName, resultForState(stateName).errorCode])
    }
  })

  it("preserves two fixed decision slots and rejects contradictory result receipts", () => {
    expect(parseNormalizedScoringResult(result())).toEqual(result())
    const invalid = [
      { ...result(), errorCode: "fault" },
      { ...resultForState("fault"), left: decision("left") },
      { ...result(), left: { ...decision("left"), visual: "none" } },
      { ...result(), left: decision("right") }
    ]
    for (const receipt of invalid) {
      expect(() => parseNormalizedScoringResult(receipt)).toThrow(expect.objectContaining({ code: "value" }))
    }
  })

  it("rejects omitted, extra, unbounded, and JavaScript-only values", () => {
    const invalid: readonly [unknown, NormalizedScoringSchemaError["code"]][] = [
      [null, "value"],
      [{ ...sample(), schemaVersion: 2 }, "schema-version"],
      [{ ...sample(), kind: "other" }, "kind"],
      [{ ...sample(), inputId: Number.NaN }, "integer"],
      [{ ...sample(), inputId: Number.POSITIVE_INFINITY }, "integer"],
      [{ ...sample(), inputId: -1 }, "integer"],
      [{ ...sample(), inputId: 0x1_0000_0000 }, "integer"],
      [{ ...sample(), atUs: "01" }, "integer"],
      [{ ...sample(), atUs: "18446744073709551616" }, "integer"],
      [{ ...sample(), atUs: 1n }, "value"],
      [
        {
          ...sample(),
          diagnostics: Array.from({ length: MAX_NORMALIZED_DIAGNOSTICS + 1 }, () => ({ code: "white", side: "left" }))
        },
        "bounds"
      ],
      [
        {
          ...sample(),
          faults: Array.from({ length: MAX_NORMALIZED_FAULTS + 1 }, () => ({ code: "line-fault", side: "left" }))
        },
        "bounds"
      ],
      [{ ...sample(), unexpected: "yes" }, "fields"],
      [{ ...sample(), left: { signals: { ...signals(), point: undefined } } }, "value"]
    ]

    for (const [value, code] of invalid) {
      expect(() => parseNormalizedScoringInput(value)).toThrow(expect.objectContaining({ code }))
    }
  })

  it("uses the declared fixed-width limits", () => {
    expect(NORMALIZED_UINT_WIDTHS).toEqual({ u8: 255, u16: 65535, u32: 4294967295, u64: "18446744073709551615" })
    expect(Object.isFrozen(NORMALIZED_UINT_WIDTHS)).toBe(true)
    expect(MAX_NORMALIZED_DECISIONS).toBe(2)
  })

  it("rejects getter, hidden, sparse, subclass, aliased, cyclic, and symbolic data before any read", () => {
    const accessor = sample()
    Object.defineProperty(accessor, "inputId", { configurable: true, get: () => 1 })
    const hidden = sample()
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: true })
    const symbolic = sample()
    Reflect.set(symbolic, Symbol("hidden"), true)
    const sparse = sample()
    const sparseDiagnostics: unknown[] = []
    sparseDiagnostics.length = 1
    Reflect.set(sparse, "diagnostics", sparseDiagnostics)
    class DiagnosticList extends Array<unknown> {}
    const subclass = sample()
    Reflect.set(subclass, "diagnostics", new DiagnosticList())
    const alias = sample()
    Reflect.set(alias.right, "signals", alias.left.signals)
    const cycle = sample()
    Reflect.set(cycle.left.signals, "loop", cycle)

    for (const value of [accessor, hidden, symbolic, sparse, subclass, alias, cycle]) {
      expect(() => parseNormalizedScoringInput(value)).toThrow(expect.objectContaining({ code: "value" }))
    }
  })

  it("returns detached deeply frozen parsed graphs", () => {
    const input = parseNormalizedScoringInput(sample())
    const parsedState = parseNormalizedScoringState(state())
    const parsedResult = parseNormalizedScoringResult(result())
    expect(Object.isFrozen(input)).toBe(true)
    if (input.kind === "sample") {
      expect(Object.isFrozen(input.diagnostics)).toBe(true)
      expect(Object.isFrozen(input.left.signals)).toBe(true)
    }
    expect(Object.isFrozen(parsedState.left)).toBe(true)
    expect(Object.isFrozen(parsedResult.right)).toBe(true)
    expect(Object.isFrozen(parsedResult.diagnostics)).toBe(true)
  })
})
