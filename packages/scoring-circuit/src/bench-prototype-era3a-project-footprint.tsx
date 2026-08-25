import type { ReactElement } from "react"

type DataRecord = Record<PropertyKey, unknown>

const affectedReferences = [
  "R_SOURCE_1",
  "R_SOURCE_2",
  "R_SOURCE_3",
  "R_SOURCE_4",
  "R_SOURCE_5",
  "R_SOURCE_6",
  "R_SOURCE_7"
] as const

const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf"
const sourceSha256 = "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79"
const landPatternArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf"
const landPatternSha256 = "65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D"
const productArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html"
const productSha256 = "BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048"
const cadStatusArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html"
const cadStatusSha256 = "ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D"
const artworkSha256 = "06D522D5384717F820A4BEF38F828012E0735506126039442373BA74CEC9B967"

const projectCopperPadLengthMm = 0.8
const projectCopperPadWidthMm = 0.9
const projectOverallLandSpanMm = 2.1
const projectCopperPadGapMm = projectOverallLandSpanMm - 2 * projectCopperPadLengthMm
const projectCopperPadCenterXMm = (projectCopperPadGapMm + projectCopperPadLengthMm) / 2

function isPlainRecord(value: object): value is DataRecord {
  return Object.getPrototypeOf(value) === Object.prototype
}

