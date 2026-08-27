import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

const rj14Footprint = (
  <footprint name="TE_5520250_2_RJ14_6P4C" originalLayer="top">
    {[
      { name: "OUTER_A", number: 2, x: -1.905, y: 0.635 },
      { name: "DATA_A", number: 3, x: -0.635, y: -0.635 },
      { name: "DATA_B", number: 4, x: 0.635, y: 0.635 },
      { name: "OUTER_B", number: 5, x: 1.905, y: -0.635 }
    ].map(({ name, number, x, y }) => (
      <Fragment key={name}>
        <platedhole
          name={name}
          shape="circle"
          pcbX={x}
          pcbY={y}
          holeDiameter="0.9mm"
          outerDiameter="1.4mm"
          portHints={[String(number), `pin${number}`, name]}
        />
      </Fragment>
    ))}
    <hole name="BOARD_LOCK_LEFT" diameter="3.25mm" pcbX={-5.08} pcbY={-7.62} />
    <hole name="BOARD_LOCK_RIGHT" diameter="3.25mm" pcbX={5.08} pcbY={-7.62} />
    <silkscreenrect pcbX={0} pcbY={-3.7} width="15.88mm" height="20.96mm" strokeWidth="0.2mm" filled={false} />
    <silkscreentext text="FA-05 DATA" pcbX={0} pcbY={4.5} fontSize="0.9mm" />
    <courtyardrect pcbX={0} pcbY={-3.7} width="16.4mm" height="21.5mm" strokeWidth="0.05mm" />
  </footprint>
)

const dip6Footprint = (
  <footprint name="DIP_6_W7_62MM" originalLayer="top">
    {[
      { number: 1, x: -3.81, y: 2.54 },
      { number: 2, x: -3.81, y: 0 },
      { number: 3, x: -3.81, y: -2.54 },
      { number: 4, x: 3.81, y: -2.54 },
      { number: 5, x: 3.81, y: 0 },
      { number: 6, x: 3.81, y: 2.54 }
    ].map(({ number, x, y }) => (
      <Fragment key={number}>
        <platedhole
          name={`PIN_${number}`}
          shape="circular_hole_with_rect_pad"
          pcbX={x}
          pcbY={y}
          holeDiameter="0.9mm"
          rectPadWidth="1.8mm"
          rectPadHeight="1.8mm"
          rectBorderRadius={number === 1 ? "0mm" : "0.9mm"}
          portHints={[String(number), `pin${number}`]}
        />
      </Fragment>
    ))}
    <silkscreenrect pcbX={0} pcbY={0} width="10.2mm" height="7.4mm" strokeWidth="0.2mm" filled={false} />
    <silkscreencircle pcbX={-3.2} pcbY={2.5} radius="0.5mm" strokeWidth="0.2mm" isOutline />
  </footprint>
)

const do41Footprint = (
  <footprint name="DO_41_P10_16MM" originalLayer="top">
    <platedhole
      name="CATHODE"
      shape="circular_hole_with_rect_pad"
      pcbX={-5.08}
      pcbY={0}
      holeDiameter="1mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="0mm"
      portHints={["1", "pin1", "CATHODE"]}
    />
    <platedhole
      name="ANODE"
      shape="circular_hole_with_rect_pad"
      pcbX={5.08}
      pcbY={0}
      holeDiameter="1mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="1mm"
      portHints={["2", "pin2", "ANODE"]}
    />
    <silkscreenrect pcbX={0} pcbY={0} width="6mm" height="2.6mm" strokeWidth="0.2mm" filled={false} />
    <silkscreenline x1={-2} y1={-1.3} x2={-2} y2={1.3} strokeWidth="0.3mm" />
  </footprint>
)

export const faveroDataLine = {
  connectors: ["J_FAVERO_DATA_1", "J_FAVERO_DATA_2"],
  electricalInterface: "isolated 20 mA current loop",
  gpio: "GPIO43_UART_TX",
  optocoupler: "4N32M",
  pinout: {
    2: "outer loop conductor",
    3: "center data conductor",
    4: "center data conductor",
    5: "outer loop conductor"
  },
  protocol: "Favero FULL-ARM-05 DATA-LINE, 2400 baud, 8N1"
} as const

