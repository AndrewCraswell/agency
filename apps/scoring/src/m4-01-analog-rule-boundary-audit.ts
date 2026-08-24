/**
 * Executable M4-01 analogue model-screen inventory.
 *
 * It independently reproduces only the bounded arithmetic exposed by the
 * committed M0-03, BP-100, BP-101, BP-102, and BP-106 artifacts. It does not
 * import the circuit package at application runtime, select a threshold, or
 * establish a physical characteristic.
 */

export type M401ModelDisposition = "no-credit" | "screen-fail-no-credit" | "screen-pass-no-credit"

export type M401SourceContract = {
  readonly commit: string
  readonly id: "BP-100" | "BP-101" | "BP-102" | "BP-106" | "M0-03"
  readonly sha256: string
  readonly sourcePath: string
}

export type M401ModelCase = {
  readonly disposition: M401ModelDisposition
  readonly id: string
  readonly inputs: Readonly<Record<string, number | string>>
  readonly ownedFollowUp: string
  readonly outputs: Readonly<Record<string, boolean | number>>
  readonly sourceContractDigests: readonly string[]
}

export type M401AuditAuthority = {
  readonly circuitRelease: false
  readonly energizedTestAuthorization: false
  readonly fabricationRelease: false
  readonly scoringAuthority: false
}

type PlainRecord = Record<PropertyKey, unknown>

const resistanceOhms = [
  0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500, 505
] as const
const capacitancePf = [500, 2_000, 5_000, 10_000] as const
const temperatureC = [-40, 25, 85, 125] as const
const guardedVolts = [-24, -7, -3, -1, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 1, 3, 7, 24] as const
const pulseWidthsUs = [
  99, 100, 101, 999, 1_000, 1_001, 1_999, 2_000, 2_001, 2_999, 3_000, 3_001, 12_999, 13_000, 14_000, 15_000, 15_001
] as const

const sourceResistanceOhms = 2_490
const excitationVolts = 2.5
const sourceTcrPpmPerC = 25
const adcReferenceVolts = 2.5
const adcIntegralLinearityMaximumLsb = 3
const adcOffsetDriftMaximumUvPerC = 1.5
const bufferInputBiasMaximumNa = 1
const bufferOffsetMaximumUvAtFullTemperature = 120
const bufferGainBandwidthTypicalMhz = 3.5
const adcAcquisitionUs = 0.29
const adcConversionMaximumUs = 0.71
const sarFilterResistanceOhms = 20
const sarFilterCapacitancePf = 1_000
const adcInputCapacitancePf = 59
const guardedMinimumResistanceOhms = 56_000 * 0.99
const guardedMaximumPulseDurationMs = 100
const bufferPositiveRailVolts = 5
const bufferNegativeRailVolts = -5
const bufferOvervoltageBeyondRailVolts = 32

function deepFreeze<const Value>(value: Value): Value {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

function sourceContractDigest(contract: M401SourceContract): string {
  return `${contract.id}:${contract.sha256}`
}

export const M401_ANALOG_AUDIT_SOURCE_CONTRACTS = deepFreeze([
  {
    commit: "bc8b1eac6a28ccd2f65e85008ceee63d1743cd48",
    id: "M0-03",
    sha256: "45bed255c6c5bdf3ac48ef51e7e3744243584a5ac39cd143a61aa985f1d861b6",
    sourcePath: "apps/scoring/docs/seven-conductor-signal-contract.md"
  },
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
    commit: "d4af2cba2a4203fc57b968ac2ae3b257f838056b",
    id: "BP-106",
    sha256: "a7c95df59dbd24f88b5da009c353a821942a622a50e8cc6d9fac88b0b841d88c",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-analog-test-matrix.ts"
  }
] as const satisfies readonly M401SourceContract[])

const allSourceContractDigests = M401_ANALOG_AUDIT_SOURCE_CONTRACTS.map(sourceContractDigest)

function sourceTheveninResistanceOhms(externalResistanceOhms: number): number {
  return (sourceResistanceOhms * externalResistanceOhms) / (sourceResistanceOhms + externalResistanceOhms)
}

