/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"

/**
 * BP-033 review-only transcription for TI TPS259474ARPWR.
 *
 * This module is deliberately not imported by a board.  The retained TI
 * drawing is evidence for a review input; it is not a manufacturing release.
 */

const sourceArtifactPath = "docs/evidence/bp-033/ti-tps25947-datasheet.pdf"
const sourceSha256 = "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC"
const canonicalLedgerPath = "packages/scoring-circuit/src/bench-prototype-application-footprints.ts"
const canonicalLedgerSha256 = "EA10263933D3BC3CCFEAAA1EA00AEAAAB1797E367BF0EB6CCCDD680DE0E302A1"

const canonicalActiveReferenceReconciliation = [
  {
    canonicalLedgerReference: "U_VBUS_EFUSE",
    activeCircuitReference: "U_EFUSE",
    activeBomReference: "U_EFUSE",
    activeRole: "normal USB-C PD post-contract reverse-blocking eFuse",
    reconciliation: "explicit-ledger-alias-to-one-active-U_EFUSE-instance"
  },
  {
    canonicalLedgerReference: "U_DISPLAY_LIMITER",
    activeCircuitReference: "U_EFUSE",
    activeBomReference: "U_EFUSE",
    activeRole: "display branch limiter role in the active power contract",
    reconciliation: "explicit-logical-role-alias-to-one-active-U_EFUSE-instance; no-second-circuit-instance"
  }
] as const

const canonicalActiveReferenceBasis = {
  ledgerPath: canonicalLedgerPath,
  ledgerSha256: canonicalLedgerSha256,
  ledgerAuthority: "retained-baseline-provenance-only; validator does not hash a mutable live file",
  activeCircuitPath: "packages/scoring-circuit/src/communications-module.circuit.tsx",
  activeCircuitReference: "U_EFUSE",
  activeBomPath: "packages/scoring-circuit/src/bench-prototype-bom.ts",
  activeBomReference: "U_EFUSE",
  activePowerContractPath: "packages/scoring-circuit/src/bench-prototype-power.ts",
  activePowerContractRoles: ["normalInput.parts.efuseMpn", "branches.display.limiter.mpn"]
} as const

const pinRoles = {
  1: "EN/UVLO",
  2: "OVLO",
  3: "PG",
  4: "PGTH",
  5: "IN",
  6: "OUT",
  7: "DVDT",
  8: "GND",
  9: "ILM",
  10: "ITIMER"
} as const

type PinNumber = keyof typeof pinRoles

type ReviewPad = {
  readonly heightMm: number
  readonly pin: PinNumber
  readonly role: (typeof pinRoles)[PinNumber]
  readonly widthMm: number
  readonly xMm: number
  readonly yMm: number
}

/**
 * TI's RPW0010A page-73 example as a deliberately rectangular review
 * approximation. The source drawing includes corner/land detail that is not
 * represented as accepted project copper here. Pins 5 and 6 are the two
 * central HotRod power lands; they are IN and OUT pins, not an unnumbered
 * thermal pad.
 */
const publishedPads: readonly ReviewPad[] = [
  { pin: 1, role: pinRoles[1], xMm: -0.9, yMm: 0.75, widthMm: 0.6, heightMm: 0.25 },
  { pin: 2, role: pinRoles[2], xMm: -0.9, yMm: 0.25, widthMm: 0.6, heightMm: 0.25 },
  { pin: 3, role: pinRoles[3], xMm: -0.9, yMm: -0.25, widthMm: 0.6, heightMm: 0.25 },
  { pin: 4, role: pinRoles[4], xMm: -0.9, yMm: -0.75, widthMm: 0.6, heightMm: 0.25 },
  { pin: 5, role: pinRoles[5], xMm: -0.275, yMm: -0.325, widthMm: 0.3, heightMm: 1.75 },
  { pin: 6, role: pinRoles[6], xMm: 0.275, yMm: -0.325, widthMm: 0.3, heightMm: 1.75 },
  { pin: 7, role: pinRoles[7], xMm: 0.9, yMm: -0.75, widthMm: 0.6, heightMm: 0.25 },
  { pin: 8, role: pinRoles[8], xMm: 0.9, yMm: -0.25, widthMm: 0.6, heightMm: 0.25 },
  { pin: 9, role: pinRoles[9], xMm: 0.9, yMm: 0.25, widthMm: 0.6, heightMm: 0.25 },
  { pin: 10, role: pinRoles[10], xMm: 0.9, yMm: 0.75, widthMm: 0.6, heightMm: 0.25 }
] as const

