import { Fragment, type ReactElement } from "react"

/**
 * WIZ850io carrier pin map from the manufacturer's J1/J2 pin tables.
 * The module includes the W5500, oscillator, PHY, transformer, magnetics, and
 * RJ45; the prototype carrier only needs two 1x6 through-hole sockets.
 */
export const ethernetModulePins = [
  { header: "J1", headerPin: 1, pin: 1, signal: "APP_GND", x: -10.16, y: -6.35 },
  { header: "J1", headerPin: 2, pin: 2, signal: "APP_GND", x: -10.16, y: -3.81 },
  { header: "J1", headerPin: 3, pin: 3, signal: "APP_SPI_MOSI", x: -10.16, y: -1.27 },
  { header: "J1", headerPin: 4, pin: 4, signal: "APP_SPI_SCK", x: -10.16, y: 1.27 },
  { header: "J1", headerPin: 5, pin: 5, signal: "ETH_CS_N", x: -10.16, y: 3.81 },
  { header: "J1", headerPin: 6, pin: 6, signal: "APP_W5500_INT_N", x: -10.16, y: 6.35 },
  { header: "J2", headerPin: 1, pin: 7, signal: "APP_GND", x: 10.16, y: -6.35 },
  { header: "J2", headerPin: 2, pin: 8, signal: "APP_3V3", x: 10.16, y: -3.81 },
  { header: "J2", headerPin: 3, pin: 9, signal: "APP_3V3", x: 10.16, y: -1.27 },
  { header: "J2", headerPin: 4, pin: 10, signal: "NC", x: 10.16, y: 1.27 },
  { header: "J2", headerPin: 5, pin: 11, signal: "APP_RESET_N", x: 10.16, y: 3.81 },
  { header: "J2", headerPin: 6, pin: 12, signal: "APP_SPI_MISO", x: 10.16, y: 6.35 }
] as const

const ethernetModulePinLabels = Object.fromEntries(ethernetModulePins.map(({ pin, signal }) => [`pin${pin}`, signal]))

const ethernetModuleFootprint = (
  <footprint name="WIZ850IO_TWO_1X6_2P54_FOOTPRINT" originalLayer="top">
    <silkscreenrect pcbX={0} pcbY={0} width="23mm" height="25mm" strokeWidth="0.1mm" filled={false} />
    <silkscreenrect pcbX={-10.16} pcbY={0} width="2mm" height="15.24mm" strokeWidth="0.1mm" filled={false} />
    <silkscreenrect pcbX={10.16} pcbY={0} width="2mm" height="15.24mm" strokeWidth="0.1mm" filled={false} />
    {ethernetModulePins.map(({ header, headerPin, pin, signal, x, y }) => (
      <Fragment key={pin}>
        <platedhole
          name={`${header}_${headerPin}`}
          shape="circular_hole_with_rect_pad"
          pcbX={x}
          pcbY={y}
          holeDiameter="1mm"
          rectPadWidth="1.7mm"
          rectPadHeight="1.7mm"
          rectBorderRadius={pin === 1 ? "0mm" : "0.85mm"}
          portHints={[String(pin), `pin${pin}`, signal, `${header}.${headerPin}`]}
        />
      </Fragment>
    ))}
    <courtyardrect pcbX={0} pcbY={0} width="25mm" height="27mm" strokeWidth="0.05mm" />
  </footprint>
)

export const ethernetModule = {
  manufacturer: "WIZnet",
  manufacturerPartNumber: "WIZ850io",
  sourceUrl: "https://docs.wiznet.io/Product/ioModule/WIZ850io",
  moduleOutlineMm: { width: 23, height: 25 },
  pinPitchMm: 2.54,
  pinMap: ethernetModulePins
} as const

export interface EthernetModuleFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
  readonly pcbPositionMode?: "relative_to_board_anchor"
}

export function EthernetModuleFootprint({
  pcbX,
  pcbY,
  pcbRotation,
  pcbPositionMode
}: EthernetModuleFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_ETHERNET"
      manufacturerPartNumber="WIZ850io"
      pinLabels={ethernetModulePinLabels}
      footprint={ethernetModuleFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
      pcbPositionMode={pcbPositionMode}
    />
  )
}
