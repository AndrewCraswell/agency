import { calculateApplicationRail, defaultApplicationRailInputs } from "./application-rail.js"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import { componentDecisions } from "./component-decisions.js"

type ApplicationRailPart = {
  readonly references: readonly string[]
  readonly manufacturer: string
  readonly mpn: string
  readonly quantity: number
  readonly value: string
  readonly connection: string
}

const applicationRailSupportDefinition = [
  {
    references: ["U_APP_REGULATOR"],
    manufacturer: "Texas Instruments",
    mpn: "LMR43620MSC3RPERQ1",
    quantity: 1,
    value: "Fixed 3.3 V, 2 A, 2.2 MHz synchronous buck",
    connection: "VIN and EN/UVLO to V5; MODE/SYNC to VCC; GND to APP_GND; SW to L_APP_REGULATOR"
  },
  {
    references: ["L_APP_REGULATOR"],
    manufacturer: "Coilcraft",
    mpn: "XGL4030-222MEC",
    quantity: 1,
    value: "2.2 uH shielded power inductor",
    connection: "U_APP_REGULATOR.SW to V3_3"
  },
  {
    references: ["C_APP_REG_IN"],
    manufacturer: "TDK",
    mpn: "C2012X7R1E475K125AB",
    quantity: 1,
    value: "4.7 uF, 25 V, X7R, 0805",
    connection: "V5 to APP_GND at U_APP_REGULATOR.VIN"
  },
  {
    references: ["C_APP_REG_IN_HF", "C_APP_REG_BOOT"],
    manufacturer: "Yageo KEMET",
    mpn: "C0603C104K3RACTU",
    quantity: 2,
    value: "100 nF, 25 V, X7R, 0603",
    connection: "C_APP_REG_IN_HF: V5 to APP_GND at VIN; C_APP_REG_BOOT: BOOT to SW"
  },
  {
    references: ["C_APP_REG_VCC"],
    manufacturer: "Wurth Elektronik",
    mpn: "885012206052",
    quantity: 1,
    value: "1 uF, 16 V, +/-10%, X7R, 0603",
    connection: "U_APP_REGULATOR.VCC to APP_GND"
  },
  {
    references: ["C_APP_REG_OUT_A", "C_APP_REG_OUT_B", "C_APP_REG_OUT_C"],
    manufacturer: "TDK",
    mpn: "C2012X7S1A226M125AC",
    quantity: 3,
    value: "22 uF, 10 V, X7S, 0805",
    connection: "V3_3 to APP_GND at the output-inductor and application-load region; 40 uF effective bank minimum"
  },
  {
    references: ["R_APP_REG_DISCHARGE"],
    manufacturer: "Yageo",
    mpn: "RC0603FR-071KL",
    quantity: 1,
    value: "1 kOhm, 1%, 0603",
    connection: "V3_3 to APP_GND output discharge"
  },
  {
    references: ["R_APP_REG_PGOOD"],
    manufacturer: "Yageo",
    mpn: "RC0603FR-0710KL",
    quantity: 1,
    value: "10 kOhm, 1%, 0603",
    connection: "V5 pull-up to the open-drain U_APP_REGULATOR.PGOOD observation net"
  }
] as const satisfies readonly ApplicationRailPart[]

const retainedApplicationRailInputs = { ...defaultApplicationRailInputs }

