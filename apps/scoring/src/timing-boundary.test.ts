import { describe, expect, it } from "vitest"
import {
  advanceEpeeResistanceScoring,
  createEpeeResistanceScoringState,
  type EpeeResistanceContact,
  type EpeeResistanceSample,
  type ResistanceMeasurement
} from "./epee-resistance.js"
import { advanceFoilScoring, createFoilScoringState, type FoilContact, type FoilSample } from "./foil.js"
import { advanceSabreScoring, createSabreScoringState, type SabreContact, type SabreSample } from "./sabre.js"
import {
  approvedRuleRevisionMappings,
  generateTimingBoundaryVectors,
  loadTimingTableForRuleRevision,
  type TimingBoundarySide,
  type TimingBoundaryPosition,
  type TimingBoundaryVector
} from "./timing-boundary.js"
import { FIE_TIMING_BANDS, getFieTimingBandEndpointUs, loadTimingTable, type TimingTable } from "./timing-table.js"

const table = loadTimingTable("timing-1")
const vectors = generateTimingBoundaryVectors(table)
const runtimeVectors = vectors.filter(({ kind }) => kind === "runtime")
const referenceVectors = vectors.filter(({ kind }) => kind === "reference")

type RuntimeExpectation = {
  readonly hitCount: number
  readonly whiteDiagnostic?: "white-off" | "white-on"
}

const EXPECTED_SIDES: readonly TimingBoundarySide[] = ["left", "right"]
const EXPECTED_POSITIONS: readonly TimingBoundaryPosition[] = ["below", "at", "above"]

/**
 * This order is intentionally authored separately from the generator. It is
 * the review record for the released scalar boundaries, not a projection of
 * whatever order the implementation happens to emit.
 */
const EXPECTED_RUNTIME_BOUNDARY_ORDER = [
  "epee.contact-minimum",
  "epee.double-hit-window",
  "foil.contact-break-minimum",
  "foil.lockout",
  "sabre.minimum-contact",
  "sabre.blade-registration-latest",
  "sabre.blade-recovery",
  "sabre.control-break",
  "sabre.lockout"
] as const

const EXPECTED_RUNTIME_VECTOR_IDS = EXPECTED_RUNTIME_BOUNDARY_ORDER.flatMap((boundary) =>
  EXPECTED_SIDES.flatMap((side) => EXPECTED_POSITIONS.map((position) => `${boundary}.${side}.${position}`))
)

const EXPECTED_RUNTIME_BOUNDARY_VALUES: Readonly<Record<string, number>> = {
  "epee.contact-minimum": table.epee.contactMinimumUs,
  "epee.double-hit-window": table.epee.doubleHitWindowUs,
  "foil.contact-break-minimum": table.foil.contactBreakMinimumUs,
  "foil.lockout": table.foil.lockoutUs,
  "sabre.blade-recovery": table.sabre.bladeRecoveryUs,
  "sabre.blade-registration-latest": table.sabre.bladeRegistrationLatestUs,
  "sabre.control-break": table.sabre.controlBreakUs,
  "sabre.lockout": table.sabre.lockoutUs,
  "sabre.minimum-contact": table.sabre.minimumContactUs
}

const EXPECTED_RUNTIME_OUTCOMES: Readonly<
  Record<string, Readonly<Record<TimingBoundaryPosition, RuntimeExpectation>>>
> = {
  "epee.contact-minimum": { at: { hitCount: 1 }, above: { hitCount: 1 }, below: { hitCount: 0 } },
  "epee.double-hit-window": { at: { hitCount: 2 }, above: { hitCount: 1 }, below: { hitCount: 2 } },
  "foil.contact-break-minimum": { at: { hitCount: 1 }, above: { hitCount: 1 }, below: { hitCount: 0 } },
  "foil.lockout": { at: { hitCount: 1 }, above: { hitCount: 1 }, below: { hitCount: 2 } },
  "sabre.blade-recovery": { at: { hitCount: 1 }, above: { hitCount: 1 }, below: { hitCount: 0 } },
  "sabre.blade-registration-latest": { at: { hitCount: 1 }, above: { hitCount: 0 }, below: { hitCount: 1 } },
  "sabre.control-break": {
    at: { hitCount: 0, whiteDiagnostic: "white-on" },
    above: { hitCount: 0, whiteDiagnostic: "white-on" },
    below: { hitCount: 0, whiteDiagnostic: "white-off" }
  },
  "sabre.lockout": { at: { hitCount: 1 }, above: { hitCount: 1 }, below: { hitCount: 2 } },
  "sabre.minimum-contact": { at: { hitCount: 1 }, above: { hitCount: 1 }, below: { hitCount: 0 } }
}

