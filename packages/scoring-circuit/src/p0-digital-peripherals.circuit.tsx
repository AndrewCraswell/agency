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

/**
 * P0's display and Ethernet peripherals. The parent circuit owns the ESP32 and
 * common reset: this block consumes their reviewed nets but creates
 * neither a second controller nor another reset authority.
 */
export function P0DigitalPeripherals({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group name="P0_DIGITAL_PERIPHERALS">
      <Bp033W5500ProjectFootprint name="U_W5500" pcbX={pcbX - 35} pcbY={pcbY} />
      <P0EthernetMagJackFootprint pcbX={pcbX - 5} pcbY={pcbY} />
      <P0W5500CrystalFootprint />
      <chip
        name="FB_W5500_AVDD"
        manufacturerPartNumber="BLM21PG221SN1D"
        footprint="0805"
        pinLabels={{ pin1: "APP_3V3", pin2: "ETH_AVDD" }}
      />
      <resistor
        name="R_W5500_XTAL"
        manufacturerPartNumber="ERJ3EKF1004V"
        resistance="1M"
        tolerance="1%"
        footprint="0603"
      />
      <resistor name="R_W5500_XO" manufacturerPartNumber="ERJ3GEY0R00V" resistance="0" footprint="0603" />
      <resistor
        name="R_W5500_EXRES"
        manufacturerPartNumber="ERJ3EKF1242V"
        resistance="12.4k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_W5500_INT_BIAS"
        manufacturerPartNumber="RC0603FR-07100KL"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
      />
      <capacitor name="C_W5500_XI" manufacturerPartNumber="CGA3E2C0G1H180J080AA" capacitance="18pF" footprint="0603" />
      <capacitor name="C_W5500_XO" manufacturerPartNumber="CGA3E2C0G1H180J080AA" capacitance="18pF" footprint="0603" />
      <capacitor
        name="C_W5500_TOCAP"
        manufacturerPartNumber="GRM21BR71C475KA73L"
        capacitance="4.7uF"
        footprint="0805"
      />
      <capacitor name="C_W5500_1V2O" manufacturerPartNumber="GRM188R71H103KA01D" capacitance="10nF" footprint="0603" />
      <capacitor name="C_W5500_VDD" manufacturerPartNumber="GRM188R71C104KA01D" capacitance="100nF" footprint="0603" />
      <capacitor
        name="C_ETH_AVDD_FERRITE_INPUT"
        manufacturerPartNumber="GRM188R71C104KA01D"
        capacitance="100nF"
        footprint="0603"
      />
      {w5500AvddPins.map((pin) => (
        <capacitor
          key={pin}
          name={`C_W5500_AVDD_${pin}`}
          manufacturerPartNumber="GRM188R71C104KA01D"
          capacitance="100nF"
          footprint="0603"
        />
      ))}
      <resistor
        name="R_ETH_TX_P_TERM"
        manufacturerPartNumber="RC0603FR-0749R9L"
        resistance="49.9"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_ETH_TX_N_TERM"
        manufacturerPartNumber="RC0603FR-0749R9L"
        resistance="49.9"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_ETH_RX_P_BIAS"
        manufacturerPartNumber="RC0603FR-0749R9L"
        resistance="49.9"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_ETH_RX_N_BIAS"
        manufacturerPartNumber="RC0603FR-0749R9L"
        resistance="49.9"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_ETH_TX_CT"
        manufacturerPartNumber="RC0603FR-0710RL"
        resistance="10"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_ETH_YELLOW"
        manufacturerPartNumber="RC0603FR-07330RL"
        resistance="330"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_ETH_GREEN"
        manufacturerPartNumber="RC0603FR-07330RL"
        resistance="330"
        tolerance="1%"
        footprint="0603"
      />
      <capacitor name="C_ETH_TX_CT" manufacturerPartNumber="C0603C223K5RACTU" capacitance="22nF" footprint="0603" />
      <capacitor name="C_ETH_RX_BIAS" manufacturerPartNumber="C0603C103K5RACTU" capacitance="10nF" footprint="0603" />
      <capacitor name="C_ETH_RX_P" manufacturerPartNumber="C0603C682J5RACTU" capacitance="6.8nF" footprint="0603" />
      <capacitor name="C_ETH_RX_N" manufacturerPartNumber="C0603C682J5RACTU" capacitance="6.8nF" footprint="0603" />
      <pinheader name="TP_W5500_INT_N" manufacturerPartNumber="5001" pinCount={1} pinLabels={["APP_W5500_INT_N"]} />

      <P0Hub75Ahct245Footprint reference="U_DISPLAY_BUFFER_A" pcbX={pcbX + 15} pcbY={pcbY - 12} />
      <P0Hub75Ahct245Footprint reference="U_DISPLAY_BUFFER_B" pcbX={pcbX + 15} pcbY={pcbY + 12} />
      {hub75Signals.map(([signal]) => {
        const reference = signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${signal}_PD`
        const part = hub75Part(reference)
        return (
          <resistor
            key={signal}
            name={reference}
            manufacturerPartNumber={part.mpn}
            resistance="10k"
            tolerance="1%"
            footprint={part.footprint}
          />
        )
      })}
      {(["A6", "A7", "A8"] as const).map((input) => {
        const reference = `R_HUB75_UNUSED_B_${input}_PD`
        const part = hub75Part(reference)
        return (
          <resistor
            key={input}
            name={reference}
            manufacturerPartNumber={part.mpn}
            resistance="10k"
            tolerance="1%"
            footprint={part.footprint}
          />
        )
      })}
      <resistor
        name="R_HUB75_PANEL_OE_PULLUP"
        manufacturerPartNumber={hub75Part("R_HUB75_PANEL_OE_PULLUP").mpn}
        resistance="10k"
        tolerance="1%"
        footprint="0603"
      />
      {(["A", "B"] as const).map((bank) => (
        <capacitor
          key={bank}
          name={`C_HUB75_BUF_${bank}_BYPASS`}
          manufacturerPartNumber={hub75Part(`C_HUB75_BUF_${bank}_BYPASS`).mpn}
          capacitance="100nF"
          footprint="0603"
        />
      ))}
      <P0Hub75EnableFetFootprint />
      <resistor
        name="R_DISPLAY_ENABLE_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_DISPLAY_ENABLE_GATE"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_DISPLAY_ENABLE_GATE_PD"
        manufacturerPartNumber="RC0603FR-07100KL"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
      />
      <P0Hub75ConnectorFootprint pcbX={pcbX + 42} pcbY={pcbY} />

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

export default P0DigitalPeripherals
