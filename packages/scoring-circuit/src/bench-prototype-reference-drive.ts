import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import {
  ads8881ReferenceNetworkRequirement,
  oneChannelAnalogExperimentBom,
  ref5025OutputCapacitorRequirement
} from "./one-channel-analog-readiness.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as PlainRecord)[key], seen)
  return Object.freeze(value)
}

/** Rejects getters, prototypes, holes, symbols, unexpected keys, and aliases. */
function hasExactDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false

  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  if (Array.isArray(expected)) {
    if (
      !Array.isArray(actual) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      actual.length !== expected.length
    ) {
      return false
    }
    const keys = Reflect.ownKeys(actual)
    if (keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))) {
      return false
    }
    return expected.every((entry, index) => hasExactDataGraph(actual[index], entry, seen))
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }

  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    return Boolean(descriptor && "value" in descriptor && hasExactDataGraph(descriptor.value, expected[key], seen))
  })
}

const referenceParts = [
  ["U_REF", "REF5025AQDRQ1"],
  ["C_REF_IN", "GRM188R71A105KA12D"],
  ["C_REF_REG", "T521B106M025ATE100"],
  ["C_REF_REG_HF", "C0603C104K3RACTU"],
  ["R_REF_SAR", "RCWE0603R220FKEA"],
  ["C_REF", "GRM21BR71A106KE51L"],
  ["U_SAR", "ADS8881IDGS"]
] as const

const primaryEvidence = {
  ads8881: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
  ref5025aQ1: "https://www.ti.com/lit/gpn/REF5025A-Q1",
  cRefReg: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
  cRefInput: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A105KA12-01.pdf",
  cRefRegHighFrequency: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en",
  cRefSar: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf",
  rRefSar: "https://www.vishay.com/docs/20019/rcwe.pdf"
} as const

/**
 * An illustrative passive-only load envelope. It is a capture stimulus, not
 * a claim that ADS8881 draws this charge or that REF5025 settles this amount.
 */
export function calculateReferenceTransientScreen(input: {
  capacitorMinimumUf: number
  capacitorMaximumEsrOhms: number
  chargePulseNc: number
  pulseWidthUs: number
}): {
  capacitorDroopMv: number
  chargePulseNc: number
  esrStepMv: number
  illustrativePulseCurrentMa: number
  modelIsPassiveOnly: true
  pulseWidthUs: number
  totalUnregulatedStepMv: number
  validatesDynamicLoad: false
} {
  const { capacitorMinimumUf, capacitorMaximumEsrOhms, chargePulseNc, pulseWidthUs } = input
  if (
    !Number.isFinite(capacitorMinimumUf) ||
    !Number.isFinite(capacitorMaximumEsrOhms) ||
    !Number.isFinite(chargePulseNc) ||
    !Number.isFinite(pulseWidthUs) ||
    capacitorMinimumUf <= 0 ||
    capacitorMaximumEsrOhms < 0 ||
    chargePulseNc < 0 ||
    pulseWidthUs <= 0
  ) {
    throw new RangeError(
      "reference transient inputs must be finite, with positive capacitance/pulse width and non-negative ESR/charge"
    )
  }

  const illustrativePulseCurrentMa = chargePulseNc / pulseWidthUs
  const capacitorDroopMv = Number((chargePulseNc / capacitorMinimumUf).toFixed(12))
  const esrStepMv = Number((illustrativePulseCurrentMa * capacitorMaximumEsrOhms).toFixed(12))
  return {
    capacitorDroopMv,
    chargePulseNc,
    esrStepMv,
    illustrativePulseCurrentMa,
    modelIsPassiveOnly: true,
    pulseWidthUs,
    totalUnregulatedStepMv: Number((capacitorDroopMv + esrStepMv).toFixed(12)),
    validatesDynamicLoad: false
  }
}

const illustrativeScreen = calculateReferenceTransientScreen({
  capacitorMinimumUf: 8,
  capacitorMaximumEsrOhms: 0.1,
  chargePulseNc: 100,
  pulseWidthUs: 1
})

