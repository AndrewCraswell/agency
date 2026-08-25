import { Fragment, type ReactElement } from "react"

/**
 * BP-031 review-only project footprint for the exact TI TPD4E05U06DQAR.
 *
 * The TI DQA0010A package drawing and land-pattern/stencil examples are
 * retained as primary evidence. The values below are a project rendering of
 * those examples, not an imported TI CAD release. All release authority stays
 * denied until orientation, board fit, artwork, and fabrication review pass.
 */

const packageBodyWidthMm = { minimum: 0.9, maximum: 1.1 } as const
const packageBodyLengthMm = { minimum: 2.4, maximum: 2.6 } as const
const packageHeightMaximumMm = 0.55
const padRowCenterMm = 0.835 / 2
const padPitchMm = 0.5
const padWidthMm = 0.565
const regularPadHeightMm = 0.2
const groundPadHeightMm = 0.4
const solderMaskMarginMm = 0.07
const centerPasteReductionPerEdgeMm = 0.02
const courtyardClearanceMm = 0.25

type PinFunction = "D1+" | "D1-" | "GND" | "D2+" | "D2-" | "NC"

type Pad = {
  readonly pin: number
  readonly name: PinFunction
  readonly xMm: number
  readonly yMm: number
  readonly copperWidthMm: number
  readonly copperHeightMm: number
  readonly solderPasteReductionPerEdgeMm: number
}

const pinFunctions: readonly { readonly pin: number; readonly name: PinFunction; readonly description: string }[] = [
  { pin: 1, name: "D1+", description: "ESD protected channel" },
  { pin: 2, name: "D1-", description: "ESD protected channel" },
  { pin: 3, name: "GND", description: "Ground; connect to ground" },
  { pin: 4, name: "D2+", description: "ESD protected channel" },
  { pin: 5, name: "D2-", description: "ESD protected channel" },
  { pin: 6, name: "NC", description: "Not connected; may be left floating or grounded" },
  { pin: 7, name: "NC", description: "Not connected; may be left floating or grounded" },
  { pin: 8, name: "GND", description: "Ground; connect to ground" },
  { pin: 9, name: "NC", description: "Not connected; may be left floating or grounded" },
  { pin: 10, name: "NC", description: "Not connected; may be left floating or grounded" }
] as const

const pads: readonly Pad[] = [
  {
    pin: 1,
    name: "D1+",
    xMm: -padRowCenterMm,
    yMm: -1,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 2,
    name: "D1-",
    xMm: -padRowCenterMm,
    yMm: -0.5,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 3,
    name: "GND",
    xMm: -padRowCenterMm,
    yMm: 0,
    copperWidthMm: padWidthMm,
    copperHeightMm: groundPadHeightMm,
    solderPasteReductionPerEdgeMm: centerPasteReductionPerEdgeMm
  },
  {
    pin: 4,
    name: "D2+",
    xMm: -padRowCenterMm,
    yMm: 0.5,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 5,
    name: "D2-",
    xMm: -padRowCenterMm,
    yMm: 1,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 6,
    name: "NC",
    xMm: padRowCenterMm,
    yMm: -1,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 7,
    name: "NC",
    xMm: padRowCenterMm,
    yMm: -0.5,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 8,
    name: "GND",
    xMm: padRowCenterMm,
    yMm: 0,
    copperWidthMm: padWidthMm,
    copperHeightMm: groundPadHeightMm,
    solderPasteReductionPerEdgeMm: centerPasteReductionPerEdgeMm
  },
  {
    pin: 9,
    name: "NC",
    xMm: padRowCenterMm,
    yMm: 0.5,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  },
  {
    pin: 10,
    name: "NC",
    xMm: padRowCenterMm,
    yMm: 1,
    copperWidthMm: padWidthMm,
    copperHeightMm: regularPadHeightMm,
    solderPasteReductionPerEdgeMm: 0
  }
] as const

