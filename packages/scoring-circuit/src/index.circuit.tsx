import type { ReactElement } from "react"
import { minimalPrototypeBoard } from "./clean-sheet-board-architecture.js"
import { EthernetModuleFootprint } from "./ethernet-module-footprint.js"

export const controllerLeftPins = [
  "APP_3V3",
  "APP_3V3",
  "APP_RESET_N",
  "GPIO4",
  "GPIO5",
  "GPIO6",
  "GPIO7",
  "GPIO15",
  "GPIO16",
  "GPIO17",
  "GPIO18",
  "GPIO8",
  "GPIO3",
  "GPIO46",
  "GPIO9",
  "GPIO10",
  "GPIO11",
  "GPIO12",
  "GPIO13",
  "GPIO14",
  "V5",
  "APP_GND"
] as const

export const controllerRightPins = [
  "APP_GND",
  "GPIO43_UART_TX",
  "GPIO44_UART_RX",
  "GPIO1",
  "GPIO2",
  "GPIO42",
  "GPIO41",
  "GPIO40",
  "GPIO39",
  "GPIO38_RGB",
  "RESERVED_GPIO37",
  "RESERVED_GPIO36",
  "RESERVED_GPIO35",
  "GPIO0_BOOT",
  "GPIO45",
  "GPIO48",
  "GPIO47",
  "GPIO21",
  "GPIO20_USB_D_PLUS",
  "GPIO19_USB_D_MINUS",
  "APP_GND",
  "APP_GND"
] as const

export const prototypeInterfaces = {
  weaponLeft: ["LEFT_A", "LEFT_B", "LEFT_C"],
  weaponRight: ["RIGHT_A", "RIGHT_B", "RIGHT_C"],
  piste: ["PISTE"],
  ir: ["APP_3V3", "IR_RX", "APP_GND"],
  buzzer: ["BUZZER_DRIVE", "APP_GND"],
  displayPower: ["V5", "APP_GND"],
  powerInput: ["V5", "APP_GND"],
  hub75: ["R1", "G1", "B1", "APP_GND", "R2", "G2", "B2", "APP_GND", "A", "B", "C", "D", "CLK", "LAT", "OE_N", "APP_GND"]
} as const

function MinimalScoringPrototype(): ReactElement {
  const { widthMm, heightMm, layerCount, title } = minimalPrototypeBoard
  const halfWidth = widthMm / 2
  const halfHeight = heightMm / 2

  return (
    <board title={title} width={`${widthMm}mm`} height={`${heightMm}mm`} layers={layerCount} pcbPack={false}>
      <hole name="H1" diameter="3.2mm" pcbX={-halfWidth + 5} pcbY={-halfHeight + 5} />
      <hole name="H2" diameter="3.2mm" pcbX={halfWidth - 5} pcbY={-halfHeight + 5} />
      <hole name="H3" diameter="3.2mm" pcbX={-halfWidth + 5} pcbY={halfHeight - 5} />
      <hole name="H4" diameter="3.2mm" pcbX={halfWidth - 5} pcbY={halfHeight - 5} />

      <pinheader
        name="J_CONTROLLER_LEFT"
        pinCount={22}
        pinLabels={[...controllerLeftPins]}
        pcbX={18}
        pcbY={0}
        pcbRotation={90}
      />
      <pinheader
        name="J_CONTROLLER_RIGHT"
        pinCount={22}
        pinLabels={[...controllerRightPins]}
        pcbX={43.4}
        pcbY={0}
        pcbRotation={90}
      />

      <pinheader
        name="J_WEAPON_LEFT"
        pinCount={3}
        pinLabels={[...prototypeInterfaces.weaponLeft]}
        pcbX={-68}
        pcbY={-15}
      />
      <pinheader
        name="J_WEAPON_RIGHT"
        pinCount={3}
        pinLabels={[...prototypeInterfaces.weaponRight]}
        pcbX={-68}
        pcbY={0}
      />
      <pinheader name="J_PISTE" pinCount={1} pinLabels={[...prototypeInterfaces.piste]} pcbX={-68} pcbY={15} />
      <pinheader
        name="J_POWER_INPUT"
        pinCount={2}
        pinLabels={[...prototypeInterfaces.powerInput]}
        pcbX={-55}
        pcbY={40}
      />
      <pinheader
        name="J_DISPLAY_POWER"
        pinCount={2}
        pinLabels={[...prototypeInterfaces.displayPower]}
        pcbX={-20}
        pcbY={40}
      />
      <pinheader name="J_IR" pinCount={3} pinLabels={[...prototypeInterfaces.ir]} pcbX={65} pcbY={35} />
      <pinheader name="J_BUZZER" pinCount={2} pinLabels={[...prototypeInterfaces.buzzer]} pcbX={65} pcbY={20} />
      <pinheader name="J_HUB75" pinCount={16} doubleRow pinLabels={[...prototypeInterfaces.hub75]} pcbX={65} pcbY={0} />
      <EthernetModuleFootprint pcbX={-25} pcbY={-25} />
    </board>
  )
}

export default MinimalScoringPrototype