export const benchPrototypeReferenceDrive = deepFreeze({
  workUnit: "BP-101",
  decision: "freeze-reference-network-and-require-measured-sar-reference-transient-evidence",
  selectedParts: referenceParts,
  topology: {
    input:
      "S5V_ISOLATED -> C_REF_IN 1 uF X7R directly to SCORING_SGND at REF5025A-Q1 IN/GND; no shared return through ADS8881 or digital decoupling",
    regulatorOutput:
      "REF5025A-Q1 OUT -> C_REF_REG 10 uF polymer tantalum in parallel with C_REF_REG_HF 100 nF X7R -> SCORING_SGND, entirely inside the regulator-local loop",
    adc: "REF5025A-Q1 OUT -> R_REF_SAR 0.22 ohm -> ADS_REF2V5; C_REF 10 uF X7R 0805 is the only capacitor directly across ADS8881 REF/GND; AINN remains SCORING_SGND"
  },
  ref5025LocalStabilization: {
    inputBypassUf: 1,
    outputMaximumCapacitanceUf: 50,
    outputMaximumEsrOhms: 1.5,
    outputMinimumCapacitanceUf: 1,
    selectedCapacitanceUf: 10,
    selectedManufacturerMaximumEsrOhms: 0.1,
    selectedMpn: "T521B106M025ATE100",
    highFrequencyBypassMpn: "C0603C104K3RACTU"
  },
  ads8881LocalReservoir: {
    capacitorMpn: "GRM21BR71A106KE51L",
    capacitanceUf: 10,
    dielectric: "X7R",
    package: "0805",
    feedResistorMpn: "RCWE0603R220FKEA",
    feedResistanceOhms: 0.22,
    permittedFeedResistanceOhms: [0.1, 0.47],
    lowerValueParallelCapacitorPermitted: false
  },
  netRename: {
    isolatedPositive: { legacy: "S5V_ISO", canonical: "S5V_ISOLATED" },
    scoringReturn: { legacy: "SGND", canonical: "SCORING_SGND" },
    validatedForBp101Contract: true
  },
  layoutLoops: {
    ref5025Output: {
      members: ["U_REF OUT/GND", "C_REF_REG", "C_REF_REG_HF"],
      maximumConductorLengthInches: 0.1,
      maximumEstimatedLoopInductanceNh: 2,
      maximumViasPerConductor: 0,
      separateFromAds8881LocalLoop: true
    },
    ads8881Reference: {
      members: ["R_REF_SAR output", "U_SAR REF/GND", "C_REF"],
      maximumConductorLengthInches: 0.1,
      maximumEstimatedLoopInductanceNh: 2,
      maximumViasPerConductor: 0,
      lowerValueParallelCapacitorPermitted: false
    },
    requiredLayoutEvidence: [
      "annotated placement and copper screenshot with reference designators and net names",
      "measured pad-to-pad conductor lengths for both loops",
      "via count for each loop conductor",
      "post-layout extracted loop inductance for each loop"
    ],
    evidenceAccepted: false
  },
  illustrativeTransientScreen: {
    assumptions: {
      capacitorMinimumUf: 8,
      capacitorMaximumEsrOhms: 0.1,
      chargePulseNc: 100,
      pulseWidthUs: 1
    },
    result: illustrativeScreen,
    interpretation:
      "This illustrative passive-only 100 nC, 1 us stimulus is intentionally not attributed to ADS8881 and is not an upper bound. It excludes REF5025 loop response, capacitor DC bias, ESL, trace inductance, converter ripple, ADC conversion phasing, and probe loading."
  },
  capturePlan: {
    trigger: "ADS8881 CONVST at the selected acquisition rate, with source transition held separately quiet",
    requiredNodes: [
      "ADS_REF2V5 at ADS8881 REF/GND",
      "REF5025A-Q1 OUT/GND",
      "S5V_ISOLATED at REF5025A-Q1 IN/GND",
      "SCORING_SGND near ADS8881 GND"
    ],
    requiredConditions: [
      "single conversion and sustained conversion bursts at the chosen one-channel rate",
      "cold, ambient, and hot validated board conditions",
      "source off and the largest normal source-on signal",
      "isolated-converter and charge-pump operating, plus separately controlled power-transition captures"
    ],
    archiveMustInclude: [
      "probe model, bandwidth limit, grounding method, calibration state, and exact probe points",
      "raw waveform files with time base, sample rate, trigger position, board identifier, firmware digest, and SHA-256",
      "peak-to-peak ripple, conversion-correlated step, recovery time, ringing, and concurrent ADC-code statistics"
    ],
    measurementRequired: true
  },
  simulationAndEvidence: {
    artifactKind: "bench-prototype-reference-transient-evidence",
    simulation: {
      model: "bounded-behavioral-REF5025-to-ADS8881-reference-network-screen",
      status: "passed-bounded-behavioral-screen",
      modelAuthority:
        "No official REF5025A-Q1 macromodel or ADS8881 conversion-phase REF-load model is claimed. Declared behavioral parameters exercise the selected passive network only.",
      declaredModelInputs: [
        "2.5 V behavioral regulator target with 1 V declared input headroom",
        "1 uF C_REF_IN behind a declared 0.05 ohm source resistance",
        "100 mA, 1 us behavioral ADC reference-load pulse representing the illustrative 100 nC stimulus",
        "8 uF to 10 uF ADS8881-local effective capacitance with 0.05 ohm to 0.1 ohm declared ESR",
        "8 uF to 10 uF REF5025-local effective capacitance with 0.05 ohm to 0.1 ohm declared ESR",
        "0.22 ohm R_REF_SAR and 0.05 ohm to 0.1 ohm declared regulator output resistance",
        "cold, ambient, and hot labels that select declared behavioral values rather than vendor temperature bounds"
      ],
      requiredCases: [
        "single conversion at the selected one-channel acquisition rate",
        "sustained conversion burst at the selected one-channel acquisition rate",
        "source off and largest normal source-on signal",
        "cold, ambient, and hot component conditions",
        "isolated-converter startup and controlled power transitions"
      ],
      requiredArtifacts: [
        "versioned simulator and model identifiers",
        "machine-readable netlist and parameter manifest",
        "raw node waveforms for ADS_REF2V5 and REF5025A-Q1 OUT",
        "peak-to-peak ripple, conversion-correlated step, settling time, and ringing summary",
        "artifact digest bound to the exact selected-part and layout-parasitic inputs"
      ],
      execution: {
        command: "node packages/scoring-circuit/scripts/run-reference-drive-sim.mjs",
        engineIdentity: "ngspice-47 : Circuit level simulation program",
        caseCount: 12,
        rawWaveformPointCount: 126279,
        caseFamilies: ["single-conversion", "sustained-burst", "startup", "power-transition"],
        cornersC: [-40, 25, 125],
        boundedAcceptance: {
          dynamicMaximumDroopMv: 30,
          dynamicMaximumFinalErrorMv: 3,
          powerOffMaximumResidualMv: 1,
          powerTransitionMaximumCollapseUs: 50,
          powerTransitionMaximumRecoveryUs: 50,
          startupMaximumTimeTo99PercentUs: 150
        },
        observedEnvelope: {
          maximumDynamicDroopMv: 13.69,
          maximumDynamicFinalErrorMv: 2.11,
          maximumPowerOffResidualMv: 0.000000961191,
          maximumPowerTransitionCollapseUs: 7.848,
          maximumPowerTransitionRecoveryUs: 16.21,
          maximumStartupTimeTo99PercentUs: 94.71
        },
        artifactDigests: {
          netlistTemplateSha256: "87be1beb2285c6adc1ab4b620f7139445cf06b451f57264a94508658f66894c2",
          parameterManifestSha256: "5ca2d17e0664ace5c44ff4ed96113b1280b389591a2c1c03ba4ab17adce34f46",
          normalizedResultsSha256: "f3a2997911b1b700babc4822093731aa54c3286de8e941748f8e9a5764b5d975",
          waveformManifestSha256: "1c708bcb507b3cbed63ddd416524c478dafef2409949362dba9f528a4e98f62f",
          evidenceDigest: "79d700c8eddaf11a4a47ea1cd6e38ef29d8407effb30a1cef5cf6b2089b5599c"
        },
        reproduced: true,
        boundedSimulationPassed: true
      },
      unavailableSiliconEvidence: [
        "REF5025A-Q1 official transient macromodel or exact selected-condition output-impedance model",
        "ADS8881 conversion-phase REF current waveform or official REF-load macromodel",
        "temperature-qualified selected-capacitor DC-bias, ESR, and ESL bounds",
        "post-layout loop parasitics"
      ],
      performanceCredit: false
    },
    measurement: {
      status: "not-acquired",
      requiredArchiveFields: [
        "board identifier and exact populated-part manifest",
        "firmware digest and acquisition-rate configuration",
        "instrument model, serial, calibration certificate, and due date",
        "probe model, bandwidth limit, grounding method, and exact probe points",
        "raw waveform artifact with sample rate, time base, trigger position, and SHA-256",
        "concurrent ADC-code statistics and environmental condition"
      ],
      requiredComparison:
        "Compare measured REF5025A-Q1 OUT and ADS_REF2V5 traces with the simulation cases before any dynamic-load credit.",
      physicalEvidenceAccepted: false
    },
    correlation: {
      status: "not-assessed",
      required: true,
      acceptance:
        "Simulation and measurement must use identical case identifiers and bound inputs; any missing, substituted, or non-reproducible artifact keeps BP-101 denied."
    },
    authority: {
      boundedSimulationPassed: true,
      performanceClaimAccepted: false,
      measurementAccepted: false,
      correlationAccepted: false,
      releaseState: "deny"
    }
  },
  authority: {
    measuredTransientApproved: false,
    layoutApproved: false,
    footprintsApproved: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  primaryEvidence
} as const)

const expectedUpstream = deepFreeze({
  acquisition: {
    adc: "ADS8881IDGS",
    adcReferenceVolts: 2.5
  },
  reference: {
    cRef: {
      manufacturerEsrTestCondition: "25 C, 100 kHz",
      reference: "C_REF_REG",
      requiredMaximumCapacitanceUf: 50,
      requiredMaximumEsrOhms: 1.5,
      requiredMinimumCapacitanceUf: 1,
      selectedCapacitanceUf: 10,
      selectedManufacturerMaximumEsrOhms: 0.1,
      selectedMpn: "T521B106M025ATE100"
    },
    adcReferenceNetwork: {
      capacitor: {
        reference: "C_REF",
        dielectric: "X7R",
        nominalCapacitanceUf: 10,
        package: "0805",
        tolerancePercent: 10,
        selectedMpn: "GRM21BR71A106KE51L"
      },
      feedResistor: {
        allowedMaximumOhms: 0.47,
        allowedMinimumOhms: 0.1,
        reference: "R_REF_SAR",
        selectedOhms: 0.22,
        selectedMpn: "RCWE0603R220FKEA"
      },
      lowerValueParallelCapacitorPermittedAtAdcRef: false
    },
    partRows: referenceParts.map(([reference, mpn]) => ({ reference, mpn }))
  },
  isolatedRail: {
    converter: "NXE1S0505MC",
    reference: "REF5025AQDRQ1"
  }
} as const)

function currentUpstreamSnapshot() {
  return {
    acquisition: {
      adc: oneChannelAnalogExperiment.acquisition.adc,
      adcReferenceVolts: oneChannelAnalogExperiment.acquisition.adcReferenceVolts
    },
    reference: {
      cRef: ref5025OutputCapacitorRequirement,
      adcReferenceNetwork: ads8881ReferenceNetworkRequirement,
      partRows: referenceParts.map(([reference]) => {
        const matches = oneChannelAnalogExperimentBom.filter((row) => row.reference === reference)
        return { reference, mpn: matches.length === 1 ? matches[0]!.mpn : "__MISSING_OR_DUPLICATE__" }
      })
    },
    isolatedRail: {
      converter: oneChannelAnalogExperiment.isolatedRail.converter,
      reference: oneChannelAnalogExperiment.isolatedRail.reference
    }
  }
}

const expectedTransientScreen = deepFreeze(illustrativeScreen)

export function validateBenchPrototypeReferenceDrive(value: unknown): true {
  if (!hasExactDataGraph(value, benchPrototypeReferenceDrive)) {
    throw new RangeError("BP-101 reference-drive decision must exactly match the reviewed canonical decision")
  }
  if (!hasExactDataGraph(currentUpstreamSnapshot(), expectedUpstream)) {
    throw new RangeError("BP-101 reference-drive source provenance drifted from the reviewed decision")
  }
  const liveScreen = calculateReferenceTransientScreen(
    benchPrototypeReferenceDrive.illustrativeTransientScreen.assumptions
  )
  if (!hasExactDataGraph(liveScreen, expectedTransientScreen)) {
    throw new RangeError("BP-101 illustrative reference arithmetic drifted from the reviewed decision")
  }
  return true
}