function resistanceSensitivityVoltsPerOhm(externalResistanceOhms: number): number {
  return (excitationVolts * sourceResistanceOhms) / (sourceResistanceOhms + externalResistanceOhms) ** 2
}

function resistanceErrorForVoltage(externalResistanceOhms: number, voltageErrorVolts: number): number {
  return Math.abs(voltageErrorVolts / resistanceSensitivityVoltsPerOhm(externalResistanceOhms))
}

function normalCase(resistance: number, capacitance: number, temperature: number): M401ModelCase {
  const senseVolts = (excitationVolts * resistance) / (sourceResistanceOhms + resistance)
  const temperatureDeltaC = Math.abs(temperature - 25)
  const lsbVolts = adcReferenceVolts / (2 ** 18 - 1)
  const staticErrorOhms =
    resistanceErrorForVoltage(resistance, lsbVolts * adcIntegralLinearityMaximumLsb) +
    resistanceErrorForVoltage(resistance, adcOffsetDriftMaximumUvPerC * temperatureDeltaC * 1e-6) +
    resistanceErrorForVoltage(resistance, sourceTheveninResistanceOhms(resistance) * bufferInputBiasMaximumNa * 1e-9) +
    resistanceErrorForVoltage(resistance, bufferOffsetMaximumUvAtFullTemperature * 1e-6) +
    0.5 +
    resistance * sourceTcrPpmPerC * temperatureDeltaC * 1e-6
  const sourceFiveTimeConstantsUs = sourceTheveninResistanceOhms(resistance) * capacitance * 5e-6
  const normalRangePass = senseVolts >= 0 && senseVolts <= adcReferenceVolts && senseVolts >= -1.5 && senseVolts <= 1.5
  const staticArithmeticPass = staticErrorOhms <= 4.5
  return {
    disposition: "screen-pass-no-credit",
    id: `normal-r${resistance}-c${capacitance}-t${temperature}-tolerance-unclosed`,
    inputs: {
      capacitancePf: capacitance,
      externalResistanceOhms: resistance,
      temperatureC: temperature,
      tolerancePolicy: "per-corner-calibration-required-unbounded-terms-no-credit"
    },
    ownedFollowUp:
      "BP-106 calibrated one-channel measurement, expanded uncertainty, and raw trace evidence; M1 alone may bind a qualified physical observation to a rule.",
    outputs: {
      bufferInputWithinPublishedRange: senseVolts >= -1.5 && senseVolts <= 1.5,
      normalInputVolts: senseVolts,
      normalRangePass,
      sourceFiveTimeConstantsUs,
      staticArithmeticPass,
      staticErrorOhms,
      unboundedToleranceTerms: 10
    },
    sourceContractDigests: allSourceContractDigests
  }
}

function pulseCase(pulseWidthUs: number): M401ModelCase {
  const sourceFiveTimeConstantsUs = sourceTheveninResistanceOhms(100) * 10_000 * 5e-6
  const bufferSettlingUs = Math.log(2 ** 19) / (2 * Math.PI * bufferGainBandwidthTypicalMhz)
  const sarSettlingUs =
    sarFilterResistanceOhms * (sarFilterCapacitancePf + adcInputCapacitancePf) * Math.log(2 ** 19) * 1e-6
  const arithmeticResponseUs =
    sourceFiveTimeConstantsUs + bufferSettlingUs + sarSettlingUs + adcAcquisitionUs + adcConversionMaximumUs
  const rulePulseMinimumMet = pulseWidthUs >= 100
  return {
    disposition:
      arithmeticResponseUs <= pulseWidthUs && rulePulseMinimumMet ? "screen-pass-no-credit" : "screen-fail-no-credit",
    id: `pulse-r100-c10000-t25-w${pulseWidthUs}`,
    inputs: { capacitancePf: 10_000, externalResistanceOhms: 100, pulseWidthUs, temperatureC: 25 },
    ownedFollowUp:
      "BP-101 triggered physical captures must prove source switching, ADC phasing, reference response, board parasitics, and timing before a pulse can qualify a rule event.",
    outputs: {
      arithmeticResponseUs,
      modelUsesTypicalBufferBandwidth: true,
      rulePulseMinimumMet,
      settledBeforePulseWidth: arithmeticResponseUs <= pulseWidthUs,
      sourceFiveTimeConstantsUs
    },
    sourceContractDigests: allSourceContractDigests
  }
}

