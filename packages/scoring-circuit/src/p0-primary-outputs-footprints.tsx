/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"

/**
 * P0 output footprint inputs.
 *
 * The exact orderable package identities and retained source hashes are
 * recorded here so the circuit cannot silently fall back to a similarly named
 * library footprint.  These are placement-review inputs only: fabrication
 * remains denied until the root reviewer accepts the complete board.
 */
export const p0PrimaryOutputsFootprintMetadata = Object.freeze({
  sourceDriver: {
    manufacturer: "Toshiba",
    manufacturerPartNumber: "TBD62783AFWG",
    package: "P-SOP18-0812-1.27-001 (SOL18)",
    pinCount: 18,
    pitchMm: 1.27,
    sourceUrl:
      "https://toshiba-semicon-storage.com/info/TBD62783AFNG_datasheet_en_20160511.pdf?did=30523&prodName=TBD62783AFNG",
    evidenceArtifact: "docs/evidence/p0-06/toshiba-tbd62783a-family-datasheet.pdf",
    evidenceSha256: "CA6F02A615FE6A1713BF98373B72B77B98B3F78D8F7F673277CBCA8EB1922C79",
    evidenceState: "evidence-complete-pending-root-placement-approval",
    packageDrawing: "P-SOP18-0812-1.27-001",
    exactVariantBinding: "TBD62783AFWG is the FWG row in the retained TBD62783A family drawing",
    padGeometry: {
      padCount: 18,
      padPitchMm: 1.27,
      padWidthMm: 1.6,
      padHeightMm: 0.6,
      rowCenterMm: 4.9,
      sourceBasis: "project transcription of Toshiba P-SOP18 package drawing"
    },
    orientation: "top view pin 1 at upper-left; pins 1-9 descend left and 10-18 ascend right",
    releaseState: "deny"
  },
  esdProtection: {
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TPD6E05U06RVZR",
    package: "USON RVZ, 14-pin",
    pinCount: 14,
    pitchMm: 0.5,
    sourceUrl: "https://www.ti.com/lit/ds/symlink/tpd6e05u06.pdf",
    evidenceArtifact: "docs/evidence/p0-06/ti-tpd6e05u06-datasheet.pdf",
    evidenceSha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
    evidenceState: "evidence-complete-pending-root-placement-approval",
    packageDrawing: "RVZ",
    padGeometry: {
      perimeterPadCount: 14,
      edgePadPitchMm: 0.5,
      perimeterPadWidthMm: 0.6,
      perimeterPadHeightMm: 0.25,
      sourceBasis: "project transcription of TI TPD6E05U06 RVZ top-view package drawing"
    },
    orientation: "top view pin 1 at upper-left; pins 1-7 across the top and 8-14 return across the bottom",
    releaseState: "deny"
  },
  primaryConnector: {
    manufacturer: "Molex",
    manufacturerPartNumber: "39-29-1067",
    package: "Mini-Fit Jr 2x3 through-hole header",
    pinCount: 6,
    pitchMm: 4.2,
    sourceUrl:
      "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/556/5569/039291067_sd.pdf",
    sourceMirror: "https://www.farnell.com/cad/2619715.pdf",
    evidenceArtifact: "docs/evidence/p0-06/molex-39-29-1067-drawing.pdf",
    evidenceSha256: "5F1CF7BA17009329350D2EAC32CDEDDCDB002F90B1E4563BDE13362A04EC6EFB",
    evidenceState: "evidence-complete-pending-root-placement-approval",
    padGeometry: {
      contactCount: 6,
      contactHoleDiameterMm: 1.8,
      contactHoleToleranceMm: 0.05,
      contactPitchMm: 4.2,
      contactRows: 2,
      contactCoordinatesMm: [
        [0, 0],
        [0, 4.2],
        [4.2, 0],
        [4.2, 4.2],
        [8.4, 0],
        [8.4, 4.2]
      ],
      mountingHoleDiameterMm: 3.2,
      sourceBasis: "Molex SD-5569-002 recommended PCB hole layout for six circuits"
    },
    sourceState: "official-drawing-retained; exact-six-contact-grid",
    orientation: "component-side circuit 1 datum follows Molex SD-5569-002; polarized header",
    releaseState: "deny"
  },
  lamp: {
    manufacturer: "Kingbright",
    package: "T-1 3/4 (5 mm) radial through-hole LED",
    pinCount: 2,
    pitchMm: 2.54,
    sourceUrl: "https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf",
    evidenceArtifacts: [
      {
        manufacturerPartNumber: "WP7113ID",
        artifact: "docs/evidence/p0-06/kingbright-wp7113id-datasheet.pdf",
        sha256: "B5BB33F69C13FD92AB6D47A8FD71168B6E7EE685139C8F381957AEEA9286C9DA"
      },
      {
        manufacturerPartNumber: "WP7113SGD",
        artifact: "docs/evidence/p0-06/kingbright-wp7113sgd-datasheet.pdf",
        sha256: "EB92D24EB3C4E9E7EB44BBD1729F83AD6381B5EA2935EC3AE711DAE005D75401"
      },
      {
        manufacturerPartNumber: "WP7113QWC/D",
        artifact: "docs/evidence/p0-06/kingbright-wp7113qwc-d-datasheet.pdf",
        sha256: "ED173DBAE5D58E84338E421458EFE8789E0E5F8AAA3191920534036EFD0E0120"
      }
    ],
    evidenceState: "evidence-complete-pending-root-placement-approval",
    packageDrawing: "T-1 3/4, 5 mm radial LED",
    padGeometry: { holeDiameterMm: 0.9, padDiameterMm: 1.8, leadPitchMm: 2.54 },
    orientation: "pin 1 anode and pin 2 cathode; cathode marking remains assembly-visible",
    releaseState: "deny"
  },
  buzzer: {
    manufacturer: "Same Sky",
    manufacturerPartNumber: "CMI-9605-0580T",
    package: "9.6 mm diameter through-hole magnetic indicator",
    pinCount: 2,
    pitchMm: 5,
    sourceUrl: "https://jp.sameskydevices.com/product/resource/cmi-9605-0580t.pdf",
    evidenceArtifact: "docs/evidence/p0-06/samesky-cmi-9605-0580t-datasheet.pdf",
    evidenceSha256: "857ED0E1055FFEEFAE4B48757042574BE86C80B878F396DA62168232BF08C6DB",
    evidenceState: "evidence-complete-pending-root-placement-approval",
    packageDrawing: "CMI-9605-0580T, Ø9.6 x 5 mm through-hole magnetic indicator",
    padGeometry: { holeDiameterMm: 0.8, padDiameterMm: 2, leadPitchMm: 5 },
    orientation: "positive terminal at local negative Y; negative terminal at local positive Y",
    releaseState: "deny"
  },
  supportPassives: [
    {
      referenceClass: "output-input-pulldown",
      manufacturerPartNumber: "RC0603FR-07100KL",
      package: "0603",
      orientation: "non-polar; rotation may follow placement escape",
      sourceState: "exact-BOM-MPN-generic-package-render",
      releaseState: "deny"
    },
    {
      referenceClass: "lamp-ballast",
      manufacturerPartNumber: "RC1206FR-07180RL",
      package: "1206",
      orientation: "non-polar; rotation may follow placement escape",
      sourceState: "exact-BOM-MPN-generic-package-render",
      releaseState: "deny"
    },
    {
      referenceClass: "shared-output-limiter",
      manufacturerPartNumber: "1206L020YR",
      package: "1206",
      orientation: "non-polar; rotation may follow placement escape",
      sourceState: "exact-BOM-MPN-generic-package-render",
      releaseState: "deny"
    }
  ]
} as const)