const explicitPasteCoverage = [
  { padIds: [1, 4, 7, 10] as const, printedAreaPercent: 93 },
  { padIds: [5, 6] as const, printedAreaPercent: 82 }
] as const

function symmetricPasteMargin(widthMm: number, heightMm: number, printedAreaPercent: number): number {
  const targetArea = widthMm * heightMm * (printedAreaPercent / 100)
  const perimeter = widthMm + heightMm
  return (perimeter - Math.sqrt(perimeter ** 2 - 4 * (widthMm * heightMm - targetArea))) / 4
}

function pasteMarginForPin(pin: PinNumber): number {
  const pad = publishedPads.find((candidate) => candidate.pin === pin)
  if (pad === undefined) {
    throw new RangeError(`TPS259474ARPWR pin ${pin} is missing`)
  }
  const coverage = explicitPasteCoverage.find((group) => group.padIds.some((candidate) => candidate === pin))
  return coverage === undefined ? 0 : symmetricPasteMargin(pad.widthMm, pad.heightMm, coverage.printedAreaPercent)
}

type DataObject = Record<PropertyKey, unknown>

function isDataObject(value: object): value is DataObject {
  return Object.getPrototypeOf(value) === Object.prototype
}

/** Freeze only the canonical plain-data graph; aliases and cycles are evidence errors. */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("TPS25947 evidence must not contain aliases or cycles")
  seen.add(value)

  const array = Array.isArray(value)
  if ((!array && !isDataObject(value)) || (array && Object.getPrototypeOf(value) !== Array.prototype)) {
    throw new RangeError("TPS25947 evidence must contain only plain objects and arrays")
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    const arrayLength = array && key === "length"
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      (!descriptor.enumerable && !arrayLength) ||
      typeof key === "symbol"
    ) {
      throw new RangeError("TPS25947 evidence must contain enumerable data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function cloneDataGraph(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("TPS25947 expected evidence cannot contain aliases or cycles")
  seen.add(value)

  const array = Array.isArray(value)
  if ((!array && !isDataObject(value)) || (array && Object.getPrototypeOf(value) !== Array.prototype)) {
    throw new RangeError("TPS25947 expected evidence must contain only plain objects and arrays")
  }
  const clone: DataObject | unknown[] = array ? [] : {}
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    const arrayLength = array && key === "length"
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      (!descriptor.enumerable && !arrayLength) ||
      typeof key === "symbol"
    ) {
      throw new RangeError("TPS25947 expected evidence must contain enumerable data properties only")
    }
    if (arrayLength) continue
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: descriptor.enumerable,
      value: cloneDataGraph(descriptor.value, seen),
      writable: true
    })
  }
  return clone
}

function sameExactDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (
    (actualArray && Object.getPrototypeOf(actual) !== Array.prototype) ||
    (expectedArray && Object.getPrototypeOf(expected) !== Array.prototype) ||
    (!actualArray && !isDataObject(actual)) ||
    (!expectedArray && !isDataObject(expected))
  ) {
    return false
  }

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      actualDescriptor.configurable !== expectedDescriptor.configurable ||
      actualDescriptor.writable !== expectedDescriptor.writable
    ) {
      return false
    }
    return sameExactDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
  })
}

function sameCanonicalValues(actual: unknown, expected: unknown): boolean {
  try {
    const actualCopy = deepFreeze(cloneDataGraph(actual))
    const expectedCopy = deepFreeze(cloneDataGraph(expected))
    return sameExactDataGraph(actualCopy, expectedCopy)
  } catch {
    return false
  }
}

const pinLabels = Object.fromEntries(Object.entries(pinRoles).map(([pin, role]) => [`pin${pin}`, role]))

