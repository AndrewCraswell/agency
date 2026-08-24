/**
 * M4-05 socketed analog-fixture design.
 *
 * This freezes the de-energized fixture requirements needed to exercise the
 * canonical analog matrix. It is neither a fabrication package nor permission
 * to apply power, fault energy, or scoring inputs to a coupon.
 */

type DataRecord = Record<PropertyKey, unknown>

export type M405SourceContract = {
  readonly commit: string
  readonly id: "M4-01" | "BP-106" | "analog-front-end"
  readonly sha256: string
  readonly sourcePath: string
}

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-05 fixture data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-05 fixture data can contain only data properties")
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

const resistanceOhms = [
  0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500, 505
] as const
const capacitancePf = [500, 2_000, 5_000, 10_000] as const
const temperatureC = [-40, 25, 85, 125] as const
const pulseWidthsUs = [
  50, 99, 100, 101, 999, 1_000, 1_001, 1_999, 2_000, 2_001, 2_999, 3_000, 3_001, 10_000, 12_999, 13_000, 14_000, 15_000,
  15_001
] as const
const timingBoundariesUs = [100, 1_000, 2_000, 3_000, 13_000, 14_000, 15_000] as const

function normalPointId(resistance: number, capacitance: number, temperature: number): string {
  return `normal-r${resistance}-c${capacitance}-t${temperature}`
}

function pulsePointId(widthUs: number): string {
  return `pulse-r100-c10000-t25-w${widthUs}`
}

function buildNormalPointIds(): readonly string[] {
  const ids: string[] = []
  for (const temperature of temperatureC)
    for (const capacitance of capacitancePf)
      for (const resistance of resistanceOhms) ids.push(normalPointId(resistance, capacitance, temperature))
  return ids
}

function buildBothSideCombinations(): readonly { readonly id: string; readonly side: "left" | "right" }[] {
  const combinations = ["open", "short", "cross-line", "blade-guard", "opponent-target", "self-lame", "piste"] as const
  return (["left", "right"] as const).flatMap((side) =>
    combinations.map((combination) => ({ id: `${side}-${combination}`, side }))
  )
}

function buildTimingBoundaryCases(): readonly {
  readonly boundaryUs: number
  readonly points: readonly {
    readonly disposition: "indeterminate-no-credit"
    readonly role: string
    readonly widthUs: number
  }[]
}[] {
  return timingBoundariesUs.map((boundaryUs) => ({
    boundaryUs,
    points: [
      { disposition: "indeterminate-no-credit", role: "boundary-minus-expanded-uncertainty", widthUs: boundaryUs - 1 },
      { disposition: "indeterminate-no-credit", role: "boundary", widthUs: boundaryUs },
      { disposition: "indeterminate-no-credit", role: "boundary-plus-expanded-uncertainty", widthUs: boundaryUs + 1 }
    ]
  }))
}

export const M405_SOURCE_CONTRACTS = deepFreeze([
  {
    commit: "49ec880a24e990bd511ffc3a22543d84231968a6",
    id: "M4-01",
    sha256: "b18e380bc01830aab5cbe21c2bc43a97c77d4a2a2fbfea368cb270549908d697",
    sourcePath: "apps/scoring/src/m4-01-analog-rule-boundary-audit.ts"
  },
  {
    commit: "d4af2cba2a4203fc57b968ac2ae3b257f838056b",
    id: "BP-106",
    sha256: "a7c95df59dbd24f88b5da009c353a821942a622a50e8cc6d9fac88b0b841d88c",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-analog-test-matrix.ts"
  },
  {
    commit: "63e3ec30fa44f963b7e0bf5ca0fc02d02dab2a8e",
    id: "analog-front-end",
    sha256: "f7b4ba7c660028ac39125ee372950bf81b5a6d922499698e1849dd75e6de11a7",
    sourcePath: "packages/scoring-circuit/docs/analog-front-end.md"
  }
] as const satisfies readonly M405SourceContract[])

