/** BT-03 fail-closed DUT boundary and switch-matrix evidence contract. */

import { boxTesterInterfaceContract, evaluateBoxTesterInterfaceContract } from "./box-tester-interface-contract.js"
import {
  M405_SOCKETED_ANALOG_FIXTURE_DESIGN,
  validateM405SocketedAnalogFixtureDesign
} from "./m4-05-socketed-analog-fixture.js"

export type BoxTesterDutLimitEvaluation = {
  readonly physicalRunAuthorized: false
  readonly status: "blocked"
  readonly unresolvedGates: readonly string[]
}

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BT-03 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BT-03 data can contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const definition = {
  authority: {
    energizedDutConnectionAuthorized: false,
    faultSurvivalClaim: false,
    physicalRunAuthorized: false,
    scoringAuthority: false,
    testerHardwareApproved: false
  },
  calibrationInputs: {
    capacitance: {
      maximumExpandedUncertaintyPf:
        M405_SOCKETED_ANALOG_FIXTURE_DESIGN.calibration.uncertaintyLimits.capacitance.maximumExpandedUncertaintyPf,
      permittedBankPf: M405_SOCKETED_ANALOG_FIXTURE_DESIGN.canonicalMatrix.capacitancePf
    },
    resistance: {
      maximumExpandedUncertaintyOhms:
        M405_SOCKETED_ANALOG_FIXTURE_DESIGN.calibration.uncertaintyLimits.resistance.maximumExpandedUncertaintyOhms,
      permittedValuesOhms: M405_SOCKETED_ANALOG_FIXTURE_DESIGN.canonicalMatrix.resistanceOhms
    },
    timing: {
      boundaryDisposition: "indeterminate-no-credit",
      maximumExpandedUncertaintyUs: M405_SOCKETED_ANALOG_FIXTURE_DESIGN.timingAcceptance.expandedUncertaintyUs,
      requiredPulseWidthsUs: M405_SOCKETED_ANALOG_FIXTURE_DESIGN.canonicalMatrix.pulseWidthsUs
    }
  },
  dutBoundary: {
    capacitanceAndSwitchParasitics: {
      allocation: "unallocated-pending-measurement",
      requiredEvidence:
        "Measure each selected fixture path at the DUT connector, including cable and switch parasitics, at every selected capacitance bank; do not credit the 500 pF to 10,000 pF bank identity as a measured DUT capacitance."
    },
    delayAndSkew: {
      allocation: "unallocated-pending-measurement",
      requiredEvidence:
        "Measure command-to-contact make/break delay, bounce, and every simultaneous-transition channel skew at the DUT connector. A plus or minus 1 microsecond fixture timing uncertainty makes every rule-boundary observation indeterminate-no-credit."
    },
    guardedFaultSurvival: {
      maximumPulseDurationMilliseconds:
        boxTesterInterfaceContract.voltageCurrentEnvelope.guardedFaultTest.maximumPulseDurationMilliseconds,
      maximumSourceCurrentMicroamps:
        boxTesterInterfaceContract.voltageCurrentEnvelope.guardedFaultTest.maximumSourceCurrentMicroamps,
      maximumSourceEnergyMicrojoules:
        boxTesterInterfaceContract.voltageCurrentEnvelope.guardedFaultTest.maximumSourceEnergyMicrojoules,
      maximumSourceVoltageMillivolts:
        boxTesterInterfaceContract.voltageCurrentEnvelope.guardedFaultTest.maximumAbsoluteVoltageMillivolts,
      result: "unmeasured-no-survival-credit",
      requiredEvidence:
        "Only a separately reviewed and interlocked procedure may capture pre-pulse, pulse, trip, recovery, leakage, rail, reset, and output observations. These source limits do not establish DUT survival."
    },
    leakage: {
      allocation: "unallocated-pending-measurement",
      requiredEvidence:
        "Measure powered and unpowered leakage in both directions at every declared conductor relation and after each guarded exposure. Do not convert a component data-sheet leakage value into a tester or DUT limit."
    },
    lineState: {
      normalMaximumSourceCurrentMicroamps:
        boxTesterInterfaceContract.voltageCurrentEnvelope.normalStimulus.maximumSourceCurrentMicroamps,
      normalMaximumSourceVoltageMillivolts:
        boxTesterInterfaceContract.voltageCurrentEnvelope.normalStimulus.maximumAbsoluteVoltageMillivolts,
      normalMinimumSourceResistanceOhms:
        boxTesterInterfaceContract.voltageCurrentEnvelope.normalStimulus.minimumSourceResistanceOhms,
      result: "unmeasured-no-line-state-credit",
      requiredEvidence:
        "Capture voltage, current, polarity, and relation state at the DUT connector for every selected normal stimulus. The frozen source envelope is a ceiling, not a known DUT operating limit."
    },
    outputSense: {
      allocation: "unallocated-pending-observer-selection",
      requiredEvidence:
        "Select and calibrate an electrical, optical, or acoustic observer, then measure threshold, latency, duration, uncertainty, ambient rejection, and correlation to physical outputs. DUT records remain secondary correlation only."
    },
    unpoweredIsolation: {
      minimumIsolationResistanceOhms: 10_000_000,
      result: "unmeasured-no-isolation-credit",
      testVoltageVolts: 5,
      requiredEvidence:
        "Use the BP-104 project screen as a de-energized measurement precondition for every required isolated relation and no-back-power path. It is not a tester insulation rating or a completed DUT isolation result."
    }
  },
  matrixCoverage: {
    conductorCount: 7,
    minimumTopology: "unselected-pending-coverage-proof",
    requirement:
      "A later coverage proof must show that the selected topology reaches every declared open, closed, cross-line, grounded, resistive, capacitive, pulse, and fault relation while every unselected path remains open. Pair-count arithmetic alone is insufficient.",
    relationFamilies: ["open", "closed", "cross-line", "grounded", "resistive", "capacitive", "pulse", "fault"]
  },
  prerequisites: ["M4-01", "M4-05", "BT-02"],
  sourceProvenance: [
    {
      id: "BP-104",
      sha256: "991D0F862C9DF8749CAA2DA529D9B70A95C98F3A9F5FF4B1D137316608116583",
      sourcePath: "packages/scoring-circuit/src/bench-prototype-fixture-harness.ts"
    }
  ],
  sourceEnvelopes: {
    interfaceContract: "BT-02",
    fixtureContract: "M4-05",
    isolationScreen: "BP-104"
  },
  workUnit: "BT-03"
} as const

