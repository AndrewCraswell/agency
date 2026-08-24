import { describe, expect, it } from "vitest"
import {
  SCORING_GLOSSARY,
  SCORING_GLOSSARY_TERMS,
  SCORING_GLOSSARY_UNITS,
  assertIntegerMicroseconds,
  isIntegerMicroseconds,
  resolveScoringGlossaryTerm,
  validateGlossaryMeasurement,
  validateScoringGlossary,
  validateScoringQuantity
} from "./scoring-glossary-and-units.js"

function mutableGlossary(): {
  revision: string
  terms: Array<Record<string, unknown>>
  units: Array<Record<string, unknown>>
} {
  return {
    revision: SCORING_GLOSSARY.revision,
    terms: SCORING_GLOSSARY.terms.map((term) => ({ ...term, aliases: [...term.aliases] })),
    units: SCORING_GLOSSARY.units.map((unit) => ({ ...unit }))
  }
}

function expectImmutable(value: unknown): void {
  expect(Object.isFrozen(value)).toBe(true)
  if (typeof value === "object" && value !== null) {
    for (const nestedValue of Object.values(value)) {
      expectImmutable(nestedValue)
    }
  }
}

describe("M0-02 scoring glossary and units", () => {
  it("publishes exact side, line, state, and quantity names", () => {
    expect(SCORING_GLOSSARY_TERMS.map((term) => term.canonical)).toEqual(
      expect.arrayContaining([
        "left",
        "right",
        "left.A",
        "left.B",
        "left.C",
        "right.A",
        "right.B",
        "right.C",
        "piste",
        "open",
        "closed",
        "grounded",
        "crossLine",
        "outOfRange",
        "indeterminate",
        "unavailable",
        "safeInactive",
        "atUs",
        "resistanceMilliOhms"
      ])
    )
    expect(SCORING_GLOSSARY_TERMS.some((term) => term.canonical === "A")).toBe(false)
    expect(SCORING_GLOSSARY_TERMS.some((term) => term.canonical === "saber")).toBe(false)
  })

  it("is deeply immutable and exposes only integer machine units", () => {
    expectImmutable(SCORING_GLOSSARY)
    expectImmutable(SCORING_GLOSSARY_UNITS)
    expect(SCORING_GLOSSARY_UNITS.map((unit) => unit.code)).toEqual(
      expect.arrayContaining(["us", "milliOhm", "milliVolt", "microAmp", "nanoFarad", "milliWatt"])
    )
    expect(() => validateGlossaryMeasurement({ unit: "us", value: 1.5 })).toThrow(/integer safe number/iu)
    expect(() => validateGlossaryMeasurement({ unit: "none", value: 0 })).toThrow(/unknown scoring glossary unit/iu)
    expect(() => validateGlossaryMeasurement({ unit: "millisecond", value: 1 })).toThrow(
      /unknown scoring glossary unit/iu
    )
    expect(validateGlossaryMeasurement({ unit: "milliOhm", value: 200_000 })).toEqual({
      unit: "milliOhm",
      value: 200_000
    })
  })

  it("rejects duplicate canonical names and duplicate units", () => {
    const duplicateTerm = mutableGlossary()
    duplicateTerm.terms.push({ ...duplicateTerm.terms[0] })
    expect(() => validateScoringGlossary(duplicateTerm)).toThrow(/duplicate glossary canonical name/iu)

    const duplicateUnit = mutableGlossary()
    duplicateUnit.units.push({ ...duplicateUnit.units[0] })
    expect(() => validateScoringGlossary(duplicateUnit)).toThrow(/duplicate glossary unit/iu)
  })

  it("rejects unknown unit references and unsupported unit definitions", () => {
    const unknownReference = mutableGlossary()
    const quantity = unknownReference.terms.find((term) => term.canonical === "atUs")
    expect(quantity).toBeDefined()
    if (quantity === undefined) {
      throw new Error("test fixture did not include atUs")
    }
    quantity.unit = "milliseconds"
    expect(() => validateScoringGlossary(unknownReference)).toThrow(/unknown glossary unit reference/iu)

    const unknownDefinition = mutableGlossary()
    unknownDefinition.units.push({
      ...unknownDefinition.units[0],
      code: "millisecond"
    })
    expect(() => validateScoringGlossary(unknownDefinition)).toThrow(/unknown glossary unit code/iu)
  })

  it("rejects aliases that collide with canonical names or another alias", () => {
    const canonicalCollision = mutableGlossary()
    const right = canonicalCollision.terms.find((term) => term.canonical === "right")
    expect(right).toBeDefined()
    if (right === undefined) {
      throw new Error("test fixture did not include right")
    }
    right.aliases = ["left"]
    expect(() => validateScoringGlossary(canonicalCollision)).toThrow(/ambiguous glossary alias/iu)

    const aliasCollision = mutableGlossary()
    const left = aliasCollision.terms.find((term) => term.canonical === "left")
    const rightTerm = aliasCollision.terms.find((term) => term.canonical === "right")
    expect(left).toBeDefined()
    expect(rightTerm).toBeDefined()
    if (left === undefined || rightTerm === undefined) {
      throw new Error("test fixture did not include both sides")
    }
    left.aliases = ["position"]
    rightTerm.aliases = ["position"]
    expect(() => validateScoringGlossary(aliasCollision)).toThrow(/ambiguous glossary alias/iu)
  })

  it("rejects generic overloaded names even when they are otherwise unique", () => {
    const overloaded = mutableGlossary()
    overloaded.terms.push({
      ...overloaded.terms[0],
      aliases: [],
      canonical: "A"
    })
    expect(() => validateScoringGlossary(overloaded)).toThrow(/overloaded glossary name/iu)
  })

  it("resolves canonical terms and rejects ambiguous or unknown lookups", () => {
    expect(resolveScoringGlossaryTerm("left.A")).toMatchObject({ kind: "line", unit: null })
    expect(resolveScoringGlossaryTerm("ATus")).toMatchObject({ canonical: "atUs", unit: "us" })
    expect(() => resolveScoringGlossaryTerm("line")).toThrow(/unknown scoring glossary term/iu)
  })

  it("enforces integer microseconds for every internal timing field", () => {
    expect(isIntegerMicroseconds(0)).toBe(true)
    expect(isIntegerMicroseconds(2_000)).toBe(true)
    expect(isIntegerMicroseconds(-1)).toBe(false)
    expect(isIntegerMicroseconds(2.5)).toBe(false)
    expect(() => assertIntegerMicroseconds(2.5, "qualifiedAtUs")).toThrow(/microsecond/iu)
    expect(validateScoringQuantity("qualifiedAtUs", 13_000)).toBe(13_000)
    expect(() => validateScoringQuantity("qualifiedAtUs", 13)).not.toThrow()
    expect(() => validateScoringQuantity("qualifiedAtUs", 13.1)).toThrow(/microsecond/iu)
    expect(validateScoringQuantity("wallAtUs", -1)).toBe(-1)
    expect(() => validateScoringQuantity("wallAtUs", 1.1)).toThrow(/Unix-epoch/iu)
    expect(() => validateScoringQuantity("piste", 1)).toThrow(/not a measurable/iu)
  })

  it("returns a fresh immutable glossary when validating external data", () => {
    const candidate = mutableGlossary()
    const validated = validateScoringGlossary(candidate)
    expect(validated).not.toBe(candidate)
    expectImmutable(validated)
    expect(() => {
      candidate.terms[0].canonical = "changed"
    }).not.toThrow()
    expect(validated.terms[0].canonical).not.toBe("changed")
  })
})
