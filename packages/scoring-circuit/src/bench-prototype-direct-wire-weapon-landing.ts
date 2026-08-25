/**
 * BP-034 prototype-only direct-wire landing for the two three-pin weapon
 * pigtails. This is an electrical and assembly contract, not a land pattern.
 */

import {
  benchPrototypeWeaponPanelHarness,
  validateBenchPrototypeWeaponPanelHarness
} from "./bench-prototype-connector-preorder.js"
import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"
import {
  benchPrototypeFixtureHarness,
  benchPrototypeContinuityThresholds,
  validateBenchPrototypeFixtureHarness
} from "./bench-prototype-fixture-harness.js"
import { weaponInputTopology } from "./weapon-input-topology.js"

type DataRecord = Record<PropertyKey, unknown>
type WeaponSide = "left" | "right"
type WeaponConductor = "A" | "B" | "C"

function isPlainRecord(value: unknown): value is DataRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is DataRecord {
  if (!isPlainRecord(value)) {
    return false
  }
  const actual = Object.keys(value)
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") {
    return value
  }
  if (seen.has(value)) {
    throw new RangeError("BP-034 direct-wire landing cannot contain cycles or aliases")
  }
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-034 direct-wire landing allows data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/**
 * Compares only plain enumerable data. Arrays are ordered contracts, while
 * records are keyed contracts. Hidden properties, symbols, and accessors fail.
 */
function sameCanonicalData(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) {
    return true
  }
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return false
  }
  const actualIsArray = Array.isArray(actual)
  const expectedIsArray = Array.isArray(expected)
  if (actualIsArray !== expectedIsArray) {
    return false
  }
  if (actualIsArray) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || Object.getPrototypeOf(actual) !== Array.prototype) {
      return false
    }
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (
      actual.length !== expected.length ||
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
    ) {
      return false
    }
    return expected.every((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable &&
        sameCanonicalData(descriptor.value, entry)
      )
    })
  }
  if (!isPlainRecord(actual) || !isPlainRecord(expected)) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (typeof key === "symbol") {
      return false
    }
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameCanonicalData(actualDescriptor.value, expectedDescriptor.value)
    )
  })
}

const conductors = ["A", "B", "C"] as const
const negativeTestIds = ["open", "a-b-swap", "a-c-swap", "b-c-swap", "polarity-orientation-reversal"] as const
const prohibitedNets = [
  "PISTE",
  "PISTE_RETURN",
  "FIXTURE_RETURN_REVIEW_REQUIRED",
  "ESD_RETURN_REVIEW_REQUIRED",
  "SCORING_SGND",
  "APP_GND"
] as const

const landingFor = (side: WeaponSide, conductor: WeaponConductor) => {
  const sideCode = side === "left" ? "L" : "R"
  const sideName = side === "left" ? "LEFT" : "RIGHT"
  return {
    conductor,
    boardNet: `${sideName}_WEAPON_${conductor}`,
    landingPadReference: `P_WEAPON_${sideCode}_${conductor}`,
    testPadReference: `TP_WEAPON_${sideCode}_${conductor}`,
    boardLabel: `${sideName} WEAPON ${conductor}`,
    padRule: "labeled plated-through-hole landing and separate labeled test landing",
    ncRule: "no alternate conductor, return, ground, or piste net may land here"
  }
}

/**
 * Exact named landing and test endpoints, deliberately without dimensions,
 * hole sizes, copper shape, spacing, footprint, or fabrication geometry.
 */