function guardedCase(appliedVolts: number, capacitance: number, temperature: number): M401ModelCase {
  const sourceCurrentA = Math.abs(appliedVolts) / guardedMinimumResistanceOhms
  const sourcePowerW = appliedVolts ** 2 / guardedMinimumResistanceOhms
  const sourceEnergyJ = sourcePowerW * (guardedMaximumPulseDurationMs / 1_000)
  const abovePositiveRailVolts = Math.max(0, appliedVolts - bufferPositiveRailVolts)
  const belowNegativeRailVolts = Math.max(0, bufferNegativeRailVolts - appliedVolts)
  const ovpRangeCovered =
    abovePositiveRailVolts <= bufferOvervoltageBeyondRailVolts &&
    belowNegativeRailVolts <= bufferOvervoltageBeyondRailVolts
  return {
    disposition: "screen-pass-no-credit",
    id: `guarded-v${appliedVolts}-c${capacitance}-t${temperature}-p100ms`,
    inputs: { appliedVolts, capacitancePf: capacitance, pulseDurationMs: 100, temperatureC: temperature },
    ownedFollowUp:
      "BP-102 and BP-106 interlocked guarded capture must establish component behaviour, trip operation, recovery, and post-pulse health; no source envelope proves survival.",
    outputs: {
      abovePositiveRailVolts,
      belowNegativeRailVolts,
      ovpRangeCovered,
      sourceCurrentA,
      sourceEnergyJ,
      sourcePowerW
    },
    sourceContractDigests: allSourceContractDigests
  }
}

function unpoweredCase(appliedVolts: number, capacitance: number, temperature: number): M401ModelCase {
  return {
    disposition: "no-credit",
    id: `unpowered-v${appliedVolts}-c${capacitance}-t${temperature}`,
    inputs: { appliedVolts, capacitancePf: capacitance, powered: "false", temperatureC: temperature },
    ownedFollowUp:
      "BP-102 owns unpowered plus/minus voltage and current captures at every named node, rating-margin review, and post-pulse leakage, startup, reference, ADC-code, and overload-recovery evidence.",
    outputs: { modelledPhysicalPaths: 0, permittedScoringRelations: 0, unpoweredFaultApproved: false },
    sourceContractDigests: allSourceContractDigests
  }
}

function referenceCase(): M401ModelCase {
  const capacitorDroopMv = 100 / 8
  const pulseCurrentMa = 100 / 1
  const esrStepMv = pulseCurrentMa * 0.1
  return {
    disposition: "screen-pass-no-credit",
    id: "reference-passive-c8uf-esr0.1-q100nc-w1us",
    inputs: { capacitorMinimumUf: 8, capacitorMaximumEsrOhms: 0.1, chargePulseNc: 100, pulseWidthUs: 1 },
    ownedFollowUp:
      "BP-101 must measure REF5025 and ADS8881 reference dynamics with the selected converter phasing and physical layout; the passive-only screen is not a dynamic-load bound.",
    outputs: {
      capacitorDroopMv,
      chargePulseNc: 100,
      esrStepMv,
      illustrativePulseCurrentMa: pulseCurrentMa,
      modelIsPassiveOnly: true,
      pulseWidthUs: 1,
      totalUnregulatedStepMv: capacitorDroopMv + esrStepMv,
      validatesDynamicLoad: false
    },
    sourceContractDigests: allSourceContractDigests
  }
}

