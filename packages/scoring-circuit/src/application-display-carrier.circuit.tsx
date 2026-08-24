import { applicationDisplayHub75SupportPart } from "./application-display-carrier-support.js"
import { manufacturerFootprintProps } from "./manufacturer-footprint-adapter.js"
import { isolatedInterboardPinLabels, physicalBoardContract } from "./physical-board-contract.js"

export const hub75Signals = [
  ["HUB75_R1", "U_DISPLAY_BUFFER_A", "R1_IN", "R1_OUT", "R1"],
  ["HUB75_G1", "U_DISPLAY_BUFFER_A", "G1_IN", "G1_OUT", "G1"],
  ["HUB75_B1", "U_DISPLAY_BUFFER_A", "B1_IN", "B1_OUT", "B1"],
  ["HUB75_R2", "U_DISPLAY_BUFFER_A", "R2_IN", "R2_OUT", "R2"],
  ["HUB75_G2", "U_DISPLAY_BUFFER_A", "G2_IN", "G2_OUT", "G2"],
  ["HUB75_B2", "U_DISPLAY_BUFFER_A", "B2_IN", "B2_OUT", "B2"],
  ["HUB75_A", "U_DISPLAY_BUFFER_A", "A_IN", "A_OUT", "A"],
  ["HUB75_B", "U_DISPLAY_BUFFER_A", "B_IN", "B_OUT", "B"],
  ["HUB75_C", "U_DISPLAY_BUFFER_B", "C_IN", "C_OUT", "C"],
  ["HUB75_D", "U_DISPLAY_BUFFER_B", "D_IN", "D_OUT", "D"],
  ["HUB75_CLK", "U_DISPLAY_BUFFER_B", "CLK_IN", "CLK_OUT", "CLK"],
  ["HUB75_LAT", "U_DISPLAY_BUFFER_B", "LAT_IN", "LAT_OUT", "LAT"],
  ["HUB75_OE_N", "U_DISPLAY_BUFFER_B", "OE_N_IN", "OE_N_OUT", "OE"]
] as const