const definition = {
  authority: {
    energizedTestAuthorization: false,
    fabricationAuthorized: false,
    faultInjectionAuthorized: false,
    scoringAuthority: false,
    schematicIntegrationAuthorized: false
  },
  calibration: {
    beforeEachRun: [
      "verify the selected resistance path with a four-wire digital multimeter",
      "verify the selected capacitance bank with a traceable capacitance measurement",
      "verify pulse width at the fixture output with a traceable oscilloscope",
      "verify the temperature reference and record its expanded uncertainty"
    ],
    requiredRecordFields: [
      "fixture-configuration-digest",
      "resistance-standard-certificate-digest",
      "capacitance-standard-certificate-digest",
      "oscilloscope-certificate-digest",
      "temperature-reference-certificate-digest",
      "four-wire-resistance-reading-ohms",
      "capacitance-reading-pf",
      "pulse-width-reading-us",
      "expanded-uncertainty-k2",
      "operator-and-timestamp"
    ],
    uncertaintyLimits: {
      capacitance: { maximumExpandedUncertaintyPf: 100, coverageFactor: 2, rangePf: [500, 10_000] },
      pulseWidth: { maximumExpandedUncertaintyUs: 1, coverageFactor: 2, rangeUs: [50, 15_001] },
      resistance: { maximumExpandedUncertaintyOhms: 0.25, coverageFactor: 2, rangeOhms: [0, 505] },
      temperature: { maximumExpandedUncertaintyC: 0.5, coverageFactor: 2, rangeC: [-40, 125] }
    }
  },
  canonicalMatrix: {
    capacitancePf: [...capacitancePf],
    normalPointIds: buildNormalPointIds(),
    pulsePointIds: pulseWidthsUs.map(pulsePointId),
    pulseWidthsUs: [...pulseWidthsUs],
    resistanceOhms: [...resistanceOhms],
    temperatureC: [...temperatureC]
  },
  connections: {
    DUT: {
      bodyCordConnectors: [
        { id: "left-fencer-weapon", pins: 3, role: "left fencer weapon-body-cord path" },
        { id: "left-fencer-lame", pins: 3, role: "left fencer lame-body-cord path" },
        { id: "left-fencer-guard", pins: 3, role: "left fencer guard-body-cord path" },
        { id: "right-fencer-weapon", pins: 3, role: "right fencer weapon-body-cord path" },
        { id: "right-fencer-lame", pins: 3, role: "right fencer lame-body-cord path" },
        { id: "right-fencer-guard", pins: 3, role: "right fencer guard-body-cord path" }
      ],
      contactAssignment:
        "exactly six three-pin body-cord connectors terminate both fencers at the labeled scoring-box port patch boundary; a separate piste terminal completes the seven-conductor path",
      pisteTerminal: { id: "piste", pinCount: 1, role: "separate conductive piste terminal" },
      scoringBoxPort: { conductorCount: 7, role: "labeled fixture-to-scoring-box port" },
      stateWhenUnpowered: "all external paths open and no fixture source connected",
      topology:
        "socketed passive stimulus modules connect between explicitly labeled DUT conductors; no fixture module infers a scoring relation"
    },
    measurementPoints: [
      "connector-line",
      "protected-node",
      "adc-input",
      "comparator-output",
      "precision-reference",
      "scoring-ground"
    ],
    power:
      "USB-C PD is the normal apparatus input. This fixture design adds no VBUS, CC, battery, or laboratory power connection to the DUT."
  },
  combinations: {
    bothSideFaultCombinations: buildBothSideCombinations(),
    disposition: "deenergized-continuity-map-only-no-qualification",
    requiredCombinationsPerSide: ["open", "short", "cross-line", "blade-guard", "opponent-target", "self-lame", "piste"]
  },
  fixture: {
    capacitanceBank: {
      valuesPf: [...capacitancePf],
      switching: "one socketed capacitance module at a time; unselected modules are physically removed",
      topology: "line-to-return bank at the connector-side fixture boundary"
    },
    pulseGenerator: {
      contactStates:
        "normally open and de-energized until the separately approved operator procedure enables an isolated pulse source",
      requiredWidthsUs: [...pulseWidthsUs],
      relayRequirements: {
        breakBeforeMake: true,
        closedResistanceAndBounceRecord:
          "record relay closed resistance and bounce separately from the selected external stimulus path before any qualified observation",
        mechanicalAlternative:
          "any non-relay replacement requires root review demonstrating break-before-make behavior and separate resistance and bounce evidence"
      },
      topology: "isolated dry-contact pulse output in series with the selected passive stimulus module"
    },
    resistanceBank: {
      kelvinCharacterization:
        "four-wire reading at the fixture output includes socket and lead resistance; the archived value, not the nominal marking, is the stimulus value",
      valuesOhms: [...resistanceOhms],
      switching: "one socketed resistance module at a time; the zero-ohm module is a measured short-link"
    }
  },
  environmentalCases: {
    ambientC: [
      { label: "minimum-qualified", temperatureC: -40 },
      { label: "room", temperatureC: 25 },
      { label: "maximum-qualified", temperatureC: 125 }
    ],
    usbCPdInput: {
      cases: [
        "usb-pd-20v-lower-declared-tolerance",
        "usb-pd-20v-nominal",
        "usb-pd-20v-upper-declared-tolerance",
        "usb-pd-20v-brownout-falling-ramp",
        "usb-pd-20v-brownout-rising-ramp"
      ],
      declaration:
        "USB-C PD SPR 20 V at 3 A remains the normal input. A future energized run must bind lower and upper limits to the negotiated source's immutable tolerance record; this design does not declare those measured limits.",
      disposition: "required-case-identities-only-no-energized-authority"
    }
  },
  gates: {
    beforeAnyEnergizedWork: [
      "M4-06 fabrication package independently reviewed",
      "M4-07 incoming inspection records socket, relay, and harness measurements",
      "BP-102 guarded fault procedure independently approved",
      "operator has a reviewed interlock, current-trip, stop-condition, and recovery procedure"
    ],
    forbiddenClaims: [
      "no fixture drawing, BOM, footprint, Gerber, or assembly release",
      "no normal or guarded source is authorized by this artifact",
      "no measured result may qualify a touch or scoring outcome",
      "no ESD, EFT, surge, sweat, salt, cable-fault, or unpowered result is implied"
    ]
  },
  safety: {
    defaultState: "de-energized-open",
    interlocks: [
      "normal passive modules and any future guarded-force connector are physically mutually incompatible",
      "remove the DUT connector before changing a socketed resistance or capacitance module",
      "verify zero source potential at fixture and DUT measurement points before mating or remating",
      "do not connect a pulse source until the separate reviewed procedure names its source, current limit, stop condition, and observer"
    ],
    pulseAndFaultBoundary:
      "The pulse-generator definition is a mechanical interface requirement only. It does not define a source, authorize an energized pulse, or authorize a fault injection."
  },
  sourceContracts: structuredClone(M405_SOURCE_CONTRACTS),
  timingAcceptance: {
    boundaryCases: buildTimingBoundaryCases(),
    coverageFactor: 2,
    expandedUncertaintyUs: 1,
    policy:
      "At k=2 plus or minus 1 us, every boundary-minus, boundary, and boundary-plus observation whose interval touches a rule boundary is indeterminate-no-credit. A later task must use a tighter reviewed uncertainty before it can classify a boundary observation."
  },
  workUnit: "M4-05"
} as const

