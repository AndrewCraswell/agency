import { Fragment, type ReactElement } from "react"
import { applicationDisplayHub75SupportPart } from "./application-display-carrier-support.js"
import { EthernetModuleFootprint } from "./ethernet-module-footprint.js"
import {
  P0Hub75Ahct245Footprint,
  P0Hub75ConnectorFootprint,
  P0Hub75EnableFetFootprint
} from "./p0-digital-peripheral-footprints.js"

const hub75Signals = [
  ["HUB75_R1", "U_DISPLAY_BUFFER_A", "A1", "B1", "R1"],
  ["HUB75_G1", "U_DISPLAY_BUFFER_A", "A2", "B2", "G1"],
  ["HUB75_B1", "U_DISPLAY_BUFFER_A", "A3", "B3", "B1"],
  ["HUB75_R2", "U_DISPLAY_BUFFER_A", "A4", "B4", "R2"],
  ["HUB75_G2", "U_DISPLAY_BUFFER_A", "A5", "B5", "G2"],
  ["HUB75_B2", "U_DISPLAY_BUFFER_A", "A6", "B6", "B2"],
  ["HUB75_A", "U_DISPLAY_BUFFER_A", "A7", "B7", "A"],
  ["HUB75_B", "U_DISPLAY_BUFFER_A", "A8", "B8", "B"],
  ["HUB75_C", "U_DISPLAY_BUFFER_B", "A1", "B1", "C"],
  ["HUB75_D", "U_DISPLAY_BUFFER_B", "A2", "B2", "D"],
  ["HUB75_CLK", "U_DISPLAY_BUFFER_B", "A3", "B3", "CLK"],
  ["HUB75_LAT", "U_DISPLAY_BUFFER_B", "A4", "B4", "LAT"],
  ["HUB75_OE_N", "U_DISPLAY_BUFFER_B", "A5", "B5", "OE"]
] as const

function hub75Part(reference: string) {
  return applicationDisplayHub75SupportPart(reference)
}

/**
 * P0's display and Ethernet peripherals. The parent circuit owns the ESP32
 * and common reset: this block consumes their reviewed nets but creates
 * neither a second controller nor another reset authority.
 *
 * Ethernet is deliberately a module boundary for the prototype. WIZ850io
 * contains the W5500, clock, PHY, transformer, magnetics, and RJ45; this
 * carrier only provides its two 1x6 sockets and host-side connections.
 */
export type P0DigitalPeripheralsProps = {
  readonly ethernet: { readonly pcbX: number; readonly pcbY: number }
  readonly hub75: { readonly pcbX: number; readonly pcbY: number }
  readonly pcbX: number
  readonly pcbY: number
}

