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
  type TimingBoundaryVector
} from "./timing-boundary.js"
import { loadTimingTable, type TimingTable } from "./timing-table.js"

const table = loadTimingTable("timing-1")
const vectors = generateTimingBoundaryVectors(table)
const runtimeVectors = vectors.filter(({ kind }) => kind === "runtime")
const referenceVectors = vectors.filter(({ kind }) => kind === "reference")

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

function expectContactBoundary(vector: TimingBoundaryVector) {
  const qualifies = vector.position !== "below"
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

  expect(state.hits, vector.id).toHaveLength(qualifies ? 1 : 0)
}

function expectEpeeLockout(vector: TimingBoundaryVector) {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.epee.contactMinimumUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.epee.contactMinimumUs
  const state = replayEpee([
    epeeSample(0, firstSide, EPEE_HIT),
    epeeSample(firstHitAtUs, firstSide, EPEE_HIT),
    epeeSample(opposingStartUs, vector.side, EPEE_HIT),
    epeeSample(opposingStartUs + table.epee.contactMinimumUs, vector.side, EPEE_HIT)
  ])

  expect(state.hits, vector.id).toHaveLength(vector.position === "above" ? 1 : 2)
}

function expectFoilLockout(vector: TimingBoundaryVector) {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.foil.contactBreakMinimumUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.foil.contactBreakMinimumUs
  const state = replayFoil([
    foilSample(0, firstSide, FOIL_ON_TARGET),
    foilSample(firstHitAtUs, firstSide, FOIL_ON_TARGET),
    foilSample(opposingStartUs, vector.side, FOIL_ON_TARGET),
    foilSample(opposingStartUs + table.foil.contactBreakMinimumUs, vector.side, FOIL_ON_TARGET)
  ])

  expect(state.hits, vector.id).toHaveLength(vector.position === "below" ? 2 : 1)
}

function expectSabreBladeRegistration(vector: TimingBoundaryVector) {
  const candidateStartUs = vector.elapsedUs - table.sabre.minimumContactUs
  const state = replaySabre([
    sabreSample(0, vector.side, SABRE_BLADE_TARGET),
    sabreSample(99, vector.side, SABRE_BLADE_NON_CONDUCTIVE),
    sabreSample(candidateStartUs, vector.side, SABRE_BLADE_TARGET),
    sabreSample(vector.elapsedUs, vector.side, SABRE_BLADE_TARGET)
  ])

  expect(state.hits, vector.id).toHaveLength(vector.position === "above" ? 0 : 1)
}

function expectSabreBladeRecovery(vector: TimingBoundaryVector) {
  const state = replaySabre([
    sabreSample(0, vector.side, SABRE_BLADE_TARGET),
    sabreSample(99, vector.side, SABRE_BLADE_NON_CONDUCTIVE),
    sabreSample(vector.elapsedUs, vector.side, SABRE_READY),
    sabreSample(vector.elapsedUs + table.sabre.minimumContactUs, vector.side, SABRE_READY)
  ])

  expect(state.hits, vector.id).toHaveLength(vector.position === "below" ? 0 : 1)
}

function expectSabreControlBreak(vector: TimingBoundaryVector) {
  const controlBreak: SabreContact = { ...SABRE_NON_CONDUCTIVE, circuitBCFault: "controlBreak" }
  const state = replaySabre([
    sabreSample(0, vector.side, controlBreak),
    sabreSample(vector.elapsedUs, vector.side, controlBreak)
  ])

  expect(state.hits, vector.id).toEqual([])
  expect(state[vector.side].whiteDiagnostic, vector.id).toBe(vector.position === "below" ? "white-off" : "white-on")
}

function expectSabreLockout(vector: TimingBoundaryVector) {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.sabre.minimumContactUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.sabre.minimumContactUs
  const state = replaySabre([
    sabreSample(0, firstSide, SABRE_READY),
    sabreSample(firstHitAtUs, firstSide, SABRE_READY),
    sabreSample(opposingStartUs, vector.side, SABRE_READY),
    sabreSample(opposingStartUs + table.sabre.minimumContactUs, vector.side, SABRE_READY)
  ])

  expect(state.hits, vector.id).toHaveLength(vector.position === "below" ? 2 : 1)
}

function assertRuntimeVector(vector: TimingBoundaryVector): void {
  if (
    vector.boundary === "contact-minimum" ||
    vector.boundary === "contact-break-minimum" ||
    vector.boundary === "minimum-contact"
  ) {
    expectContactBoundary(vector)
    return
  }

  if (vector.weapon === "epee") {
    expectEpeeLockout(vector)
    return
  }

  if (vector.weapon === "foil") {
    expectFoilLockout(vector)
    return
  }

  if (vector.boundary === "blade-registration-latest") {
    expectSabreBladeRegistration(vector)
    return
  }

  if (vector.boundary === "blade-recovery") {
    expectSabreBladeRecovery(vector)
    return
  }

  if (vector.boundary === "control-break") {
    expectSabreControlBreak(vector)
    return
  }

  expectSabreLockout(vector)
}

describe("generated timing boundary vectors", () => {
  it("maps only the approved golden rule revision and fails closed otherwise", () => {
    expect(approvedRuleRevisionMappings()).toEqual({ "fie-2026-epee": "timing-1" })
    expect(Object.isFrozen(approvedRuleRevisionMappings())).toBe(true)
    expect(loadTimingTableForRuleRevision("fie-2026-epee")).toBe(table)
    expect(() => loadTimingTableForRuleRevision("fie-2026-foil")).toThrow(new RangeError("unknown-rule-revision"))
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
      boundaryUs: 2_000,
      elapsedUs: 1_999,
      id: "epee.contact-minimum.left.below",
      kind: "runtime",
      position: "below",
      side: "left",
      weapon: "epee"
    })
    expect(vectors.at(-1)?.id).toBe("sabre.sensitivity-test-point.right.above")
    expect(vectors.map(({ id }) => id)).toEqual(generateTimingBoundaryVectors(table).map(({ id }) => id))
  })

  it.each(runtimeVectors)("executes $id against the loaded table", (vector) => {
    assertRuntimeVector(vector)
  })

  it.each(referenceVectors)("retains $id as a reference without treating it as an endpoint", (vector) => {
    expect(vector.kind).toBe("reference")
    expect([
      "contact-minimum-envelope-latest",
      "double-hit-window-envelope-earliest",
      "double-hit-window-envelope-latest",
      "contact-break-minimum-envelope-latest",
      "lockout-envelope-earliest",
      "lockout-envelope-latest",
      "control-break-envelope-earliest",
      "control-break-envelope-latest",
      "sensitivity-test-point"
    ]).toContain(vector.boundary)
    expect(["below", "at", "above"]).toContain(vector.position)
  })
})
