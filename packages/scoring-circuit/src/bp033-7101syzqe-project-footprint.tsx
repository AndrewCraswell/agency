import { Fragment, type ReactElement } from "react"

const manufacturerPartNumber = "7101SYZQE"
const manufacturerProductUrl = "https://www.ckswitches.com/products/switches/product-details/Toggle/7000/7101SYZQE/"
const manufacturerDatasheetUrl = "https://www.ckswitches.com/media/1394/7000toggle.pdf"
const retainedDatasheetPath = "docs/evidence/bp-033/ck-7000toggle-7101syzqe-datasheet.pdf"
const retainedDatasheetSha256 = "81C507AE655CBF893635F3E0ED421734A28AF08C975A8279E02070FFDCD353CB"

const panelCutoutDiameterMm = 6.35
const bodyWidthMm = 6.86
const bodyHeightMm = 12.7
const terminalPitchMm = 4.7
const terminalWidthMm = 2.03
const terminalThicknessMm = 0.76

type SwitchPosition = "POS. 1" | "POS. 2" | "POS. 3"

type Terminal = {
  readonly terminal: 1 | 2 | 3
  readonly yMm: number
  readonly sourcePosition: SwitchPosition
  readonly role: "throw" | "common"
}

const terminals: readonly Terminal[] = [
  { terminal: 1, yMm: -terminalPitchMm, sourcePosition: "POS. 1", role: "throw" },
  { terminal: 2, yMm: 0, sourcePosition: "POS. 2", role: "common" },
  { terminal: 3, yMm: terminalPitchMm, sourcePosition: "POS. 3", role: "throw" }
] as const

const connectedTerminalsByPosition = [
  { position: "POS. 1" as const, function: "ON" as const, connected: [2, 3] as const },
  { position: "POS. 2" as const, function: "NONE" as const, connected: [] as const },
  { position: "POS. 3" as const, function: "ON" as const, connected: [2, 1] as const }
] as const

const expectedSources = [
  {
    authority: "manufacturer-primary",
    document: "C&K 7000 Series product page",
    reviewedSections: "7101SYZQE configuration, panel mounting, cutout, actuator, and CAD status",
    conditionalClaims: {
      circuit: "On-On",
      seal: "Unsealed",
      termination: "Z solder lug",
      terminalSeal: "epoxy"
    },
    conflictDisposition:
      "The current official product page lists On-On and Unsealed, while its terminal specification separately lists epoxy. Those page fields conflict with the retained CM.10/15/24 datasheet for this exact orderable; the retained datasheet remains authoritative and the page fields stay conditional.",
    url: manufacturerProductUrl,
    retention: "unretained-live-page-conditional",
    exactMpnBinding:
      "The official product page is for 7101SYZQE; its panel and CAD claims remain conditional because no local snapshot was acquired."
  },
  {
    authority: "manufacturer-primary",
    document: "C&K 7000 Series miniature toggle switches datasheet",
    revision: "CM.10/15/24",
    currentUrlRevision: "CM.05/30/25",
    revisionDisposition:
      "Retained-byte revision is authoritative: the retained PDF bytes are CM.10/15/24. The mutable URL currently resolves to CM.05/30/25 and is recorded as revision drift, not substituted evidence.",
    reviewedPages: "1-4",
    drawingApplicability:
      "SPDT drawing and 7101 ordering/function tables; terminal numbers are reference numbers only.",
    url: manufacturerDatasheetUrl,
    artifactPath: retainedDatasheetPath,
    sha256: retainedDatasheetSha256
  }
] as const

const expectedCanonicalIdentity = {
  manufacturer: "C&K",
  manufacturerAliases: ["C&K Switches", "Littelfuse C&K"],
  manufacturerPartNumber,
  productFamily: "7000 Series miniature toggle switch",
  termination: "Z solder lug",
  sourceContract: "BP-033 S_SOURCE_SELECTOR"
} as const

const expectedConfiguration = {
  poles: 1,
  throws: 2,
  circuit: "SPDT",
  switchFunction: "On-None-On",
  contactMaterial: "silver (Q suffix)",
  electricalRating: "5 A at 120 V AC or 28 V DC; 2 A at 250 V AC",
  electricalLifeCycles: 100000,
  connectedTerminalsByPosition
} as const

const expectedTerminalNumbering = {
  sourceView: "C&K SPDT top view, terminal numbers for reference only",
  coordinateDatum: "bushing axis at (0, 0); component-side source view",
  numberingDirection: "terminal 1 is the lower throw, terminal 2 is the center common, terminal 3 is the upper throw",
  terminalPitchMm,
  terminalWidthMm,
  terminalThicknessMm,
  terminals
} as const