export const boxTesterDutLimits = deepFreeze(definition)

/**
 * Validates the immutable planning boundary. It deliberately cannot produce a
 * passing physical result because no measured tester or DUT evidence exists.
 */
export function evaluateBoxTesterDutLimits(value: unknown = boxTesterDutLimits): BoxTesterDutLimitEvaluation {
  evaluateBoxTesterInterfaceContract()
  validateM405SocketedAnalogFixtureDesign(M405_SOCKETED_ANALOG_FIXTURE_DESIGN)
  if (!sameDataGraph(value, boxTesterDutLimits)) {
    throw new RangeError("BT-03 must exactly match the reviewed fail-closed DUT-boundary contract")
  }
  const contract = boxTesterDutLimits
  if (
    contract.workUnit !== "BT-03" ||
    contract.prerequisites.join(",") !== "M4-01,M4-05,BT-02" ||
    contract.sourceProvenance.length !== 1 ||
    contract.sourceProvenance[0].id !== "BP-104" ||
    !/^[0-9A-F]{64}$/u.test(contract.sourceProvenance[0].sha256) ||
    contract.matrixCoverage.conductorCount !== 7 ||
    contract.matrixCoverage.minimumTopology !== "unselected-pending-coverage-proof" ||
    contract.dutBoundary.lineState.normalMaximumSourceVoltageMillivolts !== 2_500 ||
    contract.dutBoundary.lineState.normalMinimumSourceResistanceOhms !== 2_490 ||
    contract.dutBoundary.lineState.normalMaximumSourceCurrentMicroamps !== 1_100 ||
    contract.dutBoundary.guardedFaultSurvival.maximumSourceVoltageMillivolts !== 24_000 ||
    contract.dutBoundary.guardedFaultSurvival.maximumPulseDurationMilliseconds !== 100 ||
    contract.dutBoundary.guardedFaultSurvival.maximumSourceCurrentMicroamps !== 433 ||
    contract.dutBoundary.guardedFaultSurvival.maximumSourceEnergyMicrojoules !== 1_040 ||
    contract.dutBoundary.unpoweredIsolation.testVoltageVolts !== 5 ||
    contract.dutBoundary.unpoweredIsolation.minimumIsolationResistanceOhms !== 10_000_000 ||
    contract.calibrationInputs.resistance.maximumExpandedUncertaintyOhms !== 0.25 ||
    contract.calibrationInputs.capacitance.maximumExpandedUncertaintyPf !== 100 ||
    contract.calibrationInputs.timing.maximumExpandedUncertaintyUs !== 1 ||
    contract.authority.energizedDutConnectionAuthorized ||
    contract.authority.faultSurvivalClaim ||
    contract.authority.physicalRunAuthorized ||
    contract.authority.scoringAuthority ||
    contract.authority.testerHardwareApproved
  ) {
    throw new RangeError("BT-03 must retain source-bound limits and deny unmeasured DUT claims")
  }
  return {
    physicalRunAuthorized: false,
    status: "blocked",
    unresolvedGates: [
      ...Object.values(contract.dutBoundary).map((boundary) => boundary.requiredEvidence),
      contract.matrixCoverage.requirement
    ]
  }
}
