import type { ReactElement } from "react"
import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"
import {
  Bp032YageoRc0603Fr0710KlFootprint,
  bp032YageoRc0603ResistorFootprintEvidence,
  validateBp032YageoRc0603ResistorFootprintEvidence
} from "./bp032-yageo-rc0603-resistor-footprint-evidence.js"

const manufacturer = "Yageo"
const manufacturerPartNumber = "RC0603FR-0710KL"
const resistanceOhms = 10000
const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf"
const sourceSha256 = "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497"
const artworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"

const expectedReferences = [
  "R_APP_REG_PGOOD",
  "R_W5500_RESET_PULLUP",
  "R_HUB75_R1_PD",
  "R_HUB75_G1_PD",
  "R_HUB75_B1_PD",
  "R_HUB75_R2_PD",
  "R_HUB75_G2_PD",
  "R_HUB75_B2_PD",
  "R_HUB75_A_PD",
  "R_HUB75_B_PD",
  "R_HUB75_C_PD",
  "R_HUB75_D_PD",
  "R_HUB75_CLK_PD",
  "R_HUB75_LAT_PD",
  "R_HUB75_OE_PULLUP",
  "R_HUB75_UNUSED_B_A6_PD",
  "R_HUB75_UNUSED_B_A7_PD",
  "R_HUB75_UNUSED_B_A8_PD",
  "R_HUB75_PANEL_OE_PULLUP",
  "R_BUFFER_A_ENABLE_PULLUP",
  "R_BUFFER_A_GATE",
  "R_BUFFER_B_ENABLE_PULLUP",
  "R_BUFFER_B_GATE",
  "R_IR_PULLUP",
  "R_FRAM_WP_PULLUP",
  "R_FRAM_HOLD_PULLUP"
] as const

type BridgeReference = (typeof expectedReferences)[number]

const canonicalBridgeRecords = expectedReferences.map((reference) => {
  const matches = benchPrototypeApplicationFootprints.records.filter(
    (record) => record.reference === reference && record.mpn === manufacturerPartNumber
  )
  if (matches.length !== 1)
    throw new RangeError(`BP-033 canonical Yageo bridge row is missing or duplicated: ${reference}`)
  const record = matches[0]!
  return {
    reference,
    section: record.section,
    sourceContract: record.sourceContract,
    manufacturer: record.manufacturer,
    mpn: record.mpn,
    package: record.package
  }
})

const bp032ValidationErrors = validateBp032YageoRc0603ResistorFootprintEvidence()
if (bp032ValidationErrors.length > 0) {
  throw new RangeError(`BP-033 requires a valid BP-032 Yageo source candidate: ${bp032ValidationErrors.join(", ")}`)
}

const reusedProjectFootprint = structuredClone(bp032YageoRc0603ResistorFootprintEvidence.projectFootprint)

const expectedBindings = canonicalBridgeRecords.map((record) => ({
  ...record,
  upstreamLedger: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts"
})) as readonly {
  readonly reference: BridgeReference
  readonly section: string
  readonly sourceContract: string
  readonly manufacturer: string
  readonly mpn: string
  readonly package: string | null
  readonly upstreamLedger: string
}[]

const expectedDenyGates = {
  manufacturerLandPattern: { state: "not-published", authority: "deny" },
  manufacturerCad: { state: "not-acquired", authority: "deny", artifactPath: null },
  boardPlacement: { state: "not-integrated", authority: "deny" },
  fitClearance: { state: "not-reviewed", authority: "deny" },
  mechanicalLoad: { state: "not-reviewed", authority: "deny" },
  assemblyProcess: { state: "not-reviewed", authority: "deny" },
  release: { state: "deny", authority: "deny" },
  fabrication: { state: "deny", authority: "deny" },
  accepted: false
} as const

const candidateDefinition = {
  artifactKind: "bp033-yageo-10k-bridge-footprint",
  workUnit: "BP-033",
  manufacturer,
  exactOrderable: {
    manufacturerPartNumber,
    resistanceOhms,
    tolerancePercent: 1,
    package: "0603",
    packageDesignation: "0603 (1608 metric)"
  },
  references: expectedReferences,
  upstream: {
    canonicalLedger: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
    canonicalWorkUnit: "BP-033",
    sourceContracts: ["BP-142", "BP-123/BP-140", "BP-144", "BP-146", "BP-145"] as const
  },
  bindings: expectedBindings,
  retainedSource: {
    artifactPath: sourceArtifactPath,
    sha256: sourceSha256,
    manufacturer,
    manufacturerPartNumber,
    sourceOwner: "BP-125",
    reusedFrom: "bp032-yageo-rc0603-resistor-footprint-evidence.sources[0]",
    duplicateEvidenceAdded: false
  },
  geometry: {
    state: "reused-review-only-project-geometry",
    sourceCandidate: "bp032-yageo-rc0603-resistor-footprint-evidence.projectFootprint",
    sourceArtifactPath,
    projectFootprint: reusedProjectFootprint,
    manufacturerLandPattern: "not-published",
    sourceAccurate: false
  },
  artwork: {
    state: "reused-rendered-review-only-artwork",
    sourceCandidate: "bp032-yageo-rc0603-resistor-footprint-evidence.artwork",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: artworkSha256,
    authority: "deny",
    duplicateEvidenceAdded: false
  },
  denyGates: expectedDenyGates
} as const

function deepFreezeDataGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 Yageo bridge expected graph must contain only data properties")
    }
    deepFreezeDataGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const expectedBp033Yageo10kBridgeFootprint = deepFreezeDataGraph(structuredClone(candidateDefinition))
export const bp033Yageo10kBridgeFootprint = deepFreezeDataGraph(candidateDefinition)

type GraphValidationState = {
  readonly actualToExpected: Map<object, object>
  readonly activeActual: Set<object>
  readonly expectedToActual: Map<object, object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: GraphValidationState, path: string): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 Yageo bridge graph drift at ${path}`)
    return
  }
  if (typeof actual !== "object" || actual === null) throw new RangeError(`BP-033 Yageo bridge graph drift at ${path}`)
  if (state.activeActual.has(actual)) throw new RangeError(`BP-033 Yageo bridge cycle at ${path}`)
  const mappedActual = state.expectedToActual.get(expected)
  if (mappedActual !== undefined) {
    if (mappedActual !== actual) throw new RangeError(`BP-033 Yageo bridge alias drift at ${path}`)
    return
  }
  if (state.actualToExpected.has(actual)) throw new RangeError(`BP-033 Yageo bridge alias drift at ${path}`)
  state.expectedToActual.set(expected, actual)
  state.actualToExpected.set(actual, expected)
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    throw new RangeError(`BP-033 Yageo bridge prototype drift at ${path}`)
  }
  const expectedNames = Object.getOwnPropertyNames(expected)
  const actualNames = Object.getOwnPropertyNames(actual)
  const expectedSymbols = Object.getOwnPropertySymbols(expected)
  const actualSymbols = Object.getOwnPropertySymbols(actual)
  if (
    expectedNames.length !== actualNames.length ||
    expectedNames.some((name) => !actualNames.includes(name)) ||
    expectedSymbols.length !== actualSymbols.length ||
    expectedSymbols.some((symbol) => !actualSymbols.includes(symbol))
  ) {
    throw new RangeError(`BP-033 Yageo bridge hidden or symbol property drift at ${path}`)
  }
  state.activeActual.add(actual)
  try {
    for (const propertyName of expectedNames) {
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, propertyName)
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, propertyName)
      if (
        !expectedDescriptor ||
        !actualDescriptor ||
        !("value" in expectedDescriptor) ||
        !("value" in actualDescriptor) ||
        expectedDescriptor.get !== undefined ||
        expectedDescriptor.set !== undefined ||
        actualDescriptor.get !== undefined ||
        actualDescriptor.set !== undefined ||
        expectedDescriptor.enumerable !== actualDescriptor.enumerable ||
        expectedDescriptor.configurable !== actualDescriptor.configurable ||
        expectedDescriptor.writable !== actualDescriptor.writable
      ) {
        throw new RangeError(`BP-033 Yageo bridge accessor or descriptor drift at ${path}.${propertyName}`)
      }
      assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${propertyName}`)
    }
  } finally {
    state.activeActual.delete(actual)
  }
}

export function validateBp033Yageo10kBridgeFootprint(value: unknown = bp033Yageo10kBridgeFootprint): true {
  validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)
  const bp032Errors = validateBp032YageoRc0603ResistorFootprintEvidence()
  if (bp032Errors.length > 0) {
    throw new RangeError(`BP-033 BP-032 source cross-check failed: ${bp032Errors.join(", ")}`)
  }
  try {
    assertExactDataGraph(
      value,
      expectedBp033Yageo10kBridgeFootprint,
      { actualToExpected: new Map(), activeActual: new Set(), expectedToActual: new Map() },
      "root"
    )
  } catch {
    throw new RangeError("BP-033 Yageo 10 kOhm bridge exact graph or deny state drifted")
  }
  return true
}

export interface Bp033Yageo10kBridgeFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** BP-033 bridge wrapper; geometry and rendered artwork are explicitly reused from BP-032. */
export function Bp033Yageo10kBridgeFootprint(props: Bp033Yageo10kBridgeFootprintProps = {}): ReactElement {
  return <Bp032YageoRc0603Fr0710KlFootprint {...props} />
}

export default Bp033Yageo10kBridgeFootprint