const driverPadPitchMm = 1.27
const driverPadYExtentMm = (8 * driverPadPitchMm) / 2
const driverRowCenterMm = 4.9

/** Exact orderable SOL18 pad numbering; no TSSOP/SSOP substitution is allowed. */
export const p0SourceDriverFootprint = (
  <footprint name="P0_TBD62783AFWG_P_SOP18_1P27_REVIEW" originalLayer="top">
    {Array.from({ length: 18 }, (_, index) => {
      const pin = index + 1
      const leftSide = pin <= 9
      const rowIndex = leftSide ? pin - 1 : 18 - pin
      return (
        <Fragment key={pin}>
          <smtpad
            name={`pin${pin}`}
            pcbX={leftSide ? -driverRowCenterMm : driverRowCenterMm}
            pcbY={
              leftSide
                ? rowIndex * driverPadPitchMm - driverPadYExtentMm
                : driverPadYExtentMm - rowIndex * driverPadPitchMm
            }
            shape="rect"
            width="1.6mm"
            height="0.6mm"
            solderMaskMargin="0.05mm"
            portHints={[`pin${pin}`]}
          />
        </Fragment>
      )
    })}
    <courtyardrect pcbX={0} pcbY={0} width="12.1mm" height="14.2mm" strokeWidth="0.05mm" />
  </footprint>
)

