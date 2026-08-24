/** BT-02 independent tester reel, piste, observer, and safety interface contract. */

export type TesterInterfaceEvaluation = {
  readonly physicalRunAuthorized: false
  readonly status: "deny"
  readonly blockers: readonly string[]
}

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BT-02 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BT-02 data can contain only data properties")
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
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const definition = {
  workUnit: "BT-02",
  releaseState: "deny",
  prerequisites: ["M0-03", "M0-10", "BT-01"],
  apparatusPower: {
    normalExternalInput: "USB-C PD",
    negotiatedRequest: { currentMilliamps: 3_000, voltageMillivolts: 20_000 },
    testerConnection: "The tester has no connection to USB-C VBUS, CC, or apparatus power return."
  },
  sourceProvenance: [
    {
      id: "M0-03",
      sha256: "45BED255C6C5BDF3AC48EF51E7E3744243584A5AC39CD143A61AA985F1D861B6",
      sourcePath: "apps/scoring/docs/seven-conductor-signal-contract.md"
    },
    {
      id: "M4-02",
      sha256: "FC611D073C8BAF8040A559D58E2996F78C8CF1C7C69D42CA92CE0C97D6B23603",
      sourcePath: "apps/scoring/src/m4-02-clamp-rail-protection.ts"
    },
    {
      id: "BP-102",
      sha256: "CFBD43E9E1E56220522C17AC971EF48CC8675EE7D976EB16290F8274CDC0E289",
      sourcePath: "packages/scoring-circuit/src/bench-prototype-fault-protection.ts"
    }
  ],
  testerIndependence: {
    power: "Tester power is independent of the DUT and cannot back-power the DUT.",
    timebase: "Tester timestamps and calibration identity are independent of DUT records.",
    reference:
      "Tester logic ground, chassis, protective earth, and DUT power return are not a reel or piste return path."
  },
  reelInterfaces: [
    {
      contactMap: [
        { contact: "A", conductor: "left.A" },
        { contact: "B", conductor: "left.B" },
        { contact: "C", conductor: "left.C" }
      ],
      conductors: ["left.A", "left.B", "left.C"],
      connectorSelection: "unselected",
      identity: "tester.left.reel",
      keying: "left-only",
      stateWhenTesterUnpowered: "all-three-paths-open"
    },
    {
      contactMap: [
        { contact: "A", conductor: "right.A" },
        { contact: "B", conductor: "right.B" },
        { contact: "C", conductor: "right.C" }
      ],
      conductors: ["right.A", "right.B", "right.C"],
      connectorSelection: "unselected",
      identity: "tester.right.reel",
      keying: "right-only",
      stateWhenTesterUnpowered: "all-three-paths-open"
    }
  ],
  pisteInterface: {
    contact: "P",
    conductor: "piste",
    connectorSelection: "unselected",
    identity: "tester.piste",
    stateWhenTesterUnpowered: "open",
    statement: "Piste is a measured conductive-piste reference, not protective earth, chassis, or processor ground."
  },
  voltageCurrentEnvelope: {
    guardedFaultTest: {
      maximumAbsoluteVoltageMillivolts: 24_000,
      maximumPulseDurationMilliseconds: 100,
      maximumSourceCurrentMicroamps: 433,
      maximumSourceEnergyMicrojoules: 1_040,
      status: "source-envelope-only-no-downstream-survival-credit"
    },
    normalStimulus: {
      maximumAbsoluteVoltageMillivolts: 2_500,
      maximumSourceCurrentMicroamps: 1_100,
      minimumSourceResistanceOhms: 2_490,
      status: "source-envelope-only-no-downstream-survival-credit"
    },
    unresolvedDutBoundary: {
      prerequisite:
        "BT-03 must establish measured DUT line-state, output-sense, leakage, isolation, and fault-survival limits against this source envelope.",
      status: "blocked"
    },
    usePolicy:
      "The source envelope permits no energized DUT connection, source, sink, output-sense attachment, or passing result until the unresolved DUT boundary is closed."
  },
  floatingBoundary: {
    allowedReference: "only the selected declared conductor relation",
    forbiddenTies: ["DUT power return", "protective earth", "tester chassis", "tester logic ground"],
    polarity: "polarity-independent",
    requiredProof: "BT-03 and BT-08 must measure unpowered isolation and no-back-power in both directions."
  },
  outputObservation: {
    channels: [
      "left-valid-lamp",
      "right-valid-lamp",
      "left-off-target-short-or-fault",
      "right-off-target-short-or-fault",
      "buzzer",
      "lamp-latch-and-reset",
      "extension-lamp-or-clock-when-enabled",
      "unavailable-state"
    ],
    dutRecords: "Secondary correlation only; DUT records cannot be the physical-output oracle.",
    methods: ["defined-output-connector-electrical-sense", "calibrated-optical-sense", "calibrated-acoustic-sense"],
    state: "unselected"
  },
  misuseHandling: [
    {
      caseId: "missing-or-wrong-reel-cable",
      requiredOutcome: "infrastructureError",
      safeState: "all-tester-paths-open"
    },
    {
      caseId: "piste-tied-to-protective-earth-chassis-or-logic-ground",
      requiredOutcome: "infrastructureError",
      safeState: "all-tester-paths-open"
    },
    {
      caseId: "unpowered-tester-or-dut",
      requiredOutcome: "infrastructureError",
      safeState: "no-back-power-and-all-tester-paths-open"
    },
    {
      caseId: "unknown-dut-line-voltage-current-or-polarity",
      requiredOutcome: "infrastructureError",
      safeState: "all-tester-paths-open"
    },
    {
      caseId: "observer-or-calibration-identity-missing",
      requiredOutcome: "infrastructureError",
      safeState: "no-passing-result"
    }
  ],
  claims: {
    fabricationAuthorized: false,
    fieApprovalClaim: false,
    physicalQualificationClaim: false,
    testerHardwareApproved: false
  },
  releaseBlockers: [
    "Physical connector MPN, physical pin numbering and geometry, mechanical keying implementation, mate, footprint, and strain relief remain unselected.",
    "BT-03 must set and analyze the numeric DUT voltage, current, energy, leakage, impedance, capacitance, delay, and skew limits.",
    "BT-06 through BT-09 must provide hardware, calibration, fault containment, and physical-output observer correlation evidence."
  ]
} as const

