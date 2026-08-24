/**
 * M4-02 candidate clamp and rail-protection calculation.
 *
 * This is a source-backed paper screen for the already-selected BP-102 parts.
 * It is not a schematic, a layout rule release, an energized-test procedure,
 * or permission to apply a fault to an assembled board.
 */

export type M402SourceContract = {
  readonly commit: string
  readonly id: "BP-100" | "BP-101" | "BP-102" | "M0-04"
  readonly sha256: string
  readonly sourcePath: string
}

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-02 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-02 data can contain only data properties")
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
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const sourceResistanceOhms = 2_490
const resistanceBoundaryOhms = 450
const excitationVolts = 2.5
const tpdLeakageMaximumA = 10e-9
const tpdCapacitanceTypicalPf = 0.5
const maximumFixtureCapacitancePf = 10_000
const tmuxChargeInjectionTypicalPc = 1.5
const guardedMinimumResistanceOhms = 56_000 * 0.99

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`)
}

export function calculateM402CandidateScreen(input: {
  readonly lineCapacitancePf: number
  readonly resistanceOhms: number
}): {
  readonly chargeInjectionResistanceErrorOhms: number
  readonly chargeInjectionStepVolts: number
  readonly fiveTauAdditionNs: number
  readonly leakageResistanceErrorOhms: number
  readonly lineTheveninResistanceOhms: number
  readonly resistanceSensitivityVoltsPerOhm: number
  readonly tpdCapacitanceFraction: number
} {
  finitePositive(input.lineCapacitancePf, "lineCapacitancePf")
  if (!Number.isFinite(input.resistanceOhms) || input.resistanceOhms < 0) {
    throw new RangeError("resistanceOhms must be finite and non-negative")
  }
  const denominator = sourceResistanceOhms + input.resistanceOhms
  const lineTheveninResistanceOhms = (sourceResistanceOhms * input.resistanceOhms) / denominator
  const resistanceSensitivityVoltsPerOhm = (excitationVolts * sourceResistanceOhms) / denominator ** 2
  const leakageVoltageErrorVolts = lineTheveninResistanceOhms * tpdLeakageMaximumA
  const chargeInjectionStepVolts = (tmuxChargeInjectionTypicalPc * 1e-12) / (input.lineCapacitancePf * 1e-12)
  return deepFreeze({
    chargeInjectionResistanceErrorOhms: chargeInjectionStepVolts / resistanceSensitivityVoltsPerOhm,
    chargeInjectionStepVolts,
    fiveTauAdditionNs: 5 * lineTheveninResistanceOhms * tpdCapacitanceTypicalPf * 1e-3,
    leakageResistanceErrorOhms: leakageVoltageErrorVolts / resistanceSensitivityVoltsPerOhm,
    lineTheveninResistanceOhms,
    resistanceSensitivityVoltsPerOhm,
    tpdCapacitanceFraction: tpdCapacitanceTypicalPf / input.lineCapacitancePf
  })
}

const boundaryScreen = calculateM402CandidateScreen({
  lineCapacitancePf: maximumFixtureCapacitancePf,
  resistanceOhms: resistanceBoundaryOhms
})
const lowCapacitanceScreen = calculateM402CandidateScreen({
  lineCapacitancePf: 500,
  resistanceOhms: resistanceBoundaryOhms
})

export const M402_CLAMP_RAIL_SOURCE_CONTRACTS = deepFreeze([
  {
    commit: "b7590b03b6f162405690bb8d15aa0cc19799cfa2",
    id: "BP-100",
    sha256: "438983d09aa2dad47f6ff3b49076f3e245f0d8693d469cf5c7601e912ca776ee",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts"
  },
  {
    commit: "b7590b03b6f162405690bb8d15aa0cc19799cfa2",
    id: "BP-101",
    sha256: "ed062898c379110e61ebc321e41901cdcdfd27976b5c11f1b75cd7a76ffb0544",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-reference-drive.ts"
  },
  {
    commit: "b7590b03b6f162405690bb8d15aa0cc19799cfa2",
    id: "BP-102",
    sha256: "cfbd43e9e1e56220522c17ac971ef48cc8675ee7d976eb16290f8274cdc0e289",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-fault-protection.ts"
  },
  {
    commit: "a2a93069fa5d6b0a4adb0fa9903eea9bd3ab7a30",
    id: "M0-04",
    sha256: "034ef363bc9f17f1d682f0e7a6d1bfbd313169cb246d930d31f31db592b28873",
    sourcePath: "apps/scoring/src/processor-fault-containment.ts"
  }
] as const satisfies readonly M402SourceContract[])

const definition = {
  authority: {
    energizedTestAuthorization: false,
    fabricationAuthorized: false,
    railProtectionValidated: false,
    scoringAuthority: false,
    schematicIntegrationAuthorized: false
  },
  calculationStatus: "bounded-paper-screen-with-unbounded-terms-denied",
  candidate: {
    clamp: {
      manufacturer: "Texas Instruments",
      mpn: "TPD4E05U06DQAR",
      primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
      published: {
        clampVoltageAt1A: 10,
        dynamicResistanceTypicalOhms: 0.8,
        ioCapacitanceTypicalPf: tpdCapacitanceTypicalPf,
        ioLeakageMaximumNa: 10,
        surgeCurrent8By20UsA: 2.5
      }
    },
    normalPath:
      "J_FIXTURE LINE -> TPD4E05U06 shunt to SCORING_SGND; LINE -> CRCW060322R0FKEAHP 22 ohm -> TMUX1112 -> ADA4177-1 -> 20 ohm and 1 nF -> ADS8881 AINP",
    protectedRailBoundary: {
      analog: "ADA4177-1 on S5V_ISOLATED and S5V_NEG; ADS8881 is the acquisition endpoint",
      mcu: "No connector LINE to STM32 pin path is selected by this paper candidate; any later direct path must remain at zero positive injection on FT_xxx, TT_xx, and NRST pins.",
      power:
        "USB-C PD remains the normal apparatus input; LAB_POST_EFUSE_20V remains a de-energized-selection laboratory-only input. This candidate adds no VBUS, CC, or USB-C PD rail connection.",
      return:
        "TPD4E05U06 ground pins return directly to SCORING_SGND; the reserved third fixture pin remains electrically unconnected."
    },
    seriesResistor: {
      manufacturer: "Vishay",
      mpn: "CRCW060322R0FKEAHP",
      primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
      resistanceOhms: 22
    }
  },
  mcuInjectionLimits: {
    candidatePredictedInjectionA: 0,
    candidatePredictionBasis:
      "No connector LINE-to-STM32 electrical path is present in the candidate boundary; this is not an assembled-board measurement.",
    negativePerPinMaximumA: 0.005,
    positivePerPinMaximumA: 0,
    primaryEvidenceUrl: "https://www.st.com/resource/en/datasheet/stm32g474rc.pdf",
    totalAbsoluteInjectedCurrentA: 0.025
  },
  requiredEvidence: [
    "At powered and unpowered cold, ambient, and hot corners, capture LINE, post-TPD, ADA4177 input and output, ADS8881 AINP, S5V_ISOLATED, S5V_NEG, ADS8881 DVDD, and every STM32-facing digital line.",
    "For each permitted guarded pulse, record clamp-current return path and rail current with the BP-102 interlock, current-trip, mutual-exclusion, stop-condition, and ten-second inter-pulse requirements.",
    "Measure post-pulse leakage, rail startup, reference recovery, ADC code validity, STM32 reset state, and all STM32-facing pins before any candidate may receive schematic or fabrication review.",
    "Use an IEC 61000-4-2, IEC 61000-4-4, and IEC 61000-4-5 test plan only after an independent safety review. The published TPD ratings do not establish assembled-board compliance or survival."
  ],
  screens: {
    capacitance: {
      maximumFixtureCapacitancePf,
      publishedValueIsTypicalOnly: true,
      screen: structuredClone(boundaryScreen),
      status: "no-maximum-capacitance-credit"
    },
    chargeInjection: {
      lowCapacitance500Pf: lowCapacitanceScreen,
      publishedValueIsTypicalOnly: true,
      source: {
        mpn: "TMUX1112PWR",
        primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf",
        typicalPc: tmuxChargeInjectionTypicalPc
      },
      status: "no-polarity-temperature-or-layout-credit"
    },
    guardedSource: {
      maximum24V100MsCurrentA: 24 / guardedMinimumResistanceOhms,
      maximum24V100MsEnergyJ: (24 ** 2 / guardedMinimumResistanceOhms) * 0.1,
      maximum24V100MsPowerW: 24 ** 2 / guardedMinimumResistanceOhms,
      status: "source-envelope-only-no-downstream-survival-credit"
    },
    leakage: {
      boundaryResistanceOhms: resistanceBoundaryOhms,
      screen: structuredClone(boundaryScreen),
      status: "10-na-at-5.5-v-published-bound-used-conservatively-at-2.5-v"
    },
    surgePath: {
      path: "connector LINE -> TPD4E05U06 -> direct SCORING_SGND return; 22 ohm normal path then reaches the OVP buffer",
      publishedAt1AClampVoltageV: 10,
      published8By20UsSurgeCurrentA: 2.5,
      status: "no-2.5-a-clamp-voltage-or-board-survival-extrapolation"
    }
  },
  sourceContracts: structuredClone(M402_CLAMP_RAIL_SOURCE_CONTRACTS),
  workUnit: "M4-02"
} as const

export const M402_CLAMP_RAIL_PROTECTION_CANDIDATE = deepFreeze(definition)

/** Reject altered calculations, invented maximums, and any release escalation. */
export function validateM402ClampRailProtectionCandidate(value: unknown): true {
  if (!sameDataGraph(value, M402_CLAMP_RAIL_PROTECTION_CANDIDATE)) {
    throw new RangeError("M4-02 candidate must exactly match the reviewed clamp and rail-protection paper screen")
  }
  const candidate = M402_CLAMP_RAIL_PROTECTION_CANDIDATE
  if (
    candidate.workUnit !== "M4-02" ||
    candidate.candidate.clamp.mpn !== "TPD4E05U06DQAR" ||
    candidate.candidate.seriesResistor.resistanceOhms !== 22 ||
    !candidate.screens.capacitance.publishedValueIsTypicalOnly ||
    !candidate.screens.chargeInjection.publishedValueIsTypicalOnly ||
    candidate.mcuInjectionLimits.positivePerPinMaximumA !== 0 ||
    candidate.mcuInjectionLimits.candidatePredictedInjectionA !== 0 ||
    candidate.authority.energizedTestAuthorization ||
    candidate.authority.fabricationAuthorized ||
    candidate.authority.railProtectionValidated ||
    candidate.authority.scoringAuthority ||
    candidate.authority.schematicIntegrationAuthorized ||
    candidate.candidate.protectedRailBoundary.power.includes("USB-C PD remains") === false
  ) {
    throw new RangeError("M4-02 must retain bounded assumptions, USB-C PD, and denied physical authority")
  }
  return true
}
