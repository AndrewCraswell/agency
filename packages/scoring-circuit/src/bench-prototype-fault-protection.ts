import { benchPrototypeAnalogTopology } from "./bench-prototype-analog-topology.js"
import { oneChannelAnalogExperiment, oneChannelGuardedFaultScreen } from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentReadiness } from "./one-channel-analog-readiness.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

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

function readExactDataRecord(value: unknown, requiredKeys: readonly string[], label: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new RangeError(`${label} must be a plain data record`)
  const actualKeys = Reflect.ownKeys(value)
  if (
    actualKeys.length !== requiredKeys.length ||
    actualKeys.some((key) => typeof key !== "string" || !requiredKeys.includes(key))
  ) {
    throw new RangeError(`${label} must contain exactly the reviewed keys`)
  }

  const record: Record<string, unknown> = {}
  for (const key of requiredKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError(`${label}.${key} must be an own data property`)
    }
    record[key] = descriptor.value
  }
  return record
}

function readExactBooleanRecord(
  value: unknown,
  requiredKeys: readonly string[],
  label: string
): Record<string, boolean> {
  const record = readExactDataRecord(value, requiredKeys, label)
  const witness: Record<string, boolean> = {}
  for (const key of requiredKeys) {
    const booleanValue = record[key]
    if (typeof booleanValue !== "boolean") throw new RangeError(`${label}.${key} must be a Boolean data property`)
    witness[key] = booleanValue
  }
  return witness
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
    )
      return false
    const keys = Reflect.ownKeys(actual)
    if (keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))) return false
    return expected.every((entry, index) => hasExactDataGraph(actual[index], entry, seen))
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  )
    return false

  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    return Boolean(descriptor && "value" in descriptor && hasExactDataGraph(descriptor.value, expected[key], seen))
  })
}

export function calculateGuardedFaultEnvelope(input: { appliedVolts: number; pulseDurationMs: number }): {
  appliedVolts: number
  maximumSourceEnergyJ: number
  maximumSourcePowerW: number
  pulseDurationMs: number
  sourceCurrentA: number
  sourceEnvelopeOnly: true
} {
  const { appliedVolts, pulseDurationMs } = input
  const { faultGuard } = oneChannelAnalogExperiment
  if (
    !Number.isFinite(appliedVolts) ||
    !Number.isFinite(pulseDurationMs) ||
    Math.abs(appliedVolts) > faultGuard.maximumAppliedVolts ||
    pulseDurationMs <= 0 ||
    pulseDurationMs > faultGuard.maximumPulseDurationMs
  ) {
    throw new RangeError("guarded fault input must be finite and inside the reviewed 24 V, 100 ms source envelope")
  }

  const sourceCurrentA = Math.abs(appliedVolts) / faultGuard.minimumResistanceOhms
  const maximumSourcePowerW = appliedVolts ** 2 / faultGuard.minimumResistanceOhms
  return {
    appliedVolts,
    maximumSourceEnergyJ: maximumSourcePowerW * (pulseDurationMs / 1_000),
    maximumSourcePowerW,
    pulseDurationMs,
    sourceCurrentA,
    sourceEnvelopeOnly: true
  }
}

const maximumGuardedEnvelope = calculateGuardedFaultEnvelope({ appliedVolts: 24, pulseDurationMs: 100 })

const guardedFaultWitnessRequirements = deepFreeze({
  beforePulse: [
    "fixturePermitObserved",
    "currentTripArmed",
    "watchdogHealthy",
    "normalSourceDisabled",
    "sinkDisabled",
    "sourceSinkForceMutualExclusionObserved",
    "dwellTimerArmed",
    "interPulseTimerSatisfied"
  ],
  health: [
    "referenceHealthy",
    "positiveAnalogRailHealthy",
    "negativeAnalogRailHealthy",
    "overloadClear",
    "adcCodeExpected"
  ],
  traceObserved: [
    "line",
    "postTpd",
    "bufferInput",
    "bufferOutput",
    "ads8881Ainp",
    "s5vIsolated",
    "s5vNeg",
    "ref5025Output",
    "guardedForceVoltage",
    "guardedForceCurrent"
  ]
} as const)

const guardedFaultWitnessTopLevelKeys = [
  "appliedVolts",
  "beforePulse",
  "health",
  "powered",
  "pulseDurationMs",
  "stopConditionObserved",
  "traceObserved"
] as const

