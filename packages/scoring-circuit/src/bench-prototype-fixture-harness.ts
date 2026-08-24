/**
 * BP-104 freezes the seven-channel bench fixture harness interface.
 *
 * This is a schematic and de-energized bench-test input only. It does not
 * release a footprint, harness drawing, or fabrication build.
 */

import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"
import { parseCanonicalUtcTimestamp, parseRealUtcDate } from "./bench-prototype-evidence-time.js"
import {
  benchPrototypeSevenChannelAnalog,
  validateBenchPrototypeSevenChannelAnalog
} from "./bench-prototype-seven-channel-analog.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-104 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-104 may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
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
    return expected.every((entry, index) => sameDataGraph(actual[index], entry, seen))
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const conductorOrder = [
  "LEFT_WEAPON_A",
  "LEFT_WEAPON_B",
  "LEFT_WEAPON_C",
  "RIGHT_WEAPON_A",
  "RIGHT_WEAPON_B",
  "RIGHT_WEAPON_C",
  "PISTE"
] as const

const pinMap = [
  {
    boardPin: 1,
    circuit: 1,
    signal: "LEFT_WEAPON_A",
    label: "LEFT WEAPON A",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "LEFT_WEAPON_A",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 2,
    circuit: 2,
    signal: "LEFT_WEAPON_B",
    label: "LEFT WEAPON B",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "LEFT_WEAPON_B",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 3,
    circuit: 3,
    signal: "LEFT_WEAPON_C",
    label: "LEFT WEAPON C",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "LEFT_WEAPON_C",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 4,
    circuit: 4,
    signal: "RIGHT_WEAPON_A",
    label: "RIGHT WEAPON A",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "RIGHT_WEAPON_A",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 5,
    circuit: 5,
    signal: "RIGHT_WEAPON_B",
    label: "RIGHT WEAPON B",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "RIGHT_WEAPON_B",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 6,
    circuit: 6,
    signal: "RIGHT_WEAPON_C",
    label: "RIGHT WEAPON C",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "RIGHT_WEAPON_C",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 7,
    circuit: 7,
    signal: "PISTE",
    label: "PISTE",
    disposition: "scored-conductor",
    populated: true,
    boardNet: "PISTE",
    terminalMpn: "43030-0007"
  },
  {
    boardPin: 8,
    circuit: 8,
    signal: "PISTE_RETURN",
    label: "PISTE RETURN REVIEW",
    disposition: "return-review-required",
    populated: false,
    boardNet: null,
    terminalMpn: null
  },
  {
    boardPin: 9,
    circuit: 9,
    signal: "FIXTURE_RETURN_REVIEW_REQUIRED",
    label: "FIXTURE RETURN REVIEW",
    disposition: "return-review-required",
    populated: false,
    boardNet: null,
    terminalMpn: null
  },
  {
    boardPin: 10,
    circuit: 10,
    signal: "ESD_RETURN_REVIEW_REQUIRED",
    label: "ESD RETURN REVIEW",
    disposition: "return-review-required",
    populated: false,
    boardNet: null,
    terminalMpn: null
  },
  {
    boardPin: 11,
    circuit: 11,
    signal: "NC",
    label: "NC",
    disposition: "NC-unpopulated",
    populated: false,
    boardNet: null,
    terminalMpn: null
  },
  {
    boardPin: 12,
    circuit: 12,
    signal: "NC",
    label: "NC",
    disposition: "NC-unpopulated",
    populated: false,
    boardNet: null,
    terminalMpn: null
  }
] as const

const continuityMap = pinMap.map((pin) => ({
  boardPin: pin.boardPin,
  harnessCircuit: pin.circuit,
  signal: pin.signal,
  expected:
    pin.disposition === "scored-conductor"
      ? "one-to-one continuity to the identically labeled fixture conductor"
      : "open; no board net, terminal, or shared return is permitted before review",
  deenergizedOnly: true,
  required: true
}))

/** Project bench-screen limits, not Molex connector ratings. */
export const benchPrototypeContinuityThresholds = deepFreeze({
  maxEndToEndResistanceOhms: 2,
  minimumIsolationResistanceOhms: 10_000_000,
  isolationTestVoltageV: 5,
  maximumLeadCompensationOhms: 0.2
})

