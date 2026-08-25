import type { ReactElement } from "react"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-031 Murata evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-031 Murata evidence may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (
      !Array.isArray(actual) ||
      !Array.isArray(expected) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype ||
      actual.length !== expected.length
    ) {
      return false
    }
  } else if (!isPlainRecord(actual) || !isPlainRecord(expected)) {
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
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

function assertDataGraphShape(actual: unknown, expected: unknown, seen = new WeakSet<object>()): void {
  if (typeof expected !== "object" || expected === null) {
    if (typeof actual !== typeof expected || (expected === null ? actual !== null : actual === null)) {
      throw new RangeError("Murata candidate primitive shape drift")
    }
    return
  }
  if (actual === null || typeof actual !== "object") throw new RangeError("Murata candidate object shape drift")
  if (seen.has(actual) || seen.has(expected)) throw new RangeError("Murata candidate graph cycle or alias")
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected))
    throw new RangeError("Murata candidate prototype drift")

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) throw new RangeError("Murata candidate array shape drift")

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    !actualArray &&
    (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key)))
  ) {
    throw new RangeError("Murata candidate hidden or symbol property drift")
  }
  seen.add(actual)
  seen.add(expected)
  try {
    for (const key of actualKeys) {
      if (typeof key === "symbol") throw new RangeError("Murata candidate symbol property drift")
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      if (
        actualDescriptor === undefined ||
        !("value" in actualDescriptor) ||
        expectedDescriptor === undefined ||
        (expectedDescriptor !== undefined &&
          (!("value" in expectedDescriptor) || actualDescriptor.enumerable !== expectedDescriptor.enumerable))
      ) {
        throw new RangeError(`Murata candidate accessor or descriptor drift at ${String(key)}`)
      }
      if (expectedDescriptor !== undefined && "value" in expectedDescriptor) {
        assertDataGraphShape(actualDescriptor.value, expectedDescriptor.value, seen)
      }
    }
  } finally {
    seen.delete(actual)
    seen.delete(expected)
  }
}