export function evaluateGuardedFaultCaptureWitness(input: unknown): {
  approval: false
  evidenceState: "capture-eligible-no-approval" | "unavailable"
  polarity: "minus" | "plus"
  reasons: readonly string[]
  sourceEnvelope: ReturnType<typeof calculateGuardedFaultEnvelope>
} {
  const witness = readExactDataRecord(input, guardedFaultWitnessTopLevelKeys, "guarded-fault witness")
  const { appliedVolts, powered, pulseDurationMs, stopConditionObserved } = witness
  if (
    typeof appliedVolts !== "number" ||
    !Number.isFinite(appliedVolts) ||
    appliedVolts === 0 ||
    typeof pulseDurationMs !== "number" ||
    typeof powered !== "boolean" ||
    typeof stopConditionObserved !== "boolean"
  ) {
    throw new RangeError("guarded-fault witness must use finite nonzero volts and Boolean powered and stop fields")
  }

  const beforePulse = readExactBooleanRecord(
    witness.beforePulse,
    guardedFaultWitnessRequirements.beforePulse,
    "beforePulse"
  )
  const health = readExactBooleanRecord(witness.health, guardedFaultWitnessRequirements.health, "health")
  const traceObserved = readExactBooleanRecord(
    witness.traceObserved,
    guardedFaultWitnessRequirements.traceObserved,
    "traceObserved"
  )
  const sourceEnvelope = calculateGuardedFaultEnvelope({ appliedVolts, pulseDurationMs })
  const reasons = [
    ...Object.entries(beforePulse)
      .filter(([, observed]) => !observed)
      .map(([key]) => `before-pulse witness absent: ${key}`),
    ...Object.entries(health)
      .filter(([, observed]) => !observed)
      .map(([key]) => `health witness absent: ${key}`),
    ...Object.entries(traceObserved)
      .filter(([, observed]) => !observed)
      .map(([key]) => `required trace absent: ${key}`),
    ...(stopConditionObserved ? ["fixture stop condition observed"] : []),
    ...(!powered ? ["unpowered behavior remains unvalidated and denied"] : [])
  ]

  return deepFreeze({
    approval: false,
    evidenceState: reasons.length === 0 ? "capture-eligible-no-approval" : "unavailable",
    polarity: appliedVolts < 0 ? "minus" : "plus",
    reasons,
    sourceEnvelope
  })
}

const selectedParts = deepFreeze([
  {
    mpn: "43650-0300",
    package: "Micro-Fit 3.0, 3-circuit right-angle THT header",
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/436500300",
    reference: "J_FIXTURE"
  },
  {
    mpn: "B2B-PH-K-S(LF)(SN)",
    package: "PH, 2-circuit vertical THT",
    primaryEvidenceUrl: "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf",
    reference: "J_GUARDED_FORCE"
  },
  {
    mpn: "TPD4E05U06DQAR",
    package: "DQA USON-10",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
    reference: "U_ESD"
  },
  {
    mpn: "CRCW060322R0FKEAHP",
    package: "0603",
    primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    reference: "R_ESD"
  },
  {
    mpn: "CRCW120656K0FKEAHP",
    package: "1206",
    primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    reference: "R_FAULT_GUARD"
  },
  {
    mpn: "TMUX1112PWR",
    package: "PW TSSOP-16",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf",
    reference: "U_SOURCE_SWITCH"
  },
  {
    mpn: "ADA4177-1BRZ",
    package: "R SOIC-8",
    primaryEvidenceUrl:
      "https://www.analog.com/media/en/technical-documentation/data-sheets/ada4177-1_4177-2_4177-4.pdf",
    reference: "U_OVP_BUFFER"
  },
  {
    mpn: "CRCW060320R0FKEAHP",
    package: "0603",
    primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    reference: "R_SAR"
  },
  {
    mpn: "ADS8881IDGS",
    package: "DGS VSSOP-10",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
    reference: "U_SAR"
  }
] as const)

function selectedBomSnapshot() {
  return selectedParts.map(({ reference }) => {
    const matches = oneChannelAnalogExperimentBom.filter((row) => row.reference === reference)
    const row = matches.length === 1 ? matches[0] : undefined
    return row === undefined
      ? {
          mpn: "__MISSING_OR_DUPLICATE__",
          package: "__MISSING_OR_DUPLICATE__",
          primaryEvidenceUrl: "__MISSING_OR_DUPLICATE__",
          reference
        }
      : {
          mpn: row.mpn,
          package: row.package,
          primaryEvidenceUrl: row.primaryEvidenceUrl,
          reference: row.reference
        }
  })
}

function liveSelectedBomMatchesIndependentIdentity(): boolean {
  const snapshot = selectedBomSnapshot()
  return (
    snapshot.every((row) => !Object.values(row).includes("__MISSING_OR_DUPLICATE__")) &&
    hasExactDataGraph(snapshot, selectedParts)
  )
}

