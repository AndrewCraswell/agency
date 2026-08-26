/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"
import { bp033Littelfuse0451FuseFootprintEvidence } from "./bp033-littelfuse-0451-fuses.js"
import { bp033Tps25947ProjectFootprintGeometry } from "./bp033-tps25947-project-footprint.js"

/**
 * P0-06 display-power footprint reconciliation.
 *
 * These renderers bind exact identities to retained manufacturer evidence.
 * They are placement-review inputs only: fabrication remains denied until the
 * root reviewer accepts the complete board.
 */
export const p0DisplayPowerFootprintMetadata = Object.freeze({
  limiter: {
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TPS259474ARPWR",
    package: "VQFN-HR RPW0010A, 10-pin",
    pinCount: 10,
    sourceUrl: "https://www.ti.com/lit/ds/symlink/tps25947.pdf",
    evidenceArtifact: "docs/evidence/p0-06/ti-tps259474a-datasheet.pdf",
    evidenceSha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC",
    sourceState: "evidence-complete-pending-root-placement-approval",
    packageDrawing: "RPW0010A",
    padGeometry: {
      pinCount: 10,
      edgePadPitchMm: 0.5,
      centralPowerLands: [5, 6],
      sourceBasis: "TI RPW0010A drawing transcribed by BP-033 retained geometry"
    },
    orientation: "top view pin 1 datum; pins 5 and 6 are central IN and OUT power lands",
    releaseState: "deny"
  },
  fuse: {
    manufacturer: "Littelfuse",
    manufacturerPartNumber: "045106.3MRL",
    package: "NANO2 451 surface-mount fuse",
    pinCount: 2,
    sourceUrl:
      "https://www.littelfuse.com/assetdocs/fuse-451-and-453-datasheet?assetguid=533cd5cc-956c-4243-867f-6ab5a62f6ba1",
    evidenceArtifact: "docs/evidence/p0-06/littelfuse-451-453-datasheet.pdf",
    evidenceSha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2",
    sourceState: "evidence-complete-pending-root-placement-approval",
    padGeometry: {
      padCount: 2,
      padLengthMm: 1.96,
      padWidthMm: 3.15,
      padGapMm: 2.95,
      sourceBasis: "Littelfuse 451 recommended pad layout, retained BP-033 transcription"
    },
    orientation: "non-polar; long axis on local X and terminals at negative/positive X",
    releaseState: "deny"
  },
  pigtail: {
    package: "eight-conductor direct solder-wire board landing",
    pinCount: 8,
    inBom: false,
    onBoard: true,
    sourceState: "prototype-solder-wire-landing-no-mating-part",
    orientation: "direct wire landing order follows the display branch pin labels",
    releaseState: "deny"
  },
  supportPassives: [
    {
      referenceClass: "display-0402",
      package: "0402",
      exactParts: [
        "RC0402FR-07698RL",
        "C0402C104K3RACTU",
        "C0402C222K3RACTU",
        "RC0402FR-0710KL",
        "RC0402FR-07137KL",
        "RC0402FR-0749K9L"
      ],
      orientation: "non-polar; rotation may follow placement escape",
      releaseState: "deny"
    },
    {
      referenceClass: "display-0805",
      package: "0805",
      exactParts: ["C2012X7S1A226M125AC"],
      orientation: "non-polar; rotation may follow placement escape",
      releaseState: "deny"
    }
  ]
} as const)

/** Map over the retained BP-033 TPS259474ARPWR geometry. */
export const p0DisplayLimiterFootprint = (
  <footprint name="P0_TPS259474ARPWR_RPW0010A_REVIEW" originalLayer="top">
    {bp033Tps25947ProjectFootprintGeometry.projectFootprint.pads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={String(pad.pin)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin="0.05mm"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[String(pad.pin), pad.role, `pin${pad.pin}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

/** Map over the retained Littelfuse 451 recommended copper. */
export const p0DisplayFuseFootprint = (
  <footprint name="P0_LITTELFUSE_0451063MRL_451_REVIEW" originalLayer="top">
    {bp033Littelfuse0451FuseFootprintEvidence.projectFootprint.pads.map((pad) => (
      <Fragment key={pad.pad}>
        <smtpad
          name={pad.pad}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderPasteMargin="-1mm"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[pad.pad, pad.terminal, "non-polar"]}
        />
      </Fragment>
    ))}
  </footprint>
)

/**
 * The prototype keeps the display cable as eight direct board-wire landings.
 * This is intentionally not represented as a panel connector or a released
 * cable mating footprint.
 */
export const p0DisplayPowerPigtailFootprint = (
  <footprint name="P0_DISPLAY_SOLDER_WIRE_LANDINGS" originalLayer="top">
    {Array.from({ length: 8 }, (_, index) => (
      <Fragment key={index + 1}>
        <platedhole
          name={String(index + 1)}
          shape="circular_hole_with_rect_pad"
          pcbX={0}
          pcbY={(index - 3.5) * 3}
          holeDiameter="1.1mm"
          rectPadWidth="2.2mm"
          rectPadHeight="2.2mm"
          rectBorderRadius="1.1mm"
          portHints={[String(index + 1), `pin${index + 1}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

export type P0DisplayPowerFootprint = ReactElement
