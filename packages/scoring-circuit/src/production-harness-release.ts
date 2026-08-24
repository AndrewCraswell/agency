import { productionHarnessSelection, validateProductionHarnessSelection } from "./production-harness-selection.js"

type DataRecord = Record<PropertyKey, unknown>

type ReleaseLine = {
  readonly boardReference: string
  readonly connectorPin: number
  readonly logicalLine: string
  readonly physicalSocketPosition: string | null
  readonly positionOffsetFromCentreMm: number | null
}

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-13 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-13 data can contain only data properties")
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
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
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
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const physicalSocketMap: readonly ReleaseLine[] = [
  {
    boardReference: "J_WEAPON_HARNESS_L",
    connectorPin: 1,
    logicalLine: "left.A",
    physicalSocketPosition: "outer-near-15-mm",
    positionOffsetFromCentreMm: 15
  },
  {
    boardReference: "J_WEAPON_HARNESS_L",
    connectorPin: 2,
    logicalLine: "left.B",
    physicalSocketPosition: "centre",
    positionOffsetFromCentreMm: 0
  },
  {
    boardReference: "J_WEAPON_HARNESS_L",
    connectorPin: 3,
    logicalLine: "left.C",
    physicalSocketPosition: "outer-far-20-mm",
    positionOffsetFromCentreMm: 20
  },
  {
    boardReference: "J_WEAPON_HARNESS_R",
    connectorPin: 1,
    logicalLine: "right.A",
    physicalSocketPosition: "outer-near-15-mm",
    positionOffsetFromCentreMm: 15
  },
  {
    boardReference: "J_WEAPON_HARNESS_R",
    connectorPin: 2,
    logicalLine: "right.B",
    physicalSocketPosition: "centre",
    positionOffsetFromCentreMm: 0
  },
  {
    boardReference: "J_WEAPON_HARNESS_R",
    connectorPin: 3,
    logicalLine: "right.C",
    physicalSocketPosition: "outer-far-20-mm",
    positionOffsetFromCentreMm: 20
  },
  {
    boardReference: "J_PISTE_HARNESS",
    connectorPin: 1,
    logicalLine: "piste",
    physicalSocketPosition: null,
    positionOffsetFromCentreMm: null
  },
  {
    boardReference: "J_PISTE_HARNESS",
    connectorPin: 2,
    logicalLine: "piste-return",
    physicalSocketPosition: null,
    positionOffsetFromCentreMm: null
  }
] as const

function lineForPin(boardReference: string, pin: number, functionName: string): string | null {
  if (functionName === "intentional empty cavity") return null
  if (boardReference === "J_WEAPON_HARNESS_L") return `left.${functionName.at(-1)!.toUpperCase()}`
  if (boardReference === "J_WEAPON_HARNESS_R") return `right.${functionName.at(-1)!.toUpperCase()}`
  if (boardReference === "J_PISTE_HARNESS") return pin === 1 ? "piste" : "piste-return"
  return ["lamp.red", "lamp.green", "lamp.white-left", "lamp.white-right", "buzzer", "primary-return"][pin - 1] ?? null
}

const boardHarnesses = productionHarnessSelection.map((harness) => ({
  boardReference: harness.boardReference,
  connector: {
    circuitCount: harness.connector.circuitCount,
    headerMpn: harness.connector.headerMpn,
    mateHousingMpn: harness.connector.mateHousingMpn,
    mateTerminalMpn: harness.connector.mateTerminalMpn,
    maximumCurrentPerContactA: harness.connector.maximumCurrentPerContactA,
    series: harness.connector.series
  },
  cable: {
    conductorCount: harness.cable.conductorCount,
    mpn: harness.cable.mpn,
    operatingTemperatureMaximumC: harness.cable.operatingTemperatureMaximumC,
    voltageMaximumV: harness.cable.voltageMaximumV,
    wireGaugeAwg: harness.cable.wireGaugeAwg
  },
  function: harness.function,
  id: harness.id,
  pins: harness.pins.map((pin) => ({
    connectorPin: pin.pin,
    function: pin.function,
    logicalLine: lineForPin(harness.boardReference, pin.pin, pin.function),
    terminalInstalled: pin.terminalInstalled,
    wire: pin.wire
  }))
}))

