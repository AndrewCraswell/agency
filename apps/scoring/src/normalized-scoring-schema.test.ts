import { describe, expect, it } from "vitest"
import {
  MAX_NORMALIZED_DECISIONS,
  NORMALIZED_SCORING_SCHEMA_VERSION,
  NORMALIZED_UINT_WIDTHS,
  NormalizedScoringSchemaError,
  parseNormalizedScoringInput,
  parseNormalizedScoringResult,
  parseNormalizedScoringState
} from "./normalized-scoring-schema.js"
import type { NormalizedResult } from "./normalized-scoring-schema.js"

const emptyDecision = (side: "left" | "right") => ({
  atUs: "0",
  audible: "no",
  disposition: "none",
  latched: "no",
  side,
  startedAtUs: "0",
  visual: "none"
})
const hitDecision = (side: "left" | "right") => ({
  atUs: "4",
  audible: "yes",
  disposition: "qualified-hit",
  latched: "yes",
  side,
  startedAtUs: "3",
  visual: "valid-hit"
})
const commonSample = () => ({
  atUs: "18446744073709551615",
  diagnostics: [{ code: "white", side: "left" }],
  faults: [{ code: "line-fault", side: "right" }],
  inputId: 0xffff_ffff,
  kind: "sample",
  schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION
})
const epeeMeasurement = () => ({ resistanceMilliOhms: "100000", resistanceUncertaintyMilliOhms: "100" })
const epeeSide = () => ({
  circuitComplete: "closed",
  contactResistance: epeeMeasurement(),
  groundPathResistance: epeeMeasurement(),
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
})
const foilSide = () => ({ circuitBreak: "open", insulation: "within-range", integrity: "intact", target: "target" })
const sabreSide = () => ({
  bcFault: "normal",
  blade: "present",
  externalPath: "eligible",
  ownEquipment: "absent",
  target: "target"
})
const sample = (weapon: "epee" | "foil" | "sabre") => ({
  ...commonSample(),
  left: weapon === "epee" ? epeeSide() : weapon === "foil" ? foilSide() : sabreSide(),
  right: weapon === "epee" ? epeeSide() : weapon === "foil" ? foilSide() : sabreSide(),
  weapon
})
const stateBase = () => ({
  availability: "available",
  diagnostics: [{ code: "grounded", side: "none" }],
  faults: [{ code: "acquisition-unavailable", side: "left" }],
  firstHitAtUs: "1",
  hasFirstHit: "yes",
  hasLastInput: "yes",
  lastInputAtUs: "2",
  lastInputId: 1,
  locked: "no",
  lockoutActive: "yes",
  lockoutEndsAtUs: "3",
  outputCapacity: 2,
  schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION
})
const sideState = () => ({ candidate: "pending", candidateSinceUs: "1", registered: "no" })
const state = (weapon: "epee" | "foil" | "sabre") => ({
  ...stateBase(),
  left:
    weapon === "epee"
      ? sideState()
      : weapon === "foil"
        ? { ...sideState(), candidateClassification: "on-target", insulation: "within-range", observation: "ready" }
        : {
            ...sideState(),
            bladeHistory: { interruptionCount: 1, lastBlade: "present", startedAtUs: "1", state: "active" },
            controlBreak: { sinceUs: "2", state: "active" },
            observation: "ready",
            white: "white-off",
            yellow: "yellow-off"
          },
  right:
    weapon === "epee"
      ? sideState()
      : weapon === "foil"
        ? {
            candidate: "none",
            candidateClassification: "none",
            candidateSinceUs: "0",
            insulation: "unavailable",
            observation: "unavailable",
            registered: "no"
          }
        : {
            ...sideState(),
            bladeHistory: { state: "none" },
            controlBreak: { state: "inactive" },
            observation: "non-conductive-surface",
            white: "unavailable",
            yellow: "unavailable"
          },
  weapon
})
const result = () => ({
  diagnostics: [{ code: "yellow", side: "right" }],
  errorCode: "none",
  faults: [],
  inputId: 7,
  left: hitDecision("left"),
  right: hitDecision("right"),
  schemaVersion: NORMALIZED_SCORING_SCHEMA_VERSION,
  state: "accepted"
})
const resultForState = (stateName: NormalizedResult["state"]) => {
  const blank = { left: emptyDecision("left"), right: emptyDecision("right") }
  if (stateName === "accepted") return result()
  if (stateName === "indeterminate")
    return {
      ...result(),
      ...blank,
      left: { ...emptyDecision("left"), atUs: "4", disposition: "indeterminate", startedAtUs: "3" },
      state: stateName
    }
  if (stateName === "unavailable")
    return {
      ...result(),
      ...blank,
      errorCode: "unavailable",
      faults: [{ code: "acquisition-unavailable", side: "none" }],
      right: { ...emptyDecision("right"), atUs: "4", disposition: "unavailable", startedAtUs: "3" },
      state: stateName
    }
  const errorCode =
    stateName === "capacity"
      ? "capacity"
      : stateName === "exhausted"
        ? "exhausted"
        : stateName === "fault"
          ? "fault"
          : stateName === "overflow"
            ? "overflow"
            : "none"
  return {
    ...result(),
    ...blank,
    errorCode,
    faults: stateName === "fault" ? [{ code: "state-fault", side: "none" }] : [],
    state: stateName
  }
}