if (!liveSelectedBomMatchesIndependentIdentity()) {
  throw new RangeError(
    "BP-102 readiness BOM was missing, duplicate, sentinel-valued, or identity-mismatched before contract initialization"
  )
}

export const benchPrototypeFaultProtection = deepFreeze({
  workUnit: "BP-102",
  decision: "freeze-one-channel-connector-side-protection-and-evidence-gated-guarded-fault-contract",
  exactNetwork: {
    normalSignal:
      "J_FIXTURE pin 1 LINE -> U_ESD TPD4E05U06DQAR pin 1 LINE_SHUNT and R_ESD pin 1; R_ESD 22 ohm pin 2 -> TMUX1112 QUIET -> ADA4177-1BRZ non-inverting input",
    guardedInjection:
      "external force source -> externally interlocked normally-open relay -> J_GUARDED_FORCE pin 1 FORCE -> R_FAULT_GUARD CRCW120656K0FKEAHP 56 kohm 1 percent -> LINE; the normal source and guarded force are never enabled together",
    protectedAcquisition:
      "ADA4177-1BRZ unity buffer on S5V_ISOLATED and S5V_NEG -> R_SAR CRCW060320R0FKEAHP 20 ohm -> ADS8881IDGS AINP; ADS8881 AINN -> SCORING_SGND"
  },
  circuitPinAndNetMap: {
    J_FIXTURE: { 1: "LINE", 2: "SGND", 3: "ESD_RETURN_RESERVED_NC" },
    J_GUARDED_FORCE: { 1: "FORCE", 2: "SGND" },
    U_ESD: { 1: "LINE_SHUNT", 3: "SGND_3 -> SGND", 8: "SGND_8 -> SGND" },
    signalBranches: [
      "LINE -> U_ESD.LINE_SHUNT",
      "LINE -> R_ESD.pin1 -> R_ESD.pin2 -> U_SOURCE_SWITCH.QUIET -> U_OVP_BUFFER.BUFFER_INPUT",
      "FORCE -> R_FAULT_GUARD.pin1 -> R_FAULT_GUARD.pin2 -> LINE"
    ],
    normalPin3Disposition:
      "reserved and electrically unconnected; no separate ESD_RETURN net is released because the circuit ties both U_ESD ground pins directly to SGND"
  },
  selectedParts,
  connectorSafety: {
    boardConnectorsAreMale: true,
    normal: {
      mateMpn: "43645-0300",
      pinMap: { 1: "LINE", 2: "SGND", 3: "ESD_RETURN_RESERVED_NC" },
      pitchMm: 3,
      positions: 3
    },
    guarded: { mateMpn: "PHR-2", pinMap: { 1: "FORCE", 2: "SGND" }, pitchMm: 2, positions: 2 },
    physicallyMutuallyIncompatible: true,
    requiredPreConnectionEvidence: [
      "cable drawing and pin-one orientation",
      "drill pattern and assembled keying test",
      "strain-relief and connector-to-fixture continuity record"
    ]
  },
  guardedSourceEnvelope: {
    maximumAppliedVolts: 24,
    maximumPulseDurationMs: 100,
    minimumPulseIntervalMs: 10_000,
    minimumGuardResistanceOhms: 55_440,
    maximumAt24V100Ms: maximumGuardedEnvelope,
    appliesOnlyTo:
      "source energy entering the 56 kohm guard; it gives no downstream clamp, TPD, buffer, ADC, rail, thermal, or survival credit"
  },
  fixtureInterlock: {
    forceRelay: "externally interlocked, normally open, and observed closed only for a guarded pulse",
    requiredForFavorableMeasurement: [
      "reference observed healthy",
      "positive analog rail observed healthy",
      "negative analog rail observed healthy",
      "overload observed clear",
      "ADC code observed expected"
    ],
    requiredBeforeGuardedPulse: [
      "fixture permit observed",
      "current trip armed",
      "watchdog healthy",
      "source disabled and observed disabled",
      "sink disabled and observed disabled",
      "source/sink/force mutual exclusion observed",
      "100 ms dwell timer armed",
      "10 second inter-pulse timer satisfied"
    ],
    stopConditions: [
      "reference loss",
      "isolated rail fault",
      "overload or unexpected ADC code",
      "watchdog or interlock disagreement",
      "missing required trace"
    ],
    faultOutcome: "unavailable-never-favorable-measurement"
  },
  unpoweredBehavior: {
    status: "unvalidated-deny",
    noCreditFor: [
      "TPD clamping",
      "buffer input current",
      "ADC pin behavior",
      "rail injection",
      "back-powering",
      "recovery"
    ],
    requiredEvidence: [
      "unpowered plus and minus guarded-pulse voltage and current traces at LINE, post-TPD, buffer input, buffer output, ADS8881 AINP, and each analog rail",
      "component rating-margin review using measured peak current, voltage, power, and energy",
      "post-pulse continuity, leakage, rail-startup, reference, ADC-code, and buffer-overload recovery records"
    ]
  },
  overloadRecovery: {
    status: "unvalidated-deny",
    requiredConditions: [
      "powered and unpowered states",
      "minus and plus guarded-voltage matrix through 24 V only",
      "cold, ambient, and hot assembled-board conditions",
      "normal source disabled throughout each guarded pulse",
      "before, during, and after pulse traces plus a subsequent normal-resistance record"
    ],
    requiredTraceNodes: [
      "LINE",
      "post-TPD",
      "buffer input",
      "buffer output",
      "ADS8881 AINP",
      "S5V_ISOLATED",
      "S5V_NEG",
      "REF5025A-Q1 output",
      "guarded force voltage",
      "guarded force current"
    ],
    approval: false
  },
  authority: {
    sustainedPlusMinus24VApproved: false,
    unpoweredFaultApproved: false,
    recoveryValidated: false,
    schematicIntegrationAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const)

const expectedUpstream = deepFreeze({
  bp100: {
    selectedReferences: structuredClone(benchPrototypeAnalogTopology.selectedReferences),
    selectedNormalChain: benchPrototypeAnalogTopology.selectedChain.normal,
    selectedGuardedChain: benchPrototypeAnalogTopology.selectedChain.guardedFault
  },
  connectorSafety: structuredClone(oneChannelAnalogExperimentReadiness.connectorSafety),
  experiment: {
    acquisition: {
      adc: oneChannelAnalogExperiment.acquisition.adc,
      buffer: oneChannelAnalogExperiment.acquisition.buffer,
      bufferNegativeRailVolts: oneChannelAnalogExperiment.acquisition.bufferNegativeRailVolts,
      bufferPositiveRailVolts: oneChannelAnalogExperiment.acquisition.bufferPositiveRailVolts
    },
    faultGuard: structuredClone(oneChannelAnalogExperiment.faultGuard),
    source: { switch: oneChannelAnalogExperiment.source.switch }
  },
  selectedParts: structuredClone(selectedParts),
  negative24V: oneChannelGuardedFaultScreen(-24),
  positive24V: oneChannelGuardedFaultScreen(24)
})

function currentUpstreamSnapshot() {
  return {
    bp100: {
      selectedReferences: benchPrototypeAnalogTopology.selectedReferences,
      selectedNormalChain: benchPrototypeAnalogTopology.selectedChain.normal,
      selectedGuardedChain: benchPrototypeAnalogTopology.selectedChain.guardedFault
    },
    connectorSafety: oneChannelAnalogExperimentReadiness.connectorSafety,
    experiment: {
      acquisition: {
        adc: oneChannelAnalogExperiment.acquisition.adc,
        buffer: oneChannelAnalogExperiment.acquisition.buffer,
        bufferNegativeRailVolts: oneChannelAnalogExperiment.acquisition.bufferNegativeRailVolts,
        bufferPositiveRailVolts: oneChannelAnalogExperiment.acquisition.bufferPositiveRailVolts
      },
      faultGuard: oneChannelAnalogExperiment.faultGuard,
      source: { switch: oneChannelAnalogExperiment.source.switch }
    },
    selectedParts: selectedBomSnapshot(),
    negative24V: oneChannelGuardedFaultScreen(-24),
    positive24V: oneChannelGuardedFaultScreen(24)
  }
}

const expectedMaximumGuardedEnvelope = deepFreeze(maximumGuardedEnvelope)

export function validateBenchPrototypeFaultProtection(value: unknown): true {
  if (!hasExactDataGraph(value, benchPrototypeFaultProtection)) {
    throw new RangeError("BP-102 fault-protection decision must exactly match the reviewed canonical decision")
  }
  if (!liveSelectedBomMatchesIndependentIdentity() || !hasExactDataGraph(currentUpstreamSnapshot(), expectedUpstream)) {
    throw new RangeError("BP-102 connector or guarded-fault provenance drifted from the reviewed decision")
  }
  const liveEnvelope = calculateGuardedFaultEnvelope({ appliedVolts: 24, pulseDurationMs: 100 })
  if (!hasExactDataGraph(liveEnvelope, expectedMaximumGuardedEnvelope)) {
    throw new RangeError("BP-102 guarded-source arithmetic drifted from the reviewed decision")
  }
  return true
}