function buildModelCases(): readonly M401ModelCase[] {
  const cases: M401ModelCase[] = []
  for (const temperature of temperatureC)
    for (const capacitance of capacitancePf)
      for (const resistance of resistanceOhms) cases.push(normalCase(resistance, capacitance, temperature))
  for (const pulseWidthUs of pulseWidthsUs) cases.push(pulseCase(pulseWidthUs))
  for (const temperature of temperatureC)
    for (const capacitance of capacitancePf)
      for (const volts of guardedVolts) cases.push(guardedCase(volts, capacitance, temperature))
  for (const temperature of temperatureC)
    for (const capacitance of capacitancePf)
      for (const volts of guardedVolts) cases.push(unpoweredCase(volts, capacitance, temperature))
  cases.push(referenceCase())
  return cases
}

export const M401_ANALOG_MODEL_CASES = deepFreeze(buildModelCases())

export const M401_ANALOG_AUDIT_AUTHORITY = deepFreeze({
  circuitRelease: false,
  energizedTestAuthorization: false,
  fabricationRelease: false,
  scoringAuthority: false
} satisfies M401AuditAuthority)

export const M401_ANALOG_MODEL_AUDIT = deepFreeze({
  authority: M401_ANALOG_AUDIT_AUTHORITY,
  cases: M401_ANALOG_MODEL_CASES,
  disposition: "evidence-plan-only",
  sourceContracts: M401_ANALOG_AUDIT_SOURCE_CONTRACTS,
  version: "M4-01.model-screen-1"
} as const)

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function allNumbersAreFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(allNumbersAreFinite)
  if (isPlainRecord(value)) return Object.values(value).every(allNumbersAreFinite)
  return true
}

/** Rejects missing, duplicate, stale, non-finite, or altered model cases. */
export function validateM401AnalogModelAudit(value: unknown): true {
  if (!isPlainRecord(value) || !Array.isArray(value.cases) || !Array.isArray(value.sourceContracts)) {
    throw new TypeError("M4-01 model audit must contain case and source-contract arrays")
  }
  if (!allNumbersAreFinite(value)) throw new RangeError("M4-01 model audit contains a non-finite output or input")
  if (value.cases.length !== M401_ANALOG_MODEL_CASES.length) {
    throw new RangeError("M4-01 model audit has missing or stale cases")
  }
  const expectedById = new Map(M401_ANALOG_MODEL_CASES.map((modelCase) => [modelCase.id, modelCase]))
  const seen = new Set<string>()
  for (const modelCase of value.cases) {
    if (!isPlainRecord(modelCase) || typeof modelCase.id !== "string") {
      throw new TypeError("M4-01 model case must be a plain record with an id")
    }
    if (seen.has(modelCase.id)) throw new RangeError(`M4-01 model audit has a duplicate case ${modelCase.id}`)
    seen.add(modelCase.id)
    const expected = expectedById.get(modelCase.id)
    if (!expected) throw new RangeError(`M4-01 model audit has a stale case ${modelCase.id}`)
    if (JSON.stringify(modelCase.sourceContractDigests) !== JSON.stringify(expected.sourceContractDigests)) {
      throw new RangeError(`M4-01 model case ${modelCase.id} has stale source-contract evidence`)
    }
    if (JSON.stringify(modelCase) !== JSON.stringify(expected)) {
      throw new RangeError(`M4-01 model case ${modelCase.id} drifted from the committed arithmetic screen`)
    }
  }
  if (JSON.stringify(value.sourceContracts) !== JSON.stringify(M401_ANALOG_AUDIT_SOURCE_CONTRACTS)) {
    throw new RangeError("M4-01 model audit source-contract identity or digest drifted")
  }
  if (value.authority !== M401_ANALOG_AUDIT_AUTHORITY) {
    throw new RangeError("M4-01 model audit authority must be the immutable denied authority")
  }
  return true
}

/** Loads the complete model screen only after rejecting every evidence drift. */
export function loadM401AnalogRuleBoundaryAudit(): typeof M401_ANALOG_MODEL_AUDIT {
  validateM401AnalogModelAudit(M401_ANALOG_MODEL_AUDIT)
  return M401_ANALOG_MODEL_AUDIT
}
