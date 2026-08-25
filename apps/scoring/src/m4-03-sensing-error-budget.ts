/**
 * M4-03 source, sink, resistor, reference, and ADC threshold-error budget.
 *
 * This is a bounded paper calculation for the selected one-channel path. It
 * records the calibration measurements that must be accepted by M4-08; it
 * does not authorize a schematic, coupon, energized test, or scoring result.
 */

export type M403SourceContract = {
  readonly commit: string
  readonly currentSha256: string
  readonly id: "BP-100" | "BP-101" | "M4-01" | "M4-02"
  readonly sha256: string
  readonly sourcePath: string
}

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-03 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-03 data can contain only data properties")
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
const excitationAndAdcReferenceVolts = 2.5
const sourceResistorTolerance = 0.001
const sourceResistorTcrPpmPerC = 25
const sourceSwitchResistanceMaximumOhms = 9.8
const adcBits = 18
const adcIntegralLinearityMaximumLsb = 3
const adcInputLeakageMaximumNa = 5
const adcOffsetDriftMaximumUvPerC = 1.5
const bufferOffsetMaximumUv = 120
const bufferInputBiasMaximumNa = 1
const fixtureTargetHalfWidthOhms = 5
const calibrationTemperatureC = 25
const minimumModeledResistanceOhms = 0
const maximumModeledResistanceOhms = 500
const minimumModeledTemperatureC = -40
const maximumModeledTemperatureC = 125

function finiteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative`)
}

function modeledCornerInput(input: { readonly resistanceOhms: number; readonly temperatureC: number }): void {
  finiteNonNegative(input.resistanceOhms, "resistanceOhms")
  if (input.resistanceOhms > maximumModeledResistanceOhms) {
    throw new RangeError(`resistanceOhms must be at most ${maximumModeledResistanceOhms}`)
  }
  if (!Number.isFinite(input.temperatureC)) throw new RangeError("temperatureC must be finite")
  if (input.temperatureC < minimumModeledTemperatureC || input.temperatureC > maximumModeledTemperatureC) {
    throw new RangeError(
      `temperatureC must be between ${minimumModeledTemperatureC} and ${maximumModeledTemperatureC} degrees C`
    )
  }
}

function sensitivityVoltsPerOhm(resistanceOhms: number): number {
  return (excitationAndAdcReferenceVolts * sourceResistanceOhms) / (sourceResistanceOhms + resistanceOhms) ** 2
}

function voltageErrorOhms(resistanceOhms: number, voltageErrorVolts: number): number {
  return Math.abs(voltageErrorVolts / sensitivityVoltsPerOhm(resistanceOhms))
}

/** Calculates the source-bounded voltage-to-resistance terms at one threshold corner. */
export function calculateM403ThresholdError(input: {
  readonly resistanceOhms: number
  readonly temperatureC: number
}): {
  readonly adcIntegralLinearityOhms: number
  readonly adcInputLeakageOhms: number
  readonly adcOffsetDriftOhms: number
  readonly adcQuantizationOhms: number
  readonly bufferInputBiasOhms: number
  readonly bufferOffsetOhms: number
  readonly sensitivityVoltsPerOhm: number
  readonly totalSourceBoundOhms: number
} {
  modeledCornerInput(input)
  const temperatureDeltaC = Math.abs(input.temperatureC - calibrationTemperatureC)
  const sourceTheveninOhms =
    (sourceResistanceOhms * input.resistanceOhms) / (sourceResistanceOhms + input.resistanceOhms)
  const lsbVolts = excitationAndAdcReferenceVolts / (2 ** adcBits - 1)
  const adcIntegralLinearityOhms = voltageErrorOhms(input.resistanceOhms, lsbVolts * adcIntegralLinearityMaximumLsb)
  const adcOffsetDriftOhms = voltageErrorOhms(
    input.resistanceOhms,
    adcOffsetDriftMaximumUvPerC * temperatureDeltaC * 1e-6
  )
  const adcQuantizationOhms = voltageErrorOhms(input.resistanceOhms, lsbVolts / 2)
  const adcInputLeakageOhms = voltageErrorOhms(
    input.resistanceOhms,
    sourceTheveninOhms * adcInputLeakageMaximumNa * 1e-9
  )
  const bufferInputBiasOhms = voltageErrorOhms(
    input.resistanceOhms,
    sourceTheveninOhms * bufferInputBiasMaximumNa * 1e-9
  )
  const bufferOffsetOhms = voltageErrorOhms(input.resistanceOhms, bufferOffsetMaximumUv * 1e-6)
  const totalSourceBoundOhms =
    adcIntegralLinearityOhms +
    adcInputLeakageOhms +
    adcOffsetDriftOhms +
    adcQuantizationOhms +
    bufferInputBiasOhms +
    bufferOffsetOhms
  return deepFreeze({
    adcIntegralLinearityOhms,
    adcInputLeakageOhms,
    adcOffsetDriftOhms,
    adcQuantizationOhms,
    bufferInputBiasOhms,
    bufferOffsetOhms,
    sensitivityVoltsPerOhm: sensitivityVoltsPerOhm(input.resistanceOhms),
    totalSourceBoundOhms
  })
}

function maximumRawSourcePathShiftOhms(temperatureC: number): number {
  return (
    sourceResistanceOhms * sourceResistorTolerance +
    sourceResistanceOhms * sourceResistorTcrPpmPerC * Math.abs(temperatureC - calibrationTemperatureC) * 1e-6 +
    sourceSwitchResistanceMaximumOhms
  )
}

export type M403Term = {
  readonly allocationOhms: number
  readonly evidenceRequired: readonly string[]
  readonly id: string
  readonly invalidatedBy: readonly string[]
  readonly kind: "calibration-allocation" | "source-bound"
  readonly source: string
}

export const M403_REQUIRED_TERM_IDS = [
  "source-switch-on-resistance",
  "source-resistor-initial-and-temperature",
  "sink-switch-off-and-selected-path",
  "series-resistor-and-clamp-path",
  "clamp-connector-cable-fixture-leakage",
  "buffer-full-temperature-offset",
  "buffer-input-bias",
  "buffer-gain-linearity-noise",
  "buffer-settling-and-recovery",
  "adc-integral-linearity",
  "adc-offset-drift",
  "adc-input-leakage",
  "adc-quantization",
  "adc-kickback-and-aperture",
  "reference-ratiometric-ratio",
  "reference-load-and-conversion-timing",
  "sar-resistor-capacitor-and-parasitics",
  "temperature-soak-and-humidity-transfer",
  "calibration-fit-residual",
  "standard-and-expanded-uncertainty"
] as const

function sourceBoundTerm(
  id: (typeof M403_REQUIRED_TERM_IDS)[number],
  allocationOhms: number,
  source: string,
  evidenceRequired: string,
  invalidatedBy: string
): M403Term {
  return {
    allocationOhms,
    evidenceRequired: [evidenceRequired],
    id,
    invalidatedBy: [invalidatedBy],
    kind: "source-bound",
    source
  }
}

function calibratedTerm(
  id: (typeof M403_REQUIRED_TERM_IDS)[number],
  allocationOhms: number,
  evidenceRequired: string,
  invalidatedBy: string
): M403Term {
  return {
    allocationOhms,
    evidenceRequired: [evidenceRequired],
    id,
    invalidatedBy: [invalidatedBy],
    kind: "calibration-allocation",
    source: "M4-03 measurement allocation; no physical credit before the named evidence exists"
  }
}

/** Builds the complete no-null term ledger for one resistance and temperature corner. */
export function calculateM403ThresholdLedger(input: {
  readonly resistanceOhms: number
  readonly temperatureC: number
}): {
  readonly resistanceOhms: number
  readonly temperatureC: number
  readonly terms: readonly M403Term[]
  readonly totalWorstCaseOhms: number
  readonly withinFixtureTarget: boolean
} {
  const bounded = calculateM403ThresholdError(input)
  const terms = [
    calibratedTerm(
      "source-switch-on-resistance",
      0.4,
      "Per-channel, per-temperature 0 and 500 ohm source-path standards, observed TMUX enable, and raw ADC fit prove residual at or below 0.4 ohm.",
      "Any TMUX part, source-enable timing, supply, source-path routing, or channel change."
    ),
    calibratedTerm(
      "source-resistor-initial-and-temperature",
      0.25,
      "The same per-corner source-path calibration proves ERA3AEB2491V initial tolerance and temperature residual at or below 0.25 ohm.",
      "Any source-resistor lot, temperature corner, source reference, or routing change."
    ),
    calibratedTerm(
      "sink-switch-off-and-selected-path",
      0.25,
      "Observed source/sink mutual exclusion plus source- and sink-selected 0 and 500 ohm records prove residual at or below 0.25 ohm.",
      "Any sink switch, control pull state, channel assignment, or selected direction change."
    ),
    calibratedTerm(
      "series-resistor-and-clamp-path",
      0.15,
      "Four-wire LINE-to-quiet-path resistance and no-fault leakage records prove the combined 22-ohm and clamp-path residual at or below 0.15 ohm.",
      "Any clamp, 22-ohm resistor, connector-side copper, or fault exposure change."
    ),
    calibratedTerm(
      "clamp-connector-cable-fixture-leakage",
      0.25,
      "Powered and unpowered leakage records at LINE, post-clamp, quiet, and fixture standards prove the allocated 0.25-ohm equivalent limit.",
      "Any cable, connector, fixture, humidity condition, contamination event, clamp pulse, or post-fault recovery."
    ),
    sourceBoundTerm(
      "buffer-full-temperature-offset",
      bounded.bufferOffsetOhms,
      "ADA4177-1 120 uV full-temperature input-offset bound from committed BP-100 arithmetic.",
      "Part identity and source document digest remain pinned.",
      "Any buffer substitution or source-bound revision."
    ),
    sourceBoundTerm(
      "buffer-input-bias",
      bounded.bufferInputBiasOhms,
      "ADA4177-1 1 nA maximum input-bias bound from committed BP-100 arithmetic.",
      "Part identity and source document digest remain pinned.",
      "Any buffer substitution, input topology, or source-bound revision."
    ),
    calibratedTerm(
      "buffer-gain-linearity-noise",
      0.25,
      "Repeated zero, 450, 475, and 500 ohm captures with noise statistics prove gain, linearity, and noise residual at or below 0.25 ohm.",
      "Any buffer, gain topology, acquisition bandwidth, sampling count, or rail change."
    ),
    calibratedTerm(
      "buffer-settling-and-recovery",
      0.2,
      "Source-step and post-guarded-pulse waveforms at buffer input/output and ADC input prove the 0.2-ohm settled residual.",
      "Any source/sink timing, pulse qualification, buffer load, fault event, or recovery behavior change."
    ),
    sourceBoundTerm(
      "adc-integral-linearity",
      bounded.adcIntegralLinearityOhms,
      "ADS8881 three-LSB INL bound from committed BP-100 arithmetic.",
      "Part identity and source document digest remain pinned.",
      "Any ADC substitution, range, or source-bound revision."
    ),
    sourceBoundTerm(
      "adc-offset-drift",
      bounded.adcOffsetDriftOhms,
      "ADS8881 1.5 uV/C offset-drift bound from committed BP-100 arithmetic, relative to the 25 C calibration only.",
      "Part identity and source document digest remain pinned.",
      "Any ADC substitution, calibration reference temperature, or source-bound revision."
    ),
    sourceBoundTerm(
      "adc-input-leakage",
      bounded.adcInputLeakageOhms,
      "ADS8881 5 nA input-leakage bound from committed BP-100 arithmetic.",
      "Part identity and source document digest remain pinned.",
      "Any ADC substitution, input topology, or source-bound revision."
    ),
    sourceBoundTerm(
      "adc-quantization",
      bounded.adcQuantizationOhms,
      "ADS8881 half-LSB quantization at the committed 2.5 V, 18-bit range.",
      "Part identity and source document digest remain pinned.",
      "Any ADC range, reference voltage, resolution, or conversion-code policy change."
    ),
    calibratedTerm(
      "adc-kickback-and-aperture",
      0.2,
      "CONVST-correlated ADS8881 AINP and reference waveforms plus code statistics prove a 0.2-ohm residual.",
      "Any ADC acquisition interval, CONVST phasing, SAR filter, reference network, or source transition change."
    ),
    calibratedTerm(
      "reference-ratiometric-ratio",
      0.1,
      "Simultaneous source-reference and ADS8881 REF/GND capture proves the non-common ratiometric ratio residual at or below 0.1 ohm.",
      "Any REF5025, reference routing, ADC reference network, or probe method change."
    ),
    calibratedTerm(
      "reference-load-and-conversion-timing",
      0.25,
      "Single and burst CONVST reference load, recovery, and code records prove the 0.25-ohm dynamic residual.",
      "Any ADC rate, burst profile, reference capacitor, R_REF_SAR, converter load, or layout change."
    ),
    calibratedTerm(
      "sar-resistor-capacitor-and-parasitics",
      0.25,
      "Four-wire SAR resistor, capacitor identity, extracted input network, and settled ADC waveform prove the 0.25-ohm residual.",
      "Any R_SAR, C_SAR, PCB layout, probe point, cable, or channel replication change."
    ),
    calibratedTerm(
      "temperature-soak-and-humidity-transfer",
      0.25,
      "Soaked -40, 25, 85, and 125 C plus declared humidity records prove the between-record transfer residual at or below 0.25 ohm.",
      "Any temperature range, soak procedure, humidity limit, enclosure, or calibration interval change."
    ),
    calibratedTerm(
      "calibration-fit-residual",
      0.45,
      "Stored two-point gain/intercept fit, 450/475-ohm holdout residual, raw ADC data, and repeatability prove the 0.45-ohm allocation.",
      "Any calibration algorithm, standard set, firmware digest, channel, or fit residual limit change."
    ),
    calibratedTerm(
      "standard-and-expanded-uncertainty",
      0.45,
      "Traceable standard certificates, DMM and temperature calibration, fixture four-wire characterization, and expanded uncertainty prove the 0.45-ohm allocation.",
      "Any standard certificate expiry, instrument calibration expiry, fixture rebuild, or uncertainty method change."
    )
  ] as const
  const totalWorstCaseOhms = terms.reduce((total, term) => total + term.allocationOhms, 0)
  return deepFreeze({
    resistanceOhms: input.resistanceOhms,
    temperatureC: input.temperatureC,
    terms,
    totalWorstCaseOhms,
    withinFixtureTarget: totalWorstCaseOhms <= fixtureTargetHalfWidthOhms
  })
}

const thresholdScreens = [
  calculateM403ThresholdLedger({ resistanceOhms: 450, temperatureC: -40 }),
  calculateM403ThresholdLedger({ resistanceOhms: 450, temperatureC: 125 }),
  calculateM403ThresholdLedger({ resistanceOhms: 475, temperatureC: -40 }),
  calculateM403ThresholdLedger({ resistanceOhms: 475, temperatureC: 125 })
] as const

export const M403_SENSING_ERROR_SOURCE_CONTRACTS = deepFreeze([
  {
    commit: "49ec880a24e990bd511ffc3a22543d84231968a6",
    currentSha256: "b18e380bc01830aab5cbe21c2bc43a97c77d4a2a2fbfea368cb270549908d697",
    id: "M4-01",
    sha256: "b18e380bc01830aab5cbe21c2bc43a97c77d4a2a2fbfea368cb270549908d697",
    sourcePath: "apps/scoring/src/m4-01-analog-rule-boundary-audit.ts"
  },
  {
    commit: "0ebd7feb7112818cba21a5b420a7c6785d9e522f",
    currentSha256: "fc611d073c8baf8040a559d58e2996f78c8cf1c7c69d42ca92ce0c97d6b23603",
    id: "M4-02",
    sha256: "fc611d073c8baf8040a559d58e2996f78c8cf1c7c69d42ca92ce0c97d6b23603",
    sourcePath: "apps/scoring/src/m4-02-clamp-rail-protection.ts"
  },
  {
    commit: "b7590b03b6f162405690bb8d15aa0cc19799cfa2",
    currentSha256: "1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d",
    id: "BP-100",
    sha256: "438983d09aa2dad47f6ff3b49076f3e245f0d8693d469cf5c7601e912ca776ee",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts"
  },
  {
    commit: "b7590b03b6f162405690bb8d15aa0cc19799cfa2",
    currentSha256: "6b2dd869bb91f40fc3439ee9fffd96cb774f1dada4777c32f3be50a1b79a1c66",
    id: "BP-101",
    sha256: "ed062898c379110e61ebc321e41901cdcdfd27976b5c11f1b75cd7a76ffb0544",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-reference-drive.ts"
  }
] as const satisfies readonly M403SourceContract[])

const definition = {
  authority: {
    energizedTestAuthorization: false,
    fabricationAuthorized: false,
    fixtureTargetValidated: false,
    schematicIntegrationAuthorized: false,
    scoringAuthority: false
  },
  candidatePath: {
    adc: "ADS8881IDGS, 18-bit, 2.5 V REF5025AQDRQ1 reference",
    reference:
      "REF5025AQDRQ1 supplies both source excitation and ADS8881 reference; ideal common reference error is ratiometric and cancels",
    sink: "TMUX1112PWR sink path is off and observed off during a source measurement; its residual is separately calibrated for sink-selected tests",
    source: "REF5025AQDRQ1 -> ERA3AEB2491V 2.49 kohm -> TMUX1112PWR -> LINE",
    switch: "TMUX1112PWR maximum on resistance is 9.8 ohm in the committed bounded screen"
  },
  calibration: {
    invalidationTriggers: [
      "source or sink control, path, or channel assignment change",
      "reference or ADC conversion timing change",
      "power, rail, or supply-selection change",
      "temperature boundary or declared humidity range change",
      "wiring, probe, fixture, or channel replication provenance change",
      "calibration algorithm, standard, firmware, or fit-limit change",
      "integrity/configuration identity mismatch, failed drift/reference self-test, or explicit recalibration"
    ],
    requiredProcedure: [
      "At each channel, source-selected and sink-selected direction, and -40, 25, 85, and 125 C corner, acquire traceable 0 and 500 ohm standards with the same conversion timing used for the threshold measurement.",
      "Fit one gain and one intercept from the two standards; invalidate calibration after source/sink control, reference, ADC timing, power, temperature, or wiring provenance changes.",
      "Accept the stated residuals only when raw ADC, reference, source/sink state, standard, temperature, fit, and expanded-uncertainty evidence prove each limit."
    ],
    rawSourcePathShiftAt125COhms: maximumRawSourcePathShiftOhms(125),
    residualsAreUnmeasuredAcceptanceGates: true,
    status: "every non-source-bound term has a numeric allocation, evidence, and invalidation rule"
  },
  fixtureTarget: {
    maximumAbsoluteThresholdErrorOhms: fixtureTargetHalfWidthOhms,
    status: "paper-budget-meets-target-only-if-calibration-residuals-are-proven"
  },
  sourceContracts: structuredClone(M403_SENSING_ERROR_SOURCE_CONTRACTS),
  thresholdScreens,
  requiredTermIds: M403_REQUIRED_TERM_IDS,
  workUnit: "M4-03"
} as const

export const M403_SENSING_ERROR_BUDGET = deepFreeze(definition)

/** Reject altered arithmetic, unstated residuals, or an authority escalation. */
export function validateM403SensingErrorBudget(value: unknown): true {
  if (!sameDataGraph(value, M403_SENSING_ERROR_BUDGET)) {
    throw new RangeError("M4-03 budget must exactly match the reviewed paper calculation")
  }
  const budget = M403_SENSING_ERROR_BUDGET
  if (
    budget.workUnit !== "M4-03" ||
    budget.fixtureTarget.maximumAbsoluteThresholdErrorOhms !== 5 ||
    budget.thresholdScreens.some((screen) => !screen.withinFixtureTarget) ||
    budget.thresholdScreens.some(
      (screen) =>
        !Number.isFinite(screen.totalWorstCaseOhms) ||
        screen.totalWorstCaseOhms < minimumModeledResistanceOhms ||
        screen.terms.length !== M403_REQUIRED_TERM_IDS.length ||
        screen.terms.some(
          (term) =>
            !Number.isFinite(term.allocationOhms) ||
            term.allocationOhms < 0 ||
            !term.source.trim() ||
            !term.evidenceRequired.length ||
            term.evidenceRequired.some((evidence) => !evidence.trim()) ||
            !term.invalidatedBy.length ||
            term.invalidatedBy.some((invalidation) => !invalidation.trim())
        ) ||
        screen.terms.map((term) => term.id).join("|") !== M403_REQUIRED_TERM_IDS.join("|") ||
        !Object.is(
          screen.terms.reduce((total, term) => total + term.allocationOhms, 0),
          screen.totalWorstCaseOhms
        )
    ) ||
    budget.thresholdScreens.some(
      (screen) =>
        screen.resistanceOhms < minimumModeledResistanceOhms ||
        screen.resistanceOhms > maximumModeledResistanceOhms ||
        screen.temperatureC < minimumModeledTemperatureC ||
        screen.temperatureC > maximumModeledTemperatureC
    ) ||
    budget.sourceContracts.length !== 4 ||
    new Set(budget.sourceContracts.map((contract) => contract.id)).size !== budget.sourceContracts.length ||
    budget.sourceContracts.some(
      (contract) =>
        !/^[0-9a-f]{40}$/u.test(contract.commit) ||
        !/^[0-9a-f]{64}$/u.test(contract.currentSha256) ||
        !/^[0-9a-f]{64}$/u.test(contract.sha256) ||
        (!contract.sourcePath.startsWith("apps/scoring/src/") &&
          !contract.sourcePath.startsWith("packages/scoring-circuit/src/"))
    ) ||
    budget.calibration.invalidationTriggers.length < 5 ||
    budget.calibration.invalidationTriggers.some((trigger) => !trigger.trim()) ||
    !budget.calibration.residualsAreUnmeasuredAcceptanceGates ||
    budget.authority.energizedTestAuthorization ||
    budget.authority.fabricationAuthorized ||
    budget.authority.fixtureTargetValidated ||
    budget.authority.schematicIntegrationAuthorized ||
    budget.authority.scoringAuthority
  ) {
    throw new RangeError("M4-03 must preserve target gates and denied physical authority")
  }
  return true
}