export type BenchPrototypeContinuityEvidence = {
  readonly artifactKind: "bench-prototype-fixture-continuity-evidence"
  readonly evidenceId: string
  readonly status: "measured"
  readonly recordedAtUtc: string
  readonly operator: string
  readonly boardId: string
  readonly harnessId: string
  readonly testPlugMpn: "44242-0005"
  readonly equipment: {
    readonly manufacturer: string
    readonly model: string
    readonly serialNumber: string
    readonly calibrationCertificate: string
    readonly calibrationDueDate: string
  }
  readonly method: {
    readonly powerState: "off-and-discharged"
    readonly continuityTestVoltageV: number
    readonly isolationTestVoltageV: 5
    readonly leadCompensationMethod: "zeroed-with-same-leads-at-fixture"
    readonly compensatedLeadResidualOhms: number
  }
  readonly endToEnd: readonly {
    readonly boardPin: number
    readonly harnessCircuit: number
    readonly signal: string
    readonly resistanceOhms: number
  }[]
  readonly isolation: readonly {
    readonly boardPinA: number
    readonly boardPinB: number
    readonly resistanceOhms: number
    readonly testVoltageV: 5
  }[]
  readonly openCircuitChecks: readonly {
    readonly boardPin: number
    readonly harnessCircuit: number
    readonly resistanceOhms: number
  }[]
  readonly negativeTests: readonly {
    readonly id: "BP104-NEG-SWAP" | "BP104-NEG-OPEN" | "BP104-NEG-RETURN-BOND" | "BP104-NEG-REVERSED-MATE"
    readonly result: "rejected"
    readonly observation: string
  }[]
}

export type BenchPrototypeContinuityEvaluation = {
  readonly accepted: boolean
  readonly reasons: readonly string[]
}

const requiredNegativeTestIds = [
  "BP104-NEG-SWAP",
  "BP104-NEG-OPEN",
  "BP104-NEG-RETURN-BOND",
  "BP104-NEG-REVERSED-MATE"
] as const

const requiredIsolationPairs = Array.from({ length: 12 }, (_, index) => index + 1).flatMap((boardPinA) =>
  Array.from({ length: 12 - boardPinA }, (_, offset) => ({ boardPinA, boardPinB: boardPinA + offset + 1 }))
)

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

