/**
 * Preliminary power envelope for the USB-PD 20 V, 3 A apparatus input.
 *
 * The component values below are intentionally allocations, not measured
 * board loads. The display is not selected yet, so its allocation is the
 * remaining V5 capacity after fixed system loads and declared deratings.
 */

export type PowerPair = {
  continuousW: number
  peakW: number
}

export type RailBudgetInputs = {
  sourceVoltageV: number
  sourceCurrentA: number
  continuousSourceUtilization: number
  peakSourceUtilization: number
  pdAndEfusePathLossW: number
  buckBoostEfficiency: number
  v3v3RegulatorEfficiency: number
  displayVoltageV: number
  peakDurationMs: number
  localLoads: {
    v3v3: {
      esp32Module: PowerPair
      ethernet: PowerPair
      framRtcSecurity: PowerPair
      supportAndSupervision: PowerPair
    }
    v5: {
      scoringIsolatedSupply: PowerPair
      audio: PowerPair
      hub75Buffers: PowerPair
      otherSystemLoads: PowerPair
    }
  }
}

export type RailBudgetPoint = {
  sourceEnvelopeW: number
  sourceEnvelopeA: number
  converterInputW: number
  buckBoostLossW: number
  pathAndConversionLossW: number
  downstreamRailBudgetW: number
  v3v3LocalLoadW: number
  v3v3InputEquivalentW: number
  v5FixedLoadW: number
  fixedRailLoadW: number
  displayAllocationW: number
  displayAllocationA: number
}

export type RailBudgetResult = {
  contractW: number
  peakDurationMs: number
  continuous: RailBudgetPoint
  peak: RailBudgetPoint
}

/**
 * These numbers are the preliminary design envelope used by the companion
 * power-budget document. They deliberately leave the panel as an allocation.
 */
export const defaultRailBudgetInputs = {
  sourceVoltageV: 20,
  sourceCurrentA: 3,
  continuousSourceUtilization: 0.8,
  peakSourceUtilization: 0.9,
  pdAndEfusePathLossW: 1,
  buckBoostEfficiency: 0.85,
  v3v3RegulatorEfficiency: 0.9,
  displayVoltageV: 5,
  peakDurationMs: 100,
  localLoads: {
    v3v3: {
      // Espressif quotes 355 mA for 100% duty-cycle Wi-Fi TX at 3.3 V
      // (1.17 W); 1.2 W continuous and 1.5 W peak are rounded allocations.
      esp32Module: { continuousW: 1.2, peakW: 1.5 },
      // WIZnet quotes 132 mA typical at 3.3 V for normal 100 Mb/s operation.
      ethernet: { continuousW: 0.6, peakW: 0.6 },
      // The security device can draw 21 mA while processing; F-RAM and RTC
      // are small by comparison. This includes I2C/SPI pull-up overhead.
      framRtcSecurity: { continuousW: 0.1, peakW: 0.1 },
      // Supervisors, isolators, status indicators, and unmeasured 3.3 V I/O.
      supportAndSupervision: { continuousW: 0.7, peakW: 1.0 }
    },
    v5: {
      // The Murata NXE1S0505MC is a 1 W isolated converter with 64% minimum
      // efficiency. This input-side allocation covers its full output and
      // local scoring-domain consumption plus tolerance/temperature margin.
      scoringIsolatedSupply: { continuousW: 1.6, peakW: 2.0 },
      // TAS2505-Q1 is a 2.6 W-class speaker amplifier. Peak includes output
      // stage conversion overhead; the speaker/enclosure remain unselected.
      audio: { continuousW: 1.5, peakW: 3.5 },
      // Two SN74AHCT245 devices and their switching/default-blank network.
      // Dynamic output current is not closed by the static ICC specification.
      hub75Buffers: { continuousW: 0.4, peakW: 0.6 },
      otherSystemLoads: { continuousW: 0.4, peakW: 0.6 }
    }
  }
} as const satisfies RailBudgetInputs

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero`)
  }
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative`)
  }
}

function assertUtilization(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(`${name} must be finite and in the range (0, 1]`)
  }
}

function assertPowerPair(name: string, pair: PowerPair): void {
  if (pair === null || typeof pair !== "object") {
    throw new RangeError(`${name} must be a power pair`)
  }

  assertFiniteNonNegative(`${name}.continuousW`, pair.continuousW)
  assertFiniteNonNegative(`${name}.peakW`, pair.peakW)
  if (pair.peakW < pair.continuousW) {
    throw new RangeError(`${name}.peakW must be greater than or equal to ${name}.continuousW`)
  }
}

function assertObject(name: string, value: unknown): void {
  if (value === null || typeof value !== "object") {
    throw new RangeError(`${name} must be an object`)
  }
}

function assertRailBudgetPoint(name: string, point: RailBudgetPoint): void {
  assertObject(name, point)
  const pointFields: Array<keyof RailBudgetPoint> = [
    "sourceEnvelopeW",
    "sourceEnvelopeA",
    "converterInputW",
    "buckBoostLossW",
    "pathAndConversionLossW",
    "downstreamRailBudgetW",
    "v3v3LocalLoadW",
    "v3v3InputEquivalentW",
    "v5FixedLoadW",
    "fixedRailLoadW",
    "displayAllocationW",
    "displayAllocationA"
  ]
  for (const field of pointFields) {
    assertFiniteNonNegative(`${name}.${field}`, point[field])
  }
}

function assertRailBudgetResult(result: RailBudgetResult): void {
  assertObject("result", result)
  assertFinitePositive("result.contractW", result.contractW)
  assertFinitePositive("result.peakDurationMs", result.peakDurationMs)
  assertRailBudgetPoint("result.continuous", result.continuous)
  assertRailBudgetPoint("result.peak", result.peak)
}