export const benchPrototypeDirectWireWeaponLanding = deepFreeze({
  artifactKind: "bench-prototype-direct-wire-weapon-landing-contract",
  workUnit: "BP-034",
  prototypeOnly: true,
  scope: "temporary direct-solder pigtails from the insulated weapon socket modules to the scoring board",
  cableCompatibility: {
    supplier: "OK Fencing",
    status: "owner-validated-not-a-blocker",
    nonClaim: "The validated cable does not identify a board socket, a socket footprint, or fabrication geometry."
  },
  normalPower: {
    interface: "USB-C PD",
    unchanged: true,
    rule: "Weapon pigtail assembly never supplies power and does not alter the normal USB-C PD input path."
  },
  sides: [
    {
      side: "left",
      pigtailId: "PIGTAIL_LEFT",
      boardHarnessReference: "J_WEAPON_HARNESS_L",
      conductors: conductors.map((conductor) => landingFor("left", conductor))
    },
    {
      side: "right",
      pigtailId: "PIGTAIL_RIGHT",
      boardHarnessReference: "J_WEAPON_HARNESS_R",
      conductors: conductors.map((conductor) => landingFor("right", conductor))
    }
  ],
  ncPolicy: {
    conductorsPerSide: 3,
    allowedConductors: conductors,
    prohibitedNets,
    rule: "Each side has only A, B, and C. No fourth wire, return, ground, shield, or piste conductor is permitted."
  },
  assembly: {
    powerState: "off-and-discharged",
    allSourcesRemoved: true,
    replacementMode: "deenergized-board-rework",
    replacementRule:
      "The pigtail is replaceable only by complete de-energized board rework; it is not a field-service connector.",
    retentionRule:
      "A separate pigtail clamp or anchor carries pull and bend loads. Solder joints and plated holes are not the mechanical retention path.",
    inspectionRule:
      "Inspect insulation, labels, clamp engagement, and separation from any conductive panel hardware before continuity testing."
  },
  evidenceThresholds: {
    maximumEndToEndResistanceOhms: benchPrototypeContinuityThresholds.maxEndToEndResistanceOhms,
    maximumCompensatedLeadResidualOhms: benchPrototypeContinuityThresholds.maximumLeadCompensationOhms,
    minimumIsolationResistanceOhms: benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms,
    isolationTestVoltageV: benchPrototypeContinuityThresholds.isolationTestVoltageV
  },
  negativeTestIds,
  productionSocket: {
    state: "open",
    rule: "A production replaceable insulated socket module and keyed board-end harness remain a separate selection and physical-evidence gate."
  },
  physicalEvidence: {
    state: "open",
    required: [
      "received socket sample",
      "de-energized fit",
      "continuity",
      "isolation",
      "miswire rejection",
      "retention and strain relief"
    ]
  },
  fabricationDisposition: "DENY",
  releaseState: "deny"
})

export type BenchPrototypeDirectWireWeaponLandingEvidence = {
  readonly artifactKind: "bench-prototype-direct-wire-weapon-landing-evidence"
  readonly status: "measured"
  readonly side: WeaponSide
  readonly boardId: string
  readonly pigtailId: string
  readonly assembly: {
    readonly powerState: "off-and-discharged"
    readonly allSourcesRemoved: true
    readonly boardDischarged: true
    readonly replacementMode: "deenergized-board-rework"
    readonly strainReliefLoadBypassesSolderJoints: true
  }
  readonly continuity: readonly {
    readonly conductor: WeaponConductor
    readonly from: string
    readonly landingPadReference: string
    readonly testPadReference: string
    readonly boardNet: string
    readonly resistanceOhms: number
  }[]
  readonly isolation: readonly {
    readonly conductorA: WeaponConductor
    readonly conductorB: WeaponConductor
    readonly testVoltageV: 5
    readonly resistanceOhms: number
  }[]
  readonly leadCompensation: {
    readonly method: "zeroed-with-same-leads-at-landing"
    readonly compensatedLeadResidualOhms: number
  }
  readonly ncInspection: {
    readonly noAdditionalConductors: true
    readonly prohibitedNetsAbsent: true
  }
  readonly negativeTests: readonly {
    readonly id: (typeof negativeTestIds)[number]
    readonly result: "rejected"
  }[]
}

export type BenchPrototypeDirectWireWeaponLandingEvaluation = {
  readonly accepted: boolean
  readonly reasons: readonly string[]
}

function sideContract(side: WeaponSide) {
  return benchPrototypeDirectWireWeaponLanding.sides.find((candidate) => candidate.side === side)
}

function expectedIsolationPairs() {
  return [
    { conductorA: "A", conductorB: "B" },
    { conductorA: "A", conductorB: "C" },
    { conductorA: "B", conductorB: "C" }
  ] as const
}

