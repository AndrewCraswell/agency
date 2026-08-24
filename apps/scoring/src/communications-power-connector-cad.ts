/** M4-11 immutable communications and power connector CAD verification contract. */
type DataRecord = Record<PropertyKey, unknown>

export type VerificationState = "unknown" | "unverified" | "verified"

type PrimarySource = {
  readonly artifactPath: string | null
  readonly checkedOn: "2026-08-24"
  readonly kind: "datasheet" | "product-page" | "product-drawing" | "sales-drawing" | "step-model"
  readonly revision: string
  readonly sha256: string | null
  readonly state: "acquired" | "access-blocked" | "checked-no-local-copy"
  readonly url: string
}

type ConnectorCadRecord = {
  readonly selected: boolean
  readonly reference: string
  readonly role: string
  readonly mpn: string
  readonly mate: { readonly mpn: string; readonly terminalMpn: string } | null
  readonly primarySources: readonly PrimarySource[]
  readonly evidence: {
    readonly landPattern: VerificationState
    readonly cadOverlay: VerificationState
    readonly shieldTabs: VerificationState
    readonly fasteners: VerificationState
    readonly serviceAccess: VerificationState
    readonly strainRelief: VerificationState
  }
}

type StaticCheck = {
  readonly actual: string
  readonly expected: string
  readonly id: string
  readonly result: "compatible-planning-constraint-only" | "no-released-geometry-to-overlay"
}

export type ConnectorCadEvaluation = {
  readonly fabricationApproved: false
  readonly status: "deny"
  readonly failedChecks: readonly string[]
  readonly staticChecks: readonly StaticCheck[]
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

function validateSource(source: PrimarySource): void {
  if (!source.url.startsWith("https://")) throw new RangeError("M4-11 primary sources must use HTTPS")
  const acquired = source.state === "acquired"
  if (acquired !== (source.artifactPath !== null && source.sha256 !== null)) {
    throw new RangeError("M4-11 acquired sources require both an evidence path and a SHA-256")
  }
  if (source.sha256 !== null && !/^[0-9A-F]{64}$/u.test(source.sha256)) {
    throw new RangeError("M4-11 source SHA-256 must be 64 uppercase hexadecimal characters")
  }
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
      mate: null,
      primarySources: [
        {
          artifactPath: "docs/evidence/m4-11/we-7499011121a-datasheet.pdf",
          checkedOn: "2026-08-24",
          kind: "datasheet",
          revision: "003.000, 2023-07-11",
          sha256: "05B718A55907F45D2388BEA0EBEAADB60C7C93CE2C4C5CA582637936E890E350",
          state: "acquired",
          url: "https://www.we-online.com/components/products/datasheet/7499011121A.pdf"
        },
        {
          artifactPath: "docs/evidence/m4-11/we-7499011121a-rev1.stp",
          checkedOn: "2026-08-24",
          kind: "step-model",
          revision: "rev1",
          sha256: "A4968DA8AC85C413990CD4F1F20600BFDB07F30005A4503DA7484651E38C386C",
          state: "acquired",
          url: "https://www.we-online.com/components/products/download/7499011121A%20%28rev1%29.stp"
        }
      ],
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
      mate: null,
      primarySources: [
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "product-page",
          revision: "product page, exact MPN checked",
          sha256: null,
          state: "checked-no-local-copy",
          url: "https://www.amphenol-cs.com/product/1017707000011lf.html"
        },
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "product-drawing",
          revision: "10177070 drawing, manufacturer CDN returned HTTP 403",
          sha256: null,
          state: "access-blocked",
          url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf"
        },
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "step-model",
          revision: "s10177070c archive, manufacturer CDN returned HTTP 403",
          sha256: null,
          state: "access-blocked",
          url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip"
        }
      ],
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
      mate: { mpn: "43025-0400", terminalMpn: "43030-0007" },
      primarySources: [
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "product-page",
          revision: "product page, exact 43045-0400 MPN checked",
          sha256: null,
          state: "checked-no-local-copy",
          url: "https://www.molex.com/en-us/products/part-detail/0430450400"
        },
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "sales-drawing",
          revision: "SD-43045-XXXX revision E1, exact 43045-0400 row checked",
          sha256: null,
          state: "checked-no-local-copy",
          url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450201_sd.pdf"
        },
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "sales-drawing",
          revision: "430250000-SD revision D, exact 43025-0400 row checked",
          sha256: null,
          state: "checked-no-local-copy",
          url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430252400_sd.pdf"
        },
        {
          artifactPath: null,
          checkedOn: "2026-08-24",
          kind: "sales-drawing",
          revision: "SD-43030-XXXX revision N10, exact 43030-0007 row checked",
          sha256: null,
          state: "checked-no-local-copy",
          url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf"
        }
      ],
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
  staticChecks: [
    {
      actual: "J_ETHERNET_MAGJACK has an empty/DNP tscircuit footprint and no declared PCB coordinates",
      expected: "7499011121A drawing and STEP require an actual footprint and assembly placement",
      id: "rj45-footprint-and-assembly-overlay",
      result: "no-released-geometry-to-overlay"
    },
    {
      actual:
        "J_USB_C is declared on the 110 mm x 55 mm communications planning board with 0.80 mm finished thickness and an empty/DNP footprint",
      expected:
        "10177070-00011LF manufacturer product page specifies 0.80 mm PCB thickness; drawing/STEP geometry is unacquired",
      id: "usb-c-stackup-only",
      result: "compatible-planning-constraint-only"
    },
    {
      actual:
        "J_PWR_CARRIER is declared on the 290 mm x 135 mm application/display planning board with 1.60 mm finished thickness and an empty/DNP footprint",
      expected:
        "43045-0400 manufacturer product page specifies 1.60 mm recommended PCB thickness; drawing geometry is not locally acquired",
      id: "locking-power-stackup-only",
      result: "compatible-planning-constraint-only"
    }
  ],
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
  readonly staticChecks: readonly StaticCheck[]
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
    contract.connectors.lockingPower.mpn !== "43045-0400" ||
    contract.connectors.lockingPower.mate?.mpn !== "43025-0400" ||
    contract.connectors.lockingPower.mate.terminalMpn !== "43030-0007"
  ) {
    throw new RangeError("M4-11 must retain selected parts and USB-C PD as the normal apparatus power input")
  }
  for (const connector of Object.values(contract.connectors)) {
    connector.primarySources.forEach(validateSource)
  }
  if (
    !contract.staticChecks.some((check) => check.result === "compatible-planning-constraint-only") ||
    !contract.staticChecks.some((check) => check.result === "no-released-geometry-to-overlay")
  ) {
    throw new RangeError("M4-11 must distinguish planning-constraint matches from CAD overlays")
  }
  const failedChecks = Object.entries(contract.connectors).flatMap(([connector, record]) =>
    failedEvidence(connector, record.evidence)
  )
  if (failedChecks.length === 0) throw new RangeError("M4-11 cannot approve unreviewed connector evidence")
  return { fabricationApproved: false, status: "deny", failedChecks, staticChecks: contract.staticChecks }
}