const upstreamProvenanceDefinition = {
  bp050ApplicationBranch: {
    expectedContinuousA: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.expectedContinuousA,
    expectedPeakA: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.expectedPeakA,
    fuseMpn: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.fuse.mpn,
    measurementLink: { ...defaultBenchPrototypePowerInputs.measurementLinks.application },
    peakDurationMs: defaultBenchPrototypePowerInputs.selectedSystemInputDemand.peakDurationMs
  },
  regulatorDecision: {
    category: "application-rail-regulator",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/LMR43620-Q1",
    mpn: "LMR43620MSC3RPERQ1",
    purpose: "Fixed 3.3 V, 2 A synchronous buck for the ESP32 application rail",
    qualification:
      "Active automotive orderable; 3.6 V to 36 V startup input, 2 A, fixed 2.2 MHz, spread spectrum, 3.27 V to 3.33 V fixed-output accuracy over line/load/temperature in FPWM; 2 mm x 2 mm VQFN-HR RPE; thermal layout and transient validation required"
  },
  sourceIdentity: {
    decisionRegistry: "componentDecisions",
    retainedCalculatorModule: "src/application-rail.ts",
    regulatorDatasheet: {
      identity: "LMR436x0-Q1 datasheet",
      revision: "H",
      url: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf"
    },
    regulatorEvmGuide: {
      identity: "SNVU585B LMR43620-Q1 EVM User's Guide",
      revision: "B",
      url: "https://www.ti.com/lit/ug/snvu585b/snvu585b.pdf"
    }
  },
  retainedApplicationRailInputs
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export const benchPrototypeApplicationRailUpstreamProvenance = deepFreeze(upstreamProvenanceDefinition)

function assertCanonical(actual: unknown, expected: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match the BP-142 contract`)
    return
  }
  if (typeof actual !== "object" || actual === null || seen.has(actual)) {
    throw new RangeError(`${path} must match the canonical object topology without aliases or cycles`)
  }
  seen.add(actual)
  const expectedArray = Array.isArray(expected)
  if (Array.isArray(actual) !== expectedArray) throw new RangeError(`${path} has the wrong container type`)
  if (Object.getPrototypeOf(actual) !== (expectedArray ? Array.prototype : Object.prototype)) {
    throw new RangeError(`${path} must use the canonical prototype`)
  }
  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError(`${path}.${String(key)} must be data`)
    }
    assertCanonical(descriptor.value, Reflect.get(expected, key), `${path}.${String(key)}`, seen)
  }
}

function currentUpstreamProvenance() {
  const decision = componentDecisions.find((candidate) => candidate.mpn === "LMR43620MSC3RPERQ1")
  if (decision === undefined) throw new RangeError("componentDecisions no longer contains LMR43620MSC3RPERQ1")
  return {
    bp050ApplicationBranch: {
      expectedContinuousA: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.expectedContinuousA,
      expectedPeakA: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.expectedPeakA,
      fuseMpn: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.fuse.mpn,
      measurementLink: { ...defaultBenchPrototypePowerInputs.measurementLinks.application },
      peakDurationMs: defaultBenchPrototypePowerInputs.selectedSystemInputDemand.peakDurationMs
    },
    regulatorDecision: {
      category: decision.category,
      lifecycle: decision.lifecycle,
      manufacturer: decision.manufacturer,
      manufacturerUrl: decision.manufacturerUrl,
      mpn: decision.mpn,
      purpose: decision.purpose,
      qualification: decision.qualification
    },
    sourceIdentity: benchPrototypeApplicationRailUpstreamProvenance.sourceIdentity,
    retainedApplicationRailInputs: { ...defaultApplicationRailInputs }
  }
}

function assertUpstreamProvenance(): void {
  calculateBenchPrototypePowerContract()
  calculateApplicationRail()
  assertCanonical(
    currentUpstreamProvenance(),
    benchPrototypeApplicationRailUpstreamProvenance,
    "BP-142 upstream provenance",
    new WeakSet<object>()
  )
}

const retainedScreen = calculateApplicationRail()
const branch = defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping
const peakStepOutputCurrentA = retainedScreen.peakOutputCurrentA - retainedScreen.continuousOutputCurrentA
const permittedOutputTransientV = defaultApplicationRailInputs.esp32TransientAllowanceV
const capacitorOnlyHoldUpUs =
  (defaultApplicationRailInputs.outputCapEffectiveMinUf * permittedOutputTransientV) / peakStepOutputCurrentA
const outputCapacitorChargingCurrentA =
  (defaultApplicationRailInputs.outputCapEffectiveMinUf * defaultApplicationRailInputs.outputMaxV) /
  (defaultApplicationRailInputs.regulatorSoftStartMaxMs * 1_000)

const definition = {
  artifactKind: "bench-prototype-application-3v3-implementation",
  workUnit: "BP-142",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  integrationRelease: false,
  fabricationRelease: false,
  releaseState: "deny",
  input: {
    source: "BP-050 J_LINK_APPLICATION V5 branch with its loopback installed",
    ground: "APP_GND",
    nominalVoltageV: 5,
    calculatorVoltageScreenV: {
      minimum: defaultApplicationRailInputs.inputMinV,
      maximum: defaultApplicationRailInputs.inputMaxV
    },
    voltageEvidence:
      "Retained LMR43620 calculation screen only; BP-050 defines the V5 branch but does not close V5 regulation, droop, or routing loss."
  },
  topology: {
    outputNet: "V3_3",
    supportParts: applicationRailSupportDefinition,
    connections: [
      {
        from: "U_APP_REGULATOR.VOUT/FB",
        to: "V3_3",
        rule: "The fixed-output VOUT/FB pin senses V3_3 directly; no feedback divider is populated."
      },
      {
        from: "C_APP_REG_OUT_A.V3_3",
        to: "V3_3",
        return: "C_APP_REG_OUT_A.GND to APP_GND"
      },
      {
        from: "C_APP_REG_OUT_B.V3_3",
        to: "V3_3",
        return: "C_APP_REG_OUT_B.GND to APP_GND"
      },
      {
        from: "C_APP_REG_OUT_C.V3_3",
        to: "V3_3",
        return: "C_APP_REG_OUT_C.GND to APP_GND"
      }
    ],
    rules: [
      "V5 feeds only U_APP_REGULATOR.VIN, EN/UVLO, and the PGOOD pull-up; it never bypasses the regulator onto V3_3.",
      "MODE/SYNC is tied to VCC to select FPWM with spread spectrum; VCC has its dedicated local bypass.",
      "BOOT capacitor spans BOOT to SW and the inductor is the only power path from SW to V3_3.",
      "The fixed-output U_APP_REGULATOR.VOUT/FB pin connects directly to V3_3; no adjustable-output divider is allowed.",
      "The three output capacitors and discharge resistor connect V3_3 to APP_GND; the output bank must retain at least 40 uF effective capacitance.",
      "PGOOD is an observation net only. Application reset, brownout policy, and W5500 reset remain owned by BP-123."
    ]
  },
  screens: {
    startup: {
      regulatorInputStartupMarginV: retainedScreen.startupInputMarginV,
      regulatorSoftStartMaximumMs: defaultApplicationRailInputs.regulatorSoftStartMaxMs,
      outputCapacitorChargingCurrentA: outputCapacitorChargingCurrentA,
      resetDependency:
        "DENY: BP-123 must select and measure supervisor/reset timing; no supervisor timing is claimed by BP-142."
    },
    transient: {
      continuousToPeakDurationMs: defaultBenchPrototypePowerInputs.selectedSystemInputDemand.peakDurationMs,
      continuousToPeakOutputStepA: peakStepOutputCurrentA,
      effectiveOutputCapacitanceMinimumUf: defaultApplicationRailInputs.outputCapEffectiveMinUf,
      permittedOutputTransientV,
      capacitorOnlyHoldUpUs,
      conclusion:
        "DENY: capacitor-only hold-up is far shorter than the 100 ms peak envelope, so regulator control-loop response and point-of-load droop require measurement."
    },
    current: {
      continuousOutputCurrentA: retainedScreen.continuousOutputCurrentA,
      peakOutputCurrentA: retainedScreen.peakOutputCurrentA,
      continuousInputCurrentA: retainedScreen.continuousInputCurrentA,
      peakInputCurrentA: retainedScreen.peakInputCurrentA,
      bp050ContinuousBranchHeadroomA: branch.expectedContinuousA - retainedScreen.continuousInputCurrentA,
      bp050PeakBranchHeadroomA: branch.expectedPeakA - retainedScreen.peakInputCurrentA,
      regulatorPeakCurrentLimitMarginA: retainedScreen.peakRegulatorCurrentMarginA,
      inductorPeakCurrentWithMarginA: retainedScreen.inductorPeakCurrentWithMarginA,
      inductor20PercentSaturationA: defaultApplicationRailInputs.inductorIsatAt20PercentDropA,
      inductor40CRiseA: defaultApplicationRailInputs.inductorIrmsAt40CRiseA
    },
    thermal: {
      ambientScreenC: defaultApplicationRailInputs.ambientMaxC,
      continuousLossW: retainedScreen.continuousLossW,
      peakLossW: retainedScreen.peakLossW,
      thermalResistanceScreenCPerW: defaultApplicationRailInputs.regulatorRthetaJaMaxCPerW,
      continuousJunctionScreenC: retainedScreen.continuousJunctionC,
      peakJunctionScreenC: retainedScreen.peakJunctionC,
      junctionTargetC: defaultApplicationRailInputs.thermalJunctionTargetC,
      conclusion: "DENY: the JEDEC theta-JA arithmetic screen is not a board thermal model or a layout approval."
    }
  },
  requiredObservations: [
    "J_LINK_APPLICATION current link and V5 at U_APP_REGULATOR.VIN",
    "V3_3 at the output bank, W5500 supply region, and ESP32 3V3 pins",
    "U_APP_REGULATOR.PGOOD and the BP-123 reset output",
    "SW node with a suitably short ground spring"
  ],
  deniedEvidence: {
    exactFootprintsApproved: false,
    layoutApproved: false,
    effectiveCapacitanceMeasured: false,
    startupAndBrownoutMeasured: false,
    loadStepMeasured: false,
    thermalMeasured: false,
    fabricationApproved: false
  },
  openGates: [
    "Import and independently review exact TI RPE, Coilcraft XGL4030, and all support-part manufacturer land patterns, paste, mask, courtyard, orientation, and pin mapping.",
    "Place and review the VIN, BOOT/SW, output, VCC-bypass, feedback, and APP_GND return loops before any layout release.",
    "Measure effective output capacitance at 3.3 V across temperature and reject any lot or substitution below 40 uF effective.",
    "Measure V5 at VIN, V3_3 at each required observation point, PGOOD, reset, cold start, brownout, output discharge, and the continuous-to-100-ms peak load step.",
    "Measure regulator, inductor, capacitor, and adjacent-board temperatures at 50 C blocked-vent ambient.",
    "Complete BP-123 reset/supervisor closure, BP-033 footprint evidence, BP-300 schematic integration, ERC, placement, routing, DRC, and independent power review."
  ]
} as const

export const benchPrototypeApplicationRail = deepFreeze(definition)

export function validateBenchPrototypeApplicationRail(value: unknown): true {
  assertUpstreamProvenance()
  const screen = calculateApplicationRail()
  const currentBranch = defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping
  if (screen.continuousInputCurrentA >= currentBranch.expectedContinuousA) {
    throw new RangeError("BP-050 application branch has no continuous headroom for the regulator input")
  }
  if (screen.peakInputCurrentA >= currentBranch.expectedPeakA) {
    throw new RangeError("BP-050 application branch has no peak headroom for the regulator input")
  }
  if (
    capacitorOnlyHoldUpUs <= 0 ||
    capacitorOnlyHoldUpUs >= defaultBenchPrototypePowerInputs.selectedSystemInputDemand.peakDurationMs * 1_000
  ) {
    throw new RangeError("transient screen must not grant capacitor-only credit for the BP-050 peak envelope")
  }
  assertCanonical(value, benchPrototypeApplicationRail, "benchPrototypeApplicationRail", new WeakSet<object>())
  return true
}
