import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

const connectorPins = [
  { name: "NC_1", number: 1, x: -5.54, y: -1.42 },
  { name: "NC_2", number: 2, x: -2.77, y: -1.42 },
  { name: "TX_NEG", number: 3, x: 0, y: -1.42 },
  { name: "TX_POS", number: 4, x: 2.77, y: -1.42 },
  { name: "NC_5", number: 5, x: 5.54, y: -1.42 },
  { name: "APP_GND_6", number: 6, x: -4.155, y: 1.42 },
  { name: "APP_GND_7", number: 7, x: -1.385, y: 1.42 },
  { name: "NC_8", number: 8, x: 1.385, y: 1.42 },
  { name: "NC_9", number: 9, x: 4.155, y: 1.42 }
] as const

const repeaterConnectorFootprint = (
  <footprint name="NORCOMP_182_009_113R161" originalLayer="top">
    {connectorPins.map(({ name, number, x, y }) => (
      <Fragment key={number}>
        <platedhole
          name={name}
          shape="circular_hole_with_rect_pad"
          pcbX={x}
          pcbY={y}
          holeDiameter="1.19mm"
          rectPadWidth="2mm"
          rectPadHeight="2mm"
          rectBorderRadius={number === 1 ? "0mm" : "1mm"}
          portHints={[String(number), `pin${number}`, name]}
        />
      </Fragment>
    ))}
    <hole name="MOUNT_LEFT" diameter="3.2mm" pcbX={-12.495} pcbY={0} />
    <hole name="MOUNT_RIGHT" diameter="3.2mm" pcbX={12.495} pcbY={0} />
    <silkscreenrect pcbX={0} pcbY={-4.75} width="30.8mm" height="9.5mm" strokeWidth="0.2mm" filled={false} />
    <silkscreentext text="FPA RS-422" pcbX={0} pcbY={3.8} fontSize="1mm" />
    <courtyardrect pcbX={0} pcbY={-4.75} width="31.3mm" height="10mm" strokeWidth="0.05mm" />
  </footprint>
)

const driverPinLabels = {
  pin1: "DRIVER_1_INPUT",
  pin2: "DRIVER_1_POSITIVE",
  pin3: "DRIVER_1_NEGATIVE",
  pin4: "ENABLE_HIGH",
  pin5: "DRIVER_2_NEGATIVE",
  pin6: "DRIVER_2_POSITIVE",
  pin7: "DRIVER_2_INPUT",
  pin8: "APP_GND",
  pin9: "DRIVER_3_INPUT",
  pin10: "DRIVER_3_POSITIVE",
  pin11: "DRIVER_3_NEGATIVE",
  pin12: "ENABLE_LOW",
  pin13: "DRIVER_4_NEGATIVE",
  pin14: "DRIVER_4_POSITIVE",
  pin15: "DRIVER_4_INPUT",
  pin16: "APP_3V3"
} as const

export const prototypeRepeaterInterfaces = {
  connectors: ["J_FPA_REPEATER_1", "J_FPA_REPEATER_2"],
  driver: "AM26LV31EIPWR",
  gpio: "GPIO43_UART_TX",
  protocol: "RS422-FPA 3.04a, 38400 baud, 8N1",
  pinout: { 3: "Tx-", 4: "Tx+", 6: "GND", 7: "GND" }
} as const

export function PrototypeRepeaterInterfaces(): ReactElement {
  return (
    <group name="PROTOTYPE_REPEATER_INTERFACES" pcbX={0} pcbY={0} pcbPack={false}>
      <chip
        name="U_FPA_DRIVER"
        manufacturerPartNumber={prototypeRepeaterInterfaces.driver}
        pinLabels={driverPinLabels}
        footprint="tssop16"
        pcbX={35}
        pcbY={-27}
        cadModel={cadModels.tssop16}
      />
      <capacitor
        name="C_FPA_DRIVER_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={29}
        pcbY={-27}
        cadModel={cadModels.capacitor0603}
      />
      {prototypeRepeaterInterfaces.connectors.map((name, index) => (
        <Fragment key={name}>
          <chip
            name={name}
            manufacturerPartNumber="182-009-113R161"
            pinLabels={Object.fromEntries(connectorPins.map(({ name: pinName, number }) => [`pin${number}`, pinName]))}
            footprint={repeaterConnectorFootprint}
            pcbX={index === 0 ? 18 : 54}
            pcbY={-43}
            cadModel={cadModels.repeaterConnector}
          />
        </Fragment>
      ))}

      <trace from="net.APP_3V3" to="U_FPA_DRIVER.APP_3V3" />
      <trace from="net.APP_3V3" to="U_FPA_DRIVER.ENABLE_HIGH" />
      <trace from="net.APP_3V3" to="C_FPA_DRIVER_BYPASS.pin1" />
      <trace from="C_FPA_DRIVER_BYPASS.pin2" to="net.APP_GND" />
      <trace from="net.APP_GND" to="U_FPA_DRIVER.APP_GND" />
      <trace from="net.APP_GND" to="U_FPA_DRIVER.ENABLE_LOW" />
      <trace from="net.APP_GND" to="U_FPA_DRIVER.DRIVER_3_INPUT" />
      <trace from="net.APP_GND" to="U_FPA_DRIVER.DRIVER_4_INPUT" />
      <trace from="net.FPA_TX" to="U_FPA_DRIVER.DRIVER_1_INPUT" />
      <trace from="net.FPA_TX" to="U_FPA_DRIVER.DRIVER_2_INPUT" />
      <trace from="U_FPA_DRIVER.DRIVER_1_NEGATIVE" to="J_FPA_REPEATER_1.TX_NEG" />
      <trace from="U_FPA_DRIVER.DRIVER_1_POSITIVE" to="J_FPA_REPEATER_1.TX_POS" />
      <trace from="U_FPA_DRIVER.DRIVER_2_NEGATIVE" to="J_FPA_REPEATER_2.TX_NEG" />
      <trace from="U_FPA_DRIVER.DRIVER_2_POSITIVE" to="J_FPA_REPEATER_2.TX_POS" />
      <trace from="J_FPA_REPEATER_1.APP_GND_6" to="net.APP_GND" />
      <trace from="J_FPA_REPEATER_1.APP_GND_7" to="net.APP_GND" />
      <trace from="J_FPA_REPEATER_2.APP_GND_6" to="net.APP_GND" />
      <trace from="J_FPA_REPEATER_2.APP_GND_7" to="net.APP_GND" />
    </group>
  )
}