describe("CW-03 normalized scoring schema", () => {
  it("losslessly normalizes each weapon's distinct input language", () => {
    const epee = parseNormalizedScoringInput(sample("epee"))
    const foil = parseNormalizedScoringInput(sample("foil"))
    const sabre = parseNormalizedScoringInput(sample("sabre"))
    if (epee.kind !== "sample" || foil.kind !== "sample" || sabre.kind !== "sample") throw new Error("sample expected")
    expect(epee.weapon === "epee" && epee.left).toEqual({
      circuitComplete: "closed",
      contactResistance: epeeMeasurement(),
      groundPathResistance: epeeMeasurement(),
      groundedMaterial: "not-grounded",
      lineIntegrity: "intact"
    })
    expect(foil.weapon === "foil" && foil.left).toMatchObject({
      circuitBreak: "open",
      insulation: "within-range",
      integrity: "intact",
      target: "target"
    })
    expect(sabre.weapon === "sabre" && sabre.left).toMatchObject({
      bcFault: "normal",
      blade: "present",
      externalPath: "eligible",
      ownEquipment: "absent",
      target: "target"
    })
  })

  it("covers every exact EpeeResistanceContact status and rejects partial measurements", () => {
    for (const circuitComplete of ["closed", "indeterminate", "open", "unavailable"] as const)
      expect(
        parseNormalizedScoringInput({ ...sample("epee"), left: { ...epeeSide(), circuitComplete } })
      ).toMatchObject({ left: { circuitComplete } })
    for (const groundedMaterial of ["grounded", "indeterminate", "not-grounded", "unavailable"] as const)
      expect(
        parseNormalizedScoringInput({ ...sample("epee"), left: { ...epeeSide(), groundedMaterial } })
      ).toMatchObject({ left: { groundedMaterial } })
    for (const lineIntegrity of ["cross-line", "indeterminate", "intact", "out-of-range", "unavailable"] as const)
      expect(parseNormalizedScoringInput({ ...sample("epee"), left: { ...epeeSide(), lineIntegrity } })).toMatchObject({
        left: { lineIntegrity }
      })
    expect(
      parseNormalizedScoringInput({
        ...sample("epee"),
        left: { ...epeeSide(), contactResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null } }
      })
    ).toMatchObject({
      left: { contactResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null } }
    })
    expect(() =>
      parseNormalizedScoringInput({
        ...sample("epee"),
        left: {
          ...epeeSide(),
          contactResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: "1" }
        }
      })
    ).toThrow(expect.objectContaining({ code: "value" }))
    expect(() =>
      parseNormalizedScoringInput({ ...sample("epee"), left: { ...epeeSide(), lineIntegrity: "broken" } })
    ).toThrow(expect.objectContaining({ code: "value" }))
  })

  it("keeps reset explicit and accepts every reason", () => {
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

  it("preserves weapon-specific persistent state needed for replay", () => {
    for (const weapon of ["epee", "foil", "sabre"] as const)
      expect(parseNormalizedScoringState(state(weapon)).weapon).toBe(weapon)
    const sabre = parseNormalizedScoringState(state("sabre"))
    expect(sabre.weapon === "sabre" && sabre.left).toMatchObject({
      bladeHistory: { interruptionCount: 1, lastBlade: "present", startedAtUs: "1", state: "active" },
      controlBreak: { sinceUs: "2", state: "active" },
      white: "white-off",
      yellow: "yellow-off"
    })
  })

  it("requires explicit time-presence discriminators while permitting timestamp zero", () => {
    const zeroTime = {
      ...state("epee"),
      firstHitAtUs: "0",
      lastInputAtUs: "0",
      lockoutEndsAtUs: "0",
      left: { candidate: "pending", candidateSinceUs: "0", registered: "no" },
      right: { candidate: "none", candidateSinceUs: "0", registered: "yes" }
    }
    expect(parseNormalizedScoringState(zeroTime)).toMatchObject({ firstHitAtUs: "0", lastInputAtUs: "0" })
    const invalid = [
      { ...state("epee"), hasFirstHit: "no" },
      { ...state("epee"), hasLastInput: "no", lastInputAtUs: "0", lastInputId: 0 },
      { ...state("epee"), lockoutActive: "no" },
      { ...state("epee"), lockoutActive: "no", locked: "yes", lockoutEndsAtUs: "0" },
      { ...state("epee"), lastInputAtUs: "0" },
      { ...state("epee"), left: { candidate: "none", candidateSinceUs: "1", registered: "no" } },
      { ...state("epee"), left: { candidate: "pending", candidateSinceUs: "1", registered: "yes" } },
      { ...state("foil"), left: { ...state("foil").left, candidateClassification: "none" } },
      { ...state("sabre"), left: { ...state("sabre").left, controlBreak: { sinceUs: "3", state: "active" } } },
      {
        ...state("sabre"),
        left: {
          ...state("sabre").left,
          bladeHistory: { interruptionCount: 1, lastBlade: "present", startedAtUs: "3", state: "active" }
        }
      }
    ]
    for (const value of invalid)
      expect(() => parseNormalizedScoringState(value)).toThrow(expect.objectContaining({ code: "value" }))
  })

  it("covers every receipt state with fixed simultaneous decision slots and fault provenance", () => {
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
      expect(parsed.state).toBe(stateName)
    }
    expect(parseNormalizedScoringResult(result()).faults).toEqual([])
    expect(() => parseNormalizedScoringResult({ ...resultForState("fault"), left: hitDecision("left") })).toThrow(
      expect.objectContaining({ code: "value" })
    )
    expect(() => parseNormalizedScoringResult({ ...resultForState("fault"), faults: [] })).toThrow(
      expect.objectContaining({ code: "value" })
    )
    expect(() =>
      parseNormalizedScoringResult({ ...resultForState("unavailable"), faults: [{ code: "line-fault", side: "none" }] })
    ).toThrow(expect.objectContaining({ code: "value" }))
    expect(() => parseNormalizedScoringResult({ ...result(), faults: [{ code: "line-fault", side: "none" }] })).toThrow(
      expect.objectContaining({ code: "value" })
    )
  })

  it("preserves post-registration state after a candidate has cleared for every weapon", () => {
    for (const weapon of ["epee", "foil", "sabre"] as const) {
      const raw = state(weapon)
      const left =
        weapon === "foil"
          ? {
              ...raw.left,
              candidate: "none",
              candidateClassification: "none",
              candidateSinceUs: "0",
              registered: "yes"
            }
          : { ...raw.left, candidate: "none", candidateSinceUs: "0", registered: "yes" }
      const parsed = parseNormalizedScoringState({ ...raw, left })
      expect(parsed.left).toMatchObject({ candidate: "none", candidateSinceUs: "0", registered: "yes" })
    }
  })

  it("rejects missing fields, cross-weapon shapes, noncanonical u64, and invalid state unions", () => {
    expect(() => parseNormalizedScoringInput({ ...sample("epee"), atUs: "01" })).toThrow(
      expect.objectContaining({ code: "integer" })
    )
    expect(() => parseNormalizedScoringInput({ ...sample("foil"), left: epeeSide() })).toThrow(
      expect.objectContaining({ code: "fields" })
    )
    expect(() =>
      parseNormalizedScoringInput({ ...sample("sabre"), left: { ...sabreSide(), bcFault: "other" } })
    ).toThrow(expect.objectContaining({ code: "value" }))
    expect(() =>
      parseNormalizedScoringState({
        ...state("sabre"),
        left: { ...state("sabre").left, bladeHistory: { state: "none", startedAtUs: "1" } }
      })
    ).toThrow(expect.objectContaining({ code: "fields" }))
    expect(() => parseNormalizedScoringInput({ ...sample("epee"), inputId: 0x1_0000_0000 })).toThrow(
      expect.objectContaining({ code: "integer" })
    )
  })

  it("requires diagnostics and faults to be duplicate-free in canonical code then side order", () => {
    expect(() =>
      parseNormalizedScoringInput({
        ...sample("epee"),
        diagnostics: [
          { code: "yellow", side: "left" },
          { code: "white", side: "left" }
        ]
      })
    ).toThrow(expect.objectContaining({ code: "value" }))
    expect(() =>
      parseNormalizedScoringInput({
        ...sample("epee"),
        faults: [
          { code: "line-fault", side: "left" },
          { code: "line-fault", side: "left" }
        ]
      })
    ).toThrow(expect.objectContaining({ code: "value" }))
    const parsed = parseNormalizedScoringInput({
      ...sample("epee"),
      diagnostics: [
        { code: "control-break", side: "right" },
        { code: "white", side: "left" }
      ],
      faults: [
        { code: "clock-fault", side: "none" },
        { code: "line-fault", side: "left" }
      ]
    })
    if (parsed.kind !== "sample") throw new Error("sample expected")
    expect(parsed.diagnostics).toHaveLength(2)
  })

  it("rejects JavaScript-only graphs before any field read and returns detached deep-frozen data", () => {
    const accessor = sample("epee")
    Object.defineProperty(accessor, "inputId", { configurable: true, get: () => 1 })
    const hidden = sample("epee")
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: true })
    const symbolic = sample("epee")
    Reflect.set(symbolic, Symbol("hidden"), true)
    const alias = sample("epee")
    Reflect.set(alias, "right", alias.left)
    for (const value of [accessor, hidden, symbolic, alias])
      expect(() => parseNormalizedScoringInput(value)).toThrow(expect.objectContaining({ code: "value" }))
    const parsed = parseNormalizedScoringInput(sample("epee"))
    expect(Object.isFrozen(parsed)).toBe(true)
    if (parsed.kind === "sample") expect(Object.isFrozen(parsed.left)).toBe(true)
  })

  it("publishes the fixed-width contract", () => {
    expect(NORMALIZED_UINT_WIDTHS).toEqual({ u16: 65535, u32: 4294967295, u64: "18446744073709551615", u8: 255 })
    expect(MAX_NORMALIZED_DECISIONS).toBe(2)
    expect(Object.isFrozen(NORMALIZED_UINT_WIDTHS)).toBe(true)
    expect(NormalizedScoringSchemaError).toBeTypeOf("function")
  })
})