const EXPECTED_REFERENCE_VECTOR_IDS = [
  "epee.contact-minimum-envelope-latest.left.at",
  "epee.contact-minimum-envelope-latest.right.at",
  "epee.double-hit-window-envelope-earliest.left.at",
  "epee.double-hit-window-envelope-earliest.right.at",
  "epee.double-hit-window-envelope-latest.left.at",
  "epee.double-hit-window-envelope-latest.right.at",
  "foil.contact-break-minimum-envelope-latest.left.at",
  "foil.contact-break-minimum-envelope-latest.right.at",
  "foil.lockout-envelope-earliest.left.at",
  "foil.lockout-envelope-earliest.right.at",
  "foil.lockout-envelope-latest.left.at",
  "foil.lockout-envelope-latest.right.at",
  "sabre.control-break-envelope-earliest.left.at",
  "sabre.control-break-envelope-earliest.right.at",
  "sabre.control-break-envelope-latest.left.at",
  "sabre.control-break-envelope-latest.right.at",
  "sabre.lockout-envelope-earliest.left.at",
  "sabre.lockout-envelope-earliest.right.at",
  "sabre.lockout-envelope-latest.left.at",
  "sabre.lockout-envelope-latest.right.at",
  "sabre.sensitivity-test-point.left.below",
  "sabre.sensitivity-test-point.left.at",
  "sabre.sensitivity-test-point.left.above",
  "sabre.sensitivity-test-point.right.below",
  "sabre.sensitivity-test-point.right.at",
  "sabre.sensitivity-test-point.right.above"
] as const

const EXPECTED_REFERENCE_BOUNDARY_VALUES: Readonly<Record<string, number>> = {
  "epee.contact-minimum-envelope-latest": getFieTimingBandEndpointUs(FIE_TIMING_BANDS.epee.contactMinimumUs, "latest"),
  "epee.double-hit-window-envelope-earliest": getFieTimingBandEndpointUs(
    FIE_TIMING_BANDS.epee.doubleHitWindowUs,
    "earliest"
  ),
  "epee.double-hit-window-envelope-latest": getFieTimingBandEndpointUs(
    FIE_TIMING_BANDS.epee.doubleHitWindowUs,
    "latest"
  ),
  "foil.contact-break-minimum-envelope-latest": getFieTimingBandEndpointUs(
    FIE_TIMING_BANDS.foil.contactBreakMinimumUs,
    "latest"
  ),
  "foil.lockout-envelope-earliest": getFieTimingBandEndpointUs(FIE_TIMING_BANDS.foil.lockoutUs, "earliest"),
  "foil.lockout-envelope-latest": getFieTimingBandEndpointUs(FIE_TIMING_BANDS.foil.lockoutUs, "latest"),
  "sabre.control-break-envelope-earliest": getFieTimingBandEndpointUs(
    FIE_TIMING_BANDS.sabre.controlBreakUs,
    "earliest"
  ),
  "sabre.control-break-envelope-latest": getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.controlBreakUs, "latest"),
  "sabre.lockout-envelope-earliest": getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.lockoutUs, "earliest"),
  "sabre.lockout-envelope-latest": getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.lockoutUs, "latest"),
  "sabre.sensitivity-test-point": table.sabre.sensitivityTestPointUs
}

const NO_MEASUREMENT: ResistanceMeasurement = {
  resistanceMilliOhms: null,
  resistanceUncertaintyMilliOhms: null
}
const NORMAL_10_OHM: ResistanceMeasurement = {
  resistanceMilliOhms: 10_000,
  resistanceUncertaintyMilliOhms: 0
}