/** Evaluates a measured prototype record; it never changes the open evidence or release gates. */
export function evaluateBenchPrototypeDirectWireWeaponLandingEvidence(
  value: unknown
): BenchPrototypeDirectWireWeaponLandingEvaluation {
  const reasons: string[] = []
  if (
    !hasExactKeys(value, [
      "artifactKind",
      "status",
      "side",
      "boardId",
      "pigtailId",
      "assembly",
      "continuity",
      "isolation",
      "leadCompensation",
      "ncInspection",
      "negativeTests"
    ])
  ) {
    return { accepted: false, reasons: ["direct-wire evidence must contain only the exact declared data keys"] }
  }
  const side = value.side
  const contract = side === "left" || side === "right" ? sideContract(side) : undefined
  if (
    value.artifactKind !== "bench-prototype-direct-wire-weapon-landing-evidence" ||
    value.status !== "measured" ||
    contract === undefined ||
    !nonEmptyString(value.boardId) ||
    value.pigtailId !== contract.pigtailId
  ) {
    reasons.push("artifact identity, measured state, side, board ID, and exact pigtail ID are required")
  }
  if (
    !hasExactKeys(value.assembly, [
      "powerState",
      "allSourcesRemoved",
      "boardDischarged",
      "replacementMode",
      "strainReliefLoadBypassesSolderJoints"
    ]) ||
    value.assembly.powerState !== "off-and-discharged" ||
    value.assembly.allSourcesRemoved !== true ||
    value.assembly.boardDischarged !== true ||
    value.assembly.replacementMode !== "deenergized-board-rework" ||
    value.assembly.strainReliefLoadBypassesSolderJoints !== true
  ) {
    reasons.push(
      "assembly must be de-energized, discharged, replaceable by board rework, and independently strain relieved"
    )
  }
  const continuity = value.continuity
  if (
    contract === undefined ||
    !Array.isArray(continuity) ||
    continuity.length !== conductors.length ||
    !conductors.every((conductor, index) => {
      const expected = contract.conductors[index]
      const actual = continuity[index]
      return (
        expected !== undefined &&
        actual !== undefined &&
        hasExactKeys(actual, [
          "conductor",
          "from",
          "landingPadReference",
          "testPadReference",
          "boardNet",
          "resistanceOhms"
        ]) &&
        actual.conductor === conductor &&
        actual.from === `${contract.pigtailId}.SOCKET.${conductor}` &&
        actual.landingPadReference === expected.landingPadReference &&
        actual.testPadReference === expected.testPadReference &&
        actual.boardNet === expected.boardNet &&
        finiteNumber(actual.resistanceOhms) &&
        actual.resistanceOhms >= 0 &&
        actual.resistanceOhms <= benchPrototypeDirectWireWeaponLanding.evidenceThresholds.maximumEndToEndResistanceOhms
      )
    })
  ) {
    reasons.push(
      "continuity must prove the exact labeled A, B, and C pigtail-to-pad-to-test-pad paths at no more than 2 ohms"
    )
  }
  const isolation = value.isolation
  const expectedPairs = expectedIsolationPairs()
  if (
    !Array.isArray(isolation) ||
    isolation.length !== expectedPairs.length ||
    !expectedPairs.every((pair, index) => {
      const actual = isolation[index]
      return (
        actual !== undefined &&
        hasExactKeys(actual, ["conductorA", "conductorB", "testVoltageV", "resistanceOhms"]) &&
        actual.conductorA === pair.conductorA &&
        actual.conductorB === pair.conductorB &&
        actual.testVoltageV === benchPrototypeDirectWireWeaponLanding.evidenceThresholds.isolationTestVoltageV &&
        finiteNumber(actual.resistanceOhms) &&
        actual.resistanceOhms >= benchPrototypeDirectWireWeaponLanding.evidenceThresholds.minimumIsolationResistanceOhms
      )
    })
  ) {
    reasons.push("all three A/B/C isolation pairs must meet the 10 Mohm screen at 5 V")
  }
  if (
    !hasExactKeys(value.leadCompensation, ["method", "compensatedLeadResidualOhms"]) ||
    value.leadCompensation.method !== "zeroed-with-same-leads-at-landing" ||
    !finiteNumber(value.leadCompensation.compensatedLeadResidualOhms) ||
    value.leadCompensation.compensatedLeadResidualOhms < 0 ||
    value.leadCompensation.compensatedLeadResidualOhms >
      benchPrototypeDirectWireWeaponLanding.evidenceThresholds.maximumCompensatedLeadResidualOhms
  ) {
    reasons.push("lead compensation must use the same leads at the landing and leave no more than 0.2 ohm residual")
  }
  if (
    !hasExactKeys(value.ncInspection, ["noAdditionalConductors", "prohibitedNetsAbsent"]) ||
    value.ncInspection.noAdditionalConductors !== true ||
    value.ncInspection.prohibitedNetsAbsent !== true
  ) {
    reasons.push("NC inspection must reject extra conductors and every prohibited return, ground, and piste net")
  }
  const negativeTests = value.negativeTests
  if (
    !Array.isArray(negativeTests) ||
    negativeTests.length !== negativeTestIds.length ||
    !negativeTestIds.every((id, index) => {
      const actual = negativeTests[index]
      return (
        actual !== undefined &&
        hasExactKeys(actual, ["id", "result"]) &&
        actual.id === id &&
        actual.result === "rejected"
      )
    })
  ) {
    reasons.push("open, every A/B/C swap, and polarity-orientation reversal must be recorded as rejected")
  }
  return { accepted: reasons.length === 0, reasons }
}

