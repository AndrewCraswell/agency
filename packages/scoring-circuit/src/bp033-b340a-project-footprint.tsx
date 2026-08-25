import { Fragment, type ReactElement } from "react"

const sourceArtifactPath = "docs/evidence/bp-033/diodes-b340a-datasheet.pdf"
const sourceSha256 = "453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917"

const copperPadLengthMm = 2.5
const copperPadWidthMm = 1.7
const padCenterSpacingMm = 4
const padGapMm = 1.5
const overallCopperSpanMm = 6.5

const pads = [
  { id: "A", role: "anode", xMm: -2, yMm: 0 },
  { id: "K", role: "cathode", xMm: 2, yMm: 0 }
] as const

/**
 * BP-033 review-only copper transcription for the exact D_SOURCE_SELECTOR
 * orderable. The retained Diodes drawing does not publish CAD, paste, mask,
 * or courtyard data, so this isolated artifact intentionally emits no
 * courtyard and suppresses inferred paste apertures.
 */
export const bp033B340aProjectFootprintGeometry = {
  artifactKind: "bp033-b340a-project-footprint",
  workUnit: "BP-033",
  reference: "D_SOURCE_SELECTOR",
  manufacturer: "Diodes Incorporated",
  manufacturerPartNumber: "B340A-13-F",
  deviceFamily: "B340A",
  sources: [
    {
      authority: "manufacturer-primary",
      document: "B320A - B360A datasheet, DS30891 Rev. 19-2",
      reviewedPages: [1, 2, 6],
      drawingApplicability:
        "Page 1 identifies the B3XXA-13-F SMA orderable family and cathode-band polarity; page 2 identifies B340A electrical selection; page 6 gives the SMA outline and suggested pad layout.",
      url: "https://www.diodes.com/datasheet/download/B340A.pdf",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256
    }
  ],
  package: {
    designation: "SMA (DO-214AC)",
    terminalCount: 2,
    bodyDimensionsMm: {
      a: { min: 2.29, max: 2.92 },
      b: { min: 4, max: 4.6 },
      c: { min: 1.27, max: 1.63 },
      d: { min: 0.15, max: 0.31 },
      e: { min: 4.8, max: 5.59 },
      g: { min: 0.05, max: 0.2 },
      h: { min: 0.76, max: 1.52 },
      j: { min: 1.96, max: 2.4 }
    },
    sourceNote: "Diodes calls the package SMA; DO-214AC is the project package-family designation."
  },
  polarity: {
    sourceMarking: "Cathode band; a cathode notch may also be present",
    cathodePad: "K",
    anodePad: "A",
    sourcePage: 1,
    assemblyInspection: "Match the physical cathode band on the received B340A-13-F reel to pad K before placement."
  },
  landPattern: {
    coordinateFrame: "Package-center top view; +X right and +Y up",
    copper: {
      sourcePage: 6,
      padCount: 2,
      padLengthMm: copperPadLengthMm,
      padWidthMm: copperPadWidthMm,
      padCenterSpacingMm,
      padGapMm,
      overallSpanMm: overallCopperSpanMm,
      padCenters: pads
    },
    solderMask: {
      status: "not-published",
      renderedMarginMm: 0,
      disposition: "Zero-margin rendering is only a neutral review placeholder; no mask rule is accepted."
    },
    paste: {
      status: "not-published",
      disposition: "No paste aperture is inferred from the copper drawing; generated paste is suppressed."
    },
    courtyard: {
      status: "not-published",
      geometry: null,
      disposition: "Do not infer an assembly courtyard from the package outline."
    }
  },
  orientation: {
    boardRotationDegrees: 0,
    sourceView: "Diodes package top view and suggested pad layout",
    padIdentity: "A is anode and K is cathode; the package cathode band must face K.",
    orientationReviewState: "pending-independent-overlay",
    orientationAccepted: false
  },
  manufacturerCad: {
    state: "not-retained-official-cad",
    officialCadArtifact: null,
    reason:
      "The retained source is a datasheet PDF only; no Diodes native ECAD, footprint-library, or 3D CAD file is retained.",
    authority: "deny"
  },
  validation: {
    boardFit: { state: "not-performed", accepted: false },
    electrical: {
      state: "not-performed",
      accepted: false,
      reason:
        "A land-pattern transcription does not validate B340A current, surge, thermal, or source-selector behavior."
    }
  },
  acceptance: {
    packageDrawingReviewed: true,
    exactOrderableBound: true,
    polarityBound: true,
    manufacturerLandPatternTranscribed: true,
    projectGeometryAccepted: false,
    orientationAccepted: false,
    cadImportAccepted: false,
    boardImported: false,
    boardFitAccepted: false,
    electricalValidationAccepted: false,
    solderMaskAccepted: false,
    solderPasteAccepted: false,
    courtyardAccepted: false,
    releaseState: "deny",
    fabricationAuthorized: false
  }
} as const