/** Separate physical planning model; DNP interfaces and footprint gates remain fail-closed. */
export default function ApplicationDisplayCarrierCircuit() {
  const board = physicalBoardContract.applicationDisplayCarrier
  return (
    <board title={board.title} width={`${board.widthMm}mm`} height={`${board.heightMm}mm`} layers={board.layers}>
      <chip
        name="J_ISO_SCORING_BOUNDARY"
        manufacturerPartNumber="ISOLATED-INTERBOARD-CONNECTOR-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={isolatedInterboardPinLabels}
        pcbX={-125}
        pcbY={0}
      />
      <chip
        name="U_ESP32"
        manufacturerPartNumber="ESP32-S3-WROOM-1U-N16R2"
        {...manufacturerFootprintProps("ESP32-S3-WROOM-1U-N16R2")}
        footprint={[]}
        pinLabels={{
          pin1: "GND",
          pin2: "V3_3",
          pin3: "EN_RESET",
          pin4: "SCORE_SCK",
          pin5: "SCORE_MOSI",
          pin6: "SCORE_MISO",
          pin7: "SCORE_CS",
          pin8: "ESP_HEARTBEAT",
          pin9: "HUB75_R2",
          pin10: "STM_HEARTBEAT",
          pin11: "APP_SPI_SCK",
          pin12: "APP_SPI_MOSI",
          pin13: "USB_DN",
          pin14: "USB_DP",
          pin16: "HUB75_CLK",
          pin17: "APP_SPI_MISO",
          pin18: "I2C_SDA",
          pin19: "I2C_SCL",
          pin20: "WD_KICK",
          pin21: "HUB75_R1",
          pin22: "HUB75_G1",
          pin23: "HUB75_B1",
          pin24: "FRAM_CS",
          pin25: "HUB75_LAT",
          pin26: "HUB75_D",
          pin28: "I2S_BCLK",
          pin29: "I2S_WCLK",
          pin30: "I2S_DIN",
          pin31: "HUB75_G2",
          pin32: "HUB75_B2",
          pin33: "HUB75_A",
          pin34: "HUB75_B",
          pin35: "HUB75_C",
          pin38: "ETH_CS",
          pin39: "HUB75_OE_N",
          pin40: "GND_2",
          pin41: "EPAD_GND"
        }}
        pcbX={-90}
        pcbY={0}
      />
      <chip
        name="U_ESP_WATCHDOG"
        manufacturerPartNumber="TPS3431SDRBR"
        footprint="qfn8"
        pinLabels={{
          pin1: "V3_3",
          pin2: "CWD",
          pin3: "EN",
          pin4: "GND",
          pin5: "SET1",
          pin6: "WDI",
          pin7: "RESET",
          pin8: "ENOUT"
        }}
      />
      <chip
        name="U_ESP_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        {...manufacturerFootprintProps("TPS389033DSER")}
        footprint={[]}
        pinLabels={{ pin1: "SENSE", pin2: "GND", pin3: "MR", pin4: "V3_3", pin5: "CT", pin6: "RESET" }}
      />
      <resistor name="R_ESP_WD_CWD" resistance="10k" tolerance="1%" footprint="0603" />
      <capacitor name="C_ESP_WD_BYPASS" capacitance="100nF" footprint="0603" />
      <capacitor
        name="C_ESP_SUPERVISOR_CT"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
      />
      <capacitor
        name="C_ESP_SUPERVISOR_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
      />
      <resistor
        name="R_ESP_EN_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
      />
      <capacitor name="C_ESP_EN_DELAY" capacitance="1uF" footprint="0603" />
      <chip
        name="Q_ESP_RESET_STM"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
      />
      <chip
        name="Q_ESP_DEBUG_RESET"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
      />
      {(["STM", "DEBUG"] as const).flatMap((source) => [
        <resistor
          key={`${source}-gate`}
          name={`R_${source}_RESET_GATE`}
          resistance="10k"
          tolerance="1%"
          footprint="0603"
        />,
        <resistor
          key={`${source}-pd`}
          name={`R_${source}_RESET_GATE_PD`}
          resistance="100k"
          tolerance="1%"
          footprint="0603"
        />
      ])}

      <chip
        name="J_CTRL_CARRIER"
        manufacturerPartNumber="Molex 43045-1200"
        {...manufacturerFootprintProps("Molex 43045-1200")}
        footprint={[]}
        pinLabels={{
          pin1: "GND_1",
          pin2: "W5500_SCK",
          pin3: "GND_2",
          pin4: "W5500_MOSI",
          pin5: "GND_3",
          pin6: "W5500_MISO",
          pin7: "GND_4",
          pin8: "W5500_CS_N",
          pin9: "W5500_INT_N",
          pin10: "COMM_RESET_ASSERT",
          pin11: "COMM_PRESENT_N",
          pin12: "GND_5"
        }}
      />
      {(["SCK", "MOSI", "CS"] as const).map((signal) => (
        <resistor key={signal} name={`R_COMM_${signal}_SERIES`} resistance="33" tolerance="1%" footprint="0603" />
      ))}
      <resistor name="R_COMM_SCK_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_MOSI_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_CS_N_DEFAULT_HIGH" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_MISO_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_RESET_ASSERT_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_PRESENT_N_ABSENT_PULLUP" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_INT_N_IDLE_PULLUP" resistance="100k" tolerance="1%" footprint="0603" />
      <pinheader name="TP_COMM_RESET_ASSERT" pinCount={1} pinLabels={["COMM_RESET_ASSERT_TEST_ONLY"]} />
      <pinheader name="TP_COMM_PRESENT_N" pinCount={1} pinLabels={["COMM_PRESENT_N"]} />
      <pinheader name="TP_COMM_INT_N" pinCount={1} pinLabels={["W5500_INT_N_POLLING_ONLY"]} />
      <chip
        name="J_PWR_CARRIER"
        manufacturerPartNumber="Molex 43045-0400"
        {...manufacturerFootprintProps("Molex 43045-0400")}
        footprint={[]}
        pinLabels={{ pin1: "V20_EFUSE_OUT_A", pin2: "GND_A", pin3: "V20_EFUSE_OUT_B", pin4: "GND_B" }}
      />
      <chip
        name="J_USB2_CARRIER"
        manufacturerPartNumber="HSEC8-113-01-L-DV-A-L2"
        {...manufacturerFootprintProps("HSEC8-113-01-L-DV-A-L2")}
        footprint={[]}
        pinLabels={{ pin1: "USB_DN", pin2: "USB_DP", pin3: "SHIELD" }}
      />
      <chip
        name="R_USB_DN_CARRIER"
        manufacturerPartNumber="22R_1PCT_0402"
        footprint="0402"
        pinLabels={{ pin1: "USB_DN_FROM_COMM", pin2: "USB_DN" }}
      />
      <chip
        name="R_USB_DP_CARRIER"
        manufacturerPartNumber="22R_1PCT_0402"
        footprint="0402"
        pinLabels={{ pin1: "USB_DP_FROM_COMM", pin2: "USB_DP" }}
      />

      <chip
        name="U_V5_BUCK"
        manufacturerPartNumber="TPS56A37RPAR"
        {...manufacturerFootprintProps("TPS56A37RPAR")}
        footprint={[]}
        pinLabels={{
          pin1: "EN",
          pin2: "FB",
          pin3: "AGND",
          pin4: "PG",
          pin5: "SS",
          pin6: "SW",
          pin7: "BOOT",
          pin8: "VIN",
          pin9: "PGND",
          pin10: "MODE"
        }}
      />
      <chip
        name="L_V5_BUCK"
        manufacturerPartNumber="744325330"
        {...manufacturerFootprintProps("744325330")}
        footprint={[]}
        pinLabels={{ pin1: "SW", pin2: "V5_SENSE_IN" }}
      />
      <chip
        name="R_V5_SENSE"
        manufacturerPartNumber="CRE2512-FZ-R002E-3"
        {...manufacturerFootprintProps("CRE2512-FZ-R002E-3")}
        footprint={[]}
        pinLabels={{ pin1: "V5_SENSE_IN", pin2: "V5" }}
      />
      <chip
        name="U_APP_REGULATOR"
        manufacturerPartNumber="LMR43620MSC3RPERQ1"
        {...manufacturerFootprintProps("LMR43620MSC3RPERQ1")}
        footprint={[]}
        pinLabels={{
          pin1: "MODE_SYNC",
          pin2: "PGOOD",
          pin3: "EN_UVLO",
          pin4: "VIN",
          pin5: "SW",
          pin6: "BOOT",
          pin7: "VCC",
          pin8: "VOUT_FB",
          pin9: "GND"
        }}
      />
      <chip
        name="L_APP_REGULATOR"
        manufacturerPartNumber="XGL4030-222MEC"
        {...manufacturerFootprintProps("XGL4030-222MEC")}
        footprint={[]}
        pinLabels={{ pin1: "SW", pin2: "V3_3" }}
      />
      <chip
        name="U_POWER_MONITOR"
        manufacturerPartNumber="INA238AIDGSR"
        footprint="vssop10"
        pinLabels={{ pin1: "VIN_P", pin2: "VIN_N", pin3: "GND", pin4: "SDA", pin5: "SCL", pin10: "V3_3" }}
      />
      <capacitor name="C_V5_BUCK_IN_HF" manufacturerPartNumber="885012206095" capacitance="100nF" footprint="0603" />
      <capacitor name="C_V5_BUCK_BOOT" manufacturerPartNumber="885012206095" capacitance="100nF" footprint="0603" />
      <chip
        name="C_V5_BUCK_OUT_A"
        manufacturerPartNumber="GRM32ER71E226KE15L"
        {...manufacturerFootprintProps("GRM32ER71E226KE15L")}
        footprint={[]}
        pinLabels={{ pin1: "V5", pin2: "GND" }}
      />
      <resistor name="R_V5_BUCK_FB_TOP" resistance="73.2k" tolerance="0.5%" footprint="0603" />
      <resistor name="R_V5_BUCK_FB_BOTTOM" resistance="10k" tolerance="0.5%" footprint="0603" />
      <resistor name="R_V5_BUCK_EN_UP" resistance="88.7k" tolerance="1%" footprint="0603" />
      <resistor name="R_V5_BUCK_EN_DOWN" resistance="6.04k" tolerance="1%" footprint="0603" />

      <chip
        name="U_FRAM"
        manufacturerPartNumber="CY15B104Q-LHXIT"
        footprint="qfn8"
        pinLabels={{
          pin1: "CS",
          pin2: "MISO",
          pin3: "WP",
          pin4: "GND",
          pin5: "MOSI",
          pin6: "SCK",
          pin7: "HOLD",
          pin8: "V3_3"
        }}
      />
      <resistor name="R_FRAM_WP_PULLUP" resistance="10k" tolerance="1%" footprint="0603" />
      <resistor name="R_FRAM_HOLD_PULLUP" resistance="10k" tolerance="1%" footprint="0603" />
      <chip
        name="U_RTC"
        manufacturerPartNumber="RV-3028-C7"
        footprint="qfn8"
        pinLabels={{ pin1: "CLKOUT", pin2: "INT", pin3: "SCL", pin4: "SDA", pin5: "GND", pin8: "V3_3" }}
      />
      <chip
        name="U_SECURE_ELEMENT"
        manufacturerPartNumber="STSAFE-A110"
        footprint="qfn8"
        pinLabels={{ pin1: "SDA", pin2: "SCL", pin3: "GND", pin4: "V3_3" }}
      />
      <chip
        name="U_AUDIO"
        manufacturerPartNumber="TAS2505TRGERQ1"
        {...manufacturerFootprintProps("TAS2505TRGERQ1")}
        footprint={[]}
        pinLabels={{
          pin1: "SPI_SEL",
          pin2: "RESET_N",
          pin6: "AVSS",
          pin9: "SPK_N",
          pin10: "V5",
          pin11: "GND",
          pin12: "SPK_P",
          pin13: "I2S_DIN",
          pin14: "I2S_WCLK",
          pin15: "I2S_BCLK",
          pin19: "I2C_SCL",
          pin20: "I2C_SDA",
          pin22: "V3_3",
          pin23: "DVDD",
          pin24: "DVSS"
        }}
      />
      <pinheader name="J_SPEAKER" pinCount={2} pinLabels={["SPK_P", "SPK_N"]} />
      <pinheader
        name="J_ESP_DEBUG"
        pinCount={6}
        pinLabels={["V3_3", "TX", "RX", "MANUAL_RESET_ASSERT", "BOOT", "GND"]}
      />

      <chip
        name="U_DISPLAY_BUFFER_A"
        manufacturerPartNumber={applicationDisplayHub75SupportPart("U_DISPLAY_BUFFER_A").mpn}
        footprint={applicationDisplayHub75SupportPart("U_DISPLAY_BUFFER_A").footprint}
        pinLabels={{
          pin1: "DIR_TO_PANEL",
          pin2: "R1_IN",
          pin3: "G1_IN",
          pin4: "B1_IN",
          pin5: "R2_IN",
          pin6: "G2_IN",
          pin7: "B2_IN",
          pin8: "A_IN",
          pin9: "B_IN",
          pin10: "GND",
          pin11: "B_OUT",
          pin12: "A_OUT",
          pin13: "B2_OUT",
          pin14: "G2_OUT",
          pin15: "R2_OUT",
          pin16: "B1_OUT",
          pin17: "G1_OUT",
          pin18: "R1_OUT",
          pin19: "BUFFER_ENABLE_N",
          pin20: "V5"
        }}
      />
      <chip
        name="U_DISPLAY_BUFFER_B"
        manufacturerPartNumber={applicationDisplayHub75SupportPart("U_DISPLAY_BUFFER_B").mpn}
        footprint={applicationDisplayHub75SupportPart("U_DISPLAY_BUFFER_B").footprint}
        pinLabels={{
          pin1: "DIR_TO_PANEL",
          pin2: "C_IN",
          pin3: "D_IN",
          pin4: "CLK_IN",
          pin5: "LAT_IN",
          pin6: "OE_N_IN",
          pin7: "UNUSED_A6_PD",
          pin8: "UNUSED_A7_PD",
          pin9: "UNUSED_A8_PD",
          pin10: "GND",
          pin11: "UNUSED_B8_NC",
          pin12: "UNUSED_B7_NC",
          pin13: "UNUSED_B6_NC",
          pin14: "OE_N_OUT",
          pin15: "LAT_OUT",
          pin16: "CLK_OUT",
          pin17: "D_OUT",
          pin18: "C_OUT",
          pin19: "BUFFER_ENABLE_N",
          pin20: "V5"
        }}
      />
      {hub75Signals.map(([espSignal]) => (
        <resistor
          key={espSignal}
          name={espSignal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${espSignal}_PD`}
          manufacturerPartNumber={
            applicationDisplayHub75SupportPart(espSignal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${espSignal}_PD`)
              .mpn
          }
          resistance="10k"
          tolerance="1%"
          footprint={
            applicationDisplayHub75SupportPart(espSignal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${espSignal}_PD`)
              .footprint
          }
        />
      ))}
      {(["A6", "A7", "A8"] as const).map((input) => (
        <resistor
          key={input}
          name={`R_HUB75_UNUSED_B_${input}_PD`}
          manufacturerPartNumber={applicationDisplayHub75SupportPart(`R_HUB75_UNUSED_B_${input}_PD`).mpn}
          resistance="10k"
          tolerance="1%"
          footprint={applicationDisplayHub75SupportPart(`R_HUB75_UNUSED_B_${input}_PD`).footprint}
        />
      ))}
      <resistor
        name="R_HUB75_PANEL_OE_PULLUP"
        manufacturerPartNumber={applicationDisplayHub75SupportPart("R_HUB75_PANEL_OE_PULLUP").mpn}
        resistance="10k"
        tolerance="1%"
        footprint={applicationDisplayHub75SupportPart("R_HUB75_PANEL_OE_PULLUP").footprint}
      />
      <capacitor
        name="C_HUB75_BUF_A_BYPASS"
        manufacturerPartNumber={applicationDisplayHub75SupportPart("C_HUB75_BUF_A_BYPASS").mpn}
        capacitance="100nF"
        footprint={applicationDisplayHub75SupportPart("C_HUB75_BUF_A_BYPASS").footprint}
      />
      <capacitor
        name="C_HUB75_BUF_B_BYPASS"
        manufacturerPartNumber={applicationDisplayHub75SupportPart("C_HUB75_BUF_B_BYPASS").mpn}
        capacitance="100nF"
        footprint={applicationDisplayHub75SupportPart("C_HUB75_BUF_B_BYPASS").footprint}
      />
      {(["A", "B"] as const).flatMap((bank) => [
        <chip
          key={`${bank}-enable`}
          name={`Q_DISPLAY_BUFFER_${bank}_ENABLE`}
          manufacturerPartNumber={applicationDisplayHub75SupportPart(`Q_DISPLAY_BUFFER_${bank}_ENABLE`).mpn}
          footprint={applicationDisplayHub75SupportPart(`Q_DISPLAY_BUFFER_${bank}_ENABLE`).footprint}
          pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        />,
        <resistor
          key={`${bank}-pullup`}
          name={`R_BUFFER_${bank}_ENABLE_PULLUP`}
          manufacturerPartNumber={applicationDisplayHub75SupportPart(`R_BUFFER_${bank}_ENABLE_PULLUP`).mpn}
          resistance="10k"
          tolerance="1%"
          footprint={applicationDisplayHub75SupportPart(`R_BUFFER_${bank}_ENABLE_PULLUP`).footprint}
        />,
        <resistor
          key={`${bank}-gate`}
          name={`R_BUFFER_${bank}_GATE`}
          manufacturerPartNumber={applicationDisplayHub75SupportPart(`R_BUFFER_${bank}_GATE`).mpn}
          resistance="10k"
          tolerance="1%"
          footprint={applicationDisplayHub75SupportPart(`R_BUFFER_${bank}_GATE`).footprint}
        />,
        <resistor
          key={`${bank}-pd`}
          name={`R_BUFFER_${bank}_GATE_PD`}
          manufacturerPartNumber={applicationDisplayHub75SupportPart(`R_BUFFER_${bank}_GATE_PD`).mpn}
          resistance="100k"
          tolerance="1%"
          footprint={applicationDisplayHub75SupportPart(`R_BUFFER_${bank}_GATE_PD`).footprint}
        />
      ])}
      <pinheader name="J_DISPLAY_DISCONNECT" pinCount={2} pinLabels={["V5_SOURCE", "V5_DISPLAY_LIMITED"]} />
      <pinheader
        name="J_LINK_DISPLAY"
        manufacturerPartNumber="39-28-1023"
        pinCount={2}
        pinLabels={["V5_DISPLAY_LIMITED_IN", "V5_DISPLAY_LIMITED_OUT"]}
      />
      <pinheader
        name="J_HUB75"
        pinCount={16}
        doubleRow
        pinLabels={["R1", "G1", "B1", "GND1", "R2", "G2", "B2", "GND2", "A", "B", "C", "D", "CLK", "LAT", "OE", "GND3"]}
      />

      <trace from="J_ISO_SCORING_BOUNDARY.V5_PRIMARY" to="net.V5" />
      <trace from="J_ISO_SCORING_BOUNDARY.APP_GND_PRIMARY" to="net.APP_GND" />
      <trace from="J_ISO_SCORING_BOUNDARY.V3_3_APP" to="net.V3_3" />
      <trace from="J_ISO_SCORING_BOUNDARY.APP_GND_LOGIC" to="net.APP_GND" />
      <trace from="net.APP_GND" to="net.GND" />
      <trace from="J_ISO_SCORING_BOUNDARY.SCORE_SCK" to="U_ESP32.SCORE_SCK" />
      <trace from="J_ISO_SCORING_BOUNDARY.SCORE_MOSI" to="U_ESP32.SCORE_MOSI" />
      <trace from="J_ISO_SCORING_BOUNDARY.SCORE_MISO" to="U_ESP32.SCORE_MISO" />
      <trace from="J_ISO_SCORING_BOUNDARY.SCORE_CS" to="U_ESP32.SCORE_CS" />
      <trace from="J_ISO_SCORING_BOUNDARY.STM_HEARTBEAT" to="U_ESP32.STM_HEARTBEAT" />
      <trace from="U_ESP32.ESP_HEARTBEAT" to="J_ISO_SCORING_BOUNDARY.ESP_HEARTBEAT" />
      <trace from="J_ISO_SCORING_BOUNDARY.ESP_RESET_ASSERT" to="R_STM_RESET_GATE.pin1" />
      <trace from="R_STM_RESET_GATE.pin2" to="Q_ESP_RESET_STM.G" />
      <trace from="Q_ESP_RESET_STM.G" to="R_STM_RESET_GATE_PD.pin1" />
      <trace from="R_STM_RESET_GATE_PD.pin2" to="net.GND" />
      <trace from="Q_ESP_RESET_STM.D" to="U_ESP32.EN_RESET" />
      <trace from="Q_ESP_RESET_STM.S" to="net.GND" />
      <trace from="J_ESP_DEBUG.MANUAL_RESET_ASSERT" to="R_DEBUG_RESET_GATE.pin1" />
      <trace from="R_DEBUG_RESET_GATE.pin2" to="Q_ESP_DEBUG_RESET.G" />
      <trace from="Q_ESP_DEBUG_RESET.G" to="R_DEBUG_RESET_GATE_PD.pin1" />
      <trace from="R_DEBUG_RESET_GATE_PD.pin2" to="net.GND" />
      <trace from="Q_ESP_DEBUG_RESET.D" to="U_ESP32.EN_RESET" />
      <trace from="Q_ESP_DEBUG_RESET.S" to="net.GND" />
      <trace from="U_ESP32.EN_RESET" to="R_ESP_EN_PULLUP.pin1" />
      <trace from="R_ESP_EN_PULLUP.pin2" to="net.V3_3" />
      <trace from="U_ESP32.EN_RESET" to="C_ESP_EN_DELAY.pin1" />
      <trace from="C_ESP_EN_DELAY.pin2" to="net.GND" />

      <trace from="J_USB2_CARRIER.USB_DN" to="R_USB_DN_CARRIER.USB_DN_FROM_COMM" />
      <trace from="J_USB2_CARRIER.USB_DP" to="R_USB_DP_CARRIER.USB_DP_FROM_COMM" />
      <trace from="R_USB_DN_CARRIER.USB_DN" to="U_ESP32.USB_DN" />
      <trace from="R_USB_DP_CARRIER.USB_DP" to="U_ESP32.USB_DP" />
      <trace from="J_USB2_CARRIER.SHIELD" to="net.CHASSIS" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_A" to="U_V5_BUCK.VIN" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_B" to="U_V5_BUCK.VIN" />
      <trace from="J_PWR_CARRIER.GND_A" to="net.GND" />
      <trace from="J_PWR_CARRIER.GND_B" to="net.GND" />
      <trace from="U_V5_BUCK.SW" to="L_V5_BUCK.SW" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_A" to="R_V5_BUCK_EN_UP.pin1" />
      <trace from="R_V5_BUCK_EN_UP.pin2" to="U_V5_BUCK.EN" />
      <trace from="U_V5_BUCK.EN" to="R_V5_BUCK_EN_DOWN.pin1" />
      <trace from="R_V5_BUCK_EN_DOWN.pin2" to="net.GND" />
      <trace from="U_V5_BUCK.AGND" to="net.GND" />
      <trace from="U_V5_BUCK.PGND" to="net.GND" />
      <trace from="L_V5_BUCK.V5_SENSE_IN" to="R_V5_SENSE.V5_SENSE_IN" />
      <trace from="R_V5_SENSE.V5" to="net.V5" />
      <trace from="L_V5_BUCK.V5_SENSE_IN" to="U_POWER_MONITOR.VIN_P" />
      <trace from="net.V5" to="U_POWER_MONITOR.VIN_N" />
      <trace from="U_POWER_MONITOR.GND" to="net.GND" />
      <trace from="U_POWER_MONITOR.V3_3" to="net.V3_3" />
      <trace from="U_APP_REGULATOR.VIN" to="net.V5" />
      <trace from="U_APP_REGULATOR.EN_UVLO" to="net.V5" />
      <trace from="U_APP_REGULATOR.SW" to="L_APP_REGULATOR.SW" />
      <trace from="L_APP_REGULATOR.V3_3" to="net.V3_3" />
      <trace from="U_APP_REGULATOR.VOUT_FB" to="net.V3_3" />
      <trace from="U_APP_REGULATOR.GND" to="net.GND" />
      <trace from="C_V5_BUCK_IN_HF.pin1" to="U_V5_BUCK.VIN" />
      <trace from="C_V5_BUCK_IN_HF.pin2" to="net.GND" />
      <trace from="U_V5_BUCK.BOOT" to="C_V5_BUCK_BOOT.pin1" />
      <trace from="C_V5_BUCK_BOOT.pin2" to="U_V5_BUCK.SW" />
      <trace from="C_V5_BUCK_OUT_A.V5" to="net.V5" />
      <trace from="C_V5_BUCK_OUT_A.GND" to="net.GND" />
      <trace from="net.V5" to="R_V5_BUCK_FB_TOP.pin1" />
      <trace from="R_V5_BUCK_FB_TOP.pin2" to="U_V5_BUCK.FB" />
      <trace from="U_V5_BUCK.FB" to="R_V5_BUCK_FB_BOTTOM.pin1" />
      <trace from="R_V5_BUCK_FB_BOTTOM.pin2" to="net.GND" />

      <trace from="U_ESP32.APP_SPI_SCK" to="R_COMM_SCK_SERIES.pin1" />
      <trace from="R_COMM_SCK_SERIES.pin2" to="J_CTRL_CARRIER.W5500_SCK" />
      <trace from="J_CTRL_CARRIER.W5500_SCK" to="R_COMM_SCK_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_SCK_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="R_COMM_MOSI_SERIES.pin1" />
      <trace from="R_COMM_MOSI_SERIES.pin2" to="J_CTRL_CARRIER.W5500_MOSI" />
      <trace from="J_CTRL_CARRIER.W5500_MOSI" to="R_COMM_MOSI_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_MOSI_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="U_ESP32.APP_SPI_MISO" to="J_CTRL_CARRIER.W5500_MISO" />
      <trace from="J_CTRL_CARRIER.W5500_MISO" to="R_COMM_MISO_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_MISO_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="U_ESP32.ETH_CS" to="R_COMM_CS_SERIES.pin1" />
      <trace from="R_COMM_CS_SERIES.pin2" to="J_CTRL_CARRIER.W5500_CS_N" />
      <trace from="J_CTRL_CARRIER.W5500_CS_N" to="R_COMM_CS_N_DEFAULT_HIGH.pin1" />
      <trace from="R_COMM_CS_N_DEFAULT_HIGH.pin2" to="net.V3_3" />
      {(["GND_1", "GND_2", "GND_3", "GND_4", "GND_5"] as const).map((pin) => (
        <trace key={pin} from={`J_CTRL_CARRIER.${pin}`} to="net.GND" />
      ))}
      <trace from="J_CTRL_CARRIER.COMM_RESET_ASSERT" to="R_COMM_RESET_ASSERT_DEFAULT_LOW.pin1" />
      <trace from="J_CTRL_CARRIER.COMM_RESET_ASSERT" to="TP_COMM_RESET_ASSERT.COMM_RESET_ASSERT_TEST_ONLY" />
      <trace from="R_COMM_RESET_ASSERT_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="J_CTRL_CARRIER.COMM_PRESENT_N" to="R_COMM_PRESENT_N_ABSENT_PULLUP.pin1" />
      <trace from="R_COMM_PRESENT_N_ABSENT_PULLUP.pin2" to="net.V3_3" />
      <trace from="J_CTRL_CARRIER.COMM_PRESENT_N" to="TP_COMM_PRESENT_N.COMM_PRESENT_N" />
      <trace from="J_CTRL_CARRIER.W5500_INT_N" to="R_COMM_INT_N_IDLE_PULLUP.pin1" />
      <trace from="R_COMM_INT_N_IDLE_PULLUP.pin2" to="net.V3_3" />
      <trace from="J_CTRL_CARRIER.W5500_INT_N" to="TP_COMM_INT_N.W5500_INT_N_POLLING_ONLY" />

      {hub75Signals.flatMap(([espSignal, buffer, input, output, panel]) => [
        <trace key={`${espSignal}-input`} from={`U_ESP32.${espSignal}`} to={`${buffer}.${input}`} />,
        <trace key={`${espSignal}-output`} from={`${buffer}.${output}`} to={`J_HUB75.${panel}`} />,
        <trace
          key={`${espSignal}-bias-input`}
          from={`${buffer}.${input}`}
          to={espSignal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP.pin1" : `R_${espSignal}_PD.pin1`}
        />,
        <trace
          key={`${espSignal}-bias-return`}
          from={espSignal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP.pin2" : `R_${espSignal}_PD.pin2`}
          to={espSignal === "HUB75_OE_N" ? "net.V3_3" : "net.APP_GND"}
        />
      ])}
      <trace from="net.V5" to="J_DISPLAY_DISCONNECT.V5_SOURCE" />
      <trace from="J_DISPLAY_DISCONNECT.V5_DISPLAY_LIMITED" to="J_LINK_DISPLAY.V5_DISPLAY_LIMITED_IN" />
      <trace from="J_LINK_DISPLAY.V5_DISPLAY_LIMITED_OUT" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_A.DIR_TO_PANEL" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_B.DIR_TO_PANEL" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_A.V5" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_B.V5" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_BUFFER_A.GND" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_B.GND" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_A.V5" to="C_HUB75_BUF_A_BYPASS.pin1" />
      <trace from="C_HUB75_BUF_A_BYPASS.pin2" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_B.V5" to="C_HUB75_BUF_B_BYPASS.pin1" />
      <trace from="C_HUB75_BUF_B_BYPASS.pin2" to="net.APP_GND" />
      <trace from="U_DISPLAY_BUFFER_B.OE_N_OUT" to="R_HUB75_PANEL_OE_PULLUP.pin1" />
      <trace from="R_HUB75_PANEL_OE_PULLUP.pin2" to="net.V5_DISPLAY_LIMITED" />
      {(["A6", "A7", "A8"] as const).map((input) => (
        <trace key={input} from={`U_DISPLAY_BUFFER_B.UNUSED_${input}_PD`} to={`R_HUB75_UNUSED_B_${input}_PD.pin1`} />
      ))}
      {(["A6", "A7", "A8"] as const).map((input) => (
        <trace key={`${input}-gnd`} from={`R_HUB75_UNUSED_B_${input}_PD.pin2`} to="net.APP_GND" />
      ))}
      {(["GND1", "GND2", "GND3"] as const).map((pin) => (
        <trace key={pin} from={`J_HUB75.${pin}`} to="net.APP_GND" />
      ))}
      {(["A", "B"] as const).flatMap((bank) => [
        <trace
          key={`${bank}-en`}
          from={`U_DISPLAY_BUFFER_${bank}.BUFFER_ENABLE_N`}
          to={`R_BUFFER_${bank}_ENABLE_PULLUP.pin1`}
        />,
        <trace key={`${bank}-up`} from={`R_BUFFER_${bank}_ENABLE_PULLUP.pin2`} to="net.V5_DISPLAY_LIMITED" />,
        <trace
          key={`${bank}-drain`}
          from={`Q_DISPLAY_BUFFER_${bank}_ENABLE.D`}
          to={`U_DISPLAY_BUFFER_${bank}.BUFFER_ENABLE_N`}
        />,
        <trace key={`${bank}-source`} from={`Q_DISPLAY_BUFFER_${bank}_ENABLE.S`} to="net.APP_GND" />,
        <trace key={`${bank}-reset`} from="U_ESP32.EN_RESET" to={`R_BUFFER_${bank}_GATE.pin1`} />,
        <trace key={`${bank}-gate`} from={`R_BUFFER_${bank}_GATE.pin2`} to={`Q_DISPLAY_BUFFER_${bank}_ENABLE.G`} />,
        <trace
          key={`${bank}-gate-pd`}
          from={`Q_DISPLAY_BUFFER_${bank}_ENABLE.G`}
          to={`R_BUFFER_${bank}_GATE_PD.pin1`}
        />,
        <trace key={`${bank}-gate-gnd`} from={`R_BUFFER_${bank}_GATE_PD.pin2`} to="net.APP_GND" />
      ])}

      <trace from="U_ESP32.WD_KICK" to="U_ESP_WATCHDOG.WDI" />
      <trace from="U_ESP_WATCHDOG.V3_3" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.GND" to="net.GND" />
      <trace from="U_ESP_WATCHDOG.EN" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.SET1" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.CWD" to="R_ESP_WD_CWD.pin1" />
      <trace from="R_ESP_WD_CWD.pin2" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.ENOUT" to="U_ESP_WATCHDOG.RESET" />
      <trace from="C_ESP_WD_BYPASS.pin1" to="net.V3_3" />
      <trace from="C_ESP_WD_BYPASS.pin2" to="net.GND" />
      <trace from="U_ESP_SUPERVISOR.SENSE" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.V3_3" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.GND" to="net.GND" />
      <trace from="U_ESP_SUPERVISOR.MR" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.CT" to="C_ESP_SUPERVISOR_CT.pin1" />
      <trace from="C_ESP_SUPERVISOR_CT.pin2" to="net.GND" />
      <trace from="C_ESP_SUPERVISOR_BYPASS.pin1" to="net.V3_3" />
      <trace from="C_ESP_SUPERVISOR_BYPASS.pin2" to="net.GND" />
      <trace from="U_ESP_WATCHDOG.RESET" to="U_ESP32.EN_RESET" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_ESP32.EN_RESET" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_AUDIO.RESET_N" />
      <trace from="U_ESP32.I2C_SDA" to="U_RTC.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_RTC.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_SECURE_ELEMENT.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_SECURE_ELEMENT.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_POWER_MONITOR.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_POWER_MONITOR.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_AUDIO.I2C_SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_AUDIO.I2C_SCL" />
      <trace from="U_ESP32.I2S_BCLK" to="U_AUDIO.I2S_BCLK" />
      <trace from="U_ESP32.I2S_WCLK" to="U_AUDIO.I2S_WCLK" />
      <trace from="U_ESP32.I2S_DIN" to="U_AUDIO.I2S_DIN" />
      <trace from="U_ESP32.APP_SPI_SCK" to="U_FRAM.SCK" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="U_FRAM.MOSI" />
      <trace from="U_ESP32.APP_SPI_MISO" to="U_FRAM.MISO" />
      <trace from="U_ESP32.FRAM_CS" to="U_FRAM.CS" />
      <trace from="U_FRAM.WP" to="R_FRAM_WP_PULLUP.pin1" />
      <trace from="R_FRAM_WP_PULLUP.pin2" to="net.V3_3" />
      <trace from="U_FRAM.HOLD" to="R_FRAM_HOLD_PULLUP.pin1" />
      <trace from="R_FRAM_HOLD_PULLUP.pin2" to="net.V3_3" />
      <trace from="U_AUDIO.SPK_P" to="J_SPEAKER.SPK_P" />
      <trace from="U_AUDIO.SPK_N" to="J_SPEAKER.SPK_N" />
      <trace from="U_AUDIO.V5" to="net.V5" />
      <trace from="U_AUDIO.V3_3" to="net.V3_3" />
      <trace from="U_AUDIO.GND" to="net.GND" />
      <trace from="U_AUDIO.AVSS" to="net.GND" />
      <trace from="U_AUDIO.DVSS" to="net.GND" />
      <trace from="U_AUDIO.DVDD" to="net.V3_3" />
      <trace from="U_FRAM.V3_3" to="net.V3_3" />
      <trace from="U_FRAM.GND" to="net.GND" />
      <trace from="U_RTC.V3_3" to="net.V3_3" />
      <trace from="U_RTC.GND" to="net.GND" />
      <trace from="U_SECURE_ELEMENT.V3_3" to="net.V3_3" />
      <trace from="U_SECURE_ELEMENT.GND" to="net.GND" />
      <trace from="U_ESP32.V3_3" to="net.V3_3" />
      <trace from="U_ESP32.GND" to="net.GND" />
      <trace from="U_ESP32.GND_2" to="net.GND" />
      <trace from="U_ESP32.EPAD_GND" to="net.GND" />
    </board>
  )
}