/** Fails closed if this temporary exception drifts from its upstream electrical contracts. */
export function validateBenchPrototypeDirectWireWeaponLanding(
  value: unknown = benchPrototypeDirectWireWeaponLanding
): true {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)
  validateBenchPrototypeWeaponPanelHarness(benchPrototypeWeaponPanelHarness)
  if (!sameCanonicalData(value, benchPrototypeDirectWireWeaponLanding)) {
    throw new RangeError(
      "BP-034 direct-wire landing must retain the canonical cable compatibility, NC policy, assembly, thresholds, negative-test order, and physical-evidence requirements"
    )
  }
  if (
    !isPlainRecord(value) ||
    value.workUnit !== "BP-034" ||
    value.prototypeOnly !== true ||
    value.fabricationDisposition !== "DENY" ||
    value.releaseState !== "deny" ||
    !isPlainRecord(value.normalPower) ||
    value.normalPower.interface !== "USB-C PD" ||
    value.normalPower.unchanged !== true ||
    benchPrototypeContract.fixedInterfaces.usbCPdPower.normalInput !==
      "USB-C PD SPR 20 V at 3 A from an external power adapter" ||
    !isPlainRecord(value.productionSocket) ||
    value.productionSocket.state !== "open" ||
    !isPlainRecord(value.physicalEvidence) ||
    value.physicalEvidence.state !== "open" ||
    !Array.isArray(value.sides) ||
    value.sides.length !== 2
  ) {
    throw new RangeError(
      "BP-034 direct-wire landing must retain its prototype-only, USB-C PD, and open production gates"
    )
  }
  for (const side of ["left", "right"] as const) {
    const actual = value.sides.find((candidate) => isPlainRecord(candidate) && candidate.side === side)
    const actualConductors = isPlainRecord(actual) ? actual.conductors : undefined
    const expected = sideContract(side)
    if (
      expected === undefined ||
      !isPlainRecord(actual) ||
      actual.pigtailId !== expected.pigtailId ||
      actual.boardHarnessReference !== expected.boardHarnessReference ||
      !Array.isArray(actualConductors) ||
      actualConductors.length !== conductors.length ||
      !conductors.every((conductor, index) => {
        const landing = actualConductors[index]
        const expectedLanding = expected.conductors[index]
        return (
          expectedLanding !== undefined &&
          isPlainRecord(landing) &&
          landing.conductor === conductor &&
          landing.boardNet === expectedLanding.boardNet &&
          landing.landingPadReference === expectedLanding.landingPadReference &&
          landing.testPadReference === expectedLanding.testPadReference &&
          landing.boardLabel === expectedLanding.boardLabel &&
          landing.padRule === expectedLanding.padRule &&
          landing.ncRule === expectedLanding.ncRule
        )
      })
    ) {
      throw new RangeError("BP-034 direct-wire landing must retain the exact A/B/C nets, labels, and test references")
    }
    const sideCode = side === "left" ? "L" : "R"
    const topology = weaponInputTopology({
      connectorReference: `J_WEAPON_HARNESS_${sideCode}`,
      connectorEndpointLabels: { a: "WEAPON_A", b: "WEAPON_B", c: "WEAPON_C" }
    })
    if (
      topology.traces[0]?.to !== `U_ESD_${sideCode}.CH_A` ||
      topology.traces[1]?.to !== `U_ESD_${sideCode}.CH_B` ||
      topology.traces[2]?.to !== `U_ESD_${sideCode}.CH_C`
    ) {
      throw new RangeError("BP-034 direct-wire landing must retain the A/B/C ESD-to-front-end topology")
    }
  }
  return true
}

validateBenchPrototypeDirectWireWeaponLanding()
