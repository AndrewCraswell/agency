import { type ReactElement } from "react"
import { applicationDisplayHub75SupportPart } from "./application-display-carrier-support.js"
import { Bp033W5500ProjectFootprint } from "./bp033-w5500-project-footprint.js"
import {
  P0EthernetMagJackFootprint,
  P0Hub75Ahct245Footprint,
  P0Hub75ConnectorFootprint,
  P0Hub75EnableFetFootprint,
  P0W5500CrystalFootprint
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

const w5500AvddPins = [4, 8, 11, 15, 17, 21] as const
const w5500GroundPins = [3, 9, 14, 16, 19, 29, 48] as const
function hub75Part(reference: string) {
  return applicationDisplayHub75SupportPart(reference)
}

type PcbPoint = readonly [number, number]

/** Convert readable support-group coordinates to the first buffer's frame. */
function localPcbPath(origin: PcbPoint, points: readonly PcbPoint[]) {
  return points.map(([x, y]) => ({ x: x - origin[0], y: y - origin[1] }))
}

const hub75BInputPcbPath = localPcbPath(
  [30, 1],
  [
    [26.5, -1.275],
    [26.5, 4],
    [24.175, 4]
  ]
)
const hub75UnusedA6PcbPath = localPcbPath(
  [30, 13],
  [
    [26.5, 12.025],
    [26.5, 14],
    [20.175, 14]
  ]
)
const hub75UnusedA8PcbPath = localPcbPath(
  [30, 13],
  [
    [26.5, 10.725],
    [26.5, 5],
    [20.175, 5]
  ]
)

function hub75UnusedPcbPath(input: "A6" | "A7" | "A8") {
  if (input === "A6") return hub75UnusedA6PcbPath
  if (input === "A8") return hub75UnusedA8PcbPath
  return undefined
}

/**
 * P0's display and Ethernet peripherals. The parent circuit owns the ESP32 and
 * common reset: this block consumes their reviewed nets but creates
 * neither a second controller nor another reset authority.
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
      <P0EthernetMagJackFootprint {...ethernet} pcbPositionMode="relative_to_board_anchor" />
      <P0Hub75ConnectorFootprint {...hub75} pcbPositionMode="relative_to_board_anchor" />

      {/*
       * Keep the W5500, clock, MDI conditioning, and RJ45-facing passives as
       * one explicit placement island. The old grid put electrically related
       * parts on opposite sides of the board; these coordinates are local to
       * the Ethernet support anchor in millimetres.
       */}
      <group name="ETHERNET_SUPPORT" pcbX={pcbX} pcbY={pcbY} pcbPack={false}>
        <Bp033W5500ProjectFootprint name="U_W5500" pcbX={20} pcbY={5} />
        <P0W5500CrystalFootprint pcbX={28} pcbY={5} />
        <chip
          name="FB_W5500_AVDD"
          manufacturerPartNumber="BLM21PG221SN1D"
          footprint="0805"
          pinLabels={{ pin1: "APP_3V3", pin2: "ETH_AVDD" }}
          pcbX={4}
          pcbY={-6}
        />
        <resistor
          name="R_W5500_XTAL"
          manufacturerPartNumber="ERJ3EKF1004V"
          resistance="1M"
          tolerance="1%"
          footprint="0603"
          pcbX={28}
          pcbY={10}
        />
        <resistor
          name="R_W5500_XO"
          manufacturerPartNumber="ERJ3GEY0R00V"
          resistance="0"
          footprint="0603"
          pcbX={28}
          pcbY={0}
        />
        <resistor
          name="R_W5500_EXRES"
          manufacturerPartNumber="ERJ3EKF1242V"
          resistance="12.4k"
          tolerance="1%"
          footprint="0603"
          pcbX={9}
          pcbY={-6}
        />
        <resistor
          name="R_W5500_INT_BIAS"
          manufacturerPartNumber="RC0603FR-07100KL"
          resistance="100k"
          tolerance="1%"
          footprint="0603"
          pcbX={32}
          pcbY={14}
        />
        <capacitor
          name="C_W5500_XI"
          manufacturerPartNumber="CGA3E2C0G1H180J080AA"
          capacitance="18pF"
          footprint="0603"
          pcbX={32}
          pcbY={10}
        />
        <capacitor
          name="C_W5500_XO"
          manufacturerPartNumber="CGA3E2C0G1H180J080AA"
          capacitance="18pF"
          footprint="0603"
          pcbX={32}
          pcbY={0}
        />
        <capacitor
          name="C_W5500_TOCAP"
          manufacturerPartNumber="GRM21BR71C475KA73L"
          capacitance="4.7uF"
          footprint="0805"
          pcbX={12}
          pcbY={13}
        />
        <capacitor
          name="C_W5500_1V2O"
          manufacturerPartNumber="GRM188R71H103KA01D"
          capacitance="10nF"
          footprint="0603"
          pcbX={13}
          pcbY={18}
        />
        <capacitor
          name="C_W5500_VDD"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={23}
          pcbY={14}
        />
        <capacitor
          name="C_ETH_AVDD_FERRITE_INPUT"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={0}
          pcbY={-6}
        />
        <capacitor
          name="C_W5500_AVDD_4"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={13}
          pcbY={8}
        />
        <capacitor
          name="C_W5500_AVDD_8"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={13}
          pcbY={4}
        />
        <capacitor
          name="C_W5500_AVDD_11"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={13}
          pcbY={0}
        />
        <capacitor
          name="C_W5500_AVDD_15"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={18}
          pcbY={14}
        />
        <capacitor
          name="C_W5500_AVDD_17"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={23}
          pcbY={18}
        />
        <capacitor
          name="C_W5500_AVDD_21"
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
          pcbX={27}
          pcbY={18}
        />
        <resistor
          name="R_ETH_TX_P_TERM"
          manufacturerPartNumber="RC0603FR-0749R9L"
          resistance="49.9"
          tolerance="1%"
          footprint="0603"
          pcbX={9}
          pcbY={9}
        />
        <resistor
          name="R_ETH_TX_N_TERM"
          manufacturerPartNumber="RC0603FR-0749R9L"
          resistance="49.9"
          tolerance="1%"
          footprint="0603"
          pcbX={9}
          pcbY={6}
        />
        <resistor
          name="R_ETH_RX_P_BIAS"
          manufacturerPartNumber="RC0603FR-0749R9L"
          resistance="49.9"
          tolerance="1%"
          footprint="0603"
          pcbX={9}
          pcbY={2}
        />
        <resistor
          name="R_ETH_RX_N_BIAS"
          manufacturerPartNumber="RC0603FR-0749R9L"
          resistance="49.9"
          tolerance="1%"
          footprint="0603"
          pcbX={9}
          pcbY={-2}
        />
        <resistor
          name="R_ETH_TX_CT"
          manufacturerPartNumber="RC0603FR-0710RL"
          resistance="10"
          tolerance="1%"
          footprint="0603"
          pcbX={34}
          pcbY={9}
        />
        <resistor
          name="R_ETH_YELLOW"
          manufacturerPartNumber="RC0603FR-07330RL"
          resistance="330"
          tolerance="1%"
          footprint="0603"
          pcbX={34}
          pcbY={19}
        />
        <resistor
          name="R_ETH_GREEN"
          manufacturerPartNumber="RC0603FR-07330RL"
          resistance="330"
          tolerance="1%"
          footprint="0603"
          pcbX={38}
          pcbY={19}
        />
        <capacitor
          name="C_ETH_TX_CT"
          manufacturerPartNumber="C0603C223K5RACTU"
          capacitance="22nF"
          footprint="0603"
          pcbX={34}
          pcbY={6}
        />
        <capacitor
          name="C_ETH_RX_BIAS"
          manufacturerPartNumber="C0603C103K5RACTU"
          capacitance="10nF"
          footprint="0603"
          pcbX={35}
          pcbY={2}
        />
        <capacitor
          name="C_ETH_RX_P"
          manufacturerPartNumber="C0603C682J5RACTU"
          capacitance="6.8nF"
          footprint="0603"
          pcbX={29}
          pcbY={9}
        />
        <capacitor
          name="C_ETH_RX_N"
          manufacturerPartNumber="C0603C682J5RACTU"
          capacitance="6.8nF"
          footprint="0603"
          pcbX={29}
          pcbY={1}
        />
        <pinheader
          name="TP_W5500_INT_N"
          manufacturerPartNumber="5001"
          pinCount={1}
          pinLabels={["APP_W5500_INT_N"]}
          pcbX={37}
          pcbY={14}
        />
      </group>

      {/*
       * The buffers sit between the ESP32-side signals and the right-edge
       * HUB75 header. Pulls are on the input side of their matching buffer;
       * OE protection and bypass parts stay at the local buffer edge.
       */}
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

      <trace from="net.APP_SPI_SCK" to="U_W5500.33" />
      <trace from="net.APP_SPI_MOSI" to="U_W5500.35" />
      <trace from="U_W5500.34" to="net.APP_SPI_MISO" />
      <trace from="net.ETH_CS_N" to="U_W5500.32" />
      <trace from="net.APP_RESET_N" to="U_W5500.37" />
      <trace from="U_W5500.36" to="R_W5500_INT_BIAS.pin1" />
      <trace from="R_W5500_INT_BIAS.pin2" to="net.APP_3V3" />
      <trace from="U_W5500.36" to="TP_W5500_INT_N.APP_W5500_INT_N" />
      <trace from="U_W5500.28" to="net.APP_3V3" />
      <trace from="U_W5500.28" to="C_W5500_VDD.pin1" />
      <trace from="C_W5500_VDD.pin2" to="net.APP_GND" />
      <trace from="net.APP_3V3" to="C_ETH_AVDD_FERRITE_INPUT.pin1" />
      <trace from="C_ETH_AVDD_FERRITE_INPUT.pin2" to="net.APP_GND" />
      <trace from="net.APP_3V3" to="FB_W5500_AVDD.APP_3V3" />
      <trace from="FB_W5500_AVDD.ETH_AVDD" to="net.ETH_AVDD" />
      {w5500AvddPins.map((pin) => (
        <group key={pin}>
          <trace from={`U_W5500.${pin}`} to="net.ETH_AVDD" />
          <trace from="net.ETH_AVDD" to={`C_W5500_AVDD_${pin}.pin1`} />
          <trace from={`C_W5500_AVDD_${pin}.pin2`} to="net.APP_GND" />
        </group>
      ))}
      {w5500GroundPins.map((pin) => (
        <trace key={String(pin)} from={`U_W5500.${pin}`} to="net.APP_GND" />
      ))}
      {[43, 44, 45].map((pin) => (
        <trace key={String(pin)} from={`U_W5500.${pin}`} to="net.APP_3V3" />
      ))}
      <trace from="U_W5500.10" to="R_W5500_EXRES.pin1" />
      <trace from="R_W5500_EXRES.pin2" to="net.APP_GND" />
      <trace from="U_W5500.20" to="C_W5500_TOCAP.pin1" />
      <trace from="C_W5500_TOCAP.pin2" to="net.APP_GND" />
      <trace from="U_W5500.22" to="C_W5500_1V2O.pin1" />
      <trace from="C_W5500_1V2O.pin2" to="net.APP_GND" />
      <trace from="U_W5500.30" to="Y_W5500.XI" />
      <trace from="Y_W5500.XO" to="R_W5500_XO.pin1" />
      <trace from="R_W5500_XO.pin2" to="U_W5500.31" />
      <trace from="Y_W5500.XI" to="R_W5500_XTAL.pin1" />
      <trace from="R_W5500_XTAL.pin2" to="Y_W5500.XO" />
      <trace from="Y_W5500.XI" to="C_W5500_XI.pin1" />
      <trace from="Y_W5500.XO" to="C_W5500_XO.pin1" />
      <trace from="C_W5500_XI.pin2" to="net.APP_GND" />
      <trace from="C_W5500_XO.pin2" to="net.APP_GND" />
      <trace from="Y_W5500.GND_2" to="net.APP_GND" />
      <trace from="Y_W5500.GND_4" to="net.APP_GND" />

      <trace from="U_W5500.2" to="J_ETH.TD_P" />
      <trace from="U_W5500.1" to="J_ETH.TD_N" />
      <trace from="U_W5500.6" to="C_ETH_RX_P.pin1" />
      <trace from="C_ETH_RX_P.pin2" to="J_ETH.RD_P" />
      <trace from="U_W5500.5" to="C_ETH_RX_N.pin1" />
      <trace from="C_ETH_RX_N.pin2" to="J_ETH.RD_N" />
      <trace from="U_W5500.2" to="R_ETH_TX_P_TERM.pin1" />
      <trace from="U_W5500.1" to="R_ETH_TX_N_TERM.pin1" />
      <trace from="R_ETH_TX_P_TERM.pin2" to="net.ETH_AVDD" />
      <trace from="R_ETH_TX_N_TERM.pin2" to="net.ETH_AVDD" />
      <trace from="U_W5500.6" to="R_ETH_RX_P_BIAS.pin1" />
      <trace from="U_W5500.5" to="R_ETH_RX_N_BIAS.pin1" />
      <trace from="R_ETH_RX_P_BIAS.pin2" to="net.ETH_RX_BIAS" />
      <trace from="R_ETH_RX_N_BIAS.pin2" to="net.ETH_RX_BIAS" />
      <trace from="J_ETH.CRD" to="net.ETH_RX_BIAS" />
      <trace from="C_ETH_RX_BIAS.pin1" to="net.ETH_RX_BIAS" />
      <trace from="C_ETH_RX_BIAS.pin2" to="net.APP_GND" />
      <trace from="J_ETH.CTD" to="R_ETH_TX_CT.pin1" />
      <trace from="R_ETH_TX_CT.pin2" to="net.ETH_AVDD" />
      <trace from="J_ETH.CTD" to="C_ETH_TX_CT.pin1" />
      <trace from="C_ETH_TX_CT.pin2" to="net.APP_GND" />
      <trace from="net.APP_3V3" to="R_ETH_YELLOW.pin1" />
      <trace from="R_ETH_YELLOW.pin2" to="J_ETH.YELLOW_A" />
      <trace from="J_ETH.YELLOW_K" to="U_W5500.27" />
      <trace from="net.APP_3V3" to="R_ETH_GREEN.pin1" />
      <trace from="R_ETH_GREEN.pin2" to="J_ETH.GREEN_A" />
      <trace from="J_ETH.GREEN_K" to="U_W5500.25" />
      <trace from="J_ETH.CHASSIS_TERMINATION" to="net.CHASSIS_ETHERNET" />
      <trace from="J_ETH.SHIELD_A" to="net.CHASSIS_ETHERNET" />
      <trace from="J_ETH.SHIELD_B" to="net.CHASSIS_ETHERNET" />

      {hub75Signals.flatMap(([signal, buffer, input, output, panel]) => [
        <trace key={`${signal}-input`} from={`net.${signal}`} to={`${buffer}.${input}`} />,
        <trace key={`${signal}-output`} from={`${buffer}.${output}`} to={`J_HUB75.${panel}`} />,
        <trace
          key={`${signal}-default`}
          from={`${buffer}.${input}`}
          to={signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP.pin1" : `R_${signal}_PD.pin1`}
          pcbPath={signal === "HUB75_B" ? hub75BInputPcbPath : undefined}
        />,
        <trace
          key={`${signal}-return`}
          from={signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP.pin2" : `R_${signal}_PD.pin2`}
          to={signal === "HUB75_OE_N" ? "net.APP_3V3" : "net.APP_GND"}
        />
      ])}
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
      <trace from="U_DISPLAY_BUFFER_B.A6_UNUSED" to="R_HUB75_UNUSED_B_A6_PD.pin1" pcbPath={hub75UnusedPcbPath("A6")} />
      <trace from="U_DISPLAY_BUFFER_B.A7_UNUSED" to="R_HUB75_UNUSED_B_A7_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.A8_UNUSED" to="R_HUB75_UNUSED_B_A8_PD.pin1" pcbPath={hub75UnusedPcbPath("A8")} />
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
