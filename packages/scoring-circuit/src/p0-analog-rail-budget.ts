import { p0SevenLineAcquisition } from "./p0-seven-line-acquisition.js"

type PlainRecord = Record<PropertyKey, unknown>
const isPlainRecord = (value: unknown): value is PlainRecord =>
  value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype

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

const phaseCurrentA = 2.5 / (470 + 22 + 470)

const definition = {
  artifactKind: "p0-phased-analog-rail-budget",
  workUnit: "P0-02",
  acquisitionRevision: p0SevenLineAcquisition.revision,
  quantities: {
    conductorCount: 7,
    sensedConductorCount: 5,
    adcCount: 1,
    referenceCount: 1,
    bufferCount: 5,
    muxCount: 3,
    phaseRegisterCount: 2,
    removedComparedWithP0CsA: {
      adc: 6,
      reference: 6,
      buffer: 2,
      adcReferenceReservoir: 6,
      adcBypassCapacitors: 12
    }
  },
  topology: {
    V5_ANALOG: ["one REF5025 input", "five ADA4177 positive rails", "one TPS60400 input"],
    VNEG_ANALOG: ["five ADA4177 negative rails"],
    APP_3V3: ["one ADS8881 AVDD/DVDD", "three TMUX1208", "two SN74HCS595"],
    VREF_2V5: ["one ADS8881 reference loop", "one selected 470-ohm source path per phase"],
    excluded: ["STM32", "isolation converter", "seven simultaneous sources", "ESP32 internal ADC"]
  },
  arithmetic: {
    assumptions: {
      maximumSimultaneousSourcePaths: 1,
      sourceVolts: 2.5,
      sourceResistanceOhm: 470,
      lineResistanceOhm: 22,
      sinkResistanceOhm: 470,
      referenceQuiescentCurrentA: 0.0012,
      bufferCurrentPerRailA: 0.0006,
      chargePumpQuiescentCurrentA: 0.00027,
      adcAvddBoundA: 0.0024
    },
    continuous: {
      selectedPhaseCurrentA: phaseCurrentA,
      referenceOutputCurrentA: phaseCurrentA,
      v5NegativeOutputCurrentA: 0.003,
      v5AnalogPaperCurrentA: 0.0012 + phaseCurrentA + 0.003 + 0.00327,
      app3v3BoundedSubtotalCurrentA: 0.0024 + 0.000003 + 0.000004 + 0.000033 + 0.000099,
      completeRailTotal: false
    },
    startupNominalCapacitanceUf: {
      V5_ANALOG: 2.5,
      VNEG_ANALOG: 1.5,
      APP_3V3: 2.5,
      VREF_2V5: 20.1
    }
  },
  evidence: {
    state: "paper-screen",
    measured: false,
    open: [
      "TMUX1208 source/sink/sense switching and break-before-make captures",
      "one-phase REF5025 and ADS8881 dynamic-load recovery",
      "TPS60400 negative-rail ripple and five-buffer overload recovery",
      "effective capacitor value, startup, brownout, and temperature captures"
    ]
  },
  authority: {
    schematicBudgetInput: true,
    completeRailBudgetPassed: false,
    physicalPowerEvidencePassed: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeP0AnalogRailBudget = Object.freeze(definition)

export function validateBenchPrototypeP0AnalogRailBudget(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeP0AnalogRailBudget))
    throw new RangeError("P0 rail budget must match the reviewed graph")
  if (
    benchPrototypeP0AnalogRailBudget.acquisitionRevision !== "P0-CS-B" ||
    benchPrototypeP0AnalogRailBudget.quantities.adcCount !== 1 ||
    benchPrototypeP0AnalogRailBudget.quantities.referenceCount !== 1 ||
    benchPrototypeP0AnalogRailBudget.arithmetic.assumptions.maximumSimultaneousSourcePaths !== 1 ||
    benchPrototypeP0AnalogRailBudget.arithmetic.continuous.completeRailTotal ||
    benchPrototypeP0AnalogRailBudget.evidence.measured ||
    benchPrototypeP0AnalogRailBudget.authority.fabricationAuthorized
  ) {
    throw new RangeError("P0 rail quantity, concurrency, or evidence boundary drifted")
  }
  return true
}

validateBenchPrototypeP0AnalogRailBudget(benchPrototypeP0AnalogRailBudget)