const packageEnvelope = {
  minimumXMm: -packageBodyWidthMm.maximum / 2,
  maximumXMm: packageBodyWidthMm.maximum / 2,
  minimumYMm: -packageBodyLengthMm.maximum / 2,
  maximumYMm: packageBodyLengthMm.maximum / 2
} as const

function envelopeForPads(padList: readonly Pad[]) {
  return {
    minimumXMm: Math.min(...padList.map(({ xMm, copperWidthMm }) => xMm - copperWidthMm / 2)),
    maximumXMm: Math.max(...padList.map(({ xMm, copperWidthMm }) => xMm + copperWidthMm / 2)),
    minimumYMm: Math.min(...padList.map(({ yMm, copperHeightMm }) => yMm - copperHeightMm / 2)),
    maximumYMm: Math.max(...padList.map(({ yMm, copperHeightMm }) => yMm + copperHeightMm / 2))
  }
}

const padEnvelope = envelopeForPads(pads)
const courtyard = {
  minimumXMm: Math.min(packageEnvelope.minimumXMm, padEnvelope.minimumXMm) - courtyardClearanceMm,
  maximumXMm: Math.max(packageEnvelope.maximumXMm, padEnvelope.maximumXMm) + courtyardClearanceMm,
  minimumYMm: Math.min(packageEnvelope.minimumYMm, padEnvelope.minimumYMm) - courtyardClearanceMm,
  maximumYMm: Math.max(packageEnvelope.maximumYMm, padEnvelope.maximumYMm) + courtyardClearanceMm
} as const