const channels = [
  { connectorX: 40, index: 1, loopX: 35, x: 48 },
  { connectorX: 60, index: 2, loopX: 59, x: 68 }
] as const

export function FaveroDataLine(): ReactElement {
  return (
    <group name="FAVERO_DATA_LINE" pcbX={0} pcbY={0} pcbPack={false}>
      {channels.map(({ connectorX, index, loopX, x }) => {
        const connector = `J_FAVERO_DATA_${index}`
        const optocoupler = `U_FAVERO_DATA_${index}`
        const inputResistor = `R_FAVERO_DATA_${index}_INPUT`
        const loopResistor = `R_FAVERO_DATA_${index}_LOOP`
        const baseResistor = `R_FAVERO_DATA_${index}_BASE`
        const diode = `D_FAVERO_DATA_${index}`

        return (
          <Fragment key={index}>
            <chip
              name={connector}
              manufacturerPartNumber="5520250-2"
              pinLabels={{ pin2: "OUTER_A", pin3: "DATA_A", pin4: "DATA_B", pin5: "OUTER_B" }}
              footprint={rj14Footprint}
              pcbX={connectorX}
              pcbY={-40}
              cadModel={cadModels.repeaterConnectorRj14}
            />
            <chip
              name={optocoupler}
              manufacturerPartNumber={faveroDataLine.optocoupler}
              pinLabels={{
                pin1: "LED_ANODE",
                pin2: "LED_CATHODE",
                pin3: "NC",
                pin4: "EMITTER",
                pin5: "COLLECTOR",
                pin6: "BASE"
              }}
              footprint={dip6Footprint}
              pcbX={x}
              pcbY={-24}
              cadModel={cadModels.dip6}
            />
            <resistor
              name={inputResistor}
              manufacturerPartNumber="RC0805FR-07330RL"
              resistance="330ohm"
              tolerance="1%"
              footprint="0805"
              pcbX={x}
              pcbY={-18}
              cadModel={cadModels.resistor0805}
            />
            <resistor
              name={loopResistor}
              manufacturerPartNumber="RC0805FR-0782RL"
              resistance="82ohm"
              tolerance="1%"
              footprint="0805"
              pcbX={loopX}
              pcbY={-27}
              cadModel={cadModels.resistor0805}
            />
            <resistor
              name={baseResistor}
              manufacturerPartNumber="RC0805FR-07680KL"
              resistance="680kohm"
              tolerance="1%"
              footprint="0805"
              pcbX={x + 9}
              pcbY={-30}
              cadModel={cadModels.resistor0805}
            />
            <chip
              name={diode}
              manufacturerPartNumber="1N4004-E3/54"
              pinLabels={{ pin1: "CATHODE", pin2: "ANODE" }}
              footprint={do41Footprint}
              pcbX={x}
              pcbY={-30}
              cadModel={cadModels.diodeDo41}
            />

            <trace from="net.FAVERO_DATA_TX" to={`${inputResistor}.pin1`} />
            <trace from={`${inputResistor}.pin2`} to={`${optocoupler}.LED_ANODE`} />
            <trace from={`${optocoupler}.LED_CATHODE`} to="net.APP_GND" />
            <trace from={`${optocoupler}.COLLECTOR`} to={`${loopResistor}.pin1`} />
            <trace from={`${loopResistor}.pin2`} to={`${connector}.OUTER_A`} />
            <trace from={`${optocoupler}.EMITTER`} to={`${connector}.DATA_A`} />
            <trace from={`${optocoupler}.EMITTER`} to={`${connector}.DATA_B`} />
            <trace from={`${optocoupler}.BASE`} to={`${baseResistor}.pin1`} />
            <trace from={`${baseResistor}.pin2`} to={`${connector}.OUTER_B`} />
            <trace from={`${diode}.CATHODE`} to={`${optocoupler}.COLLECTOR`} />
            <trace from={`${diode}.ANODE`} to={`${optocoupler}.EMITTER`} />
          </Fragment>
        )
      })}
    </group>
  )
}
