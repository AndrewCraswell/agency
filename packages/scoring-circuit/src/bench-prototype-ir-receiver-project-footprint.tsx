import type { ReactElement } from "react"

/**
 * BP-146 project land pattern for the Vishay TSOP38438.
 *
 * This is a review-only project footprint. The reviewed Vishay package
 * drawing supplies the lead pitch, pin order, and package/lens datums; the
 * finished drill, copper, mask, and paste choices below are project inputs,
 * not a manufacturer-CAD claim. Optical, physical, and fabrication release
 * authority remain denied.
 */

export const benchPrototypeIrReceiverProjectFootprintGeometry = {
  artifactKind: "bp146-tsop38438-project-footprint",
  workUnit: "BP-146",
  manufacturer: "Vishay Semiconductors",
  manufacturerPartNumber: "TSOP38438",
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny"
  },
  geometryAuthority: "project-review-input-not-manufacturer-specification",
  pinOne: {
    pin: 1,
    name: "OUT",
    coordinatesMm: { x: 0, y: 3.6 },
    boardRotationDegrees: 0
  },
  pins: [
    { pin: 1, name: "OUT", xMm: 0, yMm: 3.6 },
    { pin: 2, name: "GND", xMm: 2.54, yMm: 3.6 },
    { pin: 3, name: "VS", xMm: 5.08, yMm: 3.6 }
  ],
  pitchMm: 2.54,
  finishedDrillDiameterMm: 1.1,
  copperPadDiameterMm: 2.2,
  copperPadGeometry: {
    representation: "rounded-rectangle-equivalent-to-circle",
    primitive: "circular_hole_with_rect_pad",
    widthMm: 2.2,
    heightMm: 2.2,
    cornerRadiusMm: 1.1,
    status: "runtime-workaround-for-zero-paste"
  },
  solderMaskOpeningDiameterMm: 2.3,
  solderMaskMarginMm: 0.05,
  pasteOpeningDiameterMm: 0,
  lensDatum: {
    source: "front optical window at the Vishay package drawing front face",
    coordinatesMm: { x: 2.5, y: 0 },
    opticalAxis: "negative-y",
    lensEnvelope: {
      centerMm: { x: 2.5, y: 2 },
      radiusMm: 2,
      projectionDepthMm: 2
    }
  },
  bodyDatum: {
    source: "Vishay Minicast package drawing 6.550-5263.01-4",
    widthMm: 5,
    packageHeightMm: 6.95,
    depthMm: 4.8,
    frontFaceYMm: 0,
    bodyBlockDepthMm: 2.8,
    bodyBlockFrontFaceYMm: 2,
    bodyBackFaceYMm: 4.8,
    leadRowYMm: 3.6,
    leadRowOffsetFromBodyBackEdgeMm: 1.2,
    extendsPositiveY: true
  },
  courtyard: {
    source: "project 0.55 mm clearance around the nominal body projection and copper-pad extents",
    clearanceMm: 0.55,
    minimumXMm: -1.65,
    maximumXMm: 6.73,
    minimumYMm: -0.55,
    maximumYMm: 5.35,
    centerMm: { x: 2.54, y: 2.4 },
    widthMm: 8.38,
    heightMm: 5.9
  },
  opticalAuthority: "deny",
  physicalAuthority: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const projectFootprint = (
  <footprint name="BP146_TSOP38438_PROJECT_FOOTPRINT" originalLayer="top">
    {/*
     * tscircuit 0.0.1634's native shape="circle" PTH path emits automatic
     * top/bottom paste apertures. circular_hole_with_rect_pad is the native
     * no-paste PTH primitive; a 2.20 mm by 2.20 mm pad with a 1.10 mm corner
     * radius is geometrically a circle, preserving the reviewed 2.20 mm pad
     * while keeping the runtime paste output empty. The rounded-rectangle
     * representation is recorded explicitly above; it must not be read as a
     * square-pad or manufacturer-CAD claim.
     */}
    <platedhole
      name="1"
      shape="circular_hole_with_rect_pad"
      pcbX={0}
      pcbY={3.6}
      holeDiameter="1.10mm"
      rectPadWidth="2.20mm"
      rectPadHeight="2.20mm"
      rectBorderRadius="1.10mm"
      solderMaskMargin="0.05mm"
      portHints={["1", "OUT", "pin1"]}
    />
    <platedhole
      name="2"
      shape="circular_hole_with_rect_pad"
      pcbX={2.54}
      pcbY={3.6}
      holeDiameter="1.10mm"
      rectPadWidth="2.20mm"
      rectPadHeight="2.20mm"
      rectBorderRadius="1.10mm"
      solderMaskMargin="0.05mm"
      portHints={["2", "GND", "pin2"]}
    />
    <platedhole
      name="3"
      shape="circular_hole_with_rect_pad"
      pcbX={5.08}
      pcbY={3.6}
      holeDiameter="1.10mm"
      rectPadWidth="2.20mm"
      rectPadHeight="2.20mm"
      rectBorderRadius="1.10mm"
      solderMaskMargin="0.05mm"
      portHints={["3", "VS", "pin3"]}
    />
    {/* Review-only assembly obstruction and courtyard; neither is manufacturer CAD. */}
    <keepout shape="rect" pcbX={2.5} pcbY={3.4} width="5mm" height="2.8mm" layers={["top"]} />
    <keepout shape="circle" pcbX={2.5} pcbY={2} radius="2mm" layers={["top"]} />
    <courtyardrect pcbX={2.54} pcbY={2.4} width="8.38mm" height="5.9mm" strokeWidth="0.05mm" />
    <silkscreenrect
      pcbX={2.5}
      pcbY={3.4}
      width="5mm"
      height="2.8mm"
      stroke="dashed"
      strokeWidth="0.1mm"
      filled={false}
    />
    <silkscreencircle pcbX={2.5} pcbY={2} radius="2mm" strokeWidth="0.1mm" />
    <silkscreenline x1={0} y1={2} x2={5} y2={2} strokeWidth="0.1mm" />
  </footprint>
)

export interface BenchPrototypeIrReceiverProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated tscircuit component for BP-146 footprint review and rendering. */
export function BenchPrototypeIrReceiverProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: BenchPrototypeIrReceiverProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP146_TSOP38438"
      manufacturerPartNumber="TSOP38438"
      pinLabels={{ pin1: "OUT", pin2: "GND", pin3: "VS" }}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}
