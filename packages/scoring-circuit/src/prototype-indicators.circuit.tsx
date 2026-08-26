import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

const ledFootprint = (
  <footprint name="KINGBRIGHT_WP7113_5MM" originalLayer="top">
    <platedhole
      name="CATHODE"
      shape="circular_hole_with_rect_pad"
      pcbX={-1.27}
      pcbY={0}
      holeDiameter="1mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="0mm"
      portHints={["1", "pin1", "cathode", "neg"]}
    />
    <platedhole
      name="ANODE"
      shape="circular_hole_with_rect_pad"
      pcbX={1.27}
      pcbY={0}
      holeDiameter="1mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="1mm"
      portHints={["2", "pin2", "anode", "pos"]}
    />
    <silkscreencircle pcbX={0} pcbY={0} radius="2.95mm" strokeWidth="0.2mm" isOutline />
    <silkscreenline x1={-2.5} y1={-1.5} x2={-2.5} y2={1.5} strokeWidth="0.2mm" />
    <courtyardrect pcbX={0} pcbY={0} width="6.5mm" height="6.5mm" strokeWidth="0.05mm" />
  </footprint>
)

export const prototypeIndicators = [
  {
    color: "red",
    gpio: "GPIO42",
    led: "LED_LEFT_RED",
    manufacturerPartNumber: "WP7113ID",
    resistor: "R_LEFT_RED_LED",
    x: 67,
    y: 27
  },
  {
    color: "green",
    gpio: "GPIO41",
    led: "LED_RIGHT_GREEN",
    manufacturerPartNumber: "WP7113GD",
    resistor: "R_RIGHT_GREEN_LED",
    x: 67,
    y: 20
  }
] as const

export function PrototypeIndicators(): ReactElement {
  return (
    <group name="PROTOTYPE_SCORING_INDICATORS" pcbX={0} pcbY={0} pcbPack={false}>
      {prototypeIndicators.map(({ color, led, manufacturerPartNumber, resistor, x, y }) => (
        <Fragment key={led}>
          <resistor
            name={resistor}
            manufacturerPartNumber="RC0805FR-07330RL"
            resistance="330ohm"
            tolerance="1%"
            footprint="0805"
            pcbX={58}
            pcbY={y}
            cadModel={cadModels.resistor0805}
          />
          <led
            name={led}
            manufacturerPartNumber={manufacturerPartNumber}
            color={color}
            footprint={ledFootprint}
            pcbX={x}
            pcbY={y}
            cadModel={cadModels.led5mm}
          />
          <trace from={`${resistor}.pin2`} to={`${led}.anode`} />
          <trace from={`${led}.cathode`} to="net.APP_GND" />
        </Fragment>
      ))}
    </group>
  )
}
