/** M4-11 immutable communications and power connector CAD verification contract. */
type DataRecord = Record<PropertyKey, unknown>

export type VerificationState = "unknown" | "unverified" | "verified"

type ConnectorCadRecord = {
  readonly selected: boolean
  readonly reference: string
  readonly role: string
  readonly mpn: string | null
  readonly primaryDrawing: {
    readonly state: VerificationState
    readonly url: string | null
    readonly note: string
  }
  readonly evidence: {
    readonly landPattern: VerificationState
    readonly cadOverlay: VerificationState
    readonly shieldTabs: VerificationState
    readonly fasteners: VerificationState
    readonly serviceAccess: VerificationState
    readonly strainRelief: VerificationState
  }
}

export type ConnectorCadEvaluation = {
  readonly fabricationApproved: false
  readonly status: "deny"
  readonly failedChecks: readonly string[]
}

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-11 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-11 data can contain only data properties")
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

function failedEvidence(connector: string, evidence: ConnectorCadRecord["evidence"]): readonly string[] {
  return Object.entries(evidence)
    .filter(([, state]) => state !== "verified")
    .map(([evidenceName]) => `${connector}-${evidenceName}`)
}

const definition = {
  workUnit: "M4-11",
  releaseState: "deny",
  normalApparatusPowerInput: "USB-C PD",
  lockedPowerPolicy:
    "J_PWR_CARRIER is an internal locking harness only. It is not an external apparatus inlet, and no second locking external power inlet is selected.",
  connectors: {
    rj45: {
      selected: true,
      reference: "J_ETHERNET_MAGJACK",
      role: "10/100 Ethernet with integrated magnetics",
      mpn: "7499011121A",
      primaryDrawing: {
        state: "unverified",
        url: "https://www.we-online.com/components/products/datasheet/7499011121A.pdf",
        note: "Würth drawing and exact STEP were acquired, but neither has been overlaid in released board or enclosure CAD."
      },
      evidence: {
        landPattern: "unverified",
        cadOverlay: "unverified",
        shieldTabs: "unverified",
        fasteners: "unknown",
        serviceAccess: "unverified",
        strainRelief: "unverified"
      }
    },
    usbC: {
      selected: true,
      reference: "J_USB_C",
      role: "sole external apparatus-power input and USB 2.0 UFP service port",
      mpn: "10177070-00011LF",
      primaryDrawing: {
        state: "unknown",
        url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf",
        note: "The manufacturer drawing and STEP archive are listed, but direct project acquisition returned HTTP 403."
      },
      evidence: {
        landPattern: "unknown",
        cadOverlay: "unknown",
        shieldTabs: "unknown",
        fasteners: "unknown",
        serviceAccess: "unverified",
        strainRelief: "unverified"
      }
    },
    lockingPower: {
      selected: true,
      reference: "J_PWR_CARRIER",
      role: "internal locking carrier-power harness, not an external apparatus inlet",
      mpn: "43045-0400",
      primaryDrawing: {
        state: "unverified",
        url: "https://www.molex.com/en-us/products/connectors/wire-to-board-connectors/micro-fit-30-connectors",
        note: "The selected Micro-Fit header has only a family source in the current contract; configured header, mate, terminal, and harness drawings remain unacquired."
      },
      evidence: {
        landPattern: "unverified",
        cadOverlay: "unverified",
        shieldTabs: "unknown",
        fasteners: "unknown",
        serviceAccess: "unverified",
        strainRelief: "unverified"
      }
    }
  },
  releaseGates: [
    "Every selected land pattern must be overlaid against its exact primary manufacturer drawing before fabrication.",
    "Every selected CAD model must be overlaid in the board and enclosure assembly before fabrication.",
    "RJ45 and USB-C shield tabs or shell stakes must be compared with the exact drawing and reviewed for chassis bonding.",
    "Chassis fastener identities, positions, and load path must be selected and checked against the enclosure assembly.",
    "Service access must be verified with the module installed and the documented de-energized service sequence.",
    "Plug and harness strain relief must be proven to transfer loads away from PCB solder joints."
  ]
} as const satisfies {
  readonly workUnit: "M4-11"
  readonly releaseState: "deny"
  readonly normalApparatusPowerInput: "USB-C PD"
  readonly lockedPowerPolicy: string
  readonly connectors: {
    readonly rj45: ConnectorCadRecord
    readonly usbC: ConnectorCadRecord
    readonly lockingPower: ConnectorCadRecord
  }
  readonly releaseGates: readonly string[]
}

export const communicationsPowerConnectorCad = deepFreeze(definition)

/** Rejects any attempt to approve missing source, overlay, service, or strain-relief evidence. */
export function evaluateCommunicationsPowerConnectorCad(
  value: unknown = communicationsPowerConnectorCad
): ConnectorCadEvaluation {
  if (!sameDataGraph(value, communicationsPowerConnectorCad)) {
    throw new RangeError("M4-11 must exactly match the reviewed fail-closed connector CAD contract")
  }
  const contract = communicationsPowerConnectorCad
  if (
    contract.workUnit !== "M4-11" ||
    contract.releaseState !== "deny" ||
    contract.normalApparatusPowerInput !== "USB-C PD" ||
    !contract.lockedPowerPolicy.includes("not an external apparatus inlet") ||
    contract.connectors.rj45.mpn !== "7499011121A" ||
    contract.connectors.usbC.mpn !== "10177070-00011LF" ||
    contract.connectors.lockingPower.mpn !== "43045-0400"
  ) {
    throw new RangeError("M4-11 must retain selected parts and USB-C PD as the normal apparatus power input")
  }
  const failedChecks = Object.entries(contract.connectors).flatMap(([connector, record]) =>
    failedEvidence(connector, record.evidence)
  )
  if (failedChecks.length === 0) throw new RangeError("M4-11 cannot approve unreviewed connector evidence")
  return { fabricationApproved: false, status: "deny", failedChecks }
}