function validateInputs(inputs: RailBudgetInputs): void {
  if (inputs === null || typeof inputs !== "object") {
    throw new RangeError("inputs must be a rail budget input object")
  }

  assertFinitePositive("sourceVoltageV", inputs.sourceVoltageV)
  assertFinitePositive("sourceCurrentA", inputs.sourceCurrentA)
  assertUtilization("continuousSourceUtilization", inputs.continuousSourceUtilization)
  assertUtilization("peakSourceUtilization", inputs.peakSourceUtilization)
  if (inputs.peakSourceUtilization < inputs.continuousSourceUtilization) {
    throw new RangeError("peakSourceUtilization must be greater than or equal to continuousSourceUtilization")
  }
  assertFiniteNonNegative("pdAndEfusePathLossW", inputs.pdAndEfusePathLossW)
  assertFinitePositive("buckBoostEfficiency", inputs.buckBoostEfficiency)
  if (inputs.buckBoostEfficiency > 1) {
    throw new RangeError("buckBoostEfficiency must be finite and in the range (0, 1]")
  }
  assertFinitePositive("v3v3RegulatorEfficiency", inputs.v3v3RegulatorEfficiency)
  if (inputs.v3v3RegulatorEfficiency > 1) {
    throw new RangeError("v3v3RegulatorEfficiency must be finite and in the range (0, 1]")
  }
  assertFinitePositive("displayVoltageV", inputs.displayVoltageV)
  assertFinitePositive("peakDurationMs", inputs.peakDurationMs)

  const continuousSourceEnvelopeW = inputs.sourceVoltageV * inputs.sourceCurrentA * inputs.continuousSourceUtilization
  if (inputs.pdAndEfusePathLossW > continuousSourceEnvelopeW) {
    throw new RangeError("pdAndEfusePathLossW must not exceed the continuous source envelope")
  }

  assertObject("localLoads", inputs.localLoads)
  assertObject("localLoads.v3v3", inputs.localLoads.v3v3)
  assertObject("localLoads.v5", inputs.localLoads.v5)
  assertPowerPair("localLoads.v3v3.esp32Module", inputs.localLoads.v3v3.esp32Module)
  assertPowerPair("localLoads.v3v3.ethernet", inputs.localLoads.v3v3.ethernet)
  assertPowerPair("localLoads.v3v3.framRtcSecurity", inputs.localLoads.v3v3.framRtcSecurity)
  assertPowerPair("localLoads.v3v3.supportAndSupervision", inputs.localLoads.v3v3.supportAndSupervision)
  assertPowerPair("localLoads.v5.scoringIsolatedSupply", inputs.localLoads.v5.scoringIsolatedSupply)
  assertPowerPair("localLoads.v5.audio", inputs.localLoads.v5.audio)
  assertPowerPair("localLoads.v5.hub75Buffers", inputs.localLoads.v5.hub75Buffers)
  assertPowerPair("localLoads.v5.otherSystemLoads", inputs.localLoads.v5.otherSystemLoads)
}

function pointFor(inputs: RailBudgetInputs, sourceUtilization: number, mode: "continuous" | "peak"): RailBudgetPoint {
  const sourceEnvelopeW = inputs.sourceVoltageV * inputs.sourceCurrentA * sourceUtilization
  const sourceEnvelopeA = inputs.sourceCurrentA * sourceUtilization
  const converterInputW = sourceEnvelopeW - inputs.pdAndEfusePathLossW
  const buckBoostLossW = converterInputW * (1 - inputs.buckBoostEfficiency)
  const pathAndConversionLossW = inputs.pdAndEfusePathLossW + buckBoostLossW
  const downstreamRailBudgetW = converterInputW * inputs.buckBoostEfficiency
  const v3v3Loads = inputs.localLoads.v3v3
  const v5Loads = inputs.localLoads.v5
  const v3v3LocalLoadW = Object.values(v3v3Loads).reduce((sum, load) => sum + load[`${mode}W`], 0)
  const v3v3InputEquivalentW = v3v3LocalLoadW / inputs.v3v3RegulatorEfficiency
  const v5FixedLoadW = Object.values(v5Loads).reduce((sum, load) => sum + load[`${mode}W`], 0)
  const fixedRailLoadW = v3v3InputEquivalentW + v5FixedLoadW
  const displayAllocationW = downstreamRailBudgetW - fixedRailLoadW
  if (displayAllocationW < 0) {
    throw new RangeError(`${mode} fixed loads exceed the downstream rail budget`)
  }

  return {
    sourceEnvelopeW,
    sourceEnvelopeA,
    converterInputW,
    buckBoostLossW,
    pathAndConversionLossW,
    downstreamRailBudgetW,
    v3v3LocalLoadW,
    v3v3InputEquivalentW,
    v5FixedLoadW,
    fixedRailLoadW,
    displayAllocationW,
    displayAllocationA: displayAllocationW / inputs.displayVoltageV
  }
}

export function calculateRailBudget(inputs: RailBudgetInputs = defaultRailBudgetInputs): RailBudgetResult {
  validateInputs(inputs)
  return {
    contractW: inputs.sourceVoltageV * inputs.sourceCurrentA,
    peakDurationMs: inputs.peakDurationMs,
    continuous: pointFor(inputs, inputs.continuousSourceUtilization, "continuous"),
    peak: pointFor(inputs, inputs.peakSourceUtilization, "peak")
  }
}

export function evaluateDisplayLoad(
  result: RailBudgetResult,
  display: PowerPair
): { continuousPass: boolean; peakPass: boolean } {
  assertRailBudgetResult(result)
  assertPowerPair("display", display)
  return {
    continuousPass: display.continuousW <= result.continuous.displayAllocationW,
    peakPass: display.peakW <= result.peak.displayAllocationW
  }
}
