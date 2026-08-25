import type { ReactElement } from "react"
import { applicationDisplayHub75SupportParts } from "./application-display-carrier-support.js"
import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"
import {
  Bp032YageoRc0603Fr07100KlFootprint,
  validateBp032YageoRc0603ResistorFootprintEvidence
} from "./bp032-yageo-rc0603-resistor-footprint-evidence.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"

const manufacturer = "Yageo"
const manufacturerPartNumber = "RC0603FR-07100KL"
const packageCode = "0603"
const packageDesignation = "0603 (1608 metric)"
const resistanceOhms = 100000
const tolerancePercent = 1
const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf"
const sourceUrl = "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL"
const sourceSha256 = "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
const artworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"
const canonicalApplicationInventoryPath = "packages/scoring-circuit/src/bench-prototype-application-footprints.ts"
const canonicalEthernetInventoryPath = "packages/scoring-circuit/src/ethernet-support-network.ts"
const canonicalDisplayInventoryPath = "packages/scoring-circuit/src/application-display-carrier-support.ts"

const expectedReference = "R_W5500_INT_BIAS"
const expectedBoundaryReferences = ["R_BUFFER_A_GATE_PD", "R_BUFFER_B_GATE_PD"] as const
const expectedExactMpnReferences = [expectedReference, ...expectedBoundaryReferences] as const

type CanonicalApplicationRow = (typeof benchPrototypeApplicationFootprints.records)[number]

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function canonicalApplicationRows(): readonly CanonicalApplicationRow[] {
  return benchPrototypeApplicationFootprints.records.filter((record) => record.mpn === manufacturerPartNumber)
}

function exactCanonicalApplicationRow(): CanonicalApplicationRow {
  const rows = canonicalApplicationRows().filter((record) => record.reference === expectedReference)
  if (
    rows.length !== 1 ||
    rows[0]?.manufacturer !== manufacturer ||
    rows[0]?.package !== packageCode ||
    rows[0]?.sourceContract !== "BP-140/BP-033" ||
    rows[0]?.sourceUrl !== sourceUrl ||
    rows[0]?.packageStatus !== "exact-package-identified"
  ) {
    throw new RangeError("BP-033 exact Yageo INT-bias canonical row is missing or drifted")
  }
  return rows[0]
}

function exactBoundaryApplicationRows(): readonly CanonicalApplicationRow[] {
  const rows = canonicalApplicationRows().filter((record) =>
    (expectedBoundaryReferences as readonly string[]).includes(record.reference)
  )
  if (
    sorted(rows.map((record) => record.reference)).join("|") !== sorted(expectedBoundaryReferences).join("|") ||
    rows.some(
      (record) =>
        record.manufacturer !== manufacturer ||
        record.package !== packageCode ||
        record.sourceContract !== "BP-144" ||
        record.sourceUrl !== sourceUrl ||
        record.packageStatus !== "exact-package-identified"
    )
  ) {
    throw new RangeError("BP-033 Yageo boundary rows do not match the BP-144 carrier inventory")
  }
  return rows
}

function exactDisplayBoundaryRows(): readonly (typeof applicationDisplayHub75SupportParts)[number][] {
  const rows = applicationDisplayHub75SupportParts.filter((part) => part.mpn === manufacturerPartNumber)
  if (
    sorted(rows.map((part) => part.reference)).join("|") !== sorted(expectedBoundaryReferences).join("|") ||
    rows.some(
      (part) =>
        part.manufacturer !== manufacturer ||
        part.value !== "100 kOhm, 1%" ||
        part.package !== packageCode ||
        part.footprint !== packageCode ||
        part.sourceUrl !== sourceUrl
    )
  ) {
    throw new RangeError("BP-033 exact Yageo display boundary inventory is missing or drifted")
  }
  return rows
}

