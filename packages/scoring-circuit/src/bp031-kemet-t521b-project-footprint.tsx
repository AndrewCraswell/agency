import type { ReactElement } from "react"

type PlainRecord = Record<PropertyKey, unknown>

const projectCopperPadLengthMm = 1
const projectCopperPadWidthMm = 2.2
const projectCopperPadGapMm = 1.9
const projectOverallLandSpanMm = Number((projectCopperPadGapMm + 2 * projectCopperPadLengthMm).toFixed(3))
const projectCopperPadCenterXMm = Number(((projectCopperPadGapMm + projectCopperPadLengthMm) / 2).toFixed(3))
const projectSolderMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0.05
const projectSolderMaskOpeningLengthMm = Number((projectCopperPadLengthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectSolderMaskOpeningWidthMm = Number((projectCopperPadWidthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectPasteOpeningLengthMm = Number((projectCopperPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((projectCopperPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectCourtyardLengthMm = 4.2
const projectCourtyardWidthMm = 3.3
const projectCourtyardClearanceMm = 0.15

const integrationBasisCommit = "c6a0723a719551c1632ff2eff5b528409b4cac57"
const canonicalReadinessSourceSha256 = "496D8727B33209C03B31F2B1F203397C7CAB364F40D00EDF2EC8B1BDF227E55D"
const m404SourceRegistrySha256 = "298F04737136BA41B9F909ECF838342DF5D2DA1173778BD42A64AC0048D9E9CE"
const retainedKemetSourceSha256 = "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD"
const renderedGeometrySha256 = "43EBA95B452F5F82802DC15C153A4E2555D591177A216923D3E2A1CFA8F3B3A1"

const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf"
const sourceRegistryPath = "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts"
const canonicalSourcePath = "packages/scoring-circuit/src/one-channel-analog-readiness.ts"

const affectedReferences = [
  "C_REF_REG_1",
  "C_REF_REG_2",
  "C_REF_REG_3",
  "C_REF_REG_4",
  "C_REF_REG_5",
  "C_REF_REG_6",
  "C_REF_REG_7"
] as const

function isPlainRecord(value: unknown): value is PlainRecord {
  try {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    )
  } catch {
    return false
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-031 KEMET evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-031 KEMET evidence may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/** Compare only own data descriptors so getters and proxy traps cannot forge evidence. */
function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  try {
    if (Object.is(actual, expected)) return true
    if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
      return false
    }
    if (seen.has(actual)) return seen.get(actual) === expected
    seen.set(actual, expected)

    const actualIsArray = Array.isArray(actual)
    if (actualIsArray !== Array.isArray(expected)) return false
    if (actualIsArray) {
      if (
        !Array.isArray(expected) ||
        Object.getPrototypeOf(actual) !== Array.prototype ||
        Object.getPrototypeOf(expected) !== Array.prototype
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
      if (typeof key === "symbol") return false
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      return (
        actualDescriptor !== undefined &&
        expectedDescriptor !== undefined &&
        "value" in actualDescriptor &&
        "value" in expectedDescriptor &&
        actualDescriptor.enumerable === expectedDescriptor.enumerable &&
        sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
      )
    })
  } catch {
    return false
  }
}

/**
 * BP-031 project land-pattern candidate for the exact KEMET polymer tantalum
 * capacitor used on the REF5025 local output. This isolated artifact is not
 * imported by a board model and does not grant fabrication or release
 * authority.
 */
const evidenceDefinition = {
  artifactKind: "bp031-kemet-t521b106m025ate100-project-footprint",
  workUnit: "BP-031",
  manufacturer: "KEMET",
  manufacturerPartNumber: "T521B106M025ATE100",
  sourceContract: "BP-101",
  role: "REF5025A-Q1 local output stabilization",
  geometryAuthority: "project-review-input-not-manufacturer-specification",
  sourceBinding: {
    canonicalSourcePath,
    canonicalSourceReference: "C_REF_REG",
    replicatedReferencePrefix: "C_REF_REG_",
    manufacturer: "KEMET",
    manufacturerPartNumber: "T521B106M025ATE100",
    package: "1411 / 3528 B case",
    requirementExport: "ref5025OutputCapacitorRequirement",
    sourceContract: "BP-101",
    sourceRegistryPath,
    sourceRegistryKey: "T521B106M025ATE100"
  },
  affectedReferences,
  primaryProductPageUrl: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
  sourceControl: {
    basisCommit: integrationBasisCommit,
    upstreamSources: [
      { path: canonicalSourcePath, sha256: canonicalReadinessSourceSha256 },
      { path: sourceRegistryPath, sha256: m404SourceRegistrySha256 }
    ]
  },
  sources: [
    {
      id: "M4-04:T521B106M025ATE100",
      authority: "manufacturer-primary",
      acquisition: "exact-drawing-hash-bound",
      artifactPath: sourceArtifactPath,
      sourceUrl: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
      drawingIdentifier: "KEMET T521, 1411/3528 manufacturer dimensions",
      reviewedPages: "1",
      pageEvidence: [
        {
          page: 1,
          claims: [
            "exact orderable T521B106M025ATE100 and 1411 / 3528 package identity",
            "cathode-negative and anode-positive end views",
            "package dimensions L 3.5 +/- 0.2 mm, W 2.8 +/- 0.2 mm, H 1.9 +/- 0.1 mm",
            "terminal dimensions S 0.8 +/- 0.3 mm, F 2.2 +/- 0.1 mm, A 1.9 mm minimum",
            "10 uF, 20%, 25 VDC at 105 C and 16.75 VDC at 125 C",
            "100 mOhm maximum ESR at 100 kHz and 25 C"
          ]
        }
      ],
      sha256: retainedKemetSourceSha256,
      scope:
        "Exact KEMET T521B106M025ATE100 product specsheet. Page 1 names the orderable, 1411 / 3528 B-case package, polarity end views, package dimensions, terminal dimensions, electrical rating, and ESR. It does not publish a PCB land pattern or manufacturer CAD."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "Manufacturer CAD was not acquired or retained for this exact orderable."
  },
  package: {
    designation: "1411 / 3528 B case",
    bodyLengthMm: { nominal: 3.5, plus: 0.2, minus: 0.2 },
    bodyWidthMm: { nominal: 2.8, plus: 0.2, minus: 0.2 },
    bodyHeightMm: { nominal: 1.9, plus: 0.1, minus: 0.1 },
    terminalLengthMm: { nominal: 0.8, plus: 0.3, minus: 0.3 },
    terminalWidthMm: { nominal: 2.2, plus: 0.1, minus: 0.1 },
    terminalGapMm: { minimum: 1.9 },
    capacitanceUf: 10,
    tolerancePercent: 20,
    dielectric: "polymer tantalum",
    ratedVoltageVdc: 25,
    ratedVoltageAt125CVdc: 16.75,
    esrMaximumOhms: 0.1,
    esrTestCondition: "100 kHz, 25 C",
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    terminals: 2
  },
  manufacturerLandPattern: {
    state: "not-published",
    sourceId: "M4-04:T521B106M025ATE100",
    reviewedPages: "1",
    sourceScope: "exact-part package drawing only",
    note: "The retained KEMET drawing describes component terminals but does not provide a PCB land-pattern recommendation or CAD."
  },
  projectSelection: {
    solderingMethod: "reflow",
    rationale:
      "Project-review copper uses the drawing's nominal terminal width F = 2.2 mm across the package and a 1.0 mm pad length along the terminal axis. The 1.0 mm length is a project selection within the drawing's S = 0.8 +/- 0.3 mm terminal-length envelope; the 1.9 mm copper gap meets the drawing's A = 1.9 mm minimum terminal-gap dimension without claiming manufacturer land guidance.",
    drawingInputsMm: {
      packageLengthNominal: 3.5,
      packageLengthMaximum: 3.7,
      packageWidthNominal: 2.8,
      packageWidthMaximum: 3,
      terminalLengthNominal: 0.8,
      terminalLengthTolerance: 0.3,
      terminalWidthNominal: 2.2,
      terminalWidthTolerance: 0.1,
      terminalGapMinimum: 1.9
    },
    projectCopperPad: {
      lengthMm: projectCopperPadLengthMm,
      widthMm: projectCopperPadWidthMm
    },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: projectSolderMaskOpeningLengthMm,
      openingWidthMm: projectSolderMaskOpeningWidthMm,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      derivation: "1.0 mm x 2.2 mm project copper plus 2 x 0.05 mm project mask margin per axis",
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      derivation: "1.0 mm x 2.2 mm project copper minus 2 x 0.05 mm project paste reduction per axis",
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      minimumClearanceMm: projectCourtyardClearanceMm,
      derivation:
        "max(3.7 mm maximum package length, 3.9 mm selected land span) plus 2 x 0.15 mm; max(3.0 mm maximum package width, 2.2 mm selected pad width) plus 2 x 0.15 mm",
      status: "project-review-input"
    }
  },
  terminals: [
    {
      pad: "1",
      terminal: "K",
      polarity: "cathode-negative",
      xMm: -projectCopperPadCenterXMm,
      yMm: 0,
      localDatum: "left pad in project top view",
      sourceDatum: "KEMET page 1 cathode (-) end view",
      numberingStatus: "project-local-datum-not-manufacturer-pin-number"
    },
    {
      pad: "2",
      terminal: "A",
      polarity: "anode-positive",
      xMm: projectCopperPadCenterXMm,
      yMm: 0,
      localDatum: "right pad in project top view",
      sourceDatum: "KEMET page 1 anode (+) end view",
      numberingStatus: "project-local-datum-not-manufacturer-pin-number"
    }
  ],
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-not-manufacturer-specification",
    padShape: "rectangular-smt",
    pads: [
      { pad: "1", terminal: "K", xMm: -projectCopperPadCenterXMm, yMm: 0 },
      { pad: "2", terminal: "A", xMm: projectCopperPadCenterXMm, yMm: 0 }
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
      minimumClearanceMm: projectCourtyardClearanceMm,
      status: "project-review-input"
    },
    orientationStatus: "pending-independent-review",
    fabricationAuthority: "deny",
    accepted: false
  },
  stressOrientationReview: {
    state: "pending-review",
    polarity: "polarized",
    pinOne:
      "pad 1 is the project-local cathode-negative datum; the manufacturer drawing does not establish a board-origin pin number",
    ratedVoltageVdc: 25,
    ratedVoltageAt125CVdc: 16.75,
    nominalApplicationRailVdc: 2.5,
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    dcBiasEvidence: "not-retained",
    sourcePolarityPage: 1,
    note: "The retained drawing shows separate cathode-negative and anode-positive end views, but it does not establish board-origin numbering or assembly rotation. Verify the polarity stripe, pad numbering, REF5025A-Q1 rail stress, derating, ripple, placement, and assembly clearance before acceptance."
  },
  orientation: {
    state: "pending-review",
    polarity: "polarized",
    sourceId: "M4-04:T521B106M025ATE100",
    sourcePage: 1,
    sourceViews: ["CATHODE (-) END VIEW", "ANODE (+) END VIEW", "BOTTOM VIEW"],
    assemblyRotationDeg: null,
    datum: "local project top-view polarity axis; pad 1 left is cathode-negative and pad 2 right is anode-positive",
    boardOriginNumbering: "not-established-by-manufacturer-source",
    independentReview: "pending",
    note: "The project candidate exposes a polarity datum and project-local pad numbering only; independent orientation, polarity-stripe, pin-number, placement, and assembly review remain open."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sourceGeometry: "projectSelection and projectFootprint fields in this artifact",
    renderedElements: [
      "pcb_smtpad:1",
      "pcb_smtpad:2",
      "pcb_solder_paste:1",
      "pcb_solder_paste:2",
      "pcb_courtyard_rect"
    ],
    sha256: renderedGeometrySha256,
    authority: "deny"
  },
  authority: {
    identityReconciled: true,
    manufacturerDrawingReviewed: false,
    manufacturerCadApproved: false,
    projectArtworkApproved: false,
    orientationApproved: false,
    footprintClosureAuthorized: false,
    schematicIntegrationAuthorized: false,
    procurementApproved: false,
    fabricationAuthorized: false,
    acceptanceState: "deny",
    releaseState: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const expectedEvidence = deepFreeze(structuredClone(evidenceDefinition))

export const benchPrototypeKemetT521bProjectFootprintGeometry = deepFreeze(evidenceDefinition)

/** Empty output means the private frozen deny-by-default baseline is exact. */
export function validateBenchPrototypeKemetT521bProjectFootprint(candidate?: unknown): readonly string[] {
  try {
    const value = arguments.length === 0 ? benchPrototypeKemetT521bProjectFootprintGeometry : candidate
    return sameDataGraph(value, expectedEvidence)
      ? []
      : ["BP-031 KEMET T521B106M025ATE100 source, geometry, orientation, or deny state drifted"]
  } catch {
    return ["BP-031 KEMET T521B106M025ATE100 candidate is not a safe data graph"]
  }
}

const projectFootprint = (
  <footprint name="BP031_KEMET_T521B106M025ATE100_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["1", "K", "cathode", "negative", "pin1"]}
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
      portHints={["2", "A", "anode", "positive", "pin2"]}
    />
    {/* This review courtyard is project geometry, not manufacturer CAD. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardLengthMm}mm`}
      height={`${projectCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface BenchPrototypeKemetT521bProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the BP-031 exact-capacitor review. */
export function BenchPrototypeKemetT521bProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeKemetT521bProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_KEMET_T521B106M025ATE100"
      manufacturerPartNumber="T521B106M025ATE100"
      pinLabels={{ pin1: "K", pin2: "A" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeKemetT521bProjectFootprint