export function P0DigitalPeripherals({ pcbX, pcbY, ethernet, hub75 }: P0DigitalPeripheralsProps): ReactElement {
  return (
    <group
      name="P0_DIGITAL_PERIPHERALS"
      pcbX={0}
      pcbY={0}
      pcbRelative
      pcbPositionMode="relative_to_board_anchor"
      pcbPack={false}
    >
      <EthernetModuleFootprint {...ethernet} pcbPositionMode="relative_to_board_anchor" />
      <P0Hub75ConnectorFootprint {...hub75} pcbPositionMode="relative_to_board_anchor" />

      {/** The buffers sit between ESP32-side signals and the HUB75 header. */}
      <group name="HUB75_SUPPORT" pcbX={pcbX} pcbY={pcbY + 85} pcbPack={false}>
        <P0Hub75Ahct245Footprint reference="U_DISPLAY_BUFFER_A" pcbX={30} pcbY={1} />
        <P0Hub75Ahct245Footprint reference="U_DISPLAY_BUFFER_B" pcbX={30} pcbY={13} />
        {hub75Signals.map(([signal]) => {
          const reference = signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${signal}_PD`
          const part = hub75Part(reference)
          const placement: Record<string, readonly [number, number]> = {
            R_HUB75_R1_PD: [21, 5],
            R_HUB75_G1_PD: [21, 3.4],
            R_HUB75_B1_PD: [21, 1.8],
            R_HUB75_R2_PD: [21, 0.2],
            R_HUB75_G2_PD: [21, -1.4],
            R_HUB75_B2_PD: [21, -3],
            R_HUB75_A_PD: [25, 5],
            R_HUB75_B_PD: [25, 1.8],
            R_HUB75_C_PD: [21, 17],
            R_HUB75_D_PD: [21, 15.4],
            R_HUB75_CLK_PD: [21, 13.8],
            R_HUB75_LAT_PD: [21, 12.2],
            R_HUB75_OE_PULLUP: [25, 16]
          }
          const [placementX, placementY] = placement[reference] ?? []
          if (placementX === undefined || placementY === undefined) {
            throw new RangeError(`missing explicit HUB75 placement for ${reference}`)
          }
          return (
            <resistor
              key={signal}
              name={reference}
              manufacturerPartNumber={part.mpn}
              resistance="10k"
              tolerance="1%"
              footprint={part.footprint}
              pcbX={placementX}
              pcbY={placementY}
            />
          )
        })}
        {(["A6", "A7", "A8"] as const).map((input) => {
          const reference = `R_HUB75_UNUSED_B_${input}_PD`
          const part = hub75Part(reference)
          const placement = { A6: [21, 10.5], A7: [21, 8.9], A8: [21, 7.3] }[input]
          return (
            <resistor
              key={input}
              name={reference}
              manufacturerPartNumber={part.mpn}
              resistance="10k"
              tolerance="1%"
              footprint={part.footprint}
              pcbX={placement[0]}
              pcbY={placement[1]}
            />
          )
        })}
        <resistor
          name="R_HUB75_PANEL_OE_PULLUP"
          manufacturerPartNumber={hub75Part("R_HUB75_PANEL_OE_PULLUP").mpn}
          resistance="10k"
          tolerance="1%"
          footprint="0603"
          pcbX={37}
          pcbY={13}
        />
        {(["A", "B"] as const).map((bank) => (
          <capacitor
            key={bank}
            name={`C_HUB75_BUF_${bank}_BYPASS`}
            manufacturerPartNumber={hub75Part(`C_HUB75_BUF_${bank}_BYPASS`).mpn}
            capacitance="100nF"
            footprint="0603"
            pcbX={30}
            pcbY={bank === "A" ? -6 : 20}
          />
        ))}
        <P0Hub75EnableFetFootprint pcbX={26} pcbY={24} />
        <resistor
          name="R_DISPLAY_ENABLE_PULLUP"
          manufacturerPartNumber="RC0603FR-0710KL"
          resistance="10k"
          tolerance="1%"
          footprint="0603"
          pcbX={31}
          pcbY={24}
        />
        <resistor
          name="R_DISPLAY_ENABLE_GATE"
          manufacturerPartNumber="RC0603FR-0710KL"
          resistance="10k"
          tolerance="1%"
          footprint="0603"
          pcbX={31}
          pcbY={28}
        />
        <resistor
          name="R_DISPLAY_ENABLE_GATE_PD"
          manufacturerPartNumber="RC0603FR-07100KL"
          resistance="100k"
          tolerance="1%"
          footprint="0603"
          pcbX={36}
          pcbY={24}
        />
      </group>

      <trace from="net.APP_SPI_SCK" to="U_ETHERNET.4" />
      <trace from="net.APP_SPI_MOSI" to="U_ETHERNET.3" />
      <trace from="U_ETHERNET.12" to="net.APP_SPI_MISO" />
      <trace from="net.ETH_CS_N" to="U_ETHERNET.5" />
      <trace from="net.APP_RESET_N" to="U_ETHERNET.11" />
      <trace from="U_ETHERNET.1" to="net.APP_GND" />
      <trace from="U_ETHERNET.2" to="net.APP_GND" />
      <trace from="U_ETHERNET.7" to="net.APP_GND" />
      <trace from="U_ETHERNET.8" to="net.APP_3V3" />
      <trace from="U_ETHERNET.9" to="net.APP_3V3" />

      {hub75Signals.map(([signal, buffer, input, output, panel]) => (
        <Fragment key={signal}>
          <trace from={`net.${signal}`} to={`${buffer}.${input}`} />
          <trace from={`${buffer}.${output}`} to={`J_HUB75.${panel}`} />
          <trace
            from={`${buffer}.${input}`}
            to={signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP.pin1" : `R_${signal}_PD.pin1`}
          />
          <trace
            from={signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP.pin2" : `R_${signal}_PD.pin2`}
            to={signal === "HUB75_OE_N" ? "net.APP_3V3" : "net.APP_GND"}
          />
        </Fragment>
      ))}
      <trace from="U_DISPLAY_BUFFER_A.DIR" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_B.DIR" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_A.V5_DISPLAY_LIMITED" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_B.V5_DISPLAY_LIMITED" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_A.APP_GND" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_B.APP_GND" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_A.V5_DISPLAY_LIMITED" to="C_HUB75_BUF_A_BYPASS.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.V5_DISPLAY_LIMITED" to="C_HUB75_BUF_B_BYPASS.pin1" />
      <trace from="C_HUB75_BUF_A_BYPASS.pin2" to="net.APP_GND" />
      <trace from="C_HUB75_BUF_B_BYPASS.pin2" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_B.A6_UNUSED" to="R_HUB75_UNUSED_B_A6_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.A7_UNUSED" to="R_HUB75_UNUSED_B_A7_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.A8_UNUSED" to="R_HUB75_UNUSED_B_A8_PD.pin1" />
      {(["A6", "A7", "A8"] as const).map((input) => (
        <trace key={input} from={`R_HUB75_UNUSED_B_${input}_PD.pin2`} to="net.APP_GND" />
      ))}
      <trace from="U_DISPLAY_BUFFER_B.B5" to="R_HUB75_PANEL_OE_PULLUP.pin1" />
      <trace from="R_HUB75_PANEL_OE_PULLUP.pin2" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_A.OE_N" to="net.DISPLAY_ENABLE_N" />
      <trace from="U_DISPLAY_BUFFER_B.OE_N" to="net.DISPLAY_ENABLE_N" />
      <trace from="Q_DISPLAY_ENABLE.DRAIN" to="net.DISPLAY_ENABLE_N" />
      <trace from="R_DISPLAY_ENABLE_PULLUP.pin1" to="net.DISPLAY_ENABLE_N" />
      <trace from="R_DISPLAY_ENABLE_PULLUP.pin2" to="net.V5_DISPLAY_LIMITED" />
      <trace from="Q_DISPLAY_ENABLE.SOURCE" to="net.APP_GND" />
      <trace from="net.APP_RESET_N" to="R_DISPLAY_ENABLE_GATE.pin1" />
      <trace from="R_DISPLAY_ENABLE_GATE.pin2" to="Q_DISPLAY_ENABLE.GATE" />
      <trace from="Q_DISPLAY_ENABLE.GATE" to="R_DISPLAY_ENABLE_GATE_PD.pin1" />
      <trace from="R_DISPLAY_ENABLE_GATE_PD.pin2" to="net.APP_GND" />
      {(["GND1", "GND2", "GND3"] as const).map((pin) => (
        <trace key={pin} from={`J_HUB75.${pin}`} to="net.APP_GND" />
      ))}
    </group>
  )
}