export const M405_SOCKETED_ANALOG_FIXTURE_DESIGN = deepFreeze(definition)

/** Rejects matrix drift and every attempt to grant a physical authority. */
export function validateM405SocketedAnalogFixtureDesign(value: unknown): true {
  if (!sameDataGraph(value, M405_SOCKETED_ANALOG_FIXTURE_DESIGN)) {
    throw new RangeError("M4-05 fixture design must exactly match the reviewed de-energized contract")
  }
  const design = M405_SOCKETED_ANALOG_FIXTURE_DESIGN
  if (
    design.workUnit !== "M4-05" ||
    design.canonicalMatrix.normalPointIds.length !== 320 ||
    design.canonicalMatrix.pulsePointIds.length !== pulseWidthsUs.length ||
    design.connections.DUT.bodyCordConnectors.length !== 6 ||
    design.connections.DUT.bodyCordConnectors.some((connector) => connector.pins !== 3) ||
    design.connections.DUT.scoringBoxPort.conductorCount !== 7 ||
    design.combinations.bothSideFaultCombinations.length !== 14 ||
    design.fixture.pulseGenerator.relayRequirements.breakBeforeMake !== true ||
    design.environmentalCases.ambientC.length !== 3 ||
    design.environmentalCases.usbCPdInput.cases.length !== 5 ||
    design.sourceContracts.length !== 3 ||
    design.timingAcceptance.boundaryCases.some((boundary) =>
      boundary.points.some((point) => point.disposition !== "indeterminate-no-credit")
    ) ||
    design.calibration.uncertaintyLimits.resistance.maximumExpandedUncertaintyOhms > 0.25 ||
    design.calibration.uncertaintyLimits.capacitance.maximumExpandedUncertaintyPf > 100 ||
    design.calibration.uncertaintyLimits.pulseWidth.maximumExpandedUncertaintyUs > 1 ||
    design.authority.energizedTestAuthorization ||
    design.authority.fabricationAuthorized ||
    design.authority.faultInjectionAuthorized ||
    design.authority.scoringAuthority ||
    design.authority.schematicIntegrationAuthorized ||
    !design.connections.power.includes("USB-C PD is the normal apparatus input")
  ) {
    throw new RangeError(
      "M4-05 must retain the complete matrix, calibrated uncertainty, USB-C PD, and denied authority"
    )
  }
  return true
}