export const boxTesterInterfaceContract = deepFreeze(definition)

/** Rejects interface drift and keeps the tester physically non-authoritative until later evidence exists. */
export function evaluateBoxTesterInterfaceContract(
  value: unknown = boxTesterInterfaceContract
): TesterInterfaceEvaluation {
  if (!sameDataGraph(value, boxTesterInterfaceContract)) {
    throw new RangeError("BT-02 must exactly match the reviewed fail-closed interface contract")
  }
  const contract = boxTesterInterfaceContract
  const left = contract.reelInterfaces[0]
  const right = contract.reelInterfaces[1]
  if (
    contract.workUnit !== "BT-02" ||
    contract.releaseState !== "deny" ||
    contract.prerequisites.join(",") !== "M0-03,M0-10,BT-01" ||
    contract.apparatusPower.normalExternalInput !== "USB-C PD" ||
    contract.apparatusPower.negotiatedRequest.voltageMillivolts !== 20_000 ||
    contract.apparatusPower.negotiatedRequest.currentMilliamps !== 3_000 ||
    left.identity !== "tester.left.reel" ||
    right.identity !== "tester.right.reel" ||
    left.keying !== "left-only" ||
    right.keying !== "right-only" ||
    left.contactMap.map((entry) => `${entry.contact}:${entry.conductor}`).join(",") !== "A:left.A,B:left.B,C:left.C" ||
    right.contactMap.map((entry) => `${entry.contact}:${entry.conductor}`).join(",") !==
      "A:right.A,B:right.B,C:right.C" ||
    left.conductors.join(",") !== "left.A,left.B,left.C" ||
    right.conductors.join(",") !== "right.A,right.B,right.C" ||
    contract.pisteInterface.contact !== "P" ||
    contract.pisteInterface.conductor !== "piste" ||
    contract.sourceProvenance.length !== 3 ||
    contract.sourceProvenance.map((source) => source.id).join(",") !== "M0-03,M4-02,BP-102" ||
    contract.sourceProvenance.some((source) => !/^[0-9A-F]{64}$/u.test(source.sha256)) ||
    contract.voltageCurrentEnvelope.normalStimulus.maximumAbsoluteVoltageMillivolts !== 2_500 ||
    contract.voltageCurrentEnvelope.normalStimulus.maximumSourceCurrentMicroamps !== 1_100 ||
    contract.voltageCurrentEnvelope.normalStimulus.minimumSourceResistanceOhms !== 2_490 ||
    contract.voltageCurrentEnvelope.guardedFaultTest.maximumAbsoluteVoltageMillivolts !== 24_000 ||
    contract.voltageCurrentEnvelope.guardedFaultTest.maximumPulseDurationMilliseconds !== 100 ||
    contract.voltageCurrentEnvelope.guardedFaultTest.maximumSourceCurrentMicroamps !== 433 ||
    contract.voltageCurrentEnvelope.guardedFaultTest.maximumSourceEnergyMicrojoules !== 1_040 ||
    contract.voltageCurrentEnvelope.unresolvedDutBoundary.status !== "blocked" ||
    contract.floatingBoundary.polarity !== "polarity-independent" ||
    contract.floatingBoundary.forbiddenTies.length !== 4 ||
    contract.outputObservation.channels.length !== 8 ||
    contract.outputObservation.dutRecords !==
      "Secondary correlation only; DUT records cannot be the physical-output oracle." ||
    contract.misuseHandling.some((misuse) => misuse.requiredOutcome !== "infrastructureError") ||
    contract.claims.fabricationAuthorized ||
    contract.claims.fieApprovalClaim ||
    contract.claims.physicalQualificationClaim ||
    contract.claims.testerHardwareApproved
  ) {
    throw new RangeError("BT-02 must retain both reels, piste, PD boundary, floating safety, and denied claims")
  }
  return { physicalRunAuthorized: false, status: "deny", blockers: contract.releaseBlockers }
}