export function evaluateBenchPrototypeContinuityEvidence(value: unknown): BenchPrototypeContinuityEvaluation {
  const reasons: string[] = []
  if (!isPlainRecord(value)) return { accepted: false, reasons: ["evidence must be a plain data record"] }
  const recordedAt = parseCanonicalUtcTimestamp(value.recordedAtUtc)
  if (value.artifactKind !== "bench-prototype-fixture-continuity-evidence") reasons.push("artifact kind is invalid")
  if (!nonEmptyString(value.evidenceId)) reasons.push("evidenceId is required")
  if (value.status !== "measured") reasons.push("status must be measured")
  if (recordedAt === null) reasons.push("recordedAtUtc must be a real UTC ISO timestamp")
  if (!nonEmptyString(value.operator) || !nonEmptyString(value.boardId) || !nonEmptyString(value.harnessId)) {
    reasons.push("operator, boardId, and harnessId are required")
  }
  if (value.testPlugMpn !== "44242-0005") reasons.push("continuity must use the exact 12-circuit 44242-0005 test plug")

  const equipment = value.equipment
  let calibrationDueDate: Date | null = null
  if (!isPlainRecord(equipment)) {
    reasons.push("equipment calibration provenance is required")
  } else {
    if (
      !nonEmptyString(equipment.manufacturer) ||
      !nonEmptyString(equipment.model) ||
      !nonEmptyString(equipment.serialNumber)
    ) {
      reasons.push("equipment manufacturer, model, and serial number are required")
    }
    calibrationDueDate = parseRealUtcDate(equipment.calibrationDueDate)
    if (!nonEmptyString(equipment.calibrationCertificate) || calibrationDueDate === null) {
      reasons.push("equipment calibration certificate and real ISO due date are required")
    }
  }
  if (
    recordedAt !== null &&
    calibrationDueDate !== null &&
    calibrationDueDate.getTime() <
      Date.UTC(recordedAt.getUTCFullYear(), recordedAt.getUTCMonth(), recordedAt.getUTCDate())
  ) {
    reasons.push("calibration due date must be on or after the measurement date")
  }

  const method = value.method
  if (!isPlainRecord(method)) {
    reasons.push("reproducible de-energized method and lead compensation are required")
  } else {
    if (method.powerState !== "off-and-discharged") reasons.push("continuity must be measured off and discharged")
    if (
      !finiteNumber(method.continuityTestVoltageV) ||
      method.continuityTestVoltageV <= 0 ||
      method.continuityTestVoltageV > 5
    ) {
      reasons.push("continuity test voltage must be greater than 0 V and no more than 5 V")
    }
    if (method.isolationTestVoltageV !== benchPrototypeContinuityThresholds.isolationTestVoltageV) {
      reasons.push("isolation test voltage must be the declared 5 V project screen")
    }
    if (method.leadCompensationMethod !== "zeroed-with-same-leads-at-fixture") {
      reasons.push("lead compensation must be zeroed with the same leads at the fixture")
    }
    if (
      !finiteNumber(method.compensatedLeadResidualOhms) ||
      method.compensatedLeadResidualOhms < 0 ||
      method.compensatedLeadResidualOhms > benchPrototypeContinuityThresholds.maximumLeadCompensationOhms
    ) {
      reasons.push("compensated lead residual exceeds the declared project screen")
    }
  }

  const endToEnd = value.endToEnd
  if (!Array.isArray(endToEnd) || endToEnd.length !== conductorOrder.length) {
    reasons.push("exactly seven scored-conductor end-to-end readings are required")
  } else {
    endToEnd.forEach((reading, index) => {
      if (!isPlainRecord(reading)) {
        reasons.push(`end-to-end reading ${index + 1} is not a data record`)
        return
      }
      if (
        reading.boardPin !== index + 1 ||
        reading.harnessCircuit !== index + 1 ||
        reading.signal !== conductorOrder[index] ||
        !finiteNumber(reading.resistanceOhms) ||
        reading.resistanceOhms < 0 ||
        reading.resistanceOhms > benchPrototypeContinuityThresholds.maxEndToEndResistanceOhms
      ) {
        reasons.push(`end-to-end reading ${index + 1} does not meet the BP-104 order or resistance screen`)
      }
    })
  }

  const isolation = value.isolation
  if (!Array.isArray(isolation) || isolation.length !== requiredIsolationPairs.length) {
    reasons.push("all 66 unique pin-pair isolation readings are required")
  } else {
    requiredIsolationPairs.forEach((pair, index) => {
      const reading = isolation[index]
      if (
        !isPlainRecord(reading) ||
        reading.boardPinA !== pair.boardPinA ||
        reading.boardPinB !== pair.boardPinB ||
        reading.testVoltageV !== benchPrototypeContinuityThresholds.isolationTestVoltageV ||
        !finiteNumber(reading.resistanceOhms) ||
        reading.resistanceOhms < benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms
      ) {
        reasons.push(`isolation reading ${index + 1} does not meet the BP-104 pair or resistance screen`)
      }
    })
  }

  const openCircuitChecks = value.openCircuitChecks
  if (!Array.isArray(openCircuitChecks) || openCircuitChecks.length !== 5) {
    reasons.push("open-circuit checks for pins 8-12 are required")
  } else {
    openCircuitChecks.forEach((reading, index) => {
      if (
        !isPlainRecord(reading) ||
        reading.boardPin !== index + 8 ||
        reading.harnessCircuit !== index + 8 ||
        !finiteNumber(reading.resistanceOhms) ||
        reading.resistanceOhms < benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms
      ) {
        reasons.push(`open-circuit check ${index + 8} does not meet the BP-104 screen`)
      }
    })
  }

  const negativeTests = value.negativeTests
  if (!Array.isArray(negativeTests) || negativeTests.length !== requiredNegativeTestIds.length) {
    reasons.push("all four BP-104 negative tests are required")
  } else {
    requiredNegativeTestIds.forEach((id, index) => {
      const negativeTest = negativeTests[index]
      if (
        !isPlainRecord(negativeTest) ||
        negativeTest.id !== id ||
        negativeTest.result !== "rejected" ||
        !nonEmptyString(negativeTest.observation)
      ) {
        reasons.push(`negative test ${id} must have a recorded rejected result`)
      }
    })
  }

  return { accepted: reasons.length === 0, reasons }
}

