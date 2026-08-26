/** P0-03 phased seven-conductor acquisition for the single-ESP32 prototype. */

const conductorOrder = [
  "LEFT_WEAPON_A",
  "LEFT_WEAPON_B",
  "LEFT_WEAPON_C",
  "RIGHT_WEAPON_A",
  "RIGHT_WEAPON_B",
  "RIGHT_WEAPON_C",
  "PISTE"
] as const

const sensedConductorOrder = ["LEFT_WEAPON_B", "LEFT_WEAPON_C", "RIGHT_WEAPON_B", "RIGHT_WEAPON_C", "PISTE"] as const

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("P0 acquisition cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor))
      throw new RangeError("P0 acquisition must contain data only")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (!Array.isArray(actual) && !(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every(
      (key) => actualKeys.includes(key) && sameDataGraph(Reflect.get(actual, key), Reflect.get(expected, key))
    )
  )
}

const conductors = conductorOrder.map((line, index) => ({
  line,
  muxChannel: index + 1,
  sourceResistanceOhm: 470,
  sinkResistanceOhm: 470,
  senseBuffer: sensedConductorOrder.includes(line as (typeof sensedConductorOrder)[number])
    ? `U_SENSE_BUFFER_${sensedConductorOrder.indexOf(line as (typeof sensedConductorOrder)[number]) + 1}`
    : null,
  role: line.endsWith("_A") ? "controlled excitation only" : "controlled excitation, sink, and protected sense"
}))

const definition = {
  artifactKind: "p0-phased-seven-conductor-acquisition",
  workUnit: "P0-03",
  revision: "P0-CS-B",
  priorArtCorrection: {
    source: "OpenPiste PCB revision 1.2 and pinned firmware",
    finding:
      "The seven connector conductors are exercised as named drive/read relations, not sampled as seven simultaneous independent voltages.",
    adopted:
      "A conductors are excitation-only; B, C, and piste are the five sensed nodes. Every phase selects exactly one source, one sink, and one sense relation.",
    notAdopted:
      "Direct ESP32 GPIO exposure, raw internal-ADC thresholds, OpenPiste component values, firmware, PCB geometry, and any claim of FIE conformance."
  },
  conductors,
  sensedConductors: [...sensedConductorOrder],
  phaseHardware: {
    sourceMux: { reference: "U_SOURCE_MUX", mpn: "TMUX1208PWR", common: "VREF_2V5", activeHighEnable: true },
    sinkMux: { reference: "U_SINK_MUX", mpn: "TMUX1208PWR", common: "SCORING_SGND", activeHighEnable: true },
    senseMux: { reference: "U_SENSE_MUX", mpn: "TMUX1208PWR", common: "ADC_DRIVER_INPUT", activeHighEnable: true },
    control: {
      registers: ["U_PHASE_CONTROL_1", "U_PHASE_CONTROL_2"],
      mpn: "SN74HCS595PWR",
      sharedBus: { clock: "APP_SPI_SCK", data: "APP_SPI_MOSI" },
      latch: "SOURCE_LATCH on GPIO47",
      outputEnable: "SOURCE_OE_N on GPIO36; 100 kilohm pull-up disables both registers",
      reset: "APP_RESET_N clears both registers; all three active-high mux enables therefore remain low",
      invariant:
        "Firmware writes a complete source/sink/sense phase before enabling any mux. Source and sink may never select the same conductor."
    }
  },
  analogPath: {
    protection: "two TPD4E05U06DQAR arrays plus one 22 ohm series resistor per external conductor",
    senseBuffers: {
      count: 5,
      mpn: "ADA4177-1ARZ",
      lines: [...sensedConductorOrder],
      reason: "retain per-sense-node input overvoltage tolerance before the shared sense mux"
    },
    adc: { count: 1, reference: "U_SAR", mpn: "ADS8881IDGS", resolutionBits: 18, maximumSamplesPerSecond: 1_000_000 },
    reference: { count: 1, reference: "U_REF", mpn: "REF5025AQDRQ1", volts: 2.5 },
    negativeRail: { count: 1, reference: "U_NEGATIVE_RAIL", mpn: "TPS60400DBVR" },
    measurement:
      "Selected source and sink paths form a calibrated divider through the external relation. The selected protected sense node is digitized; open, closed, resistance, grounded, cross-line, and indeterminate results are derived from named phases, never a simultaneous snapshot."
  },
  timing: {
    adcSignals: [
      { gpio: 4, signal: "SAR_SCLK", direction: "output" },
      { gpio: 5, signal: "SAR_DOUT", direction: "input" },
      { gpio: 6, signal: "SAR_CONVST", direction: "output" }
    ],
    phaseSettleBudgetUs: 3,
    adcConversionMaximumUs: 0.71,
    serialClockHz: 20_000_000,
    serialBits: 18,
    maximumPhaseUs: 4.61,
    scheduler:
      "Sample the two weapon-critical relations every fast cycle; interleave target, guard, piste, leakage, and health relations without treating one full relation matrix as one atomic ADC snapshot."
  },
  quantities: [
    { reference: "U_PHASE_CONTROL", mpn: "SN74HCS595PWR", quantity: 2 },
    { reference: "U_SOURCE_MUX/U_SINK_MUX/U_SENSE_MUX", mpn: "TMUX1208PWR", quantity: 3 },
    { reference: "U_SENSE_BUFFER", mpn: "ADA4177-1ARZ", quantity: 5 },
    { reference: "U_SAR", mpn: "ADS8881IDGS", quantity: 1 },
    { reference: "U_REF", mpn: "REF5025AQDRQ1", quantity: 1 },
    { reference: "U_NEGATIVE_RAIL", mpn: "TPS60400DBVR", quantity: 1 },
    { reference: "U_ESD", mpn: "TPD4E05U06DQAR", quantity: 2 },
    { reference: "R_LINE", value: "22 ohm", quantity: 7 },
    { reference: "R_SOURCE", value: "470 ohm 0.1 percent", quantity: 7 },
    { reference: "R_SINK", value: "470 ohm 0.1 percent", quantity: 7 }
  ],
  dependencies: { stm32: false, isolationHardware: false, esp32InternalAdc: false },
  authority: {
    schematicIntegrated: false,
    calibratedResistanceProven: false,
    overloadRecoveryProven: false,
    fieConformanceProven: false,
    fabricationAuthorized: false
  }
} as const

export const p0SevenLineAcquisition = deepFreeze(definition)

export function validateP0SevenLineAcquisition(value: unknown): true {
  if (!sameDataGraph(value, p0SevenLineAcquisition))
    throw new RangeError("P0 acquisition must match the reviewed graph")
  if (
    p0SevenLineAcquisition.conductors.length !== 7 ||
    p0SevenLineAcquisition.sensedConductors.length !== 5 ||
    p0SevenLineAcquisition.conductors.filter(({ senseBuffer }) => senseBuffer !== null).length !== 5 ||
    p0SevenLineAcquisition.phaseHardware.control.registers.length !== 2 ||
    p0SevenLineAcquisition.timing.maximumPhaseUs > 5 ||
    p0SevenLineAcquisition.dependencies.stm32 ||
    p0SevenLineAcquisition.dependencies.isolationHardware ||
    p0SevenLineAcquisition.dependencies.esp32InternalAdc ||
    p0SevenLineAcquisition.authority.fieConformanceProven ||
    p0SevenLineAcquisition.authority.fabricationAuthorized
  ) {
    throw new RangeError("P0 conductor roles, phase safety, timing, or authority are invalid")
  }
  return true
}

validateP0SevenLineAcquisition(p0SevenLineAcquisition)