const expectedMounting = {
  mountingType: "panel mount, rear, threaded",
  bushingThread: "1/4-40 UNS-2A",
  bushingStyle: "0.350 inch high keyway bushing",
  bushingHeightMm: 8.89,
  panelCutout: {
    shape: "circular",
    diameterMm: panelCutoutDiameterMm,
    sourceDimension: "0.250 inch diameter",
    projectArtwork: "conditional-unretained-product-page review input; fabricator drill and panel stack-up not selected"
  },
  keyway: {
    includedBySource: true,
    angleDegrees: 25,
    widthMm: null,
    depthMm: null,
    disposition: "not rendered because C&K does not dimension the keyway width or depth in the retained drawing"
  }
} as const

const expectedActuator = {
  type: "standard round chrome-plated brass toggle",
  heightMm: 10.67,
  sourceDimension: "0.420 inch high",
  sourceViewOrientation: "lever extends toward negative X from the bushing axis",
  sourcePositions: {
    "POS. 1": "lever toward negative Y, ON, terminals 2-3 connected",
    "POS. 2": "lever centered, NONE, no terminals connected",
    "POS. 3": "lever toward positive Y, ON, terminals 2-1 connected"
  },
  artworkRotationDegrees: 0,
  boardPlacementRotationDegrees: null,
  orientationAccepted: false
} as const

const expectedManufacturerBody = {
  topViewWidthMm: bodyWidthMm,
  topViewHeightMm: bodyHeightMm,
  sideViewDimensionsMm: {
    actuatorToBushingDatumMm: 10.67,
    bushingToBodyDatumMm: 8.89,
    bodyToTerminalEndDatumMm: 8.89
  },
  terminalSeal: "epoxy"
} as const

const expectedProjectReviewArtwork = {
  coordinateConvention: "source top view; bushing axis at origin; terminals 1/2/3 at y=-4.70/0/+4.70 mm",
  artworkApproximation: {
    bodyAndTerminalPcbXMm: 0,
    disposition:
      "intentional Y-datum-only visual approximation; pcbX=0 centers body and terminal rectangles because the source does not provide source-accurate X placement for these review datums",
    sourceAccurateXPlacement: false,
    placementAuthority: "deny"
  },
  panelCutout: {
    primitive: "non-plated-hole",
    diameterMm: panelCutoutDiameterMm,
    authority: "conditional-unretained-product-page-review-input"
  },
  terminalLandings: {
    state: "not-selected",
    authority: "deny",
    reason:
      "The selected Z termination is a solder lug. C&K publishes no PCB land pattern, finished drill, copper, mask, or paste geometry for this exact termination."
  },
  bodySilkscreen: {
    state: "source-outline-review-only",
    widthMm: bodyWidthMm,
    heightMm: bodyHeightMm
  },
  courtyard: { state: "not-selected", authority: "deny" },
  boardPlacement: { state: "not-integrated", authority: "deny" }
} as const

const expectedAcceptance = {
  exactMpnReviewed: true,
  configurationReviewed: true,
  terminalNumberingReviewed: true,
  mountingCutoutReviewed: false,
  actuatorOrientationReviewed: true,
  manufacturerCadImportAccepted: false,
  terminalLandingsAccepted: false,
  panelPlacementAccepted: false,
  fitClearanceAccepted: false,
  mechanicalLoadAccepted: false,
  boardImportAccepted: false,
  releaseState: "deny",
  fabricationAuthorized: false
} as const

const expectedOrderableConstruction = {
  exactCode: "7101SYZQE",
  fields: {
    switchFunction: "7101",
    actuator: "S",
    bushing: "Y",
    termination: "Z",
    contactMaterial: "Q",
    seal: "E"
  },
  construction: "7101|S|Y|Z|Q|E",
  defaultFinishOmissions: {
    bushingFinish: "omitted: nickel on all bushings",
    actuatorFinish: "omitted: bright chrome"
  }
} as const

const expectedSourceRefdesConventionWarning = {
  state: "explicit-warning",
  warning:
    "S_SOURCE_SELECTOR is the project reference convention; C&K does not publish a source refdes. Datasheet terminal numbers are reference numbers only, not PCB pin-number authority.",
  resolution: "retain the S_ project reference and deny primitive/board integration until root review",
  primitiveDisposition:
    "The generic chip wrapper is retained for isolated artwork; the switch primitive is not introduced because its schematic/simulation behavior is outside this footprint slice."
} as const

const expectedFitClearance = {
  state: "not-reviewed",
  authority: "deny",
  reason:
    "No panel, board edge, enclosure, actuator travel, neighboring component, or service-access datum is in scope for this slice."
} as const

const expectedMechanicalLoad = {
  state: "not-reviewed",
  authority: "deny",
  reason:
    "Panel retention hardware, panel thickness, nut/washer stack, actuator force, and load path were not specified."
} as const

const expectedManufacturerCad = {
  state: "not-modeled-conditional",
  authority: "deny",
  sourceUrl: manufacturerProductUrl,
  reason:
    "The official product page is not retained locally; its statement that 7101SYZQE has not been modeled remains conditional. No native CAD or 3D model is retained."
} as const