/** Freeze only an enumerable, plain-data graph; aliases and cycles are evidence errors. */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-031 ERA3A evidence cannot contain aliases or cycles")
  seen.add(value)

  const array = Array.isArray(value)
  if ((!array && !isPlainRecord(value)) || (array && Object.getPrototypeOf(value) !== Array.prototype)) {
    throw new RangeError("BP-031 ERA3A evidence must contain only plain objects and arrays")
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
      throw new RangeError("BP-031 ERA3A evidence must contain enumerable data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/** Clone through descriptors, never through property reads, so getters cannot hide evidence drift. */
function cloneDataGraph(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-031 ERA3A candidate cannot contain aliases or cycles")
  seen.add(value)

  const array = Array.isArray(value)
  if ((!array && !isPlainRecord(value)) || (array && Object.getPrototypeOf(value) !== Array.prototype)) {
    throw new RangeError("BP-031 ERA3A candidate must contain only plain objects and arrays")
  }
  const clone: DataRecord | unknown[] = array ? [] : {}
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    const arrayLength = array && key === "length"
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      (!descriptor.enumerable && !arrayLength) ||
      typeof key === "symbol"
    ) {
      throw new RangeError("BP-031 ERA3A candidate must contain enumerable data properties only")
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
    (!actualArray && !isPlainRecord(actual)) ||
    (!expectedArray && !isPlainRecord(expected))
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

function sameCanonicalDataGraph(actual: unknown, expected: unknown): boolean {
  try {
    const actualCopy = deepFreeze(cloneDataGraph(actual))
    const expectedCopy = deepFreeze(cloneDataGraph(expected))
    return sameExactDataGraph(actualCopy, expectedCopy)
  } catch {
    return false
  }
}

/**
 * BP-031 project land pattern for the exact Panasonic ERA3AEB2491V source
 * resistors. This is a review-only artifact, not a fabrication footprint.
 */
const evidenceDefinition = {
  artifactKind: "bp031-era3aeb2491v-project-footprint",
  workUnit: "BP-031",
  manufacturer: "Panasonic Industry",
  manufacturerPartNumber: "ERA3AEB2491V",
  sourceContract: "BP-102",
  role: "reference excitation series resistor",
  geometryAuthority: "project-review-input-with-panasonic-land-guidance",
  affectedReferences: [...affectedReferences],
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "R_SOURCE",
    replicatedReferencePrefix: "R_SOURCE_",
    manufacturer: "Panasonic",
    manufacturerPartNumber: "ERA3AEB2491V",
    package: "0603",
    exactSourceId: "M4-04:ERA3AEB2491V",
    landPatternSourceId: "panasonic-1608-rectangular-land-pattern",
    landPatternApplicability:
      "Panasonic high-precision ERA 1608 (0603) family guidance; not an exact-orderable CAD object or released footprint"
  },
  sourceControl: {
    basisCommit: "c6a0723a719551c1632ff2eff5b528409b4cac57",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        sha256: "496D8727B33209C03B31F2B1F203397C7CAB364F40D00EDF2EC8B1BDF227E55D"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
        sha256: "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB"
      },
      {
        path: "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts",
        sha256: "298F04737136BA41B9F909ECF838342DF5D2DA1173778BD42A64AC0048D9E9CE"
      }
    ]
  },
  primaryProductPageUrl:
    "https://industrial.panasonic.com/ww/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V",
  sources: [
    {
      id: "panasonic-era3a-package",
      authority: "manufacturer-primary",
      applicability: "exact-orderable-identity-and-ERA3A-package-drawing",
      documentNumber: "AOA0000C309",
      url: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf",
      reviewedPage: 3,
      reviewedPages: [1, 2, 3],
      pageBinding: {
        retainedPdfPageCount: 7,
        exactOrderableEvidencePage: 2,
        packageDrawingPage: 3,
        manufacturerPartNumber: "ERA3AEB2491V",
        package: "ERA3A / 1608 (0603)"
      },
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256,
      scope:
        "Panasonic ERAA type PDF. Page 2 binds the ERA3A 0603 electrical family and ERA3AEB tolerance/range; page 3 supplies the ERA3A body and terminal dimensions. The PDF is retained manufacturer drawing evidence, not project CAD."
    },
    {
      id: "panasonic-1608-rectangular-land-pattern",
      authority: "manufacturer-primary",
      applicability: "manufacturer-recommended-land-pattern-guidance-not-exact-CAD",
      documentNumber: "DMM0000COL20",
      url: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf",
      reviewedPage: 1,
      reviewedPages: [1],
      pageBinding: {
        retainedPdfPageCount: 3,
        landPatternPage: 1,
        package: "1608 (0603)",
        family: "high-precision ERA"
      },
      artifactPath: landPatternArtifactPath,
      sha256: landPatternSha256,
      scope:
        "Panasonic recommended rectangular land-pattern table, page 1, high-precision ERA 1608 (0603): a = 0.7-0.9 mm, b = 2.0-2.2 mm, c = 0.8-1.0 mm. Manufacturer guidance only; not exact-orderable CAD."
    },
    {
      id: "panasonic-era3a-product-identity",
      authority: "manufacturer-primary",
      applicability: "exact-orderable-identity-and-package",
      documentNumber: null,
      url: "https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V",
      reviewedPage: null,
      reviewedPages: null,
      pageBinding: {
        retainedHtmlDocument: true,
        manufacturerPartNumber: "ERA3AEB2491V",
        package: "0603 / 1.6 x 0.8 mm"
      },
      artifactPath: productArtifactPath,
      sha256: productSha256,
      scope:
        "Retained Panasonic exact-product page binds ERA3AEB2491V, 2.49 kilohm, 0.1 percent, 0603 / 1.6 x 0.8 mm, 0.1 W, and 25 ppm/K. It is identity evidence, not CAD or project geometry."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    availability: "not-published",
    sourceId: "panasonic-era3a-cad-status",
    sourceUrl: "https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V/cad",
    artifactPath: cadStatusArtifactPath,
    sha256: cadStatusSha256,
    authority: "deny",
    disposition: "not-acquired-no-substitute",
    note: "The retained Panasonic CAD-status page states that CAD data is unavailable for the exact product and exposes only third-party links. No Panasonic CAD object is retained or treated as project geometry."
  },
  package: {
    designation: "ERA3A / 1608 (0603)",
    caseSize: "EIA 0603 / IEC 1608",
    resistanceOhms: 2490,
    tolerancePercent: 0.1,
    tcrPpmPerK: 25,
    ratedPowerW: 0.1,
    maximumVoltageVdc: 75,
    overloadVoltageVdc: 150,
    operatingTemperatureC: { minimum: -55, maximum: 155 },
    lengthMm: { nominal: 1.6, tolerance: 0.2 },
    widthMm: { nominal: 0.8, tolerance: 0.2 },
    terminalLengthMm: { nominal: 0.3, tolerance: 0.2 },
    terminalWidthMm: { nominal: 0.3, tolerance: 0.2 },
    thicknessMm: { nominal: 0.45, tolerance: 0.1 },
    terminals: 2
  },
  manufacturerLandPattern: {
    designation: "1608 (0603) high-precision ERA rectangular land pattern",
    sourceId: "panasonic-1608-rectangular-land-pattern",
    sourceScope: "manufacturer-recommended guidance, not exact-orderable CAD",
    reviewedPage: 1,
    aPadLengthMm: { minimum: 0.7, maximum: 0.9 },
    bOverallLandSpanMm: { minimum: 2, maximum: 2.2 },
    cPadWidthMm: { minimum: 0.8, maximum: 1 },
    sourceStatement: "Panasonic DMM0000COL20 page 1 high-precision ERA 1608 (0603) row."
  },
  projectSelection: {
    solderingMethod: "reflow",
    rationale: "Midpoint selection within Panasonic's high-precision ERA 1608 a, b, and c ranges.",
    manufacturerParameterSelectionMm: { aPadLength: 0.8, bOverallLandSpan: 2.1, cPadWidth: 0.9 },
    copperPad: { lengthMm: projectCopperPadLengthMm, widthMm: projectCopperPadWidthMm },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: 0.9,
      openingWidthMm: 1,
      marginMm: 0.05,
      derivation: "project NSMD review input: copper dimensions plus 0.05 mm per edge",
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: 0.7,
      openingWidthMm: 0.8,
      reductionPerEdgeMm: 0.05,
      derivation: "project reflow review input: copper dimensions less 0.05 mm per edge",
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      lengthMm: 2.4,
      widthMm: 1.3,
      minimumClearanceMm: 0.15,
      derivation: "project review envelope around the 2.1 x 0.9 mm land span and 1.6 x 0.8 mm package",
      status: "project-review-input-not-manufacturer-specification"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
  ],
  orientation: {
    state: "pending-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    rotationEquivalence: "180-degree rotationally equivalent",
    datum: "local two-terminal resistor axis",
    basis: "ERA3A package drawing page 3 has no polarity or pin-one marking; A and B are arbitrary review endpoints.",
    note: "Printed-value marking direction and independent assembly orientation review remain open."
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-with-panasonic-land-guidance",
    padShape: "rectangular-smt",
    pads: [
      { pad: "1", terminal: "A", xMm: -projectCopperPadCenterXMm, yMm: 0, widthMm: 0.8, heightMm: 0.9 },
      { pad: "2", terminal: "B", xMm: projectCopperPadCenterXMm, yMm: 0, widthMm: 0.8, heightMm: 0.9 }
    ],
    solderMask: {
      openingLengthMm: 0.9,
      openingWidthMm: 1,
      marginPerEdgeMm: 0.05,
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: 0.7,
      openingWidthMm: 0.8,
      reductionPerEdgeMm: 0.05,
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      lengthMm: 2.4,
      widthMm: 1.3,
      status: "project-review-input-not-manufacturer-specification"
    },
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: artworkSha256,
    authority: "deny"
  },
  authority: {
    packageIdentityCaptured: true,
    packageGeometryCaptured: true,
    manufacturerLandGuidanceCaptured: true,
    manufacturerCadImported: false,
    independentOrientationAccepted: false,
    projectArtworkAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const expectedEvidence = deepFreeze(cloneDataGraph(evidenceDefinition)) as typeof evidenceDefinition
export const benchPrototypeEra3aProjectFootprintGeometry = deepFreeze(evidenceDefinition)

/** Empty output means the exact seven-reference review candidate remains internally consistent and denied. */
export function validateBenchPrototypeEra3aProjectFootprint(
  input: unknown = benchPrototypeEra3aProjectFootprintGeometry
): readonly string[] {
  let candidate: typeof evidenceDefinition
  try {
    candidate = cloneDataGraph(input) as typeof evidenceDefinition
  } catch {
    return ["BP-031 ERA3A candidate must be an independent plain data graph"]
  }

  if (!sameCanonicalDataGraph(candidate, expectedEvidence)) {
    return ["BP-031 ERA3A candidate drifted from the independent frozen evidence baseline"]
  }

  const errors: string[] = []

  const exactSource = candidate.sources.find((source) => source.id === "panasonic-era3a-package")
  const landSource = candidate.sources.find((source) => source.id === "panasonic-1608-rectangular-land-pattern")
  const productSource = candidate.sources.find((source) => source.id === "panasonic-era3a-product-identity")
  if (
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== "Panasonic Industry" ||
    candidate.manufacturerPartNumber !== "ERA3AEB2491V" ||
    candidate.sourceContract !== "BP-102" ||
    candidate.role !== "reference excitation series resistor" ||
    JSON.stringify(candidate.affectedReferences) !== JSON.stringify(affectedReferences)
  ) {
    errors.push("ERA3A exact MPN, BP-102 role, or seven-reference scope drifted")
  }
  if (
    candidate.sourceBinding.canonicalSourcePath !== "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    candidate.sourceBinding.canonicalSourceReference !== "R_SOURCE" ||
    candidate.sourceBinding.replicatedReferencePrefix !== "R_SOURCE_" ||
    candidate.sourceBinding.manufacturer !== "Panasonic" ||
    candidate.sourceBinding.manufacturerPartNumber !== "ERA3AEB2491V" ||
    candidate.sourceBinding.package !== "0603" ||
    candidate.sourceBinding.exactSourceId !== "M4-04:ERA3AEB2491V" ||
    candidate.sourceBinding.landPatternSourceId !== "panasonic-1608-rectangular-land-pattern" ||
    !candidate.sourceBinding.landPatternApplicability.includes("not an exact-orderable CAD")
  ) {
    errors.push("R_SOURCE canonical identity or land-guidance binding drifted")
  }
  if (
    candidate.sourceControl.basisCommit !== "c6a0723a719551c1632ff2eff5b528409b4cac57" ||
    candidate.sourceControl.upstreamSources.length !== 3 ||
    candidate.sourceControl.upstreamSources[0]?.path !==
      "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    candidate.sourceControl.upstreamSources[0]?.sha256 !==
      "496D8727B33209C03B31F2B1F203397C7CAB364F40D00EDF2EC8B1BDF227E55D" ||
    candidate.sourceControl.upstreamSources[1]?.path !==
      "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts" ||
    candidate.sourceControl.upstreamSources[1]?.sha256 !==
      "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB" ||
    candidate.sourceControl.upstreamSources[2]?.path !==
      "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts" ||
    candidate.sourceControl.upstreamSources[2]?.sha256 !==
      "298F04737136BA41B9F909ECF838342DF5D2DA1173778BD42A64AC0048D9E9CE"
  ) {
    errors.push("ERA3A canonical source-control hashes drifted")
  }
  if (
    candidate.sources.length !== 3 ||
    exactSource === undefined ||
    exactSource.documentNumber !== "AOA0000C309" ||
    exactSource.reviewedPage !== 3 ||
    JSON.stringify(exactSource.reviewedPages) !== JSON.stringify([1, 2, 3]) ||
    exactSource.artifactPath !== sourceArtifactPath ||
    exactSource.sha256 !== sourceSha256 ||
    landSource === undefined ||
    landSource.documentNumber !== "DMM0000COL20" ||
    landSource.reviewedPage !== 1 ||
    JSON.stringify(landSource.reviewedPages) !== JSON.stringify([1]) ||
    landSource.artifactPath !== landPatternArtifactPath ||
    landSource.sha256 !== landPatternSha256 ||
    productSource === undefined ||
    productSource.artifactPath !== productArtifactPath ||
    productSource.sha256 !== productSha256 ||
    [exactSource, landSource, productSource].some((source) => !/^[0-9A-F]{64}$/u.test(source.sha256))
  ) {
    errors.push("ERA3A retained source hash, page, or exact-product provenance drifted")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.availability !== "not-published" ||
    candidate.manufacturerCad.sourceId !== "panasonic-era3a-cad-status" ||
    candidate.manufacturerCad.artifactPath !== cadStatusArtifactPath ||
    candidate.manufacturerCad.sha256 !== cadStatusSha256 ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.disposition !== "not-acquired-no-substitute" ||
    !/^[0-9A-F]{64}$/u.test(candidate.manufacturerCad.sha256)
  ) {
    errors.push("ERA3A manufacturer-CAD provenance must remain unavailable and denied")
  }
  if (
    candidate.package.designation !== "ERA3A / 1608 (0603)" ||
    candidate.package.caseSize !== "EIA 0603 / IEC 1608" ||
    candidate.package.resistanceOhms !== 2490 ||
    candidate.package.tolerancePercent !== 0.1 ||
    candidate.package.tcrPpmPerK !== 25 ||
    candidate.package.ratedPowerW !== 0.1 ||
    candidate.package.lengthMm.nominal !== 1.6 ||
    candidate.package.lengthMm.tolerance !== 0.2 ||
    candidate.package.widthMm.nominal !== 0.8 ||
    candidate.package.widthMm.tolerance !== 0.2 ||
    candidate.package.terminalLengthMm.nominal !== 0.3 ||
    candidate.package.terminalLengthMm.tolerance !== 0.2
  ) {
    errors.push("ERA3A exact package or electrical identity drifted")
  }
  if (
    candidate.manufacturerLandPattern.sourceId !== "panasonic-1608-rectangular-land-pattern" ||
    candidate.manufacturerLandPattern.reviewedPage !== 1 ||
    candidate.manufacturerLandPattern.aPadLengthMm.minimum !== 0.7 ||
    candidate.manufacturerLandPattern.aPadLengthMm.maximum !== 0.9 ||
    candidate.manufacturerLandPattern.bOverallLandSpanMm.minimum !== 2 ||
    candidate.manufacturerLandPattern.bOverallLandSpanMm.maximum !== 2.2 ||
    candidate.manufacturerLandPattern.cPadWidthMm.minimum !== 0.8 ||
    candidate.manufacturerLandPattern.cPadWidthMm.maximum !== 1 ||
    !candidate.manufacturerLandPattern.sourceScope.includes("not exact-orderable CAD")
  ) {
    errors.push("Panasonic 1608 manufacturer land guidance drifted")
  }
  if (
    candidate.projectSelection.copperPad.lengthMm !== projectCopperPadLengthMm ||
    candidate.projectSelection.copperPad.widthMm !== projectCopperPadWidthMm ||
    candidate.projectSelection.overallLandSpanMm !== projectOverallLandSpanMm ||
    candidate.projectSelection.derivedCopperPadGapMm !== projectCopperPadGapMm ||
    candidate.projectSelection.derivedCopperPadCenterXMm !== projectCopperPadCenterXMm ||
    candidate.projectSelection.solderMask.openingLengthMm !== 0.9 ||
    candidate.projectSelection.solderMask.openingWidthMm !== 1 ||
    candidate.projectSelection.solderMask.marginMm !== 0.05 ||
    candidate.projectSelection.paste.openingLengthMm !== 0.7 ||
    candidate.projectSelection.paste.openingWidthMm !== 0.8 ||
    candidate.projectSelection.paste.reductionPerEdgeMm !== 0.05 ||
    candidate.projectSelection.courtyard.lengthMm !== 2.4 ||
    candidate.projectSelection.courtyard.widthMm !== 1.3
  ) {
    errors.push("ERA3A project copper, mask, paste, or courtyard geometry drifted")
  }
  if (
    JSON.stringify(candidate.terminals) !==
      JSON.stringify([
        { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
        { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
      ]) ||
    candidate.orientation.state !== "pending-review" ||
    candidate.orientation.polarity !== "non-polar" ||
    candidate.orientation.pinOne !== "not-applicable" ||
    candidate.orientation.assemblyRotationDeg !== null ||
    candidate.orientation.rotationEquivalence !== "180-degree rotationally equivalent"
  ) {
    errors.push("ERA3A non-polar terminal or orientation disposition drifted")
  }
  if (
    candidate.projectFootprint.pads.length !== 2 ||
    candidate.projectFootprint.pads[0]?.xMm !== -projectCopperPadCenterXMm ||
    candidate.projectFootprint.pads[0]?.yMm !== 0 ||
    candidate.projectFootprint.pads[0]?.widthMm !== 0.8 ||
    candidate.projectFootprint.pads[0]?.heightMm !== 0.9 ||
    candidate.projectFootprint.pads[1]?.xMm !== projectCopperPadCenterXMm ||
    candidate.projectFootprint.pads[1]?.yMm !== 0 ||
    candidate.projectFootprint.pads[1]?.widthMm !== 0.8 ||
    candidate.projectFootprint.pads[1]?.heightMm !== 0.9 ||
    candidate.projectFootprint.courtyard.lengthMm !== 2.4 ||
    candidate.projectFootprint.courtyard.widthMm !== 1.3 ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.projectFootprint.accepted
  ) {
    errors.push("ERA3A rendered project footprint geometry or deny state drifted")
  }
  if (
    candidate.artwork.sha256 !== artworkSha256 ||
    !/^[0-9A-F]{64}$/u.test(candidate.artwork.sha256) ||
    candidate.artwork.authority !== "deny" ||
    candidate.authority.manufacturerCadImported ||
    candidate.authority.independentOrientationAccepted ||
    candidate.authority.projectArtworkAccepted ||
    candidate.authority.fabricationAuthorized ||
    candidate.authority.releaseState !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("ERA3A explicit CAD, artwork, orientation, fabrication, and release gates must remain denied")
  }
  return errors
}

export interface BenchPrototypeEra3aProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

const projectFootprint = (
  <footprint name="BP031_ERA3AEB2491V_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.8mm"
      height="0.9mm"
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.8mm"
      height="0.9mm"
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    {/* Review-only courtyard; this is not a manufacturer-CAD layer. */}
    <courtyardrect pcbX={0} pcbY={0} width="2.4mm" height="1.3mm" strokeWidth="0.05mm" />
  </footprint>
)

export function BenchPrototypeEra3aProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeEra3aProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="R_BP031_ERA3AEB2491V"
      manufacturerPartNumber="ERA3AEB2491V"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeEra3aProjectFootprint