exactCanonicalApplicationRow()
const canonicalBoundaryApplicationRows = exactBoundaryApplicationRows()
const canonicalDisplayBoundaryRows = exactDisplayBoundaryRows()
if (
  sorted(canonicalApplicationRows().map((record) => record.reference)).join("|") !==
  sorted(expectedExactMpnReferences).join("|")
) {
  throw new RangeError("BP-033 exact Yageo MPN inventory contains an unclassified canonical row")
}
if (
  ethernetSupportNetwork.w5500.interruptPolicy.bias.reference !== expectedReference ||
  ethernetSupportNetwork.w5500.interruptPolicy.bias.manufacturer !== manufacturer ||
  ethernetSupportNetwork.w5500.interruptPolicy.bias.mpn !== manufacturerPartNumber ||
  ethernetSupportNetwork.w5500.interruptPolicy.bias.package !== packageCode ||
  ethernetSupportNetwork.w5500.interruptPolicy.bias.value !== "100 kOhm, 1%" ||
  ethernetSupportNetwork.w5500.interruptPolicy.biasEvidence.artifactPath !==
    sourceArtifactPath.replace("packages/scoring-circuit/", "") ||
  ethernetSupportNetwork.w5500.interruptPolicy.biasEvidence.sha256 !== sourceSha256
) {
  throw new RangeError("BP-033 exact Yageo INT-bias Ethernet contract is missing or drifted")
}

const projectPadGapMm = 0.5
const projectPadLengthMm = 0.9
const projectPadWidthMm = 0.9
const projectPadCenterMm = (projectPadGapMm + projectPadLengthMm) / 2
const projectMaskMarginMm = 0.05
const projectPasteReductionMm = 0.05
const projectCourtyardLengthMm = 2.4
const projectCourtyardWidthMm = 1.4