describe("normalized data boundary failures", () => {
  it("rejects cycles, shared objects, exotic prototypes and non-data properties", () => {
    const cycle = sample("epee")
    Object.assign(cycle, { left: cycle })
    const shared = sample("epee")
    shared.right = shared.left
    const hidden = sample("epee")
    Object.defineProperty(hidden, "kind", { enumerable: false })
    const symbol = sample("epee")
    Object.defineProperty(symbol, Symbol("extra"), { value: 1 })
    for (const value of [cycle, shared, hidden, symbol, null, { ...sample("epee"), left: new Date() }]) {
      expect(() => parseNormalizedScoringInput(value)).toThrow(NormalizedScoringSchemaError)
    }
  })

  it("rejects unsupported schema, kinds, widths, lists and weapon identifiers", () => {
    for (const override of [
      { schemaVersion: 2 },
      { kind: "other" },
      { atUs: "18446744073709551616" },
      { diagnostics: Array.from({ length: 9 }, () => ({ code: "white", side: "left" })) },
      { weapon: "other" }
    ]) {
      expect(() => parseNormalizedScoringInput({ ...sample("epee"), ...override })).toThrow(
        NormalizedScoringSchemaError
      )
    }
    expect(() => parseNormalizedScoringState({ ...state("epee"), weapon: "other" })).toThrow(
      NormalizedScoringSchemaError
    )
  })

  it("enforces decision side, signals, timestamps and result consistency", () => {
    for (const override of [
      { side: "right" },
      { audible: "no" },
      { latched: "no" },
      { visual: "none" },
      { atUs: "1", startedAtUs: "20" },
      { atUs: "1", startedAtUs: "2" },
      { ...emptyDecision("left"), atUs: "1" },
      { disposition: "off-target", visual: "off-target", audible: "yes" },
      { disposition: "off-target", visual: "none", audible: "no" },
      { disposition: "off-target", visual: "off-target", audible: "no", latched: "no" },
      { disposition: "indeterminate" }
    ]) {
      expect(() =>
        parseNormalizedScoringResult({ ...result(), left: { ...hitDecision("left"), ...override } })
      ).toThrow(NormalizedScoringSchemaError)
    }
    expect(
      parseNormalizedScoringResult({
        ...result(),
        left: { ...hitDecision("left"), disposition: "off-target", visual: "off-target", audible: "no" }
      }).left.disposition
    ).toBe("off-target")
    expect(() => parseNormalizedScoringResult({ ...result(), errorCode: "fault" })).toThrow(
      NormalizedScoringSchemaError
    )
  })

  it("rejects inconsistent candidate, first-hit and last-input state", () => {
    for (const override of [
      { hasLastInput: "no" },
      { hasFirstHit: "no" },
      { left: { ...sideState(), registered: "yes" } },
      { left: { ...sideState(), candidateSinceUs: "99" } },
      { left: { ...sideState(), candidate: "none", candidateSinceUs: "1" } }
    ]) {
      expect(() => parseNormalizedScoringState({ ...state("epee"), ...override })).toThrow(NormalizedScoringSchemaError)
    }
    const foil = state("foil")
    expect(() =>
      parseNormalizedScoringState({ ...foil, left: { ...foil.left, candidateClassification: "none" } })
    ).toThrow(NormalizedScoringSchemaError)
    expect(() =>
      parseNormalizedScoringState({ ...state("epee"), hasLastInput: "no", lastInputAtUs: "0", lastInputId: 0 })
    ).toThrow(NormalizedScoringSchemaError)
  })
})