const esdPadPitchMm = 0.5
const esdPadXExtentMm = (6 * esdPadPitchMm) / 2

/** Exact orderable RVZ 14-pin USON perimeter pad numbering. */
export const p0EsdProtectionFootprint = (
  <footprint name="P0_TPD6E05U06RVZR_RVZ_USON14_REVIEW" originalLayer="top">
    {Array.from({ length: 14 }, (_, index) => {
      const pin = index + 1
      const topSide = pin <= 7
      const rowIndex = topSide ? pin - 1 : 14 - pin
      return (
        <Fragment key={pin}>
          <smtpad
            name={`pin${pin}`}
            pcbX={topSide ? rowIndex * esdPadPitchMm - esdPadXExtentMm : esdPadXExtentMm - rowIndex * esdPadPitchMm}
            pcbY={topSide ? -0.5 : 0.5}
            shape="rect"
            width="0.6mm"
            height="0.25mm"
            solderMaskMargin="0.07mm"
            solderPasteMargin="0mm"
            portHints={[`pin${pin}`]}
          />
        </Fragment>
      )
    })}
    <courtyardrect pcbX={0} pcbY={0} width="4.2mm" height="2.1mm" strokeWidth="0.05mm" />
  </footprint>
)

/** Placeable Molex six-contact grid from the retained SD-5569-002 drawing. */
const primaryConnectorContactGrid = [
  { xMm: 0, yMm: 0 },
  { xMm: 0, yMm: 4.2 },
  { xMm: 4.2, yMm: 0 },
  { xMm: 4.2, yMm: 4.2 },
  { xMm: 8.4, yMm: 0 },
  { xMm: 8.4, yMm: 4.2 }
] as const

export const p0PrimaryConnectorFootprint = (
  <footprint name="P0_MOLEX_39_29_1067_MINI_FIT_JR_REVIEW" originalLayer="top">
    {primaryConnectorContactGrid.map((hole, index) => (
      <Fragment key={index + 1}>
        <platedhole
          name={`pin${index + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={hole.xMm}
          pcbY={hole.yMm}
          holeDiameter="1.8mm"
          rectPadWidth="2.8mm"
          rectPadHeight="2.8mm"
          rectBorderRadius="1.4mm"
          solderMaskMargin="0.05mm"
          portHints={[`pin${index + 1}`]}
        />
      </Fragment>
    ))}
    <courtyardrect pcbX={4.2} pcbY={2.1} width="25.8mm" height="12.6mm" strokeWidth="0.05mm" />
  </footprint>
)

/** Kingbright T-1 3/4 through-hole lamp review landing. */
export const p0LampFootprint = (
  <footprint name="P0_KINGBRIGHT_T1_3_4_5MM_REVIEW" originalLayer="top">
    <platedhole
      name="pin1"
      shape="circular_hole_with_rect_pad"
      pcbX="-1.27mm"
      pcbY={0}
      holeDiameter="0.9mm"
      rectPadWidth="1.8mm"
      rectPadHeight="1.8mm"
      rectBorderRadius="0.25mm"
      portHints={["pin1", "ANODE"]}
    />
    <platedhole
      name="pin2"
      shape="circular_hole_with_rect_pad"
      pcbX="1.27mm"
      pcbY={0}
      holeDiameter="0.9mm"
      rectPadWidth="1.8mm"
      rectPadHeight="1.8mm"
      rectBorderRadius="0.25mm"
      portHints={["pin2", "CATHODE"]}
    />
    <silkscreencircle pcbX={0} pcbY={0} radius="3mm" strokeWidth="0.1mm" />
  </footprint>
)

/** Same Sky CMI-9605-0580T polarity-aware through-hole landing. */
export const p0BuzzerFootprint = (
  <footprint name="P0_CMI_9605_0580T_TH_REVIEW" originalLayer="top">
    <platedhole
      name="pin1"
      shape="circular_hole_with_rect_pad"
      pcbX={0}
      pcbY="-2.5mm"
      holeDiameter="0.8mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="1mm"
      portHints={["pin1", "POSITIVE"]}
    />
    <platedhole
      name="pin2"
      shape="circular_hole_with_rect_pad"
      pcbX={0}
      pcbY="2.5mm"
      holeDiameter="0.8mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="1mm"
      portHints={["pin2", "NEGATIVE"]}
    />
    <silkscreencircle pcbX={0} pcbY={0} radius="4.8mm" strokeWidth="0.1mm" />
  </footprint>
)

export type P0PrimaryOutputsFootprint = ReactElement