const definition = {
  workUnit: "M4-13",
  releaseState: "deny",
  dependencies: {
    M0_03: "accepted-logical-contract",
    M0_10: "accepted-power-reset-contract",
    M4_10: "blocked-plug-fit-and-retention",
    M4_11: "blocked-connector-CAD-and-strain-relief",
    M4_12: "blocked-enclosure-and-clearance"
  },
  boardHarnesses,
  physicalSocketMap,
  keying: {
    status: "planned-not-physically-verified",
    nonInterchangeRules: [
      "J_WEAPON_HARNESS_L uses a three-circuit Micro-Fit header and cannot be treated as the right weapon interface.",
      "J_WEAPON_HARNESS_R uses a four-circuit Micro-Fit header; cavity four has no terminal and no conductor, and the empty cavity is not itself the key.",
      "J_PISTE_HARNESS uses a two-circuit Micro-Fit header and is not a weapon harness.",
      "J_PRIMARY_OUTPUTS_HARNESS uses a six-circuit dual-row Mini-Fit Jr. header and is not interchangeable with a scoring harness."
    ],
    inspectionRequired: [
      "Verify the exact housing, terminal, latch, circuit count, pin-one orientation, and label at incoming inspection.",
      "Verify right-harness cavity four is empty and the orange cable core is individually insulated and floating at both ends.",
      "Verify the chassis clamp transfers cable load away from connector solder joints."
    ]
  },
  bonding: {
    status: "planned-not-approved",
    weaponHarness:
      "No cable shield or chassis bond; weapon conductors remain in the connector-side ESD clamp and analog fault path.",
    pisteReturn:
      "J_PISTE_HARNESS pin 2 is PISTE_RETURN to connector-side ESD_RETURN, not a cable shield and not chassis or processor ground.",
    primaryOutputReturn:
      "J_PRIMARY_OUTPUTS_HARNESS pin 6 is the dedicated scoring-domain return; no cable shield or chassis bond is claimed.",
    requiredReview: "EMC and fault-containment review must approve the chassis and ESD return path before release."
  },
  currentRating: {
    status: "component-ratings-only-not-system-release",
    selectedCableGaugeAwg: [22, 22, 22, 18],
    connectorMaximumPerContactA: [7, 7, 7, 9],
    systemBranchCurrentA: null,
    requiredEvidence: [
      "Reconcile each actual driver, lamp, buzzer, cable length, ambient, and fault current to the contact and wire ratings.",
      "Measure contact temperature and voltage drop under declared continuous and peak loads.",
      "Review crimp, pull, vibration, EMC coupling, and de-energized service evidence."
    ]
  },
  powerBoundary: {
    normalApparatusPowerInput: "USB-C PD",
    alternateExternalPowerInputs: [],
    harnessesAreExternalPowerInlets: false,
    internalCarrierPowerIsNotAnExternalInlet: true,
    destructivePowerApplicationByHarnessConnector: "forbidden-until-independent-fault-review"
  },
  authority: {
    harnessDrawingReleased: false,
    keyingPhysicallyVerified: false,
    bondingApproved: false,
    currentRatingReleased: false,
    fabricationAuthorized: false
  }
} as const

export const productionHarnessRelease = deepFreeze(definition)

export type ProductionHarnessRelease = typeof productionHarnessRelease

export type ProductionHarnessReleaseEvaluation = {
  readonly status: "deny"
  readonly failedChecks: readonly string[]
  readonly fabricationAuthorized: false
}

/** Keeps the M4-13 reconciliation explicit without granting physical authority. */
export function evaluateProductionHarnessRelease(
  value: unknown = productionHarnessRelease
): ProductionHarnessReleaseEvaluation {
  if (!sameDataGraph(value, productionHarnessRelease)) {
    throw new RangeError("M4-13 must exactly match the reviewed fail-closed harness release contract")
  }
  validateProductionHarnessSelection()
  const contract = productionHarnessRelease
  const failedChecks = [
    ...Object.entries(contract.authority)
      .filter(([, approved]) => approved)
      .map(([name]) => `authority-${name}`),
    ...Object.entries(contract.dependencies)
      .filter(([, state]) => state !== "accepted-logical-contract" && state !== "accepted-power-reset-contract")
      .map(([name, state]) => `${name}-${state}`),
    contract.keying.status === "planned-not-physically-verified" ? "keying-physical-verification" : null,
    contract.bonding.status === "planned-not-approved" ? "bonding-approval" : null,
    contract.currentRating.status === "component-ratings-only-not-system-release" ? "current-rating-release" : null,
    contract.currentRating.systemBranchCurrentA === null ? "system-branch-current-measurement" : null,
    contract.releaseState !== "deny" ? "release-state" : null,
    contract.powerBoundary.normalApparatusPowerInput !== "USB-C PD" ? "normal-power-input" : null
  ].filter((check): check is string => check !== null)

  if (failedChecks.length === 0) throw new RangeError("M4-13 cannot approve incomplete harness evidence")
  return { status: "deny", failedChecks, fabricationAuthorized: false }
}