it("rejects malformed array descriptors and inconsistent empty scoring history", () => {
  const sparse = sample("epee")
  delete sparse.diagnostics[0]
  const hidden = sample("epee")
  Object.defineProperty(hidden.diagnostics, "0", { enumerable: false })
  const wrongLength = sample("epee")
  wrongLength.diagnostics = new Proxy(wrongLength.diagnostics, {
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
      return key === "length" ? { ...descriptor, value: 99 } : descriptor
    }
  })
  for (const value of [sparse, hidden, wrongLength])
    expect(() => parseNormalizedScoringInput(value)).toThrow(NormalizedScoringSchemaError)
  const empty = {
    ...state("epee"),
    hasFirstHit: "no",
    firstHitAtUs: "0",
    lockoutActive: "no",
    lockoutEndsAtUs: "0",
    locked: "no"
  }
  expect(() => parseNormalizedScoringState(empty)).not.toThrow()
  for (const changes of [{ lockoutEndsAtUs: "1" }, { locked: "yes" }, { lockoutActive: "yes" }]) {
    expect(() => parseNormalizedScoringState({ ...empty, ...changes })).toThrow(NormalizedScoringSchemaError)
  }
  expect(() => parseNormalizedScoringState({ ...state("epee"), firstHitAtUs: "2", lockoutEndsAtUs: "1" })).toThrow(
    NormalizedScoringSchemaError
  )
})