const EPEE_OPEN: EpeeResistanceContact = {
  circuitComplete: "open",
  contactResistance: NO_MEASUREMENT,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const EPEE_HIT: EpeeResistanceContact = {
  circuitComplete: "closed",
  contactResistance: NORMAL_10_OHM,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}

const FOIL_CLOSED: FoilContact = {
  circuitBreak: "closed",
  insulationDiagnostic: "unavailable",
  integrity: "intact",
  targetContext: "target"
}
const FOIL_ON_TARGET: FoilContact = { ...FOIL_CLOSED, circuitBreak: "open" }

const SABRE_READY: SabreContact = {
  bladeContact: "absent",
  circuitBCFault: "normal",
  externalPathEligibility: "eligible",
  ownEquipmentFault: "absent",
  targetContact: "target"
}
const SABRE_NON_CONDUCTIVE: SabreContact = { ...SABRE_READY, targetContact: "nonConductiveSurface" }
const SABRE_BLADE_TARGET: SabreContact = { ...SABRE_READY, bladeContact: "present" }
const SABRE_BLADE_NON_CONDUCTIVE: SabreContact = { ...SABRE_NON_CONDUCTIVE, bladeContact: "present" }

function epeeSample(atUs: number, side: TimingBoundarySide, contact: EpeeResistanceContact): EpeeResistanceSample {
  return side === "left" ? { atUs, left: contact, right: EPEE_OPEN } : { atUs, left: EPEE_OPEN, right: contact }
}

function foilSample(atUs: number, side: TimingBoundarySide, contact: FoilContact): FoilSample {
  return side === "left" ? { atUs, left: contact, right: FOIL_CLOSED } : { atUs, left: FOIL_CLOSED, right: contact }
}

function sabreSample(atUs: number, side: TimingBoundarySide, contact: SabreContact): SabreSample {
  return side === "left"
    ? { atUs, left: contact, right: SABRE_NON_CONDUCTIVE }
    : { atUs, left: SABRE_NON_CONDUCTIVE, right: contact }
}

function oppositeSide(side: TimingBoundarySide): TimingBoundarySide {
  return side === "left" ? "right" : "left"
}

function replayEpee(samples: readonly EpeeResistanceSample[]) {
  let state = createEpeeResistanceScoringState()

  for (const sample of samples) {
    state = advanceEpeeResistanceScoring(state, sample, table)
  }

  return state
}

function replayFoil(samples: readonly FoilSample[]) {
  let state = createFoilScoringState()

  for (const sample of samples) {
    state = advanceFoilScoring(state, sample, table)
  }

  return state
}

function replaySabre(samples: readonly SabreSample[]) {
  let state = createSabreScoringState()

  for (const sample of samples) {
    state = advanceSabreScoring(state, sample, table)
  }

  return state
}

function expectContactBoundary(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const state =
    vector.weapon === "epee"
      ? replayEpee([epeeSample(0, vector.side, EPEE_HIT), epeeSample(vector.elapsedUs, vector.side, EPEE_HIT)])
      : vector.weapon === "foil"
        ? replayFoil([
            foilSample(0, vector.side, FOIL_ON_TARGET),
            foilSample(vector.elapsedUs, vector.side, FOIL_ON_TARGET)
          ])
        : replaySabre([
            sabreSample(0, vector.side, SABRE_READY),
            sabreSample(vector.elapsedUs, vector.side, SABRE_READY)
          ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
}

function expectEpeeLockout(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.epee.contactMinimumUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.epee.contactMinimumUs
  const state = replayEpee([
    epeeSample(0, firstSide, EPEE_HIT),
    epeeSample(firstHitAtUs, firstSide, EPEE_HIT),
    epeeSample(opposingStartUs, vector.side, EPEE_HIT),
    epeeSample(opposingStartUs + table.epee.contactMinimumUs, vector.side, EPEE_HIT)
  ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
}

function expectFoilLockout(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.foil.contactBreakMinimumUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.foil.contactBreakMinimumUs
  const state = replayFoil([
    foilSample(0, firstSide, FOIL_ON_TARGET),
    foilSample(firstHitAtUs, firstSide, FOIL_ON_TARGET),
    foilSample(opposingStartUs, vector.side, FOIL_ON_TARGET),
    foilSample(opposingStartUs + table.foil.contactBreakMinimumUs, vector.side, FOIL_ON_TARGET)
  ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
}

function expectSabreBladeRegistration(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const candidateStartUs = vector.elapsedUs - table.sabre.minimumContactUs
  const state = replaySabre([
    sabreSample(0, vector.side, SABRE_BLADE_TARGET),
    sabreSample(table.sabre.minimumContactUs - 1, vector.side, SABRE_BLADE_NON_CONDUCTIVE),
    sabreSample(candidateStartUs, vector.side, SABRE_BLADE_TARGET),
    sabreSample(vector.elapsedUs, vector.side, SABRE_BLADE_TARGET)
  ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
}

function expectSabreBladeRecovery(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const state = replaySabre([
    sabreSample(0, vector.side, SABRE_BLADE_TARGET),
    sabreSample(table.sabre.minimumContactUs - 1, vector.side, SABRE_BLADE_NON_CONDUCTIVE),
    sabreSample(vector.elapsedUs, vector.side, SABRE_READY),
    sabreSample(vector.elapsedUs + table.sabre.minimumContactUs, vector.side, SABRE_READY)
  ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
}

function expectSabreControlBreak(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const controlBreak: SabreContact = { ...SABRE_NON_CONDUCTIVE, circuitBCFault: "controlBreak" }
  const state = replaySabre([
    sabreSample(0, vector.side, controlBreak),
    sabreSample(vector.elapsedUs, vector.side, controlBreak)
  ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
  expect(state[vector.side].whiteDiagnostic, vector.id).toBe(expected.whiteDiagnostic)
}

function expectSabreLockout(vector: TimingBoundaryVector, expected: RuntimeExpectation) {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.sabre.minimumContactUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.sabre.minimumContactUs
  const state = replaySabre([
    sabreSample(0, firstSide, SABRE_READY),
    sabreSample(firstHitAtUs, firstSide, SABRE_READY),
    sabreSample(opposingStartUs, vector.side, SABRE_READY),
    sabreSample(opposingStartUs + table.sabre.minimumContactUs, vector.side, SABRE_READY)
  ])

  expect(state.hits, vector.id).toHaveLength(expected.hitCount)
}

function assertRuntimeVector(vector: TimingBoundaryVector, expected: RuntimeExpectation): void {
  if (
    vector.boundary === "contact-minimum" ||
    vector.boundary === "contact-break-minimum" ||
    vector.boundary === "minimum-contact"
  ) {
    expectContactBoundary(vector, expected)
    return
  }

  if (vector.weapon === "epee") {
    expectEpeeLockout(vector, expected)
    return
  }

  if (vector.weapon === "foil") {
    expectFoilLockout(vector, expected)
    return
  }

  if (vector.boundary === "blade-registration-latest") {
    expectSabreBladeRegistration(vector, expected)
    return
  }

  if (vector.boundary === "blade-recovery") {
    expectSabreBladeRecovery(vector, expected)
    return
  }

  if (vector.boundary === "control-break") {
    expectSabreControlBreak(vector, expected)
    return
  }

  expectSabreLockout(vector, expected)
}

describe("generated timing boundary vectors", () => {
  it("maps only the approved golden rule revisions and fails closed otherwise", () => {
    expect(approvedRuleRevisionMappings()).toEqual({
      "fie-2026-epee": "timing-1",
      "fie-2026-foil": "timing-1",
      "fie-2026-sabre": "timing-1"
    })
    expect(Object.isFrozen(approvedRuleRevisionMappings())).toBe(true)
    expect(loadTimingTableForRuleRevision("fie-2026-epee")).toBe(table)
    expect(loadTimingTableForRuleRevision("fie-2026-foil")).toBe(table)
    expect(loadTimingTableForRuleRevision("fie-2026-sabre")).toBe(table)
    expect(() => loadTimingTableForRuleRevision("toString")).toThrow(new RangeError("unknown-rule-revision"))
    expect(() => loadTimingTableForRuleRevision(undefined)).toThrow(new RangeError("unknown-rule-revision"))
  })

  it("rejects numeric and forged explicit timing arguments before scoring", () => {
    expect(() =>
      advanceEpeeResistanceScoring(
        createEpeeResistanceScoringState(),
        epeeSample(0, "left", EPEE_OPEN),
        42 as unknown as TimingTable
      )
    ).toThrow(new TypeError("Timing table must be an object"))

    const forged = {
      ...table,
      epee: { ...table.epee, contactMinimumUs: table.epee.contactMinimumUs + 1 }
    }

    expect(() =>
      advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), epeeSample(0, "left", EPEE_OPEN), forged)
    ).toThrow(new RangeError("Timing table epee.contactMinimumUs must equal the approved timing-1 value 2000"))
    expect(() => generateTimingBoundaryVectors(forged)).toThrow(
      new RangeError("Timing table epee.contactMinimumUs must equal the approved timing-1 value 2000")
    )
  })

  it("generates a stable left/right below-at-above corpus from timing-1", () => {
    expect(vectors).toHaveLength(80)
    expect(generateTimingBoundaryVectors()).toHaveLength(80)
    expect(runtimeVectors).toHaveLength(54)
    expect(referenceVectors).toHaveLength(26)
    expect(vectors[0]).toEqual({
      boundary: "contact-minimum",
      boundaryUs: table.epee.contactMinimumUs,
      elapsedUs: table.epee.contactMinimumUs - 1,
      id: "epee.contact-minimum.left.below",
      kind: "runtime",
      position: "below",
      side: "left",
      weapon: "epee"
    })
    expect(vectors.at(-1)?.id).toBe("sabre.sensitivity-test-point.right.above")
    expect(vectors.map(({ id }) => id)).toEqual(generateTimingBoundaryVectors(table).map(({ id }) => id))
  })

  it("matches the independently authored runtime boundary order and values", () => {
    expect(runtimeVectors.map(({ id }) => id)).toEqual(EXPECTED_RUNTIME_VECTOR_IDS)

    for (const vector of runtimeVectors) {
      const boundaryKey = `${vector.weapon}.${vector.boundary}`
      const expectedBoundaryUs = EXPECTED_RUNTIME_BOUNDARY_VALUES[boundaryKey]

      expect(vector.boundaryUs, vector.id).toBe(expectedBoundaryUs)
      expect(vector.elapsedUs, vector.id).toBe(
        expectedBoundaryUs + (vector.position === "below" ? -1 : vector.position === "above" ? 1 : 0)
      )
      expect(EXPECTED_RUNTIME_OUTCOMES[boundaryKey][vector.position], vector.id).toBeDefined()
    }
  })

  it("derives tolerance references from the canonical FIE bands", () => {
    const referenceValue = (id: string) => vectors.find((vector) => vector.id === id)?.boundaryUs

    expect(referenceValue("epee.contact-minimum-envelope-latest.left.at")).toBe(
      FIE_TIMING_BANDS.epee.contactMinimumUs.latestUs
    )
    expect(referenceValue("epee.double-hit-window-envelope-earliest.left.at")).toBe(
      FIE_TIMING_BANDS.epee.doubleHitWindowUs.earliestUs
    )
    expect(referenceValue("foil.lockout-envelope-latest.right.at")).toBe(FIE_TIMING_BANDS.foil.lockoutUs.latestUs)
    expect(referenceValue("sabre.control-break-envelope-earliest.right.at")).toBe(
      FIE_TIMING_BANDS.sabre.controlBreakUs.earliestUs
    )
    expect(referenceValue("sabre.lockout-envelope-latest.left.at")).toBe(FIE_TIMING_BANDS.sabre.lockoutUs.latestUs)
  })

  it.each(runtimeVectors)("executes $id against the loaded table", (vector) => {
    const expected = EXPECTED_RUNTIME_OUTCOMES[`${vector.weapon}.${vector.boundary}`][vector.position]
    assertRuntimeVector(vector, expected)
  })

  it.each(referenceVectors)("retains $id as a reference without treating it as an endpoint", (vector) => {
    const boundaryKey = `${vector.weapon}.${vector.boundary}`

    expect(vector.kind).toBe("reference")
    expect(vector.boundaryUs, vector.id).toBe(EXPECTED_REFERENCE_BOUNDARY_VALUES[boundaryKey])
    expect(EXPECTED_REFERENCE_VECTOR_IDS).toContain(vector.id)
  })

  it("retains every independently authored reference vector in generator order", () => {
    expect(referenceVectors.map(({ id }) => id)).toEqual(EXPECTED_REFERENCE_VECTOR_IDS)
  })
})