/** Empty output means the exact identity, source geometry, and deny state remain intact. */
export function validateBp033B340aProjectFootprintGeometry(
  candidate: typeof bp033B340aProjectFootprintGeometry = bp033B340aProjectFootprintGeometry
): readonly string[] {
  const errors: string[] = []
  const source = candidate.sources[0]
  const copper = candidate.landPattern.copper
  if (
    candidate.artifactKind !== "bp033-b340a-project-footprint" ||
    candidate.workUnit !== "BP-033" ||
    candidate.reference !== "D_SOURCE_SELECTOR" ||
    candidate.manufacturer !== "Diodes Incorporated" ||
    candidate.manufacturerPartNumber !== "B340A-13-F" ||
    candidate.package.designation !== "SMA (DO-214AC)" ||
    candidate.package.terminalCount !== 2
  ) {
    errors.push("B340A identity or package drifted")
  }
  if (
    source === undefined ||
    source.authority !== "manufacturer-primary" ||
    source.artifactPath !== sourceArtifactPath ||
    source.sha256 !== sourceSha256 ||
    source.reviewedPages.join(",") !== "1,2,6"
  ) {
    errors.push("B340A retained manufacturer evidence drifted")
  }
  if (
    copper.padCount !== 2 ||
    copper.padLengthMm !== 2.5 ||
    copper.padWidthMm !== 1.7 ||
    copper.padCenterSpacingMm !== 4 ||
    copper.padGapMm !== 1.5 ||
    copper.overallSpanMm !== 6.5 ||
    copper.padCenters[0]?.id !== "A" ||
    copper.padCenters[0]?.xMm !== -2 ||
    copper.padCenters[1]?.id !== "K" ||
    copper.padCenters[1]?.xMm !== 2
  ) {
    errors.push("B340A manufacturer copper geometry drifted")
  }
  if (
    candidate.polarity.anodePad !== "A" ||
    candidate.polarity.cathodePad !== "K" ||
    candidate.orientation.orientationAccepted ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.validation.boardFit.accepted ||
    candidate.validation.electrical.accepted ||
    candidate.acceptance.projectGeometryAccepted ||
    candidate.acceptance.fabricationAuthorized ||
    candidate.acceptance.releaseState !== "deny"
  ) {
    errors.push("B340A polarity or deny state drifted")
  }
  return errors
}

const projectFootprint = (
  <footprint name="BP033_B340A_PROJECT_FOOTPRINT" originalLayer="top">
    {pads.map((pad) => (
      <Fragment key={pad.id}>
        <smtpad
          name={pad.id}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          width={`${copperPadLengthMm}mm`}
          height={`${copperPadWidthMm}mm`}
          solderMaskMargin="0mm"
          solderPasteMargin="-1mm"
          portHints={[pad.id, pad.role, pad.id === "A" ? "pin1" : "pin2"]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp033B340aProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated BP-033 review artifact; it is intentionally not imported by a board model. */
export function Bp033B340aProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp033B340aProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="D_BP033_SOURCE_SELECTOR"
      manufacturerPartNumber="B340A-13-F"
      pinLabels={{ pin1: "A", pin2: "K" }}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp033B340aProjectFootprint