const bp033Tps25947ProjectFootprintGeometryDefinition = {
  artifactKind: "bp033-tps25947-project-footprint",
  workUnit: "BP-033",
  sourceBinding: {
    canonicalLedgerPath,
    canonicalLedgerSha256,
    canonicalActiveReferenceBasis,
    canonicalActiveReferenceReconciliation,
    canonicalReferences: ["U_VBUS_EFUSE", "U_DISPLAY_LIMITER"],
    exactManufacturer: "Texas Instruments",
    exactOrderablePartNumber: "TPS259474ARPWR",
    exactDevicePartNumber: "TPS259474A",
    exactPackage: "VQFN-HR (RPW), 10-pin",
    referenceRoles: {
      U_VBUS_EFUSE: "USB-C VBUS eFuse",
      U_DISPLAY_LIMITER: "display branch limiter"
    }
  },
  manufacturer: "Texas Instruments",
  orderablePartNumber: "TPS259474ARPWR",
  devicePartNumber: "TPS259474A",
  package: {
    designation: "VQFN-HR (RPW), 10-pin",
    packageDrawing: "RPW0010A",
    nominalSizeMm: { width: 2, height: 2 },
    bodyMaximumMm: { width: 2.1, height: 2.1 },
    heightMaximumMm: 1,
    packagePitchMm: 0.45,
    pins: 10,
    exposedPad: {
      state: "none",
      note: "RPW0010A has no separate unnumbered exposed thermal pad. The two central HotRod lands are numbered pins 5 (IN) and 6 (OUT)."
    }
  },
  sources: [
    {
      id: "ti-tps25947-slvsfc9c-datasheet",
      authority: "manufacturer-primary",
      documentNumber: "SLVSFC9C",
      revision: "C",
      url: "https://www.ti.com/lit/ds/symlink/tps25947.pdf",
      reviewedPages: "1-6, 62-65, 67-71",
      drawingApplicability:
        "Exact TPS259474ARPWR orderable/package binding and 10-pin top-view pin map from datasheet SLVSFC9C Rev C.",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256,
      retainedBytes: 5316801
    },
    {
      id: "ti-rpw0010a-4225183a-package-drawing",
      authority: "manufacturer-primary",
      documentNumber: "RPW0010A",
      revision: "4225183/A",
      publicationDate: "August 2019",
      url: "https://www.ti.com/lit/ds/symlink/tps25947.pdf",
      reviewedPages: "72-74",
      drawingApplicability:
        "Separate TI RPW0010A package drawing 4225183/A: package outline, example board layout, solder-mask details, and 0.100 mm stencil example.",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256,
      retainedBytes: 5316801
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "The retained datasheet drawing and examples are not a native TI ECAD or 3D CAD import."
  },
  manufacturerLandPattern: {
    sourceId: "ti-rpw0010a-4225183a-package-drawing",
    copper: {
      view: "top",
      representation: "rectangular-review-approximation",
      pads: publishedPads.map((pad) => ({ ...pad })),
      sourcePages: [73],
      sourceStatement:
        "TI RPW0010A example board layout: ten numbered copper lands, including central HotRod pins 5 and 6. The rendered rectangles are a review approximation; TI's corner and land detail is not accepted as project copper."
    },
    solderMask: {
      definition: "non-solder-mask-defined-preferred",
      nsmdMarginMaximumMm: 0.05,
      smdMarginMinimumMm: 0.05,
      sourcePages: [73],
      sourceStatement:
        "TI RPW0010A solder-mask details show 0.05 mm maximum all around for the preferred NSMD option and 0.05 mm minimum all around for SMD."
    },
    paste: {
      stencilThicknessMm: 0.1,
      representation: "symmetric-rectangular-review-approximation",
      explicitCoverage: explicitPasteCoverage.map((group) => ({ ...group, padIds: [...group.padIds] })),
      unquantifiedPadIds: [2, 3, 8, 9] as const,
      sourcePages: [74],
      sourceStatement:
        "TI's 0.100 mm stencil example publishes 93% printed area for pads 1, 4, 7, and 10, and 82% for pads 5 and 6; no numeric reduction is stated for pads 2, 3, 8, and 9. Symmetric rectangular apertures are a review approximation of those published areas."
    },
    courtyard: {
      state: "not-published",
      authority: "deny",
      sourceStatement: "RPW0010A pages 72-74 do not publish a courtyard."
    }
  },
  pinMap: Object.entries(pinRoles).map(([pin, role]) => ({ pin: Number(pin), role })),
  orientation: {
    sourceIds: ["ti-tps25947-slvsfc9c-datasheet", "ti-rpw0010a-4225183a-package-drawing"],
    sourcePages: [5, 72, 73, 74],
    view: "top",
    boardRotationDegrees: 0,
    pinOneDatum: "upper-left package pin-1 identification in TI top view",
    numbering:
      "Pins 1 through 4 descend the left edge; pins 5 and 6 are the central lower HotRod lands; pins 7 through 10 ascend the right edge.",
    sourceCaptured: true,
    independentBoardOrientationAccepted: false
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "manufacturer-example-transcription",
    padShape: "rectangular-smt-review-approximation",
    landRowCoordinateSpacingMm: 0.5,
    pads: publishedPads.map((pad) => ({ ...pad })),
    solderMask: {
      marginPerEdgeMm: 0.05,
      derivation: "TI preferred NSMD maximum all-around margin",
      status: "review-input-only"
    },
    paste: {
      stencilThicknessMm: 0.1,
      explicitCoverage: explicitPasteCoverage.map((group) => ({ ...group, padIds: [...group.padIds] })),
      unquantifiedPadIds: [2, 3, 8, 9] as const,
      representation: "symmetric-rectangular-review-approximation",
      status: "review-input-only"
    },
    courtyard: {
      state: "not-published",
      status: "denied"
    },
    orientationStatus: "source-captured-independent-review-pending",
    layoutAuthority: "deny",
    currentCapacityAuthority: "deny",
    thermalAuthority: "deny",
    boardFitAuthority: "deny",
    fabricationAuthority: "deny",
    accepted: false
  },
  authority: {
    packageIdentityCaptured: true,
    pinMapCaptured: true,
    publishedCopperCaptured: true,
    publishedMaskCaptured: true,
    publishedPasteCaptured: true,
    publishedOrientationCaptured: true,
    layoutAccepted: false,
    currentCapacityAccepted: false,
    thermalPerformanceAccepted: false,
    boardFitAccepted: false,
    manufacturerCadImported: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "tscircuit-rendered-review-footprint",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    renderedGeometrySha256: "2b05aa3d89eae2a366006507c35f744667daba4ce6e5af3ad731d527908d5cf4",
    authority: "deny"
  }
} as const

export const bp033Tps25947ProjectFootprintGeometry = deepFreeze(bp033Tps25947ProjectFootprintGeometryDefinition)

const bp033Tps25947ExpectedSnapshot = deepFreeze(
  cloneDataGraph(bp033Tps25947ProjectFootprintGeometry)
) as typeof bp033Tps25947ProjectFootprintGeometry

/** Empty output means the immutable review-only evidence is internally consistent. */
export function validateBp033Tps25947ProjectFootprintGeometry(
  input: unknown = bp033Tps25947ProjectFootprintGeometry
): readonly string[] {
  const errors: string[] = []
  let safeCandidate: typeof bp033Tps25947ProjectFootprintGeometry
  try {
    safeCandidate = cloneDataGraph(input) as typeof bp033Tps25947ProjectFootprintGeometry
  } catch {
    return ["TPS25947 candidate must be an independent plain data graph"]
  }
  if (!sameExactDataGraph(input, bp033Tps25947ExpectedSnapshot)) {
    errors.push("TPS25947 candidate drifted from the independent frozen evidence snapshot")
  }
  try {
    const candidate = safeCandidate
    const source = safeCandidate.sources[0]
    const references = safeCandidate.sourceBinding.canonicalReferences
    if (candidate.artifactKind !== "bp033-tps25947-project-footprint") {
      errors.push("TPS25947 artifact kind drifted")
    }
    if (
      candidate.workUnit !== "BP-033" ||
      candidate.manufacturer !== "Texas Instruments" ||
      candidate.orderablePartNumber !== "TPS259474ARPWR" ||
      candidate.devicePartNumber !== "TPS259474A" ||
      candidate.package.designation !== "VQFN-HR (RPW), 10-pin" ||
      candidate.package.packageDrawing !== "RPW0010A" ||
      candidate.package.packagePitchMm !== 0.45 ||
      candidate.package.pins !== 10 ||
      candidate.package.exposedPad.state !== "none"
    ) {
      errors.push("exact TPS259474ARPWR RPW0010A identity or exposed-pad disposition drifted")
    }
    if (
      candidate.sourceBinding.canonicalLedgerPath !== canonicalLedgerPath ||
      candidate.sourceBinding.canonicalLedgerSha256 !== canonicalLedgerSha256 ||
      references.length !== 2 ||
      references[0] !== "U_VBUS_EFUSE" ||
      references[1] !== "U_DISPLAY_LIMITER" ||
      candidate.sourceBinding.exactManufacturer !== "Texas Instruments" ||
      candidate.sourceBinding.exactOrderablePartNumber !== "TPS259474ARPWR" ||
      candidate.sourceBinding.exactDevicePartNumber !== "TPS259474A" ||
      candidate.sourceBinding.exactPackage !== "VQFN-HR (RPW), 10-pin"
    ) {
      errors.push("BP-033 canonical dual-reference binding drifted")
    }
    if (
      !sameCanonicalValues(candidate.sourceBinding.canonicalActiveReferenceBasis, canonicalActiveReferenceBasis) ||
      !sameCanonicalValues(
        candidate.sourceBinding.canonicalActiveReferenceReconciliation,
        canonicalActiveReferenceReconciliation
      )
    ) {
      errors.push("canonical ledger basis or active U_EFUSE alias reconciliation drifted")
    }
    if (
      !sameCanonicalValues(candidate.sourceBinding.referenceRoles, {
        U_VBUS_EFUSE: "USB-C VBUS eFuse",
        U_DISPLAY_LIMITER: "display branch limiter"
      })
    ) {
      errors.push("canonical U_EFUSE reference roles drifted")
    }
    if (
      candidate.sources.length !== 2 ||
      source === undefined ||
      source.id !== "ti-tps25947-slvsfc9c-datasheet" ||
      source.documentNumber !== "SLVSFC9C" ||
      source.revision !== "C" ||
      source.artifactPath !== sourceArtifactPath ||
      source.sha256 !== sourceSha256 ||
      source.reviewedPages !== "1-6, 62-65, 67-71" ||
      source.retainedBytes !== 5316801
    ) {
      errors.push("retained TI TPS25947 source identity, scope, or hash drifted")
    }
    const packageDrawingSource = candidate.sources[1]
    if (
      packageDrawingSource === undefined ||
      packageDrawingSource.id !== "ti-rpw0010a-4225183a-package-drawing" ||
      packageDrawingSource.documentNumber !== "RPW0010A" ||
      packageDrawingSource.revision !== "4225183/A" ||
      packageDrawingSource.publicationDate !== "August 2019" ||
      packageDrawingSource.reviewedPages !== "72-74" ||
      packageDrawingSource.artifactPath !== sourceArtifactPath ||
      packageDrawingSource.sha256 !== sourceSha256 ||
      packageDrawingSource.retainedBytes !== 5316801
    ) {
      errors.push("separate RPW0010A drawing revision or hash drifted")
    }
    if (!sameCanonicalValues(candidate.sources, bp033Tps25947ExpectedSnapshot.sources)) {
      errors.push("official TI source URL, authority, pages, revision, or hash drifted")
    }
    if (!sameCanonicalValues(candidate.package, bp033Tps25947ExpectedSnapshot.package)) {
      errors.push("complete RPW package dimensions, pitch, pins, or exposed-pad geometry drifted")
    }
    if (
      candidate.manufacturerCad.state !== "not-acquired" ||
      candidate.manufacturerCad.artifactPath !== null ||
      candidate.manufacturerCad.authority !== "deny"
    ) {
      errors.push("manufacturer CAD must remain unacquired and denied")
    }
    if (
      candidate.manufacturerCad.note !==
      "The retained datasheet drawing and examples are not a native TI ECAD or 3D CAD import."
    ) {
      errors.push("manufacturer CAD evidence note drifted")
    }
    if (
      candidate.manufacturerLandPattern.sourceId !== "ti-rpw0010a-4225183a-package-drawing" ||
      candidate.manufacturerLandPattern.copper.representation !== "rectangular-review-approximation" ||
      candidate.manufacturerLandPattern.copper.sourcePages.length !== 1 ||
      candidate.manufacturerLandPattern.copper.sourcePages[0] !== 73 ||
      candidate.manufacturerLandPattern.solderMask.nsmdMarginMaximumMm !== 0.05 ||
      candidate.manufacturerLandPattern.solderMask.smdMarginMinimumMm !== 0.05 ||
      candidate.manufacturerLandPattern.solderMask.sourcePages[0] !== 73 ||
      candidate.manufacturerLandPattern.paste.stencilThicknessMm !== 0.1 ||
      candidate.manufacturerLandPattern.paste.representation !== "symmetric-rectangular-review-approximation" ||
      candidate.manufacturerLandPattern.paste.sourcePages[0] !== 74 ||
      !sameCanonicalValues(candidate.manufacturerLandPattern.paste.explicitCoverage, explicitPasteCoverage) ||
      !sameCanonicalValues(candidate.manufacturerLandPattern.paste.unquantifiedPadIds, [2, 3, 8, 9])
    ) {
      errors.push("published RPW copper, mask, or paste evidence drifted")
    }
    if (
      !sameCanonicalValues(candidate.manufacturerLandPattern, bp033Tps25947ExpectedSnapshot.manufacturerLandPattern)
    ) {
      errors.push("complete RPW published copper, mask, paste, or courtyard geometry drifted")
    }
    if (
      !sameCanonicalValues(candidate.orientation.sourceIds, [
        "ti-tps25947-slvsfc9c-datasheet",
        "ti-rpw0010a-4225183a-package-drawing"
      ]) ||
      candidate.orientation.view !== "top" ||
      candidate.orientation.boardRotationDegrees !== 0 ||
      candidate.orientation.sourceCaptured !== true ||
      candidate.orientation.independentBoardOrientationAccepted !== false ||
      candidate.orientation.pinOneDatum !== "upper-left package pin-1 identification in TI top view"
    ) {
      errors.push("RPW pin-one orientation evidence or acceptance drifted")
    }
    if (!sameCanonicalValues(candidate.orientation, bp033Tps25947ExpectedSnapshot.orientation)) {
      errors.push("complete RPW orientation source pages or numbering drifted")
    }
    if (candidate.pinMap.length !== 10) {
      errors.push("TPS259474ARPWR must retain exactly ten pins")
    }
    for (const [index, pin] of candidate.pinMap.entries()) {
      const expectedPin = index + 1
      if (pin.pin !== expectedPin || pin.role !== pinRoles[expectedPin as PinNumber]) {
        errors.push(`TPS259474ARPWR pin map drifted at pin ${expectedPin}`)
      }
    }
    if (
      candidate.projectFootprint.state !== "review-only" ||
      candidate.projectFootprint.accepted ||
      candidate.projectFootprint.padShape !== "rectangular-smt-review-approximation" ||
      candidate.projectFootprint.landRowCoordinateSpacingMm !== 0.5 ||
      candidate.projectFootprint.layoutAuthority !== "deny" ||
      candidate.projectFootprint.currentCapacityAuthority !== "deny" ||
      candidate.projectFootprint.thermalAuthority !== "deny" ||
      candidate.projectFootprint.boardFitAuthority !== "deny" ||
      candidate.projectFootprint.fabricationAuthority !== "deny" ||
      candidate.authority.layoutAccepted ||
      candidate.authority.currentCapacityAccepted ||
      candidate.authority.thermalPerformanceAccepted ||
      candidate.authority.boardFitAccepted ||
      candidate.authority.manufacturerCadImported ||
      candidate.authority.fabricationAuthorized ||
      candidate.authority.releaseState !== "deny"
    ) {
      errors.push("BP-033 TPS25947 layout, current, thermal, fit, and release gates must remain denied")
    }
    if (!sameCanonicalValues(candidate.projectFootprint, bp033Tps25947ExpectedSnapshot.projectFootprint)) {
      errors.push("complete RPW project pad, mask, paste, courtyard, and deny geometry drifted")
    }
    if (!sameCanonicalValues(candidate.authority, bp033Tps25947ExpectedSnapshot.authority)) {
      errors.push("captured-source authority booleans or deny gates drifted")
    }
    if (candidate.projectFootprint.paste.representation !== "symmetric-rectangular-review-approximation") {
      errors.push("project paste apertures must remain explicitly review approximations")
    }
    if (
      candidate.artwork.state !== "generated-project-review-only" ||
      candidate.artwork.authority !== "deny" ||
      !/^[0-9a-f]{64}$/u.test(candidate.artwork.renderedGeometrySha256)
    ) {
      errors.push("rendered geometry must have a bound hash while remaining denied")
    }
    if (!sameCanonicalValues(candidate.artwork, bp033Tps25947ExpectedSnapshot.artwork)) {
      errors.push("exact persisted artwork hash, generator, or authority drifted")
    }
    return errors
  } catch {
    errors.push("TPS25947 candidate is structurally incomplete")
    return errors
  }
}

const projectFootprint = (
  <footprint name="BP033_TPS25947_RPW0010A_PROJECT_FOOTPRINT" originalLayer="top">
    {publishedPads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={String(pad.pin)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin="0.05mm"
          solderPasteMargin={`${-pasteMarginForPin(pad.pin)}mm`}
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[String(pad.pin), pad.role, `pin${pad.pin}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp033Tps25947ProjectFootprintProps {
  readonly name?: string
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated review component; it must never be imported by a board model. */
export function Bp033Tps25947ProjectFootprint({
  name,
  pcbRotation,
  pcbX,
  pcbY
}: Bp033Tps25947ProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name={name ?? "BP033_TPS25947_REVIEW_ONLY"}
      manufacturerPartNumber="TPS259474ARPWR"
      pinLabels={pinLabels}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp033Tps25947ProjectFootprint
