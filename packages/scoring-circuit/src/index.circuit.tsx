import type { ReactElement } from "react"
import { cadModels } from "./cad-models.js"
import { minimalPrototypeBoard } from "./clean-sheet-board-architecture.js"
import { EthernetModuleFootprint } from "./ethernet-module-footprint.js"
import { FaveroDataLine } from "./favero-data-line.circuit.js"
import { PrototypePeripherals } from "./prototype-peripherals.circuit.js"
import { ScoringConductorInterface } from "./scoring-conductor-interface.circuit.js"
import { UsbCPower } from "./usb-c-power.circuit.js"

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
  "GPIO37",
  "GPIO36",
  "GPIO35",
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

export const controllerSocket = {
  rowSpacingMm: 22.86,
  leftRowX: 1.57,
  rightRowX: 24.43,
  outlineWidthMm: 25.4,
  outlineHeightMm: 69,
  // Keep the DevKitC USB/programming connector at the lower board edge.
  center: { pcbX: 13, pcbY: -15 }
} as const

export const prototypeInterfaces = {
  weaponLeft: ["LEFT_A", "LEFT_B", "LEFT_C"],
  weaponRight: ["RIGHT_A", "RIGHT_B", "RIGHT_C"],
  piste: ["PISTE"],
  powerInput: ["USB-C PD 20V", "V5", "APP_GND"],
  repeaterOutputs: ["FA-05 DATA-LINE 1", "FA-05 DATA-LINE 2"]
} as const

const controllerModuleFootprint = (
  <footprint name="ESP32_S3_DEVKITC_ASSEMBLY_OUTLINE" originalLayer="top">
    <silkscreenrect
      pcbX={0}
      pcbY={0}
      width={`${controllerSocket.outlineWidthMm}mm`}
      height={`${controllerSocket.outlineHeightMm}mm`}
      strokeWidth="0.2mm"
      filled={false}
    />
  </footprint>
)