export const bp031Tpd4e05u06DqaProjectFootprintGeometry = {
  artifactKind: "bp031-tpd4e05u06-dqa-project-footprint",
  workUnit: "BP-031",
  reference: "U_ESD",
  affectedReferences: ["U_ESD_1", "U_ESD_2", "U_ESD_3", "U_ESD_4", "U_ESD_5", "U_ESD_6", "U_ESD_7"],
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TPD4E05U06DQAR",
  sourceContract: "BP-103",
  role: "connector-side ESD shunt",
  sources: [
    {
      id: "ti-tpd4e05u06-rev-o",
      authority: "manufacturer-primary",
      document: "TPDxE05U06 1, 4, 6 Channel ESD Protection Device for Super-Speed Interface, Rev. O",
      url: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
      reviewedPages: "4, 20, 28-30, 37",
      pagePurposes: {
        pinMapAndFunctions: "4",
        exactOrderableAndPackage: "20, 37",
        dqaOutlineLandPatternAndStencil: "28-30"
      },
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf",
      sha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6"
    }
  ],
  sourceControl: {
    basisCommit: "fa5c88429e3ae16da0c17023d20408f383b8d2f9",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
        sha256: "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144"
      }
    ]
  },
  package: {
    designation: "DQA0010A USON-10",
    packageType: "USON",
    bodyWidthMm: packageBodyWidthMm,
    bodyLengthMm: packageBodyLengthMm,
    maximumHeightMm: packageHeightMaximumMm,
    pitchMm: padPitchMm,
    rowCenterSpanMm: 0.835,
    pinCount: 10,
    exposedGroundPads: [3, 8]
  },
  pinFunctions,
  pinOne: {
    sourceDatum: "TI DQA0010A top-view top-left pin-one index area and optional pin-one ID",
    pin: 1,
    boardCoordinatesMm: { x: -padRowCenterMm, y: -1 },
    boardRotationDegrees: 0,
    orientationVerified: false,
    topViewOrdering: {
      pin1: "top-left",
      pin5: "bottom-left",
      pin6: "bottom-right",
      pin10: "top-right"
    }
  },
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    sha256: null,
    authority: "deny",
    note: "No TI-native CAD or external partner CAD artifact was acquired or retained; the package drawing and TI example land pattern are the only geometry sources."
  },
  projectSelection: {
    authority: "project-review-input-from-TI-DQA0010A-land-pattern-and-stencil-examples",
    copper: {
      padWidthMm,
      regularPadHeightMm,
      groundPadHeightMm,
      rowCenterSpanMm: 0.835,
      padPitchMm,
      pads
    },
    solderMask: {
      marginMm: solderMaskMarginMm,
      derivation: "TI non-solder-mask-defined preferred example, 0.07 mm maximum all around",
      regularOpeningMm: {
        width: padWidthMm + 2 * solderMaskMarginMm,
        height: regularPadHeightMm + 2 * solderMaskMarginMm
      },
      groundOpeningMm: {
        width: padWidthMm + 2 * solderMaskMarginMm,
        height: groundPadHeightMm + 2 * solderMaskMarginMm
      }
    },
    solderPaste: {
      stencilThicknessMm: 0.1,
      regularOpeningMm: { width: padWidthMm, height: regularPadHeightMm },
      groundOpeningMm: {
        width: padWidthMm - 2 * centerPasteReductionPerEdgeMm,
        height: groundPadHeightMm - 2 * centerPasteReductionPerEdgeMm
      },
      derivation:
        "TI stencil example retains 0.565 mm width, 0.2 mm regular height, and 0.36 mm ground-pad height; the tscircuit review rendering uses a symmetric 0.02 mm project reduction on ground pads.",
      status: "project-review-input"
    },
    courtyard: {
      ...courtyard,
      minimumClearanceMm: courtyardClearanceMm,
      derivation: "maximum of TI package envelope and rendered copper envelope plus 0.25 mm project clearance",
      status: "project-review-input"
    }
  },
  terminals: pads,
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "15706D98382BA8B1C0BB569AE04A34B2AEEAA665C2EB69CA1063D13ECDA6DCC9",
    authority: "deny"
  },
  acceptance: {
    packageIdentityReviewed: true,
    packageDrawingReviewed: true,
    pinFunctionsReviewed: true,
    projectGeometryAccepted: false,
    pinOneOrientationAccepted: false,
    cadImportAccepted: false,
    boardFitAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const projectFootprint = (
  <footprint name="BP031_TPD4E05U06DQAR_PROJECT_FOOTPRINT" originalLayer="top">
    {pads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={String(pad.pin)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin={`${solderMaskMarginMm}mm`}
          solderPasteMargin={`-${pad.solderPasteReductionPerEdgeMm}mm`}
          width={`${pad.copperWidthMm}mm`}
          height={`${pad.copperHeightMm}mm`}
          portHints={[String(pad.pin), pad.name, `pin${pad.pin}`]}
        />
      </Fragment>
    ))}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${courtyard.maximumXMm - courtyard.minimumXMm}mm`}
      height={`${courtyard.maximumYMm - courtyard.minimumYMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031Tpd4e05u06DqaProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review component; no board imports this candidate. */
export function Bp031Tpd4e05u06DqaProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp031Tpd4e05u06DqaProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_TPD4E05U06DQAR"
      manufacturerPartNumber="TPD4E05U06DQAR"
      pinLabels={{
        pin1: "D1+",
        pin2: "D1-",
        pin3: "GND",
        pin4: "D2+",
        pin5: "D2-",
        pin6: "NC",
        pin7: "NC",
        pin8: "GND",
        pin9: "NC",
        pin10: "NC"
      }}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

type Evidence = typeof bp031Tpd4e05u06DqaProjectFootprintGeometry

/** Return invariant failures; a clean result does not grant fabrication authority. */
export function validateBp031Tpd4e05u06DqaProjectFootprint(
  evidence: Evidence = bp031Tpd4e05u06DqaProjectFootprintGeometry
): readonly string[] {
  const errors: string[] = []
  if (
    evidence.workUnit !== "BP-031" ||
    evidence.reference !== "U_ESD" ||
    evidence.manufacturer !== "Texas Instruments" ||
    evidence.manufacturerPartNumber !== "TPD4E05U06DQAR" ||
    evidence.sourceContract !== "BP-103"
  ) {
    errors.push("exact BP-031 TPD4E05U06DQAR identity drifted")
  }
  if (
    evidence.package.designation !== "DQA0010A USON-10" ||
    evidence.package.packageType !== "USON" ||
    evidence.package.pinCount !== 10 ||
    evidence.package.pitchMm !== 0.5 ||
    evidence.package.rowCenterSpanMm !== 0.835 ||
    evidence.package.bodyWidthMm.maximum !== 1.1 ||
    evidence.package.bodyLengthMm.maximum !== 2.6 ||
    evidence.package.maximumHeightMm !== 0.55
  ) {
    errors.push("DQA0010A package dimensions or pitch drifted")
  }
  const expectedFunctions = ["D1+", "D1-", "GND", "D2+", "D2-", "NC", "NC", "GND", "NC", "NC"]
  if (
    evidence.pinFunctions.length !== expectedFunctions.length ||
    evidence.pinFunctions.some((entry, index) => entry.pin !== index + 1 || entry.name !== expectedFunctions[index])
  ) {
    errors.push("DQA pin-function map drifted")
  }
  const candidatePads = evidence.projectSelection.copper.pads
  if (candidatePads.length !== 10 || evidence.terminals.length !== 10) {
    errors.push("DQA must have exactly ten pads and terminals")
  }
  const expectedPadGeometry = [
    { pin: 1, name: "D1+", xMm: -padRowCenterMm, yMm: -1, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    { pin: 2, name: "D1-", xMm: -padRowCenterMm, yMm: -0.5, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    {
      pin: 3,
      name: "GND",
      xMm: -padRowCenterMm,
      yMm: 0,
      copperHeightMm: groundPadHeightMm,
      pasteReductionMm: centerPasteReductionPerEdgeMm
    },
    { pin: 4, name: "D2+", xMm: -padRowCenterMm, yMm: 0.5, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    { pin: 5, name: "D2-", xMm: -padRowCenterMm, yMm: 1, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    { pin: 6, name: "NC", xMm: padRowCenterMm, yMm: -1, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    { pin: 7, name: "NC", xMm: padRowCenterMm, yMm: -0.5, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    {
      pin: 8,
      name: "GND",
      xMm: padRowCenterMm,
      yMm: 0,
      copperHeightMm: groundPadHeightMm,
      pasteReductionMm: centerPasteReductionPerEdgeMm
    },
    { pin: 9, name: "NC", xMm: padRowCenterMm, yMm: 0.5, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 },
    { pin: 10, name: "NC", xMm: padRowCenterMm, yMm: 1, copperHeightMm: regularPadHeightMm, pasteReductionMm: 0 }
  ] as const
  for (const expected of expectedPadGeometry) {
    const pad = candidatePads.find(({ pin }) => pin === expected.pin)
    if (
      pad === undefined ||
      pad.name !== expected.name ||
      pad.xMm !== expected.xMm ||
      pad.yMm !== expected.yMm ||
      pad.copperWidthMm !== padWidthMm ||
      pad.copperHeightMm !== expected.copperHeightMm ||
      pad.solderPasteReductionPerEdgeMm !== expected.pasteReductionMm
    ) {
      errors.push(`pad ${expected.pin} identity or geometry drifted`)
    }
  }
  if (
    evidence.terminals.length !== candidatePads.length ||
    evidence.terminals.some((terminal, index) => {
      const candidate = candidatePads[index]
      return (
        candidate === undefined ||
        terminal.pin !== candidate.pin ||
        terminal.name !== candidate.name ||
        terminal.xMm !== candidate.xMm ||
        terminal.yMm !== candidate.yMm ||
        terminal.copperWidthMm !== candidate.copperWidthMm ||
        terminal.copperHeightMm !== candidate.copperHeightMm
      )
    })
  ) {
    errors.push("DQA terminal ledger does not match pad ledger")
  }
  if (
    evidence.pinOne.pin !== 1 ||
    evidence.pinOne.boardCoordinatesMm.x !== -padRowCenterMm ||
    evidence.pinOne.boardCoordinatesMm.y !== -1 ||
    evidence.pinOne.boardRotationDegrees !== 0 ||
    evidence.pinOne.orientationVerified ||
    evidence.pinOne.topViewOrdering.pin1 !== "top-left" ||
    evidence.pinOne.topViewOrdering.pin5 !== "bottom-left" ||
    evidence.pinOne.topViewOrdering.pin6 !== "bottom-right" ||
    evidence.pinOne.topViewOrdering.pin10 !== "top-right"
  ) {
    errors.push("DQA pin-one datum or review state drifted")
  }
  if (
    evidence.manufacturerCad.state !== "not-acquired" ||
    evidence.manufacturerCad.artifactPath !== null ||
    evidence.manufacturerCad.sha256 !== null ||
    evidence.manufacturerCad.authority !== "deny"
  ) {
    errors.push("DQA manufacturer CAD must remain explicitly unacquired and denied")
  }
  const source = evidence.sources[0]
  if (
    evidence.sources.length !== 1 ||
    source === undefined ||
    source.id !== "ti-tpd4e05u06-rev-o" ||
    source.authority !== "manufacturer-primary" ||
    source.reviewedPages !== "4, 20, 28-30, 37" ||
    source.pagePurposes.pinMapAndFunctions !== "4" ||
    source.pagePurposes.exactOrderableAndPackage !== "20, 37" ||
    source.pagePurposes.dqaOutlineLandPatternAndStencil !== "28-30" ||
    source.artifactPath !== "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf" ||
    source.sha256 !== "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6"
  ) {
    errors.push("retained TI primary source binding is incomplete")
  }
  if (
    evidence.projectSelection.copper.padWidthMm !== 0.565 ||
    evidence.projectSelection.copper.regularPadHeightMm !== 0.2 ||
    evidence.projectSelection.copper.groundPadHeightMm !== 0.4 ||
    evidence.projectSelection.copper.rowCenterSpanMm !== 0.835 ||
    evidence.projectSelection.copper.padPitchMm !== 0.5 ||
    evidence.projectSelection.solderMask.marginMm !== 0.07 ||
    evidence.projectSelection.solderMask.regularOpeningMm.width !== 0.705 ||
    evidence.projectSelection.solderMask.regularOpeningMm.height !== 0.34 ||
    evidence.projectSelection.solderMask.groundOpeningMm.width !== 0.705 ||
    evidence.projectSelection.solderMask.groundOpeningMm.height !== 0.54 ||
    Math.abs(evidence.projectSelection.solderPaste.groundOpeningMm.width - 0.525) > 1e-12 ||
    Math.abs(evidence.projectSelection.solderPaste.groundOpeningMm.height - 0.36) > 1e-12 ||
    evidence.projectSelection.courtyard.minimumXMm !== -0.95 ||
    evidence.projectSelection.courtyard.maximumXMm !== 0.95 ||
    evidence.projectSelection.courtyard.minimumYMm !== -1.55 ||
    evidence.projectSelection.courtyard.maximumYMm !== 1.55
  ) {
    errors.push("DQA project copper, mask, paste, or courtyard derivation drifted")
  }
  if (
    evidence.acceptance.projectGeometryAccepted ||
    evidence.acceptance.pinOneOrientationAccepted ||
    evidence.acceptance.cadImportAccepted ||
    evidence.acceptance.boardFitAccepted ||
    evidence.acceptance.fabricationAuthorized ||
    evidence.acceptance.releaseState !== "deny" ||
    evidence.artwork.authority !== "deny"
  ) {
    errors.push("DQA candidate must remain fabrication-denied")
  }
  return errors
}

export default Bp031Tpd4e05u06DqaProjectFootprint
