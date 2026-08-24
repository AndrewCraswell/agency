import {
  currentPhysicalBoardModels,
  harnessServiceContract,
  mechanicalDatumContract,
  provisionalBoardEnvelopes
} from "./mechanical-envelope.js"

function recursivelyFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) recursivelyFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/**
 * M4-12 records the enclosure inputs that must exist before mechanical release.
 * It is a planning contract only: nulls and unverified states are intentional
 * and do not provide dimensions or physical-fit credit.
 */
export type EnclosureEvidenceState = "unverified" | "verified"

export const enclosureArchitectureContract = recursivelyFreeze({
  workUnit: "M4-12",
  releaseState: "deny",
  planningAuthority: "provisional-three-board-mechanical-envelope",
  boardAssembly: {
    physicalAssemblyCount: currentPhysicalBoardModels.physicalAssemblyCount,
    boardEnvelopeCount: provisionalBoardEnvelopes.length,
    datum: mechanicalDatumContract.coordinateSystem,
    panelEnvelope: {
      widthMm: 318,
      heightMm: 158,
      depthMm: 15,
      authority: "published panel envelope; not a selected enclosure or support datum"
    }
  },
  constraints: {
    boardOutlinesAndKeepouts: {
      state: "unverified" as EnclosureEvidenceState,
      requirement:
        "Dimensioned board outlines, hole tables, datums, tolerances, height maps, courtyards, tooling rails, and keepouts require released board data"
    },
    vesaMounting: {
      state: "unverified" as EnclosureEvidenceState,
      patternMm: 100,
      loadPath: "VESA metal inserts and chassis carry the load; no VESA load may reach a PCB"
    },
    antennaClearance: {
      state: "unverified" as EnclosureEvidenceState,
      minimumClearanceMm: null,
      requirement:
        "Selected antenna, coax bend, module keepout, and enclosure-metal detuning volume require a released assembly"
    },
    irOpticalWindow: {
      state: "unverified" as EnclosureEvidenceState,
      fieldOfViewDeg: null,
      pointingToleranceDeg: null,
      requirement:
        "Receiver aperture material, window geometry, field of view, pointing tolerance, and display/PWM interference require bench evidence"
    },
    airflowAndThermal: {
      state: "unverified" as EnclosureEvidenceState,
      maximumAmbientC: null,
      airflowAssumptions: "Not established; no vent, fan, blocked-vent, or component temperature map is released",
      requirement: "A blocked-vent thermal model and measured enclosure temperature rise are required"
    },
    display: {
      state: "unverified" as EnclosureEvidenceState,
      requirement:
        "Purchased display outline, mounting, rear-component volume, cable exit, viewing access, and removal path require measurement"
    },
    speaker: {
      state: "unverified" as EnclosureEvidenceState,
      requirement:
        "Speaker population, acoustic opening, clearance, retention, and service access require a selected part and enclosure study"
    },
    connectorModules: {
      state: "unverified" as EnclosureEvidenceState,
      requirement:
        "RJ45, USB-C, carrier power, HUB75, U.FL, and service connectors require exact cutouts, latch travel, shell support, and tool access"
    },
    harnessBendRadii: {
      state: "unverified" as EnclosureEvidenceState,
      requirement: harnessServiceContract.bendEvidence
    },
    serviceSequenceFit: {
      state: "unverified" as EnclosureEvidenceState,
      sequence: harnessServiceContract.serviceOrder,
      requirement:
        "The de-energized sequence must be demonstrated with the panel, boards, connectors, anchors, tools, and cover installed"
    }
  },
  releaseGates: [
    "Select and measure the enclosure and purchased display before freezing board outlines or cutouts.",
    "Release a chassis-supported VESA load path that bypasses every PCB and connector solder joint.",
    "Release antenna and encrypted-IR optical-window clearances from exact parts, enclosure material, field-of-view, and interference evidence.",
    "Release airflow, blocked-vent, component-height, and thermal assumptions, then correlate them with measurements.",
    "Release display, speaker, connector-module, harness bend-radius, retention, and service-sequence fit evidence.",
    "Keep fabrication and enclosure tooling denied until an independent mechanical review accepts the dimensioned assembly."
  ]
} as const)