const definition = {
  artifactKind: "bench-prototype-fixture-harness-contract",
  workUnit: "BP-104",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  schematicInputOnly: true,
  layoutRelease: false,
  fabricationDisposition: "DENY",
  releaseState: "deny",
  prerequisites: {
    boardBoundary: {
      workUnit: "BP-010",
      contract: "benchPrototypeContract",
      rule: "J_WEAPON_FIXTURE is a bench fixture interface only"
    },
    analogArchitecture: {
      workUnit: "BP-103",
      contract: "benchPrototypeSevenChannelAnalog",
      rule: "connector pin order follows the reviewed seven-channel order"
    }
  },
  connector: {
    boardReference: "J_WEAPON_FIXTURE",
    bomReference: "J_WEAPON_HARNESS",
    header: {
      manufacturer: "Molex",
      mpn: "43045-1200",
      family: "Micro-Fit 3.0 dual-row, twelve-circuit, right-angle through-hole header",
      positions: 12,
      rows: 2,
      pitchMm: 3,
      orientation: "right-angle",
      mounting: "through-hole",
      keyingToMatingPart: "No",
      polarizedToMatingPart: true,
      lockToMatingPart: true,
      selectionStatus: "candidate-orderable",
      circuitOneRule:
        "Use the manufacturer circuit-1 identifier and the component-side drawing; do not mirror the two-row pattern."
    },
    mate: {
      manufacturer: "Molex",
      mpn: "43025-1200",
      family: "Micro-Fit 3.0 dual-row, twelve-circuit receptacle housing for 43030-0007 female terminals",
      positions: 12,
      rows: 2,
      pitchMm: 3,
      terminalMpn: "43030-0007",
      terminalForm: "loose-form A female crimp terminal, 20-24 AWG",
      keyingToMatingPart: "No",
      polarizedToMatingPart: true,
      lockToMatingPart: true,
      selectionStatus: "candidate-orderable",
      matingRule:
        "Align the manufacturer circuit-1 identifier and cavity 1, then fully seat the latch/lock; populate and crimp only the seven scored conductors until return review authorizes another cavity."
    },
    testPlug: {
      manufacturer: "Molex",
      series: "44242",
      mpn: "44242-0005",
      materialNumber: "442420005",
      family: "Micro-Fit 3.0 test plug, dual row, 12 circuits",
      positions: 12,
      rows: 2,
      pitchMm: 3,
      keyingToMatingPart: "No",
      polarizedToMatingPart: false,
      lockToMatingPart: true,
      use: "continuity and miswire probing only; never a production harness or powered mate",
      availability: "check-availability",
      sampleEligible: false,
      selectionStatus: "candidate-orderable; availability and acquisition remain open",
      sourceUrls: [
        "https://www.molex.com/en-us/products/series-chart/44242",
        "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/442/44242/442420001_sd.pdf",
        "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/productspecificationpdf/203/203951/2039510000-PS-000.pdf"
      ]
    },
    conductorOrder,
    pinMap,
    labels: {
      boardSilkscreen: "J_WEAPON_FIXTURE, pin-1 marker, and labels 1-12 must be legible from the fixture side",
      harnessLabels: [
        ...conductorOrder,
        "PISTE RETURN REVIEW",
        "FIXTURE RETURN REVIEW",
        "ESD RETURN REVIEW",
        "NC",
        "NC"
      ],
      labelRule:
        "Labels identify the named signal, not only a color; pin 1, the latch/lock, and the independent fixture stop must be visible."
    },
    returnPolicy: {
      scoredReturnNet: "SCORING_SGND",
      scoredReturnBondedToConnector: false,
      sharedReturnAllowed: false,
      reviewOnlySignals: ["PISTE_RETURN", "FIXTURE_RETURN_REVIEW_REQUIRED", "ESD_RETURN_REVIEW_REQUIRED"],
      rule: "No connector pin is a shared return. Return candidates remain separate, unpopulated, and unbonded until a reviewed schematic assigns each one explicitly."
    },
    continuityMap,
    matingOrientation: {
      keyingToMatingPart: "No",
      polarizedToMatingPart: true,
      lockToMatingPart: true,
      pinOne:
        "Align board circuit 1 with harness cavity 1 using the manufacturer circuit-1 identifier and verify the pin-1 marker before inserting terminals.",
      reversalPrevention:
        "The production 43025-1200 to 43045-1200 interface is polarized to its mating part and has a latch/lock; an independent fixture stop and visible labels remain mandatory to reject reversed, offset, or half-seated mating.",
      fixtureStopRequired: true,
      energizedMating: false,
      evidenceStatus: "open"
    },
    continuityAcceptance: {
      status: "unresolved",
      evaluator: "evaluateBenchPrototypeContinuityEvidence",
      testPlugMpn: "44242-0005",
      method: "de-energized four-wire or zeroed two-wire measurement with the same leads at the fixture",
      thresholds: {
        maxEndToEndResistanceOhms: 2,
        minimumIsolationResistanceOhms: 10_000_000,
        isolationTestVoltageV: 5,
        maximumLeadCompensationOhms: 0.2
      },
      requiredProvenance:
        "evidenceId, UTC timestamp, operator, board and harness IDs, instrument manufacturer/model/serial, calibration certificate and due date",
      negativeTests: ["BP104-NEG-SWAP", "BP104-NEG-OPEN", "BP104-NEG-RETURN-BOND", "BP104-NEG-REVERSED-MATE"],
      acceptanceRule:
        "Acceptance remains unresolved until evaluateBenchPrototypeContinuityEvidence returns accepted true for seven end-to-end readings, 66 unique pin-pair isolation readings, five open-circuit readings for pins 8-12, and four recorded rejected negative tests."
    },
    sampleFitProcedure: {
      purpose:
        "one non-forced 43025-1200 to 43045-1200 sample-fit check only; it is separate from continuity and miswire probing",
      steps: [
        "Power off, remove every source, discharge the board, and verify no rail remains energized.",
        "Align circuit 1 and the independent fixture stop, insert the polarized 43025-1200 mate without force, and verify full latch/lock seating.",
        "Remove the mate while de-energized and record insertion, latch, extraction, and any interference result; reject any forced, offset, or partial mate."
      ],
      continuityUsesTestPlug: "44242-0005 only",
      status: "unresolved"
    },
    strainRelief: {
      required: true,
      selectionStatus: "open",
      method:
        "Use a fixture clamp or approved cable strain relief so pull and bend loads bypass the crimp and PCB solder joints.",
      rule: "Do not accept a harness for continuity or weapon testing until the clamp, bend path, terminal retention, and header retention are visually recorded."
    }
  },
  miswireTestPlan: [
    {
      id: "BP104-CONT-01",
      test: "Use the Molex 44242-0005 12-circuit test plug for de-energized point-to-point continuity from board pins 1-7 to the matching labeled harness conductors.",
      expected:
        "Exactly one conductor per scored signal; no swapped or shorted pair; do not use 43045-1200 as a test plug."
    },
    {
      id: "BP104-CONT-02",
      test: "Use the 44242-0005 test plug to probe all 66 unique pin pairs and pins 8-12 individually while the board is off and discharged.",
      expected:
        "Every pin pair meets the project isolation screen; pins 8-10 remain open and unassigned; pins 11-12 remain open and unpopulated."
    },
    {
      id: "BP104-MISWIRE-01",
      test: "Use the 44242-0005 test plug to run an intentional adjacent-pair swap and an open-conductor mutation through the fixture checker.",
      expected: "The checker identifies the exact expected signal and rejects the harness before energization."
    },
    {
      id: "BP104-MISWIRE-02",
      test: "Perform one non-forced 43025-1200 to 43045-1200 sample-fit check, then attempt reversed, offset, and half-seated mating while de-energized.",
      expected:
        "The independent fixture stop, labels, and latch/lock reject unsafe orientation; no force or powered mating is allowed."
    },
    {
      id: "BP104-RETURN-01",
      test: "Use the 44242-0005 test plug to measure candidate returns (8-10), scored conductors, and SCORING_SGND, recording the typed isolation evidence.",
      expected:
        "No unreviewed return bond or shared return exists; reject any continuity not explicitly approved in a later schematic."
    }
  ],
  evidence: {
    selectedParts: "candidate-orderable",
    manufacturerDrawings: "open",
    sampleFit: "open",
    terminalCrimpAndRetention: "open",
    harnessContinuity: "open",
    miswireRejection: "open",
    strainRelief: "open",
    statement: "No physical sample, fit, continuity, crimp, or miswire result is claimed by BP-104."
  },
  authority: {
    exactSelectionFrozen: true,
    schematicIntegrationApproved: false,
    footprintEvidenceApproved: false,
    sampleFitApproved: false,
    continuityVerified: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  openGates: [
    "Import the exact Molex 43045-1200 footprint and verify circuit 1, retention pegs, edge placement, courtyard, and the 43025-1200 mating envelope against the manufacturer drawing.",
    "Acquire one 43045-1200 header, one 43025-1200 housing, seven 43030-0007 terminals, and the exact Molex 44242-0005 continuity test plug; record cavity numbering, latch/lock seating, insertion depth, terminal retention, and crimp evidence.",
    "Keep continuity and miswire testing on the 44242-0005 test plug; perform only one non-forced 43025-1200 to 43045-1200 sample-fit check and do not use the production header as a test plug.",
    "Keep pins 8-10 unpopulated until a reviewed schematic assigns separate return nets; never create a shared fixture, ESD, piste, or SCORING_SGND return through this connector.",
    "Build and photograph the pin-1 labels, polarized latch/lock orientation, independent fixture stop, and strain-relief load path before any continuity test.",
    "Execute the typed de-energized continuity evaluator with equipment calibration and lead-compensation provenance, archive the map and rejected-fault results, and keep fabrication DENY until all evidence is accepted."
  ],
  sources: [
    {
      title: "Molex 43045-1200",
      url: "https://www.molex.com/en-us/products/part-detail/43045-1200"
    },
    {
      title: "Molex 43025-1200",
      url: "https://www.molex.com/en-us/products/part-detail/0430251200"
    },
    {
      title: "Molex 43045 series chart",
      url: "https://www.molex.com/en-us/products/series-chart/43045"
    },
    {
      title: "Molex 43025 series chart",
      url: "https://www.molex.com/en-us/products/series-chart/43025"
    },
    {
      title: "Molex 43030-0007",
      url: "https://www.molex.com/en-us/products/part-detail/430300007"
    },
    {
      title: "Molex 44242-0005 Micro-Fit 3.0 12-circuit test plug",
      url: "https://www.molex.com/en-us/products/series-chart/44242"
    },
    {
      title: "Molex SD-44242-001 test-plug drawing",
      url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/442/44242/442420001_sd.pdf"
    },
    { title: "BP-010 board boundary", url: "src/bench-prototype-contract.ts" },
    { title: "BP-103 seven-channel analog architecture", url: "src/bench-prototype-seven-channel-analog.ts" }
  ]
} as const

export const benchPrototypeFixtureHarness = deepFreeze(definition)

const upstreamSnapshot = deepFreeze({
  fixture: structuredClone(benchPrototypeContract.fixedInterfaces.weaponFixture),
  order: structuredClone(benchPrototypeSevenChannelAnalog.channelOrder),
  channels: structuredClone(
    benchPrototypeSevenChannelAnalog.channels.map((channel) => ({
      conductor: channel.conductor,
      connectorNet: channel.connectorNet
    }))
  )
})

function assertUpstreamContracts(): void {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeSevenChannelAnalog(benchPrototypeSevenChannelAnalog)

  const liveUpstream = {
    fixture: benchPrototypeContract.fixedInterfaces.weaponFixture,
    order: benchPrototypeSevenChannelAnalog.channelOrder,
    channels: benchPrototypeSevenChannelAnalog.channels.map((channel) => ({
      conductor: channel.conductor,
      connectorNet: channel.connectorNet
    }))
  }
  if (!sameDataGraph(liveUpstream, upstreamSnapshot)) {
    throw new RangeError("BP-010 or BP-103 fixture/channel evidence drifted")
  }
  if (
    !sameDataGraph(benchPrototypeFixtureHarness.connector.conductorOrder, conductorOrder) ||
    !sameDataGraph(
      benchPrototypeSevenChannelAnalog.channels.map((channel) => channel.conductor),
      benchPrototypeFixtureHarness.connector.conductorOrder
    )
  ) {
    throw new RangeError("BP-104 connector order does not match BP-103 channel order")
  }
}

export function validateBenchPrototypeFixtureHarness(value: unknown): true {
  assertUpstreamContracts()
  if (!sameDataGraph(value, benchPrototypeFixtureHarness)) {
    throw new RangeError("BP-104 fixture harness must exactly match the reviewed fail-closed contract")
  }

  const contract = benchPrototypeFixtureHarness
  const connector = contract.connector
  const scoredPins = connector.pinMap.filter((pin) => pin.disposition === "scored-conductor")
  const returnPins = connector.pinMap.filter((pin) => pin.disposition === "return-review-required")
  const ncPins = connector.pinMap.filter((pin) => pin.disposition === "NC-unpopulated")
  if (
    connector.header.mpn !== "43045-1200" ||
    connector.mate.mpn !== "43025-1200" ||
    connector.mate.terminalMpn !== "43030-0007" ||
    connector.header.keyingToMatingPart !== "No" ||
    connector.header.polarizedToMatingPart !== true ||
    connector.header.lockToMatingPart !== true ||
    connector.mate.keyingToMatingPart !== "No" ||
    connector.mate.polarizedToMatingPart !== true ||
    connector.mate.lockToMatingPart !== true ||
    connector.header.positions !== 12 ||
    connector.mate.positions !== 12 ||
    connector.pinMap.length !== 12 ||
    scoredPins.length !== 7 ||
    returnPins.length !== 3 ||
    ncPins.length !== 2 ||
    connector.testPlug.mpn !== "44242-0005" ||
    connector.testPlug.materialNumber !== "442420005" ||
    connector.testPlug.positions !== 12 ||
    connector.testPlug.rows !== 2 ||
    connector.testPlug.availability !== "check-availability" ||
    connector.testPlug.sampleEligible ||
    connector.testPlug.polarizedToMatingPart ||
    connector.testPlug.keyingToMatingPart !== "No" ||
    !connector.testPlug.lockToMatingPart ||
    !sameDataGraph(
      scoredPins.map((pin) => pin.signal),
      conductorOrder
    ) ||
    !sameDataGraph(
      connector.continuityMap.map((entry) => entry.boardPin),
      Array.from({ length: 12 }, (_, index) => index + 1)
    ) ||
    connector.returnPolicy.scoredReturnBondedToConnector ||
    connector.returnPolicy.sharedReturnAllowed ||
    connector.returnPolicy.reviewOnlySignals.length !== 3 ||
    connector.matingOrientation.polarizedToMatingPart !== true ||
    connector.matingOrientation.keyingToMatingPart !== "No" ||
    !connector.matingOrientation.lockToMatingPart ||
    !connector.matingOrientation.fixtureStopRequired ||
    connector.matingOrientation.energizedMating ||
    connector.continuityAcceptance.status !== "unresolved" ||
    connector.continuityAcceptance.testPlugMpn !== "44242-0005" ||
    connector.continuityAcceptance.thresholds.maxEndToEndResistanceOhms !==
      benchPrototypeContinuityThresholds.maxEndToEndResistanceOhms ||
    connector.continuityAcceptance.thresholds.minimumIsolationResistanceOhms !==
      benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms ||
    connector.continuityAcceptance.thresholds.isolationTestVoltageV !==
      benchPrototypeContinuityThresholds.isolationTestVoltageV ||
    connector.continuityAcceptance.thresholds.maximumLeadCompensationOhms !==
      benchPrototypeContinuityThresholds.maximumLeadCompensationOhms ||
    !connector.strainRelief.required ||
    contract.authority.fabricationAuthorized ||
    contract.authority.releaseState !== "deny" ||
    contract.fabricationDisposition !== "DENY" ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-104 pin order, return isolation, mating, or release gate is invalid")
  }
  if (
    connector.pinMap.slice(7).some((pin) => pin.populated || pin.boardNet !== null || pin.terminalMpn !== null) ||
    connector.pinMap.slice(0, 7).some((pin, index) => pin.signal !== conductorOrder[index] || !pin.populated) ||
    connector.continuityMap.slice(0, 7).some((entry) => !entry.expected.startsWith("one-to-one continuity")) ||
    connector.continuityMap.slice(7).some((entry) => !entry.expected.startsWith("open;")) ||
    contract.evidence.sampleFit !== "open" ||
    contract.evidence.harnessContinuity !== "open" ||
    contract.authority.sampleFitApproved ||
    contract.authority.continuityVerified ||
    contract.connector.sampleFitProcedure.status !== "unresolved"
  ) {
    throw new RangeError("BP-104 populated conductors, NC/return openings, or evidence state is invalid")
  }
  return true
}

validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)
