import type { ReactElement } from "react"

const footprint = (
  <footprint name="P0_PISTE_LANDING" originalLayer="top">
    <platedhole
      name="1"
      shape="circular_hole_with_rect_pad"
      pcbX={0}
      pcbY={0}
      holeDiameter="1.3mm"
      rectPadWidth="2.8mm"
      rectPadHeight="2.8mm"
      rectBorderRadius="1.4mm"
      solderMaskMargin="0.05mm"
      portHints={["PISTE"]}
    />
    <platedhole
      name="2"
      shape="circular_hole_with_rect_pad"
      pcbX={0}
      pcbY={5}
      holeDiameter="1mm"
      rectPadWidth="2.4mm"
      rectPadHeight="2.4mm"
      rectBorderRadius="1.2mm"
      solderMaskMargin="0.05mm"
      portHints={["PISTE_TEST"]}
    />
    <hole name="ANCHOR_PISTE" diameter="3.2mm" pcbX={0} pcbY={-4} />
  </footprint>
)

export function P0PisteLanding({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <chip
      name="J_PISTE_DIRECT"
      kicadSymbolMetadata={{ inBom: false, onBoard: true }}
      pinLabels={{ pin1: "PISTE", pin2: "PISTE_TEST" }}
      footprint={footprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbPositionMode="relative_to_board_anchor"
    />
  )
}
