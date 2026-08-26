import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

const pdMountingHoles = [
  { x: -7.62, y: -11.3665 },
  { x: 7.62, y: -11.3665 },
  { x: -7.747, y: 11.3665 },
  { x: 7.493, y: 11.3665 }
] as const

const regulatorPins = [
  { name: "VOUT_1", x: -10.16, y: 6.35 },
  { name: "VOUT_2", x: -7.62, y: 6.35 },
  { name: "GND_OUT_1", x: -10.16, y: 3.81 },
  { name: "GND_OUT_2", x: -7.62, y: 3.81 },
  { name: "GND_IN_1", x: -10.16, y: 1.27 },
  { name: "GND_IN_2", x: -7.62, y: 1.27 },
  { name: "VIN_1", x: -10.16, y: -1.27 },
  { name: "VIN_2", x: -7.62, y: -1.27 },
  { name: "VRP_1", x: -10.16, y: -3.81 },
  { name: "VRP_2", x: -7.62, y: -3.81 },
  { name: "EN", x: -10.16, y: -6.35 },
  { name: "PG", x: -7.62, y: -6.35 }
] as const

const regulatorMountingHoles = [
  { x: -10.5, y: -10.5 },
  { x: 10.6, y: -10.5 },
  { x: 10.6, y: 10.6 }
] as const

const pdModuleFootprint = (
  <footprint name="ADAFRUIT_5991_MOUNT_AND_WIRE_LANDINGS" originalLayer="top">
    <silkscreenrect pcbX={0} pcbY={0} width="20.32mm" height="27.813mm" strokeWidth="0.2mm" filled={false} />
    <silkscreentext text="USB-C" pcbX={0} pcbY={11.5} fontSize="1.2mm" />
    {pdMountingHoles.map(({ x, y }, index) => (
      <Fragment key={index}>
        <hole diameter="2.5mm" pcbX={x} pcbY={y} />
      </Fragment>
    ))}
    <platedhole
      name="PD_20V"
      shape="circular_hole_with_rect_pad"
      pcbX={-2.54}
      pcbY={-17}
      holeDiameter="1.5mm"
      rectPadWidth="3mm"
      rectPadHeight="3mm"
      rectBorderRadius="0mm"
      portHints={["1", "pin1", "PD_20V"]}
    />
    <platedhole
      name="APP_GND"
      shape="circular_hole_with_rect_pad"
      pcbX={2.54}
      pcbY={-17}
      holeDiameter="1.5mm"
      rectPadWidth="3mm"
      rectPadHeight="3mm"
      rectBorderRadius="1.5mm"
      portHints={["2", "pin2", "APP_GND"]}
    />
    <silkscreentext text="20V WIRE" pcbX={0} pcbY={-14.8} fontSize="0.9mm" />
    <courtyardrect pcbX={0} pcbY={-1.55} width="22mm" height="33.5mm" strokeWidth="0.05mm" />
  </footprint>
)

const regulatorFootprint = (
  <footprint name="POLOLU_D36V50F5_CARRIER" originalLayer="top">
    <silkscreenrect pcbX={0} pcbY={0} width="25.4mm" height="25.4mm" strokeWidth="0.2mm" filled={false} />
    {regulatorPins.map(({ name, x, y }, index) => (
      <Fragment key={name}>
        <platedhole
          name={name}
          shape="circular_hole_with_rect_pad"
          pcbX={x}
          pcbY={y}
          holeDiameter="1mm"
          rectPadWidth="1.8mm"
          rectPadHeight="1.8mm"
          rectBorderRadius={index === 0 ? "0mm" : "0.9mm"}
          portHints={[String(index + 1), `pin${index + 1}`, name]}
        />
      </Fragment>
    ))}
    {regulatorMountingHoles.map(({ x, y }, index) => (
      <Fragment key={index}>
        <hole diameter="2.18mm" pcbX={x} pcbY={y} />
      </Fragment>
    ))}
    <silkscreentext text="5V REG" pcbX={3.5} pcbY={0} fontSize="1mm" />
    <courtyardrect pcbX={0} pcbY={0} width="27mm" height="27mm" strokeWidth="0.05mm" />
  </footprint>
)

const pdPinLabels = { pin1: "PD_20V", pin2: "APP_GND" } as const
const regulatorPinLabels = Object.fromEntries(regulatorPins.map(({ name }, index) => [`pin${index + 1}`, name]))

export const usbCPowerAssembly = {
  pdModule: "Adafruit 5991 HUSB238 USB-C PD switchable breakout",
  pdSetting: "20V",
  regulatorModule: "Pololu D36V50F5 5V step-down regulator",
  assemblyWire: "Two short 18 AWG jumpers from the PD terminal block to the labeled carrier landings"
} as const

export function UsbCPower(): ReactElement {
  return (
    <group name="USB_C_POWER">
      <chip
        name="U_USB_C_PD"
        manufacturerPartNumber="5991"
        pinLabels={pdPinLabels}
        footprint={pdModuleFootprint}
        pcbX={-62}
        pcbY={34.5}
        pcbPositionMode="relative_to_board_anchor"
        cadModel={cadModels.usbCPdModule}
      />
      <chip
        name="U_V5_REGULATOR"
        manufacturerPartNumber="D36V50F5"
        pinLabels={regulatorPinLabels}
        footprint={regulatorFootprint}
        pcbX={-34}
        pcbY={34}
        pcbPositionMode="relative_to_board_anchor"
        cadModel={cadModels.v5RegulatorModule}
      />

      <trace from="U_USB_C_PD.PD_20V" to="U_V5_REGULATOR.VIN_1" width="1mm" />
      <trace from="U_USB_C_PD.PD_20V" to="U_V5_REGULATOR.VIN_2" width="1mm" />
      <trace from="U_USB_C_PD.APP_GND" to="U_V5_REGULATOR.GND_IN_1" width="1mm" />
      <trace from="U_USB_C_PD.APP_GND" to="U_V5_REGULATOR.GND_IN_2" width="1mm" />
      <trace from="U_V5_REGULATOR.VOUT_1" to="net.V5" width="1mm" />
      <trace from="U_V5_REGULATOR.VOUT_2" to="net.V5" width="1mm" />
      <trace from="U_V5_REGULATOR.GND_OUT_1" to="net.APP_GND" width="1mm" />
      <trace from="U_V5_REGULATOR.GND_OUT_2" to="net.APP_GND" width="1mm" />
      <trace from="U_V5_REGULATOR.EN" to="U_V5_REGULATOR.VIN_1" width="0.5mm" />
    </group>
  )
}