const projectFootprint = {
  state: "review-only",
  geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
  padShape: "rectangular-smt",
  pads: [
    {
      pad: "1",
      terminal: "A",
      xMm: -projectPadCenterMm,
      yMm: 0,
      widthMm: projectPadLengthMm,
      heightMm: projectPadWidthMm
    },
    {
      pad: "2",
      terminal: "B",
      xMm: projectPadCenterMm,
      yMm: 0,
      widthMm: projectPadLengthMm,
      heightMm: projectPadWidthMm
    }
  ],
  solderMask: {
    openingLengthMm: projectPadLengthMm + 2 * projectMaskMarginMm,
    openingWidthMm: projectPadWidthMm + 2 * projectMaskMarginMm,
    marginPerEdgeMm: projectMaskMarginMm,
    status: "project-input-not-manufacturer-specification"
  },
  paste: {
    openingLengthMm: projectPadLengthMm - 2 * projectPasteReductionMm,
    openingWidthMm: projectPadWidthMm - 2 * projectPasteReductionMm,
    reductionPerEdgeMm: projectPasteReductionMm,
    status: "project-input-not-manufacturer-specification"
  },
  courtyard: {
    centerMm: { x: 0, y: 0 },
    lengthMm: projectCourtyardLengthMm,
    widthMm: projectCourtyardWidthMm,
    clearanceFromPadAndPackageMm: { length: 0.05, width: 0.15 },
    status: "project-review-input-not-manufacturer-specification"
  },
  orientation: {
    datum: "pad 1 at negative local X; pad 2 at positive local X",
    boardRotationDegrees: 0,
    pinOnePad: null,
    polarity: "non-polar"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const denyGates = {
  manufacturerLandPattern: { state: "not-published", authority: "deny" },
  manufacturerCad: { state: "not-acquired", authority: "deny", artifactPath: null },
  boardPlacement: { state: "not-integrated", authority: "deny" },
  fitClearance: { state: "not-reviewed", authority: "deny" },
  thermal: { state: "not-reviewed", authority: "deny" },
  schematic: { state: "not-integrated", authority: "deny" },
  mechanicalLoad: { state: "not-reviewed", authority: "deny" },
  assemblyProcess: { state: "not-reviewed", authority: "deny" },
  release: { state: "deny", authority: "deny" },
  fabrication: { state: "deny", authority: "deny" },
  acceptance: { state: "deny", authority: "deny" },
  accepted: false
} as const

const candidateDefinition = {
  artifactKind: "bp033-yageo-rc0603fr-07100kl-100k-candidate-footprint",
  workUnit: "BP-033",
  manufacturer,
  exactOrderable: {
    manufacturerPartNumber,
    resistanceOhms,
    tolerancePercent,
    package: packageCode,
    packageDesignation
  },
  affectedReferences: [...expectedExactMpnReferences] as const,
  sourceBinding: {
    sourceOwner: "BP-033",
    exactOrderableSourceId: "bp033-yageo-rc0603fr-07100kl-datasheet",
    artifactPath: sourceArtifactPath,
    url: sourceUrl,
    sha256: sourceSha256,
    reviewedPages: [1] as const,
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      printedPageLabel: "1",
      package: "0603 / 1608",
      markers: [manufacturerPartNumber, "100 kOhms", "1.6mm +/-0.1mm", "0.8mm +/-0.1mm", "0.45mm +/-0.1mm"] as const
    },
    genericFamilySubstitution: "denied",
    duplicateEvidenceAdded: false
  },
  rootIntegrationHandoff: {
    canonicalApplicationInventoryPath,
    canonicalDisplayInventoryPath,
    requiredReferences: [...expectedExactMpnReferences] as const,
    exactOrderable: {
      manufacturer,
      manufacturerPartNumber,
      package: packageCode,
      value: "100 kOhm, 1%"
    },
    handoffStatus: "root-integration-required",
    requiredLedgerReconciliation:
      "Root must revalidate the live canonical application ledger and carrier inventory for this exact three-reference set at integration; no mutable full-file ledger hash is an authority for this candidate."
  },
  upstreamContracts: {
    ethernet: {
      contract: "BP-140/BP-033",
      ownerWorkUnit: "BP-033",
      inventoryPath: canonicalEthernetInventoryPath,
      reference: expectedReference,
      value: "100 kOhm, 1%",
      manufacturer,
      mpn: manufacturerPartNumber,
      package: packageCode,
      rail: ethernetSupportNetwork.w5500.interruptPolicy.bias.rail,
      reason: ethernetSupportNetwork.w5500.interruptPolicy.bias.reason,
      sourceEvidence: {
        artifactPath: sourceArtifactPath.replace("packages/scoring-circuit/", ""),
        sha256: sourceSha256
      }
    },
    carrier: {
      contract: "BP-144",
      ownerWorkUnit: "BP-144",
      inventoryPath: canonicalDisplayInventoryPath,
      references: [...expectedBoundaryReferences] as const,
      manufacturer,
      mpn: manufacturerPartNumber,
      package: packageCode,
      value: "100 kOhm, 1%",
      sourceUrl,
      provenance:
        "BP-144 selects these carrier rows; BP-033 owns their footprint-evidence state in this closure candidate."
    }
  },
  provenanceReconciliation: {
    status: "bp-033-evidence-owner-bp-144-selection-provenance",
    includedExactMpnRows: expectedBoundaryReferences.map((reference, index) => ({
      reference,
      ownerWorkUnit: "BP-144",
      sourceContract: canonicalBoundaryApplicationRows[index]?.sourceContract,
      applicationInventoryReference: canonicalBoundaryApplicationRows[index]?.reference,
      displayInventoryReference: canonicalDisplayBoundaryRows[index]?.reference,
      reason:
        "Exact MPN and package are present in the BP-144 carrier inventories; BP-144 remains selection provenance while BP-033 includes these rows in its footprint-evidence closure."
    }))
  },
  manufacturerFacts: {
    package: {
      designation: packageDesignation,
      caseSize: "EIA 0603 / IEC 1608",
      bodyLengthMm: { nominal: 1.6, minimum: 1.5, maximum: 1.7 },
      bodyWidthMm: { nominal: 0.8, minimum: 0.7, maximum: 0.9 },
      bodyThicknessMm: { nominal: 0.45, minimum: 0.35, maximum: 0.55 },
      terminalLengthMm: { nominal: 0.25, minimum: 0.1, maximum: 0.4 },
      terminals: 2
    },
    landPattern: {
      sourceScope: "retained exact-part product specification; exact land-pattern guidance is not published",
      copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "not-published", lengthMm: null, widthMm: null }
    },
    cad: {
      state: "not-acquired",
      artifactPath: null,
      authority: "deny"
    }
  },
  projectGeometry: {
    state: "generated-review-only",
    footprintId: "bp033-yageo-rc0603fr-07100kl-100k-project-review",
    footprint: projectFootprint,
    sourceAccurate: false,
    geometryAuthority: "project-review-input-not-manufacturer-land-pattern"
  },
  orientation: {
    state: "pending-independent-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    rotationEquivalence: "180-degree rotationally equivalent",
    datum: "local two-terminal resistor axis",
    note: "Electrical polarity is symmetric; printed value orientation, assembly marking, and stress review remain open."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: artworkSha256,
    authority: "deny"
  },
  denyGates
} as const

function deepFreezeDataGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 Yageo candidate cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 Yageo candidate may contain only data properties")
    }
    deepFreezeDataGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const expectedCandidate = deepFreezeDataGraph(structuredClone(candidateDefinition))
export const bp033YageoRc0603Fr07100Kl100kCandidateFootprint = deepFreezeDataGraph(candidateDefinition)

type GraphValidationState = {
  readonly actualSeen: Set<object>
  readonly expectedSeen: Set<object>
  readonly actualToExpected: Map<object, object>
  readonly expectedToActual: Map<object, object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: GraphValidationState, path: string): void {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 Yageo candidate drift at ${path}`)
    return
  }
  if (actual === null || typeof actual !== "object") throw new RangeError(`BP-033 Yageo candidate drift at ${path}`)
  if (state.expectedSeen.has(expected) || state.actualSeen.has(actual)) {
    throw new RangeError(`BP-033 Yageo candidate cycle or alias drift at ${path}`)
  }
  state.expectedSeen.add(expected)
  state.actualSeen.add(actual)
  state.expectedToActual.set(expected, actual)
  state.actualToExpected.set(actual, expected)
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    throw new RangeError(`BP-033 Yageo candidate prototype drift at ${path}`)
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
    throw new RangeError(`BP-033 Yageo candidate own-key drift at ${path}`)
  }
  for (const key of [...expectedNames, ...expectedSymbols]) {
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    if (
      expectedDescriptor === undefined ||
      actualDescriptor === undefined ||
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
      throw new RangeError(`BP-033 Yageo candidate descriptor drift at ${path}`)
    }
    assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${String(key)}`)
  }
}

export function validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint(
  value: unknown = bp033YageoRc0603Fr07100Kl100kCandidateFootprint
): true {
  validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)
  const bp032Errors = validateBp032YageoRc0603ResistorFootprintEvidence()
  if (bp032Errors.length > 0)
    throw new RangeError(`BP-033 retained Yageo source cross-check failed: ${bp032Errors.join(", ")}`)
  exactCanonicalApplicationRow()
  exactBoundaryApplicationRows()
  exactDisplayBoundaryRows()
  if (
    sorted(canonicalApplicationRows().map((record) => record.reference)).join("|") !==
      sorted(expectedExactMpnReferences).join("|") ||
    ethernetSupportNetwork.w5500.interruptPolicy.bias.mpn !== manufacturerPartNumber
  ) {
    throw new RangeError("BP-033 exact Yageo canonical inventory drifted")
  }
  try {
    assertExactDataGraph(
      value,
      expectedCandidate,
      { actualSeen: new Set(), expectedSeen: new Set(), actualToExpected: new Map(), expectedToActual: new Map() },
      "root"
    )
  } catch {
    throw new RangeError("BP-033 exact Yageo 100 kOhm candidate graph or deny state drifted")
  }
  return true
}

export interface Bp033YageoRc0603Fr07100Kl100kCandidateFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** BP-033 exact 100 kOhm candidate; generated geometry remains review-only. */
export function Bp033YageoRc0603Fr07100Kl100kCandidateFootprint(
  props: Bp033YageoRc0603Fr07100Kl100kCandidateFootprintProps = {}
): ReactElement {
  return <Bp032YageoRc0603Fr07100KlFootprint {...props} />
}

export default Bp033YageoRc0603Fr07100Kl100kCandidateFootprint