/**
 * BP-033 review-only transcription for the exact C&K 7101SYZQE.
 *
 * The Z termination is a solder lug, not a manufacturer-published PCB land
 * pattern. The rendered artwork therefore shows only the source panel
 * cutout and source-outline datums on non-copper review layers. It is not a
 * board footprint release and is intentionally not imported by any board.
 */
export const bp0337101SyzqeProjectFootprintGeometry = {
  artifactKind: "bp033-7101syzqe-project-footprint",
  workUnit: "BP-033",
  reference: "S_SOURCE_SELECTOR",
  canonicalIdentity: expectedCanonicalIdentity,
  sources: expectedSources,
  orderableConstruction: expectedOrderableConstruction,
  configuration: expectedConfiguration,
  terminalNumbering: expectedTerminalNumbering,
  mounting: expectedMounting,
  actuator: expectedActuator,
  manufacturerBody: expectedManufacturerBody,
  sourceRefdesConventionWarning: expectedSourceRefdesConventionWarning,
  projectReviewArtwork: expectedProjectReviewArtwork,
  fitClearance: expectedFitClearance,
  mechanicalLoad: expectedMechanicalLoad,
  manufacturerCad: expectedManufacturerCad,
  acceptance: expectedAcceptance
} as const

function isEvidenceRecord(value: unknown): value is typeof bp0337101SyzqeProjectFootprintGeometry {
  return typeof value === "object" && value !== null && "canonicalIdentity" in value && "acceptance" in value
}

/** Fail closed if this isolated review record drifts from the exact source binding or deny state. */
export function validateBp0337101SyzqeProjectFootprintGeometry(
  value: unknown = bp0337101SyzqeProjectFootprintGeometry
): true {
  if (!isEvidenceRecord(value)) throw new RangeError("BP-033 7101SYZQE evidence must be an object")
  if (
    value.artifactKind !== "bp033-7101syzqe-project-footprint" ||
    value.workUnit !== "BP-033" ||
    value.reference !== "S_SOURCE_SELECTOR" ||
    JSON.stringify(value.canonicalIdentity) !== JSON.stringify(expectedCanonicalIdentity) ||
    JSON.stringify(value.sources) !== JSON.stringify(expectedSources) ||
    JSON.stringify(value.orderableConstruction) !== JSON.stringify(expectedOrderableConstruction) ||
    JSON.stringify(value.configuration) !== JSON.stringify(expectedConfiguration) ||
    JSON.stringify(value.terminalNumbering) !== JSON.stringify(expectedTerminalNumbering) ||
    JSON.stringify(value.mounting) !== JSON.stringify(expectedMounting) ||
    JSON.stringify(value.actuator) !== JSON.stringify(expectedActuator) ||
    JSON.stringify(value.manufacturerBody) !== JSON.stringify(expectedManufacturerBody) ||
    JSON.stringify(value.sourceRefdesConventionWarning) !== JSON.stringify(expectedSourceRefdesConventionWarning) ||
    JSON.stringify(value.projectReviewArtwork) !== JSON.stringify(expectedProjectReviewArtwork) ||
    JSON.stringify(value.fitClearance) !== JSON.stringify(expectedFitClearance) ||
    JSON.stringify(value.mechanicalLoad) !== JSON.stringify(expectedMechanicalLoad) ||
    JSON.stringify(value.manufacturerCad) !== JSON.stringify(expectedManufacturerCad) ||
    JSON.stringify(value.acceptance) !== JSON.stringify(expectedAcceptance)
  ) {
    throw new RangeError("BP-033 7101SYZQE source geometry or deny gates drifted")
  }
  return true
}

const projectFootprint = (
  <footprint name="BP033_7101SYZQE_REVIEW_ONLY" originalLayer="top">
    <hole name="PANEL_CUTOUT_REVIEW" diameter={`${panelCutoutDiameterMm}mm`} pcbX={0} pcbY={0} />
    <silkscreencircle pcbX={0} pcbY={0} radius={`${panelCutoutDiameterMm / 2}mm`} strokeWidth="0.1mm" />
    {/* pcbX=0 is an intentional Y-datum-only review approximation, not source-accurate X placement. */}
    <silkscreenrect
      pcbX={0}
      pcbY={0}
      width={`${bodyWidthMm}mm`}
      height={`${bodyHeightMm}mm`}
      strokeWidth="0.1mm"
      filled={false}
    />
    {terminals.map((terminal) => (
      <Fragment key={terminal.terminal}>
        {/* Terminal rectangles share the bushing-axis X datum; placement remains denied. */}
        <silkscreenrect
          pcbX={0}
          pcbY={terminal.yMm}
          width={`${terminalWidthMm}mm`}
          height={`${terminalThicknessMm}mm`}
          strokeWidth="0.1mm"
          filled={false}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp0337101SyzqeProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review artwork; intentionally not imported by a board model. */
export function Bp0337101SyzqeProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp0337101SyzqeProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="S_BP033_SOURCE_SELECTOR"
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "1", pin2: "2", pin3: "3" }}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp0337101SyzqeProjectFootprint
