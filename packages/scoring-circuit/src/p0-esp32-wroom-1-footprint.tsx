import { Fragment, type ReactElement } from "react"

const moduleMpn = "ESP32-S3-WROOM-1-N16R2"

type PadPosition = {
  readonly number: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const sidePads = Array.from({ length: 14 }, (_, index) => ({
  number: index + 1,
  x: -8.75,
  y: Number((8.255 - index * 1.27).toFixed(3)),
  width: 1.5,
  height: 0.9
}))
const bottomPads = Array.from({ length: 12 }, (_, index) => ({
  number: index + 15,
  x: Number((-6.985 + index * 1.27).toFixed(3)),
  y: -9.5,
  width: 0.9,
  height: 1.5
}))
const oppositeSidePads = Array.from({ length: 14 }, (_, index) => ({
  number: index + 27,
  x: 8.75,
  y: Number((-8.255 + index * 1.27).toFixed(3)),
  width: 1.5,
  height: 0.9
}))

const perimeterPads: readonly PadPosition[] = [...sidePads, ...bottomPads, ...oppositeSidePads]
const thermalVias = [
  [-2.9, -0.9],
  [-1.5, -0.9],
  [-0.1, -0.9],
  [-2.9, 0.5],
  [-1.5, 0.5],
  [-0.1, 0.5],
  [-2.9, 1.9],
  [-1.5, 1.9],
  [-0.1, 1.9]
] as const

export const p0Esp32Wroom1FootprintMetadata = {
  manufacturer: "Espressif Systems",
  manufacturerPartNumber: moduleMpn,
  package: {
    bodyMm: { width: 18, length: 25.5, height: 3.1 },
    perimeterPadCount: 40,
    exposedGroundPad: 41,
    perimeterPitchMm: 1.27
  },
  integratedAntennaKeepout: {
    preferredPlacement: "antenna projects past the base-board edge",
    fallbackClearanceMm: 15,
    appliesIn: "all directions around the antenna area",
    prohibited: ["copper", "routing", "components"],
    baseBoard: "cut away below the antenna area when it cannot project past the edge",
    enclosure: "keep metal away and verify finished-product throughput and range"
  },
  projectGeometry: {
    status: "renderable-review-candidate",
    padTopology: "40 perimeter terminals and nine EPAD thermal vias",
    blocker:
      "The retained evidence directory has only the WROOM-1U DXF and STEP. The official WROOM-1 DXF and STEP are not retained, so this source must not be treated as an exact fabrication footprint until they are imported and independently overlaid.",
    fabricationAuthorized: false
  }
} as const

const footprint = (
  <footprint name="P0_ESP32_S3_WROOM_1_N16R2_REVIEW_CANDIDATE" originalLayer="top">
    {perimeterPads.map((pad) => (
      <Fragment key={pad.number}>
        <smtpad
          name={String(pad.number)}
          pcbX={pad.x}
          pcbY={pad.y}
          shape="rect"
          width={`${pad.width}mm`}
          height={`${pad.height}mm`}
          solderMaskMargin="0mm"
          solderPasteMargin="-1mm"
          portHints={[String(pad.number), `pin${pad.number}`]}
        />
      </Fragment>
    ))}
    {thermalVias.map(([x, y], index) => (
      <Fragment key={`thermal-${index + 1}`}>
        <platedhole
          name={`EP_VIA_${index + 1}`}
          pcbX={x}
          pcbY={y}
          shape="circular_hole_with_rect_pad"
          holeDiameter="0.5mm"
          rectPadWidth="0.9mm"
          rectPadHeight="0.9mm"
          rectBorderRadius="0mm"
          solderMaskMargin="0mm"
          portHints={["41", "GND_EP", "thermal-via"]}
        />
      </Fragment>
    ))}
    <keepout shape="rect" pcbX={0} pcbY={18} width="48mm" height="36mm" layers={["top", "bottom"]} />
  </footprint>
)

export type P0Esp32Wroom1FootprintProps = {
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Review-only WROOM-1 renderer with the integrated-antenna exclusion zone. */
export function P0Esp32Wroom1Footprint({ pcbX, pcbY }: P0Esp32Wroom1FootprintProps): ReactElement {
  return (
    <chip
      name="U_APP"
      manufacturerPartNumber={moduleMpn}
      pcbX={pcbX}
      pcbY={pcbY}
      pinLabels={{
        pin1: "APP_GND",
        pin2: "APP_3V3",
        pin3: "EN_RESET",
        pin4: "SAR_SCLK",
        pin5: "SAR_DOUT",
        pin6: "SAR_CONVST",
        pin7: "LAMP_RED",
        pin8: "LAMP_GREEN",
        pin9: "HUB75_R2",
        pin10: "LAMP_WHITE_LEFT",
        pin11: "APP_SPI_SCK",
        pin12: "APP_SPI_MOSI",
        pin13: "USB_DN",
        pin14: "USB_DP",
        pin15: "NC_STRAP_QUIET",
        pin16: "HUB75_CLK",
        pin17: "APP_SPI_MISO",
        pin18: "LAMP_WHITE_RIGHT",
        pin19: "BUZZER",
        pin20: "APP_WD_KICK",
        pin21: "HUB75_R1",
        pin22: "HUB75_G1",
        pin23: "HUB75_B1",
        pin24: "SOURCE_LATCH",
        pin25: "HUB75_LAT",
        pin26: "HUB75_D",
        pin27: "BOOT_N",
        pin28: "IR_RX",
        pin29: "SOURCE_OE_N",
        pin30: "P0_SPARE_GPIO37",
        pin31: "HUB75_G2",
        pin32: "HUB75_B2",
        pin33: "HUB75_A",
        pin34: "HUB75_B",
        pin35: "HUB75_C",
        pin36: "UART0_RX",
        pin37: "UART0_TX",
        pin38: "ETH_CS_N",
        pin39: "HUB75_OE_N",
        pin40: "APP_GND",
        pin41: "APP_GND"
      }}
      footprint={footprint}
    />
  )
}

export default P0Esp32Wroom1Footprint