function MinimalScoringPrototype(): ReactElement {
  const { widthMm, heightMm, layerCount, title } = minimalPrototypeBoard
  const halfWidth = widthMm / 2
  const halfHeight = heightMm / 2

  return (
    <board
      title={title}
      width={`${widthMm}mm`}
      height={`${heightMm}mm`}
      layers={layerCount}
      solderMaskColor="black"
      silkscreenColor="white"
      pcbPack={false}
    >
      <copperpour
        name="GROUND_PLANE"
        layer="bottom"
        connectsTo="net.APP_GND"
        clearance="0.25mm"
        boardEdgeMargin="0.5mm"
      />
      <hole name="H1" diameter="3.2mm" pcbX={-halfWidth + 5} pcbY={-halfHeight + 5} />
      <hole name="H2" diameter="3.2mm" pcbX={halfWidth - 5} pcbY={-halfHeight + 5} />
      <hole name="H3" diameter="3.2mm" pcbX={-halfWidth + 5} pcbY={halfHeight - 5} />
      <hole name="H4" diameter="3.2mm" pcbX={halfWidth - 5} pcbY={halfHeight - 5} />

      <pinheader
        name="J_CONTROLLER_LEFT"
        manufacturerPartNumber="PPTC221LFBN-RC"
        pinCount={22}
        pinLabels={[...controllerLeftPins]}
        pcbX={controllerSocket.leftRowX}
        pcbY={controllerSocket.center.pcbY}
        pcbRotation={90}
        cadModel={cadModels.pinSocket1x22}
      />
      <chip
        name="U_CONTROLLER_MODULE"
        manufacturerPartNumber="ESP32-S3-DevKitC-1-N8R8"
        footprint={controllerModuleFootprint}
        noSchematicRepresentation
        obstructsWithinBounds={false}
        pcbX={controllerSocket.center.pcbX}
        pcbY={controllerSocket.center.pcbY}
        cadModel={cadModels.controllerDevKit}
      />
      <pinheader
        name="J_CONTROLLER_RIGHT"
        manufacturerPartNumber="PPTC221LFBN-RC"
        pinCount={22}
        pinLabels={[...controllerRightPins]}
        pcbX={controllerSocket.rightRowX}
        pcbY={controllerSocket.center.pcbY}
        pcbRotation={90}
        cadModel={cadModels.pinSocket1x22}
      />

      <pinheader
        name="J_WEAPON_LEFT"
        manufacturerPartNumber="PREC003SAAN-RC"
        pinCount={3}
        pinLabels={[...prototypeInterfaces.weaponLeft]}
        pcbX={-68}
        pcbY={-15}
        cadModel={cadModels.pinHeader1x03}
      />
      <pinheader
        name="J_WEAPON_RIGHT"
        manufacturerPartNumber="PREC003SAAN-RC"
        pinCount={3}
        pinLabels={[...prototypeInterfaces.weaponRight]}
        pcbX={-68}
        pcbY={0}
        cadModel={cadModels.pinHeader1x03}
      />
      <pinheader
        name="J_PISTE"
        manufacturerPartNumber="PREC001SAAN-RC"
        pinCount={1}
        pinLabels={[...prototypeInterfaces.piste]}
        pcbX={-76.5}
        pcbY={15}
        cadModel={cadModels.pinHeader1x01}
      />
      <UsbCPower />
      <EthernetModuleFootprint pcbX={-20} pcbY={-32} pcbRotation={180} />
      <ScoringConductorInterface pcbX={-48} pcbY={0} />
      <PrototypePeripherals />
      <FaveroDataLine />

      <trace from="J_CONTROLLER_LEFT.1" to="net.APP_3V3" />
      <trace from="J_CONTROLLER_LEFT.2" to="net.APP_3V3" />
      <trace from="J_CONTROLLER_LEFT.3" to="net.APP_RESET_N" />
      <trace from="J_CONTROLLER_LEFT.21" to="net.V5" />
      <trace from="J_CONTROLLER_LEFT.22" to="net.APP_GND" />
      <trace from="J_CONTROLLER_RIGHT.1" to="net.APP_GND" />
      <trace from="J_CONTROLLER_RIGHT.21" to="net.APP_GND" />
      <trace from="J_CONTROLLER_RIGHT.22" to="net.APP_GND" />

      <trace from="J_WEAPON_LEFT.LEFT_A" to="net.LEFT_A" />
      <trace from="J_WEAPON_LEFT.LEFT_B" to="net.LEFT_B" />
      <trace from="J_WEAPON_LEFT.LEFT_C" to="net.LEFT_C" />
      <trace from="J_WEAPON_RIGHT.RIGHT_A" to="net.RIGHT_A" />
      <trace from="J_WEAPON_RIGHT.RIGHT_B" to="net.RIGHT_B" />
      <trace from="J_WEAPON_RIGHT.RIGHT_C" to="net.RIGHT_C" />
      <trace from="J_PISTE.PISTE" to="net.PISTE" />

      <trace from="J_CONTROLLER_LEFT.15" to="net.SCORING_LEFT_A" />
      <trace from="J_CONTROLLER_LEFT.16" to="net.SCORING_LEFT_B" />
      <trace from="J_CONTROLLER_LEFT.17" to="net.SCORING_LEFT_C" />
      <trace from="J_CONTROLLER_LEFT.18" to="net.SCORING_RIGHT_A" />
      <trace from="J_CONTROLLER_LEFT.19" to="net.SCORING_RIGHT_B" />
      <trace from="J_CONTROLLER_LEFT.20" to="net.SCORING_RIGHT_C" />
      <trace from="J_CONTROLLER_RIGHT.4" to="net.SCORING_PISTE" />

      <trace from="J_CONTROLLER_LEFT.10" to="net.APP_SPI_SCK" />
      <trace from="J_CONTROLLER_RIGHT.18" to="net.APP_SPI_MOSI" />
      <trace from="J_CONTROLLER_RIGHT.19" to="net.APP_SPI_MISO" />
      <trace from="J_CONTROLLER_RIGHT.17" to="net.ETH_CS_N" />
      <trace from="J_CONTROLLER_RIGHT.9" to="net.ETH_INT_N" />
      <trace from="U_ETHERNET.4" to="net.APP_SPI_SCK" />
      <trace from="U_ETHERNET.3" to="net.APP_SPI_MOSI" />
      <trace from="U_ETHERNET.12" to="net.APP_SPI_MISO" />
      <trace from="U_ETHERNET.5" to="net.ETH_CS_N" />
      <trace from="U_ETHERNET.6" to="net.ETH_INT_N" />
      <trace from="U_ETHERNET.11" to="net.APP_RESET_N" />
      <trace from="U_ETHERNET.8" to="net.APP_3V3" />
      <trace from="U_ETHERNET.9" to="net.APP_3V3" />
      <trace from="U_ETHERNET.1" to="net.APP_GND" />
      <trace from="U_ETHERNET.2" to="net.APP_GND" />
      <trace from="U_ETHERNET.7" to="net.APP_GND" />

      <trace from="J_CONTROLLER_RIGHT.10" to="net.IR_RX" />
      <trace from="J_CONTROLLER_RIGHT.16" to="net.BUZZER_DRIVE" />
      <trace from="J_CONTROLLER_RIGHT.2" to="net.FAVERO_DATA_TX" />

      <trace from="J_CONTROLLER_LEFT.4" to="net.HUB75_R1" />
      <trace from="J_CONTROLLER_LEFT.5" to="net.HUB75_G1" />
      <trace from="J_CONTROLLER_LEFT.6" to="net.HUB75_B1" />
      <trace from="J_CONTROLLER_LEFT.7" to="net.HUB75_R2" />
      <trace from="J_CONTROLLER_LEFT.8" to="net.HUB75_G2" />
      <trace from="J_CONTROLLER_LEFT.9" to="net.HUB75_B2" />
      <trace from="J_CONTROLLER_LEFT.11" to="net.HUB75_A" />
      <trace from="J_CONTROLLER_LEFT.12" to="net.HUB75_B" />
      <trace from="J_CONTROLLER_LEFT.13" to="net.HUB75_C" />
      <trace from="J_CONTROLLER_RIGHT.6" to="net.HUB75_D" />
      <trace from="J_CONTROLLER_RIGHT.7" to="net.HUB75_CLK" />
      <trace from="J_CONTROLLER_RIGHT.8" to="net.HUB75_LAT" />
      <trace from="J_CONTROLLER_RIGHT.5" to="net.HUB75_OE" />
    </board>
  )
}

export default MinimalScoringPrototype