const projectCopperPadLengthMm = 0.7
const projectCopperPadWidthMm = 1.3
const projectCopperPadGapMm = 1.2
const projectOverallLandSpanMm = Number((projectCopperPadGapMm + 2 * projectCopperPadLengthMm).toFixed(3))
const projectCopperPadCenterXMm = Number(((projectCopperPadGapMm + projectCopperPadLengthMm) / 2).toFixed(3))
const projectSolderMaskMarginMm = 0.05
const projectSolderMaskOpeningLengthMm = Number((projectCopperPadLengthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectSolderMaskOpeningWidthMm = Number((projectCopperPadWidthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectPasteReductionPerEdgeMm = 0.05
const projectPasteOpeningLengthMm = Number((projectCopperPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((projectCopperPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectCourtyardLengthMm = 3.1
const projectCourtyardWidthMm = 1.9
const projectCourtyardClearanceMm = 0.25

const integrationBasisCommit = "c6a0723a719551c1632ff2eff5b528409b4cac57"
const canonicalSourceSha256 = "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB"
const retainedMurataSourceSha256 = "E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F"
const renderedGeometrySha256 = "0C97468EE0E3B398EAC314577D0C1D10AFBE7AC0A064B4DC1862935190C7C15D"

const affectedReferences = ["C_REF_1", "C_REF_2", "C_REF_3", "C_REF_4", "C_REF_5", "C_REF_6", "C_REF_7"] as const

/**
 * BP-031 review-only candidate for the exact Murata GRM21BR71A106KE51L
 * reference reservoir replicated as C_REF_1 through C_REF_7.
 *
 * Murata publishes package dimensions and reflow land guidance, but not a
 * finished PCB CAD footprint. Mask, paste, courtyard, and release state are
 * therefore explicit project-review inputs and remain denied.
 */
const candidateDefinition = {
  artifactKind: "bp031-murata-grm21br71a106ke51l-0805-candidate-footprint",
  workUnit: "BP-031",
  manufacturer: "Murata",
  manufacturerPartNumber: "GRM21BR71A106KE51L",
  sourceContract: "BP-101",
  role: "SAR reference reservoir",
  geometryAuthority: "project-review-input-not-manufacturer-cad",
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
    canonicalSourceReference: "C_REF",
    replicatedReferencePrefix: "C_REF_",
    manufacturer: "Murata",
    manufacturerPartNumber: "GRM21BR71A106KE51L",
    package: "0805 (2012M)",
    exactOrderableSourceId: "murata-grm21br71a106ke51-reference-sheet",
    landPatternSourceId: "murata-grm21br71a106ke51-reference-sheet",
    landPatternApplicability:
      "Applicable GRM21-family reflow land guidance is selected by the exact package row; it is not exact-orderable CAD or a released footprint.",
    sourceSha256: canonicalSourceSha256
  },
  sourceControl: {
    basisCommit: integrationBasisCommit,
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
        sha256: canonicalSourceSha256
      }
    ]
  },
  affectedReferences,
  primaryProductPageUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71A106KE51L",
  sources: [
    {
      id: "murata-grm21br71a106ke51-reference-sheet",
      authority: "manufacturer-primary",
      documentNumber: "GRM21BR71A106KE51-01",
      revision: "X",
      url: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf",
      reviewedPages: "1, 24-25",
      applicability: "exact-orderable-identity-package-and-electrical",
      pagePurposes: {
        exactOrderableIdentityPackageAndElectrical: "1",
        familyReflowLandGuidance: "25",
        stressAndPlacementWarnings: "24-25"
      },
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf",
      sha256: retainedMurataSourceSha256,
      scope:
        "Page 1 binds exact GRM21BR71A106KE51L identity, package dimensions, and electrical rating. Page 25 supplies applicable GRM21-family reflow guidance; it is not an exact-orderable CAD object.",
      role: "Exact GRM21BR71A106KE51L identity and package/electrical data, with separately scoped GRM21-family reflow guidance."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    availability: "not-confirmed",
    retainedArtifactPath: null,
    sha256: null,
    disposition: "not-acquired-no-substitute",
    note: "Murata CAD was not acquired or retained for this exact MPN. No generic 0805 CAD is represented as Murata geometry."
  },
  package: {
    designation: "GRM21 (2012M / 0805)",
    packageCode: "21",
    lengthMm: { nominal: 2, plus: 0.15, minus: 0.15 },
    widthMm: { nominal: 1.25, plus: 0.15, minus: 0.15 },
    thicknessMm: { nominal: 1.25, plus: 0.15, minus: 0.15 },
    terminalLengthMm: { minimum: 0.2, maximum: 0.7 },
    terminalGapMm: { minimum: 0.7 }
  },
  electrical: {
    nominalCapacitanceUf: 10,
    tolerancePercent: 10,
    dielectric: "X7R",
    ratedVoltageVdc: 10,
    operatingTemperatureC: { minimum: -55, maximum: 125 }
  },
  manufacturerLandPattern: {
    designation: "Murata GRM21 reflow land guidance",
    sourceScope: "applicable manufacturer GRM21-family reflow guidance only, not exact-orderable CAD",
    applicability:
      "Applicable GRM21-family reflow guidance for the 2.0 x 1.25 mm (±0.15) package row; not exact-orderable CAD or a released footprint.",
    sourceId: "murata-grm21br71a106ke51-reference-sheet",
    reviewedPage: 25,
    sourceTable: "Table 2 Reflow Soldering Method",
    chipDimensionRow: "2.0 x 1.25 mm (±0.15)",
    chipDimensionTolerance: "±0.15",
    innerGapMm: { minimum: 1.2, maximum: 1.2 },
    padLengthMm: { minimum: 0.6, maximum: 0.8 },
    padWidthMm: { minimum: 1.2, maximum: 1.4 },
    note: "Murata asks that the suitable land dimension be confirmed on the actual set and PCB; this is not manufacturer CAD."
  },
  projectSelection: {
    solderingMethod: "reflow",
    authority: "project-review-input-derived-from-applicable-Murata-family-guidance",
    rationale:
      "Midpoint selection within Murata's exact GRM21 2.0 x 1.25 mm (±0.15) reflow row: a=1.2 mm inner gap, b=0.7 mm pad length, and c=1.3 mm pad width.",
    manufacturerParameterSelectionMm: { aInnerGap: 1.2, bPadLength: 0.7, cPadWidth: 1.3 },
    copperPad: { lengthMm: projectCopperPadLengthMm, widthMm: projectCopperPadWidthMm },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: projectSolderMaskOpeningLengthMm,
      openingWidthMm: projectSolderMaskOpeningWidthMm,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      derivation:
        "0.7 mm x 1.3 mm project copper plus 2 x 0.05 mm project mask margin per axis; Murata does not publish a finished NSMD expansion for this candidate.",
      status: "project-input"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      derivation:
        "0.7 mm x 1.3 mm project copper minus 2 x 0.05 mm project paste reduction per axis; Murata does not publish a finished stencil aperture for this candidate.",
      status: "project-input"
    },
    courtyard: {
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      minimumClearanceMm: projectCourtyardClearanceMm,
      derivation:
        "max(2.30 mm maximum package length, 2.60 mm selected copper span) + 2 x 0.25 mm; max(1.40 mm maximum package width, 1.30 mm selected pad width) + 2 x 0.25 mm.",
      sourceStatus: "not-published",
      status: "project-review-input"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
  ],
  orientation: {
    state: "non-polar",
    assemblyRotationDeg: null,
    datum: "local two-terminal axis",
    pinOne: "not-applicable",
    note: "Murata's ceramic capacitor is non-polar. No pin-one, cathode, anode, or assembly rotation is asserted; rotation is electrically equivalent, subject to independent placement and stress review."
  },
  stressOrientationReview: {
    state: "pending-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    ratedVoltageVdc: 10,
    nominalApplicationRailVdc: 2.5,
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    dcBiasEvidence: "not-retained",
    note: "The exact Murata reference sheet supplies the electrical rating and package dimensions, but effective capacitance under DC bias, placement stress, assembly clearance, and final orientation remain open."
  },
  placementReview: {
    state: "pending-independent-review",
    boardPlacementStatus: "not-reviewed",
    boardIntegrationAuthority: "deny",
    boardFitAccepted: false,
    edgeClearanceAccepted: false,
    assemblyClearanceAccepted: false,
    stressReviewAccepted: false,
    note: "No board-edge, neighboring-component, keepout, assembly-clearance, board-fit, or board-stress limit is published or accepted by this candidate."
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-not-manufacturer-cad",
    padShape: "rectangular-smt",
    pads: [
      { pad: "1", terminal: "A", xMm: -projectCopperPadCenterXMm, yMm: 0 },
      { pad: "2", terminal: "B", xMm: projectCopperPadCenterXMm, yMm: 0 }
    ],
    solderMask: {
      openingLengthMm: projectSolderMaskOpeningLengthMm,
      openingWidthMm: projectSolderMaskOpeningWidthMm,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      status: "project-review-input-not-manufacturer-specification"
    },
    orientation: {
      datum: "pad 1 at negative local X; pad 2 at positive local X",
      boardRotationDegrees: 0,
      pinOnePad: null,
      polarity: "non-polar"
    },
    placementStatus: "not-reviewed",
    boardIntegrationAuthority: "deny",
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: renderedGeometrySha256,
    authority: "deny"
  },
  acceptance: {
    packageIdentityReviewed: true,
    packageDrawingReviewed: true,
    familyLandGuidanceReviewed: true,
    projectGeometryAccepted: false,
    pinOneOrientationAccepted: false,
    placementAccepted: false,
    cadImportAccepted: false,
    boardFitAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const bp031MurataGrm21br71a106ke51l0805CandidateFootprintBaseline = deepFreeze(structuredClone(candidateDefinition))
export const bp031MurataGrm21br71a106ke51l0805CandidateFootprint = deepFreeze(candidateDefinition)

type Candidate = typeof candidateDefinition

function hasExpectedCandidateShape(value: unknown): value is Candidate {
  try {
    assertDataGraphShape(value, bp031MurataGrm21br71a106ke51l0805CandidateFootprintBaseline)
    return true
  } catch {
    return false
  }
}

const projectFootprint = (
  <footprint name="BP031_MURATA_GRM21BR71A106KE51L_0805_CANDIDATE" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["1", "A", "non-polar", "terminal-a"]}
    />
    <smtpad
      name="2"
      pcbX={projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["2", "B", "non-polar", "terminal-b"]}
    />
    {/* This review courtyard is project geometry, not Murata CAD. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardLengthMm}mm`}
      height={`${projectCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031MurataGrm21br71a106ke51l0805CandidateFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the seven-reference BP-031 review. */
export function Bp031MurataGrm21br71a106ke51l0805CandidateFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031MurataGrm21br71a106ke51l0805CandidateFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_MURATA_GRM21BR71A106KE51L"
      manufacturerPartNumber="GRM21BR71A106KE51L"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

/** Return exact review failures; an empty result means the denied record is internally consistent. */
export function validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(
  candidate: unknown = bp031MurataGrm21br71a106ke51l0805CandidateFootprint
): readonly string[] {
  if (!hasExpectedCandidateShape(candidate)) {
    return ["Murata GRM21 exact graph, descriptor, or deny-state drifted"]
  }
  const errors: string[] = []
  const source = candidate.sources[0]
  if (
    candidate.artifactKind !== "bp031-murata-grm21br71a106ke51l-0805-candidate-footprint" ||
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== "Murata" ||
    candidate.manufacturerPartNumber !== "GRM21BR71A106KE51L" ||
    candidate.sourceContract !== "BP-101" ||
    candidate.role !== "SAR reference reservoir" ||
    candidate.geometryAuthority !== "project-review-input-not-manufacturer-cad" ||
    candidate.primaryProductPageUrl !== "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71A106KE51L"
  ) {
    errors.push("exact BP-031 Murata GRM21BR71A106KE51L identity drifted")
  }
  if (
    candidate.sourceBinding.canonicalSourcePath !==
      "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts" ||
    candidate.sourceBinding.canonicalSourceReference !== "C_REF" ||
    candidate.sourceBinding.replicatedReferencePrefix !== "C_REF_" ||
    candidate.sourceBinding.manufacturer !== "Murata" ||
    candidate.sourceBinding.manufacturerPartNumber !== "GRM21BR71A106KE51L" ||
    candidate.sourceBinding.package !== "0805 (2012M)" ||
    candidate.sourceBinding.exactOrderableSourceId !== "murata-grm21br71a106ke51-reference-sheet" ||
    candidate.sourceBinding.landPatternSourceId !== "murata-grm21br71a106ke51-reference-sheet" ||
    candidate.sourceBinding.landPatternApplicability !==
      "Applicable GRM21-family reflow land guidance is selected by the exact package row; it is not exact-orderable CAD or a released footprint." ||
    candidate.sourceBinding.sourceSha256 !== canonicalSourceSha256 ||
    JSON.stringify(candidate.affectedReferences) !== JSON.stringify(affectedReferences)
  ) {
    errors.push("C_REF seven-reference source binding drifted")
  }
  if (
    candidate.sourceControl.basisCommit !== integrationBasisCommit ||
    candidate.sourceControl.upstreamSources.length !== 1 ||
    candidate.sourceControl.upstreamSources[0]?.path !== candidate.sourceBinding.canonicalSourcePath ||
    candidate.sourceControl.upstreamSources[0]?.sha256 !== canonicalSourceSha256
  ) {
    errors.push("BP-031 canonical source control binding drifted")
  }
  if (
    candidate.sources.length !== 1 ||
    source?.id !== "murata-grm21br71a106ke51-reference-sheet" ||
    source?.authority !== "manufacturer-primary" ||
    source?.documentNumber !== "GRM21BR71A106KE51-01" ||
    source?.revision !== "X" ||
    source?.url !== "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf" ||
    source?.reviewedPages !== "1, 24-25" ||
    source?.applicability !== "exact-orderable-identity-package-and-electrical" ||
    source?.pagePurposes.exactOrderableIdentityPackageAndElectrical !== "1" ||
    source?.pagePurposes.familyReflowLandGuidance !== "25" ||
    source?.pagePurposes.stressAndPlacementWarnings !== "24-25" ||
    source?.artifactPath !== "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf" ||
    source?.sha256 !== retainedMurataSourceSha256 ||
    source?.scope !==
      "Page 1 binds exact GRM21BR71A106KE51L identity, package dimensions, and electrical rating. Page 25 supplies applicable GRM21-family reflow guidance; it is not an exact-orderable CAD object."
  ) {
    errors.push("exact retained Murata GRM21 source is required")
  }
  for (const source of candidate.sources) {
    if (
      typeof source.sha256 !== "string" ||
      !/^[0-9A-F]{64}$/u.test(source.sha256) ||
      typeof source.artifactPath !== "string" ||
      source.artifactPath.length === 0
    ) {
      errors.push(`retained Murata source hash/path is invalid for ${source.id}`)
    }
  }
  if (
    candidate.package.designation !== "GRM21 (2012M / 0805)" ||
    candidate.package.packageCode !== "21" ||
    candidate.package.lengthMm.nominal !== 2 ||
    candidate.package.lengthMm.plus !== 0.15 ||
    candidate.package.lengthMm.minus !== 0.15 ||
    candidate.package.widthMm.nominal !== 1.25 ||
    candidate.package.widthMm.plus !== 0.15 ||
    candidate.package.widthMm.minus !== 0.15 ||
    candidate.package.thicknessMm.nominal !== 1.25 ||
    candidate.package.terminalLengthMm.minimum !== 0.2 ||
    candidate.package.terminalLengthMm.maximum !== 0.7 ||
    candidate.package.terminalGapMm.minimum !== 0.7
  ) {
    errors.push("Murata GRM21 0805 package dimensions drifted")
  }
  if (
    candidate.electrical.nominalCapacitanceUf !== 10 ||
    candidate.electrical.tolerancePercent !== 10 ||
    candidate.electrical.dielectric !== "X7R" ||
    candidate.electrical.ratedVoltageVdc !== 10 ||
    candidate.electrical.operatingTemperatureC.minimum !== -55 ||
    candidate.electrical.operatingTemperatureC.maximum !== 125
  ) {
    errors.push("Murata GRM21 electrical identity drifted")
  }
  if (
    candidate.manufacturerLandPattern.designation !== "Murata GRM21 reflow land guidance" ||
    candidate.manufacturerLandPattern.sourceScope !==
      "applicable manufacturer GRM21-family reflow guidance only, not exact-orderable CAD" ||
    candidate.manufacturerLandPattern.applicability !==
      "Applicable GRM21-family reflow guidance for the 2.0 x 1.25 mm (±0.15) package row; not exact-orderable CAD or a released footprint." ||
    candidate.manufacturerLandPattern.sourceId !== "murata-grm21br71a106ke51-reference-sheet" ||
    candidate.manufacturerLandPattern.reviewedPage !== 25 ||
    candidate.manufacturerLandPattern.sourceTable !== "Table 2 Reflow Soldering Method" ||
    candidate.manufacturerLandPattern.chipDimensionRow !== "2.0 x 1.25 mm (±0.15)" ||
    candidate.manufacturerLandPattern.chipDimensionTolerance !== "±0.15" ||
    candidate.manufacturerLandPattern.innerGapMm.minimum !== 1.2 ||
    candidate.manufacturerLandPattern.innerGapMm.maximum !== 1.2 ||
    candidate.manufacturerLandPattern.padLengthMm.minimum !== 0.6 ||
    candidate.manufacturerLandPattern.padLengthMm.maximum !== 0.8 ||
    candidate.manufacturerLandPattern.padWidthMm.minimum !== 1.2 ||
    candidate.manufacturerLandPattern.padWidthMm.maximum !== 1.4
  ) {
    errors.push("Murata GRM21 reflow land guidance drifted")
  }
  const selection = candidate.projectSelection
  if (
    selection.solderingMethod !== "reflow" ||
    selection.authority !== "project-review-input-derived-from-applicable-Murata-family-guidance" ||
    selection.manufacturerParameterSelectionMm.aInnerGap !== 1.2 ||
    selection.manufacturerParameterSelectionMm.bPadLength !== 0.7 ||
    selection.manufacturerParameterSelectionMm.cPadWidth !== 1.3 ||
    selection.copperPad.lengthMm !== projectCopperPadLengthMm ||
    selection.copperPad.widthMm !== projectCopperPadWidthMm ||
    selection.derivedCopperPadGapMm !== projectCopperPadGapMm ||
    selection.overallLandSpanMm !== projectOverallLandSpanMm ||
    selection.derivedCopperPadCenterXMm !== projectCopperPadCenterXMm ||
    selection.solderMask.openingLengthMm !== projectSolderMaskOpeningLengthMm ||
    selection.solderMask.openingWidthMm !== projectSolderMaskOpeningWidthMm ||
    selection.solderMask.marginPerEdgeMm !== projectSolderMaskMarginMm ||
    selection.solderMask.status !== "project-input" ||
    selection.paste.openingLengthMm !== projectPasteOpeningLengthMm ||
    selection.paste.openingWidthMm !== projectPasteOpeningWidthMm ||
    selection.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    selection.paste.status !== "project-input" ||
    selection.courtyard.lengthMm !== projectCourtyardLengthMm ||
    selection.courtyard.widthMm !== projectCourtyardWidthMm ||
    selection.courtyard.minimumClearanceMm !== projectCourtyardClearanceMm ||
    selection.courtyard.sourceStatus !== "not-published" ||
    selection.courtyard.status !== "project-review-input"
  ) {
    errors.push("Murata-derived project copper, mask, paste, or courtyard drifted")
  }
  if (
    JSON.stringify(candidate.terminals) !==
      JSON.stringify([
        { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
        { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
      ]) ||
    candidate.orientation.state !== "non-polar" ||
    candidate.orientation.datum !== "local two-terminal axis" ||
    candidate.orientation.pinOne !== "not-applicable" ||
    candidate.orientation.assemblyRotationDeg !== null ||
    candidate.stressOrientationReview.state !== "pending-review" ||
    candidate.stressOrientationReview.polarity !== "non-polar" ||
    candidate.stressOrientationReview.pinOne !== "not-applicable" ||
    candidate.stressOrientationReview.ratedVoltageVdc !== 10 ||
    candidate.stressOrientationReview.nominalApplicationRailVdc !== 2.5 ||
    candidate.stressOrientationReview.operatingTemperatureC.minimum !== -55 ||
    candidate.stressOrientationReview.operatingTemperatureC.maximum !== 125 ||
    candidate.stressOrientationReview.dcBiasEvidence !== "not-retained"
  ) {
    errors.push("Murata GRM21 non-polar orientation drifted")
  }
  if (
    candidate.placementReview.state !== "pending-independent-review" ||
    candidate.placementReview.boardPlacementStatus !== "not-reviewed" ||
    candidate.placementReview.boardIntegrationAuthority !== "deny" ||
    candidate.placementReview.boardFitAccepted ||
    candidate.placementReview.edgeClearanceAccepted ||
    candidate.placementReview.assemblyClearanceAccepted ||
    candidate.placementReview.stressReviewAccepted ||
    candidate.projectFootprint.state !== "review-only" ||
    candidate.projectFootprint.geometryAuthority !== "project-review-input-not-manufacturer-cad" ||
    candidate.projectFootprint.padShape !== "rectangular-smt" ||
    candidate.projectFootprint.pads.length !== 2 ||
    candidate.projectFootprint.pads[0]?.pad !== "1" ||
    candidate.projectFootprint.pads[0]?.terminal !== "A" ||
    candidate.projectFootprint.pads[0]?.xMm !== -projectCopperPadCenterXMm ||
    candidate.projectFootprint.pads[0]?.yMm !== 0 ||
    candidate.projectFootprint.pads[1]?.pad !== "2" ||
    candidate.projectFootprint.pads[1]?.terminal !== "B" ||
    candidate.projectFootprint.pads[1]?.xMm !== projectCopperPadCenterXMm ||
    candidate.projectFootprint.pads[1]?.yMm !== 0 ||
    candidate.projectFootprint.solderMask.openingLengthMm !== projectSolderMaskOpeningLengthMm ||
    candidate.projectFootprint.solderMask.openingWidthMm !== projectSolderMaskOpeningWidthMm ||
    candidate.projectFootprint.solderMask.marginPerEdgeMm !== projectSolderMaskMarginMm ||
    candidate.projectFootprint.solderMask.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectFootprint.paste.openingLengthMm !== projectPasteOpeningLengthMm ||
    candidate.projectFootprint.paste.openingWidthMm !== projectPasteOpeningWidthMm ||
    candidate.projectFootprint.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    candidate.projectFootprint.paste.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectFootprint.courtyard.centerMm.x !== 0 ||
    candidate.projectFootprint.courtyard.centerMm.y !== 0 ||
    candidate.projectFootprint.courtyard.lengthMm !== projectCourtyardLengthMm ||
    candidate.projectFootprint.courtyard.widthMm !== projectCourtyardWidthMm ||
    candidate.projectFootprint.courtyard.status !== "project-review-input-not-manufacturer-specification" ||
    candidate.projectFootprint.orientation.datum !== "pad 1 at negative local X; pad 2 at positive local X" ||
    candidate.projectFootprint.orientation.boardRotationDegrees !== 0 ||
    candidate.projectFootprint.orientation.pinOnePad !== null ||
    candidate.projectFootprint.orientation.polarity !== "non-polar" ||
    candidate.projectFootprint.placementStatus !== "not-reviewed" ||
    candidate.projectFootprint.boardIntegrationAuthority !== "deny" ||
    candidate.projectFootprint.releaseState !== "deny" ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.projectFootprint.accepted
  ) {
    errors.push("Murata project footprint or placement gate must remain denied")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.availability !== "not-confirmed" ||
    candidate.manufacturerCad.retainedArtifactPath !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.manufacturerCad.disposition !== "not-acquired-no-substitute" ||
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
    candidate.artwork.generator !== "tscircuit" ||
    candidate.artwork.generatorVersion !== "0.0.2271" ||
    candidate.artwork.sha256 !== renderedGeometrySha256 ||
    candidate.artwork.authority !== "deny" ||
    candidate.acceptance.packageIdentityReviewed !== true ||
    candidate.acceptance.packageDrawingReviewed !== true ||
    candidate.acceptance.familyLandGuidanceReviewed !== true ||
    candidate.acceptance.projectGeometryAccepted ||
    candidate.acceptance.pinOneOrientationAccepted ||
    candidate.acceptance.placementAccepted ||
    candidate.acceptance.cadImportAccepted ||
    candidate.acceptance.boardFitAccepted ||
    candidate.acceptance.fabricationAuthorized ||
    candidate.acceptance.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.accepted !== false
  ) {
    errors.push("Murata CAD uncertainty and fabrication denial must remain fail-closed")
  }
  if (errors.length === 0 && !sameDataGraph(candidate, bp031MurataGrm21br71a106ke51l0805CandidateFootprintBaseline)) {
    errors.push("Murata GRM21 exact graph, descriptor, or deny-state drifted")
  }
  return errors
}