export type EnclosureArchitectureEvidence = {
  readonly planningModelsRecorded: boolean
  readonly boardOutlinesAndKeepouts: boolean
  readonly vesaLoadBypass: boolean
  readonly antennaClearance: boolean
  readonly irOpticalWindow: boolean
  readonly airflowAndThermal: boolean
  readonly displayAndSpeaker: boolean
  readonly connectorModules: boolean
  readonly harnessBendRadii: boolean
  readonly serviceSequenceFit: boolean
}

export const currentEnclosureArchitectureEvidence = recursivelyFreeze({
  planningModelsRecorded: true,
  boardOutlinesAndKeepouts: false,
  vesaLoadBypass: false,
  antennaClearance: false,
  irOpticalWindow: false,
  airflowAndThermal: false,
  displayAndSpeaker: false,
  connectorModules: false,
  harnessBendRadii: false,
  serviceSequenceFit: false
} as const satisfies EnclosureArchitectureEvidence)

export type EnclosureArchitectureEvaluation = {
  readonly fabricationApproved: false
  /** Evidence completeness only; this status never grants fabrication authority. */
  readonly status: "evidence-complete" | "deny"
  readonly failedGates: readonly (keyof EnclosureArchitectureEvidence)[]
}

const evidenceKeys = [
  "planningModelsRecorded",
  "boardOutlinesAndKeepouts",
  "vesaLoadBypass",
  "antennaClearance",
  "irOpticalWindow",
  "airflowAndThermal",
  "displayAndSpeaker",
  "connectorModules",
  "harnessBendRadii",
  "serviceSequenceFit"
] as const satisfies readonly (keyof EnclosureArchitectureEvidence)[]

function assertStrictPlainDataGraph(value: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof value !== "object" || value === null) return
  if (seen.has(value)) throw new RangeError(`${path} must not contain aliases or cycles`)
  seen.add(value)
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new RangeError(`${path} must be a plain object`)

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") throw new RangeError(`${path} must not contain symbol keys`)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RangeError(`${path}.${key} must be an enumerable data property`)
    }
    assertStrictPlainDataGraph(descriptor.value, `${path}.${key}`, seen)
  }
}

function readStrictEvidenceRecord(value: unknown): EnclosureArchitectureEvidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("M4-12 evidence must be a plain object")
  }
  assertStrictPlainDataGraph(value, "M4-12 evidence", new WeakSet<object>())

  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.some((key) => typeof key === "symbol")) {
    throw new RangeError("M4-12 evidence must not contain symbol keys")
  }
  const actualStringKeys = actualKeys.filter((key): key is string => typeof key === "string").sort()
  const expectedKeys = [...evidenceKeys].sort()
  if (
    actualStringKeys.length !== expectedKeys.length ||
    actualStringKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new RangeError("M4-12 evidence must contain exactly the reviewed gates")
  }

  const record = {} as { -readonly [key in keyof EnclosureArchitectureEvidence]: boolean }
  for (const key of evidenceKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RangeError(`${key} must be an enumerable data property`)
    }
    if (typeof descriptor.value !== "boolean") throw new TypeError(`${key} must be boolean`)
    record[key] = descriptor.value
  }
  return record
}

export function evaluateEnclosureArchitecture(
  input: unknown = currentEnclosureArchitectureEvidence
): EnclosureArchitectureEvaluation {
  const record = readStrictEvidenceRecord(input)
  const failedGates = evidenceKeys.filter((key) => record[key] === false)
  return recursivelyFreeze({
    fabricationApproved: false,
    status: failedGates.length === 0 ? "evidence-complete" : "deny",
    failedGates
  })
}
