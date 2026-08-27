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
    drive: "direct-3v3",
    gpio: "GPIO39",
    led: "LED_LEFT_RED",
    manufacturerPartNumber: "WP7113ID",
    resistor: "R_LEFT_RED_LED",
    role: "left on-target",
    x: 69,
    y: 30
  },
  {
    color: "white",
    drive: "v5-low-side",
    gpio: "GPIO47",
    led: "LED_LEFT_WHITE",
    manufacturerPartNumber: "WP7113QWC/D",
    mosfet: "Q_LEFT_WHITE_LED",
    pulldown: "R_LEFT_WHITE_LED_PULLDOWN",
    resistor: "R_LEFT_WHITE_LED",
    role: "left off-target",
    x: 69,
    y: 22
  },
  {
    color: "green",
    drive: "direct-3v3",
    gpio: "GPIO19",
    led: "LED_RIGHT_GREEN",
    manufacturerPartNumber: "WP7113GD",
    resistor: "R_RIGHT_GREEN_LED",
    role: "right on-target",
    x: 69,
    y: 14
  },
  {
    color: "white",
    drive: "v5-low-side",
    gpio: "GPIO20",
    led: "LED_RIGHT_WHITE",
    manufacturerPartNumber: "WP7113QWC/D",
    mosfet: "Q_RIGHT_WHITE_LED",
    pulldown: "R_RIGHT_WHITE_LED_PULLDOWN",
    resistor: "R_RIGHT_WHITE_LED",
    role: "right off-target",
    x: 69,
    y: 6
  }
] as const

const indicatorCadModels = {
  green: cadModels.led5mmGreen,
  red: cadModels.led5mmRed,
  white: cadModels.led5mmWhite
} as const

export function PrototypeIndicators(): ReactElement {
  return (
    <group name="PROTOTYPE_SCORING_INDICATORS" pcbX={0} pcbY={0} pcbPack={false}>
      {prototypeIndicators.map((indicator) => (
        <Fragment key={indicator.led}>
          <resistor
            name={indicator.resistor}
            manufacturerPartNumber="RC0805FR-07330RL"
            resistance="330ohm"
            tolerance="1%"
            footprint="0805"
            pcbX={indicator.x - 9}
            pcbY={indicator.y}
            cadModel={cadModels.resistor0805}
          />
          <led
            name={indicator.led}
            manufacturerPartNumber={indicator.manufacturerPartNumber}
            color={indicator.color}
            footprint={ledFootprint}
            pcbX={indicator.x}
            pcbY={indicator.y}
            cadModel={indicatorCadModels[indicator.color]}
          />
          {indicator.drive === "direct-3v3" ? (
            <>
              <trace from={`${indicator.resistor}.pin2`} to={`${indicator.led}.anode`} />
              <trace from={`${indicator.led}.cathode`} to="net.APP_GND" />
            </>
          ) : (
            <>
              <chip
                name={indicator.mosfet}
                manufacturerPartNumber="BSS138-7-F"
                pinLabels={{ pin1: "GATE", pin2: "SOURCE", pin3: "DRAIN" }}
                footprint="sot23"
                pcbX={indicator.x - 17}
                pcbY={indicator.y}
                cadModel={cadModels.sot23}
              />
              <resistor
                name={indicator.pulldown}
                manufacturerPartNumber="RC0603FR-07100KL"
                resistance="100kohm"
                tolerance="1%"
                footprint="0603"
                pcbX={indicator.x - 24}
                pcbY={indicator.y}
                cadModel={cadModels.resistor0603}
              />
              <trace from="net.V5" to={`${indicator.resistor}.pin1`} />
              <trace from={`${indicator.resistor}.pin2`} to={`${indicator.led}.anode`} />
              <trace from={`${indicator.led}.cathode`} to={`${indicator.mosfet}.DRAIN`} />
              <trace from={`${indicator.mosfet}.SOURCE`} to="net.APP_GND" />
              <trace from={`net.${indicator.led}_DRIVE`} to={`${indicator.mosfet}.GATE`} />
              <trace from={`${indicator.mosfet}.GATE`} to={`${indicator.pulldown}.pin1`} />
              <trace from={`${indicator.pulldown}.pin2`} to="net.APP_GND" />
            </>
          )}
        </Fragment>
      ))}
    </group>
  )
}
