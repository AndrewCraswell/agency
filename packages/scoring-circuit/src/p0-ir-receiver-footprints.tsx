/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"
import { benchPrototypeIrReceiverProjectFootprintGeometry } from "./bench-prototype-ir-receiver-project-footprint.js"

/**
 * P0-06 IR receiver footprint reconciliation.
 *
 * The TSOP geometry is bound to the retained Vishay package drawing. It is
 * suitable for connectivity and placement review; optical range testing and
 * fabrication authority remain denied until the root reviewer accepts the
 * complete board.
 */
export const p0IrReceiverFootprintMetadata = Object.freeze({
  receiver: {
    manufacturer: "Vishay Semiconductors",
    manufacturerPartNumber: "TSOP38438",
    package: "Minicast through-hole IR receiver",
    pinCount: 3,
    pitchMm: 2.54,
    sourceUrl: "https://www.vishay.com/docs/82491/tsop382.pdf",
    evidenceArtifact: "docs/evidence/p0-06/vishay-tsop382-tsop384-datasheet.pdf",
    evidenceSha256: "5F81C36AA02E9901E51C749D03AEE75A23A29B8195B30BF1CBA95F536C865074",
    sourceState: "evidence-complete-pending-root-placement-approval",
    packageDrawing: "Minicast 5.0 W x 6.95 H x 4.8 D, leaded",
    padGeometry: {
      pinCount: 3,
      leadPitchMm: 2.54,
      finishedDrillDiameterMm: 1.1,
      copperPadDiameterMm: 2.2,
      sourceBasis: "Vishay TSOP382/384 package drawing plus explicit project solder landings"
    },
    opticalTesting: "later-range-and-angle-validation",
    orientation: "top view pin 1 OUT, pin 2 GND, pin 3 VS; optical window faces negative local Y",
    releaseState: "deny"
  },
  supportPassives: [
    {
      reference: "R_IR_VS",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0603FR-07100RL",
      package: "0603",
      value: "100 ohm",
      orientation: "non-polar; rotation may follow placement escape",
      releaseState: "deny"
    },
    {
      reference: "C_IR_VS",
      manufacturer: "KEMET",
      manufacturerPartNumber: "C0603C104K3RACTU",
      package: "0603",
      value: "100 nF",
      orientation: "non-polar; rotation may follow placement escape",
      releaseState: "deny"
    },
    {
      reference: "R_IR_OUT",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0603FR-07100RL",
      package: "0603",
      value: "100 ohm",
      orientation: "non-polar; rotation may follow placement escape",
      releaseState: "deny"
    },
    {
      reference: "R_IR_PULLUP",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0603FR-0710KL",
      package: "0603",
      value: "10 kilohm",
      orientation: "non-polar; rotation may follow placement escape",
      releaseState: "deny"
    }
  ]
} as const)

export const p0IrReceiverFootprint = (
  <footprint name="P0_TSOP38438_MINICAST_REVIEW" originalLayer="top">
    {benchPrototypeIrReceiverProjectFootprintGeometry.pins.map((pin) => (
      <Fragment key={pin.pin}>
        <platedhole
          name={String(pin.pin)}
          shape="circular_hole_with_rect_pad"
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          holeDiameter={`${benchPrototypeIrReceiverProjectFootprintGeometry.finishedDrillDiameterMm}mm`}
          rectPadWidth={`${benchPrototypeIrReceiverProjectFootprintGeometry.copperPadDiameterMm}mm`}
          rectPadHeight={`${benchPrototypeIrReceiverProjectFootprintGeometry.copperPadDiameterMm}mm`}
          rectBorderRadius={`${benchPrototypeIrReceiverProjectFootprintGeometry.copperPadDiameterMm / 2}mm`}
          solderMaskMargin={`${benchPrototypeIrReceiverProjectFootprintGeometry.solderMaskMarginMm}mm`}
          portHints={[`pin${pin.pin}`, pin.name]}
        />
      </Fragment>
    ))}
    <keepout
      shape="rect"
      pcbX={benchPrototypeIrReceiverProjectFootprintGeometry.lensDatum.lensEnvelope.centerMm.x}
      pcbY={
        benchPrototypeIrReceiverProjectFootprintGeometry.bodyDatum.bodyBlockFrontFaceYMm +
        benchPrototypeIrReceiverProjectFootprintGeometry.bodyDatum.bodyBlockDepthMm / 2
      }
      width="5mm"
      height="2.8mm"
      layers={["top"]}
    />
    <keepout
      shape="circle"
      pcbX={benchPrototypeIrReceiverProjectFootprintGeometry.lensDatum.lensEnvelope.centerMm.x}
      pcbY={benchPrototypeIrReceiverProjectFootprintGeometry.lensDatum.lensEnvelope.centerMm.y}
      radius={`${benchPrototypeIrReceiverProjectFootprintGeometry.lensDatum.lensEnvelope.radiusMm}mm`}
      layers={["top"]}
    />
    <courtyardrect
      pcbX={benchPrototypeIrReceiverProjectFootprintGeometry.courtyard.centerMm.x}
      pcbY={benchPrototypeIrReceiverProjectFootprintGeometry.courtyard.centerMm.y}
      width={`${benchPrototypeIrReceiverProjectFootprintGeometry.courtyard.widthMm}mm`}
      height={`${benchPrototypeIrReceiverProjectFootprintGeometry.courtyard.heightMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export type P0IrReceiverFootprint = ReactElement
